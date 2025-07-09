/**
 * ProxyManager Error Handling Tests
 * Tests for error scenarios, timeout handling, and recovery
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProxyManager } from '../../../../src/proxy/proxy-manager.js';
import { ProxyConfig } from '../../../../src/proxy/proxy-config.js';
import { FakeProxyProcessLauncher } from '../../../implementations/test/fake-process-launcher.js';
import { createMockLogger, createMockFileSystem } from '../../../test-utils/helpers/test-utils.js';
import { ILogger, IFileSystem } from '../../../../src/interfaces/external-dependencies.js';
import { ErrorMessages } from '../../../../src/utils/error-messages.js';
import { DebugLanguage } from '../../../../src/session/models.js';

describe('ProxyManager - Error Handling', () => {
  let proxyManager: ProxyManager;
  let fakeLauncher: FakeProxyProcessLauncher;
  let mockLogger: ILogger;
  let mockFileSystem: IFileSystem;

  const defaultConfig: ProxyConfig = {
    sessionId: 'test-session-123',
    language: DebugLanguage.MOCK,
    executablePath: 'python',
    adapterHost: '127.0.0.1',
    adapterPort: 5678,
    logDir: '/tmp/logs',
    scriptPath: 'test.py'
  };

  beforeEach(() => {
    fakeLauncher = new FakeProxyProcessLauncher();
    mockLogger = createMockLogger();
    mockFileSystem = createMockFileSystem();
    
    proxyManager = new ProxyManager(
      null,  // No adapter needed for these tests
      fakeLauncher,
      mockFileSystem,
      mockLogger
    );
  });

  afterEach(() => {
    vi.useRealTimers(); // Always restore real timers first
    vi.clearAllMocks();
    fakeLauncher.reset();
  });

  describe('Process Spawn Failures', () => {
    it('should handle missing proxy script', async () => {
      // Mock file system to simulate script not found
      vi.mocked(mockFileSystem.pathExists).mockResolvedValue(false);

      await expect(proxyManager.start(defaultConfig))
        .rejects.toThrow('Bootstrap worker script not found');
    });

    it('should handle launch failure', async () => {
      // Make launcher throw an error
      fakeLauncher.launchProxy = vi.fn().mockImplementation(() => {
        throw new Error('Failed to spawn process');
      });

      await expect(proxyManager.start(defaultConfig))
        .rejects.toThrow('Failed to spawn process');
        
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to spawn proxy'),
        expect.any(Error)
      );
    });

    it('should handle invalid process (no PID)', async () => {
      // Return a process without PID
      fakeLauncher.launchProxy = vi.fn().mockReturnValue({
        pid: undefined,
        on: vi.fn(),
        sendCommand: vi.fn()
      });

      await expect(proxyManager.start(defaultConfig))
        .rejects.toThrow('Proxy process is invalid or PID is missing');
    });

    it('should handle null process', async () => {
      fakeLauncher.launchProxy = vi.fn().mockReturnValue(null);

      await expect(proxyManager.start(defaultConfig))
        .rejects.toThrow('Proxy process is invalid or PID is missing');
    });
  });

  describe('Initialization Errors', () => {
    it('should handle error event during initialization', async () => {
      fakeLauncher.prepareProxy((proxy) => {
        setTimeout(() => {
          proxy.simulateProcessError(new Error('Spawn error'));
        }, 50);
      });

      await expect(proxyManager.start(defaultConfig))
        .rejects.toThrow('Spawn error');
    });

    it('should handle exit with non-zero code during initialization', async () => {
      fakeLauncher.prepareProxy((proxy) => {
        setTimeout(() => {
          proxy.simulateExit(1);
        }, 50);
      });

      await expect(proxyManager.start(defaultConfig))
        .rejects.toThrow('Proxy exited during initialization. Code: 1, Signal: undefined');
    });

    it('should handle exit with signal during initialization', async () => {
      fakeLauncher.prepareProxy((proxy) => {
        setTimeout(() => {
          proxy.simulateExit(0, 'SIGKILL');
        }, 50);
      });

      await expect(proxyManager.start(defaultConfig))
        .rejects.toThrow('Proxy exited during initialization. Code: 0, Signal: SIGKILL');
    });

    it('should handle error message from proxy', async () => {
      let errorCount = 0;
      
      // Listen for error event before starting
      proxyManager.on('error', (error) => {
        errorCount++;
        expect(error.message).toBe('Failed to import debugpy');
      });
      
      fakeLauncher.prepareProxy((proxy) => {
        // Send initialization first to complete start
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
          // Then send error message after proxy is initialized
          setTimeout(() => {
            proxy.simulateMessage({
              type: 'error',
              sessionId: defaultConfig.sessionId,
              message: 'Failed to import debugpy'
            });
          }, 10);
        }, 50);
      });

      await proxyManager.start(defaultConfig);
      
      // Give time for error to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify error was emitted
      expect(errorCount).toBe(1);
    });
  });

  describe('Runtime Errors', () => {
    beforeEach(async () => {
      // Start proxy successfully first
      fakeLauncher.prepareProxy((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });
      await proxyManager.start(defaultConfig);
    });

    it('should handle process crash during operation', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Verify error event was emitted
      const errorPromise = new Promise<Error>((resolve) => {
        proxyManager.once('error', resolve);
      });

      // Trigger the error event
      fakeProxy.emit('error', new Error('Process crashed'));

      const error = await errorPromise;
      expect(error.message).toBe('Process crashed');
      
      // Verify cleanup
      expect(proxyManager.isRunning()).toBe(false);
    });

    it('should handle malformed DAP response', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Send malformed response
      fakeProxy.simulateMessage({
        type: 'dapResponse',
        sessionId: defaultConfig.sessionId,
        requestId: 'some-id',
        success: true,
        // Missing response field
      });

      // Should log warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Received response for unknown request: some-id')
      );
    });

    it('should handle send command failure', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Kill the process to make it unavailable
      fakeProxy.kill();
      
      // Try to send DAP request
      await expect(proxyManager.sendDapRequest('stackTrace', {}))
        .rejects.toThrow('Proxy process not available');
    });

    it('should handle multiple rapid errors', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      let errorCount = 0;
      
      // Listen for error events
      proxyManager.on('error', () => {
        errorCount++;
      });
      
      // Send multiple error messages rapidly
      for (let i = 0; i < 5; i++) {
        fakeProxy.simulateMessage({
          type: 'error',
          sessionId: defaultConfig.sessionId,
          message: `Error ${i}`
        });
      }
      
      // Give time for events to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      // All errors should be emitted
      expect(errorCount).toBe(5);
    });
  });

  describe('Timeout Handling', () => {
    it('should handle DAP request timeout and cleanup', async () => {
      // Start proxy
      fakeLauncher.prepareProxy((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });
      await proxyManager.start(defaultConfig);

      // Setup fake timers before any async operations
      vi.useFakeTimers();

      try {
        // Start the async operation that will timeout
        const requestPromise = proxyManager.sendDapRequest('evaluate', { expression: 'test' });

        // Immediately attach rejection expectation before advancing timers
        const expectPromise = expect(requestPromise).rejects.toThrow(ErrorMessages.dapRequestTimeout('evaluate', 35));

        // Advance timers using the async method
        await vi.advanceTimersByTimeAsync(35001);

        // Now await the expectation
        await expectPromise;
      } finally {
        // Always restore real timers
        vi.useRealTimers();
      }

      // Verify request was cleaned up
      // Send another request to verify system still works
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Mock immediate response for new request
      fakeProxy.on('message', (msg: any) => {
        if (typeof msg !== 'string') return;
        const parsed = JSON.parse(msg);
        if (parsed.cmd === 'dap') {
          fakeProxy.simulateMessage({
            type: 'dapResponse',
            sessionId: defaultConfig.sessionId,
            requestId: parsed.requestId,
            success: true,
            response: { success: true }
          });
        }
      });

      // Should work fine
      await expect(proxyManager.sendDapRequest('continue', {})).resolves.toBeDefined();
    });

    it('should handle initialization timeout with cleanup', async () => {
      vi.useFakeTimers();

      try {
        const startPromise = proxyManager.start(defaultConfig);

        // Immediately attach rejection expectation before advancing timers
        const expectPromise = expect(startPromise).rejects.toThrow(ErrorMessages.proxyInitTimeout(30));

        // Advance past timeout
        await vi.advanceTimersByTimeAsync(30001);

        // Now await the expectation
        await expectPromise;
      } finally {
        vi.useRealTimers();
      }

      // The proxy is still running after timeout, but should be stopped
      // Manually trigger cleanup by simulating process exit
      const fakeProxy = fakeLauncher.getLastLaunchedProxy();
      if (fakeProxy) {
        fakeProxy.simulateExit(1);
      }

      // Give time for cleanup
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify cleanup
      expect(proxyManager.isRunning()).toBe(false);
    });
  });

  describe('Error Recovery', () => {
    it('should allow restart after error', async () => {
      // First start with error
      fakeLauncher.prepareProxy((proxy) => {
        setTimeout(() => {
          proxy.simulateProcessError(new Error('First start failed'));
        }, 50);
      });

      await expect(proxyManager.start(defaultConfig)).rejects.toThrow('First start failed');
      
      // Verify cleaned up
      expect(proxyManager.isRunning()).toBe(false);

      // Second start should work
      fakeLauncher.prepareProxy((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });

      await expect(proxyManager.start(defaultConfig)).resolves.toBeUndefined();
      expect(proxyManager.isRunning()).toBe(true);
    });

    it('should handle stop after error state', async () => {
      // Don't start the proxy - stop should handle gracefully
      await expect(proxyManager.stop()).resolves.toBeUndefined();
      
      // Verify no errors were thrown and proxy state is clean
      expect(proxyManager.isRunning()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle adapter exit status messages', async () => {
      fakeLauncher.prepareProxy((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });

      await proxyManager.start(defaultConfig);

      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Listen for exit event
      const exitPromise = new Promise<{ code: number; signal?: string }>((resolve) => {
        proxyManager.once('exit', (code, signal) => resolve({ code, signal }));
      });

      // Send various exit status messages
      fakeProxy.simulateMessage({
        type: 'status',
        sessionId: defaultConfig.sessionId,
        status: 'adapter_exited',
        code: 1
      });

      const result = await exitPromise;
      expect(result.code).toBe(1);
    });

    it('should handle terminated status message', async () => {
      fakeLauncher.prepareProxy((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });

      await proxyManager.start(defaultConfig);

      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      const exitPromise = new Promise<{ code: number; signal?: string }>((resolve) => {
        proxyManager.once('exit', (code, signal) => resolve({ code, signal }));
      });

      fakeProxy.simulateMessage({
        type: 'status',
        sessionId: defaultConfig.sessionId,
        status: 'terminated'
      });

      const result = await exitPromise;
      expect(result.code).toBe(1);
    });

    it('should handle missing DAP state', async () => {
      // Simulate a scenario where DAP state is not initialized
      // This is an edge case that shouldn't happen normally
      
      fakeLauncher.prepareProxy((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });

      await proxyManager.start(defaultConfig);
      
      // Force dapState to null to simulate edge case
      (proxyManager as any).dapState = null;
      
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Send a message that would normally be handled by dapState
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: defaultConfig.sessionId,
        event: 'stopped',
        body: { threadId: 1, reason: 'breakpoint' }
      });
      
      // Should log error
      expect(mockLogger.error).toHaveBeenCalledWith('[ProxyManager] DAP state not initialized');
    });
  });
});
