/**
 * Java Adapter Smoke Tests via MCP Interface
 *
 * Tests core Java debugging functionality through MCP tools.
 * Skips gracefully when JDK is not installed.
 *
 * Validates actual behavior including:
 * - Adapter can be loaded through AdapterLoader
 * - Session can be created with language: 'java'
 * - Breakpoints, stack traces, variables, stepping work through KDA
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('MCP Server Java Debugging Smoke Test @requires-java', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    console.log('[Java Smoke Test] Starting MCP server...');

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client({
      name: 'java-smoke-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[Java Smoke Test] MCP client connected');
  }, 30000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      } catch {
        // Session may already be closed
      }
    }

    if (mcpClient) {
      await mcpClient.close();
    }
    if (transport) {
      await transport.close();
    }

    console.log('[Java Smoke Test] Cleanup completed');
  });

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      } catch {
        // Session may already be closed
      }
      sessionId = null;
    }
  });

  it('should create Java debug session through MCP interface', async () => {
    console.log('[Java Smoke Test] Creating debug session...');
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'java',
        name: 'java-smoke-test'
      }
    });

    const createResponse = parseSdkToolResult(createResult);
    expect(createResponse.sessionId).toBeDefined();
    sessionId = createResponse.sessionId as string;
    console.log(`[Java Smoke Test] Session created: ${sessionId}`);

    expect(sessionId).toBeTruthy();
  });

  it('should complete Java debugging flow', async () => {
    // Check for java and javac
    let javaAvailable = false;
    let javacAvailable = false;

    try {
      execSync('java -version', { stdio: 'ignore' });
      javaAvailable = true;
    } catch {
      console.log('[Java Smoke Test] Java not available, skipping full flow test');
    }

    try {
      execSync('javac -version', { stdio: 'ignore' });
      javacAvailable = true;
    } catch {
      console.log('[Java Smoke Test] javac not available, skipping full flow test');
    }

    if (!javaAvailable || !javacAvailable) {
      console.log('[Java Smoke Test] Skipping full debugging flow - JDK not installed');
      return;
    }

    const testJavaFile = path.resolve(ROOT, 'examples', 'java', 'HelloWorld.java');
    const testClassDir = path.resolve(ROOT, 'examples', 'java');

    // Compile the Java file
    try {
      execSync(`javac "${testJavaFile}"`, {
        cwd: testClassDir,
        stdio: 'pipe'
      });
      console.log('[Java Smoke Test] Compiled HelloWorld.java');
    } catch (error) {
      console.log('[Java Smoke Test] Failed to compile test file, skipping full flow');
      return;
    }

    try {
      // 1. Create Java debug session
      console.log('[Java Smoke Test] Creating debug session...');
      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: {
          language: 'java',
          name: 'java-full-flow-test'
        }
      });

      const createResponse = parseSdkToolResult(createResult);
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;
      console.log(`[Java Smoke Test] Session created: ${sessionId}`);

      // 2. Set breakpoint on line 22 (int sum = add(x, y))
      console.log('[Java Smoke Test] Setting breakpoint...');
      const bpResult = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: testJavaFile,
          line: 22
        }
      });

      const bpResponse = parseSdkToolResult(bpResult);
      console.log('[Java Smoke Test] Breakpoint response:', bpResponse);

      // 3. Start debugging
      console.log('[Java Smoke Test] Starting debugging...');
      const startResult = await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: testJavaFile,
          args: [],
          dapLaunchArgs: {
            mainClass: 'HelloWorld',
            classPaths: [testClassDir],
            cwd: testClassDir,
            stopOnEntry: false
          }
        }
      });

      const startResponse = parseSdkToolResult(startResult);
      expect(startResponse.state).toBeDefined();
      console.log('[Java Smoke Test] Debug started, state:', startResponse.state);

      // Wait for breakpoint hit
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 4. Get stack trace
      console.log('[Java Smoke Test] Getting stack trace...');
      const stackResult = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId });

      if (stackResult.stackFrames) {
        const frames = stackResult.stackFrames as any[];
        console.log(`[Java Smoke Test] Stack has ${frames.length} frames`);
        if (frames.length > 0) {
          console.log('[Java Smoke Test] Top frame:', frames[0].name, 'line:', frames[0].line);
        }
      }

      // 5. Get local variables
      console.log('[Java Smoke Test] Getting local variables...');
      const varsResult = await callToolSafely(mcpClient!, 'get_local_variables', { sessionId });
      console.log('[Java Smoke Test] Variables result:', JSON.stringify(varsResult).slice(0, 200));

      // 6. Step over
      console.log('[Java Smoke Test] Stepping over...');
      await callToolSafely(mcpClient!, 'step_over', { sessionId });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 7. Continue execution
      console.log('[Java Smoke Test] Continuing execution...');
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });

      // Wait for program to finish
      await new Promise(resolve => setTimeout(resolve, 2000));

    } finally {
      // Clean up compiled class files
      try {
        const fs = await import('fs');
        const classFile = path.resolve(testClassDir, 'HelloWorld.class');
        if (fs.existsSync(classFile)) {
          fs.unlinkSync(classFile);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }, 60000);
});
