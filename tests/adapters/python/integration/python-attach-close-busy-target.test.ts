/**
 * Ending a session while the attached Python target is busy (issue #1325).
 *
 * A target started with `python -m debugpy --listen` has one debug adapter,
 * started once, which owns the listening port. That adapter answers a
 * `disconnect` only after pydevd inside the debuggee has processed it, which
 * waits for the interpreter: within milliseconds on an idle target, as long as
 * the hold on a busy one. When its client closes the connection before the
 * reply is written, the adapter ends itself (`debugpy/common/messaging.py`,
 * `_run_handlers`: `self.close(); os._exit(1)`), and the target's debug port is
 * closed for the rest of its life.
 *
 * `close_debug_session` used to send that disconnect from the worker's
 * shutdown with a 1 s cap and then close the connection: a close during a
 * hold of more than a second closed the port for good (measured with 0.27.0).
 * And a close that arrived while a detach waited sent a second disconnect on
 * the same connection, which did the same, while both calls said released.
 *
 * Here the target holds the interpreter with one C call that blocks with the
 * GIL held until this test lets it go (`busy_target.py`, `block <port>`: a
 * `recv` on a loopback connection the target opened to a listener here). The
 * test, not a clock, ends the hold. The target prints `HOLD_START` before the
 * call, while it still runs Python code; what says the call has begun is the
 * target's ticker thread, which writes a byte on that connection every 20 ms
 * for as long as it gets the GIL. The test waits, after `HOLD_START` and at
 * least one tick, until no tick has arrived for 300 ms, and only then sends
 * the ending. Then: the ending is still unanswered 2 s later (the old close
 * answered after its 1 s cap, with a warning); the test lets go; the ending
 * answers `released: true`; the hold's end says `byte`; a new session
 * attaches on the same port.
 *
 * What can still make it fail without a defect in the server:
 * - A silence that is not the hold: the target process (or only its ticker
 *   thread) not scheduled for 300 ms while the main thread is still before
 *   the C call. The ending then goes out before the hold, is answered at
 *   once, and the "still unanswered 2 s later" assertion fails. (A stalled
 *   test process does not count: after a silence the test lets Node read what
 *   arrived meanwhile and looks again.)
 * - The target's own 8 s receive timeout, which ends the hold if this test is
 *   delayed past it (300 ms of silence, the 2 s wait, the calls): the hold's
 *   end then says `timeout`, not `byte`, and the test fails by that name; and
 *   when it expires the target need not be rescheduled at once.
 * - A wait that runs out on a loaded machine: 10 s for the hold to start, its
 *   first tick, the silence and the detach's log line; 15 s for the hold's end.
 * - The target's debug port: chosen free, then bound by debugpy after the
 *   choice is closed; taken in between, the start is retried up to 4 times.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import fs from 'node:fs';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';
import { ensurePythonOnPath } from './env-utils.js';

const currentDirName = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(currentDirName, '../../../fixtures/python');
const busyTarget = path.join(fixturesDir, 'busy_target.py');
const serverLogPath = path.resolve(currentDirName, '../../busy_target_close_test_server.log');
const PYTHON = process.env.PYTHON_PATH ?? process.env.PYTHON_EXECUTABLE ?? (process.platform === 'win32' ? 'python' : 'python3');
/**
 * How long an ending must still be waiting while the target is held: twice the
 * 1 s the close used to give the adapter, and well inside the target's own
 * 8 s safety and the 10 s release bound.
 */
const STILL_WAITING_MS = 2000;
/**
 * How long no tick from the target's ticker thread means its main thread holds
 * the GIL in the C call: fifteen of its 20 ms ticks.
 */
const HOLD_SILENCE_MS = 300;
const DETACH_RELEASED = 'Detached from process: the debug adapter confirmed the detach, and the process was left running';

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => (port ? resolve(port) : reject(new Error('no free port'))));
    });
    server.on('error', reject);
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(condition: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(20);
  }
}

let client: Client | null = null;

async function startTestServer(): Promise<void> {
  const serverScriptPath = path.resolve(currentDirName, '../../../../dist/index.js');
  client = new Client({ name: 'mcp-test-client', version: '0.1.0' }, { capabilities: {} });
  const env: Record<string, string> = {};
  for (const key in process.env) {
    if (process.env[key] !== undefined) env[key] = process.env[key] as string;
  }
  ensurePythonOnPath(env);
  try {
    if (fs.existsSync(serverLogPath)) fs.unlinkSync(serverLogPath);
  } catch { /* best effort */ }
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverScriptPath, '--log-level', 'debug', '--log-file', serverLogPath],
    env
  });
  await client.connect(transport);
}

