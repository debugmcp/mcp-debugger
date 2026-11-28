/**
 * Row coverage of the session transition table: every row in force is matched
 * by a write the real session manager makes over the mock proxy. Each flow
 * names the rows it must match and checks them by id; the last test checks
 * that the flows together name every row in force, so a row added to the
 * table without a flow that makes it fails here. Rows marked `future` are not
 * in force and can never be matched: a write only a future row lists has no
 * row, which strict mode fails wherever it happens.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DebugLanguage, MockAdapterPolicy, SessionState, type AdapterPolicy } from '@debugmcp/shared';
import { SessionManager, type SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DapResponseError } from '../../../../src/proxy/dap-response-error.js';
import { IN_FORCE } from '../../../../src/session/machine/transition-table.js';
import type { StateShadow } from '../../../../src/session/machine/shadow.js';
import type { ManagedSession } from '../../../../src/session/session-store.js';
import { createMockDependencies } from './session-manager-test-utils.js';
import { internals } from '../../../test-utils/helpers/operations-internals.js';
import type { ProxyConfig } from '../../../../src/proxy/proxy-config.js';

const CONFIG: SessionManagerConfig = { logDirBase: '/tmp/test-sessions', defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true } };

const refusal = (command: string) =>
  new DapResponseError({ seq: 1, type: 'response', request_seq: 1, success: false, command, message: 'not now (injected)' });

const childReport = (reportId: string, pid = 4242) => ({
  reportId,
  targetId: String(pid),
  name: `Subprocess ${pid}`,
  configuration: { type: 'python', subProcessId: pid }
});

interface Harness {
  manager: SessionManager;
  deps: ReturnType<typeof createMockDependencies>;
  shadow: StateShadow;
  settle(): Promise<void>;
  session(id: string): ManagedSession;
  /** A new session, launched and running. */
  running(): Promise<string>;
  /** A new session, launched and paused at a breakpoint. */
  paused(): Promise<string>;
  /** A new session that borrows its program, the way an attach leaves one, running. */
  borrowed(): Promise<string>;
  pinNativeRestart(): void;
}

interface Flow {
  name: string;
  rows: string[];
  run(h: Harness): Promise<void>;
}

