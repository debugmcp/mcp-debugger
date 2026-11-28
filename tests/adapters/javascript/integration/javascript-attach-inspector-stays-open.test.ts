/**
 * What an attach by processId leaves in a Node.js target, said, never undone
 * (issue #1261). This server closes no inspector, and the answers say what
 * the attach observed in one field, `inspector`. With a real Node target and
 * the built server, this pins:
 *
 *   1. an attach that saw the port refuse, signalled, and saw an inspector
 *      answer says that, in that order; the detach and the close say what one
 *      probe of that address sees; it still listens, and the process serves;
 *   2. one that was already open is said to be left as it was;
 *   3. an attach by port says nothing about it;
 *   4. two sessions on one target: neither one's end closes anything.
 *
 * Ports: each target is started with `--inspect-port=<n>` (where a signal
 * opens it) or `--inspect=<n>` on a free port. By default the kernel picks
 * it; MCP_TEST_INSPECT_PORT_RANGE=<from>-<to> picks from a range instead.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const serverScript = path.join(root, 'examples/javascript/idle_server_attach_target.js');

interface Answer extends ToolAnswer { inspector?: string }
interface Target { proc: ChildProcess; pid: number; httpPort: number; inspectPort: number }

let server: StdioClientHandle;
let targets: Target[] = [];
const usedPorts = new Set<number>();

/** Does anything accept a connection on 127.0.0.1:port? */
function listening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

/** A port nothing on this host listens on, never handed out twice in this file. */
async function freePort(): Promise<number> {
  const range = /^(\d+)-(\d+)$/.exec(process.env.MCP_TEST_INSPECT_PORT_RANGE ?? '');
  if (range) {
    for (let port = Number(range[1]); port <= Number(range[2]); port++) {
      if (!usedPorts.has(port) && !(await listening(port))) {
        usedPorts.add(port);
        return port;
      }
    }
    throw new Error(`no free port in MCP_TEST_INSPECT_PORT_RANGE=${process.env.MCP_TEST_INSPECT_PORT_RANGE}`);
  }
  for (;;) {
    const port = await new Promise<number>((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', reject);
      probe.listen(0, '127.0.0.1', () => {
        const address = probe.address();
        probe.close(() => (address && typeof address === 'object' ? resolve(address.port) : reject(new Error('no port'))));
      });
    });
    if (!usedPorts.has(port)) {
      usedPorts.add(port);
      return port;
    }
  }
}

/** The idle HTTP fixture, with its inspector closed (`--inspect-port`) or already open (`--inspect`). */
async function startTarget(inspector: 'closed' | 'open'): Promise<Target> {
  const inspectPort = await freePort();
  const flag = inspector === 'open' ? `--inspect=127.0.0.1:${inspectPort}` : `--inspect-port=127.0.0.1:${inspectPort}`;
  const proc = spawn(process.execPath, [flag, serverScript], { cwd: path.dirname(serverScript), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  const target: Target = { proc, pid: proc.pid!, httpPort: 0, inspectPort };
  targets.push(target);
  target.httpPort = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`the target did not listen: ${stdout} ${stderr}`)), 30000);
    const check = () => {
      const served = /listening (\d+)/.exec(stdout);
      const ready = inspector === 'closed' || /Debugger listening on/.test(stderr);
      if (served && ready) { clearTimeout(timer); resolve(Number(served[1])); }
    };
    proc.stdout!.on('data', (chunk: Buffer) => { stdout += chunk.toString(); check(); });
    proc.stderr!.on('data', (chunk: Buffer) => { stderr += chunk.toString(); check(); });
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error(`the target exited ${code}: ${stderr}`)); });
  });
  return target;
}

function get(port: number, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve) => {
    const request = http.get({ host: '127.0.0.1', port, path: '/work', agent: false }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve(body.trim()));
    });
    request.setTimeout(timeoutMs, () => { request.destroy(); resolve(`no answer within ${timeoutMs} ms`); });
    request.on('error', (error) => resolve(`failed: ${error.message}`));
  });
}

/** The inspector still listens, and the process runs on and serves. */
async function expectOpenAndServing(target: Target): Promise<void> {
  expect(await listening(target.inspectPort), `127.0.0.1:${target.inspectPort} no longer listens`).toBe(true);
  expect(await get(target.httpPort)).toMatch(/^work done:/);
}

