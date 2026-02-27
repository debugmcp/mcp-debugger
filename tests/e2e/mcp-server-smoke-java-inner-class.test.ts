/**
 * Java Inner Class Breakpoint Smoke Tests via MCP Interface
 *
 * Tests that breakpoints inside non-static inner classes fire correctly.
 * Verifies the JDI bridge's ClassPrepareRequest with "$*" suffix and
 * "$"-stripping in handleClassPrepared for inner class breakpoint resolution.
 *
 * Uses InnerClassTest.java which has a non-static inner class Inner with
 * a compute(int, int) method as the breakpoint target.
 *
 * Prerequisites:
 * - JDK installed (java + javac on PATH)
 * - javac -g for LocalVariableTable
 *
 * Skips gracefully when JDK is not installed.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fs from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

/**
 * Poll for non-empty stack frames (breakpoint hit).
 */
async function waitForPausedState(
  client: Client,
  sessionId: string,
  maxAttempts = 20,
  intervalMs = 500
): Promise<{ stackFrames?: Array<{ file?: string; name?: string; line?: number }> } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await callToolSafely(client, 'get_stack_trace', { sessionId });
    if (result.stackFrames && (result.stackFrames as any[]).length > 0) {
      return result as { stackFrames: Array<{ file?: string; name?: string; line?: number }> };
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

describe('MCP Server Java Inner Class Breakpoint Smoke Test @requires-java', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    // Check for JDK
    try {
      execSync('java -version', { stdio: 'ignore' });
      execSync('javac -version', { stdio: 'ignore' });
    } catch {
      console.log('[Java Inner Class Test] Skipping — JDK not installed');
      return;
    }

    console.log('[Java Inner Class Test] Starting MCP server...');

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client({
      name: 'java-inner-class-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[Java Inner Class Test] MCP client connected');
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

    console.log('[Java Inner Class Test] Cleanup completed');
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

  it('should hit a breakpoint inside a non-static inner class', async () => {
    // Check for JDK
    try {
      execSync('java -version', { stdio: 'ignore' });
      execSync('javac -version', { stdio: 'ignore' });
    } catch {
      console.log('[Java Inner Class Test] Skipping — JDK not installed');
      return;
    }

    const testJavaFile = path.resolve(ROOT, 'examples', 'java', 'InnerClassTest.java');
    const testClassDir = path.resolve(ROOT, 'examples', 'java');

    // Compile with full debug info
    execSync(`javac -g -d "${testClassDir}" "${testJavaFile}"`, {
      cwd: testClassDir,
      stdio: 'pipe'
    });
    console.log('[Java Inner Class Test] Compiled InnerClassTest.java');

    try {
      // 1. Create session
      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'java', name: 'java-inner-class-test' }
      });
      const createResponse = parseSdkToolResult(createResult);
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;
      console.log(`[Java Inner Class Test] Session created: ${sessionId}`);

      // 2. Set breakpoint on line 15 (int result = a + b; inside Inner.compute())
      const bpResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: testJavaFile, line: 15 }
      }));
      expect(bpResult.success).toBe(true);
      console.log('[Java Inner Class Test] Breakpoint set on line 15 (Inner.compute)');

      // 3. Start debugging
      const startResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: testJavaFile,
          args: [],
          dapLaunchArgs: {
            mainClass: 'InnerClassTest',
            classpath: testClassDir,
            cwd: testClassDir,
            stopOnEntry: false
          }
        }
      }));
      expect(startResult.success).toBe(true);
      console.log('[Java Inner Class Test] Debugging started');

      // 4. Wait for breakpoint hit
      console.log('[Java Inner Class Test] Waiting for breakpoint hit...');
      const stackResponse = await waitForPausedState(mcpClient!, sessionId, 30, 500);

      // HARD ASSERTION: Breakpoint in inner class must fire
      expect(stackResponse).not.toBeNull();
      const frames = stackResponse!.stackFrames!;
      expect(frames.length).toBeGreaterThan(0);

      const topFrame = frames[0];
      console.log(`[Java Inner Class Test] Hit breakpoint at ${topFrame.name}:${topFrame.line}`);

      // Top frame should be in compute() method
      expect(topFrame.name?.toLowerCase()).toContain('compute');
      if (typeof topFrame.line === 'number' && topFrame.line > 0) {
        expect(topFrame.line).toBe(15);
      }

      // 5. Get local variables and verify a=7, b=8
      console.log('[Java Inner Class Test] Getting local variables...');
      const localsRaw = await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      });
      const localsResponse = parseSdkToolResult(localsRaw) as {
        success?: boolean;
        variables?: Array<{ name: string; value: string }>;
      };

      expect(localsResponse.success).toBe(true);
      expect(Array.isArray(localsResponse.variables)).toBe(true);

      const localsByName = new Map(
        (localsResponse.variables ?? []).map(v => [v.name, v.value])
      );
      console.log('[Java Inner Class Test] Variables:', Object.fromEntries(localsByName));

      // HARD ASSERTION: a=7, b=8 in compute()
      expect(localsByName.get('a')).toBe('7');
      expect(localsByName.get('b')).toBe('8');

      // 6. Continue execution to let program finish
      console.log('[Java Inner Class Test] Continuing execution...');
      const contResult = await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect(contResult.success).toBe(true);

      console.log('[Java Inner Class Test] TEST PASSED — inner class breakpoint worked');

    } finally {
      // Clean up compiled class files (InnerClassTest.class and InnerClassTest$Inner.class)
      try {
        const classFile = path.resolve(testClassDir, 'InnerClassTest.class');
        if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
      } catch { /* ignore */ }
      try {
        const innerClassFile = path.resolve(testClassDir, 'InnerClassTest$Inner.class');
        if (fs.existsSync(innerClassFile)) fs.unlinkSync(innerClassFile);
      } catch { /* ignore */ }
    }
  }, 60000);
});
