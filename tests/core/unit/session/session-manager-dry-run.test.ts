import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { SessionState, DebugLanguage } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

describe('SessionManager - Dry Run Race Condition Tests', () => {
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

  describe('Dry Run Timing Issues', () => {
    it('should wait for dry run completion beyond 500ms', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        name: 'SlowDryRunTest',
        pythonPath: 'python'
      });

      const mockProxyManager = dependencies.mockProxyManager;
      
      // Override the default start behavior to control when dry-run-complete fires
      mockProxyManager.start = vi.fn(async (config) => {
        mockProxyManager.startCalls.push(config);
        (mockProxyManager as unknown as { _isRunning: boolean })._isRunning = true;
        
        // Don't emit immediately if it's a dry run
        if (config.dryRunSpawn) {
          // Emit after delay
          setTimeout(() => {
            mockProxyManager.emit('dry-run-complete', 'python', config.scriptPath);
          }, 1000); // Longer than current 500ms timeout
        }
      });

      const startTime = Date.now();
      const resultPromise = sessionManager.startDebugging(
        session.id,
        'test.py',
        [],
        {},
        true // dryRunSpawn
      );
      
      // Advance timers to trigger the dry-run-complete event
      await vi.advanceTimersByTimeAsync(1000);
      
      const result = await resultPromise;
      const duration = Date.now() - startTime;

      // Should wait for the full 1000ms
      expect(duration).toBeGreaterThanOrEqual(1000);
      expect(duration).toBeLessThan(2500); // More tolerant timing for CI environments
      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.STOPPED);
      const data = result.data as { dryRun?: boolean; message?: string };
      expect(data?.dryRun).toBe(true);
      expect(data?.message).toContain('Dry run spawn command logged');
    });

    it('should timeout gracefully if dry run never completes', async () => {
      // Create a new session manager with shorter timeout for testing
      const testTimeout = 2000; // 2 seconds for faster test
      const testSessionManager = new SessionManager(
        { logDirBase: '/tmp/test-sessions', dryRunTimeoutMs: testTimeout },
        dependencies
      );
      
      const session = await testSessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        name: 'TimeoutDryRunTest',
        pythonPath: 'python'
      });

      const mockProxyManager = dependencies.mockProxyManager;
      
      // Configure mock to never emit dry-run-complete
      mockProxyManager.start = vi.fn(async (config) => {
        mockProxyManager.startCalls.push(config);
        (mockProxyManager as unknown as { _isRunning: boolean })._isRunning = true;
        
        // Don't emit dry-run-complete event at all
        if (config.dryRunSpawn) {
          // Do nothing - no event
        }
      });
      
      const startTime = Date.now();
      const resultPromise = testSessionManager.startDebugging(
        session.id,
        'test.py',
        [],
        {},
        true // dryRunSpawn
      );
      
      // Advance timers to trigger the timeout
      await vi.advanceTimersByTimeAsync(testTimeout);
      
      const result = await resultPromise;
      const duration = Date.now() - startTime;

      // Should wait for the configured timeout period
      expect(duration).toBeGreaterThanOrEqual(testTimeout);
      expect(duration).toBeLessThan(testTimeout + 2500); // Very tolerant timing for CI environments
      
      // Should return failure with timeout error
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('timed out');
      expect(result.error).toContain(`${testTimeout}ms`);
    });

    it('should handle dry run completing before event listener setup', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        name: 'RaceConditionTest',
        pythonPath: 'python'
      });

      const mockProxyManager = dependencies.mockProxyManager;
      
      // Configure mock to emit dry-run-complete very early
      mockProxyManager.start = vi.fn(async (config) => {
        mockProxyManager.startCalls.push(config);
        (mockProxyManager as unknown as { _isRunning: boolean })._isRunning = true;
        
        // Emit immediately to simulate race condition
        if (config.dryRunSpawn) {
          // Use process.nextTick to emit before our wait handler is set up
          process.nextTick(() => {
            mockProxyManager.emit('dry-run-complete', 'python', config.scriptPath);
          });
        }
      });

      const resultPromise = sessionManager.startDebugging(
        session.id,
        'test.py',
        [],
        {},
        true // dryRunSpawn
      );
      
      // Allow the process.nextTick to execute
      await vi.runAllTimersAsync();
      
      const result = await resultPromise;

      // Should still succeed by checking state
      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.STOPPED);
      const data = result.data as { dryRun?: boolean };
      expect(data?.dryRun).toBe(true);
    });

    it('should handle dry run with very fast completion', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        name: 'FastDryRunTest',
        pythonPath: 'python'
      });

      const mockProxyManager = dependencies.mockProxyManager;
      
      // Configure mock to emit dry-run-complete very quickly (10ms)
      mockProxyManager.start = vi.fn(async (config) => {
        mockProxyManager.startCalls.push(config);
        (mockProxyManager as unknown as { _isRunning: boolean })._isRunning = true;
        
        if (config.dryRunSpawn) {
          setTimeout(() => {
            mockProxyManager.emit('dry-run-complete', 'python', config.scriptPath);
          }, 10); // Very fast completion
        }
      });

      const startTime = Date.now();
      const resultPromise = sessionManager.startDebugging(
        session.id,
        'test.py',
        [],
        {},
        true // dryRunSpawn
      );
      
      // Advance timers by 10ms to trigger the event
      await vi.advanceTimersByTimeAsync(10);
      
      const result = await resultPromise;
      const duration = Date.now() - startTime;

      // Should complete quickly without unnecessary delays
      expect(duration).toBeLessThan(100); // More tolerant timing for CI environments
      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.STOPPED);
      const data = result.data as { dryRun?: boolean };
      expect(data?.dryRun).toBe(true);
    });

    it('should clean up event listeners properly on timeout', async () => {
      // Create a new session manager with shorter timeout for testing
      const testTimeout = 1000; // 1 second for faster test
      const testSessionManager = new SessionManager(
        { logDirBase: '/tmp/test-sessions', dryRunTimeoutMs: testTimeout },
        dependencies
      );
      
      const session = await testSessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        name: 'CleanupTest',
        pythonPath: 'python'  // Add pythonPath
      });

      const mockProxyManager = dependencies.mockProxyManager;
      
      // Track if 'once' was called to set up the listener
      const onceSpy = vi.spyOn(mockProxyManager, 'once');
      
      mockProxyManager.start = vi.fn(async (config) => {
        mockProxyManager.startCalls.push(config);
        (mockProxyManager as unknown as { _isRunning: boolean })._isRunning = true;
        // Never emit dry-run-complete
      });

      // Spy on removeListener
      const removeListenerSpy = vi.spyOn(mockProxyManager, 'removeListener');
      
      const resultPromise = testSessionManager.startDebugging(
        session.id,
        'test.py',
        [],
        {},
        true // dryRunSpawn
      );
      
      // Advance timers to trigger timeout
      await vi.advanceTimersByTimeAsync(testTimeout);
      const result = await resultPromise;

      // Verify the operation failed with timeout
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
      
      // The listener should have been set up with 'once'
      expect(onceSpy).toHaveBeenCalledWith('dry-run-complete', expect.any(Function));
      
      // After timeout, listener should be cleaned up
      expect(removeListenerSpy).toHaveBeenCalledWith('dry-run-complete', expect.any(Function));
    });
  });
});
