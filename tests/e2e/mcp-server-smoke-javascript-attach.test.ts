/**
 * JavaScript Attach-Mode Smoke Tests via MCP Interface (issue #124)
 *
 * Test 1 — invariant: attach_to_process must not lie. Attach to a real
 * `node --inspect=<port>` process and require that EITHER attach reports
 * success AND the session is actually debuggable (non-empty threads, real
 * stack frames) OR attach reports a truthful failure. What must never happen
 * is the original issue #124 behavior: success + "paused" while the js-debug
 * child session never connected to the inspector and every downstream tool
 * answered empty-but-successful results.
 *
 * Test 2 — acceptance: full working attach cycle. Attach, set a breakpoint,
 * continue to hit it, evaluate an expression at the stop, then
 * detach_from_process must leave the target alive and running.
 *
 * Test 3 — stopOnEntry:false: attaching must NOT pause the target (the
 * js-debug child adoption path must not force an entry stop), and detach
 * must leave it alive.
 *
 * Tests 5/6 — forking targets (issue #501): attaching must not wedge child
 * processes the target fork()s. By default the auto-attach bootloader is off,
 * so forks run untouched; with autoAttachChildProcesses:true each fork parks
 * under waitForDebugger and js-debug requests adoption — the single-child
 * limitation means it must be released to run undebugged, not dropped.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import net from 'net';
import http from 'http';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const TARGET_SCRIPT = path.resolve(ROOT, 'examples', 'javascript', 'attach_target.js');
const FORK_TARGET_SCRIPT = path.resolve(ROOT, 'examples', 'javascript', 'fork_attach_target.js');
const IDLE_TARGET_SCRIPT = path.resolve(ROOT, 'examples', 'javascript', 'idle_server_attach_target.js');
const BREAKPOINT_LINE = 11; // `counter += 1;` inside tick()

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        srv.close(() => reject(new Error('Could not determine port')));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

interface Target {
  proc: ChildProcess;
  port: number;
  stdout: () => string;
}

/** Spawn a tick target with an open inspector port and wait until it listens. */
async function spawnTarget(script: string = TARGET_SCRIPT): Promise<Target> {
  const port = await getFreePort();
  const proc = spawn(
    process.execPath,
    [`--inspect=127.0.0.1:${port}`, script],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let stdout = '';
  proc.stdout!.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('node --inspect did not start listening within 30s')),
      30000
    );
    let stderr = '';
    proc.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.includes('Debugger listening on')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`target exited prematurely (code ${code}): ${stderr}`));
    });
  });

  return { proc, port, stdout: () => stdout };
}

