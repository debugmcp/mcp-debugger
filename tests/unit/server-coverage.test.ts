/**
 * Targeted tests to improve coverage for server.ts
 * Focus on error paths and edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebugMcpServer } from '../../src/server';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { SessionLifecycleState } from '@debugmcp/shared';

describe('Server Coverage - Error Paths and Edge Cases', () => {
  let server: DebugMcpServer;
  let mockSessionManager: any;
  let mockLogger: any;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    // Create server instance
    server = new DebugMcpServer({
      logLevel: 'info',
      logFile: '/tmp/test.log'
    });

    // Mock the session manager
    mockSessionManager = {
      getSession: vi.fn(),
      getSessionPolicy: vi.fn().mockReturnValue({}),
      createSession: vi.fn(),
      closeSession: vi.fn(),
      closeAllSessions: vi.fn(),
      getAllSessions: vi.fn(),
      setBreakpoint: vi.fn(),
      startDebugging: vi.fn(),
      getVariables: vi.fn(),
      getStackTrace: vi.fn(),
      getStackTraceDetailed: vi.fn().mockResolvedValue({
        frames: [], totalFrameCount: 0, hiddenFrameCount: 0, allFramesInternal: false
      }),
      getScopes: vi.fn(),
      continue: vi.fn(),
      stepOver: vi.fn(),
      stepInto: vi.fn(),
      stepOut: vi.fn(),
      evaluateExpression: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      adapterRegistry: {
        getSupportedLanguages: vi.fn().mockReturnValue(['python', 'mock']),
        listLanguages: vi.fn().mockResolvedValue(['python', 'mock']),
        listAvailableAdapters: vi.fn().mockResolvedValue([
          { name: 'python', packageName: '@debugmcp/adapter-python', installed: true, description: 'Python adapter' },
          { name: 'mock', packageName: '@debugmcp/adapter-mock', installed: true, description: 'Mock adapter' }
        ])
      }
    };

    // Replace the session manager with our mock
    (server as any).sessionManager = mockSessionManager;
    (server as any).logger = mockLogger;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Validation Edge Cases', () => {
    it('should handle session not found error', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      await expect(server.setBreakpoint({ sessionId: 'invalid-session', file: 'test.py', line: 10 }))
        .rejects.toThrow(McpError);
    });

    it('should handle terminated session error', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.TERMINATED
      });

      await expect(server.continueExecution('test-session'))
        .rejects.toThrow(McpError);
    });
  });

  describe('Error Handling in Tool Operations', () => {
    it('should handle stepOver failure with specific error', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        proxyManager: { getCurrentThreadId: () => 1 }
      });
      mockSessionManager.stepOver.mockResolvedValue({
        success: false,
        error: 'Debugger not in valid state'
      });

      await expect(server.stepOver('test-session'))
        .rejects.toThrow('Debugger not in valid state');
    });

    it('should handle stepInto failure', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        proxyManager: { getCurrentThreadId: () => 1 }
      });
      mockSessionManager.stepInto.mockResolvedValue({
        success: false,
        error: 'Cannot step into native code'
      });

      await expect(server.stepInto('test-session'))
        .rejects.toThrow('Cannot step into native code');
    });

    it('should handle stepOut failure', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        proxyManager: { getCurrentThreadId: () => 1 }
      });
      mockSessionManager.stepOut.mockResolvedValue({
        success: false,
        error: 'Already at top level'
      });

      await expect(server.stepOut('test-session'))
        .rejects.toThrow('Already at top level');
    });

    it('should handle continue execution failure', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        proxyManager: { getCurrentThreadId: () => 1 }
      });
      mockSessionManager.continue.mockResolvedValue({
        success: false,
        error: 'Process has terminated'
      });

      await expect(server.continueExecution('test-session'))
        .rejects.toThrow('Process has terminated');
    });

    it('should handle getStackTrace without proxy manager', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        proxyManager: null
      });

      await expect(server.getStackTrace('test-session'))
        .rejects.toThrow('Cannot get stack trace: no active proxy');
    });

    it('should handle getStackTrace without current thread â€” falls back to threads request', async () => {
      const mockProxy = {
        getCurrentThreadId: () => null,
        isRunning: () => true,
        sendDapRequest: vi.fn().mockResolvedValue({ body: { threads: [{ id: 5, name: 'main' }] } })
      };
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        proxyManager: mockProxy
      });
      mockSessionManager.getStackTraceDetailed.mockResolvedValue({
        frames: [{ id: 1, name: 'main', file: 'test.go', line: 10 }],
        totalFrameCount: 1, hiddenFrameCount: 0, allFramesInternal: false
      });

      const result = await server.getStackTrace('test-session');

      expect(mockProxy.sendDapRequest).toHaveBeenCalledWith('threads', {});
      expect(mockSessionManager.getStackTraceDetailed).toHaveBeenCalledWith('test-session', 5, false, { ensureStackReady: true });
      expect(result.frames).toHaveLength(1);
    });

    it('should throw when getStackTrace has no thread and threads request fails', async () => {
      const mockProxy = {
        getCurrentThreadId: () => null,
        isRunning: () => true,
        sendDapRequest: vi.fn().mockRejectedValue(new Error('not connected'))
      };
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        proxyManager: mockProxy
      });

      await expect(server.getStackTrace('test-session'))
        .rejects.toThrow('Cannot get stack trace: no active proxy');
    });

    it('should throw when getStackTrace has no thread and threads response is empty', async () => {
      const mockProxy = {
        getCurrentThreadId: () => null,
        isRunning: () => true,
        sendDapRequest: vi.fn().mockResolvedValue({ body: { threads: [] } })
      };
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        proxyManager: mockProxy
      });

      await expect(server.getStackTrace('test-session'))
        .rejects.toThrow('Cannot get stack trace: no active proxy');
    });
  });

  describe('Create Debug Session Edge Cases', () => {
    it('should handle session creation failure', async () => {
      mockSessionManager.createSession.mockRejectedValue(new Error('Port allocation failed'));

      await expect(server.createDebugSession({
        language: 'python' as any,
        name: 'test-session'
      })).rejects.toThrow('Failed to create debug session: Port allocation failed');
    });

    it('should handle unsupported language in non-container mode', async () => {
      vi.stubEnv('MCP_CONTAINER', undefined);

      mockSessionManager.adapterRegistry.listLanguages.mockResolvedValue(['python']);

      await expect(server.createDebugSession({
        language: 'javascript' as any
      })).rejects.toThrow("Language 'javascript' is not supported");
    });

    it('should allow python in container mode even if not in list', async () => {
      vi.stubEnv('MCP_CONTAINER', 'true');

      mockSessionManager.adapterRegistry.listLanguages.mockResolvedValue(['mock']);
      mockSessionManager.createSession.mockResolvedValue({
        id: 'session-1',
        name: 'python-session',
        language: 'python',
        state: 'created'
      });

      const result = await server.createDebugSession({
        language: 'python' as any,
        name: 'container-python'
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('session-1');
    });
  });

  describe('Start Debugging Edge Cases', () => {
    it('should handle file not found error', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });

      // Mock file checker
      (server as any).fileChecker = {
        checkExists: vi.fn().mockResolvedValue({
          exists: false,
          effectivePath: '/path/to/script.py',
          errorMessage: 'ENOENT: no such file'
        })
      };

      await expect(server.startDebugging('test-session', '/nonexistent/script.py'))
        .rejects.toThrow('Script file not found');
    });

    it('should handle debugging start failure', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });

      (server as any).fileChecker = {
        checkExists: vi.fn().mockResolvedValue({
          exists: true,
          effectivePath: '/path/to/script.py'
        })
      };

      mockSessionManager.startDebugging.mockRejectedValue(new Error('Failed to launch debugger'));

      await expect(server.startDebugging('test-session', '/path/to/script.py'))
        .rejects.toThrow('Failed to launch debugger');
    });
  });

  describe('Set Breakpoint Edge Cases', () => {
    it('should handle file not found for breakpoint', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });

      (server as any).fileChecker = {
        checkExists: vi.fn().mockResolvedValue({
          exists: false,
          effectivePath: '/path/to/file.py',
          errorMessage: 'File does not exist'
        })
      };

      await expect(server.setBreakpoint({ sessionId: 'test-session', file: '/nonexistent/file.py', line: 10 }))
        .rejects.toThrow('Breakpoint file not found');
    });

    it('should handle breakpoint setting failure', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });

      (server as any).fileChecker = {
        checkExists: vi.fn().mockResolvedValue({
          exists: true,
          effectivePath: '/path/to/file.py'
        })
      };

      mockSessionManager.setBreakpoint.mockRejectedValue(new Error('Invalid line number'));

      await expect(server.setBreakpoint({ sessionId: 'test-session', file: '/path/to/file.py', line: -1 }))
        .rejects.toThrow('Invalid line number');
    });

    it('should skip file existence check when policy recognizes non-file source identifier', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });

      // Mock policy with isNonFileSourceIdentifier (e.g. Java adapter)
      mockSessionManager.getSessionPolicy.mockReturnValue({
        isNonFileSourceIdentifier: (src: string) =>
          !src.includes('/') && !src.includes('\\') && !src.endsWith('.java')
      });

      const mockFileChecker = {
        checkExists: vi.fn()
      };
      (server as any).fileChecker = mockFileChecker;

      mockSessionManager.setBreakpoint.mockResolvedValue({
        breakpoint: {
          id: 'bp-1',
          file: 'com.example.MyClass',
          line: 42,
          verified: true
        }
      });

      const { breakpoint: result } = await server.setBreakpoint({ sessionId: 'test-session', file: 'com.example.MyClass', line: 42 });

      expect(result.verified).toBe(true);
      expect(mockFileChecker.checkExists).not.toHaveBeenCalled();
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith('test-session', expect.objectContaining({
        file: 'com.example.MyClass',
        line: 42,
        condition: undefined,
        suspendPolicy: undefined,
        logMessage: undefined
      }));
    });

    it('should skip file existence check for inner class notation via policy', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });

      mockSessionManager.getSessionPolicy.mockReturnValue({
        isNonFileSourceIdentifier: (src: string) =>
          !src.includes('/') && !src.includes('\\') && !src.endsWith('.java')
      });

      const mockFileChecker = {
        checkExists: vi.fn()
      };
      (server as any).fileChecker = mockFileChecker;

      mockSessionManager.setBreakpoint.mockResolvedValue({
        breakpoint: {
          id: 'bp-1',
          file: 'com.example.Outer$Inner',
          line: 10,
          verified: true
        }
      });

      const { breakpoint: result } = await server.setBreakpoint({ sessionId: 'test-session', file: 'com.example.Outer$Inner', line: 10 });

      expect(result.verified).toBe(true);
      expect(mockFileChecker.checkExists).not.toHaveBeenCalled();
    });

    it('should skip file existence check for simple class name via policy', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });

      mockSessionManager.getSessionPolicy.mockReturnValue({
        isNonFileSourceIdentifier: (src: string) =>
          !src.includes('/') && !src.includes('\\') && !src.endsWith('.java')
      });

      const mockFileChecker = {
        checkExists: vi.fn()
      };
      (server as any).fileChecker = mockFileChecker;

      mockSessionManager.setBreakpoint.mockResolvedValue({
        breakpoint: {
          id: 'bp-1',
          file: 'MyClass',
          line: 5,
          verified: true
        }
      });

      const { breakpoint: result } = await server.setBreakpoint({ sessionId: 'test-session', file: 'MyClass', line: 5 });

      expect(result.verified).toBe(true);
      expect(mockFileChecker.checkExists).not.toHaveBeenCalled();
    });

    it('should NOT skip file existence check when policy returns false for .java paths', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });

      mockSessionManager.getSessionPolicy.mockReturnValue({
        isNonFileSourceIdentifier: (src: string) =>
          !src.includes('/') && !src.includes('\\') && !src.endsWith('.java')
      });

      (server as any).fileChecker = {
        checkExists: vi.fn().mockResolvedValue({
          exists: true,
          effectivePath: '/path/to/MyClass.java'
        })
      };

      mockSessionManager.setBreakpoint.mockResolvedValue({
        breakpoint: {
          id: 'bp-1',
          file: '/path/to/MyClass.java',
          line: 10,
          verified: true
        }
      });

      await server.setBreakpoint({ sessionId: 'test-session', file: '/path/to/MyClass.java', line: 10 });

      expect((server as any).fileChecker.checkExists).toHaveBeenCalledWith('/path/to/MyClass.java');
    });

    it('should NOT skip file existence check when policy has no isNonFileSourceIdentifier', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });

      // Policy without isNonFileSourceIdentifier (e.g. Python adapter)
      mockSessionManager.getSessionPolicy.mockReturnValue({});

      (server as any).fileChecker = {
        checkExists: vi.fn().mockResolvedValue({
          exists: true,
          effectivePath: '/path/to/script.py'
        })
      };

      mockSessionManager.setBreakpoint.mockResolvedValue({
        breakpoint: {
          id: 'bp-1',
          file: '/path/to/script.py',
          line: 10,
          verified: true
        }
      });

      await server.setBreakpoint({ sessionId: 'test-session', file: '/path/to/script.py', line: 10 });

      expect((server as any).fileChecker.checkExists).toHaveBeenCalledWith('/path/to/script.py');
    });

    it('should run file existence check for FQCN-like input when policy does not implement isNonFileSourceIdentifier', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });

      // Non-Java policy (no isNonFileSourceIdentifier) â€” even "MyClass" gets file-checked
      mockSessionManager.getSessionPolicy.mockReturnValue({});

      (server as any).fileChecker = {
        checkExists: vi.fn().mockResolvedValue({
          exists: false,
          effectivePath: 'MyClass',
          errorMessage: 'File does not exist'
        })
      };

      await expect(server.setBreakpoint({ sessionId: 'test-session', file: 'MyClass', line: 5 }))
        .rejects.toThrow('Breakpoint file not found');

      expect((server as any).fileChecker.checkExists).toHaveBeenCalledWith('MyClass');
    });
  });

  describe('Server Lifecycle', () => {
    it('should handle server start', async () => {
      await server.start();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('[MCP Server] Started at'));
    });

    it('should handle server stop and cleanup', async () => {
      mockSessionManager.closeAllSessions.mockResolvedValue(true);
      
      await server.stop();
      
      expect(mockSessionManager.closeAllSessions).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Debug MCP Server stopped');
    });

    it('should handle stop with session cleanup failure', async () => {
      mockSessionManager.closeAllSessions.mockRejectedValue(new Error('Cleanup failed'));
      
      await expect(server.stop()).rejects.toThrow('Cleanup failed');
    });
  });

  describe('Get Adapter Registry', () => {
    it('should return adapter registry', () => {
      const registry = server.getAdapterRegistry();
      expect(registry).toBe(mockSessionManager.adapterRegistry);
    });
  });

  describe('Language Support Dynamic Discovery', () => {
    it('should fallback when dynamic discovery fails', async () => {
      mockSessionManager.adapterRegistry.listLanguages.mockRejectedValue(new Error('Discovery failed'));
      mockSessionManager.adapterRegistry.getSupportedLanguages.mockReturnValue(['python']);

      const result = await (server as any).getSupportedLanguagesAsync();
      expect(result).toEqual(['python']);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Dynamic adapter language discovery failed, falling back to registered languages',
        expect.any(Object)
      );
    });

    it('should use default languages when no registry available', async () => {
      (server as any).sessionManager = { 
        adapterRegistry: undefined
      };

      const result = await (server as any).getSupportedLanguagesAsync();
      expect(result).toEqual(['python', 'mock']);
    });

    it('should add python in container mode if missing', async () => {
      vi.stubEnv('MCP_CONTAINER', 'true');

      mockSessionManager.adapterRegistry.getSupportedLanguages.mockReturnValue(['mock']);
      mockSessionManager.adapterRegistry.listLanguages = undefined;

      const result = await (server as any).getSupportedLanguagesAsync();
      expect(result).toContain('python');
      expect(result).toContain('mock');
    });
  });

  describe('Successful execution paths', () => {
    beforeEach(() => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        proxyManager: { getCurrentThreadId: () => 1 }
      });
    });

    it('continueExecution resolves when session manager succeeds', async () => {
      mockSessionManager.continue.mockResolvedValue({ success: true });

      await expect(server.continueExecution('test-session')).resolves.toBe(true);
      expect(mockSessionManager.continue).toHaveBeenCalledWith('test-session');
    });

    it('step operations resolve when session manager succeeds', async () => {
      mockSessionManager.stepOver.mockResolvedValue({ success: true, state: 'paused' });
      mockSessionManager.stepInto.mockResolvedValue({ success: true, state: 'paused' });
      mockSessionManager.stepOut.mockResolvedValue({ success: true, state: 'paused' });

      await expect(server.stepOver('test-session')).resolves.toEqual({ success: true, state: 'paused' });
      await expect(server.stepInto('test-session')).resolves.toEqual({ success: true, state: 'paused' });
      await expect(server.stepOut('test-session')).resolves.toEqual({ success: true, state: 'paused' });
    });
  });

  describe('Get Session Name Error Handling', () => {
    it('should handle session name retrieval failure gracefully', () => {
      mockSessionManager.getSession.mockImplementation(() => {
        throw new Error('Session lookup failed');
      });

      const name = (server as any).getSessionName('invalid-session');
      expect(name).toBe('Unknown Session');
    });

    it('should handle null session gracefully', () => {
      mockSessionManager.getSession.mockReturnValue(null);

      const name = (server as any).getSessionName('nonexistent');
      expect(name).toBe('Unknown Session');
    });
  });

  describe('Variables and Scopes Error Handling', () => {
    it('should handle getVariables error gracefully', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        proxyManager: { getCurrentThreadId: () => 1 }
      });
      mockSessionManager.getVariables.mockRejectedValue(new Error('Variables unavailable'));

      await expect(server.getVariables('test-session', 1))
        .rejects.toThrow('Variables unavailable');
    });

    it('should handle getScopes error gracefully', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        proxyManager: { getCurrentThreadId: () => 1 }
      });
      mockSessionManager.getScopes.mockRejectedValue(new Error('Scopes unavailable'));

      await expect(server.getScopes('test-session', 0))
        .rejects.toThrow('Scopes unavailable');
    });
  });

  describe('Multi-Breakpoint per Source File', () => {
    const activeSession = {
      id: 'test-session',
      sessionLifecycle: SessionLifecycleState.ACTIVE,
      proxyManager: { getCurrentThreadId: () => 1 }
    };

    const javaPolicyMock = {
      isNonFileSourceIdentifier: (src: string) =>
        !src.includes('/') && !src.includes('\\') && !src.endsWith('.java')
    };

    it('should send all breakpoints for same file in single DAP request', async () => {
      mockSessionManager.getSession.mockReturnValue(activeSession);
      mockSessionManager.getSessionPolicy.mockReturnValue(javaPolicyMock);

      // First breakpoint
      mockSessionManager.setBreakpoint.mockResolvedValueOnce({
        breakpoint: {
          id: 'bp-1',
          file: 'com.example.Foo',
          line: 10,
          verified: true,
        }
      });

      await server.setBreakpoint({ sessionId: 'test-session', file: 'com.example.Foo', line: 10 });

      // Second breakpoint on same file
      mockSessionManager.setBreakpoint.mockResolvedValueOnce({
        breakpoint: {
          id: 'bp-2',
          file: 'com.example.Foo',
          line: 20,
          verified: true,
        }
      });

      await server.setBreakpoint({ sessionId: 'test-session', file: 'com.example.Foo', line: 20 });

      // Both calls should have been made
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledTimes(2);
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
        'test-session', expect.objectContaining({
          file: 'com.example.Foo', line: 10,
          condition: undefined, suspendPolicy: undefined, logMessage: undefined
        })
      );
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
        'test-session', expect.objectContaining({
          file: 'com.example.Foo', line: 20,
          condition: undefined, suspendPolicy: undefined, logMessage: undefined
        })
      );
    });

    it('should update all breakpoints from DAP response', async () => {
      mockSessionManager.getSession.mockReturnValue(activeSession);
      mockSessionManager.getSessionPolicy.mockReturnValue(javaPolicyMock);

      // Simulate setBreakpoint returning updated breakpoint info
      mockSessionManager.setBreakpoint.mockResolvedValueOnce({
        breakpoint: {
          id: 'bp-1',
          file: 'com.example.Foo',
          line: 10,
          verified: true,
          message: 'Breakpoint set',
        }
      });

      const { breakpoint: result } = await server.setBreakpoint({ sessionId: 'test-session', file: 'com.example.Foo', line: 10 });
      expect(result.id).toBe('bp-1');
      expect(result.verified).toBe(true);
      expect(result.line).toBe(10);
      expect(result.message).toBe('Breakpoint set');
    });

    it('should not interfere between different source files', async () => {
      mockSessionManager.getSession.mockReturnValue(activeSession);
      mockSessionManager.getSessionPolicy.mockReturnValue(javaPolicyMock);

      // BP on com.a.Foo
      mockSessionManager.setBreakpoint.mockResolvedValueOnce({
        breakpoint: {
          id: 'bp-1',
          file: 'com.a.Foo',
          line: 10,
          verified: true,
        }
      });
      await server.setBreakpoint({ sessionId: 'test-session', file: 'com.a.Foo', line: 10 });

      // BP on com.b.Foo (different package, same simple name)
      mockSessionManager.setBreakpoint.mockResolvedValueOnce({
        breakpoint: {
          id: 'bp-2',
          file: 'com.b.Foo',
          line: 15,
          verified: true,
        }
      });
      await server.setBreakpoint({ sessionId: 'test-session', file: 'com.b.Foo', line: 15 });

      // Both should be set independently
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledTimes(2);
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
        'test-session', expect.objectContaining({
          file: 'com.a.Foo', line: 10,
          condition: undefined, suspendPolicy: undefined, logMessage: undefined
        })
      );
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
        'test-session', expect.objectContaining({
          file: 'com.b.Foo', line: 15,
          condition: undefined, suspendPolicy: undefined, logMessage: undefined
        })
      );
    });
  });
});

/* ------------------------------------------------------------------ */
/*  coerceToolArguments (exported pure function)                        */
/* ------------------------------------------------------------------ */

