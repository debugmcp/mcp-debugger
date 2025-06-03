/**
 * MCP Native Tool Test for debug-mcp-server
 * 
 * This test script exercises the debug-mcp-server tools through the MCP protocol,
 * simulating how an LLM would use the tools to debug a Python script.
 */

const fetch = require('node-fetch');
const path = require('path');

// Configuration
const MCP_SERVER_URL = 'http://localhost:3000'; // Adjust if your server runs on a different port
const TEST_SCRIPT_PATH = path.resolve(__dirname, '../examples/python/fibonacci.py');
const SERVER_NAME = 'debug-mcp-server'; // The MCP server name

// Utility function to call an MCP tool
async function callTool(toolName, args) {
    console.log(`\n----- Calling tool: ${toolName} -----`);
    console.log('Arguments:', JSON.stringify(args, null, 2));
    
    try {
        const response = await fetch(`${MCP_SERVER_URL}/mcp-tool`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                server_name: SERVER_NAME,
                tool_name: toolName,
                arguments: args
            }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Response:', JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error(`Error calling tool ${toolName}:`, error);
        throw error;
    }
}

// Sleep function for waiting between steps if needed
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Main test function
async function runTest() {
    console.log('=== Starting MCP debug test ===');
    console.log(`Test script: ${TEST_SCRIPT_PATH}`);
    
    try {
        // Step 1: Create a debug session
        console.log('\n--- Step 1: Create a debug session ---');
        const createSessionResult = await callTool('create_debug_session', {
            language: 'python',
            name: 'Fibonacci Test'
        });
        
        if (!createSessionResult.success) {
            throw new Error('Failed to create debug session');
        }
        
        const sessionId = createSessionResult.sessionId;
        console.log(`Session created with ID: ${sessionId}`);
        
        // Step 2: Set a breakpoint on the buggy calculation
        console.log('\n--- Step 2: Set a breakpoint ---');
        const breakpointResult = await callTool('set_breakpoint', {
            sessionId: sessionId,
            file: TEST_SCRIPT_PATH,
            line: 38, // Line with the buggy_value calculation
        });
        
        if (!breakpointResult.success) {
            throw new Error('Failed to set breakpoint');
        }
        
        console.log(`Breakpoint set at ${TEST_SCRIPT_PATH}:38`);
        
        // Step 3: Start debugging
        console.log('\n--- Step 3: Start debugging ---');
        const startResult = await callTool('start_debugging', {
            sessionId: sessionId,
            scriptPath: TEST_SCRIPT_PATH
        });
        
        if (!startResult.success) {
            throw new Error('Failed to start debugging');
        }
        
        console.log('Debugging started, waiting for breakpoint to be hit...');
        
        // Brief pause to allow execution to reach the breakpoint
        await sleep(1000);
        
        // Step 4: Get variables at the breakpoint
        console.log('\n--- Step 4: Get variables ---');
        const variablesResult = await callTool('get_variables', {
            sessionId: sessionId
        });
        
        console.log('Variables at breakpoint:');
        console.log(JSON.stringify(variablesResult, null, 2));
        
        // Step 5: Evaluate an expression
        console.log('\n--- Step 5: Evaluate expression ---');
        const evaluateResult = await callTool('evaluate_expression', {
            sessionId: sessionId,
            expression: 'fibonacci_iterative(n)'
        });
        
        console.log('Evaluation result:');
        console.log(JSON.stringify(evaluateResult, null, 2));
        
        // Step 6: Step over
        console.log('\n--- Step 6: Step over ---');
        const stepOverResult = await callTool('step_over', {
            sessionId: sessionId
        });
        
        if (!stepOverResult.success) {
            throw new Error('Failed to step over');
        }
        
        console.log('Stepped over to next line');
        
        // Step 7: Get stack trace
        console.log('\n--- Step 7: Get stack trace ---');
        const stackTraceResult = await callTool('get_stack_trace', {
            sessionId: sessionId
        });
        
        console.log('Stack trace:');
        console.log(JSON.stringify(stackTraceResult, null, 2));
        
        // Step 8: Continue execution
        console.log('\n--- Step 8: Continue execution ---');
        const continueResult = await callTool('continue_execution', {
            sessionId: sessionId
        });
        
        if (!continueResult.success) {
            throw new Error('Failed to continue execution');
        }
        
        console.log('Continued execution');
        
        // Step 9: Close the debug session
        console.log('\n--- Step 9: Close debug session ---');
        const closeResult = await callTool('close_debug_session', {
            sessionId: sessionId
        });
        
        if (!closeResult.success) {
            throw new Error('Failed to close debug session');
        }
        
        console.log('Debug session closed successfully');
        
        console.log('\n=== Test completed successfully ===');
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
runTest().catch(error => {
    console.error('Unhandled error in test:', error);
    process.exit(1);
});
