/**
 * Targeted tests to improve coverage for session-manager-operations.ts
 * Focus on error paths and edge cases (aligned with new APIs)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { SessionManagerOperations } from '../../src/session/session-manager-operations';
import { SessionLifecycleState, SessionState } from '@debugmcp/shared';

/** Concrete subclass for testing the abstract SessionManagerOperations */
class TestableSessionManagerOperations extends SessionManagerOperations {
  protected async handleAutoContinue(_sessionId: string): Promise<void> {
    // no-op for tests
  }
}
import {
  SessionNotFoundError,
  SessionTerminatedError,
  ProxyNotRunningError,
  PythonNotFoundError,
  DebugSessionCreationError
} from '../../src/errors/debug-errors';
import { createEnvironmentMock } from '../test-utils/mocks/environment';

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

    // Create mock proxy manager (aligned with new IProxyManager shape)
    mockProxyManager = {
      isRunning: vi.fn().mockReturnValue(true),
      getCurrentThreadId: vi.fn().mockReturnValue(1),
      sendDapRequest: vi.fn().mockResolvedValue({}),
      stop: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
      removeListener: vi.fn(),
      on: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined)
    };
    mockProxyManager.on.mockImplementation(() => mockProxyManager);
    mockProxyManager.off.mockImplementation(() => mockProxyManager);
    mockProxyManager.once.mockImplementation(() => mockProxyManager);
    mockProxyManager.removeListener.mockImplementation(() => mockProxyManager);

    // Create mock session (aligned with new session model)
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

    // Create mock session store (aligned with SessionStoreFactory usage)
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
      updateState: vi.fn().mockImplementation((_sessionId: string, newState: SessionState) => {
        mockSession.state = newState;
      }),
      delete: vi.fn(),
      remove: vi.fn().mockReturnValue(true),
      getAll: vi.fn().mockReturnValue([mockSession])
    };

    // Create mock dependencies (aligned with new constructor dependencies)
    mockDependencies = {
      logger: mockLogger,
      sessionStoreFactory: {
        create: vi.fn().mockReturnValue(mockSessionStore)
      },
      proxyManagerFactory: {
        create: vi.fn().mockReturnValue(mockProxyManager)
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
          buildAdapterCommand: vi.fn().mockReturnValue('python -m debugpy'),
          resolveExecutablePath: vi.fn().mockResolvedValue('python')
        }),
        getAdapterPolicy: vi.fn().mockReturnValue({
          name: 'python',
          getInitializationBehavior: () => ({})
        })
      }
    };

    // Create operations instance with config
    operations = new TestableSessionManagerOperations(
      { logDirBase: '/tmp/logs' },
      mockDependencies as any
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('startProxyManager edge cases', () => {
    it('bubbles meaningful error when log directory creation fails', async () => {
      mockDependencies.fileSystem.ensureDir.mockRejectedValueOnce(new Error('disk full'));

      await expect(
        (operations as any).startProxyManager(mockSession, 'script.py')
      ).rejects.toThrow('Failed to create session log directory: disk full');
    });

    it('raises PythonNotFoundError when adapter cannot resolve interpreter', async () => {
      const adapterStub = {
        resolveExecutablePath: vi.fn().mockRejectedValue(new Error('python not found')),
        buildAdapterCommand: vi.fn()
      };
      mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

      await expect(
        (operations as any).startProxyManager(mockSession, 'script.py')
      ).rejects.toBeInstanceOf(PythonNotFoundError);
    });

    it('throws when log directory cannot be verified after creation', async () => {
      mockDependencies.fileSystem.pathExists.mockResolvedValueOnce(false);

      await expect(
        (operations as any).startProxyManager(mockSession, 'script.py')
      ).rejects.toThrow(/could not be created/);
    });

    it('wraps unresolved executable errors for non-python languages', async () => {
      mockSession.language = 'javascript';
      const adapterStub = {
        resolveExecutablePath: vi.fn().mockRejectedValue(new Error('node missing')),
        buildAdapterCommand: vi.fn()
      };
      mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

      await expect(
        (operations as any).startProxyManager(mockSession, 'app.js')
      ).rejects.toBeInstanceOf(DebugSessionCreationError);
    });

    it('starts proxy manager with resolved configuration', async () => {
      vi.stubEnv('CI', 'true');
      vi.stubEnv('GITHUB_ACTIONS', undefined);

      const proxyInstance: any = {
        ...mockProxyManager,
        start: vi.fn().mockResolvedValue(undefined),
        once: vi.fn(),
        removeListener: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
      };
      proxyInstance.on.mockReturnValue(proxyInstance);
      proxyInstance.off.mockReturnValue(proxyInstance);
      proxyInstance.once.mockReturnValue(proxyInstance);
      proxyInstance.removeListener.mockReturnValue(proxyInstance);
      mockDependencies.proxyManagerFactory.create.mockReturnValueOnce(proxyInstance);

      const scriptArgs = ['--flag'];
      const dapArgs = { stopOnEntry: true, justMyCode: true };
      mockSession.breakpoints.set('bp-1', {
        id: 'bp-1',
        file: 'script.py',
        line: 12,
        condition: 'x > 0',
        verified: false
      });

      await (operations as any).startProxyManager(
        mockSession,
        'script.py',
        scriptArgs,
        dapArgs,
        false
      );

      expect(mockDependencies.fileSystem.ensureDir).toHaveBeenCalled();
      expect(mockDependencies.networkManager.findFreePort).toHaveBeenCalled();
      expect(mockDependencies.adapterRegistry.create).toHaveBeenCalledWith(
        mockSession.language,
        expect.objectContaining({
          sessionId: mockSession.id,
          scriptPath: 'script.py',
          scriptArgs
        })
      );
      expect(proxyInstance.start).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: mockSession.id,
          dryRunSpawn: false,
          scriptPath: 'script.py',
          scriptArgs,
          stopOnEntry: true
        })
      );
      expect(mockSession.proxyManager).toBe(proxyInstance);
      expect(mockSessionStore.update).toHaveBeenCalledWith(
        mockSession.id,
        expect.objectContaining({ logDir: expect.stringContaining(`run-`) })
      );
    });

    it('captures MSVC toolchain validation and throws structured error', async () => {
      mockSession.language = 'rust';
      const validation = {
        compatible: false,
        behavior: 'warn',
        toolchain: 'msvc',
        message: 'MSVC binaries have limited support'
      };

      const adapterStub = {
        transformLaunchConfig: vi.fn().mockResolvedValue({ program: 'debug.exe' }),
        consumeLastToolchainValidation: vi.fn().mockReturnValue(validation),
        resolveExecutablePath: vi.fn(),
        buildAdapterCommand: vi.fn()
      };
      mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

      let capturedError: unknown;
      try {
        await (operations as any).startProxyManager(mockSession, 'debug.exe');
      } catch (error) {
        capturedError = error;
      }

      expect(adapterStub.consumeLastToolchainValidation).toHaveBeenCalled();
      expect(capturedError).toBeInstanceOf(Error);
      expect((capturedError as Error).message).toBe('MSVC_TOOLCHAIN_DETECTED');
      expect((capturedError as { toolchainValidation?: unknown }).toolchainValidation).toBe(validation);
      expect(mockSessionStore.update).toHaveBeenCalledWith(
        mockSession.id,
        expect.objectContaining({ toolchainValidation: validation })
      );
      expect(adapterStub.resolveExecutablePath).not.toHaveBeenCalled();
    });
  });

  describe('startDebugging toolchain handling', () => {
    it('returns structured response when MSVC toolchain is detected', async () => {
      mockSession.proxyManager = undefined as any;
      mockSession.language = 'rust';
      const validation = {
        compatible: false,
        behavior: 'warn',
        toolchain: 'msvc',
        message: 'MSVC binaries provide limited debugger data'
      };
      mockSession.toolchainValidation = validation;

      const startProxySpy = vi
        .spyOn(operations as any, 'startProxyManager')
        .mockImplementation(async () => {
          const error = new Error('MSVC_TOOLCHAIN_DETECTED') as Error & {
            toolchainValidation?: unknown;
          };
          error.toolchainValidation = validation;
          throw error;
        });

      try {
        const result = await operations.startDebugging('test-session', 'debug.exe');

        expect(result.success).toBe(false);
        expect(result.error).toBe('MSVC_TOOLCHAIN_DETECTED');
        expect(result.canContinue).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            toolchainValidation: validation,
            message: validation.message
          })
        );

        expect(mockSession.state).toBe(SessionState.CREATED);
        const lastStateCall = mockSessionStore.updateState.mock.calls.at(-1);
        expect(lastStateCall?.[0]).toBe(mockSession.id);
        expect(lastStateCall?.[1]).toBe(SessionState.CREATED);
        expect(mockSessionStore.update).toHaveBeenCalledWith(
          mockSession.id,
          expect.objectContaining({ sessionLifecycle: SessionLifecycleState.CREATED })
        );
      } finally {
        startProxySpy.mockRestore();
      }
    });
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

    it('should report a pending step when no stopped event arrives within the grace window', async () => {
      vi.useFakeTimers();

      mockSession.state = SessionState.PAUSED;
      // Simulate a long-running step by not emitting the 'stopped' event
      mockProxyManager.sendDapRequest.mockResolvedValue({});

      // Setup once to do nothing (no stopped event will fire)
      mockProxyManager.once.mockImplementation(() => {});

      const stepOutPromise = operations.stepOut('test-session');

      // Fast-forward past the grace window (5 seconds)
      await vi.advanceTimersByTimeAsync(5100);

      const result = await stepOutPromise;

      // A slow step is not a failure: the tool reports success with a pending
      // marker and the session completes the step asynchronously.
      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.RUNNING);
      const data = result.data as { message?: string; pending?: boolean };
      expect(data.pending).toBe(true);
      expect(data.message).toContain('still executing');

      vi.useRealTimers();
    });

    it('handles stepOut when internal execution rejects', async () => {
      mockSession.state = SessionState.PAUSED;
      const execSpy = vi.spyOn(operations as any, '_executeStepOperation').mockRejectedValue(new Error('internal failure'));

      const result = await operations.stepOut('test-session');

      expect(result.success).toBe(false);
      expect(result.error).toContain('internal failure');
      expect(mockSession.state).toBe(SessionState.ERROR);
      execSpy.mockRestore();
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

    it('should treat a malformed getStackTrace response as an error', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          // Missing stackFrames property
        }
      });

      // Malformed responses must not be flattened into an empty-but-successful
      // stack trace (issue #124).
      await expect(operations.getStackTrace('test-session', 1))
        .rejects.toThrow('did not include stack frames');
    });

    it('should propagate getStackTrace network failures', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockRejectedValue(new Error('Proxy disconnected'));

      await expect(operations.getStackTrace('test-session', 1))
        .rejects.toThrow('Proxy disconnected');
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

    it('maps syntax errors to friendly messages', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest
        .mockResolvedValueOnce({
          body: {
            stackFrames: [{ id: 7 }]
          }
        })
        .mockRejectedValueOnce(new Error('SyntaxError: invalid syntax'));

      const result = await operations.evaluateExpression('test-session', 'def foo(');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Syntax error in expression');
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

  describe('Evaluate Expression Success Scenarios', () => {
    it('evaluates expression after resolving stack trace frame', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.isRunning.mockReturnValue(true);
      mockProxyManager.getCurrentThreadId.mockReturnValue(5);

      mockProxyManager.sendDapRequest.mockImplementation(
        async (command: string, args: unknown) => {
          if (command === 'stackTrace') {
            return {
              body: {
                stackFrames: [{ id: 123 }],
              },
            };
          }
          if (command === 'evaluate') {
            return {
              body: {
                result: '42',
                type: 'int',
                variablesReference: 0,
                namedVariables: 1,
                indexedVariables: 0,
              },
            };
          }
          return {};
        }
      );

      const result = await operations.evaluateExpression('test-session', '6*7');

      expect(result.success).toBe(true);
      expect(result.result).toBe('42');
      expect(result.type).toBe('int');
      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith(
        'stackTrace',
        expect.objectContaining({ threadId: 5 })
      );
      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith(
        'evaluate',
        expect.objectContaining({ expression: '6*7', frameId: 123 })
      );
    });
  });

  describe('Evaluate Expression timeout override (issue #142)', () => {
    beforeEach(() => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'stackTrace') {
          return { body: { stackFrames: [{ id: 123 }] } };
        }
        if (command === 'evaluate') {
          return { body: { result: '42', variablesReference: 0 } };
        }
        return {};
      });
    });

    it('forwards the override to the evaluate request but not the stackTrace pre-request', async () => {
      const result = await operations.evaluateExpression('test-session', '6*7', undefined, 120000);

      expect(result.success).toBe(true);
      // The internal stackTrace pre-request keeps the default timeout (2-arg call)
      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith(
        'stackTrace',
        expect.objectContaining({ threadId: 1 })
      );
      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith(
        'evaluate',
        expect.objectContaining({ expression: '6*7', frameId: 123 }),
        { timeoutMs: 120000 }
      );
    });

    it('rejects a non-positive or non-finite timeout without sending any DAP request', async () => {
      for (const bad of [0, -5, NaN]) {
        const result = await operations.evaluateExpression('test-session', 'x', undefined, bad);

        expect(result.success).toBe(false);
        expect(result.error).toContain('timeout');
      }
      expect(mockProxyManager.sendDapRequest).not.toHaveBeenCalled();
    });

    it('clamps the override to 600000ms with a warning', async () => {
      const result = await operations.evaluateExpression('test-session', 'x', 123, 900000);

      expect(result.success).toBe(true);
      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith(
        'evaluate',
        expect.objectContaining({ expression: 'x', frameId: 123 }),
        { timeoutMs: 600000 }
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('600000'));
    });

    it('appends a hint naming the timeout arg when the evaluate request times out', async () => {
      mockProxyManager.sendDapRequest
        .mockResolvedValueOnce({ body: { stackFrames: [{ id: 1 }] } })
        .mockRejectedValueOnce(new Error("Request 'evaluate' timed out after 30s"));

      const result = await operations.evaluateExpression('test-session', 'slow()');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
      expect(result.error).toContain("larger 'timeout'");
    });
  });

  describe('Start Debugging Error Scenarios', () => {
    it('should return timeout result when dry run never completes', async () => {
      vi.stubEnv('CI', 'true');
      vi.stubEnv('GITHUB_ACTIONS', undefined);

      const dryRunProxy = {
        ...mockProxyManager,
        hasDryRunCompleted: vi.fn().mockReturnValue(false),
        getDryRunSnapshot: vi.fn().mockReturnValue({ command: 'python -m debugpy', script: 'dry-run.py' })
      };
      mockSession.proxyManager = dryRunProxy;
      mockSession.state = SessionState.INITIALIZING;

      vi.spyOn(operations as any, 'startProxyManager').mockResolvedValue(undefined);
      vi.spyOn(operations as any, 'waitForDryRunCompletion').mockResolvedValue(false);

      const result = await operations.startDebugging('test-session', 'dry-run.py', undefined, undefined, true);

      expect((operations as any).startProxyManager).toHaveBeenCalledTimes(1);
      expect((operations as any).waitForDryRunCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'test-session' }),
        expect.any(Number)
      );
      expect(result!.success).toBe(false);
      expect(result!.error).toContain('Dry run timed out');
    });

    it('returns success immediately when dry run already completed', async () => {
      vi.stubEnv('CI', 'true');
      vi.stubEnv('GITHUB_ACTIONS', undefined);

      const dryRunProxy = {
        ...mockProxyManager,
        hasDryRunCompleted: vi.fn().mockReturnValue(true),
        getDryRunSnapshot: vi.fn().mockReturnValue({ command: 'python -m debugpy', script: 'dry-run.py' }),
      };
      mockSession.proxyManager = undefined;
      mockSession.state = SessionState.STOPPED;
      mockSessionStore.getOrThrow.mockReturnValue(mockSession);

      const waitSpy = vi.spyOn(operations as any, 'waitForDryRunCompletion');
      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = dryRunProxy as any;
      });

      const result = await operations.startDebugging('test-session', 'dry-run.py', undefined, undefined, true);

      expect(result!.success).toBe(true);
      expect(result!.state).toBe(SessionState.STOPPED);
      expect(result!.data?.dryRun).toBe(true);
      expect(dryRunProxy.getDryRunSnapshot).toHaveBeenCalled();
      expect(waitSpy).not.toHaveBeenCalled();
    });

    it('should handle startDebugging with proxy creation failure', async () => {
      vi.stubEnv('CI', 'true');
      vi.stubEnv('GITHUB_ACTIONS', undefined);

      mockDependencies.proxyManagerFactory.create.mockImplementation(() => {
        throw new Error('Port allocation failed');
      });

      const result = await operations.startDebugging('test-session', 'test.py');

      expect(result!.success).toBe(false);
      expect(result!.error).toContain('Port allocation failed');
    });

    it('should handle startDebugging with launch failure', async () => {
      vi.stubEnv('CI', 'true');
      vi.stubEnv('GITHUB_ACTIONS', undefined);

      mockProxyManager.start.mockRejectedValue(new Error('Failed to launch debuggee'));

      const result = await operations.startDebugging('test-session', 'test.py');

      expect(result!.success).toBe(false);
      expect(result!.error).toContain('Failed to launch debuggee');
    });

    it('captures proxy log tail when initialization throws', async () => {
      mockSession.logDir = '/tmp/session-logs';
      mockDependencies.fileSystem.pathExists.mockResolvedValueOnce(true);
      mockDependencies.fileSystem.readFile.mockResolvedValueOnce('first line\nsecond line\nthird line');

      vi.spyOn(operations as any, 'startProxyManager').mockRejectedValue(new Error('Proxy failed to initialize'));

      const result = await operations.startDebugging('test-session', 'test.py');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Proxy failed to initialize');
      expect(mockDependencies.fileSystem.pathExists).toHaveBeenCalledWith(
        path.join('/tmp/session-logs', 'proxy-test-session.log')
      );
      expect(mockDependencies.fileSystem.readFile).toHaveBeenCalled();
      expect(mockProxyManager.stop).toHaveBeenCalled();
      expect(mockSession.proxyManager).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Detailed error in startDebugging'),
        expect.objectContaining({ proxyLogTail: expect.stringContaining('second line') })
      );
    });

    it('records log read failure when tail cannot be captured', async () => {
      mockSession.logDir = '/tmp/session-logs';
      mockDependencies.fileSystem.pathExists.mockResolvedValueOnce(true);
      mockDependencies.fileSystem.readFile.mockRejectedValueOnce(new Error('permission denied'));

      vi.spyOn(operations as any, 'startProxyManager').mockRejectedValue(new Error('Proxy start error'));

      const result = await operations.startDebugging('test-session', 'test.py');

      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Detailed error in startDebugging'),
        expect.objectContaining({
          proxyLogTail: expect.stringContaining('Failed to read proxy log')
        })
      );
    });

    it('should handle startDebugging when already debugging', async () => {
      // Session already has proxy manager
      mockSession.proxyManager = mockProxyManager;
      
      // Mock closeSession method
      (operations as any).closeSession = vi.fn().mockResolvedValue(true);

      // Make the "adapter-configured" event fire immediately to avoid 30s wait
      mockProxyManager.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'adapter-configured' || event === 'stopped') {
          callback();
        }
      });

      const result = await operations.startDebugging('test-session', 'test.py');
      
      // Should close existing session and start new one
      expect((operations as any).closeSession).toHaveBeenCalledWith('test-session');
    });
  });

  describe('Start Debugging Success Scenarios', () => {
    it('completes handshake and waits for stop event', async () => {
      vi.stubEnv('CI', 'true');
      vi.stubEnv('GITHUB_ACTIONS', undefined);

      const proxyStub: any = {
        hasDryRunCompleted: vi.fn().mockReturnValue(false),
        once: vi.fn(),
        removeListener: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        sendDapRequest: vi.fn().mockResolvedValue(undefined),
        isRunning: vi.fn().mockReturnValue(true)
      };
      proxyStub.on.mockReturnValue(proxyStub);
      proxyStub.off.mockReturnValue(proxyStub);
      proxyStub.removeListener.mockReturnValue(proxyStub);
      proxyStub.once.mockImplementation((event: string, handler: () => void) => {
        if (event === 'stopped') {
          mockSession.state = SessionState.PAUSED;
          handler();
        }
        return proxyStub;
      });

      mockSession.proxyManager = undefined;
      mockSession.state = SessionState.CREATED;
      const startProxySpy = vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = proxyStub;
      });

      const policy = {
        performHandshake: vi.fn().mockResolvedValue(undefined),
        isSessionReady: vi.fn().mockImplementation(
          (state: SessionState) => state === SessionState.PAUSED
        ),
      };
      const selectPolicySpy = vi.spyOn(operations as any, 'selectPolicy').mockReturnValue(policy as any);

      let result: any;
      try {
        result = await operations.startDebugging('test-session', 'main.py', undefined, { stopOnEntry: true });
      } finally {
        startProxySpy.mockRestore();
        selectPolicySpy.mockRestore();
      }

      expect(policy.performHandshake).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'test-session' })
      );
      expect(policy.isSessionReady).toHaveBeenCalled();
      expect(result?.success).toBe(true);
      expect(result?.state).toBe(SessionState.PAUSED);
      expect(result?.data?.reason).toBe('entry');
    });

    it('handles dry run completion after waiting', async () => {
      vi.stubEnv('CI', 'true');
      vi.stubEnv('GITHUB_ACTIONS', undefined);

      const dryRunProxy: any = {
        getDryRunSnapshot: vi.fn().mockReturnValue({ command: 'python -m debugpy', script: 'wait.py' }),
        hasDryRunCompleted: vi.fn().mockReturnValue(false),
      };
      mockSession.proxyManager = undefined;
      mockSession.state = SessionState.INITIALIZING;

      const startProxySpy = vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = dryRunProxy;
      });
      const waitSpy = vi.spyOn(operations as any, 'waitForDryRunCompletion').mockResolvedValue(true);

      let result: any;
      try {
        result = await operations.startDebugging('test-session', 'wait.py', undefined, undefined, true);
      } finally {
        startProxySpy.mockRestore();
      }

      expect(waitSpy).toHaveBeenCalled();
      waitSpy.mockRestore();
      expect(result?.success).toBe(true);
      expect(result?.data?.dryRun).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Dry run completed for session test-session')
      );
    });

    it('skips readiness wait when policy reports session ready', async () => {
      const proxyStub: any = {
        hasDryRunCompleted: vi.fn().mockReturnValue(false),
        once: vi.fn(),
        removeListener: vi.fn(),
        sendDapRequest: vi.fn().mockResolvedValue(undefined),
        isRunning: vi.fn().mockReturnValue(true)
      };
      proxyStub.once.mockReturnValue(proxyStub);
      proxyStub.removeListener.mockReturnValue(proxyStub);

      mockSession.proxyManager = undefined;
      mockSession.state = SessionState.INITIALIZING;

      const startProxySpy = vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = proxyStub;
        mockSession.state = SessionState.PAUSED;
      });

      const policy = {
        performHandshake: vi.fn().mockResolvedValue(undefined),
        isSessionReady: vi.fn().mockReturnValue(true),
      };
      const selectPolicySpy = vi.spyOn(operations as any, 'selectPolicy').mockReturnValue(policy as any);

      let result: any;
      try {
        result = await operations.startDebugging('test-session', 'main.py');
      } finally {
        startProxySpy.mockRestore();
        selectPolicySpy.mockRestore();
      }

      expect(policy.performHandshake).toHaveBeenCalled();
      expect(policy.isSessionReady).toHaveBeenCalled();
      expect(proxyStub.once).not.toHaveBeenCalled();
      expect(proxyStub.removeListener).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('skipping adapter readiness wait')
      );
      expect(result?.success).toBe(true);
      expect(result?.state).toBe(SessionState.PAUSED);
    });

    it('logs warning when handshake throws but continues', async () => {
      const proxyStub: any = {
        hasDryRunCompleted: vi.fn().mockReturnValue(false),
        once: vi.fn(),
        removeListener: vi.fn(),
        sendDapRequest: vi.fn().mockResolvedValue(undefined),
        isRunning: vi.fn().mockReturnValue(true)
      };
      proxyStub.once.mockReturnValue(proxyStub);
      proxyStub.removeListener.mockReturnValue(proxyStub);

      mockSession.proxyManager = undefined;
      mockSession.state = SessionState.INITIALIZING;

      const startProxySpy = vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = proxyStub;
        mockSession.state = SessionState.PAUSED;
      });

      const policy = {
        performHandshake: vi.fn().mockRejectedValue(new Error('handshake failed')),
        isSessionReady: vi.fn().mockReturnValue(true),
      };
      const selectPolicySpy = vi.spyOn(operations as any, 'selectPolicy').mockReturnValue(policy as any);

      try {
        const result = await operations.startDebugging('test-session', 'handshake.py');
        expect(result.success).toBe(true);
      } finally {
        startProxySpy.mockRestore();
        selectPolicySpy.mockRestore();
      }

      expect(policy.performHandshake).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Language handshake returned with warning/error')
      );
    });

    it('warns when adapter readiness wait times out', async () => {
      vi.useFakeTimers();
      const proxyStub: any = {
        hasDryRunCompleted: vi.fn().mockReturnValue(false),
        once: vi.fn(),
        removeListener: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        sendDapRequest: vi.fn().mockResolvedValue(undefined),
        isRunning: vi.fn().mockReturnValue(true)
      };
      proxyStub.once.mockReturnValue(proxyStub);
      proxyStub.removeListener.mockReturnValue(proxyStub);
      proxyStub.on.mockReturnValue(proxyStub);
      proxyStub.off.mockReturnValue(proxyStub);

      mockSession.proxyManager = undefined;
      mockSession.state = SessionState.INITIALIZING;

      const startProxySpy = vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = proxyStub;
      });

      const policy = {
        performHandshake: vi.fn().mockResolvedValue(undefined),
        isSessionReady: vi.fn().mockReturnValue(false),
      };
      const selectPolicySpy = vi.spyOn(operations as any, 'selectPolicy').mockReturnValue(policy as any);

      const startPromise = operations.startDebugging('test-session', 'timeout.py');
      await vi.advanceTimersByTimeAsync(30000);
      const result = await startPromise;

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Timed out waiting for debug adapter to be ready')
      );
      expect(result.success).toBe(true);

      startProxySpy.mockRestore();
      selectPolicySpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('waitForDryRunCompletion behaviour', () => {
    it('returns true immediately if already completed', async () => {
      const proxyStub = {
        hasDryRunCompleted: vi.fn().mockReturnValue(true),
        once: vi.fn(),
        removeListener: vi.fn(),
      };
      const session = { ...mockSession, proxyManager: proxyStub } as any;
      const result = await (operations as any).waitForDryRunCompletion(session, 500);
      expect(result).toBe(true);
      expect(proxyStub.once).not.toHaveBeenCalled();
    });

    it('resolves true when dry-run-complete event fires', async () => {
      let capturedHandler: (() => void) | undefined;
      const proxyStub = {
        hasDryRunCompleted: vi.fn().mockReturnValue(false),
        once: vi.fn((event: string, handler: () => void) => {
          if (event === 'dry-run-complete') {
            capturedHandler = handler;
          }
        }),
        removeListener: vi.fn(),
      };
      const session = { ...mockSession, proxyManager: proxyStub } as any;

      const waitPromise = (operations as any).waitForDryRunCompletion(session, 1000);
      expect(capturedHandler).toBeDefined();
      capturedHandler?.();
      const result = await waitPromise;
      expect(result).toBe(true);
      expect(proxyStub.removeListener).toHaveBeenCalledWith('dry-run-complete', expect.any(Function));
    });

    it('resolves true when completion detected during timeout window', async () => {
      vi.useFakeTimers();
      let callCount = 0;
      const proxyStub = {
        hasDryRunCompleted: vi.fn().mockImplementation(() => {
          callCount += 1;
          return callCount > 1;
        }),
        once: vi.fn(),
        removeListener: vi.fn(),
      };
      const session = { ...mockSession, proxyManager: proxyStub } as any;

      const waitPromise = (operations as any).waitForDryRunCompletion(session, 400);
      await vi.advanceTimersByTimeAsync(400);
      const result = await waitPromise;
      expect(result).toBe(true);
      expect(proxyStub.removeListener).toHaveBeenCalledWith('dry-run-complete', expect.any(Function));
      vi.useRealTimers();
    });

    it('returns false when timeout elapses without completion', async () => {
      vi.useFakeTimers();
      const proxyStub = {
        hasDryRunCompleted: vi.fn().mockReturnValue(false),
        once: vi.fn(),
        removeListener: vi.fn(),
      };
      const session = { ...mockSession, proxyManager: proxyStub } as any;

      const waitPromise = (operations as any).waitForDryRunCompletion(session, 400);
      await vi.advanceTimersByTimeAsync(400);
      const result = await waitPromise;
      expect(result).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('_executeStepOperation behaviour', () => {
    it('returns failure when proxy manager unavailable', async () => {
      const session = { ...mockSession, proxyManager: undefined, state: SessionState.PAUSED } as any;

      const result = await (operations as any)._executeStepOperation(session, session.id, {
        command: 'next',
        threadId: 1,
        logTag: 'stepOver',
        successMessage: 'Step completed.',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Proxy manager unavailable');
    });

    it('resolves success when stopped event fires', async () => {
      const handlers: Record<string, Function> = {};
      const proxyStub: any = {
        on: vi.fn((event: string, handler: Function) => {
          handlers[event] = handler;
          return proxyStub;
        }),
        off: vi.fn(() => proxyStub),
        sendDapRequest: vi.fn().mockResolvedValue(undefined),
      };
      const session = { ...mockSession, proxyManager: proxyStub, state: SessionState.PAUSED } as any;

      const promise = (operations as any)._executeStepOperation(session, session.id, {
        command: 'next',
        threadId: 1,
        logTag: 'stepOver',
        successMessage: 'Step completed.',
      });

      expect(proxyStub.on).toHaveBeenCalledWith('stopped', expect.any(Function));
      handlers['stopped']?.();

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data?.message).toBe('Step completed.');
      expect(proxyStub.off).toHaveBeenCalledWith('stopped', expect.any(Function));
      expect(proxyStub.sendDapRequest).toHaveBeenCalledWith('next', { threadId: 1 });
      expect(mockSessionStore.updateState).toHaveBeenCalledWith(session.id, SessionState.RUNNING);
    });
  });

  describe('Operation Success Scenarios', () => {
    it('sets RUNNING state before sending DAP continue request', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.isRunning.mockReturnValue(true);
      mockProxyManager.getCurrentThreadId.mockReturnValue(7);
      mockProxyManager.sendDapRequest.mockResolvedValue(undefined);

      const result = await operations.continue('test-session');

      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('continue', { threadId: 7 });
      expect(result.success).toBe(true);
      expect(mockSessionStore.updateState).toHaveBeenCalledWith('test-session', SessionState.RUNNING);
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
      const eventHandler = (event: string, callback: Function) => {
        if (event === 'stopped' || event === 'terminated' || event === 'exited' || event === 'exit') {
          setTimeout(() => callback(), 10);
        }
        return mockProxyManager;
      };
      mockProxyManager.once.mockImplementation(eventHandler);
      mockProxyManager.on.mockImplementation(eventHandler);
      mockProxyManager.off.mockImplementation(() => mockProxyManager);

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
  });

  describe('attachToProcess thread discovery', () => {
    let mockAdapter: any;

    beforeEach(() => {
      mockAdapter = {
        supportsAttach: vi.fn().mockReturnValue(true),
        transformAttachConfig: vi.fn().mockReturnValue({ type: 'java', request: 'attach', host: 'localhost', port: 5005 }),
        buildAdapterCommand: vi.fn().mockReturnValue({ command: 'java', args: ['-jar', 'debug.jar'] }),
        resolveExecutablePath: vi.fn().mockResolvedValue('java')
      };
      mockDependencies.adapterRegistry.create.mockResolvedValue(mockAdapter);
      mockSession.language = 'java';
      mockSession.state = SessionState.CREATED;
      mockProxyManager.setCurrentThreadId = vi.fn();
      // Shrink the attach verification window so failure-path tests stay fast.
      (operations as unknown as { attachVerifyTimeoutMs: number }).attachVerifyTimeoutMs = 200;
      (operations as unknown as { attachVerifyIntervalMs: number }).attachVerifyIntervalMs = 10;
      (operations as unknown as { attachPauseStopTimeoutMs: number }).attachPauseStopTimeoutMs = 50;
    });

    it('should discover main thread when available', async () => {
      // Setup: threads request returns threads including "main"
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          return {
            body: {
              threads: [
                { id: 1, name: 'Reference Handler' },
                { id: 2, name: 'main' },
                { id: 3, name: 'Finalizer' }
              ]
            }
          };
        }
        return {};
      });

      // Mock startProxyManager to succeed and set up the proxy
      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });

      const result = await operations.attachToProcess('test-session', {
        port: 5005,
        host: 'localhost',
        stopOnEntry: true
      });

      expect(result.success).toBe(true);
      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('threads', {});
      expect(mockProxyManager.setCurrentThreadId).toHaveBeenCalledWith(2); // main thread id
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Discovered 3 threads')
      );
    });

    it('should use first thread when main is not available', async () => {
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          return {
            body: {
              threads: [
                { id: 5, name: 'Worker-1' },
                { id: 6, name: 'Worker-2' }
              ]
            }
          };
        }
        return {};
      });

      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });

      const result = await operations.attachToProcess('test-session', {
        port: 5005,
        host: 'localhost',
        stopOnEntry: true
      });

      expect(result.success).toBe(true);
      expect(mockProxyManager.setCurrentThreadId).toHaveBeenCalledWith(5); // first thread
    });

    it('should fail the attach when the debugger reports zero threads for the whole verification window', async () => {
      // Previously this scenario silently fell back to threadId=1 and
      // reported success + PAUSED — the exact lie described in issue #124.
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          return { body: { threads: [] } };
        }
        return {};
      });

      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });

      const result = await operations.attachToProcess('test-session', {
        port: 5005,
        host: 'localhost',
        stopOnEntry: true
      });

      expect(result.success).toBe(false);
      expect(result.state).toBe(SessionState.ERROR);
      expect(result.error).toContain('no threads reported');
      expect(result.error).toContain('zero threads');
      // The failure must tell the caller which knob raises the window (#143).
      expect(result.error).toContain('verifyTimeout');
      expect(mockProxyManager.setCurrentThreadId).not.toHaveBeenCalled();
      // The proxy must be torn down so the session is not left half-attached.
      expect(mockProxyManager.stop).toHaveBeenCalled();
      expect(mockSession.proxyManager).toBeUndefined();
    });

    it('should fail the attach when the threads request keeps failing for the whole verification window', async () => {
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          throw new Error('Connection refused');
        }
        return {};
      });

      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });

      const result = await operations.attachToProcess('test-session', {
        port: 5005,
        host: 'localhost',
        stopOnEntry: true
      });

      expect(result.success).toBe(false);
      expect(result.state).toBe(SessionState.ERROR);
      expect(result.error).toContain('no threads reported');
      expect(result.error).toContain('Connection refused');
      expect(mockProxyManager.setCurrentThreadId).not.toHaveBeenCalled();
      expect(mockProxyManager.stop).toHaveBeenCalled();
    });

    it('should fail the attach when the adapter answers threads with a DAP failure response', async () => {
      // Shape produced by the js-debug proxy when the child session never
      // materializes ("Child session not ready for '...' after waiting ...ms").
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          return { success: false, message: "Child session not ready for 'threads' after waiting 12000ms" };
        }
        return {};
      });

      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });

      const result = await operations.attachToProcess('test-session', {
        port: 5005,
        host: 'localhost',
        stopOnEntry: true
      });

      expect(result.success).toBe(false);
      expect(result.state).toBe(SessionState.ERROR);
      expect(result.error).toContain('Child session not ready');
      expect(mockProxyManager.setCurrentThreadId).not.toHaveBeenCalled();
    });

    it('should invoke the adapter policy performHandshake for attach when the policy defines it', async () => {
      // js-debug's DAP attach sequence is driven by performHandshake; before
      // issue #124 attachToProcess never called it, so no attach request ever
      // reached the adapter. Policies without performHandshake are no-ops.
      const handshakeSpy = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(operations as any, 'selectPolicy').mockReturnValue({
        performHandshake: handshakeSpy,
        getAttachBehavior: () => undefined
      });

      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          return { body: { threads: [{ id: 1, name: 'main' }] } };
        }
        return {};
      });

      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
        return { request: 'attach', port: 5005 };
      });

      const result = await operations.attachToProcess('test-session', {
        port: 5005,
        host: 'localhost',
        stopOnEntry: true
      });

      expect(result.success).toBe(true);
      expect(handshakeSpy).toHaveBeenCalledTimes(1);
      expect(handshakeSpy.mock.calls[0][0]).toMatchObject({
        sessionId: 'test-session',
        scriptPath: 'attach://remote',
        dapLaunchArgs: expect.objectContaining({
          request: 'attach',
          __attachMode: true,
          port: 5005
        }),
        launchConfig: { request: 'attach', port: 5005 }
      });
    });

    it('should tolerate a performHandshake failure and still verify the attach', async () => {
      const handshakeSpy = vi.fn().mockRejectedValue(new Error('handshake exploded'));
      vi.spyOn(operations as any, 'selectPolicy').mockReturnValue({
        performHandshake: handshakeSpy,
        getAttachBehavior: () => undefined
      });

      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          return { body: { threads: [{ id: 1, name: 'main' }] } };
        }
        return {};
      });

      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });

      const result = await operations.attachToProcess('test-session', {
        port: 5005,
        host: 'localhost',
        stopOnEntry: true
      });

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Language handshake for attach returned with warning/error')
      );
    });

    it('should succeed when threads appear during the verification window', async () => {
      // Emulates child-session adoption finishing after the attach handshake:
      // the first polls see no threads, a later poll reports the real ones.
      let threadCalls = 0;
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          threadCalls++;
          if (threadCalls < 3) {
            return { body: { threads: [] } };
          }
          return { body: { threads: [{ id: 7, name: 'main' }] } };
        }
        return {};
      });

      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });

      const result = await operations.attachToProcess('test-session', {
        port: 5005,
        host: 'localhost',
        stopOnEntry: true
      });

      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.PAUSED);
      expect(threadCalls).toBeGreaterThanOrEqual(3);
      expect(mockProxyManager.setCurrentThreadId).toHaveBeenCalledWith(7);
    });

    it('should honor a caller-provided verifyTimeout over the default window', async () => {
      // Issue #143: the window must be adjustable per call. A shorter
      // override proves the caller's value is the one actually applied —
      // if the default (raised to 5s here) were used instead, the failure
      // message would name 5000ms and the test would take seconds.
      (operations as unknown as { attachVerifyTimeoutMs: number }).attachVerifyTimeoutMs = 5000;
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          return { body: { threads: [] } };
        }
        return {};
      });

      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });

      const result = await operations.attachToProcess('test-session', {
        port: 5005,
        host: 'localhost',
        stopOnEntry: true,
        verifyTimeout: 200
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('200ms');
    });

    it('should succeed when a larger verifyTimeout lets a slow target report threads', async () => {
      // Models the #143 rescue: a target that only becomes debuggable after
      // the default window (200ms via beforeEach) has elapsed succeeds when
      // the caller extends the window.
      (operations as unknown as { attachVerifyIntervalMs: number }).attachVerifyIntervalMs = 25;
      const attachStartedAt = Date.now();
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          if (Date.now() - attachStartedAt < 400) {
            return { body: { threads: [] } };
          }
          return { body: { threads: [{ id: 9, name: 'main' }] } };
        }
        return {};
      });

      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });

      const result = await operations.attachToProcess('test-session', {
        port: 5005,
        host: 'localhost',
        stopOnEntry: true,
        verifyTimeout: 2000
      });

      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.PAUSED);
      expect(mockProxyManager.setCurrentThreadId).toHaveBeenCalledWith(9);
    });

    it('should reject a non-positive verifyTimeout without starting a proxy', async () => {
      const startSpy = vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          return { body: { threads: [{ id: 1, name: 'main' }] } };
        }
        return {};
      });

      for (const bad of [0, -5, Number.NaN]) {
        const result = await operations.attachToProcess('test-session', {
          port: 5005,
          host: 'localhost',
          stopOnEntry: true,
          verifyTimeout: bad
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('verifyTimeout');
      }
      expect(startSpy).not.toHaveBeenCalled();
    });

    it('should not leak verifyTimeout into the adapter attach arguments', async () => {
      // verifyTimeout is consumed by the session manager's verification loop;
      // it must not ride the config spread into the DAP attach arguments.
      const startSpy = vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          return { body: { threads: [{ id: 1, name: 'main' }] } };
        }
        return {};
      });

      const result = await operations.attachToProcess('test-session', {
        port: 5005,
        host: 'localhost',
        stopOnEntry: true,
        verifyTimeout: 3000
      });

      expect(result.success).toBe(true);
      const attachLaunchArgs = startSpy.mock.calls[0][3] as Record<string, unknown>;
      expect(attachLaunchArgs).not.toHaveProperty('verifyTimeout');
      expect(attachLaunchArgs).toMatchObject({ request: 'attach', __attachMode: true, port: 5005 });
    });

    it('should skip thread discovery when stopOnEntry is false', async () => {
      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });

      const result = await operations.attachToProcess('test-session', {
        port: 5005,
        host: 'localhost',
        stopOnEntry: false
      });

      expect(result.success).toBe(true);
      // threads request should not be made when stopOnEntry is false
      expect(mockProxyManager.sendDapRequest).not.toHaveBeenCalledWith('threads', {});
      expect(mockProxyManager.setCurrentThreadId).not.toHaveBeenCalled();
    });

    it('should send a post-attach pause when the policy requests it (ruby)', async () => {
      // Ruby's policy declares pauseAfterAttach: rdbg does not suspend a
      // running target on attach, so the PAUSED state must be made real.
      mockSession.language = 'ruby';
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          return { body: { threads: [{ id: 1, name: 'main' }] } };
        }
        return {};
      });

      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });

      const result = await operations.attachToProcess('test-session', {
        port: 12345,
        host: '127.0.0.1',
        stopOnEntry: true
      });

      expect(result.success).toBe(true);
      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('pause', { threadId: 1 });
    });

    it('should tolerate a rejected post-attach pause (target already stopped)', async () => {
      mockSession.language = 'ruby';
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          return { body: { threads: [{ id: 1, name: 'main' }] } };
        }
        if (command === 'pause') {
          throw new Error('already stopped');
        }
        return {};
      });

      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });

      const result = await operations.attachToProcess('test-session', {
        port: 12345,
        host: '127.0.0.1',
        stopOnEntry: true
      });

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Post-attach pause not needed/accepted')
      );
    });

    it('should not send a post-attach pause for policies without the behavior (java)', async () => {
      mockSession.language = 'java';
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          return { body: { threads: [{ id: 2, name: 'main' }] } };
        }
        return {};
      });

      vi.spyOn(operations as any, 'startProxyManager').mockImplementation(async () => {
        mockSession.proxyManager = mockProxyManager;
      });

      const result = await operations.attachToProcess('test-session', {
        port: 5005,
        host: 'localhost',
        stopOnEntry: true
      });

      expect(result.success).toBe(true);
      expect(mockProxyManager.sendDapRequest).not.toHaveBeenCalledWith('pause', expect.anything());
    });
  });

  describe('Attach Mode Handling', () => {
    // These tests use resolveExecutablePath to throw immediately after config transformation
    // This allows us to verify the attach mode logic was exercised without waiting for proxy startup
    // Note: startDebugging returns { success: false, ... } on error, not throw

    it('should detect attach mode from request field', async () => {
      const mockAdapter = {
        supportsAttach: vi.fn().mockReturnValue(true),
        transformAttachConfig: vi.fn().mockReturnValue({ type: 'java', request: 'attach' }),
        transformLaunchConfig: vi.fn().mockResolvedValue({}),
        // Throw after config transform to exit fast
        resolveExecutablePath: vi.fn().mockRejectedValue(new Error('early_exit'))
      };

      mockDependencies.adapterRegistry.create.mockResolvedValue(mockAdapter);
      mockSession.language = 'java';
      mockSession.state = SessionState.CREATED;

      const result = await operations.startDebugging(
        'test-session',
        '/dummy/path.java',
        [],
        { request: 'attach', host: 'localhost', port: 5005 }
      );

      expect(result.success).toBe(false);
      // Verify transformAttachConfig was called (not transformLaunchConfig)
      expect(mockAdapter.transformAttachConfig).toHaveBeenCalled();
      expect(mockAdapter.transformLaunchConfig).not.toHaveBeenCalled();
    });

    it('should detect attach mode from __attachMode flag', async () => {
      const mockAdapter = {
        supportsAttach: vi.fn().mockReturnValue(true),
        transformAttachConfig: vi.fn().mockReturnValue({ type: 'java', request: 'attach' }),
        transformLaunchConfig: vi.fn().mockResolvedValue({}),
        resolveExecutablePath: vi.fn().mockRejectedValue(new Error('early_exit'))
      };

      mockDependencies.adapterRegistry.create.mockResolvedValue(mockAdapter);
      mockSession.language = 'java';
      mockSession.state = SessionState.CREATED;

      const result = await operations.startDebugging(
        'test-session',
        '/dummy/path.java',
        [],
        { __attachMode: true, host: 'localhost', port: 5005 }
      );

      expect(result.success).toBe(false);
      expect(mockAdapter.transformAttachConfig).toHaveBeenCalled();
      expect(mockAdapter.transformLaunchConfig).not.toHaveBeenCalled();
    });

    it('should not set program/cwd/args in attach mode', async () => {
      let capturedConfig: Record<string, unknown> | null = null;
      const mockAdapter = {
        supportsAttach: vi.fn().mockReturnValue(true),
        transformAttachConfig: vi.fn().mockImplementation((config) => {
          capturedConfig = config;
          return { type: 'java', request: 'attach' };
        }),
        transformLaunchConfig: vi.fn().mockResolvedValue({}),
        resolveExecutablePath: vi.fn().mockRejectedValue(new Error('early_exit'))
      };

      mockDependencies.adapterRegistry.create.mockResolvedValue(mockAdapter);
      mockSession.language = 'java';
      mockSession.state = SessionState.CREATED;

      const result = await operations.startDebugging(
        'test-session',
        '/some/script.java',
        ['arg1', 'arg2'],
        { request: 'attach', host: 'localhost', port: 5005 }
      );

      expect(result.success).toBe(false);
      // Verify program, cwd, args are NOT in the config for attach mode
      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig!.program).toBeUndefined();
      expect(capturedConfig!.args).toBeUndefined();
    });

    it('should fall back to transformLaunchConfig when adapter does not support attach', async () => {
      const mockAdapter = {
        supportsAttach: vi.fn().mockReturnValue(false), // Does not support attach
        transformLaunchConfig: vi.fn().mockResolvedValue({ type: 'python' }),
        resolveExecutablePath: vi.fn().mockRejectedValue(new Error('early_exit'))
      };

      mockDependencies.adapterRegistry.create.mockResolvedValue(mockAdapter);
      mockSession.language = 'python';
      mockSession.state = SessionState.CREATED;

      const result = await operations.startDebugging(
        'test-session',
        '/script.py',
        [],
        { request: 'attach' } // Request attach but adapter doesn't support it
      );

      expect(result.success).toBe(false);
      // Should fall back to transformLaunchConfig
      expect(mockAdapter.transformLaunchConfig).toHaveBeenCalled();
    });

    it('should handle transformAttachConfig errors gracefully', async () => {
      const mockAdapter = {
        supportsAttach: vi.fn().mockReturnValue(true),
        transformAttachConfig: vi.fn().mockImplementation(() => {
          throw new Error('Attach config transformation failed');
        }),
        transformLaunchConfig: vi.fn().mockResolvedValue({}),
        resolveExecutablePath: vi.fn().mockRejectedValue(new Error('early_exit'))
      };

      mockDependencies.adapterRegistry.create.mockResolvedValue(mockAdapter);
      mockSession.language = 'java';
      mockSession.state = SessionState.CREATED;

      const result = await operations.startDebugging(
        'test-session',
        '/dummy/path.java',
        [],
        { request: 'attach', host: 'localhost', port: 5005 }
      );

      expect(result.success).toBe(false);
      // Should have logged the warning about transformAttachConfig failure
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('transformAttachConfig failed')
      );
    });
  });

  describe('Multi-Breakpoint DAP Aggregation', () => {
    /** Helper to extract the breakpoints array from the last sendDapRequest call. */
    function getLastDapBreakpoints(): Array<{ line: number; condition?: string }> {
      const calls = mockProxyManager.sendDapRequest.mock.calls;
      const lastCall = calls[calls.length - 1];
      return lastCall[1].breakpoints;
    }

    /** Helper to extract the source path from the last sendDapRequest call. */
    function getLastDapSourcePath(): string {
      const calls = mockProxyManager.sendDapRequest.mock.calls;
      const lastCall = calls[calls.length - 1];
      return lastCall[1].source.path;
    }

    beforeEach(() => {
      mockSession.state = SessionState.PAUSED;
      mockSession.breakpoints = new Map();
    });

    it('should send all 3 BPs for same file in a single DAP request', async () => {
      // Set 3 breakpoints on same file, each DAP response returns all BPs so far
      for (let i = 1; i <= 3; i++) {
        mockProxyManager.sendDapRequest.mockResolvedValue({
          body: {
            breakpoints: Array.from({ length: i }, (_, j) => ({
              verified: true,
              line: (j + 1) * 10,
            }))
          }
        });
        await operations.setBreakpoint('test-session', 'com.example.Foo', i * 10);
      }

      // The last DAP call should have all 3 BPs
      const lastBps = getLastDapBreakpoints();
      expect(lastBps).toHaveLength(3);
      expect(lastBps.map(bp => bp.line)).toEqual([10, 20, 30]);
      expect(getLastDapSourcePath()).toBe('com.example.Foo');
    });

    it('should remove first BP: remaining 2 BPs are sent correctly', async () => {
      // Set 3 BPs
      for (let i = 1; i <= 3; i++) {
        mockProxyManager.sendDapRequest.mockResolvedValue({
          body: {
            breakpoints: Array.from({ length: i }, (_, j) => ({
              verified: true,
              line: (j + 1) * 10,
            }))
          }
        });
        await operations.setBreakpoint('test-session', 'com.example.Foo', i * 10);
      }

      // Remove first BP (line 10) by deleting from session.breakpoints
      const firstBpId = Array.from(mockSession.breakpoints.entries())
        .find(([_, bp]: [string, any]) => bp.line === 10)?.[0];
      expect(firstBpId).toBeDefined();
      mockSession.breakpoints.delete(firstBpId!);

      // Set another BP to trigger a new DAP request (simulates re-sync)
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [
            { verified: true, line: 20 },
            { verified: true, line: 30 },
            { verified: true, line: 40 },
          ]
        }
      });
      await operations.setBreakpoint('test-session', 'com.example.Foo', 40);

      const lastBps = getLastDapBreakpoints();
      expect(lastBps).toHaveLength(3);
      expect(lastBps.map(bp => bp.line)).toEqual([20, 30, 40]);
    });

    it('should remove middle BP: remaining 2 BPs are sent correctly', async () => {
      // Set 3 BPs
      for (let i = 1; i <= 3; i++) {
        mockProxyManager.sendDapRequest.mockResolvedValue({
          body: {
            breakpoints: Array.from({ length: i }, (_, j) => ({
              verified: true,
              line: (j + 1) * 10,
            }))
          }
        });
        await operations.setBreakpoint('test-session', 'com.example.Foo', i * 10);
      }

      // Remove middle BP (line 20)
      const middleBpId = Array.from(mockSession.breakpoints.entries())
        .find(([_, bp]: [string, any]) => bp.line === 20)?.[0];
      expect(middleBpId).toBeDefined();
      mockSession.breakpoints.delete(middleBpId!);

      // Trigger new DAP request
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [
            { verified: true, line: 10 },
            { verified: true, line: 30 },
            { verified: true, line: 40 },
          ]
        }
      });
      await operations.setBreakpoint('test-session', 'com.example.Foo', 40);

      const lastBps = getLastDapBreakpoints();
      expect(lastBps).toHaveLength(3);
      expect(lastBps.map(bp => bp.line)).toEqual([10, 30, 40]);
    });

    it('should remove last BP: remaining 2 BPs are sent correctly', async () => {
      // Set 3 BPs
      for (let i = 1; i <= 3; i++) {
        mockProxyManager.sendDapRequest.mockResolvedValue({
          body: {
            breakpoints: Array.from({ length: i }, (_, j) => ({
              verified: true,
              line: (j + 1) * 10,
            }))
          }
        });
        await operations.setBreakpoint('test-session', 'com.example.Foo', i * 10);
      }

      // Remove last BP (line 30)
      const lastBpId = Array.from(mockSession.breakpoints.entries())
        .find(([_, bp]: [string, any]) => bp.line === 30)?.[0];
      expect(lastBpId).toBeDefined();
      mockSession.breakpoints.delete(lastBpId!);

      // Trigger new DAP request
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [
            { verified: true, line: 10 },
            { verified: true, line: 20 },
            { verified: true, line: 40 },
          ]
        }
      });
      await operations.setBreakpoint('test-session', 'com.example.Foo', 40);

      const lastBps = getLastDapBreakpoints();
      expect(lastBps).toHaveLength(3);
      expect(lastBps.map(bp => bp.line)).toEqual([10, 20, 40]);
    });

    it('should not include BPs from different files in the DAP request', async () => {
      // Set BP on file A
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: { breakpoints: [{ verified: true, line: 10 }] }
      });
      await operations.setBreakpoint('test-session', 'com.a.Foo', 10);

      // Set BP on file B (different package, same simple name)
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: { breakpoints: [{ verified: true, line: 20 }] }
      });
      await operations.setBreakpoint('test-session', 'com.b.Foo', 20);

      // Last DAP request should only contain the BP for com.b.Foo
      const lastBps = getLastDapBreakpoints();
      expect(lastBps).toHaveLength(1);
      expect(lastBps[0].line).toBe(20);
      expect(getLastDapSourcePath()).toBe('com.b.Foo');
    });

    it('should update verified status for all BPs from DAP response', async () => {
      // Set 2 BPs, first response: only first verified
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: { breakpoints: [{ verified: true, line: 10 }] }
      });
      await operations.setBreakpoint('test-session', 'com.example.Foo', 10);

      // Second BP: both returned, second unverified
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [
            { verified: true, line: 10 },
            { verified: false, line: 20, message: 'No executable code at line 20' },
          ]
        }
      });
      await operations.setBreakpoint('test-session', 'com.example.Foo', 20);

      const bps = Array.from(mockSession.breakpoints.values());
      const bp10 = bps.find((bp: any) => bp.line === 10);
      const bp20 = bps.find((bp: any) => bp.line === 20);

      expect(bp10.verified).toBe(true);
      expect(bp20.verified).toBe(false);
      expect(bp20.message).toBe('No executable code at line 20');
    });

    it('should update line number when DAP adjusts it', async () => {
      // DAP can adjust the line to the nearest executable line
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [{ verified: true, line: 12 }] // adjusted from 10 to 12
        }
      });
      await operations.setBreakpoint('test-session', 'com.example.Foo', 10);

      const bps = Array.from(mockSession.breakpoints.values());
      expect(bps).toHaveLength(1);
      expect((bps[0] as any).line).toBe(12); // adjusted
    });

    it('should update message field from DAP response', async () => {
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [{
            verified: true,
            line: 10,
            message: 'Breakpoint bound to com.example.Foo:10'
          }]
        }
      });
      await operations.setBreakpoint('test-session', 'com.example.Foo', 10);

      const bp = Array.from(mockSession.breakpoints.values())[0] as any;
      expect(bp.message).toBe('Breakpoint bound to com.example.Foo:10');
    });

    it('should pass condition through to DAP request', async () => {
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: { breakpoints: [{ verified: true, line: 10 }] }
      });
      await operations.setBreakpoint('test-session', 'com.example.Foo', 10, 'x > 5');

      const lastBps = getLastDapBreakpoints();
      expect(lastBps).toHaveLength(1);
      expect(lastBps[0].condition).toBe('x > 5');
    });

    it('should preserve conditions when adding a second BP to the same file', async () => {
      // First BP with condition
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: { breakpoints: [{ verified: true, line: 10 }] }
      });
      await operations.setBreakpoint('test-session', 'com.example.Foo', 10, 'x > 5');

      // Second BP without condition — DAP request should contain both
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [
            { verified: true, line: 10 },
            { verified: true, line: 20 },
          ]
        }
      });
      await operations.setBreakpoint('test-session', 'com.example.Foo', 20);

      const lastBps = getLastDapBreakpoints();
      expect(lastBps).toHaveLength(2);
      expect(lastBps[0].line).toBe(10);
      expect(lastBps[0].condition).toBe('x > 5');
      expect(lastBps[1].line).toBe(20);
      expect(lastBps[1].condition).toBeUndefined();
    });

    it('should handle DAP response with fewer BPs than sent', async () => {
      // Set 2 BPs
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: { breakpoints: [{ verified: true, line: 10 }] }
      });
      await operations.setBreakpoint('test-session', 'com.example.Foo', 10);

      // DAP only returns 1 BP in response (e.g. adapter bug or limit)
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [{ verified: true, line: 10 }]
          // missing second BP
        }
      });
      await operations.setBreakpoint('test-session', 'com.example.Foo', 20);

      // First BP updated, second remains unverified (default)
      const bps = Array.from(mockSession.breakpoints.values());
      const bp10 = bps.find((bp: any) => bp.line === 10);
      const bp20 = bps.find((bp: any) => bp.line === 20);
      expect(bp10.verified).toBe(true);
      expect(bp20.verified).toBe(false);
    });

    it('should keep com.b.Foo BP intact when removing com.a.Foo BP', async () => {
      // Set BP on com.a.Foo
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: { breakpoints: [{ verified: true, line: 10 }] }
      });
      await operations.setBreakpoint('test-session', 'com.a.Foo', 10);

      // Set BP on com.b.Foo
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: { breakpoints: [{ verified: true, line: 20 }] }
      });
      await operations.setBreakpoint('test-session', 'com.b.Foo', 20);

      // Both BPs exist
      expect(mockSession.breakpoints.size).toBe(2);

      // Remove the com.a.Foo BP
      const aFooBpId = Array.from(mockSession.breakpoints.entries())
        .find(([_, bp]: [string, any]) => bp.file === 'com.a.Foo')?.[0];
      expect(aFooBpId).toBeDefined();
      mockSession.breakpoints.delete(aFooBpId!);

      // Add new BP on com.b.Foo to trigger DAP re-sync for that file
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [
            { verified: true, line: 20 },
            { verified: true, line: 30 },
          ]
        }
      });
      await operations.setBreakpoint('test-session', 'com.b.Foo', 30);

      // DAP request should only contain com.b.Foo BPs (20, 30), not com.a.Foo
      const lastBps = getLastDapBreakpoints();
      expect(lastBps).toHaveLength(2);
      expect(lastBps.map(bp => bp.line)).toEqual([20, 30]);
      expect(getLastDapSourcePath()).toBe('com.b.Foo');

      // com.a.Foo BP should be gone, com.b.Foo BPs should remain
      const remainingFiles = Array.from(mockSession.breakpoints.values())
        .map((bp: any) => bp.file);
      expect(remainingFiles).not.toContain('com.a.Foo');
      expect(remainingFiles.filter((f: string) => f === 'com.b.Foo')).toHaveLength(2);
    });

    it('should keep com.b.Foo BP intact when removing com.b.Foo BP (but not the other)', async () => {
      // Set 2 BPs on com.b.Foo
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: { breakpoints: [{ verified: true, line: 10 }] }
      });
      await operations.setBreakpoint('test-session', 'com.b.Foo', 10);

      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [
            { verified: true, line: 10 },
            { verified: true, line: 20 },
          ]
        }
      });
      await operations.setBreakpoint('test-session', 'com.b.Foo', 20);

      // Set BP on com.a.Foo
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: { breakpoints: [{ verified: true, line: 50 }] }
      });
      await operations.setBreakpoint('test-session', 'com.a.Foo', 50);

      expect(mockSession.breakpoints.size).toBe(3);

      // Remove one of the com.b.Foo BPs (line 10)
      const bFoo10Id = Array.from(mockSession.breakpoints.entries())
        .find(([_, bp]: [string, any]) => bp.file === 'com.b.Foo' && bp.line === 10)?.[0];
      expect(bFoo10Id).toBeDefined();
      mockSession.breakpoints.delete(bFoo10Id!);

      // Trigger re-sync on com.b.Foo
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [
            { verified: true, line: 20 },
            { verified: true, line: 30 },
          ]
        }
      });
      await operations.setBreakpoint('test-session', 'com.b.Foo', 30);

      // DAP request for com.b.Foo should contain remaining + new (20, 30)
      const lastBps = getLastDapBreakpoints();
      expect(lastBps).toHaveLength(2);
      expect(lastBps.map(bp => bp.line)).toEqual([20, 30]);
      expect(getLastDapSourcePath()).toBe('com.b.Foo');

      // com.a.Foo BP (line 50) should be untouched
      const aFooBp = Array.from(mockSession.breakpoints.values())
        .find((bp: any) => bp.file === 'com.a.Foo') as any;
      expect(aFooBp).toBeDefined();
      expect(aFooBp.line).toBe(50);
      expect(aFooBp.verified).toBe(true);
    });

    it('should treat com.A.Foo and com.A$Foo as separate sources', async () => {
      // com.A.Foo = class Foo in package com.A
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: { breakpoints: [{ verified: true, line: 10 }] }
      });
      await operations.setBreakpoint('test-session', 'com.A.Foo', 10);

      // com.A$Foo = inner class Foo of class A in default package
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: { breakpoints: [{ verified: true, line: 20 }] }
      });
      await operations.setBreakpoint('test-session', 'com.A$Foo', 20);

      expect(mockSession.breakpoints.size).toBe(2);

      // Remove com.A.Foo BP
      const aFooBpId = Array.from(mockSession.breakpoints.entries())
        .find(([_, bp]: [string, any]) => bp.file === 'com.A.Foo')?.[0];
      expect(aFooBpId).toBeDefined();
      mockSession.breakpoints.delete(aFooBpId!);

      // Trigger re-sync on com.A$Foo
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [
            { verified: true, line: 20 },
            { verified: true, line: 30 },
          ]
        }
      });
      await operations.setBreakpoint('test-session', 'com.A$Foo', 30);

      // DAP request should only contain com.A$Foo BPs
      const lastBps = getLastDapBreakpoints();
      expect(lastBps).toHaveLength(2);
      expect(lastBps.map(bp => bp.line)).toEqual([20, 30]);
      expect(getLastDapSourcePath()).toBe('com.A$Foo');

      // com.A.Foo should be gone from breakpoints map
      const remainingFiles = Array.from(mockSession.breakpoints.values())
        .map((bp: any) => bp.file);
      expect(remainingFiles).not.toContain('com.A.Foo');
      expect(remainingFiles.filter((f: string) => f === 'com.A$Foo')).toHaveLength(2);
    });

    it('should keep com.A$Foo BP when adding more BPs to com.A.Foo', async () => {
      // com.A$Foo (inner class)
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: { breakpoints: [{ verified: true, line: 10 }] }
      });
      await operations.setBreakpoint('test-session', 'com.A$Foo', 10);

      // com.A.Foo (regular class)
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: { breakpoints: [{ verified: true, line: 20 }] }
      });
      await operations.setBreakpoint('test-session', 'com.A.Foo', 20);

      // Add second BP to com.A.Foo
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [
            { verified: true, line: 20 },
            { verified: true, line: 30 },
          ]
        }
      });
      await operations.setBreakpoint('test-session', 'com.A.Foo', 30);

      // DAP request should only contain com.A.Foo BPs (20, 30)
      const lastBps = getLastDapBreakpoints();
      expect(lastBps).toHaveLength(2);
      expect(lastBps.map(bp => bp.line)).toEqual([20, 30]);
      expect(getLastDapSourcePath()).toBe('com.A.Foo');

      // com.A$Foo BP (line 10) should be untouched
      const innerBp = Array.from(mockSession.breakpoints.values())
        .find((bp: any) => bp.file === 'com.A$Foo') as any;
      expect(innerBp).toBeDefined();
      expect(innerBp.line).toBe(10);
      expect(innerBp.verified).toBe(true);
    });
  });

  describe('Disconnect and Detach Safety', () => {
    it('detachFromProcess should return error when proxyManager is null', async () => {
      mockSession.proxyManager = null;

      const result = await operations.detachFromProcess('test-session');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No active debug session to detach from');
    });

    it('detachFromProcess should send disconnect with terminateDebuggee=false', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockResolvedValue({});

      const result = await operations.detachFromProcess('test-session', false);

      expect(result.success).toBe(true);
      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('disconnect', {
        terminateDebuggee: false
      });
      expect(result.data.message).toContain('process still running');
    });

    it('detachFromProcess should survive proxyManager being nulled during disconnect (race condition)', async () => {
      mockSession.state = SessionState.PAUSED;
      // Simulate the race: sendDapRequest triggers a 'terminated' event handler
      // that sets proxyManager to undefined before we reach the .stop() call
      mockProxyManager.sendDapRequest.mockImplementation(async () => {
        mockSession.proxyManager = undefined;
        return {};
      });

      const result = await operations.detachFromProcess('test-session', false);

      expect(result.success).toBe(true);
      // stop() should NOT have been called since proxyManager was cleared
      expect(mockProxyManager.stop).not.toHaveBeenCalled();
    });

    it('detachFromProcess should call stop() when proxyManager survives disconnect', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockResolvedValue({});

      const result = await operations.detachFromProcess('test-session', false);

      expect(result.success).toBe(true);
      expect(mockProxyManager.stop).toHaveBeenCalled();
    });

    it('detachFromProcess should continue cleanup even when disconnect request fails', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockRejectedValue(new Error('Connection lost'));

      const result = await operations.detachFromProcess('test-session', false);

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Disconnect request failed'),
        expect.any(Error)
      );
      // Should still stop the proxy
      expect(mockProxyManager.stop).toHaveBeenCalled();
    });

    it('detachFromProcess with terminateProcess=true should call closeSession', async () => {
      mockSession.state = SessionState.PAUSED;
      // closeSession uses sessionStore.get (not getOrThrow)
      mockSessionStore.get.mockReturnValue(mockSession);
      mockProxyManager.stop.mockResolvedValue(undefined);

      const result = await operations.detachFromProcess('test-session', true);

      expect(result.success).toBe(true);
      expect(result.data.message).toContain('terminated process');
      // Should NOT have sent disconnect with terminateDebuggee=false
      expect(mockProxyManager.sendDapRequest).not.toHaveBeenCalledWith('disconnect', {
        terminateDebuggee: false
      });
    });

    it('detachFromProcess should update session state to STOPPED and lifecycle to TERMINATED', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockResolvedValue({});

      await operations.detachFromProcess('test-session', false);

      expect(mockSession.state).toBe(SessionState.STOPPED);
      expect(mockSessionStore.update).toHaveBeenCalledWith('test-session', {
        sessionLifecycle: SessionLifecycleState.TERMINATED
      });
    });

    it('detachFromProcess should handle stop() failure gracefully', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockResolvedValue({});
      mockProxyManager.stop.mockRejectedValue(new Error('Process already gone'));

      const result = await operations.detachFromProcess('test-session', false);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Process already gone');
    });

    it('detachFromProcess should throw SessionNotFoundError for unknown session', async () => {
      mockSessionStore.getOrThrow.mockImplementation(() => {
        throw new SessionNotFoundError('unknown-session');
      });

      await expect(operations.detachFromProcess('unknown-session'))
        .rejects.toThrow(SessionNotFoundError);
    });
  });

  describe('selectPolicy coverage', () => {
    it('should return DotnetAdapterPolicy for dotnet language', () => {
      const policy = (operations as any).selectPolicy('dotnet');
      expect(policy.name).toBe('dotnet');
    });

    it('should return DotnetAdapterPolicy for DebugLanguage.DOTNET', () => {
      const { DebugLanguage } = require('@debugmcp/shared');
      const policy = (operations as any).selectPolicy(DebugLanguage.DOTNET);
      expect(policy.name).toBe('dotnet');
    });

    it('should apply dotnet filtering in getStackTrace for dotnet session', async () => {
      mockSession.language = 'dotnet';
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.isRunning.mockReturnValue(true);
      mockProxyManager.getCurrentThreadId.mockReturnValue(1);
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          stackFrames: [
            { id: 1, name: 'MyApp.Main', line: 10, column: 1, source: { path: '/app/Program.cs' } },
            { id: 2, name: 'System.Runtime.CompilerServices.TaskAwaiter', line: 0, column: 0 },
            { id: 3, name: 'Microsoft.AspNetCore.Hosting', line: 0, column: 0 }
          ]
        }
      });

      const frames = await operations.getStackTrace('test-session', undefined, false);

      // DotnetAdapterPolicy.filterStackFrames filters out frames with no file
      // and frames starting with System.* or Microsoft.*
      expect(frames).toHaveLength(1);
      expect(frames[0].name).toBe('MyApp.Main');
    });
  });

  describe('listThreads', () => {
    it('should return mapped threads from DAP response', async () => {
      mockSession.state = SessionState.RUNNING;
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          threads: [
            { id: 1, name: 'main' },
            { id: 2, name: 'AWT-EventQueue-0' },
          ]
        }
      });

      const threads = await operations.listThreads('test-session');

      expect(threads).toEqual([
        { id: 1, name: 'main' },
        { id: 2, name: 'AWT-EventQueue-0' },
      ]);
      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('threads', {});
    });

    it('should return empty array when DAP response has no threads', async () => {
      mockSession.state = SessionState.RUNNING;
      mockProxyManager.sendDapRequest.mockResolvedValue({});

      const threads = await operations.listThreads('test-session');

      expect(threads).toEqual([]);
    });

    it('should throw SessionTerminatedError for terminated session', async () => {
      mockSession.sessionLifecycle = SessionLifecycleState.TERMINATED;

      await expect(operations.listThreads('test-session'))
        .rejects.toBeInstanceOf(SessionTerminatedError);
    });

    it('should throw ProxyNotRunningError when proxy is not running', async () => {
      mockProxyManager.isRunning.mockReturnValue(false);

      await expect(operations.listThreads('test-session'))
        .rejects.toBeInstanceOf(ProxyNotRunningError);
    });

    it('should throw ProxyNotRunningError when proxy manager is null', async () => {
      mockSession.proxyManager = null;

      await expect(operations.listThreads('test-session'))
        .rejects.toBeInstanceOf(ProxyNotRunningError);
    });
  });

  describe('pause with threadId', () => {
    // pause() waits for the 'stopped' event before resolving, so these tests
    // capture the registered handlers and emit 'stopped' the way the real
    // ProxyManager would (after the core handleStopped listener has already
    // flipped the session state to PAUSED).
    let handlers: Record<string, Function[]>;

    const emit = (event: string, ...args: unknown[]) => {
      (handlers[event] ?? []).forEach(fn => fn(...args));
    };

    const emitStopped = () => {
      mockSession.state = SessionState.PAUSED; // core handleStopped runs first
      emit('stopped', 1, 'pause');
    };

    beforeEach(() => {
      handlers = {};
      mockProxyManager.on.mockImplementation((event: string, handler: Function) => {
        (handlers[event] ??= []).push(handler);
        return mockProxyManager;
      });
    });

    it('should pass specific threadId to DAP request', async () => {
      mockSession.state = SessionState.RUNNING;
      mockProxyManager.sendDapRequest.mockResolvedValue({});

      const promise = operations.pause('test-session', 42);
      await vi.waitFor(() => {
        expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('pause', { threadId: 42 });
      });
      emitStopped();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.PAUSED);
    });

    it('should auto-discover threadId when not provided', async () => {
      mockSession.state = SessionState.RUNNING;
      // First call: threads request returns thread list
      // Second call: pause request
      mockProxyManager.sendDapRequest
        .mockResolvedValueOnce({ body: { threads: [{ id: 7, name: 'Main' }] } })
        .mockResolvedValueOnce({});

      const promise = operations.pause('test-session');
      await vi.waitFor(() => {
        expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('pause', { threadId: 7 });
      });
      emitStopped();
      const result = await promise;

      expect(result.success).toBe(true);
      // Should have called threads first, then pause with discovered threadId
      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('threads', {});
    });

    it('should fall back to threadId=0 when threads request fails', async () => {
      mockSession.state = SessionState.RUNNING;
      // threads request fails, pause succeeds
      mockProxyManager.sendDapRequest
        .mockRejectedValueOnce(new Error('not connected'))
        .mockResolvedValueOnce({});

      const promise = operations.pause('test-session');
      await vi.waitFor(() => {
        expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('pause', { threadId: 0 });
      });
      emitStopped();
      const result = await promise;

      expect(result.success).toBe(true);
    });

    it('should fall back to threadId=0 when threads response has no threads', async () => {
      mockSession.state = SessionState.RUNNING;
      // threads returns empty list, pause succeeds
      mockProxyManager.sendDapRequest
        .mockResolvedValueOnce({ body: { threads: [] } })
        .mockResolvedValueOnce({});

      const promise = operations.pause('test-session');
      await vi.waitFor(() => {
        expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('pause', { threadId: 0 });
      });
      emitStopped();
      const result = await promise;

      expect(result.success).toBe(true);
    });

    it('reports state PAUSED when stopped arrives after the pause response (the common adapter ordering)', async () => {
      mockSession.state = SessionState.RUNNING;
      mockProxyManager.sendDapRequest.mockResolvedValue({});

      const promise = operations.pause('test-session', 1);
      // Let the pause response resolve first — state must still be RUNNING here
      await vi.waitFor(() => {
        expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('pause', { threadId: 1 });
      });
      expect(mockSession.state).toBe(SessionState.RUNNING);
      emitStopped();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.PAUSED);
    });

    it('reports state PAUSED when stopped arrives before the pause response resolves (netcoredbg ordering)', async () => {
      mockSession.state = SessionState.RUNNING;
      // Emit 'stopped' from inside the pause request, before its promise resolves
      mockProxyManager.sendDapRequest.mockImplementation((command: string) => {
        if (command === 'pause') {
          emitStopped();
        }
        return Promise.resolve({});
      });

      const result = await operations.pause('test-session', 1);

      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.PAUSED);
    });

    it('reports state PAUSED when the stop happened during thread discovery (no further event arrives)', async () => {
      mockSession.state = SessionState.RUNNING;
      // The stop lands while awaiting the 'threads' request, before the
      // stopped listeners are registered — the post-response guard covers it.
      mockProxyManager.sendDapRequest.mockImplementation((command: string) => {
        if (command === 'threads') {
          mockSession.state = SessionState.PAUSED;
          return Promise.resolve({ body: { threads: [{ id: 3, name: 'Main' }] } });
        }
        return Promise.resolve({});
      });

      const result = await operations.pause('test-session');

      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.PAUSED);
    });

    it('reports a pending pause when no stopped event arrives within the grace window', async () => {
      vi.useFakeTimers();
      try {
        mockSession.state = SessionState.RUNNING;
        mockProxyManager.sendDapRequest.mockResolvedValue({});

        const promise = operations.pause('test-session', 1);
        await vi.advanceTimersByTimeAsync(5000);
        const result = await promise;

        // A slow pause (e.g. target blocked in native code) is not a failure:
        // the tool reports success with a pending marker; the session flips to
        // PAUSED asynchronously when the stop lands.
        expect(result.success).toBe(true);
        expect(result.state).toBe(SessionState.RUNNING);
        const data = result.data as { message?: string; pending?: boolean };
        expect(data.pending).toBe(true);
        expect(data.message).toContain("no 'stopped' event");
      } finally {
        vi.useRealTimers();
      }
    });

    it('resolves gracefully when the session terminates while waiting', async () => {
      mockSession.state = SessionState.RUNNING;
      mockProxyManager.sendDapRequest.mockResolvedValue({});

      const promise = operations.pause('test-session', 1);
      await vi.waitFor(() => {
        expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('pause', { threadId: 1 });
      });
      emit('terminated');
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data?.message).toContain('Session ended');
    });

    it('rejects when the pause request itself fails', async () => {
      mockSession.state = SessionState.RUNNING;
      mockProxyManager.sendDapRequest.mockImplementation((command: string) => {
        if (command === 'pause') {
          return Promise.reject(new Error('pause not supported'));
        }
        return Promise.resolve({ body: { threads: [{ id: 1, name: 'Main' }] } });
      });

      await expect(operations.pause('test-session', 1)).rejects.toThrow('pause not supported');
    });
  });

  describe('setBreakpoint with suspendPolicy', () => {
    it('should include suspendPolicy in DAP setBreakpoints request', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [{ verified: true, line: 10, id: 1 }]
        }
      });

      await operations.setBreakpoint('test-session', 'test.py', 10, undefined, 'thread');

      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith(
        'setBreakpoints',
        expect.objectContaining({
          breakpoints: expect.arrayContaining([
            expect.objectContaining({ line: 10, suspendPolicy: 'thread' })
          ])
        })
      );
    });

    it('should not include suspendPolicy when not provided', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.sendDapRequest.mockResolvedValue({
        body: {
          breakpoints: [{ verified: true, line: 10, id: 1 }]
        }
      });

      await operations.setBreakpoint('test-session', 'test.py', 10);

      const call = mockProxyManager.sendDapRequest.mock.calls.find(
        (c: any[]) => c[0] === 'setBreakpoints'
      );
      expect(call).toBeDefined();
      const bpArg = call![1].breakpoints[0];
      expect(bpArg).not.toHaveProperty('suspendPolicy');
    });
  });
});
