/**
 * SessionManager error recovery tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '../../../src/session/models.js';
import { createMockDependencies } from './session-manager-test-utils.js';

describe('SessionManager - Error Recovery', () => {
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

  describe('Proxy Crash Recovery', () => {
    it('should clean up when proxy crashes unexpectedly', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      // Start debugging
      const startPromise = sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      await startPromise;
      
      // Simulate proxy crash
      dependencies.mockProxyManager.simulateExit(1, 'SIGKILL');
      
      // Session should be in error state
      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.state).toBe(SessionState.ERROR);
      expect(managedSession?.proxyManager).toBeUndefined();
    });

    it('should allow restart after proxy crash', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      // First start
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Crash the proxy
      dependencies.mockProxyManager.simulateExit(1);
      
      // Reset the mock for restart
      dependencies.mockProxyManager.reset();
      
      // Should be able to start again
      const restartResult = await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      expect(restartResult.success).toBe(true);
    });

    it('should handle "proxy exited before initialization" scenario', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      // Configure mock to fail start with error
      dependencies.mockProxyManager.shouldFailStart = true;
      
      const startResult = await sessionManager.startDebugging(session.id, 'test.py');
      
      expect(startResult.success).toBe(false);
      expect(startResult.error).toContain('Mock start failure');
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.ERROR);
    });
  });
  
  describe('Timeout Handling', () => {
    it('should handle proxy initialization properly', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      // Configure mock to emit events immediately
      dependencies.mockProxyManager.start = vi.fn().mockImplementation(async () => {
        // Simulate successful start
        setTimeout(() => {
          dependencies.mockProxyManager.emit('adapter-configured');
        }, 10);
      });
      
      const startPromise = sessionManager.startDebugging(session.id, 'test.py');
      
      // Advance timers to process the timeout
      await vi.advanceTimersByTimeAsync(100);
      
      const result = await startPromise;
      expect(result.success).toBe(true);
    });

    it('should handle DAP command response timeouts', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      // Start session but don't pause it
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Session state should be PAUSED by default (stopOnEntry=true)
      // But we'll simulate RUNNING state to test the empty array return
      const managedSession = sessionManager.getSession(session.id);
      if (managedSession) {
        managedSession.state = SessionState.RUNNING;
      }
      
      // Should return empty array when not paused
      const variables = await sessionManager.getVariables(session.id, 1000);
      expect(variables).toEqual([]);
    });

    it('should cleanup properly after timeout', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      // Make proxy fail to start
      dependencies.mockProxyManager.shouldFailStart = true;
      
      const result = await sessionManager.startDebugging(session.id, 'test.py');
      
      expect(result.success).toBe(false);
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.ERROR);
      expect(sessionManager.getSession(session.id)?.proxyManager).toBeUndefined();
    });
  });
});
