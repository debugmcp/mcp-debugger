/**
 * buildNoDebugLaunchWarning (issue #710): `dapLaunchArgs.noDebug: true` reaches
 * every adapter and disables the debugger, so nothing the caller asked to stop
 * on can fire. The warning names what will not fire — and stays silent for a
 * bare noDebug run, which is a legitimate "just run it".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildNoDebugLaunchWarning } from '../../../../src/session/breakpoints/launch-warnings.js';
import type { ManagedSession } from '../../../../src/session/session-store.js';
import { SessionManager, type SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';
import type { MockProxyManager } from '../../../test-utils/mocks/mock-proxy-manager.js';

type BuilderSession = {
  breakpoints: Map<string, { file: string; line: number; verified: boolean }>;
  functionBreakpoints: Map<string, { functionName: string; verified: boolean }>;
};

const noBreakpoints = (): BuilderSession => ({ breakpoints: new Map(), functionBreakpoints: new Map() });

const withLineBreakpoints = (count: number): BuilderSession => ({
  breakpoints: new Map(
    Array.from({ length: count }, (_, i) => [`bp${i}`, { file: '/proj/app.py', line: 10 + i, verified: false }])
  ),
  functionBreakpoints: new Map()
});

function build(
  session: BuilderSession,
  dapLaunchArgs: Record<string, unknown> | undefined,
  explicitBreakOnExceptions?: string
): string | undefined {
  // The builder is a free function over the two breakpoint stores plus the
  // launch arguments and the caller's explicit exception mode.
  return buildNoDebugLaunchWarning(
    session as unknown as Pick<ManagedSession, 'breakpoints' | 'functionBreakpoints'>,
    dapLaunchArgs,
    explicitBreakOnExceptions
  );
}

describe('buildNoDebugLaunchWarning', () => {
  it('names the line breakpoints that will not fire', () => {
    const warning = build(withLineBreakpoints(2), { noDebug: true });
    expect(warning).toMatch(/noDebug is true/);
    expect(warning).toMatch(/2 breakpoint\(s\)/);
    expect(warning).toMatch(/will not fire/);
    expect(warning).toMatch(/Drop noDebug/);
  });

  it('names function breakpoints separately from line breakpoints', () => {
    const session = withLineBreakpoints(1);
    session.functionBreakpoints.set('f', { functionName: 'main', verified: false });
    const warning = build(session, { noDebug: true });
    expect(warning).toMatch(/1 breakpoint\(s\)/);
    expect(warning).toMatch(/1 function breakpoint\(s\)/);
  });

  it("names an explicit breakOnExceptions other than 'none'", () => {
    const warning = build(noBreakpoints(), { noDebug: true }, 'uncaught');
    expect(warning).toMatch(/breakOnExceptions='uncaught'/);
    expect(warning).not.toMatch(/breakpoint\(s\)/);
  });

  it("stays silent for an explicit breakOnExceptions of 'none' with nothing else set", () => {
    expect(build(noBreakpoints(), { noDebug: true }, 'none')).toBeUndefined();
  });

  it('does not treat the policy default as something the caller asked for', () => {
    // The launcher passes the caller's value, undefined when unset; the
    // 'uncaught' policy default must not make every bare noDebug run warn.
    expect(build(noBreakpoints(), { noDebug: true }, undefined)).toBeUndefined();
  });

  it('names stopOnEntry as a stop that will not come', () => {
    const warning = build(noBreakpoints(), { noDebug: true, stopOnEntry: true });
    expect(warning).toMatch(/stopOnEntry/);
  });

  it('stays silent when noDebug is absent or false, whatever else is set', () => {
    const session = withLineBreakpoints(3);
    expect(build(session, undefined, 'all')).toBeUndefined();
    expect(build(session, { stopOnEntry: true }, 'all')).toBeUndefined();
    expect(build(session, { noDebug: false, stopOnEntry: true }, 'all')).toBeUndefined();
  });

  it('lists every applicable clause in one sentence', () => {
    const session = withLineBreakpoints(2);
    session.functionBreakpoints.set('f', { functionName: 'main', verified: false });
    const warning = build(session, { noDebug: true, stopOnEntry: true }, 'all');
    expect(warning).toMatch(
      /2 breakpoint\(s\), 1 function breakpoint\(s\), breakOnExceptions='all' and stopOnEntry will not fire/
    );
  });
});

/**
 * Wiring: the launcher computes the warning once per launch and puts it on
 * data.warning for a real launch, a dry run and a restart; when it fires, the
 * breakpoint-shaped launch warnings that presuppose a debugger are withheld.
 */
