/**
 * Unit tests for inspector-activation.ts (issue #871): the PID → inspector
 * step js-debug's DAP server does not have. Every external effect is
 * injectable (the signal, the /json/list probe, the process checks, the
 * clock), so the decision flow is tested without touching real processes;
 * one test exercises the real HTTP probe against a local server.
 */
import { describe, it, expect, vi } from 'vitest';
import * as http from 'node:http';
import { spawn } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import { AdapterError, AdapterErrorCode, type MonotonicClock } from '@debugmcp/shared';
import {
  activateInspector,
  inspectorSignalDisabledByPid,
  isNodeProcessByPid,
  pidViaInspector,
  probeInspector,
  SignalledActivationError,
  type InspectorActivationOptions,
  type InspectorProbe,
  type InspectorTarget
} from '../../src/utils/inspector-activation.js';

const inspector = (...titles: string[]): InspectorProbe => ({
  status: 'inspector',
  targets: titles.map((title, index) => ({ id: String(index), title, type: 'node' }))
});
const closed: InspectorProbe = { status: 'closed' };

/** The default ownership rule, minus the network: the title's `[pid]` suffix or nothing. */
const pidFromTitle = async (target: InspectorTarget): Promise<number | undefined> => {
  const match = /\[(\d+)\]\s*$/.exec(target.title ?? '');
  return match ? Number(match[1]) : undefined;
};

/**
 * A clock on which no real time passes: whenever nothing but its timers is
 * left to run (a macrotask after the microtasks drain), it jumps to the
 * earliest timer and fires it. The wait's sleeps and deadline run on it, so
 * a 500 ms wait costs no wall-clock time.
 */
function virtualClock(): MonotonicClock {
  let now = 0;
  let nextId = 1;
  let pumping = false;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const pump = (): void => {
    pumping = false;
    let earliest: [number, { at: number; callback: () => void }] | undefined;
    for (const entry of timers) {
      if (!earliest || entry[1].at < earliest[1].at) earliest = entry;
    }
    if (!earliest) return;
    timers.delete(earliest[0]);
    now = Math.max(now, earliest[1].at);
    earliest[1].callback();
    schedule();
  };
  const schedule = (): void => {
    if (!pumping && timers.size > 0) {
      pumping = true;
      setImmediate(pump);
    }
  };
  return {
    now: () => now,
    setTimeout: (callback, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, callback });
      schedule();
      return id;
    },
    clearTimeout: (handle) => { timers.delete(handle as number); }
  };
}

/** A virtual clock and a scripted sequence of probe answers (the last one repeats). */
function harness(overrides: Partial<InspectorActivationOptions> & { probes?: InspectorProbe[] } = {}) {
  const { probes = [closed, inspector('node[4242]')], ...rest } = overrides;
  const listTargets = vi.fn(async () => (probes.length > 1 ? probes.shift()! : probes[0]));
  const signal = vi.fn();
  const options: InspectorActivationOptions = {
    pid: 4242,
    platform: 'linux',
    container: false,
    processExists: () => true,
    isNodeProcess: async () => true,
    inspectorSignalDisabled: async () => false,
    selfPid: 1,
    signal,
    listTargets,
    pidOf: pidFromTitle,
    clock: virtualClock(),
    deadlineMs: 500,
    pollMs: 100,
    ...rest
  };
  return { options, signal, listTargets };
}

async function failure(promise: Promise<unknown>): Promise<AdapterError> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(AdapterError);
    expect((err as AdapterError).code).toBe(AdapterErrorCode.ENVIRONMENT_INVALID);
    return err as AdapterError;
  }
  throw new Error('expected activateInspector to reject');
}

