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
import { noAnswerWithin } from '../../../../src/session/attach/target-release.js';
import type { InFlightGuard } from '../../../../src/session/in-flight-guard.js';
import { DebugLanguage, SessionState, JsDebugAdapterPolicy, MockAdapterPolicy } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';
import { ErrorMessages } from '../../../../src/utils/error-messages.js';
import { FakeDebugAdapter } from '../../../test-utils/fakes/fake-debug-adapter.js';
import { attachLocalityOf } from '../../../../src/session/attach/attach-addressing.js';
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

    it('omits the persistence note when adapterConfig.host selects a remote target (#1288)', async () => {
      const sessionId = await borrowedSession();
      const session = sessionManager.getSession(sessionId)!;
      session.language = DebugLanguage.JAVASCRIPT;
      session.run.attachLocality = attachLocalityOf({ port: 9229,
        adapterConfig: { host: 'remote.example', autoAttachChildProcesses: true } });
      expect(session.run.attachLocality).toBe('remote');
      const detached = await sessionManager.detachFromProcess(sessionId);
      expect(detached.success).toBe(true);
      expect(detached.data?.note).toBeUndefined();
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
      // A timeout is stated as the bound that expired (issue #1325).
      expect(detached.data?.message).toBe(ErrorMessages.detachUnconfirmed(noAnswerWithin(10_000)));
      expect(detached.data?.warning).toBe(ErrorMessages.detachUnconfirmed(noAnswerWithin(10_000)));
      expect(detached.data?.message).toMatch(/not known/);
      expect(detached.data?.message).not.toContain('(process still running)');
    });

    it('says what closing the connection can have done to the target when the release was not confirmed (issue #1325)', async () => {
      const sessionId = await borrowedSession();
      vi.spyOn(dependencies.mockProxyManager, 'sendDapRequest').mockRejectedValueOnce(new Error("Request 'disconnect' timed out after 10s"));

      const detached = await sessionManager.detachFromProcess(sessionId);

      expect(detached.data?.message).toBe(
        'Detached, but the debug adapter did not confirm the release (no answer within 10000 ms). The debugger was stopped ' +
        'anyway, and its connection to the adapter was closed: if the adapter belongs to the target (it was listening ' +
        "before this session attached), the target's debug port may have closed with it. Whether the process is still running is not known"
      );
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

  // Issue #1325: close_debug_session used to leave the release to the
  // worker's shutdown, which gives the adapter 1 s and then closes the
  // connection; an adapter that belongs to the target and answers only once
  // the target is free ends itself when its client leaves first. The tool's
  // close now sends the release detach_from_process sends, before the worker
  // is stopped. The closes above (the server's exit, the idle policy) keep
  // the worker's own detach.
  describe("close_debug_session's own release (issue #1325)", () => {
    const close = (sessionId: string) => sessionManager.closeDebugSession(sessionId);
    /** Make the release request itself fail, the way a worker answers a detach that got no answer. */
    const failRelease = (message: string): void => {
      dependencies.mockProxyManager.setDapRequestHandler(async (command) => {
        if (command === 'disconnect') {
          throw new Error(message);
        }
        return { success: true };
      });
    };

    it('sends the request and bound detach_from_process uses, before the worker is stopped', async () => {
      const sessionId = await borrowedSession();
      const mock = dependencies.mockProxyManager;
      let stopsWhenReleased: number | undefined;
      mock.setDapRequestHandler(async (command) => {
        if (command === 'disconnect') {
          stopsWhenReleased = mock.stopCalls;
        }
        return { success: true };
      });

      const outcome = await close(sessionId);

      expect(mock.dapRequestCalls.filter((call) => call.command === 'disconnect')).toEqual([
        { command: 'disconnect', args: { terminateDebuggee: false }, options: { timeoutMs: 10_000 } }
      ]);
      expect(stopsWhenReleased).toBe(0);
      expect(mock.stopCalls).toBe(1);
      expect(outcome).toEqual({ closed: true, closedSessionIds: [sessionId], releasedSessionIds: [sessionId], released: true });
    });

    it('says released when the adapter acknowledged it by terminated in reply', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: true, by: 'terminated' };
      failRelease('DAP client disconnected');

      const outcome = await close(sessionId);

      expect(outcome.released).toBe(true);
    });

    it('states an expired bound as the bound, and does not say released', async () => {
      const sessionId = await borrowedSession();
      const timeout = "Request 'disconnect' timed out after 10s";
      dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: false, error: timeout };
      failRelease(timeout);

      const outcome = await close(sessionId);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [sessionId], releaseUnconfirmed: 'no answer within 10000 ms' });
    });

    it('states the bound when the request timed out before any report of it came (measured order)', async () => {
      // The worker's request tracker answers the timeout first; its report of
      // the detach can come after the close has read it, or not at all.
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.reportsDetachOnStop = false;
      failRelease("Request 'disconnect' timed out after 10s");

      const outcome = await close(sessionId);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [sessionId], releaseUnconfirmed: 'no answer within 10000 ms' });
    });

    it('carries any other failure as it came', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: false, error: 'the adapter refused' };
      failRelease('the adapter refused');

      const outcome = await close(sessionId);

      expect(outcome.releaseUnconfirmed).toBe('the adapter refused');
      expect(outcome.released).toBeUndefined();
    });

    it('says the program ended when the adapter reported its exit', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: true, by: 'response', debuggeeExited: true };

      const outcome = await close(sessionId);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [sessionId], processEnded: true });
    });

    it("falls back to the worker's own detach when the release never reached the worker", async () => {
      // The proxy refused the request before the worker saw it: the worker's
      // shutdown detaches by itself, and its report is the close's answer.
      const sessionId = await borrowedSession();
      failRelease('Proxy not initialized');

      const outcome = await close(sessionId);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [sessionId], releasedSessionIds: [sessionId], released: true });
    });

    it("falls back to the worker's own detach when that one reported the program's exit", async () => {
      // The release failed (the worker was already going down by itself);
      // the worker's own disconnect saw the program exit: the close says so.
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.detachResult = { trigger: 'shutdown', acknowledged: true, by: 'response', debuggeeExited: true };
      failRelease('DAP client disconnected');

      const outcome = await close(sessionId);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [sessionId], processEnded: true });
    });

    it('leaves the release to the worker while the attach handshake is not done (initializing)', async () => {
      const sessionId = await borrowedSession();
      sessionManager.getSession(sessionId)!.state = SessionState.INITIALIZING;

      const outcome = await close(sessionId);

      expect(dependencies.mockProxyManager.dapRequestCalls.some((call) => call.command === 'disconnect')).toBe(false);
      expect(outcome.released).toBe(true);
    });

    it('sends the release for a paused session as for a running one', async () => {
      const sessionId = await borrowedSession();
      sessionManager.getSession(sessionId)!.state = SessionState.PAUSED;

      const outcome = await close(sessionId);

      expect(dependencies.mockProxyManager.dapRequestCalls.filter((call) => call.command === 'disconnect')).toEqual([
        { command: 'disconnect', args: { terminateDebuggee: false }, options: { timeoutMs: 10_000 } }
      ]);
      expect(outcome.released).toBe(true);
    });

    it('sends the release once the session runs, though attach_to_process has not returned yet, and is not refused by it', async () => {
      // The boundary is the session's state, not the attach call (issue
      // #1325): the port depends on the live connection. A close is never
      // refused; with the attach's claim held it goes ahead without one.
      const sessionId = await borrowedSession();
      const guard = (sessionManager as unknown as { inFlight: InFlightGuard }).inFlight;
      expect(guard.tryAcquire(sessionId, 'attach', 'attach_to_process')).toBeUndefined();

      const outcome = await close(sessionId);

      expect(dependencies.mockProxyManager.dapRequestCalls.filter((call) => call.command === 'disconnect')).toHaveLength(1);
      expect(outcome).toMatchObject({ closed: true, released: true });
      // The attach's claim is still the attach's: the close took none.
      expect(guard.current(sessionId)).toBe('attach');
      guard.release(sessionId);
    });

    it('says stopping the worker failed, and why, instead of saying the connection was closed', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.reportsDetachOnStop = false;
      failRelease("Request 'disconnect' timed out after 10s");
      vi.spyOn(dependencies.mockProxyManager, 'stop').mockRejectedValueOnce(new Error('kill EPERM'));

      const outcome = await close(sessionId);

      expect(outcome).toEqual({
        closed: true,
        closedSessionIds: [sessionId],
        releaseUnconfirmed: 'no answer within 10000 ms',
        stopFailed: 'kill EPERM'
      });
    });

    it('sends no release for a program the session launched', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      const started = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
      await vi.runAllTimersAsync();
      await started;

      const outcome = await close(session.id);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [session.id] });
      expect(dependencies.mockProxyManager.dapRequestCalls.some((call) => call.command === 'disconnect')).toBe(false);
    });

    it("leaves the server's exit and the idle policy on the worker's own detach", async () => {
      const exiting = await borrowedSession();
      await sessionManager.closeAllSessions();
      expect(sessionManager.getSession(exiting)).toBeUndefined();
      expect(dependencies.mockProxyManager.dapRequestCalls.some((call) => call.command === 'disconnect')).toBe(false);
    });
  });

  // Issue #1325, the review's P1: a close that arrived while a detach waited
  // for its answer sent a second `disconnect` on the same connection, which
  // ended debugpy's adapter and the target's debug port with it, and both
  // calls said released. For one session at most one ending is in flight; an
  // ending that arrives meanwhile joins it and sends nothing of its own.
  describe('overlapping endings (issue #1325)', () => {
    const disconnects = () => dependencies.mockProxyManager.dapRequestCalls.filter((call) => call.command === 'disconnect');
    /** Hold every disconnect until the returned function is called, the way a busy target does. */
    const holdDisconnects = (): (() => void) => {
      let letGo!: () => void;
      const held = new Promise<void>((resolve) => { letGo = resolve; });
      dependencies.mockProxyManager.setDapRequestHandler(async (command) => {
        if (command === 'disconnect') {
          await held;
        }
        return { success: true };
      });
      return letGo;
    };
    /** Track whether a call has answered yet. */
    const tracked = <T>(call: Promise<T>) => {
      const state = { answered: false };
      void call.then(() => { state.answered = true; }, () => { state.answered = true; });
      return { call, state };
    };
    const firstDisconnectSent = () => vi.waitFor(() => expect(disconnects()).toHaveLength(1));

    it('close during detach: the close sends nothing, waits for the detach, and says what its release observed', async () => {
      const sessionId = await borrowedSession();
      const letGo = holdDisconnects();

      const detach = tracked(sessionManager.detachFromProcess(sessionId));
      await firstDisconnectSent();
      const close = tracked(sessionManager.closeDebugSession(sessionId));
      await vi.advanceTimersByTimeAsync(50);
      expect(disconnects()).toHaveLength(1);
      expect(detach.state.answered).toBe(false);
      expect(close.state.answered).toBe(false);

      letGo();
      const [detached, closed] = await Promise.all([detach.call, close.call]);

      expect(detached).toEqual({
        success: true,
        state: SessionState.STOPPED,
        data: { message: ErrorMessages.detachReleased(), released: true }
      });
      expect(closed).toEqual({ closed: true, closedSessionIds: [sessionId], releasedSessionIds: [sessionId], released: true });
      expect(disconnects()).toHaveLength(1);
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });

    it("close during detach: an unconfirmed release is the close's warning too", async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.reportsDetachOnStop = false;
      let letGo!: () => void;
      const held = new Promise<void>((resolve) => { letGo = resolve; });
      dependencies.mockProxyManager.setDapRequestHandler(async (command) => {
        if (command === 'disconnect') {
          await held;
          throw new Error("Request 'disconnect' timed out after 10s");
        }
        return { success: true };
      });

      const detach = sessionManager.detachFromProcess(sessionId);
      await firstDisconnectSent();
      const close = sessionManager.closeDebugSession(sessionId);
      letGo();
      const [detached, closed] = await Promise.all([detach, close]);

      expect(detached.data?.warning).toBe(ErrorMessages.detachUnconfirmed(noAnswerWithin(10_000)));
      expect(closed).toEqual({ closed: true, closedSessionIds: [sessionId], releaseUnconfirmed: 'no answer within 10000 ms' });
      expect(disconnects()).toHaveLength(1);
    });

    it("close during detach: a detach that saw the program exit is the close's processEnded", async () => {
      const sessionId = await borrowedSession();
      const letGo = holdDisconnects();
      dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: true, by: 'response', debuggeeExited: true };

      const detach = sessionManager.detachFromProcess(sessionId);
      await firstDisconnectSent();
      const close = sessionManager.closeDebugSession(sessionId);
      letGo();
      const [detached, closed] = await Promise.all([detach, close]);

      expect(detached.data).toEqual({ message: ErrorMessages.detachProgramEnded(), processEnded: true });
      expect(closed).toEqual({ closed: true, closedSessionIds: [sessionId], processEnded: true });
      expect(disconnects()).toHaveLength(1);
    });

    it("detach during close: the detach sends nothing, and answers from the close's release, saying whose it was", async () => {
      const sessionId = await borrowedSession();
      const letGo = holdDisconnects();

      const close = tracked(sessionManager.closeDebugSession(sessionId));
      await firstDisconnectSent();
      const detach = tracked(sessionManager.detachFromProcess(sessionId));
      await vi.advanceTimersByTimeAsync(50);
      expect(disconnects()).toHaveLength(1);
      expect(close.state.answered).toBe(false);
      expect(detach.state.answered).toBe(false);

      letGo();
      const [closed, detached] = await Promise.all([close.call, detach.call]);

      expect(closed).toEqual({ closed: true, closedSessionIds: [sessionId], releasedSessionIds: [sessionId], released: true });
      expect(detached).toEqual({
        success: true,
        state: SessionState.STOPPED,
        data: { message: ErrorMessages.detachJoinedClose(ErrorMessages.detachReleased()), released: true }
      });
      expect(detached.data?.message).toBe(
        'Detached from process: the debug adapter confirmed the detach, and the process was left running. ' +
        'The release was the one the close_debug_session already in progress sent; that close also removed the session'
      );
      expect(disconnects()).toHaveLength(1);
    });

    it('detach during close: a close that saw the program exit, in a detach\'s words', async () => {
      const sessionId = await borrowedSession();
      const letGo = holdDisconnects();
      dependencies.mockProxyManager.detachResult = { trigger: 'detach', acknowledged: true, by: 'response', debuggeeExited: true };

      const closing = sessionManager.closeDebugSession(sessionId);
      await firstDisconnectSent();
      const detaching = sessionManager.detachFromProcess(sessionId);
      letGo();

      expect((await closing).processEnded).toBe(true);
      expect(await detaching).toEqual({
        success: true,
        state: SessionState.STOPPED,
        data: { message: ErrorMessages.detachJoinedClose(ErrorMessages.detachProgramEnded()), processEnded: true }
      });
    });

    it('detach during close: an unanswered release whose worker also failed to stop is not called closed', async () => {
      const sessionId = await borrowedSession();
      dependencies.mockProxyManager.reportsDetachOnStop = false;
      let letGo!: () => void;
      const held = new Promise<void>((resolve) => { letGo = resolve; });
      dependencies.mockProxyManager.setDapRequestHandler(async (command) => {
        if (command === 'disconnect') {
          await held;
          throw new Error("Request 'disconnect' timed out after 10s");
        }
        return { success: true };
      });
      vi.spyOn(dependencies.mockProxyManager, 'stop').mockRejectedValueOnce(new Error('kill EPERM'));

      const closing = sessionManager.closeDebugSession(sessionId);
      await firstDisconnectSent();
      const detaching = sessionManager.detachFromProcess(sessionId);
      letGo();

      expect(await closing).toMatchObject({ releaseUnconfirmed: 'no answer within 10000 ms', stopFailed: 'kill EPERM' });
      const detached = await detaching;
      const unconfirmed = ErrorMessages.detachJoinedClose(ErrorMessages.closeReleaseUnconfirmed('no answer within 10000 ms', 'kill EPERM'));
      expect(detached).toEqual({ success: true, state: SessionState.STOPPED, data: { message: unconfirmed, warning: unconfirmed } });
      expect(detached.data?.message).not.toContain('The connection to the adapter was closed');
    });

    it('close during close: one release, and the same answer for both', async () => {
      const sessionId = await borrowedSession();
      const letGo = holdDisconnects();

      const first = sessionManager.closeDebugSession(sessionId);
      await firstDisconnectSent();
      const second = sessionManager.closeDebugSession(sessionId);
      await vi.advanceTimersByTimeAsync(50);
      expect(disconnects()).toHaveLength(1);

      letGo();
      const [a, b] = await Promise.all([first, second]);

      expect(a).toEqual({ closed: true, closedSessionIds: [sessionId], releasedSessionIds: [sessionId], released: true });
      expect(b).toEqual(a);
      expect(disconnects()).toHaveLength(1);
      expect(dependencies.mockProxyManager.stopCalls).toBe(1);
    });

    it('detach during detach: one release, and the same answer for both', async () => {
      const sessionId = await borrowedSession();
      const letGo = holdDisconnects();

      const first = sessionManager.detachFromProcess(sessionId);
      await firstDisconnectSent();
      const second = sessionManager.detachFromProcess(sessionId);
      await vi.advanceTimersByTimeAsync(50);
      expect(disconnects()).toHaveLength(1);

      letGo();
      const [a, b] = await Promise.all([first, second]);

      expect(a).toEqual({ success: true, state: SessionState.STOPPED, data: { message: ErrorMessages.detachReleased(), released: true } });
      expect(b).toEqual(a);
      expect(disconnects()).toHaveLength(1);
    });

    it('a terminating detach neither joins a release nor is joined by one: it is refused and sends nothing', async () => {
      const sessionId = await borrowedSession();
      const letGo = holdDisconnects();

      const close = sessionManager.closeDebugSession(sessionId);
      await firstDisconnectSent();
      const terminating = await sessionManager.detachFromProcess(sessionId, true);

      expect(terminating).toMatchObject({ success: false, error: ErrorMessages.operationInFlight('close', 'detach_from_process') });
      expect(disconnects()).toHaveLength(1);
      letGo();
      await close;
    });

    it('a plain detach during a terminating one is refused; a close during it answers the close the detach made', async () => {
      const sessionId = await borrowedSession();
      const letGo = holdDisconnects();

      const terminating = sessionManager.detachFromProcess(sessionId, true);
      await firstDisconnectSent();
      const plain = await sessionManager.detachFromProcess(sessionId);
      const close = sessionManager.closeDebugSession(sessionId);

      expect(plain).toMatchObject({ success: false, error: ErrorMessages.operationInFlight('detach', 'detach_from_process') });
      letGo();
      const [ended, closed] = await Promise.all([terminating, close]);

      expect(ended).toMatchObject({ success: true, data: { message: 'Detached and terminated process' } });
      expect(closed).toEqual({ closed: true, closedSessionIds: [sessionId] });
      expect(disconnects()).toEqual([
        expect.objectContaining({ command: 'disconnect', args: { terminateDebuggee: true } })
      ]);
    });

    it('refuses a launch-shaped call while a close releases the target, rather than stopping the worker under it', async () => {
      const sessionId = await borrowedSession();
      const letGo = holdDisconnects();

      const close = sessionManager.closeDebugSession(sessionId);
      await firstDisconnectSent();
      const attach = await sessionManager.attachToProcess(sessionId, { port: 5678 });
      const start = await sessionManager.startDebugging(sessionId, 'test.py');

      for (const refused of [attach, start]) {
        expect(refused.success).toBe(false);
        expect(refused.error).toMatch(/^This session is being closed \(close_debug_session has not returned yet\)/);
      }
      expect(dependencies.mockProxyManager.stopCalls).toBe(0);
      letGo();
      await close;
    });

    it('a close during an attach still in flight is joined by a second close', async () => {
      const sessionId = await borrowedSession();
      const guard = (sessionManager as unknown as { inFlight: InFlightGuard }).inFlight;
      guard.tryAcquire(sessionId, 'attach', 'attach_to_process');
      const letGo = holdDisconnects();

      const first = sessionManager.closeDebugSession(sessionId);
      await firstDisconnectSent();
      const second = sessionManager.closeDebugSession(sessionId);
      letGo();
      const [a, b] = await Promise.all([first, second]);

      expect(b).toEqual(a);
      expect(disconnects()).toHaveLength(1);
      guard.release(sessionId);
    });

    it('an attach still in flight that fails while a close releases the target leaves the teardown to that close', async () => {
      // The close sends the release once the session is paused, before
      // attach_to_process returns. The attach's own failure teardown used to
      // stop the worker then, under the release still waiting for its answer.
      const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      const adapter = new FakeDebugAdapter({ language: DebugLanguage.MOCK }).withAttachSupport({ directConnect: true });
      vi.mocked(dependencies.adapterRegistry.create).mockResolvedValue(adapter);
      const mock = dependencies.mockProxyManager;
      let letGo!: () => void;
      const held = new Promise<void>((resolve) => { letGo = resolve; });
      mock.setDapRequestHandler(async (command) => {
        if (command === 'threads') {
          throw new Error('the target did not answer threads');
        }
        if (command === 'disconnect') {
          await held;
        }
        return { success: true };
      });

      const attach = sessionManager.attachToProcess(session.id, { port: 5678, verifyTimeout: 300 });
      await vi.waitFor(() => expect(mock.dapRequestCalls.some((call) => call.command === 'threads')).toBe(true));
      // The target stops while the attach still verifies: the session is paused.
      mock.emit('stopped', 1, 'pause');
      await vi.waitFor(() => expect(sessionManager.getSession(session.id)!.state).toBe(SessionState.PAUSED));
      const close = sessionManager.closeDebugSession(session.id);
      await firstDisconnectSent();

      // The verification's deadline passes; the attach fails, and must not stop the worker yet.
      await vi.advanceTimersByTimeAsync(2000);
      expect(mock.stopCalls).toBe(0);

      letGo();
      const [attached, closed] = await Promise.all([attach, close]);
      expect(closed).toMatchObject({ closed: true, released: true });
      expect(attached.success).toBe(false);
      expect(disconnects()).toHaveLength(1);
      expect(mock.stopCalls).toBe(1);
    });

    it("forgets the ending once it is over: the session's next ending is its own", async () => {
      const sessionId = await borrowedSession();
      const guard = (sessionManager as unknown as { inFlight: InFlightGuard }).inFlight;

      await sessionManager.detachFromProcess(sessionId);

      expect(guard.ending(sessionId)).toBeUndefined();
      expect(guard.current(sessionId)).toBeUndefined();
      // The row the detach left is closed by a close of its own, which sends nothing: nothing runs.
      expect(await sessionManager.closeDebugSession(sessionId)).toEqual({ closed: true, closedSessionIds: [sessionId] });
      expect(disconnects()).toHaveLength(1);
      expect(guard.ending(sessionId)).toBeUndefined();
    });
  });
});
