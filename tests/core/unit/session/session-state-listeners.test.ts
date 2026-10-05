/**
 * The per-session state listeners behind OperationsContext.onStateChange
 * (issue #849): told on every transition of their own session and on its
 * removal, silent once unsubscribed, and never able to break a transition.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';
import { internals } from '../../../test-utils/helpers/operations-internals.js';

describe('SessionManager - state listeners (issue #849)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    sessionManager = new SessionManager(
      { logDirBase: '/tmp/test-sessions', defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true } },
      dependencies
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  const subscribe = (sessionId: string, listener: () => void) =>
    internals(sessionManager).opsContext.onStateChange(sessionId, listener);

  async function runningSession(): Promise<string> {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
    const started = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    expect((await started).state).toBe(SessionState.RUNNING);
    return session.id;
  }

  it('tells a listener about each state change of its own session only', async () => {
    const watched = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
    const other = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
    const seen: SessionState[] = [];
    subscribe(watched.id, () => { seen.push(sessionManager.getSession(watched.id)!.state); });
    const elsewhere = vi.fn();
    subscribe(other.id, elsewhere);

    const started = sessionManager.startDebugging(watched.id, 'test.py', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    await started;
    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');

    expect(seen).toEqual([SessionState.INITIALIZING, SessionState.RUNNING, SessionState.PAUSED]);
    expect(elsewhere).not.toHaveBeenCalled();
  });

  it('shows the auto-continued entry stop as two changes inside one stopped event', async () => {
    const sessionId = await runningSession();
    const seen: SessionState[] = [];
    subscribe(sessionId, () => { seen.push(sessionManager.getSession(sessionId)!.state); });

    dependencies.mockProxyManager.simulateStopped(1, 'entry');

    // Both happened before simulateStopped returned: this is the transient
    // waitForSessionState defers its read past.
    expect(seen).toEqual([SessionState.PAUSED, SessionState.RUNNING]);
  });

  it('stops telling a listener once it has unsubscribed', async () => {
    const sessionId = await runningSession();
    const listener = vi.fn();
    const unsubscribe = subscribe(sessionId, listener);

    unsubscribe();
    unsubscribe(); // idempotent
    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');

    expect(listener).not.toHaveBeenCalled();
  });

  it('completes the transition and tells the other listeners when one throws', async () => {
    const sessionId = await runningSession();
    const after = vi.fn();
    subscribe(sessionId, () => { throw new Error('listener boom'); });
    subscribe(sessionId, after);

    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');

    expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.PAUSED);
    expect(after).toHaveBeenCalledTimes(1);
    expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('listener boom'));
  });

  it('tells listeners when the session is closed, after it has left the store', async () => {
    const sessionId = await runningSession();
    const present: boolean[] = [];
    subscribe(sessionId, () => { present.push(sessionManager.getSession(sessionId) !== undefined); });

    await sessionManager.closeSession(sessionId);

    // Once for the transition to STOPPED (still stored), once for the removal.
    expect(present).toEqual([true, false]);
  });
});
