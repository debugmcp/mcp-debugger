/**
 * Java PauseTest Smoke Test via MCP Interface
 *
 * Regression test for the 2026-04-28 testdebugger finding: examples/java/PauseTest.class
 * existed on disk compiled WITHOUT `-g`, so any debugger run that landed on it could not
 * report local variables. No test in the repo actually built PauseTest, so the staleness
 * went unnoticed.
 *
 * This test exercises PauseTest end-to-end: the java-example-utils helper guarantees a
 * fresh `-g` build, we hit a breakpoint inside the while-loop, and assert that the
 * `counter` local variable is reported with a numeric value. Without `-g`, the
 * LocalVariableTable is absent and `counter` would either be missing or returned as
 * the placeholder "Compile with javac -g to see variables".
 *
 * Skips gracefully when JDK is not installed.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { prepareJavaExample } from './java-example-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

async function waitForPausedState(
  client: Client,
  sessionId: string,
  maxAttempts = 30,
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

describe('MCP Server Java PauseTest Smoke Test @requires-java', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client({
      name: 'java-pause-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
  }, 30000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      } catch {
        // Session may already be closed
      }
    }
    if (mcpClient) await mcpClient.close();
    if (transport) await transport.close();
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

  it('returns local variables from inside the PauseTest loop (regression: stale .class without -g)', async () => {
    try {
      execSync('java -version', { stdio: 'ignore' });
      execSync('javac -version', { stdio: 'ignore' });
    } catch {
      console.log('[Java Pause Test] Skipping — JDK not installed');
      return;
    }

    const { sourcePath, classDir, mainClass } = prepareJavaExample('PauseTest');
    console.log('[Java Pause Test] PauseTest.class ready in', classDir);

    // 1. Create session
    const createResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'java', name: 'java-pause-test' }
    }));
    expect(createResponse.sessionId).toBeDefined();
    sessionId = createResponse.sessionId as string;

    // 2. Set breakpoint on line 7 (Thread.sleep — inside the while(true) loop, after counter++)
    const bpResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: sourcePath, line: 7 }
    }));
    expect(bpResponse.success).toBe(true);

    // 3. Start debugging
    const startResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath: sourcePath,
        args: [],
        dapLaunchArgs: { mainClass, classpath: classDir, cwd: classDir, stopOnEntry: false }
      }
    }));
    expect(startResponse.success).toBe(true);

    // 4. Wait for breakpoint hit inside the loop
    const stack = await waitForPausedState(mcpClient!, sessionId, 30, 500);
    expect(stack).not.toBeNull();
    const frames = stack!.stackFrames!;
    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0].name?.toLowerCase()).toContain('main');

    // 5. Get local variables — `counter` must be present with a numeric value
    const localsResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'get_local_variables',
      arguments: { sessionId }
    })) as {
      success?: boolean;
      variables?: Array<{ name: string; value: string }>;
    };

    expect(localsResponse.success).toBe(true);
    expect(Array.isArray(localsResponse.variables)).toBe(true);

    const counter = localsResponse.variables!.find(v => v.name === 'counter');
    // Regression assertion: without `-g`, this is either missing or a sentinel
    // placeholder string instead of a numeric value.
    expect(counter).toBeDefined();
    expect(Number.isFinite(Number(counter!.value))).toBe(true);
    console.log(`[Java Pause Test] counter = ${counter!.value} (numeric — -g present)`);

    // 6. Continue and let the test process clean up via afterEach (close_debug_session
    //    terminates the JVM since this is launch mode)
    const contResult = await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    expect(contResult.success).toBe(true);
  }, 60000);
});
