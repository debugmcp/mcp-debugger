#!/usr/bin/env node

/**
 * Test script to verify the SSE JavaScript debugging fix
 * This tests the timing issue where stackTrace was called before the child session was active
 */

const { spawn } = require('child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');
const path = require('path');

const PORT = 3100; // Use a specific port for testing

async function waitForPort(port, maxAttempts = 30) {
  const net = require('net');
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection(port, 'localhost');
        socket.on('connect', () => {
          socket.end();
          resolve();
        });
        socket.on('error', reject);
        socket.setTimeout(1000);
      });
      return true;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`Port ${port} not ready after ${maxAttempts} attempts`);
}

async function runTest() {
  let serverProcess = null;
  let client = null;
  let sessionId = null;

  try {
    console.log('🚀 Starting SSE server on port', PORT);
    
    // Start the SSE server
    serverProcess = spawn('node', [
      path.join(__dirname, 'dist', 'index.js'),
      'sse',
      '-p', PORT.toString(),
      '--log-level', 'debug'
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: __dirname
    });

    // Capture server output
    serverProcess.stdout.on('data', (data) => {
      console.log('[SSE Server]', data.toString().trim());
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error('[SSE Server Error]', data.toString().trim());
    });

    // Wait for server to be ready
    console.log('⏳ Waiting for server to be ready...');
    await waitForPort(PORT);
    console.log('✅ Server is ready');

    // Connect MCP client via SSE
    console.log('🔌 Connecting MCP client via SSE...');
    client = new Client({
      name: 'test-sse-js-debug-fix',
      version: '1.0.0'
    });
    
    const transport = new SSEClientTransport(new URL(`http://localhost:${PORT}/sse`));
    await client.connect(transport);
    console.log('✅ MCP client connected');

    // Create debug session for JavaScript
    console.log('\n📝 Creating JavaScript debug session...');
    const createResult = await client.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'javascript',
        name: 'SSE JS Debug Fix Test'
      }
    });
    
    sessionId = createResult.content?.[0]?.text ? 
      JSON.parse(createResult.content[0].text).sessionId : 
      null;
    
    if (!sessionId) {
      throw new Error('Failed to create debug session');
    }
    console.log('✅ Debug session created:', sessionId);

    // Set a breakpoint
    const scriptPath = path.join(__dirname, 'examples', 'javascript', 'simple_test.js');
    console.log('\n🎯 Setting breakpoint at line 11 in', scriptPath);
    
    const bpResult = await client.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId,
        file: scriptPath,
        line: 11
      }
    });
    console.log('✅ Breakpoint set');

    // Start debugging
    console.log('\n▶️ Starting debug session...');
    const startResult = await client.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath,
        args: []
      }
    });
    console.log('✅ Debug session started');

    // The critical test: Get stack trace immediately
    // This is where the bug occurred - stackTrace was called before child was active
    console.log('\n🔍 Getting stack trace (this is where the bug occurred)...');
    
    const stackResult = await client.callTool({
      name: 'get_stack_trace',
      arguments: {
        sessionId
      }
    });
    
    const stackContent = stackResult.content?.[0]?.text;
    const stackData = stackContent ? JSON.parse(stackContent) : {};
    
    console.log('📊 Stack trace result:', JSON.stringify(stackData, null, 2));
    
    // Check if we got stack frames
    if (stackData.stackFrames && stackData.stackFrames.length > 0) {
      console.log('✅ SUCCESS: Stack trace retrieved with', stackData.stackFrames.length, 'frame(s)');
      console.log('✅ The timing issue has been fixed!');
      
      // Also get local variables to fully test the fix
      console.log('\n🔍 Getting local variables...');
      const varsResult = await client.callTool({
        name: 'get_local_variables',
        arguments: {
          sessionId
        }
      });
      
      const varsContent = varsResult.content?.[0]?.text;
      const varsData = varsContent ? JSON.parse(varsContent) : {};
      console.log('📊 Variables:', JSON.stringify(varsData, null, 2));
      
      if (varsData.variables && varsData.variables.length > 0) {
        console.log('✅ Local variables retrieved successfully');
      }
      
    } else {
      console.error('❌ FAILURE: No stack frames returned');
      console.error('The timing issue still exists - child session not ready');
      process.exit(1);
    }

    // Clean up
    console.log('\n🧹 Cleaning up...');
    if (sessionId) {
      await client.callTool({
        name: 'close_debug_session',
        arguments: { sessionId }
      });
      console.log('✅ Debug session closed');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (client) {
      try {
        await client.close();
      } catch {}
    }
    
    if (serverProcess) {
      const exited = new Promise(resolve => {
        serverProcess.on('exit', resolve);
      });
      serverProcess.kill('SIGTERM');
      // Give it a moment to shut down gracefully
      const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), 3000));
      const result = await Promise.race([exited, timeout]);
      if (result === 'timeout') {
        serverProcess.kill('SIGKILL');
      }
    }
    
    console.log('\n✅ Test completed');
  }
}

// Run the test
runTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
