/**
 * @jest-environment node
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import {
  executeDebugSequence,
  waitForPort
} from './smoke-test-utils.js';

const TEST_TIMEOUT = 30000; // 30 seconds for all operations

let mcpSdkClient: Client | null = null;
let sseServerProcess: ChildProcess | null = null;
let serverPort: number | null = null;
const projectRoot = process.cwd();

describe('MCP Server E2E SSE Smoke Test', () => {
  // Ensure server is killed even if test fails
  afterEach(async () => {
    console.log('[SSE Smoke Test] Cleaning up...');
    
    // Close MCP client
    if (mcpSdkClient) {
      try {
        await mcpSdkClient.close();
        console.log('[SSE Smoke Test] MCP client closed');
      } catch (e) {
        console.error('[SSE Smoke Test] Error closing MCP client:', e);
      }
      mcpSdkClient = null;
    }
    
    // Kill SSE server process with graceful shutdown
    if (sseServerProcess) {
      try {
        // First try graceful shutdown with SIGTERM
        if (!sseServerProcess.killed) {
          console.log('[SSE Smoke Test] Attempting graceful shutdown with SIGTERM...');
          sseServerProcess.kill('SIGTERM');
          
          // Wait up to 2 seconds for graceful shutdown
          const gracefulShutdownTimeout = 2000;
          const shutdownStart = Date.now();
          
          await new Promise<void>((resolve) => {
            const checkInterval = setInterval(() => {
              if (sseServerProcess!.killed || Date.now() - shutdownStart > gracefulShutdownTimeout) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
          });
          
          // If still not killed, use SIGKILL
          if (!sseServerProcess.killed) {
            console.log('[SSE Smoke Test] Graceful shutdown failed, using SIGKILL...');
            sseServerProcess.kill('SIGKILL');
          } else {
            console.log('[SSE Smoke Test] Server shut down gracefully');
          }
        }
        
        // Wait a bit for process to fully terminate and release resources
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('[SSE Smoke Test] SSE server process terminated');
      } catch (e) {
        console.error('[SSE Smoke Test] Error killing SSE server:', e);
      }
      sseServerProcess = null;
    }
    
    serverPort = null;
  });

  /**
   * Find an available port by trying to bind to it
   */
  async function findAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const maxAttempts = 10;
      let attempts = 0;
      
      const tryPort = () => {
        if (attempts >= maxAttempts) {
          reject(new Error('Could not find an available port after 10 attempts'));
          return;
        }
        
        attempts++;
        const port = Math.floor(Math.random() * (65535 - 49152)) + 49152;
        const server = net.createServer();
        
        server.once('error', (err: any) => {
          if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
            console.log(`[SSE Smoke Test] Port ${port} is unavailable (${err.code}), trying another...`);
            tryPort();
          } else {
            reject(err);
          }
        });
        
        server.once('listening', () => {
          server.close(() => {
            console.log(`[SSE Smoke Test] Found available port: ${port}`);
            // Add a small delay to ensure Windows fully releases the port
            setTimeout(() => resolve(port), 200);
          });
        });
        
        server.listen(port);
      };
      
      tryPort();
    });
  }

  /**
   * Start SSE server with comprehensive logging and error handling
   */
  async function startSSEServer(options: { cwd?: string, env?: NodeJS.ProcessEnv } = {}, maxRetries: number = 3): Promise<number> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const port = await findAvailablePort();
        
        return await new Promise((resolve, reject) => {
          console.log(`[SSE Smoke Test] Starting SSE server on port ${port} (attempt ${attempt}/${maxRetries})...`);
          if (options.cwd) {
            console.log(`[SSE Smoke Test] Working directory: ${options.cwd}`);
          }
          
          // Collect all server output for debugging
          let stdout = '';
          let stderr = '';
          let hasStarted = false;
          
          // Start server with specific port
          sseServerProcess = spawn(process.execPath, [
            path.join(projectRoot, 'dist', 'index.js'),
            'sse',
            '-p', port.toString(),
            '--log-level', 'debug'
          ], {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: options.cwd,
            env: options.env || process.env
          });
          
          // Set a timeout for the entire startup process
          const timeout = setTimeout(() => {
            if (!hasStarted) {
              console.error('[SSE Smoke Test] Server startup timeout after 30 seconds');
              console.error('[SSE Smoke Test] Stdout:', stdout);
              console.error('[SSE Smoke Test] Stderr:', stderr);
              reject(new Error(`Timeout waiting for SSE server to start on port ${port}`));
            }
          }, TEST_TIMEOUT);
          
          // Listen for server output to confirm it started
          const handleStdout = (data: Buffer) => {
            const output = data.toString();
            stdout += output;
            console.log('[SSE Server Stdout]', output.trim());
            
            // Look for the server ready message
            if (output.includes('listening') || output.includes('started')) {
              hasStarted = true;
              clearTimeout(timeout);
              console.log(`[SSE Smoke Test] Server confirmed started on port ${port}`);
              resolve(port);
            }
          };
          
          const handleStderr = (data: Buffer) => {
            const output = data.toString();
            stderr += output;
            console.error('[SSE Server Stderr]', output.trim());
            
            // Check for EACCES error specifically
            if (output.includes('EACCES') && output.includes('permission denied')) {
              hasStarted = true; // Prevent timeout error
              clearTimeout(timeout);
              reject(new Error(`EACCES: Permission denied on port ${port}`));
            }
          };
          
          sseServerProcess.stdout?.on('data', handleStdout);
          sseServerProcess.stderr?.on('data', handleStderr);
          
          sseServerProcess.on('error', (err) => {
            hasStarted = true; // Prevent timeout error
            clearTimeout(timeout);
            console.error('[SSE Smoke Test] Failed to spawn server process:', err);
            reject(err);
          });
          
          sseServerProcess.on('exit', (code, signal) => {
            if (!hasStarted) {
              clearTimeout(timeout);
              console.error(`[SSE Smoke Test] Server exited unexpectedly with code ${code}, signal ${signal}`);
              console.error('[SSE Smoke Test] Stdout:', stdout);
              console.error('[SSE Smoke Test] Stderr:', stderr);
              reject(new Error(`SSE server exited with code ${code}`));
            }
          });
        });
      } catch (error) {
        lastError = error as Error;
        console.error(`[SSE Smoke Test] Attempt ${attempt} failed:`, error);
        
        // Clean up the failed process
        if (sseServerProcess) {
          sseServerProcess.kill();
          sseServerProcess = null;
          await new Promise(resolve => setTimeout(resolve, 500)); // Give it time to clean up
        }
        
        // If it's an EACCES error and we have more retries, try again with a new port
        if ((error as any).message?.includes('EACCES') && attempt < maxRetries) {
          console.log(`[SSE Smoke Test] Retrying with a different port...`);
          continue;
        }
        
        // Otherwise, throw the error
        throw error;
      }
    }
    
    throw lastError || new Error('Failed to start SSE server after all retries');
  }

  it('should successfully debug fibonacci.py via SSE transport', async () => {
    let debugSessionId: string | undefined;
    
    try {
      // 1. Start SSE server
      serverPort = await startSSEServer();
      
      // 2. Wait for server to be ready (health check)
      console.log(`[SSE Smoke Test] Checking server health on port ${serverPort}...`);
      const serverReady = await waitForPort(serverPort, TEST_TIMEOUT);
      if (!serverReady) {
        throw new Error(`Server health check failed on port ${serverPort}`);
      }
      console.log('[SSE Smoke Test] Server health check passed');
      
      // 3. Create MCP client and connect using SSE transport
      console.log('[SSE Smoke Test] Connecting MCP SDK client via SSE...');
      mcpSdkClient = new Client({ 
        name: "e2e-sse-smoke-test-client", 
        version: "0.1.0" 
      });
      
      const sseUrl = new URL(`http://localhost:${serverPort}/sse`);
      const transport = new SSEClientTransport(sseUrl);
      
      await mcpSdkClient.connect(transport);
      console.log('[SSE Smoke Test] MCP SDK Client connected via SSE.');

      // 4. Execute debug sequence
      const fibonacciPath = path.join(projectRoot, 'examples', 'python', 'fibonacci.py');
      const result = await executeDebugSequence(
        mcpSdkClient,
        fibonacciPath,
        'E2E SSE Smoke Test Session'
      );
      
      expect(result.success).toBe(true);
      debugSessionId = result.sessionId;
      console.log('[SSE Smoke Test] Debug sequence completed successfully.');
      
    } catch (error) {
      console.error('[SSE Smoke Test] Test failed with error:', error);
      throw error;
    } finally {
      // 5. Cleanup
      if (debugSessionId && mcpSdkClient) {
        try {
          await mcpSdkClient.callTool({ 
            name: 'close_debug_session', 
            arguments: { sessionId: debugSessionId } 
          });
          console.log(`[SSE Smoke Test] Debug session ${debugSessionId} closed.`);
        } catch (e) {
          console.error(`[SSE Smoke Test] Error closing debug session ${debugSessionId}:`, e);
        }
      }
    }
  }, TEST_TIMEOUT);

  // Test spawning the server from a different working directory
  it('should work when SSE server is spawned from different working directory', async () => {
    const tempDir = os.tmpdir();
    console.log(`[SSE Smoke Test] Testing server spawn from temp directory: ${tempDir}`);
    
    let debugSessionId: string | undefined;
    
    try {
      // 1. Start SSE server from temp directory
      serverPort = await startSSEServer({ 
        cwd: tempDir
      });
      
      // 2. Wait for server to be ready (health check)
      console.log(`[SSE Smoke Test] Checking server health on port ${serverPort}...`);
      const serverReady = await waitForPort(serverPort, TEST_TIMEOUT);
      if (!serverReady) {
        // Additional debugging when health check fails
        if (sseServerProcess && !sseServerProcess.killed) {
          console.error('[SSE Smoke Test] Server process is still running but health check failed');
        } else {
          console.error('[SSE Smoke Test] Server process has exited');
        }
        throw new Error(`Server health check failed on port ${serverPort}`);
      }
      console.log('[SSE Smoke Test] Server health check passed');
      
      // 3. Create MCP client and connect
      console.log('[SSE Smoke Test] Connecting MCP SDK client via SSE...');
      mcpSdkClient = new Client({ 
        name: "e2e-sse-smoke-test-client-tempdir", 
        version: "0.1.0" 
      });
      
      const sseUrl = new URL(`http://localhost:${serverPort}/sse`);
      const transport = new SSEClientTransport(sseUrl);
      
      await mcpSdkClient.connect(transport);
      console.log('[SSE Smoke Test] MCP SDK Client connected via SSE from temp directory.');

      // 4. Execute debug sequence
      const fibonacciPath = path.join(projectRoot, 'examples', 'python', 'fibonacci.py');
      const result = await executeDebugSequence(
        mcpSdkClient,
        fibonacciPath,
        'E2E SSE Smoke Test Session (Temp Dir)'
      );
      
      expect(result.success).toBe(true);
      debugSessionId = result.sessionId;
      console.log('[SSE Smoke Test] Debug sequence completed successfully from temp directory.');

    } catch (error) {
      console.error('[SSE Smoke Test] Test failed with error:', error);
      throw error;
    } finally {
      // Cleanup
      if (debugSessionId && mcpSdkClient) {
        try {
          await mcpSdkClient.callTool({ 
            name: 'close_debug_session', 
            arguments: { sessionId: debugSessionId } 
          });
          console.log(`[SSE Smoke Test] Debug session ${debugSessionId} closed.`);
        } catch (e) {
          console.error(`[SSE Smoke Test] Error closing debug session ${debugSessionId}:`, e);
        }
      }
    }
  }, TEST_TIMEOUT);
});
