/**
 * Java Adapter Smoke Tests via MCP Interface (Launch Mode)
 *
 * Tests core Java debugging in launch mode through MCP tools.
 * JdiDapServer spawns the JVM via JDI and manages the debug session.
 *
 * Hard assertions (every step must succeed):
 * - Session creation returns valid sessionId
 * - Breakpoint on line 10 (add method) returns success
 * - start_debugging succeeds with defined state
 * - Breakpoint fires: non-empty stack frames with top frame in add()
 * - Local variables a=10, b=20 with correct values
 * - Step over succeeds
 * - Continue execution succeeds
 *
 * Prerequisites:
 * - JDK installed (java + javac on PATH)
 * - javac -g for LocalVariableTable (JDI requires it for variable access)
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
 * Returns the stack response once frames appear, or null after exhausting attempts.
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

  it('should complete Java debugging flow with verified stack and variables', async () => {
    // Check for java and javac
    try {
      execSync('java -version', { stdio: 'ignore' });
      execSync('javac -version', { stdio: 'ignore' });
    } catch {
      console.log('[Java Smoke Test] Skipping — JDK not installed');
      return;
    }

    const testJavaFile = path.resolve(ROOT, 'examples', 'java', 'HelloWorld.java');
    const testClassDir = path.resolve(ROOT, 'examples', 'java');

    // Compile with full debug info (-g) so JDI can access local variables.
    // JDI bridge accepts classpath directly — no Gradle build dir hack needed.
    execSync(`javac -g -d "${testClassDir}" "${testJavaFile}"`, {
      cwd: testClassDir,
      stdio: 'pipe'
    });
    console.log('[Java Smoke Test] Compiled HelloWorld.java into', testClassDir);

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

      // 2. Set breakpoint on line 10 (int result = a + b; inside add())
      console.log('[Java Smoke Test] Setting breakpoint on line 10...');
      const bpResult = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: testJavaFile,
          line: 10
        }
      });

      const bpResponse = parseSdkToolResult(bpResult);
      expect(bpResponse.success).toBe(true);
      console.log('[Java Smoke Test] Breakpoint set successfully');

      // 3. Start debugging — JDI bridge launches the JVM and connects via JDI
      console.log('[Java Smoke Test] Starting debugging...');
      const startResult = await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: testJavaFile,
          args: [],
          dapLaunchArgs: {
            mainClass: 'HelloWorld',
            classpath: testClassDir,
            cwd: testClassDir,
            stopOnEntry: false
          }
        }
      });

      const startResponse = parseSdkToolResult(startResult);
      expect(startResponse.success).toBe(true);
      expect(startResponse.state).toBeDefined();
      console.log('[Java Smoke Test] Debug started, state:', startResponse.state);

      // 4. Poll for breakpoint hit (non-empty stack frames)
      console.log('[Java Smoke Test] Waiting for breakpoint hit...');
      const stackResponse = await waitForPausedState(mcpClient!, sessionId, 20, 500);

      // HARD ASSERTION: Breakpoint must fire
      expect(stackResponse).not.toBeNull();
      expect(stackResponse!.stackFrames).toBeDefined();
      const frames = stackResponse!.stackFrames!;
      expect(frames.length).toBeGreaterThan(0);
      console.log(`[Java Smoke Test] Stack has ${frames.length} frames`);

      // HARD ASSERTION: Top frame is add() at line 10
      const topFrame = frames[0];
      console.log('[Java Smoke Test] Top frame:', topFrame.name, 'line:', topFrame.line);
      expect(topFrame.name?.toLowerCase()).toContain('add');
      if (typeof topFrame.line === 'number' && topFrame.line > 0) {
        expect(topFrame.line).toBe(10);
      }

      // 5. Get local variables and verify values
      console.log('[Java Smoke Test] Getting local variables...');
      const localsRaw = await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      });
      const localsResponse = parseSdkToolResult(localsRaw) as {
        success?: boolean;
        variables?: Array<{ name: string; value: string }>;
        count?: number;
      };

      expect(localsResponse.success).toBe(true);
      expect(Array.isArray(localsResponse.variables)).toBe(true);
      expect(localsResponse.variables!.length).toBeGreaterThan(0);

      const localsByName = new Map(
        (localsResponse.variables ?? []).map(v => [v.name, v.value])
      );
      console.log('[Java Smoke Test] Variables:', Object.fromEntries(localsByName));

      // HARD ASSERTION: a=10, b=20 in add()
      expect(localsByName.get('a')).toBe('10');
      expect(localsByName.get('b')).toBe('20');

      // 6. Step over
      console.log('[Java Smoke Test] Stepping over...');
      const stepResult = await callToolSafely(mcpClient!, 'step_over', { sessionId });
      expect(stepResult.success).toBe(true);

      // Wait briefly for step to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 7. Continue execution to let program finish
      console.log('[Java Smoke Test] Continuing execution...');
      const finalContinue = await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect(finalContinue.success).toBe(true);

    } finally {
      // Clean up compiled class file
      try {
        const classFile = path.resolve(testClassDir, 'HelloWorld.class');
        if (fs.existsSync(classFile)) {
          fs.unlinkSync(classFile);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }, 60000);

  it('should hit a breakpoint added while the application is paused', async () => {
    // Check for java and javac
    try {
      execSync('java -version', { stdio: 'ignore' });
      execSync('javac -version', { stdio: 'ignore' });
    } catch {
      console.log('[Java Smoke Test] Skipping — JDK not installed');
      return;
    }

    const testJavaFile = path.resolve(ROOT, 'examples', 'java', 'HelloWorld.java');
    const testClassDir = path.resolve(ROOT, 'examples', 'java');

    // Compile with full debug info
    execSync(`javac -g -d "${testClassDir}" "${testJavaFile}"`, {
      cwd: testClassDir,
      stdio: 'pipe'
    });

    try {
      // 1. Create session
      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'java', name: 'java-bp-while-paused' }
      });
      const createResponse = parseSdkToolResult(createResult);
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;

      // 2. Set FIRST breakpoint on line 10 (add method: int result = a + b)
      console.log('[BP While Paused] Setting breakpoint on line 10 (add)...');
      const bp1Result = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: testJavaFile, line: 10 }
      }));
      expect(bp1Result.success).toBe(true);

      // 3. Start debugging
      console.log('[BP While Paused] Starting debugging...');
      const startResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: testJavaFile,
          args: [],
          dapLaunchArgs: {
            mainClass: 'HelloWorld',
            classpath: testClassDir,
            cwd: testClassDir,
            stopOnEntry: false
          }
        }
      }));
      expect(startResult.success).toBe(true);

      // 4. Wait for FIRST breakpoint hit at line 10
      console.log('[BP While Paused] Waiting for first breakpoint (line 10)...');
      const stack1 = await waitForPausedState(mcpClient!, sessionId, 20, 500);
      expect(stack1).not.toBeNull();
      const frames1 = stack1!.stackFrames!;
      expect(frames1.length).toBeGreaterThan(0);
      expect(frames1[0].name?.toLowerCase()).toContain('add');
      expect(frames1[0].line).toBe(10);
      console.log('[BP While Paused] Hit first breakpoint at add():10');

      // 5. While PAUSED at line 10, set a SECOND breakpoint on line 15 (greet method)
      //    greet() hasn't been called yet, so line 15 should be reachable after continue.
      console.log('[BP While Paused] Setting second breakpoint on line 15 (greet) while paused...');
      const bp2Result = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: testJavaFile, line: 15 }
      }));
      expect(bp2Result.success).toBe(true);
      console.log('[BP While Paused] Second breakpoint set');

      // 6. Continue execution — should run through add(), then hit greet() at line 15
      console.log('[BP While Paused] Continuing execution...');
      const contResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      }));
      expect(contResult.success).toBe(true);

      // 7. Wait for SECOND breakpoint hit at line 15
      console.log('[BP While Paused] Waiting for second breakpoint (line 15)...');
      const stack2 = await waitForPausedState(mcpClient!, sessionId, 20, 500);

      // HARD ASSERTION: Second breakpoint must fire
      expect(stack2).not.toBeNull();
      const frames2 = stack2!.stackFrames!;
      expect(frames2.length).toBeGreaterThan(0);
      expect(frames2[0].name?.toLowerCase()).toContain('greet');
      expect(frames2[0].line).toBe(15);
      console.log('[BP While Paused] Hit second breakpoint at greet():15');

      // 8. Verify variables in greet() — name should be "World"
      const localsRaw = await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      });
      const localsResponse = parseSdkToolResult(localsRaw) as {
        success?: boolean;
        variables?: Array<{ name: string; value: string }>;
      };

      expect(localsResponse.success).toBe(true);
      const localsByName = new Map(
        (localsResponse.variables ?? []).map(v => [v.name, v.value])
      );
      console.log('[BP While Paused] Variables:', Object.fromEntries(localsByName));
      expect(localsByName.get('name')).toBe('"World"');

      // 9. Continue to finish
      console.log('[BP While Paused] Continuing to finish...');
      const finalContinue = parseSdkToolResult(await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      }));
      expect(finalContinue.success).toBe(true);

      console.log('[BP While Paused] TEST PASSED — breakpoint added while paused was hit');

    } finally {
      try {
        const classFile = path.resolve(testClassDir, 'HelloWorld.class');
        if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
      } catch { /* ignore */ }
    }
  }, 60000);

  it('should support conditional breakpoints', async () => {
    // Check for java and javac
    try {
      execSync('java -version', { stdio: 'ignore' });
      execSync('javac -version', { stdio: 'ignore' });
    } catch {
      console.log('[Java Smoke Test] Skipping — JDK not installed');
      return;
    }

    const testJavaFile = path.resolve(ROOT, 'examples', 'java', 'HelloWorld.java');
    const testClassDir = path.resolve(ROOT, 'examples', 'java');

    // Compile with full debug info
    execSync(`javac -g -d "${testClassDir}" "${testJavaFile}"`, {
      cwd: testClassDir,
      stdio: 'pipe'
    });

    try {
      // 1. Create session
      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'java', name: 'java-conditional-bp' }
      });
      const createResponse = parseSdkToolResult(createResult);
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;

      // 2. Set conditional breakpoint on line 10 (add method) with condition "a > 5"
      //    Since add(10, 20) is called, a=10 > 5 is true → breakpoint should fire
      console.log('[Conditional BP] Setting conditional breakpoint: a > 5 on line 10...');
      const bpResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: testJavaFile, line: 10, condition: 'a > 5' }
      }));
      expect(bpResult.success).toBe(true);

      // 3. Start debugging
      console.log('[Conditional BP] Starting debugging...');
      const startResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: testJavaFile,
          args: [],
          dapLaunchArgs: {
            mainClass: 'HelloWorld',
            classpath: testClassDir,
            cwd: testClassDir,
            stopOnEntry: false
          }
        }
      }));
      expect(startResult.success).toBe(true);

      // 4. Wait for breakpoint hit — condition a > 5 is true (a=10), so it should fire
      console.log('[Conditional BP] Waiting for conditional breakpoint hit...');
      const stackResponse = await waitForPausedState(mcpClient!, sessionId, 20, 500);

      // HARD ASSERTION: Conditional breakpoint must fire
      expect(stackResponse).not.toBeNull();
      const frames = stackResponse!.stackFrames!;
      expect(frames.length).toBeGreaterThan(0);
      expect(frames[0].name?.toLowerCase()).toContain('add');
      expect(frames[0].line).toBe(10);
      console.log('[Conditional BP] Breakpoint hit at add():10');

      // 5. Verify a=10 (which satisfies a > 5)
      const localsRaw = await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      });
      const localsResponse = parseSdkToolResult(localsRaw) as {
        success?: boolean;
        variables?: Array<{ name: string; value: string }>;
      };
      expect(localsResponse.success).toBe(true);
      const localsByName = new Map(
        (localsResponse.variables ?? []).map(v => [v.name, v.value])
      );
      console.log('[Conditional BP] Variables:', Object.fromEntries(localsByName));
      expect(localsByName.get('a')).toBe('10');

      // 6. Continue to finish
      console.log('[Conditional BP] Continuing execution...');
      const contResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      }));
      expect(contResult.success).toBe(true);

      console.log('[Conditional BP] TEST PASSED — conditional breakpoint worked');

    } finally {
      try {
        const classFile = path.resolve(testClassDir, 'HelloWorld.class');
        if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
      } catch { /* ignore */ }
    }
  }, 60000);
});
