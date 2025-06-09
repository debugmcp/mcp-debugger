import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { 
  ProcessLauncherImpl,
  ProcessLauncherFactoryImpl
} from '../../../src/implementations/process-launcher-impl';
import { ProcessManagerImpl } from '../../../src/implementations/process-manager-impl';
import type { IChildProcess } from '../../../src/interfaces/external-dependencies';
import type { IProcess } from '../../../src/interfaces/process-interfaces';

// Mock child process type
interface MockChildProcess extends EventEmitter, IChildProcess {
  pid?: number;
  stdin: NodeJS.WritableStream | null;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  killed: boolean;
  exitCode: number | null;
  signalCode: string | null;
  kill: (signal?: string) => boolean;
  send: (message: any) => boolean;
}

// Test helper for creating mock processes
function createMockProcess(pid = 12345): MockChildProcess {
  const proc = new EventEmitter() as MockChildProcess;
  proc.pid = pid;
  proc.killed = false;
  proc.exitCode = null;
  proc.signalCode = null;
  proc.kill = vi.fn().mockImplementation((signal?: string) => {
    if (proc.killed) {
      return false; // Already dead
    }
    proc.killed = true;
    process.nextTick(() => proc.emit('exit', 0, signal || 'SIGTERM'));
    return true;
  });
  proc.send = vi.fn().mockReturnValue(true);
  proc.stdin = new EventEmitter() as any;
  proc.stdout = new EventEmitter() as any;
  proc.stderr = new EventEmitter() as any;
  return proc;
}

