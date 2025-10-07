// Simple test to verify IPC is working
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('[Parent] Starting IPC test...');

// Spawn the proxy bootstrap with IPC
const child = spawn(process.execPath, [
  path.join(__dirname, '..', 'dist', 'proxy', 'proxy-bootstrap.js')
], {
  stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  cwd: path.join(__dirname, '..')
});

child.on('spawn', () => {
  console.log('[Parent] Child spawned with PID:', child.pid);
  console.log('[Parent] child.send type:', typeof child.send);
  console.log('[Parent] child.killed:', child.killed);
  
  // Wait a bit for the proxy to be ready
  setTimeout(() => {
    // Try to send a message
    const testMessage = {
      cmd: 'init',
      sessionId: 'test-session',
      executablePath: 'node',
      adapterHost: 'localhost',
      adapterPort: 12345,
      logDir: '.',
      scriptPath: 'test.js'
    };
    
    console.log('[Parent] Sending test message...');
    const result = child.send(testMessage);
    console.log('[Parent] send() returned:', result);
  }, 1000); // Wait 1 second
});

child.on('message', (msg) => {
  console.log('[Parent] Received message from child:', msg);
});

child.stderr.on('data', (data) => {
  console.log('[Child stderr]', data.toString());
});

child.stdout.on('data', (data) => {
  console.log('[Child stdout]', data.toString());
});

child.on('exit', (code) => {
  console.log('[Parent] Child exited with code:', code);
});

// Kill after 10 seconds to see what happens
setTimeout(() => {
  console.log('[Parent] Killing child...');
  child.kill();
}, 10000);
