/**
 * SessionManager state machine integrity tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '../../../src/session/models.js';
import { createMockDependencies } from './session-manager-test-utils.js';

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
      language: DebugLanguage.PYTHON 
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
    expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.RUNNING);
    
    // RUNNING → STOPPED
    await sessionManager.closeSession(session.id);
    expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.STOPPED);
  });

  it('should reject invalid operations based on state', async () => {
    const session = await sessionManager.createSession({ 
      language: DebugLanguage.PYTHON 
    });
    
    // Can't step when not started
    let result = await sessionManager.stepOver(session.id);
    expect(result.success).toBe(false);
    expect(result.error).toBe('No active debug run');
    
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
      language: DebugLanguage.PYTHON 
    });
    
    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    
    // Simulate error during RUNNING state
    dependencies.mockProxyManager.simulateEvent('continued');
    expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.RUNNING);
    
    dependencies.mockProxyManager.simulateError(new Error('Runtime error'));
    
    // Should transition to ERROR state
    expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.ERROR);
    expect(sessionManager.getSession(session.id)?.proxyManager).toBeUndefined();
  });
});
