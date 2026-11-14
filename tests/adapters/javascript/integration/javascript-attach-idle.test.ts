/**
 * A pause on a Node program that is running nothing, with real js-debug
 * (issue #1146).
 *
 * The defect: a default (pausing) attach to an idle HTTP server with one line
 * breakpoint set left the server frozen and spinning a full core. The session
 * kept reporting `running`, the breakpoint stayed unbound, and
 * `close_debug_session` answered `released: true` while the server stayed
 * frozen. Measured on Node 24 with js-debug 1.140, two of three runs.
 *
 * Why: a pause sent to a program that is executing nothing stays armed in V8
 * and fires inside the next code that runs there. The attach flow armed the
 * pause, waited, and then re-sent the breakpoints; js-debug answered that
 * re-send by evaluating a script of its own in the target, three times back
 * to back, and the pause fired inside the first. js-debug then resumed it
 * without reporting it, or Node's inspector stopped dispatching and spun.
 *
 * What these cases pin, each one a fact that does not depend on that race:
 *   - a default attach answers `paused` (it answered `running`, `pending`),
 *     with the breakpoint bound, and a request then reaches the breakpoint;
 *   - `pause_execution` on an idle server lands too, attached or launched;
 *   - where the pause cannot be made to land, a breakpoint request waits for
 *     it instead of running adapter code under it, and is sent when it lands;
 *   - after `close_debug_session` the server answers.
 *
 * The pause lands because the server schedules one no-op timer in the target
 * before it requests the pause, so the stop is in `processTimers`: no program
 * frame, and the answer says so.
 *
 * One thing is outside the server's hands: js-debug evaluates code of its own
 * in the target shortly after it attaches (telemetry, the environment for
 * child processes). On a loaded machine that can run after the pause is
 * armed, and the pause then lands inside it: `paused` on a sourceless
 * `<anonymous>` frame, measured 6 runs in 6 at 16 busy processes on 16 cores.
 * Both landings are a real pause with the same note, so the cases accept
 * either, and the held-breakpoint case first works its way to a pause that
 * is really pending.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const idleServer = path.join(root, 'examples/javascript/idle_server_attach_target.js');
const noTimersServer = path.join(root, 'tests/fixtures/javascript/idle-attach/no-timers-server.cjs');
const lineContaining = (file: string, text: string): number =>
  fs.readFileSync(file, 'utf8').split('\n').findIndex((line) => line.includes(text)) + 1;
const IDLE_BREAKPOINT_LINE = lineContaining(idleServer, 'const total = doWork();');
const NO_TIMERS_BREAKPOINT_LINE = lineContaining(noTimersServer, 'BREAK-HERE');

interface Stop extends ToolAnswer {
  pending?: boolean;
  note?: string;
  location?: { file: string; line: number };
  noProgramFrame?: boolean;
}
interface BreakpointAnswer extends ToolAnswer { verified?: boolean }
interface BreakpointList extends ToolAnswer { breakpoints: Array<{ line?: number; verified: boolean }> }
interface Closed extends ToolAnswer { released?: boolean }
interface Output extends ToolAnswer { entries: Array<{ output: string }> }

interface Target { proc: ChildProcess; inspectPort: number; httpPort: number }

let server: StdioClientHandle;
let targets: Target[] = [];
const call = <T extends ToolAnswer = ToolAnswer>(name: string, args: Record<string, unknown> = {}): Promise<T> => server.call<T>(name, args);

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => (port ? resolve(port) : reject(new Error('no free port'))));
    });
    probe.on('error', reject);
  });
}

/** Start a server fixture under `node --inspect` and wait for the port it prints. */
async function startTarget(script: string): Promise<Target> {
  const inspectPort = await getFreePort();
  const proc = spawn(process.execPath, [`--inspect=127.0.0.1:${inspectPort}`, script], {
    cwd: path.dirname(script),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let buffer = '';
  const target: Target = { proc, inspectPort, httpPort: 0 };
  // Register before readiness so afterEach also cleans up a failed startup.
  targets.push(target);
  target.httpPort = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`the server did not print its port: ${buffer}`)), 30000);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const listening = /listening (\d+)/.exec(buffer);
      // The inspector's own banner goes to stderr first; wait for both.
      if (listening && buffer.includes('Debugger listening on')) { clearTimeout(timer); resolve(Number(listening[1])); }
    };
    proc.stdout!.on('data', onData);
    proc.stderr!.on('data', onData);
    proc.on('error', (error) => { clearTimeout(timer); reject(error); });
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error(`the server exited ${code} before listening: ${buffer}`)); });
  });
  return target;
}

