/**
 * Unit tests for DebugpyAdapterManager
 * Tests debugpy adapter process management including spawning, shutdown, and validation
 */
import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { DebugpyAdapterManager } from '../../../src/proxy/dap-proxy-process-manager.js';
import {
  IProcessSpawner,
  ILogger,
  IFileSystem,
  AdapterConfig
} from '../../../src/proxy/dap-proxy-interfaces.js';
import { ChildProcess } from 'child_process';

describe('DebugpyAdapterManager', () => {
  let mockProcessSpawner: IProcessSpawner;
  let mockLogger: ILogger;
  let mockFileSystem: IFileSystem;
  let manager: DebugpyAdapterManager;
  let mockChildProcess: any;

  beforeEach(() => {
    // Setup mock child process
    mockChildProcess = {
      pid: 12345,
      kill: vi.fn().mockReturnValue(true),
      unref: vi.fn(),
      on: vi.fn(),
      killed: false,
      stdout: null,
      stderr: null
    };

    // Setup mock process spawner
    mockProcessSpawner = {
      spawn: vi.fn().mockReturnValue(mockChildProcess)
    } as any;

    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    };

    // Setup mock file system
    mockFileSystem = {
      ensureDir: vi.fn().mockResolvedValue(undefined),
      pathExists: vi.fn().mockResolvedValue(true)
    } as any;

    // Create manager instance
    manager = new DebugpyAdapterManager(mockProcessSpawner, mockLogger, mockFileSystem);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.MCP_SERVER_CWD;
  });

  describe('buildSpawnCommand', () => {
    it('should build correct command with all parameters', () => {
      const result = manager.buildSpawnCommand(
        '/usr/bin/python3',
        'localhost',
        5678,
        '/var/log/debugpy'
      );

      expect(result).toEqual({
        command: '/usr/bin/python3',
        args: [
          '-m', 'debugpy.adapter',
          '--host', 'localhost',
          '--port', '5678',
          '--log-dir', '/var/log/debugpy'
        ]
      });
    });

    it('should handle different port numbers including edge cases', () => {
      // Test with minimum port
      const minPort = manager.buildSpawnCommand('python', '0.0.0.0', 1, '/logs');
      expect(minPort.args).toContain('1');

      // Test with maximum port
      const maxPort = manager.buildSpawnCommand('python', '0.0.0.0', 65535, '/logs');
      expect(maxPort.args).toContain('65535');

      // Test with common port
      const commonPort = manager.buildSpawnCommand('python', '0.0.0.0', 8080, '/logs');
      expect(commonPort.args).toContain('8080');
    });
  });

  describe('ensureLogDirectory', () => {
    it('should successfully create directory', async () => {
      await manager.ensureLogDirectory('/test/logs');

      expect(mockFileSystem.ensureDir).toHaveBeenCalledWith('/test/logs');
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AdapterManager] Ensured adapter log directory exists: /test/logs'
      );
    });

    it('should handle filesystem permission errors (lines 50-52)', async () => {
      const permissionError = new Error('EACCES: permission denied');
      (mockFileSystem.ensureDir as any).mockRejectedValue(permissionError);

      await expect(manager.ensureLogDirectory('/protected/logs'))
        .rejects.toThrow('Failed to create adapter log directory: EACCES: permission denied');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[AdapterManager] Failed to ensure adapter log directory /protected/logs:',
        permissionError
      );
    });

    it('should handle disk full errors (lines 50-52)', async () => {
      const diskError = new Error('ENOSPC: no space left on device');
      (mockFileSystem.ensureDir as any).mockRejectedValue(diskError);

      await expect(manager.ensureLogDirectory('/full/disk/logs'))
        .rejects.toThrow('Failed to create adapter log directory: ENOSPC: no space left on device');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[AdapterManager] Failed to ensure adapter log directory /full/disk/logs:',
        diskError
      );
    });

    it('should handle non-Error objects in catch block (lines 50-52)', async () => {
      (mockFileSystem.ensureDir as any).mockRejectedValue('string error');

      await expect(manager.ensureLogDirectory('/error/logs'))
        .rejects.toThrow('Failed to create adapter log directory: string error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[AdapterManager] Failed to ensure adapter log directory /error/logs:',
        'string error'
      );
    });
  });

  describe('spawn', () => {
    const defaultConfig: AdapterConfig = {
      pythonPath: '/usr/bin/python3',
      host: 'localhost',
      port: 5678,
      logDir: '/var/log/debugpy'
    };

    it('should successfully spawn with valid config', async () => {
      const result = await manager.spawn(defaultConfig);

      expect(mockFileSystem.ensureDir).toHaveBeenCalledWith(defaultConfig.logDir);
      expect(mockProcessSpawner.spawn).toHaveBeenCalledWith(
        defaultConfig.pythonPath,
        ['-m', 'debugpy.adapter', '--host', 'localhost', '--port', '5678', '--log-dir', '/var/log/debugpy'],
        expect.objectContaining({
          stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
          cwd: expect.any(String),
          env: process.env,
          detached: true
        })
      );
      expect(result).toEqual({
        process: mockChildProcess,
        pid: 12345
      });
    });

    it('should spawn with custom cwd and env', async () => {
      const customConfig: AdapterConfig = {
        ...defaultConfig,
        cwd: '/custom/working/dir',
        env: { ...process.env, CUSTOM_VAR: 'value' }
      };

      await manager.spawn(customConfig);

      expect(mockProcessSpawner.spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cwd: '/custom/working/dir',
          env: expect.objectContaining({ CUSTOM_VAR: 'value' })
        })
      );
    });

    it('should use MCP_SERVER_CWD environment variable if set', async () => {
      process.env.MCP_SERVER_CWD = '/mcp/custom/path';

      await manager.spawn(defaultConfig);

      expect(mockProcessSpawner.spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cwd: '/mcp/custom/path'
        })
      );
    });

    it('should handle spawn failure with no PID returned', async () => {
      mockChildProcess.pid = undefined;

      await expect(manager.spawn(defaultConfig))
        .rejects.toThrow('Failed to spawn debugpy adapter process or get PID');
    });

    it('should handle spawn returning null process', async () => {
      (mockProcessSpawner.spawn as any).mockReturnValue(null as any);

      await expect(manager.spawn(defaultConfig))
        .rejects.toThrow('Failed to spawn debugpy adapter process or get PID');
    });

    it('should verify unref() is called (line 93)', async () => {
      await manager.spawn(defaultConfig);

      expect(mockChildProcess.unref).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AdapterManager] Called unref() on adapter process PID: 12345'
      );
    });

    it('should handle spawn throwing error', async () => {
      const spawnError = new Error('Spawn failed');
      (mockProcessSpawner.spawn as any).mockImplementation(() => {
        throw spawnError;
      });

      await expect(manager.spawn(defaultConfig)).rejects.toThrow('Spawn failed');
    });

    it('should set up process handlers after spawn', async () => {
      await manager.spawn(defaultConfig);

      expect(mockChildProcess.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockChildProcess.on).toHaveBeenCalledWith('exit', expect.any(Function));
    });
  });

  describe('setupProcessHandlers', () => {
    it('should log process errors (line 114)', async () => {
      await manager.spawn({
        pythonPath: 'python',
        host: 'localhost',
        port: 5678,
        logDir: '/logs'
      });

      // Get the error handler that was registered
      const errorHandler = mockChildProcess.on.mock.calls
        .find(call => call[0] === 'error')?.[1];

      // Simulate error event
      const error = new Error('Process crashed');
      errorHandler(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[AdapterManager] Adapter process spawn error:',
        error
      );
    });

    it('should log process exit with code and signal (line 118)', async () => {
      await manager.spawn({
        pythonPath: 'python',
        host: 'localhost',
        port: 5678,
        logDir: '/logs'
      });

      // Get the exit handler that was registered
      const exitHandler = mockChildProcess.on.mock.calls
        .find(call => call[0] === 'exit')?.[1];

      // Test normal exit
      exitHandler(0, null);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AdapterManager] Adapter process exited. Code: 0, Signal: null'
      );

      // Test exit with error code
      exitHandler(1, null);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AdapterManager] Adapter process exited. Code: 1, Signal: null'
      );

      // Test exit with signal
      exitHandler(null, 'SIGTERM');
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AdapterManager] Adapter process exited. Code: null, Signal: SIGTERM'
      );
    });
  });

  describe('shutdown', () => {
    it('should handle null process gracefully', async () => {
      await manager.shutdown(null);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AdapterManager] No active adapter process to terminate.'
      );
      expect(mockChildProcess.kill).not.toHaveBeenCalled();
    });

    it('should handle process without PID', async () => {
      const processWithoutPid = { ...mockChildProcess, pid: undefined };
      
      await manager.shutdown(processWithoutPid);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AdapterManager] No active adapter process to terminate.'
      );
      expect(processWithoutPid.kill).not.toHaveBeenCalled();
    });

    it('should perform graceful shutdown with SIGTERM', async () => {
      // Process dies immediately after SIGTERM
      mockChildProcess.killed = false;
      mockChildProcess.kill.mockImplementation((signal: string) => {
        if (signal === 'SIGTERM') {
          mockChildProcess.killed = true;
        }
        return true;
      });

      await manager.shutdown(mockChildProcess);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AdapterManager] Attempting to terminate adapter process PID: 12345'
      );
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AdapterManager] Adapter process PID: 12345 exited after SIGTERM.'
      );
    });

    it('should force kill with SIGKILL if process doesnt die after SIGTERM (lines 127-128)', async () => {
      vi.useFakeTimers();
      
      // Process stays alive after SIGTERM
      mockChildProcess.killed = false;
      mockChildProcess.kill.mockReturnValue(true);

      const shutdownPromise = manager.shutdown(mockChildProcess);

      // First kill with SIGTERM
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AdapterManager] Sending SIGTERM to adapter process PID: 12345'
      );

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(300);

      // Should force kill with SIGKILL
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[AdapterManager] Adapter process PID: 12345 did not exit after SIGTERM. Sending SIGKILL.'
      );

      await shutdownPromise;
      vi.useRealTimers();
    });

    it('should handle already killed process', async () => {
      mockChildProcess.killed = true;

      await manager.shutdown(mockChildProcess);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AdapterManager] Adapter process PID: 12345 was already marked as killed.'
      );
      expect(mockChildProcess.kill).not.toHaveBeenCalled();
    });

    it('should handle kill throwing errors', async () => {
      const killError = new Error('ESRCH: No such process');
      mockChildProcess.kill.mockImplementation(() => {
        throw killError;
      });

      await manager.shutdown(mockChildProcess);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[AdapterManager] Error during adapter process termination (PID: 12345): ESRCH: No such process',
        killError
      );
    });

    it('should handle non-Error objects in catch block', async () => {
      mockChildProcess.kill.mockImplementation(() => {
        throw 'string error';
      });

      await manager.shutdown(mockChildProcess);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[AdapterManager] Error during adapter process termination (PID: 12345): string error',
        'string error'
      );
    });
  });

  describe('validatePythonPath', () => {
    it('should validate Python path by executing python --version (lines 145-171)', async () => {
      const mockValidateProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'exit') {
            // Simulate successful exit
            setTimeout(() => handler(0), 0);
          }
          return mockValidateProcess;
        }),
        stdout: null,
        stderr: null
      };
      (mockProcessSpawner.spawn as any).mockReturnValue(mockValidateProcess as any);

      const result = await manager.validatePythonPath('/usr/bin/python3');

      expect(mockProcessSpawner.spawn).toHaveBeenCalledWith(
        '/usr/bin/python3',
        ['--version'],
        { stdio: 'ignore' }
      );
      expect(result).toBe(true);
    });

    it('should return false for invalid Python path', async () => {
      const mockValidateProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'exit') {
            // Simulate failed exit
            setTimeout(() => handler(1), 0);
          }
          return mockValidateProcess;
        })
      };
      (mockProcessSpawner.spawn as any).mockReturnValue(mockValidateProcess as any);

      const result = await manager.validatePythonPath('/invalid/python');

      expect(result).toBe(false);
    });

    it('should handle spawn errors during validation', async () => {
      const mockValidateProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'error') {
            // Simulate spawn error
            setTimeout(() => handler(new Error('spawn ENOENT')), 0);
          }
          return mockValidateProcess;
        })
      };
      (mockProcessSpawner.spawn as any).mockReturnValue(mockValidateProcess as any);

      const result = await manager.validatePythonPath('/nonexistent/python');

      expect(result).toBe(false);
    });

    it('should handle different exit codes', async () => {
      const testCases = [
        { code: 0, expected: true },
        { code: 1, expected: false },
        { code: 127, expected: false },
        { code: -1, expected: false }
      ];

      for (const { code, expected } of testCases) {
        const mockValidateProcess = {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'exit') {
              setTimeout(() => handler(code), 0);
            }
            return mockValidateProcess;
          })
        };
        (mockProcessSpawner.spawn as any).mockReturnValue(mockValidateProcess as any);

        const result = await manager.validatePythonPath('/usr/bin/python');
        expect(result).toBe(expected);
      }
    });

    it('should handle both error and exit events', async () => {
      const mockValidateProcess = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'error') {
            // Error happens first
            setTimeout(() => handler(new Error('spawn error')), 0);
          } else if (event === 'exit') {
            // Exit happens later (should be ignored)
            setTimeout(() => handler(0), 10);
          }
          return mockValidateProcess;
        })
      };
      (mockProcessSpawner.spawn as any).mockReturnValue(mockValidateProcess as any);

      const result = await manager.validatePythonPath('/usr/bin/python');

      expect(result).toBe(false);
    });

    it('should handle spawn throwing exceptions', async () => {
      (mockProcessSpawner.spawn as any).mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      const result = await manager.validatePythonPath('/bad/python');

      expect(result).toBe(false);
    });

    it('should handle timeout/hanging processes', async () => {
      vi.useFakeTimers();

      const mockValidateProcess = {
        on: vi.fn(() => mockValidateProcess) // Never calls handlers
      };
      (mockProcessSpawner.spawn as any).mockReturnValue(mockValidateProcess as any);

      const validationPromise = manager.validatePythonPath('/hanging/python');

      // Advance time significantly
      await vi.advanceTimersByTimeAsync(10000);

      // Force the promise to resolve by triggering error handler
      const errorHandler = (mockValidateProcess.on as any).mock.calls
        .find((call: any) => call[0] === 'error')?.[1];
      if (errorHandler) {
        errorHandler(new Error('timeout'));
      }

      const result = await validationPromise;
      expect(result).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('integration scenarios', () => {
    it('should handle full lifecycle: spawn, error, and shutdown', async () => {
      // Spawn process
      const spawnResult = await manager.spawn({
        pythonPath: '/usr/bin/python3',
        host: 'localhost',
        port: 5678,
        logDir: '/var/log/debugpy'
      });

      expect(spawnResult.pid).toBe(12345);

      // Simulate process error
      const errorHandler = mockChildProcess.on.mock.calls
        .find(call => call[0] === 'error')?.[1];
      errorHandler(new Error('Connection refused'));

      // Shutdown process
      mockChildProcess.killed = false;
      mockChildProcess.kill.mockImplementation((signal: string) => {
        if (signal === 'SIGTERM') {
          mockChildProcess.killed = true;
        }
        return true;
      });

      await manager.shutdown(spawnResult.process);

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should handle multiple spawn attempts with same manager', async () => {
      // First spawn
      const firstResult = await manager.spawn({
        pythonPath: 'python',
        host: 'localhost',
        port: 5678,
        logDir: '/logs1'
      });

      // Second spawn with different config
      mockChildProcess.pid = 54321;
      const secondResult = await manager.spawn({
        pythonPath: 'python3',
        host: '0.0.0.0',
        port: 5679,
        logDir: '/logs2'
      });

      expect(firstResult.pid).toBe(12345);
      expect(secondResult.pid).toBe(54321);
      expect(mockProcessSpawner.spawn).toHaveBeenCalledTimes(2);
    });
  });
});
