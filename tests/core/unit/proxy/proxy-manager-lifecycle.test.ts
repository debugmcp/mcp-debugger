/**
 * ProxyManager Lifecycle Tests
 * Tests for process spawning, initialization, shutdown, and state management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProxyManager } from '../../../../src/proxy/proxy-manager.js';
import { ProxyConfig } from '../../../../src/proxy/proxy-config.js';
import { FakeProxyProcessLauncher } from '../../../implementations/test/fake-process-launcher.js';
import { createMockLogger, createMockFileSystem } from '../../../test-utils/helpers/test-utils.js';
import { ILogger, IFileSystem } from '../../../../src/interfaces/external-dependencies.js';
import { ErrorMessages } from '../../../../src/utils/error-messages.js';
import { DebugLanguage } from '@debugmcp/shared';

describe('ProxyManager - Lifecycle', () => {
  let proxyManager: ProxyManager;
  let fakeLauncher: FakeProxyProcessLauncher;
  let mockLogger: ILogger;
  let mockFileSystem: IFileSystem;

  // Default test config
  const defaultConfig: ProxyConfig = {
    sessionId: 'test-session-123',
    language: DebugLanguage.MOCK,
    executablePath: 'python',
    adapterHost: '127.0.0.1',
    adapterPort: 5678,
    logDir: '/tmp/logs',
    scriptPath: 'test.py',
    scriptArgs: ['--arg1', 'value1'],
    stopOnEntry: false,
    justMyCode: true
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

  // Helper function to prepare a proxy with proxy-ready signal
  const prepareProxyWithReady = (setup: (proxy: any) => void) => {
    fakeLauncher.prepareProxy((proxy) => {
      // Send proxy-ready signal immediately to allow initialization to proceed
      process.nextTick(() => {
        proxy.simulateMessage({ type: 'proxy-ready', pid: process.pid });
      });
      // Run custom setup
      setup(proxy);
    });
  };

  describe('Constructor', () => {
    it('should create ProxyManager with dependencies', () => {
      expect(proxyManager).toBeDefined();
      expect(proxyManager.isRunning()).toBe(false);
      expect(proxyManager.getCurrentThreadId()).toBe(null);
    });
  });

  describe('start()', () => {
    it('should start proxy process with correct configuration', async () => {
      // Prepare a fake process that will simulate successful initialization
      prepareProxyWithReady((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });

      await proxyManager.start(defaultConfig);

      // Verify process was launched
      expect(fakeLauncher.launchedProxies).toHaveLength(1);
      const launchCall = fakeLauncher.launchedProxies[0];
      expect(launchCall.sessionId).toBe(defaultConfig.sessionId);

      // Verify initialization command was sent
      const fakeProxy = fakeLauncher.getLastLaunchedProxy();
      expect(fakeProxy?.sentCommands).toHaveLength(1);
      const initCommand = fakeProxy?.sentCommands[0] as any;
      expect(initCommand.cmd).toBe('init');
      expect(initCommand.sessionId).toBe(defaultConfig.sessionId);
      expect(initCommand.executablePath).toBe(defaultConfig.executablePath);
      expect(initCommand.adapterHost).toBe(defaultConfig.adapterHost);
      expect(initCommand.adapterPort).toBe(defaultConfig.adapterPort);
      expect(initCommand.scriptPath).toBe(defaultConfig.scriptPath);
      expect(initCommand.scriptArgs).toEqual(defaultConfig.scriptArgs);

      // Verify state
      expect(proxyManager.isRunning()).toBe(true);
    });

    it('should handle dry run mode', async () => {
      const dryRunConfig = { ...defaultConfig, dryRunSpawn: true };

      prepareProxyWithReady((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: dryRunConfig.sessionId,
            status: 'dry_run_complete',
            command: 'python',
            script: dryRunConfig.scriptPath
          });
          // Simulate normal exit for dry run
          proxy.simulateExit(0);
        }, 50);
      });

      await proxyManager.start(dryRunConfig);

      const fakeProxy = fakeLauncher.getLastLaunchedProxy();
      const initCommand = fakeProxy?.sentCommands[0] as any;
      expect(initCommand.dryRunSpawn).toBe(true);
    });

    it('should reject if proxy already running', async () => {
      prepareProxyWithReady((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });

      await proxyManager.start(defaultConfig);
      
      await expect(proxyManager.start(defaultConfig))
        .rejects.toThrow('Proxy already running');
    });

    it('should handle process spawn failure', async () => {
      // Mock file system to simulate proxy script not found
      vi.mocked(mockFileSystem.pathExists).mockResolvedValue(false);

      await expect(proxyManager.start(defaultConfig))
        .rejects.toThrow('Bootstrap worker script not found');
    });

    it('should handle initialization timeout', async () => {
      // Setup fake timers before any async operations
      vi.useFakeTimers();
      
      try {
        // Start the async operation that will timeout
        const startPromise = proxyManager.start(defaultConfig);
        
        // Immediately attach rejection expectation before advancing timers
        const expectPromise = expect(startPromise).rejects.toThrow(ErrorMessages.proxyInitTimeout(30));

        // Advance timers using the async method
        await vi.advanceTimersByTimeAsync(30001);

        // Now await the expectation
        await expectPromise;
      } finally {
        // Always restore real timers
        vi.useRealTimers();
      }
    });

    it('should handle process exit during initialization', async () => {
      prepareProxyWithReady((proxy) => {
        setTimeout(() => {
          proxy.simulateExit(1, 'SIGTERM');
        }, 50);
      });

      await expect(proxyManager.start(defaultConfig))
        .rejects.toThrow('Proxy exited during initialization. Code: 1, Signal: SIGTERM');
    });

    it('should handle error during initialization', async () => {
      prepareProxyWithReady((proxy) => {
        setTimeout(() => {
          proxy.simulateProcessError(new Error('Failed to connect to adapter'));
        }, 50);
      });

      await expect(proxyManager.start(defaultConfig))
        .rejects.toThrow('Failed to connect to adapter');
    });

    it('should set up initial breakpoints if provided', async () => {
      const configWithBreakpoints = {
        ...defaultConfig,
        initialBreakpoints: [
          { file: 'test.py', line: 10 },
          { file: 'test.py', line: 20, condition: 'x > 5' }
        ]
      };

      prepareProxyWithReady((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: configWithBreakpoints.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });

      await proxyManager.start(configWithBreakpoints);

      const fakeProxy = fakeLauncher.getLastLaunchedProxy();
      const initCommand = fakeProxy?.sentCommands[0] as any;
      expect(initCommand.initialBreakpoints).toEqual(configWithBreakpoints.initialBreakpoints);
    });
  });

  describe('stop()', () => {
    beforeEach(async () => {
      // Start proxy first
      prepareProxyWithReady((proxy) => {
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

    it('should stop running proxy gracefully', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Track terminate command
      let terminateReceived = false;
      
      // Simulate graceful exit when terminate command is received
      fakeProxy.on('message', (msg: any) => {
        if (msg.cmd === 'terminate') {
          terminateReceived = true;
          setTimeout(() => fakeProxy.simulateExit(0), 50);
        }
      });

      await proxyManager.stop();

      // Verify terminate command was sent
      expect(terminateReceived).toBe(true);

      // Verify state is cleaned up
      expect(proxyManager.isRunning()).toBe(false);
      expect(proxyManager.getCurrentThreadId()).toBe(null);
    });

    it('should force kill proxy after timeout', async () => {
      vi.useFakeTimers();
      
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      const killSpy = vi.spyOn(fakeProxy, 'kill');

      // Don't respond to terminate command
      const stopPromise = proxyManager.stop();

      // Fast-forward past graceful shutdown timeout
      vi.advanceTimersByTime(5001);

      await stopPromise;

      expect(killSpy).toHaveBeenCalledWith('SIGKILL');
    });

    it('should handle stop when proxy not running', async () => {
      // Stop it first
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateExit(0);
      await proxyManager.stop();

      // Try to stop again
      await expect(proxyManager.stop()).resolves.toBeUndefined();
    });

    it('should handle error sending terminate command', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Make send throw
      fakeProxy.send = vi.fn().mockImplementation(() => {
        throw new Error('IPC channel closed');
      });

      // Should still complete stop
      await expect(proxyManager.stop()).resolves.toBeUndefined();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending terminate command'),
        expect.any(Error)
      );
    });
  });

  describe('isRunning()', () => {
    it('should return false when not started', () => {
      expect(proxyManager.isRunning()).toBe(false);
    });

    it('should return true when proxy is running', async () => {
      prepareProxyWithReady((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });

      await proxyManager.start(defaultConfig);
      expect(proxyManager.isRunning()).toBe(true);
    });

    it('should return false after proxy exits', async () => {
      prepareProxyWithReady((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });

      await proxyManager.start(defaultConfig);
      expect(proxyManager.isRunning()).toBe(true);

      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateExit(0);

      expect(proxyManager.isRunning()).toBe(false);
    });
  });

  describe('getCurrentThreadId()', () => {
    it('should return null when not started', () => {
      expect(proxyManager.getCurrentThreadId()).toBe(null);
    });

    it('should return thread ID after stopped event', async () => {
      prepareProxyWithReady((proxy) => {
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
      
      // Simulate stopped event
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: defaultConfig.sessionId,
        event: 'stopped',
        body: { threadId: 42, reason: 'breakpoint' }
      });

      expect(proxyManager.getCurrentThreadId()).toBe(42);
    });

    it('should return null after stop', async () => {
      prepareProxyWithReady((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
          setTimeout(() => {
            proxy.simulateMessage({
              type: 'dapEvent',
              sessionId: defaultConfig.sessionId,
              event: 'stopped',
              body: { threadId: 42, reason: 'breakpoint' }
            });
          }, 100);
        }, 50);
      });

      await proxyManager.start(defaultConfig);
      
      // Wait for thread ID to be set
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(proxyManager.getCurrentThreadId()).toBe(42);

      // Stop and verify thread ID is cleared
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateExit(0);
      await proxyManager.stop();
      
      expect(proxyManager.getCurrentThreadId()).toBe(null);
    });
  });

  describe('Process Exit Handling', () => {
    it('should emit exit event when proxy process exits', async () => {
      prepareProxyWithReady((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });

      await proxyManager.start(defaultConfig);

      const exitPromise = new Promise<{ code: number; signal?: string }>((resolve) => {
        proxyManager.once('exit', (code, signal) => resolve({ code, signal }));
      });

      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateExit(0, 'SIGTERM');

      const result = await exitPromise;
      expect(result.code).toBe(0);
      expect(result.signal).toBe('SIGTERM');
      expect(proxyManager.isRunning()).toBe(false);
    });

    it('should clean up pending DAP requests on exit', async () => {
      prepareProxyWithReady((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });

      await proxyManager.start(defaultConfig);

      // Start a DAP request that won't complete
      const dapPromise = proxyManager.sendDapRequest('stackTrace', { threadId: 1 });

      // Simulate process exit
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateExit(1);

      await expect(dapPromise).rejects.toThrow('Proxy exited');
    });
  });

  describe('Status Message Handling', () => {
    it('should handle IPC test message', async () => {
      let ipcTestReceived = false;
      
      prepareProxyWithReady((proxy) => {
        // Override kill to track it was called but don't actually exit
        const originalKill = proxy.kill.bind(proxy);
        proxy.kill = vi.fn((signal) => {
          ipcTestReceived = true;
          // Don't actually kill to avoid rejecting the promise
          return true;
        });
        
        setTimeout(() => {
          // Send IPC test message
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'proxy_minimal_ran_ipc_test',
            message: 'IPC test successful'
          });
          
          // Then send initialization to complete start
          setTimeout(() => {
            proxy.simulateMessage({
              type: 'status',
              sessionId: defaultConfig.sessionId,
              status: 'adapter_configured_and_launched'
            });
          }, 50);
        }, 50);
      });

      await proxyManager.start(defaultConfig);
      
      // Verify IPC test was received and kill was called
      expect(ipcTestReceived).toBe(true);
      
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      expect(fakeProxy.kill).toHaveBeenCalled();
    });

    it('should emit dry-run-complete event', async () => {
      const config = { ...defaultConfig, dryRunSpawn: true };
      
      prepareProxyWithReady((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: config.sessionId,
            status: 'dry_run_complete',
            command: 'python -m debugpy',
            script: config.scriptPath
          });
        }, 50);
      });

      const dryRunPromise = new Promise<{ command: string; script: string }>((resolve) => {
        proxyManager.once('dry-run-complete', (command, script) => resolve({ command, script }));
      });

      await proxyManager.start(config);

      const result = await dryRunPromise;
      expect(result.command).toBe('python -m debugpy');
      expect(result.script).toBe(config.scriptPath);
    });

    it('should emit adapter-configured event', async () => {
      const adapterConfiguredPromise = new Promise<void>((resolve) => {
        proxyManager.once('adapter-configured', resolve);
      });

      prepareProxyWithReady((proxy) => {
        setTimeout(() => {
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });

      await proxyManager.start(defaultConfig);
      await adapterConfiguredPromise;

      // Verify adapter-configured was emitted
      expect.assertions(0); // Just verifying the promise resolved
    });
  });

  describe('Multiple Initialization', () => {
    it('should only emit initialized once', async () => {
      let initCount = 0;
      proxyManager.on('initialized', () => initCount++);

      prepareProxyWithReady((proxy) => {
        setTimeout(() => {
          // Send multiple adapter_configured messages
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
          proxy.simulateMessage({
            type: 'status',
            sessionId: defaultConfig.sessionId,
            status: 'adapter_configured_and_launched'
          });
        }, 50);
      });

      await proxyManager.start(defaultConfig);
      
      // Give time for both messages to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(initCount).toBe(1);
    });
  });
});