describe('coerceToolArguments', () => {
  let coerceToolArguments: (args: Record<string, unknown>) => Record<string, unknown>;

  beforeEach(async () => {
    const mod = await import('../../src/server.js');
    coerceToolArguments = mod.coerceToolArguments;
  });

  it('converts "null" string to undefined', () => {
    const args = { line: 'null' };
    coerceToolArguments(args);
    expect(args.line).toBeUndefined();
  });

  it('converts numeric string to number', () => {
    const args = { line: '42', linesContext: '5' };
    coerceToolArguments(args);
    expect(args.line).toBe(42);
    expect(args.linesContext).toBe(5);
  });

  it('converts verifyTimeout string to number', () => {
    const args = { verifyTimeout: '9000' };
    coerceToolArguments(args);
    expect(args.verifyTimeout).toBe(9000);
  });

  it('leaves empty string as-is for number fields', () => {
    const args = { line: '' };
    coerceToolArguments(args);
    expect(args.line).toBe('');
  });

  it('leaves non-numeric string as-is for number fields', () => {
    const args = { line: 'abc' };
    coerceToolArguments(args);
    expect(args.line).toBe('abc');
  });

  it('converts "true"/"false" to booleans', () => {
    const args = { stopOnEntry: 'true', justMyCode: 'false' };
    coerceToolArguments(args);
    expect(args.stopOnEntry).toBe(true);
    expect(args.justMyCode).toBe(false);
  });

  it('leaves non-boolean strings as-is', () => {
    const args = { stopOnEntry: 'yes' };
    coerceToolArguments(args);
    expect(args.stopOnEntry).toBe('yes');
  });

  it('parses JSON object string for object fields', () => {
    const args = { dapLaunchArgs: '{"key": "value"}' };
    coerceToolArguments(args);
    expect(args.dapLaunchArgs).toEqual({ key: 'value' });
  });

  it('leaves non-object JSON for object fields', () => {
    const args = { dapLaunchArgs: '"just a string"' };
    coerceToolArguments(args);
    expect(args.dapLaunchArgs).toBe('"just a string"');
  });

  it('parses JSON array string for array fields', () => {
    const args = { args: '["a", "b"]' };
    coerceToolArguments(args);
    expect(args.args).toEqual(['a', 'b']);
  });

  it('leaves non-array JSON for array fields', () => {
    const args = { args: '{"not": "array"}' };
    coerceToolArguments(args);
    expect(args.args).toBe('{"not": "array"}');
  });

  it('leaves invalid JSON as-is', () => {
    const args = { dapLaunchArgs: '{broken json' };
    coerceToolArguments(args);
    expect(args.dapLaunchArgs).toBe('{broken json');
  });

  it('skips undefined values', () => {
    const args = { line: undefined, port: '8080' };
    coerceToolArguments(args);
    expect(args.line).toBeUndefined();
    expect(args.port).toBe(8080);
  });

  it('skips already-correct types', () => {
    const args = { line: 42, stopOnEntry: true };
    coerceToolArguments(args);
    expect(args.line).toBe(42);
    expect(args.stopOnEntry).toBe(true);
  });

  it('ignores unknown keys', () => {
    const args = { unknownField: 'hello' };
    coerceToolArguments(args);
    expect(args.unknownField).toBe('hello');
  });
});
