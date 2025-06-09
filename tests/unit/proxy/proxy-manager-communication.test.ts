/**
 * ProxyManager Communication Tests
 * Tests for DAP request/response handling, event emission, and IPC communication
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProxyManager, ProxyConfig } from '../../../src/proxy/proxy-manager.js';
import { FakeProxyProcessLauncher } from '../../implementations/test/fake-process-launcher.js';
import { createMockLogger, createMockFileSystem } from '../../utils/test-utils.js';
import { ILogger, IFileSystem } from '../../../src/interfaces/external-dependencies.js';
import { v4 as uuidv4 } from 'uuid';
import { ErrorMessages } from '../../../src/utils/error-messages.js';

describe('ProxyManager - Communication', () => {
  let proxyManager: ProxyManager;
  let fakeLauncher: FakeProxyProcessLauncher;
  let mockLogger: ILogger;
  let mockFileSystem: IFileSystem;

  const defaultConfig: ProxyConfig = {
    sessionId: 'test-session-123',
    pythonPath: 'python',
    adapterHost: '127.0.0.1',
    adapterPort: 5678,
    logDir: '/tmp/logs',
    scriptPath: 'test.py'
  };

  beforeEach(async () => {
    fakeLauncher = new FakeProxyProcessLauncher();
    mockLogger = createMockLogger();
    mockFileSystem = createMockFileSystem();
    
    proxyManager = new ProxyManager(
      fakeLauncher,
      mockFileSystem,
      mockLogger
    );

    // Start proxy with default initialization
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

  afterEach(() => {
    vi.useRealTimers(); // Always restore real timers first
    vi.clearAllMocks();
    fakeLauncher.reset();
  });

  describe('sendDapRequest()', () => {
    it('should send DAP request and receive response', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Mock response for stackTrace request
      let commandSent = false;
      fakeProxy.on('message', (msg: any) => {
        // Skip if this is a simulateMessage call (will be an object)
        if (typeof msg !== 'string') return;
        
        const parsed = JSON.parse(msg);
        if (parsed.cmd === 'dap' && parsed.dapCommand === 'stackTrace' && !commandSent) {
          commandSent = true;
          setTimeout(() => {
            fakeProxy.simulateMessage({
              type: 'dapResponse',
              sessionId: defaultConfig.sessionId,
              requestId: parsed.requestId,
              success: true,
              response: {
                seq: 1,
                type: 'response',
                request_seq: 1,
                success: true,
                command: 'stackTrace',
                body: {
                  stackFrames: [{
                    id: 1,
                    name: 'main',
                    source: { path: 'test.py' },
                    line: 10,
                    column: 0
                  }]
                }
              }
            });
          }, 10);
        }
      });

      const response = await proxyManager.sendDapRequest('stackTrace', { threadId: 1 });
      
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.command).toBe('stackTrace');
      expect(response.body.stackFrames).toHaveLength(1);
    });

    it('should handle DAP request failure', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Mock error response
      let commandSent = false;
      fakeProxy.on('message', (msg: any) => {
        if (typeof msg !== 'string') return;
        
        const parsed = JSON.parse(msg);
        if (parsed.cmd === 'dap' && !commandSent) {
          commandSent = true;
          setTimeout(() => {
            fakeProxy.simulateMessage({
              type: 'dapResponse',
              sessionId: defaultConfig.sessionId,
              requestId: parsed.requestId,
              success: false,
              error: 'Variable not found'
            });
          }, 10);
        }
      });

      await expect(proxyManager.sendDapRequest('variables', { variablesReference: 999 }))
        .rejects.toThrow('Variable not found');
    });

    it('should handle DAP request timeout', async () => {
      // Setup fake timers before any async operations
      vi.useFakeTimers();
      
      try {
        // Start the async operation that will timeout
        const requestPromise = proxyManager.sendDapRequest('stackTrace', { threadId: 1 });
        
        // Immediately attach rejection expectation before advancing timers
        const expectPromise = expect(requestPromise).rejects.toThrow(ErrorMessages.dapRequestTimeout('stackTrace', 35));
        
        // Advance timers using the async method
        await vi.advanceTimersByTimeAsync(35001);
        
        // Now await the expectation
        await expectPromise;
      } finally {
        // Always restore real timers
        vi.useRealTimers();
      }
    });

    it('should reject DAP request when proxy not initialized', async () => {
      // Create a new proxy manager that's not started
      const uninitializedManager = new ProxyManager(
        fakeLauncher,
        mockFileSystem,
        mockLogger
      );

      await expect(uninitializedManager.sendDapRequest('stackTrace', {}))
        .rejects.toThrow('Proxy not initialized');
    });

    it('should handle concurrent DAP requests', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Mock responses for different commands
      fakeProxy.on('message', (msg: any) => {
        if (typeof msg !== 'string') return;
        
        const parsed = JSON.parse(msg);
        if (parsed.cmd === 'dap') {
          setTimeout(() => {
            const body = parsed.dapCommand === 'stackTrace' 
              ? { stackFrames: [] }
              : { scopes: [] };
              
            fakeProxy.simulateMessage({
              type: 'dapResponse',
              sessionId: defaultConfig.sessionId,
              requestId: parsed.requestId,
              success: true,
              response: {
                seq: 1,
                type: 'response',
                request_seq: 1,
                success: true,
                command: parsed.dapCommand,
                body
              }
            });
          }, 10);
        }
      });

      // Send multiple requests concurrently
      const [response1, response2] = await Promise.all([
        proxyManager.sendDapRequest('stackTrace', { threadId: 1 }),
        proxyManager.sendDapRequest('scopes', { frameId: 1 })
      ]);

      expect(response1.command).toBe('stackTrace');
      expect(response1.body.stackFrames).toBeDefined();
      expect(response2.command).toBe('scopes');
      expect(response2.body.scopes).toBeDefined();
    });

    it('should track pending requests correctly', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      const sentCommands = fakeProxy.sentCommands;
      
      // Send a request
      const requestPromise = proxyManager.sendDapRequest('continue', {});
      
      // Verify command was sent
      const dapCommand = sentCommands.find((cmd: any) => cmd.cmd === 'dap') as any;
      expect(dapCommand).toBeDefined();
      expect(dapCommand.dapCommand).toBe('continue');
      expect(dapCommand.requestId).toBeDefined();
      
      // Send response
      fakeProxy.simulateMessage({
        type: 'dapResponse',
        sessionId: defaultConfig.sessionId,
        requestId: dapCommand.requestId,
        success: true,
        response: { success: true }
      });
      
      await requestPromise;
    });

    it('should handle response for unknown request ID', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Send response with unknown request ID
      fakeProxy.simulateMessage({
        type: 'dapResponse',
        sessionId: defaultConfig.sessionId,
        requestId: 'unknown-id',
        success: true,
        response: { success: true }
      });
      
      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Received response for unknown request: unknown-id')
      );
    });
  });

  describe('Event Emission', () => {
    it('should emit stopped event with thread ID', async () => {
      const stoppedPromise = new Promise<{ threadId: number; reason: string; data: any }>((resolve) => {
        proxyManager.once('stopped', (threadId, reason, data) => {
          resolve({ threadId, reason, data });
        });
      });

      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: defaultConfig.sessionId,
        event: 'stopped',
        body: { 
          threadId: 42, 
          reason: 'breakpoint',
          hitBreakpointIds: [1]
        }
      });

      const result = await stoppedPromise;
      expect(result.threadId).toBe(42);
      expect(result.reason).toBe('breakpoint');
      expect(result.data.hitBreakpointIds).toEqual([1]);
      expect(proxyManager.getCurrentThreadId()).toBe(42);
    });

    it('should emit continued event', async () => {
      const continuedPromise = new Promise<void>((resolve) => {
        proxyManager.once('continued', resolve);
      });

      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: defaultConfig.sessionId,
        event: 'continued',
        body: { threadId: 1 }
      });

      await continuedPromise;
      // Test passes if promise resolves
    });

    it('should emit terminated event', async () => {
      const terminatedPromise = new Promise<void>((resolve) => {
        proxyManager.once('terminated', resolve);
      });

      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: defaultConfig.sessionId,
        event: 'terminated'
      });

      await terminatedPromise;
      // Test passes if promise resolves
    });

    it('should emit exited event', async () => {
      const exitedPromise = new Promise<void>((resolve) => {
        proxyManager.once('exited', resolve);
      });

      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: defaultConfig.sessionId,
        event: 'exited',
        body: { exitCode: 0 }
      });

      await exitedPromise;
      // Test passes if promise resolves
    });

    it('should handle stopped event without thread ID', async () => {
      const stoppedPromise = new Promise<{ threadId: number; reason: string }>((resolve) => {
        proxyManager.once('stopped', (threadId, reason) => {
          resolve({ threadId, reason });
        });
      });

      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: defaultConfig.sessionId,
        event: 'stopped',
        body: { reason: 'pause' }
      });

      const result = await stoppedPromise;
      expect(result.threadId).toBeUndefined();
      expect(result.reason).toBe('pause');
      // Thread ID should not be updated if not provided
      expect(proxyManager.getCurrentThreadId()).toBe(null);
    });
  });

  describe('Message Validation', () => {
    it('should ignore invalid message format', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Send invalid messages
      fakeProxy.simulateMessage('invalid string message');
      fakeProxy.simulateMessage({ invalid: 'structure' });
      fakeProxy.simulateMessage(null);
      fakeProxy.simulateMessage(undefined);
      
      // Verify warnings were logged (4 for invalid messages + 1 for missing sessionId)
      expect(mockLogger.warn).toHaveBeenCalledTimes(5);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid message format'),
        expect.anything()
      );
    });

    it('should handle messages with missing session ID', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Send message without sessionId
      fakeProxy.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched'
      });
      
      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid message format'),
        expect.anything()
      );
    });
  });

  describe('IPC Communication', () => {
    it('should send commands as JSON via IPC', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      const sendSpy = vi.spyOn(fakeProxy, 'send');
      
      // Send a DAP request which triggers sendCommand
      proxyManager.sendDapRequest('threads', {}).catch(() => {
        // Ignore the rejection - we're only testing that the command is sent
      });
      
      // Verify send was called with JSON string
      expect(sendSpy).toHaveBeenCalled();
      const sentMessage = sendSpy.mock.calls[0][0];
      expect(typeof sentMessage).toBe('string');
      
      const parsed = JSON.parse(sentMessage);
      expect(parsed.cmd).toBe('dap');
      expect(parsed.dapCommand).toBe('threads');
    });

    it('should handle process stderr output', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Simulate stderr output
      if (fakeProxy.stderr) {
        fakeProxy.stderr.push('Error: Something went wrong\n');
      }
      
      // Give time for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ProxyManager STDERR] Error: Something went wrong'
      );
    });
  });

  describe('State Updates', () => {
    it('should update thread ID from stopped events', async () => {
      expect(proxyManager.getCurrentThreadId()).toBe(null);
      
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Send first stopped event
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: defaultConfig.sessionId,
        event: 'stopped',
        body: { threadId: 1, reason: 'step' }
      });
      
      expect(proxyManager.getCurrentThreadId()).toBe(1);
      
      // Send another stopped event with different thread
      fakeProxy.simulateMessage({
        type: 'dapEvent',
        sessionId: defaultConfig.sessionId,
        event: 'stopped',
        body: { threadId: 2, reason: 'breakpoint' }
      });
      
      expect(proxyManager.getCurrentThreadId()).toBe(2);
    });

    it('should handle status messages that update state', async () => {
      const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
      
      // Send adapter exit status
      fakeProxy.simulateMessage({
        type: 'status',
        sessionId: defaultConfig.sessionId,
        status: 'adapter_exited',
        code: 0
      });
      
      // Verify exit event was emitted
      const exitPromise = new Promise<{ code: number; signal?: string }>((resolve) => {
        proxyManager.once('exit', (code, signal) => resolve({ code, signal }));
      });
      
      // Need to trigger the event again since we missed the first one
      fakeProxy.simulateMessage({
        type: 'status',
        sessionId: defaultConfig.sessionId,
        status: 'dap_connection_closed'
      });
      
      const result = await exitPromise;
      expect(result.code).toBe(1);
    });
  });
});