describe('ProcessAdapter', () => {
  let processLauncher: ProcessLauncherImpl;
  let processManager: ProcessManagerImpl;
  let mockChildProcess: MockChildProcess;
  let createdProcesses: IProcess[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    
    mockChildProcess = createMockProcess();
    processManager = new ProcessManagerImpl();
    vi.spyOn(processManager, 'spawn').mockReturnValue(mockChildProcess);
    
    processLauncher = new ProcessLauncherImpl(processManager);
    createdProcesses = [];
  });

  afterEach(async () => {
    // Clean up any lingering processes
    for (const proc of createdProcesses) {
      if (proc && !proc.killed) {
        proc.kill();
      }
    }
    createdProcesses = [];
    
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Basic Process Launch', () => {
    it('should launch a process with correct parameters', () => {
      const process = processLauncher.launch('node', ['script.js'], { cwd: '/test' });
      createdProcesses.push(process);

      expect(processManager.spawn).toHaveBeenCalledWith(
        'node',
        ['script.js'],
        { cwd: '/test' }
      );
      expect(process.pid).toBe(12345);
    });

    it('should provide access to process streams', () => {
      const process = processLauncher.launch('node', ['script.js']);
      createdProcesses.push(process);

      expect(process.stdin).toBe(mockChildProcess.stdin);
      expect(process.stdout).toBe(mockChildProcess.stdout);
      expect(process.stderr).toBe(mockChildProcess.stderr);
    });
  });

  describe('Event Forwarding', () => {
    it('should forward exit event with code and signal', () => {
      const process = processLauncher.launch('node', ['script.js']);
      createdProcesses.push(process);
      
      const exitHandler = vi.fn();
      process.on('exit', exitHandler);

      mockChildProcess.emit('exit', 1, 'SIGTERM');

      expect(exitHandler).toHaveBeenCalledWith(1, 'SIGTERM');
      expect(process.exitCode).toBe(1);
      expect(process.signalCode).toBe('SIGTERM');
    });

    it('should forward close event', () => {
      const process = processLauncher.launch('node', ['script.js']);
      createdProcesses.push(process);
      
      const closeHandler = vi.fn();
      process.on('close', closeHandler);

      mockChildProcess.emit('close', 0, null);

      expect(closeHandler).toHaveBeenCalledWith(0, null);
    });

    it('should forward error event', () => {
      const process = processLauncher.launch('node', ['script.js']);
      createdProcesses.push(process);
      
      const errorHandler = vi.fn();
      process.on('error', errorHandler);

      const error = new Error('spawn failed');
      mockChildProcess.emit('error', error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it('should forward spawn event', () => {
      const process = processLauncher.launch('node', ['script.js']);
      createdProcesses.push(process);
      
      const spawnHandler = vi.fn();
      process.on('spawn', spawnHandler);

      mockChildProcess.emit('spawn');

      expect(spawnHandler).toHaveBeenCalled();
    });

    it('should forward message event', () => {
      const process = processLauncher.launch('node', ['script.js']);
      createdProcesses.push(process);
      
      const messageHandler = vi.fn();
      process.on('message', messageHandler);

      const message = { type: 'test', data: 'hello' };
      mockChildProcess.emit('message', message);

      expect(messageHandler).toHaveBeenCalledWith(message);
    });
  });

  describe('Process Control', () => {
    it('should send messages to child process', () => {
      const process = processLauncher.launch('node', ['script.js']);
      createdProcesses.push(process);

      const message = { command: 'test' };
      const result = process.send(message);

      expect(mockChildProcess.send).toHaveBeenCalledWith(message);
      expect(result).toBe(true);
    });

    it('should kill process with signal', () => {
      const process = processLauncher.launch('node', ['script.js']);
      createdProcesses.push(process);

      const result = process.kill('SIGKILL');

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
      expect(result).toBe(true);
    });

    it('should kill process without signal', () => {
      const process = processLauncher.launch('node', ['script.js']);
      createdProcesses.push(process);

      const result = process.kill();

      expect(mockChildProcess.kill).toHaveBeenCalledWith(undefined);
      expect(result).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle killing an already-dead process', () => {
      const process = processLauncher.launch('node', ['script.js']);
      createdProcesses.push(process);

      // First kill succeeds
      expect(process.kill()).toBe(true);
      expect(process.killed).toBe(true);

      // Second kill fails (process already dead)
      expect(process.kill()).toBe(false);
    });

    it('should handle sending messages to an exiting process', () => {
      const process = processLauncher.launch('node', ['script.js']);
      createdProcesses.push(process);

      // Mock send to fail when process is killed
      mockChildProcess.send = vi.fn().mockImplementation(() => {
        return !mockChildProcess.killed;
      });

      // Send message while alive
      expect(process.send({ test: 1 })).toBe(true);

      // Kill process
      process.kill();

      // Send message after kill
      expect(process.send({ test: 2 })).toBe(false);
    });

    it('should handle process exit during message send', async () => {
      const process = processLauncher.launch('node', ['script.js']);
      createdProcesses.push(process);

      let sendCount = 0;
      mockChildProcess.send = vi.fn().mockImplementation(() => {
        sendCount++;
        if (sendCount === 2) {
          // Emit exit during second send
          globalThis.process.nextTick(() => {
            mockChildProcess.killed = true;
            mockChildProcess.emit('exit', 1, null);
          });
        }
        return !mockChildProcess.killed;
      });

      // First send succeeds
      expect(process.send({ test: 1 })).toBe(true);

      // Second send triggers exit
      expect(process.send({ test: 2 })).toBe(true);

      // Wait for exit event
      await vi.runAllTimersAsync();

      // Third send fails (process exited)
      expect(process.send({ test: 3 })).toBe(false);
      expect(process.exitCode).toBe(1);
    });

    it('should track killed state correctly', () => {
      const process = processLauncher.launch('node', ['script.js']);
      createdProcesses.push(process);

      expect(process.killed).toBe(false);

      process.kill();

      expect(process.killed).toBe(true);
    });

    it('should handle null exit codes and signals', () => {
      const process = processLauncher.launch('node', ['script.js']);
      createdProcesses.push(process);

      expect(process.exitCode).toBeNull();
      expect(process.signalCode).toBeNull();

      mockChildProcess.emit('exit', null, null);

      expect(process.exitCode).toBeNull();
      expect(process.signalCode).toBeNull();
    });
  });

  describe('ProcessLauncherFactoryImpl', () => {
    it('should create process launcher', () => {
      const networkManager = {
        findFreePort: vi.fn().mockResolvedValue(5678)
      };
      
      const factory = new ProcessLauncherFactoryImpl(processManager, networkManager as any);
      const launcher = factory.createProcessLauncher();

      expect(launcher).toBeInstanceOf(ProcessLauncherImpl);
    });

    it('should create debug target launcher', () => {
      const networkManager = {
        findFreePort: vi.fn().mockResolvedValue(5678)
      };
      
      const factory = new ProcessLauncherFactoryImpl(processManager, networkManager as any);
      const launcher = factory.createDebugTargetLauncher();

      expect(launcher).toBeDefined();
      expect(launcher.launchPythonDebugTarget).toBeDefined();
    });

    it('should create proxy process launcher', () => {
      const networkManager = {
        findFreePort: vi.fn().mockResolvedValue(5678)
      };
      
      const factory = new ProcessLauncherFactoryImpl(processManager, networkManager as any);
      const launcher = factory.createProxyProcessLauncher();

      expect(launcher).toBeDefined();
      expect(launcher.launchProxy).toBeDefined();
    });
  });
});