describe('SessionManager launches with noDebug (issue #710)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  let config: SessionManagerConfig;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    config = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true }
    };
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(async () => {
    await sessionManager.closeAllSessions();
    vi.useRealTimers();
  });

  /** Replace the mock proxy's start with one that ends the program during startup. */
  function endDuringStartup(): void {
    const proxy = dependencies.mockProxyManager;
    proxy.start = vi.fn().mockImplementation(async (startConfig) => {
      (proxy as unknown as { _isRunning: boolean })._isRunning = true;
      proxy.startCalls.push(startConfig);
      process.nextTick(() => proxy.emit('exited', 0));
    }) as MockProxyManager['start'];
  }

  it('says which breakpoints will not fire instead of telling the caller to check their paths', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    await sessionManager.setBreakpoint(session.id, { file: '/work/src/app.py', line: 7 });
    endDuringStartup();

    const startPromise = sessionManager.startDebugging(session.id, '/work/src/app.py', [], { stopOnEntry: false, noDebug: true });
    await vi.runAllTimersAsync();
    const result = await startPromise;

    expect(result.success).toBe(true);
    expect(result.state).toBe(SessionState.STOPPED);
    const warning = (result.data as { warning?: string }).warning;
    expect(warning).toMatch(/noDebug is true/);
    expect(warning).toMatch(/1 breakpoint\(s\)/);
    // The #467 diagnosis ("check the file path and line") would be wrong here.
    expect(warning).not.toMatch(/never bound during this run/);
  });

  it('stays silent for a bare noDebug run with nothing to stop on', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    endDuringStartup();

    const startPromise = sessionManager.startDebugging(session.id, '/work/src/app.py', [], { stopOnEntry: false, noDebug: true });
    await vi.runAllTimersAsync();
    const result = await startPromise;

    expect(result.success).toBe(true);
    expect((result.data as { warning?: string }).warning).toBeUndefined();
  });

  it('warns on a dry run too — it is a configuration check', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    await sessionManager.setBreakpoint(session.id, { file: '/work/src/app.py', line: 7 });

    const startPromise = sessionManager.startDebugging(session.id, '/work/src/app.py', [], { noDebug: true }, true);
    await vi.runAllTimersAsync();
    const result = await startPromise;

    expect(result.success).toBe(true);
    const data = result.data as { dryRun?: boolean; warning?: string };
    expect(data.dryRun).toBe(true);
    expect(data.warning).toMatch(/noDebug is true/);
  });

  it('warns on restart for a breakpoint added after the noDebug launch', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    const startPromise = sessionManager.startDebugging(session.id, '/work/src/app.py', [], { stopOnEntry: false, noDebug: true });
    await vi.runAllTimersAsync();
    const first = await startPromise;
    expect(first.success).toBe(true);
    expect((first.data as { warning?: string }).warning).toBeUndefined();

    await sessionManager.setBreakpoint(session.id, { file: '/work/src/app.py', line: 7 });
    dependencies.mockProxyManager.simulateEvent('terminated');
    await vi.runAllTimersAsync();

    const restartPromise = sessionManager.restartDebugging(session.id);
    await vi.runAllTimersAsync();
    const restarted = await restartPromise;

    expect(restarted.success).toBe(true);
    const data = restarted.data as { warning?: string; breakpointsReapplied?: number };
    expect(data.breakpointsReapplied).toBe(1);
    expect(data.warning).toMatch(/noDebug is true/);
    expect(data.warning).toMatch(/1 breakpoint\(s\)/);
  });
});
