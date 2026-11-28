/**
 * An attach borrows; a detach returns what was borrowed, whole (issue #1261).
 *
 * `attach_to_process { processId }` on a plain `node server.js` makes Node
 * open its inspector (`SIGUSR1` on POSIX, `process._debugProcess` on Windows),
 * and Node never closes it by itself: it used to stay listening,
 * unauthenticated, after `detach_from_process` and `close_debug_session`, and
 * while it held the port an attach by processId to any other Node process was
 * refused. With a real Node target and the built server, this pins:
 *
 *   1. detach, close, and the server's own exit close an inspector the
 *      session opened: the port refuses, the process lives and still serves;
 *   2. an inspector that was already open is left open, on every path;
 *   3. a failed attach that had already opened the inspector closes it again;
 *   4. two sessions on one inspector this server opened: the first to leave
 *      leaves it open and names the other, which keeps working; the last
 *      closes it;
 *   and a closed inspector opens again on the next attach by processId, five
 *   times over on one target; a session whose target exits under it gives
 *   back by itself; and a target started with `--inspect-port`, attached by
 *   processId without that port, fails truthfully and closes nothing (#1310).
 *
 * Every answer says which happened in one field, `inspector`, the same on
 * attach, detach and close.
 *
 * Ports: a target started with `--inspect-port=<n>` opens there when
 * signalled, so each case picks a free port for `<n>`. By default the kernel
 * picks it; set MCP_TEST_INSPECT_PORT_RANGE=<from>-<to> to pick from a range
 * instead (a host whose other suites must not be collided with).
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
const serverScript = path.join(root, 'examples/javascript/idle_server_attach_target.js');
const BREAKPOINT_LINE = fs.readFileSync(serverScript, 'utf8').split('\n').findIndex((line) => line.includes('const total = doWork();')) + 1;

interface Answer extends ToolAnswer {
  inspector?: string;
  released?: boolean;
  sessionId?: string;
  result?: string;
  location?: { line: number };
}

interface Target { proc: ChildProcess; pid: number; httpPort: number; inspectPort: number; stderr: () => string }

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

/**
 * The idle HTTP fixture. `inspector: 'closed'` starts it with no inspector
 * (`--inspect-port`: where a signal opens it); 'open' starts it with the
 * inspector already listening (`--inspect`).
 */