describe('MCP Server JavaScript Attach-Mode Smoke Tests', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;
  let targetProcess: ChildProcess | null = null;

  beforeAll(async () => {
    const serverEntry = path.join(ROOT, 'dist', 'index.js');
    if (!existsSync(serverEntry)) {
      throw new Error(
        `Server entry missing at ${serverEntry}. Run "npm run build" before executing this test.`
      );
    }

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverEntry, '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client({
      name: 'js-attach-smoke-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[JS Attach Test] MCP client connected');
  }, 30000);

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      } catch {
        // Session may already be closed
      }
      sessionId = null;
    }
    if (targetProcess && !targetProcess.killed) {
      targetProcess.kill('SIGKILL');
    }
    targetProcess = null;
  });

  afterAll(async () => {
    if (mcpClient) {
      await mcpClient.close();
    }
    if (transport) {
      await transport.close();
    }
    console.log('[JS Attach Test] Cleanup completed');
  });

  async function createSessionAndAttach(
    port: number,
    extraAttachArgs: Record<string, unknown> = {}
  ) {
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'javascript', name: 'js-attach-test' }
    });
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    expect(sessionId).toBeTruthy();

    const attachResult = await mcpClient!.callTool({
      name: 'attach_to_process',
      // verifyTimeout: js-debug child adoption is load-sensitive; on a
      // heavily loaded host (e.g. a full-suite run) the default 5s window
      // hard-fails a healthy attach (issue #143 — this knob exists for
      // exactly this). The poll exits as soon as threads appear, so a
      // generous window costs nothing on a responsive machine.
      arguments: { sessionId, host: '127.0.0.1', port, verifyTimeout: 20000, ...extraAttachArgs }
    });
    return parseSdkToolResult(attachResult);
  }

  interface StoredBreakpoint {
    line: number;
    verified: boolean;
    adapterId?: number;
    message?: string;
  }

  /**
   * Poll list_breakpoints until the breakpoint at BREAKPOINT_LINE reports
   * verified:true with an adapterId (eventual-consistency pattern from
   * mcp-server-breakpoint-management.test.ts). Returns null on deadline.
   */
  async function pollForVerifiedBreakpoint(deadlineMs = 10000): Promise<StoredBreakpoint | null> {
    const deadline = Date.now() + deadlineMs;
    let last: StoredBreakpoint | undefined;
    while (Date.now() < deadline) {
      const listResult = await callToolSafely(mcpClient!, 'list_breakpoints', { sessionId: sessionId! });
      const bps = (listResult.breakpoints as StoredBreakpoint[] | undefined) ?? [];
      last = bps.find(bp => bp.line === BREAKPOINT_LINE);
      if (last && last.verified === true && last.adapterId !== undefined) {
        return last;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    console.log(`[JS Attach Test] pollForVerifiedBreakpoint deadline; last state: ${JSON.stringify(last)}`);
    return null;
  }

  it('attach_to_process must either really attach (threads + frames) or fail loudly', async () => {
    const target = await spawnTarget();
    targetProcess = target.proc;

    const attachResponse = await createSessionAndAttach(target.port);
    console.log('[JS Attach Test] attach_to_process response:', JSON.stringify(attachResponse));

    if (attachResponse.success === true) {
      // Branch (a): attach claims success — hold it to that claim.
      const threadsResult = await callToolSafely(mcpClient!, 'list_threads', { sessionId: sessionId! });
      const threads = (threadsResult.threads as Array<{ id: number; name: string }> | undefined) ?? [];
      expect(
        threads.length,
        `attach_to_process reported success + state "${attachResponse.state}" but list_threads ` +
        `returned no threads (${JSON.stringify(threadsResult)}) — the attach is lying about being ` +
        `debuggable; the js-debug child session likely never connected to the inspector (issue #124)`
      ).toBeGreaterThan(0);

      const stackResult = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId: sessionId! });
      expect(
        stackResult.success,
        `attach_to_process reported success but get_stack_trace failed: ` +
        `${JSON.stringify(stackResult)} (issue #124)`
      ).toBe(true);
      const frames = (stackResult.stackFrames as unknown[] | undefined) ?? [];
      expect(
        frames.length,
        `attach_to_process reported success + state "${attachResponse.state}" but get_stack_trace ` +
        `returned an empty-but-successful stack (${JSON.stringify(stackResult)}) — the attach is ` +
        `lying about being debuggable (issue #124)`
      ).toBeGreaterThan(0);
    } else {
      // Branch (b): a truthful failure must carry a real error.
      const errorText = String(attachResponse.message ?? attachResponse.error ?? '');
      expect(
        errorText.length,
        `attach_to_process failed without an actionable error message: ${JSON.stringify(attachResponse)}`
      ).toBeGreaterThan(0);
      console.log(`[JS Attach Test] Attach failed truthfully: ${errorText}`);
    }

    // In both branches, the attach attempt must not have harmed the target.
    await new Promise(r => setTimeout(r, 500));
    expect(
      targetProcess!.exitCode,
      'the attach attempt must leave the target process running'
    ).toBeNull();
  }, 120000);

  it('should attach, hit a breakpoint, evaluate, and detach leaving the target running', async () => {
    const target = await spawnTarget();
    targetProcess = target.proc;

    // 1. Attach (default stopOnEntry: the target is paused once attached)
    const attachResponse = await createSessionAndAttach(target.port);
    expect(attachResponse.success, `attach failed: ${JSON.stringify(attachResponse)}`).toBe(true);
    expect(attachResponse.state).toBe('paused');

    // 2. Breakpoint inside the tick loop
    const bpResult = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId: sessionId!,
      file: TARGET_SCRIPT,
      line: BREAKPOINT_LINE
    });
    expect(bpResult.success, `set_breakpoint failed: ${JSON.stringify(bpResult)}`).toBe(true);

    // 3. Continue and wait for the breakpoint to fire (tick runs every 100ms)
    const contResult = await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sessionId! });
    expect(contResult.success, `continue_execution failed: ${JSON.stringify(contResult)}`).toBe(true);

    let hit: { line?: number } | null = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const stack = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId: sessionId! });
      const frames = (stack.stackFrames as Array<{ file?: string; line?: number }> | undefined) ?? [];
      if (stack.success && frames.length > 0 && frames[0].line === BREAKPOINT_LINE) {
        hit = frames[0];
        break;
      }
    }
    expect(hit, 'breakpoint at tick() was not hit within 10s of continue').not.toBeNull();

    // 3b. The store must tell the truth about a breakpoint that just fired
    // (issue #500): verified with a child-session adapterId, and no
    // provisional "Unbound breakpoint" note. Poll — verification is
    // eventually consistent on the child-session path.
    const stored = await pollForVerifiedBreakpoint();
    expect(
      stored,
      'list_breakpoints must report verified:true + adapterId for a breakpoint that has ' +
      'demonstrably fired (issue #500: js attach breakpoints were stuck "Unbound breakpoint")'
    ).not.toBeNull();
    expect(stored!.message ?? '').not.toMatch(/Unbound breakpoint|breakpoint\.provisionalBreakpoint/);

    // 4. Evaluate at the stop — counter is live program state
    const evalResult = await callToolSafely(mcpClient!, 'evaluate_expression', {
      sessionId: sessionId!,
      expression: 'counter'
    });
    expect(evalResult.success, `evaluate_expression failed: ${JSON.stringify(evalResult)}`).toBe(true);
    expect(Number(evalResult.result)).toBeGreaterThanOrEqual(1);

    // 5. Detach without terminating; the target must stay alive and resume
    const outputBeforeDetach = target.stdout().length;
    const detachResult = await callToolSafely(mcpClient!, 'detach_from_process', {
      sessionId: sessionId!,
      terminateProcess: false
    });
    expect(detachResult.success, `detach_from_process failed: ${JSON.stringify(detachResult)}`).toBe(true);

    await new Promise(r => setTimeout(r, 2500));
    expect(targetProcess!.exitCode, 'detach must leave the target process alive').toBeNull();
    expect(
      target.stdout().length,
      'the target must resume ticking after detach (it was left paused or was killed)'
    ).toBeGreaterThan(outputBeforeDetach);
  }, 120000);

  it('verifies a breakpoint set BEFORE attach once the attach completes (issue #500)', async () => {
    const target = await spawnTarget();
    targetProcess = target.proc;

    // 1. Create the session and set the breakpoint FIRST — the exact shape
    // that stayed "Unbound breakpoint" forever: js-debug registers the
    // breakpoint via its pending-target queue during adoption and then
    // answers identical re-sends with an empty no-change echo, so only the
    // post-attach fresh-echo re-sync can recover the verified state.
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'javascript', name: 'js-attach-preset-bp' }
    });
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    expect(sessionId).toBeTruthy();

    const bpResult = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId: sessionId!,
      file: TARGET_SCRIPT,
      line: BREAKPOINT_LINE
    });
    expect(bpResult.success, `pre-attach set_breakpoint failed: ${JSON.stringify(bpResult)}`).toBe(true);

    // 2. Attach
    const attachResult = await mcpClient!.callTool({
      name: 'attach_to_process',
      arguments: { sessionId, host: '127.0.0.1', port: target.port, verifyTimeout: 20000 }
    });
    const attachResponse = parseSdkToolResult(attachResult);
    expect(attachResponse.success, `attach failed: ${JSON.stringify(attachResponse)}`).toBe(true);

    // 3. The pre-attach breakpoint must become verified with an adapterId
    const stored = await pollForVerifiedBreakpoint();
    expect(
      stored,
      'a breakpoint set before attach_to_process must verify once the attach completes ' +
      '(issue #500: it stayed "Unbound breakpoint" with no adapterId forever)'
    ).not.toBeNull();
    expect(stored!.message ?? '').not.toMatch(/Unbound breakpoint|breakpoint\.provisionalBreakpoint/);

    // 4. And it must actually fire
    const contResult = await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sessionId! });
    expect(contResult.success, `continue_execution failed: ${JSON.stringify(contResult)}`).toBe(true);
    let hit = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const stack = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId: sessionId! });
      const frames = (stack.stackFrames as Array<{ line?: number }> | undefined) ?? [];
      if (stack.success && frames.length > 0 && frames[0].line === BREAKPOINT_LINE) {
        hit = true;
        break;
      }
    }
    expect(hit, 'the pre-attach breakpoint was reported verified but never fired').toBe(true);

    // 5. Detach must leave the target alive
    const detachResult = await callToolSafely(mcpClient!, 'detach_from_process', {
      sessionId: sessionId!,
      terminateProcess: false
    });
    expect(detachResult.success, `detach_from_process failed: ${JSON.stringify(detachResult)}`).toBe(true);
    await new Promise(r => setTimeout(r, 500));
    expect(targetProcess!.exitCode, 'detach must leave the target process alive').toBeNull();
  }, 120000);

  it('should not pause the target when attaching with stopOnEntry:false', async () => {
    const target = await spawnTarget();
    targetProcess = target.proc;

    const attachResponse = await createSessionAndAttach(target.port, { stopOnEntry: false });
    expect(attachResponse.success, `attach failed: ${JSON.stringify(attachResponse)}`).toBe(true);
    expect(attachResponse.state).toBe('running');

    // Give child adoption time to settle, then verify the target kept running:
    // the tick loop prints every ~1s, so new output must appear.
    const outputAfterAttach = target.stdout().length;
    await new Promise(r => setTimeout(r, 3000));
    expect(
      target.stdout().length,
      'attach with stopOnEntry:false must not pause the target (issue #124: the js-debug ' +
      'child adoption path must not force an entry stop)'
    ).toBeGreaterThan(outputAfterAttach);

    const detachResult = await callToolSafely(mcpClient!, 'detach_from_process', {
      sessionId: sessionId!,
      terminateProcess: false
    });
    expect(detachResult.success, `detach_from_process failed: ${JSON.stringify(detachResult)}`).toBe(true);

    await new Promise(r => setTimeout(r, 500));
    expect(targetProcess!.exitCode, 'detach must leave the target process alive').toBeNull();
  }, 120000);

  /** Poll list_debug_sessions until this session reports the wanted state. */
  async function pollForSessionState(wanted: string, deadlineMs: number): Promise<string | undefined> {
    const deadline = Date.now() + deadlineMs;
    let lastState: string | undefined;
    while (Date.now() < deadline) {
      const listResult = await callToolSafely(mcpClient!, 'list_debug_sessions', {});
      const sessions = (listResult.sessions as Array<{ id: string; state: string }> | undefined) ?? [];
      lastState = sessions.find(s => s.id === sessionId)?.state;
      if (lastState === wanted) {
        return lastState;
      }
      await new Promise(r => setTimeout(r, 250));
    }
    return lastState;
  }

  it('pause_execution lands on an attached IDLE server once JS runs (issue #513)', async () => {
    // The #513 repro: attach (stopOnEntry:false) to a server whose event loop
    // is completely idle, request a pause, then make the server execute JS.
    // Pre-fix, js-debug's smart-stepper turned the pause into an endless
    // auto-step through internal frames and the stop never landed.
    const target = await spawnTarget(IDLE_TARGET_SCRIPT);
    targetProcess = target.proc;

    // The fixture prints `listening <port>` for its HTTP port
    const httpPort = await (async () => {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const m = target.stdout().match(/listening (\d+)/);
        if (m) return Number(m[1]);
        await new Promise(r => setTimeout(r, 100));
      }
      throw new Error(`idle server never printed its port; stdout: ${target.stdout()}`);
    })();

    const attachResponse = await createSessionAndAttach(target.port, { stopOnEntry: false });
    expect(attachResponse.success, `attach failed: ${JSON.stringify(attachResponse)}`).toBe(true);

    const pauseResult = await callToolSafely(mcpClient!, 'pause_execution', { sessionId: sessionId! });
    expect(pauseResult.success, `pause_execution failed: ${JSON.stringify(pauseResult)}`).toBe(true);

    const pauseData = (pauseResult.data ?? {}) as { pending?: boolean };
    if (pauseResult.state !== 'paused') {
      // Truly idle server: the pause is armed but cannot land until JS runs —
      // the documented pending contract
      expect(pauseData.pending, `expected pending pause, got: ${JSON.stringify(pauseResult)}`).toBe(true);

      // Make the server execute JS; the armed pause must now land. The pause
      // typically fires BEFORE the handler can respond, so the request
      // hanging (and being torn down) is the expected outcome — its only job
      // is to put JavaScript on the target's event loop.
      await new Promise<void>(resolve => {
        const req = http.get(`http://127.0.0.1:${httpPort}/work`, res => {
          res.resume();
          res.on('end', resolve);
          res.on('error', () => resolve());
        });
        req.on('error', () => resolve());
        req.setTimeout(3000, () => {
          req.destroy();
          resolve();
        });
      });

      const state = await pollForSessionState('paused', 15000);
      expect(
        state,
        'the pending pause must land once the target provably executes JS (issue #513)'
      ).toBe('paused');
    }

    // The paused session must be genuinely usable
    const stackResult = await callToolSafely(mcpClient!, 'get_stack_trace', {
      sessionId: sessionId!,
      includeInternals: true
    });
    expect(stackResult.success, `get_stack_trace failed: ${JSON.stringify(stackResult)}`).toBe(true);
    const frames = (stackResult.stackFrames as unknown[] | undefined) ?? [];
    expect(frames.length, 'paused session must report at least one stack frame').toBeGreaterThan(0);
    expect(stackResult.stopReason).toBe('pause');

    // Leave the target running for teardown
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sessionId! });
  }, 120000);

  it('pause_execution stops a busy attached target within the grace window', async () => {
    // First-ever attach+pause smoke: the ticking target executes JS every
    // 100ms, so the stop must land inside pause_execution's own 5s grace.
    const target = await spawnTarget();
    targetProcess = target.proc;

    const attachResponse = await createSessionAndAttach(target.port, { stopOnEntry: false });
    expect(attachResponse.success, `attach failed: ${JSON.stringify(attachResponse)}`).toBe(true);

    const pauseResult = await callToolSafely(mcpClient!, 'pause_execution', { sessionId: sessionId! });
    expect(pauseResult.success, `pause_execution failed: ${JSON.stringify(pauseResult)}`).toBe(true);

    // A 100ms ticker gives the pause plenty to land on; tolerate pending only
    // long enough for the state to flip
    if (pauseResult.state !== 'paused') {
      const state = await pollForSessionState('paused', 10000);
      expect(state, 'pause must land on a target that runs JS every 100ms').toBe('paused');
    }

    const stackResult = await callToolSafely(mcpClient!, 'get_stack_trace', {
      sessionId: sessionId!,
      includeInternals: true
    });
    expect(stackResult.success).toBe(true);
    expect(((stackResult.stackFrames as unknown[] | undefined) ?? []).length).toBeGreaterThan(0);

    await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sessionId! });
  }, 120000);

  /** Count completed fork→parent IPC handshakes in the fork target's stdout. */
  function countHandshakes(target: Target): number {
    return (target.stdout().match(/child-handshake /g) ?? []).length;
  }

  /** Poll until the fork target completes a NEW handshake, or the deadline. */
  async function waitForHandshakeProgress(target: Target, baseline: number, deadlineMs: number): Promise<boolean> {
    const deadline = Date.now() + deadlineMs;
    while (Date.now() < deadline) {
      if (countHandshakes(target) > baseline) {
        return true;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return false;
  }

  it('forked children keep completing their IPC handshake while attached (issue #501)', async () => {
    const target = await spawnTarget(FORK_TARGET_SCRIPT);
    targetProcess = target.proc;

    const attachResponse = await createSessionAndAttach(target.port, { stopOnEntry: false });
    expect(attachResponse.success, `attach failed: ${JSON.stringify(attachResponse)}`).toBe(true);

    // Forks started AFTER the attach must complete their fork→IPC→ack round
    // trip. Pre-fix, js-debug's auto-attach bootloader (attach default: on)
    // parked every fork in waitForDebugger and only one target could ever be
    // adopted — each fork wedged until the fixture's 5s diagnostic timeout.
    const baseline = countHandshakes(target);
    const progressed = await waitForHandshakeProgress(target, baseline, 45000);
    expect(
      progressed,
      `no fork completed its IPC handshake within 45s of attach (issue #501: children ` +
      `parked by the auto-attach bootloader); target stdout:\n${target.stdout()}`
    ).toBe(true);
    expect(
      target.stdout(),
      'a forked child hit the 5s wedge diagnostic while attached (issue #501)'
    ).not.toContain('child-wedged');

    const detachResult = await callToolSafely(mcpClient!, 'detach_from_process', {
      sessionId: sessionId!,
      terminateProcess: false
    });
    expect(detachResult.success, `detach_from_process failed: ${JSON.stringify(detachResult)}`).toBe(true);
    await new Promise(r => setTimeout(r, 500));
    expect(targetProcess!.exitCode, 'detach must leave the target process alive').toBeNull();
  }, 120000);

  it('releases forks it cannot adopt when autoAttachChildProcesses is opted in (issue #501)', async () => {
    const target = await spawnTarget(FORK_TARGET_SCRIPT);
    targetProcess = target.proc;

    const attachResponse = await createSessionAndAttach(target.port, {
      stopOnEntry: false,
      adapterConfig: { autoAttachChildProcesses: true }
    });
    expect(attachResponse.success, `attach failed: ${JSON.stringify(attachResponse)}`).toBe(true);

    // The key is declared in supportedAttachKeys — opting in must not trip
    // the unrecognized-adapterConfig-key warning (issue #466 mechanism)
    const warning = String(attachResponse.warning ?? '');
    expect(
      warning,
      `autoAttachChildProcesses is a supported attach key but the attach warned about it: ${warning}`
    ).not.toContain('autoAttachChildProcesses');

    // With the bootloader ON, every fork parks under waitForDebugger and
    // js-debug requests adoption for it. The single-child limitation means it
    // cannot be adopted — it must be RELEASED to run undebugged (attach with
    // its __pendingTargetId, then detach), so handshakes keep completing.
    const baseline = countHandshakes(target);
    const progressed = await waitForHandshakeProgress(target, baseline, 45000);
    expect(
      progressed,
      `no fork completed its IPC handshake within 45s of attach with ` +
      `autoAttachChildProcesses:true — unadoptable forks are not being released ` +
      `(issue #501); target stdout:\n${target.stdout()}`
    ).toBe(true);

    // Debugging the parent must remain intact after releases happened
    const threadsResult = await callToolSafely(mcpClient!, 'list_threads', { sessionId: sessionId! });
    const threads = (threadsResult.threads as unknown[] | undefined) ?? [];
    expect(
      threads.length,
      `list_threads failed after fork releases: ${JSON.stringify(threadsResult)}`
    ).toBeGreaterThan(0);

    const detachResult = await callToolSafely(mcpClient!, 'detach_from_process', {
      sessionId: sessionId!,
      terminateProcess: false
    });
    expect(detachResult.success, `detach_from_process failed: ${JSON.stringify(detachResult)}`).toBe(true);
    await new Promise(r => setTimeout(r, 500));
    expect(targetProcess!.exitCode, 'detach must leave the target process alive').toBeNull();
  }, 120000);
});
