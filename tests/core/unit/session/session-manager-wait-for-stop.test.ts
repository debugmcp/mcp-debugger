/**
 * SessionManager.waitForStop (issue #849): block until the session next pauses
 * or ends, bounded by the caller's timeout, and answer from the session as it
 * is when the wait settles.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';
import { SessionNotFoundError } from '../../../../src/errors/debug-errors.js';
import type { DebugResult, WaitForStopResultData } from '../../../../src/session/session-manager-core.js';

describe('SessionManager - waitForStop (issue #849)', () => {
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

  /** A launched session whose program is running: nothing has stopped it. */
  async function runningSession(): Promise<string> {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
    const started = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    expect((await started).state).toBe(SessionState.RUNNING);
    return session.id;
  }

  /**
   * Past the short settle a stop is given before its stack is read (the same
   * 10 ms a step or a pause allows), so the answer has been assembled.
   */
  const afterStop = () => vi.advanceTimersByTimeAsync(20);

  /** Start a wait and expose whether it has answered yet. */
  function track(pending: Promise<DebugResult<WaitForStopResultData>>) {
    let result: DebugResult<WaitForStopResultData> | undefined;
    void pending.then((settled) => { result = settled; });
    return { result: () => result };
  }

  it('refuses a session that was never started', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });

    const result = await sessionManager.waitForStop(session.id);

    expect(result.success).toBe(false);
    expect(result.state).toBe(SessionState.CREATED);
    expect(result.error).toMatch(/has not been started/);
    expect(result.error).toMatch(/start_debugging/);
  });

  it('answers at once with the current stop when the session is already paused', async () => {
    const sessionId = await runningSession();
    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');

    const result = await sessionManager.waitForStop(sessionId);

    expect(result.success).toBe(true);
    expect(result.state).toBe(SessionState.PAUSED);
    expect(result.data?.lastStop).toMatchObject({ reason: 'breakpoint', threadId: 1 });
    expect(result.data?.location).toMatchObject({ file: 'test.py', line: 10 });
    expect(result.data?.pending).toBeUndefined();
    expect(result.data?.message).toMatch(/breakpoint/);
  });

  it('resolves with the stop that arrives while it waits', async () => {
    const sessionId = await runningSession();
    const wait = track(sessionManager.waitForStop(sessionId, 10_000));
    await vi.advanceTimersByTimeAsync(50);
    expect(wait.result()).toBeUndefined();

    dependencies.mockProxyManager.simulateStopped(1, 'exception', { reason: 'exception', description: 'ValueError: boom', threadId: 1 });
    await afterStop();

    expect(wait.result()).toMatchObject({ success: true, state: SessionState.PAUSED });
    expect(wait.result()?.data?.lastStop).toMatchObject({ reason: 'exception', description: 'ValueError: boom' });
  });

  it('does not report an entry stop the core auto-continues', async () => {
    const sessionId = await runningSession();
    const wait = track(sessionManager.waitForStop(sessionId, 10_000));

    // stopOnEntry is false: the core resumes an 'entry' stop itself.
    dependencies.mockProxyManager.simulateStopped(1, 'entry');
    await vi.advanceTimersByTimeAsync(0);
    expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.RUNNING);
    expect(wait.result()).toBeUndefined();

    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
    await afterStop();
    expect(wait.result()?.data?.lastStop).toMatchObject({ reason: 'breakpoint' });
  });

  it('answers pending when its timeout passes with the program still running', async () => {
    const sessionId = await runningSession();
    const wait = track(sessionManager.waitForStop(sessionId, 2_000));

    await vi.advanceTimersByTimeAsync(1_999);
    expect(wait.result()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);

    expect(wait.result()).toMatchObject({ success: true, state: SessionState.RUNNING });
    expect(wait.result()?.data?.pending).toBe(true);
    expect(wait.result()?.data?.message).toMatch(/still running after 2s/);
    expect(wait.result()?.data?.message).toMatch(/wait_for_stop/);
    // Nothing is armed here, so no pause is promised.
    expect(wait.result()?.data?.message).toMatch(/no breakpoint or caught-exception filter is armed/);
    expect(wait.result()?.data?.message).not.toMatch(/stays? armed/);
    expect(wait.result()?.data?.lastStop).toBeUndefined();
  });

  it('names what is armed when its timeout passes with a breakpoint not yet reached', async () => {
    const sessionId = await runningSession();
    await sessionManager.setBreakpoint(sessionId, { file: 'test.py', line: 5 });
    const wait = track(sessionManager.waitForStop(sessionId, 2_000));

    await vi.advanceTimersByTimeAsync(2_000);

    expect(wait.result()?.data?.pending).toBe(true);
    expect(wait.result()?.data?.message).toMatch(/without reaching 1 breakpoint\(s\)/);
    expect(wait.result()?.data?.message).toMatch(/Nothing was cancelled/);
    expect(wait.result()?.data?.message).toMatch(/stays armed/);
  });

  it('waits 30 s by default', async () => {
    const sessionId = await runningSession();
    const wait = track(sessionManager.waitForStop(sessionId));

    await vi.advanceTimersByTimeAsync(29_999);
    expect(wait.result()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);

    expect(wait.result()?.data?.pending).toBe(true);
  });

  it('reports the program ending, with its exit code', async () => {
    const sessionId = await runningSession();
    const wait = track(sessionManager.waitForStop(sessionId, 10_000));

    dependencies.mockProxyManager.simulateExited(3);
    await vi.advanceTimersByTimeAsync(0);

    expect(wait.result()).toMatchObject({ success: true, state: SessionState.STOPPED });
    expect(wait.result()?.data?.exitCode).toBe(3);
    expect(wait.result()?.data?.message).toMatch(/exited with code 3/);
    expect(wait.result()?.data?.pending).toBeUndefined();
  });

  it('answers a finished session at once', async () => {
    const sessionId = await runningSession();
    dependencies.mockProxyManager.simulateExited(0);

    const result = await sessionManager.waitForStop(sessionId, 10_000);

    expect(result).toMatchObject({ success: true, state: SessionState.STOPPED });
    expect(result.data?.exitCode).toBe(0);
    expect(result.data?.message).toMatch(/ran to completion/);
  });

  it('reports a session whose proxy died as ended in error', async () => {
    const sessionId = await runningSession();
    const wait = track(sessionManager.waitForStop(sessionId, 10_000));

    dependencies.mockProxyManager.simulateExit(1);
    await vi.advanceTimersByTimeAsync(0);

    expect(wait.result()).toMatchObject({ success: true, state: SessionState.ERROR });
    expect(wait.result()?.data?.message).toMatch(/error/i);
  });

  it.each([0, -5, Number.NaN])('rejects the invalid timeout %s', async (timeout) => {
    const sessionId = await runningSession();

    const result = await sessionManager.waitForStop(sessionId, timeout);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid 'timeout'/);
    expect(result.state).toBe(SessionState.RUNNING);
  });

  it('releases the wait when the caller aborts', async () => {
    const sessionId = await runningSession();
    const controller = new AbortController();
    const wait = track(sessionManager.waitForStop(sessionId, 10_000, controller.signal));
    await vi.advanceTimersByTimeAsync(10);

    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(wait.result()).toMatchObject({ success: true, state: SessionState.RUNNING });
    expect(wait.result()?.data?.pending).toBe(true);
  });

  it('reports a session that is closed while it waits', async () => {
    const sessionId = await runningSession();
    const wait = track(sessionManager.waitForStop(sessionId, 10_000));
    await vi.advanceTimersByTimeAsync(10);

    await sessionManager.closeSession(sessionId);
    await vi.advanceTimersByTimeAsync(0);

    expect(wait.result()?.success).toBe(false);
    expect(wait.result()?.error).toMatch(/closed while waiting/);
  });

  it('throws SessionNotFoundError for an unknown session', async () => {
    await expect(sessionManager.waitForStop('no-such-session')).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it('serves several waiters on one session', async () => {
    const sessionId = await runningSession();
    const first = track(sessionManager.waitForStop(sessionId, 10_000));
    const second = track(sessionManager.waitForStop(sessionId, 10_000));

    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
    await afterStop();

    expect(first.result()?.state).toBe(SessionState.PAUSED);
    expect(second.result()?.state).toBe(SessionState.PAUSED);
  });
});