async function startTarget(inspector: 'closed' | 'open'): Promise<Target> {
  const inspectPort = await freePort();
  const flag = inspector === 'open' ? `--inspect=127.0.0.1:${inspectPort}` : `--inspect-port=127.0.0.1:${inspectPort}`;
  const proc = spawn(process.execPath, [flag, serverScript], { cwd: path.dirname(serverScript), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  const target: Target = { proc, pid: proc.pid!, httpPort: 0, inspectPort, stderr: () => stderr };
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

/** GET on the target's HTTP port; never rejects, so a request parked on a stop can be awaited later. */
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

const alive = (pid: number): boolean => {
  try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; }
};

/** The inspector is gone and the process runs on and serves, as a session's end must leave it. */
async function expectClosedAndServing(target: Target): Promise<void> {
  expect(await listening(target.inspectPort), `127.0.0.1:${target.inspectPort} still listens`).toBe(false);
  expect(alive(target.pid), 'the process must run on').toBe(true);
  expect(await get(target.httpPort)).toMatch(/^work done:/);
}

const call = (name: string, args: Record<string, unknown> = {}): Promise<Answer> => server.call<Answer>(name, args);
const attachByPid = (target: Target, extra: Record<string, unknown> = {}): Promise<Answer> =>
  call('attach_to_process', { processId: target.pid, port: target.inspectPort, stopOnEntry: false, verifyTimeout: 20000, ...extra });

beforeEach(async () => {
  server = await startStdioClient({ name: 'js-attach-inspector-loan', callTimeoutMs: 60_000 });
});

afterEach(async () => {
  await server?.close();
  for (const target of targets) {
    if (target.proc.exitCode === null && target.proc.signalCode === null) target.proc.kill();
  }
  targets = [];
});

describe('an inspector this session opened is closed when it ends (issue #1261)', () => {
  it.each([
    ['a pausing attach, then detach_from_process', { stopOnEntry: true }, 'detach'],
    ['a running attach, then detach_from_process', {}, 'detach'],
    ['a running attach, then close_debug_session with no detach', {}, 'close']
  ] as const)('%s', async (_name, extra, end) => {
    const target = await startTarget('closed');
    await server.createSession('javascript', 'inspector-loan-g1');

    const attached = await attachByPid(target, extra);
    expect(attached.success, JSON.stringify(attached)).toBe(true);
    expect(attached.inspector).toBe(`opened by this attach on 127.0.0.1:${target.inspectPort}; closed when this session detaches or closes`);
    expect(await listening(target.inspectPort)).toBe(true);

    const ended = end === 'detach' ? await call('detach_from_process') : await call('close_debug_session');
    expect(ended.success, JSON.stringify(ended)).toBe(true);
    expect(ended.inspector).toBe(
      `closed: 127.0.0.1:${target.inspectPort} no longer accepts connections, and PID ${target.pid} runs on; an attach by processId opens it again`
    );
    await expectClosedAndServing(target);

    if (end === 'detach') {
      // The close after it has nothing left to give back, and claims nothing.
      const closed = await call('close_debug_session');
      expect(closed.inspector, JSON.stringify(closed)).toBeUndefined();
    }
    server.sessionId = undefined;
  }, 120000);

  it('closes it when the server exits with the session still attached', async () => {
    const target = await startTarget('closed');
    await server.createSession('javascript', 'inspector-loan-exit');
    expect((await attachByPid(target)).success).toBe(true);

    server.sessionId = undefined;
    await server.client.close();
    const deadline = Date.now() + 10000;
    while (await listening(target.inspectPort) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await expectClosedAndServing(target);
  }, 120000);

  it('opens again on the next attach by processId: five attach-and-detach cycles on one target', async () => {
    const target = await startTarget('closed');
    for (let cycle = 1; cycle <= 5; cycle++) {
      await server.createSession('javascript', `inspector-loan-cycle-${cycle}`);
      const attached = await attachByPid(target);
      expect(attached.success, `cycle ${cycle}: ${JSON.stringify(attached)}`).toBe(true);
      expect(attached.inspector, `cycle ${cycle}`).toMatch(/^opened by this attach/);
      const detached = await call('detach_from_process');
      expect(detached.inspector, `cycle ${cycle}`).toMatch(/^closed: /);
      expect(await listening(target.inspectPort), `cycle ${cycle}`).toBe(false);
      await call('close_debug_session');
      server.sessionId = undefined;
    }
    expect((target.stderr().match(/Debugger listening on/g) ?? []).length, 'one opening per attach').toBe(5);
    await expectClosedAndServing(target);
  }, 180000);
});

describe('an inspector that was already open is left open (issue #1261)', () => {
  it('on detach and close after an attach by processId, and after an attach by port', async () => {
    const target = await startTarget('open');

    await server.createSession('javascript', 'inspector-loan-found-detach');
    let answer = await attachByPid(target);
    expect(answer.inspector).toBe(`already open on 127.0.0.1:${target.inspectPort} before this attach; left open when this session ends`);
    answer = await call('detach_from_process');
    expect(answer.inspector).toBe(`left open: it was already open on 127.0.0.1:${target.inspectPort} before this attach`);
    expect(await listening(target.inspectPort)).toBe(true);
    await call('close_debug_session');

    await server.createSession('javascript', 'inspector-loan-found-close');
    await attachByPid(target);
    answer = await call('close_debug_session');
    expect(answer.inspector).toBe(`left open: it was already open on 127.0.0.1:${target.inspectPort} before this attach`);
    expect(await listening(target.inspectPort)).toBe(true);

    await server.createSession('javascript', 'inspector-loan-port');
    answer = await call('attach_to_process', { host: '127.0.0.1', port: target.inspectPort, stopOnEntry: false, verifyTimeout: 20000 });
    expect(answer.inspector).toMatch(/^not opened by this server/);
    answer = await call('detach_from_process');
    expect(answer.inspector).toMatch(/^left as it was: this server did not open it/);
    expect(await listening(target.inspectPort)).toBe(true);
    await call('close_debug_session');
    server.sessionId = undefined;

    expect(alive(target.pid)).toBe(true);
    expect(await get(target.httpPort)).toMatch(/^work done:/);
  }, 120000);
});

describe('a target started with --inspect-port, attached by processId alone (issue #1261, #1310)', () => {
  it('fails truthfully and closes nothing; a retry with that port finds the inspector open and leaves it open', async (ctx) => {
    // The attach looks at Node's default port: it must be free for this case.
    if (await listening(9229)) {
      console.log('[inspector-loan] 127.0.0.1:9229 is in use on this host; skipping the processId-alone case');
      ctx.skip();
    }
    const target = await startTarget('closed');
    await server.createSession('javascript', 'inspector-loan-inspect-port');

    // One attach, one endpoint: 9229. The signal opens the inspector on the target's own port.
    const failed = await call('attach_to_process', { processId: target.pid, stopOnEntry: false, verifyTimeout: 20000 });
    expect(failed.success, JSON.stringify(failed)).toBe(false);
    expect(failed.message).toContain(`PID ${target.pid} was signalled to open its inspector, but none appeared on 127.0.0.1:9229 within 5000 ms`);
    expect(failed.message).toContain('this server closed nothing, because it could not identify one; restarting the target closes it');
    expect(failed.inspector).toMatch(/^not confirmed closed: this attach signalled PID \d+ to open its inspector/);
    // Nothing was closed: the inspector the signal opened is still there.
    expect(await listening(target.inspectPort)).toBe(true);
    await call('close_debug_session');

    await server.createSession('javascript', 'inspector-loan-inspect-port-retry');
    const retried = await attachByPid(target);
    expect(retried.success, JSON.stringify(retried)).toBe(true);
    expect(retried.inspector).toBe(`already open on 127.0.0.1:${target.inspectPort} before this attach; left open when this session ends`);
    const detached = await call('detach_from_process');
    expect(detached.inspector).toBe(`left open: it was already open on 127.0.0.1:${target.inspectPort} before this attach`);
    expect(await listening(target.inspectPort)).toBe(true);
    expect(alive(target.pid)).toBe(true);
    expect(await get(target.httpPort)).toMatch(/^work done:/);
    await call('close_debug_session');
    server.sessionId = undefined;
  }, 120000);
});

describe('a session whose connection ends by itself (issue #1261)', () => {
  it('gives back when the target exits under it, and its close says what became of the inspector', async () => {
    const target = await startTarget('closed');
    await server.createSession('javascript', 'inspector-loan-target-exits');
    expect((await attachByPid(target)).success).toBe(true);

    target.proc.kill();
    await new Promise<void>((resolve) => target.proc.once('exit', () => resolve()));
    // The session notices the end, and its worker teardown gives the loan back.
    const deadline = Date.now() + 15000;
    let state: string | undefined;
    while (Date.now() < deadline) {
      const listing = await call('list_debug_sessions');
      state = (listing as unknown as { sessions: Array<{ id: string; state: string }> }).sessions.find((row) => row.id === server.sessionId)?.state;
      if (state === 'stopped' || state === 'error') break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(state).toMatch(/^(stopped|error)$/);

    const closed = await call('close_debug_session');
    expect(closed.inspector).toBe(`gone: PID ${target.pid} is no longer running, and its inspector went with it`);
    server.sessionId = undefined;
  }, 120000);
});

describe('a failed attach gives back what it opened (issue #1261)', () => {
  it('closes the inspector its activation opened, and its answer says so', async () => {
    const target = await startTarget('closed');
    const nothing = await freePort();
    await server.createSession('javascript', 'inspector-loan-failed');

    // The activation opens the inspector; js-debug is then sent to an
    // address where nothing listens, so the attach fails after the opening.
    const failed = await attachByPid(target, {
      verifyTimeout: 3000,
      adapterConfig: { websocketAddress: `ws://127.0.0.1:${nothing}/nothing-here` }
    });
    expect(failed.success, JSON.stringify(failed)).toBe(false);
    expect(target.stderr()).toMatch(/Debugger listening on/);
    expect(failed.inspector).toBe(
      `closed: 127.0.0.1:${target.inspectPort} no longer accepts connections, and PID ${target.pid} runs on; an attach by processId opens it again`
    );
    await expectClosedAndServing(target);
  }, 120000);
});

describe('two sessions on one inspector this server opened (issue #1261)', () => {
  it.each(['port', 'processId', 'processId alone', 'inspector URL'] as const)(
    'the second, attached by %s, is not cut off when the first leaves; the last to leave closes it',
    async (how) => {
      const target = await startTarget('closed');
      const first = await server.createSession('javascript', 'inspector-loan-first');
      expect((await attachByPid(target)).success).toBe(true);

      const second = await server.createSession('javascript', 'inspector-loan-second');
      await call('set_breakpoint', { file: serverScript, line: BREAKPOINT_LINE });
      const address = how === 'port'
        ? { host: '127.0.0.1', port: target.inspectPort }
        : how === 'processId'
          ? { processId: target.pid, port: target.inspectPort }
          // No port: the endpoint is the one this server's opening for the PID is on, looked at only.
          : how === 'processId alone'
            ? { processId: target.pid }
            : { adapterConfig: { websocketAddress: await webSocketUrl(target.inspectPort) } };
      const attached = await call('attach_to_process', { ...address, stopOnEntry: false, verifyTimeout: 20000 });
      expect(attached.success, JSON.stringify(attached)).toBe(true);
      expect(attached.inspector).toMatch(new RegExp(`^opened by this server on 127\\.0\\.0\\.1:${target.inspectPort}, and also used by session ${first}`));
      // One opening for both sessions: the second attach sent no signal of its own.
      expect((target.stderr().match(/Debugger listening on/g) ?? []).length).toBe(1);

      const left = await call('detach_from_process', { sessionId: first });
      expect(left.inspector).toBe(
        `left open: session ${second} uses it too and has not detached or closed yet; the last session of this server using it closes it`
      );
      expect(await listening(target.inspectPort)).toBe(true);

      // The second session still debugs: a request reaches its breakpoint.
      const parked = get(target.httpPort, 20000);
      const stop = await call('wait_for_stop', { timeout: 15000 });
      expect(stop.state, JSON.stringify(stop)).toBe('paused');
      expect(stop.location?.line).toBe(BREAKPOINT_LINE);
      const evaluated = await call('evaluate_expression', { expression: 'process.pid' });
      expect(Number(evaluated.result)).toBe(target.pid);
      await call('continue_execution');
      expect(await parked).toMatch(/^work done:/);

      const last = await call('detach_from_process');
      expect(last.inspector).toMatch(new RegExp(`^closed: 127\\.0\\.0\\.1:${target.inspectPort} no longer accepts connections`));
      await expectClosedAndServing(target);
      await call('close_debug_session', { sessionId: first });
    },
    120000
  );
});

/** The inspector URL /json/list reports for the target on `port`. */
async function webSocketUrl(port: number): Promise<string> {
  const body = await new Promise<string>((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: '/json/list', agent: false }, (response) => {
      let text = '';
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => resolve(text));
    }).on('error', reject);
  });
  return (JSON.parse(body) as Array<{ webSocketDebuggerUrl: string }>)[0].webSocketDebuggerUrl;
}
