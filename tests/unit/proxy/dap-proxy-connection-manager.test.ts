import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DapConnectionManager } from '../../../src/proxy/dap-proxy-connection-manager.js';
import type {
  IDapClientFactory,
  ILogger
} from '../../../src/proxy/dap-proxy-interfaces.js';
import { DebugProtocol } from '@vscode/debugprotocol';
import { createMockDapClient } from '../../test-utils/mocks/dap-client.js';

describe('DapConnectionManager', () => {
  let mockDapClient: ReturnType<typeof createMockDapClient>;

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

    mockDapClient = createMockDapClient();

    // Typed against the interface so the double is checked against
    // IDapClient rather than widened past it (issue #691).
    mockDapClientFactory = {
      create: vi.fn<IDapClientFactory['create']>(() => mockDapClient)
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

    // The window is a wall-clock budget, not an attempt count (issue #963): a
    // slow adapter boot on a loaded runner used to run out of the 60 attempts
    // (~12.5 s) while the adapter was still starting, 17.5 s before the
    // parent's own 30 s deadline would have given up.
    it('keeps attempting past the old 60-attempt ceiling while the budget remains (issue #963)', async () => {
      let attempts = 0;
      mockDapClient.connect.mockImplementation(() => {
        attempts++;
        return attempts < 90 ? Promise.reject(new Error('ECONNREFUSED')) : Promise.resolve();
      });

      const resultPromise = connectionManager.connectWithRetry('localhost', 5678, { budgetMs: 25_000 });

      await vi.advanceTimersByTimeAsync(500);
      await waitForRetries(89);

      await expect(resultPromise).resolves.toBe(mockDapClient);
      expect(mockDapClient.connect).toHaveBeenCalledTimes(90);
    });

    it('gives up when the budget expires with nothing listening, saying what expired (issue #963)', async () => {
      mockDapClient.connect.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5678'));

      // Create expectation immediately to attach rejection handler
      const expectation = expect(
        connectionManager.connectWithRetry('127.0.0.1', 5678)
      ).rejects.toThrow(
        'Failed to connect DAP client: nothing accepted a connection on 127.0.0.1:5678 within 12.5s'
      );

      // Wait for initial delay, then out the default budget (today's 60-attempt equivalent).
      await vi.advanceTimersByTimeAsync(500);
      await waitForRetries(61);

      await expectation;

      expect(mockDapClient.connect.mock.calls.length).toBeGreaterThanOrEqual(60);
      expect(mockDapClient.off).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockDapClient.disconnect).toHaveBeenCalledTimes(1);
      // The elapsed time is stated beside the window: one attempt can outlive
      // the window (a remote attach host that drops SYNs answers ETIMEDOUT
      // after the OS's own ~21 s), and the message must not read as if the
      // loop had stopped at 12.5 s.
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('within 12.5s (12.5s elapsed, 61 attempts; last error: connect ECONNREFUSED 127.0.0.1:5678)')
      );
    });

    it('states the real elapsed time when a single attempt outlives the window (issue #963)', async () => {
      // One connect that only settles after 21 s, as a dropped SYN does.
      mockDapClient.connect.mockImplementation(
        () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error('connect ETIMEDOUT 10.0.0.9:5678')), 21_000))
      );

      const expectation = expect(
        connectionManager.connectWithRetry('10.0.0.9', 5678)
      ).rejects.toThrow('nothing accepted a connection on 10.0.0.9:5678 within 12.5s (21.5s elapsed, 1 attempts; last error: connect ETIMEDOUT 10.0.0.9:5678)');

      await vi.advanceTimersByTimeAsync(500 + 21_000);
      await expectation;
    });

    it('keeps reporting the real reason when the client refuses to disconnect (issue #963)', async () => {
      mockDapClient.connect.mockRejectedValue(new Error('ECONNREFUSED'));
      mockDapClient.disconnect.mockImplementation(() => {
        throw new Error('disconnect exploded');
      });

      const expectation = expect(
        connectionManager.connectWithRetry('127.0.0.1', 5678, { budgetMs: 100 })
      ).rejects.toThrow('nothing accepted a connection on 127.0.0.1:5678');

      await vi.advanceTimersByTimeAsync(100);
      await expectation;

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('disconnect exploded'));
    });

    it('quotes at most the last ten stderr lines of an exited adapter, as seen at its exit (issue #963)', async () => {
      mockDapClient.connect.mockRejectedValue(new Error('ECONNREFUSED'));
      const adapterExit = new AbortController();
      const stderrTail = Array.from({ length: 15 }, (_unused, index) => `line ${index + 1} of the tail`);
      adapterExit.abort({ code: 1, signal: null, stderrTail });

      const failure = await connectionManager.connectWithRetry('127.0.0.1', 5678, { abort: adapterExit.signal })
        .then(() => undefined, (error: Error) => error);

      expect(failure).toBeDefined();
      expect(failure!.message).toContain('Its last stderr lines by the time it exited: line 6 of the tail | ');
      expect(failure!.message).not.toContain('line 5 of the tail');
      expect(failure!.message).toContain('line 15 of the tail');
    });

    it('caps the quoted stderr at the parent\'s 2000 characters, keeping the most recent (issue #963)', async () => {
      mockDapClient.connect.mockRejectedValue(new Error('ECONNREFUSED'));
      const adapterExit = new AbortController();
      const stderrTail = Array.from({ length: 10 }, (_unused, index) => `line ${index + 1} ${'x'.repeat(300)}`);
      adapterExit.abort({ code: 1, signal: null, stderrTail });

      const failure = await connectionManager.connectWithRetry('127.0.0.1', 5678, { abort: adapterExit.signal })
        .then(() => undefined, (error: Error) => error);

      expect(failure).toBeDefined();
      expect(failure!.message).toContain('line 10 ');
      expect(failure!.message).not.toContain('line 1 ');
      expect(failure!.message.length).toBeLessThan(2300);
    });

    it('makes at least one attempt however small the budget (issue #963)', async () => {
      mockDapClient.connect.mockRejectedValue(new Error('ECONNREFUSED'));

      const expectation = expect(
        connectionManager.connectWithRetry('127.0.0.1', 5678, { budgetMs: 100 })
      ).rejects.toThrow('within 0.1s');

      await vi.advanceTimersByTimeAsync(100);
      await expectation;

      expect(mockDapClient.connect).toHaveBeenCalledTimes(1);
    });

    it('ends the wait at once when the adapter process exits, quoting the exit (issue #963)', async () => {
      mockDapClient.connect.mockRejectedValue(new Error('ECONNREFUSED'));
      const adapterExit = new AbortController();

      const expectation = expect(
        connectionManager.connectWithRetry('127.0.0.1', 5678, { budgetMs: 30_500, abort: adapterExit.signal })
      ).rejects.toThrow(
        'Failed to connect DAP client: the adapter process exited (code 1) before it started listening on 127.0.0.1:5678. Its last stderr lines by the time it exited: rdbg: command not found'
      );

      await vi.advanceTimersByTimeAsync(500);
      await waitForRetries(3);
      const attemptsBeforeExit = mockDapClient.connect.mock.calls.length;
      expect(attemptsBeforeExit).toBeGreaterThan(0);

      adapterExit.abort({ code: 1, signal: null, stderrTail: ['rdbg: command not found'] });
      await expectation;

      // No further attempts after the exit, however long the budget had left.
      await vi.advanceTimersByTimeAsync(5_000);
      expect(mockDapClient.connect.mock.calls.length).toBe(attemptsBeforeExit);
      expect(mockDapClient.off).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockDapClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it('names a signal-terminated adapter and copes with an abort that carries no reason (issue #963)', async () => {
      mockDapClient.connect.mockRejectedValue(new Error('ECONNREFUSED'));

      const killed = new AbortController();
      killed.abort({ code: null, signal: 'SIGKILL' });
      await expect(
        connectionManager.connectWithRetry('127.0.0.1', 5678, { abort: killed.signal })
      ).rejects.toThrow('the adapter process exited (signal SIGKILL) before it started listening on 127.0.0.1:5678');
      // Already exited before the first wait: no attempt is made.
      expect(mockDapClient.connect).not.toHaveBeenCalled();

      const bare = new AbortController();
      bare.abort();
      await expect(
        connectionManager.connectWithRetry('127.0.0.1', 5678, { abort: bare.signal })
      ).rejects.toThrow('the adapter process exited before it started listening on 127.0.0.1:5678');
    });

    it('should handle temporary error events during connection', async () => {
      let tempErrorHandler: ((error: Error) => void) | undefined;
      mockDapClient.on.mockImplementation((event: string, handler: (error: Error) => void) => {
        if (event === 'error') {
          tempErrorHandler = handler;
        }
        return mockDapClient;
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
      await waitForRetries(61);

      // Await the expectation
      await expectation;

      // Verify error handler was removed
      expect(mockDapClient.off).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('initializeSession', () => {
    it('should send initialize request with correct arguments', async () => {
      mockDapClient.sendRequest.mockResolvedValue({ success: true });

      await connectionManager.initializeSession(mockDapClient, 'test-session-123');

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
        connectionManager.initializeSession(mockDapClient, 'test-session')
      ).rejects.toThrow('Initialize failed');
    });

    it('returns the initialize response body (adapter capabilities, issue #243)', async () => {
      const capabilities = {
        supportsExceptionInfoRequest: true,
        exceptionBreakpointFilters: [{ filter: 'uncaught', label: 'Uncaught' }]
      };
      mockDapClient.sendRequest.mockResolvedValue({ success: true, body: capabilities });

      const result = await connectionManager.initializeSession(mockDapClient, 'test-session');

      expect(result).toEqual(capabilities);
    });

    it('returns undefined when the initialize response has no body', async () => {
      mockDapClient.sendRequest.mockResolvedValue({ success: true });

      const result = await connectionManager.initializeSession(mockDapClient, 'test-session');

      expect(result).toBeUndefined();
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
        onBreakpoint: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn()
      };

      connectionManager.setupEventHandlers(mockDapClient, handlers);

      expect(mockDapClient.on).toHaveBeenCalledWith('initialized', handlers.onInitialized);
      expect(mockDapClient.on).toHaveBeenCalledWith('output', handlers.onOutput);
      expect(mockDapClient.on).toHaveBeenCalledWith('stopped', handlers.onStopped);
      expect(mockDapClient.on).toHaveBeenCalledWith('continued', handlers.onContinued);
      expect(mockDapClient.on).toHaveBeenCalledWith('thread', handlers.onThread);
      expect(mockDapClient.on).toHaveBeenCalledWith('exited', handlers.onExited);
      expect(mockDapClient.on).toHaveBeenCalledWith('terminated', handlers.onTerminated);
      expect(mockDapClient.on).toHaveBeenCalledWith('breakpoint', handlers.onBreakpoint);
      expect(mockDapClient.on).toHaveBeenCalledWith('error', handlers.onError);
      expect(mockDapClient.on).toHaveBeenCalledWith('close', handlers.onClose);
    });

    it('should only set up provided handlers', () => {
      const handlers = {
        onInitialized: vi.fn(),
        onStopped: vi.fn()
      };

      connectionManager.setupEventHandlers(mockDapClient, handlers);

      expect(mockDapClient.on).toHaveBeenCalledTimes(2);
      expect(mockDapClient.on).toHaveBeenCalledWith('initialized', handlers.onInitialized);
      expect(mockDapClient.on).toHaveBeenCalledWith('stopped', handlers.onStopped);
    });

    it('should handle empty handlers object', () => {
      connectionManager.setupEventHandlers(mockDapClient, {});

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

      await connectionManager.disconnect(mockDapClient);

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('disconnect', { 
        terminateDebuggee: true 
      });
      expect(mockDapClient.disconnect).toHaveBeenCalled();
      expectDisconnectCleanup();
    });

    it('should disconnect without terminating debuggee when specified', async () => {
      mockDapClient.sendRequest.mockResolvedValue(undefined);

      await connectionManager.disconnect(mockDapClient, false);

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('disconnect', { 
        terminateDebuggee: false 
      });
    });

    it('should handle disconnect request timeout', async () => {
      mockDapClient.sendRequest.mockImplementation(() => 
        new Promise((resolve) => setTimeout(resolve, 2000))
      );

      const disconnectPromise = connectionManager.disconnect(mockDapClient);
      
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

      await connectionManager.disconnect(mockDapClient);

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

      await connectionManager.disconnect(mockDapClient);

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

      await connectionManager.disconnect(mockDapClient);

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

      const disconnectPromise = connectionManager.disconnect(mockDapClient);
      
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

      await connectionManager.sendLaunchRequest(mockDapClient, scriptPath);

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('launch', {
        program: scriptPath,
        stopOnEntry: true,
        noDebug: false,
        args: [],
        console: 'internalConsole',
        justMyCode: true
      });
    });

    it('sends the launch as the DAP verb the policy asks for (issue #798)', async () => {
      // rdbg honours nonstop only on `attach`, so the Ruby policy's launch
      // goes out as an attach request with the very same arguments.
      mockDapClient.sendRequest.mockResolvedValue(undefined);

      await connectionManager.sendLaunchRequest(
        mockDapClient,
        scriptPath,
        [],
        true,
        true,
        { nonstop: false, localfs: true },
        { requestCommand: 'attach' }
      );

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('attach', {
        program: scriptPath,
        stopOnEntry: true,
        noDebug: false,
        args: [],
        console: 'internalConsole',
        justMyCode: true,
        nonstop: false,
        localfs: true
      });
    });

    it('should send launch request with custom arguments', async () => {
      mockDapClient.sendRequest.mockResolvedValue(undefined);

      await connectionManager.sendLaunchRequest(
        mockDapClient,
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
        connectionManager.sendLaunchRequest(mockDapClient, scriptPath)
      ).rejects.toThrow('Launch failed');
    });

    it('does not log launch env values while still sending them to the adapter', async () => {
      mockDapClient.sendRequest.mockResolvedValue(undefined);

      await connectionManager.sendLaunchRequest(
        mockDapClient,
        scriptPath,
        [],
        true,
        true,
        { type: 'pwa-node', env: { GITHUB_PAT: 'github_pat_LOGLEAK123' } }
      );

      // The adapter must still receive the real environment
      expect(mockDapClient.sendRequest).toHaveBeenCalledWith(
        'launch',
        expect.objectContaining({ env: { GITHUB_PAT: 'github_pat_LOGLEAK123' } })
      );

      const logged = (mockLogger.info as any).mock.calls
        .map((call: unknown[]) => JSON.stringify(call))
        .join('\n');
      expect(logged).not.toContain('github_pat_LOGLEAK123');
      expect(logged).toContain('env vars redacted');
    });
  });

  describe('sendAttachRequest', () => {
    it('does not log attach config env values while still sending them to the adapter', async () => {
      mockDapClient.sendRequest.mockResolvedValue(undefined);

      await connectionManager.sendAttachRequest(mockDapClient, {
        host: 'localhost',
        port: 5678,
        env: { SECRET_TOKEN: 'attach-secret-1' }
      });

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith(
        'attach',
        expect.objectContaining({ env: { SECRET_TOKEN: 'attach-secret-1' } })
      );

      const logged = (mockLogger.info as any).mock.calls
        .map((call: unknown[]) => JSON.stringify(call))
        .join('\n');
      expect(logged).not.toContain('attach-secret-1');
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
        mockDapClient,
        sourcePath,
        [{ line: 10 }]
      );

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('setBreakpoints', {
        source: { path: sourcePath, name: 'source.py' },
        breakpoints: [{ line: 10 }]
      });
      expect(result).toBe(response);
    });

    it('forwards logMessage and suspendPolicy fields (issue #235)', async () => {
      const response: DebugProtocol.SetBreakpointsResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'setBreakpoints',
        success: true,
        body: { breakpoints: [{ verified: true, line: 10 }] }
      };
      mockDapClient.sendRequest.mockResolvedValue(response);

      await connectionManager.setBreakpoints(
        mockDapClient,
        sourcePath,
        [{ line: 10, condition: 'x > 1', logMessage: 'x is {x}', suspendPolicy: 'thread' }]
      );

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('setBreakpoints', {
        source: { path: sourcePath, name: 'source.py' },
        breakpoints: [{ line: 10, condition: 'x > 1', logMessage: 'x is {x}', suspendPolicy: 'thread' }]
      });
    });

    it("sends a policy's wire form when one is given (issue #850)", async () => {
      const response: DebugProtocol.SetBreakpointsResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'setBreakpoints',
        success: true,
        body: { breakpoints: [{ verified: true, line: 10 }] }
      };
      mockDapClient.sendRequest.mockResolvedValue(response);
      const policy = {
        toWireBreakpoint: (bp: { line: number; logMessage?: string }) => ({ line: bp.line, condition: `compiled(${bp.logMessage})` })
      };

      await connectionManager.setBreakpoints(mockDapClient, sourcePath, [{ line: 10, logMessage: 'x is {x}' }], policy);

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('setBreakpoints', {
        source: { path: sourcePath, name: 'source.py' },
        breakpoints: [{ line: 10, condition: 'compiled(x is {x})' }]
      });
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
        mockDapClient,
        sourcePath,
        breakpoints
      );

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('setBreakpoints', {
        source: { path: sourcePath, name: 'source.py' },
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
        mockDapClient,
        sourcePath,
        breakpoints
      );

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('setBreakpoints', {
        source: { path: sourcePath, name: 'source.py' },
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
        mockDapClient,
        sourcePath,
        []
      );

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('setBreakpoints', {
        source: { path: sourcePath, name: 'source.py' },
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
        mockDapClient,
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
        mockDapClient,
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
        mockDapClient,
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
          mockDapClient,
          sourcePath,
          [{ line: 10 }]
        )
      ).rejects.toThrow('Failed to set breakpoints');
    });
  });

  describe('sendConfigurationDone', () => {
    it('should send configurationDone request', async () => {
      mockDapClient.sendRequest.mockResolvedValue(undefined);

      await connectionManager.sendConfigurationDone(mockDapClient);

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('configurationDone', {});
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ConnectionManager] "configurationDone" sent.'
      );
    });

    it('should handle configurationDone request failure', async () => {
      const error = new Error('Configuration done failed');
      mockDapClient.sendRequest.mockRejectedValue(error);

      await expect(
        connectionManager.sendConfigurationDone(mockDapClient)
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
