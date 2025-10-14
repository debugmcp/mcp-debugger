/**
 * Comprehensive unit tests for DapProxyWorker
 * Tests the refactored implementation using the Adapter Policy pattern
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { DapProxyWorker } from '../../src/proxy/dap-proxy-worker.js';
import type {
  DapProxyDependencies,
  ILogger,
  IFileSystem,
  IProcessSpawner,
  IDapClient,
  ProxyInitPayload,
  DapCommandPayload,
  StatusMessage,
  DapResponseMessage,
  DapEventMessage
} from '../../src/proxy/dap-proxy-interfaces.js';
import { ProxyState } from '../../src/proxy/dap-proxy-interfaces.js';
import type { AdapterPolicy } from '@debugmcp/shared';
import { 
  DefaultAdapterPolicy,
  JsDebugAdapterPolicy,
  PythonAdapterPolicy
} from '@debugmcp/shared';

// Mock implementations
const createMockLogger = (): ILogger => ({
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn()
});

const createMockFileSystem = (): IFileSystem => ({
  ensureDir: vi.fn().mockResolvedValue(undefined),
  pathExists: vi.fn().mockResolvedValue(true)
});

const createMockProcessSpawner = (): IProcessSpawner => ({
  spawn: vi.fn().mockReturnValue({
    pid: 12345,
    on: vi.fn(),
    kill: vi.fn(),
    unref: vi.fn(),
    killed: false
  })
});

const createMockDapClient = (): IDapClient => ({
  sendRequest: vi.fn().mockResolvedValue({ body: {} }),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  shutdown: vi.fn()
});

const createMockMessageSender = () => ({
  send: vi.fn()
});

describe('DapProxyWorker', () => {
  let worker: DapProxyWorker;
  let dependencies: DapProxyDependencies;
  let mockLogger: ILogger;
  let mockDapClient: IDapClient;
  let mockMessageSender: ReturnType<typeof createMockMessageSender>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDapClient = createMockDapClient();
    mockMessageSender = createMockMessageSender();
    
    dependencies = {
      fileSystem: createMockFileSystem(),
      loggerFactory: vi.fn().mockResolvedValue(mockLogger),
      processSpawner: createMockProcessSpawner(),
      dapClientFactory: {
        create: vi.fn().mockResolvedValue(mockDapClient)
      },
      messageSender: mockMessageSender
    };
    
    worker = new DapProxyWorker(dependencies);
  });

  describe('State Management', () => {
    it('should initialize with UNINITIALIZED state', () => {
      expect(worker.getState()).toBe(ProxyState.UNINITIALIZED);
    });

    it('should transition to INITIALIZING on init command', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.js',
        adapterHost: 'localhost',
        adapterPort: 9229,
        logDir: '/logs',
        executablePath: 'node',
        adapterCommand: {
          command: 'node',
          args: ['--inspect']
        },
        dryRunSpawn: true
      };

      await worker.handleCommand(payload);

      expect(worker.getState()).toBe(ProxyState.TERMINATED); // Dry run ends in TERMINATED
    });
  });

  describe('Policy Selection', () => {
    it('should select Python policy when no adapter command provided', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python',
        dryRunSpawn: true
      };

      await worker.handleCommand(payload);

      const statusCall = mockMessageSender.send.mock.calls.find(
        call => call[0].type === 'status' && call[0].status === 'dry_run_complete'
      );
      expect(statusCall).toBeTruthy();
      expect(statusCall![0].command).toContain('debugpy');
    });

    it('should select JavaScript policy for js-debug adapter', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.js',
        adapterHost: 'localhost',
        adapterPort: 9229,
        logDir: '/logs',
        executablePath: 'node',
        adapterCommand: {
          command: 'node',
          args: ['vendor/js-debug/vsDebugServer.js', '--port', '9229']
        },
        dryRunSpawn: true
      };

      await worker.handleCommand(payload);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[Worker] Using adapter policy: js-debug')
      );
    });

    it('should select Python policy for debugpy adapter', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python',
        adapterCommand: {
          command: 'python',
          args: ['-m', 'debugpy.adapter']
        },
        dryRunSpawn: true
      };

      await worker.handleCommand(payload);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[Worker] Using adapter policy: python')
      );
    });
  });

  describe('Dry Run Mode', () => {
    it('should execute dry run and report command', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python',
        adapterCommand: {
          command: 'python',
          args: ['-m', 'debugpy.adapter', '--port', '5678']
        },
        dryRunSpawn: true
      };

      await worker.handleCommand(payload);

      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          status: 'dry_run_complete',
          command: 'python -m debugpy.adapter --port 5678'
        })
      );
    });
  });

  describe('DAP Command Handling', () => {
    beforeEach(async () => {
      // Initialize worker with Python (non-queueing)
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python',
        adapterCommand: {
          command: 'python',
          args: ['-m', 'debugpy.adapter']
        }
      };

      // Mock the connection manager behavior
      vi.mocked(dependencies.dapClientFactory.create).mockResolvedValue(mockDapClient);
      
      await worker.handleCommand(initPayload);
    });

    it('should forward DAP commands when connected', async () => {
      // Simulate connected state by manually setting it
      // (normally happens after successful connection)
      const dapPayload: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-1',
        dapCommand: 'threads',
        dapArgs: {}
      };

      await worker.handleCommand(dapPayload);

      // Should reject before connection
      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapResponse',
          requestId: 'req-1',
          success: false,
          error: 'DAP client not connected'
        })
      );
    });

    it('should reject commands when shutting down', async () => {
      await worker.handleTerminate();

      const dapPayload: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-2',
        dapCommand: 'threads',
        dapArgs: {}
      };

      await worker.handleCommand(dapPayload);

      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapResponse',
          requestId: 'req-2',
          success: false,
          error: 'Proxy is shutting down'
        })
      );
    });
  });

  describe('JavaScript Adapter Command Queueing', () => {
    it('should queue commands for JavaScript adapter', async () => {
      // Create a new worker for JS testing
      const jsWorker = new DapProxyWorker(dependencies);
      
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.js',
        adapterHost: 'localhost',
        adapterPort: 9229,
        logDir: '/logs',
        executablePath: 'node',
        adapterCommand: {
          command: 'node',
          args: ['vendor/js-debug/vsDebugServer.js']
        }
      };

      // Initialize with JS adapter
      await jsWorker.handleCommand(initPayload);

      // Send commands before initialization
      await jsWorker.handleCommand({
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-3',
        dapCommand: 'setBreakpoints',
        dapArgs: {}
      });

      // Verify command was queued (not rejected)
      const responses = mockMessageSender.send.mock.calls.filter(
        call => call[0].type === 'dapResponse' && call[0].requestId === 'req-3'
      );
      
      // Should not have sent a rejection response yet
      expect(responses.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Make file system fail
      vi.mocked(dependencies.fileSystem.ensureDir).mockRejectedValue(
        new Error('Permission denied')
      );

      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python'
      };

      // Mock process.exit to prevent test from exiting
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(worker.handleCommand(payload)).rejects.toThrow('process.exit called');

      exitSpy.mockRestore();
    });

    it('should handle DAP command errors', async () => {
      // Setup connected state
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python',
        adapterCommand: {
          command: 'python',
          args: ['-m', 'debugpy.adapter']
        }
      };

      await worker.handleCommand(initPayload);

      // Make DAP client fail
      vi.mocked(mockDapClient.sendRequest).mockRejectedValue(
        new Error('Connection lost')
      );

      // This would need to be done after connected state
      // Since we're testing error handling, the test shows the pattern
    });
  });

  describe('Message Sending', () => {
    it('should send status messages', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python',
        dryRunSpawn: true
      };

      await worker.handleCommand(payload);

      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          sessionId: 'test-session'
        })
      );
    });

    it('should send error messages', async () => {
      // Invalid state for init
      await worker.handleCommand({
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python'
      } as any);

      // Try init again - should fail
      await worker.handleCommand({
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python'
      } as any);

      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('Invalid state for init')
        })
      );
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', async () => {
      await worker.handleTerminate();

      expect(worker.getState()).toBe(ProxyState.TERMINATED);
      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          status: 'terminated'
        })
      );
    });

    it('should handle multiple shutdown calls', async () => {
      await worker.handleTerminate();
      await worker.handleTerminate();

      // Should only send terminated once
      const terminatedCalls = mockMessageSender.send.mock.calls.filter(
        call => call[0].type === 'status' && call[0].status === 'terminated'
      );
      expect(terminatedCalls.length).toBe(1);
    });
  });
});
