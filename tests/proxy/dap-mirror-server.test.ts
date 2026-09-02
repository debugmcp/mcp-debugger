/**
 * Hermetic unit tests for DapMirrorServer / MirrorClientConnection
 * (issue #217). No real sockets: an EventEmitter fake stands in for
 * net.Server/net.Socket, and everything the mirror writes is decoded with
 * the real DapFrameDecoder so the assertions read whole protocol frames.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { DebugProtocol } from '@vscode/debugprotocol';
import {
  DapMirrorServer,
  CONFIGURATION_DONE_FALLBACK_MS,
  type DapMirrorHost,
  type MirrorNetServer,
  type MirrorSocket
} from '../../src/proxy/dap-mirror-server.js';
import { DapFrameDecoder, encodeDapMessage } from '../../src/proxy/dap-framing.js';
import type { ILogger } from '../../src/proxy/dap-proxy-interfaces.js';

const createMockLogger = (): ILogger => ({
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn()
});

class FakeSocket extends EventEmitter implements MirrorSocket {
  public written: DebugProtocol.ProtocolMessage[] = [];
  public destroyed = false;
  public ended = false;
  private decoder = new DapFrameDecoder();

  write(data: Buffer | string, cb?: (err?: Error) => void): boolean {
    this.written.push(...this.decoder.push(Buffer.isBuffer(data) ? data : Buffer.from(data)));
    cb?.();
    return true;
  }

  end(): void {
    this.ended = true;
    this.emit('close');
  }

  destroy(): void {
    this.destroyed = true;
  }

  setNoDelay(): void {
    /* no-op */
  }
}

class FakeNetServer extends EventEmitter implements MirrorNetServer {
  public listening = false;
  public listenOptions: { port: number; host: string } | null = null;
  public closed = false;

  constructor(private readonly port: number = 43117) {
    super();
  }

  listen(options: { port: number; host: string }, cb: () => void): void {
    this.listenOptions = options;
    this.listening = true;
    cb();
  }

  close(cb?: (err?: Error) => void): void {
    this.listening = false;
    this.closed = true;
    cb?.();
  }

  address(): { port: number } | null {
    return this.listening ? { port: this.port } : null;
  }
}

interface Harness {
  server: DapMirrorServer;
  netServer: FakeNetServer;
  host: DapMirrorHost & {
    forwardRequest: ReturnType<typeof vi.fn>;
    getCapabilities: ReturnType<typeof vi.fn>;
    getLastStop: ReturnType<typeof vi.fn>;
  };
  logger: ILogger;
  endpoint: { host: string; port: number; token: string };
  connect: () => FakeSocket;
}

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setImmediate(resolve));
};

const send = (socket: FakeSocket, message: object): void => {
  socket.emit('data', encodeDapMessage(message as DebugProtocol.ProtocolMessage));
};

let requestSeq: number;
const request = (command: string, args?: unknown): DebugProtocol.Request =>
  ({
    seq: requestSeq++,
    type: 'request',
    command,
    ...(args !== undefined ? { arguments: args } : {})
  }) as DebugProtocol.Request;

const responses = (socket: FakeSocket): DebugProtocol.Response[] =>
  socket.written.filter((m): m is DebugProtocol.Response => m.type === 'response');

const events = (socket: FakeSocket): DebugProtocol.Event[] =>
  socket.written.filter((m): m is DebugProtocol.Event => m.type === 'event');

const responseFor = (socket: FakeSocket, command: string): DebugProtocol.Response | undefined =>
  responses(socket).find((r) => r.command === command);

async function createHarness(options?: {
  capabilities?: DebugProtocol.Capabilities;
  lastStop?: DebugProtocol.StoppedEvent['body'];
  maxClients?: number;
}): Promise<Harness> {
  const netServer = new FakeNetServer();
  const logger = createMockLogger();
  const host = {
    forwardRequest: vi.fn(async (command: string) => ({
      seq: 999,
      type: 'response',
      request_seq: 0,
      command,
      success: true,
      body: { forwarded: command }
    })),
    getCapabilities: vi.fn(() => options?.capabilities),
    getLastStop: vi.fn(() => options?.lastStop)
  };
  const server = new DapMirrorServer(host, {
    logger,
    createServer: () => netServer,
    maxClients: options?.maxClients,
    randomBytes: (n: number) => Buffer.alloc(n, 7)
  });
  const endpoint = await server.start();
  return {
    server,
    netServer,
    host,
    logger,
    endpoint,
    connect: () => {
      const socket = new FakeSocket();
      netServer.emit('connection', socket);
      return socket;
    }
  };
}

