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
      // Continued events emitted while the session is already paused should not flip the state back to running.
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.PAUSED);
      
      dependencies.mockProxyManager.simulateEvent('terminated');
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.STOPPED);
      // Natural termination must reap the proxy process (issue #122)
      expect(dependencies.mockProxyManager.stopCalls).toBe(1);
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
      // Seed the proxy's current-thread view as a real stopped event would;
      // auto-continue cannot issue DAP continue without that anchor.
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      await vi.runAllTimersAsync();
      
      // Should log auto-continue message
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-continuing (stopOnEntry=false)')
      );
    });
  });

  describe('Stop reason persistence (issue #214)', () => {
    it('records lastStop when a breakpoint is hit', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'breakpoint');

      const managed = sessionManager.getSession(session.id);
      expect(managed?.lastStop).toMatchObject({ reason: 'breakpoint', threadId: 1 });
      expect(typeof managed?.lastStop?.timestamp).toBe('number');
    });

    it('reports exception as the reason for a later stop, not the first one', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'breakpoint');
      dependencies.mockProxyManager.simulateEvent('continued');
      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'exception');

      expect(sessionManager.getSession(session.id)?.lastStop?.reason).toBe('exception');
    });

    it('does not record auto-continued entry stops', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
      await vi.runAllTimersAsync();

      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'entry');

      expect(sessionManager.getSession(session.id)?.lastStop).toBeUndefined();
    });

    it('exposes lastStop through getAllSessions', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      dependencies.mockProxyManager.simulateEvent('stopped', 7, 'exception');

      const listed = sessionManager.getAllSessions().find((s) => s.id === session.id);
      expect(listed?.lastStop).toMatchObject({ reason: 'exception', threadId: 7 });
    });
  });

  describe('Debuggee output capture (issue #218)', () => {
    async function startSession(dapLaunchArgs?: { stopOnEntry?: boolean }) {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.startDebugging(session.id, 'test.py', [], dapLaunchArgs);
      await vi.runAllTimersAsync();
      return session;
    }

    it('captures stdout and stderr output events with increasing seq', async () => {
      const session = await startSession();

      dependencies.mockProxyManager.simulateEvent('output', { category: 'stdout', output: 'hello\n' });
      dependencies.mockProxyManager.simulateEvent('output', { category: 'stderr', output: 'oops\n' });

      const read = sessionManager.getSession(session.id)?.outputBuffer?.read(0, 100);
      expect(read?.entries).toHaveLength(2);
      expect(read?.entries[0]).toMatchObject({ seq: 1, category: 'stdout', output: 'hello\n' });
      expect(read?.entries[1]).toMatchObject({ seq: 2, category: 'stderr', output: 'oops\n' });
      expect(typeof read?.entries[0].timestamp).toBe('number');
    });

    it('defaults a missing category to console', async () => {
      const session = await startSession();

      dependencies.mockProxyManager.simulateEvent('output', { output: 'no category\n' } as never);

      const read = sessionManager.getSession(session.id)?.outputBuffer?.read(0, 100);
      expect(read?.entries[0]).toMatchObject({ category: 'console', output: 'no category\n' });
    });

    it('filters telemetry events at write time', async () => {
      const session = await startSession();

      dependencies.mockProxyManager.simulateEvent('output', { category: 'telemetry', output: '{"event":"x"}' });
      dependencies.mockProxyManager.simulateEvent('output', { category: 'stdout', output: 'real\n' });

      const read = sessionManager.getSession(session.id)?.outputBuffer?.read(0, 100);
      expect(read?.entries).toHaveLength(1);
      expect(read?.entries[0].output).toBe('real\n');
    });

    it('ignores malformed output bodies', async () => {
      const session = await startSession();

      dependencies.mockProxyManager.simulateEvent('output', {} as never);
      dependencies.mockProxyManager.simulateEvent('output', { category: 'stdout', output: '' });
      dependencies.mockProxyManager.simulateEvent('output', undefined as never);

      const read = sessionManager.getSession(session.id)?.outputBuffer?.read(0, 100);
      expect(read?.entries).toHaveLength(0);
    });

    it('captures output emitted before the first stop (entry auto-continue window)', async () => {
      const session = await startSession({ stopOnEntry: false });

      dependencies.mockProxyManager.simulateEvent('output', { category: 'stdout', output: 'early\n' });
      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'entry');

      const read = sessionManager.getSession(session.id)?.outputBuffer?.read(0, 100);
      expect(read?.entries.map(e => e.output)).toEqual(['early\n']);
    });

    it('keeps output readable after termination but stops capturing (handlers removed)', async () => {
      const session = await startSession();

      dependencies.mockProxyManager.simulateEvent('output', { category: 'stdout', output: 'before exit\n' });
      dependencies.mockProxyManager.simulateEvent('terminated');
      dependencies.mockProxyManager.simulateEvent('output', { category: 'stdout', output: 'after exit\n' });

      const read = sessionManager.getSession(session.id)?.outputBuffer?.read(0, 100);
      expect(read?.entries.map(e => e.output)).toEqual(['before exit\n']);
    });

    it('starts a fresh buffer with restarted seq on re-launch', async () => {
      const session = await startSession();

      dependencies.mockProxyManager.simulateEvent('output', { category: 'stdout', output: 'first launch\n' });
      dependencies.mockProxyManager.simulateEvent('terminated');
      // Let the first launch's teardown (proxy exit) finish before re-launching —
      // the shared mock ProxyManager would otherwise tear down the new handlers.
      await vi.runAllTimersAsync();

      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      const empty = sessionManager.getSession(session.id)?.outputBuffer?.read(0, 100);
      expect(empty?.entries).toHaveLength(0);

      dependencies.mockProxyManager.simulateEvent('output', { category: 'stdout', output: 'second launch\n' });
      const read = sessionManager.getSession(session.id)?.outputBuffer?.read(0, 100);
      expect(read?.entries).toHaveLength(1);
      expect(read?.entries[0].seq).toBe(1);
    });

    it("emits 'output-captured' with the session id and entry", async () => {
      const captured: Array<{ sessionId: string; entry: unknown }> = [];
      sessionManager.on('output-captured', (sessionId: string, entry: unknown) => {
        captured.push({ sessionId, entry });
      });

      const session = await startSession();
      dependencies.mockProxyManager.simulateEvent('output', { category: 'stdout', output: 'ping\n' });
      dependencies.mockProxyManager.simulateEvent('output', { category: 'telemetry', output: 'noise' });

      expect(captured).toHaveLength(1);
      expect(captured[0].sessionId).toBe(session.id);
      expect(captured[0].entry).toMatchObject({ seq: 1, category: 'stdout', output: 'ping\n' });
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

    it('does not log env values passed in dapLaunchArgs', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.startDebugging(session.id, 'test.py', [], {
        stopOnEntry: false,
        env: { GITHUB_PAT: 'github_pat_SESSIONLEAK1' }
      } as never);
      await vi.runAllTimersAsync();

      const logged = (dependencies.logger.info as ReturnType<typeof vi.fn>).mock.calls
        .map((call: unknown[]) => JSON.stringify(call))
        .join('\n');
      expect(logged).not.toContain('github_pat_SESSIONLEAK1');
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
