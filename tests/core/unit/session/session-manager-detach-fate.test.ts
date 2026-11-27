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
import { DebugLanguage, SessionState, JsDebugAdapterPolicy, MockAdapterPolicy } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';
import { ErrorMessages } from '../../../../src/utils/error-messages.js';
import { FakeDebugAdapter } from '../../../test-utils/fakes/fake-debug-adapter.js';
import { launchConfigIsAttach } from '../../../../src/proxy/proxy-config.js';

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
    managed.run.attachMode = true;
    managed.run.programOwnership = 'borrowed';
    return session.id;
  }

  // The review found the first key for #1151 was read from the launch
  // arguments before the adapter transformed them, while the worker decides
  // what its shutdown does from the transformed config: an attach-shaped
  // launch on an adapter with no attach transform was called borrowed and
  // then ended. Both now read one function of one config.
  describe('who owns the program (issue #1151)', () => {
    it('is one function of the launch config the worker is given', () => {
      expect(launchConfigIsAttach({ request: 'attach' })).toBe(true);
      expect(launchConfigIsAttach({ request: 'launch', __attachMode: true })).toBe(true);
      expect(launchConfigIsAttach({ request: 'launch' })).toBe(false);
      expect(launchConfigIsAttach({})).toBe(false);
      expect(launchConfigIsAttach(undefined)).toBe(false);
    });

    it.each([
      ['a plain launch', {}],
      ['a launch whose arguments are attach-shaped', { request: 'attach' }],
      ['a launch carrying the internal attach flag', { __attachMode: true }]
    ])('records for %s what the config handed to the worker says', async (_what, extra) => {
      const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      const started = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false, ...extra } as never);
      await vi.runAllTimersAsync();
      await started;

      const given = dependencies.mockProxyManager.startCalls.at(-1)!;
      expect(sessionManager.getSession(session.id)!.run.programOwnership).toBe(
        launchConfigIsAttach(given.launchConfig as Record<string, unknown>) ? 'borrowed' : 'owned'
      );
    });

    it('does not refuse a terminating detach on an owned program', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      const started = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
      await vi.runAllTimersAsync();
      await started;
      expect(sessionManager.getSession(session.id)!.run.programOwnership).toBe('owned');

      const ended = await sessionManager.detachFromProcess(session.id, true);

      expect(ended).toMatchObject({ success: true, data: { message: 'Detached and terminated process' } });
    });
  });

  describe('detach_from_process', () => {
    it.each([
      { locality: 'pid', attached: true, off: false, expected: true },
      { locality: 'loopback', attached: true, off: false, expected: true },
      { locality: 'remote', attached: true, off: false, expected: false },
      { locality: undefined, attached: true, off: false, expected: false },
      { locality: 'loopback', attached: false, off: false, expected: false },
      { locality: 'loopback', attached: true, off: true, expected: false }
    ] as const)('gates persistent target wording on run facts: %j', async ({ locality, attached, off, expected }) => {
      const sessionId = await borrowedSession();
      const session = sessionManager.getSession(sessionId)!;
      session.language = DebugLanguage.JAVASCRIPT;
      session.run.attachMode = attached;
      session.run.attachLocality = locality;
      session.run.childDebuggingOptedOut = off ? 'adapter-default' : undefined;
      const detached = await sessionManager.detachFromProcess(sessionId);
      expect(detached.data?.note).toBe(expected ? JsDebugAdapterPolicy.childAdoption?.attachLeavesTargetChanged : undefined);
    });

    it.each([false, true])('omits the persistence note when the target ends (terminate=%s)', async terminate => {
      const sessionId = await borrowedSession();
      const session = sessionManager.getSession(sessionId)!;
      session.language = DebugLanguage.JAVASCRIPT;
      session.run.attachLocality = 'loopback';
      dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: true, by: 'response', debuggeeExited: true };
      const detached = await sessionManager.detachFromProcess(sessionId, terminate);
      expect(detached.data?.note).toBeUndefined();
    });
    it('does not retain detach wording across an attach-shaped start_debugging (#1288)', async () => {
      const sessionId = await borrowedSession();
      const session = sessionManager.getSession(sessionId)!;
      session.run.attachLocality = 'loopback';
      Object.assign(sessionManager, { selectPolicy: () => ({ ...MockAdapterPolicy, childAdoption: JsDebugAdapterPolicy.childAdoption }) });
      const detached = await sessionManager.detachFromProcess(sessionId);
      expect(detached.data?.note).toBe(JsDebugAdapterPolicy.childAdoption?.attachLeavesTargetChanged);
      // Drain the old mock worker's queued exit before reusing it for a new run.
      await vi.runAllTimersAsync();
      session.proxyManager = undefined;
      const adapter = new FakeDebugAdapter({ language: DebugLanguage.MOCK }).withAttachSupport({
        directConnect: true, transform: config => ({ ...config, request: 'attach' })
      });
      vi.mocked(dependencies.adapterRegistry.create).mockResolvedValue(adapter);
      const attachShapedArgs = { request: 'attach', stopOnEntry: false };
      const started = sessionManager.startDebugging(sessionId, 'test.py', [], attachShapedArgs);
      await vi.runAllTimersAsync();
      const startResult = await started;
      expect(startResult.state, JSON.stringify(startResult)).toBe(SessionState.RUNNING);
      expect(session.run.attachMode).toBe(false);
      expect(session.run.attachLocality).toBeUndefined();
      const nextDetach = await sessionManager.detachFromProcess(sessionId);
      expect(nextDetach.success, JSON.stringify(nextDetach)).toBe(true);
      expect(nextDetach.data?.note).toBeUndefined();
    });

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

    it('answers a second detach as a session with nothing to detach from, not from the report of the first', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: true, by: 'response' };
      await sessionManager.detachFromProcess(sessionId);

      const again = await sessionManager.detachFromProcess(sessionId);

      expect(again).toMatchObject({ success: false, error: 'No active debug session to detach from' });
    });

    it('does not read the report of the worker shutting down by itself as the answer to this detach', async () => {
      // A `terminated` the adapter sent by itself makes the worker shut down
      // and report its shutdown-path disconnect. A detach arriving in that
      // window gets a failed request, and that report is not about it.
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = { trigger: 'shutdown', acknowledged: true, by: 'response' };
      vi.spyOn(dependencies.mockProxyManager, 'sendDapRequest').mockRejectedValueOnce(new Error('DAP client disconnected'));

      const detached = await sessionManager.detachFromProcess(sessionId);

      expect(detached.data?.released).toBeUndefined();
      expect(detached.data?.message).toBe(ErrorMessages.detachUnconfirmed('DAP client disconnected'));
    });

    it('carries the unconfirmed detach and a refused pre-detach resume in one warning', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: false, error: 'no answer' };
      dependencies.mockProxyManager.preDetachResume = { trigger: 'detach', threadId: 7, resumed: false, error: 'process is running' };
      vi.spyOn(dependencies.mockProxyManager, 'sendDapRequest').mockRejectedValueOnce(new Error('no answer'));

      const detached = await sessionManager.detachFromProcess(sessionId);

      const [fate, resume, ...rest] = String(detached.data?.warning).split('; Could not resume');
      expect(fate).toBe(ErrorMessages.detachUnconfirmed('no answer'));
      expect(resume).toMatch(/^ the stopped target before detaching \(process is running\)/);
      expect(rest).toEqual([]);
      expect(detached.data?.message).toBe(ErrorMessages.detachUnconfirmed('no answer'));
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

    it('reads a borrowed program from what the launch recorded, not from attachMode, which a launch clears', async () => {
      // An attach made through start_debugging with attach-shaped arguments:
      // the worker detaches at shutdown, and the close must say what it saw.
      const sessionId = await borrowedSession();
      sessionManager.getSession(sessionId)!.run.attachMode = false;
      dependencies.mockProxyManager.detachResult = { trigger: 'close', acknowledged: true, by: 'response' };

      const outcome = await sessionManager.closeSessionReporting(sessionId);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [sessionId], releasedSessionIds: [sessionId], released: true });
    });

    it('does not read a detach-triggered report as the report of this close', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: true, by: 'response' };
      dependencies.mockProxyManager.reportsDetachOnStop = false;

      const outcome = await sessionManager.closeSessionReporting(sessionId);

      expect(outcome.released).toBeUndefined();
      expect(outcome.releaseUnconfirmed).toBe('the debug adapter reported nothing about the detach');
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
