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

describe('ProxyProcessAdapter - Prerequisites (Promise Lifecycle)', () => {
  let proxyLauncher: ProxyProcessLauncherImpl;
  let processLauncher: ProcessLauncherImpl;
  let processManager: ProcessManagerImpl;
  let mockChildProcess: MockChildProcess;
  let unhandledRejections: any[] = [];
  let unhandledRejectionHandler: (reason: any) => void;

  beforeEach(() => {
    // Don't use fake timers as they conflict with process.nextTick
    
    // Track unhandled rejections
    unhandledRejections = [];
    unhandledRejectionHandler = (reason: any) => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', unhandledRejectionHandler);
    
    mockChildProcess = createMockProcess();
    processManager = new ProcessManagerImpl();
    vi.spyOn(processManager, 'spawn').mockReturnValue(mockChildProcess);
    
    processLauncher = new ProcessLauncherImpl(processManager);
    proxyLauncher = new ProxyProcessLauncherImpl(processLauncher);
  });

  afterEach(async () => {
    // Remove unhandled rejection listener
    process.removeListener('unhandledRejection', unhandledRejectionHandler);
    
    // Check for unhandled rejections
    expect(unhandledRejections).toHaveLength(0);
    
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // Test 1: Process can be killed without initialization
  it('should handle process termination without initialization request', async () => {
    const adapter = proxyLauncher.launchProxy(
      '/path/to/proxy.js',
      'session-prereq-no-init',
      { DEBUG: 'true' }
    );
    
    // Kill process immediately - no initialization requested
    mockChildProcess.kill();
    mockChildProcess.emit('exit', 0);
    
    // Wait to ensure no unhandled rejections occur
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // This test should FAIL if unhandled rejections occur
    expect(unhandledRejections).toHaveLength(0);
  });

  // Test 2: Lazy initialization
  it('should not create initialization promise until requested', async () => {
    const adapter = proxyLauncher.launchProxy(
      '/path/to/proxy.js',
      'session-prereq-lazy-init',
      { DEBUG: 'true' }
    );

    // Access internal state using type assertion
    const internalAdapter = adapter as any;

    // Verify no promise exists yet
    // This should FAIL if implementation eagerly creates promises
    expect(internalAdapter.initializationPromise).toBeUndefined();

    // Now request initialization
    const initPromise = adapter.waitForInitialization();
    expect(internalAdapter.initializationPromise).toBeDefined();

    // Clean up by killing the process and handling the promise
    mockChildProcess.emit('exit', 0);
    await expect(initPromise).rejects.toThrow('Proxy process exited before initialization');
  });

  // Test 3: Proper rejection on early exit
  it('should properly reject initialization promise when process exits', async () => {
    const adapter = proxyLauncher.launchProxy(
      '/path/to/proxy.js',
      'session-prereq-reject-exit',
      { DEBUG: 'true' }
    );
    
    const initPromise = adapter.waitForInitialization();
    
    // Kill process before initialization completes
    mockChildProcess.emit('exit', 1);
    
    // Should FAIL with assertion, not ERROR with unhandled rejection
    await expect(initPromise).rejects.toThrow('Proxy process exited before initialization');
    
    // Verify no unhandled rejections
    expect(unhandledRejections).toHaveLength(0);
  });

  // Test 4: Multiple initialization requests
  it('should handle multiple initialization requests correctly', async () => {
    const adapter = proxyLauncher.launchProxy(
      '/path/to/proxy.js',
      'session-prereq-multiple-init',
      { DEBUG: 'true' }
    );
    
    const promise1 = adapter.waitForInitialization();
    const promise2 = adapter.waitForInitialization();
    
    // Should return same promise (or both should work)
    // Implementation might create new promises, but both should resolve
    
    // Complete initialization
    mockChildProcess.emit('message', {
      type: 'status',
      status: 'adapter_configured_and_launched'
    });
    
    // Both should resolve successfully
    await Promise.all([promise1, promise2]);
    expect(unhandledRejections).toHaveLength(0);
  });

  // Test 5: Mimics the exact scenario causing 8 unhandled rejections
  it('should not cause unhandled rejections in typical test cleanup', async () => {
    // This mimics what the 8 failing tests do
    const adapter = proxyLauncher.launchProxy(
      '/path/to/proxy.js',
      'session-prereq-typical-cleanup',
      { DEBUG: 'true' }
    );
    // Don't call waitForInitialization() - just like the failing tests
    
    // Simulate afterEach cleanup
    mockChildProcess.kill();
    mockChildProcess.emit('exit', 0);
    
    // Should complete without unhandled rejections
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // This assertion should FAIL if the bug exists
    expect(unhandledRejections).toHaveLength(0);
  });

  // Test 6: Exit before initialization with multiple adapters
  it('should handle multiple adapters being killed without initialization', async () => {
    const adapters: IProxyProcess[] = [];
    
    // Create multiple adapters (simulating multiple tests)
    for (let i = 0; i < 3; i++) {
      const mockProc = createMockProcess(12345 + i);
      vi.spyOn(processManager, 'spawn').mockReturnValueOnce(mockProc);
      
      const adapter = proxyLauncher.launchProxy(
        '/path/to/proxy.js',
        `session-prereq-multi-adapter-${i}`,
        { DEBUG: 'true' }
      );
      adapters.push(adapter);
      
      // Kill immediately without initialization
      mockProc.kill();
      mockProc.emit('exit', 0);
    }
    
    // Wait for all potential rejections
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Should have no unhandled rejections
    expect(unhandledRejections).toHaveLength(0);
  });

  // Test 7: Process error during initialization
  it('should handle process errors during initialization gracefully', async () => {
    const adapter = proxyLauncher.launchProxy(
      '/path/to/proxy.js',
      'session-prereq-error-init',
      { DEBUG: 'true' }
    );
    
    // Add error handler to prevent Node.js from throwing
    const errorHandler = vi.fn();
    adapter.on('error', errorHandler);
    
    // Request initialization
    const initPromise = adapter.waitForInitialization();
    
    // Wait for next tick to ensure error handlers are set up
    await new Promise(resolve => process.nextTick(resolve));
    
    // Emit error then exit
    const error = new Error('Process crashed');
    mockChildProcess.emit('error', error);
    mockChildProcess.emit('exit', 1);
    
    // Should reject the promise properly
    await expect(initPromise).rejects.toThrow('Proxy process exited before initialization');
    
    // Error should have been emitted
    expect(errorHandler).toHaveBeenCalledWith(error);
    
    // No unhandled rejections
    expect(unhandledRejections).toHaveLength(0);
  });

  // Test 8: Initialization promise should be cleared after resolution
  it('should clear initialization promise after successful initialization', async () => {
    const adapter = proxyLauncher.launchProxy(
      '/path/to/proxy.js',
      'session-prereq-clear-promise',
      { DEBUG: 'true' }
    );
    
    const initPromise = adapter.waitForInitialization();
    
    // Complete initialization
    mockChildProcess.emit('message', {
      type: 'status',
      status: 'adapter_configured_and_launched'
    });
    
    await initPromise;
    
    // Now kill the process - should not cause unhandled rejection
    mockChildProcess.emit('exit', 0);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(unhandledRejections).toHaveLength(0);
  });
});
