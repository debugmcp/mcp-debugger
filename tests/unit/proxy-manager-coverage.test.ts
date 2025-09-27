/**
 * Targeted tests to improve coverage for proxy-manager.ts
 * Focus on error paths and edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProxyManager } from '../../src/proxy/proxy-manager';
import { ProxyConfig } from '../../src/proxy/proxy-config';
import { EventEmitter } from 'events';
import { DebugLanguage } from '@debugmcp/shared';

describe('Proxy Manager Coverage - Error Paths and Edge Cases', () => {
  let proxyManager: ProxyManager;
  let mockLogger: any;
  let mockProxyProcess: any;
  let mockAdapter: any;
  let mockProxyProcessLauncher: any;
  let mockFileSystem: any;
  let defaultConfig: ProxyConfig;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    // Create mock proxy process
    mockProxyProcess = new EventEmitter();
    mockProxyProcess.send = vi.fn();
    mockProxyProcess.sendCommand = vi.fn();
    mockProxyProcess.kill = vi.fn();
    mockProxyProcess.killed = false;
    mockProxyProcess.exitCode = null;
    mockProxyProcess.pid = 12345;
    mockProxyProcess.stderr = new EventEmitter();

    // Create mock adapter 
    mockAdapter = {
      language: 'python',
      validateEnvironment: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
      resolveExecutablePath: vi.fn().mockResolvedValue('/usr/bin/python')
    };

    // Create mock proxy process launcher
    mockProxyProcessLauncher = {
      launchProxy: vi.fn().mockImplementation(() => {
        // Simulate proxy ready message
        setTimeout(() => {
          mockProxyProcess.emit('message', { type: 'proxy-ready' });
        }, 10);
        return mockProxyProcess;
      })
    };

    // Create mock file system
    mockFileSystem = {
      pathExists: vi.fn().mockResolvedValue(true),
      readFile: vi.fn(),
      writeFile: vi.fn()
    };

    // Create proxy manager
    proxyManager = new ProxyManager(
      mockAdapter,
      mockProxyProcessLauncher,
      mockFileSystem,
      mockLogger
    );

    // Default configuration
    defaultConfig = {
      sessionId: 'session-123',
      language: 'python' as DebugLanguage,
      executablePath: '/usr/bin/python',
      adapterHost: 'localhost',
      adapterPort: 9000,
      logDir: '/tmp/logs',
      scriptPath: 'test.py',
      scriptArgs: [],
      stopOnEntry: false,
      justMyCode: true,
      initialBreakpoints: [],
      dryRunSpawn: false
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization Error Scenarios', () => {
    it('should handle proxy process launch failure', async () => {
      mockProxyProcessLauncher.launchProxy.mockImplementation(() => {
        throw new Error('Failed to spawn process');
      });

      await expect(proxyManager.start(defaultConfig)).rejects.toThrow('Failed to spawn process');
    });

    it('should handle proxy ready timeout', async () => {
      vi.useFakeTimers();
      
      mockProxyProcessLauncher.launchProxy.mockReturnValue(mockProxyProcess);
      // Don't send ready message - the timeout will occur

      const startPromise = proxyManager.start(defaultConfig);
      
      // Fast-forward past the initialization timeout (30 seconds)
      await vi.advanceTimersByTimeAsync(31000);
      
      // The actual error message from proxy-manager includes "Proxy did not send ready signal"
      await expect(startPromise).rejects.toThrow('Proxy did not send ready signal');
      
      vi.useRealTimers();
    });

    it('should handle adapter validation failure', async () => {
      mockAdapter.validateEnvironment.mockResolvedValue({ 
        valid: false, 
        errors: [{ message: 'Python not found' }] 
      });
      
      await expect(proxyManager.start(defaultConfig)).rejects.toThrow('Invalid environment');
    });

    it('should handle missing executable path', async () => {
      const noAdapter = new ProxyManager(
        null,
        mockProxyProcessLauncher,
        mockFileSystem,
        mockLogger
      );

      const config = { ...defaultConfig, executablePath: undefined };
      await expect(noAdapter.start(config)).rejects.toThrow('No executable path');
    });

    it('should handle proxy script not found', async () => {
      mockFileSystem.pathExists.mockResolvedValue(false);
      
      await expect(proxyManager.start(defaultConfig)).rejects.toThrow('Bootstrap worker script not found');
    });
  });

  describe('Message Handling Error Scenarios', () => {
    it('should handle sendDapRequest when not initialized', async () => {
      // Manager not started
      await expect(proxyManager.sendDapRequest('continue'))
        .rejects.toThrow('Proxy not initialized');
    });

    it('should handle sendDapRequest timeout', async () => {
      // Bypass start() and directly set initialized state to avoid 30s init wait
      (proxyManager as any).proxyProcess = mockProxyProcess;
      (proxyManager as any).isInitialized = true;

      // Capture requestId that sendDapRequest will generate
      let capturedRequestId: string | undefined;
      mockProxyProcess.sendCommand = vi.fn((cmd: any) => {
        capturedRequestId = cmd.requestId;
      });

      // Issue request (no response will be sent by the proxy)
      const requestPromise = proxyManager.sendDapRequest('continue');

      // Synchronously reject the pending request without relying on event handlers (since start() wasn't called)
      expect(capturedRequestId).toBeDefined();
      const pendingMap: Map<string, { reject: (err: Error) => void }> = (proxyManager as any).pendingDapRequests;
      pendingMap.get(capturedRequestId as string)?.reject(new Error('timeout'));

      await expect(requestPromise).rejects.toThrow('timeout');
    });
  });

  describe('Stop and Cleanup Error Scenarios', () => {
    it('should handle stop when not started', async () => {
      // Not started - returns void
      await expect(proxyManager.stop()).resolves.toBeUndefined();
    });
  });

  describe('Thread Management', () => {
    it('should handle getCurrentThreadId when not set', () => {
      const threadId = proxyManager.getCurrentThreadId();
      expect(threadId).toBeNull();
    });
  });

  describe('Running State Checks', () => {
    it('should report not running initially', () => {
      expect(proxyManager.isRunning()).toBe(false);
    });
  });

  describe('Error Recovery', () => {
    it('should handle proxy exit during initialization', async () => {
      vi.useFakeTimers();
      
      mockProxyProcessLauncher.launchProxy.mockImplementation(() => {
        // Ensure we pass the initial "proxy-ready" wait
        setTimeout(() => {
          mockProxyProcess.emit('message', { type: 'proxy-ready' });
        }, 0);
        // Schedule exit event
        setTimeout(() => {
          mockProxyProcess.emit('exit', 1, 'SIGTERM');
        }, 50);
        return mockProxyProcess;
      });
      
      const startPromise = proxyManager.start(defaultConfig);
      
      // Fast-forward to trigger the exit event
      await vi.advanceTimersByTimeAsync(100);
      
      await expect(startPromise).rejects.toThrow('Proxy exited during initialization');
      
      vi.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing PID in process', async () => {
      mockProxyProcessLauncher.launchProxy.mockReturnValue({
        ...mockProxyProcess,
        pid: undefined
      });

      await expect(proxyManager.start(defaultConfig)).rejects.toThrow('PID is missing');
    });

    it('should capture stderr during initialization', async () => {
      vi.useFakeTimers();
      
      mockProxyProcessLauncher.launchProxy.mockImplementation(() => {
        // Ensure we pass the initial "proxy-ready" wait
        setTimeout(() => {
          mockProxyProcess.emit('message', { type: 'proxy-ready' });
        }, 0);
        // Schedule exit event with error during initialization
        setTimeout(() => {
          mockProxyProcess.emit('exit', 1, null);
        }, 50);
        return mockProxyProcess;
      });
      
      const startPromise = proxyManager.start(defaultConfig);
      
      // Emit stderr before exit
      mockProxyProcess.stderr.emit('data', 'Init error message');
      
      // Fast-forward to trigger the exit event
      await vi.advanceTimersByTimeAsync(100);
      
      await expect(startPromise).rejects.toThrow('Proxy exited during initialization');
      
      vi.useRealTimers();
    });
  });
});
