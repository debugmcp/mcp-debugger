/**
 * SessionManager integration tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

describe('SessionManager - Integration Tests', () => {
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

  describe('Event Handling', () => {
    it('should forward ProxyManager events correctly', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Test various events
      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'breakpoint');
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.PAUSED);
      
      dependencies.mockProxyManager.simulateEvent('continued');
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.RUNNING);
      
      dependencies.mockProxyManager.simulateEvent('terminated');
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.STOPPED);
    });

    it('should handle auto-continue for stopOnEntry=false', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      // Configure logger spy
      const loggerSpy = vi.spyOn(dependencies.logger, 'info');
      
      await sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
      await vi.runAllTimersAsync();
      
      // Simulate entry stop
      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'entry');
      
      // Should log auto-continue message
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-continuing (stopOnEntry=false)')
      );
    });
  });

  describe('Logger Integration', () => {
    it('should log all major operations', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      expect(dependencies.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Created new session')
      );
      
      await sessionManager.startDebugging(session.id, 'test.py');
      // Check that some variation of "start debugging" was logged
      // The logger.info call has two arguments - the message and the dapLaunchArgs (which may be undefined)
      expect(dependencies.logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/[Aa]ttempting to start debugging/),
        undefined  // No dapLaunchArgs were provided, so it logs undefined
      );
      
      await sessionManager.closeSession(session.id);
      expect(dependencies.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Closing debug session')
      );
    });

    it('should log errors appropriately', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      dependencies.mockProxyManager.shouldFailStart = true;
      
      await sessionManager.startDebugging(session.id, 'test.py');
      
      // The error logger is called with the full error message as one argument
      expect(dependencies.logger.error).toHaveBeenCalled();
      const errorCall = (dependencies.logger.error as any).mock.calls.find((call: any[]) => 
        call[0].includes('Detailed error in startDebugging')
      );
      expect(errorCall).toBeDefined();
    });
  });

  describe('Integration with SessionStore', () => {
    it('should persist sessions correctly', async () => {
      const session1 = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        name: 'Session 1',
        executablePath: 'python'
      });
      const session2 = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        name: 'Session 2',
        executablePath: 'python'
      });
      
      // Check they're in the store
      const allSessions = sessionManager.getAllSessions();
      expect(allSessions).toHaveLength(2);
      expect(allSessions).toContainEqual(
        expect.objectContaining({ id: session1.id, name: 'Session 1' })
      );
      expect(allSessions).toContainEqual(
        expect.objectContaining({ id: session2.id, name: 'Session 2' })
      );
    });

    it('should update session state in store', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      const initialUpdatedAt = session.updatedAt;
      
      // Use fake timers to advance time
      vi.advanceTimersByTime(100);
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync(); // Allow events to process
      
      const updatedSession = sessionManager.getSession(session.id);
      // State transitions to PAUSED because stopOnEntry=true and the mock immediately emits a stopped event
      expect(updatedSession?.state).toBe(SessionState.PAUSED);
      expect(updatedSession?.updatedAt?.getTime()).toBeGreaterThan(initialUpdatedAt?.getTime() || 0);
    });
  });
});
