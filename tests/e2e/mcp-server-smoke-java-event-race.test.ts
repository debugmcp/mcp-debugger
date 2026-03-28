/**
 * Java Event Loop Race Condition Test
 *
 * Verifies the fix for a bug where ClassPrepareEvent in the same JDI EventSet
 * as a BreakpointEvent would incorrectly resume the stopped thread, causing
 * "Thread has been resumed" errors on evaluate_expression.
 *
 * The test:
 * 1. Sets a breakpoint with suspendPolicy="thread" in EventRaceTest.compute()
 * 2. Sets a breakpoint in LateLoadedHelper.greet() (class not yet loaded → ClassPrepareRequest)
 * 3. Starts debugging — when compute() breakpoint fires, the ClassPrepareRequest is active
 * 4. Evaluates an expression at the breakpoint — this would fail before the fix
 * 5. Continues and verifies the second breakpoint in LateLoadedHelper also fires
 *
 * Prerequisites: JDK installed (java + javac on PATH)
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

describe('Java Event Loop Race Condition Fix @requires-java', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  const testJavaDir = path.resolve(ROOT, 'examples', 'java');
  const mainFile = path.resolve(testJavaDir, 'EventRaceTest.java');
  const helperFile = path.resolve(testJavaDir, 'LateLoadedHelper.java');

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    mcpClient = new Client(
      { name: 'java-event-race-test', version: '1.0.0' },
      { capabilities: {} }
    );

    await mcpClient.connect(transport);
  }, 30000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try { await callToolSafely(mcpClient, 'close_debug_session', { sessionId }); } catch { /* */ }
    }
    if (mcpClient) await mcpClient.close();
    if (transport) await transport.close();
  });

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try { await callToolSafely(mcpClient, 'close_debug_session', { sessionId }); } catch { /* */ }
      sessionId = null;
    }
  });

  it('should not resume thread when ClassPrepareEvent coincides with BreakpointEvent (suspendPolicy=thread)', async () => {
    // Check JDK availability
    try {
      execSync('java -version', { stdio: 'ignore' });
      execSync('javac -version', { stdio: 'ignore' });
    } catch {
      console.log('[Event Race] Skipping — JDK not installed');
      return;
    }

    // Compile both files
    execSync(`javac -g -d "${testJavaDir}" "${mainFile}" "${helperFile}"`, {
      cwd: testJavaDir,
      stdio: 'pipe'
    });
    console.log('[Event Race] Compiled EventRaceTest + LateLoadedHelper');

    try {
      // 1. Create session
      const createResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'java', name: 'java-event-race' }
      }));
      expect(createResult.sessionId).toBeDefined();
      sessionId = createResult.sessionId as string;

      // 2. Set breakpoint in compute() with suspendPolicy="thread"
      //    This is the key: only the hitting thread is suspended, not all threads
      console.log('[Event Race] Setting breakpoint on EventRaceTest line 21 (suspendPolicy=thread)...');
      const bp1 = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: mainFile,
          line: 21,
          suspendPolicy: 'thread'
        }
      }));
      expect(bp1.success).toBe(true);

      // 3. Set breakpoint in LateLoadedHelper (not loaded yet → ClassPrepareRequest)
      //    This creates a ClassPrepareRequest that fires when LateLoadedHelper is loaded.
      //    Before the fix, if this ClassPrepareEvent arrived in the same EventSet as the
      //    breakpoint above, it would incorrectly resume the stopped thread.
      console.log('[Event Race] Setting breakpoint on LateLoadedHelper line 8 (deferred)...');
      const bp2 = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: helperFile,
          line: 8,
          suspendPolicy: 'thread'
        }
      }));
      expect(bp2.success).toBe(true);

      // 4. Start debugging
      console.log('[Event Race] Starting debugging...');
      const startResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: mainFile,
          args: [],
          dapLaunchArgs: {
            mainClass: 'EventRaceTest',
            classpath: testJavaDir,
            cwd: testJavaDir,
            stopOnEntry: false
          }
        }
      }));
      expect(startResult.success).toBe(true);

      // 5. Wait for first breakpoint hit at compute() line 21
      console.log('[Event Race] Waiting for breakpoint in compute()...');
      const stack1 = await waitForPausedState(mcpClient!, sessionId, 30, 500);
      expect(stack1).not.toBeNull();
      const frames1 = stack1!.stackFrames!;
      expect(frames1.length).toBeGreaterThan(0);
      expect(frames1[0].name?.toLowerCase()).toContain('compute');
      console.log('[Event Race] Hit breakpoint at compute():' + frames1[0].line);

      // 6. CRITICAL: Evaluate expression while stopped
      //    Before the fix, this would fail with "Thread has been resumed"
      //    if ClassPrepareEvent was in the same EventSet
      console.log('[Event Race] Evaluating expression at breakpoint (the critical test)...');
      const evalResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'evaluate_expression',
        arguments: {
          sessionId,
          expression: 'a + b'
        }
      }));
      console.log('[Event Race] Evaluation result:', evalResult);
      expect(evalResult.success).toBe(true);
      expect(evalResult.result).toBe('30');

      // 7. Get local variables — also verifies thread is still suspended
      const locals = parseSdkToolResult(await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      })) as { success?: boolean; variables?: Array<{ name: string; value: string }> };
      expect(locals.success).toBe(true);
      const localsByName = new Map((locals.variables ?? []).map(v => [v.name, v.value]));
      expect(localsByName.get('a')).toBe('10');
      expect(localsByName.get('b')).toBe('20');
      console.log('[Event Race] Variables verified: a=10, b=20');

      // 8. Continue — should hit second breakpoint in LateLoadedHelper
      console.log('[Event Race] Continuing to LateLoadedHelper breakpoint...');
      const cont1 = parseSdkToolResult(await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      }));
      expect(cont1.success).toBe(true);

      // 9. Wait for second breakpoint in LateLoadedHelper.greet()
      console.log('[Event Race] Waiting for breakpoint in greet()...');
      const stack2 = await waitForPausedState(mcpClient!, sessionId, 20, 500);
      expect(stack2).not.toBeNull();
      const frames2 = stack2!.stackFrames!;
      expect(frames2.length).toBeGreaterThan(0);
      expect(frames2[0].name?.toLowerCase()).toContain('greet');
      console.log('[Event Race] Hit breakpoint at greet():' + frames2[0].line);

      // 10. Evaluate in greet() — also with thread suspend policy
      const evalResult2 = parseSdkToolResult(await mcpClient!.callTool({
        name: 'evaluate_expression',
        arguments: {
          sessionId,
          expression: 'name'
        }
      }));
      expect(evalResult2.success).toBe(true);
      expect(evalResult2.result).toBe('"World"');
      console.log('[Event Race] Evaluation in greet() succeeded: name=' + evalResult2.result);

      // 11. Continue to finish
      const cont2 = parseSdkToolResult(await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      }));
      expect(cont2.success).toBe(true);

      console.log('[Event Race] TEST PASSED — thread suspension preserved despite ClassPrepareEvent');

    } finally {
      // Cleanup compiled classes
      for (const cls of ['EventRaceTest.class', 'LateLoadedHelper.class']) {
        try {
          const f = path.resolve(testJavaDir, cls);
          if (fs.existsSync(f)) fs.unlinkSync(f);
        } catch { /* ignore */ }
      }
    }
  }, 90000);
});
