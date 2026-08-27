/**
 * SessionManager worker-reap tests (issue #502)
 *
 * The HTTP stale-session reaper leak: terminal event handlers cleared
 * session.proxyManager before a fire-and-forget stop(), so closeSession could
 * report success while the worker was still dying — or failing to die — and
 * nothing retained the worker pid to verify the kill after the fact.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

describe('SessionManager - worker reap guarantees (issue #502)', () => {
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

  async function startSession(): Promise<string> {
    const session = await sessionManager.createSession({
      language: DebugLanguage.MOCK,
      pythonPath: 'python'
    });
    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    return session.id;
  }

  it('reaps the worker on a status-driven exit (worker claims dead; OS process may be alive)', async () => {
    await startSession();
    const mockProxy = dependencies.mockProxyManager;

    // The 3-arg 'exit' (expected defined) is emitted from a worker STATUS
    // message — the worker reported termination over IPC, but its OS process
    // may still be alive (e.g. stranded mid-shutdown). It must be stopped
    // like the other terminal events, not just dereferenced.
    mockProxy.simulateEvent('exit', 0, undefined, true);
    await vi.runAllTimersAsync();

    expect(mockProxy.stopCalls).toBe(1);
  });

  it('does not stop() on a real child-process exit (2-arg form; process already gone)', async () => {
    await startSession();
    const mockProxy = dependencies.mockProxyManager;

    mockProxy.simulateExit(0);
    await vi.runAllTimersAsync();

    expect(mockProxy.stopCalls).toBe(0);
  });

  it('closeSession awaits the in-flight stop started by a terminal handler', async () => {
    const sessionId = await startSession();
    const mockProxy = dependencies.mockProxyManager;

    let resolveStop!: () => void;
    const stopMock = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveStop = resolve; })
    );
    mockProxy.stop = stopMock;

    // Terminal handler clears session.proxyManager and fires stop() —
    // which we hold open.
    mockProxy.simulateEvent('terminated');
    expect(stopMock).toHaveBeenCalledTimes(1);

    let closed = false;
    const closePromise = sessionManager.closeSession(sessionId).then((result) => {
      closed = true;
      return result;
    });

    // Give closeSession every chance to (incorrectly) finish early.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(closed).toBe(false);

    resolveStop();
    await expect(closePromise).resolves.toBe(true);
    // No second stop: the pending one was awaited, not re-issued.
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('logs an error naming the worker pid when it is still alive after close', async () => {
    const sessionId = await startSession();
    const mockProxy = dependencies.mockProxyManager;
    mockProxy.proxyPid = 31337;

    // Liveness seam: pretend the worker survived the teardown.
    (sessionManager as unknown as { pidLivenessCheck: (pid: number) => boolean })
      .pidLivenessCheck = () => true;

    await sessionManager.closeSession(sessionId);
    await vi.advanceTimersByTimeAsync(1500);

    const errorCalls = (dependencies.mockLogger.error as ReturnType<typeof vi.fn>).mock.calls;
    const leakLine = errorCalls.find((call) =>
      typeof call[0] === 'string' && call[0].includes('31337') && call[0].includes('leaked worker')
    );
    expect(leakLine).toBeDefined();
  });

  it('warns when the status-driven exit reap itself fails', async () => {
    await startSession();
    const mockProxy = dependencies.mockProxyManager;
    mockProxy.stop = vi.fn().mockRejectedValue(new Error('stop exploded'));

    mockProxy.simulateEvent('exit', 0, undefined, true);
    await vi.runAllTimersAsync();

    const warnCalls = (dependencies.mockLogger.warn as ReturnType<typeof vi.fn>).mock.calls;
    expect(warnCalls.some((call) =>
      typeof call[0] === 'string' && call[0].includes("Error stopping proxy after 'exit'")
    )).toBe(true);
  });

  it('stopProxyPreservingSession awaits a pending stop and survives cleanup/stop failures', async () => {
    const sessionId = await startSession();
    const mockProxy = dependencies.mockProxyManager;
    const managed = sessionManager.getSession(sessionId)!;

    // Both failure paths at once: listener cleanup throws, stop() rejects,
    // and a terminal handler left a pending stop behind.
    (sessionManager as unknown as { cleanupProxyEventHandlers: () => void })
      .cleanupProxyEventHandlers = () => { throw new Error('cleanup boom'); };
    mockProxy.stop = vi.fn().mockRejectedValue(new Error('stop boom'));
    let pendingResolved = false;
    managed.pendingProxyStop = Promise.resolve().then(() => { pendingResolved = true; });

    await (sessionManager as unknown as {
      stopProxyPreservingSession: (s: typeof managed) => Promise<void>;
    }).stopProxyPreservingSession(managed);

    expect(managed.proxyManager).toBeUndefined();
    expect(managed.pendingProxyStop).toBeUndefined();
    expect(pendingResolved).toBe(true);
    const errorCalls = (dependencies.mockLogger.error as ReturnType<typeof vi.fn>).mock.calls;
    expect(errorCalls.some((call) =>
      typeof call[0] === 'string' && call[0].includes('Error during listener cleanup')
    )).toBe(true);
    expect(errorCalls.some((call) =>
      typeof call[0] === 'string' && call[0].includes('Error stopping proxy for session')
    )).toBe(true);
  });

  it('stays silent when the worker is confirmed dead after close', async () => {
    const sessionId = await startSession();
    const mockProxy = dependencies.mockProxyManager;
    mockProxy.proxyPid = 31337;

    (sessionManager as unknown as { pidLivenessCheck: (pid: number) => boolean })
      .pidLivenessCheck = () => false;

    await sessionManager.closeSession(sessionId);
    await vi.advanceTimersByTimeAsync(1500);

    const errorCalls = (dependencies.mockLogger.error as ReturnType<typeof vi.fn>).mock.calls;
    const leakLine = errorCalls.find((call) =>
      typeof call[0] === 'string' && call[0].includes('leaked worker')
    );
    expect(leakLine).toBeUndefined();
  });
});
