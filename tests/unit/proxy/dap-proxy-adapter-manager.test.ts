/**
 * Unit tests for GenericAdapterManager
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { GenericAdapterManager } from '../../../src/proxy/dap-proxy-adapter-manager.js';
import type { IProcessSpawner, ILogger, IFileSystem } from '../../../src/proxy/dap-proxy-interfaces.js';

function createMockLogger(): ILogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  };
}

function createMockFileSystem(): IFileSystem {
  return {
    ensureDir: vi.fn().mockResolvedValue(undefined),
    pathExists: vi.fn().mockResolvedValue(true)
  };
}

function createMockProcess(pid = 12345) {
  const proc = new EventEmitter() as any;
  proc.pid = pid;
  proc.killed = false;
  proc.kill = vi.fn();
  proc.unref = vi.fn();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
}

describe('GenericAdapterManager', () => {
  let manager: GenericAdapterManager;
  let logger: ILogger;
  let fileSystem: IFileSystem;
  let spawner: IProcessSpawner;
  let mockProcess: any;

  beforeEach(() => {
    logger = createMockLogger();
    fileSystem = createMockFileSystem();
    mockProcess = createMockProcess();
    spawner = { spawn: vi.fn().mockReturnValue(mockProcess) };
    manager = new GenericAdapterManager(spawner, logger, fileSystem);
  });

  describe('ensureLogDirectory', () => {
    it('creates the log directory', async () => {
      await manager.ensureLogDirectory('/logs/test');
      expect(fileSystem.ensureDir).toHaveBeenCalledWith('/logs/test');
    });

    it('throws on failure with clear message', async () => {
      (fileSystem.ensureDir as any).mockRejectedValue(new Error('EACCES'));
      await expect(manager.ensureLogDirectory('/logs/test'))
        .rejects.toThrow('Failed to create adapter log directory: EACCES');
    });
  });

  describe('spawn', () => {
    it('spawns adapter process and returns pid', async () => {
      const result = await manager.spawn({
        command: 'python',
        args: ['-m', 'debugpy.adapter'],
        logDir: '/logs'
      });

      expect(result.pid).toBe(12345);
      expect(result.process).toBe(mockProcess);
      expect(spawner.spawn).toHaveBeenCalledWith(
        'python',
        ['-m', 'debugpy.adapter'],
        expect.objectContaining({ detached: true })
      );
    });

    it('sets cwd when provided', async () => {
      await manager.spawn({
        command: 'dlv',
        args: ['dap'],
        logDir: '/logs',
        cwd: '/workspace'
      });

      expect(spawner.spawn).toHaveBeenCalledWith(
        'dlv',
        ['dap'],
        expect.objectContaining({ cwd: '/workspace' })
      );
    });

    it('throws when spawn returns no pid', async () => {
      (spawner.spawn as any).mockReturnValue({ pid: undefined });

      await expect(manager.spawn({
        command: 'bad-cmd',
        args: [],
        logDir: '/logs'
      })).rejects.toThrow('Failed to spawn adapter process or get PID');
    });

    it('handles unref errors gracefully', async () => {
      mockProcess.unref.mockImplementation(() => { throw new Error('unref failed'); });

      // Should not throw
      const result = await manager.spawn({
        command: 'python',
        args: [],
        logDir: '/logs'
      });
      expect(result.pid).toBe(12345);
    });

    it('captures stderr output', async () => {
      await manager.spawn({
        command: 'python',
        args: [],
        logDir: '/logs'
      });

      mockProcess.stderr.emit('data', Buffer.from('warning: something\n'));
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('STDERR'),
        // Not exact match - just that it was called
      );
    });
  });

  describe('shutdown', () => {
    it('returns early for null process', async () => {
      await manager.shutdown(null);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('No active adapter process')
      );
    });

    it('returns early for process without pid', async () => {
      await manager.shutdown({ pid: undefined } as any);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('No active adapter process')
      );
    });

    it('sends SIGTERM and reports graceful exit', async () => {
      vi.useFakeTimers();

      const proc = createMockProcess(999);
      // Simulate process exiting after SIGTERM
      proc.kill.mockImplementation(() => {
        process.nextTick(() => proc.emit('exit', 0, null));
      });

      const shutdownPromise = manager.shutdown(proc);
      await vi.advanceTimersByTimeAsync(300);
      await shutdownPromise;

      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('exited after SIGTERM')
      );

      vi.useRealTimers();
    });

    it('escalates to SIGKILL if process does not exit', async () => {
      vi.useFakeTimers();

      const proc = createMockProcess(999);
      // Process doesn't exit after SIGTERM

      const shutdownPromise = manager.shutdown(proc);
      await vi.advanceTimersByTimeAsync(300);
      await shutdownPromise;

      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
      expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('did not exit after SIGTERM')
      );

      vi.useRealTimers();
    });

    it('skips kill for already-killed process', async () => {
      const proc = createMockProcess(999);
      proc.killed = true;

      await manager.shutdown(proc);

      expect(proc.kill).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('already marked as killed')
      );
    });

    it('handles kill errors gracefully', async () => {
      const proc = createMockProcess(999);
      proc.kill.mockImplementation(() => { throw new Error('ESRCH'); });

      // Should not throw
      await manager.shutdown(proc);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during adapter process termination'),
        expect.anything()
      );
    });
  });
});
