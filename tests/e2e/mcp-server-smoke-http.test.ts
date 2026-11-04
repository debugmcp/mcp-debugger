import { describe, it, expect, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import { existsSync } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import {
  executeDebugSequence,
  waitForHealthEndpoint
} from './smoke-test-utils.js';

const TEST_TIMEOUT = 30000; // 30 seconds for all operations

let mcpSdkClient: Client | null = null;
let httpServerProcess: ChildProcess | null = null;
let serverPort: number | null = null;
const projectRoot = process.cwd();
let distReady = false;

describe('MCP Server E2E HTTP Smoke Test', () => {
  // Ensure server is killed even if test fails
  afterEach(async () => {
    console.log('[HTTP Smoke Test] Cleaning up...');
    
    // Close MCP client
    if (mcpSdkClient) {
      try {
        await mcpSdkClient.close();
        console.log('[HTTP Smoke Test] MCP client closed');
      } catch (e) {
        console.error('[HTTP Smoke Test] Error closing MCP client:', e);
      }
      mcpSdkClient = null;
    }
    
    // Kill HTTP server process with graceful shutdown
    if (httpServerProcess) {
      try {
        // First try graceful shutdown with SIGTERM
        const proc = httpServerProcess;
        if (proc && !proc.killed) {
          console.log('[HTTP Smoke Test] Attempting graceful shutdown with SIGTERM...');
          proc.kill('SIGTERM');
          
          // Wait up to 2 seconds for graceful shutdown
          const gracefulShutdownTimeout = 2000;
          const shutdownStart = Date.now();
          
          await new Promise<void>((resolve) => {
            const checkInterval = setInterval(() => {
              // Note: proc.killed is true as soon as a signal is sent, not when the process exits.
              // Use exitCode as a more reliable indicator of actual process termination.
              if (!proc || proc.exitCode !== null || Date.now() - shutdownStart > gracefulShutdownTimeout) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
          });
          
          // If still not killed, use SIGKILL
          if (proc && proc.exitCode === null) {
            console.log('[HTTP Smoke Test] Graceful shutdown failed, using SIGKILL...');
            proc.kill('SIGKILL');
          } else {
            console.log('[HTTP Smoke Test] Server shut down gracefully');
          }
        }
        
        // Wait a bit for process to fully terminate and release resources
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('[HTTP Smoke Test] HTTP server process terminated');
      } catch (e) {
        console.error('[HTTP Smoke Test] Error killing HTTP server:', e);
      }
      httpServerProcess = null;
    }
    
    serverPort = null;
  });

  // Fail fast if the project hasn't been built. Building is the job of the
  // `pretest:e2e:smoke` npm hook (build once), not of each test.
  function ensureDistBuild(): void {
    if (distReady) {
      return;
    }

    const distEntry = path.join(projectRoot, 'dist', 'index.js');
    if (!existsSync(distEntry)) {
      throw new Error('dist/index.js not found. Run "npm run build" first or use "npm run test:e2e:smoke".');
    }
    distReady = true;
  }

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
            console.log(`[HTTP Smoke Test] Port ${port} is unavailable (${err.code}), trying another...`);
            tryPort();
          } else {
            reject(err);
          }
        });
        
        server.once('listening', () => {
          server.close(() => {
            console.log(`[HTTP Smoke Test] Found available port: ${port}`);
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
   * Start HTTP server with comprehensive logging and error handling
   */
  async function startHttpServer(options: { cwd?: string, env?: NodeJS.ProcessEnv } = {}, maxRetries: number = 3): Promise<number> {
    let lastError: Error | null = null;
    ensureDistBuild();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const port = await findAvailablePort();
        
        return await new Promise((resolve, reject) => {
          console.log(`[HTTP Smoke Test] Starting HTTP server on port ${port} (attempt ${attempt}/${maxRetries})...`);
          if (options.cwd) {
            console.log(`[HTTP Smoke Test] Working directory: ${options.cwd}`);
          }
          
          // Collect all server output for debugging
          let stdout = '';
          let stderr = '';
          let hasStarted = false;
          
          // Start server with specific port
          httpServerProcess = spawn(process.execPath, [
            path.join(projectRoot, 'dist', 'index.js'),
            'http',
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
              console.error('[HTTP Smoke Test] Server startup timeout after 30 seconds');
              console.error('[HTTP Smoke Test] Stdout:', stdout);
              console.error('[HTTP Smoke Test] Stderr:', stderr);
              reject(new Error(`Timeout waiting for HTTP server to start on port ${port}`));
            }
          }, TEST_TIMEOUT);
          
          // Capture server output for diagnostics
          const handleStdout = (data: Buffer) => {
            const output = data.toString();
            stdout += output;
            console.log('[HTTP Server Stdout]', output.trim());
          };
          
          const handleStderr = (data: Buffer) => {
            const output = data.toString();
            stderr += output;
            console.error('[HTTP Server Stderr]', output.trim());
            
            // Check for EACCES error specifically
            if (output.includes('EACCES') && output.includes('permission denied')) {
              hasStarted = true; // Prevent timeout error
              clearTimeout(timeout);
              reject(new Error(`EACCES: Permission denied on port ${port}`));
            }
          };
          
          httpServerProcess.stdout?.on('data', handleStdout);
          httpServerProcess.stderr?.on('data', handleStderr);

          // Also consider the server ready once the port is accepting connections (deterministic readiness)
          void (async () => {
            try {
              const ok = await waitForHealthEndpoint(port, TEST_TIMEOUT);
              if (ok && !hasStarted) {
                hasStarted = true;
                clearTimeout(timeout);
                console.log(`[HTTP Smoke Test] Port check succeeded; server ready on ${port}`);
                resolve(port);
              }
            } catch {
              // Ignore; failure paths (exit/timeout) will handle rejection with context
            }
          })();
          
          httpServerProcess.on('error', (err) => {
            hasStarted = true; // Prevent timeout error
            clearTimeout(timeout);
            console.error('[HTTP Smoke Test] Failed to spawn server process:', err);
            reject(err);
          });
          
          httpServerProcess.on('exit', (code, signal) => {
            if (!hasStarted) {
              clearTimeout(timeout);
              console.error(`[HTTP Smoke Test] Server exited unexpectedly with code ${code}, signal ${signal}`);
              console.error('[HTTP Smoke Test] Stdout:', stdout);
              console.error('[HTTP Smoke Test] Stderr:', stderr);
              reject(new Error(`HTTP server exited with code ${code}`));
            }
          });
        });
      } catch (error) {
        lastError = error as Error;
        console.error(`[HTTP Smoke Test] Attempt ${attempt} failed:`, error);
        
        // Clean up the failed process
        if (httpServerProcess) {
          httpServerProcess.kill();
          httpServerProcess = null;
          await new Promise(resolve => setTimeout(resolve, 500)); // Give it time to clean up
        }
        
        // If it's an EACCES error and we have more retries, try again with a new port
        if ((error as any).message?.includes('EACCES') && attempt < maxRetries) {
          console.log(`[HTTP Smoke Test] Retrying with a different port...`);
          continue;
        }
        
        // Otherwise, throw the error
        throw error;
      }
    }
    
    throw lastError || new Error('Failed to start HTTP server after all retries');
  }

  it('should successfully debug fibonacci.py via the Streamable HTTP transport', async () => {
    let debugSessionId: string | undefined;
    
    try {
      // 1. Start HTTP server
      serverPort = await startHttpServer();
      
      // 2. Wait for server to be ready (health check)
      console.log(`[HTTP Smoke Test] Checking server health on port ${serverPort}...`);
      const serverReady = await waitForHealthEndpoint(serverPort, TEST_TIMEOUT);
      if (!serverReady) {
        throw new Error(`Server health check failed on port ${serverPort}`);
      }
      console.log('[HTTP Smoke Test] Server health check passed');
      
      // 3. Create MCP client and connect using the Streamable HTTP transport
      console.log('[HTTP Smoke Test] Connecting MCP SDK client via Streamable HTTP...');
      mcpSdkClient = new Client({ 
        name: "e2e-http-smoke-test-client", 
        version: "0.1.0" 
      });
      
      const mcpUrl = new URL(`http://127.0.0.1:${serverPort}/mcp`);
      const transport = new StreamableHTTPClientTransport(mcpUrl);
      
      await mcpSdkClient.connect(transport);
      console.log('[HTTP Smoke Test] MCP SDK Client connected via Streamable HTTP.');

      // 4. Execute debug sequence
      const fibonacciPath = path.join(projectRoot, 'examples', 'python', 'fibonacci.py');
      const result = await executeDebugSequence(
        mcpSdkClient,
        fibonacciPath,
        'E2E HTTP Smoke Test Session'
      );
      
      expect(result.success).toBe(true);
      debugSessionId = result.sessionId;
      console.log('[HTTP Smoke Test] Debug sequence completed successfully.');
      
    } catch (error) {
      console.error('[HTTP Smoke Test] Test failed with error:', error);
      throw error;
    } finally {
      // 5. Cleanup
      if (debugSessionId && mcpSdkClient) {
        try {
          await mcpSdkClient.callTool({ 
            name: 'close_debug_session', 
            arguments: { sessionId: debugSessionId } 
          });
          console.log(`[HTTP Smoke Test] Debug session ${debugSessionId} closed.`);
        } catch (e) {
          console.error(`[HTTP Smoke Test] Error closing debug session ${debugSessionId}:`, e);
        }
      }
    }
  }, TEST_TIMEOUT);

  // Test spawning the server from a different working directory
  it('should work when the HTTP server is spawned from a different working directory', async () => {
    const tempDir = os.tmpdir();
    console.log(`[HTTP Smoke Test] Testing server spawn from temp directory: ${tempDir}`);
    
    let debugSessionId: string | undefined;
    
    try {
      // 1. Start HTTP server from temp directory
      serverPort = await startHttpServer({ 
        cwd: tempDir
      });
      
      // 2. Wait for server to be ready (health check)
      console.log(`[HTTP Smoke Test] Checking server health on port ${serverPort}...`);
      const serverReady = await waitForHealthEndpoint(serverPort, TEST_TIMEOUT);
      if (!serverReady) {
        // Additional debugging when health check fails
        // Note: proc.killed is true as soon as a signal is sent, not when the process exits.
        // Use exitCode as a more reliable indicator of actual process termination.
        if (httpServerProcess && httpServerProcess.exitCode === null) {
          console.error('[HTTP Smoke Test] Server process is still running but health check failed');
        } else {
          console.error('[HTTP Smoke Test] Server process has exited');
        }
        throw new Error(`Server health check failed on port ${serverPort}`);
      }
      console.log('[HTTP Smoke Test] Server health check passed');
      
      // 3. Create MCP client and connect
      console.log('[HTTP Smoke Test] Connecting MCP SDK client via Streamable HTTP...');
      mcpSdkClient = new Client({ 
        name: "e2e-http-smoke-test-client-tempdir", 
        version: "0.1.0" 
      });
      
      const mcpUrl = new URL(`http://127.0.0.1:${serverPort}/mcp`);
      const transport = new StreamableHTTPClientTransport(mcpUrl);
      
      await mcpSdkClient.connect(transport);
      console.log('[HTTP Smoke Test] MCP SDK Client connected via Streamable HTTP from temp directory.');

      // 4. Execute debug sequence
      const fibonacciPath = path.join(projectRoot, 'examples', 'python', 'fibonacci.py');
      const result = await executeDebugSequence(
        mcpSdkClient,
        fibonacciPath,
        'E2E HTTP Smoke Test Session (Temp Dir)'
      );
      
      expect(result.success).toBe(true);
      debugSessionId = result.sessionId;
      console.log('[HTTP Smoke Test] Debug sequence completed successfully from temp directory.');

    } catch (error) {
      console.error('[HTTP Smoke Test] Test failed with error:', error);
      throw error;
    } finally {
      // Cleanup
      if (debugSessionId && mcpSdkClient) {
        try {
          await mcpSdkClient.callTool({ 
            name: 'close_debug_session', 
            arguments: { sessionId: debugSessionId } 
          });
          console.log(`[HTTP Smoke Test] Debug session ${debugSessionId} closed.`);
        } catch (e) {
          console.error(`[HTTP Smoke Test] Error closing debug session ${debugSessionId}:`, e);
        }
      }
    }
  }, TEST_TIMEOUT);
});
