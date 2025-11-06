/**
 * Targeted tests to improve coverage for server.ts
 * Focus on error paths and edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebugMcpServer } from '../../src/server';
import { McpError, ErrorCode as McpErrorCode } from '@modelcontextprotocol/sdk/types.js';
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
  });

  describe('Server Lifecycle', () => {
    it('should handle server start', async () => {
      await server.start();
      expect(mockLogger.info).toHaveBeenCalledWith('Debug MCP Server started');
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
      mockSessionManager.stepOver.mockResolvedValue({ success: true });
      mockSessionManager.stepInto.mockResolvedValue({ success: true });
      mockSessionManager.stepOut.mockResolvedValue({ success: true });

      await expect(server.stepOver('test-session')).resolves.toBe(true);
      await expect(server.stepInto('test-session')).resolves.toBe(true);
      await expect(server.stepOut('test-session')).resolves.toBe(true);
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

    it('handlePause surfaces standardized error response', async () => {
      await expect((server as any).handlePause({ sessionId: 'test-session' })).rejects.toThrow('Pause execution not yet implemented with proxy.');
      expect(mockLogger.info).toHaveBeenCalledWith('Pause requested for session: test-session');
      expect(mockLogger.error).toHaveBeenCalled();
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
});
