/**
 * The transition table's shadow through the real session manager over the mock
 * proxy: the flows the design runs recorded, the rows the reviews added, the
 * notes where today's code writes no state, strict mode on a transition the
 * table does not list, and the proof that the shadow changes no behaviour.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DebugLanguage, MockAdapterPolicy, SessionState, type AdapterPolicy } from '@debugmcp/shared';
import { SessionManager, type SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DapResponseError } from '../../../../src/proxy/dap-response-error.js';
import { StateShadowError, takeStrictFailures, type ShadowRecord, type StateShadow } from '../../../../src/session/machine/shadow.js';
import type { StateWrite } from '../../../../src/session/machine/transition-table.js';
import type { ManagedSession } from '../../../../src/session/session-store.js';
import { createMockDependencies } from './session-manager-test-utils.js';
import { internals } from '../../../test-utils/helpers/operations-internals.js';

const CONFIG: SessionManagerConfig = { logDirBase: '/tmp/test-sessions', defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true } };

type Dependencies = ReturnType<typeof createMockDependencies>;

/** What the adapter answers when it refuses a request. */
const refusal = (command: string, message = 'not now (injected)') =>
  new DapResponseError({ seq: 1, type: 'response', request_seq: 1, success: false, command, message });

const childReport = (reportId: string, pid = 4242) => ({
  reportId,
  targetId: String(pid),
  name: `Subprocess ${pid}`,
  configuration: { type: 'python', subProcessId: pid }
});

function shadowOf(sessionManager: SessionManager): StateShadow {
  return internals(sessionManager).stateShadow;
}

/** The verdict keys a block of work added: `outcome|site|event|from|to` -> count. */
async function delta(shadow: StateShadow, work: () => Promise<unknown> | unknown): Promise<Record<string, number>> {
  const before = new Map(shadow.countsByKey());
  await work();
  const added: Record<string, number> = {};
  for (const [key, count] of shadow.countsByKey()) {
    const n = count - (before.get(key) ?? 0);
    if (n > 0) added[key] = n;
  }
  return added;
}

function managed(sessionManager: SessionManager, sessionId: string): ManagedSession {
  return sessionManager.getSession(sessionId) as ManagedSession;
}