/** initialize + attach with the (correct, unless overridden) token. */
async function join(h: Harness, socket: FakeSocket, token?: string): Promise<void> {
  send(socket, request('initialize', { clientID: 'test', adapterID: 'mock', linesStartAt1: true }));
  send(socket, request('attach', { mirrorToken: token ?? h.endpoint.token }));
  await flush();
}

describe('DapMirrorServer', () => {
  beforeEach(() => {
    requestSeq = 1;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('start()', () => {
    it('binds loopback-only on the reported port and mints a 32-char token', async () => {
      const h = await createHarness();
      expect(h.netServer.listenOptions).toEqual({ port: 0, host: '127.0.0.1' });
      expect(h.endpoint).toEqual({
        host: '127.0.0.1',
        port: 43117,
        token: Buffer.alloc(24, 7).toString('base64url')
      });
      expect(h.endpoint.token.length).toBeGreaterThanOrEqual(32);
    });

    it('is idempotent: a second start() returns the same endpoint', async () => {
      const h = await createHarness();
      await expect(h.server.start()).resolves.toEqual(h.endpoint);
    });

    it('rejects when the listener errors before binding', async () => {
      const netServer = new FakeNetServer();
      netServer.listen = (_options, _cb) => {
        netServer.emit('error', new Error('EADDRINUSE'));
      };
      const server = new DapMirrorServer(
        { forwardRequest: vi.fn(), getCapabilities: vi.fn(), getLastStop: vi.fn() },
        { logger: createMockLogger(), createServer: () => netServer }
      );
      await expect(server.start()).rejects.toThrow('EADDRINUSE');
    });
  });

  describe('handshake', () => {
    it('answers initialize from the capability mask and follows with an initialized event', async () => {
      const h = await createHarness({
        capabilities: {
          supportsEvaluateForHovers: true,
          supportsExceptionInfoRequest: true,
          supportsSetVariable: true,
          supportsRestartRequest: true,
          supportsStepBack: true,
          exceptionBreakpointFilters: [{ filter: 'uncaught', label: 'Uncaught' }]
        }
      });
      const socket = h.connect();
      send(socket, request('initialize', { adapterID: 'mock' }));
      await flush();

      const init = responseFor(socket, 'initialize');
      expect(init?.success).toBe(true);
      const caps = init?.body as DebugProtocol.Capabilities;
      // Pass-through read capabilities survive…
      expect(caps.supportsEvaluateForHovers).toBe(true);
      expect(caps.supportsExceptionInfoRequest).toBe(true);
      // …control affordances are forced off…
      expect(caps.supportsSetVariable).toBe(false);
      expect(caps.supportsRestartRequest).toBe(false);
      expect(caps.supportsStepBack).toBe(false);
      // …configurationDone is forced on, exception filters emptied.
      expect(caps.supportsConfigurationDoneRequest).toBe(true);
      expect(caps.exceptionBreakpointFilters).toEqual([]);

      // The initialized event comes after the initialize response.
      const initIndex = socket.written.findIndex((m) => m.type === 'response');
      const initializedIndex = socket.written.findIndex(
        (m) => m.type === 'event' && (m as DebugProtocol.Event).event === 'initialized'
      );
      expect(initializedIndex).toBeGreaterThan(initIndex);
    });

    it('completes attach + breakpoint config + configurationDone without a synthesized stop when not paused', async () => {
      const h = await createHarness();
      const socket = h.connect();
      await join(h, socket);

      expect(responseFor(socket, 'attach')?.success).toBe(true);

      send(socket, request('setBreakpoints', { source: { path: 'a.py' }, breakpoints: [{ line: 3 }, { line: 9 }] }));
      send(socket, request('setExceptionBreakpoints', { filters: ['uncaught'] }));
      send(socket, request('configurationDone'));
      await flush();

      const bps = responseFor(socket, 'setBreakpoints');
      expect(bps?.success).toBe(true);
      expect((bps?.body as { breakpoints: unknown[] }).breakpoints).toEqual([
        expect.objectContaining({ verified: false, line: 3, message: expect.stringContaining('Read-only mirror') }),
        expect.objectContaining({ verified: false, line: 9 })
      ]);
      expect(responseFor(socket, 'setExceptionBreakpoints')?.success).toBe(true);
      expect(responseFor(socket, 'configurationDone')?.success).toBe(true);
      expect(events(socket).map((e) => e.event)).not.toContain('stopped');
    });

    it('rejects a second attach on the same connection', async () => {
      const h = await createHarness();
      const socket = h.connect();
      await join(h, socket);
      send(socket, request('attach', { mirrorToken: h.endpoint.token }));
      await flush();

      const attaches = responses(socket).filter((r) => r.command === 'attach');
      expect(attaches[0]?.success).toBe(true);
      expect(attaches[1]?.success).toBe(false);
    });
  });

  describe('late-join stopped synthesis', () => {
    const lastStop: DebugProtocol.StoppedEvent['body'] = {
      reason: 'breakpoint',
      threadId: 7,
      allThreadsStopped: true,
      description: 'Paused on breakpoint'
    };

    it('synthesizes a stopped event after configurationDone when the session is paused', async () => {
      const h = await createHarness({ lastStop });
      const socket = h.connect();
      await join(h, socket);
      send(socket, request('configurationDone'));
      await flush();

      const stopped = events(socket).find((e) => e.event === 'stopped');
      expect(stopped?.body).toEqual({ ...lastStop, preserveFocusHint: false });

      // Order: configurationDone response precedes the synthesized stop.
      const cfgIdx = socket.written.findIndex(
        (m) => m.type === 'response' && (m as DebugProtocol.Response).command === 'configurationDone'
      );
      const stopIdx = socket.written.findIndex(
        (m) => m.type === 'event' && (m as DebugProtocol.Event).event === 'stopped'
      );
      expect(stopIdx).toBeGreaterThan(cfgIdx);
    });

    it('falls back to a short timer for clients that never send configurationDone', async () => {
      vi.useFakeTimers();
      const h = await createHarness({ lastStop });
      const socket = h.connect();
      send(socket, request('initialize', {}));
      send(socket, request('attach', { mirrorToken: h.endpoint.token }));
      await vi.advanceTimersByTimeAsync(0);

      // Never at t=0: protocol-following IDEs must not see a stopped event
      // before their configuration phase.
      expect(events(socket).map((e) => e.event)).not.toContain('stopped');
      await vi.advanceTimersByTimeAsync(CONFIGURATION_DONE_FALLBACK_MS);
      expect(events(socket).filter((e) => e.event === 'stopped')).toHaveLength(1);
    });

    it('delivers a live stopped broadcast to a client still in the configuration phase', async () => {
      // The synthesized late-join replay waits for configurationDone, but a
      // real stop happening mid-handshake is broadcast immediately — the
      // mirror's ordering tolerance the short fallback relies on.
      const h = await createHarness();
      const socket = h.connect();
      await join(h, socket);

      h.server.broadcastEvent('stopped', { reason: 'breakpoint', threadId: 3 });
      await flush();

      expect(events(socket).filter((e) => e.event === 'stopped')).toHaveLength(1);
    });

    it('does not double-fire when configurationDone arrives before the fallback timer', async () => {
      vi.useFakeTimers();
      const h = await createHarness({ lastStop });
      const socket = h.connect();
      send(socket, request('initialize', {}));
      send(socket, request('attach', { mirrorToken: h.endpoint.token }));
      send(socket, request('configurationDone'));
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(2000);

      expect(events(socket).filter((e) => e.event === 'stopped')).toHaveLength(1);
    });
  });

  describe('token gate', () => {
    it('rejects a wrong token with a user-visible error and closes the socket', async () => {
      const h = await createHarness();
      const socket = h.connect();
      await join(h, socket, 'wrong-token');

      const attach = responseFor(socket, 'attach');
      expect(attach?.success).toBe(false);
      expect((attach?.body as { error: { id: number; showUser: boolean } }).error).toMatchObject({
        id: 9102,
        showUser: true
      });
      expect(socket.ended).toBe(true);
      expect(h.server.clientCount()).toBe(0);
    });

    it('rejects a missing token', async () => {
      const h = await createHarness();
      const socket = h.connect();
      send(socket, request('initialize', {}));
      send(socket, request('attach', {}));
      await flush();

      expect(responseFor(socket, 'attach')?.success).toBe(false);
      expect(socket.ended).toBe(true);
    });

    it('gates non-handshake requests until authenticated', async () => {
      const h = await createHarness();
      const socket = h.connect();
      send(socket, request('initialize', {}));
      send(socket, request('threads'));
      await flush();

      const threads = responseFor(socket, 'threads');
      expect(threads?.success).toBe(false);
      expect((threads?.body as { error: { id: number } }).error.id).toBe(9102);
      expect(h.host.forwardRequest).not.toHaveBeenCalled();
    });

    it('reaps clients that never authenticate after the auth timeout', async () => {
      vi.useFakeTimers();
      const h = await createHarness();
      const socket = h.connect();
      send(socket, request('initialize', {}));
      await vi.advanceTimersByTimeAsync(0);

      expect(h.server.clientCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(socket.ended).toBe(true);
      expect(h.server.clientCount()).toBe(0);
    });
  });

  describe('request forwarding', () => {
    const FORWARDED = [
      'threads',
      'stackTrace',
      'scopes',
      'variables',
      'source',
      'evaluate',
      'exceptionInfo',
      'loadedSources',
      'modules'
    ];

    it('forwards every allowlisted read request and relays the body with the client seq correlated', async () => {
      const h = await createHarness();
      const socket = h.connect();
      await join(h, socket);

      const sentSeqs = new Map<string, number>();
      for (const command of FORWARDED) {
        const req = request(command, { probe: command });
        sentSeqs.set(command, req.seq);
        send(socket, req);
      }
      await flush();

      for (const command of FORWARDED) {
        expect(h.host.forwardRequest).toHaveBeenCalledWith(command, { probe: command });
        const response = responseFor(socket, command);
        expect(response?.success).toBe(true);
        expect(response?.body).toEqual({ forwarded: command });
        expect(response?.request_seq).toBe(sentSeqs.get(command));
      }
    });

    it('relays adapter failures as error responses', async () => {
      const h = await createHarness();
      h.host.forwardRequest.mockRejectedValueOnce(new Error('stackTrace not available while running'));
      const socket = h.connect();
      await join(h, socket);
      send(socket, request('stackTrace', { threadId: 1 }));
      await flush();

      const response = responseFor(socket, 'stackTrace');
      expect(response?.success).toBe(false);
      expect(response?.message).toContain('not available while running');
    });

    it('forwards a failed response that carries only body.error.format with that text as message (issue #663)', async () => {
      const h = await createHarness();
      h.host.forwardRequest.mockResolvedValueOnce({
        seq: 999,
        type: 'response',
        request_seq: 0,
        command: 'evaluate',
        success: false,
        body: { error: { id: 2013, format: 'Uncaught ReferenceError: {name} is not defined', variables: { name: 'x' } } }
      });
      const socket = h.connect();
      await join(h, socket);
      send(socket, request('evaluate', { expression: 'x' }));
      await flush();

      const response = responseFor(socket, 'evaluate');
      expect(response?.success).toBe(false);
      expect(response?.message).toBe('Uncaught ReferenceError: x is not defined');
    });

    it('correlates out-of-order completions to the right request_seq', async () => {
      const h = await createHarness();
      const deferred: Array<(r: DebugProtocol.Response) => void> = [];
      h.host.forwardRequest.mockImplementation(
        (command: string) =>
          new Promise<DebugProtocol.Response>((resolve) => {
            deferred.push((r) => resolve({ ...r, command }));
          })
      );
      const socket = h.connect();
      await join(h, socket);

      const first = request('threads');
      const second = request('stackTrace', { threadId: 1 });
      send(socket, first);
      send(socket, second);
      await flush();

      // Resolve in reverse order.
      const template = { seq: 0, type: 'response', request_seq: 0, command: '', success: true } as DebugProtocol.Response;
      deferred[1]({ ...template, body: { which: 'second' } });
      deferred[0]({ ...template, body: { which: 'first' } });
      await flush();

      expect(responseFor(socket, 'threads')).toMatchObject({ request_seq: first.seq, body: { which: 'first' } });
      expect(responseFor(socket, 'stackTrace')).toMatchObject({ request_seq: second.seq, body: { which: 'second' } });
    });
  });

  describe('read-only rejection', () => {
    const REJECTED = [
      'continue',
      'next',
      'stepIn',
      'stepOut',
      'stepBack',
      'reverseContinue',
      'pause',
      'goto',
      'gotoTargets',
      'restart',
      'restartFrame',
      'terminate',
      'terminateThreads',
      'setVariable',
      'setExpression',
      'writeMemory',
      'readMemory',
      'disassemble',
      'dataBreakpointInfo',
      'completions',
      'stepInTargets',
      'someCustomAdapterRequest'
    ];

    it.each(REJECTED)('rejects %s with a quiet read-only error and never forwards it', async (command) => {
      const h = await createHarness();
      const socket = h.connect();
      await join(h, socket);
      send(socket, request(command, { threadId: 1 }));
      await flush();

      const response = responseFor(socket, command);
      expect(response?.success).toBe(false);
      expect(response?.message).toContain('read-only');
      expect((response?.body as { error: { id: number; showUser: boolean } }).error).toMatchObject({
        id: 9101,
        showUser: false
      });
      expect(h.host.forwardRequest).not.toHaveBeenCalled();
    });
  });

  describe('multi-client fan-out and seq spaces', () => {
    it('broadcasts events to all authenticated clients with independent monotonic seqs', async () => {
      const h = await createHarness();
      const a = h.connect();
      const b = h.connect();
      await join(h, a);
      // Client A does extra work to shift its seq space.
      send(a, request('threads'));
      await join(h, b);
      await flush();

      h.server.broadcastEvent('output', { category: 'stdout', output: 'hello\n' });
      h.server.broadcastEvent('thread', { reason: 'started', threadId: 2 });
      await flush();

      for (const socket of [a, b]) {
        expect(events(socket).filter((e) => e.event === 'output')).toHaveLength(1);
        expect(events(socket).filter((e) => e.event === 'thread')).toHaveLength(1);
        const seqs = socket.written.map((m) => m.seq);
        expect([...seqs].sort((x, y) => x - y)).toEqual(seqs); // monotonic
        expect(seqs[0]).toBe(1); // per-client space starts at 1
      }
      // A wrote more frames than B — spaces are independent.
      expect(a.written.length).toBeGreaterThan(b.written.length);
    });

    it('does not broadcast to unauthenticated clients', async () => {
      const h = await createHarness();
      const joined = h.connect();
      const lurker = h.connect();
      await join(h, joined);
      send(lurker, request('initialize', {}));
      await flush();

      h.server.broadcastEvent('output', { output: 'secret\n' });
      expect(events(joined).some((e) => e.event === 'output')).toBe(true);
      expect(events(lurker).some((e) => e.event === 'output')).toBe(false);
    });

    it('a disconnect closes only that client', async () => {
      const h = await createHarness();
      const a = h.connect();
      const b = h.connect();
      await join(h, a);
      await join(h, b);

      send(a, request('disconnect'));
      await flush();

      expect(responseFor(a, 'disconnect')?.success).toBe(true);
      expect(a.ended).toBe(true);
      expect(h.server.clientCount()).toBe(1);

      send(b, request('threads'));
      await flush();
      expect(responseFor(b, 'threads')?.success).toBe(true);
    });

    it('destroys connections beyond maxClients before any frame', async () => {
      const h = await createHarness({ maxClients: 2 });
      h.connect();
      h.connect();
      const rejected = h.connect();

      expect(rejected.destroyed).toBe(true);
      expect(h.server.clientCount()).toBe(2);
    });
  });

  describe('stop()', () => {
    it('notifies clients with terminated, closes sockets, and closes the listener', async () => {
      const h = await createHarness();
      const socket = h.connect();
      await join(h, socket);

      await h.server.stop({ notifyClients: true });

      expect(events(socket).filter((e) => e.event === 'terminated')).toHaveLength(1);
      expect(socket.ended).toBe(true);
      expect(h.netServer.closed).toBe(true);
      expect(h.server.clientCount()).toBe(0);

      // Idempotent.
      await expect(h.server.stop()).resolves.toBeUndefined();
    });

    it('does not duplicate terminated for clients that already received one', async () => {
      const h = await createHarness();
      const socket = h.connect();
      await join(h, socket);

      h.server.broadcastEvent('terminated', {});
      await h.server.stop({ notifyClients: true });

      expect(events(socket).filter((e) => e.event === 'terminated')).toHaveLength(1);
    });

    it('a stopped server refuses new connections', async () => {
      const h = await createHarness();
      await h.server.stop();
      const socket = h.connect();
      expect(socket.destroyed).toBe(true);
    });
  });

  describe('malformed input', () => {
    it('closes a client on a corrupt header but keeps serving other clients', async () => {
      const h = await createHarness();
      const bad = h.connect();
      const good = h.connect();
      await join(h, good);

      bad.emit('data', Buffer.from('Content-Length: garbage\r\n\r\n{"type":"request"}', 'utf8'));
      await flush();

      expect(bad.ended).toBe(true);
      send(good, request('threads'));
      await flush();
      expect(responseFor(good, 'threads')?.success).toBe(true);
    });
  });
});
