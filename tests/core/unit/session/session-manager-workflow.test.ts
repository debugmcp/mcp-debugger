/**
 * SessionManager workflow tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

describe('SessionManager - Debug Session Workflow', () => {
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

  describe('Complete Debug Cycle', () => {
    it('should complete full debug workflow: create → start → breakpoint → step → stop', async () => {
      // Create session
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        name: 'Full Workflow Test',
        pythonPath: 'python'
      });
      
      expect(session).toMatchObject({
        language: DebugLanguage.MOCK,
        name: 'Full Workflow Test',
        state: SessionState.CREATED
      });
      
      // Start debugging
      const startPromise = sessionManager.startDebugging(
        session.id,
        'test.py',
        [],
        { stopOnEntry: true }
      );
      
      // Wait for proxy to emit events
      await vi.runAllTimersAsync();
      
      const startResult = await startPromise;
      expect(startResult.success).toBe(true);
      expect(startResult.state).toBe(SessionState.PAUSED);
      
      // Set a breakpoint
      const breakpoint = await sessionManager.setBreakpoint(session.id, 'test.py', 15);
      expect(breakpoint.verified).toBe(true);
      expect(dependencies.mockProxyManager.dapRequestCalls).toContainEqual({
        command: 'setBreakpoints',
        args: expect.objectContaining({
          breakpoints: [{ line: 15, condition: undefined }]
        })
      });
      
      // Step over
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      const stepResult = await sessionManager.stepOver(session.id);
      expect(stepResult.success).toBe(true);
      
      // Stop debugging
      const closeResult = await sessionManager.closeSession(session.id);
      expect(closeResult).toBe(true);
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.STOPPED);
    });

    it('should handle dry run workflow correctly', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        name: 'Dry Run Test',
        pythonPath: 'python'
      });
      
      const startPromise = sessionManager.startDebugging(
        session.id,
        'test.py',
        ['--arg1', '--arg2'],
        {},
        true // dry run
      );
      
      await vi.runAllTimersAsync();
      
      const result = await startPromise;
      expect(result.success).toBe(true);
      expect((result.data as any)?.dryRun).toBe(true);
      expect(result.state).toBe(SessionState.STOPPED);
      
      // Verify no "proxy exited before initialization" errors
      expect(dependencies.mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('proxy exited before initialization')
      );
      
      // Verify proxy was configured for dry run
      expect(dependencies.mockProxyManager.startCalls[0].dryRunSpawn).toBe(true);
    });

    it('should handle stopOnEntry=false workflow', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      // Configure mock to not stop on entry
      dependencies.mockProxyManager.on('start', (config) => {
        if (!config.stopOnEntry) {
          // Don't emit stopped event initially, go straight to running
          setTimeout(() => {
            dependencies.mockProxyManager.emit('adapter-configured');
          }, 10);
        }
      });
      
      const startPromise = sessionManager.startDebugging(
        session.id,
        'test.py',
        [],
        { stopOnEntry: false }
      );
      
      await vi.runAllTimersAsync();
      
      const result = await startPromise;
      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.RUNNING);
      
      // Verify stopOnEntry was passed correctly
      expect(dependencies.mockProxyManager.startCalls[0].stopOnEntry).toBe(false);
    });
  });
});
