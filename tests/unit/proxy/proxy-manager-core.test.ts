/**
 * Core unit tests for ProxyManager - simplified for faster execution
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProxyManager, ProxyConfig } from '../../../src/proxy/proxy-manager.js';
import { IFileSystem, ILogger } from '../../../src/interfaces/external-dependencies.js';
import { FakeProxyProcessLauncher, FakeProxyProcess } from '../../implementations/test/fake-process-launcher.js';
import { waitForEvent, delay } from '../../utils/test-utils.js';
import { DebugProtocol } from '@vscode/debugprotocol';

describe.skip('ProxyManager Core Tests', () => {
  let proxyManager: ProxyManager;
  let fakeProxyLauncher: FakeProxyProcessLauncher;
  let mockFileSystem: IFileSystem;
  let mockLogger: ILogger;
  let fakeProxyProcess: FakeProxyProcess;

  const defaultConfig: ProxyConfig = {
    sessionId: 'test-session-123',
    pythonPath: '/usr/bin/python',
    adapterHost: 'localhost',
    adapterPort: 5678,
    logDir: '/tmp/logs',
    scriptPath: 'test.py'
  };

  beforeEach(() => {
    // Setup fakes and mocks
    fakeProxyLauncher = new FakeProxyProcessLauncher();
    
    mockFileSystem = {
      pathExists: vi.fn().mockResolvedValue(true),
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
    
    // Clean up
    proxyManager.removeAllListeners();
    fakeProxyLauncher.reset();
    vi.clearAllMocks();
  });

  describe('Basic Lifecycle', () => {
    it('should start proxy successfully', async () => {
      const startPromise = proxyManager.start(defaultConfig);
      
      // Wait for IPC setup
      await delay(10);
      
      // Get the launched proxy process
      const fakeProxy = fakeProxyLauncher.getLastLaunchedProxy();
      expect(fakeProxy).toBeDefined();
      
      // Simulate successful initialization
      fakeProxy!.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: defaultConfig.sessionId
      });
      
      await expect(startPromise).resolves.toBeUndefined();
      expect(proxyManager.isRunning()).toBe(true);
    });

    it('should stop proxy gracefully', async () => {
      // Start proxy first
      const startPromise = proxyManager.start(defaultConfig);
      await delay(10);
      
      const fakeProxy = fakeProxyLauncher.getLastLaunchedProxy();
      expect(fakeProxy).toBeDefined();
      
      fakeProxy!.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: defaultConfig.sessionId
      });
      await startPromise;
      
      // Stop proxy
      const stopPromise = proxyManager.stop();
      fakeProxy!.simulateExit(0);
      
      await expect(stopPromise).resolves.toBeUndefined();
      expect(proxyManager.isRunning()).toBe(false);
    });

    it('should reject if proxy script not found', async () => {
      (mockFileSystem.pathExists as any).mockResolvedValue(false);
      
      await expect(proxyManager.start(defaultConfig)).rejects.toThrow(
        'Bootstrap worker script not found'
      );
    });
  });

  describe('DAP Communication', () => {
    let fakeProxy: FakeProxyProcess;

    beforeEach(async () => {
      // Start proxy for DAP tests
      const startPromise = proxyManager.start(defaultConfig);
      await delay(10);
      
      fakeProxy = fakeProxyLauncher.getLastLaunchedProxy()!;
      expect(fakeProxy).toBeDefined();
      
      fakeProxy.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: defaultConfig.sessionId
      });
      await startPromise;
    });

    it('should send DAP request and receive response', async () => {
      const requestPromise = proxyManager.sendDapRequest<DebugProtocol.ThreadsResponse>('threads');
      
      await delay(10);
      
      // Get the request ID from the sent command
      const sentCommands = fakeProxy.sentCommands;
      expect(sentCommands.length).toBeGreaterThan(0);
      const lastCommand = sentCommands[sentCommands.length - 1] as any;
      const requestId = lastCommand.requestId;
      
      // Simulate response
      fakeProxy.simulateMessage({
        type: 'dapResponse',
        sessionId: defaultConfig.sessionId,
        requestId,
        success: true,
        response: {
          seq: 1,
          type: 'response',
          request_seq: 1,
          command: 'threads',
          success: true,
          body: {
            threads: [{ id: 1, name: 'MainThread' }]
          }
        }
      });
      
      const response = await requestPromise;
      expect(response.body.threads).toHaveLength(1);
    }, 5000);

    it('should handle DAP request errors', async () => {
      const requestPromise = proxyManager.sendDapRequest('continue');
      
      await delay(10);
      
      const sentCommands = fakeProxy.sentCommands;
      expect(sentCommands.length).toBeGreaterThan(0);
      const lastCommand = sentCommands[sentCommands.length - 1] as any;
      const requestId = lastCommand.requestId;
      
      // Simulate error response
      fakeProxy.simulateMessage({
        type: 'dapResponse',
        sessionId: defaultConfig.sessionId,
        requestId,
        success: false,
        error: 'No active thread'
      });
      
      await expect(requestPromise).rejects.toThrow('No active thread');
    }, 5000);
  });

  describe('Event Handling', () => {
    let fakeProxy: FakeProxyProcess;

    beforeEach(async () => {
      // Start proxy for event tests
      const startPromise = proxyManager.start(defaultConfig);
      await delay(10);
      
      fakeProxy = fakeProxyLauncher.getLastLaunchedProxy()!;
      expect(fakeProxy).toBeDefined();
      
      fakeProxy.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: defaultConfig.sessionId
      });
      await startPromise;
    });

    it('should emit stopped event', async () => {
      const stoppedPromise = waitForEvent(proxyManager, 'stopped', 1000);
      
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: defaultConfig.sessionId,
        event: 'stopped',
        body: { threadId: 1, reason: 'breakpoint' }
      });
      
      const [threadId, reason] = await stoppedPromise;
      expect(threadId).toBe(1);
      expect(reason).toBe('breakpoint');
    });

    it('should handle process exit', async () => {
      const exitPromise = waitForEvent(proxyManager, 'exit', 1000);
      
      fakeProxy.simulateExit(0);
      
      const [code, signal] = await exitPromise;
      expect(code).toBe(0);
      expect(signal).toBeUndefined();
      expect(proxyManager.isRunning()).toBe(false);
    });
  });

  describe('Error Scenarios', () => {
    it('should reject if proxy not initialized', async () => {
      await expect(proxyManager.sendDapRequest('threads')).rejects.toThrow(
        'Proxy not initialized'
      );
    });

    it('should handle invalid proxy process', async () => {
      // Prepare the fake launcher to return an invalid process
      fakeProxyLauncher.prepareProxy((proxy) => {
        // Override the pid to make it invalid
        (proxy as any).pid = undefined;
      });
      
      await expect(proxyManager.start(defaultConfig)).rejects.toThrow(
        'Proxy process is invalid or PID is missing'
      );
    });

    it('should ignore invalid messages', async () => {
      const startPromise = proxyManager.start(defaultConfig);
      await delay(10);
      
      const fakeProxy = fakeProxyLauncher.getLastLaunchedProxy()!;
      expect(fakeProxy).toBeDefined();
      
      fakeProxy.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: defaultConfig.sessionId
      });
      await startPromise;
      
      // Send invalid messages
      fakeProxy.simulateMessage('string message' as any);
      fakeProxy.simulateMessage(null as any);
      fakeProxy.simulateMessage({ type: 'status' } as any); // missing sessionId
      
      // The fake process might emit additional warnings during setup/teardown
      expect(mockLogger.warn).toHaveBeenCalled();
      expect((mockLogger.warn as any).mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });
});
