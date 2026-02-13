/**
 * SessionManager state machine integrity tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';
import { ProxyNotRunningError } from '../../../../src/errors/debug-errors.js';

describe('SessionManager - State Machine Integrity', () => {
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

  it('should enforce valid state transitions', async () => {
    const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
    
    // CREATED → INITIALIZING
    const startPromise = sessionManager.startDebugging(session.id, 'test.py');
    expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.INITIALIZING);
    
    await vi.runAllTimersAsync();
    await startPromise;
    
    // INITIALIZING → PAUSED (because stopOnEntry=true by default)
    expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.PAUSED);
    
    // PAUSED → RUNNING
    dependencies.mockProxyManager.simulateStopped(1, 'entry');
    await sessionManager.continue(session.id);
    dependencies.mockProxyManager.simulateEvent('continued');
    expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.PAUSED);
    
    // RUNNING → STOPPED (session removed from store after close)
    await sessionManager.closeSession(session.id);
    expect(sessionManager.getSession(session.id)).toBeUndefined();
  });

  it('should reject invalid operations based on state', async () => {
    const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
    
    // Can't step when not started - now throws typed error
    await expect(sessionManager.stepOver(session.id)).rejects.toThrow(ProxyNotRunningError);
    let result: any;
    
    // Start session but don't pause
    await sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    dependencies.mockProxyManager.simulateEvent('continued');
    
    // Can't step when running
    result = await sessionManager.stepOver(session.id);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not paused');
    
    // Can't continue when not paused
    result = await sessionManager.continue(session.id);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not paused');
  });

  it('should maintain state consistency during errors', async () => {
    const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
    
    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    
    // Simulate continued event; state should remain paused until the next explicit transition
    dependencies.mockProxyManager.simulateEvent('continued');
    expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.PAUSED);
    
    dependencies.mockProxyManager.simulateError(new Error('Runtime error'));
    
    // Should transition to ERROR state
    expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.ERROR);
    expect(sessionManager.getSession(session.id)?.proxyManager).toBeUndefined();
  });
});