describe('activateInspector (issue #871)', () => {
  it('signals a Node process whose inspector is closed and attaches to the port it opens', async () => {
    const { options, signal, listTargets } = harness();
    const result = await activateInspector(options);
    expect(signal).toHaveBeenCalledWith(4242);
    expect(listTargets).toHaveBeenCalledWith('127.0.0.1', 9229);
    expect(result).toEqual({ host: '127.0.0.1', port: 9229, alreadyActive: false, title: 'node[4242]' });
  });

  it('does not signal a process whose inspector is already open on the port (a --inspect target, or a re-attach)', async () => {
    const { options, signal } = harness({ probes: [inspector('C:\\Program Files\\nodejs\\node.exe[4242]')] });
    const result = await activateInspector(options);
    expect(signal).not.toHaveBeenCalled();
    expect(result.alreadyActive).toBe(true);
    expect(result.port).toBe(9229);
  });

  it('accepts a numeric-string pid and a caller port, probing that port', async () => {
    const { options, listTargets } = harness({ pid: '4242', port: 9230, probes: [closed, inspector('node[4242]')] });
    const result = await activateInspector(options);
    expect(listTargets).toHaveBeenCalledWith('127.0.0.1', 9230);
    expect(result.port).toBe(9230);
  });

  it('refuses when the port is held by a Node inspector of a different process, without signalling', async () => {
    const { options, signal } = harness({ probes: [inspector('node[9999]')] });
    const err = await failure(activateInspector(options));
    expect(err.message).toMatch(/127\.0\.0\.1:9229 is already held by a Node inspector for a different process \(PID 9999: node\[9999\]\)/);
    expect(err.message).toMatch(/pass port/);
    expect(signal).not.toHaveBeenCalled();
  });

  it('asks the inspector itself when the title carries no pid (a `node script.js` target)', async () => {
    const pidOf = vi.fn(async (target: InspectorTarget) => (target.title === 'C:_app_server.js' ? 4242 : undefined));
    const { options, signal } = harness({ probes: [inspector('C:_app_server.js')], pidOf });
    const result = await activateInspector(options);
    expect(pidOf).toHaveBeenCalledOnce();
    expect(signal).not.toHaveBeenCalled();
    expect(result).toEqual({ host: '127.0.0.1', port: 9229, alreadyActive: true, title: 'C:_app_server.js' });
  });

  it('refuses an already-open inspector whose owner cannot be told, naming the paused-by-another-debugger case and attach by port', async () => {
    const { options, signal } = harness({ probes: [inspector('C:_app_server.js')], pidOf: async () => undefined });
    const err = await failure(activateInspector(options));
    expect(err.message).toMatch(/already held by a Node inspector \(C:_app_server\.js\) that could not be confirmed to be PID 4242's/);
    expect(err.message).toMatch(/another debugger is attached and holds the target paused/);
    expect(err.message).toMatch(/attach by port instead of processId/);
    expect(signal).not.toHaveBeenCalled();
  });

  it('keeps polling through a transient probe failure after the signal, and names it only on the deadline', async () => {
    const reset: InspectorProbe = { status: 'other', detail: 'read ECONNRESET' };
    const ok = await activateInspector(harness({ probes: [closed, reset, reset, inspector('node[4242]')] }).options);
    expect(ok.alreadyActive).toBe(false);

    const err = await failure(activateInspector(harness({ probes: [closed, reset], deadlineMs: 250, pollMs: 100 }).options));
    expect(err.message).toMatch(/none appeared on 127\.0\.0\.1:9229 within 250 ms/);
    expect(err.message).toMatch(/\(last probe: read ECONNRESET\)/);
  });

  it('still refuses a non-inspector listener seen BEFORE the signal', async () => {
    const { options, signal } = harness({ probes: [{ status: 'other', detail: 'HTTP 404 from /json/list' }] });
    await failure(activateInspector(options));
    expect(signal).not.toHaveBeenCalled();
  });

  it('never signals a target started with --disable-sigusr1 (no handler: the signal would kill it)', async () => {
    const { options, signal } = harness({ inspectorSignalDisabled: async () => true });
    const err = await failure(activateInspector(options));
    expect(err.message).toMatch(/PID 4242 was started with --disable-sigusr1/);
    expect(signal).not.toHaveBeenCalled();
  });

  it('proceeds when the --disable-sigusr1 check cannot see the target (documented residual case)', async () => {
    const { options, signal } = harness({ inspectorSignalDisabled: async () => undefined });
    await activateInspector(options);
    expect(signal).toHaveBeenCalledWith(4242);
  });

  it.each(['localhost', '::1', '[::1]'])('probes and answers 127.0.0.1 for the loopback spelling %s', async (host) => {
    const { options, listTargets } = harness({ host });
    const result = await activateInspector(options);
    expect(listTargets).toHaveBeenCalledWith('127.0.0.1', 9229);
    expect(result.host).toBe('127.0.0.1');
  });

  it('refuses the server\'s own PID', async () => {
    const { options, signal, listTargets } = harness({ pid: 777, selfPid: 777 });
    const err = await failure(activateInspector(options));
    expect(err.message).toMatch(/PID 777 is this mcp-debugger server itself/);
    expect(listTargets).not.toHaveBeenCalled();
    expect(signal).not.toHaveBeenCalled();
  });

  it('adds the Windows hint to a failed process._debugProcess', async () => {
    const { options } = harness({ platform: 'win32', signal: () => { throw new Error('The system cannot find the file specified.'); } });
    const err = await failure(activateInspector(options));
    expect(err.message).toMatch(/could not activate the inspector of PID 4242: The system cannot find the file specified\. — on Windows this is what a process that is not Node\.js/);
  });

  it('accepts an inspector that opened right after the signal even when its owner cannot be told', async () => {
    const { options, signal } = harness({ probes: [closed, inspector('C:_app_server.js')], pidOf: async () => undefined });
    const result = await activateInspector(options);
    expect(signal).toHaveBeenCalledWith(4242);
    expect(result).toEqual({ host: '127.0.0.1', port: 9229, alreadyActive: false, title: 'C:_app_server.js' });
  });

  it('refuses when the port is held by something that is not a Node inspector', async () => {
    const { options, signal } = harness({ probes: [{ status: 'other', detail: 'HTTP 404 from /json/list' }] });
    const err = await failure(activateInspector(options));
    expect(err.message).toMatch(/is in use by something that is not a Node inspector \(HTTP 404 from \/json\/list\)/);
    expect(signal).not.toHaveBeenCalled();
  });

  // The review's construction (issue #1261): the target opens its inspector on its own
  // --inspect-port when signalled, and another process takes the expected port meanwhile.
  it('a different process on the port after the signal fails as a signalled attach, saying so', async () => {
    const { options, signal } = harness({ probes: [closed, inspector('node[31337]')] });
    const err = await failure(activateInspector(options));
    expect(signal).toHaveBeenCalledWith(4242);
    expect(err).toBeInstanceOf(SignalledActivationError);
    expect(err.name).toBe('SignalledActivationError');
    expect(err.message).toBe(
      'JavaScript attach: PID 4242 was signalled to open its inspector, but 127.0.0.1:9229 is already held by a Node inspector ' +
        'for a different process (PID 31337: node[31337]); one may now be open on another port (a target started with ' +
        '--inspect-port=<n> opens it there), and this server does not close it (#1310). To attach to it, pass that port with processId'
    );
    expect(err).toMatchObject({ pid: 4242, host: '127.0.0.1', port: 9229 });
  });

  it('any other failure after the signal is a signalled one too; one before it is not', async () => {
    const thrown = harness({ probes: [closed, inspector('server.js')], pidOf: async () => { throw new Error('read ECONNRESET'); } });
    // The pre-signal probe sees the port closed, so the ownership read only runs after the signal.
    const err = await failure(activateInspector(thrown.options));
    expect(err).toBeInstanceOf(SignalledActivationError);
    expect(err.message).toMatch(/^JavaScript attach: PID 4242 was signalled to open its inspector, but read ECONNRESET; /);

    const before = await failure(activateInspector(harness({ probes: [inspector('node[31337]')] }).options));
    expect(before).not.toBeInstanceOf(SignalledActivationError);
  });

  it('a rejection after the signal that is not an Error keeps its detail in the signalled failure', async () => {
    const { options } = harness({ probes: [closed, inspector('server.js')], pidOf: () => Promise.reject('socket hang up') });
    const err = await failure(activateInspector(options));
    expect(err).toBeInstanceOf(SignalledActivationError);
    expect(err.message).toMatch(/^JavaScript attach: PID 4242 was signalled to open its inspector, but socket hang up; /);
  });

  it('never signals a PID that is not a Node.js process on POSIX (SIGUSR1 would terminate it)', async () => {
    const { options, signal } = harness({ isNodeProcess: async () => false });
    const err = await failure(activateInspector(options));
    expect(err.message).toMatch(/PID 4242 is not a Node\.js process/);
    expect(err.message).toMatch(/would terminate it/);
    expect(signal).not.toHaveBeenCalled();
  });

  it('never signals a PID whose executable could not be identified on POSIX', async () => {
    const { options, signal } = harness({ isNodeProcess: async () => undefined });
    const err = await failure(activateInspector(options));
    expect(err.message).toMatch(/could not confirm that PID 4242 is a Node\.js process/);
    expect(signal).not.toHaveBeenCalled();
  });

  it('skips the executable check on win32, where process._debugProcess fails harmlessly on a non-Node target', async () => {
    const isNodeProcess = vi.fn(async () => false);
    const { options, signal } = harness({ platform: 'win32', isNodeProcess });
    await activateInspector(options);
    expect(isNodeProcess).not.toHaveBeenCalled();
    expect(signal).toHaveBeenCalledWith(4242);
  });

  it('reports a signal refused with EPERM as a permission problem', async () => {
    const { options } = harness({
      signal: () => { throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' }); }
    });
    const err = await failure(activateInspector(options));
    expect(err.message).toMatch(/not permitted to signal PID 4242 \(EPERM\)/);
  });

  it('reports any other signal failure with its message', async () => {
    const { options } = harness({ signal: () => { throw new Error('The system cannot find the file specified.'); } });
    const err = await failure(activateInspector(options));
    expect(err.message).toMatch(/could not activate the inspector of PID 4242: The system cannot find the file specified\./);
  });

  it('gives up when no inspector opens on the port before the deadline, saying the signal was sent and nothing was closed (#1261, #1310)', async () => {
    const { options, listTargets } = harness({ probes: [closed], deadlineMs: 350, pollMs: 100 });
    const err = await failure(activateInspector(options));
    expect(err).toBeInstanceOf(SignalledActivationError);
    expect(err.message).toBe(
      'JavaScript attach: PID 4242 was signalled to open its inspector, but none appeared on 127.0.0.1:9229 within 350 ms; ' +
        'one may now be open on another port (a target started with --inspect-port=<n> opens it there), ' +
        'and this server does not close it (#1310). To attach to it, pass that port with processId'
    );
    // the pre-signal probe, then one per poll until the clock passes the deadline
    expect(listTargets.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('refuses a PID that does not exist, with the container hint only in container mode', async () => {
    const host = await failure(activateInspector(harness({ processExists: () => false }).options));
    expect(host.message).toMatch(/no process with PID 4242/);
    expect(host.message).not.toMatch(/container/);

    const container = await failure(activateInspector(harness({ processExists: () => false, container: true }).options));
    expect(container.message).toMatch(/no process with PID 4242/);
    expect(container.message).toMatch(/container .*own PID namespace/);
  });

  it('refuses a non-loopback host: the signal can only reach a local process', async () => {
    const { options, signal } = harness({ host: '10.0.0.5' });
    const err = await failure(activateInspector(options));
    expect(err.message).toMatch(/local only \(host 10\.0\.0\.5\)/);
    expect(signal).not.toHaveBeenCalled();
  });

  it.each([['abc'], [0], [-3], [1.5], [''], [true], [null]])('refuses %j as a processId', async (pid) => {
    const { options } = harness({ pid: pid as unknown as number | string });
    const err = await failure(activateInspector(options));
    expect(err.message).toMatch(/processId must be a positive integer/);
  });
});

describe('probeInspector (the real /json/list probe)', () => {
  async function serve(handler: http.RequestListener): Promise<{ port: number; close: () => Promise<void> }> {
    const server = http.createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    return { port, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
  }

  it('reads the inspector targets off a listening inspector', async () => {
    const srv = await serve((req, res) => {
      expect(req.url).toBe('/json/list');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify([{ id: 'abc', title: 'node[777]', type: 'node', url: 'file://', webSocketDebuggerUrl: 'ws://127.0.0.1:9229/abc' }]));
    });
    try {
      const probe = await probeInspector('127.0.0.1', srv.port, 1000);
      expect(probe).toEqual({
        status: 'inspector',
        targets: [{ id: 'abc', title: 'node[777]', type: 'node', url: 'file://', webSocketDebuggerUrl: 'ws://127.0.0.1:9229/abc' }]
      });
    } finally {
      await srv.close();
    }
  });

  it('classifies a listener that is not an inspector as "other"', async () => {
    const srv = await serve((_req, res) => { res.statusCode = 404; res.end('not here'); });
    try {
      const probe = await probeInspector('127.0.0.1', srv.port, 1000);
      expect(probe.status).toBe('other');
      expect((probe as { detail: string }).detail).toMatch(/404/);
    } finally {
      await srv.close();
    }
  });

  // The review's construction (issue #1261): an ordinary HTTP server on the port answers a JSON array.
  it.each([
    [[], '/json/list answered a list with no Node inspector target in it (0 entries)'],
    [[{ id: 'x', title: 'app', type: 'page', webSocketDebuggerUrl: 'ws://127.0.0.1/x' }], '/json/list answered a list with no Node inspector target in it (1 entry)'],
    [[{ id: 'x', title: 'node[1]', type: 'node' }, { name: 'thing' }], '/json/list answered a list with no Node inspector target in it (2 entries)'],
    [[{ id: 'x', title: 'node[1]', type: 'node', webSocketDebuggerUrl: '' }], '/json/list answered a list with no Node inspector target in it (1 entry)']
  ])('an HTTP server whose /json/list is not a Node inspector\'s target list is "other": %j', async (list, detail) => {
    const srv = await serve((_req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(list)); });
    try {
      expect(await probeInspector('127.0.0.1', srv.port, 1000)).toEqual({ status: 'other', detail });
    } finally {
      await srv.close();
    }
  });

  it('keeps only the Node targets of a list that has one', async () => {
    const node = { id: 'n', title: 'server.js', type: 'node', webSocketDebuggerUrl: 'ws://127.0.0.1:9229/n' };
    const srv = await serve((_req, res) => { res.end(JSON.stringify([{ id: 'p', type: 'page' }, node])); });
    try {
      expect(await probeInspector('127.0.0.1', srv.port, 1000)).toEqual({ status: 'inspector', targets: [node] });
    } finally {
      await srv.close();
    }
  });

  it('a null entry beside a Node target is skipped: the list is an inspector\'s, with that target', async () => {
    const node = { id: 'n', title: 'server.js', type: 'node', webSocketDebuggerUrl: 'ws://127.0.0.1:9229/n' };
    const srv = await serve((_req, res) => { res.end(JSON.stringify([null, node])); });
    try {
      expect(await probeInspector('127.0.0.1', srv.port, 1000)).toEqual({ status: 'inspector', targets: [node] });
    } finally {
      await srv.close();
    }
  });

  it('classifies a closed port as "closed"', async () => {
    const srv = await serve((_req, res) => res.end());
    const port = srv.port;
    await srv.close();
    expect(await probeInspector('127.0.0.1', port, 1000)).toEqual({ status: 'closed' });
  });

  // The detach and close answers probe once (issue #1261): the bound is on the whole request.
  it('bounds the whole request: a responder that keeps trickling is "other" when the bound passes, and its connection is destroyed', async () => {
    let closedByProbe!: () => void;
    const connectionClosed = new Promise<void>((resolve) => { closedByProbe = resolve; });
    const srv = await serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write('[');
      const timer = setInterval(() => res.write(' '), 20);
      res.on('close', () => { clearInterval(timer); closedByProbe(); });
    });
    try {
      const started = Date.now();
      const probe = await probeInspector('127.0.0.1', srv.port, 300);
      expect(probe).toEqual({ status: 'other', detail: 'no answer from /json/list within 300 ms' });
      expect(Date.now() - started).toBeLessThan(1000);
      await connectionClosed;
    } finally {
      await srv.close();
    }
  });

  it('answers "other" as soon as a body passes the cap, without waiting for the bound', async () => {
    const srv = await serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write('[' + ' '.repeat(70 * 1024));
    });
    try {
      const started = Date.now();
      const probe = await probeInspector('127.0.0.1', srv.port, 5000);
      expect(probe).toEqual({ status: 'other', detail: '/json/list answered with more than 65536 bytes' });
      expect(Date.now() - started).toBeLessThan(2500);
    } finally {
      await srv.close();
    }
  });
});

