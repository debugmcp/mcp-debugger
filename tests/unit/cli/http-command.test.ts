import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { EventEmitter } from 'events';
import os from 'os';
import path from 'path';
import { createHttpApp, handleHttpCommand, type ServerFactoryOptions } from '../../../src/cli/http-command.js';
import { FakeCurrentProcess } from '../../test-utils/mocks/fake-current-process.js';
import type { Logger as WinstonLoggerType } from 'winston';
import { DebugMcpServer } from '../../../src/server.js';

vi.mock('../../../src/server.js');
vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js');
vi.mock('@modelcontextprotocol/sdk/server/express.js');

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
const MockedStreamableHTTPServerTransport = vi.mocked(StreamableHTTPServerTransport);
const mockedCreateMcpExpressApp = vi.mocked(createMcpExpressApp);

describe('HTTP Command Handler', () => {
  let mockLogger: WinstonLoggerType;
  let mockServerFactory: Mock<(options: ServerFactoryOptions) => DebugMcpServer>;
  let mockExitProcess: Mock<(code: number) => void>;
  let mockServer: DebugMcpServer;
  let mockTransport: any;
  let fakeProc: FakeCurrentProcess;
  let mockApp: any;

  // Track transports created so tests can drive them
  let createdTransports: any[];
  let lastTransportOptions: any;

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      level: 'info',
    } as any;

    mockServer = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      server: {
        connect: vi.fn().mockResolvedValue(undefined),
      },
      sessionManager: {
        getAllSessions: vi.fn().mockReturnValue([]),
      },
    } as any;

    mockServerFactory = vi.fn<(options: ServerFactoryOptions) => DebugMcpServer>().mockReturnValue(mockServer);
    mockExitProcess = vi.fn<(code: number) => void>();
    // Signal handlers attach to the fake's emitter, never the real process
    // (issues #159/#183).
    fakeProc = new FakeCurrentProcess();

    createdTransports = [];

    MockedStreamableHTTPServerTransport.mockImplementation(function (options: any) {
      lastTransportOptions = options;
      const sessionId = 'session-' + Math.random().toString(36).slice(2, 9);
      const t: any = {
        sessionId,
        close: vi.fn(),
        onclose: undefined,
        onerror: undefined,
        handleRequest: vi.fn().mockResolvedValue(undefined),
        // Helper: drive the SDK's onsessioninitialized callback to register the session
        triggerSessionInit() {
          if (options?.onsessioninitialized) options.onsessioninitialized(sessionId);
        },
        triggerClose() {
          if (this.onclose) this.onclose();
        },
        triggerError(err: Error) {
          if (this.onerror) this.onerror(err);
        },
      };
      createdTransports.push(t);
      mockTransport = t;
      return t;
    });

    mockApp = {
      use: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
      all: vi.fn(),
      listen: vi.fn(),
    };
    mockedCreateMcpExpressApp.mockReturnValue(mockApp as any);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('createHttpApp', () => {
    it('creates the Express app via the SDK helper for DNS rebind protection', () => {
      createHttpApp({ port: '3001' }, { logger: mockLogger, serverFactory: mockServerFactory });
      expect(mockedCreateMcpExpressApp).toHaveBeenCalled();
    });

    it('exposes the per-session transport map for graceful shutdown', () => {
      const app = createHttpApp(
        { port: '3001' },
        { logger: mockLogger, serverFactory: mockServerFactory }
      );
      expect((app as any).httpSessions).toBeInstanceOf(Map);
    });

    it('registers /mcp on POST, GET, and DELETE', () => {
      createHttpApp({ port: '3001' }, { logger: mockLogger, serverFactory: mockServerFactory });
      expect(mockApp.post).toHaveBeenCalledWith('/mcp', expect.any(Function));
      expect(mockApp.get).toHaveBeenCalledWith('/mcp', expect.any(Function));
      expect(mockApp.delete).toHaveBeenCalledWith('/mcp', expect.any(Function));
    });

    it('registers a /health endpoint', () => {
      createHttpApp({ port: '3001' }, { logger: mockLogger, serverFactory: mockServerFactory });
      expect(mockApp.get).toHaveBeenCalledWith('/health', expect.any(Function));
    });

    it('installs a CORS middleware that exposes Mcp-Session-Id and related headers', () => {
      createHttpApp({ port: '3001' }, { logger: mockLogger, serverFactory: mockServerFactory });

      // CORS is the first use() call
      const corsMiddleware = mockApp.use.mock.calls[0][0];
      const headers = new Map<string, string>();
      const res = {
        header: vi.fn((name: string, value: string) => headers.set(name.toLowerCase(), value)),
        sendStatus: vi.fn(),
      };
      const next = vi.fn();

      corsMiddleware({ method: 'GET' }, res, next);
      expect(headers.get('access-control-allow-origin')).toBe('*');
      expect(headers.get('access-control-expose-headers')?.toLowerCase()).toContain('mcp-session-id');
      expect(headers.get('access-control-expose-headers')?.toLowerCase()).toContain('last-event-id');
      expect(headers.get('access-control-expose-headers')?.toLowerCase()).toContain('mcp-protocol-version');
      expect(next).toHaveBeenCalled();

      // OPTIONS short-circuits
      const res2 = { header: vi.fn(), sendStatus: vi.fn() };
      const next2 = vi.fn();
      corsMiddleware({ method: 'OPTIONS' }, res2, next2);
      expect(res2.sendStatus).toHaveBeenCalledWith(200);
      expect(next2).not.toHaveBeenCalled();
    });
  });

  describe('/mcp request handling', () => {
    function getHandler() {
      const app = createHttpApp(
        { port: '3001' },
        { logger: mockLogger, serverFactory: mockServerFactory }
      );
      const postCall = mockApp.post.mock.calls.find((c: any) => c[0] === '/mcp');
      return { app, handler: postCall![1] as (req: any, res: any) => Promise<void> };
    }

    function makeReq(overrides: Partial<{ method: string; headers: any; body: any }> = {}) {
      return {
        method: overrides.method ?? 'POST',
        headers: overrides.headers ?? {},
        body: overrides.body,
      };
    }

    function makeRes() {
      return {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        end: vi.fn(),
        headersSent: false,
      };
    }

    it('creates a new transport + server when an Initialize request arrives without a session ID', async () => {
      const { app, handler } = getHandler();
      const req = makeReq({
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'c', version: '1' } },
        },
      });
      const res = makeRes();

      await handler(req, res);

      expect(mockServerFactory).toHaveBeenCalledTimes(1);
      expect(MockedStreamableHTTPServerTransport).toHaveBeenCalledTimes(1);
      expect(mockServer.server.connect).toHaveBeenCalledWith(mockTransport);
      expect(typeof lastTransportOptions.sessionIdGenerator).toBe('function');
      expect(typeof lastTransportOptions.onsessioninitialized).toBe('function');
      expect(mockTransport.handleRequest).toHaveBeenCalledWith(req, res, req.body);

      // Drive the SDK's onsessioninitialized callback so the session is registered in our map
      mockTransport.triggerSessionInit();
      expect((app as any).httpSessions.size).toBe(1);
      expect((app as any).httpSessions.has(mockTransport.sessionId)).toBe(true);
    });

    it('routes a request with a known Mcp-Session-Id to the existing transport', async () => {
      const { app, handler } = getHandler();

      // First: initialize to set up a session
      await handler(
        makeReq({
          body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'c', version: '1' } } },
        }),
        makeRes()
      );
      mockTransport.triggerSessionInit();
      const firstTransport = mockTransport;
      const sessionId = firstTransport.sessionId;

      // Second: a follow-up call carrying the session ID
      const req2 = makeReq({
        method: 'POST',
        headers: { 'mcp-session-id': sessionId },
        body: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      });
      const res2 = makeRes();
      await handler(req2, res2);

      expect(MockedStreamableHTTPServerTransport).toHaveBeenCalledTimes(1); // no new transport created
      expect(mockServerFactory).toHaveBeenCalledTimes(1); // no new server created
      expect(firstTransport.handleRequest).toHaveBeenCalledWith(req2, res2, req2.body);
      expect((app as any).httpSessions.size).toBe(1);
    });

    it('rejects a non-Initialize POST without a session ID with 400', async () => {
      const { handler } = getHandler();
      const req = makeReq({
        body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      });
      const res = makeRes();

      await handler(req, res);

      expect(MockedStreamableHTTPServerTransport).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          error: expect.objectContaining({ code: -32600 }),
        })
      );
    });

    it('rejects a request with an unknown Mcp-Session-Id with 400', async () => {
      const { handler } = getHandler();
      const req = makeReq({
        headers: { 'mcp-session-id': 'unknown-session' },
        body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      });
      const res = makeRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ code: -32600 }) })
      );
    });

    it('removes the session from the map and stops its server when the transport closes', async () => {
      const { app, handler } = getHandler();
      await handler(
        makeReq({
          body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'c', version: '1' } } },
        }),
        makeRes()
      );
      mockTransport.triggerSessionInit();
      expect((app as any).httpSessions.size).toBe(1);

      mockTransport.triggerClose();
      // Allow async stop() to settle
      await new Promise((r) => setImmediate(r));

      expect((app as any).httpSessions.size).toBe(0);
      expect(mockServer.stop).toHaveBeenCalled();
    });

    it('logs and surfaces transport errors', async () => {
      const { handler } = getHandler();
      await handler(
        makeReq({
          body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'c', version: '1' } } },
        }),
        makeRes()
      );
      mockTransport.triggerSessionInit();

      const err = new Error('boom');
      mockTransport.triggerError(err);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(mockTransport.sessionId),
        err
      );
    });

    it('returns 500 when handleRequest throws and headers have not been sent', async () => {
      const { handler } = getHandler();
      // Make the very first transport's handleRequest reject
      MockedStreamableHTTPServerTransport.mockImplementationOnce((options: any) => {
        const t: any = {
          sessionId: 'will-fail',
          close: vi.fn(),
          handleRequest: vi.fn().mockRejectedValue(new Error('handler exploded')),
        };
        createdTransports.push(t);
        mockTransport = t;
        return t;
      });

      const req = makeReq({
        body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'c', version: '1' } } },
      });
      const res = makeRes();
      await handler(req, res);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('does not call res.status when headers have already been sent', async () => {
      const { handler } = getHandler();
      MockedStreamableHTTPServerTransport.mockImplementationOnce((options: any) => {
        const t: any = {
          sessionId: 'will-fail-2',
          close: vi.fn(),
          handleRequest: vi.fn().mockRejectedValue(new Error('mid-stream')),
        };
        return t;
      });

      const req = makeReq({
        body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'c', version: '1' } } },
      });
      const res = makeRes();
      res.headersSent = true;
      await handler(req, res);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('/health endpoint', () => {
    it('reports mode http and the active session count', async () => {
      const app = createHttpApp(
        { port: '3001' },
        { logger: mockLogger, serverFactory: mockServerFactory }
      );
      const healthCall = mockApp.get.mock.calls.find((c: any) => c[0] === '/health');
      const healthHandler = healthCall![1];

      const res = { json: vi.fn() };
      healthHandler({}, res);
      expect(res.json).toHaveBeenCalledWith({
        status: 'ok',
        mode: 'http',
        connections: 0,
        sessions: [],
        details: [],
      });

      // Add a session and re-check
      (app as any).httpSessions.set('s1', {
        transport: {},
        server: mockServer,
        lastActivity: Date.now(),
        openStreams: 1,
        hadStream: true,
      });
      healthHandler({}, res);
      expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({
        status: 'ok',
        mode: 'http',
        connections: 1,
        sessions: ['s1'],
      }));
    });

    it('names what each HTTP session holds, so an orphan is discoverable (issue #658)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(100_000);
      const app = createHttpApp(
        { port: '3001' },
        { logger: mockLogger, serverFactory: mockServerFactory }
      );
      const healthHandler = mockApp.get.mock.calls.find((c: any) => c[0] === '/health')![1];
      (mockServer as any).sessionManager.getAllSessions.mockReturnValue([
        { id: 'dbg-1', name: 'attached', language: 'javascript', state: 'paused', createdAt: new Date(), extra: 'omitted' },
      ]);
      (app as any).httpSessions.set('orphan', {
        transport: {},
        server: mockServer,
        lastActivity: 40_000,
        openStreams: 0,
        hadStream: true,
      });

      const res = { json: vi.fn() };
      healthHandler({}, res);
      expect(res.json.mock.calls[0][0].details).toEqual([
        {
          id: 'orphan',
          openStreams: 0,
          streamLost: true,
          idleMs: 60_000,
          debugSessions: [{ id: 'dbg-1', name: 'attached', language: 'javascript', state: 'paused' }],
        },
      ]);
    });
  });

  describe('stale session reaping (issue #337)', () => {
    // A client that crashes without DELETE leaves its session (and its live
    // DebugMcpServer + proxy chains) in httpSessions forever — invisible to
    // the reconnecting client, which gets a fresh server with an empty store.
    // The sweep closes sessions that are idle with no open SSE stream, which
    // cascades transport.onclose → server.stop() → closeAllSessions().
    const INIT_BODY = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'c', version: '1' } },
    };

    function makeStreamRes() {
      const res = new EventEmitter() as any;
      res.status = vi.fn().mockReturnThis();
      res.json = vi.fn();
      res.end = vi.fn();
      res.headersSent = false;
      return res;
    }

    function createAppAndHandler(staleMsEnv?: string) {
      if (staleMsEnv !== undefined) {
        fakeProc.env.MCP_HTTP_STALE_SESSION_MS = staleMsEnv;
      }
      const app = createHttpApp(
        { port: '3001' },
        { logger: mockLogger, serverFactory: mockServerFactory, proc: fakeProc }
      );
      const postCall = mockApp.post.mock.calls.find((c: any) => c[0] === '/mcp');
      return { app, handler: postCall![1] as (req: any, res: any) => Promise<void> };
    }

    async function initSession(handler: (req: any, res: any) => Promise<void>) {
      await handler({ method: 'POST', headers: {}, body: INIT_BODY }, makeStreamRes());
      mockTransport.triggerSessionInit();
      return mockTransport;
    }

    it('reaps an idle session with no open stream after the staleness window', async () => {
      vi.useFakeTimers();
      const { app, handler } = createAppAndHandler('5000');
      const transport = await initSession(handler);
      expect((app as any).httpSessions.size).toBe(1);

      await vi.advanceTimersByTimeAsync(61_000);

      expect(transport.close).toHaveBeenCalled();
      // The SDK fires onclose from close(); simulate it and confirm the
      // existing cleanup path runs: server stopped, session forgotten.
      transport.triggerClose();
      expect(mockServer.stop).toHaveBeenCalled();
      expect((app as any).httpSessions.size).toBe(0);
    });

    it('never reaps a session holding an open stream; reaps after the stream closes and goes idle', async () => {
      vi.useFakeTimers();
      const { handler } = createAppAndHandler('5000');
      const transport = await initSession(handler);

      const streamRes = makeStreamRes();
      await handler(
        { method: 'GET', headers: { 'mcp-session-id': transport.sessionId }, body: undefined },
        streamRes
      );

      await vi.advanceTimersByTimeAsync(300_000);
      expect(transport.close).not.toHaveBeenCalled();

      // Client crash: the socket closes without a DELETE.
      streamRes.emit('close');
      await vi.advanceTimersByTimeAsync(61_000);

      expect(transport.close).toHaveBeenCalled();
    });

    it('request activity resets the idle window', async () => {
      vi.useFakeTimers();
      const { handler } = createAppAndHandler('90000');
      const transport = await initSession(handler);

      await vi.advanceTimersByTimeAsync(59_000);
      await handler(
        { method: 'POST', headers: { 'mcp-session-id': transport.sessionId }, body: { jsonrpc: '2.0', id: 2, method: 'tools/list' } },
        makeStreamRes()
      );

      // Sweep ticks at 60s and 120s see idle 1s and 61s — both under 90s.
      await vi.advanceTimersByTimeAsync(61_000);
      expect(transport.close).not.toHaveBeenCalled();

      // Tick at 180s sees idle 121s — over the window.
      await vi.advanceTimersByTimeAsync(60_000);
      expect(transport.close).toHaveBeenCalled();
    });

    it('MCP_HTTP_STALE_SESSION_MS=0 disables reaping', async () => {
      vi.useFakeTimers();
      const { handler } = createAppAndHandler('0');
      const transport = await initSession(handler);

      await vi.advanceTimersByTimeAsync(3_600_000);

      expect(transport.close).not.toHaveBeenCalled();
    });

    it('defaults to a 30-minute window', async () => {
      vi.useFakeTimers();
      const { handler } = createAppAndHandler();
      const transport = await initSession(handler);

      await vi.advanceTimersByTimeAsync(29 * 60_000);
      expect(transport.close).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(3 * 60_000);
      expect(transport.close).toHaveBeenCalled();
    });

    it('MCP_HTTP_STALE_SWEEP_INTERVAL_MS shortens the sweep cadence (issue #502)', async () => {
      vi.useFakeTimers();
      fakeProc.env.MCP_HTTP_STALE_SWEEP_INTERVAL_MS = '1000';
      const { handler } = createAppAndHandler('500');
      const transport = await initSession(handler);

      // Idle 500ms window, 1s sweep: the second tick must reap — no 60s wait.
      await vi.advanceTimersByTimeAsync(2_100);

      expect(transport.close).toHaveBeenCalled();
    });

    it('reaps a session whose SSE stream dropped and never returned after the short window (issue #658)', async () => {
      vi.useFakeTimers();
      const { handler } = createAppAndHandler();
      const transport = await initSession(handler);
      const streamRes = makeStreamRes();
      await handler(
        { method: 'GET', headers: { 'mcp-session-id': transport.sessionId }, body: undefined },
        streamRes
      );
      (mockServer as any).sessionManager.getAllSessions.mockReturnValue([
        { id: 'dbg-1', name: 'attached', language: 'javascript', state: 'paused', createdAt: new Date() },
      ]);

      // Client crash: the socket closes without a DELETE, and — unlike a
      // reconnecting SDK client or a load balancer cutting an idle stream —
      // no GET comes back.
      streamRes.emit('close');

      // Sweeps at 60s and 120s see idle 60s/120s — not over the 2-minute window.
      await vi.advanceTimersByTimeAsync(120_000);
      expect(transport.close).not.toHaveBeenCalled();

      // The 180s sweep sees idle 180s and reaps — not 30 minutes later.
      await vi.advanceTimersByTimeAsync(60_000);
      expect(transport.close).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/its SSE stream closed 180s ago .*MCP_HTTP_STREAM_LOST_SESSION_MS=120000.*holding debug session\(s\) dbg-1 \(javascript, paused\)/)
      );
    });

    it('a stream that comes back within the window keeps the session alive (issue #658)', async () => {
      vi.useFakeTimers();
      const { handler } = createAppAndHandler();
      const transport = await initSession(handler);
      const first = makeStreamRes();
      await handler({ method: 'GET', headers: { 'mcp-session-id': transport.sessionId }, body: undefined }, first);

      // A load balancer cuts the idle stream; the SDK client reconnects seconds later.
      first.emit('close');
      await vi.advanceTimersByTimeAsync(3_000);
      const second = makeStreamRes();
      await handler({ method: 'GET', headers: { 'mcp-session-id': transport.sessionId }, body: undefined }, second);

      await vi.advanceTimersByTimeAsync(20 * 60_000);
      expect(transport.close).not.toHaveBeenCalled();
    });

    it('request activity after a lost stream keeps the session alive (issue #658)', async () => {
      vi.useFakeTimers();
      const { handler } = createAppAndHandler();
      const transport = await initSession(handler);
      const streamRes = makeStreamRes();
      await handler({ method: 'GET', headers: { 'mcp-session-id': transport.sessionId }, body: undefined }, streamRes);
      streamRes.emit('close');

      // A client that gave up on its stream (SDK maxRetries exhausted during
      // a network blip) but still POSTs is alive: every request resets the window.
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(90_000);
        await handler(
          { method: 'POST', headers: { 'mcp-session-id': transport.sessionId }, body: { jsonrpc: '2.0', id: 2 + i, method: 'tools/list' } },
          makeStreamRes()
        );
      }
      expect(transport.close).not.toHaveBeenCalled();

      // Once it stops sending, the short window applies.
      await vi.advanceTimersByTimeAsync(180_000);
      expect(transport.close).toHaveBeenCalled();
    });

    it('a session that never held a stream keeps the long stale window (issue #658)', async () => {
      vi.useFakeTimers();
      const { handler } = createAppAndHandler();
      const transport = await initSession(handler);

      await vi.advanceTimersByTimeAsync(20 * 60_000);
      expect(transport.close).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(12 * 60_000);
      expect(transport.close).toHaveBeenCalled();
    });

    it('MCP_HTTP_STREAM_LOST_SESSION_MS=0 falls back to the stale window; the sweep still runs when only that path is on', async () => {
      vi.useFakeTimers();
      fakeProc.env.MCP_HTTP_STREAM_LOST_SESSION_MS = '0';
      const { handler } = createAppAndHandler('300000');
      const transport = await initSession(handler);
      const streamRes = makeStreamRes();
      await handler({ method: 'GET', headers: { 'mcp-session-id': transport.sessionId }, body: undefined }, streamRes);
      streamRes.emit('close');

      await vi.advanceTimersByTimeAsync(4 * 60_000);
      expect(transport.close).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2 * 60_000);
      expect(transport.close).toHaveBeenCalled();

      // And the inverse: the stale window off, the stream-lost path alone still sweeps.
      vi.clearAllMocks();
      fakeProc.env.MCP_HTTP_STREAM_LOST_SESSION_MS = '1000';
      const second = createAppAndHandler('0');
      const t2 = await initSession(second.handler);
      const s2 = makeStreamRes();
      await second.handler({ method: 'GET', headers: { 'mcp-session-id': t2.sessionId }, body: undefined }, s2);
      s2.emit('close');
      await vi.advanceTimersByTimeAsync(61_000);
      expect(t2.close).toHaveBeenCalled();
    });

    it('invalid MCP_HTTP_STREAM_LOST_SESSION_MS values warn and keep the 2-minute default', async () => {
      vi.useFakeTimers();
      for (const bad of ['-5', 'abc']) {
        vi.clearAllMocks();
        fakeProc.env.MCP_HTTP_STREAM_LOST_SESSION_MS = bad;
        const { handler } = createAppAndHandler();
        const transport = await initSession(handler);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Ignoring invalid MCP_HTTP_STREAM_LOST_SESSION_MS')
        );
        const streamRes = makeStreamRes();
        await handler({ method: 'GET', headers: { 'mcp-session-id': transport.sessionId }, body: undefined }, streamRes);
        streamRes.emit('close');
        await vi.advanceTimersByTimeAsync(120_000);
        expect(transport.close).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(transport.close).toHaveBeenCalled();
      }
    });

    it('invalid MCP_HTTP_STALE_SWEEP_INTERVAL_MS values warn and keep the 60s default', async () => {
      vi.useFakeTimers();
      for (const bad of ['0', '-5', 'abc']) {
        vi.clearAllMocks();
        fakeProc.env.MCP_HTTP_STALE_SWEEP_INTERVAL_MS = bad;
        const { handler } = createAppAndHandler('500');
        const transport = await initSession(handler);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Ignoring invalid MCP_HTTP_STALE_SWEEP_INTERVAL_MS')
        );

        // Sweep still ticks at the 60s default, not at the invalid value.
        await vi.advanceTimersByTimeAsync(59_000);
        expect(transport.close).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(2_000);
        expect(transport.close).toHaveBeenCalled();
      }
    });
  });

  describe('handleHttpCommand', () => {
    let mockHttpServer: any;

    beforeEach(() => {
      mockHttpServer = {
        close: vi.fn((cb?: Function) => cb && cb()),
        on: vi.fn(),
      };
    });

    it('starts the HTTP server on the parsed port and logs the endpoint URL', async () => {
      const listen = vi.fn((_port: number, cb: Function) => {
        cb();
        return mockHttpServer;
      });
      mockApp.listen = listen;

      await handleHttpCommand(
        { port: '4000', logLevel: 'debug' },
        { logger: mockLogger, serverFactory: mockServerFactory, exitProcess: mockExitProcess, proc: fakeProc }
      );

      expect(mockLogger.level).toBe('debug');
      expect(listen).toHaveBeenCalledWith(4000, expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:4000/mcp')
      );
      expect(mockExitProcess).not.toHaveBeenCalled();
      expect(fakeProc.listenerCount('SIGINT')).toBe(1);
      expect(fakeProc.listenerCount('SIGTERM')).toBe(1);
    });

    it('wires --log-file into the CLI logger without failing on non-winston loggers (issue #502)', async () => {
      const listen = vi.fn((_port: number, cb: Function) => {
        cb();
        return mockHttpServer;
      });
      mockApp.listen = listen;

      // The mock logger has no winston transports — attachSharedFileTransport
      // must swallow that (best-effort) and startup must proceed normally.
      await handleHttpCommand(
        { port: '4001', logLevel: 'debug', logFile: path.join(os.tmpdir(), 'http-cmd-502-test.log') },
        { logger: mockLogger, serverFactory: mockServerFactory, exitProcess: mockExitProcess, proc: fakeProc }
      );

      expect(listen).toHaveBeenCalledWith(4001, expect.any(Function));
      expect(mockExitProcess).not.toHaveBeenCalled();
    });

    it('exits with code 1 when the app cannot be created', async () => {
      const error = new Error('boom');
      mockedCreateMcpExpressApp.mockImplementationOnce(() => {
        throw error;
      });

      await handleHttpCommand(
        { port: '3001' },
        { logger: mockLogger, serverFactory: mockServerFactory, exitProcess: mockExitProcess }
      );

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to start server in HTTP mode', { error });
      expect(mockExitProcess).toHaveBeenCalledWith(1);
    });

    it('handles SIGINT by closing all transports, stopping all servers, then exiting', async () => {
      const listen = vi.fn((_port: number, cb: Function) => {
        cb();
        return mockHttpServer;
      });
      mockApp.listen = listen;

      await handleHttpCommand(
        { port: '3001' },
        { logger: mockLogger, serverFactory: mockServerFactory, exitProcess: mockExitProcess, proc: fakeProc }
      );

      // gracefulShutdown is async — grab the registered listener so it can be awaited
      const sigintHandler = fakeProc.lastListener('SIGINT');

      // Inject mock sessions
      const t1 = { close: vi.fn() };
      const t2 = { close: vi.fn() };
      const s1 = { stop: vi.fn().mockResolvedValue(undefined) };
      const s2 = { stop: vi.fn().mockResolvedValue(undefined) };
      const sessions = (mockApp as any).httpSessions as Map<string, any>;
      sessions.set('a', { transport: t1, server: s1 });
      sessions.set('b', { transport: t2, server: s2 });

      await sigintHandler();

      expect(t1.close).toHaveBeenCalled();
      expect(t2.close).toHaveBeenCalled();
      expect(s1.stop).toHaveBeenCalled();
      expect(s2.stop).toHaveBeenCalled();
      expect(mockHttpServer.close).toHaveBeenCalled();
      expect(mockExitProcess).toHaveBeenCalledWith(0);
    });

    it('proceeds past a hung session stop after the guard and still exits 0 (issue #337)', async () => {
      const listen = vi.fn((_port: number, cb: Function) => {
        cb();
        return mockHttpServer;
      });
      mockApp.listen = listen;

      await handleHttpCommand(
        { port: '3001' },
        { logger: mockLogger, serverFactory: mockServerFactory, exitProcess: mockExitProcess, proc: fakeProc }
      );

      const sigintHandler = fakeProc.lastListener('SIGINT');
      const sessions = (mockApp as any).httpSessions as Map<string, any>;
      // A wedged proxy makes stop() hang — shutdown must not hang with it.
      sessions.set('wedged', {
        transport: { close: vi.fn() },
        server: { stop: vi.fn().mockReturnValue(new Promise(() => {})) }
      });

      vi.useFakeTimers();
      const shutdownPromise = sigintHandler();
      await vi.advanceTimersByTimeAsync(10_000);
      await shutdownPromise;

      expect(mockHttpServer.close).toHaveBeenCalled();
      expect(mockExitProcess).toHaveBeenCalledWith(0);
    });

    it('hard-exits 1 when even the HTTP listener refuses to close (issue #337)', async () => {
      // server.close() waits on open sockets — a stuck keep-alive connection
      // must not park the process forever once shutdown has begun.
      mockHttpServer.close = vi.fn();
      const listen = vi.fn((_port: number, cb: Function) => {
        cb();
        return mockHttpServer;
      });
      mockApp.listen = listen;

      await handleHttpCommand(
        { port: '3001' },
        { logger: mockLogger, serverFactory: mockServerFactory, exitProcess: mockExitProcess, proc: fakeProc }
      );

      const sigintHandler = fakeProc.lastListener('SIGINT');

      vi.useFakeTimers();
      const shutdownPromise = sigintHandler();
      await vi.advanceTimersByTimeAsync(15_000);
      await shutdownPromise;

      expect(mockExitProcess).toHaveBeenCalledWith(1);
    });

    describe('stdin watchdog (MCP_EXIT_ON_STDIN_CLOSE, issue #122)', () => {
      function makeFakeStdin() {
        const stdin = new EventEmitter() as unknown as NodeJS.ReadStream & {
          resume: ReturnType<typeof vi.fn>;
          emit: (event: string, ...args: unknown[]) => boolean;
        };
        (stdin as unknown as { resume: unknown }).resume = vi.fn();
        return stdin;
      }

      beforeEach(() => {
        mockApp.listen = vi.fn((_port: number, cb: Function) => {
          cb();
          return mockHttpServer;
        });
      });

      it('shuts down gracefully and exits 0 when stdin ends and the env gate is set', async () => {
        fakeProc.env.MCP_EXIT_ON_STDIN_CLOSE = '1';
        const stdin = makeFakeStdin();

        await handleHttpCommand(
          { port: '3001' },
          { logger: mockLogger, serverFactory: mockServerFactory, exitProcess: mockExitProcess, stdin, proc: fakeProc }
        );

        // The watchdog must resume stdin so EOF is actually observed
        expect(stdin.resume).toHaveBeenCalled();

        // Inject an active session to prove graceful shutdown ran
        const t1 = { close: vi.fn() };
        const s1 = { stop: vi.fn().mockResolvedValue(undefined) };
        ((mockApp as any).httpSessions as Map<string, any>).set('a', { transport: t1, server: s1 });

        stdin.emit('end');

        await vi.waitFor(() => expect(mockExitProcess).toHaveBeenCalledWith(0));
        expect(t1.close).toHaveBeenCalled();
        expect(s1.stop).toHaveBeenCalled();
        expect(mockHttpServer.close).toHaveBeenCalled();
      });

      it('shuts down only once when end and close both fire', async () => {
        fakeProc.env.MCP_EXIT_ON_STDIN_CLOSE = '1';
        const stdin = makeFakeStdin();

        await handleHttpCommand(
          { port: '3001' },
          { logger: mockLogger, serverFactory: mockServerFactory, exitProcess: mockExitProcess, stdin, proc: fakeProc }
        );

        stdin.emit('end');
        stdin.emit('close');

        await vi.waitFor(() => expect(mockExitProcess).toHaveBeenCalled());
        expect(mockExitProcess).toHaveBeenCalledTimes(1);
        expect(mockHttpServer.close).toHaveBeenCalledTimes(1);
      });

      it('does not watch stdin when the env gate is unset', async () => {
        const stdin = makeFakeStdin();

        await handleHttpCommand(
          { port: '3001' },
          { logger: mockLogger, serverFactory: mockServerFactory, exitProcess: mockExitProcess, stdin, proc: fakeProc }
        );

        expect(stdin.resume).not.toHaveBeenCalled();
        stdin.emit('end');
        await new Promise((r) => setTimeout(r, 10));

        expect(mockExitProcess).not.toHaveBeenCalled();
        expect(mockHttpServer.close).not.toHaveBeenCalled();
      });
    });

    it('logs EADDRINUSE specifically and exits 1', async () => {
      let errorHandler: Function = () => {};
      const listen = vi.fn((_port: number, cb: Function) => {
        cb();
        return mockHttpServer;
      });
      mockApp.listen = listen;
      mockHttpServer.on = vi.fn((event: string, handler: Function) => {
        if (event === 'error') errorHandler = handler;
      });

      await handleHttpCommand(
        { port: '3001' },
        { logger: mockLogger, serverFactory: mockServerFactory, exitProcess: mockExitProcess, proc: fakeProc }
      );

      const err = Object.assign(new Error('addr in use'), { code: 'EADDRINUSE' });
      errorHandler(err);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('already in use')
      );
      expect(mockExitProcess).toHaveBeenCalledWith(1);
    });
  });
});
