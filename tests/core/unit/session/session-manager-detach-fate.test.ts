/**
 * Issue #1148: what became of a borrowed program is observed, not assumed.
 *
 * `detach_from_process` answered "Detached from process (process still
 * running)" whether or not the adapter had acknowledged the detach, and
 * `close_debug_session` answered `released: true` from the session's mode. The
 * worker now reports what the adapter did with the detaching disconnect
 * (answered, `terminated` sent in reply, or neither; and whether the program
 * exited), and both answers are read from that report:
 *
 *   released      the adapter acknowledged the detach
 *   processEnded  the adapter reported that the program exited
 *   neither       not confirmed, and the answer says so
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';
import { ErrorMessages } from '../../../../src/utils/error-messages.js';

describe('SessionManager - the fate of a borrowed program (issue #1148)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    const config: SessionManagerConfig = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true }
    };
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  /** A running session that borrows its program, the way an attach leaves one. */
  async function borrowedSession(): Promise<string> {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
    const started = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    expect((await started).state).toBe(SessionState.RUNNING);
    const managed = sessionManager.getSession(session.id)!;
    managed.attachMode = true;
    managed.programOwnership = 'borrowed';
    return session.id;
  }

  describe('detach_from_process', () => {
    it('says released when the adapter acknowledged the detach', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: true, by: 'response' };

      const detached = await sessionManager.detachFromProcess(sessionId);

      expect(detached).toMatchObject({ success: true, state: SessionState.STOPPED });
      expect(detached.data).toEqual({ message: ErrorMessages.detachReleased(), released: true });
    });

    it('takes terminated sent in reply as the acknowledgement, though the request itself failed (debugpy)', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: true, by: 'terminated' };
      vi.spyOn(dependencies.mockProxyManager, 'sendDapRequest').mockRejectedValueOnce(new Error('DAP client disconnected'));

      const detached = await sessionManager.detachFromProcess(sessionId);

      expect(detached.data).toEqual({ message: ErrorMessages.detachReleased(), released: true });
    });

    it('says the program ended when the adapter reported its exit', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: true, by: 'response', debuggeeExited: true };

      const detached = await sessionManager.detachFromProcess(sessionId);

      expect(detached.data).toEqual({ message: ErrorMessages.detachProgramEnded(), processEnded: true });
    });

    it('does not say released when nothing acknowledged the detach, and says why', async () => {
      const sessionId = await borrowedSession();
      const failure = "Request 'disconnect' timed out after 10s";
      dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: false, error: failure };
      vi.spyOn(dependencies.mockProxyManager, 'sendDapRequest').mockRejectedValueOnce(new Error(failure));

      const detached = await sessionManager.detachFromProcess(sessionId);

      expect(detached).toMatchObject({ success: true, state: SessionState.STOPPED });
      expect(detached.data?.released).toBeUndefined();
      expect(detached.data?.processEnded).toBeUndefined();
      expect(detached.data?.message).toBe(ErrorMessages.detachUnconfirmed(failure));
      expect(detached.data?.warning).toBe(ErrorMessages.detachUnconfirmed(failure));
      expect(detached.data?.message).toMatch(/not known/);
      expect(detached.data?.message).not.toContain('(process still running)');
    });

    it('reads a missing report as not confirmed when the request failed, and as acknowledged when it was answered', async () => {
      const unanswered = await borrowedSession();
      vi.spyOn(dependencies.mockProxyManager, 'sendDapRequest').mockRejectedValueOnce(new Error('Proxy exited'));
      const first = await sessionManager.detachFromProcess(unanswered);
      expect(first.data?.released).toBeUndefined();
      expect(first.data?.message).toBe(ErrorMessages.detachUnconfirmed('Proxy exited'));
    });

    it('bounds the wait for the acknowledgement', async () => {
      const sessionId = await borrowedSession();
      const send = vi.spyOn(dependencies.mockProxyManager, 'sendDapRequest');

      await sessionManager.detachFromProcess(sessionId);

      expect(send).toHaveBeenCalledWith('disconnect', { terminateDebuggee: false }, { timeoutMs: 10_000 });
    });
  });

  describe('close_debug_session', () => {
    it('says released when the worker reported an acknowledged detach', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = { trigger: 'close', acknowledged: true, by: 'terminated' };

      const outcome = await sessionManager.closeSessionReporting(sessionId);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [sessionId], releasedSessionIds: [sessionId], released: true });
    });

    it('does not say released when the worker reported an unacknowledged one, and carries why', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = {
        trigger: 'close', acknowledged: false, error: 'DAP disconnect request timed out after 1000ms'
      };

      const outcome = await sessionManager.closeSessionReporting(sessionId);

      expect(outcome).toEqual({
        closed: true,
        closedSessionIds: [sessionId],
        releaseUnconfirmed: 'DAP disconnect request timed out after 1000ms'
      });
    });

    it('does not say released when no report arrived at all', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = undefined;
      dependencies.mockProxyManager.reportsDetachOnStop = false;

      const outcome = await sessionManager.closeSessionReporting(sessionId);

      expect(outcome.released).toBeUndefined();
      expect(outcome.releaseUnconfirmed).toBe('the debug adapter reported nothing about the detach');
    });

    it('says the program ended when the adapter reported its exit', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = { trigger: 'close', acknowledged: true, by: 'response', debuggeeExited: true };

      const outcome = await sessionManager.closeSessionReporting(sessionId);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [sessionId], processEnded: true });
    });

    it('claims nothing for a session that no longer has a program', async () => {
      const sessionId = await borrowedSession();
      await sessionManager.detachFromProcess(sessionId);

      const outcome = await sessionManager.closeSessionReporting(sessionId);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [sessionId] });
    });

    it('claims nothing about a program the session launched', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      const started = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
      await vi.runAllTimersAsync();
      await started;

      const outcome = await sessionManager.closeSessionReporting(session.id);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [session.id] });
    });
  });
});
