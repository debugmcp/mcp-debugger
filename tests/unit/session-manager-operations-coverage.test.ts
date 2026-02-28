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
  protected async handleAutoContinue(): Promise<void> {
    // no-op for tests
  }
}
import { DebugProtocol } from '@vscode/debugprotocol';
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
      const originalCI = process.env.CI;
      const originalGitHub = process.env.GITHUB_ACTIONS;
      process.env.CI = 'true';
      delete process.env.GITHUB_ACTIONS;

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

      try {
        await (operations as any).startProxyManager(
          mockSession,
          'script.py',
          scriptArgs,
          dapArgs,
          false
        );
      } finally {
        if (originalCI === undefined) {
          delete process.env.CI;
        } else {
          process.env.CI = originalCI;
        }
        if (originalGitHub === undefined) {
          delete process.env.GITHUB_ACTIONS;
        } else {
          process.env.GITHUB_ACTIONS = originalGitHub;
        }
      }

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

  describe('Start Debugging Error Scenarios', () => {
    it('should return timeout result when dry run never completes', async () => {
      const originalCI = process.env.CI;
      const originalGitHub = process.env.GITHUB_ACTIONS;
      process.env.CI = 'true';
      delete process.env.GITHUB_ACTIONS;

      const dryRunProxy = {
        ...mockProxyManager,
        hasDryRunCompleted: vi.fn().mockReturnValue(false),
        getDryRunSnapshot: vi.fn().mockReturnValue({ command: 'python -m debugpy', script: 'dry-run.py' })
      };
      mockSession.proxyManager = dryRunProxy;
      mockSession.state = SessionState.INITIALIZING;

      vi.spyOn(operations as any, 'startProxyManager').mockResolvedValue(undefined);
      vi.spyOn(operations as any, 'waitForDryRunCompletion').mockResolvedValue(false);

      let result;
      try {
        result = await operations.startDebugging('test-session', 'dry-run.py', undefined, undefined, true);
      } finally {
        if (originalCI === undefined) {
          delete process.env.CI;
        } else {
          process.env.CI = originalCI;
        }
        if (originalGitHub === undefined) {
          delete process.env.GITHUB_ACTIONS;
        } else {
          process.env.GITHUB_ACTIONS = originalGitHub;
        }
      }

      expect((operations as any).startProxyManager).toHaveBeenCalledTimes(1);
      expect((operations as any).waitForDryRunCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'test-session' }),
        expect.any(Number)
      );
      expect(result!.success).toBe(false);
      expect(result!.error).toContain('Dry run timed out');
    });

    it('returns success immediately when dry run already completed', async () => {
      const originalCI = process.env.CI;
      const originalGitHub = process.env.GITHUB_ACTIONS;
      process.env.CI = 'true';
      delete process.env.GITHUB_ACTIONS;

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

      let result;
      try {
        result = await operations.startDebugging('test-session', 'dry-run.py', undefined, undefined, true);
      } finally {
        if (originalCI === undefined) {
          delete process.env.CI;
        } else {
          process.env.CI = originalCI;
        }
        if (originalGitHub === undefined) {
          delete process.env.GITHUB_ACTIONS;
        } else {
          process.env.GITHUB_ACTIONS = originalGitHub;
        }
      }

      expect(result!.success).toBe(true);
      expect(result!.state).toBe(SessionState.STOPPED);
      expect(result!.data?.dryRun).toBe(true);
      expect(dryRunProxy.getDryRunSnapshot).toHaveBeenCalled();
      expect(waitSpy).not.toHaveBeenCalled();
    });

    it('should handle startDebugging with proxy creation failure', async () => {
      const originalCI = process.env.CI;
      const originalGitHub = process.env.GITHUB_ACTIONS;
      process.env.CI = 'true';
      delete process.env.GITHUB_ACTIONS;

      mockDependencies.proxyManagerFactory.create.mockImplementation(() => {
        throw new Error('Port allocation failed');
      });

      let result;
      try {
        result = await operations.startDebugging('test-session', 'test.py');
      } finally {
        if (originalCI === undefined) {
          delete process.env.CI;
        } else {
          process.env.CI = originalCI;
        }
        if (originalGitHub === undefined) {
          delete process.env.GITHUB_ACTIONS;
        } else {
          process.env.GITHUB_ACTIONS = originalGitHub;
        }
      }
      
      expect(result!.success).toBe(false);
      expect(result!.error).toContain('Port allocation failed');
    });

    it('should handle startDebugging with launch failure', async () => {
      const originalCI = process.env.CI;
      const originalGitHub = process.env.GITHUB_ACTIONS;
      process.env.CI = 'true';
      delete process.env.GITHUB_ACTIONS;

      mockProxyManager.start.mockRejectedValue(new Error('Failed to launch debuggee'));

      let result;
      try {
        result = await operations.startDebugging('test-session', 'test.py');
      } finally {
        if (originalCI === undefined) {
          delete process.env.CI;
        } else {
          process.env.CI = originalCI;
        }
        if (originalGitHub === undefined) {
          delete process.env.GITHUB_ACTIONS;
        } else {
          process.env.GITHUB_ACTIONS = originalGitHub;
        }
      }
      
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
      const originalCI = process.env.CI;
      const originalGitHub = process.env.GITHUB_ACTIONS;
      process.env.CI = 'true';
      delete process.env.GITHUB_ACTIONS;

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
        if (originalCI === undefined) {
          delete process.env.CI;
        } else {
          process.env.CI = originalCI;
        }
        if (originalGitHub === undefined) {
          delete process.env.GITHUB_ACTIONS;
        } else {
          process.env.GITHUB_ACTIONS = originalGitHub;
        }
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
      const originalCI = process.env.CI;
      const originalGitHub = process.env.GITHUB_ACTIONS;
      process.env.CI = 'true';
      delete process.env.GITHUB_ACTIONS;

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
        if (originalCI === undefined) {
          delete process.env.CI;
        } else {
          process.env.CI = originalCI;
        }
        if (originalGitHub === undefined) {
          delete process.env.GITHUB_ACTIONS;
        } else {
          process.env.GITHUB_ACTIONS = originalGitHub;
        }
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
    it('continues execution without forcing session into RUNNING state immediately', async () => {
      mockSession.state = SessionState.PAUSED;
      mockProxyManager.isRunning.mockReturnValue(true);
      mockProxyManager.getCurrentThreadId.mockReturnValue(7);
      mockProxyManager.sendDapRequest.mockResolvedValue(undefined);

      const result = await operations.continue('test-session');

      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('continue', { threadId: 7 });
      expect(result.success).toBe(true);
      expect(mockSessionStore.updateState).not.toHaveBeenCalledWith('test-session', SessionState.RUNNING);
      expect(mockSession.state).toBe(SessionState.PAUSED);
    });
  });

  describe('waitForInitialBreakpointPause behaviour', () => {
    it('returns false when no proxy manager present', async () => {
      mockSession.proxyManager = undefined;
      const result = await (operations as any).waitForInitialBreakpointPause('test-session', 200);
      expect(result).toBe(false);
    });

    it('returns true immediately when session already paused', async () => {
      mockSession.state = SessionState.PAUSED;
      const result = await (operations as any).waitForInitialBreakpointPause('test-session', 200);
      expect(result).toBe(true);
    });

    it('resolves true when stopped event fires before timeout', async () => {
      let captured: (() => void) | undefined;
      mockProxyManager.once.mockImplementation((event: string, handler: () => void) => {
        if (event === 'stopped') {
          captured = handler;
        }
        return mockProxyManager;
      });
      mockProxyManager.removeListener.mockReturnValue(mockProxyManager);

      const waitPromise = (operations as any).waitForInitialBreakpointPause('test-session', 500);
      expect(captured).toBeDefined();
      captured?.();
      const result = await waitPromise;
      expect(result).toBe(true);
    });

    it('resolves false when timeout elapses without event', async () => {
      vi.useFakeTimers();
      mockProxyManager.once.mockImplementation(() => mockProxyManager);
      mockProxyManager.removeListener.mockReturnValue(mockProxyManager);

      const waitPromise = (operations as any).waitForInitialBreakpointPause('test-session', 300);
      await vi.advanceTimersByTimeAsync(350);
      const result = await waitPromise;
      expect(result).toBe(false);
      vi.useRealTimers();
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
});
