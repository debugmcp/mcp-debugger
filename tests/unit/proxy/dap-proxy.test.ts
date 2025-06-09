import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import type { Readable, Writable } from 'stream';

// Import the actual core functionality
import { ProxyRunner, detectExecutionMode, shouldAutoExecute } from '../../../src/proxy/dap-proxy-core.js';
import { DapProxyWorker } from '../../../src/proxy/dap-proxy-worker.js';
import { MessageParser } from '../../../src/proxy/dap-proxy-message-parser.js';
import { ProxyState } from '../../../src/proxy/dap-proxy-interfaces.js';
import type { 
  DapProxyDependencies, 
  ILogger, 
  ParentCommand 
} from '../../../src/proxy/dap-proxy-interfaces.js';

// Mock readline
vi.mock('readline', () => ({
  default: {
    createInterface: vi.fn()
  }
}));

// Import mocked readline for assertions
import readline from 'readline';

describe('dap-proxy-core', () => {
  let mockDependencies: DapProxyDependencies;
  let mockLogger: ILogger;
  let mockWorker: any;
  let mockProcessOn: MockInstance;
  let mockProcessExit: MockInstance;
  let mockSetTimeout: MockInstance;
  let originalProcessSend: typeof process.send | undefined;

  beforeEach(() => {
    // Save original state
    originalProcessSend = process.send;
    
    // Mock dependencies
    mockDependencies = {
      loggerFactory: vi.fn(),
      fileSystem: { 
        ensureDir: vi.fn().mockResolvedValue(undefined), 
        pathExists: vi.fn().mockResolvedValue(true)
      },
      processSpawner: { spawn: vi.fn() },
      dapClientFactory: { create: vi.fn() },
      messageSender: { send: vi.fn() }
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    };

    // Mock DapProxyWorker
    mockWorker = {
      handleCommand: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockReturnValue(ProxyState.CONNECTED),
      currentSessionId: 'test-session-123'
    };
    vi.spyOn(DapProxyWorker.prototype, 'handleCommand').mockImplementation(mockWorker.handleCommand);
    vi.spyOn(DapProxyWorker.prototype, 'shutdown').mockImplementation(mockWorker.shutdown);
    vi.spyOn(DapProxyWorker.prototype, 'getState').mockImplementation(mockWorker.getState);
    
    // Mock process methods
    mockProcessOn = vi.spyOn(process, 'on').mockImplementation(() => process);
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      // Don't actually exit or throw, just track the call
      return undefined as never;
    });
    mockSetTimeout = vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
      return { id: 1 } as any;
    });
    
    // Mock MessageParser
    vi.spyOn(MessageParser, 'parseCommand').mockImplementation((message: unknown) => {
      const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
      return JSON.parse(msgStr);
    });
    vi.spyOn(MessageParser, 'getErrorMessage').mockImplementation((error: unknown) => {
      if (error instanceof Error) return error.message;
      return String(error);
    });
    
    // Setup readline mock properly
    const mockRl = {
      on: vi.fn(),
      close: vi.fn()
    };
    (readline.createInterface as any).mockReturnValue(mockRl);
  });

  afterEach(() => {
    // Restore original state
    if (originalProcessSend === undefined) {
      delete (process as any).send;
    } else {
      Object.defineProperty(process, 'send', {
        value: originalProcessSend,
        configurable: true,
        writable: true
      });
    }
    
    vi.restoreAllMocks();
  });

  describe('ProxyRunner', () => {
    let runner: ProxyRunner;

    beforeEach(() => {
      runner = new ProxyRunner(mockDependencies, mockLogger);
    });

    describe('start', () => {
      it('should start with IPC when available', async () => {
        // Mock process.send
        Object.defineProperty(process, 'send', { 
          value: vi.fn(), 
          configurable: true,
          writable: true
        });

        await runner.start();

        expect(mockLogger.info).toHaveBeenCalledWith('[ProxyRunner] Starting proxy runner...');
        expect(mockLogger.info).toHaveBeenCalledWith('[ProxyRunner] Setting up IPC communication');
        expect(mockLogger.info).toHaveBeenCalledWith('[ProxyRunner] Ready to receive commands');
        expect(mockProcessOn).toHaveBeenCalledWith('message', expect.any(Function));
      });

      it('should start with stdin when IPC not available', async () => {
        // Remove process.send
        delete (process as any).send;

        await runner.start();

        expect(mockLogger.info).toHaveBeenCalledWith('[ProxyRunner] Starting proxy runner...');
        expect(mockLogger.info).toHaveBeenCalledWith('[ProxyRunner] Setting up stdin/readline communication');
        expect(mockLogger.info).toHaveBeenCalledWith('[ProxyRunner] Ready to receive commands');
        expect(readline.createInterface).toHaveBeenCalled();
      });

      it('should use custom message handler when provided', async () => {
        const customHandler = vi.fn();
        const customRunner = new ProxyRunner(mockDependencies, mockLogger, {
          onMessage: customHandler
        });

        Object.defineProperty(process, 'send', { 
          value: vi.fn(), 
          configurable: true,
          writable: true
        });

        await customRunner.start();
        
        // Trigger message
        const messageHandler = mockProcessOn.mock.calls.find(call => call[0] === 'message')?.[1];
        await messageHandler?.('test message');

        expect(customHandler).toHaveBeenCalledWith('test message');
      });

      it('should throw error if already running', async () => {
        await runner.start();
        await expect(runner.start()).rejects.toThrow('Proxy runner is already running');
      });

      it('should handle start errors', async () => {
        // Mock error in readline
        (readline.createInterface as any).mockImplementation(() => {
          throw new Error('Test error');
        });

        delete (process as any).send;

        await expect(runner.start()).rejects.toThrow('Test error');
        expect(mockLogger.error).toHaveBeenCalledWith('[ProxyRunner] Failed to start:', expect.any(Error));
      });
    });

    describe('stop', () => {
      it('should stop runner and clean up resources', async () => {
        Object.defineProperty(process, 'send', { 
          value: vi.fn(), 
          configurable: true,
          writable: true
        });

        await runner.start();
        await runner.stop();

        expect(mockLogger.info).toHaveBeenCalledWith('[ProxyRunner] Stopping proxy runner...');
        expect(mockWorker.shutdown).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith('[ProxyRunner] Stopped');
      });

      it('should close readline when using stdin', async () => {
        delete (process as any).send;
        const mockRl = readline.createInterface({} as any);

        await runner.start();
        await runner.stop();

        expect(mockRl.close).toHaveBeenCalled();
      });

      it('should do nothing if not running', async () => {
        await runner.stop();
        expect(mockLogger.info).not.toHaveBeenCalledWith('[ProxyRunner] Stopping proxy runner...');
      });
    });

    describe('message processing', () => {
      beforeEach(async () => {
        Object.defineProperty(process, 'send', { 
          value: vi.fn(), 
          configurable: true,
          writable: true
        });
        await runner.start();
      });

      it('should process string messages from IPC', async () => {
        const messageHandler = mockProcessOn.mock.calls.find(call => call[0] === 'message')?.[1];
        const testCommand = { cmd: 'init', sessionId: 'test123' };
        
        await messageHandler?.(JSON.stringify(testCommand));
        
        expect(mockLogger.info).toHaveBeenCalledWith(
          '[ProxyRunner] Received message (first 200 chars): {"cmd":"init","sessionId":"test123"}...'
        );
        expect(MessageParser.parseCommand).toHaveBeenCalledWith(JSON.stringify(testCommand));
        expect(mockWorker.handleCommand).toHaveBeenCalledWith(testCommand);
      });

      it('should process object messages by stringifying', async () => {
        const messageHandler = mockProcessOn.mock.calls.find(call => call[0] === 'message')?.[1];
        const testCommand = { cmd: 'dap', sessionId: 'test123', requestId: '1', dapCommand: 'test' };
        
        await messageHandler?.(testCommand);
        
        expect(mockLogger.debug).toHaveBeenCalledWith(
          '[ProxyRunner] Received object message, stringifying:',
          testCommand
        );
        expect(MessageParser.parseCommand).toHaveBeenCalledWith(JSON.stringify(testCommand));
        expect(mockWorker.handleCommand).toHaveBeenCalledWith(testCommand);
      });

      it('should handle command parsing errors', async () => {
        const messageHandler = mockProcessOn.mock.calls.find(call => call[0] === 'message')?.[1];
        const parseError = new Error('Invalid JSON');
        
        (MessageParser.parseCommand as any).mockImplementation(() => {
          throw parseError;
        });
        
        await messageHandler?.('invalid json');
        
        expect(mockLogger.error).toHaveBeenCalledWith(
          '[ProxyRunner] Error processing message:',
          { error: 'Invalid JSON' }
        );
        expect(mockDependencies.messageSender.send).toHaveBeenCalledWith({
          type: 'error',
          message: 'Proxy error processing command: Invalid JSON',
          sessionId: 'unknown'
        });
      });

      it('should handle worker state TERMINATED', async () => {
        const messageHandler = mockProcessOn.mock.calls.find(call => call[0] === 'message')?.[1];
        const testCommand = { cmd: 'terminate', sessionId: 'test123' };
        
        mockWorker.getState.mockReturnValue(ProxyState.TERMINATED);
        
        await messageHandler?.(JSON.stringify(testCommand));
        
        expect(mockLogger.info).toHaveBeenCalledWith(
          '[ProxyRunner] Worker state is TERMINATED. Exiting in 0ms.'
        );
        expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
      });

      it('should handle worker state TERMINATED with dry-run', async () => {
        const messageHandler = mockProcessOn.mock.calls.find(call => call[0] === 'message')?.[1];
        const testCommand = { cmd: 'init', sessionId: 'test123', dryRunSpawn: true };
        
        mockWorker.getState.mockReturnValue(ProxyState.TERMINATED);
        
        await messageHandler?.(JSON.stringify(testCommand));
        
        expect(mockLogger.info).toHaveBeenCalledWith(
          '[ProxyRunner] Worker state is TERMINATED. Exiting in 500ms.'
        );
        expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 500);
      });
    });

    describe('global error handlers', () => {
      it('should set up all error handlers', () => {
        const errorShutdown = vi.fn().mockResolvedValue(undefined);
        const getCurrentSessionId = vi.fn().mockReturnValue('test-session');

        runner.setupGlobalErrorHandlers(errorShutdown, getCurrentSessionId);

        expect(mockProcessOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
        expect(mockProcessOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
        expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
        expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      });

      it('should handle uncaught exceptions', async () => {
        const errorShutdown = vi.fn().mockResolvedValue(undefined);
        const getCurrentSessionId = vi.fn().mockReturnValue('test-session');

        runner.setupGlobalErrorHandlers(errorShutdown, getCurrentSessionId);

        const handler = mockProcessOn.mock.calls.find(call => call[0] === 'uncaughtException')?.[1];
        expect(handler).toBeDefined();
        
        const testError = new Error('Test uncaught exception');

        // The handler is async and eventually calls process.exit
        // We need to wait for the promise to be handled
        const handlerPromise = handler!(testError);
        
        // Wait for all microtasks to complete
        await new Promise(resolve => setImmediate(resolve));

        expect(mockLogger.error).toHaveBeenCalledWith('[ProxyRunner] Uncaught exception:', testError);
        expect(mockDependencies.messageSender.send).toHaveBeenCalledWith({
          type: 'error',
          message: 'Proxy uncaught exception: Test uncaught exception',
          sessionId: 'test-session'
        });
        expect(errorShutdown).toHaveBeenCalled();
        
        // The process.exit should have been called
        expect(mockProcessExit).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('detectExecutionMode', () => {
    it('should detect IPC presence', () => {
      Object.defineProperty(process, 'send', { 
        value: vi.fn(), 
        configurable: true,
        writable: true
      });

      const mode = detectExecutionMode();
      expect(mode.hasIPC).toBe(true);
    });

    it('should detect worker environment', () => {
      process.env.DAP_PROXY_WORKER = 'true';
      const mode = detectExecutionMode();
      expect(mode.isWorkerEnv).toBe(true);
      delete process.env.DAP_PROXY_WORKER;
    });
  });

  describe('shouldAutoExecute', () => {
    it('should return true when any condition is met', () => {
      expect(shouldAutoExecute({ isDirectRun: true, hasIPC: false, isWorkerEnv: false })).toBe(true);
      expect(shouldAutoExecute({ isDirectRun: false, hasIPC: true, isWorkerEnv: false })).toBe(true);
      expect(shouldAutoExecute({ isDirectRun: false, hasIPC: false, isWorkerEnv: true })).toBe(true);
    });

    it('should return false when no conditions are met', () => {
      expect(shouldAutoExecute({ isDirectRun: false, hasIPC: false, isWorkerEnv: false })).toBe(false);
    });
  });

  describe('exports', () => {
    it('should export all required components from dap-proxy.ts', async () => {
      const module = await import('../../../src/proxy/dap-proxy.js');
      
      expect(module.ProxyRunner).toBeDefined();
      expect(module.DapProxyWorker).toBeDefined();
      expect(module.detectExecutionMode).toBeDefined();
      expect(module.shouldAutoExecute).toBeDefined();
      expect(module.createProductionDependencies).toBeDefined();
      expect(module.createConsoleLogger).toBeDefined();
      expect(module.MessageParser).toBeDefined();
      expect(module.ProxyState).toBeDefined();
    });
  });
});