describe('the transition table shadow, through the session manager', () => {
  let sessionManager: SessionManager;
  let dependencies: Dependencies;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    sessionManager = new SessionManager(CONFIG, dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    dependencies.mockProxyManager.reset();
  });

  async function runningSession(): Promise<string> {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
    const started = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    expect((await started).state).toBe(SessionState.RUNNING);
    return session.id;
  }

  async function pausedSession(reason = 'breakpoint'): Promise<string> {
    const id = await runningSession();
    dependencies.mockProxyManager.simulateStopped(1, reason);
    await vi.runAllTimersAsync();
    expect(managed(sessionManager, id).state).toBe(SessionState.PAUSED);
    return id;
  }

  function pinNativeRestart(): void {
    vi.spyOn(sessionManager as unknown as { selectPolicy: (language: string) => AdapterPolicy }, 'selectPolicy')
      .mockReturnValue({ ...MockAdapterPolicy, restartViaDapRequest: true } as AdapterPolicy);
    dependencies.mockProxyManager.emit('adapter-capabilities', { supportsRestartRequest: true });
  }

  /** A step whose request fails with a non-DAP error: ERROR, and the proxy's handlers stay attached. */
  async function failedByAStep(): Promise<string> {
    const id = await pausedSession();
    dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
      if (command === 'next') throw new Error('step transport failure (injected)');
      return { success: true };
    });
    const result = await sessionManager.stepOver(id);
    expect(result.success).toBe(false);
    expect(managed(sessionManager, id).state).toBe(SessionState.ERROR);
    return id;
  }

  describe('a hot restart', () => {
    it('from a running program writes no state and is recorded as a legal hot-restart', async () => {
      const id = await runningSession();
      pinNativeRestart();
      dependencies.mockProxyManager.dapRequestCalls = [];
      const notified: SessionState[] = [];
      internals(sessionManager).opsContext.onStateChange(id, () => notified.push(managed(sessionManager, id).state));
      let result: Awaited<ReturnType<SessionManager['restartDebugging']>> | undefined;
      const added = await delta(shadowOf(sessionManager), async () => {
        const pending = sessionManager.restartDebugging(id);
        await vi.runAllTimersAsync();
        result = await pending;
      });
      expect(result).toMatchObject({ success: true, state: SessionState.RUNNING, data: expect.objectContaining({ hotRestart: true }) });
      expect(dependencies.mockProxyManager.dapRequestCalls.filter((c) => c.command === 'restart')).toHaveLength(1);
      expect(notified).toEqual([]);
      expect(added).toEqual({ 'legal|hotRestart.sent|hot-restart|running|running(note)': 1 });
    });

    it('from a running program, refused by the adapter, changes nothing and records only the note', async () => {
      const id = await runningSession();
      pinNativeRestart();
      dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'restart') throw refusal(command);
        return { success: true };
      });
      let result: Awaited<ReturnType<SessionManager['restartDebugging']>> | undefined;
      const added = await delta(shadowOf(sessionManager), async () => { result = await sessionManager.restartDebugging(id); });
      expect(result).toMatchObject({ success: false, state: SessionState.RUNNING });
      expect(added).toEqual({ 'legal|hotRestart.sent|hot-restart|running|running(note)': 1 });
    });

    for (const [how, failure, event] of [
      ['refused by the adapter', (command: string) => refusal(command), 'resume-refused'],
      ['with no answer', () => new Error('restart timed out after resuming (injected)'), 'resume-unanswered']
    ] as const) {
      it(`from paused, ${how} after the engine reported continued, rolls back as today and is guard-not-met`, async () => {
        const id = await pausedSession();
        pinNativeRestart();
        const proxy = dependencies.mockProxyManager;
        proxy.setDapRequestHandler(async (command: string) => {
          if (command === 'restart') {
            proxy.emit('continued');
            throw failure(command);
          }
          return { success: true };
        });
        const added = await delta(shadowOf(sessionManager), () => sessionManager.restartDebugging(id));
        // Today's behaviour, unchanged: the session says paused while the engine runs.
        expect(managed(sessionManager, id).state).toBe(SessionState.PAUSED);
        expect(added).toEqual({
          'legal|hotRestart.sent|hot-restart|paused|running': 1,
          'legal|handleContinued|continued|running|running': 1,
          [`guard-not-met|hotRestart.rejected|${event}|running|paused`]: 1
        });
      });
    }
  });

  describe('a refused or unanswered resume', () => {
    it('refused by the adapter after the engine reported continued rolls back as today and is guard-not-met', async () => {
      const id = await pausedSession();
      const proxy = dependencies.mockProxyManager;
      proxy.setDapRequestHandler(async (command: string) => {
        if (command === 'continue') {
          proxy.emit('continued');
          throw refusal(command);
        }
        return { success: true };
      });
      const added = await delta(shadowOf(sessionManager), async () => {
        await expect(sessionManager.continue(id)).rejects.toThrow('not now (injected)');
      });
      expect(managed(sessionManager, id).state).toBe(SessionState.PAUSED);
      expect(added['guard-not-met|continue.rejected|resume-refused|running|paused']).toBe(1);
      expect(shadowOf(sessionManager).mismatches().at(-1)).toMatchObject({ guard: 'refused-before-resume', sessionId: id });
    });

    it('with no answer after the engine reported continued rolls back as today and is guard-not-met', async () => {
      const id = await pausedSession();
      const proxy = dependencies.mockProxyManager;
      proxy.setDapRequestHandler(async (command: string) => {
        if (command === 'continue') {
          proxy.emit('continued');
          throw new Error('continue timed out after resuming (injected)');
        }
        return { success: true };
      });
      const added = await delta(shadowOf(sessionManager), async () => {
        await expect(sessionManager.continue(id)).rejects.toThrow('continue timed out after resuming');
      });
      expect(managed(sessionManager, id).state).toBe(SessionState.PAUSED);
      expect(added['guard-not-met|continue.rejected|resume-unanswered|running|paused']).toBe(1);
      expect(shadowOf(sessionManager).mismatches().at(-1)).toMatchObject({ guard: 'no-continued-since', sessionId: id });
    });

    it('refused before the engine resumed is legal; with no answer, the rollback is legacy', async () => {
      const id = await pausedSession();
      dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'continue') throw refusal(command);
        return { success: true };
      });
      let added = await delta(shadowOf(sessionManager), async () => {
        await expect(sessionManager.continue(id)).rejects.toThrow('not now');
      });
      expect(added).toEqual({
        'legal|continue.sent|resume|paused|running': 1,
        'legal|continue.rejected|resume-refused|running|paused': 1
      });
      dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'continue') throw new Error('Request cancelled during proxy shutdown: continue');
        return { success: true };
      });
      added = await delta(shadowOf(sessionManager), async () => {
        await expect(sessionManager.continue(id)).rejects.toThrow('cancelled');
      });
      expect(added).toEqual({
        'legal|continue.sent|resume|paused|running': 1,
        'legacy|continue.rejected|resume-unanswered|running|paused': 1
      });
    });

    for (const [how, failure, event] of [
      ['refused', (command: string) => refusal(command), 'resume-refused'],
      ['unanswered', () => new Error('continue rejected after a newer stop (injected)'), 'resume-unanswered']
    ] as const) {
      it(`${how} while a newer stop was shown keeps the session paused at that stop: the same-state row`, async () => {
        const id = await pausedSession();
        const session = managed(sessionManager, id);
        const firstStop = session.lastStop;
        const proxy = dependencies.mockProxyManager;
        proxy.setDapRequestHandler(async (command: string) => {
          if (command === 'continue') {
            proxy.simulateStopped(2, 'exception');
            throw failure(command);
          }
          return { success: true };
        });
        const added = await delta(shadowOf(sessionManager), async () => {
          await expect(sessionManager.continue(id)).rejects.toThrow();
        });
        expect(session.state).toBe(SessionState.PAUSED);
        expect(session.lastStop).not.toBe(firstStop);
        expect(session.lastStop?.reason).toBe('exception');
        expect(added).toEqual({
          'legal|continue.sent|resume|paused|running': 1,
          'legal|settleStop.shown|stop-shown|running|paused': 1,
          [`legal|continue.rejected|${event}|paused|paused`]: 1
        });
      });
    }

    it('a step the adapter refused is legal; with no stop recorded the direct write is guard-not-met', async () => {
      const id = await pausedSession();
      const session = managed(sessionManager, id);
      dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'next') throw refusal(command);
        return { success: true, body: { stackFrames: [] } };
      });
      let added = await delta(shadowOf(sessionManager), () => sessionManager.stepOver(id));
      expect(session.state).toBe(SessionState.PAUSED);
      expect(added['legal|executeStep.refused|resume-refused|running|paused']).toBe(1);

      // The same refusal with the stop record gone: today's code assigns PAUSED
      // directly (the gate's invariant would refuse it); the shadow notes it.
      dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'next') {
          session.lastStop = undefined;
          throw refusal(command);
        }
        return { success: true, body: { stackFrames: [] } };
      });
      added = await delta(shadowOf(sessionManager), () => sessionManager.stepOver(id));
      expect(session.state).toBe(SessionState.PAUSED);
      expect(session.lastStop).toBeUndefined();
      expect(added['guard-not-met|executeStep.refused-unrecorded|resume-refused|running|paused(note)']).toBe(1);
    });

    it('the core\'s own resume of an unseen entry stop, refused, leaves the stop shown (resume-unseen-failed)', async () => {
      const id = await runningSession();
      const proxy = dependencies.mockProxyManager;
      proxy.setDapRequestHandler(async (command: string) => {
        if (command === 'continue') throw new Error('auto-continue refused (injected)');
        return { success: true };
      });
      const added = await delta(shadowOf(sessionManager), async () => {
        proxy.simulateStopped(1, 'entry');
        await vi.runAllTimersAsync();
      });
      expect(managed(sessionManager, id).state).toBe(SessionState.PAUSED);
      expect(added).toEqual({
        'legacy|settleStop.hidden|stop-hidden|running|paused': 1,
        'legacy|continue.sent|resume-unseen|paused|running': 1,
        'legal|continue.rejected|resume-unseen-failed|running|paused': 1
      });
    });

    it('the core\'s own resume that fails after a newer stop was shown keeps that stop (resume-unseen-failed from paused)', async () => {
      const id = await runningSession();
      const proxy = dependencies.mockProxyManager;
      proxy.setDapRequestHandler(async (command: string) => {
        if (command === 'continue') {
          proxy.simulateStopped(1, 'breakpoint');
          throw new Error('auto-continue failed after a newer stop (injected)');
        }
        return { success: true };
      });
      const added = await delta(shadowOf(sessionManager), async () => {
        proxy.simulateStopped(1, 'entry');
        await vi.runAllTimersAsync();
      });
      const session = managed(sessionManager, id);
      expect(session.state).toBe(SessionState.PAUSED);
      expect(session.lastStop?.reason).toBe('breakpoint');
      expect(added['legal|continue.rejected|resume-unseen-failed|paused|paused']).toBe(1);
      expect(shadowOf(sessionManager).mismatches()).toEqual([]);
    });
  });

  describe('the endings', () => {
    const ORDERS: Array<Array<'terminated' | 'exited' | 'worker-exit'>> = [
      ['exited', 'terminated', 'worker-exit'],
      ['exited', 'worker-exit', 'terminated'],
      ['terminated', 'exited', 'worker-exit'],
      ['terminated', 'worker-exit', 'exited'],
      ['worker-exit', 'exited', 'terminated'],
      ['worker-exit', 'terminated', 'exited']
    ];
    const SITE = { terminated: 'handleTerminated', exited: 'handleExited', 'worker-exit': 'handleExit.expected' } as const;

    for (const order of ORDERS) {
      it(`${order.join(', ')}: one ending; the core receives no evidence after it`, async () => {
        const id = await runningSession();
        const proxy = dependencies.mockProxyManager;
        const added = await delta(shadowOf(sessionManager), async () => {
          for (const event of order) {
            if (event === 'terminated') proxy.emit('terminated');
            if (event === 'exited') proxy.emit('exited', 3);
            if (event === 'worker-exit') proxy.emit('exit', 0, undefined, true);
            await vi.advanceTimersByTimeAsync(1);
          }
          await vi.runAllTimersAsync();
        });
        expect(managed(sessionManager, id).state).toBe(SessionState.STOPPED);
        // The first terminal event ends the session; its handler removes the
        // others' listeners, so the later two reach no handler and leave no
        // record. (The worker's own exit after the reap is not the session's.)
        expect(added).toEqual({ [`legal|${SITE[order[0]]}|${order[0]}|running|ended`]: 1 });
      });
    }

    it('a worker exit that reaches a session a step failure left failed, handlers attached, has no row today', async () => {
      const id = await failedByAStep();
      // The evidence row it would be is the endings stage's (future); today the
      // exit reaches the session only because the failure left its handlers on.
      expect(() => dependencies.mockProxyManager.emit('exit', 1, undefined, false)).toThrow(StateShadowError);
      expect(managed(sessionManager, id).state).toBe(SessionState.ERROR);
      expect(takeStrictFailures()).toEqual([
        expect.objectContaining<Partial<ShadowRecord>>({ outcome: 'no-row', site: 'handleExit.ended', from: 'failed', note: true })
      ]);
    });

    it('a terminated after a failure that left the handlers attached rewrites failed as ended: no row, recorded', async () => {
      vi.stubEnv('MCP_STATE_SHADOW', 'record');
      const id = await failedByAStep();
      const added = await delta(shadowOf(sessionManager), async () => {
        dependencies.mockProxyManager.emit('terminated');
        await vi.runAllTimersAsync();
      });
      // Today's behaviour, unchanged; the table says failed is absorbing.
      expect(managed(sessionManager, id).state).toBe(SessionState.STOPPED);
      expect(added['no-row|handleTerminated|terminated|failed|ended']).toBe(1);
      expect(shadowOf(sessionManager).mismatches().at(-1)?.why).toBe('no row for terminated from failed');
    });
  });

  describe('strict mode', () => {
    it('fails a forced STOPPED -> RUNNING through the gate', async () => {
      const id = await runningSession();
      dependencies.mockProxyManager.emit('terminated');
      await vi.runAllTimersAsync();
      const session = managed(sessionManager, id);
      expect(session.state).toBe(SessionState.STOPPED);
      const gate = (sessionManager as unknown as {
        _updateSessionState: (s: ManagedSession, next: SessionState, write: { site: string; event: string }) => void;
      })._updateSessionState.bind(sessionManager);
      expect(() => gate(session, SessionState.RUNNING, { site: 'handleContinued', event: 'continued' })).toThrow(StateShadowError);
      const failures = takeStrictFailures();
      expect(failures).toEqual([expect.objectContaining<Partial<ShadowRecord>>({ outcome: 'no-row', from: 'ended', actual: 'running', event: 'continued' })]);
    });

    it('fails a resurrection through the handlers: a continued after a step failure, or over a test-made STOPPED', async () => {
      const failedId = await failedByAStep();
      expect(() => dependencies.mockProxyManager.emit('continued')).toThrow(StateShadowError);
      // The gate wrote first: today's behaviour is what it was, then strict mode threw.
      expect(managed(sessionManager, failedId).state).toBe(SessionState.RUNNING);
      expect(takeStrictFailures().map((r) => `${r.event} ${r.from} -> ${r.actual}`)).toEqual(['continued failed -> running']);

      // A test that sets .state bypasses the shadow; the next gate call from it is judged.
      const deps2 = createMockDependencies();
      const second = new SessionManager(CONFIG, deps2);
      const session = await second.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      const started = second.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
      await vi.runAllTimersAsync();
      await started;
      managed(second, session.id).state = SessionState.STOPPED;
      expect(() => deps2.mockProxyManager.emit('continued')).toThrow(StateShadowError);
      expect(takeStrictFailures().map((r) => `${r.event} ${r.from} -> ${r.actual}`)).toEqual(['continued ended -> running']);
      deps2.mockProxyManager.reset();
    });

    it('does not throw outside strict mode', async () => {
      vi.stubEnv('MCP_STATE_SHADOW', 'record');
      const id = await failedByAStep();
      expect(() => dependencies.mockProxyManager.emit('continued')).not.toThrow();
      expect(managed(sessionManager, id).state).toBe(SessionState.RUNNING);
      expect(shadowOf(sessionManager).counts()['no-row']).toBe(1);
      expect(takeStrictFailures()).toEqual([]);
    });
  });

  describe('the facts a guard reads are taken at the write', () => {
    it('a state listener that changes the stop record does not change the verdict on the write that told it', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      const s = managed(sessionManager, session.id);
      const gate = (next: SessionState, write: StateWrite) =>
        (sessionManager as unknown as { _updateSessionState: (s: ManagedSession, next: SessionState, write: StateWrite) => void })
          ._updateSessionState(s, next, write);
      gate(SessionState.INITIALIZING, { site: 'launch', event: 'start' });
      const shown = { reason: 'breakpoint', threadId: 1, timestamp: 1 };
      s.lastStop = shown;
      gate(SessionState.PAUSED, { site: 'settleStop.shown', event: 'stop-shown' });
      const token = shadowOf(sessionManager).token(s);
      gate(SessionState.RUNNING, { site: 'executeStep.sent', event: 'resume' });
      // When the refusal writes PAUSED, a listener moves the record to another stop.
      internals(sessionManager).opsContext.onStateChange(s.id, () => {
        if (s.state === SessionState.PAUSED) s.lastStop = { reason: 'exception', threadId: 2, timestamp: 2 };
      });
      const added = await delta(shadowOf(sessionManager), () =>
        gate(SessionState.PAUSED, { site: 'executeStep.refused', event: 'resume-refused', facts: { since: token } }));
      expect(added).toEqual({ 'legal|executeStep.refused|resume-refused|running|paused': 1 });
    });
  });

  describe('a run replaced', () => {
    it('a relaunch over a running program notes the replacement and judges the start from the old run\'s ending', async () => {
      const id = await runningSession();
      const added = await delta(shadowOf(sessionManager), async () => {
        const again = sessionManager.startDebugging(id, 'test.py', [], { stopOnEntry: false });
        await vi.runAllTimersAsync();
        await again;
      });
      expect(added['legal|launch.replace|replace|running|ended(note)']).toBe(1);
      expect(added['legal|launch|start|ended|starting']).toBe(1);
      expect(added['lifecycle-agrees|launch|lifecycle|-|starting']).toBe(1);
      expect(shadowOf(sessionManager).runOf(managed(sessionManager, id))).toBe(2);
    });

    it('a root event that arrives while a child is closing is judged from the live phase, then the replacement, then the start', async () => {
      const rootId = await runningSession();
      const proxy = dependencies.mockProxyManager;
      proxy.simulateEvent('child-reported', childReport('r1'));
      await vi.runAllTimersAsync();
      const child = sessionManager.getAllSessions().find((s) => s.parentSessionId === rootId)!;
      const view = proxy.childViews.get(child.id)!;
      const stopChild = view.stop.bind(view);
      // The root's listeners are still on while its children close.
      view.stop = async (options) => {
        proxy.simulateStopped(1, 'breakpoint');
        return stopChild(options);
      };
      const added = await delta(shadowOf(sessionManager), async () => {
        const again = sessionManager.startDebugging(rootId, 'test.py', [], { stopOnEntry: false });
        await vi.runAllTimersAsync();
        await again;
      });
      expect(added['legal|settleStop.shown|stop-shown|running|paused']).toBe(1);
      expect(added['legal|closeSingleSession|close|running|ended']).toBe(1);
      expect(added['legal|launch.replace|replace|paused|ended(note)']).toBe(1);
      expect(added['legal|launch|start|ended|starting']).toBe(1);
      expect(Object.keys(added).filter((key) => !/^(legal|legacy|lifecycle-agrees)\|/.test(key))).toEqual([]);
      expect(shadowOf(sessionManager).mismatches()).toEqual([]);
    });

    it('the same for a re-attach: a root event while a child is closing, then the replacement, then the start', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      const proxy = dependencies.mockProxyManager;
      proxy.setDapRequestHandler(async (command: string) =>
        command === 'threads' ? { success: true, body: { threads: [{ id: 1, name: 'main' }] } } : { success: true });
      const attached = sessionManager.attachToProcess(session.id, { port: 5678, stopOnEntry: false });
      await vi.runAllTimersAsync();
      expect((await attached).success).toBe(true);
      expect(managed(sessionManager, session.id).state).toBe(SessionState.RUNNING);
      proxy.simulateEvent('child-reported', childReport('r1'));
      await vi.runAllTimersAsync();
      const child = sessionManager.getAllSessions().find((s) => s.parentSessionId === session.id);
      expect(child, 'the attached root adopted a child').toBeDefined();
      const view = proxy.childViews.get(child!.id)!;
      const stopChild = view.stop.bind(view);
      view.stop = async (options) => {
        proxy.simulateStopped(1, 'breakpoint');
        return stopChild(options);
      };
      const added = await delta(shadowOf(sessionManager), async () => {
        const again = sessionManager.attachToProcess(session.id, { port: 5678, stopOnEntry: false });
        await vi.runAllTimersAsync();
        await again;
      });
      expect(added['legal|settleStop.shown|stop-shown|running|paused']).toBe(1);
      expect(added['legal|attach.replace|replace|paused|ended(note)']).toBe(1);
      expect(added['legal|attach|start|ended|starting']).toBe(1);
      expect(Object.keys(added).filter((key) => !/^(legal|legacy|lifecycle-agrees)\|/.test(key))).toEqual([]);
      expect(shadowOf(sessionManager).mismatches()).toEqual([]);
    });
  });

  describe('changes no behaviour', () => {
    type Variant = 'off' | 'record' | 'strict' | 'record, throwing';

    /** The same flow: launch, an unseen entry stop, a breakpoint, a step, a continue, a refused continue, a hot restart, close. */
    async function runFlow(variant: Variant) {
      vi.stubEnv('MCP_STATE_SHADOW', variant === 'record, throwing' ? 'record' : variant);
      const deps = createMockDependencies();
      const manager = new SessionManager(CONFIG, deps);
      if (variant === 'record, throwing') {
        const shadow = internals(manager).stateShadow as unknown as Record<string, unknown>;
        const boom = () => { throw new Error('the shadow throws (injected)'); };
        shadow.evaluate = boom;
        shadow.evaluateNote = boom;
        shadow.impliedLifecycle = boom;
        // and inside `begin`, the one call the gate makes before it writes
        (shadow.options as Record<string, unknown>).descendantsOf = boom;
      }
      const proxy = deps.mockProxyManager;
      const answers: unknown[] = [];
      const states: string[] = [];
      const session = await manager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      internals(manager).opsContext.onStateChange(session.id, () => states.push(String(manager.getSession(session.id)?.state ?? 'removed')));
      const settle = () => vi.runAllTimersAsync();

      const started = manager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
      await settle();
      answers.push(await started);
      proxy.simulateStopped(1, 'entry');
      await settle();
      proxy.simulateStopped(1, 'breakpoint');
      await settle();
      const step = manager.stepOver(session.id);
      await settle();
      answers.push(await step);
      const resumed = manager.continue(session.id);
      await settle();
      answers.push(await resumed);
      proxy.simulateStopped(1, 'breakpoint');
      await settle();
      proxy.setDapRequestHandler(async (command: string) => {
        if (command === 'continue') throw new Error('refused (injected)');
        return { success: true };
      });
      answers.push(await manager.continue(session.id).catch((error: Error) => ({ threw: error.message })));
      const policySpy = vi.spyOn(manager as unknown as { selectPolicy: (language: string) => AdapterPolicy }, 'selectPolicy')
        .mockReturnValue({ ...MockAdapterPolicy, restartViaDapRequest: true } as AdapterPolicy);
      proxy.emit('adapter-capabilities', { supportsRestartRequest: true });
      const restarted = manager.restartDebugging(session.id);
      await settle();
      answers.push(await restarted);
      answers.push(await manager.closeSessionReporting(session.id));
      const dap = proxy.dapRequestCalls.map((call) => call.command);
      proxy.reset();
      policySpy.mockRestore();
      const text = JSON.stringify(answers, (key, value) =>
        key === 'timestamp' || key === 'sessionId' || key === 'sentAt' ? undefined : value);
      return {
        states,
        dap,
        answers: JSON.parse(text.split(session.id).join('<session>')),
        counts: internals(manager).stateShadow.counts()
      };
    }

    it('the states each listener sees, the answers and the DAP requests are the same with the shadow off, recording, strict, and throwing', async () => {
      const off = await runFlow('off');
      const record = await runFlow('record');
      const strict = await runFlow('strict');
      const throwing = await runFlow('record, throwing');
      expect(off.states.length).toBeGreaterThan(6);
      expect(off.dap).toContain('restart');
      for (const other of [record, strict, throwing]) {
        expect(other.states).toEqual(off.states);
        expect(other.answers).toEqual(off.answers);
        expect(other.dap).toEqual(off.dap);
      }
      // what each variant recorded: nothing; verdicts; verdicts; only its own faults
      expect(off.counts).toEqual({});
      expect(record.counts.legal).toBeGreaterThan(0);
      expect(strict.counts).toEqual(record.counts);
      expect(Object.keys(throwing.counts)).toEqual(['internal-error']);
      expect(takeStrictFailures()).toEqual([]);
    });
  });
});
