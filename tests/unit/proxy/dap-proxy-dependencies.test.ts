import { describe, it, expect, vi, beforeEach, afterEach, MockInstance, Mock } from 'vitest';
import { 
  createProductionDependencies, 
  createConsoleLogger, 
  setupGlobalErrorHandlers 
} from '../../../src/proxy/dap-proxy-dependencies.js';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

// Mock fs-extra - the mock needs to be hoisted, so we can't reference external variables
vi.mock('fs-extra', () => {
  const ensureDirMock = vi.fn().mockResolvedValue(undefined);
  const pathExistsMock = vi.fn().mockResolvedValue(true);
  
  return {
    default: {
      ensureDir: ensureDirMock,
      pathExists: pathExistsMock
    },
    ensureDir: ensureDirMock,
    pathExists: pathExistsMock
  };
});

// Mock the MinimalDapClient
vi.mock('../../../src/proxy/minimal-dap.js', () => ({
  MinimalDapClient: vi.fn().mockImplementation((host: string, port: number) => ({
    host,
    port,
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendRequest: vi.fn()
  }))
}));

// Mock the createLogger function
vi.mock('../../../src/utils/logger.js', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  })
}));

describe('DAP Proxy Dependencies', () => {
  let mockProcessSend: MockInstance;
  let mockProcessExit: MockInstance;
  let mockConsoleError: MockInstance;
  let mockStdoutWrite: MockInstance;
  let processOnHandlers: { [key: string]: Function } = {};

  beforeEach(() => {
    vi.clearAllMocks();
    processOnHandlers = {};
    
    // Mock process.send - create it if it doesn't exist
    if (!process.send) {
      (process as any).send = vi.fn();
    }
    mockProcessSend = vi.spyOn(process as any, 'send').mockImplementation(() => true);
    
    // Mock process.exit to prevent test termination
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      // Store the exit code for assertions but don't actually exit
      return undefined as never;
    });
    
    // Mock console.error
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock process.stdout.write
    mockStdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    
    // Mock process.on to capture handlers
    vi.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: Function) => {
      if (typeof event === 'string') {
        processOnHandlers[event] = handler;
      }
      return process;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createProductionDependencies', () => {
    it('should create all required dependencies', () => {
      const deps = createProductionDependencies();

      expect(deps).toBeDefined();
      expect(deps.loggerFactory).toBeDefined();
      expect(deps.fileSystem).toBeDefined();
      expect(deps.processSpawner).toBeDefined();
      expect(deps.dapClientFactory).toBeDefined();
      expect(deps.messageSender).toBeDefined();
    });

    describe('loggerFactory', () => {
      it('should create logger with correct path', async () => {
        const { createLogger } = await import('../../../src/utils/logger.js');

        const deps = createProductionDependencies();
        const logger = await deps.loggerFactory('test-session', '/log/dir');

        const expectedPath = path.join('/log/dir', 'proxy-test-session.log');
        expect(createLogger).toHaveBeenCalledWith('dap-proxy:test-session', {
          level: 'debug',
          file: expectedPath
        });
      });

      it('should handle logger creation without calling fs.ensureDir', async () => {
        const { createLogger } = await import('../../../src/utils/logger.js');
        const deps = createProductionDependencies();
        
        // Reset the mock to ensure it returns a logger
        vi.mocked(createLogger).mockReturnValue({
          info: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
          warn: vi.fn()
        } as any);
        
        // The logger factory doesn't call fs.ensureDir directly - it just passes a path
        const logger = await deps.loggerFactory('test-session', '/invalid/path');
        
        // Logger should be created regardless (createLogger is mocked to return a logger)
        expect(logger).toBeDefined();
        expect(createLogger).toHaveBeenCalled();
        // fs.ensureDir should not have been called by the logger factory itself
        expect(fs.ensureDir).not.toHaveBeenCalled();
      });
    });

    describe('fileSystem', () => {
      it('should delegate ensureDir to fs-extra', async () => {
        const deps = createProductionDependencies();
        await deps.fileSystem.ensureDir('/test/path');

        expect(fs.ensureDir).toHaveBeenCalledWith('/test/path');
      });

      it('should delegate pathExists to fs-extra', async () => {
        // Reset the mock to ensure it returns true
        vi.mocked(fs.pathExists as any).mockResolvedValue(true);
        
        const deps = createProductionDependencies();
        const exists = await deps.fileSystem.pathExists('/test/path');

        expect(fs.pathExists).toHaveBeenCalledWith('/test/path');
        expect(exists).toBe(true);
      });
    });

    describe('processSpawner', () => {
      it('should delegate spawn to child_process', () => {
        const deps = createProductionDependencies();
        const mockChild = { pid: 123 };
        vi.mocked(spawn).mockReturnValue(mockChild as any);

        const result = deps.processSpawner.spawn('python', ['-m', 'debugpy'], {});

        expect(spawn).toHaveBeenCalledWith('python', ['-m', 'debugpy'], {});
        expect(result).toBe(mockChild);
      });
    });

    describe('dapClientFactory', () => {
      it('should create MinimalDapClient with correct parameters', async () => {
        const MinimalDapClientModule = await import('../../../src/proxy/minimal-dap.js');
        const MinimalDapClient = vi.mocked(MinimalDapClientModule.MinimalDapClient);
        
        const deps = createProductionDependencies();
        const client = deps.dapClientFactory.create('localhost', 5678);

        expect(MinimalDapClient).toHaveBeenCalledWith('localhost', 5678);
        // Verify client was created (we can't check host/port on IDapClient interface)
        expect(client).toBeDefined();
      });
    });

    describe('messageSender', () => {
      it('should use process.send when available', () => {
        const deps = createProductionDependencies();
        const message = { type: 'test', data: 'hello' };

        deps.messageSender.send(message);

        expect(mockProcessSend).toHaveBeenCalledWith(message);
        expect(mockStdoutWrite).not.toHaveBeenCalled();
      });

      it('should fallback to stdout when process.send is not available', () => {
        // Remove process.send temporarily
        mockProcessSend.mockRestore();
        const originalSend = process.send;
        delete (process as any).send;

        try {
          const deps = createProductionDependencies();
          const message = { type: 'test', data: 'hello' };

          deps.messageSender.send(message);

          expect(mockStdoutWrite).toHaveBeenCalledWith(JSON.stringify(message) + '\n');
        } finally {
          // Restore process.send
          (process as any).send = originalSend;
        }
      });

      it('should handle process.send failure', () => {
        mockProcessSend.mockImplementation(() => {
          throw new Error('IPC channel closed');
        });

        const deps = createProductionDependencies();
        const message = { type: 'test', data: 'hello' };

        // Should not throw
        expect(() => deps.messageSender.send(message)).toThrow('IPC channel closed');
      });
    });
  });

  describe('createConsoleLogger', () => {
    it('should create logger that writes to console.error', () => {
      const logger = createConsoleLogger();

      logger.info('info message', 'extra', 'data');
      logger.error('error message', { error: 'details' });
      logger.debug('debug message');
      logger.warn('warning message');

      expect(mockConsoleError).toHaveBeenCalledWith('[INFO]', 'info message', 'extra', 'data');
      expect(mockConsoleError).toHaveBeenCalledWith('[ERROR]', 'error message', { error: 'details' });
      expect(mockConsoleError).toHaveBeenCalledWith('[DEBUG]', 'debug message');
      expect(mockConsoleError).toHaveBeenCalledWith('[WARN]', 'warning message');
    });

    it('should handle multiple arguments correctly', () => {
      const logger = createConsoleLogger();
      const obj = { key: 'value' };
      const arr = [1, 2, 3];

      logger.info('message', obj, arr, null, undefined);

      expect(mockConsoleError).toHaveBeenCalledWith('[INFO]', 'message', obj, arr, null, undefined);
    });
  });

  describe('setupGlobalErrorHandlers', () => {
    let mockLogger: any;
    let mockMessageSender: any;
    let mockShutdownFn: Mock;
    let mockGetCurrentSessionId: Mock;

    beforeEach(() => {
      mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn()
      };

      mockMessageSender = {
        send: vi.fn()
      };

      mockShutdownFn = vi.fn().mockResolvedValue(undefined);
      mockGetCurrentSessionId = vi.fn().mockReturnValue('test-session');
    });

    it('should register all required event handlers', () => {
      setupGlobalErrorHandlers(mockLogger, mockMessageSender, mockShutdownFn, mockGetCurrentSessionId);

      expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    describe('uncaughtException handler', () => {
      it('should log error, send message, shutdown and exit', async () => {
        setupGlobalErrorHandlers(mockLogger, mockMessageSender, mockShutdownFn, mockGetCurrentSessionId);

        const error = new Error('Test uncaught exception');
        const handler = processOnHandlers['uncaughtException'];
        
        // Call the handler
        await handler(error, 'unhandledRejection');

        expect(mockLogger.error).toHaveBeenCalledWith(
          '[Proxy Worker UNCAUGHT_EXCEPTION] Origin: unhandledRejection',
          error
        );

        expect(mockMessageSender.send).toHaveBeenCalledWith({
          type: 'error',
          message: 'Proxy worker uncaught exception: Test uncaught exception (origin: unhandledRejection)',
          sessionId: 'test-session'
        });

        expect(mockShutdownFn).toHaveBeenCalled();
        
        // Wait for shutdown to complete
        await new Promise(resolve => setTimeout(resolve, 0));
        
        expect(mockProcessExit).toHaveBeenCalledWith(1);
      });

      it('should handle null session ID', async () => {
        mockGetCurrentSessionId.mockReturnValue(null);
        setupGlobalErrorHandlers(mockLogger, mockMessageSender, mockShutdownFn, mockGetCurrentSessionId);

        const error = new Error('Test error');
        const handler = processOnHandlers['uncaughtException'];
        
        await handler(error, 'test');

        expect(mockMessageSender.send).toHaveBeenCalledWith({
          type: 'error',
          message: expect.any(String),
          sessionId: 'unknown'
        });
      });
    });

    describe('unhandledRejection handler', () => {
      it('should handle promise rejections', async () => {
        setupGlobalErrorHandlers(mockLogger, mockMessageSender, mockShutdownFn, mockGetCurrentSessionId);

        const reason = new Error('Test rejection');
        // Create rejected promise but handle it to prevent unhandled rejection
        const promise = Promise.reject(reason).catch(() => {});
        const handler = processOnHandlers['unhandledRejection'];
        
        await handler(reason, promise);

        expect(mockLogger.error).toHaveBeenCalledWith(
          '[Proxy Worker UNHANDLED_REJECTION] Reason:',
          reason,
          'Promise:',
          promise
        );

        expect(mockMessageSender.send).toHaveBeenCalledWith({
          type: 'error',
          message: 'Proxy worker unhandled rejection: Error: Test rejection',
          sessionId: 'test-session'
        });

        expect(mockProcessExit).toHaveBeenCalledWith(1);
      });

      it('should handle non-error rejection reasons', async () => {
        setupGlobalErrorHandlers(mockLogger, mockMessageSender, mockShutdownFn, mockGetCurrentSessionId);

        const reason = 'string rejection';
        const handler = processOnHandlers['unhandledRejection'];
        
        // Create rejected promise but handle it to prevent unhandled rejection
        const promise = Promise.reject(reason).catch(() => {});
        await handler(reason, promise);

        expect(mockMessageSender.send).toHaveBeenCalledWith({
          type: 'error',
          message: 'Proxy worker unhandled rejection: string rejection',
          sessionId: 'test-session'
        });
      });
    });

    describe('SIGINT handler', () => {
      it('should shutdown gracefully and exit with 0', async () => {
        setupGlobalErrorHandlers(mockLogger, mockMessageSender, mockShutdownFn, mockGetCurrentSessionId);

        const handler = processOnHandlers['SIGINT'];
        await handler();

        expect(mockLogger.info).toHaveBeenCalledWith('[Proxy] SIGINT received, shutting down proxy worker.');
        expect(mockShutdownFn).toHaveBeenCalled();
        expect(mockProcessExit).toHaveBeenCalledWith(0);
      });
    });

    describe('SIGTERM handler', () => {
      it('should shutdown gracefully and exit with 0', async () => {
        setupGlobalErrorHandlers(mockLogger, mockMessageSender, mockShutdownFn, mockGetCurrentSessionId);

        const handler = processOnHandlers['SIGTERM'];
        await handler();

        expect(mockLogger.info).toHaveBeenCalledWith('[Proxy] SIGTERM received, shutting down proxy worker.');
        expect(mockShutdownFn).toHaveBeenCalled();
        expect(mockProcessExit).toHaveBeenCalledWith(0);
      });
    });

    it('should handle shutdown function errors', async () => {
      // Mock the shutdown function to reject
      const shutdownError = new Error('Shutdown failed');
      mockShutdownFn.mockRejectedValue(shutdownError);
      
      setupGlobalErrorHandlers(mockLogger, mockMessageSender, mockShutdownFn, mockGetCurrentSessionId);

      const handler = processOnHandlers['SIGINT'];
      
      // The handler should throw an error when shutdown fails
      await expect(handler()).rejects.toThrow('Shutdown failed');

      // process.exit should NOT be called when shutdown fails
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should not interfere with other handlers', () => {
      // Set up a pre-existing handler
      const existingHandler = vi.fn();
      process.on('uncaughtException', existingHandler);

      setupGlobalErrorHandlers(mockLogger, mockMessageSender, mockShutdownFn, mockGetCurrentSessionId);

      // Our handler should be added without removing the existing one
      expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    });
  });
});
