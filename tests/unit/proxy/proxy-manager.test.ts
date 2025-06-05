/**
 * Unit tests for ProxyManager
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProxyManager, ProxyConfig } from '../../../src/proxy/proxy-manager.js';
import { IFileSystem, ILogger } from '../../../src/interfaces/external-dependencies.js';
import { FakeProxyProcessLauncher, FakeProxyProcess } from '../../implementations/test/fake-process-launcher.ts';
import { waitForEvent, delay } from '../../utils/test-utils.js';
import { DebugProtocol } from '@vscode/debugprotocol';

describe.skip('ProxyManager', () => {
  let proxyManager: ProxyManager;
  let fakeProxyLauncher: FakeProxyProcessLauncher;
  let mockFileSystem: IFileSystem;
  let mockLogger: ILogger;

  beforeEach(() => {
    // Setup fakes and mocks
    fakeProxyLauncher = new FakeProxyProcessLauncher();
    
    mockFileSystem = {
      pathExists: vi.fn().mockImplementation(async (path: string) => {
        // Mock that proxy-bootstrap.js exists
        return path.includes('proxy-bootstrap');
      }),
      readFile: vi.fn() as any,
      writeFile: vi.fn() as any,
      ensureDir: vi.fn() as any,
      remove: vi.fn() as any,
      copy: vi.fn() as any,
      outputFile: vi.fn() as any,
      exists: vi.fn() as any,
      mkdir: vi.fn() as any,
      readdir: vi.fn() as any,
      stat: vi.fn() as any,
      unlink: vi.fn() as any,
      rmdir: vi.fn() as any,
      ensureDirSync: vi.fn() as any
    } as IFileSystem;
    
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    } as ILogger;
    
    proxyManager = new ProxyManager(
      fakeProxyLauncher,
      mockFileSystem,
      mockLogger
    );
  });

  afterEach(async () => {
    // Clean up any running proxy
    if (proxyManager.isRunning()) {
      try {
        const lastProxy = fakeProxyLauncher.getLastLaunchedProxy();
        if (lastProxy) {
          lastProxy.simulateExit(0);
        }
        await proxyManager.stop();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    
    // Remove all event listeners
    proxyManager.removeAllListeners();
    
    // Reset mocks
    fakeProxyLauncher.reset();
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('start', () => {
    const defaultConfig: ProxyConfig = {
      sessionId: 'test-session-123',
      pythonPath: '/usr/bin/python',
      adapterHost: 'localhost',
      adapterPort: 5678,
      logDir: '/tmp/logs',
      scriptPath: 'test.py',
      scriptArgs: ['--debug'],
      stopOnEntry: false,
      justMyCode: true,
      initialBreakpoints: [],
      dryRunSpawn: false
    };

    it('should successfully start proxy in normal mode', async () => {
      const startPromise = proxyManager.start(defaultConfig);
      
      // Wait a bit for the process to be spawned
      await delay(10);
      
      // Verify proxy was launched correctly
      expect(fakeProxyLauncher.launchedProxies).toHaveLength(1);
      const launchedProxy = fakeProxyLauncher.launchedProxies[0];
      expect(launchedProxy.proxyScriptPath).toContain('proxy-bootstrap.js');
      expect(launchedProxy.sessionId).toBe(defaultConfig.sessionId);
      expect(launchedProxy.env).toHaveProperty('MCP_SERVER_CWD');
      
      // Get the fake proxy
      const fakeProxy = fakeProxyLauncher.getLastLaunchedProxy()!;
      expect(fakeProxy).toBeDefined();
      
      // Verify init command was sent
      expect(fakeProxy.sentCommands).toHaveLength(1);
      const initCommand = fakeProxy.sentCommands[0] as any;
      expect(initCommand.cmd).toBe('init');
      expect(initCommand.sessionId).toBe(defaultConfig.sessionId);
      expect(initCommand.pythonPath).toBe(defaultConfig.pythonPath);
      expect(initCommand.scriptPath).toBe(defaultConfig.scriptPath);
      
      // Simulate successful initialization
      fakeProxy.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: defaultConfig.sessionId
      });
      
      await expect(startPromise).resolves.toBeUndefined();
      expect(proxyManager.isRunning()).toBe(true);
    });

    it('should successfully start proxy in dry run mode', async () => {
      const dryRunConfig = { ...defaultConfig, dryRunSpawn: true };
      const startPromise = proxyManager.start(dryRunConfig);
      
      await delay(10);
      
      const fakeProxy = fakeProxyLauncher.getLastLaunchedProxy()!;
      
      // Simulate dry run complete
      fakeProxy.simulateMessage({
        type: 'status',
        status: 'dry_run_complete',
        sessionId: dryRunConfig.sessionId,
        command: 'python test.py --debug',
        script: 'test.py'
      });
      
      await expect(startPromise).resolves.toBeUndefined();
    });

    it('should reject if proxy script not found', async () => {
      (mockFileSystem.pathExists as any).mockResolvedValue(false);
      
      await expect(proxyManager.start(defaultConfig)).rejects.toThrow(
        'Bootstrap worker script not found'
      );
    });

    it('should reject if spawn fails', async () => {
      // Prepare launcher to throw error
      fakeProxyLauncher.launchProxy = vi.fn().mockImplementation(() => {
        throw new Error('Failed to spawn process');
      });
      
      await expect(proxyManager.start(defaultConfig)).rejects.toThrow('Failed to spawn process');
    });

    it('should reject if already running', async () => {
      // Start first instance
      const firstStart = proxyManager.start(defaultConfig);
      await delay(10);
      const fakeProxy = fakeProxyLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: defaultConfig.sessionId
      });
      await firstStart;
      
      // Try to start again
      await expect(proxyManager.start(defaultConfig)).rejects.toThrow(
        'Proxy already running'
      );
    });

    it('should reject on initialization timeout', async () => {
      vi.useFakeTimers();
      
      try {
        const startPromise = proxyManager.start(defaultConfig);
        
        // Let microtasks run
        await Promise.resolve();
        
        // Fast-forward time to trigger timeout
        await vi.advanceTimersByTimeAsync(30000);
        
        await expect(startPromise).rejects.toThrow('Proxy initialization timeout');
      } finally {
        vi.useRealTimers();
      }
    }, 20000);

    it('should reject if proxy exits during initialization', async () => {
      const startPromise = proxyManager.start(defaultConfig);
      
      await delay(10);
      
      const fakeProxy = fakeProxyLauncher.getLastLaunchedProxy()!;
      
      // Simulate unexpected exit
      fakeProxy.simulateExit(1, 'SIGTERM');
      
      await expect(startPromise).rejects.toThrow(
        'Proxy exited during initialization. Code: 1, Signal: SIGTERM'
      );
    }, 20000);

    it('should handle dry run normal exit', async () => {
      const dryRunConfig = { ...defaultConfig, dryRunSpawn: true };
      const startPromise = proxyManager.start(dryRunConfig);
      
      await delay(10);
      
      const fakeProxy = fakeProxyLauncher.getLastLaunchedProxy()!;
      
      // Simulate normal exit for dry run
      fakeProxy.simulateExit(0);
      
      await expect(startPromise).resolves.toBeUndefined();
    }, 20000);

    it('should reject on initialization error', async () => {
      const startPromise = proxyManager.start(defaultConfig);
      
      await delay(10);
      
      // Simulate error during initialization
      proxyManager.emit('error', new Error('Init failed'));
      
      await expect(startPromise).rejects.toThrow('Init failed');
    }, 20000);
  });

  describe('stop', () => {
    let fakeProxy: FakeProxyProcess;

    beforeEach(async () => {
      // Start proxy first
      const config: ProxyConfig = {
        sessionId: 'test-session-123',
        pythonPath: '/usr/bin/python',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: 'test.py'
      };
      
      const startPromise = proxyManager.start(config);
      await delay(10);
      
      fakeProxy = fakeProxyLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: config.sessionId
      });
      await startPromise;
    }, 20000);

    it('should send terminate command and wait for exit', async () => {
      const stopPromise = proxyManager.stop();
      
      // Verify terminate command was sent
      const lastCommand = fakeProxy.sentCommands[fakeProxy.sentCommands.length - 1] as any;
      expect(lastCommand.cmd).toBe('terminate');
      
      // Simulate graceful exit
      fakeProxy.simulateExit(0);
      
      await expect(stopPromise).resolves.toBeUndefined();
    }, 20000);

    it('should force kill after timeout', async () => {
      vi.useFakeTimers();
      
      try {
        // Make kill a spy
        const originalKill = fakeProxy.kill.bind(fakeProxy);
        fakeProxy.kill = vi.fn().mockImplementation(originalKill);
        
        const stopPromise = proxyManager.stop();
        
        // Let microtasks run
        await Promise.resolve();
        
        // Fast-forward to timeout
        await vi.advanceTimersByTimeAsync(5000);
        
        // Verify force kill was called
        expect(fakeProxy.kill).toHaveBeenCalledWith('SIGKILL');
        
        // Simulate process exit after kill
        fakeProxy.simulateExit(0);
        
        await expect(stopPromise).resolves.toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    }, 20000);

    it('should handle stop when already stopped', async () => {
      // First stop
      const firstStop = proxyManager.stop();
      fakeProxy.simulateExit(0);
      await firstStop;
      
      // Second stop should be no-op
      await expect(proxyManager.stop()).resolves.toBeUndefined();
    }, 20000);

    it('should handle errors when sending terminate command', async () => {
      // Override sendCommand to throw
      fakeProxy.sendCommand = vi.fn().mockImplementationOnce(() => {
        throw new Error('Send failed');
      });
      
      const stopPromise = proxyManager.stop();
      
      // Should still resolve even if send fails
      fakeProxy.simulateExit(0);
      
      await expect(stopPromise).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending terminate command'),
        expect.any(Error)
      );
    }, 20000);
  });

  describe('sendDapRequest', () => {
    let fakeProxy: FakeProxyProcess;

    beforeEach(async () => {
      // Start proxy first
      const config: ProxyConfig = {
        sessionId: 'test-session-123',
        pythonPath: '/usr/bin/python',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: 'test.py'
      };
      
      const startPromise = proxyManager.start(config);
      await delay(10);
      
      fakeProxy = fakeProxyLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: config.sessionId
      });
      await startPromise;
    }, 20000);

    it('should send DAP request and return response', async () => {
      const requestPromise = proxyManager.sendDapRequest<DebugProtocol.ThreadsResponse>(
        'threads'
      );
      
      await delay(10);
      
      // Get the sent command
      const lastCommand = fakeProxy.sentCommands[fakeProxy.sentCommands.length - 1] as any;
      expect(lastCommand.cmd).toBe('dap');
      expect(lastCommand.dapCommand).toBe('threads');
      const requestId = lastCommand.requestId;
      
      // Simulate response
      const mockResponse: DebugProtocol.ThreadsResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'threads',
        success: true,
        body: {
          threads: [{ id: 1, name: 'MainThread' }]
        }
      };
      
      fakeProxy.simulateMessage({
        type: 'dapResponse',
        sessionId: 'test-session-123',
        requestId,
        success: true,
        response: mockResponse
      });
      
      const response = await requestPromise;
      expect(response).toEqual(mockResponse);
    }, 20000);

    it('should handle DAP request failure', async () => {
      const requestPromise = proxyManager.sendDapRequest('continue');
      
      await delay(10);
      
      const lastCommand = fakeProxy.sentCommands[fakeProxy.sentCommands.length - 1] as any;
      const requestId = lastCommand.requestId;
      
      // Simulate error response
      fakeProxy.simulateMessage({
        type: 'dapResponse',
        sessionId: 'test-session-123',
        requestId,
        success: false,
        error: 'Continue failed: No active thread'
      });
      
      await expect(requestPromise).rejects.toThrow('Continue failed: No active thread');
    }, 20000);

    it('should reject if proxy not initialized', async () => {
      // Create new instance without starting
      const uninitializedProxy = new ProxyManager(
        fakeProxyLauncher,
        mockFileSystem,
        mockLogger
      );
      
      await expect(uninitializedProxy.sendDapRequest('threads')).rejects.toThrow(
        'Proxy not initialized'
      );
    }, 20000);

    it('should handle request timeout', async () => {
      vi.useFakeTimers();
      
      try {
        const requestPromise = proxyManager.sendDapRequest('evaluate', {
          expression: 'complex_computation()'
        });
        
        // Let microtasks run
        await Promise.resolve();
        
        // Fast-forward to timeout
        await vi.advanceTimersByTimeAsync(35000);
        
        await expect(requestPromise).rejects.toThrow('Timeout waiting for DAP response: evaluate');
      } finally {
        vi.useRealTimers();
      }
    }, 20000);

    it('should handle send command failure', async () => {
      fakeProxy.sendCommand = vi.fn().mockImplementationOnce(() => {
        throw new Error('IPC channel closed');
      });
      
      await expect(proxyManager.sendDapRequest('threads')).rejects.toThrow(
        'IPC channel closed'
      );
    }, 20000);

    it('should handle concurrent requests', async () => {
      const request1 = proxyManager.sendDapRequest('threads');
      const request2 = proxyManager.sendDapRequest('stackTrace', { threadId: 1 });
      
      await delay(10);
      
      // Get request IDs
      const commands = fakeProxy.sentCommands.slice(-2);
      const requestId1 = (commands[0] as any).requestId;
      const requestId2 = (commands[1] as any).requestId;
      
      // Respond to requests out of order
      fakeProxy.simulateMessage({
        type: 'dapResponse',
        sessionId: 'test-session-123',
        requestId: requestId2,
        success: true,
        body: { stackFrames: [] }
      });
      
      fakeProxy.simulateMessage({
        type: 'dapResponse',
        sessionId: 'test-session-123',
        requestId: requestId1,
        success: true,
        body: { threads: [] }
      });
      
      const [response1, response2] = await Promise.all([request1, request2]);
      expect(response1).toHaveProperty('threads');
      expect(response2).toHaveProperty('stackFrames');
    }, 20000);
  });

  describe('event handling', () => {
    let fakeProxy: FakeProxyProcess;

    beforeEach(async () => {
      // Start proxy first
      const config: ProxyConfig = {
        sessionId: 'test-session-123',
        pythonPath: '/usr/bin/python',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: 'test.py'
      };
      
      const startPromise = proxyManager.start(config);
      await delay(10);
      
      fakeProxy = fakeProxyLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: config.sessionId
      });
      await startPromise;
    }, 20000);

    it('should emit stopped event when receiving DAP stopped event', async () => {
      const stoppedPromise = waitForEvent(proxyManager, 'stopped');
      
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: 'test-session-123',
        event: 'stopped',
        body: { threadId: 1, reason: 'breakpoint' }
      });
      
      const [threadId, reason] = await stoppedPromise;
      expect(threadId).toBe(1);
      expect(reason).toBe('breakpoint');
      expect(proxyManager.getCurrentThreadId()).toBe(1);
    }, 20000);

    it('should emit continued event', async () => {
      const continuedPromise = waitForEvent(proxyManager, 'continued');
      
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: 'test-session-123',
        event: 'continued',
        body: {}
      });
      
      await continuedPromise;
    }, 20000);

    it('should emit terminated event', async () => {
      const terminatedPromise = waitForEvent(proxyManager, 'terminated');
      
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: 'test-session-123',
        event: 'terminated',
        body: {}
      });
      
      await terminatedPromise;
    }, 20000);

    it('should emit exited event', async () => {
      const exitedPromise = waitForEvent(proxyManager, 'exited');
      
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: 'test-session-123',
        event: 'exited',
        body: {}
      });
      
      await exitedPromise;
    }, 20000);

    it('should forward unknown DAP events', async () => {
      const customEventPromise = waitForEvent(proxyManager, 'dap-event' as any);
      
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: 'test-session-123',
        event: 'custom',
        body: { data: 'test' }
      });
      
      const [eventName, body] = await customEventPromise;
      expect(eventName).toBe('custom');
      expect(body).toEqual({ data: 'test' });
    }, 20000);

    it('should emit dry-run-complete event', async () => {
      const dryRunPromise = waitForEvent(proxyManager, 'dry-run-complete');
      
      fakeProxy.simulateMessage({
        type: 'status',
        sessionId: 'test-session-123',
        status: 'dry_run_complete',
        command: 'python test.py',
        script: 'test.py'
      });
      
      const [command, script] = await dryRunPromise;
      expect(command).toBe('python test.py');
      expect(script).toBe('test.py');
    }, 20000);

    it('should emit error event on proxy error', async () => {
      const errorPromise = waitForEvent(proxyManager, 'error');
      
      fakeProxy.simulateMessage({
        type: 'error',
        sessionId: 'test-session-123',
        message: 'Adapter connection failed'
      });
      
      const [error] = await errorPromise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Adapter connection failed');
    }, 20000);

    it('should emit exit event on adapter exit', async () => {
      const exitPromise = waitForEvent(proxyManager, 'exit');
      
      fakeProxy.simulateMessage({
        type: 'status',
        sessionId: 'test-session-123',
        status: 'adapter_exited',
        code: 1,
        signal: 'SIGTERM'
      });
      
      const [code, signal] = await exitPromise;
      expect(code).toBe(1);
      expect(signal).toBe('SIGTERM');
    }, 20000);

    it('should handle stderr output', async () => {
      fakeProxy.simulateError('Error: Something went wrong\n');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ProxyManager STDERR] Error: Something went wrong'
      );
    }, 20000);

    it('should handle process error events', async () => {
      const errorPromise = waitForEvent(proxyManager, 'error');
      const processError = new Error('Process crashed');
      
      fakeProxy.simulateProcessError(processError);
      
      const [error] = await errorPromise;
      expect(error).toBe(processError);
    }, 20000);

    it('should clean up on process exit', async () => {
      const exitPromise = waitForEvent(proxyManager, 'exit');
      
      // Add a pending request
      const requestPromise = proxyManager.sendDapRequest('threads');
      
      // Simulate process exit
      fakeProxy.simulateExit(1, 'SIGKILL');
      
      await exitPromise;
      await expect(requestPromise).rejects.toThrow('Proxy exited');
      expect(proxyManager.isRunning()).toBe(false);
    }, 20000);
  });

  describe('message validation', () => {
    let fakeProxy: FakeProxyProcess;

    beforeEach(async () => {
      // Start proxy first
      const config: ProxyConfig = {
        sessionId: 'test-session-123',
        pythonPath: '/usr/bin/python',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: 'test.py'
      };
      
      const startPromise = proxyManager.start(config);
      await delay(10);
      
      fakeProxy = fakeProxyLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: config.sessionId
      });
      await startPromise;
    }, 20000);

    it('should ignore messages with invalid format', () => {
      // Clear any warnings from initialization
      (mockLogger.warn as any).mockClear();
      
      // Send various invalid messages
      fakeProxy.simulateMessage('string message' as any);
      fakeProxy.simulateMessage(123 as any);
      fakeProxy.simulateMessage(null as any);
      fakeProxy.simulateMessage(undefined as any);
      
      // Should log warnings but not crash
      expect(mockLogger.warn).toHaveBeenCalledTimes(4);
    });

    it('should ignore messages without sessionId', () => {
      fakeProxy.simulateMessage({
        type: 'status',
        status: 'some_status'
      } as any);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid message format'),
        expect.any(Object)
      );
    });

    it('should ignore messages without type', () => {
      fakeProxy.simulateMessage({
        sessionId: 'test-session-123',
        data: 'some data'
      } as any);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid message format'),
        expect.any(Object)
      );
    });

    it('should ignore messages with mismatched sessionId', () => {
      // Clear any warnings from initialization
      (mockLogger.warn as any).mockClear();
      
      fakeProxy.simulateMessage({
        type: 'status',
        sessionId: 'wrong-session-id',
        status: 'some_status'
      } as any);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Session ID mismatch'),
        undefined
      );
    });

    it('should handle unknown response requestId', () => {
      // Clear any warnings from initialization
      (mockLogger.warn as any).mockClear();
      
      fakeProxy.simulateMessage({
        type: 'dapResponse',
        sessionId: 'test-session-123',
        requestId: 'unknown-request-id',
        success: true,
        body: {}
      });
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Received response for unknown request: unknown-request-id')
      );
    });

    it('should handle IPC test message and kill process', () => {
      // Make kill a spy
      const originalKill = fakeProxy.kill.bind(fakeProxy);
      fakeProxy.kill = vi.fn().mockImplementation(originalKill);
      
      fakeProxy.simulateMessage({
        type: 'status',
        sessionId: 'test-session-123',
        status: 'proxy_minimal_ran_ipc_test',
        message: 'IPC test successful'
      });
      
      expect(fakeProxy.kill).toHaveBeenCalled();
    });
  });

  describe('getCurrentThreadId', () => {
    it('should return null when no thread is active', () => {
      expect(proxyManager.getCurrentThreadId()).toBeNull();
    });

    it('should return thread ID after stopped event', async () => {
      // Start proxy
      const config: ProxyConfig = {
        sessionId: 'test-session-123',
        pythonPath: '/usr/bin/python',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: 'test.py'
      };
      
      const startPromise = proxyManager.start(config);
      await delay(10);
      
      const fakeProxy = fakeProxyLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: config.sessionId
      });
      await startPromise;
      
      // Simulate stopped event
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: 'test-session-123',
        event: 'stopped',
        body: { threadId: 42, reason: 'step' }
      });
      
      expect(proxyManager.getCurrentThreadId()).toBe(42);
    }, 20000);
  });

  describe('error scenarios', () => {
    it('should handle process without pid', async () => {
      // Prepare launcher to return process without PID
      fakeProxyLauncher.prepareProxy((proxy) => {
        (proxy as any).pid = undefined;
      });
      
      await expect(proxyManager.start({
        sessionId: 'test-session-123',
        pythonPath: '/usr/bin/python',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: 'test.py'
      })).rejects.toThrow('Proxy process is invalid or PID is missing');
    });

    it('should handle send command when worker is killed', async () => {
      // Start proxy
      const config: ProxyConfig = {
        sessionId: 'test-session-123',
        pythonPath: '/usr/bin/python',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: 'test.py'
      };
      
      const startPromise = proxyManager.start(config);
      await delay(10);
      
      const fakeProxy = fakeProxyLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: config.sessionId
      });
      await startPromise;
      
      // Kill the process
      fakeProxy.kill();
      
      // Try to send a command
      await expect(proxyManager.sendDapRequest('threads')).rejects.toThrow(
        'Proxy process not available'
      );
    }, 20000);
  });
});
