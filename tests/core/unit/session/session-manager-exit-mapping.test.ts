/**
 * SessionManager proxy-exit → session-state mapping (issue #258)
 *
 * The proxy's terminal statuses reach SessionManager as an 'exit' event
 * carrying (code, signal, expected). `expected` distinguishes orderly
 * debuggee termination (terminated/exited DAP event seen, or shutdown
 * underway) from an adapter dying or dropping the socket mid-run. A clean
 * or crashing debuggee must land the session in STOPPED — ERROR is
 * reserved for genuine infrastructure failures.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

describe('SessionManager - proxy exit mapping (issue #258)', () => {
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

  /** Create a session and drive it into RUNNING (stopOnEntry: false). */
  async function startRunningSession(): Promise<string> {
    const session = await sessionManager.createSession({
      language: DebugLanguage.MOCK,
      executablePath: 'python'
    });
    await sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.RUNNING);
    return session.id;
  }

  it('maps an expected codeless exit to STOPPED (rdbg closes the socket after terminating)', async () => {
    const sessionId = await startRunningSession();

    dependencies.mockProxyManager.simulateEvent('exit', null, undefined, true);

    expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.STOPPED);
  });

  it('maps an expected non-zero exit to STOPPED and records the debuggee exit code', async () => {
    const sessionId = await startRunningSession();

    // rdbg -c propagates the debuggee's exit status: an unhandled raise is 1
    dependencies.mockProxyManager.simulateEvent('exit', 1, undefined, true);

    const session = sessionManager.getSession(sessionId);
    expect(session?.state).toBe(SessionState.STOPPED);
    expect(session?.exitCode).toBe(1);
  });

  it('maps an unexpected clean exit (code 0) to STOPPED', async () => {
    const sessionId = await startRunningSession();

    dependencies.mockProxyManager.simulateEvent('exit', 0, undefined, false);

    expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.STOPPED);
  });

  it('maps an unexpected codeless exit to ERROR (socket dropped mid-run)', async () => {
    const sessionId = await startRunningSession();

    dependencies.mockProxyManager.simulateEvent('exit', null, undefined, false);

    expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.ERROR);
  });

  it('maps an unexpected non-zero exit to ERROR (adapter died mid-run)', async () => {
    const sessionId = await startRunningSession();

    dependencies.mockProxyManager.simulateEvent('exit', 134, undefined, false);

    const session = sessionManager.getSession(sessionId);
    expect(session?.state).toBe(SessionState.ERROR);
    expect(session?.lastProxyExit).toEqual({ code: 134, signal: undefined, expected: false });
  });

  it('keeps the legacy mapping when expected is absent: clean proxy exit → STOPPED', async () => {
    const sessionId = await startRunningSession();

    dependencies.mockProxyManager.simulateEvent('exit', 0, undefined, undefined);

    expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.STOPPED);
  });

  it('keeps the legacy mapping when expected is absent: proxy crash → ERROR', async () => {
    const sessionId = await startRunningSession();

    dependencies.mockProxyManager.simulateEvent('exit', 1, 'SIGKILL', undefined);

    expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.ERROR);
  });

  it('ignores a late exit after terminated already stopped the session', async () => {
    const sessionId = await startRunningSession();

    dependencies.mockProxyManager.simulateEvent('terminated');
    expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.STOPPED);

    // The trailing status-driven exit (listeners already stripped) must not
    // flip the state to ERROR
    dependencies.mockProxyManager.simulateEvent('exit', 1, undefined, false);

    expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.STOPPED);
  });
});
