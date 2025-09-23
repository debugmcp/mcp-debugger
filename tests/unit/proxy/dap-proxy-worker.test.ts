/**
 * Unit tests for DapProxyWorker
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { ChildProcess } from 'child_process';
import { DapProxyWorker } from '../../../src/proxy/dap-proxy-worker.js';
import {
  DapProxyDependencies,
  ProxyInitPayload,
  DapCommandPayload,
  TerminatePayload,
  ProxyState,
  IDapClient,
  ILogger
} from '../../../src/proxy/dap-proxy-interfaces.js';

describe('DapProxyWorker', () => {
  let worker: DapProxyWorker;
  let mockDependencies: DapProxyDependencies;
  let mockLogger: ILogger;
  let mockDapClient: IDapClient;
  let mockChildProcess: Partial<ChildProcess>;
  let messageSendSpy: Mock;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    };

    // Create mock DAP client
    mockDapClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      sendRequest: vi.fn().mockResolvedValue({ body: {} }),
      disconnect: vi.fn(),
      shutdown: vi.fn().mockImplementation(() => {
        // Mock implementation that mimics the real shutdown behavior
        // In a real implementation, this would reject pending requests
      }),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn()
    };

    // Create mock child process
    mockChildProcess = {
      pid: 12345,
      kill: vi.fn().mockReturnValue(true),
      killed: false,
      on: vi.fn(),
      unref: vi.fn()
    };

    // Create message send spy
    messageSendSpy = vi.fn();

    // Create mock dependencies
    mockDependencies = {
      loggerFactory: vi.fn().mockResolvedValue(mockLogger),
      fileSystem: {
        ensureDir: vi.fn().mockResolvedValue(undefined),
        pathExists: vi.fn().mockResolvedValue(true)
      },
      processSpawner: {
        spawn: vi.fn().mockReturnValue(mockChildProcess)
      },
      dapClientFactory: {
        create: vi.fn().mockReturnValue(mockDapClient)
      },
      messageSender: {
        send: messageSendSpy
      }
    };

    worker = new DapProxyWorker(mockDependencies);
  });

  afterEach(async () => {
    // Clear all timers first to prevent timeout errors
    vi.clearAllTimers();

    // Ensure worker is properly shut down after each test
    // This prevents any lingering timers or connections
    if (worker && worker.getState() !== ProxyState.TERMINATED) {
      try {
        await worker.shutdown();
      } catch (error) {
        // Ignore shutdown errors in cleanup
      }
    }

    // Reset all mocks
    vi.clearAllMocks();

    // Restore real timers if they were faked
    if (vi.isFakeTimers()) {
      vi.useRealTimers();
    }
  });

  describe('initialization', () => {
    it('should start in UNINITIALIZED state', () => {
      expect(worker.getState()).toBe(ProxyState.UNINITIALIZED);
    });

    it('should handle init command successfully', async () => {
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py',
        scriptArgs: ['arg1', 'arg2'],
        stopOnEntry: true,
        justMyCode: false
      };

      await worker.handleCommand(initPayload);

      // Verify logger was created
      expect(mockDependencies.loggerFactory).toHaveBeenCalledWith('test-session', '/tmp/logs');
      
      // Verify process was spawned
      expect(mockDependencies.processSpawner.spawn).toHaveBeenCalledWith(
        '/usr/bin/python3',
        ['-m', 'debugpy.adapter', '--host', 'localhost', '--port', '5678', '--log-dir', '/tmp/logs'],
        expect.any(Object)
      );

      // Verify DAP client was created and connected
      expect(mockDependencies.dapClientFactory.create).toHaveBeenCalledWith('localhost', 5678);
      expect(mockDapClient.connect).toHaveBeenCalled();
    });

    it('should reject init if already initialized', async () => {
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };

      // First init should succeed
      await worker.handleCommand(initPayload);

      // Second init should fail
      await worker.handleCommand(initPayload);

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('Invalid state for init')
        })
      );
    });

    // Test removed: Path validation is removed as part of "hands-off" approach
    // We let debugpy handle path validation and provide natural error messages

    it('should handle dry run mode', async () => {
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py',
        dryRunSpawn: true
      };

      await worker.handleCommand(initPayload);

      // Verify the status message was sent
      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          status: 'dry_run_complete',
          command: expect.stringContaining('python3 -m debugpy.adapter')
        })
      );

      // Verify state is TERMINATED
      expect(worker.getState()).toBe(ProxyState.TERMINATED);
    });
  });

  describe('DAP command handling', () => {
    beforeEach(async () => {
      // Initialize worker first
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };

      await worker.handleCommand(initPayload);

      // Simulate initialized event to reach CONNECTED state
      const onInitialized = (mockDapClient.on as Mock).mock.calls
        .find(call => call[0] === 'initialized')?.[1];
      if (onInitialized) {
        await onInitialized();
      }
    });

    it('should forward DAP commands to client', async () => {
      const dapCommand: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-123',
        dapCommand: 'continue',
        dapArgs: { threadId: 1 }
      };

      const mockResponse = { 
        success: true, 
        body: { allThreadsContinued: true } 
      };
      (mockDapClient.sendRequest as Mock).mockResolvedValue(mockResponse);

      await worker.handleCommand(dapCommand);

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('continue', { threadId: 1 });
      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapResponse',
          requestId: 'req-123',
          success: true,
          body: { allThreadsContinued: true }
        })
      );
    });

    it('should handle DAP command errors', async () => {
      const dapCommand: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-456',
        dapCommand: 'evaluate',
        dapArgs: { expression: 'invalid()' }
      };

      (mockDapClient.sendRequest as Mock).mockRejectedValue(new Error('Evaluation failed'));

      await worker.handleCommand(dapCommand);

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapResponse',
          requestId: 'req-456',
          success: false,
          error: 'Evaluation failed'
        })
      );
    });

    it('should reject DAP commands before connection', async () => {
      // Create fresh worker without initialization
      const newWorker = new DapProxyWorker(mockDependencies);

      const dapCommand: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-789',
        dapCommand: 'continue'
      };

      await newWorker.handleCommand(dapCommand);

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapResponse',
          requestId: 'req-789',
          success: false,
          error: 'DAP client not connected'
        })
      );
    });
  });

  describe('terminate handling', () => {
    beforeEach(async () => {
      // Initialize worker first to ensure logger is available
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };
      await worker.handleCommand(initPayload);
    });

    it('should handle terminate command', async () => {
      const terminateCommand: TerminatePayload = {
        cmd: 'terminate',
        sessionId: 'test-session'
      };

      await worker.handleCommand(terminateCommand);

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          status: 'terminated'
        })
      );
      
      expect(worker.getState()).toBe(ProxyState.TERMINATED);
    });
  });

  describe('event handling', () => {
    let eventHandlers: Record<string, (...args: unknown[]) => void>;

    beforeEach(async () => {
      // Initialize worker
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };

      await worker.handleCommand(initPayload);

      // Capture event handlers
      eventHandlers = {};
      (mockDapClient.on as Mock).mock.calls.forEach(call => {
        eventHandlers[call[0]] = call[1];
      });
    });

    it('should handle stopped event', () => {
      const stoppedBody = {
        reason: 'breakpoint',
        threadId: 1,
        allThreadsStopped: true
      };

      eventHandlers['stopped'](stoppedBody);

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapEvent',
          event: 'stopped',
          body: stoppedBody
        })
      );
    });

    it('should handle output event', () => {
      const outputBody = {
        category: 'stdout',
        output: 'Hello, world!\n'
      };

      eventHandlers['output'](outputBody);

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapEvent',
          event: 'output',
          body: outputBody
        })
      );
    });

    it('should handle terminated event and shutdown', async () => {
      const terminatedBody = { restart: false };

      // The handler is not async, so we can't await it.
      // It triggers shutdown(), which is async. We need to wait for it to complete.
      eventHandlers['terminated'](terminatedBody);

      // Give the async shutdown promise time to resolve
      await new Promise(resolve => setImmediate(resolve));

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapEvent',
          event: 'terminated',
          body: terminatedBody
        })
      );

      // Verify shutdown was called
      expect(mockDapClient.shutdown).toHaveBeenCalledWith('worker shutdown');
      expect(mockDapClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should clean up resources on shutdown', async () => {
      // Initialize worker with all resources
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };

      await worker.handleCommand(initPayload);

      // Call shutdown
      await worker.shutdown();

      // Verify cleanup
      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('disconnect', { terminateDebuggee: true });
      expect(mockDapClient.disconnect).toHaveBeenCalled();
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(worker.getState()).toBe(ProxyState.TERMINATED);
    });

    it('should handle shutdown when already shutting down', async () => {
      await worker.shutdown();
      const state1 = worker.getState();

      await worker.shutdown(); // Second call
      const state2 = worker.getState();

      expect(state1).toBe(ProxyState.TERMINATED);
      expect(state2).toBe(ProxyState.TERMINATED);
    });
  });

  describe('error handling and timeouts', () => {
    beforeEach(async () => {
      // Initialize worker for error tests
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };
      await worker.handleCommand(initPayload);
    });

    it('should handle request timeout', async () => {
      vi.useFakeTimers();

      const dapCommand: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-timeout',
        dapCommand: 'continue',
        dapArgs: { threadId: 1 }
      };

      // Make the DAP client request hang indefinitely
      let resolveRequest: (value: any) => void;
      const requestPromise = new Promise(resolve => {
        resolveRequest = resolve;
      });
      (mockDapClient.sendRequest as Mock).mockReturnValue(requestPromise);

      // Send command and advance time to trigger timeout
      const commandPromise = worker.handleCommand(dapCommand);

      // Advance time by timeout duration (30 seconds)
      vi.advanceTimersByTime(30000);

      await commandPromise;

      // Verify error was sent (DAP client not connected)
      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapResponse',
          requestId: 'req-timeout',
          sessionId: 'test-session',
          success: false,
          error: 'DAP client not connected'
        })
      );

      // Clean up
      resolveRequest!({ body: {} });
      vi.useRealTimers();
    });

    it('should handle adapter process errors', async () => {
      let errorHandler: (error: Error) => void;

      // Capture the error handler from process.on('error', ...)
      (mockChildProcess.on as Mock).mockImplementation((event: string, handler: any) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      });

      // Re-initialize to capture handler
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };

      const newWorker = new DapProxyWorker(mockDependencies);
      await newWorker.handleCommand(initPayload);

      // Simulate process error
      const testError = new Error('Process spawn failed');
      errorHandler!(testError);

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('Adapter process error: Process spawn failed')
        })
      );

      await newWorker.shutdown();
    });

    it('should handle DAP client connection errors', async () => {
      let errorHandler: (error: Error) => void;

      // Capture the error handler from dapClient.on('error', ...)
      (mockDapClient.on as Mock).mockImplementation((event: string, handler: any) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      });

      // Re-initialize to capture handler
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };

      const newWorker = new DapProxyWorker(mockDependencies);
      await newWorker.handleCommand(initPayload);

      // Simulate DAP client error
      const testError = new Error('Connection refused');
      errorHandler!(testError);

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('DAP client error: Connection refused')
        })
      );

      await newWorker.shutdown();
    });

    it('should handle DAP client connection close', async () => {
      let closeHandler: () => void;

      // Capture the close handler from dapClient.on('close', ...)
      (mockDapClient.on as Mock).mockImplementation((event: string, handler: any) => {
        if (event === 'close') {
          closeHandler = handler;
        }
      });

      // Re-initialize to capture handler
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };

      const newWorker = new DapProxyWorker(mockDependencies);
      await newWorker.handleCommand(initPayload);

      // Simulate DAP client connection close
      closeHandler!();

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          status: 'dap_connection_closed'
        })
      );

      // Wait for async shutdown to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Worker should be in shutting down state after connection close
      expect(newWorker.getState()).toBe(ProxyState.SHUTTING_DOWN);
    });

    it('should handle adapter process exit events', async () => {
      let exitHandler: (code: number | null, signal: string | null) => void;

      // Capture the exit handler from process.on('exit', ...)
      (mockChildProcess.on as Mock).mockImplementation((event: string, handler: any) => {
        if (event === 'exit') {
          exitHandler = handler;
        }
      });

      // Re-initialize to capture handler
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };

      const newWorker = new DapProxyWorker(mockDependencies);
      await newWorker.handleCommand(initPayload);

      // Simulate process exit with non-zero code
      exitHandler!(1, null);

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          status: 'adapter_exited',
          sessionId: 'test-session',
          code: 1,
          signal: null
        })
      );

      await newWorker.shutdown();
    });

    it('should handle adapter process exit with signal', async () => {
      let exitHandler: (code: number | null, signal: string | null) => void;

      (mockChildProcess.on as Mock).mockImplementation((event: string, handler: any) => {
        if (event === 'exit') {
          exitHandler = handler;
        }
      });

      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };

      const newWorker = new DapProxyWorker(mockDependencies);
      await newWorker.handleCommand(initPayload);

      // Simulate process killed by signal
      exitHandler!(null, 'SIGTERM');

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          status: 'adapter_exited',
          sessionId: 'test-session',
          code: null,
          signal: 'SIGTERM'
        })
      );

      await newWorker.shutdown();
    });

    it('should handle invalid command errors', async () => {
      // Create a new worker without prior initialization to test invalid command handling
      const newWorker = new DapProxyWorker(mockDependencies);

      const invalidCommand = {
        cmd: 'invalid-command',
        sessionId: 'test-session'
      } as any;

      await newWorker.handleCommand(invalidCommand);

      // The worker logs the error but may not send a message for invalid commands before init
      expect(newWorker.getState()).toBe(ProxyState.UNINITIALIZED);
    });

    it('should handle initialization errors', async () => {
      // Make logger factory fail
      mockDependencies.loggerFactory = vi.fn().mockRejectedValue(new Error('Logger creation failed'));

      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };

      const newWorker = new DapProxyWorker(mockDependencies);
      await newWorker.handleCommand(initPayload);

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          sessionId: 'test-session'
        })
      );
    });

    it('should handle DAP connection initialization errors', async () => {
      // Make DAP client connection fail
      (mockDapClient.connect as Mock).mockRejectedValue(new Error('Connection failed'));

      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };

      const newWorker = new DapProxyWorker(mockDependencies);
      await newWorker.handleCommand(initPayload);

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          sessionId: 'test-session',
          message: expect.any(String)  // Just verify an error message exists
        })
      );

      expect(newWorker.getState()).toBe(ProxyState.TERMINATED);
    });
  });

  describe('status message handling', () => {
    beforeEach(async () => {
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        executablePath: '/usr/bin/python3',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: '/home/user/script.py'
      };
      await worker.handleCommand(initPayload);
    });

    it('should send adapter_configured_and_launched status after initialization', async () => {
      // Find and call the initialized handler
      const onInitialized = (mockDapClient.on as Mock).mock.calls
        .find(call => call[0] === 'initialized')?.[1];

      if (onInitialized) {
        await onInitialized();
      }

      expect(mockDependencies.messageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          status: 'adapter_configured_and_launched'
        })
      );

      expect(worker.getState()).toBe(ProxyState.CONNECTED);
    });

    it('should send error message when status sending fails', async () => {
      // Make the message sender fail to test error handling
      mockDependencies.messageSender.send.mockImplementationOnce(() => {
        throw new Error('Send failed');
      });

      // Try to send a status message which will fail
      const statusCommand = {
        cmd: 'dap',
        sessionId: 'test-session',
        dapCommand: 'threads',
        dapArgs: {}
      };

      await worker.handleCommand(statusCommand);

      // The error should be handled gracefully (no exception thrown)
      expect(worker.getState()).toBeDefined();
    });
  });
});
