/**
 * One launch contract for every adapter (issues #823, #826, #851).
 *
 * `start_debugging` answers when the launched program stops, when it ends, or
 * when a short hold elapses — the same hold whatever is armed and whichever
 * adapter runs the program. A launch that has not stopped answers `running`
 * with `pending: true`, names what is armed at that moment, and points at
 * `wait_for_stop`. Nothing here depends on an adapter policy's opinion of
 * when a session is "ready": that hook is gone.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies, setMockProxyRunning } from './session-manager-test-utils.js';
import { MockProxyManager } from '../../../test-utils/mocks/mock-proxy-manager.js';
import type { DebugResult } from '../../../../src/session/session-manager-core.js';

/** The hold these tests reason about; asserted below so a retune has to look here. */
const HOLD_MS = 1_000;

describe('SessionManager - launch contract (issues #823, #826, #851)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.useFakeTimers();
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

  const proxy = () => dependencies.mockProxyManager;

  async function createSession(language: DebugLanguage = DebugLanguage.MOCK): Promise<string> {
    const session = await sessionManager.createSession({ language, executablePath: 'python' });
    return session.id;
  }

  /** Start a launch without awaiting it, and expose whether it has answered. */
  function launch(sessionId: string, dapLaunchArgs: Record<string, unknown> = {}, script = 'test.py') {
    let result: DebugResult | undefined;
    const promise = sessionManager
      .startDebugging(sessionId, script, [], { stopOnEntry: false, ...dapLaunchArgs })
      .then((settled) => { result = settled; return settled; });
    return { promise, result: () => result };
  }

  const setBreakpointDapCalls = () => proxy().dapRequestCalls.filter((call) => call.command === 'setBreakpoints');

  it('holds for one second by default', () => {
    expect((sessionManager as unknown as { launchHoldMs: number }).launchHoldMs).toBe(HOLD_MS);
  });

  it('answers paused, with the reason, for a breakpoint reached inside the hold', async () => {
    const sessionId = await createSession();
    await sessionManager.setBreakpoint(sessionId, { file: 'test.py', line: 5 });
    const started = launch(sessionId);
    await vi.advanceTimersByTimeAsync(300);
    expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.RUNNING);
    expect(started.result()).toBeUndefined();

    proxy().simulateStopped(1, 'breakpoint');
    await vi.advanceTimersByTimeAsync(50);

    expect(started.result()).toMatchObject({ success: true, state: SessionState.PAUSED });
    expect(started.result()?.data?.reason).toBe('breakpoint');
    expect(started.result()?.data?.pending).toBeUndefined();
  });

  it('answers running with pending when the hold elapses, however much is armed', async () => {
    const sessionId = await createSession();
    await sessionManager.setBreakpoint(sessionId, { file: 'test.py', line: 5 });
    const started = launch(sessionId);

    await vi.advanceTimersByTimeAsync(HOLD_MS - 50);
    expect(started.result()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(100);

    const result = started.result();
    expect(result).toMatchObject({ success: true, state: SessionState.RUNNING });
    expect(result?.data?.pending).toBe(true);
    // What is armed, that it stays armed, and the explicit wait — and no
    // number: the hold is not part of the contract.
    expect(result?.data?.message).toMatch(/1 breakpoint\(s\)/);
    expect(result?.data?.message).toMatch(/stays? armed/);
    expect(result?.data?.message).toContain('wait_for_stop');
    expect(result?.data?.message).not.toMatch(/after \d+(\.\d+)?s/);
  });

  it('answers the same way, after the same hold, when nothing is armed', async () => {
    const sessionId = await createSession();
    const started = launch(sessionId);

    await vi.advanceTimersByTimeAsync(HOLD_MS - 50);
    expect(started.result()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(100);

    const result = started.result();
    expect(result).toMatchObject({ success: true, state: SessionState.RUNNING });
    expect(result?.data?.pending).toBe(true);
    expect(result?.data?.message).toMatch(/nothing is armed to stop it/);
    expect(result?.data?.message).toContain('wait_for_stop');
  });

  it('names an armed logpoint instead of saying "no breakpoints" when only logpoints are set (issue #865)', async () => {
    const sessionId = await createSession();
    const started = launch(sessionId);
    await vi.advanceTimersByTimeAsync(300);
    // The handshake has said logpoints run on; a logpoint is then set.
    proxy().simulateEvent('adapter-capabilities', { supportsLogPoints: true });
    await sessionManager.setBreakpoint(sessionId, { file: 'test.py', line: 5, logMessage: 'x={x}' });
    await vi.advanceTimersByTimeAsync(HOLD_MS);

    const result = started.result();
    expect(result).toMatchObject({ success: true, state: SessionState.RUNNING });
    expect(result?.data?.pending).toBe(true);
    expect(result?.data?.message).toMatch(/1 logpoint\(s\) that log without stopping/);
    expect(result?.data?.message).toContain('get_output');
    expect(result?.data?.message).toMatch(/nothing is armed to stop it/);
    expect(result?.data?.message).not.toMatch(/\(no breakpoints,/);
  });

  it('answers stopped with the exit code for a program that ends inside the hold', async () => {
    const sessionId = await createSession();
    const started = launch(sessionId);
    await vi.advanceTimersByTimeAsync(200);

    proxy().simulateExited(3);
    await vi.advanceTimersByTimeAsync(50);

    expect(started.result()).toMatchObject({ success: true, state: SessionState.STOPPED });
    expect(started.result()?.data?.exitCode).toBe(3);
    expect(started.result()?.data?.pending).toBeUndefined();
  });

  it('is not answered by an entry stop the core auto-continues: the breakpoint after it is the answer', async () => {
    const sessionId = await createSession();
    await sessionManager.setBreakpoint(sessionId, { file: 'test.py', line: 5 });
    const started = launch(sessionId);
    await vi.advanceTimersByTimeAsync(100);

    // stopOnEntry is false, so the core resumes this stop itself.
    proxy().simulateStopped(1, 'entry');
    await vi.advanceTimersByTimeAsync(50);
    expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.RUNNING);
    expect(started.result()).toBeUndefined();

    proxy().simulateStopped(1, 'breakpoint');
    await vi.advanceTimersByTimeAsync(50);
    expect(started.result()).toMatchObject({ state: SessionState.PAUSED });
    expect(started.result()?.data?.reason).toBe('breakpoint');
  });

  it('waits past the hold for a requested entry stop: that stop is certain to come', async () => {
    const sessionId = await createSession();
    // An adapter that is slow to deliver the entry stop: nothing is reported
    // at start, and the session stays INITIALIZING until the stop arrives.
    vi.spyOn(proxy(), 'start').mockImplementation(async () => {
      setMockProxyRunning(proxy(), true);
    });
    const started = launch(sessionId, { stopOnEntry: true });

    await vi.advanceTimersByTimeAsync(5 * HOLD_MS);
    expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.INITIALIZING);
    expect(started.result()).toBeUndefined();

    proxy().simulateStopped(1, 'entry');
    await vi.advanceTimersByTimeAsync(50);
    expect(started.result()).toMatchObject({ success: true, state: SessionState.PAUSED });
    expect(started.result()?.data?.reason).toBe('entry');
    expect(started.result()?.data?.stopOnEntrySuccessful).toBe(true);
  });

  it('names a breakpoint that was set during the hold: the arming is read when the answer is built (issue #826)', async () => {
    const sessionId = await createSession();
    const started = launch(sessionId);
    await vi.advanceTimersByTimeAsync(300);
    expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.RUNNING);

    await sessionManager.setBreakpoint(sessionId, { file: 'test.py', line: 5 });
    await vi.advanceTimersByTimeAsync(HOLD_MS);

    const result = started.result();
    expect(result?.data?.pending).toBe(true);
    expect(result?.data?.message).toMatch(/1 breakpoint\(s\)/);
    expect(result?.data?.message).not.toMatch(/nothing is armed/);
  });

  describe('a breakpoint set while the launch is still starting (issue #851)', () => {
    it('is sent to the adapter as soon as the program is launched, not when the wait ends', async () => {
      const sessionId = await createSession();
      proxy().startDelay = 500;
      const started = launch(sessionId);
      await vi.advanceTimersByTimeAsync(200);
      expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.INITIALIZING);

      // Stored only: the adapter cannot take it while the launch is starting.
      const { breakpoint } = await sessionManager.setBreakpoint(sessionId, { file: 'test.py', line: 7 });
      expect(breakpoint.verified).toBe(false);
      expect(setBreakpointDapCalls()).toHaveLength(0);

      // The proxy finishes starting and the program is running: the hold has
      // only just begun, and the breakpoint is already on its way.
      await vi.advanceTimersByTimeAsync(400);
      expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.RUNNING);
      expect(started.result()).toBeUndefined();
      expect(setBreakpointDapCalls()).toHaveLength(1);
      expect(setBreakpointDapCalls()[0].args).toMatchObject({
        source: { path: 'test.py' },
        breakpoints: [expect.objectContaining({ line: 7 })]
      });

      // And it can therefore be the launch's answer.
      proxy().simulateStopped(1, 'breakpoint');
      await vi.advanceTimersByTimeAsync(50);
      expect(started.result()).toMatchObject({ state: SessionState.PAUSED });
    });

    it('costs a launch whose breakpoints did not change nothing: no re-send before the hold', async () => {
      const sessionId = await createSession();
      await sessionManager.setBreakpoint(sessionId, { file: 'test.py', line: 5 });
      const started = launch(sessionId);

      await vi.advanceTimersByTimeAsync(HOLD_MS - 50);
      expect(started.result()).toBeUndefined();
      expect(setBreakpointDapCalls()).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(100);
      expect(started.result()?.data?.pending).toBe(true);
    });

    it('also delivers a removal made while the launch was starting', async () => {
      const sessionId = await createSession();
      const { breakpoint } = await sessionManager.setBreakpoint(sessionId, { file: 'test.py', line: 5 });
      proxy().startDelay = 500;
      const started = launch(sessionId);
      await vi.advanceTimersByTimeAsync(200);

      await sessionManager.removeBreakpoint(sessionId, breakpoint.id);
      await vi.advanceTimersByTimeAsync(400);

      expect(started.result()).toBeUndefined();
      // The snapshot the proxy started with still had it: the adapter is told.
      expect(setBreakpointDapCalls().some((call) =>
        (call.args as { source?: { path?: string }; breakpoints?: unknown[] }).source?.path === 'test.py' &&
        (call.args as { breakpoints?: unknown[] }).breakpoints?.length === 0
      )).toBe(true);
    });
  });

  describe('the breakpoint re-send after the launch (issue #856)', () => {
    it('is not made to a program still running when the hold elapses: its end may be on its way', async () => {
      const sessionId = await createSession();
      await sessionManager.setBreakpoint(sessionId, { file: 'test.py', line: 5 });
      const started = launch(sessionId);
      await vi.advanceTimersByTimeAsync(HOLD_MS + 100);

      expect(started.result()).toMatchObject({ success: true, state: SessionState.RUNNING });
      expect(started.result()?.data?.pending).toBe(true);
      // The proxy's own send at start is the only one. A second one here
      // would be answered by whatever is left of a program whose exit the
      // session has not heard yet — CodeLLDB on Windows marked a logpoint
      // that had fired `verified: false` that way.
      expect(setBreakpointDapCalls()).toHaveLength(0);
    });

    it('is still made when the launch stops inside the hold: a paused program is certainly there', async () => {
      const sessionId = await createSession();
      await sessionManager.setBreakpoint(sessionId, { file: 'test.py', line: 5 });
      const started = launch(sessionId);
      await vi.advanceTimersByTimeAsync(200);
      proxy().simulateStopped(1, 'breakpoint');
      await vi.advanceTimersByTimeAsync(50);

      expect(started.result()).toMatchObject({ success: true, state: SessionState.PAUSED });
      expect(setBreakpointDapCalls()).toHaveLength(1);
      expect(setBreakpointDapCalls()[0].args).toMatchObject({ source: { path: 'test.py' } });
    });

    it('is not needed to hear that the adapter rejected the function breakpoints: the worker echoes it and the answer quotes it', async () => {
      const sessionId = await createSession();
      await sessionManager.setFunctionBreakpoint(sessionId, { functionName: 'main' });
      const started = launch(sessionId);
      await vi.advanceTimersByTimeAsync(100);
      // What the worker sends when the adapter answers its pre-launch
      // setFunctionBreakpoints with an error.
      proxy().simulateEvent('function-breakpoints-synced', [
        { name: 'main', verified: false, message: 'function breakpoints are not supported here', refused: true }
      ]);
      await vi.advanceTimersByTimeAsync(HOLD_MS);

      const result = started.result();
      expect(result?.data?.pending).toBe(true);
      expect(proxy().dapRequestCalls.filter((call) => call.command === 'setFunctionBreakpoints')).toHaveLength(0);
      const warning = (result?.data as { warning?: string } | undefined)?.warning ?? '';
      // The adapter's own words, as a refusal — not as a name it could not
      // resolve, which would send the caller looking for a typo.
      expect(warning).toContain('function breakpoints are not supported here');
      expect(warning).toMatch(/refused/);
      expect(warning).toContain("'main'");
      expect(warning).not.toMatch(/could not resolve the name|check the symbol name/);
    });
  });

  describe('JavaScript launches follow the same contract (issue #823)', () => {
    async function jsSession(): Promise<string> {
      const sessionId = await createSession(DebugLanguage.JAVASCRIPT);
      // The js handshake waits for a DAP 'initialized' event; satisfy it as
      // the real ProxyManager would, and answer everything else plainly.
      proxy().setDapRequestHandler(async (command, args) => {
        if (command === 'initialize') {
          proxy().simulateEvent('dap-event', 'initialized', {});
        }
        if (command === 'setBreakpoints') {
          return {
            success: true,
            body: {
              breakpoints: (args?.breakpoints ?? []).map((bp: { line: number }, i: number) => ({
                id: 7 + i, verified: false, line: bp.line
              }))
            }
          };
        }
        return { success: true };
      });
      return sessionId;
    }

    it('waits for a breakpoint reached after the program is configured, instead of answering running at once', async () => {
      const sessionId = await jsSession();
      await sessionManager.setBreakpoint(sessionId, { file: 'app.js', line: 10 });
      const started = launch(sessionId, {}, 'app.js');
      await vi.advanceTimersByTimeAsync(400);
      expect(sessionManager.getSession(sessionId)?.state).toBe(SessionState.RUNNING);
      // Before #823 this launch had already answered `running`.
      expect(started.result()).toBeUndefined();

      proxy().simulateStopped(1, 'breakpoint');
      await vi.advanceTimersByTimeAsync(50);
      expect(started.result()).toMatchObject({ success: true, state: SessionState.PAUSED });
      expect(started.result()?.data?.reason).toBe('breakpoint');
    });

    it('answers running with pending, like every other adapter, when the hold elapses', async () => {
      const sessionId = await jsSession();
      const started = launch(sessionId, {}, 'app.js');
      await vi.advanceTimersByTimeAsync(HOLD_MS + 200);

      expect(started.result()).toMatchObject({ success: true, state: SessionState.RUNNING });
      expect(started.result()?.data?.pending).toBe(true);
      expect(started.result()?.data?.message).toContain('wait_for_stop');
    });
  });

  it('applies the same contract to restart_debugging', async () => {
    const sessionId = await createSession();
    // A proxy per launch, as in production: the shared mock would deliver the
    // first launch's exit to the relaunch's handlers.
    const relaunchProxy = new MockProxyManager();
    vi.mocked(dependencies.proxyManagerFactory.create)
      .mockReturnValueOnce(proxy())
      .mockReturnValueOnce(relaunchProxy);
    const first = launch(sessionId);
    await vi.advanceTimersByTimeAsync(HOLD_MS + 100);
    expect(first.result()?.data?.pending).toBe(true);

    let restarted: DebugResult | undefined;
    void sessionManager.restartDebugging(sessionId).then((settled) => { restarted = settled; });
    await vi.advanceTimersByTimeAsync(HOLD_MS + 500);

    expect(restarted, JSON.stringify(restarted)).toMatchObject({ success: true, state: SessionState.RUNNING });
    expect(restarted?.data?.pending).toBe(true);
    expect(restarted?.data?.message).toContain('wait_for_stop');
  });
});
