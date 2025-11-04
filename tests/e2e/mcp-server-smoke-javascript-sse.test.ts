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
  waitForPort,
  parseSdkToolResult
} from './smoke-test-utils.js';

const TEST_TIMEOUT = 60000; // 60 seconds for all operations (JavaScript may need more time in SSE mode)

let mcpSdkClient: Client | null = null;
let sseServerProcess: ChildProcess | null = null;
let serverPort: number | null = null;
const projectRoot = process.cwd();

describe('MCP Server E2E JavaScript SSE Test', () => {
  // Ensure server is killed even if test fails
  afterEach(async () => {
    console.log('[JS SSE Test] Cleaning up...');
    
    // Close MCP client
    if (mcpSdkClient) {
      try {
        await mcpSdkClient.close();
        console.log('[JS SSE Test] MCP client closed');
      } catch (e) {
        console.error('[JS SSE Test] Error closing MCP client:', e);
      }
      mcpSdkClient = null;
    }
    
    // Kill SSE server process with graceful shutdown
    if (sseServerProcess) {
      try {
        // First try graceful shutdown with SIGTERM
        const proc = sseServerProcess;
        if (proc && !proc.killed) {
          console.log('[JS SSE Test] Attempting graceful shutdown with SIGTERM...');
          proc.kill('SIGTERM');
          
          // Wait up to 2 seconds for graceful shutdown
          const gracefulShutdownTimeout = 2000;
          const shutdownStart = Date.now();
          
          await new Promise<void>((resolve) => {
            const checkInterval = setInterval(() => {
              if (!proc || proc.killed || Date.now() - shutdownStart > gracefulShutdownTimeout) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
          });
          
          // If still not killed, use SIGKILL
          if (proc && !proc.killed) {
            console.log('[JS SSE Test] Graceful shutdown failed, using SIGKILL...');
            proc.kill('SIGKILL');
          } else {
            console.log('[JS SSE Test] Server shut down gracefully');
          }
        }
        
        // Wait a bit for process to fully terminate and release resources
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('[JS SSE Test] SSE server process terminated');
      } catch (e) {
        console.error('[JS SSE Test] Error killing SSE server:', e);
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
            console.log(`[JS SSE Test] Port ${port} is unavailable (${err.code}), trying another...`);
            tryPort();
          } else {
            reject(err);
          }
        });
        
        server.once('listening', () => {
          server.close(() => {
            console.log(`[JS SSE Test] Found available port: ${port}`);
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
          console.log(`[JS SSE Test] Starting SSE server on port ${port} (attempt ${attempt}/${maxRetries})...`);
          if (options.cwd) {
            console.log(`[JS SSE Test] Working directory: ${options.cwd}`);
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
              console.error('[JS SSE Test] Server startup timeout after 30 seconds');
              console.error('[JS SSE Test] Stdout:', stdout);
              console.error('[JS SSE Test] Stderr:', stderr);
              reject(new Error(`Timeout waiting for SSE server to start on port ${port}`));
            }
          }, TEST_TIMEOUT);
          
          // Listen for server output to confirm it started
          const handleStdout = (data: Buffer) => {
            const output = data.toString();
            stdout += output;
            console.log('[JS SSE Server Stdout]', output.trim());
          };
          
          const handleStderr = (data: Buffer) => {
            const output = data.toString();
            stderr += output;
            console.error('[JS SSE Server Stderr]', output.trim());
            
            // Check for EACCES error specifically
            if (output.includes('EACCES') && output.includes('permission denied')) {
              hasStarted = true; // Prevent timeout error
              clearTimeout(timeout);
              reject(new Error(`EACCES: Permission denied on port ${port}`));
            }
          };
          
          sseServerProcess.stdout?.on('data', handleStdout);
          sseServerProcess.stderr?.on('data', handleStderr);

          // Also consider the server ready once the port is accepting connections
          void (async () => {
            try {
              const ok = await waitForPort(port, TEST_TIMEOUT);
              if (ok && !hasStarted) {
                hasStarted = true;
                clearTimeout(timeout);
                console.log(`[JS SSE Test] Port check succeeded; server ready on ${port}`);
                resolve(port);
              }
            } catch {
              // Ignore; failure paths (exit/timeout) will handle rejection with context
            }
          })();
          
          sseServerProcess.on('error', (err) => {
            hasStarted = true; // Prevent timeout error
            clearTimeout(timeout);
            console.error('[JS SSE Test] Failed to spawn server process:', err);
            reject(err);
          });
          
          sseServerProcess.on('exit', (code, signal) => {
            if (!hasStarted) {
              clearTimeout(timeout);
              console.error(`[JS SSE Test] Server exited unexpectedly with code ${code}, signal ${signal}`);
              console.error('[JS SSE Test] Stdout:', stdout);
              console.error('[JS SSE Test] Stderr:', stderr);
              reject(new Error(`SSE server exited with code ${code}`));
            }
          });
        });
      } catch (error) {
        lastError = error as Error;
        console.error(`[JS SSE Test] Attempt ${attempt} failed:`, error);
        
        // Clean up the failed process
        if (sseServerProcess) {
          sseServerProcess.kill();
          sseServerProcess = null;
          await new Promise(resolve => setTimeout(resolve, 500)); // Give it time to clean up
        }
        
        // If it's an EACCES error and we have more retries, try again with a new port
        if ((error as any).message?.includes('EACCES') && attempt < maxRetries) {
          console.log(`[JS SSE Test] Retrying with a different port...`);
          continue;
        }
        
        // Otherwise, throw the error
        throw error;
      }
    }
    
    throw lastError || new Error('Failed to start SSE server after all retries');
  }

  /**
   * Execute JavaScript debug sequence - reproduces the reported issue
   */
  interface ExecuteSequenceOptions {
    launchArgs?: {
      stopOnEntry?: boolean;
      justMyCode?: boolean;
    } | null;
    stackTraceBeforeLocals?: boolean;
  }

  async function executeJavaScriptDebugSequence(
    client: Client, 
    scriptPath: string,
    sessionName: string,
    options: ExecuteSequenceOptions = {}
  ): Promise<{ success: boolean; sessionId?: string; errorMessage?: string }> {
    let sessionId: string | undefined;
    const { launchArgs = undefined } = options;
    const stackTraceBeforeLocals = options.stackTraceBeforeLocals !== false;
    
    try {
      console.log(`[JS SSE Test] Starting debug sequence for ${scriptPath}`);
      
      // 1. Create debug session for JavaScript
      const createSessionResult = await client.callTool({
        name: 'create_debug_session',
        arguments: { 
          language: 'javascript',
          name: sessionName 
        }
      });
      const createResponse = parseSdkToolResult(createSessionResult);
      sessionId = typeof createResponse.sessionId === 'string' ? createResponse.sessionId : undefined;
      if (!sessionId) {
        throw new Error('Failed to create debug session');
      }

      console.log(`[JS SSE Test] Created debug session: ${sessionId}`);

      // 2. Set breakpoint at line 11 in simple_test.js
      const breakpointResult = await client.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: scriptPath,
          line: 11 // Line with: [a, b] = [b, a];
        }
      });
      const breakpointResponse = parseSdkToolResult(breakpointResult);
      console.log('[JS SSE Test] Breakpoint response:', breakpointResponse);
      if (breakpointResponse.success !== true) {
        return {
          success: false,
          sessionId,
          errorMessage: `Failed to set breakpoint: ${JSON.stringify(breakpointResponse)}`
        };
      }

      // 3. Start debugging
      const startArguments: Record<string, unknown> = {
        sessionId,
        scriptPath,
        args: []
      };

      if (launchArgs !== null) {
        startArguments.dapLaunchArgs = launchArgs ?? {
          stopOnEntry: false,
          justMyCode: true
        };
      }

      const startResult = await client.callTool({
        name: 'start_debugging',
        arguments: startArguments
      });
      const startResponse = parseSdkToolResult(startResult);
      console.log('[JS SSE Test] Start debugging result:', startResponse);
      if (startResponse.success !== true) {
        return {
          success: false,
          sessionId,
          errorMessage: `Failed to start debugging: ${JSON.stringify(startResponse)}`
        };
      }

      // 4. Poll for stack trace availability instead of sleeping
      let stackResponse: Record<string, unknown> = {};
      let stackFrames: Array<Record<string, unknown>> = [];

      const fetchStackTrace = async () => {
        const stackResult = await client.callTool({
          name: 'get_stack_trace',
          arguments: {
            sessionId
          }
        });
        stackResponse = parseSdkToolResult(stackResult);
        stackFrames = Array.isArray(stackResponse.stackFrames)
          ? (stackResponse.stackFrames as Array<Record<string, unknown>>)
          : [];
        console.log(`[JS SSE Test] Stack frames count: ${stackFrames.length}`);
        console.log(`[JS SSE Test] Stack frames:`, JSON.stringify(stackResponse, null, 2));
      };

      const waitForStackTrace = async (timeoutMs = 2500, intervalMs = 150) => {
        const deadline = Date.now() + timeoutMs;
        let attempts = 0;
        while (Date.now() < deadline) {
          attempts += 1;
          await fetchStackTrace();
          if (stackFrames.length > 0) {
            console.log(`[JS SSE Test] Stack trace ready after ${attempts} attempt(s).`);
            return;
          }
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        // One last fetch to capture final state before throwing
        await fetchStackTrace();
        throw new Error('Stack trace did not populate before timeout');
      };

      if (stackTraceBeforeLocals) {
        await waitForStackTrace();
      }

      // Additional resilience check: wait a few seconds and ensure the session still reports frames.
      console.log('[JS SSE Test] Waiting before requesting additional debug data...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // 6. Retrieve local variables (may trigger stack trace internally)
      const varsResult = await client.callTool({
        name: 'get_local_variables',
        arguments: {
          sessionId
        }
      });
      const varsResponse = parseSdkToolResult(varsResult);
      const variables = Array.isArray(varsResponse.variables)
        ? varsResponse.variables as Array<Record<string, unknown>>
        : [];
      console.log(`[JS SSE Test] Variables count: ${variables.length}`);
      console.log(`[JS SSE Test] Variables:`, JSON.stringify(varsResponse, null, 2));

      if (!stackTraceBeforeLocals) {
        // Capture stack trace after locals so we can validate frames
        await fetchStackTrace();
      }

      // Check if we have the expected results
      const hasStackFrames = stackFrames.length > 0;
      const hasVariables = variables.length > 0;

      if (!hasStackFrames) {
        return {
          success: false,
          sessionId,
          errorMessage: `No stack frames returned: ${JSON.stringify(stackResponse)}`
        };
      }

      if (!hasVariables) {
        return {
          success: false,
          sessionId,
          errorMessage: `No variables returned: ${JSON.stringify(varsResponse)}`
        };
      }

      return { success: true, sessionId };

    } catch (error) {
      console.error(`[JS SSE Test] Error during debug sequence:`, error);
      return {
        success: false,
        sessionId,
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  it('should successfully debug JavaScript via SSE transport', async () => {
    let debugSessionId: string | undefined;
    
    try {
      // 1. Start SSE server
      serverPort = await startSSEServer();
      
      // 2. Wait for server to be ready
      console.log(`[JS SSE Test] Checking server health on port ${serverPort}...`);
      const serverReady = await waitForPort(serverPort, TEST_TIMEOUT);
      if (!serverReady) {
        throw new Error(`Server health check failed on port ${serverPort}`);
      }
      console.log('[JS SSE Test] Server health check passed');
      
      // 3. Create MCP client and connect using SSE transport
      console.log('[JS SSE Test] Connecting MCP SDK client via SSE...');
      mcpSdkClient = new Client({ 
        name: "e2e-javascript-sse-test-client", 
        version: "0.1.0" 
      });
      
      const sseUrl = new URL(`http://localhost:${serverPort}/sse`);
      const transport = new SSEClientTransport(sseUrl);
      
      await mcpSdkClient.connect(transport);
      console.log('[JS SSE Test] MCP SDK Client connected via SSE.');

      // 4. Execute JavaScript debug sequence
      const simpleTestPath = path.join(projectRoot, 'examples', 'javascript', 'simple_test.js');
      const result = await executeJavaScriptDebugSequence(
        mcpSdkClient,
        simpleTestPath,
        'JS SSE Bug Reproduction Test',
        { launchArgs: undefined, stackTraceBeforeLocals: true }
      );
      
      debugSessionId = result.sessionId;
      
      // After our fix, JavaScript debugging should work in SSE mode
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      
      if (!result.success) {
        console.error('[JS SSE Test] JavaScript debugging failed unexpectedly:', result.errorMessage);
      } else {
        console.log('[JS SSE Test] JavaScript debugging working correctly in SSE mode!');
      }
      
    } catch (error) {
      console.error('[JS SSE Test] Test failed with error:', error);
      throw error;
    } finally {
      // 5. Cleanup
      if (debugSessionId && mcpSdkClient) {
        try {
          await mcpSdkClient.callTool({ 
            name: 'close_debug_session', 
            arguments: { sessionId: debugSessionId } 
          });
          console.log(`[JS SSE Test] Debug session ${debugSessionId} closed.`);
        } catch (e) {
          console.error(`[JS SSE Test] Error closing debug session ${debugSessionId}:`, e);
        }
      }
    }
  }, TEST_TIMEOUT);

  it('should provide stack trace without overriding launch args (stopOnEntry default)', async () => {
    let debugSessionId: string | undefined;
    
    try {
      serverPort = await startSSEServer();
      const serverReady = await waitForPort(serverPort, TEST_TIMEOUT);
      if (!serverReady) {
        throw new Error(`Server health check failed on port ${serverPort}`);
      }

      mcpSdkClient = new Client({ 
        name: "e2e-javascript-sse-default-launch",
        version: "0.1.0" 
      });

      const sseUrl = new URL(`http://localhost:${serverPort}/sse`);
      const transport = new SSEClientTransport(sseUrl);
      await mcpSdkClient.connect(transport);

      const simpleTestPath = path.join(projectRoot, 'examples', 'javascript', 'simple_test.js');
      const result = await executeJavaScriptDebugSequence(
        mcpSdkClient,
        simpleTestPath,
        'JS SSE Default LaunchArgs Test',
        { launchArgs: null, stackTraceBeforeLocals: false }
      );

      debugSessionId = result.sessionId;
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();

    } finally {
      if (debugSessionId && mcpSdkClient) {
        try {
          await mcpSdkClient.callTool({ 
            name: 'close_debug_session', 
            arguments: { sessionId: debugSessionId } 
          });
        } catch (e) {
          console.error(`[JS SSE Test] Error closing debug session ${debugSessionId}:`, e);
        }
      }
    }
  }, TEST_TIMEOUT);
});