describe('pidViaInspector (the real CDP ownership question)', () => {
  it('reads process.pid off a live inspector, and answers "unknown" for a closed port', async () => {
    const child = spawn(process.execPath, ['--inspect=127.0.0.1:0', '-e', 'setTimeout(() => {}, 20000)'], {
      stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true
    });
    try {
      let stderr = '';
      const wsUrl = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no inspector banner: ${stderr}`)), 15000);
        child.stderr!.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
          const match = /Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[0-9a-f-]+)/.exec(stderr);
          if (match) { clearTimeout(timer); resolve(match[1]); }
        });
        child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`child exited early (${code}): ${stderr}`)); });
      });
      expect(await pidViaInspector(wsUrl, 5000)).toBe(child.pid);
      const port = Number(new URL(wsUrl).port);
      child.kill('SIGKILL');
      await new Promise<void>((resolve) => child.once('exit', () => resolve()));
      expect(await pidViaInspector(`ws://127.0.0.1:${port}/gone`, 2000)).toBeUndefined();
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  }, 30000);
});

describe('isNodeProcessByPid', () => {
  it.skipIf(process.platform === 'win32')('recognises this test runner as a Node.js process', async () => {
    expect(await isNodeProcessByPid(process.pid)).toBe(true);
  });

  it.skipIf(process.platform === 'win32')('answers "unknown" for a PID that does not exist', async () => {
    // PID 2^22 is above Linux's default pid_max and far above macOS's.
    expect(await isNodeProcessByPid(4194304)).toBeUndefined();
  });
});

describe('inspectorSignalDisabledByPid', () => {
  it.skipIf(process.platform === 'win32')('sees --disable-sigusr1 on a child\'s command line, and its absence on this runner', async () => {
    expect(await inspectorSignalDisabledByPid(process.pid)).toBe(false);
    const child = spawn(process.execPath, ['--disable-sigusr1', '-e', 'setTimeout(() => {}, 20000)'], {
      stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true
    });
    try {
      let stderr = '';
      child.stderr!.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (child.exitCode !== null) {
        // A Node too old for the flag exits with "bad option": nothing to check here.
        expect(stderr).toMatch(/bad option/);
        return;
      }
      expect(await inspectorSignalDisabledByPid(child.pid!)).toBe(true);
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  }, 15000);
});