const FLOWS: Flow[] = [
  {
    name: 'a launch runs, stops, steps, continues and is closed',
    rows: ['start', 'adapter-configured', 'stop-shown', 'resume', 'continued', 'close'],
    async run(h) {
      const id = await h.running();
      h.deps.mockProxyManager.simulateStopped(1, 'breakpoint');
      await h.settle();
      const step = h.manager.stepOver(id);
      await h.settle();
      expect((await step).success).toBe(true);
      const resumed = h.manager.continue(id);
      await h.settle();
      expect((await resumed).success).toBe(true);
      await h.manager.closeSession(id);
    }
  },
  {
    name: 'a continued that arrives while paused is stale',
    rows: ['continued-stale'],
    async run(h) {
      const id = await h.paused();
      h.deps.mockProxyManager.emit('continued');
      expect(h.session(id).state).toBe(SessionState.PAUSED);
    }
  },
  {
    name: 'adapter-configured again while running',
    rows: ['adapter-configured-running'],
    async run(h) {
      await h.running();
      h.deps.mockProxyManager.emit('adapter-configured');
    }
  },
  {
    name: 'a relaunch over a running program replaces its run',
    rows: ['replace-live', 'start-again'],
    async run(h) {
      const id = await h.running();
      const again = h.manager.startDebugging(id, 'test.py', [], { stopOnEntry: false });
      await h.settle();
      expect((await again).success).toBe(true);
    }
  },
  {
    name: 'a relaunch over an ended root that retains a child replaces it',
    rows: ['adopt', 'terminated', 'replace-ended', 'start-again'],
    async run(h) {
      const id = await h.running();
      h.deps.mockProxyManager.simulateEvent('child-reported', childReport('r1'));
      await h.settle();
      expect(h.manager.getAllSessions().filter((s) => s.parentSessionId === id)).toHaveLength(1);
      h.deps.mockProxyManager.emit('terminated');
      await h.settle();
      expect(h.session(id).state).toBe(SessionState.STOPPED);
      const again = h.manager.startDebugging(id, 'test.py', [], { stopOnEntry: false });
      await h.settle();
      expect((await again).success).toBe(true);
    }
  },
  {
    name: 'an incompatible toolchain refuses the start',
    rows: ['start-refused'],
    async run(h) {
      const session = await h.manager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      vi.spyOn(internals(h.manager).proxyLauncher, 'start').mockRejectedValue(
        Object.assign(new Error('MSVC toolchain'), { toolchainValidation: { compatible: false, behavior: 'warn', message: 'MSVC toolchain' } })
      );
      const result = await h.manager.startDebugging(session.id, 'test.py');
      expect(result.error).toBe('MSVC_TOOLCHAIN_DETECTED');
      expect(h.session(session.id).state).toBe(SessionState.CREATED);
    }
  },
  {
    name: 'a launch fails, and its session is closed',
    rows: ['start-failed', 'close-failed'],
    async run(h) {
      const session = await h.manager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      h.deps.mockProxyManager.shouldFailStart = true;
      const result = await h.manager.startDebugging(session.id, 'test.py');
      expect(result.success).toBe(false);
      expect(h.session(session.id).state).toBe(SessionState.ERROR);
      await h.manager.closeSession(session.id);
    }
  },
  {
    name: 'a launch whose proxy reports an error before it fails',
    rows: ['error', 'start-failed-again'],
    async run(h) {
      const session = await h.manager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      const proxy = h.deps.mockProxyManager;
      vi.spyOn(proxy, 'start').mockImplementation(async (_config: ProxyConfig) => {
        proxy.emit('error', new Error('adapter crashed (injected)'));
        throw new Error('the proxy did not start (injected)');
      });
      const result = await h.manager.startDebugging(session.id, 'test.py');
      expect(result.success).toBe(false);
      expect(h.session(session.id).state).toBe(SessionState.ERROR);
    }
  },
  {
    name: 'a launch whose program ends during the start, then fails',
    rows: ['terminated', 'start-failed-ended'],
    async run(h) {
      const session = await h.manager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      const proxy = h.deps.mockProxyManager;
      vi.spyOn(proxy, 'start').mockImplementation(async (_config: ProxyConfig) => {
        proxy.emit('terminated');
        throw new Error('the debug server ended during the handshake (injected)');
      });
      const result = await h.manager.startDebugging(session.id, 'test.py');
      expect(result.success).toBe(false);
      expect(h.session(session.id).state).toBe(SessionState.ERROR);
    }
  },
  {
    name: 'an attach is verified, and a plain detach releases it',
    rows: ['start', 'attach-verified', 'release'],
    async run(h) {
      const session = await h.manager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      h.deps.mockProxyManager.setDapRequestHandler(async (command: string) =>
        command === 'threads' ? { success: true, body: { threads: [{ id: 1, name: 'main' }] } } : { success: true });
      const attached = h.manager.attachToProcess(session.id, { port: 5678, stopOnEntry: false });
      await h.settle();
      expect((await attached).success).toBe(true);
      expect(h.session(session.id).state).toBe(SessionState.RUNNING);
      const detached = await h.manager.detachFromProcess(session.id);
      expect(detached.success).toBe(true);
    }
  },
  {
    name: 'a detach the adapter answers with terminated finds the session already ended',
    rows: ['release-ended'],
    async run(h) {
      const id = await h.borrowed();
      const proxy = h.deps.mockProxyManager;
      proxy.detachResult = { trigger: 'detach', acknowledged: true, by: 'terminated' };
      proxy.setDapRequestHandler(async (command: string) => {
        if (command === 'disconnect') proxy.emit('terminated');
        return { success: true };
      });
      const detached = await h.manager.detachFromProcess(id);
      expect(detached.success).toBe(true);
    }
  },
  {
    name: 'an entry stop the core resumes unseen',
    rows: ['stop-hidden', 'resume-unseen'],
    async run(h) {
      const id = await h.running();
      h.deps.mockProxyManager.simulateStopped(1, 'entry');
      await h.settle();
      expect(h.session(id).state).toBe(SessionState.RUNNING);
    }
  },
  {
    name: 'the core\'s own resume refused, then failing after a newer stop was shown',
    rows: ['resume-unseen-failed', 'resume-unseen-failed-paused'],
    async run(h) {
      const proxy = h.deps.mockProxyManager;
      const first = await h.running();
      proxy.setDapRequestHandler(async (command: string) => {
        if (command === 'continue') throw new Error('auto-continue refused (injected)');
        return { success: true };
      });
      proxy.simulateStopped(1, 'entry');
      await h.settle();
      expect(h.session(first).state).toBe(SessionState.PAUSED);

      const deps = createMockDependencies();
      const manager = new SessionManager(CONFIG, deps);
      const session = await manager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      const started = manager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
      await h.settle();
      await started;
      deps.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'continue') {
          deps.mockProxyManager.simulateStopped(1, 'breakpoint');
          throw new Error('auto-continue failed after a newer stop (injected)');
        }
        return { success: true };
      });
      deps.mockProxyManager.simulateStopped(1, 'entry');
      await h.settle();
      for (const [id, n] of internals(manager).stateShadow.rowHits()) {
        (h.shadow.rowHits() as Map<string, number>).set(id, (h.shadow.rowHits().get(id) ?? 0) + n);
      }
      deps.mockProxyManager.reset();
    }
  },
  {
    name: 'hot restarts from paused and from running',
    rows: ['hot-restart'],
    async run(h) {
      const id = await h.paused();
      h.pinNativeRestart();
      let restarted = h.manager.restartDebugging(id);
      await h.settle();
      expect((await restarted).success).toBe(true);
      restarted = h.manager.restartDebugging(id);
      await h.settle();
      expect((await restarted).success).toBe(true);
    }
  },
  {
    name: 'refusals and requests with no answer, before and after a newer stop',
    rows: ['resume-refused', 'resume-refused-paused', 'resume-unanswered', 'resume-unanswered-paused'],
    async run(h) {
      const id = await h.paused();
      const proxy = h.deps.mockProxyManager;
      const fail = (failure: (command: string) => Error, newerStop: boolean) =>
        proxy.setDapRequestHandler(async (command: string) => {
          if (command === 'continue') {
            if (newerStop) proxy.simulateStopped(1, 'breakpoint');
            throw failure(command);
          }
          return { success: true };
        });
      const unanswered = () => new Error('Request cancelled during proxy shutdown: continue');
      for (const [failure, newerStop] of [[refusal, false], [refusal, true], [unanswered, false], [unanswered, true]] as const) {
        fail(failure, newerStop);
        await expect(h.manager.continue(id)).rejects.toThrow();
        expect(h.session(id).state).toBe(SessionState.PAUSED);
      }
    }
  },
  {
    name: 'a step request that fails otherwise fails the session',
    rows: ['resume-failed'],
    async run(h) {
      const id = await h.paused();
      h.deps.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'next') throw new Error('step transport failure (injected)');
        return { success: true };
      });
      expect((await h.manager.stepOver(id)).success).toBe(false);
      expect(h.session(id).state).toBe(SessionState.ERROR);
    }
  },
  {
    name: 'each terminal event ends a live session',
    rows: ['terminated', 'exited', 'worker-exit', 'error'],
    async run(h) {
      const endings: Array<() => void> = [
        () => h.deps.mockProxyManager.emit('terminated'),
        () => h.deps.mockProxyManager.emit('exited', 0),
        () => h.deps.mockProxyManager.emit('exit', 1, undefined, false),
        () => h.deps.mockProxyManager.emit('error', new Error('socket reset (injected)'))
      ];
      for (const end of endings) {
        const id = await h.running();
        end();
        await h.settle();
        expect([SessionState.STOPPED, SessionState.ERROR]).toContain(h.session(id).state);
        h.deps.mockProxyManager.reset();
      }
    }
  }
];