const serverLog = (): string => {
  try {
    return fs.readFileSync(serverLogPath, 'utf8');
  } catch {
    return '';
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(name: string, args: Record<string, unknown>): Promise<any> {
  if (!client) throw new Error('MCP client not initialized');
  const raw = await client.callTool({ name, arguments: args });
  const content = (raw as { content?: Array<{ type: string; text: string }> }).content;
  if (!content?.[0] || content[0].type !== 'text') {
    throw new Error(`Invalid tool result: ${JSON.stringify(raw)}`);
  }
  return JSON.parse(content[0].text);
}

/** A call in flight, and whether it has answered yet. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function track(answer: Promise<any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tracked: { answer: Promise<any>; answered: boolean; value?: unknown } = { answer, answered: false };
  void answer.then((value) => { tracked.answered = true; tracked.value = value; }, () => { tracked.answered = true; });
  return tracked;
}

interface Target { proc: ChildProcess; port: number; output: () => string }

let targets: Target[] = [];
const gates: Array<{ server: net.Server; socket?: net.Socket }> = [];

const PORT_IN_USE_PATTERN = /Address already in use|EADDRINUSE|10048/i;

/**
 * Start busy_target.py under debugpy and wait for its READY line. No TCP
 * probe: a session-less connect makes this adapter exit too
 * (docs/python/spike-notes-subprocess.md).
 */
async function startTargetOnce(): Promise<Target> {
  const port = await getFreePort();
  const proc = spawn(PYTHON, ['-m', 'debugpy', '--listen', `127.0.0.1:${port}`, busyTarget], {
    cwd: fixturesDir,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let buffer = '';
  const target: Target = { proc, port, output: () => buffer };
  targets.push(target);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`debugpy target not ready: ${buffer}`)), 20000);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      if (buffer.includes('BUSY_TARGET_READY')) { clearTimeout(timer); resolve(); }
    };
    proc.stdout!.on('data', onData);
    proc.stderr!.on('data', onData);
    proc.on('error', (error) => { clearTimeout(timer); reject(error); });
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error(`debugpy target exited ${code} before ready: ${buffer}`)); });
  });
  return target;
}

/** Retries if a parallel test takes the port between getFreePort() and debugpy's bind (#1243). */
async function startTarget(): Promise<Target> {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await startTargetOnce();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt < maxAttempts && PORT_IN_USE_PATTERN.test(message)) {
        const failed = targets.pop();
        if (failed && failed.proc.exitCode === null) failed.proc.kill();
        continue;
      }
      throw error;
    }
  }
  throw new Error('unreachable');
}

/** Attach a new session to the target and leave it running. */
async function attachRunning(name: string, port: number): Promise<string> {
  const created = await call('create_debug_session', { language: 'python', name });
  expect(created.success).toBe(true);
  const sessionId = created.sessionId as string;
  const attached = await call('attach_to_process', { sessionId, host: '127.0.0.1', port });
  expect(attached.success, JSON.stringify(attached)).toBe(true);
  if (attached.state === 'paused') {
    const resumed = await call('continue_execution', { sessionId });
    expect(resumed.success, JSON.stringify(resumed)).toBe(true);
  }
  return sessionId;
}

/** The target's ticks on the hold's connection: how many, and when the last one was read. */
interface Ticks { count: number; lastAt: number }

/**
 * Until no tick has arrived for `HOLD_SILENCE_MS`: the target's main thread
 * holds the GIL. A silence measured across a stall of this process would be
 * ticks not yet read, so once the silence is long enough, Node's poll phase
 * runs (a setImmediate comes after it) and the silence is measured again.
 */
