#!/usr/bin/env node
/**
 * JavaScript SSE timing test harness
 * 
 * This reproduces the critical issue where JavaScript debugging in SSE mode
 * returns empty stack frames due to child session creation timing.
 * 
 * JavaScript uses a multi-session architecture where:
 * 1. Parent session acts as coordinator
 * 2. Child sessions handle actual debugging
 * 3. Commands like stackTrace are routed to child sessions
 * 
 * In SSE mode, rapid stackTrace requests arrive before child sessions are created.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Test configuration
const SSE_PORT = 3001;
const SSE_URL = `http://localhost:${SSE_PORT}/sse`;
const LOG_FILE = path.join(__dirname, '../../logs/javascript-sse-timing-test.log');

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Simple logger
const log = (message, data = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = data 
        ? `${timestamp} - ${message}: ${JSON.stringify(data, null, 2)}\n`
        : `${timestamp} - ${message}\n`;
    
    console.log(logEntry);
    fs.appendFileSync(LOG_FILE, logEntry);
};

// Helper to make JSON-RPC requests
async function makeRequest(sessionId, method, params = {}, id = null) {
    const requestId = id || Math.floor(Math.random() * 100000);
    const body = JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: requestId
    });

    const url = sessionId ? `${SSE_URL}?sessionId=${sessionId}` : SSE_URL;
    
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (e) {
                    reject(new Error(`Invalid JSON response: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// Establish SSE connection and capture events
function connectSSE() {
    return new Promise((resolve, reject) => {
        log('Connecting to SSE server...');
        
        const events = [];
        let sessionId = null;
        
        const req = http.get(SSE_URL, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`SSE connection failed with status ${res.statusCode}`));
                return;
            }

            let buffer = '';
            
            res.on('data', (chunk) => {
                buffer += chunk.toString();
                
                // Parse SSE messages
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            // Log all events for diagnostics
                            events.push({
                                timestamp: Date.now(),
                                data
                            });
                            
                            if (data.sessionId && !sessionId) {
                                sessionId = data.sessionId;
                                log(`SSE session established: ${sessionId}`);
                                
                                // Don't resolve immediately - keep capturing events
                                setTimeout(() => {
                                    resolve({ 
                                        sessionId, 
                                        connection: res,
                                        events
                                    });
                                }, 100);
                            }
                        } catch (e) {
                            // Not JSON, ignore
                        }
                    }
                }
            });
            
            res.on('error', reject);
        });
        
        req.on('error', reject);
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('SSE connection timeout'));
        });
    });
}

// Test scenario: JavaScript debugging with timing that triggers the issue
async function testJavaScriptSSETiming() {
    let sessionId;
    let sessionConnection;
    let sseEvents;
    
    try {
        // 1. Connect to SSE
        const sseResult = await connectSSE();
        sessionId = sseResult.sessionId;
        sessionConnection = sseResult.connection;
        sseEvents = sseResult.events;
        
        log(`Connected with session ID: ${sessionId}`);
        log(`Initial SSE events captured: ${sseEvents.length}`);
        
        // 2. Initialize connection
        const initResult = await makeRequest(sessionId, 'initialize', {
            protocolVersion: '0.1.0',
            capabilities: {}
        });
        log('Initialize response', initResult);
        
        // 3. Create a JavaScript debug session
        const createResult = await makeRequest(sessionId, 'create_debug_session', {
            language: 'javascript',  // Critical: must be JavaScript
            name: 'js-sse-timing-test'
        });
        log('Create session response', createResult);
        
        const debugSessionId = createResult.result?.id;
        if (!debugSessionId) {
            throw new Error('Failed to get debug session ID');
        }
        
        // 4. Create test script
        const testScript = path.join(__dirname, 'test_script.js');
        fs.writeFileSync(testScript, `
// Simple JavaScript test file for SSE timing issue
function main() {
    const a = 1;
    const b = 2;
    const c = a + b;  // Set breakpoint here (line 5)
    console.log('Result:', c);
    
    // Do some work to keep the debugger active
    for (let i = 0; i < 3; i++) {
        console.log('Iteration', i);
    }
    
    return c;
}

main();
`);
        
        // 5. Set a breakpoint
        const bpResult = await makeRequest(sessionId, 'set_breakpoint', {
            sessionId: debugSessionId,
            file: testScript,
            line: 5,  // Line with: const c = a + b;
        });
        log('Set breakpoint response', bpResult);
        
        // 6. Start debugging (should pause at breakpoint or entry)
        const startResult = await makeRequest(sessionId, 'start_debugging', {
            sessionId: debugSessionId,
            scriptPath: testScript,
            dapLaunchArgs: {
                stopOnEntry: false,  // Go directly to breakpoint
                justMyCode: true
            }
        });
        log('Start debugging response', startResult);
        
        // 7. CRITICAL TIMING: Multiple rapid requests that expose the issue
        // This mimics what happens in real SSE usage
        
        log('=== CRITICAL TIMING SEQUENCE START ===');
        
        // Small delay to let js-debug start processing
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Rapid sequence that triggers the issue
        const testSequence = async () => {
            const results = {};
            
            // Try to get stack trace immediately (might fail if child not ready)
            log('Attempt 1: Immediate stack trace...');
            try {
                const stack1 = await makeRequest(sessionId, 'get_stack_trace', {
                    sessionId: debugSessionId,
                    includeInternals: false
                });
                results.immediate = stack1;
                log('Immediate stack trace result', stack1);
            } catch (e) {
                results.immediate = { error: e.message };
                log('Immediate stack trace failed', e.message);
            }
            
            // Try local variables (internally uses stack trace)
            log('Attempt 2: Get local variables...');
            try {
                const vars1 = await makeRequest(sessionId, 'get_local_variables', {
                    sessionId: debugSessionId
                });
                results.locals = vars1;
                log('Local variables result', vars1);
            } catch (e) {
                results.locals = { error: e.message };
                log('Local variables failed', e.message);
            }
            
            // Wait a bit for child session
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try stack trace again after delay
            log('Attempt 3: Stack trace after 1s delay...');
            try {
                const stack2 = await makeRequest(sessionId, 'get_stack_trace', {
                    sessionId: debugSessionId,
                    includeInternals: false
                });
                results.afterDelay = stack2;
                log('Stack trace after delay', stack2);
            } catch (e) {
                results.afterDelay = { error: e.message };
                log('Stack trace after delay failed', e.message);
            }
            
            // Wait more for child session establishment
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Final attempt
            log('Attempt 4: Stack trace after 3s total delay...');
            try {
                const stack3 = await makeRequest(sessionId, 'get_stack_trace', {
                    sessionId: debugSessionId,
                    includeInternals: false
                });
                results.final = stack3;
                log('Final stack trace', stack3);
            } catch (e) {
                results.final = { error: e.message };
                log('Final stack trace failed', e.message);
            }
            
            return results;
        };
        
        const testResults = await testSequence();
        
        log('=== CRITICAL TIMING SEQUENCE END ===');
        
        // Analyze results
        log('\n=== ANALYSIS ===');
        
        const hasImmediateFrames = testResults.immediate?.result && 
            Array.isArray(testResults.immediate.result) && 
            testResults.immediate.result.length > 0;
            
        const hasDelayedFrames = testResults.afterDelay?.result && 
            Array.isArray(testResults.afterDelay.result) && 
            testResults.afterDelay.result.length > 0;
            
        const hasFinalFrames = testResults.final?.result && 
            Array.isArray(testResults.final.result) && 
            testResults.final.result.length > 0;
        
        log('Results summary:', {
            immediateStackFrames: hasImmediateFrames,
            delayedStackFrames: hasDelayedFrames,
            finalStackFrames: hasFinalFrames,
            immediateFrameCount: testResults.immediate?.result?.length || 0,
            delayedFrameCount: testResults.afterDelay?.result?.length || 0,
            finalFrameCount: testResults.final?.result?.length || 0
        });
        
        if (!hasImmediateFrames && (hasDelayedFrames || hasFinalFrames)) {
            log('❌ BUG CONFIRMED: Empty stack frames on immediate request, works after delay');
            log('This confirms the JavaScript SSE timing issue with child session creation');
        } else if (hasImmediateFrames) {
            log('✅ Bug appears to be fixed! Stack frames available immediately');
        } else {
            log('⚠️ Unexpected: No stack frames even after delays');
        }
        
        // 8. Continue execution
        await makeRequest(sessionId, 'continue_execution', {
            sessionId: debugSessionId
        });
        
        // 9. Close session
        await makeRequest(sessionId, 'close_debug_session', {
            sessionId: debugSessionId
        });
        
        log('Test completed successfully');
        
    } catch (error) {
        log('Test failed', error.message);
        console.error(error);
    } finally {
        // Clean up
        if (sessionConnection) {
            sessionConnection.destroy();
        }
        
        // Clean up test script
        const testScript = path.join(__dirname, 'test_script.js');
        if (fs.existsSync(testScript)) {
            fs.unlinkSync(testScript);
        }
    }
}

// Check if SSE server is running
async function checkServerRunning() {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${SSE_PORT}/health`, (res) => {
            resolve(res.statusCode === 200);
        });
        
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// Main test runner
async function main() {
    log('=== JavaScript SSE Timing Test Harness ===');
    log(`Log file: ${LOG_FILE}`);
    log('This test reproduces the JavaScript debugging issue in SSE mode where');
    log('rapid stackTrace requests arrive before child sessions are created.');
    log('');
    
    // Check if server is running
    const serverRunning = await checkServerRunning();
    if (!serverRunning) {
        log('ERROR: SSE server is not running on port 3001');
        log('Please start it with: npm run start:sse or scripts/start-sse-server.cmd');
        process.exit(1);
    }
    
    log('SSE server is running, starting test...');
    log('');
    
    // Run the test
    await testJavaScriptSSETiming();
    
    log('');
    log('Test harness complete. Check logs for details.');
    log(`Full log available at: ${LOG_FILE}`);
    process.exit(0);
}

// Run the test
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
