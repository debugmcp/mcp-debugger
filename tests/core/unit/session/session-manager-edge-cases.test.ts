/**
 * SessionManager edge cases and error scenarios tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '../../../../src/session/models.js';
import { createMockDependencies } from './session-manager-test-utils.js';

describe('SessionManager - Edge Cases and Error Scenarios', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  let config: SessionManagerConfig;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    config = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: {
        stopOnEntry: true,
        justMyCode: true
      }
    };
    
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  describe('Session Creation Edge Cases', () => {
    it('should use provided executable path', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.executablePath).toBe('python');
    });

    it('should generate unique session IDs', async () => {
      const sessions = await Promise.all([
        sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' }),
        sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' }),
        sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' })
      ]);
      
      const ids = sessions.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should set default session name if not provided', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      // SessionStore generates IDs like 'session-<short-uuid>'
      expect(session.name).toMatch(/session-[a-f0-9]+/);
    });
  });

  describe('Continue Method Error Handling', () => {
    it('should throw error when continue DAP request fails', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Simulate being paused
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      
      // Configure mock to fail on continue request
      dependencies.mockProxyManager.sendDapRequest = vi.fn().mockRejectedValue(new Error('DAP request failed'));
      
      // Should throw the error (line 595)
      await expect(sessionManager.continue(session.id)).rejects.toThrow('DAP request failed');
    });
  });

  describe('Error Scenarios in DAP Operations', () => {
    it('should handle errors in getVariables gracefully', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Pause the session
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      
      // Configure mock to throw error
      dependencies.mockProxyManager.sendDapRequest = vi.fn().mockRejectedValue(new Error('Network error'));
      
      // Should return empty array and log error (lines 653-655)
      const variables = await sessionManager.getVariables(session.id, 100);
      expect(variables).toEqual([]);
      expect(dependencies.mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting variables'),
        expect.any(Error)
      );
    });

    it('should handle missing response body in getVariables', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Pause the session
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      
      // Configure mock to return response without body
      dependencies.mockProxyManager.sendDapRequest = vi.fn().mockResolvedValue({});
      
      // Should return empty array and warn (lines 650-651)
      const variables = await sessionManager.getVariables(session.id, 100);
      expect(variables).toEqual([]);
      expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No variables in response body'),
        expect.any(Object)
      );
    });

    it('should handle errors in getStackTrace gracefully', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Pause the session
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      
      // Configure mock to throw error
      dependencies.mockProxyManager.sendDapRequest = vi.fn().mockRejectedValue(new Error('Timeout'));
      
      // Should return empty array and log error (lines 690, 692)
      const stackFrames = await sessionManager.getStackTrace(session.id);
      expect(stackFrames).toEqual([]);
      expect(dependencies.mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting stack trace'),
        expect.any(Error)
      );
    });

    it('should handle missing response body in getStackTrace', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Pause the session
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      
      // Configure mock to return null body
      dependencies.mockProxyManager.sendDapRequest = vi.fn().mockResolvedValue({ body: null });
      
      // Should return empty array and warn (lines 687-688)
      const stackFrames = await sessionManager.getStackTrace(session.id);
      expect(stackFrames).toEqual([]);
      expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No stackFrames in response body'),
        expect.any(Object)
      );
    });

    it('should handle no effective thread ID in getStackTrace', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Ensure session is paused but mock returns no thread ID
      dependencies.mockProxyManager.getCurrentThreadId = vi.fn().mockReturnValue(null);
      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'entry');
      // Override getCurrentThreadId to return null after the stopped event
      dependencies.mockProxyManager.getCurrentThreadId = vi.fn().mockReturnValue(null);
      
      // Should return empty array and warn
      const stackFrames = await sessionManager.getStackTrace(session.id);
      expect(stackFrames).toEqual([]);
      expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No effective thread ID to use')
      );
    });

    it('should handle errors in getScopes gracefully', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Pause the session
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      
      // Configure mock to throw error
      dependencies.mockProxyManager.sendDapRequest = vi.fn().mockRejectedValue(new Error('Invalid frame'));
      
      // Should return empty array and log error (lines 728-730)
      const scopes = await sessionManager.getScopes(session.id, 1);
      expect(scopes).toEqual([]);
      expect(dependencies.mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting scopes'),
        expect.any(Error)
      );
    });

    it('should handle missing scopes in response', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Pause the session
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      
      // Configure mock to return empty response
      dependencies.mockProxyManager.sendDapRequest = vi.fn().mockResolvedValue({ 
        body: { scopes: null } 
      });
      
      // Should return empty array and warn (lines 725-726)
      const scopes = await sessionManager.getScopes(session.id, 1);
      expect(scopes).toEqual([]);
      expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No scopes in response body'),
        expect.any(Object)
      );
    });
  });

  describe('Session Closing Error Cases', () => {
    it('should handle errors when stopping proxy during closeSession', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Configure proxy to throw error on stop
      dependencies.mockProxyManager.stop = vi.fn().mockRejectedValue(new Error('Stop failed'));
      
      // Should handle error gracefully and still mark as stopped (lines 758-762)
      const result = await sessionManager.closeSession(session.id);
      expect(result).toBe(true);
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.STOPPED);
      expect(dependencies.mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error stopping proxy'),
        'Stop failed'
      );
    });

    it('should return false when closing non-existent session', async () => {
      // Try to close session that doesn't exist (lines 751-754)
      const result = await sessionManager.closeSession('non-existent-id');
      expect(result).toBe(false);
      expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Session not found: non-existent-id')
      );
    });

    it('should handle closeSession when proxy is already undefined', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      // Don't start debugging, so no proxy manager
      const result = await sessionManager.closeSession(session.id);
      expect(result).toBe(true);
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.STOPPED);
    });
  });
});
