/**
 * The transition table's shadow through the real session manager over the mock
 * proxy: the flows the design runs recorded, the rows the review added, the
 * notes where today's code writes no state, strict mode on a transition the
 * table does not list, and the proof that the shadow changes no behaviour.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DebugLanguage, MockAdapterPolicy, SessionState, type AdapterPolicy } from '@debugmcp/shared';
import { SessionManager, type SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DapResponseError } from '../../../../src/proxy/dap-response-error.js';
import { StateShadowError, takeStrictFailures, type ShadowRecord, type StateShadow } from '../../../../src/session/machine/shadow.js';
import type { ManagedSession } from '../../../../src/session/session-store.js';
import { createMockDependencies } from './session-manager-test-utils.js';
import { internals } from '../../../test-utils/helpers/operations-internals.js';

const CONFIG: SessionManagerConfig = { logDirBase: '/tmp/test-sessions', defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true } };

type Dependencies = ReturnType<typeof createMockDependencies>;


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

  describe('a hot restart (R1)', () => {
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
        if (command === 'restart') throw new Error('restart refused (injected)');
        return { success: true };
      });
      let result: Awaited<ReturnType<SessionManager['restartDebugging']>> | undefined;
      const added = await delta(shadowOf(sessionManager), async () => { result = await sessionManager.restartDebugging(id); });
      expect(result).toMatchObject({ success: false, state: SessionState.RUNNING });
      expect(added).toEqual({ 'legal|hotRestart.sent|hot-restart|running|running(note)': 1 });
    });

    it('from paused, refused after the engine reported continued, rolls back as today and is guard-not-met (R1r)', async () => {
      const id = await pausedSession();
      pinNativeRestart();
      const proxy = dependencies.mockProxyManager;
      proxy.setDapRequestHandler(async (command: string) => {
        if (command === 'restart') {
          proxy.emit('continued');
          throw new Error('restart failed after resuming (injected)');
        }
        return { success: true };
      });
      const added = await delta(shadowOf(sessionManager), () => sessionManager.restartDebugging(id));
      // Today's behaviour, unchanged: the session says paused while the engine runs.
      expect(managed(sessionManager, id).state).toBe(SessionState.PAUSED);
      expect(added).toEqual({
        'legal|hotRestart.sent|hot-restart|paused|running': 1,
        'legal|handleContinued|continued|running|running': 1,
        'guard-not-met|hotRestart.refused|resume-refused|running|paused': 1
      });
      expect(shadowOf(sessionManager).mismatches().at(-1)).toMatchObject({ guard: 'refused-before-resume', sessionId: id });
    });
  });

  describe('a refused resume', () => {
    it('after the engine reported continued rolls back as today and is guard-not-met (R1r)', async () => {
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
      expect(added['guard-not-met|continue.refused|resume-refused|running|paused']).toBe(1);
    });

    it('before the engine resumed is legal', async () => {
      const id = await pausedSession();
      dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'continue') throw new Error('continue refused (injected)');
        return { success: true };
      });
      const added = await delta(shadowOf(sessionManager), async () => {
        await expect(sessionManager.continue(id)).rejects.toThrow('continue refused');
      });
      expect(added).toEqual({
        'legal|continue.sent|resume|paused|running': 1,
        'legal|continue.refused|resume-refused|running|paused': 1
      });
    });

    it('while a newer stop arrived keeps the session paused at that stop: the same-state row', async () => {
      const id = await pausedSession();
      const session = managed(sessionManager, id);
      const firstStop = session.lastStop;
      const proxy = dependencies.mockProxyManager;
      proxy.setDapRequestHandler(async (command: string) => {
        if (command === 'continue') {
          proxy.simulateStopped(2, 'exception');
          throw new Error('continue rejected after a newer stop (injected)');
        }
        return { success: true };
      });
      const added = await delta(shadowOf(sessionManager), async () => {
        await expect(sessionManager.continue(id)).rejects.toThrow('continue rejected after a newer stop');
      });
      expect(session.state).toBe(SessionState.PAUSED);
      expect(session.lastStop).not.toBe(firstStop);
      expect(session.lastStop?.reason).toBe('exception');
      expect(added).toEqual({
        'legal|continue.sent|resume|paused|running': 1,
        'legal|settleStop.shown|stop-shown|running|paused': 1,
        'legal|continue.refused|resume-refused|paused|paused': 1
      });
    });

    it('a step the adapter refused is legal; with no stop recorded the direct write is guard-not-met', async () => {
      const id = await pausedSession();
      const session = managed(sessionManager, id);
      const refuse = (command: string) => new DapResponseError({ seq: 1, type: 'response', request_seq: 1, success: false, command, message: 'not now (injected)' });
      dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'next') throw refuse(command);
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
          throw refuse(command);
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
        'legal|continue.refused|resume-unseen-failed|running|paused': 1
      });
    });
  });

  describe('the endings (R2)', () => {
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

    it('a worker exit that reaches an already-failed session is recorded as evidence', async () => {
      const id = await failedByAStep();
      const added = await delta(shadowOf(sessionManager), async () => {
        dependencies.mockProxyManager.emit('exit', 1, undefined, false);
        await vi.runAllTimersAsync();
      });
      expect(managed(sessionManager, id).state).toBe(SessionState.ERROR);
      expect(added).toEqual({ 'legal|handleExit.ended|worker-exit|failed|failed(note)': 1 });
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
      expect(shadowOf(sessionManager).mismatches().at(-1)?.why).toBe('terminated from failed goes to ended; the rows allow failed');
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