type Fetched = { body: string } | { failed: string };

/** GET a path on the target; never rejects, so a request parked on a stop can be awaited later. */
function get(port: number, urlPath: string, timeoutMs: number): Promise<Fetched> {
  return new Promise((resolve) => {
    const request = http.get({ host: '127.0.0.1', port, path: urlPath, agent: false }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ body: body.trim() }));
    });
    request.setTimeout(timeoutMs, () => { request.destroy(); resolve({ failed: `no answer within ${timeoutMs}ms` }); });
    request.on('error', (error) => resolve({ failed: error.message }));
  });
}

/** The session's breakpoints as `line:verified`, polled until `accept` or the timeout. */
async function breakpointsUntil(accept: (states: string[]) => boolean, timeoutMs = 10000): Promise<string[]> {
  const read = async () => (await call<BreakpointList>('list_breakpoints')).breakpoints.map((bp) => `${bp.line}:${bp.verified}`);
  const deadline = Date.now() + timeoutMs;
  let states = await read();
  while (!accept(states) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    states = await read();
  }
  return states;
}

/**
 * The idle landing: a real pause, not a pending one, and the answer says it
 * is not the program's. Where: the timer code the wake ran, or (on a loaded
 * machine) js-debug's own evaluation, which has no source.
 */
function expectIdleLanding(stop: Stop): void {
  expect(stop.success, JSON.stringify(stop)).toBe(true);
  expect(stop.state, JSON.stringify(stop)).toBe('paused');
  expect(stop.pending, JSON.stringify(stop)).toBeUndefined();
  expect(stop.location?.file, JSON.stringify(stop)).toMatch(/timers|<unknown_source>/);
  expect(stop.note, JSON.stringify(stop)).toMatch(/No program frame is active/);
}

/**
 * Get to a pause that is pending on a server the wake cannot reach. A pause
 * that landed inside one of js-debug's own evaluations is resumed and asked
 * for again: once those have run, nothing is left for it to land in.
 */
async function reachPendingPause(first: Stop): Promise<void> {
  let answer = first;
  for (let attempt = 0; attempt < 5 && answer.state === 'paused'; attempt++) {
    expect((await call('continue_execution')).success).toBe(true);
    answer = await call<Stop>('pause_execution');
  }
  expect(answer.state, JSON.stringify(answer)).toBe('running');
  expect(answer.pending, JSON.stringify(answer)).toBe(true);
}

async function waitForBreakpointStop(file: string, line: number): Promise<void> {
  const stop = await call<Stop>('wait_for_stop', { timeout: 20000 });
  expect(stop.state, JSON.stringify(stop)).toBe('paused');
  expect(stop.message, JSON.stringify(stop)).toMatch(/^Paused \(breakpoint\)/);
  expect(path.basename(stop.location?.file ?? ''), JSON.stringify(stop)).toBe(path.basename(file));
  expect(stop.location?.line, JSON.stringify(stop)).toBe(line);
}

beforeEach(async () => {
  server = await startStdioClient({ name: 'js-attach-idle', callTimeoutMs: 60_000 });
});

afterEach(async () => {
  await server?.close();
  for (const target of targets) {
    if (target.proc.exitCode === null) target.proc.kill();
  }
  targets = [];
});

