/**
 * Cross-Transport Parity Test
 *
 * Ensures that debug operations produce identical results across:
 * - STDIO transport
 * - Streamable HTTP transport
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import * as path from 'path';
import * as fs from 'fs/promises';

const runStressTests = process.env.RUN_STRESS_TESTS === 'true';
const describeStress = runStressTests ? describe : describe.skip;

const TEST_TIMEOUT = 60000;
const PROJECT_ROOT = process.cwd();

interface DebugSequenceResult {
  sessionCreated: boolean;
  sessionId?: string;
  breakpointSet: boolean;
  debugStarted: boolean;
  stackFrames?: any[];
  stackFrameCount: number;
  variables?: any[];
  variableCount: number;
  errors: string[];
}

interface TransportTestResult {
  transport: string;
  success: boolean;
  result?: DebugSequenceResult;
  error?: string;
}

class TransportTester {
  private httpServer: ChildProcess | null = null;

  async setupHttpTransport(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = spawn('node', [
        path.join(PROJECT_ROOT, 'dist', 'index.js'),
        'http',
        '-p', port.toString(),
        '--log-level', 'error'
      ], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: PROJECT_ROOT
      });

      const timeout = setTimeout(() => {
        clearInterval(checkReady);
        if (this.httpServer && !this.httpServer.killed) {
          this.httpServer.kill('SIGKILL');
        }
        reject(new Error('HTTP server startup timeout'));
      }, 15000);

      // Wait for server to be ready
      const checkReady = setInterval(async () => {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/health`);
          if (response.ok) {
            clearInterval(checkReady);
            clearTimeout(timeout);
            resolve();
          }
        } catch {
          // Server not ready yet
        }
      }, 500);

      this.httpServer.on('error', (err) => {
        clearInterval(checkReady);
        clearTimeout(timeout);
        reject(err);
      });

      // If the child exits before becoming ready (e.g. EADDRINUSE on a port
      // collision), surface the real failure immediately instead of waiting
      // out the full startup timeout.
      let stderrBuf = '';
      this.httpServer.stderr?.on('data', (d) => { stderrBuf += d.toString(); });
      this.httpServer.on('exit', (code) => {
        if (code !== null && code !== 0) {
          clearInterval(checkReady);
          clearTimeout(timeout);
          reject(new Error(`HTTP server exited (code ${code}) before ready: ${stderrBuf.trim()}`));
        }
      });
    });
  }
  
  async teardownHttp(): Promise<void> {
    if (this.httpServer) {
      this.httpServer.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!this.httpServer.killed) {
        this.httpServer.kill('SIGKILL');
      }
      this.httpServer = null;
    }
  }

  async runDebugSequence(client: Client): Promise<DebugSequenceResult> {
    const result: DebugSequenceResult = {
      sessionCreated: false,
      breakpointSet: false,
      debugStarted: false,
      stackFrameCount: 0,
      variableCount: 0,
      errors: []
    };

    try {
      // 1. Create debug session
      console.log('  Creating debug session...');
      const createResult = await client.callTool({
        name: 'create_debug_session',
        arguments: {
          language: 'javascript',
          name: 'Cross-Transport Test'
        }
      });

      const createResponse = this.parseToolResponse(createResult);
      if (createResponse.success && createResponse.sessionId) {
        result.sessionCreated = true;
        result.sessionId = createResponse.sessionId;
        console.log(`  ✓ Session created: ${result.sessionId}`);
      } else {
        throw new Error('Failed to create session');
      }

      // 2. Set breakpoint
      const testScript = path.join(PROJECT_ROOT, 'examples', 'javascript', 'simple_test.js');
      
      // Ensure test script exists
      const scriptExists = await fs.access(testScript).then(() => true).catch(() => false);
      if (!scriptExists) {
        throw new Error(`Test script not found: ${testScript}`);
      }

      console.log('  Setting breakpoint...');
      const bpResult = await client.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId: result.sessionId,
          file: testScript,
          line: 11
        }
      });

      const bpResponse = this.parseToolResponse(bpResult);
      if (bpResponse.success) {
        result.breakpointSet = true;
        console.log('  ✓ Breakpoint set');
      }

      // 3. Start debugging
      console.log('  Starting debug session...');
      const startResult = await client.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId: result.sessionId,
          scriptPath: testScript,
          args: []
        }
      });

      const startResponse = this.parseToolResponse(startResult);
      if (startResponse.success) {
        result.debugStarted = true;
        console.log('  ✓ Debug session started');
      }

      // Wait a bit for the debugger to hit the breakpoint
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 4. Get stack trace
      console.log('  Getting stack trace...');
      const stackResult = await client.callTool({
        name: 'get_stack_trace',
        arguments: {
          sessionId: result.sessionId
        }
      });

      const stackResponse = this.parseToolResponse(stackResult);
      if (stackResponse.success && stackResponse.stackFrames) {
        result.stackFrames = stackResponse.stackFrames;
        result.stackFrameCount = stackResponse.stackFrames.length;
        console.log(`  ✓ Stack trace retrieved: ${result.stackFrameCount} frames`);
      }

      // 5. Get local variables
      console.log('  Getting local variables...');
      const varsResult = await client.callTool({
        name: 'get_local_variables',
        arguments: {
          sessionId: result.sessionId
        }
      });

      const varsResponse = this.parseToolResponse(varsResult);
      if (varsResponse.success && varsResponse.variables) {
        result.variables = varsResponse.variables;
        result.variableCount = varsResponse.variables.length;
        console.log(`  ✓ Variables retrieved: ${result.variableCount} variables`);
      }

      // 6. Clean up
      console.log('  Closing session...');
      await client.callTool({
        name: 'close_debug_session',
        arguments: {
          sessionId: result.sessionId
        }
      });
      console.log('  ✓ Session closed');

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      console.error('  ✗ Error:', error);
    }

    return result;
  }

  async testStdioTransport(): Promise<TransportTestResult> {
    console.log('\nTesting STDIO transport...');
    try {
      const client = new Client({
        name: 'cross-transport-stdio-test',
        version: '1.0.0'
      });

      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [
          path.join(PROJECT_ROOT, 'dist', 'index.js'),
          'stdio',
          '--log-level', 'error'
        ]
      });

      await client.connect(transport);
      console.log('  Connected via STDIO');

      const result = await this.runDebugSequence(client);
      
      await client.close();

      return {
        transport: 'STDIO',
        success: result.errors.length === 0,
        result
      };
    } catch (error) {
      return {
        transport: 'STDIO',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async testHttpTransport(): Promise<TransportTestResult> {
    console.log('\nTesting HTTP transport...');
    try {
      const port = 4500 + Math.floor(Math.random() * 500);
      await this.setupHttpTransport(port);

      const client = new Client({
        name: 'cross-transport-http-test',
        version: '1.0.0'
      });

      const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
      await client.connect(transport);
      console.log('  Connected via Streamable HTTP');

      const result = await this.runDebugSequence(client);

      await client.close();

      return {
        transport: 'HTTP',
        success: result.errors.length === 0,
        result
      };
    } catch (error) {
      return {
        transport: 'HTTP',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      await this.teardownHttp();
    }
  }

  private parseToolResponse(response: any): any {
    if (!response || !response.content || !response.content[0] || !response.content[0].text) {
      return { success: false, error: 'Invalid response format' };
    }
    
    try {
      return JSON.parse(response.content[0].text);
    } catch {
      return { success: false, error: 'Failed to parse response' };
    }
  }
}

describeStress('Cross-Transport Parity Tests', () => {
  let tester: TransportTester;

  beforeAll(() => {
    tester = new TransportTester();
  });

  afterAll(async () => {
    await tester.teardownHttp();
  });

  it('should produce identical results across transports', async () => {
    const results: TransportTestResult[] = [];
    
    // Test STDIO transport
    const stdioResult = await tester.testStdioTransport();
    results.push(stdioResult);
    
    // Test HTTP transport
    const httpResult = await tester.testHttpTransport();
    results.push(httpResult);
    
    // Display results summary
    console.log('\n========== RESULTS SUMMARY ==========');
    for (const result of results) {
      console.log(`${result.transport}: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
      if (result.result) {
        console.log(`  - Session created: ${result.result.sessionCreated}`);
        console.log(`  - Breakpoint set: ${result.result.breakpointSet}`);
        console.log(`  - Debug started: ${result.result.debugStarted}`);
        console.log(`  - Stack frames: ${result.result.stackFrameCount}`);
        console.log(`  - Variables: ${result.result.variableCount}`);
        if (result.result.errors.length > 0) {
          console.log(`  - Errors: ${result.result.errors.join(', ')}`);
        }
      }
      if (result.error) {
        console.log(`  - Error: ${result.error}`);
      }
    }
    console.log('====================================\n');
    
    // All transports should succeed
    const allSucceeded = results.every(r => r.success);
    expect(allSucceeded).toBe(true);
    
    // Compare results for parity
    if (results.length >= 2 && allSucceeded) {
      const stdioData = results.find(r => r.transport === 'STDIO')?.result;
      const httpData = results.find(r => r.transport === 'HTTP')?.result;
      
      if (stdioData && httpData) {
        // Key metrics should match
        expect(httpData.sessionCreated).toBe(stdioData.sessionCreated);
        expect(httpData.breakpointSet).toBe(stdioData.breakpointSet);
        expect(httpData.debugStarted).toBe(stdioData.debugStarted);
        
        // Stack frames should be similar (allowing for minor differences)
        expect(httpData.stackFrameCount).toBeGreaterThan(0);
        expect(stdioData.stackFrameCount).toBeGreaterThan(0);
        expect(Math.abs(httpData.stackFrameCount - stdioData.stackFrameCount)).toBeLessThanOrEqual(1);
        
        // Variables should match
        expect(httpData.variableCount).toBe(stdioData.variableCount);
      }
    }
  }, TEST_TIMEOUT);
});
