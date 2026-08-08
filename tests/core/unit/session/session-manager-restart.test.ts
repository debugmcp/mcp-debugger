/**
 * restart_debugging (issue #238) — SessionManager layer.
 *
 * Also pins the fix for a latent bug: startDebugging on a session with a
 * LIVE proxy used to call closeSession (which removes the session from the
 * store) and then update state on the removed session — destroying the
 * session and surfacing "Session not found".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

describe('SessionManager - restart and relaunch', () => {
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

  async function createLaunchedSession(script = 'test.py') {
    const session = await sessionManager.createSession({
      language: DebugLanguage.MOCK,
      executablePath: 'python'
    });
    await sessionManager.startDebugging(session.id, script);
    await vi.runAllTimersAsync();
    return session;
  }

  describe('start_debugging on a live-proxy session (landmine regression)', () => {
    it('relaunches instead of destroying the session', async () => {
      const session = await createLaunchedSession();
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.PAUSED);

      const result = await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      expect(result.success).toBe(true);
      expect(sessionManager.getSession(session.id)).toBeDefined();
      expect(dependencies.mockProxyManager.stopCalls).toBeGreaterThanOrEqual(1);
      expect(dependencies.mockProxyManager.startCalls).toHaveLength(2);
    });
  });

  describe('per-launch breakpoint state reset', () => {
    it('clears stale verified state when a new launch begins', async () => {
      const session = await createLaunchedSession();
      const { breakpoint: bp } = await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 10 });
      expect(bp.verified).toBe(true); // mock default verifies live sets

      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();

      // Relaunch that dies during startup: the per-launch reset must already
      // have cleared verified/message — nothing else will overwrite them.
      dependencies.mockProxyManager.shouldFailStart = true;
      await sessionManager.startDebugging(session.id, 'test.py').catch(() => {});
      await vi.runAllTimersAsync();

      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.verified).toBe(false);
      expect(stored.message).toBeUndefined();
      expect(stored.adapterId).toBeUndefined();
    });
  });

  describe('restartDebugging', () => {
    it('replays the last launch with identical config and re-applies breakpoints', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 10 });
      await sessionManager.startDebugging(
        session.id, 'test.py', ['--flag'], { stopOnEntry: true }, undefined, { custom: 'cfg' }
      );
      await vi.runAllTimersAsync();

      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      expect(sessionManager.getSession(session.id)?.sessionLifecycle).toBe('terminated');

      const restartPromise = sessionManager.restartDebugging(session.id);
      await vi.runAllTimersAsync();
      const result = await restartPromise;

      expect(result.success).toBe(true);
      const startCalls = dependencies.mockProxyManager.startCalls;
      expect(startCalls).toHaveLength(2);
      expect(startCalls[1].scriptPath).toBe(startCalls[0].scriptPath);
      expect(startCalls[1].scriptArgs).toEqual(['--flag']);
      expect(startCalls[1].initialBreakpoints).toEqual([
        expect.objectContaining({ file: 'test.py', line: 10 })
      ]);
      const data = result.data as { breakpointsReapplied?: number; outputReset?: boolean };
      expect(data.breakpointsReapplied).toBe(1);
      expect(data.outputReset).toBe(true);
    });

    it('refuses when the session has never been launched', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      const result = await sessionManager.restartDebugging(session.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Nothing to restart');
    });

    it('refuses when only a dry run has been performed', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.startDebugging(session.id, 'test.py', undefined, undefined, true);
      await vi.runAllTimersAsync();

      const result = await sessionManager.restartDebugging(session.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Nothing to restart');
    });

    it('refuses attach sessions with an attach-specific error', async () => {
      const session = await createLaunchedSession();
      sessionManager.getSession(session.id)!.attachMode = true;

      const result = await sessionManager.restartDebugging(session.id);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/attach/i);
    });

    it('refuses a second restart while one is in progress', async () => {
      const session = await createLaunchedSession();
      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();

      const first = sessionManager.restartDebugging(session.id);
      const second = sessionManager.restartDebugging(session.id);
      await vi.runAllTimersAsync();

      const secondResult = await second;
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toMatch(/in progress/i);

      const firstResult = await first;
      expect(firstResult.success).toBe(true);
    });

    it('allows restart from ERROR state (crash recovery)', async () => {
      const session = await createLaunchedSession();
      dependencies.mockProxyManager.simulateExit(1, undefined);
      await vi.runAllTimersAsync();

      const restartPromise = sessionManager.restartDebugging(session.id);
      await vi.runAllTimersAsync();
      const result = await restartPromise;

      expect(result.success).toBe(true);
    });

    it('refuses while a start is still INITIALIZING', async () => {
      const session = await createLaunchedSession();
      sessionManager.getSession(session.id)!.state = SessionState.INITIALIZING;

      const result = await sessionManager.restartDebugging(session.id);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/initializing/i);
    });
  });
});
