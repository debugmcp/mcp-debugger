/**
 * SessionManager memory leak tests
 * Tests to verify that event listeners are properly cleaned up to prevent memory leaks
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

describe('SessionManager - Memory Leak Prevention', () => {
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

  describe('Event Listener Cleanup', () => {
    it('should remove all event listeners when closing session', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      const mockProxy = dependencies.mockProxyManager;
      
      // Get listener counts after setup
      const eventNames = ['stopped', 'continued', 'terminated', 'exited', 
                         'initialized', 'error', 'exit', 'adapter-configured', 
                         'dry-run-complete'];
      
      const listenerCountsBefore: Record<string, number> = {};
      eventNames.forEach(event => {
        listenerCountsBefore[event] = mockProxy.listenerCount(event);
      });
      
      // Verify listeners were attached
      expect(listenerCountsBefore['stopped']).toBeGreaterThan(0);
      expect(listenerCountsBefore['continued']).toBeGreaterThan(0);
      expect(listenerCountsBefore['terminated']).toBeGreaterThan(0);
      expect(listenerCountsBefore['exited']).toBeGreaterThan(0);
      expect(listenerCountsBefore['error']).toBeGreaterThan(0);
      expect(listenerCountsBefore['exit']).toBeGreaterThan(0);
      
      // Close session
      await sessionManager.closeSession(session.id);
      await vi.runAllTimersAsync();
      
      // Verify all listeners were removed
      eventNames.forEach(event => {
        expect(mockProxy.listenerCount(event)).toBe(0);
      });
    });

    it('should not accumulate listeners across multiple sessions', async () => {
      const mockProxy = dependencies.mockProxyManager;
      const sessionIds: string[] = [];
      
      // Create and close 10 sessions
      for (let i = 0; i < 10; i++) {
        const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
        sessionIds.push(session.id);
        
        await sessionManager.startDebugging(session.id, 'test.py');
        await vi.runAllTimersAsync();
        
        await sessionManager.closeSession(session.id);
        await vi.runAllTimersAsync();
      }
      
      // Total listener count should be 0
      const totalListeners = mockProxy.eventNames().reduce(
        (sum, event) => sum + mockProxy.listenerCount(event as string), 0
      );
      expect(totalListeners).toBe(0);
    });

    it('should clean up listeners even if proxyManager.stop() throws error', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      const mockProxy = dependencies.mockProxyManager;
      
      // Make stop() throw an error
      mockProxy.stop = vi.fn().mockRejectedValue(new Error('Stop failed'));
      
      // Close session
      await sessionManager.closeSession(session.id);
      await vi.runAllTimersAsync();
      
      // Verify all listeners were still removed
      const totalListeners = mockProxy.eventNames().reduce(
        (sum, event) => sum + mockProxy.listenerCount(event as string), 0
      );
      expect(totalListeners).toBe(0);
    });

    it('should handle double close gracefully', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      const mockProxy = dependencies.mockProxyManager;
      
      // Close session twice
      await sessionManager.closeSession(session.id);
      await vi.runAllTimersAsync();
      
      const firstCloseListenerCount = mockProxy.eventNames().reduce(
        (sum, event) => sum + mockProxy.listenerCount(event as string), 0
      );
      
      // Second close should not throw
      await expect(sessionManager.closeSession(session.id)).resolves.toBe(true);
      
      const secondCloseListenerCount = mockProxy.eventNames().reduce(
        (sum, event) => sum + mockProxy.listenerCount(event as string), 0
      );
      
      // Listener count should remain 0
      expect(firstCloseListenerCount).toBe(0);
      expect(secondCloseListenerCount).toBe(0);
    });

    it('should clean up listeners when proxy terminates unexpectedly', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      const mockProxy = dependencies.mockProxyManager;
      
      // Simulate unexpected termination
      mockProxy.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      
      // Verify all listeners were removed
      const totalListeners = mockProxy.eventNames().reduce(
        (sum, event) => sum + mockProxy.listenerCount(event as string), 0
      );
      expect(totalListeners).toBe(0);
      
      // Session should be in STOPPED state
      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.state).toBe(SessionState.STOPPED);
    });

    it('should clean up listeners when proxy exits unexpectedly', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      const mockProxy = dependencies.mockProxyManager;
      
      // Simulate unexpected exit
      mockProxy.simulateExit(1, 'SIGTERM');
      await vi.runAllTimersAsync();
      
      // Verify all listeners were removed
      const totalListeners = mockProxy.eventNames().reduce(
        (sum, event) => sum + mockProxy.listenerCount(event as string), 0
      );
      expect(totalListeners).toBe(0);
      
      // Session should be in ERROR state
      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.state).toBe(SessionState.ERROR);
    });
  });

  describe('Cleanup Method Testing', () => {
    it('should properly clean up event handlers via internal method', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      const mockProxy = dependencies.mockProxyManager;
      const managedSession = sessionManager.getSession(session.id);
      
      // Verify listeners are attached
      expect(mockProxy.listenerCount('stopped')).toBeGreaterThan(0);
      
      // Call internal cleanup method (if available for testing)
      if ((sessionManager as any)._testOnly_cleanupProxyEventHandlers) {
        (sessionManager as any)._testOnly_cleanupProxyEventHandlers(managedSession, mockProxy);
        
        // Verify listeners were removed
        expect(mockProxy.listenerCount('stopped')).toBe(0);
      }
    });

    it('should log cleanup operations', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      const logSpy = vi.spyOn(dependencies.logger, 'debug');
      const infoSpy = vi.spyOn(dependencies.logger, 'info');
      
      await sessionManager.closeSession(session.id);
      await vi.runAllTimersAsync();
      
      // Verify cleanup logging
      const debugCalls = logSpy.mock.calls.map(call => call[0]);
      const infoCalls = infoSpy.mock.calls.map(call => call[0]);
      
      // Should log removal of each listener
      expect(debugCalls.some(msg => msg.includes('Removing') && msg.includes('listener'))).toBe(true);
      
      // Should log cleanup completion
      expect(infoCalls.some(msg => msg.includes('Cleanup complete') || msg.includes('removed'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle cleanup when no handlers were attached', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      // Close without starting debugging (no proxy/handlers)
      await expect(sessionManager.closeSession(session.id)).resolves.toBe(true);
    });

    it('should handle partial cleanup failure gracefully', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      const mockProxy = dependencies.mockProxyManager;
      
      // Make removeListener throw for specific event
      const originalRemoveListener = mockProxy.removeListener.bind(mockProxy);
      mockProxy.removeListener = vi.fn((event, listener) => {
        if (event === 'stopped') {
          throw new Error('Failed to remove stopped listener');
        }
        return originalRemoveListener(event, listener);
      });
      
      const errorSpy = vi.spyOn(dependencies.logger, 'error');
      
      // Close session - should continue despite error
      await sessionManager.closeSession(session.id);
      await vi.runAllTimersAsync();
      
      // Should log the error
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to remove'),
        expect.any(Error)
      );
      
      // Other listeners should still be removed
      expect(mockProxy.listenerCount('continued')).toBe(0);
      expect(mockProxy.listenerCount('terminated')).toBe(0);
    });
  });
});
