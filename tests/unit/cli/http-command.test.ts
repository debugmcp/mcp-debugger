import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { createHttpApp, handleHttpCommand } from '../../../src/cli/http-command.js';
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
  let mockServerFactory: ReturnType<typeof vi.fn>;
  let mockExitProcess: ReturnType<typeof vi.fn>;
  let mockServer: DebugMcpServer;
  let mockTransport: any;
  let originalProcessOn: typeof process.on;
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
    } as any;

    mockServerFactory = vi.fn().mockReturnValue(mockServer);
    mockExitProcess = vi.fn();
    originalProcessOn = process.on;

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
    process.on = originalProcessOn;
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
      });

      // Add a session and re-check
      (app as any).httpSessions.set('s1', { transport: {}, server: {} });
      healthHandler({}, res);
      expect(res.json).toHaveBeenLastCalledWith({
        status: 'ok',
        mode: 'http',
        connections: 1,
        sessions: ['s1'],
      });
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

      process.on = vi.fn() as any;

      await handleHttpCommand(
        { port: '4000', logLevel: 'debug' },
        { logger: mockLogger, serverFactory: mockServerFactory, exitProcess: mockExitProcess }
      );

      expect(mockLogger.level).toBe('debug');
      expect(listen).toHaveBeenCalledWith(4000, expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:4000/mcp')
      );
      expect(mockExitProcess).not.toHaveBeenCalled();
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
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
      let sigintHandler: Function = () => {};
      const listen = vi.fn((_port: number, cb: Function) => {
        cb();
        return mockHttpServer;
      });
      mockApp.listen = listen;

      process.on = vi.fn((event: string, handler: Function) => {
        if (event === 'SIGINT') sigintHandler = handler;
      }) as any;

      await handleHttpCommand(
        { port: '3001' },
        { logger: mockLogger, serverFactory: mockServerFactory, exitProcess: mockExitProcess }
      );

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
      process.on = vi.fn() as any;

      await handleHttpCommand(
        { port: '3001' },
        { logger: mockLogger, serverFactory: mockServerFactory, exitProcess: mockExitProcess }
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
