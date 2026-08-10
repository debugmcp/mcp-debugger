/**
 * Java Function Breakpoint Smoke Tests via MCP Interface (issue #292)
 *
 * Exercises the JDI bridge's setFunctionBreakpoints support end-to-end:
 * - Deferred bind (primary path): a bare-name function breakpoint set before
 *   launch reports pending, binds on class prepare (breakpoint "changed"
 *   event → verified + boundLine in list_breakpoints), and stops on entry
 *   with reason "function breakpoint"
 * - Qualified Class.method names bind every concrete overload
 * - Live re-sync: a function breakpoint set while the program runs binds
 *   immediately (class already loaded) and still stops
 * - Conditions filter calls exactly like line-breakpoint conditions
 *
 * Fixture: examples/java/FunctionBpTest.java (line layout asserted here —
 * method entry locations map to the first statement line: compute(int) → 20,
 * compute(String) → 25, helper() → 30; the sleep sits at line 11).
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

const SLEEP_LINE = 11;
const COMPUTE_INT_LINE = 20;
const COMPUTE_STRING_LINE = 25;
const HELPER_LINE = 30;

interface FunctionBpSnapshot {
  functionName?: string;
  verified?: boolean;
  boundLine?: number;
  boundFile?: string;
}

function hasJdk(): boolean {
  try {
    execSync('java -version', { stdio: 'ignore' });
    execSync('javac -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('MCP Server Java Function Breakpoints @requires-java', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: { ...process.env, NODE_ENV: 'test' }
    });
    mcpClient = new Client(
      { name: 'java-function-bp-e2e', version: '1.0.0' },
      { capabilities: {} }
    );
    await mcpClient.connect(transport);
  }, 30000);

  afterAll(async () => {
    if (mcpClient) {
      await mcpClient.close();
    }
    if (transport) {
      await transport.close();
    }
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

  async function createSession(name: string): Promise<string> {
    const createResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'java', name }
    }));
    expect(createResponse.sessionId).toBeDefined();
    sessionId = createResponse.sessionId as string;
    return sessionId;
  }

  async function startFixture(sid: string): Promise<void> {
    const { sourcePath, classDir, mainClass } = prepareJavaExample('FunctionBpTest');
    const startResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId: sid,
        scriptPath: sourcePath,
        args: [],
        dapLaunchArgs: { mainClass, classpath: classDir, cwd: classDir, stopOnEntry: false }
      }
    }));
    expect(startResponse.success).toBe(true);
  }

  /** Poll list_breakpoints until the first function breakpoint reports verified. */
  async function waitForVerifiedFunctionBp(
    sid: string,
    timeoutMs = 15_000
  ): Promise<FunctionBpSnapshot | undefined> {
    const deadline = Date.now() + timeoutMs;
    let fnBp: FunctionBpSnapshot | undefined;
    while (Date.now() < deadline) {
      const listRes = await callToolSafely(mcpClient!, 'list_breakpoints', { sessionId: sid });
      fnBp = ((listRes as { functionBreakpoints?: FunctionBpSnapshot[] }).functionBreakpoints ?? [])[0];
      if (fnBp?.verified) return fnBp;
      await new Promise(r => setTimeout(r, 250));
    }
    return fnBp;
  }

  /** Poll for a paused state with non-empty stack frames. */
  async function waitForPausedState(
    sid: string,
    maxAttempts = 40,
    intervalMs = 500
  ): Promise<{ stackFrames?: Array<{ file?: string; name?: string; line?: number }> } | null> {
    for (let i = 0; i < maxAttempts; i++) {
      const result = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId: sid });
      if (result.stackFrames && (result.stackFrames as unknown[]).length > 0) {
        return result as { stackFrames: Array<{ file?: string; name?: string; line?: number }> };
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return null;
  }

  async function getLastStopReason(sid: string): Promise<string | undefined> {
    const res = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
    const sessions = (res.sessions ?? []) as Array<{ id: string; lastStop?: { reason?: string } }>;
    return sessions.find(s => s.id === sid)?.lastStop?.reason;
  }

  async function getLocalsByName(sid: string): Promise<Map<string, string>> {
    const localsResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'get_local_variables',
      arguments: { sessionId: sid }
    })) as { variables?: Array<{ name: string; value: string }> };
    return new Map((localsResponse.variables ?? []).map(v => [v.name, v.value]));
  }

  it('binds a bare-name function breakpoint via deferred class prepare and stops on entry', async () => {
    if (!hasJdk()) {
      console.log('[Java Function BP] Skipping — JDK not installed');
      return;
    }
    const sid = await createSession('java-fnbp-deferred');

    // Pre-launch: no file, no line — just the bare symbol name.
    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', { sessionId: sid, function: 'helper' });
    expect(bpRes.success).toBe(true);
    expect((bpRes as { functionName?: string }).functionName).toBe('helper');

    await startFixture(sid);

    // Deferred bind: class prepare fires after launch resumes; the breakpoint
    // "changed" event (matched by adapter id) must flip the stored breakpoint
    // to verified with the bound line.
    const fnBp = await waitForVerifiedFunctionBp(sid);
    expect(fnBp?.verified).toBe(true);
    expect(fnBp?.boundLine).toBe(HELPER_LINE);
    expect(fnBp?.boundFile).toContain('FunctionBpTest.java');

    // The program calls helper() after its sleep — must stop on entry.
    const stack = await waitForPausedState(sid);
    expect(stack).not.toBeNull();
    const top = stack!.stackFrames![0];
    expect(top.name?.toLowerCase()).toContain('helper');
    expect(top.line).toBe(HELPER_LINE);
    expect(await getLastStopReason(sid)).toBe('function breakpoint');

    const contRes = await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });
    expect(contRes.success).toBe(true);
  }, 60000);

  it('binds every concrete overload for a qualified Class.method name', async () => {
    if (!hasJdk()) {
      console.log('[Java Function BP] Skipping — JDK not installed');
      return;
    }
    const sid = await createSession('java-fnbp-overloads');

    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId: sid,
      function: 'FunctionBpTest.compute'
    });
    expect(bpRes.success).toBe(true);

    await startFixture(sid);

    const fnBp = await waitForVerifiedFunctionBp(sid);
    expect(fnBp?.verified).toBe(true);
    // The reported location is whichever overload bound first
    expect([COMPUTE_INT_LINE, COMPUTE_STRING_LINE]).toContain(fnBp?.boundLine);

    // Stop 1: compute(3) — int overload
    const stack1 = await waitForPausedState(sid);
    expect(stack1).not.toBeNull();
    expect(stack1!.stackFrames![0].name?.toLowerCase()).toContain('compute');
    expect(stack1!.stackFrames![0].line).toBe(COMPUTE_INT_LINE);
    expect((await getLocalsByName(sid)).get('x')).toBe('3');
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });

    // Stop 2: compute(7) — int overload again
    const stack2 = await waitForPausedState(sid);
    expect(stack2).not.toBeNull();
    expect(stack2!.stackFrames![0].line).toBe(COMPUTE_INT_LINE);
    expect((await getLocalsByName(sid)).get('x')).toBe('7');
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });

    // Stop 3: compute("hi") — the String overload also bound
    const stack3 = await waitForPausedState(sid);
    expect(stack3).not.toBeNull();
    expect(stack3!.stackFrames![0].name?.toLowerCase()).toContain('compute');
    expect(stack3!.stackFrames![0].line).toBe(COMPUTE_STRING_LINE);
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });
  }, 60000);

  it('binds immediately when set while the program is running (live re-sync)', async () => {
    if (!hasJdk()) {
      console.log('[Java Function BP] Skipping — JDK not installed');
      return;
    }
    const sid = await createSession('java-fnbp-live');

    // A launch with no breakpoints at all runs to completion before
    // start_debugging settles, so park on a line breakpoint at the sleep,
    // continue into the 3s sleep window, and set the function breakpoint
    // while the program is genuinely running.
    const { sourcePath } = prepareJavaExample('FunctionBpTest');
    const lineBpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId: sid,
      file: sourcePath,
      line: SLEEP_LINE
    });
    expect(lineBpRes.success).toBe(true);

    await startFixture(sid);

    const parked = await waitForPausedState(sid);
    expect(parked).not.toBeNull();
    expect(parked!.stackFrames![0].line).toBe(SLEEP_LINE);
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });

    // Running (inside the sleep): the live re-sync sends setFunctionBreakpoints
    // to the bridge, and the class is already loaded, so the response itself
    // reports the bound state.
    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', { sessionId: sid, function: 'helper' });
    expect(bpRes.success, `set_breakpoint failed: ${JSON.stringify(bpRes)}`).toBe(true);
    expect((bpRes as { verified?: boolean }).verified, JSON.stringify(bpRes)).toBe(true);
    expect((bpRes as { boundLine?: number }).boundLine).toBe(HELPER_LINE);

    const stack = await waitForPausedState(sid);
    expect(stack).not.toBeNull();
    expect(stack!.stackFrames![0].name?.toLowerCase()).toContain('helper');
    expect(stack!.stackFrames![0].line).toBe(HELPER_LINE);
    expect(await getLastStopReason(sid)).toBe('function breakpoint');

    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });
  }, 60000);

  it('honors conditions on function breakpoints', async () => {
    if (!hasJdk()) {
      console.log('[Java Function BP] Skipping — JDK not installed');
      return;
    }
    const sid = await createSession('java-fnbp-condition');

    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId: sid,
      function: 'FunctionBpTest.compute',
      condition: 'x > 5'
    });
    expect(bpRes.success).toBe(true);

    await startFixture(sid);

    // compute(3) fails the condition; the first stop must be compute(7).
    const stack = await waitForPausedState(sid);
    expect(stack).not.toBeNull();
    expect(stack!.stackFrames![0].line).toBe(COMPUTE_INT_LINE);
    expect((await getLocalsByName(sid)).get('x')).toBe('7');
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });

    // The String overload has no 'x': condition evaluation errors default to
    // breaking (same policy as line-breakpoint conditions in the bridge).
    const stack2 = await waitForPausedState(sid);
    expect(stack2).not.toBeNull();
    expect(stack2!.stackFrames![0].line).toBe(COMPUTE_STRING_LINE);
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });
  }, 60000);
});
