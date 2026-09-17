/**
 * buildNoDebugLaunchWarning (issue #710): where an adapter honours DAP's
 * `noDebug` launch flag, the debugger is off and nothing the caller asked to
 * stop on can fire — the warning names what will not fire, and stays silent
 * for a bare noDebug run, which is a legitimate "just run it". Where the
 * adapter ignores the flag, the caller is told it had no effect instead.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildNoDebugFailureNote, buildNoDebugLaunchWarning } from '../../../../src/session/breakpoints/launch-warnings.js';
import type { ManagedSession } from '../../../../src/session/session-store.js';
import { SessionManager, type SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState, type AdapterPolicy, type Breakpoint, type ExceptionBreakMode, type FunctionBreakpoint } from '@debugmcp/shared';
import { createMockDependencies, overridePolicy, setMockProxyRunning } from './session-manager-test-utils.js';
import type { MockProxyManager } from '../../../test-utils/mocks/mock-proxy-manager.js';

type BuilderSession = Pick<ManagedSession, 'breakpoints' | 'functionBreakpoints' | 'language'>;

function session(lineBreakpoints = 0, functionBreakpoints = 0): BuilderSession {
  const breakpoints = new Map<string, Breakpoint>();
  for (let i = 0; i < lineBreakpoints; i++) {
    breakpoints.set(`bp${i}`, { id: `bp${i}`, file: '/proj/app.py', line: 10 + i, verified: false });
  }
  const fnBreakpoints = new Map<string, FunctionBreakpoint>();
  for (let i = 0; i < functionBreakpoints; i++) {
    fnBreakpoints.set(`fn${i}`, { id: `fn${i}`, functionName: `handler${i}`, verified: false });
  }
  return { breakpoints, functionBreakpoints: fnBreakpoints, language: DebugLanguage.PYTHON };
}

function build(
  s: BuilderSession,
  launchArgs: { noDebug?: boolean; stopOnEntry?: boolean } | undefined,
  explicitBreakOnExceptions?: ExceptionBreakMode,
  honoursNoDebug = true
): string | undefined {
  return buildNoDebugLaunchWarning(s, launchArgs, explicitBreakOnExceptions, honoursNoDebug);
}

describe('buildNoDebugLaunchWarning', () => {
  it('names the line breakpoints that will not fire', () => {
    const warning = build(session(2), { noDebug: true });
    expect(warning).toMatch(/noDebug is true/);
    expect(warning).toMatch(/2 breakpoint\(s\)/);
    expect(warning).toMatch(/will not fire/);
    expect(warning).toMatch(/Drop noDebug/);
  });

  it('names function breakpoints separately from line breakpoints', () => {
    const warning = build(session(1, 1), { noDebug: true });
    expect(warning).toMatch(/1 breakpoint\(s\)/);
    expect(warning).toMatch(/1 function breakpoint\(s\)/);
  });

  it("names an explicit breakOnExceptions other than 'none'", () => {
    const warning = build(session(), { noDebug: true }, 'uncaught');
    expect(warning).toMatch(/breakOnExceptions='uncaught'/);
    expect(warning).not.toMatch(/breakpoint\(s\)/);
  });

  it("stays silent for an explicit breakOnExceptions of 'none' with nothing else set", () => {
    expect(build(session(), { noDebug: true }, 'none')).toBeUndefined();
  });

  it('does not treat the policy default as something the caller asked for', () => {
    // The launcher passes the caller's value, undefined when unset; the
    // 'uncaught' policy default must not make every bare noDebug run warn.
    expect(build(session(), { noDebug: true }, undefined)).toBeUndefined();
  });

  it('names stopOnEntry as a stop that will not come', () => {
    expect(build(session(), { noDebug: true, stopOnEntry: true })).toMatch(/stopOnEntry/);
  });

  it('stays silent when noDebug is absent or false, whatever else is set', () => {
    expect(build(session(3), undefined, 'all')).toBeUndefined();
    expect(build(session(3), { stopOnEntry: true }, 'all')).toBeUndefined();
    expect(build(session(3), { noDebug: false, stopOnEntry: true }, 'all')).toBeUndefined();
  });

  it('counts logpoints apart from breakpoints, as the run-to-completion summary does', () => {
    const s = session(1);
    s.breakpoints.set('lp', { id: 'lp', file: '/proj/app.py', line: 30, verified: false, logMessage: 'x={x}' });
    const warning = build(s, { noDebug: true });
    expect(warning).toMatch(/1 breakpoint\(s\) and 1 logpoint\(s\) will not fire/);
  });

  it('lists every applicable clause in one sentence', () => {
    const warning = build(session(2, 1), { noDebug: true, stopOnEntry: true }, 'all');
    expect(warning).toMatch(
      /2 breakpoint\(s\), 1 function breakpoint\(s\), breakOnExceptions='all' and stopOnEntry will not fire/
    );
  });

  it('says the flag had no effect where the adapter ignores it — whatever the caller set', () => {
    // rdbg, netcoredbg, the JDI bridge and the mock adapter ignore noDebug;
    // the rust transform never forwards it. Their debugger stays on.
    const warning = build({ ...session(2), language: DebugLanguage.RUBY }, { noDebug: true }, 'all', false);
    expect(warning).toMatch(/noDebug has no effect with the ruby adapter/);
    expect(warning).toMatch(/debugger stays on/);
    expect(warning).not.toMatch(/will not fire/);
    // ...and even with nothing to stop on: the caller set a flag that does nothing.
    expect(build(session(), { noDebug: true }, undefined, false)).toMatch(/has no effect/);
    expect(build(session(), { noDebug: false }, undefined, false)).toBeUndefined();
  });
});

/**
 * Wiring: the launcher decides once per launch — from the merged noDebug the
 * adapter will see and the policy's word on whether it honours the flag — and
 * puts the warning on data.warning for a real launch, a dry run and a restart.
 * Where the debugger is off, the breakpoint-shaped launch warnings are
 * withheld and readiness does not wait for an entry stop that cannot come.
 */
