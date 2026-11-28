/**
 * The JavaScript attach's wait for an inspector after the signal keeps its
 * stated bound (issue #1339): the adapter packages' first loop on the shared
 * Deadline.
 *
 * The wait is 5,000 ms by default. Each probe and each ownership query in it
 * is given the time that remains, and one that ignores what it is given is
 * abandoned 250 ms after the window (the grace a request already sent may
 * take to answer). The cases below stall one dependency at a time, each
 * honouring a different one of the three mechanisms (its own timeout, its
 * abort signal, nothing), so no mechanism can mask the absence of another.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as crypto from 'node:crypto';
import * as http from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { AdapterError, AdapterErrorCode } from '@debugmcp/shared';
import {
  activateInspector,
  pidViaInspector,
  probeInspector,
  SignalledActivationError,
  type InspectorActivationOptions,
  type InspectorProbe,
  type InspectorTarget
} from '../../src/utils/inspector-activation.js';

const WINDOW_MS = 5000;
const GRACE_MS = 250;

const closed: InspectorProbe = { status: 'closed' };
const inspector = (title: string): InspectorProbe => ({ status: 'inspector', targets: [{ id: '0', title, type: 'node' }] });

type ListTargets = (host: string, port: number, timeoutMs?: number, signal?: AbortSignal) => Promise<InspectorProbe>;
type PidOf = (target: InspectorTarget, timeoutMs?: number, signal?: AbortSignal) => Promise<number | undefined>;

/** The options of a Linux attach by PID 4242 whose port is closed before the signal; `after` answers every probe after it. */
function options(after: ListTargets, extra: Partial<InspectorActivationOptions> = {}): InspectorActivationOptions {
  let first = true;
  const listTargets: ListTargets = (host, port, timeoutMs, signal) => {
    if (first) {
      first = false;
      return Promise.resolve(closed);
    }
    return after(host, port, timeoutMs, signal);
  };
  return {
    pid: 4242,
    platform: 'linux',
    container: false,
    processExists: () => true,
    isNodeProcess: async () => true,
    inspectorSignalDisabled: async () => false,
    selfPid: 1,
    signal: vi.fn(),
    listTargets: listTargets as InspectorActivationOptions['listTargets'],
    pidOf: (async () => undefined) as InspectorActivationOptions['pidOf'],
    ...extra
  };
}

/** Run an activation on the fake clock; when it settled (virtual ms) and how. */
async function settle(opts: InspectorActivationOptions, limitMs = 20_000): Promise<{ at?: number; value?: unknown; error?: Error }> {
  const started = Date.now();
  const outcome: { at?: number; value?: unknown; error?: Error } = {};
  void activateInspector(opts).then(
    (value) => { outcome.at = Date.now() - started; outcome.value = value; },
    (error: Error) => { outcome.at = Date.now() - started; outcome.error = error; }
  );
  for (let elapsed = 0; elapsed < limitMs && outcome.at === undefined; elapsed += 10) {
    await vi.advanceTimersByTimeAsync(10);
  }
  return outcome;
}

const noneAppeared = /^JavaScript attach: PID 4242 was signalled to open its inspector, but none appeared on 127\.0\.0\.1:9229 within 5000 ms/;

