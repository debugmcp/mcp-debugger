import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import express from 'express';
import { createSSEApp, handleSSECommand } from '../../../src/cli/sse-command.js';
import type { Logger as WinstonLoggerType } from 'winston';
import { DebugMcpServer } from '../../../src/server.js';
import { EventEmitter } from 'events';

// Mock modules
vi.mock('../../../src/server.js');
vi.mock('@modelcontextprotocol/sdk/server/sse.js');
vi.mock('express');

// Import mocked module
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
const MockedSSEServerTransport = vi.mocked(SSEServerTransport);

describe('SSE Command Handler', () => {
  let mockLogger: WinstonLoggerType;
  let mockServerFactory: ReturnType<typeof vi.fn>;
  let mockExitProcess: ReturnType<typeof vi.fn>;
  let mockServer: DebugMcpServer;
  let mockTransport: any;
  let originalProcessOn: typeof process.on;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      level: 'info'
    } as any;

    // Create mock server
    mockServer = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      server: {
        connect: vi.fn().mockResolvedValue(undefined)
      }
    } as any;

    // Create mock server factory
    mockServerFactory = vi.fn().mockReturnValue(mockServer);

    // Create mock exit function
    mockExitProcess = vi.fn();

    // Store original process.on
    originalProcessOn = process.on;

    // Setup mock transport
    MockedSSEServerTransport.mockImplementation((path: string, res: any) => {
      mockTransport = {
        sessionId: 'test-session-' + Math.random().toString(36).substring(7),
        close: vi.fn(),
        onclose: null,
        onerror: null,
        handlePostMessage: vi.fn().mockResolvedValue(undefined),
        // Add helper methods for testing
        triggerClose: function() { 
          if (this.onclose) this.onclose(); 
        },
        triggerError: function(err: Error) { 
          if (this.onerror) this.onerror(err); 
        }
      };
      
      return mockTransport;
    });
  });

  afterEach(() => {
    // Restore original process.on
    process.on = originalProcessOn;
    // Clear all timers
    vi.clearAllTimers();
    vi.useRealTimers();
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('createSSEApp', () => {
    let mockApp: any;

    beforeEach(() => {
      // Create a minimal Express app mock
      mockApp = {
        use: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        listen: vi.fn(),
        sseTransports: undefined
      };
      
      vi.mocked(express).mockReturnValue(mockApp);
    });

    it('should create an Express app with correct middleware', () => {
      const options = { port: '3001', logLevel: 'info' };
      const app = createSSEApp(options, { logger: mockLogger, serverFactory: mockServerFactory });

      expect(app).toBeDefined();
      expect(app.get).toBeDefined();
      expect(app.post).toBeDefined();
      expect(app.listen).toBeDefined();
    });

    it('should set up CORS middleware', () => {
      const options = { port: '3001', logLevel: 'info' };
      createSSEApp(options, { logger: mockLogger, serverFactory: mockServerFactory });

      // Verify middleware was set up
      expect(mockApp.use).toHaveBeenCalled();
      
      // Get the middleware function
      const corsMiddleware = mockApp.use.mock.calls[0][0];
      const mockReq = { method: 'OPTIONS' };
      const mockRes = {
        header: vi.fn(),
        sendStatus: vi.fn()
      };
      const mockNext = vi.fn();

      // Test OPTIONS request
      corsMiddleware(mockReq, mockRes, mockNext);
      expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      expect(mockRes.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');
      expect(mockRes.sendStatus).toHaveBeenCalledWith(200);
      expect(mockNext).not.toHaveBeenCalled();

      // Test non-OPTIONS request
      mockReq.method = 'GET';
      corsMiddleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set up SSE and health check routes', () => {
      const options = { port: '3001', logLevel: 'info' };
      createSSEApp(options, { logger: mockLogger, serverFactory: mockServerFactory });

      // Verify routes were set up
      expect(mockApp.get).toHaveBeenCalledWith('/sse', expect.any(Function));
      expect(mockApp.post).toHaveBeenCalledWith('/sse', expect.any(Function));
      expect(mockApp.get).toHaveBeenCalledWith('/health', expect.any(Function));
    });

    it('should expose sseTransports map', () => {
      const options = { port: '3001', logLevel: 'info' };
      const app = createSSEApp(options, { logger: mockLogger, serverFactory: mockServerFactory });

      expect((app as any).sseTransports).toBeInstanceOf(Map);
    });
  });

  describe('GET /sse route handler', () => {
    let getHandler: Function;
    let mockReq: any;
    let mockRes: any;
    let app: any;

    beforeEach(() => {
      const mockApp = {
        use: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        listen: vi.fn()
      };
      
      vi.mocked(express).mockReturnValue(mockApp as any);
      
      const options = { port: '3001', logLevel: 'info' };
      app = createSSEApp(options, { logger: mockLogger, serverFactory: mockServerFactory });
      
      // Extract the GET /sse handler
      const getCall = mockApp.get.mock.calls.find(call => call[0] === '/sse');
      getHandler = getCall ? getCall[1] : undefined;
      
      // Create comprehensive mocks with EventEmitter
      mockReq = Object.assign(new EventEmitter(), {
        headers: {},
        query: {}
      });
      
      mockRes = {
        write: vi.fn(),
        status: vi.fn().mockReturnThis(),
        end: vi.fn(),
        headersSent: false
      };
    });

    it('should establish SSE connection successfully', async () => {
      vi.useFakeTimers();
      
      expect(getHandler).toBeDefined();
      await getHandler(mockReq, mockRes);

      // Verify server factory was called
      expect(mockServerFactory).toHaveBeenCalledWith({
        logLevel: 'info',
        logFile: undefined
      });

      // Verify transport was created
      expect(MockedSSEServerTransport).toHaveBeenCalledWith('/sse', mockRes);

      // Verify server connection
      expect(mockServer.server.connect).toHaveBeenCalledWith(mockTransport);

      // Verify session was stored
      expect((app as any).sseTransports.size).toBe(1);
      expect((app as any).sseTransports.has(mockTransport.sessionId)).toBe(true);

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(`SSE connection established: ${mockTransport.sessionId}`);

      // Verify ping interval is set up
      vi.advanceTimersByTime(30000);
      expect(mockRes.write).toHaveBeenCalledWith(':ping\n\n');

      vi.useRealTimers();
    });

    it('should handle server factory errors', async () => {
      const error = new Error('Server factory failed');
      mockServerFactory.mockImplementation(() => {
        throw error;
      });

      await getHandler(mockReq, mockRes);

      expect(mockLogger.error).toHaveBeenCalledWith('Error establishing SSE connection:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle server connection errors', async () => {
      const error = new Error('Connection failed');
      (mockServer.server.connect as Mock).mockRejectedValue(error);

      await getHandler(mockReq, mockRes);

      expect(mockLogger.error).toHaveBeenCalledWith('Error establishing SSE connection:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle connection close event', async () => {
      await getHandler(mockReq, mockRes);
      
      const sessionId = mockTransport.sessionId;
      expect((app as any).sseTransports.size).toBe(1);

      // Trigger close through transport
      mockTransport.triggerClose();

      // Allow setImmediate to run
      await new Promise(resolve => setImmediate(resolve));

      expect(mockLogger.info).toHaveBeenCalledWith(`SSE connection closed: ${sessionId}`);
      expect((app as any).sseTransports.size).toBe(0);
      expect(mockServer.stop).toHaveBeenCalled();
    });

    it('should handle client disconnect event', async () => {
      await getHandler(mockReq, mockRes);
      
      const sessionId = mockTransport.sessionId;
      const initialListenerCount = mockReq.listenerCount('close');
      
      expect((app as any).sseTransports.size).toBe(1);

      // Trigger client disconnect
      mockReq.emit('close');

      // Allow setImmediate to run
      await new Promise(resolve => setImmediate(resolve));

      expect(mockLogger.info).toHaveBeenCalledWith(`SSE connection closed: ${sessionId}`);
      expect((app as any).sseTransports.size).toBe(0);
      expect(mockServer.stop).toHaveBeenCalled();
      
      // Verify no memory leaks
      expect(mockReq.listenerCount('close')).toBeLessThanOrEqual(initialListenerCount);
    });

    it('should prevent recursive close', async () => {
      await getHandler(mockReq, mockRes);
      
      const sessionId = mockTransport.sessionId;

      // Trigger close multiple times
      mockTransport.triggerClose();
      mockTransport.triggerClose();
      mockReq.emit('close');
      mockReq.emit('end');

      // Allow setImmediate to run
      await new Promise(resolve => setImmediate(resolve));

      // Should only log once
      expect(mockLogger.info).toHaveBeenCalledWith(`SSE connection closed: ${sessionId}`);
      expect(mockLogger.info).toHaveBeenCalledTimes(2); // Once for establish, once for close
      
      // Should only stop server once
      expect(mockServer.stop).toHaveBeenCalledTimes(1);
    });

    it('should handle server stop error during close', async () => {
      await getHandler(mockReq, mockRes);
      
      const sessionId = mockTransport.sessionId;
      const stopError = new Error('Server stop failed');
      
      // Make stop reject with an error
      (mockServer.stop as Mock).mockRejectedValueOnce(stopError);

      // Trigger close
      mockTransport.triggerClose();

      // Allow setImmediate to run
      await new Promise(resolve => setImmediate(resolve));

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error stopping server for session ${sessionId}:`,
        stopError
      );
    });

    it('should handle transport errors', async () => {
      await getHandler(mockReq, mockRes);
      
      const error = new Error('Transport error');
      mockTransport.triggerError(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        `SSE transport error for session ${mockTransport.sessionId}:`,
        error
      );
    });

    it('should not send status when headers are already sent', async () => {
      mockRes.headersSent = true;
      const error = new Error('Connection failed');
      mockServerFactory.mockImplementation(() => {
        throw error;
      });

      await getHandler(mockReq, mockRes);

      expect(mockLogger.error).toHaveBeenCalledWith('Error establishing SSE connection:', error);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.end).not.toHaveBeenCalled();
    });

    it('should handle multiple concurrent connections', async () => {
      const sessions: string[] = [];
      
      // Create multiple connections
      for (let i = 0; i < 3; i++) {
        await getHandler(mockReq, mockRes);
        sessions.push(mockTransport.sessionId);
      }
      
      expect((app as any).sseTransports.size).toBe(3);
      
      // Close one connection
      const sseTransports = (app as any).sseTransports as Map<string, any>;
      const firstSession = sseTransports.get(sessions[0]);
      if (firstSession && firstSession.transport && firstSession.transport.onclose) {
        // Directly invoke the onclose handler
        const closeHandler = firstSession.transport.onclose;
        closeHandler();
      }
      
      // Allow setImmediate to run
      await new Promise(resolve => setImmediate(resolve));
      
      // Verify only one was removed
      expect((app as any).sseTransports.size).toBe(2);
      expect((app as any).sseTransports.has(sessions[0])).toBe(false);
      expect((app as any).sseTransports.has(sessions[1])).toBe(true);
      expect((app as any).sseTransports.has(sessions[2])).toBe(true);
    });

    it('should stop ping interval when session is removed', async () => {
      vi.useFakeTimers();
      
      await getHandler(mockReq, mockRes);
      
      // Remove session from map
      (app as any).sseTransports.clear();
      
      // Advance time
      vi.advanceTimersByTime(30000);
      
      // Should not write ping since session is gone
      expect(mockRes.write).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('POST /sse route handler', () => {
    let postHandler: Function;
    let mockReq: any;
    let mockRes: any;
    let app: any;

    beforeEach(() => {
      const mockApp = {
        use: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        listen: vi.fn()
      };
      
      vi.mocked(express).mockReturnValue(mockApp as any);
      
      const options = { port: '3001', logLevel: 'info' };
      app = createSSEApp(options, { logger: mockLogger, serverFactory: mockServerFactory });
      
      // Extract the POST /sse handler
      const postCall = mockApp.post.mock.calls.find(call => call[0] === '/sse');
      postHandler = postCall ? postCall[1] : undefined;
      
      // Create mock request/response
      mockReq = {
        headers: {},
        query: {}
      };
      
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
    });

    it('should handle POST request with valid session ID', async () => {
      expect(postHandler).toBeDefined();
      
      // First establish a connection by adding to the sseTransports map
      const sessionId = 'test-session-valid';
      (app as any).sseTransports.set(sessionId, {
        transport: mockTransport,
        server: mockServer
      });
      
      mockReq.query.sessionId = sessionId;

      await postHandler(mockReq, mockRes);

      expect(mockTransport.handlePostMessage).toHaveBeenCalledWith(mockReq, mockRes);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should reject POST request with invalid session ID', async () => {
      mockReq.query.sessionId = 'invalid-session';

      await postHandler(mockReq, mockRes);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid session ID: invalid-session',
        expect.objectContaining({
          headers: mockReq.headers,
          query: mockReq.query,
          hasSessionId: true,
          knownSessions: []
        })
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid session ID'
        },
        id: null
      });
    });

    it('should reject POST request with missing session ID', async () => {
      await postHandler(mockReq, mockRes);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid session ID: undefined',
        expect.objectContaining({
          hasSessionId: false
        })
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle transport.handlePostMessage errors', async () => {
      // Establish a connection by adding to the sseTransports map
      const sessionId = 'test-session-error';
      const errorTransport = {
        ...mockTransport,
        handlePostMessage: vi.fn().mockRejectedValue(new Error('Message handling failed'))
      };
      (app as any).sseTransports.set(sessionId, {
        transport: errorTransport,
        server: mockServer
      });
      
      mockReq.query.sessionId = sessionId;
      
      await postHandler(mockReq, mockRes);

      expect(mockLogger.error).toHaveBeenCalledWith('Error handling SSE POST request', { 
        error: expect.any(Error) 
      });
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: 'Message handling failed'
        },
        id: null
      });
    });

    it('should handle non-Error objects in catch block', async () => {
      // Establish a connection by adding to the sseTransports map
      const sessionId = 'test-session-string-error';
      const errorTransport = {
        ...mockTransport,
        handlePostMessage: vi.fn().mockRejectedValue('String error')
      };
      (app as any).sseTransports.set(sessionId, {
        transport: errorTransport,
        server: mockServer
      });
      
      mockReq.query.sessionId = sessionId;
      
      await postHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: 'Unknown error'
        },
        id: null
      });
    });
  });

  describe('Health check endpoint', () => {
    let healthHandler: Function;
    let mockReq: any;
    let mockRes: any;
    let app: any;

    beforeEach(() => {
      const mockApp = {
        use: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        listen: vi.fn()
      };
      
      vi.mocked(express).mockReturnValue(mockApp as any);
      
      const options = { port: '3001', logLevel: 'info' };
      app = createSSEApp(options, { logger: mockLogger, serverFactory: mockServerFactory });
      
      // Extract the health check handler
      const healthCall = mockApp.get.mock.calls.find(call => call[0] === '/health');
      healthHandler = healthCall ? healthCall[1] : undefined;
      
      mockReq = {};
      mockRes = {
        json: vi.fn()
      };
    });

    it('should return health status with no connections', () => {
      expect(healthHandler).toBeDefined();
      healthHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'ok',
        mode: 'sse',
        connections: 0,
        sessions: []
      });
    });

    it('should return health status with active connections', async () => {
      // Establish some connections by adding them directly to the sseTransports map
      const sessions = ['session1', 'session2'];
      
      sessions.forEach(sessionId => {
        (app as any).sseTransports.set(sessionId, {
          transport: mockTransport,
          server: mockServer
        });
      });

      healthHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'ok',
        mode: 'sse',
        connections: 2,
        sessions: expect.arrayContaining(sessions)
      });
    });
  });

  describe('handleSSECommand', () => {
    let mockServer: any;

    beforeEach(() => {
      mockServer = {
        close: vi.fn()
      };
    });

    it('should start server successfully in SSE mode', async () => {
      const options = {
        port: '4000',
        logLevel: 'debug',
        logFile: '/tmp/test.log'
      };

      const mockListen = vi.fn((port, callback) => {
        callback();
        return mockServer;
      });

      // Mock express app
      vi.mocked(express).mockReturnValue({
        use: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        listen: mockListen,
        sseTransports: new Map()
      } as any);

      // Mock process.on to prevent actual signal handlers
      process.on = vi.fn() as any;

      await handleSSECommand(options, {
        logger: mockLogger,
        serverFactory: mockServerFactory,
        exitProcess: mockExitProcess
      });

      // Verify log level was set
      expect(mockLogger.level).toBe('debug');

      // Verify info logs
      expect(mockLogger.info).toHaveBeenCalledWith('Starting Debug MCP Server in SSE mode on port 4000');
      expect(mockLogger.info).toHaveBeenCalledWith('Debug MCP Server (SSE) listening on port 4000');
      expect(mockLogger.info).toHaveBeenCalledWith('SSE endpoint available at http://localhost:4000/sse');

      // Verify server listen was called
      expect(mockListen).toHaveBeenCalledWith(4000, expect.any(Function));

      // Verify SIGINT handler was registered
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));

      // Verify process did not exit
      expect(mockExitProcess).not.toHaveBeenCalled();
    });

    it('should handle server start failure', async () => {
      const options = { port: '3001' };
      const error = new Error('Server start failed');

      // Mock express to throw error
      vi.mocked(express).mockImplementation(() => {
        throw error;
      });

      await handleSSECommand(options, {
        logger: mockLogger,
        serverFactory: mockServerFactory,
        exitProcess: mockExitProcess
      });

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to start server in SSE mode', { error });

      // Verify process exited with code 1
      expect(mockExitProcess).toHaveBeenCalledWith(1);
    });

    it('should parse port as integer', async () => {
      const options = {
        port: '3001',
        logLevel: 'info'
      };

      const mockListen = vi.fn((port, callback) => {
        callback();
        return mockServer;
      });

      // Mock express app
      vi.mocked(express).mockReturnValue({
        use: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        listen: mockListen,
        sseTransports: new Map()
      } as any);

      // Mock process.on
      process.on = vi.fn() as any;

      await handleSSECommand(options, {
        logger: mockLogger,
        serverFactory: mockServerFactory,
        exitProcess: mockExitProcess
      });

      // Verify listen was called with integer port
      expect(mockListen).toHaveBeenCalledWith(3001, expect.any(Function));
    });

    it('should handle SIGINT for graceful shutdown', async () => {
      const options = { port: '3001' };
      let sigintHandler: Function = () => {};

      // Create mock app with sseTransports
      const mockApp = {
        use: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        listen: vi.fn((port: number, callback: Function) => {
          callback();
          return mockServer;
        }),
        sseTransports: new Map()
      };

      vi.mocked(express).mockReturnValue(mockApp as any);

      // Capture SIGINT handler
      process.on = vi.fn((event, handler) => {
        if (event === 'SIGINT') {
          sigintHandler = handler as Function;
        }
      }) as any;

      await handleSSECommand(options, {
        logger: mockLogger,
        serverFactory: mockServerFactory,
        exitProcess: mockExitProcess
      });

      // Add some mock sessions
      const mockSession1 = {
        transport: { close: vi.fn() },
        server: { stop: vi.fn() }
      };
      const mockSession2 = {
        transport: { close: vi.fn() },
        server: { stop: vi.fn() }
      };
      
      mockApp.sseTransports.set('session1', mockSession1 as any);
      mockApp.sseTransports.set('session2', mockSession2 as any);

      // Mock server.close to call callback immediately
      mockServer.close.mockImplementation((callback: Function) => {
        callback();
      });

      // Trigger SIGINT
      sigintHandler();

      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down SSE server...');
      expect(mockSession1.transport.close).toHaveBeenCalled();
      expect(mockSession1.server.stop).toHaveBeenCalled();
      expect(mockSession2.transport.close).toHaveBeenCalled();
      expect(mockSession2.server.stop).toHaveBeenCalled();
      expect(mockServer.close).toHaveBeenCalled();
      expect(mockExitProcess).toHaveBeenCalledWith(0);
    });

    it('should use process.exit by default if exitProcess is not provided', async () => {
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const error = new Error('Server start failed');
      
      // Mock express to throw error
      vi.mocked(express).mockImplementation(() => {
        throw error;
      });

      await handleSSECommand({ port: '3001' }, {
        logger: mockLogger,
        serverFactory: mockServerFactory
      });

      // Verify process.exit was called
      expect(processExitSpy).toHaveBeenCalledWith(1);

      processExitSpy.mockRestore();
    });

    it('should not change log level if not provided', async () => {
      const options = { port: '3001' };
      mockLogger.level = 'warn';

      const mockListen = vi.fn((port, callback) => {
        callback();
        return mockServer;
      });

      vi.mocked(express).mockReturnValue({
        use: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        listen: mockListen,
        sseTransports: new Map()
      } as any);

      process.on = vi.fn() as any;

      await handleSSECommand(options, {
        logger: mockLogger,
        serverFactory: mockServerFactory,
        exitProcess: mockExitProcess
      });

      // Verify log level was not changed
      expect(mockLogger.level).toBe('warn');
    });
  });

  describe('Server factory options', () => {
    it('should pass correct options to server factory', async () => {
      const mockApp = {
        use: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        listen: vi.fn()
      };
      
      vi.mocked(express).mockReturnValue(mockApp as any);
      
      const options = { 
        port: '3001', 
        logLevel: 'debug',
        logFile: '/var/log/debug.log'
      };
      
      const app = createSSEApp(options, { logger: mockLogger, serverFactory: mockServerFactory });
      
      // Get the handler and trigger it
      const getCall = mockApp.get.mock.calls.find(call => call[0] === '/sse');
      const getHandler = getCall ? getCall[1] : undefined;
      
      if (getHandler) {
        await getHandler(Object.assign(new EventEmitter(), { headers: {}, query: {} }), { write: vi.fn() });
        
        expect(mockServerFactory).toHaveBeenCalledWith({
          logLevel: 'debug',
          logFile: '/var/log/debug.log'
        });
      }
    });
  });

  describe('Transport event assignment', () => {
    it('should properly assign onclose and onerror handlers', async () => {
      const mockApp = {
        use: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        listen: vi.fn()
      };
      
      vi.mocked(express).mockReturnValue(mockApp as any);
      
      const app = createSSEApp({ port: '3001' }, { logger: mockLogger, serverFactory: mockServerFactory });
      
      const getCall = mockApp.get.mock.calls.find(call => call[0] === '/sse');
      const getHandler = getCall ? getCall[1] : undefined;
      
      if (getHandler) {
        await getHandler(Object.assign(new EventEmitter(), { headers: {}, query: {} }), { write: vi.fn() });
        
        expect(mockTransport.onclose).toBeDefined();
        expect(mockTransport.onerror).toBeDefined();
      }
    });
  });
});