const call = (name: string, args: Record<string, unknown> = {}): Promise<Answer> => server.call<Answer>(name, args);
const attachByPid = (target: Target): Promise<Answer> =>
  call('attach_to_process', { processId: target.pid, port: target.inspectPort, stopOnEntry: false, verifyTimeout: 20000 });

const signalled = (target: Target) =>
  `signalled: 127.0.0.1:${target.inspectPort} refused this attach's first probe, this attach then signalled PID ${target.pid}, ` +
  'and an inspector answered there after the signal, unauthenticated; this server does not close it';
const listeningNow = (target: Target) =>
  `listening: an inspector answers on 127.0.0.1:${target.inspectPort}, unauthenticated ` +
  `(one answered there after this attach signalled PID ${target.pid}); this server does not close it`;
const found = (target: Target) =>
  `an inspector answered this attach's first probe on 127.0.0.1:${target.inspectPort}, so no signal was sent`;

beforeEach(async () => {
  server = await startStdioClient({ name: 'js-attach-inspector-stays-open', callTimeoutMs: 60_000 });
});

afterEach(async () => {
  await server?.close();
  for (const target of targets) {
    if (target.proc.exitCode === null && target.proc.signalCode === null) target.proc.kill();
  }
  targets = [];
});

describe('the inspector an attach by processId leaves in the target (issue #1261)', () => {
  it('an attach that signalled says what it saw; detach and close say it still listens; nothing closes it', async () => {
    const target = await startTarget('closed');
    await server.createSession('javascript', 'inspector-opened');
    expect(await listening(target.inspectPort)).toBe(false);

    const attached = await attachByPid(target);
    expect(attached.success, JSON.stringify(attached)).toBe(true);
    expect(attached.inspector).toBe(signalled(target));

    const detached = await call('detach_from_process');
    expect(detached.inspector).toBe(listeningNow(target));
    await expectOpenAndServing(target);

    const closed = await call('close_debug_session');
    expect(closed.inspector).toBe(listeningNow(target));
    server.sessionId = undefined;
    await expectOpenAndServing(target);
  }, 120000);

  it('one that was already open is left as it was, and the answers say so', async () => {
    const target = await startTarget('open');
    await server.createSession('javascript', 'inspector-found');

    const attached = await attachByPid(target);
    expect(attached.success, JSON.stringify(attached)).toBe(true);
    expect(attached.inspector).toBe(`already open: ${found(target)}; this server does not close it`);

    const detached = await call('detach_from_process');
    expect(detached.inspector).toBe(`left as it was: ${found(target)}; this server does not close it`);
    await expectOpenAndServing(target);
  }, 120000);

  it('an attach by port says nothing about it', async () => {
    const target = await startTarget('open');
    await server.createSession('javascript', 'inspector-by-port');

    const attached = await call('attach_to_process', { host: '127.0.0.1', port: target.inspectPort, stopOnEntry: false, verifyTimeout: 20000 });
    expect(attached.success, JSON.stringify(attached)).toBe(true);
    expect(attached).not.toHaveProperty('inspector');
    expect(await call('detach_from_process')).not.toHaveProperty('inspector');
    await expectOpenAndServing(target);
  }, 120000);

  it('two sessions on one target: neither one\'s end closes anything under the other', async () => {
    const target = await startTarget('closed');
    const first = await server.createSession('javascript', 'inspector-first');
    expect((await attachByPid(target)).inspector).toBe(signalled(target));

    const second = await server.createSession('javascript', 'inspector-second');
    expect((await attachByPid(target)).inspector).toBe(`already open: ${found(target)}; this server does not close it`);

    expect((await call('detach_from_process', { sessionId: first })).inspector).toBe(listeningNow(target));
    await expectOpenAndServing(target);
    // The second session still debugs.
    const paused = await call('pause_execution', { sessionId: second });
    expect(paused.success, JSON.stringify(paused)).toBe(true);
    await call('continue_execution', { sessionId: second });
    await call('detach_from_process', { sessionId: second });
    await expectOpenAndServing(target);
    await call('close_debug_session', { sessionId: first });
  }, 120000);
});
