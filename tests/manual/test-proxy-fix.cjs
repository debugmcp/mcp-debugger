#!/usr/bin/env node

/**
 * Manual test script to verify the proxy startup fix
 * This simulates how the main server spawns the proxy
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('[Test] Starting proxy startup test...');
console.log('[Test] Working directory:', process.cwd());

// Path to the compiled proxy bootstrap
const proxyPath = path.join(__dirname, '../../dist/proxy/proxy-bootstrap.js');
console.log('[Test] Proxy path:', proxyPath);

// Spawn the proxy with IPC, similar to how the server does it
const proxy = spawn('node', [proxyPath], {
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  env: {
    ...process.env,
    MCP_SERVER_CWD: process.cwd(),
    // Ensure test variables are NOT set
    NODE_ENV: undefined,
    VITEST: undefined
  }
});

// Collect output
let stderr = '';
proxy.stderr.on('data', (data) => {
  const output = data.toString();
  stderr += output;
  console.log('[Proxy stderr]', output.trim());
});

// Handle messages from proxy
proxy.on('message', (message) => {
  console.log('[Test] Received message from proxy:', message);
});

// Set up timeout
const timeout = setTimeout(() => {
  console.error('[Test] TIMEOUT: Proxy did not start within 5 seconds');
  console.error('[Test] Final stderr:', stderr);
  proxy.kill();
  process.exit(1);
}, 5000);

// Check for successful startup
proxy.stderr.on('data', (data) => {
  const output = data.toString();
  
  if (output.includes('Ready to receive commands')) {
    clearTimeout(timeout);
    console.log('\n[Test] ✅ SUCCESS: Proxy started correctly!');
    console.log('[Test] Detection results found in output:');
    
    const detectionMatch = stderr.match(/Detection results: (.+)/);
    if (detectionMatch) {
      console.log('  ', detectionMatch[0]);
    }
    
    // Send a test init command
    console.log('\n[Test] Sending test init command...');
    proxy.send(JSON.stringify({
      cmd: 'init',
      sessionId: 'test-manual',
      pythonPath: 'python',
      adapterHost: 'localhost',
      adapterPort: 5678,
      logDir: './logs',
      scriptPath: path.resolve('test-script.py'),
      dryRunSpawn: true
    }));
    
    // Wait a bit for response, then exit
    setTimeout(() => {
      console.log('\n[Test] Test completed successfully');
      proxy.kill();
      process.exit(0);
    }, 2000);
  }
  
  if (output.includes('Running as imported module (test mode)')) {
    clearTimeout(timeout);
    console.error('\n[Test] ❌ FAILURE: Proxy incorrectly detected test mode!');
    console.error('[Test] This indicates the regression is not fixed.');
    proxy.kill();
    process.exit(1);
  }
});

// Handle proxy exit
proxy.on('exit', (code, signal) => {
  console.log(`[Test] Proxy exited with code ${code} and signal ${signal}`);
});

// Handle errors
proxy.on('error', (err) => {
  console.error('[Test] Failed to spawn proxy:', err);
  process.exit(1);
});
