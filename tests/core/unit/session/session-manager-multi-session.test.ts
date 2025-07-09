/**
 * SessionManager multi-session management tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '../../../../src/session/models.js';
import { MockProxyManager } from '../../../test-utils/mocks/mock-proxy-manager.js';
import { createMockDependencies } from './session-manager-test-utils.js';

describe('SessionManager - Multi-Session Management', () => {
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

  it('should manage multiple concurrent debug sessions', async () => {
    // Create multiple sessions
    const session1 = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        name: 'Session 1',
        pythonPath: 'python'
      });
    const session2 = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        name: 'Session 2',
        pythonPath: 'python'
      });
    const session3 = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        name: 'Session 3',
        pythonPath: 'python'
      });
    
    // All sessions should be created
    expect(sessionManager.getAllSessions()).toHaveLength(3);
    
    // Start all sessions
    const start1 = sessionManager.startDebugging(session1.id, 'test1.py');
    const start2 = sessionManager.startDebugging(session2.id, 'test2.py');
    const start3 = sessionManager.startDebugging(session3.id, 'test3.py');
    
    await vi.runAllTimersAsync();
    
    const results = await Promise.all([start1, start2, start3]);
    expect(results.every(r => r.success)).toBe(true);
    
    // Each session should have its own state
    expect(sessionManager.getSession(session1.id)?.state).toBe(SessionState.PAUSED);
    expect(sessionManager.getSession(session2.id)?.state).toBe(SessionState.PAUSED);
    expect(sessionManager.getSession(session3.id)?.state).toBe(SessionState.PAUSED);
  });

  it('should isolate session states properly', async () => {
    // Create separate mock proxy managers for each session
    const mockProxyManager1 = new MockProxyManager();
    const mockProxyManager2 = new MockProxyManager();
    let proxyCount = 0;
    
    dependencies.proxyManagerFactory.create = vi.fn().mockImplementation(() => {
      return proxyCount++ === 0 ? mockProxyManager1 : mockProxyManager2;
    });
    
    const session1 = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        name: 'Session 1',
        pythonPath: 'python'
      });
    const session2 = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        name: 'Session 2',
        pythonPath: 'python'
      });
    
    // Start both sessions
    await sessionManager.startDebugging(session1.id, 'test1.py');
    await sessionManager.startDebugging(session2.id, 'test2.py');
    await vi.runAllTimersAsync();
    
    // Continue session 1 only
    mockProxyManager1.simulateStopped(1, 'entry');
    await sessionManager.continue(session1.id);
    mockProxyManager1.simulateEvent('continued');
    
    // Session 1 should be running, session 2 should still be paused
    expect(sessionManager.getSession(session1.id)?.state).toBe(SessionState.RUNNING);
    expect(sessionManager.getSession(session2.id)?.state).toBe(SessionState.PAUSED);
  });

  it('should handle closeAllSessions with active sessions', async () => {
    // Create and start multiple sessions
    const session1 = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
    const session2 = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
    
    await sessionManager.startDebugging(session1.id, 'test1.py');
    await sessionManager.startDebugging(session2.id, 'test2.py');
    await vi.runAllTimersAsync();
    
    // Close all sessions
    await sessionManager.closeAllSessions();
    
    // All sessions should be stopped
    expect(sessionManager.getSession(session1.id)?.state).toBe(SessionState.STOPPED);
    expect(sessionManager.getSession(session2.id)?.state).toBe(SessionState.STOPPED);
    expect(dependencies.mockProxyManager.stopCalls).toBe(2);
  });

  it('should handle empty session list in closeAllSessions', async () => {
    // No sessions created
    await sessionManager.closeAllSessions();
    
    expect(dependencies.mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Closing all debug sessions (0 active)')
    );
    expect(dependencies.mockLogger.info).toHaveBeenCalledWith(
      'All debug sessions closed'
    );
  });

  it('should handle errors in individual sessions during closeAllSessions', async () => {
    // Create multiple sessions
    const session1 = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
    const session2 = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
    
    await sessionManager.startDebugging(session1.id, 'test1.py');
    await sessionManager.startDebugging(session2.id, 'test2.py');
    await vi.runAllTimersAsync();
    
    // Make first proxy fail on stop
    const session1Proxy = sessionManager.getSession(session1.id)?.proxyManager;
    if (session1Proxy) {
      session1Proxy.stop = vi.fn().mockRejectedValue(new Error('Stop failed'));
    }
    
    // Should still close all sessions despite error
    await sessionManager.closeAllSessions();
    
    expect(sessionManager.getSession(session1.id)?.state).toBe(SessionState.STOPPED);
    expect(sessionManager.getSession(session2.id)?.state).toBe(SessionState.STOPPED);
  });
});
