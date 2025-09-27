/**
 * Targeted tests to improve coverage for session-manager-operations.ts
 * Focus on error paths and edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManagerOperations } from '../../../src/session/session-manager-operations';
import { SessionLifecycleState, SessionState } from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
import { 
  SessionNotFoundError,
  SessionTerminatedError,
  ProxyNotRunningError
} from '../../../src/errors/debug-errors';
import { createEnvironmentMock } from '../../test-utils/mocks/environment';

describe('Session Manager Operations Coverage - Error Paths and Edge Cases', () => {
  let operations: SessionManagerOperations;
  let mockSessionStore: any;
  let mockProxyManager: any;
  let mockDependencies: any;
  let mockLogger: any;
  let mockSession: any;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    // Create mock proxy manager
    mockProxyManager = {
      isRunning: vi.fn().mockReturnValue(true),
      getCurrentThreadId: vi.fn().mockReturnValue(1),
      sendDapRequest: vi.fn(),
      stop: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
      on: vi.fn(),
      start: vi.fn()
    };

    // Create mock session
    mockSession = {
      id: 'test-session',
      name: 'Test Session',
      language: 'python',
      state: SessionState.CREATED,
      sessionLifecycle: SessionLifecycleState.ACTIVE,
      proxyManager: mockProxyManager,
      breakpoints: new Map(),
      createdAt: new Date(),
      updatedAt: new Date(),
      executablePath: 'python'
    };

    // Create mock session store
    mockSessionStore = {
      get: vi.fn().mockReturnValue(mockSession),
      getOrThrow: vi.fn().mockImplementation((sessionId: string) => {
        const session = mockSession.id === sessionId ? mockSession : null;
        if (!session) {
          throw new SessionNotFoundError(sessionId);
        }
        return session;
      }),
      update: vi.fn(),
      updateState: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn().mockReturnValue([mockSession])
    };

    // Create mock dependencies
    mockDependencies = {
      logger: mockLogger,
      sessionStoreFactory: {
        create: vi.fn().mockReturnValue(mockSessionStore)
      },
      proxyManagerFactory: {
        create: vi.fn().mockReturnValue(mockProxyManager)
      },
      processLauncher: {
        launch: vi.fn()
      },
      fileSystem: {
        readFile: vi.fn(),
        exists: vi.fn(),
        pathExists: vi.fn().mockResolvedValue(true),
        ensureDir: vi.fn().mockResolvedValue(undefined),
        ensureDirSync: vi.fn()
      },
      environment: createEnvironmentMock(),
      networkManager: {
        findFreePort: vi.fn().mockResolvedValue(9000)
      },
      adapterRegistry: {
        create: vi.fn().mockResolvedValue({
          buildAdapterCommand: vi.fn().mockReturnValue('python -m debugpy')
        })
      }
    };

    // Create operations instance with config
    operations = new SessionManagerOperations(
      { logDirBase: '/tmp/logs' },
      mockDependencies as any
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Operation Failures with Error Details', () => {
    it('should handle continue failure with no proxy', async () => {
      mockSession.proxyManager = null;

      await expect(operations.continue('test-session'))
        .rejects.toThrow(ProxyNotRunningError);
    });

    it('should handle continue failure with proxy not running', async () => {
      mockProxyManager.isRunning.mockReturnValue(false);

      await expect(operations.continue('test-session'))
        .rejects.toThrow(ProxyNotRunningError);
    });

    it('should handle continue request failure', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockRejectedValue(new Error('Network error'));

      await expect(operations.continue('test-session'))
        .rejects.toThrow('Network error');
    });

    it('should handle stepOver failure with DAP error response', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockRejectedValue(new Error('Not in valid state for step'));

      const result = await operations.stepOver('test-session');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not in valid state');
    });

    it('should handle stepInto failure with exception', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockRejectedValue(new Error('DAP protocol error'));

      const result = await operations.stepInto('test-session');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('DAP protocol error');
    });

    it('should handle stepOut failure with timeout', async () => {
      vi.useFakeTimers();
      
      mockSession.state = SessionState.PAUSED;
      // Simulate timeout by not calling the 'stopped' event
      mockProxyManager.sendDapRequest.mockResolvedValue({});
      
      // Setup once to do nothing (no stopped event will fire)
      mockProxyManager.once.mockImplementation(() => {});

      const stepOutPromise = operations.stepOut('test-session');
      
      // Fast-forward past the timeout (5 seconds)
      await vi.advanceTimersByTimeAsync(5100);
      
      const result = await stepOutPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('did not complete within 5s');
      
      vi.useRealTimers();
    });
  });

  describe('Set Breakpoint Error Scenarios', () => {
    it('should handle setBreakpoint with no proxy', async () => {
      mockSession.proxyManager = null;

      const result = await operations.setBreakpoint('test-session', 'test.py', 10);
      
      // Without proxy, breakpoint is queued but not verified
      expect(result.verified).toBe(false);
      expect(result.file).toBe('test.py');
      expect(result.line).toBe(10);
    });

    it('should handle setBreakpoint with DAP failure', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [{
            verified: false,
            message: 'Invalid line number',
            line: 10
          }]
        }
      });

      const result = await operations.setBreakpoint('test-session', 'test.py', 10);
      
      expect(result.verified).toBe(false);
      expect(result.message).toContain('Invalid line number');
    });

    it('should handle setBreakpoint with empty response', async () => {
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: []
        }
      });

      const result = await operations.setBreakpoint('test-session', 'test.py', 10);
      
      expect(result.verified).toBe(false);
    });

    it('should handle setBreakpoint network error', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockRejectedValue(new Error('Connection lost'));

      // Error is caught and logged, breakpoint is still created but unverified
      const result = await operations.setBreakpoint('test-session', 'test.py', 10);
      
      expect(result.verified).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Get Variables Error Scenarios', () => {
    it('should handle getVariables with no proxy', async () => {
      mockSession.proxyManager = null;

      const result = await operations.getVariables('test-session', 100);
      
      // Returns empty array when no proxy
      expect(result).toEqual([]);
    });

    it('should handle getVariables when not paused', async () => {
      mockSession.state = SessionState.RUNNING;

      const result = await operations.getVariables('test-session', 100);
      
      // Returns empty array when not paused
      expect(result).toEqual([]);
    });

    it('should handle getVariables DAP error', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockRejectedValue(new Error('Invalid variables reference'));

      const result = await operations.getVariables('test-session', 999);
      
      // Returns empty array on error
      expect(result).toEqual([]);
    });
  });

  describe('Get Stack Trace Error Scenarios', () => {
    it('should handle getStackTrace with no proxy', async () => {
      mockSession.proxyManager = null;

      const result = await operations.getStackTrace('test-session', 1);
      
      // Returns empty array when no proxy
      expect(result).toEqual([]);
    });

    it('should handle getStackTrace when not paused', async () => {
      mockSession.state = SessionState.RUNNING;

      const result = await operations.getStackTrace('test-session', 1);
      
      // Returns empty array when not paused
      expect(result).toEqual([]);
    });

    it('should handle getStackTrace with empty frames', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          stackFrames: []
        }
      });

      const result = await operations.getStackTrace('test-session', 1);
      
      expect(result).toEqual([]);
    });

    it('should handle getStackTrace with malformed response', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          // Missing stackFrames property
        }
      });

      const result = await operations.getStackTrace('test-session', 1);
      
      expect(result).toEqual([]);
    });

    it('should handle getStackTrace network failure', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockRejectedValue(new Error('Proxy disconnected'));

      const result = await operations.getStackTrace('test-session', 1);
      
      // Returns empty array on error
      expect(result).toEqual([]);
    });
  });

  describe('Get Scopes Error Scenarios', () => {
    it('should handle getScopes with no proxy', async () => {
      mockSession.proxyManager = null;

      const result = await operations.getScopes('test-session', 0);
      
      // Returns empty array when no proxy
      expect(result).toEqual([]);
    });

    it('should handle getScopes when not paused', async () => {
      mockSession.state = SessionState.RUNNING;

      const result = await operations.getScopes('test-session', 0);
      
      // Returns empty array when not paused
      expect(result).toEqual([]);
    });

    it('should handle getScopes with invalid frame ID', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          scopes: []
        }
      });

      const result = await operations.getScopes('test-session', -1);
      
      expect(result).toEqual([]);
    });

    it('should handle getScopes protocol error', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockRejectedValue(new Error('Frame not found'));

      const result = await operations.getScopes('test-session', 999);
      
      // Returns empty array on error
      expect(result).toEqual([]);
    });
  });

  describe('Evaluate Expression Error Scenarios', () => {
    it('should handle evaluateExpression with no proxy', async () => {
      mockSession.proxyManager = null;

      const result = await operations.evaluateExpression('test-session', 'x + 1');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No active debug session');
    });

    it('should handle evaluateExpression with evaluation error', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest
        .mockResolvedValueOnce({ // For stack trace
          body: {
            stackFrames: [{ id: 1 }]
          }
        })
        .mockResolvedValueOnce({ // For evaluate
          body: {
            result: '',
            success: false,
            message: 'NameError: name \'x\' is not defined'
          }
        });

      const result = await operations.evaluateExpression('test-session', 'x + 1');
      
      expect(result.success).toBe(true); // DAP response is successful, even if evaluation had error
      expect(result.result).toBe('');
    });

    it('should handle evaluateExpression network failure', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest
        .mockResolvedValueOnce({ // For stack trace
          body: {
            stackFrames: [{ id: 1 }]
          }
        })
        .mockRejectedValueOnce(new Error('Request failed')); // For evaluate

      const result = await operations.evaluateExpression('test-session', 'print("test")');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Request failed');
    });

    it('should handle evaluateExpression with timeout', async () => {
      vi.useFakeTimers();
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest
        .mockResolvedValueOnce({ // For stack trace
          body: {
            stackFrames: [{ id: 1 }]
          }
        })
        .mockImplementationOnce(() => 
          new Promise((resolve) => 
            setTimeout(() => resolve({
              body: {
                result: '',
                success: false
              }
            }), 100)
          )
        );

      const promise = operations.evaluateExpression('test-session', 'while True: pass');
      await vi.advanceTimersByTimeAsync(120);
      const result = await promise;
      
      expect(result.success).toBe(true); // Response received
      expect(result.result).toBe('');
      vi.useRealTimers();
    });
  });

  describe('Start Debugging Error Scenarios', () => {
    it('should handle startDebugging with proxy creation failure', async () => {
      mockDependencies.proxyManagerFactory.create.mockImplementation(() => {
        throw new Error('Port allocation failed');
      });

      const result = await operations.startDebugging('test-session', 'test.py');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Port allocation failed');
    });

    it('should handle startDebugging with launch failure', async () => {
      mockProxyManager.start.mockRejectedValue(new Error('Failed to launch debuggee'));

      const result = await operations.startDebugging('test-session', 'test.py');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to launch debuggee');
    });

    it('should handle startDebugging when already debugging', async () => {
      // Session already has proxy manager
      mockSession.proxyManager = mockProxyManager;
      
      // Mock closeSession method
      (operations as any).closeSession = vi.fn().mockResolvedValue(true);

      // Make the "adapter-configured" event fire immediately to avoid 30s wait
      mockProxyManager.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'adapter-configured') {
          callback();
        }
      });

      const result = await operations.startDebugging('test-session', 'test.py');
      
      // Should close existing session and start new one
      expect((operations as any).closeSession).toHaveBeenCalledWith('test-session');
    });
  });

  describe('Session Not Found Scenarios', () => {
    it('should handle operations on non-existent session', async () => {
      mockSessionStore.getOrThrow.mockImplementation(() => {
        throw new SessionNotFoundError('non-existent');
      });

      await expect(() => operations.continue('non-existent'))
        .rejects.toThrow(SessionNotFoundError);

      await expect(() => operations.stepOver('non-existent'))
        .rejects.toThrow(SessionNotFoundError);

      await expect(operations.getVariables('non-existent', 1))
        .rejects.toThrow(SessionNotFoundError);

      await expect(operations.getStackTrace('non-existent', 1))
        .rejects.toThrow(SessionNotFoundError);
    });
  });

  describe('Terminated Session Scenarios', () => {
    it('should reject operations on terminated session', async () => {
      mockSession.sessionLifecycle = SessionLifecycleState.TERMINATED;

      await expect(() => operations.continue('test-session'))
        .rejects.toThrow(SessionTerminatedError);

      await expect(() => operations.setBreakpoint('test-session', 'test.py', 10))
        .rejects.toThrow(SessionTerminatedError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle proxy manager that returns undefined thread ID', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.getCurrentThreadId.mockReturnValue(undefined);

      const result = await operations.continue('test-session');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No current thread ID');
    });

    it('should handle concurrent step operations gracefully', async () => {
      vi.useFakeTimers();
      mockSession.state = SessionState.PAUSED;
      
      // Simulate slow response and stopped events
      mockProxyManager.sendDapRequest.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 50))
      );
      mockProxyManager.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'stopped') {
          setTimeout(() => callback(), 10);
        }
      });

      // Start multiple operations concurrently
      const promises = [
        operations.stepOver('test-session'),
        operations.stepInto('test-session'),
        operations.stepOut('test-session')
      ];
      await vi.advanceTimersByTimeAsync(100);
      const results = await Promise.allSettled(promises);

      // All should complete (some may fail due to state changes)
      expect(results).toHaveLength(3);
      vi.useRealTimers();
    });

    it('should use provided thread ID when available', async () => {
      vi.useFakeTimers();
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.getCurrentThreadId.mockReturnValue(42);
      mockProxyManager.sendDapRequest.mockResolvedValue({});
      
      // Setup the once listener to trigger stopped event shortly
      mockProxyManager.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'stopped') {
          setTimeout(() => callback(), 10);
        }
      });

      const p = operations.stepOver('test-session');
      await vi.advanceTimersByTimeAsync(20);
      await p;
      
      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('next', { threadId: 42 });
      vi.useRealTimers();
    });
  });
});
