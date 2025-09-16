import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { DapConnectionManager } from '../../../src/proxy/dap-proxy-connection-manager.js';
import type { 
  IDapClient, 
  IDapClientFactory, 
  ILogger 
} from '../../../src/proxy/dap-proxy-interfaces.js';
import { DebugProtocol } from '@vscode/debugprotocol';

describe('DapConnectionManager', () => {
  let mockDapClient: {
    connect: MockInstance;
    disconnect: MockInstance;
    shutdown: MockInstance;
    sendRequest: MockInstance;
    on: MockInstance;
    off: MockInstance;
    once: MockInstance;
    removeAllListeners: MockInstance;
  };

  let mockDapClientFactory: IDapClientFactory;
  let mockLogger: ILogger;
  let connectionManager: DapConnectionManager;

  // Test helpers
  const waitForRetries = async (count: number) => {
    for (let i = 0; i < count; i++) {
      await vi.advanceTimersByTimeAsync(200); // CONNECT_RETRY_INTERVAL
      await Promise.resolve(); // Let promises settle
    }
  };

  const expectDisconnectCleanup = () => {
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[ConnectionManager] Client disconnected')
    );
  };

  const errorScenarios = [
    { error: new Error('ECONNREFUSED'), description: 'connection refused' },
    { error: new Error('ETIMEDOUT'), description: 'timeout' },
    { error: new Error('ENOTFOUND'), description: 'host not found' },
    { error: new Error('Unknown error'), description: 'unknown error' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockDapClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      shutdown: vi.fn().mockImplementation((reason?: string) => {
        // Mock implementation that mimics the real shutdown behavior
        // In a real implementation, this would reject pending requests
      }),
      sendRequest: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn()
    };

    mockDapClientFactory = {
      create: vi.fn().mockReturnValue(mockDapClient)
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    };

    connectionManager = new DapConnectionManager(mockDapClientFactory, mockLogger);
  });

  afterEach(() => {
    // Clear all pending timers before switching to real timers
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('connectWithRetry', () => {
    it('should connect successfully on first attempt', async () => {
      mockDapClient.connect.mockResolvedValue(undefined);

      const resultPromise = connectionManager.connectWithRetry('localhost', 5678);
      
      // Wait for initial delay
      await vi.advanceTimersByTimeAsync(500); // INITIAL_CONNECT_DELAY
      
      const result = await resultPromise;

      expect(mockDapClientFactory.create).toHaveBeenCalledWith('localhost', 5678);
      expect(mockDapClient.connect).toHaveBeenCalledTimes(1);
      expect(mockDapClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockDapClient.off).toHaveBeenCalledWith('error', expect.any(Function));
      expect(result).toBe(mockDapClient);
    });

    it('should retry on connection failure', async () => {
      mockDapClient.connect
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValue(undefined);

      const resultPromise = connectionManager.connectWithRetry('localhost', 5678);
      
      // Wait for initial delay
      await vi.advanceTimersByTimeAsync(500);
      
      // Wait for 2 retries
      await waitForRetries(2);
      
      const result = await resultPromise;

      expect(mockDapClient.connect).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockDapClient);
    });

    it('should fail after maximum retry attempts', async () => {
      mockDapClient.connect.mockRejectedValue(new Error('ECONNREFUSED'));

      // Create expectation immediately to attach rejection handler
      const expectation = expect(
        connectionManager.connectWithRetry('localhost', 5678)
      ).rejects.toThrow('Failed to connect DAP client: ECONNREFUSED');
      
      // Wait for initial delay
      await vi.advanceTimersByTimeAsync(500);
      
      // Wait for all 60 retries
      await waitForRetries(60);
      
      // Await the expectation
      await expectation;
      
      expect(mockDapClient.connect).toHaveBeenCalledTimes(60);
      expect(mockDapClient.off).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to connect DAP client after 60 attempts')
      );
    });

    it('should handle temporary error events during connection', async () => {
      let tempErrorHandler: ((error: Error) => void) | undefined;
      mockDapClient.on.mockImplementation((event: string, handler: (error: Error) => void) => {
        if (event === 'error') {
          tempErrorHandler = handler;
        }
      });

      mockDapClient.connect.mockResolvedValue(undefined);

      const resultPromise = connectionManager.connectWithRetry('localhost', 5678);
      
      // Wait for initial delay to ensure handler is set
      await vi.advanceTimersByTimeAsync(500);
      
      // Emit error during connection phase
      if (tempErrorHandler) {
        const testError = new Error('Connection error');
        tempErrorHandler(testError);
      }
      
      await resultPromise;

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[ConnectionManager] DAP client emitted \'error\' during connection phase (expected for retries): Connection error')
      );
    });

    it.each(errorScenarios)('should handle $description error', async ({ error }) => {
      mockDapClient.connect
        .mockRejectedValueOnce(error)
        .mockResolvedValue(undefined);

      const resultPromise = connectionManager.connectWithRetry('localhost', 5678);
      
      await vi.advanceTimersByTimeAsync(500);
      await waitForRetries(1);
      
      const result = await resultPromise;

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`DAP client connect attempt 1 failed: ${error.message}`)
      );
      expect(result).toBe(mockDapClient);
    });

    it('should test intermediate retry counts', async () => {
      let connectAttempts = 0;
      mockDapClient.connect.mockImplementation(() => {
        connectAttempts++;
        if (connectAttempts < 10) {
          return Promise.reject(new Error('ECONNREFUSED'));
        }
        return Promise.resolve();
      });

      const resultPromise = connectionManager.connectWithRetry('localhost', 5678);
      
      await vi.advanceTimersByTimeAsync(500);
      
      // Test after 5 retries
      await waitForRetries(5);
      expect(mockDapClient.connect).toHaveBeenCalledTimes(6); // initial + 5 retries
      
      // Continue to success
      await waitForRetries(4);
      await resultPromise;
      
      expect(mockDapClient.connect).toHaveBeenCalledTimes(10);
    });

    it('should properly clean up error handler on exception during connect', async () => {
      const unexpectedError = new Error('Unexpected error');
      mockDapClient.connect.mockImplementation(() => {
        throw unexpectedError;
      });

      // Create expectation immediately to attach rejection handler
      const expectation = expect(
        connectionManager.connectWithRetry('localhost', 5678)
      ).rejects.toThrow('Failed to connect DAP client');
      
      await vi.advanceTimersByTimeAsync(500);
      await waitForRetries(60);
      
      // Await the expectation
      await expectation;
      
      // Verify error handler was removed
      expect(mockDapClient.off).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('initializeSession', () => {
    it('should send initialize request with correct arguments', async () => {
      mockDapClient.sendRequest.mockResolvedValue({ success: true });

      await connectionManager.initializeSession(mockDapClient as any, 'test-session-123');

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('initialize', {
        clientID: 'mcp-proxy-test-session-123',
        clientName: 'MCP Debug Proxy',
        adapterID: 'python',
        pathFormat: 'path',
        linesStartAt1: true,
        columnsStartAt1: true,
        supportsVariableType: true,
        supportsRunInTerminalRequest: false,
        locale: 'en-US'
      });
    });

    it('should handle initialize request failure', async () => {
      const error = new Error('Initialize failed');
      mockDapClient.sendRequest.mockRejectedValue(error);

      await expect(
        connectionManager.initializeSession(mockDapClient as any, 'test-session')
      ).rejects.toThrow('Initialize failed');
    });
  });

  describe('setupEventHandlers', () => {
    it('should set up all provided handlers', () => {
      const handlers = {
        onInitialized: vi.fn(),
        onOutput: vi.fn(),
        onStopped: vi.fn(),
        onContinued: vi.fn(),
        onThread: vi.fn(),
        onExited: vi.fn(),
        onTerminated: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn()
      };

      connectionManager.setupEventHandlers(mockDapClient as any, handlers);

      expect(mockDapClient.on).toHaveBeenCalledWith('initialized', handlers.onInitialized);
      expect(mockDapClient.on).toHaveBeenCalledWith('output', handlers.onOutput);
      expect(mockDapClient.on).toHaveBeenCalledWith('stopped', handlers.onStopped);
      expect(mockDapClient.on).toHaveBeenCalledWith('continued', handlers.onContinued);
      expect(mockDapClient.on).toHaveBeenCalledWith('thread', handlers.onThread);
      expect(mockDapClient.on).toHaveBeenCalledWith('exited', handlers.onExited);
      expect(mockDapClient.on).toHaveBeenCalledWith('terminated', handlers.onTerminated);
      expect(mockDapClient.on).toHaveBeenCalledWith('error', handlers.onError);
      expect(mockDapClient.on).toHaveBeenCalledWith('close', handlers.onClose);
    });

    it('should only set up provided handlers', () => {
      const handlers = {
        onInitialized: vi.fn(),
        onStopped: vi.fn()
      };

      connectionManager.setupEventHandlers(mockDapClient as any, handlers);

      expect(mockDapClient.on).toHaveBeenCalledTimes(2);
      expect(mockDapClient.on).toHaveBeenCalledWith('initialized', handlers.onInitialized);
      expect(mockDapClient.on).toHaveBeenCalledWith('stopped', handlers.onStopped);
    });

    it('should handle empty handlers object', () => {
      connectionManager.setupEventHandlers(mockDapClient as any, {});

      expect(mockDapClient.on).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('[ConnectionManager] DAP event handlers set up');
    });
  });

  describe('disconnect', () => {
    it('should handle null client gracefully', async () => {
      await connectionManager.disconnect(null);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ConnectionManager] No active DAP client to disconnect.'
      );
      expect(mockDapClient.sendRequest).not.toHaveBeenCalled();
    });

    it('should disconnect with terminateDebuggee true by default', async () => {
      mockDapClient.sendRequest.mockResolvedValue(undefined);

      await connectionManager.disconnect(mockDapClient as any);

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('disconnect', { 
        terminateDebuggee: true 
      });
      expect(mockDapClient.disconnect).toHaveBeenCalled();
      expectDisconnectCleanup();
    });

    it('should disconnect without terminating debuggee when specified', async () => {
      mockDapClient.sendRequest.mockResolvedValue(undefined);

      await connectionManager.disconnect(mockDapClient as any, false);

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('disconnect', { 
        terminateDebuggee: false 
      });
    });

    it('should handle disconnect request timeout', async () => {
      mockDapClient.sendRequest.mockImplementation(() => 
        new Promise((resolve) => setTimeout(resolve, 2000))
      );

      const disconnectPromise = connectionManager.disconnect(mockDapClient as any);
      
      // Advance past timeout
      await vi.advanceTimersByTimeAsync(1100);
      await disconnectPromise;

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error or timeout during DAP "disconnect" request: DAP disconnect request timed out after 1000ms')
      );
      expect(mockDapClient.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect request error', async () => {
      const error = new Error('Disconnect failed');
      mockDapClient.sendRequest.mockRejectedValue(error);

      await connectionManager.disconnect(mockDapClient as any);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error or timeout during DAP "disconnect" request: Disconnect failed')
      );
      expect(mockDapClient.disconnect).toHaveBeenCalled();
    });

    it('should handle error during client.disconnect()', async () => {
      mockDapClient.sendRequest.mockResolvedValue(undefined);
      mockDapClient.disconnect.mockImplementation(() => {
        throw new Error('Client disconnect error');
      });

      await connectionManager.disconnect(mockDapClient as any);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error calling client.disconnect(): Client disconnect error'),
        expect.any(Error)
      );
    });

    it('should handle both disconnect request and client.disconnect errors', async () => {
      mockDapClient.sendRequest.mockRejectedValue(new Error('Request error'));
      mockDapClient.disconnect.mockImplementation(() => {
        throw new Error('Disconnect error');
      });

      await connectionManager.disconnect(mockDapClient as any);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Request error')
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Disconnect error'),
        expect.any(Error)
      );
    });

    it('should test race condition - disconnect completes before timeout', async () => {
      mockDapClient.sendRequest.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(undefined), 500))
      );

      const disconnectPromise = connectionManager.disconnect(mockDapClient as any);
      
      // Advance time but less than timeout
      await vi.advanceTimersByTimeAsync(600);
      await disconnectPromise;

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ConnectionManager] DAP "disconnect" request completed.'
      );
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('timeout')
      );
    });
  });

  describe('sendLaunchRequest', () => {
    const scriptPath = '/path/to/script.py';

    it('should send launch request with default arguments', async () => {
      mockDapClient.sendRequest.mockResolvedValue(undefined);

      await connectionManager.sendLaunchRequest(mockDapClient as any, scriptPath);

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('launch', {
        program: scriptPath,
        stopOnEntry: true,
        noDebug: false,
        args: [],
        console: 'internalConsole',
        justMyCode: true
      });
    });

    it('should send launch request with custom arguments', async () => {
      mockDapClient.sendRequest.mockResolvedValue(undefined);

      await connectionManager.sendLaunchRequest(
        mockDapClient as any,
        scriptPath,
        ['--arg1', 'value1'],
        false,
        false
      );

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('launch', {
        program: scriptPath,
        stopOnEntry: false,
        noDebug: false,
        args: ['--arg1', 'value1'],
        console: 'internalConsole',
        justMyCode: false
      });
    });

    it('should handle launch request failure', async () => {
      const error = new Error('Launch failed');
      mockDapClient.sendRequest.mockRejectedValue(error);

      await expect(
        connectionManager.sendLaunchRequest(mockDapClient as any, scriptPath)
      ).rejects.toThrow('Launch failed');
    });
  });

  describe('setBreakpoints', () => {
    const sourcePath = '/path/to/source.py';

    it('should set single breakpoint', async () => {
      const response: DebugProtocol.SetBreakpointsResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'setBreakpoints',
        success: true,
        body: {
          breakpoints: [{ verified: true, line: 10 }]
        }
      };
      mockDapClient.sendRequest.mockResolvedValue(response);

      const result = await connectionManager.setBreakpoints(
        mockDapClient as any,
        sourcePath,
        [{ line: 10 }]
      );

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('setBreakpoints', {
        source: { path: sourcePath },
        breakpoints: [{ line: 10 }]
      });
      expect(result).toBe(response);
    });

    it('should set multiple breakpoints', async () => {
      const response: DebugProtocol.SetBreakpointsResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'setBreakpoints',
        success: true,
        body: {
          breakpoints: [
            { verified: true, line: 10 },
            { verified: true, line: 20 },
            { verified: true, line: 30 }
          ]
        }
      };
      mockDapClient.sendRequest.mockResolvedValue(response);

      const breakpoints = [
        { line: 10 },
        { line: 20 },
        { line: 30 }
      ];

      const result = await connectionManager.setBreakpoints(
        mockDapClient as any,
        sourcePath,
        breakpoints
      );

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('setBreakpoints', {
        source: { path: sourcePath },
        breakpoints: [
          { line: 10 },
          { line: 20 },
          { line: 30 }
        ]
      });
      expect(result.body.breakpoints).toHaveLength(3);
    });

    it('should set breakpoints with conditions', async () => {
      const response: DebugProtocol.SetBreakpointsResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'setBreakpoints',
        success: true,
        body: {
          breakpoints: [
            { verified: true, line: 10 },
            { verified: true, line: 20 }
          ]
        }
      };
      mockDapClient.sendRequest.mockResolvedValue(response);

      const breakpoints = [
        { line: 10, condition: 'x > 5' },
        { line: 20, condition: 'y == "test"' }
      ];

      await connectionManager.setBreakpoints(
        mockDapClient as any,
        sourcePath,
        breakpoints
      );

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('setBreakpoints', {
        source: { path: sourcePath },
        breakpoints: [
          { line: 10, condition: 'x > 5' },
          { line: 20, condition: 'y == "test"' }
        ]
      });
    });

    it('should handle empty breakpoints array', async () => {
      const response: DebugProtocol.SetBreakpointsResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'setBreakpoints',
        success: true,
        body: {
          breakpoints: []
        }
      };
      mockDapClient.sendRequest.mockResolvedValue(response);

      const result = await connectionManager.setBreakpoints(
        mockDapClient as any,
        sourcePath,
        []
      );

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('setBreakpoints', {
        source: { path: sourcePath },
        breakpoints: []
      });
      expect(result.body.breakpoints).toHaveLength(0);
    });

    it('should handle invalid breakpoint data', async () => {
      const response: DebugProtocol.SetBreakpointsResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'setBreakpoints',
        success: true,
        body: {
          breakpoints: [
            { verified: false, line: -1, message: 'Invalid line number' }
          ]
        }
      };
      mockDapClient.sendRequest.mockResolvedValue(response);

      const result = await connectionManager.setBreakpoints(
        mockDapClient as any,
        sourcePath,
        [{ line: -1 }]
      );

      expect(result.body.breakpoints[0].verified).toBe(false);
      expect(result.body.breakpoints[0].message).toBe('Invalid line number');
    });

    it('should handle very large breakpoint arrays', async () => {
      const largeBreakpointsCount = 100;
      const breakpoints = Array.from({ length: largeBreakpointsCount }, (_, i) => ({
        line: i + 1
      }));

      const response: DebugProtocol.SetBreakpointsResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'setBreakpoints',
        success: true,
        body: {
          breakpoints: breakpoints.map(bp => ({ verified: true, line: bp.line }))
        }
      };
      mockDapClient.sendRequest.mockResolvedValue(response);

      const result = await connectionManager.setBreakpoints(
        mockDapClient as any,
        sourcePath,
        breakpoints
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        `[ConnectionManager] Setting ${largeBreakpointsCount} breakpoint(s) for ${sourcePath}`
      );
      expect(result.body.breakpoints).toHaveLength(largeBreakpointsCount);
    });

    it('should handle duplicate breakpoints in array', async () => {
      const breakpoints = [
        { line: 10 },
        { line: 10 }, // duplicate
        { line: 20 },
        { line: 10 } // another duplicate
      ];

      const response: DebugProtocol.SetBreakpointsResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'setBreakpoints',
        success: true,
        body: {
          breakpoints: breakpoints.map(bp => ({ verified: true, line: bp.line }))
        }
      };
      mockDapClient.sendRequest.mockResolvedValue(response);

      await connectionManager.setBreakpoints(
        mockDapClient as any,
        sourcePath,
        breakpoints
      );

      // Verify all breakpoints are sent, even duplicates
      const sentBreakpoints = mockDapClient.sendRequest.mock.calls[0][1].breakpoints;
      expect(sentBreakpoints).toHaveLength(4);
    });

    it('should handle setBreakpoints request failure', async () => {
      const error = new Error('Failed to set breakpoints');
      mockDapClient.sendRequest.mockRejectedValue(error);

      await expect(
        connectionManager.setBreakpoints(
          mockDapClient as any,
          sourcePath,
          [{ line: 10 }]
        )
      ).rejects.toThrow('Failed to set breakpoints');
    });
  });

  describe('sendConfigurationDone', () => {
    it('should send configurationDone request', async () => {
      mockDapClient.sendRequest.mockResolvedValue(undefined);

      await connectionManager.sendConfigurationDone(mockDapClient as any);

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('configurationDone', {});
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ConnectionManager] "configurationDone" sent.'
      );
    });

    it('should handle configurationDone request failure', async () => {
      const error = new Error('Configuration done failed');
      mockDapClient.sendRequest.mockRejectedValue(error);

      await expect(
        connectionManager.sendConfigurationDone(mockDapClient as any)
      ).rejects.toThrow('Configuration done failed');
    });
  });

  describe('State Management and Concurrent Operations', () => {
    it('should handle concurrent connect attempts', async () => {
      mockDapClient.connect.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      const promise1 = connectionManager.connectWithRetry('localhost', 5678);
      const promise2 = connectionManager.connectWithRetry('localhost', 5679);

      await vi.advanceTimersByTimeAsync(600);
      
      const [client1, client2] = await Promise.all([promise1, promise2]);

      expect(mockDapClientFactory.create).toHaveBeenCalledTimes(2);
      expect(mockDapClientFactory.create).toHaveBeenCalledWith('localhost', 5678);
      expect(mockDapClientFactory.create).toHaveBeenCalledWith('localhost', 5679);
    });

    it('should handle rapid disconnect/reconnect cycles', async () => {
      mockDapClient.connect.mockResolvedValue(undefined);
      mockDapClient.sendRequest.mockResolvedValue(undefined);

      // Connect
      const connectPromise = connectionManager.connectWithRetry('localhost', 5678);
      await vi.advanceTimersByTimeAsync(500);
      const client = await connectPromise;

      // Immediately disconnect
      await connectionManager.disconnect(client);

      // Immediately reconnect
      const reconnectPromise = connectionManager.connectWithRetry('localhost', 5678);
      await vi.advanceTimersByTimeAsync(500);
      await reconnectPromise;

      expect(mockDapClient.disconnect).toHaveBeenCalledTimes(1);
      expect(mockDapClientFactory.create).toHaveBeenCalledTimes(2);
    });
  });
});
