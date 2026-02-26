/**
 * Java Adapter Smoke Tests via MCP Interface (Launch Mode)
 *
 * Tests core Java debugging in launch mode through MCP tools.
 * KDA (kotlin-debug-adapter) spawns the JVM and manages the debug session.
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
 * - Compiled into build/classes/java/main/ (KDA resolves classpath from
 *   Gradle/Maven build output directories, not from the project root)
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
    // KDA resolves classpath from Gradle/Maven build output directories under projectRoot.
    // Compile into build/classes/java/main/ so KDA's ProjectClassesResolver finds the class.
    const buildClassDir = path.resolve(testClassDir, 'build', 'classes', 'java', 'main');
    fs.mkdirSync(buildClassDir, { recursive: true });
    execSync(`javac -g -d "${buildClassDir}" "${testJavaFile}"`, {
      cwd: testClassDir,
      stdio: 'pipe'
    });
    console.log('[Java Smoke Test] Compiled HelloWorld.java into', buildClassDir);

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
            projectRoot: testClassDir,
            stopOnEntry: false
          }
        }
      });

      const startResponse = parseSdkToolResult(startResult);
      expect(startResponse.success).toBe(true);
      expect(startResponse.state).toBeDefined();
      console.log('[Java Smoke Test] Debug started, state:', startResponse.state);

      // 4. Poll for breakpoint hit (non-empty stack frames)
      //    In launch mode, KDA finds the class via the Gradle-style build directory,
      //    so initial breakpoints set during initialization fire correctly.
      console.log('[Java Smoke Test] Waiting for breakpoint hit...');
      const stackResponse = await waitForPausedState(mcpClient!, sessionId, 15, 500);

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
      // KDA may report line 0 (no source mapping) — assert only when present
      if (typeof topFrame.line === 'number' && topFrame.line > 0) {
        expect(topFrame.line).toBe(10);
      }

      // 6. Get local variables and verify values
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

      // 7. Step over
      console.log('[Java Smoke Test] Stepping over...');
      const stepResult = await callToolSafely(mcpClient!, 'step_over', { sessionId });
      expect(stepResult.success).toBe(true);

      // Wait briefly for step to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 8. Continue execution to let program finish
      console.log('[Java Smoke Test] Continuing execution...');
      const finalContinue = await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect(finalContinue.success).toBe(true);

    } finally {
      // Clean up compiled class files (Gradle-style build directory)
      try {
        const buildDir = path.resolve(testClassDir, 'build');
        if (fs.existsSync(buildDir)) {
          fs.rmSync(buildDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }, 60000);
});
