/**
 * JavaScript Function Breakpoint Smoke Tests via MCP Interface (issue #295)
 *
 * Exercises the CDP-proxy bridge end-to-end against real js-debug + Node:
 * - Entry-pause bind: a function breakpoint on a main-module declaration set
 *   before launch binds at the (auto-continued) entry pause, reports
 *   boundFile/boundLine, and stops with reason "function breakpoint"
 * - Deferred bind: a breakpoint on a lazily-required module's function stays
 *   pending until a pause after the require, then binds (changed event) and
 *   stops
 * - Conditions filter calls (evaluated in callee scope with args bound)
 * - remove_breakpoint mid-session disarms for good
 * - restart_debugging re-applies function breakpoints
 * - Attach mode: a globally reachable function resolves while running
 *
 * Fixture: examples/javascript/function_bp_test.js — compute declared line 9,
 * entry statement line 10; helper's doWork declared line 6, entry line 7.
 * Semantics note: names are dotted runtime paths bound to the current function
 * value (Chrome debug(fn) semantics), not a source-symbol search.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const FIXTURE = path.resolve(ROOT, 'examples', 'javascript', 'function_bp_test.js');
const ATTACH_TARGET = path.resolve(ROOT, 'examples', 'javascript', 'function_bp_attach_target.js');

const COMPUTE_DECL_LINE = 9;
const COMPUTE_ENTRY_LINE = 10;
const DOWORK_DECL_LINE = 6;
const DOWORK_ENTRY_LINE = 7;

interface FunctionBpSnapshot {
  functionName?: string;
  verified?: boolean;
  boundLine?: number;
  boundFile?: string;
  message?: string;
}

describe('MCP Server JavaScript Function Breakpoints', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;
  let targetProcess: ChildProcess | null = null;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: { ...process.env, NODE_ENV: 'test' }
    });
    mcpClient = new Client(
      { name: 'js-function-bp-e2e', version: '1.0.0' },
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
    if (targetProcess) {
      try {
        targetProcess.kill();
      } catch {
        // already gone
      }
      targetProcess = null;
    }
  });

  async function createSession(name: string): Promise<string> {
    const createResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'javascript', name }
    }));
    expect(createResponse.sessionId).toBeDefined();
    sessionId = createResponse.sessionId as string;
    return sessionId;
  }

  async function startFixture(sid: string): Promise<void> {
    const startResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId: sid,
        scriptPath: FIXTURE,
        args: [],
        dapLaunchArgs: { stopOnEntry: false, justMyCode: true }
      }
    }));
    expect(startResponse.state).toBeDefined();
  }

  async function listFunctionBps(sid: string): Promise<FunctionBpSnapshot[]> {
    const listRes = await callToolSafely(mcpClient!, 'list_breakpoints', { sessionId: sid });
    return ((listRes as { functionBreakpoints?: FunctionBpSnapshot[] }).functionBreakpoints ?? []);
  }

  /** Poll list_breakpoints until the named function breakpoint reports verified. */
  async function waitForVerifiedFunctionBp(
    sid: string,
    functionName: string,
    timeoutMs = 15_000
  ): Promise<FunctionBpSnapshot | undefined> {
    const deadline = Date.now() + timeoutMs;
    let fnBp: FunctionBpSnapshot | undefined;
    while (Date.now() < deadline) {
      fnBp = (await listFunctionBps(sid)).find((bp) => bp.functionName === functionName);
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

  async function getSessionSnapshot(sid: string): Promise<{ state?: string; lastStop?: { reason?: string } } | undefined> {
    const res = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
    const sessions = (res.sessions ?? []) as Array<{ id: string; state?: string; lastStop?: { reason?: string } }>;
    return sessions.find(s => s.id === sid);
  }

  async function getLocalsByName(sid: string): Promise<Map<string, string>> {
    const localsResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'get_local_variables',
      arguments: { sessionId: sid }
    })) as { variables?: Array<{ name: string; value: string }> };
    return new Map((localsResponse.variables ?? []).map(v => [v.name, v.value]));
  }

  it('binds a main-module function at the entry pause and stops with reason "function breakpoint"', async () => {
    const sid = await createSession('js-fnbp-basic');

    // Pre-launch, no file, no line — a bare dotted runtime path.
    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', { sessionId: sid, function: 'compute' });
    expect(bpRes.success).toBe(true);
    expect((bpRes as { functionName?: string }).functionName).toBe('compute');

    await startFixture(sid);

    // The entry pause is auto-continued (stopOnEntry: false), but the bridge
    // binds hoisted main-module declarations there first.
    const fnBp = await waitForVerifiedFunctionBp(sid, 'compute');
    expect(fnBp?.verified).toBe(true);
    expect(fnBp?.boundLine).toBe(COMPUTE_DECL_LINE);
    expect(fnBp?.boundFile).toContain('function_bp_test.js');

    // compute(3) fires first.
    const stack = await waitForPausedState(sid);
    expect(stack).not.toBeNull();
    const top = stack!.stackFrames![0];
    expect(top.name).toContain('compute');
    expect(top.line).toBe(COMPUTE_ENTRY_LINE);
    expect((await getSessionSnapshot(sid))?.lastStop?.reason).toBe('function breakpoint');

    const contRes = await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });
    expect(contRes.success).toBe(true);
  }, 60000);

  it('defers a lazily-loaded module function until a pause after the require, then binds and stops', async () => {
    const sid = await createSession('js-fnbp-deferred');

    await callToolSafely(mcpClient!, 'set_breakpoint', { sessionId: sid, function: 'compute' });
    const deferredRes = await callToolSafely(mcpClient!, 'set_breakpoint', { sessionId: sid, function: 'helper.doWork' });
    expect(deferredRes.success).toBe(true);

    await startFixture(sid);

    // Stop 1: compute(3) — before the require, helper.doWork must be pending.
    const stack1 = await waitForPausedState(sid);
    expect(stack1).not.toBeNull();
    expect(stack1!.stackFrames![0].line).toBe(COMPUTE_ENTRY_LINE);
    const pendingDoWork = (await listFunctionBps(sid)).find((bp) => bp.functionName === 'helper.doWork');
    expect(pendingDoWork?.verified).toBe(false);
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });

    // Stop 2: compute(7) — after the require; the pause re-resolves and binds
    // helper.doWork (breakpoint "changed" event → verified + bound location).
    const stack2 = await waitForPausedState(sid);
    expect(stack2).not.toBeNull();
    const boundDoWork = await waitForVerifiedFunctionBp(sid, 'helper.doWork');
    expect(boundDoWork?.verified).toBe(true);
    expect(boundDoWork?.boundLine).toBe(DOWORK_DECL_LINE);
    expect(boundDoWork?.boundFile).toContain('function_bp_helper.js');
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });

    // Stop 3: doWork() itself.
    const stack3 = await waitForPausedState(sid);
    expect(stack3).not.toBeNull();
    expect(stack3!.stackFrames![0].name).toContain('doWork');
    expect(stack3!.stackFrames![0].line).toBe(DOWORK_ENTRY_LINE);
    expect((await getSessionSnapshot(sid))?.lastStop?.reason).toBe('function breakpoint');
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });

    // Stop 4: compute(99) — then let the fixture finish.
    const stack4 = await waitForPausedState(sid);
    expect(stack4).not.toBeNull();
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });
  }, 60000);

  it('honors conditions evaluated in the callee scope', async () => {
    const sid = await createSession('js-fnbp-condition');

    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId: sid,
      function: 'compute',
      condition: 'x > 5'
    });
    expect(bpRes.success).toBe(true);

    await startFixture(sid);

    // compute(3) fails the condition; the first stop must be compute(7).
    const stack = await waitForPausedState(sid);
    expect(stack).not.toBeNull();
    expect(stack!.stackFrames![0].line).toBe(COMPUTE_ENTRY_LINE);
    expect((await getLocalsByName(sid)).get('x')).toBe('7');
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });

    // compute(99) also satisfies it.
    const stack2 = await waitForPausedState(sid);
    expect(stack2).not.toBeNull();
    expect((await getLocalsByName(sid)).get('x')).toBe('99');
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });
  }, 60000);

  it('remove_breakpoint disarms a function breakpoint for good', async () => {
    const sid = await createSession('js-fnbp-remove');

    await callToolSafely(mcpClient!, 'set_breakpoint', { sessionId: sid, function: 'compute' });
    await startFixture(sid);

    const stack = await waitForPausedState(sid);
    expect(stack).not.toBeNull();
    expect(stack!.stackFrames![0].line).toBe(COMPUTE_ENTRY_LINE);

    const removeRes = await callToolSafely(mcpClient!, 'remove_breakpoint', { sessionId: sid, function: 'compute' });
    expect(removeRes.success).toBe(true);
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });

    // compute(7) and compute(99) must run through; the fixture finishes on its
    // own (~4s of sleeps) and the session leaves the paused state for good.
    const deadline = Date.now() + 20_000;
    let finished = false;
    while (Date.now() < deadline) {
      const snapshot = await getSessionSnapshot(sid);
      expect(snapshot?.state?.toLowerCase()).not.toBe('paused');
      if (snapshot?.state?.toLowerCase() === 'stopped') {
        finished = true;
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    expect(finished).toBe(true);
  }, 60000);

  it('restart_debugging re-applies function breakpoints', async () => {
    const sid = await createSession('js-fnbp-restart');

    await callToolSafely(mcpClient!, 'set_breakpoint', { sessionId: sid, function: 'compute' });
    await startFixture(sid);

    const stack = await waitForPausedState(sid);
    expect(stack).not.toBeNull();
    expect(stack!.stackFrames![0].line).toBe(COMPUTE_ENTRY_LINE);

    const restartRes = await callToolSafely(mcpClient!, 'restart_debugging', { sessionId: sid });
    expect(restartRes.success).toBe(true);

    // The relaunch replays the desired set: fresh bind, fresh stop.
    const fnBp = await waitForVerifiedFunctionBp(sid, 'compute');
    expect(fnBp?.verified).toBe(true);
    const stack2 = await waitForPausedState(sid);
    expect(stack2).not.toBeNull();
    expect(stack2!.stackFrames![0].line).toBe(COMPUTE_ENTRY_LINE);
    expect((await getSessionSnapshot(sid))?.lastStop?.reason).toBe('function breakpoint');
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });
  }, 90000);

  it('attach mode: binds a globally reachable function while the target runs', async () => {
    // Spawn the target with an open inspector port.
    const port = await new Promise<number>((resolve, reject) => {
      const srv = net.createServer();
      srv.listen(0, '127.0.0.1', () => {
        const addr = srv.address();
        if (!addr || typeof addr === 'string') {
          srv.close(() => reject(new Error('Could not determine port')));
          return;
        }
        const p = addr.port;
        srv.close(() => resolve(p));
      });
      srv.on('error', reject);
    });

    targetProcess = spawn(
      process.execPath,
      [`--inspect=127.0.0.1:${port}`, ATTACH_TARGET],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('node --inspect did not start listening')), 30000);
      let stderr = '';
      targetProcess!.stderr!.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
        if (stderr.includes('Debugger listening on')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      targetProcess!.on('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`target exited prematurely (code ${code}): ${stderr}`));
      });
    });

    const sid = await createSession('js-fnbp-attach');
    const attachResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'attach_to_process',
      arguments: { sessionId: sid, host: '127.0.0.1', port }
    }));
    expect(attachResponse.success, JSON.stringify(attachResponse)).toBe(true);

    // Ensure the target is running (attach may leave it paused), then set the
    // function breakpoint while it runs: no pause frames exist, so the bridge
    // resolves via global Runtime.evaluate.
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });
    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', { sessionId: sid, function: 'globalThis.tick' });
    expect(bpRes.success, JSON.stringify(bpRes)).toBe(true);

    const fnBp = await waitForVerifiedFunctionBp(sid, 'globalThis.tick');
    expect(fnBp?.verified, `function breakpoint state: ${JSON.stringify(fnBp)}`).toBe(true);

    // The interval calls tick every 100ms — the stop lands promptly.
    const stack = await waitForPausedState(sid);
    expect(stack).not.toBeNull();
    expect(stack!.stackFrames![0].name).toContain('tick');
    expect((await getSessionSnapshot(sid))?.lastStop?.reason).toBe('function breakpoint');

    // Leave the target alive for the detach.
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sid });
    const detachRes = await callToolSafely(mcpClient!, 'detach_from_process', { sessionId: sid });
    expect(detachRes.success).toBe(true);
    expect(targetProcess!.exitCode).toBeNull();
  }, 90000);
});