describe('a pause on an idle Node server lands, and nothing is left frozen (issue #1146)', () => {
  it('a default attach with a breakpoint set answers paused, binds the breakpoint, and the server answers after close', async () => {
    const target = await startTarget(idleServer);
    await server.createSession('javascript', 'attach-idle-default');
    const bp = await call<BreakpointAnswer>('set_breakpoint', { file: idleServer, line: IDLE_BREAKPOINT_LINE });
    expect(bp.success, JSON.stringify(bp)).toBe(true);

    const attached = await call<Stop>('attach_to_process', { host: '127.0.0.1', port: target.inspectPort, verifyTimeout: 20000 });

    expectIdleLanding(attached);
    expect(attached.message).toBe(`Attached to process at 127.0.0.1:${target.inspectPort}`);
    expect(await breakpointsUntil((states) => states.every((state) => state.endsWith(':true')))).toEqual([`${IDLE_BREAKPOINT_LINE}:true`]);

    expect((await call('continue_execution')).success).toBe(true);
    const request = get(target.httpPort, '/work', 30000);
    await waitForBreakpointStop(idleServer, IDLE_BREAKPOINT_LINE);
    expect((await call('continue_execution')).success).toBe(true);
    expect(await request).toEqual({ body: 'work done: 332833500' });

    const closed = await call<Closed>('close_debug_session');
    expect(closed.success, JSON.stringify(closed)).toBe(true);
    server.sessionId = undefined;
    expect(await get(target.httpPort, '/', 10000)).toEqual({ body: 'ok' });
  }, 120000);

  it('pause_execution on an attached idle server lands, and a breakpoint set then binds at once', async () => {
    const target = await startTarget(idleServer);
    await server.createSession('javascript', 'attach-idle-pause');
    const attached = await call<Stop>('attach_to_process', { host: '127.0.0.1', port: target.inspectPort, stopOnEntry: false, verifyTimeout: 20000 });
    expect(attached.state, JSON.stringify(attached)).toBe('running');

    expectIdleLanding(await call<Stop>('pause_execution'));

    const bp = await call<BreakpointAnswer>('set_breakpoint', { file: idleServer, line: IDLE_BREAKPOINT_LINE });
    expect(bp.verified, JSON.stringify(bp)).toBe(true);
    expect(bp.warning, JSON.stringify(bp)).toBeUndefined();
    expect((await call('continue_execution')).success).toBe(true);
    const request = get(target.httpPort, '/work', 30000);
    await waitForBreakpointStop(idleServer, IDLE_BREAKPOINT_LINE);
    expect((await call('continue_execution')).success).toBe(true);
    expect(await request).toEqual({ body: 'work done: 332833500' });
  }, 120000);

  it('where the pause cannot land, a breakpoint request waits for it and is sent when it does', async () => {
    // This server replaces setTimeout once it listens, so the wake never
    // fires: the pause is pending, as it was for every idle server before.
    const target = await startTarget(noTimersServer);
    await server.createSession('javascript', 'attach-idle-held');
    const attached = await call<Stop>('attach_to_process', { host: '127.0.0.1', port: target.inspectPort, verifyTimeout: 20000 });
    expect(attached.success, JSON.stringify(attached)).toBe(true);
    await reachPendingPause(attached);

    const bp = await call<BreakpointAnswer>('set_breakpoint', { file: noTimersServer, line: NO_TIMERS_BREAKPOINT_LINE });

    expect(bp.success, JSON.stringify(bp)).toBe(true);
    expect(bp.verified, JSON.stringify(bp)).toBe(false);
    expect(bp.warning, JSON.stringify(bp)).toMatch(/^Held: a pause is pending on this session/);

    // The request is the first code the server runs: the pending pause lands in it.
    const request = get(target.httpPort, '/work', 30000);
    const landed = await call<Stop>('wait_for_stop', { timeout: 20000 });
    expect(landed.state, JSON.stringify(landed)).toBe('paused');
    expect(landed.message, JSON.stringify(landed)).toMatch(/^Paused \(pause\)/);

    // Resume at once, without looking at the breakpoint first: the held
    // request goes out with the stop, and a resume must wait for it. (In the
    // Linux image a client that continued 47 ms after the stop ran the
    // request past a breakpoint that was not set yet.)
    expect((await call('continue_execution')).success).toBe(true);
    await waitForBreakpointStop(noTimersServer, NO_TIMERS_BREAKPOINT_LINE);
    expect(await breakpointsUntil((states) => states.every((state) => state.endsWith(':true')), 1)).toEqual([`${NO_TIMERS_BREAKPOINT_LINE}:true`]);
    expect((await call('continue_execution')).success).toBe(true);
    expect(await request).toEqual({ body: 'work done: 332833500' });

    const closed = await call<Closed>('close_debug_session');
    expect(closed.success, JSON.stringify(closed)).toBe(true);
    server.sessionId = undefined;
    expect(await get(target.httpPort, '/', 10000)).toEqual({ body: 'ok' });
  }, 120000);

  it('pause_execution on a launched idle server lands too', async () => {
    await server.createSession('javascript', 'launch-idle-pause');
    const started = await call<Stop>('start_debugging', { scriptPath: idleServer });
    expect(started.success, JSON.stringify(started)).toBe(true);
    // The server is idle once it has printed its port.
    const deadline = Date.now() + 20000;
    let port = 0;
    while (!port && Date.now() < deadline) {
      const output = await call<Output>('get_output', { limit: 100 });
      port = Number(/listening (\d+)/.exec(output.entries.map((entry) => entry.output).join(''))?.[1] ?? 0);
      if (!port) await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(port, 'the launched server never printed its port').toBeGreaterThan(0);

    expectIdleLanding(await call<Stop>('pause_execution'));

    expect((await call('continue_execution')).success).toBe(true);
    expect(await get(port, '/work', 10000)).toEqual({ body: 'work done: 332833500' });
  }, 120000);
});
