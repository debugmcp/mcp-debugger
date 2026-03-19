/**
 * Targeted tests to improve coverage for server.ts
 * Focus on error paths and edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebugMcpServer } from '../../src/server';
import { McpError, ErrorCode as McpErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { SessionLifecycleState } from '@debugmcp/shared';
import { SessionTerminatedError, ProxyNotRunningError } from '../../src/errors/debug-errors.js';

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
      getScopes: vi.fn(),
      continue: vi.fn(),
      stepOver: vi.fn(),
      stepInto: vi.fn(),
      stepOut: vi.fn(),
      evaluateExpression: vi.fn(),
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

      await expect(server.setBreakpoint('invalid-session', 'test.py', 10))
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

    it('should handle getStackTrace without current thread', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        proxyManager: { getCurrentThreadId: () => null }
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
      const originalEnv = process.env.MCP_CONTAINER;
      delete process.env.MCP_CONTAINER;
      
      mockSessionManager.adapterRegistry.listLanguages.mockResolvedValue(['python']);

      await expect(server.createDebugSession({
        language: 'javascript' as any
      })).rejects.toThrow("Language 'javascript' is not supported");

      process.env.MCP_CONTAINER = originalEnv;
    });

    it('should allow python in container mode even if not in list', async () => {
      const originalEnv = process.env.MCP_CONTAINER;
      process.env.MCP_CONTAINER = 'true';
      
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

      process.env.MCP_CONTAINER = originalEnv;
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

      await expect(server.setBreakpoint('test-session', '/nonexistent/file.py', 10))
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

      await expect(server.setBreakpoint('test-session', '/path/to/file.py', -1))
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
        id: 'bp-1',
        file: 'com.example.MyClass',
        line: 42,
        verified: true
      });

      const result = await server.setBreakpoint('test-session', 'com.example.MyClass', 42);

      expect(result.verified).toBe(true);
      expect(mockFileChecker.checkExists).not.toHaveBeenCalled();
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith('test-session', 'com.example.MyClass', 42, undefined);
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
        id: 'bp-1',
        file: 'com.example.Outer$Inner',
        line: 10,
        verified: true
      });

      const result = await server.setBreakpoint('test-session', 'com.example.Outer$Inner', 10);

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
        id: 'bp-1',
        file: 'MyClass',
        line: 5,
        verified: true
      });

      const result = await server.setBreakpoint('test-session', 'MyClass', 5);

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
        id: 'bp-1',
        file: '/path/to/MyClass.java',
        line: 10,
        verified: true
      });

      await server.setBreakpoint('test-session', '/path/to/MyClass.java', 10);

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
        id: 'bp-1',
        file: '/path/to/script.py',
        line: 10,
        verified: true
      });

      await server.setBreakpoint('test-session', '/path/to/script.py', 10);

      expect((server as any).fileChecker.checkExists).toHaveBeenCalledWith('/path/to/script.py');
    });

    it('should run file existence check for FQCN-like input when policy does not implement isNonFileSourceIdentifier', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });

      // Non-Java policy (no isNonFileSourceIdentifier) — even "MyClass" gets file-checked
      mockSessionManager.getSessionPolicy.mockReturnValue({});

      (server as any).fileChecker = {
        checkExists: vi.fn().mockResolvedValue({
          exists: false,
          effectivePath: 'MyClass',
          errorMessage: 'File does not exist'
        })
      };

      await expect(server.setBreakpoint('test-session', 'MyClass', 5))
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
      const originalEnv = process.env.MCP_CONTAINER;
      process.env.MCP_CONTAINER = 'true';
      
      mockSessionManager.adapterRegistry.getSupportedLanguages.mockReturnValue(['mock']);
      mockSessionManager.adapterRegistry.listLanguages = undefined;

      const result = await (server as any).getSupportedLanguagesAsync();
      expect(result).toContain('python');
      expect(result).toContain('mock');

      process.env.MCP_CONTAINER = originalEnv;
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

    it('handleListDebugSessions maps active sessions', async () => {
      const now = new Date();
      mockSessionManager.getAllSessions.mockReturnValue([{
        id: 'session-1',
        name: 'Test Session',
        language: 'python',
        state: 'active',
        createdAt: now,
        updatedAt: now
      }]);

      const result = await (server as any).handleListDebugSessions();
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(1);
      expect(payload.sessions[0]).toMatchObject({
        id: 'session-1',
        name: 'Test Session',
        language: 'python'
      });
    });

    it('handlePause throws McpError when session validation fails', async () => {
      mockSessionManager.pause = vi.fn().mockRejectedValue(new Error('some pause error'));
      (server as any).validateSession = vi.fn().mockImplementation(() => { throw new McpError(McpErrorCode.InvalidParams, 'Session not found: test-session'); });

      await expect((server as any).handlePause({ sessionId: 'test-session' })).rejects.toThrow('Session not found');
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
        id: 'bp-1',
        file: 'com.example.Foo',
        line: 10,
        verified: true,
      });

      await server.setBreakpoint('test-session', 'com.example.Foo', 10);

      // Second breakpoint on same file
      mockSessionManager.setBreakpoint.mockResolvedValueOnce({
        id: 'bp-2',
        file: 'com.example.Foo',
        line: 20,
        verified: true,
      });

      await server.setBreakpoint('test-session', 'com.example.Foo', 20);

      // Both calls should have been made
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledTimes(2);
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
        'test-session', 'com.example.Foo', 10, undefined
      );
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
        'test-session', 'com.example.Foo', 20, undefined
      );
    });

    it('should update all breakpoints from DAP response', async () => {
      mockSessionManager.getSession.mockReturnValue(activeSession);
      mockSessionManager.getSessionPolicy.mockReturnValue(javaPolicyMock);

      // Simulate setBreakpoint returning updated breakpoint info
      mockSessionManager.setBreakpoint.mockResolvedValueOnce({
        id: 'bp-1',
        file: 'com.example.Foo',
        line: 10,
        verified: true,
        message: 'Breakpoint set',
      });

      const result = await server.setBreakpoint('test-session', 'com.example.Foo', 10);
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
        id: 'bp-1',
        file: 'com.a.Foo',
        line: 10,
        verified: true,
      });
      await server.setBreakpoint('test-session', 'com.a.Foo', 10);

      // BP on com.b.Foo (different package, same simple name)
      mockSessionManager.setBreakpoint.mockResolvedValueOnce({
        id: 'bp-2',
        file: 'com.b.Foo',
        line: 15,
        verified: true,
      });
      await server.setBreakpoint('test-session', 'com.b.Foo', 15);

      // Both should be set independently
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledTimes(2);
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
        'test-session', 'com.a.Foo', 10, undefined
      );
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
        'test-session', 'com.b.Foo', 15, undefined
      );
    });
  });

  describe('Evaluate Expression Edge Cases', () => {
    it('should handle expression evaluation in terminated session', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.TERMINATED
      });

      const result = await (server as any).handleEvaluateExpression({
        sessionId: 'test-session',
        expression: 'x + 1'
      });

      // The method returns a success response with the error in the content
      expect(result.content[0].text).toContain('Session is terminated');
    });
  });

  describe('handlePause', () => {
    it('returns result on success', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      mockSessionManager.pause = vi.fn().mockResolvedValue({ success: true, state: 'paused' });

      const result = await (server as any).handlePause({ sessionId: 'test-session' });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.state).toBe('paused');
    });

    it('re-throws SessionTerminatedError (extends McpError)', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      mockSessionManager.pause = vi.fn().mockRejectedValue(new SessionTerminatedError('test-session'));

      await expect((server as any).handlePause({ sessionId: 'test-session' }))
        .rejects.toThrow(McpError);
    });

    it('re-throws ProxyNotRunningError (extends McpError)', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      mockSessionManager.pause = vi.fn().mockRejectedValue(new ProxyNotRunningError('test-session'));

      await expect((server as any).handlePause({ sessionId: 'test-session' }))
        .rejects.toThrow(McpError);
    });

    it('wraps generic errors as McpError', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      mockSessionManager.pause = vi.fn().mockRejectedValue(new Error('unexpected'));

      await expect((server as any).handlePause({ sessionId: 'test-session' }))
        .rejects.toThrow('Failed to pause execution');
    });
  });

  describe('handleGetSourceContext', () => {
    beforeEach(() => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
    });

    it('returns source context on success', async () => {
      (server as any).fileChecker = {
        checkExists: vi.fn().mockResolvedValue({ exists: true, effectivePath: '/app/main.py' })
      };
      (server as any).lineReader = {
        getLineContext: vi.fn().mockResolvedValue({
          lineContent: 'print("hello")',
          surrounding: [
            { line: 9, content: 'def main():' },
            { line: 10, content: '    print("hello")' },
            { line: 11, content: '' }
          ]
        })
      };

      const result = await (server as any).handleGetSourceContext({
        sessionId: 'test-session',
        file: '/app/main.py',
        line: 10
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.file).toBe('/app/main.py');
      expect(payload.line).toBe(10);
      expect(payload.lineContent).toBe('print("hello")');
      expect(payload.surrounding).toHaveLength(3);
    });

    it('throws McpError when file not found', async () => {
      (server as any).fileChecker = {
        checkExists: vi.fn().mockResolvedValue({
          exists: false,
          effectivePath: '/missing.py',
          errorMessage: 'ENOENT'
        })
      };

      await expect((server as any).handleGetSourceContext({
        sessionId: 'test-session',
        file: '/missing.py',
        line: 1
      })).rejects.toThrow('Source file');
    });

    it('returns error JSON when file is unreadable', async () => {
      (server as any).fileChecker = {
        checkExists: vi.fn().mockResolvedValue({ exists: true, effectivePath: '/app/binary.dat' })
      };
      (server as any).lineReader = {
        getLineContext: vi.fn().mockResolvedValue(null)
      };

      const result = await (server as any).handleGetSourceContext({
        sessionId: 'test-session',
        file: '/app/binary.dat',
        line: 1
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(false);
      expect(payload.error).toContain('Could not read source context');
    });

    it('uses default context lines when not specified', async () => {
      (server as any).fileChecker = {
        checkExists: vi.fn().mockResolvedValue({ exists: true, effectivePath: '/app/test.py' })
      };
      const getLineContext = vi.fn().mockResolvedValue({
        lineContent: 'x = 1',
        surrounding: []
      });
      (server as any).lineReader = { getLineContext };

      await (server as any).handleGetSourceContext({
        sessionId: 'test-session',
        file: '/app/test.py',
        line: 5
      });

      expect(getLineContext).toHaveBeenCalledWith('/app/test.py', 5, { contextLines: 5 });
    });
  });

  describe('handleGetLocalVariables', () => {
    beforeEach(() => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      mockSessionManager.getLocalVariables = vi.fn();
    });

    it('returns variables with frame and scope info', async () => {
      mockSessionManager.getLocalVariables.mockResolvedValue({
        variables: [{ name: 'x', value: '42' }],
        frame: { name: 'main', file: 'test.py', line: 10 },
        scopeName: 'Locals'
      });

      const result = await (server as any).handleGetLocalVariables({
        sessionId: 'test-session'
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(1);
      expect(payload.variables[0].name).toBe('x');
      expect(payload.frame.name).toBe('main');
      expect(payload.scopeName).toBe('Locals');
    });

    it('shows "not paused" message when no frame available', async () => {
      mockSessionManager.getLocalVariables.mockResolvedValue({
        variables: [],
        frame: null,
        scopeName: null
      });

      const result = await (server as any).handleGetLocalVariables({
        sessionId: 'test-session'
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(0);
      expect(payload.message).toContain('No stack frames available');
    });

    it('shows "no local scope" message when frame exists but no scope', async () => {
      mockSessionManager.getLocalVariables.mockResolvedValue({
        variables: [],
        frame: { name: 'main', file: 'test.py', line: 10 },
        scopeName: null
      });

      const result = await (server as any).handleGetLocalVariables({
        sessionId: 'test-session'
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.message).toContain('No local scope found');
    });

    it('shows "scope is empty" message when scope exists but has no variables', async () => {
      mockSessionManager.getLocalVariables.mockResolvedValue({
        variables: [],
        frame: { name: 'main', file: 'test.py', line: 10 },
        scopeName: 'Locals'
      });

      const result = await (server as any).handleGetLocalVariables({
        sessionId: 'test-session'
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.message).toContain('The Locals scope is empty');
    });

    it('returns graceful JSON for McpError with "not paused"', async () => {
      (server as any).validateSession = vi.fn().mockImplementation(() => {
        throw new McpError(McpErrorCode.InvalidRequest, 'Session is not paused');
      });

      const result = await (server as any).handleGetLocalVariables({
        sessionId: 'test-session'
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(false);
      expect(payload.error).toContain('not paused');
      expect(payload.message).toContain('Cannot get local variables');
    });

    it('wraps generic errors as McpError', async () => {
      mockSessionManager.getLocalVariables.mockRejectedValue(new Error('unexpected'));

      await expect((server as any).handleGetLocalVariables({
        sessionId: 'test-session'
      })).rejects.toThrow('Failed to get local variables');
    });
  });

  describe('handleListSupportedLanguages', () => {
    it('returns installed languages and adapter metadata', async () => {
      const result = await (server as any).handleListSupportedLanguages();
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.installed).toEqual(['python', 'mock']);
      expect(payload.available).toHaveLength(2);
      expect(payload.available[0].language).toBe('python');
      expect(payload.available[0].package).toBe('@debugmcp/adapter-python');
      expect(payload.count).toBe(2);
    });

    it('falls back to installed list when listAvailableAdapters fails', async () => {
      mockSessionManager.adapterRegistry.listAvailableAdapters.mockRejectedValue(
        new Error('metadata unavailable')
      );

      const result = await (server as any).handleListSupportedLanguages();
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.installed).toEqual(['python', 'mock']);
      // available falls back to simple format derived from installed
      expect(payload.available).toHaveLength(2);
      expect(payload.available[0].installed).toBe(true);
    });
  });
});