describe('row coverage of the transition table', () => {
  let h: Harness;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const deps = createMockDependencies();
    const manager = new SessionManager(CONFIG, deps);
    const settle = () => vi.runAllTimersAsync().then(() => undefined);
    const launch = async () => {
      const session = await manager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      const started = manager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
      await settle();
      expect((await started).state).toBe(SessionState.RUNNING);
      return session.id;
    };
    h = {
      manager,
      deps,
      shadow: internals(manager).stateShadow,
      settle,
      session: (id) => manager.getSession(id) as ManagedSession,
      running: launch,
      async paused() {
        const id = await launch();
        deps.mockProxyManager.simulateStopped(1, 'breakpoint');
        await settle();
        expect((manager.getSession(id) as ManagedSession).state).toBe(SessionState.PAUSED);
        return id;
      },
      async borrowed() {
        const id = await launch();
        const managed = manager.getSession(id) as ManagedSession;
        managed.run.attachMode = true;
        managed.run.programOwnership = 'borrowed';
        return id;
      },
      pinNativeRestart() {
        vi.spyOn(manager as unknown as { selectPolicy: (language: string) => AdapterPolicy }, 'selectPolicy')
          .mockReturnValue({ ...MockAdapterPolicy, restartViaDapRequest: true } as AdapterPolicy);
        deps.mockProxyManager.emit('adapter-capabilities', { supportsRestartRequest: true });
      }
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    h.deps.mockProxyManager.reset();
  });

  for (const flow of FLOWS) {
    it(`${flow.name}: ${flow.rows.join(', ')}`, async () => {
      await flow.run(h);
      const hits = h.shadow.rowHits();
      for (const id of flow.rows) {
        expect(hits.get(id) ?? 0, `row ${id} was not matched; matched: ${[...hits.keys()].join(', ')}`).toBeGreaterThan(0);
      }
      expect(h.shadow.mismatches()).toEqual([]);
    });
  }

  it('the flows together name every row in force, and only rows in force', () => {
    const named = new Set(FLOWS.flatMap((flow) => flow.rows));
    expect([...named].sort()).toEqual(IN_FORCE.map((row) => row.id).sort());
  });
});