async function untilSilent(ticks: Ticks, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (Date.now() - ticks.lastAt >= HOLD_SILENCE_MS) {
      await new Promise((resolve) => setImmediate(resolve));
      if (Date.now() - ticks.lastAt >= HOLD_SILENCE_MS) return;
    }
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for the target to hold the interpreter: ${ticks.count} ticks, the last ${Date.now() - ticks.lastAt} ms ago`);
    }
    await sleep(20);
  }
}

/**
 * Make the target hold the interpreter until `letGo()`: it connects to a
 * listener here and blocks in recv on that connection. Resolves once the
 * target has said the hold starts, its ticker has been heard, and the ticker
 * has then been silent for `HOLD_SILENCE_MS`: the main thread is in the call.
 */
async function hold(target: Target): Promise<{ letGo: () => void; ended: () => Promise<{ seconds: number; why: string }> }> {
  const gate: { server: net.Server; socket?: net.Socket } = { server: net.createServer() };
  gates.push(gate);
  const ticks: Ticks = { count: 0, lastAt: 0 };
  const connected = new Promise<net.Socket>((resolve) => gate.server.once('connection', (socket: net.Socket) => {
    socket.on('data', (chunk: Buffer) => {
      ticks.count += chunk.length;
      ticks.lastAt = Date.now();
    });
    socket.on('error', () => { /* the target closes its end when the hold is over */ });
    resolve(socket);
  }));
  await new Promise<void>((resolve, reject) => {
    gate.server.once('error', reject);
    gate.server.listen(0, '127.0.0.1', () => resolve());
  });
  const gatePort = (gate.server.address() as net.AddressInfo).port;
  target.proc.stdin!.write(`block ${gatePort}\n`);
  gate.socket = await connected;
  await until(() => target.output().includes('HOLD_START'), 10000, 'the hold to start');
  await until(() => ticks.count > 0, 10000, "the target's first tick");
  await untilSilent(ticks, 10000);
  const holdEnd = /HOLD_END (\d+\.\d+) ([^\r\n]+)/;
  return {
    letGo: () => { gate.socket!.write(Buffer.from([1])); },
    ended: async () => {
      await until(() => holdEnd.test(target.output()), 15000, 'the hold to end');
      const [, seconds, why] = holdEnd.exec(target.output())!;
      return { seconds: Number(seconds), why };
    }
  };
}

/** The port the ending must not have closed: the target runs, and a new session attaches and releases it. */
async function portServesANewAttach(target: Target): Promise<void> {
  expect(target.proc.exitCode, target.output()).toBeNull();
  const again = await attachRunning('busy-target-again', target.port);
  const closedAgain = await call('close_debug_session', { sessionId: again });
  expect(closedAgain, JSON.stringify(closedAgain)).toMatchObject({ success: true, released: true });
  expect(target.proc.exitCode, target.output()).toBeNull();
}

describe('ending a session on a busy attached Python target (issue #1325) @requires-python', () => {
  beforeAll(async () => {
    await startTestServer();
  }, 30000);

  afterAll(async () => {
    if (client) {
      try { await client.close(); } catch { /* best effort */ }
    }
    client = null;
  });

  afterEach(() => {
    for (const gate of gates.splice(0)) {
      gate.socket?.destroy();
      gate.server.close();
    }
    for (const target of targets) {
      if (target.proc.exitCode === null) target.proc.kill();
    }
    targets = [];
  });

  it("keeps the target's debug port when the session is closed while the target holds the interpreter", async () => {
    const busy = await startTarget();
    const sessionId = await attachRunning('busy-target', busy.port);
    const held = await hold(busy);

    const closing = track(call('close_debug_session', { sessionId }));
    await sleep(STILL_WAITING_MS);
    // The close waits for the adapter's answer. The old one answered here,
    // after its 1 s cap, with a warning, and the port was gone.
    expect(closing.answered, `the close answered while the target still held the interpreter: ${JSON.stringify(closing.value)}`).toBe(false);

    held.letGo();
    const closed = await closing.answer;
    expect(closed, JSON.stringify(closed)).toMatchObject({ success: true, released: true });
    expect(closed.warning).toBeUndefined();
    expect((await held.ended()).why, busy.output()).toBe('byte');

    await portServesANewAttach(busy);
  }, 60000);

  it('releases the target once when a close arrives while a detach waits: both answers say what was observed', async () => {
    const busy = await startTarget();
    const sessionId = await attachRunning('busy-target-overlap', busy.port);
    const held = await hold(busy);

    const detaching = track(call('detach_from_process', { sessionId }));
    // The close goes out once the detach is in flight, which the server logs
    // as the detach starts: the order is observed, not slept for.
    await until(() => serverLog().includes(`Detaching from process for session ${sessionId}`), 10000, 'the detach to be in flight');
    const closing = track(call('close_debug_session', { sessionId }));
    await sleep(STILL_WAITING_MS);
    expect(detaching.answered, `the detach answered while the target still held the interpreter: ${JSON.stringify(detaching.value)}`).toBe(false);
    expect(closing.answered, `the close answered while the detach still waited: ${JSON.stringify(closing.value)}`).toBe(false);

    held.letGo();
    const [detached, closed] = await Promise.all([detaching.answer, closing.answer]);
    // The detach sent the one release; the close joined it and sent nothing.
    expect(detached, JSON.stringify(detached)).toMatchObject({ success: true, state: 'stopped', released: true, message: DETACH_RELEASED });
    expect(detached.warning).toBeUndefined();
    expect(closed, JSON.stringify(closed)).toMatchObject({ success: true, message: `Closed debug session: ${sessionId}`, released: true });
    expect(closed.warning).toBeUndefined();
    expect((await held.ended()).why, busy.output()).toBe('byte');

    await portServesANewAttach(busy);
  }, 60000);
});
