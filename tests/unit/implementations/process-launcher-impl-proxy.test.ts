import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { 
  ProxyProcessLauncherImpl,
  ProcessLauncherImpl
} from '../../../src/implementations/process-launcher-impl';
import { ProcessManagerImpl } from '../../../src/implementations/process-manager-impl';
import type { IChildProcess } from '../../../src/interfaces/external-dependencies';
import type { IProxyProcess } from '../../../src/interfaces/process-interfaces';

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
    // Always emit exit event
    process.nextTick(() => proc.emit('exit', 0, signal || 'SIGTERM'));
    return true;
  });
  
  proc.send = vi.fn().mockReturnValue(true);
  proc.stdin = new EventEmitter() as any;
  proc.stdout = new EventEmitter() as any;
  proc.stderr = new EventEmitter() as any;
  return proc;
}

describe('ProxyProcessAdapter', () => {
  let proxyLauncher: ProxyProcessLauncherImpl;
  let processLauncher: ProcessLauncherImpl;
  let processManager: ProcessManagerImpl;
  let mockChildProcess: MockChildProcess;
  let createdProcesses: IProxyProcess[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    
    mockChildProcess = createMockProcess();
    processManager = new ProcessManagerImpl();
    vi.spyOn(processManager, 'spawn').mockReturnValue(mockChildProcess);
    
    processLauncher = new ProcessLauncherImpl(processManager);
    proxyLauncher = new ProxyProcessLauncherImpl(processLauncher);
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

  describe('Proxy Launch', () => {
    it('should launch proxy with correct configuration', () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123',
        { DEBUG: 'true' }
      );
      createdProcesses.push(proxyProcess);

      expect(processManager.spawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining(['--trace-uncaught', '--trace-exit', '/path/to/proxy.js']),
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          env: expect.objectContaining({ DEBUG: 'true' })
        })
      );
      
      expect(proxyProcess.sessionId).toBe('session-123');
    });

    it('should use process.env when no env provided', () => {
      const originalEnv = process.env;
      process.env = { NODE_ENV: 'test', PATH: '/usr/bin', HOME: '/home/user' };

      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-456'
      );
      createdProcesses.push(proxyProcess);

      // NODE_ENV should be filtered out, but PATH and HOME should remain
      expect(processManager.spawn).toHaveBeenCalledWith(
        process.execPath,
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PATH: '/usr/bin',
            HOME: '/home/user'
          })
        })
      );
      
      // Verify NODE_ENV was filtered out
      const callArgs = (processManager.spawn as any).mock.calls[0];
      expect(callArgs[2].env.NODE_ENV).toBeUndefined();

      process.env = originalEnv;
    });
  });

  describe('Command Sending', () => {
    it('should send commands as JSON', () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(proxyProcess);

      const command = { type: 'start', config: { port: 5678 } };
      proxyProcess.sendCommand(command);

      expect(mockChildProcess.send).toHaveBeenCalledWith(JSON.stringify(command));
    });

    it('should handle complex command objects', () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(proxyProcess);

      const complexCommand = {
        type: 'configure',
        settings: {
          nested: {
            array: [1, 2, 3],
            bool: true,
            null: null
          }
        }
      };
      proxyProcess.sendCommand(complexCommand);

      expect(mockChildProcess.send).toHaveBeenCalledWith(JSON.stringify(complexCommand));
    });
  });

  describe('Initialization Handling', () => {
    it('should resolve on adapter_configured_and_launched message', async () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(proxyProcess);

      const initPromise = proxyProcess.waitForInitialization();

      // Emit initialization message
      mockChildProcess.emit('message', {
        type: 'status',
        status: 'adapter_configured_and_launched'
      });

      await expect(initPromise).resolves.toBeUndefined();
    });

    it('should resolve on dry_run_complete message', async () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(proxyProcess);

      const initPromise = proxyProcess.waitForInitialization();

      // Emit dry run complete message
      mockChildProcess.emit('message', {
        type: 'status',
        status: 'dry_run_complete'
      });

      await expect(initPromise).resolves.toBeUndefined();
    });

    it('should ignore non-status messages during initialization', async () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(proxyProcess);

      const initPromise = proxyProcess.waitForInitialization();

      // Emit non-status message
      mockChildProcess.emit('message', {
        type: 'log',
        message: 'Starting up...'
      });

      // Emit wrong status
      mockChildProcess.emit('message', {
        type: 'status',
        status: 'some_other_status'
      });

      // Should still be pending
      let resolved = false;
      initPromise.then(() => { resolved = true; });
      await vi.advanceTimersByTimeAsync(100);
      expect(resolved).toBe(false);

      // Now emit correct status
      mockChildProcess.emit('message', {
        type: 'status',
        status: 'adapter_configured_and_launched'
      });

      await expect(initPromise).resolves.toBeUndefined();
    });

    it('should handle malformed initialization messages', async () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(proxyProcess);

      const initPromise = proxyProcess.waitForInitialization();

      // Emit malformed messages
      mockChildProcess.emit('message', null);
      mockChildProcess.emit('message', undefined);
      mockChildProcess.emit('message', 'string message');
      mockChildProcess.emit('message', { type: 'status' }); // missing status field

      // Should still be pending
      let resolved = false;
      initPromise.then(() => { resolved = true; });
      await vi.advanceTimersByTimeAsync(100);
      expect(resolved).toBe(false);

      // Now emit correct status
      mockChildProcess.emit('message', {
        type: 'status',
        status: 'adapter_configured_and_launched'
      });

      await expect(initPromise).resolves.toBeUndefined();
    });

    it('should only resolve initialization once', async () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(proxyProcess);

      const initPromise = proxyProcess.waitForInitialization();

      // First initialization message
      mockChildProcess.emit('message', {
        type: 'status',
        status: 'adapter_configured_and_launched'
      });

      await expect(initPromise).resolves.toBeUndefined();

      // Second initialization message should be ignored
      const messageHandler = vi.fn();
      proxyProcess.on('message', messageHandler);

      mockChildProcess.emit('message', {
        type: 'status',
        status: 'adapter_configured_and_launched'
      });

      // Message is still forwarded but doesn't affect initialization
      expect(messageHandler).toHaveBeenCalled();
    });

    it('should handle initialization timeout using critical async pattern', async () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(proxyProcess);

      // CRITICAL ASYNC PATTERN: Attach rejection handler BEFORE advancing timers
      const initPromise = proxyProcess.waitForInitialization(5000);
      const expectPromise = expect(initPromise).rejects.toThrow('Proxy initialization timeout');
      
      // Advance past the timeout
      await vi.advanceTimersByTimeAsync(5001);
      
      await expectPromise;
    });

    it('should reject if process exits before initialization', async () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(proxyProcess);

      // CRITICAL ASYNC PATTERN: Attach rejection handler before exit
      const initPromise = proxyProcess.waitForInitialization();
      const expectPromise = expect(initPromise).rejects.toThrow('Proxy process exited before initialization');

      // Emit exit event
      mockChildProcess.emit('exit', 1, null);

      await expectPromise;
    });

    it('should handle multiple calls to waitForInitialization', async () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(proxyProcess);

      // Multiple calls should work
      const initPromise1 = proxyProcess.waitForInitialization();
      const initPromise2 = proxyProcess.waitForInitialization();

      // Complete initialization
      mockChildProcess.emit('message', {
        type: 'status',
        status: 'adapter_configured_and_launched'
      });

      // Both should resolve successfully
      await expect(initPromise1).resolves.toBeUndefined();
      await expect(initPromise2).resolves.toBeUndefined();
    });
  });

  describe('Event Forwarding', () => {
    it('should forward spawn, message, close, and exit events', async () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(proxyProcess);

      const handlers = {
        exit: vi.fn(),
        close: vi.fn(),
        spawn: vi.fn(),
        message: vi.fn()
      };

      // Attach handlers before emitting events
      Object.entries(handlers).forEach(([event, handler]) => {
        proxyProcess.on(event, handler);
      });

      // Emit events
      mockChildProcess.emit('spawn');
      mockChildProcess.emit('message', { test: true });
      mockChildProcess.emit('close', 0, null);
      mockChildProcess.emit('exit', 0, 'SIGTERM');

      expect(handlers.spawn).toHaveBeenCalled();
      expect(handlers.message).toHaveBeenCalledWith({ test: true });
      expect(handlers.close).toHaveBeenCalledWith(0, null);
      expect(handlers.exit).toHaveBeenCalledWith(0, 'SIGTERM');
    });

    it('should forward error events from the process', async () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(proxyProcess);

      const errorPromise = new Promise<void>((resolve) => {
        proxyProcess.on('error', (error) => {
          expect(error.message).toBe('Test process error');
          resolve();
        });
      });

      // Emit error on mock process
      const testError = new Error('Test process error');
      mockChildProcess.emit('error', testError);

      // Wait for the error event to be handled
      await errorPromise;
    });
  });

  describe('Process State', () => {
    it('should track exit code and signal', () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(proxyProcess);

      expect(proxyProcess.exitCode).toBeNull();
      expect(proxyProcess.signalCode).toBeNull();

      mockChildProcess.emit('exit', 143, 'SIGTERM');

      expect(proxyProcess.exitCode).toBe(143);
      expect(proxyProcess.signalCode).toBe('SIGTERM');
    });

    it('should provide access to process properties', () => {
      const proxyProcess = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(proxyProcess);

      expect(proxyProcess.pid).toBe(12345);
      expect(proxyProcess.stdin).toBe(mockChildProcess.stdin);
      expect(proxyProcess.stdout).toBe(mockChildProcess.stdout);
      expect(proxyProcess.stderr).toBe(mockChildProcess.stderr);
      expect(proxyProcess.killed).toBe(false);
    });
  });

  describe('DAP Compliance - Error Handling', () => {
    it('should reject promise AND emit event when adapter crashes during init', async () => {
      const adapter = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(adapter);
      
      const initPromise = adapter.waitForInitialization();
      const errorHandler = vi.fn();
      
      adapter.on('error', errorHandler);
      
      // Simulate crash
      const error = new Error('Adapter crashed');
      mockChildProcess.emit('error', error);
      mockChildProcess.emit('exit', 1);
      
      // Both should happen (per DAP spec)
      await expect(initPromise).rejects.toThrow('Proxy process exited before initialization');
      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it('should support configurable initialization timeout', async () => {
      const adapter = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(adapter);
      
      // DAP spec: 5-10 seconds typical, should be configurable
      const initPromise = adapter.waitForInitialization(1000); // 1 second timeout
      const expectPromise = expect(initPromise).rejects.toThrow(/timeout/i);
      
      // Don't send initialization message
      await vi.advanceTimersByTimeAsync(1001);
      
      await expectPromise;
    });

    it('should handle rapid start/stop cycles', async () => {
      const adapter = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(adapter);
      
      // Start initialization
      const initPromise = adapter.waitForInitialization();
      const expectPromise = expect(initPromise).rejects.toThrow('Proxy process exited before initialization');
      
      // Immediately kill
      process.nextTick(() => {
        mockChildProcess.emit('exit', 0);
      });
      
      await expectPromise;
      
      // No unhandled rejections should occur
    });

    it('should handle errors after successful initialization', async () => {
      const adapter = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(adapter);
      
      // Initialize successfully first
      const initPromise = adapter.waitForInitialization();
      mockChildProcess.emit('message', {
        type: 'status',
        status: 'adapter_configured_and_launched'
      });
      await initPromise;
      
      // Now error occurs
      const errorHandler = vi.fn();
      adapter.on('error', errorHandler);
      
      const error = new Error('Runtime error');
      mockChildProcess.emit('error', error);
      
      expect(errorHandler).toHaveBeenCalledWith(error);
    });
  });

  describe('Resource Cleanup', () => {
    it('should remove all event listeners on disposal', () => {
      const adapter = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(adapter);
      
      // Track initial listener counts
      const initialExitListeners = mockChildProcess.listenerCount('exit');
      const initialMessageListeners = mockChildProcess.listenerCount('message');
      const initialErrorListeners = mockChildProcess.listenerCount('error');
      
      // Should have added listeners
      expect(initialExitListeners).toBeGreaterThan(0);
      expect(initialMessageListeners).toBeGreaterThan(0);
      expect(initialErrorListeners).toBeGreaterThan(0);
      
      // Kill process to trigger cleanup
      mockChildProcess.emit('exit', 0);
      
      // Should have removed listeners
      expect(mockChildProcess.listenerCount('exit')).toBeLessThan(initialExitListeners);
      expect(mockChildProcess.listenerCount('message')).toBeLessThan(initialMessageListeners);
      expect(mockChildProcess.listenerCount('error')).toBeLessThan(initialErrorListeners);
    });

    it('should handle cleanup when process is already killed', () => {
      const adapter = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(adapter);
      
      // Kill once
      adapter.kill();
      expect(mockChildProcess.kill).toHaveBeenCalledTimes(1);
      
      // Kill again - should not double-kill
      adapter.kill();
      expect(mockChildProcess.kill).toHaveBeenCalledTimes(1);
    });

    it('should clean up initialization state on exit', async () => {
      const adapter = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        'session-123'
      );
      createdProcesses.push(adapter);
      
      // Start initialization
      const initPromise = adapter.waitForInitialization();
      
      // Exit before completion
      mockChildProcess.emit('exit', 1);
      
      await expect(initPromise).rejects.toThrow();
      
      // Try to initialize again - should fail appropriately
      await expect(adapter.waitForInitialization()).rejects.toThrow('Initialization already completed or failed');
    });
  });
});