describe('buildNoDebugFailureNote', () => {
  it("names Delve's exec quirk for go only", () => {
    expect(buildNoDebugFailureNote('go')).toMatch(/Delve .*\.exe/);
    expect(buildNoDebugFailureNote('python')).not.toMatch(/Delve/);
    expect(buildNoDebugFailureNote('python')).toMatch(/noDebug is true, so this launch ran with the debugger disabled/);
  });
});

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
      setMockProxyRunning(proxy, true);
      proxy.startCalls.push(startConfig);
      process.nextTick(() => proxy.emit('exited', 0));
    }) as MockProxyManager['start'];
  }

  /**
   * Replace the mock proxy's start with one that configures the adapter and
   * never stops — emitting synchronously inside start(), the way the real
   * worker reports adapter-configured before start() resolves, so the
   * launcher's readiness listener is not yet registered when it fires.
   */
  function runWithoutStopping(): void {
    const proxy = dependencies.mockProxyManager;
    proxy.start = vi.fn().mockImplementation(async (startConfig) => {
      setMockProxyRunning(proxy, true);
      proxy.startCalls.push(startConfig);
      proxy.emit('adapter-configured');
      proxy.emit('initialized');
    }) as MockProxyManager['start'];
  }

  async function launch(sessionId: string, dapLaunchArgs: Record<string, unknown>, adapterLaunchConfig?: Record<string, unknown>) {
    const startPromise = sessionManager.startDebugging(sessionId, '/work/src/app.py', [], dapLaunchArgs, false, adapterLaunchConfig);
    await vi.runAllTimersAsync();
    return startPromise;
  }

  const warningOf = (result: { data?: unknown }) => (result.data as { warning?: string } | undefined)?.warning;

  /**
   * Overlay policy fields on the launcher's lookup. The launcher reads the
   * data layer's `ctx.selectPolicy`, which is the facade method — not the
   * store's, which overridePolicy() targets. The real method is taken from
   * the prototype so a second overlay does not wrap the first spy.
   */
  function pinPolicy(overrides: Partial<AdapterPolicy>): void {
    const facade = sessionManager as unknown as { selectPolicy: (language: string) => AdapterPolicy };
    const proto = Object.getPrototypeOf(sessionManager) as { selectPolicy: (language: string) => AdapterPolicy };
    const original = proto.selectPolicy.bind(sessionManager);
    vi.spyOn(facade, 'selectPolicy').mockImplementation((language) => ({ ...original(language), ...overrides }));
  }

  describe('where the adapter honours the flag', () => {
    beforeEach(() => {
      // The mock adapter ignores noDebug; the policy override says otherwise
      // so the launcher takes the debugger-off path.
      pinPolicy({ honoursNoDebug: true });
    });

    it('says which breakpoints will not fire instead of telling the caller to check their paths', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      await sessionManager.setBreakpoint(s.id, { file: '/work/src/app.py', line: 7 });
      endDuringStartup();

      const result = await launch(s.id, { stopOnEntry: false, noDebug: true });

      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.STOPPED);
      // What is known: the flag, and what it keeps from firing. Not a claim
      // that no stop of any kind can come — js-debug lands a pause under it.
      expect(warningOf(result)).toMatch(/^noDebug is true, so the debugger is off for this launch: 1 breakpoint\(s\) will not fire\./);
      expect(warningOf(result)).not.toMatch(/no stop can arrive/);
      // The #467 diagnosis ("check the file path and line") would be wrong here.
      expect(warningOf(result)).not.toMatch(/never bound during this run/);
    });

    it('stamps the decision on the proxy config — the worker reads that, not the launch config (issue #746)', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      runWithoutStopping();

      await launch(s.id, { stopOnEntry: false, noDebug: true });
      const stamped = dependencies.mockProxyManager.startCalls.at(-1) as { debuggerOff?: boolean } | undefined;
      expect(stamped?.debuggerOff).toBe(true);

      runWithoutStopping();
      await launch(s.id, { stopOnEntry: false });
      const plain = dependencies.mockProxyManager.startCalls.at(-1) as { debuggerOff?: boolean } | undefined;
      expect(plain?.debuggerOff).toBe(false);
    });

    it('stays silent for a bare noDebug run with nothing to stop on', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      endDuringStartup();

      const result = await launch(s.id, { stopOnEntry: false, noDebug: true });

      expect(result.success).toBe(true);
      expect(warningOf(result)).toBeUndefined();
    });

    it('reads the flag from adapterLaunchConfig, which wins over dapLaunchArgs (the merge order the adapter sees)', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      await sessionManager.setBreakpoint(s.id, { file: '/work/src/app.py', line: 7 });
      endDuringStartup();

      const viaAdapterConfig = await launch(s.id, { stopOnEntry: false }, { noDebug: true });
      expect(warningOf(viaAdapterConfig)).toMatch(/noDebug is true/);

      endDuringStartup();
      const overridden = await launch(s.id, { stopOnEntry: false, noDebug: true }, { noDebug: false });
      expect(warningOf(overridden)).not.toMatch(/noDebug/);
      // ...and with the debugger on, the #467 diagnosis is the right one again.
      expect(warningOf(overridden)).toMatch(/never bound during this run/);
    });

    it('does not wait for the entry stop it just said cannot come', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      runWithoutStopping();

      const before = Date.now();
      const result = await launch(s.id, { stopOnEntry: true, noDebug: true });

      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.RUNNING);
      expect(warningOf(result)).toMatch(/stopOnEntry will not fire/);
      // Readiness resolved on adapter-configured, not on the 30 s ceiling.
      expect(Date.now() - before).toBeLessThan(30000);
      // The adapter was asked for no entry stop either: one value everywhere.
      const sent = dependencies.mockProxyManager.startCalls.at(-1) as { stopOnEntry?: boolean } | undefined;
      expect(sent?.stopOnEntry).toBe(false);
      // ...while the replayable launch spec keeps what the caller asked for.
      expect(sessionManager.getSession(s.id)?.lastLaunch?.dapLaunchArgs?.stopOnEntry).toBe(true);
    });

    it('does not wait on a policy whose readiness is a pause (python/go/cpp always request an entry stop)', async () => {
      pinPolicy({ honoursNoDebug: true, isSessionReady: (state: SessionState) => state === SessionState.PAUSED });
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      runWithoutStopping();

      const before = Date.now();
      const result = await launch(s.id, { stopOnEntry: false, noDebug: true });

      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.RUNNING);
      expect(Date.now() - before).toBeLessThan(30000);
    });

    it('names a stopOnEntry that came in through adapterLaunchConfig, and neutralizes it there too', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      runWithoutStopping();

      const result = await launch(s.id, { noDebug: true }, { stopOnEntry: true });

      expect(warningOf(result)).toMatch(/stopOnEntry will not fire/);
      // adapterLaunchConfig wins the adapter merge, so it must carry false as well.
      const sent = dependencies.mockProxyManager.startCalls.at(-1) as { stopOnEntry?: boolean; launchConfig?: { stopOnEntry?: boolean } } | undefined;
      expect(sent?.stopOnEntry).toBe(false);
      expect(sent?.launchConfig?.stopOnEntry).toBe(false);
    });

    it('reads the string forms the way the proxy parser coerces them', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      runWithoutStopping();

      const result = await launch(s.id, { noDebug: 'true', stopOnEntry: 'false' });

      // 'false' is false: no entry stop was asked for, so none is named.
      expect(warningOf(result)).toBeUndefined();
    });

    it('leaves an attach-shaped start_debugging alone — noDebug is a launch-request property', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      await sessionManager.setBreakpoint(s.id, { file: '/work/src/app.py', line: 7 });
      endDuringStartup();

      const result = await launch(s.id, { request: 'attach', port: 9229, noDebug: true });

      expect(warningOf(result)).not.toMatch(/noDebug/);
      expect(warningOf(result)).toMatch(/never bound during this run/);
    });

    it('carries the note on a bare noDebug launch that failed, with nothing armed to warn about', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      dependencies.mockProxyManager.shouldFailStart = true;

      const result = await launch(s.id, { stopOnEntry: false, noDebug: true });

      expect(result.success).toBe(false);
      expect(warningOf(result)).toMatch(/noDebug is true, so this launch ran with the debugger disabled/);
    });

    it('believes an entry stop the core already resumed over the policy pin', async () => {
      // A wrong pin plus stopOnEntry: the neutralized value makes the core
      // auto-continue the entry stop, so no pause is left standing — but
      // the stop happened, and the response must not say no stop can come.
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      const proxy = dependencies.mockProxyManager;
      proxy.start = vi.fn().mockImplementation(async (startConfig) => {
        setMockProxyRunning(proxy, true);
        proxy.startCalls.push(startConfig);
        proxy.emit('adapter-configured');
        proxy.emit('initialized');
        proxy.emit('stopped', 1, 'entry', { reason: 'entry', threadId: 1 });
      }) as MockProxyManager['start'];

      const result = await launch(s.id, { stopOnEntry: true, noDebug: true });

      expect(result.success).toBe(true);
      expect(warningOf(result)).toMatch(/noDebug has no effect/);
      expect(warningOf(result)).not.toMatch(/will not fire/);
    });

    it('counts a string-typed noDebug the way the adapter will (truthy)', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      await sessionManager.setBreakpoint(s.id, { file: '/work/src/app.py', line: 7 });
      endDuringStartup();

      const result = await launch(s.id, { stopOnEntry: false, noDebug: 'true' });

      expect(warningOf(result)).toMatch(/noDebug is true/);
      expect(warningOf(result)).not.toMatch(/never bound during this run/);
    });

    it('carries the note on a launch that failed under the flag', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      await sessionManager.setBreakpoint(s.id, { file: '/work/src/app.py', line: 7 });
      dependencies.mockProxyManager.shouldFailStart = true;

      const result = await launch(s.id, { stopOnEntry: false, noDebug: true });

      expect(result.success).toBe(false);
      expect(warningOf(result)).toMatch(/noDebug is true/);
    });

    it("never claims no stop can come from a launch that ended paused — even on a 'pause' the record survives", async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      await sessionManager.setBreakpoint(s.id, { file: '/work/src/app.py', line: 7 });
      const proxy = dependencies.mockProxyManager;
      proxy.start = vi.fn().mockImplementation(async (startConfig) => {
        setMockProxyRunning(proxy, true);
        proxy.startCalls.push(startConfig);
        proxy.emit('adapter-configured');
        proxy.emit('initialized');
        proxy.emit('stopped', 1, 'pause', { reason: 'pause', threadId: 1 });
      }) as MockProxyManager['start'];

      const result = await launch(s.id, { stopOnEntry: false, noDebug: true });

      expect(result.state).toBe(SessionState.PAUSED);
      // The response and the record agree: the debugger is off for the
      // breakpoints, whatever paused — no "no effect", no "no stop can come".
      expect(warningOf(result)).toMatch(/the debugger is off for this launch: 1 breakpoint\(s\) will not fire/);
      expect(warningOf(result)).not.toMatch(/has no effect/);
      expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBe(true);
    });

    it('believes a stop that arrived anyway over the policy pin', async () => {
      // The mock adapter stops at its breakpoint whatever the flag says — the
      // override pinned honoursNoDebug, so this is what a wrong pin looks like
      // when the stop lands before the launch reports (a later stop is #749's
      // territory: the launch has already answered).
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      await sessionManager.setBreakpoint(s.id, { file: '/work/src/app.py', line: 7 });
      const proxy = dependencies.mockProxyManager;
      proxy.start = vi.fn().mockImplementation(async (startConfig) => {
        setMockProxyRunning(proxy, true);
        proxy.startCalls.push(startConfig);
        proxy.emit('adapter-configured');
        proxy.emit('initialized');
        proxy.emit('stopped', 1, 'breakpoint', { reason: 'breakpoint', threadId: 1 });
      }) as MockProxyManager['start'];

      const before = Date.now();
      const result = await launch(s.id, { stopOnEntry: false, noDebug: true });

      expect(result.state).toBe(SessionState.PAUSED);
      expect(warningOf(result)).toMatch(/noDebug has no effect/);
      expect(warningOf(result)).not.toMatch(/will not fire/);
      // A pause that came anyway is ready too — not a 30 s wait for RUNNING.
      expect(Date.now() - before).toBeLessThan(30000);
    });

    it('believes a breakpoint the adapter verified anyway over the policy pin — before any stop', async () => {
      // A wrong pin seen from the other side: the adapter binds the
      // breakpoint (its configuration-phase echo says verified) and the
      // program keeps running. The launch must not say "will not fire" of
      // a breakpoint list_breakpoints shows bound; the record stays (a stop
      // is what clears it) but is consulted with the evidence.
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      await sessionManager.setBreakpoint(s.id, { file: '/work/src/app.py', line: 7 });
      const [queued] = sessionManager.listBreakpoints(s.id);
      const proxy = dependencies.mockProxyManager;
      proxy.start = vi.fn().mockImplementation(async (startConfig) => {
        setMockProxyRunning(proxy, true);
        proxy.startCalls.push(startConfig);
        proxy.emit('adapter-configured');
        proxy.emit('initialized');
        proxy.simulateEvent('breakpoints-synced', [
          { id: queued.id, file: '/work/src/app.py', line: 7, verified: true, adapterId: 3 }
        ]);
      }) as MockProxyManager['start'];

      const result = await launch(s.id, { stopOnEntry: false, noDebug: true });

      expect(result.state).toBe(SessionState.RUNNING);
      expect(warningOf(result)).toMatch(/noDebug has no effect/);
      expect(warningOf(result)).not.toMatch(/will not fire/);
      expect(sessionManager.listBreakpoints(s.id)[0].verified).toBe(true);
      const listed = sessionManager.getAllSessions().find((x) => x.id === s.id);
      expect(listed).not.toHaveProperty('debuggerDisabled');
    });

    it('warns on a dry run too — it is a configuration check', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      await sessionManager.setBreakpoint(s.id, { file: '/work/src/app.py', line: 7 });

      const startPromise = sessionManager.startDebugging(s.id, '/work/src/app.py', [], { noDebug: true }, true);
      await vi.runAllTimersAsync();
      const result = await startPromise;

      expect(result.success).toBe(true);
      const data = result.data as { dryRun?: boolean; warning?: string };
      expect(data.dryRun).toBe(true);
      expect(data.warning).toMatch(/noDebug is true/);
    });

    it('warns on restart for a breakpoint added after the noDebug launch', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      const first = await launch(s.id, { stopOnEntry: false, noDebug: true });
      expect(first.success).toBe(true);
      expect(warningOf(first)).toBeUndefined();

      await sessionManager.setBreakpoint(s.id, { file: '/work/src/app.py', line: 7 });
      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();

      const restartPromise = sessionManager.restartDebugging(s.id);
      await vi.runAllTimersAsync();
      const restarted = await restartPromise;

      expect(restarted.success).toBe(true);
      expect(warningOf(restarted)).toMatch(/noDebug is true/);
      expect(warningOf(restarted)).toMatch(/1 breakpoint\(s\)/);
    });
  });

  describe('where the adapter ignores the flag (the mock policy, like rdbg, netcoredbg and the JDI bridge)', () => {
    it('does not stamp debugger-off on the proxy config', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      runWithoutStopping();

      await launch(s.id, { stopOnEntry: false, noDebug: true });

      const sent = dependencies.mockProxyManager.startCalls.at(-1) as { debuggerOff?: boolean } | undefined;
      expect(sent?.debuggerOff).toBe(false);
    });

    it('says the flag had no effect and keeps the breakpoint diagnostics that still apply', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      await sessionManager.setBreakpoint(s.id, { file: '/work/src/app.py', line: 7 });
      endDuringStartup();

      const result = await launch(s.id, { stopOnEntry: false, noDebug: true });

      expect(result.success).toBe(true);
      expect(warningOf(result)).toMatch(/noDebug has no effect with the mock adapter/);
      expect(warningOf(result)).not.toMatch(/will not fire/);
      // The debugger was on, so a breakpoint that never bound is still the
      // #467 story — that diagnosis must survive.
      expect(warningOf(result)).toMatch(/never bound during this run/);
    });

    it('says nothing when the flag was not set', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      endDuringStartup();

      const result = await launch(s.id, { stopOnEntry: false });

      expect(warningOf(result)).toBeUndefined();
    });
  });

  /**
   * The decision outlives the launch response (issue #749): later surfaces —
   * set_breakpoint, list_breakpoints, pause, inspection — read it off the
   * session to say why they answer the way they do.
   */
  describe('records the decision on the session (issue #749)', () => {
    it('sets debuggerDisabled on the session for an honoured noDebug launch', async () => {
      pinPolicy({ honoursNoDebug: true });
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      runWithoutStopping();

      await launch(s.id, { stopOnEntry: false, noDebug: true });

      expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBe(true);
    });

    it('leaves it unset where the adapter ignores the flag, and for a launch without it', async () => {
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      runWithoutStopping();

      await launch(s.id, { stopOnEntry: false, noDebug: true });
      expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBeUndefined();

      pinPolicy({ honoursNoDebug: true });
      runWithoutStopping();
      await launch(s.id, { stopOnEntry: false });
      expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBeUndefined();
    });

    it('clears it on the next launch without the flag', async () => {
      pinPolicy({ honoursNoDebug: true });
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      runWithoutStopping();
      await launch(s.id, { stopOnEntry: false, noDebug: true });
      expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBe(true);

      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      runWithoutStopping();
      await launch(s.id, { stopOnEntry: false });

      expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBeUndefined();
    });

    it('does not set it for a dry run — nothing launched', async () => {
      pinPolicy({ honoursNoDebug: true });
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      const proxy = dependencies.mockProxyManager;
      proxy.start = vi.fn().mockImplementation(async (startConfig) => {
        proxy.startCalls.push(startConfig);
        process.nextTick(() => proxy.emit('dry-run-complete', 'python app.py', '/work/src/app.py'));
      }) as MockProxyManager['start'];

      const startPromise = sessionManager.startDebugging(s.id, '/work/src/app.py', [], { stopOnEntry: false, noDebug: true }, true);
      await vi.runAllTimersAsync();
      const result = await startPromise;

      expect((result.data as { dryRun?: boolean }).dryRun).toBe(true);
      expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBeUndefined();
    });

    it('survives a pause that lands — js-debug pauses under noDebug while its breakpoints stay unbound', async () => {
      pinPolicy({ honoursNoDebug: true });
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      runWithoutStopping();
      await launch(s.id, { stopOnEntry: false, noDebug: true });
      expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBe(true);

      // Measured: the inspector is attached and a user pause lands, but the
      // debug domains — breakpoints — are off. A pause proves nothing.
      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'pause', { reason: 'pause', threadId: 1 });
      await vi.runAllTimersAsync();

      expect(sessionManager.getSession(s.id)?.state).toBe(SessionState.PAUSED);
      expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBe(true);
    });

    it('survives a step taken from that pause — it proves exactly as much as the pause did', async () => {
      pinPolicy({ honoursNoDebug: true });
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      runWithoutStopping();
      await launch(s.id, { stopOnEntry: false, noDebug: true });

      // Measured on js-debug: pause lands, step_over from it lands with
      // reason 'step', and line breakpoints still cannot bind.
      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'pause', { reason: 'pause', threadId: 1 });
      await vi.runAllTimersAsync();
      dependencies.mockProxyManager.simulateEvent('continued');
      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'step', { reason: 'step', threadId: 1 });
      await vi.runAllTimersAsync();

      expect(sessionManager.getSession(s.id)?.state).toBe(SessionState.PAUSED);
      expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBe(true);
    });

    it('is not consulted while the session is merely created — a launch that failed before the proxy leaves it CREATED', async () => {
      pinPolicy({ honoursNoDebug: true });
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      runWithoutStopping();
      await launch(s.id, { stopOnEntry: false, noDebug: true });
      expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBe(true);

      // The MSVC-toolchain refusal path: back to CREATED with the record intact.
      sessionManager.getSession(s.id)!.state = SessionState.CREATED;

      const listed = sessionManager.getAllSessions().find((x) => x.id === s.id);
      expect(listed).not.toHaveProperty('debuggerDisabled');
    });

    it("survives a `debugger;` statement js-debug relabels 'breakpoint' — the adapter itself said 'pause'", async () => {
      pinPolicy({ honoursNoDebug: true });
      // The relabel lives in the store's policy (the core's handleStopped reads it).
      overridePolicy(sessionManager, {
        normalizeStopReason: (raw: string, body?: { description?: string }) =>
          raw === 'pause' && body?.description === 'Paused on debugger statement' ? 'breakpoint' : raw
      });
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      runWithoutStopping();
      await launch(s.id, { stopOnEntry: false, noDebug: true });

      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'pause', {
        reason: 'pause', threadId: 1, description: 'Paused on debugger statement'
      });
      await vi.runAllTimersAsync();

      expect(sessionManager.getSession(s.id)?.lastStop?.reason).toBe('breakpoint');
      expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBe(true);
    });

    it('is cleared by a stop that names the breakpoints it hit, whatever the reason was called', async () => {
      pinPolicy({ honoursNoDebug: true });
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      await sessionManager.setBreakpoint(s.id, { file: '/work/src/app.py', line: 7 });
      runWithoutStopping();
      await launch(s.id, { stopOnEntry: false, noDebug: true });

      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'pause', {
        reason: 'pause', threadId: 1, hitBreakpointIds: [1]
      });
      await vi.runAllTimersAsync();

      expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBeUndefined();
    });

    it.each(['breakpoint', 'function breakpoint', 'exception', 'entry'])(
      "is cleared by a '%s' stop the adapter itself reported — one a disabled debugger cannot produce",
      async (reason) => {
        pinPolicy({ honoursNoDebug: true });
        const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
        runWithoutStopping();
        await launch(s.id, { stopOnEntry: false, noDebug: true });
        expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBe(true);

        dependencies.mockProxyManager.simulateEvent('stopped', 1, reason, { reason, threadId: 1 });
        await vi.runAllTimersAsync();

        expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBeUndefined();
      }
    );

    it('is not projected once the launch is over — the next set_breakpoint is an ordinary queued one', async () => {
      pinPolicy({ honoursNoDebug: true });
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      endDuringStartup();
      const result = await launch(s.id, { stopOnEntry: false, noDebug: true });
      expect(result.state).toBe(SessionState.STOPPED);

      const listed = sessionManager.getAllSessions().find((x) => x.id === s.id);
      expect(listed).not.toHaveProperty('debuggerDisabled');
    });

    it('recomputes it on restart_debugging, which replays the same arguments', async () => {
      pinPolicy({ honoursNoDebug: true });
      const s = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      runWithoutStopping();
      await launch(s.id, { stopOnEntry: false, noDebug: true });
      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      // A stop-free termination leaves the flag; restart resets and re-decides.
      runWithoutStopping();

      const restartPromise = sessionManager.restartDebugging(s.id);
      await vi.runAllTimersAsync();
      const result = await restartPromise;

      expect(result.success).toBe(true);
      expect(sessionManager.getSession(s.id)?.launchDebuggerOff).toBe(true);
    });
  });
});
