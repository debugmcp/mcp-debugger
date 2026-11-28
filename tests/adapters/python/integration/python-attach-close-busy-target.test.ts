/**
 * Ending a session while the attached Python target is busy (issue #1325).
 *
 * A target started with `python -m debugpy --listen` has one debug adapter,
 * started once, which owns the listening port. That adapter answers a
 * `disconnect` only after pydevd inside the debuggee has processed it, which
 * waits for the interpreter: about 40 ms on an idle target, the length of the
 * hold on a busy one. When its client closes the connection before the reply
 * is written, the adapter ends itself (`debugpy/common/messaging.py`,
 * `_run_handlers`: `self.close(); os._exit(1)`), and the target's debug port is
 * closed for the rest of its life.
 *
 * `close_debug_session` used to send that disconnect from the worker's
 * shutdown with a 1 s cap and then close the connection: a close during a
 * hold of more than a second closed the port for good (measured with 0.27.0).
 * Here the target holds the interpreter for a few seconds with one C call (a
 * sleep made with the GIL held, `busy_target.py`: wall-clock time, so a slow
 * or loaded machine does not stretch it towards the 10 s bound), the session
 * is closed during the hold, and the port must still serve a new session
 * afterwards.
 *
 * `HOLD_TEST_DEBUGPY_PORT` pins the target's debug port (for hosts that allow
 * only some ports); otherwise a free one is picked.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';
import { ensurePythonOnPath } from './env-utils.js';

const currentDirName = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(currentDirName, '../../../fixtures/python');
const busyTarget = path.join(fixturesDir, 'busy_target.py');
const PYTHON = process.env.PYTHON_PATH ?? process.env.PYTHON_EXECUTABLE ?? (process.platform === 'win32' ? 'python' : 'python3');
/** What the target is asked to hold for; it reports what it held. */
const HOLD_SECONDS = 3.5;
/** The old cap the close waited for the adapter's answer (issue #1325). */
const OLD_CLOSE_CAP_MS = 1000;

async function getFreePort(): Promise<number> {
  const pinned = Number(process.env.HOLD_TEST_DEBUGPY_PORT);
  if (Number.isInteger(pinned) && pinned > 0) {
    return pinned;
  }
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

let client: Client | null = null;

async function startTestServer(): Promise<void> {
  const serverScriptPath = path.resolve(currentDirName, '../../../../dist/index.js');
  client = new Client({ name: 'mcp-test-client', version: '0.1.0' }, { capabilities: {} });
  const env: Record<string, string> = {};
  for (const key in process.env) {
    if (process.env[key] !== undefined) env[key] = process.env[key] as string;
  }
  ensurePythonOnPath(env);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverScriptPath, '--log-level', 'debug', '--log-file', path.resolve(currentDirName, '../../busy_target_close_test_server.log')],
    env
  });
  await client.connect(transport);
}

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

interface Target { proc: ChildProcess; port: number; output: () => string }

let target: Target | null = null;

/**
 * Start busy_target.py under debugpy and wait for its READY line. No TCP
 * probe: a session-less connect makes this adapter exit too
 * (docs/python/spike-notes-subprocess.md).
 */
async function startTarget(): Promise<Target> {
  const port = await getFreePort();
  const proc = spawn(PYTHON, ['-m', 'debugpy', '--listen', `127.0.0.1:${port}`, busyTarget], {
    cwd: fixturesDir,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let buffer = '';
  const started: Target = { proc, port, output: () => buffer };
  target = started;
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
  return started;
}

async function until(condition: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
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

describe('close_debug_session on a busy attached Python target (issue #1325) @requires-python', () => {
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
    if (target && target.proc.exitCode === null) target.proc.kill();
    target = null;
  });

  it("keeps the target's debug port when the session is closed while the target holds the interpreter", async () => {
    const busy = await startTarget();
    const sessionId = await attachRunning('busy-target', busy.port);

    // The hold starts; the close goes out while it lasts.
    busy.proc.stdin!.write(`hold ${HOLD_SECONDS}\n`);
    await until(() => busy.output().includes('HOLD_START'), 10000, 'the hold to start');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(busy.output(), 'the close must go out during the hold').not.toContain('HOLD_END');

    const closeStartedAt = Date.now();
    const closed = await call('close_debug_session', { sessionId });
    const closeMs = Date.now() - closeStartedAt;

    await until(() => /HOLD_END (\d+\.\d+)/.test(busy.output()), 30000, 'the hold to end');
    const heldMs = Number(/HOLD_END (\d+\.\d+)/.exec(busy.output())![1]) * 1000;
    // The hold has to outlast the old cap by a margin, or this proves nothing.
    expect(heldMs, busy.output()).toBeGreaterThan(OLD_CLOSE_CAP_MS + 500);

    // The close waited for the adapter's answer instead of leaving after 1 s.
    expect(closed, JSON.stringify(closed)).toMatchObject({ success: true, released: true });
    expect(closed.warning).toBeUndefined();
    expect(closeMs).toBeGreaterThan(OLD_CLOSE_CAP_MS);

    // The port survived: the target runs, and a new session attaches and releases it.
    expect(busy.proc.exitCode).toBeNull();
    const again = await attachRunning('busy-target-again', busy.port);
    const closedAgain = await call('close_debug_session', { sessionId: again });
    expect(closedAgain, JSON.stringify(closedAgain)).toMatchObject({ success: true, released: true });
    expect(busy.proc.exitCode).toBeNull();
  }, 60000);
});