describe('activateInspector keeps its wait after the signal (issue #1339)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a probe that never answers, whatever it is given, is abandoned at the window plus the grace', async () => {
    vi.useFakeTimers();
    const { at, error } = await settle(options(() => new Promise(() => {})));

    expect(at).toBeDefined();
    expect(at!).toBeGreaterThanOrEqual(WINDOW_MS);
    expect(at!).toBeLessThanOrEqual(WINDOW_MS + GRACE_MS);
    expect(error).toBeInstanceOf(SignalledActivationError);
    expect(error!.message).toMatch(noneAppeared);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a probe that keeps only its own timeout is given what remains, so the wait ends at the window', async () => {
    vi.useFakeTimers();
    const given: number[] = [];
    const ownTimeoutOnly: ListTargets = (_h, _p, timeoutMs = 1000) => {
      given.push(timeoutMs);
      return new Promise((resolve) => {
        setTimeout(() => resolve({ status: 'other', detail: `no answer from /json/list within ${timeoutMs} ms` }), timeoutMs);
      });
    };

    const { at, error } = await settle(options(ownTimeoutOnly));

    expect(at).toBe(WINDOW_MS);
    expect(error!.message).toMatch(noneAppeared);
    // The last probe got what was left of the window, not its own 1000 ms.
    expect(given.at(-1)!).toBeLessThan(1000);
    expect(Math.max(...given)).toBeLessThanOrEqual(1000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a probe that keeps only its abort signal is cut off at the window plus the grace', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    // It answers only when abandoned, and then with an inspector: a late
    // answer the wait must not act on (no ownership query is started for it).
    const signalOnly: ListTargets = (_h, _p, _timeoutMs, signal) => {
      if (signal) signals.push(signal);
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => resolve(inspector('C:_app_server.js')), { once: true });
      });
    };
    const pidOf = vi.fn(async () => undefined);

    const { at, error } = await settle(options(signalOnly, { pidOf: pidOf as InspectorActivationOptions['pidOf'] }));
    await vi.advanceTimersByTimeAsync(10);

    expect(at).toBeDefined();
    expect(at!).toBeLessThanOrEqual(WINDOW_MS + GRACE_MS);
    expect(error!.message).toMatch(noneAppeared);
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.at(-1)!.aborted).toBe(true);
    expect(pidOf).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('an ownership query that keeps only its own timeout is given what remains, and the inspector it could not identify is taken as the one the signal opened', async () => {
    vi.useFakeTimers();
    const given: number[] = [];
    const started = Date.now();
    // The port stays closed until 4,800 ms, then an inspector whose title names no pid answers.
    const late: ListTargets = async () => (Date.now() - started >= 4800 ? inspector('C:_app_server.js') : closed);
    const pidOf: PidOf = (_target, timeoutMs = 1500) => {
      given.push(timeoutMs);
      return new Promise((resolve) => setTimeout(() => resolve(undefined), timeoutMs));
    };

    const { at, value, error } = await settle(options(late, { pidOf: pidOf as InspectorActivationOptions['pidOf'] }));

    expect(error).toBeUndefined();
    expect(at!).toBeLessThanOrEqual(WINDOW_MS);
    expect(value).toEqual({ host: '127.0.0.1', port: 9229, alreadyActive: false, title: 'C:_app_server.js' });
    expect(given).toHaveLength(1);
    expect(given[0]).toBeLessThanOrEqual(200);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('an ownership query that keeps only its abort signal is cut off at the window plus the grace', async () => {
    vi.useFakeTimers();
    const started = Date.now();
    const late: ListTargets = async () => (Date.now() - started >= 4800 ? inspector('C:_app_server.js') : closed);
    const signals: AbortSignal[] = [];
    const pidOf: PidOf = (_target, _timeoutMs, signal) => {
      if (signal) signals.push(signal);
      return new Promise((resolve) => signal?.addEventListener('abort', () => resolve(undefined), { once: true }));
    };

    const { at, error } = await settle(options(late, { pidOf: pidOf as InspectorActivationOptions['pidOf'] }));

    expect(at).toBeDefined();
    expect(at!).toBeLessThanOrEqual(WINDOW_MS + GRACE_MS);
    expect(error).toBeInstanceOf(SignalledActivationError);
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no timer when the inspector appears early', async () => {
    vi.useFakeTimers();
    const started = Date.now();
    const early: ListTargets = async () => (Date.now() - started >= 300 ? inspector('node[4242]') : closed);

    const { at, value } = await settle(options(early, { pidOf: (async () => 4242) as InspectorActivationOptions['pidOf'] }));

    expect(at!).toBeLessThan(1000);
    expect(value).toMatchObject({ alreadyActive: false, title: 'node[4242]' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 2 ** 31])('refuses a wait of %d ms before it probes or signals anything', async (deadlineMs) => {
    const listTargets = vi.fn(async () => closed);
    const signal = vi.fn();
    let caught: unknown;
    try {
      await activateInspector({ ...options(listTargets), listTargets, signal, deadlineMs });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AdapterError);
    expect(caught).not.toBeInstanceOf(SignalledActivationError);
    expect((caught as AdapterError).code).toBe(AdapterErrorCode.ENVIRONMENT_INVALID);
    expect((caught as Error).message).toMatch(/^JavaScript attach: deadlineMs: the budget must be /);
    expect(signal).not.toHaveBeenCalled();
    expect(listTargets).not.toHaveBeenCalled();
  });

  it('names the window it kept when one is given', async () => {
    vi.useFakeTimers();
    const { at, error } = await settle(options(async () => closed, { deadlineMs: 350, pollMs: 100 }));

    expect(at).toBe(350);
    expect(error!.message).toMatch(/none appeared on 127\.0\.0\.1:9229 within 350 ms/);
    expect(vi.getTimerCount()).toBe(0);
  });
});

/** A server that accepts connections and never answers; it records when each one closes. */
async function silentServer(): Promise<{ server: http.Server; closedConnections: () => number; opened: () => number }> {
  let opened = 0;
  let closedCount = 0;
  const server = http.createServer(() => { /* never answers */ });
  server.on('connection', (socket: Socket) => {
    opened++;
    socket.on('close', () => { closedCount++; });
  });
  return { server, closedConnections: () => closedCount, opened: () => opened };
}

/**
 * The probes a real activation makes, for a listener that owns its port from
 * the start. The probe before the signal is answered "closed" (the port
 * refused it); every probe after the signal goes to the real probeInspector
 * with the time and the abort signal the wait hands it, and is recorded.
 *
 * Why the first answer is scripted: "refused, then listening" on one real
 * port needs the port free before the signal and bound after it, and a port
 * that is free can be taken by any other process in between (the race the
 * attach suites removed in #1243). A listener on port 0, read back, has no
 * such window. What this gives up is only the default `listTargets`, which
 * forwards the same two arguments to the same probe.
 */
function refusedThenReal(): {
  listTargets: InspectorActivationOptions['listTargets'];
  given: Array<{ timeoutMs?: number; abandoned?: AbortSignal }>;
} {
  let first = true;
  const given: Array<{ timeoutMs?: number; abandoned?: AbortSignal }> = [];
  const listTargets: ListTargets = (host, port, timeoutMs, abandoned) => {
    if (first) {
      first = false;
      return Promise.resolve(closed);
    }
    given.push({ timeoutMs, abandoned });
    return probeInspector(host, port, timeoutMs, abandoned);
  };
  return { listTargets: listTargets as InspectorActivationOptions['listTargets'], given };
}

async function listenOnAnyPort(server: http.Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

describe('activateInspector against a real silent listener (issue #1339)', () => {
  it('cuts the real /json/list probe in flight at the window and closes its connection', async () => {
    const silent = await silentServer();
    const port = await listenOnAnyPort(silent.server);
    const { listTargets, given } = refusedThenReal();
    const signal = vi.fn();
    try {
      const started = Date.now();
      let caught: unknown;
      try {
        await activateInspector({
          pid: 4242,
          port,
          platform: 'win32',
          processExists: () => true,
          selfPid: 1,
          signal,
          listTargets,
          pidOf: (async () => undefined) as InspectorActivationOptions['pidOf'],
          deadlineMs: 400,
          pollMs: 100
        });
      } catch (err) {
        caught = err;
      }
      const elapsed = Date.now() - started;
      expect(signal).toHaveBeenCalledOnce();
      expect(caught).toBeInstanceOf(SignalledActivationError);
      expect((caught as Error).message).toMatch(new RegExp(`none appeared on 127\.0\.0\.1:${port} within 400 ms`));
      // 400 ms and the grace, with room for a loaded machine; the old probe ran on for its own 1,000 ms.
      expect(elapsed).toBeLessThan(400 + GRACE_MS + 200);
      // Each real probe was given what remained of the wait, and its abort signal.
      expect(given.length).toBeGreaterThan(0);
      for (const probe of given) {
        expect(probe.timeoutMs!).toBeLessThanOrEqual(400);
        expect(probe.abandoned).toBeInstanceOf(AbortSignal);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(silent.opened()).toBeGreaterThan(0);
      expect(silent.closedConnections()).toBe(silent.opened());
    } finally {
      silent.server.closeAllConnections?.();
      await new Promise<void>((resolve) => silent.server.close(() => resolve()));
    }
  }, 10_000);
});

describe('the probes honour an abort signal (issue #1339)', () => {
  it('probeInspector ends at the abort, destroying its connection', async () => {
    const silent = await silentServer();
    await new Promise<void>((resolve) => silent.server.listen(0, '127.0.0.1', resolve));
    const { port } = silent.server.address() as AddressInfo;
    try {
      const controller = new AbortController();
      const started = Date.now();
      setTimeout(() => controller.abort(), 50);
      const probe = await probeInspector('127.0.0.1', port, 10_000, controller.signal);
      expect(Date.now() - started).toBeLessThan(2000);
      expect(probe.status).toBe('other');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(silent.closedConnections()).toBe(silent.opened());
    } finally {
      silent.server.closeAllConnections?.();
      await new Promise<void>((resolve) => silent.server.close(() => resolve()));
    }
  }, 15_000);

  it('probeInspector answers at once for a signal already aborted, and opens nothing', async () => {
    const silent = await silentServer();
    await new Promise<void>((resolve) => silent.server.listen(0, '127.0.0.1', resolve));
    const { port } = silent.server.address() as AddressInfo;
    try {
      const probe = await probeInspector('127.0.0.1', port, 10_000, AbortSignal.abort());
      expect(probe.status).toBe('other');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(silent.opened()).toBe(0);
    } finally {
      await new Promise<void>((resolve) => silent.server.close(() => resolve()));
    }
  });

  it('pidViaInspector ends at the abort on a WebSocket that is accepted and never answered', async () => {
    const server = http.createServer();
    const upgraded = new Set<{ destroy(): void }>();
    server.on('upgrade', (req, socket) => {
      upgraded.add(socket);
      const key = req.headers['sec-websocket-key'];
      const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
      // and then silence: no CDP answer, no close frame
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const controller = new AbortController();
      const started = Date.now();
      setTimeout(() => controller.abort(), 100);
      const pid = await pidViaInspector(`ws://127.0.0.1:${port}/t1`, 10_000, controller.signal);
      expect(pid).toBeUndefined();
      expect(Date.now() - started).toBeLessThan(2000);
    } finally {
      for (const socket of upgraded) socket.destroy();
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 15_000);
});

describe('activateInspector\'s default ownership query (issue #1339)', () => {
  it('is given what remains of the wait, so an inspector it cannot identify is still taken on time', async () => {
    let port = 0;
    const upgraded = new Set<{ destroy(): void }>();
    // A Node-shaped inspector whose title names no pid and whose WebSocket is
    // accepted and never answered: the ownership query can only time out.
    const server = http.createServer((req, res) => {
      if (req.url === '/json/list') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify([{ id: 't1', title: 'server.js', type: 'node', url: 'file://', webSocketDebuggerUrl: `ws://127.0.0.1:${port}/t1` }]));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    server.on('upgrade', (req, socket) => {
      upgraded.add(socket);
      const key = req.headers['sec-websocket-key'];
      const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    });
    port = await listenOnAnyPort(server);
    const { listTargets } = refusedThenReal();
    const signal = vi.fn();
    try {
      const started = Date.now();
      const result = await activateInspector({
        pid: 4242,
        port,
        platform: 'win32',
        processExists: () => true,
        selfPid: 1,
        signal,
        // The real probe after the signal; the ownership query is the default one.
        listTargets,
        deadlineMs: 400,
        pollMs: 100
      });
      const elapsed = Date.now() - started;
      expect(signal).toHaveBeenCalledOnce();
      expect(result).toEqual({ host: '127.0.0.1', port, alreadyActive: false, title: 'server.js' });
      // Its own 1,500 ms would have outlasted the wait and its grace.
      expect(elapsed).toBeLessThan(400 + GRACE_MS + 200);
    } finally {
      for (const socket of upgraded) socket.destroy();
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 10_000);
});
