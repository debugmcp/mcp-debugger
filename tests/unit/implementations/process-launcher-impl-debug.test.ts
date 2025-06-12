import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import path from 'path';
import { 
  DebugTargetLauncherImpl,
  ProcessLauncherImpl
} from '../../../src/implementations/process-launcher-impl';
import { ProcessManagerImpl } from '../../../src/implementations/process-manager-impl';
import type { IChildProcess, INetworkManager } from '../../../src/interfaces/external-dependencies';
import type { IDebugTarget } from '../../../src/interfaces/process-interfaces';

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
      return false;
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

describe('DebugTargetLauncherImpl', () => {
  let debugLauncher: DebugTargetLauncherImpl;
  let processLauncher: ProcessLauncherImpl;
  let processManager: ProcessManagerImpl;
  let networkManager: INetworkManager;
  let mockChildProcess: MockChildProcess;
  let createdTargets: IDebugTarget[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    
    mockChildProcess = createMockProcess();
    processManager = new ProcessManagerImpl();
    vi.spyOn(processManager, 'spawn').mockReturnValue(mockChildProcess);
    
    networkManager = {
      findFreePort: vi.fn().mockResolvedValue(5678),
      createServer: vi.fn()
    };
    
    processLauncher = new ProcessLauncherImpl(processManager);
    debugLauncher = new DebugTargetLauncherImpl(processLauncher, networkManager);
    createdTargets = [];
  });

  afterEach(async () => {
    // Clean up any lingering processes
    for (const target of createdTargets) {
      if (target.process && !target.process.killed) {
        target.process.kill();
      }
    }
    createdTargets = [];
    
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Launch Python Debug Target', () => {
    it('should launch with auto-allocated port', async () => {
      const scriptPath = '/path/to/script.py';
      const args = ['--arg1', 'value1'];

      const target = await debugLauncher.launchPythonDebugTarget(
        scriptPath,
        args
      );
      createdTargets.push(target);

      expect(networkManager.findFreePort).toHaveBeenCalled();
      expect(processManager.spawn).toHaveBeenCalledWith(
        'python',
        [
          '-m', 'debugpy',
          '--listen', '127.0.0.1:5678',
          '--wait-for-client',
          scriptPath,
          '--arg1', 'value1'
        ],
        { cwd: '/path/to' }
      );
      
      expect(target.debugPort).toBe(5678);
      expect(target.process.pid).toBe(12345);
    });

    it('should launch with specific port', async () => {
      const scriptPath = '/home/user/test.py';
      const args = [];
      const specificPort = 9999;

      const target = await debugLauncher.launchPythonDebugTarget(
        scriptPath,
        args,
        'python',
        specificPort
      );
      createdTargets.push(target);

      expect(networkManager.findFreePort).not.toHaveBeenCalled();
      expect(processManager.spawn).toHaveBeenCalledWith(
        'python',
        [
          '-m', 'debugpy',
          '--listen', '127.0.0.1:9999',
          '--wait-for-client',
          scriptPath
        ],
        { cwd: '/home/user' }
      );
      
      expect(target.debugPort).toBe(9999);
    });

    it('should use custom Python path', async () => {
      const scriptPath = '/project/main.py';
      const customPython = '/usr/local/bin/python3.9';

      const target = await debugLauncher.launchPythonDebugTarget(
        scriptPath,
        [],
        customPython
      );
      createdTargets.push(target);

      expect(processManager.spawn).toHaveBeenCalledWith(
        customPython,
        expect.arrayContaining(['-m', 'debugpy']),
        expect.any(Object)
      );
    });

    it.skipIf(process.platform !== 'win32')('should handle Windows paths correctly', async () => {
      const scriptPath = 'C:\\Users\\test\\script.py';
      const args = ['--verbose'];

      const target = await debugLauncher.launchPythonDebugTarget(
        scriptPath,
        args
      );
      createdTargets.push(target);

      expect(processManager.spawn).toHaveBeenCalledWith(
        'python',
        expect.any(Array),
        { cwd: 'C:\\Users\\test' }
      );
    });

    it('should handle port allocation failure', async () => {
      const error = new Error('No available ports');
      (networkManager.findFreePort as any).mockRejectedValue(error);

      await expect(debugLauncher.launchPythonDebugTarget(
        '/path/to/script.py',
        []
      )).rejects.toThrow('No available ports');
    });

    it('should handle invalid Python path', async () => {
      // Make spawn throw an error immediately
      (processManager.spawn as any).mockImplementation(() => {
        const proc = createMockProcess();
        process.nextTick(() => proc.emit('error', new Error('spawn python ENOENT')));
        return proc;
      });

      const target = await debugLauncher.launchPythonDebugTarget(
        '/path/to/script.py',
        [],
        'invalid-python'
      );
      createdTargets.push(target);

      // Process should emit error
      const errorPromise = new Promise((resolve) => {
        target.process.once('error', resolve);
      });
      
      await expect(errorPromise).resolves.toEqual(expect.objectContaining({
        message: 'spawn python ENOENT'
      }));
    });

    it('should verify full debugpy command line arguments', async () => {
      const scriptPath = '/workspace/debug_test.py';
      const args = ['--config', 'config.json', '--debug'];

      const target = await debugLauncher.launchPythonDebugTarget(
        scriptPath,
        args,
        'python3',
        8888
      );
      createdTargets.push(target);

      expect(processManager.spawn).toHaveBeenCalledWith(
        'python3',
        [
          '-m', 'debugpy',
          '--listen', '127.0.0.1:8888',
          '--wait-for-client',
          '/workspace/debug_test.py',
          '--config', 'config.json',
          '--debug'
        ],
        { cwd: '/workspace' }
      );
    });
  });

  describe('Process Termination', () => {
    it('should terminate process gracefully', async () => {
      const target = await debugLauncher.launchPythonDebugTarget(
        '/path/to/script.py',
        []
      );
      createdTargets.push(target);

      const killSpy = vi.spyOn(target.process, 'kill');
      
      await target.terminate();

      expect(killSpy).toHaveBeenCalledWith('SIGTERM');
      expect(target.process.killed).toBe(true);
    });

    it('should handle already terminated process', async () => {
      const target = await debugLauncher.launchPythonDebugTarget(
        '/path/to/script.py',
        []
      );
      createdTargets.push(target);

      // Kill process first
      target.process.kill();
      expect(target.process.killed).toBe(true);

      // Terminate should complete without error
      await expect(target.terminate()).resolves.toBeUndefined();
    });

    it('should force kill after timeout', async () => {
      const target = await debugLauncher.launchPythonDebugTarget(
        '/path/to/script.py',
        []
      );
      createdTargets.push(target);

      // Mock kill to not emit exit immediately
      let exitEmitted = false;
      target.process.kill = vi.fn().mockImplementation((signal?: string) => {
        if (signal === 'SIGKILL') {
          exitEmitted = true;
          process.nextTick(() => target.process.emit('exit', 137, 'SIGKILL'));
        }
        return true;
      });

      const terminatePromise = target.terminate();

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(5001);

      await terminatePromise;

      expect(target.process.kill).toHaveBeenCalledWith('SIGTERM');
      expect(target.process.kill).toHaveBeenCalledWith('SIGKILL');
      expect(exitEmitted).toBe(true);
    });

    it('should resolve immediately if process exits during termination', async () => {
      const target = await debugLauncher.launchPythonDebugTarget(
        '/path/to/script.py',
        []
      );
      createdTargets.push(target);

      // Mock kill to emit exit after a delay
      target.process.kill = vi.fn().mockImplementation(() => {
        setTimeout(() => target.process.emit('exit', 0, 'SIGTERM'), 1000);
        return true;
      });

      const terminatePromise = target.terminate();

      // Advance timers to trigger exit
      await vi.advanceTimersByTimeAsync(1001);

      await expect(terminatePromise).resolves.toBeUndefined();

      // Should not have called SIGKILL
      expect(target.process.kill).toHaveBeenCalledTimes(1);
      expect(target.process.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('Debug Target Properties', () => {
    it('should expose process and debug port', async () => {
      const target = await debugLauncher.launchPythonDebugTarget(
        '/path/to/script.py',
        [],
        'python',
        7777
      );
      createdTargets.push(target);

      expect(target.process).toBeDefined();
      expect(target.process.pid).toBe(12345);
      expect(target.debugPort).toBe(7777);
      expect(target.terminate).toBeInstanceOf(Function);
    });

    it('should handle process events', async () => {
      const target = await debugLauncher.launchPythonDebugTarget(
        '/path/to/script.py',
        []
      );
      createdTargets.push(target);

      const errorHandler = vi.fn();
      const exitHandler = vi.fn();
      
      target.process.on('error', errorHandler);
      target.process.on('exit', exitHandler);

      const error = new Error('Process error');
      mockChildProcess.emit('error', error);
      mockChildProcess.emit('exit', 1, null);

      expect(errorHandler).toHaveBeenCalledWith(error);
      expect(exitHandler).toHaveBeenCalledWith(1, null);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty script path dirname', async () => {
      const scriptPath = 'script.py'; // No directory

      const target = await debugLauncher.launchPythonDebugTarget(
        scriptPath,
        []
      );
      createdTargets.push(target);

      expect(processManager.spawn).toHaveBeenCalledWith(
        'python',
        expect.any(Array),
        { cwd: '.' } // path.dirname('script.py') returns '.'
      );
    });

    it('should handle script paths with spaces', async () => {
      const scriptPath = '/path with spaces/my script.py';
      
      const target = await debugLauncher.launchPythonDebugTarget(
        scriptPath,
        ['--arg with space']
      );
      createdTargets.push(target);

      expect(processManager.spawn).toHaveBeenCalledWith(
        'python',
        [
          '-m', 'debugpy',
          '--listen', '127.0.0.1:5678',
          '--wait-for-client',
          '/path with spaces/my script.py',
          '--arg with space'
        ],
        { cwd: '/path with spaces' }
      );
    });
  });
});
