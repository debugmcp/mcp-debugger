/**
 * SessionManager and the session tree (issue #1081): a child the worker
 * reports becomes a session of its own, linked by parentSessionId, adopted
 * with the parent's breakpoints under the per-tree cap, and wired like a root.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import { ErrorMessages } from '../../../../src/utils/error-messages.js';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, JsDebugAdapterPolicy, SessionState, type AdapterPolicy, type DapClientBehavior } from '@debugmcp/shared';
import { createMockDependencies, createMockEnvironment, overridePolicy } from './session-manager-test-utils.js';
import type { MockChildProxyView } from '../../../test-utils/mocks/mock-proxy-manager.js';

const report = (reportId: string, pid = 4242) => ({
  reportId,
  targetId: String(pid),
  name: `Subprocess ${pid}`,
  configuration: { type: 'python', subProcessId: pid }
});

describe('SessionManager child sessions (issue #1081)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  const config: SessionManagerConfig = {
    logDirBase: '/tmp/test-sessions',
    defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true }
  };

  function build(env?: Partial<Record<string, string>>): void {
    dependencies = createMockDependencies();
    if (env) {
      dependencies.environment = createMockEnvironment(env);
    }
    sessionManager = new SessionManager(config, dependencies);
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    build();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  async function startRoot(dapLaunchArgs?: Parameters<SessionManager['startDebugging']>[3]): Promise<string> {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    await sessionManager.setBreakpoint(session.id, { file: '/w/child.py', line: 7 });
    await sessionManager.startDebugging(session.id, 'test.py', undefined, dapLaunchArgs);
    await vi.runAllTimersAsync();
    return session.id;
  }

  const childOf = (rootId: string) => sessionManager.getAllSessions().find((s) => s.parentSessionId === rootId);
  const releases = () => dependencies.mockProxyManager.dapRequestCalls.filter((c) => c.command === 'childRelease');

  describe('one run record for the tree', () => {
    it('a child reads how its tree was started from the record its root writes, and a later write by the root is seen by the child', async () => {
      const rootId = await startRoot({ justMyCode: false });
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();
      const root = sessionManager.getSession(rootId)!;
      const child = sessionManager.getSession(childOf(rootId)!.id)!;

      // The same object, not a copy taken at adoption.
      expect(child.run).toBe(root.run);
      expect(child.run.lastLaunch).toMatchObject({ scriptPath: 'test.py', dapLaunchArgs: { justMyCode: false } });
      expect(child.run.effectiveBreakOnExceptions).toBe(root.run.effectiveBreakOnExceptions);

      root.run.launchDebuggerOff = true;
      expect(child.run.launchDebuggerOff).toBe(true);
    });

    it("refuses the launch-shaped operations on a child at the session layer: they would write, replay or judge by its root's run", async () => {
      const rootId = await startRoot();
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();
      const root = sessionManager.getSession(rootId)!;
      const childId = childOf(rootId)!.id;
      const launchBefore = root.run.lastLaunch;
      const startsBefore = dependencies.mockProxyManager.startCalls.length;

      const answers = [
        await sessionManager.startDebugging(childId, 'other.py'),
        await sessionManager.restartDebugging(childId),
        await sessionManager.attachToProcess(childId, { port: 5678 }),
        await sessionManager.detachFromProcess(childId),
        await sessionManager.detachFromProcess(childId, true)
      ];

      for (const answer of answers) {
        expect(answer.success, JSON.stringify(answer)).toBe(false);
        expect(answer.error).toContain(`it is a child session; it was started by its parent (${rootId})`);
      }
      // Each names the tool that was refused, and none reads as the root's ownership refusal.
      expect(answers.map((a) => /`(\w+)` cannot be used/.exec(a.error ?? '')?.[1])).toEqual([
        'start_debugging', 'restart_debugging', 'attach_to_process', 'detach_from_process', 'detach_from_process'
      ]);
      // The run is untouched: nothing was started, replayed or rewritten.
      expect(root.run.lastLaunch).toBe(launchBefore);
      expect(root.run.attachMode).not.toBe(true);
      expect(dependencies.mockProxyManager.startCalls.length).toBe(startsBefore);
      expect(sessionManager.getSession(childId)).toBeDefined();
    });

    it("a session nothing was started on has an empty record of its own, and two roots do not share one", async () => {
      const first = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      const second = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      expect(sessionManager.getSession(first.id)!.run).toEqual({});
      expect(sessionManager.getSession(first.id)!.run).not.toBe(sessionManager.getSession(second.id)!.run);
    });

    it("the notes of the root's launch are said on the root: a child's output does not start with them", async () => {
      const rootId = await startRoot();
      sessionManager.getSession(rootId)!.run.launchConfigNotices = ['a note about how the root was launched'];

      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();

      const child = sessionManager.getSession(childOf(rootId)!.id)!;
      expect(child.outputBuffer?.renderText() ?? '').not.toContain('a note about how the root was launched');
      expect(child.adapterNotices ?? []).toEqual([]);
    });
  });

  it('adopts a reported child as a session of its own, linked to the parent', async () => {
    const rootId = await startRoot();

    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();

    const child = childOf(rootId);
    expect(child).toBeDefined();
    expect(child!.language).toBe(DebugLanguage.MOCK);
    expect(child!.name).toBe('Subprocess 4242');
    const view = dependencies.mockProxyManager.childViews.get(child!.id)!;
    expect(view).toBeDefined();
    expect(view.adoptCalls).toHaveLength(1);
    expect(view.adoptCalls[0].reportId).toBe('r1');
    // The parent's breakpoints, snapshotted into the child, travel with the adoption.
    expect(view.adoptCalls[0].breakpoints).toEqual([expect.objectContaining({ file: '/w/child.py', line: 7 })]);
    expect(sessionManager.getSession(child!.id)!.breakpoints.size).toBe(1);
    expect(sessionManager.getSession(child!.id)!.proxyManager).toBe(view);
    expect(sessionManager.getSession(child!.id)!.state).toBe(SessionState.RUNNING);
  });

  it('a stop that lands before the adoption answer leaves the child paused, and the parent untouched', async () => {
    const rootId = await startRoot();
    let created: MockChildProxyView | undefined;
    const originalCreate = dependencies.mockProxyManager.createChildView.bind(dependencies.mockProxyManager);
    dependencies.mockProxyManager.createChildView = (id: string) => {
      created = originalCreate(id);
      created.holdAdopt = true;
      return created;
    };

    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();
    const child = childOf(rootId)!;
    // Running from the moment the adoption is sent: the connection is a live target.
    expect(sessionManager.getSession(child.id)!.state).toBe(SessionState.RUNNING);
    const parentStateBefore = sessionManager.getSession(rootId)!.state;

    created!.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    await vi.runAllTimersAsync();
    expect(sessionManager.getSession(child.id)!.state).toBe(SessionState.PAUSED);
    expect(sessionManager.getSession(child.id)!.lastStop).toMatchObject({ reason: 'breakpoint', threadId: 1 });

    created!.resolveAdopt();
    await vi.runAllTimersAsync();
    expect(sessionManager.getSession(child.id)!.state).toBe(SessionState.PAUSED);
    expect(sessionManager.getSession(rootId)!.state).toBe(parentStateBefore);
  });

  it('a child reported on a child is a grandchild of that child', async () => {
    const rootId = await startRoot();
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();
    const child = childOf(rootId)!;
    const childView = dependencies.mockProxyManager.childViews.get(child.id)!;

    childView.simulateEvent('child-reported', report('r2', 4343));
    await vi.runAllTimersAsync();

    const grandchild = childOf(child.id);
    expect(grandchild).toBeDefined();
    expect(grandchild!.name).toBe('Subprocess 4343');
    expect(dependencies.mockProxyManager.childViews.get(grandchild!.id)!.adoptCalls).toHaveLength(1);
  });

  it('releases every reported child when the cap is 0', async () => {
    build({ DEBUG_MCP_MAX_CHILD_SESSIONS: '0' });
    const rootId = await startRoot();

    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();

    expect(childOf(rootId)).toBeUndefined();
    expect(releases()).toEqual([expect.objectContaining({ command: 'childRelease', args: expect.objectContaining({ reportId: 'r1' }) })]);
  });

  it('copies function breakpoints and exception settings without sharing breakpoint records', async () => {
    const rootId = await startRoot();
    await sessionManager.setFunctionBreakpoint(rootId, { functionName: 'compute', condition: 'i > 2' });
    const root = sessionManager.getSession(rootId)!;
    root.run.effectiveBreakOnExceptions = 'all';
    root.run.launchExceptionFilters = { ids: ['raised'], beyondMode: [], noUncaughtStop: undefined };
    const original = Array.from(root.functionBreakpoints.values())[0];
    original.adapterId = 19;
    original.verified = true;

    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();

    const child = sessionManager.getSession(childOf(rootId)!.id)!;
    const copied = child.functionBreakpoints.get(original.id)!;
    expect(copied).not.toBe(original);
    expect(copied.adapterId).toBeUndefined();
    expect(copied.verified).toBe(false);
    expect(original.adapterId).toBe(19);
    expect(child.run.effectiveBreakOnExceptions).toBe('all');
    expect(child.run.launchExceptionFilters).toEqual({ ids: ['raised'], beyondMode: [], noUncaughtStop: undefined });
    expect(dependencies.mockProxyManager.childViews.get(child.id)!.adoptCalls[0].functionBreakpoints)
      .toEqual([{ name: 'compute', condition: 'i > 2' }]);
  });

  it('releases a report when the proxy cannot create child views', async () => {
    const rootId = await startRoot();
    Object.defineProperty(dependencies.mockProxyManager, 'createChildView', { value: undefined });
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();
    expect(childOf(rootId)).toBeUndefined();
    expect(releases()).toEqual([expect.objectContaining({ args: expect.objectContaining({ reason: 'this session cannot host child sessions' }) })]);
  });

  it('contains a release failure and records the adapter error', async () => {
    build({ DEBUG_MCP_MAX_CHILD_SESSIONS: '0' });
    const rootId = await startRoot();
    dependencies.mockProxyManager.shouldFailDapRequests = true;
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();
    expect(childOf(rootId)).toBeUndefined();
    expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Releasing reported child Subprocess 4242'));
  });

  it('counts the whole tree against the cap: a grandchild beyond it is released', async () => {
    build({ DEBUG_MCP_MAX_CHILD_SESSIONS: '1' });
    const rootId = await startRoot();
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();
    const child = childOf(rootId)!;
    const childView = dependencies.mockProxyManager.childViews.get(child.id)!;

    dependencies.mockProxyManager.simulateEvent('child-reported', report('r2', 4343));
    childView.simulateEvent('child-reported', report('r3', 4444));
    await vi.runAllTimersAsync();

    expect(sessionManager.getAllSessions().filter((s) => s.parentSessionId)).toHaveLength(1);
    expect(releases().map((c) => (c.args as { reportId: string }).reportId)).toEqual(['r2']);
    // The grandchild's release went out on the child's own view.
    expect(childView.dapRequestCalls.filter((c) => c.command === 'childRelease').map((c) => (c.args as { reportId: string }).reportId)).toEqual(['r3']);
  });

  describe('terminal cleanup is scoped to the connection', () => {
    async function rootWithChild(): Promise<{ rootId: string; childId: string; view: MockChildProxyView }> {
      const rootId = await startRoot();
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();
      const childId = childOf(rootId)!.id;
      const view = dependencies.mockProxyManager.childViews.get(childId)!;
      dependencies.mockProxyManager.stopCalls = 0;
      return { rootId, childId, view };
    }

    it("a child's end stops its own view only, never the worker", async () => {
      const { rootId, childId, view } = await rootWithChild();

      view.simulateEvent('terminated');
      await vi.runAllTimersAsync();

      expect(sessionManager.getSession(childId)!.state).toBe(SessionState.STOPPED);
      expect(view.stopCalls).toBe(1);
      expect(dependencies.mockProxyManager.stopCalls).toBe(0);
      expect(sessionManager.getSession(rootId)!.state).not.toBe(SessionState.STOPPED);
    });

    it("the root's natural end with a live child defers the worker reap until the child ends", async () => {
      const { rootId, childId, view } = await rootWithChild();

      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();

      expect(sessionManager.getSession(rootId)!.state).toBe(SessionState.STOPPED);
      expect(dependencies.mockProxyManager.stopCalls).toBe(0);
      // The child is still debuggable: its row and view are untouched.
      expect(sessionManager.getSession(childId)!.state).toBe(SessionState.RUNNING);
      expect(view.stopCalls).toBe(0);

      view.simulateEvent('terminated');
      await vi.runAllTimersAsync();

      expect(view.stopCalls).toBe(1);
      expect(dependencies.mockProxyManager.stopCalls).toBe(1);
    });

    it("the root's natural end with an already ended child reaps the worker at once", async () => {
      const { view } = await rootWithChild();
      view.simulateEvent('terminated');
      await vi.runAllTimersAsync();

      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();

      expect(dependencies.mockProxyManager.stopCalls).toBe(1);
    });

    it("the root's status-driven exit with a live child defers the reap the same way", async () => {
      const { rootId, view } = await rootWithChild();

      dependencies.mockProxyManager.simulateEvent('exit', 0, undefined, true);
      await vi.runAllTimersAsync();

      expect(sessionManager.getSession(rootId)!.state).toBe(SessionState.STOPPED);
      expect(dependencies.mockProxyManager.stopCalls).toBe(0);

      view.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      expect(dependencies.mockProxyManager.stopCalls).toBe(1);
    });

    it.each(['launch', 'attach'] as const)('a new %s retires the children of a crashed worker (#1231)', async (mode) => {
      const { rootId, childId, view } = await rootWithChild();
      const proxy = dependencies.mockProxyManager;
      // A process exit reaches the child views first, then the root. An IPC
      // termination status would also carry an 'expected' flag and schedule a reap.
      view.onWorkerExit(1);
      proxy.simulateExit(1);
      expect(sessionManager.getSession(childId)!.state).toBe(SessionState.ERROR);
      expect(sessionManager.getSession(rootId)!.state).toBe(SessionState.ERROR);

      if (mode === 'launch') {
        const started = await sessionManager.startDebugging(rootId, 'next.py', undefined, { stopOnEntry: false });
        expect(started.success, started.error).toBe(true);
        expect(started.data?.childrenClosed).toBe(1);
      } else {
        proxy.setDapRequestHandler(async (command) => command === 'threads'
          ? { success: true, body: { threads: [{ id: 1, name: 'main' }] } }
          : { success: true, body: {} });
        const attached = await sessionManager.attachToProcess(rootId, { port: 5678, stopOnEntry: false });
        expect(attached.success, attached.error).toBe(true);
      }

      const wait = await sessionManager.waitForStop(rootId, 100);
      expect(wait.data).toMatchObject({ sessionId: rootId, pending: true });
      expect(sessionManager.getAllSessions().map((s) => s.id)).toEqual([rootId]);
    });

    it.each(['exit', 'error'] as const)("a child connection's failure (%s) points at its tree's one log, the root's, never a file named after the child (#1222)", async (event) => {
      const { rootId, childId, view } = await rootWithChild();
      const root = sessionManager.getSession(rootId)!;
      const treeLog = {
        proxyLogPath: path.join(root.logDir!, `proxy-${rootId}.log`),
        proxyLogResource: `debug://sessions/${rootId}/proxy-log`
      };

      if (event === 'exit') {
        view.simulateEvent('exit', 134, undefined, false);
      } else {
        view.simulateEvent('error', new Error('adapter socket closed'));
      }

      const child = sessionManager.getSession(childId)!;
      expect(child.state).toBe(SessionState.ERROR);
      // Recorded before the handler returns...
      expect(child.failureDiagnostics).toEqual(treeLog);
      // ...and again by the log record written after it.
      await vi.waitFor(() => {
        expect(dependencies.mockLogger.error).toHaveBeenCalledWith(
          `[SessionManager] Detailed error in proxyExit for session ${childId}:`,
          expect.objectContaining(treeLog)
        );
      });
      await vi.runAllTimersAsync();
      expect(child.failureDiagnostics).toEqual(treeLog);
    });

    it('contains failure to stop a terminated child connection', async () => {
      const { rootId, childId, view } = await rootWithChild();
      vi.spyOn(view, 'stop').mockRejectedValue(new Error('disconnect failed'));
      view.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      expect(sessionManager.getSession(childId)!.state).toBe(SessionState.STOPPED);
      expect(sessionManager.getSession(rootId)!.state).not.toBe(SessionState.STOPPED);
      expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('disconnect failed'));
    });

    it('contains failure to reap the deferred worker after its last child ends', async () => {
      const { rootId, view } = await rootWithChild();
      dependencies.mockProxyManager.simulateEvent('terminated');
      vi.spyOn(dependencies.mockProxyManager, 'stop').mockRejectedValue(new Error('worker stop failed'));
      view.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      expect(sessionManager.getSession(rootId)!.deferredWorkerStop).toBeUndefined();
      expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('worker stop failed'));
    });
  });

  it.each([undefined, new Error('deferred stop failed'), 'deferred stop failed'])('closes a retained worker even when no child row remains (failure: %s)', async (failure) => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    const root = sessionManager.getSession(session.id)!;
    root.deferredWorkerStop = dependencies.mockProxyManager;
    const stop = vi.spyOn(dependencies.mockProxyManager, 'stop');
    if (failure !== undefined) stop.mockRejectedValue(failure);
    else stop.mockResolvedValue();

    await expect(sessionManager.closeSession(root.id)).resolves.toBe(true);

    expect(stop).toHaveBeenCalledTimes(1);
    expect(root.deferredWorkerStop).toBeUndefined();
    expect(sessionManager.getSession(root.id)).toBeUndefined();
    if (failure !== undefined) {
      expect(dependencies.mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('deferred worker'), 'deferred stop failed');
    }
  });

  describe('closing cascades over the subtree', () => {
    async function tree(): Promise<{ rootId: string; childId: string; grandchildId: string; childView: MockChildProxyView; grandchildView: MockChildProxyView }> {
      const rootId = await startRoot();
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();
      const childId = childOf(rootId)!.id;
      const childView = dependencies.mockProxyManager.childViews.get(childId)!;
      childView.simulateEvent('child-reported', report('r2', 4343));
      await vi.runAllTimersAsync();
      const grandchildId = childOf(childId)!.id;
      const grandchildView = dependencies.mockProxyManager.childViews.get(grandchildId)!;
      dependencies.mockProxyManager.stopCalls = 0;
      return { rootId, childId, grandchildId, childView, grandchildView };
    }

    const listed = (id: string) => sessionManager.getAllSessions().some((s) => s.id === id);

    it('closing the root closes grandchild, child, then root, and removes every row', async () => {
      const { rootId, childId, grandchildId, childView, grandchildView } = await tree();
      const order: string[] = [];
      vi.spyOn(childView, 'stop').mockImplementation(async () => { order.push('child'); });
      vi.spyOn(grandchildView, 'stop').mockImplementation(async () => { order.push('grandchild'); });
      vi.spyOn(dependencies.mockProxyManager, 'stop').mockImplementation(async () => { order.push('root'); });

      await expect(sessionManager.closeSession(rootId)).resolves.toBe(true);

      expect(order).toEqual(['grandchild', 'child', 'root']);
      expect(listed(rootId)).toBe(false);
      expect(listed(childId)).toBe(false);
      expect(listed(grandchildId)).toBe(false);
    });

    it('closing a child closes its subtree and leaves the root and the worker alone', async () => {
      const { rootId, childId, grandchildId, childView, grandchildView } = await tree();

      await expect(sessionManager.closeSession(childId)).resolves.toBe(true);

      expect(childView.stopCalls).toBe(1);
      expect(grandchildView.stopCalls).toBe(1);
      expect(dependencies.mockProxyManager.stopCalls).toBe(0);
      expect(listed(rootId)).toBe(true);
      expect(listed(childId)).toBe(false);
      expect(listed(grandchildId)).toBe(false);
      expect(sessionManager.getSession(rootId)!.state).not.toBe(SessionState.STOPPED);
    });

    it('closeAllSessions closes each session once, children before their root, with no not-found noise', async () => {
      const { childView, grandchildView } = await tree();

      await sessionManager.closeAllSessions();

      expect(childView.stopCalls).toBe(1);
      expect(grandchildView.stopCalls).toBe(1);
      expect(dependencies.mockProxyManager.stopCalls).toBe(1);
      expect(sessionManager.getAllSessions()).toHaveLength(0);
      const notFound = vi.mocked(dependencies.mockLogger.warn).mock.calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes('Session not found')
      );
      expect(notFound).toBe(false);
    });

    it('an ended child stays listed until closed, and leaves with its parent', async () => {
      const { rootId, childId, childView } = await tree();

      childView.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      expect(listed(childId)).toBe(true);
      expect(sessionManager.getSession(childId)!.state).toBe(SessionState.STOPPED);

      await sessionManager.closeSession(rootId);
      expect(listed(childId)).toBe(false);
    });

    it('closing a root whose reap was deferred stops the worker then', async () => {
      const { rootId, childId } = await tree();
      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      expect(dependencies.mockProxyManager.stopCalls).toBe(0);

      await sessionManager.closeSession(rootId);

      expect(dependencies.mockProxyManager.stopCalls).toBe(1);
      expect(listed(childId)).toBe(false);
    });

    it('restarting a root closes the previous run’s children first', async () => {
      const { rootId, childId, grandchildId, childView } = await tree();

      await sessionManager.restartDebugging(rootId);
      await vi.runAllTimersAsync();

      expect(childView.stopCalls).toBe(1);
      expect(listed(childId)).toBe(false);
      expect(listed(grandchildId)).toBe(false);
      expect(listed(rootId)).toBe(true);
    });

    it('restarting an ended root closes the children keeping its old worker alive', async () => {
      const { rootId, childId, grandchildId, childView, grandchildView } = await tree();
      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      expect(sessionManager.getSession(rootId)!.proxyManager).toBeUndefined();
      expect(sessionManager.getSession(rootId)!.deferredWorkerStop).toBe(dependencies.mockProxyManager);
      vi.spyOn(dependencies.mockProxyManager, 'stop').mockResolvedValue();

      const restarted = await sessionManager.restartDebugging(rootId);
      await vi.runAllTimersAsync();

      expect(restarted.success).toBe(true);
      expect(childView.stopCalls).toBe(1);
      expect(grandchildView.stopCalls).toBe(1);
      expect(listed(childId)).toBe(false);
      expect(listed(grandchildId)).toBe(false);
      expect(dependencies.mockProxyManager.stop).toHaveBeenCalledTimes(1);
      expect(sessionManager.getSession(rootId)!.deferredWorkerStop).toBeUndefined();
    });
  });

  it('a failed adoption releases the child, removes its row and warns', async () => {
    const rootId = await startRoot();
    const originalCreate = dependencies.mockProxyManager.createChildView.bind(dependencies.mockProxyManager);
    dependencies.mockProxyManager.createChildView = (id: string) => {
      const view = originalCreate(id);
      view.shouldFailAdopt = true;
      return view;
    };

    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();

    expect(childOf(rootId)).toBeUndefined();
    expect(releases().map((c) => (c.args as { reportId: string }).reportId)).toEqual(['r1']);
    const warned = vi.mocked(dependencies.mockLogger.warn).mock.calls.some(
      (call) => typeof call[0] === 'string' && call[0].includes('mock adoption failure')
    );
    expect(warned).toBe(true);
  });

  it('releases a report arriving while the parent is closing its existing child', async () => {
    const rootId = await startRoot();
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();
    const child = childOf(rootId)!;
    const view = dependencies.mockProxyManager.childViews.get(child.id)!;
    let finishStop!: () => void;
    vi.spyOn(view, 'stop').mockImplementation(() => new Promise<void>((resolve) => { finishStop = resolve; }));

    const closing = sessionManager.closeSession(rootId);
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r2'));
    await Promise.resolve();
    finishStop();
    await closing;

    expect(sessionManager.getAllSessions()).toHaveLength(0);
    expect(releases()).toEqual([expect.objectContaining({ args: expect.objectContaining({ reportId: 'r2' }) })]);
  });

  it('releases a grandchild report while an ancestor is closing another branch', async () => {
    const rootId = await startRoot();
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r2', 4343));
    await vi.runAllTimersAsync();
    const [first, second] = sessionManager.getAllSessions().filter((s) => s.parentSessionId === rootId);
    const firstView = dependencies.mockProxyManager.childViews.get(first.id)!;
    const secondView = dependencies.mockProxyManager.childViews.get(second.id)!;
    let finishStop!: () => void;
    vi.spyOn(firstView, 'stop').mockImplementation(() => new Promise<void>((resolve) => { finishStop = resolve; }));

    const closing = sessionManager.closeSession(rootId);
    secondView.simulateEvent('child-reported', report('grandchild', 4444));
    await Promise.resolve();
    finishStop();
    await closing;

    expect(sessionManager.getAllSessions()).toHaveLength(0);
    expect(secondView.dapRequestCalls).toEqual([
      expect.objectContaining({ command: 'childRelease', args: expect.objectContaining({ reportId: 'grandchild' }) })
    ]);
  });

  it('releases reports during relaunch teardown and accepts children of the next run', async () => {
    const rootId = await startRoot();
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();
    const view = dependencies.mockProxyManager.childViews.get(childOf(rootId)!.id)!;
    // The real launcher allocates a new proxy per run. Suppress the mock's
    // deferred exit on its reused instance so it cannot terminate the new run.
    vi.spyOn(dependencies.mockProxyManager, 'stop').mockResolvedValue();
    let finishStop!: () => void;
    vi.spyOn(view, 'stop').mockImplementation(() => new Promise<void>((resolve) => { finishStop = resolve; }));

    const restarting = sessionManager.restartDebugging(rootId);
    await vi.waitFor(() => expect(finishStop).toBeTypeOf('function'));
    dependencies.mockProxyManager.simulateEvent('child-reported', report('during-restart'));
    finishStop();
    await restarting;
    await vi.runAllTimersAsync();
    expect(childOf(rootId)).toBeUndefined();
    expect(releases()).toEqual([expect.objectContaining({ args: expect.objectContaining({ reportId: 'during-restart' }) })]);

    dependencies.mockProxyManager.simulateEvent('child-reported', report('next-run'));
    await vi.runAllTimersAsync();
    expect(childOf(rootId)).toBeDefined();
  });

  it('reaps a deferred root worker when its last pending adoption fails', async () => {
    const rootId = await startRoot();
    let failAdopt!: (error: Error) => void;
    const originalCreate = dependencies.mockProxyManager.createChildView.bind(dependencies.mockProxyManager);
    vi.spyOn(dependencies.mockProxyManager, 'createChildView').mockImplementation((id) => {
      const view = originalCreate(id);
      vi.spyOn(view, 'adopt').mockImplementation(() => new Promise((_, reject) => { failAdopt = reject; }));
      return view;
    });

    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    dependencies.mockProxyManager.stopCalls = 0;
    dependencies.mockProxyManager.simulateEvent('terminated');
    expect(dependencies.mockProxyManager.stopCalls).toBe(0);
    failAdopt(new Error('attach failed'));
    await vi.runAllTimersAsync();

    expect(childOf(rootId)).toBeUndefined();
    expect(dependencies.mockProxyManager.stopCalls).toBe(1);
    expect(sessionManager.getSession(rootId)!.deferredWorkerStop).toBeUndefined();
  });

  it('does not announce an adopted row after the caller already closed it', async () => {
    const rootId = await startRoot();
    const originalCreate = dependencies.mockProxyManager.createChildView.bind(dependencies.mockProxyManager);
    vi.spyOn(dependencies.mockProxyManager, 'createChildView').mockImplementation((id) => {
      const view = originalCreate(id);
      view.holdAdopt = true;
      return view;
    });
    const adopted = vi.fn();
    sessionManager.on('child-session-adopted', adopted);
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    const child = childOf(rootId)!;
    const view = dependencies.mockProxyManager.childViews.get(child.id)!;

    await sessionManager.closeSession(child.id);
    view.resolveAdopt();
    await vi.runAllTimersAsync();

    expect(adopted).not.toHaveBeenCalled();
    expect(childOf(rootId)).toBeUndefined();
  });

  it('closes descendants reported during an adoption that ultimately fails', async () => {
    const rootId = await startRoot();
    let failAdopt!: (error: Error) => void;
    const originalCreate = dependencies.mockProxyManager.createChildView.bind(dependencies.mockProxyManager);
    vi.spyOn(dependencies.mockProxyManager, 'createChildView').mockImplementationOnce((id) => {
      const view = originalCreate(id);
      vi.spyOn(view, 'adopt').mockImplementation(() => new Promise((_, reject) => { failAdopt = reject; }));
      return view;
    });
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    const child = childOf(rootId)!;
    const view = dependencies.mockProxyManager.childViews.get(child.id)!;
    view.simulateEvent('child-reported', report('r2', 4343));
    await vi.runAllTimersAsync();
    const grandchild = childOf(child.id)!;
    const grandchildView = dependencies.mockProxyManager.childViews.get(grandchild.id)!;

    failAdopt(new Error('attach failed'));
    await vi.runAllTimersAsync();

    expect(sessionManager.getAllSessions().map((s) => s.id)).toEqual([rootId]);
    expect(grandchildView.stopCalls).toBe(1);
    expect(view.stopCalls).toBe(1);
  });

  it('lets an in-progress explicit close own cleanup when adoption is cancelled', async () => {
    const rootId = await startRoot();
    let failAdopt!: (error: Error) => void;
    const originalCreate = dependencies.mockProxyManager.createChildView.bind(dependencies.mockProxyManager);
    vi.spyOn(dependencies.mockProxyManager, 'createChildView').mockImplementationOnce((id) => {
      const view = originalCreate(id);
      vi.spyOn(view, 'adopt').mockImplementation(() => new Promise((_, reject) => { failAdopt = reject; }));
      return view;
    });
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    const child = childOf(rootId)!;
    const view = dependencies.mockProxyManager.childViews.get(child.id)!;
    let finishStop!: () => void;
    const stop = vi.spyOn(view, 'stop').mockImplementation(() => new Promise<void>((resolve) => { finishStop = resolve; }));

    const closing = sessionManager.closeSession(child.id);
    failAdopt(new Error('adoption cancelled by close'));
    await vi.runAllTimersAsync();
    expect(stop).toHaveBeenCalledTimes(1);
    finishStop();
    await expect(closing).resolves.toBe(true);
    expect(childOf(rootId)).toBeUndefined();
  });

  describe('the close outcome (issue #1081, the cascade answers)', () => {
    async function tree(): Promise<{ rootId: string; childId: string; grandchildId: string; childView: MockChildProxyView; grandchildView: MockChildProxyView }> {
      const rootId = await startRoot();
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();
      const childId = childOf(rootId)!.id;
      const childView = dependencies.mockProxyManager.childViews.get(childId)!;
      childView.simulateEvent('child-reported', report('r2', 4343));
      await vi.runAllTimersAsync();
      const grandchildId = childOf(childId)!.id;
      const grandchildView = dependencies.mockProxyManager.childViews.get(grandchildId)!;
      return { rootId, childId, grandchildId, childView, grandchildView };
    }

    it("closing a child ends its process (debugpy's close) and says so", async () => {
      const { rootId, childId, childView } = await tree();

      const outcome = await sessionManager.closeSessionReporting(childId);

      expect(outcome).toEqual({ closed: true, closedSessionIds: expect.any(Array), childrenClosed: 1, processEnded: true });
      expect(outcome.closedSessionIds).toHaveLength(2);
      expect(outcome.closedSessionIds[1]).toBe(childId);
      expect(outcome.released).toBeUndefined();
      expect(childView.stopOptions[0]?.terminateDebuggee ?? true).toBe(true);
      expect(sessionManager.getSession(rootId)).toBeDefined();
    });

    it('closing a launch root counts the descendants it took with it, deepest first', async () => {
      const { rootId, childId, grandchildId } = await tree();

      const outcome = await sessionManager.closeSessionReporting(rootId);

      expect(outcome.closed).toBe(true);
      expect(outcome.childrenClosed).toBe(2);
      expect(outcome.closedSessionIds).toEqual([grandchildId, childId, rootId]);
      expect(outcome.processEnded).toBeUndefined();
      expect(outcome.released).toBeUndefined();
      expect(sessionManager.getAllSessions()).toHaveLength(0);
    });

    it('closing an attach root releases every descendant (targets kept) and says released', async () => {
      const { rootId, childView, grandchildView } = await tree();
      sessionManager.getSession(rootId)!.run.attachMode = true;
      sessionManager.getSession(rootId)!.run.programOwnership = 'borrowed';

      const outcome = await sessionManager.closeSessionReporting(rootId);

      expect(outcome.closed).toBe(true);
      expect(outcome.released).toBe(true);
      expect(outcome.childrenClosed).toBe(2);
      expect(grandchildView.stopOptions[0]).toEqual({ terminateDebuggee: false });
      expect(childView.stopOptions[0]).toEqual({ terminateDebuggee: false });
      expect(sessionManager.getAllSessions()).toHaveLength(0);
    });

    it.each(['launch', 'attach'] as const)('a new %s releases every child of the previous borrowed run (#1244)', async (mode) => {
      const { rootId, childView, grandchildView } = await tree();
      const previousRun = sessionManager.getSession(rootId)!.run;
      previousRun.attachMode = true;
      previousRun.programOwnership = 'borrowed';
      // The mock reuses its proxy on the new run. Suppress the old worker's deferred exit.
      vi.spyOn(dependencies.mockProxyManager, 'stop').mockResolvedValue();
      dependencies.mockProxyManager.setDapRequestHandler(async (command) => command === 'threads'
        ? { success: true, body: { threads: [{ id: 1, name: 'main' }] } }
        : { success: true, body: {} });

      const result = mode === 'launch'
        ? await sessionManager.startDebugging(rootId, 'next.py', undefined, { stopOnEntry: false })
        : await sessionManager.attachToProcess(rootId, { port: 5678, stopOnEntry: false });

      expect(result.success, result.error).toBe(true);
      expect(childView.stopOptions).toEqual([{ terminateDebuggee: false }]);
      expect(grandchildView.stopOptions).toEqual([{ terminateDebuggee: false }]);
      expect(sessionManager.getAllSessions().map((s) => s.id)).toEqual([rootId]);
    });

    it('a session with no tree answers the bare outcome, and a missing one closed: false', async () => {
      const rootId = await startRoot();
      expect(await sessionManager.closeSessionReporting(rootId)).toEqual({ closed: true, closedSessionIds: [rootId] });
      expect(await sessionManager.closeSessionReporting('no-such-session')).toEqual({ closed: false, closedSessionIds: [] });
    });

    it('closing an already ended child only removes its row, without claiming the close ended its process', async () => {
      const { childId, grandchildId, childView, grandchildView } = await tree();
      grandchildView.simulateEvent('terminated');
      childView.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      expect(sessionManager.getSession(childId)!.proxyManager).toBeUndefined();

      const outcome = await sessionManager.closeSessionReporting(childId);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [grandchildId, childId], childrenClosed: 1 });
    });
  });

  describe('the detach cascade (issue #1081): an attach root with children', () => {
    async function attachTree() {
      const rootId = await startRoot();
      sessionManager.getSession(rootId)!.run.attachMode = true;
      sessionManager.getSession(rootId)!.run.programOwnership = 'borrowed';
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();
      const childId = childOf(rootId)!.id;
      const childView = dependencies.mockProxyManager.childViews.get(childId)!;
      childView.simulateEvent('child-reported', report('r2', 4343));
      await vi.runAllTimersAsync();
      const grandchildId = childOf(childId)!.id;
      const grandchildView = dependencies.mockProxyManager.childViews.get(grandchildId)!;
      return { rootId, childId, grandchildId, childView, grandchildView };
    }

    it('releases every descendant deepest first before the root detaches, keeps their rows as stopped, and counts them', async () => {
      const { rootId, childId, grandchildId, childView, grandchildView } = await attachTree();
      const order: string[] = [];
      vi.spyOn(childView, 'stop').mockImplementation(async (options) => { order.push(`child:${options?.terminateDebuggee}`); });
      vi.spyOn(grandchildView, 'stop').mockImplementation(async (options) => { order.push(`grandchild:${options?.terminateDebuggee}`); });
      const rootSend = dependencies.mockProxyManager.sendDapRequest.bind(dependencies.mockProxyManager);
      vi.spyOn(dependencies.mockProxyManager, 'sendDapRequest').mockImplementation(async (command, args, options) => {
        if (command === 'disconnect') order.push('root:disconnect');
        return rootSend(command, args, options);
      });

      const detached = await sessionManager.detachFromProcess(rootId);
      await vi.runAllTimersAsync();

      expect(detached.success).toBe(true);
      expect(detached.state).toBe(SessionState.STOPPED);
      expect(detached.data?.childrenReleased).toBe(2);
      expect(order).toEqual(['grandchild:false', 'child:false', 'root:disconnect']);
      for (const id of [childId, grandchildId]) {
        const row = sessionManager.getSession(id)!;
        expect(row).toBeDefined();
        expect(row.state).toBe(SessionState.STOPPED);
        expect(row.proxyManager).toBeUndefined();
        expect(row.programEndExplanation).toEqual({
          note: 'Released: detached with its parent; the process runs on undebugged.',
          data: { released: true }
        });
      }
      expect(sessionManager.getAllSessions().find((s) => s.id === childId)?.programEnd?.data).toEqual({ released: true });
      expect(sessionManager.getSession(rootId)!.state).toBe(SessionState.STOPPED);
    });

    it('a terminating detach closes the subtree and counts what it closed', async () => {
      const { rootId, childId, grandchildId, childView, grandchildView } = await attachTree();
      const order: string[] = [];
      vi.spyOn(childView, 'stop').mockImplementation(async (options) => { order.push(`child:${options?.terminateDebuggee ?? true}`); });
      vi.spyOn(grandchildView, 'stop').mockImplementation(async (options) => { order.push(`grandchild:${options?.terminateDebuggee ?? true}`); });
      const rootSend = dependencies.mockProxyManager.sendDapRequest.bind(dependencies.mockProxyManager);
      vi.spyOn(dependencies.mockProxyManager, 'sendDapRequest').mockImplementation(async (command, args, options) => {
        if (command === 'disconnect') {
          order.push(`root:${(args as { terminateDebuggee: boolean }).terminateDebuggee}`);
        }
        return rootSend(command, args, options);
      });
      const removed = vi.fn();
      sessionManager.on('session-removed', removed);

      const detached = await sessionManager.detachFromProcess(rootId, true);
      await vi.runAllTimersAsync();

      expect(detached.success).toBe(true);
      expect(detached.data?.childrenClosed).toBe(2);
      expect(detached.data?.childrenReleased).toBeUndefined();
      expect(order).toEqual(['grandchild:true', 'child:true', 'root:true']);
      expect(removed.mock.calls).toEqual([[grandchildId], [childId], [rootId]]);
      expect(sessionManager.getSession(childId)).toBeUndefined();
      expect(sessionManager.getSession(grandchildId)).toBeUndefined();
      expect(sessionManager.getSession(rootId)).toBeUndefined();
    });

    it('releases reports arriving during child release or the root disconnect without adopting new rows', async () => {
      const { rootId, grandchildView } = await attachTree();
      let finishChildStop!: () => void;
      vi.spyOn(grandchildView, 'stop').mockImplementation(() => new Promise<void>((resolve) => { finishChildStop = resolve; }));
      let finishRootDisconnect!: () => void;
      const rootSend = dependencies.mockProxyManager.sendDapRequest.bind(dependencies.mockProxyManager);
      vi.spyOn(dependencies.mockProxyManager, 'sendDapRequest').mockImplementation(async (command, args, options) => {
        if (command === 'disconnect') {
          await new Promise<void>((resolve) => { finishRootDisconnect = resolve; });
        }
        return rootSend(command, args, options);
      });

      const detaching = sessionManager.detachFromProcess(rootId);
      await vi.waitFor(() => expect(finishChildStop).toBeTypeOf('function'));
      dependencies.mockProxyManager.simulateEvent('child-reported', report('during-child-release', 4444));
      finishChildStop();
      await vi.waitFor(() => expect(finishRootDisconnect).toBeTypeOf('function'));
      dependencies.mockProxyManager.simulateEvent('child-reported', report('during-root-disconnect', 4545));
      finishRootDisconnect();
      const detached = await detaching;
      await vi.runAllTimersAsync();

      expect(detached.success).toBe(true);
      expect(detached.data?.childrenReleased).toBe(2);
      expect(sessionManager.getAllSessions()).toHaveLength(3);
      expect(sessionManager.getAllSessions().every((session) => session.state === SessionState.STOPPED)).toBe(true);
      expect(releases().map((call) => (call.args as { reportId: string }).reportId)).toEqual([
        'during-child-release', 'during-root-disconnect'
      ]);
      expect(sessionManager.getSession(rootId)!.releasedChildReports).toBeUndefined();
    });

    it('a detach with no children answers as before', async () => {
      const rootId = await startRoot();
      sessionManager.getSession(rootId)!.run.attachMode = true;
      sessionManager.getSession(rootId)!.run.programOwnership = 'borrowed';

      const detached = await sessionManager.detachFromProcess(rootId);

      expect(detached.success).toBe(true);
      expect(detached.data).toEqual({ message: ErrorMessages.detachReleased(), released: true });
    });

    it('closing a released child preserves the release outcome and does not claim process termination', async () => {
      const { rootId, childId, grandchildId } = await attachTree();
      await sessionManager.detachFromProcess(rootId);

      const outcome = await sessionManager.closeSessionReporting(childId);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [grandchildId, childId], releasedSessionIds: [grandchildId, childId], childrenClosed: 1, released: true });
      expect(outcome.processEnded).toBeUndefined();
    });
  });

  describe('the tree answers (issue #1081, the designed flow)', () => {
    it("a child released beyond the cap is counted on the parent's next wait answer as childrenReleased", async () => {
      build({ DEBUG_MCP_MAX_CHILD_SESSIONS: '0' });
      const rootId = await startRoot();
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();

      const answer = await sessionManager.waitForStop(rootId, 100);

      expect(answer.data?.pending).toBe(true);
      expect(answer.data?.childrenReleased).toBe(1);
      expect(answer.data?.children).toBeUndefined();
    });

    // Issue #1137: the count alone explained nothing, and the pending message
    // promised a pause only the released child could reach.
    describe('a released child is explained wherever it is counted (issue #1137)', () => {
      const OFF =
        '1 child process was released to run undebugged (child sessions are off: DEBUG_MCP_MAX_CHILD_SESSIONS=0): ' +
        'a breakpoint only it reaches will not hit.';

      it('records why: child sessions off', async () => {
        build({ DEBUG_MCP_MAX_CHILD_SESSIONS: '0' });
        const rootId = await startRoot();
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
        await vi.runAllTimersAsync();

        expect(sessionManager.getSession(rootId)).toMatchObject({ releasedChildReports: 1, releasedChildCauses: { 'adoption-off': 1 } });
      });

      it('records why: the cap, with the limit that was in force', async () => {
        build({ DEBUG_MCP_MAX_CHILD_SESSIONS: '1' });
        const rootId = await startRoot();
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
        await vi.runAllTimersAsync();
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r2', 4343));
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r3', 4444));
        await vi.runAllTimersAsync();

        expect(sessionManager.getSession(rootId)).toMatchObject({
          releasedChildReports: 2,
          releasedChildCauses: { cap: 2 },
          releasedChildCap: 1
        });
      });

      it('records why: a session that cannot host child sessions', async () => {
        const rootId = await startRoot();
        Object.defineProperty(dependencies.mockProxyManager, 'createChildView', { value: undefined });
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
        await vi.runAllTimersAsync();

        expect(sessionManager.getSession(rootId)).toMatchObject({ releasedChildReports: 1, releasedChildCauses: { unsupported: 1 } });
      });

      it('records why: an adoption that failed', async () => {
        const rootId = await startRoot();
        const originalCreate = dependencies.mockProxyManager.createChildView.bind(dependencies.mockProxyManager);
        dependencies.mockProxyManager.createChildView = (id: string) => {
          const view = originalCreate(id);
          vi.spyOn(view, 'adopt').mockRejectedValue(new Error('the adapter refused'));
          return view;
        };
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
        await vi.runAllTimersAsync();

        expect(sessionManager.getSession(rootId)).toMatchObject({ releasedChildReports: 1, releasedChildCauses: { 'adoption-failed': 1 } });
      });

      it('a relaunch forgets the causes and the cap with the count', async () => {
        build({ DEBUG_MCP_MAX_CHILD_SESSIONS: '1' });
        const rootId = await startRoot();
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
        await vi.runAllTimersAsync();
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r2', 4343));
        await vi.runAllTimersAsync();
        expect(sessionManager.getSession(rootId)).toMatchObject({ releasedChildCauses: { cap: 1 }, releasedChildCap: 1 });
        vi.spyOn(dependencies.mockProxyManager, 'stop').mockResolvedValue();

        await sessionManager.restartDebugging(rootId);
        await vi.runAllTimersAsync();

        expect(sessionManager.getSession(rootId)!.releasedChildReports).toBeUndefined();
        expect(sessionManager.getSession(rootId)!.releasedChildCauses).toBeUndefined();
        expect(sessionManager.getSession(rootId)!.releasedChildCap).toBeUndefined();
      });

      it("a wait that answers for a child still explains the asked session's count: the number and the sentence are the root's", async () => {
        build({ DEBUG_MCP_MAX_CHILD_SESSIONS: '1' });
        const rootId = await startRoot();
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
        await vi.runAllTimersAsync();
        const child = childOf(rootId)!;
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r2', 4343));
        await vi.runAllTimersAsync();
        dependencies.mockProxyManager.childViews.get(child.id)!.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
        await vi.runAllTimersAsync();

        const answer = await sessionManager.waitForStop(rootId, 100);

        expect(answer.state).toBe(SessionState.PAUSED);
        expect(answer.data?.sessionId).toBe(child.id);
        expect(answer.data?.childrenReleased).toBe(1);
        expect(answer.data?.message?.startsWith('Paused (breakpoint)')).toBe(true);
        expect(answer.data?.message?.endsWith(
          '1 child process was released to run undebugged (the tree was at its child-session cap of 1, ' +
          'which DEBUG_MCP_MAX_CHILD_SESSIONS raises): a breakpoint only it reaches will not hit.'
        )).toBe(true);
      });

      it('the answer for a session that ended in error says it too', async () => {
        build({ DEBUG_MCP_MAX_CHILD_SESSIONS: '0' });
        const rootId = await startRoot();
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
        await vi.runAllTimersAsync();
        dependencies.mockProxyManager.simulateExit(1);
        await vi.runAllTimersAsync();

        const answer = await sessionManager.waitForStop(rootId, 100);

        expect(answer.state).toBe(SessionState.ERROR);
        expect(answer.data?.message).toMatch(/^The debug session ended in an error state/);
        expect(answer.data?.message?.endsWith(OFF)).toBe(true);
      });

      it('the pending wait answer says it, right after the promise it qualifies', async () => {
        build({ DEBUG_MCP_MAX_CHILD_SESSIONS: '0' });
        const rootId = await startRoot();
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
        await vi.runAllTimersAsync();

        const answer = await sessionManager.waitForStop(rootId, 100);

        expect(answer.data?.pending).toBe(true);
        expect(answer.data?.childrenReleased).toBe(1);
        expect(answer.data?.message).toMatch(/Call wait_for_stop again to keep waiting, or pause_execution to interrupt it\. 1 child process was released/);
        expect(answer.data?.message?.endsWith(OFF)).toBe(true);
      });

      it('the ended wait answer says it after the end summary', async () => {
        build({ DEBUG_MCP_MAX_CHILD_SESSIONS: '0' });
        const rootId = await startRoot();
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
        await vi.runAllTimersAsync();
        dependencies.mockProxyManager.simulateEvent('terminated');
        await vi.runAllTimersAsync();

        const answer = await sessionManager.waitForStop(rootId, 100);

        expect(answer.state).toBe(SessionState.STOPPED);
        expect(answer.data?.message).toBe(
          `The program ended without reporting an exit code without hitting any breakpoint. ${OFF}`
        );
      });

      it('the paused wait answer says it too: the count never appears unexplained', async () => {
        build({ DEBUG_MCP_MAX_CHILD_SESSIONS: '0' });
        const rootId = await startRoot();
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
        await vi.runAllTimersAsync();
        dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
        await vi.runAllTimersAsync();

        const answer = await sessionManager.waitForStop(rootId, 100);

        expect(answer.state).toBe(SessionState.PAUSED);
        expect(answer.data?.childrenReleased).toBe(1);
        expect(answer.data?.message?.startsWith('Paused (breakpoint)')).toBe(true);
        expect(answer.data?.message?.endsWith(OFF)).toBe(true);
      });

      it('the launch answer says it when the child was released during the launch', async () => {
        build({ DEBUG_MCP_MAX_CHILD_SESSIONS: '0' });
        const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
        await sessionManager.setBreakpoint(session.id, { file: '/w/child.py', line: 7 });
        const starting = sessionManager.startDebugging(session.id, 'test.py');
        await vi.advanceTimersByTimeAsync(100);
        dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
        await vi.runAllTimersAsync();
        const started = await starting;

        expect(started.data?.pending).toBe(true);
        expect(started.data?.childrenReleased).toBe(1);
        expect(started.data?.message).toContain('has not reached');
        expect(started.data?.message?.endsWith(OFF)).toBe(true);
      });

      it('an answer on a session that released nothing reads as before', async () => {
        const rootId = await startRoot();

        const answer = await sessionManager.waitForStop(rootId, 100);

        expect(answer.data?.message).not.toContain('released');
      });
    });

    it('a relaunch starts the released count afresh', async () => {
      build({ DEBUG_MCP_MAX_CHILD_SESSIONS: '0' });
      const rootId = await startRoot();
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();
      expect((await sessionManager.waitForStop(rootId, 100)).data?.childrenReleased).toBe(1);

      vi.spyOn(dependencies.mockProxyManager, 'stop').mockResolvedValue();
      const restarted = await sessionManager.restartDebugging(rootId);
      await vi.runAllTimersAsync();

      expect(restarted.success).toBe(true);
      expect((await sessionManager.waitForStop(rootId, 100)).data?.childrenReleased).toBeUndefined();
    });

    it('a report released while its subtree is closing is not counted', async () => {
      const rootId = await startRoot();
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();
      const view = dependencies.mockProxyManager.childViews.get(childOf(rootId)!.id)!;
      vi.spyOn(dependencies.mockProxyManager, 'stop').mockResolvedValue();
      let finishStop!: () => void;
      vi.spyOn(view, 'stop').mockImplementation(() => new Promise<void>((resolve) => { finishStop = resolve; }));

      const restarting = sessionManager.restartDebugging(rootId);
      await vi.waitFor(() => expect(finishStop).toBeTypeOf('function'));
      dependencies.mockProxyManager.simulateEvent('child-reported', report('during-restart'));
      finishStop();
      await restarting;
      await vi.runAllTimersAsync();

      expect(sessionManager.getSession(rootId)!.releasedChildReports).toBeUndefined();
    });

    it('a restart answers childrenClosed with the number of descendants the relaunch closed', async () => {
      const rootId = await startRoot();
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();
      const childView = dependencies.mockProxyManager.childViews.get(childOf(rootId)!.id)!;
      childView.simulateEvent('child-reported', report('r2', 4343));
      await vi.runAllTimersAsync();
      vi.spyOn(dependencies.mockProxyManager, 'stop').mockResolvedValue();
      const removed = vi.fn();
      sessionManager.on('session-removed', removed);

      const restarted = await sessionManager.restartDebugging(rootId);
      await vi.runAllTimersAsync();

      expect(restarted.success).toBe(true);
      expect(restarted.data?.childrenClosed).toBe(2);
      expect(restarted.data?.children).toBeUndefined();
      // The old launch owned this target. Its adapter's default close ends it.
      expect(childView.stopOptions).toEqual([undefined]);
      expect(removed).toHaveBeenCalledTimes(2);
      expect(removed).not.toHaveBeenCalledWith(rootId);
    });

    it('a launch with nothing to tear down answers no childrenClosed', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      const started = await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      expect(started.data?.childrenClosed).toBeUndefined();
    });

    it('a child adopted during the launch hold is listed on the launch answer', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
      const starting = sessionManager.startDebugging(session.id, 'test.py');
      await vi.advanceTimersByTimeAsync(100);
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();
      const started = await starting;

      expect(started.success).toBe(true);
      expect(started.data?.pending).toBe(true);
      const child = childOf(session.id)!;
      expect(started.data?.children).toEqual([
        { sessionId: child.id, name: 'Subprocess 4242', state: SessionState.RUNNING, parentSessionId: session.id }
      ]);
    });
  });

  // Issue #1128: a child's stops are recorded on the child's row, and that row
  // is gone once the child is closed — so the count a root's end summary needs
  // is kept on every ancestor, per run.
  describe("a descendant's stops are counted on its ancestors (issue #1128)", () => {
    const breakpointStop = { reason: 'breakpoint', threadId: 1, allThreadsStopped: true };

    async function tree(): Promise<{ rootId: string; childId: string; view: MockChildProxyView }> {
      const rootId = await startRoot();
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();
      const childId = childOf(rootId)!.id;
      return { rootId, childId, view: dependencies.mockProxyManager.childViews.get(childId)! };
    }

    async function stopAt(view: MockChildProxyView): Promise<void> {
      view.simulateStopped(1, 'breakpoint', breakpointStop);
      await vi.runAllTimersAsync();
    }

    it('each stop of a child is counted on its parent, never on the child itself', async () => {
      const { rootId, childId, view } = await tree();

      await stopAt(view);
      await sessionManager.continue(childId);
      await stopAt(view);

      expect(sessionManager.getSession(rootId)!.descendantStops).toBe(2);
      expect(sessionManager.getSession(childId)!.descendantStops).toBeUndefined();
      // The root's own record is untouched: it never stopped.
      expect(sessionManager.getSession(rootId)!.lastStop).toBeUndefined();
    });

    it("a grandchild's stop is counted on its parent and on the root", async () => {
      const { rootId, childId, view } = await tree();
      view.simulateEvent('child-reported', report('r2', 4343));
      await vi.runAllTimersAsync();
      const grandchildView = dependencies.mockProxyManager.childViews.get(childOf(childId)!.id)!;

      await stopAt(grandchildView);

      expect(sessionManager.getSession(childId)!.descendantStops).toBe(1);
      expect(sessionManager.getSession(rootId)!.descendantStops).toBe(1);
    });

    it('the count outlives the child: closing it removes the row, not what the tree did', async () => {
      const { rootId, childId, view } = await tree();
      await stopAt(view);

      await sessionManager.closeSession(childId);

      expect(sessionManager.getSession(childId)).toBeUndefined();
      expect(sessionManager.getSession(rootId)!.descendantStops).toBe(1);
    });

    it('a relaunch starts the count afresh', async () => {
      const { rootId, view } = await tree();
      await stopAt(view);
      vi.spyOn(dependencies.mockProxyManager, 'stop').mockResolvedValue();

      await sessionManager.restartDebugging(rootId);
      await vi.runAllTimersAsync();

      expect(sessionManager.getSession(rootId)!.descendantStops).toBeUndefined();
    });

    it('a stop the server resumed by itself is not one: the entry stop of a child is never shown', async () => {
      const { rootId, view } = await tree();

      view.simulateStopped(1, 'entry', { reason: 'entry', threadId: 1, allThreadsStopped: true });
      await vi.runAllTimersAsync();

      expect(sessionManager.getSession(rootId)!.descendantStops).toBeUndefined();
    });

    it("the issue's flow: the child stops twice and is closed, then the root ends — its answer no longer says nothing was hit", async () => {
      const { rootId, childId, view } = await tree();
      await stopAt(view);
      await sessionManager.continue(childId);
      await stopAt(view);
      await sessionManager.closeSession(childId);

      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      const answer = await sessionManager.waitForStop(rootId, 100);

      expect(answer.state).toBe(SessionState.STOPPED);
      expect(answer.data?.message).toBe('The program ended without reporting an exit code. Its child sessions stopped 2 times during this run.');
      expect(answer.data).not.toHaveProperty('unhitBreakpoints');
    });

    it('a root whose children never stopped still says which breakpoints it ran past', async () => {
      const { rootId, view } = await tree();
      view.simulateEvent('terminated');
      await vi.runAllTimersAsync();

      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      const answer = await sessionManager.waitForStop(rootId, 100);

      expect(answer.data?.message).toContain('without hitting any breakpoint');
      expect(answer.data?.unhitBreakpoints).toEqual([expect.objectContaining({ file: '/w/child.py', line: 7 })]);
    });
  });

  // Issue #1214: a child was adopted, never launched. What the launch asked
  // for is its root's, and the sentences that depend on it read the root.
  describe("a child's pending step_into reads what its tree's launch asked for (issue #1214)", () => {
    /** The raw paused frame the step goes out from: dependency code, which a default js launch skips. */
    const DEPENDENCY_FRAME = { id: 1, name: 'handle', source: { path: '/app/node_modules/router/index.js' }, line: 160, column: 5 };

    async function pendingStepIntoOnChild(dapLaunchArgs?: Parameters<SessionManager['startDebugging']>[3]) {
      const describePendingStop = vi.fn(JsDebugAdapterPolicy.describePendingStop);
      const facade = sessionManager as unknown as { selectPolicy: (language: string) => AdapterPolicy };
      const original = facade.selectPolicy.bind(sessionManager);
      vi.spyOn(facade, 'selectPolicy').mockImplementation((language) => ({ ...original(language), describePendingStop }));
      const rootId = await startRoot(dapLaunchArgs);
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();
      const childId = childOf(rootId)!.id;
      const view = dependencies.mockProxyManager.childViews.get(childId)!;
      view.simulateStopped(3, 'breakpoint', { reason: 'breakpoint', threadId: 3 });
      await vi.runAllTimersAsync();
      expect(sessionManager.getSession(childId)!.state).toBe(SessionState.PAUSED);
      // The step goes out and never lands.
      view.setDapRequestHandler(async (command: string) =>
        command === 'stackTrace'
          ? { success: true, body: { stackFrames: [DEPENDENCY_FRAME], totalFrames: 1 } }
          : { success: true, body: {} });

      const step = sessionManager.stepInto(childId);
      await vi.advanceTimersByTimeAsync(6000);
      const data = (await step).data as { message?: string; pending?: boolean };
      return { data, describePendingStop };
    }

    it('explains the skipped code it went out from, as for a root, under a default launch', async () => {
      const { data, describePendingStop } = await pendingStepIntoOnChild();

      expect(data.pending).toBe(true);
      expect(data.message).toContain('The step was issued from skipped code (/app/node_modules/router/index.js:160)');
      expect(describePendingStop).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'step',
        attachMode: false,
        launch: expect.objectContaining({ dapLaunchArgs: expect.objectContaining({ justMyCode: true }) })
      }));
    });

    it('says nothing of skipped code when the launch asked for justMyCode: false', async () => {
      const { data, describePendingStop } = await pendingStepIntoOnChild({ justMyCode: false });

      expect(data.pending).toBe(true);
      expect(data.message).toBe(ErrorMessages.stepStillRunning(5));
      expect(describePendingStop).toHaveBeenCalledWith(expect.objectContaining({
        launch: expect.objectContaining({ dapLaunchArgs: expect.objectContaining({ justMyCode: false }) })
      }));
    });
  });

  it('releases the report and removes the row if creating its proxy view fails', async () => {
    const rootId = await startRoot();
    vi.spyOn(dependencies.mockProxyManager, 'createChildView').mockImplementation(() => {
      throw new Error('view unavailable');
    });

    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();

    expect(childOf(rootId)).toBeUndefined();
    expect(releases()).toEqual([expect.objectContaining({ args: expect.objectContaining({ reportId: 'r1' }) })]);
    expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('view unavailable'));
  });

  describe('a child whose adapter can only release it, with its output on the launch session (js-debug, issue #1082)', () => {
    async function jsTree(): Promise<{ rootId: string; childId: string; grandchildId: string; childView: MockChildProxyView; grandchildView: MockChildProxyView }> {
      overridePolicy(sessionManager, { childAdoption: JsDebugAdapterPolicy.childAdoption });
      const rootId = await startRoot();
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();
      const childId = childOf(rootId)!.id;
      const childView = dependencies.mockProxyManager.childViews.get(childId)!;
      childView.simulateEvent('child-reported', report('r2', 4343));
      await vi.runAllTimersAsync();
      const grandchildId = childOf(childId)!.id;
      const grandchildView = dependencies.mockProxyManager.childViews.get(grandchildId)!;
      return { rootId, childId, grandchildId, childView, grandchildView };
    }

    it('closing the child keeps its target: the connection closes with terminateDebuggee false and the answer says released', async () => {
      const { rootId, childId, grandchildId, childView, grandchildView } = await jsTree();

      const outcome = await sessionManager.closeSessionReporting(childId);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [grandchildId, childId], releasedSessionIds: [grandchildId, childId], childrenClosed: 1, released: true });
      expect(outcome.processEnded).toBeUndefined();
      expect(childView.stopOptions[0]).toEqual({ terminateDebuggee: false });
      expect(grandchildView.stopOptions[0]).toEqual({ terminateDebuggee: false });
      expect(sessionManager.getSession(rootId)).toBeDefined();
    });

    it('closing the launch root releases such children on its way down', async () => {
      const { rootId, childView, grandchildView } = await jsTree();

      const outcome = await sessionManager.closeSessionReporting(rootId);

      expect(outcome.closed).toBe(true);
      expect(outcome.childrenClosed).toBe(2);
      expect(outcome.released).toBeUndefined();
      expect(childView.stopOptions[0]).toEqual({ terminateDebuggee: false });
      expect(grandchildView.stopOptions[0]).toEqual({ terminateDebuggee: false });
      expect(sessionManager.getAllSessions()).toHaveLength(0);
    });

    it("outputOnFor names the tree's root for a child whose output rides the launch session, and nothing otherwise", async () => {
      const { rootId, childId, grandchildId } = await jsTree();

      expect(sessionManager.outputOnFor(childId)).toBe(rootId);
      expect(sessionManager.outputOnFor(grandchildId)).toBe(rootId);
      expect(sessionManager.outputOnFor(rootId)).toBeUndefined();
      expect(sessionManager.outputOnFor('no-such-session')).toBeUndefined();

      // An orphaned subtree whose walk ends below the root never points a
      // grandchild at an intermediate child that holds no tree output.
      sessionManager.getSession(childId)!.parentSessionId = 'gone-root';
      expect(sessionManager.outputOnFor(grandchildId)).toBeUndefined();
      sessionManager.getSession(childId)!.parentSessionId = rootId;

      // A debugpy child carries its own lines: no pointer.
      overridePolicy(sessionManager, { childAdoption: { ...JsDebugAdapterPolicy.childAdoption!, childOutput: 'own-connection' } });
      expect(sessionManager.outputOnFor(childId)).toBeUndefined();
    });

    it("treeChildrenOf lists a session's descendants as the tree answers do, and nothing for a leaf (issue #1212)", async () => {
      const { rootId, childId, grandchildId } = await jsTree();

      expect(sessionManager.treeChildrenOf(rootId)).toEqual([
        { sessionId: childId, name: sessionManager.getSession(childId)!.name, state: sessionManager.getSession(childId)!.state, parentSessionId: rootId },
        {
          sessionId: grandchildId,
          name: sessionManager.getSession(grandchildId)!.name,
          state: sessionManager.getSession(grandchildId)!.state,
          parentSessionId: childId
        }
      ]);
      expect(sessionManager.treeChildrenOf(childId)).toEqual([expect.objectContaining({ sessionId: grandchildId, parentSessionId: childId })]);
      expect(sessionManager.treeChildrenOf(grandchildId)).toBeUndefined();
      expect(sessionManager.treeChildrenOf('no-such-session')).toBeUndefined();
    });

    it("keeps a logpoint line a launch child's own connection delivers on the child's buffer, pointer or not (issue #1212)", async () => {
      const { rootId, childId, childView } = await jsTree();
      childView.simulateEvent('output', { category: 'console', output: 'worker n=3\n' });

      // Its stdout and stderr are still read on the launch session...
      expect(sessionManager.outputOnFor(childId)).toBe(rootId);
      // ...and the line of the logpoint it hit is its own.
      expect(sessionManager.getSession(childId)!.outputBuffer!.renderText()).toContain('worker n=3');
      expect(sessionManager.getSession(rootId)!.outputBuffer!.renderText()).not.toContain('worker n=3');
    });

    it('reads child and grandchild output from their own connections under an attach root', async () => {
      const { rootId, childId, grandchildId, childView } = await jsTree();
      sessionManager.getSession(rootId)!.run.attachMode = true;
      sessionManager.getSession(rootId)!.run.programOwnership = 'borrowed';
      childView.simulateEvent('output', { category: 'stdout', output: 'child console output\n' });

      expect(sessionManager.outputOnFor(childId)).toBeUndefined();
      expect(sessionManager.outputOnFor(grandchildId)).toBeUndefined();
      expect(sessionManager.getSession(childId)!.outputBuffer!.renderText()).toContain('child console output');
      expect(sessionManager.getSession(rootId)!.outputBuffer!.renderText()).not.toContain('child console output');
    });
  });

  describe("an adopted child's first stop that js-debug reports as a 'debugger statement' pause (issue #1097)", () => {
    /** The stopped body js-debug sent for the fourth cluster worker under load (issue #1097). */
    const ENTRY_PAUSE = { reason: 'pause', description: 'Paused on debugger statement', threadId: 3, allThreadsStopped: false };
    const FIRST_STATEMENT = 'const WORKERS = 4;';
    const TOP_FRAME = { id: 1, name: '<module>', source: { path: '/w/cluster_parent.js' }, line: 9 };

    /**
     * The js policy's stop rules over the mock tree — the relaxed first-stop
     * rule, the #672 relabel and the #1097 line check — with the child's top
     * frame and the source line under it scripted.
     */
    async function jsChild(
      topFrame: Record<string, unknown> | 'fails' = TOP_FRAME,
      lineNine = FIRST_STATEMENT,
      policyOverrides: Partial<AdapterPolicy> = {}
    ) {
      overridePolicy(sessionManager, {
        normalizeStopReason: JsDebugAdapterPolicy.normalizeStopReason,
        stopNeedsSourceLine: JsDebugAdapterPolicy.stopNeedsSourceLine,
        getDapClientBehavior: () => ({ pauseAfterChildAttach: true }) as DapClientBehavior,
        ...policyOverrides
      });
      const rootId = await startRoot();
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
      await vi.runAllTimersAsync();
      const childId = childOf(rootId)!.id;
      const view = dependencies.mockProxyManager.childViews.get(childId)!;
      const requests: string[] = [];
      view.setDapRequestHandler(async (command: string) => {
        requests.push(command);
        if (command === 'stackTrace') {
          if (topFrame === 'fails') {
            throw new Error('stackTrace failed');
          }
          return { success: true, body: { stackFrames: [topFrame] } };
        }
        return { success: true, body: {} };
      });
      const lines = Array.from({ length: 8 }, (_, i) => `// line ${i + 1}`);
      lines.push(lineNine, 'cluster.fork();');
      vi.mocked(dependencies.mockFileSystem.readFile).mockImplementation(async () => lines.join('\n'));
      return { rootId, childId, view, requests };
    }
    const child = (id: string) => sessionManager.getSession(id)!;

    it('reads the line under the stop and resumes a leaked module-entry pause without ever showing the child paused', async () => {
      const { rootId, childId, view, requests } = await jsChild();
      const wait = sessionManager.waitForStop(childId, 1000);

      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.runAllTimersAsync();

      expect(requests).toContain('stackTrace');
      expect(requests).toContain('continue');
      expect(requests.indexOf('stackTrace')).toBeLessThan(requests.indexOf('continue'));
      expect(dependencies.mockFileSystem.readFile).toHaveBeenCalledWith('/w/cluster_parent.js', 'utf8');
      expect(child(childId).state).toBe(SessionState.RUNNING);
      expect(child(childId).lastStop).toBeUndefined();
      expect(dependencies.mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Stop reason normalized: 'pause' -> 'entry'"));
      expect(dependencies.mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Auto-continuing (stopOnEntry=false) [reason=entry'));
      // The wait saw nothing: the hold never entered PAUSED, and the resume ran in the settle's own call stack.
      expect((await wait).data?.pending).toBe(true);
      // Nor does the root count it as a stop of its tree (issue #1128): nobody saw it.
      expect(child(rootId).descendantStops).toBeUndefined();
    });

    it("resumes the child's unexplained first stop by the launch's rule, where the child's own connection forces no pause", async () => {
      // A policy that adopts in-session: its child connections run the
      // child-safe derivative, whose behaviour says no forced pause.
      const { rootId, childId, view, requests } = await jsChild(TOP_FRAME, FIRST_STATEMENT, { supportsReverseStartDebugging: true });
      expect(sessionManager.clientBehaviorOf(child(rootId)).pauseAfterChildAttach).toBe(true);
      expect(sessionManager.clientBehaviorOf(child(childId)).pauseAfterChildAttach).toBe(false);

      // A pause no breakpoint, exception, user pause or debugger statement explains.
      view.simulateStopped(3, 'pause', { reason: 'pause', threadId: 3 });
      await vi.runAllTimersAsync();

      expect(requests).toContain('continue');
      expect(child(childId).state).toBe(SessionState.RUNNING);
      expect(child(childId).lastStop).toBeUndefined();
      expect(dependencies.mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Auto-continuing (stopOnEntry=false) [reason=pause, firstStop=true]'));
      expect(child(rootId).descendantStops).toBeUndefined();
    });

    it('keeps a `debugger;` statement at the first statement as the breakpoint it is (#672 still holds)', async () => {
      const { rootId, childId, view, requests } = await jsChild(TOP_FRAME, 'debugger;');

      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.runAllTimersAsync();

      expect(requests).toContain('stackTrace');
      expect(requests).not.toContain('continue');
      expect(child(childId).state).toBe(SessionState.PAUSED);
      expect(child(childId).lastStop).toMatchObject({ reason: 'breakpoint', rawReason: 'pause', threadId: 3 });
      // A stop that is shown counts for the root (issue #1128).
      expect(child(rootId).descendantStops).toBe(1);
    });

    const unreadable: Array<[string, Record<string, unknown> | 'fails']> = [
      ['the frame has no source path', { id: 1, name: '<module>', line: 9 }],
      ['the stack request fails', 'fails']
    ];
    it.each(unreadable)('keeps the stop as a breakpoint, as before, when %s', async (_label, topFrame) => {
      const { childId, view } = await jsChild(topFrame);

      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.runAllTimersAsync();

      expect(child(childId).state).toBe(SessionState.PAUSED);
      expect(child(childId).lastStop).toMatchObject({ reason: 'breakpoint', rawReason: 'pause' });
    });

    it('does not use a local file to disprove a stop in adapter-owned source', async () => {
      const { childId, view, requests } = await jsChild({
        ...TOP_FRAME,
        source: { ...TOP_FRAME.source, sourceReference: 1 }
      });
      vi.mocked(dependencies.mockFileSystem.readFile).mockClear();

      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.runAllTimersAsync();

      expect(dependencies.mockFileSystem.readFile).not.toHaveBeenCalled();
      expect(requests).not.toContain('continue');
      expect(child(childId).state).toBe(SessionState.PAUSED);
      expect(child(childId).lastStop).toMatchObject({ reason: 'breakpoint', rawReason: 'pause' });
    });

    it.each([new Error('source policy unavailable'), 'source policy unavailable'])(
      'keeps the breakpoint when the source-line policy throws %s', async (failure) => {
        const { childId, view, requests } = await jsChild(TOP_FRAME, FIRST_STATEMENT, {
          stopNeedsSourceLine: () => { throw failure; }
        });
        vi.mocked(dependencies.mockFileSystem.readFile).mockClear();

        expect(() => view.simulateStopped(3, 'pause', ENTRY_PAUSE)).not.toThrow();
        await vi.runAllTimersAsync();

        expect(requests).not.toContain('stackTrace');
        expect(requests).not.toContain('continue');
        expect(dependencies.mockFileSystem.readFile).not.toHaveBeenCalled();
        expect(child(childId).state).toBe(SessionState.PAUSED);
        expect(child(childId).lastStop).toMatchObject({ reason: 'breakpoint', rawReason: 'pause' });
        expect(dependencies.mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(
          'Could not ask the policy whether the stop needs its source line: source policy unavailable'
        ));
      }
    );

    it('keeps a stop without a thread ID instead of querying an arbitrary thread', async () => {
      const { childId, view, requests } = await jsChild();
      vi.mocked(dependencies.mockFileSystem.readFile).mockClear();

      view.simulateEvent('stopped', undefined, 'pause', { ...ENTRY_PAUSE, threadId: undefined });
      await vi.runAllTimersAsync();

      expect(requests).not.toContain('stackTrace');
      expect(requests).not.toContain('continue');
      expect(dependencies.mockFileSystem.readFile).not.toHaveBeenCalled();
      expect(child(childId).state).toBe(SessionState.PAUSED);
      expect(child(childId).lastStop).toMatchObject({ reason: 'breakpoint', rawReason: 'pause', threadId: undefined });
    });

    it('keeps the breakpoint when the frame points past the end of the local file', async () => {
      const { childId, view, requests } = await jsChild();
      vi.mocked(dependencies.mockFileSystem.readFile).mockResolvedValue('const WORKERS = 4;\n');

      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.runAllTimersAsync();

      expect(requests).toContain('stackTrace');
      expect(dependencies.mockFileSystem.readFile).toHaveBeenCalledWith(TOP_FRAME.source.path, 'utf8');
      expect(requests).not.toContain('continue');
      expect(child(childId).state).toBe(SessionState.PAUSED);
      expect(child(childId).lastStop).toMatchObject({ reason: 'breakpoint', rawReason: 'pause' });
    });

    it('keeps the breakpoint even if reporting a source-read failure also throws', async () => {
      const { childId, view, requests } = await jsChild();
      vi.mocked(dependencies.mockFileSystem.readFile).mockRejectedValue('source unavailable');
      const failedDiagnostic = vi.fn(() => { throw new Error('diagnostic sink unavailable'); });
      vi.mocked(dependencies.mockLogger.debug).mockImplementation((message) => {
        if (message.includes('Could not read the top frame\'s source line: source unavailable')) {
          failedDiagnostic();
        }
      });

      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.runAllTimersAsync();

      expect(failedDiagnostic).toHaveBeenCalledOnce();
      expect(requests).not.toContain('continue');
      expect(child(childId).state).toBe(SessionState.PAUSED);
      expect(child(childId).lastStop).toMatchObject({ reason: 'breakpoint', rawReason: 'pause' });
    });

    it('contains a failure while settling a held stop and can process the next stop', async () => {
      const { childId, view, requests } = await jsChild(TOP_FRAME, 'debugger;');
      const failure = new Error('stop diagnostic unavailable');
      const failedDiagnostic = vi.fn(() => { throw failure; });
      vi.mocked(dependencies.mockLogger.info).mockImplementation((message) => {
        if (message.includes('Stopped event:')) failedDiagnostic();
      });

      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.runAllTimersAsync();

      expect(failedDiagnostic).toHaveBeenCalledOnce();
      expect(dependencies.mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error settling a held stop:'), failure
      );
      expect(requests).not.toContain('continue');

      vi.mocked(dependencies.mockLogger.info).mockReset();
      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.runAllTimersAsync();

      expect(child(childId).state).toBe(SessionState.PAUSED);
      expect(child(childId).lastStop).toMatchObject({ reason: 'breakpoint', rawReason: 'pause' });
      expect(requests).not.toContain('continue');
    });

    it('drops a held stop when the child ends during the verification, instead of reviving an ended session', async () => {
      const { childId, view } = await jsChild();
      let answerStack: (() => void) | undefined;
      view.setDapRequestHandler(async (command: string) => {
        if (command === 'stackTrace') {
          await new Promise<void>((resolve) => { answerStack = resolve; });
          return { success: true, body: { stackFrames: [TOP_FRAME] } };
        }
        return { success: true, body: {} };
      });

      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.advanceTimersByTimeAsync(0);
      // Held: the child is not shown paused while the line is being read.
      expect(answerStack).toBeDefined();
      expect(child(childId).state).toBe(SessionState.RUNNING);

      view.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      expect(child(childId).state).toBe(SessionState.STOPPED);

      answerStack!();
      await vi.runAllTimersAsync();
      expect(child(childId).state).toBe(SessionState.STOPPED);
      expect(child(childId).lastStop).toBeUndefined();
    });

    it.each([false, true])('does not resume a newer breakpoint when an old source read finishes (continued first: %s)', async (continuedFirst) => {
      const { childId, view, requests } = await jsChild();
      let answerRead: ((text: string) => void) | undefined;
      vi.mocked(dependencies.mockFileSystem.readFile).mockImplementation(() => new Promise<string>((resolve) => {
        answerRead = resolve;
      }));

      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.advanceTimersByTimeAsync(0);
      expect(answerRead).toBeDefined();

      if (continuedFirst) view.simulateEvent('continued');
      view.simulateStopped(3, 'breakpoint', { reason: 'breakpoint', threadId: 3, hitBreakpointIds: [7] });
      const newerStop = child(childId).lastStop;
      expect(newerStop).toMatchObject({ reason: 'breakpoint' });

      answerRead!(`${'// header\n'.repeat(8)}${FIRST_STATEMENT}`);
      await vi.runAllTimersAsync();

      expect(requests).not.toContain('continue');
      expect(child(childId).state).toBe(SessionState.PAUSED);
      expect(child(childId).lastStop).toBe(newerStop);
    });

    it('drops a held stop if the adapter resumes while the source is being read', async () => {
      const { childId, view, requests } = await jsChild();
      let answerRead: ((text: string) => void) | undefined;
      vi.mocked(dependencies.mockFileSystem.readFile).mockImplementation(() => new Promise<string>((resolve) => {
        answerRead = resolve;
      }));

      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.advanceTimersByTimeAsync(0);
      expect(answerRead).toBeDefined();
      view.simulateEvent('continued');

      answerRead!(`${'// header\n'.repeat(8)}debugger;`);
      await vi.runAllTimersAsync();

      expect(requests).not.toContain('continue');
      expect(child(childId).state).toBe(SessionState.RUNNING);
      expect(child(childId).lastStop).toBeUndefined();
    });

    it('keeps the stop when the file read exceeds the lookup budget and ignores its late answer', async () => {
      const { childId, view, requests } = await jsChild();
      let answerRead: ((text: string) => void) | undefined;
      vi.mocked(dependencies.mockFileSystem.readFile).mockImplementation(() => new Promise<string>((resolve) => {
        answerRead = resolve;
      }));

      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.advanceTimersByTimeAsync(2999);
      expect(answerRead).toBeDefined();
      expect(child(childId).state).toBe(SessionState.RUNNING);

      await vi.advanceTimersByTimeAsync(1);
      expect(child(childId).state).toBe(SessionState.PAUSED);
      expect(child(childId).lastStop).toMatchObject({ reason: 'breakpoint', rawReason: 'pause' });
      const timedOutStop = child(childId).lastStop;

      answerRead!(`${'// header\n'.repeat(8)}${FIRST_STATEMENT}`);
      await vi.runAllTimersAsync();
      expect(requests).not.toContain('continue');
      expect(child(childId).lastStop).toBe(timedOutStop);
    });

    it('keeps the stop when the stack lookup itself never settles', async () => {
      const { childId, view } = await jsChild();
      view.setDapRequestHandler(async () => new Promise(() => {}));

      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.advanceTimersByTimeAsync(3000);

      expect(child(childId).state).toBe(SessionState.PAUSED);
      expect(child(childId).lastStop).toMatchObject({ reason: 'breakpoint', rawReason: 'pause' });
    });

    it("reads nothing for a later 'debugger statement' pause: the stop is a breakpoint at once", async () => {
      const { childId, view, requests } = await jsChild();
      view.simulateStopped(3, 'breakpoint', { reason: 'breakpoint', threadId: 3 });
      await vi.runAllTimersAsync();
      expect(child(childId).state).toBe(SessionState.PAUSED);
      await sessionManager.continue(childId);
      await vi.runAllTimersAsync();
      expect(child(childId).state).toBe(SessionState.RUNNING);
      requests.length = 0;

      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.runAllTimersAsync();

      expect(requests).not.toContain('stackTrace');
      expect(child(childId).state).toBe(SessionState.PAUSED);
      expect(child(childId).lastStop).toMatchObject({ reason: 'breakpoint', rawReason: 'pause' });
    });
  });
});

describe('a child session is read under its own connection (issues #1211, #1220)', () => {
  // js-debug's shape. The root connection adopts the program in-session and
  // mirrors breakpoints to it, so the root's own answers are provisional
  // (issues #495, #500). Every other connection of the worker runs the
  // child-safe derivative of the policy, where the adapter's answers are the
  // truth. Measured on a real fork (issue #1211): the adoption's
  // setBreakpoints answers `{ id: 1, verified: false }`, the bind follows as
  // `breakpoint changed { id: 1, line: 6 }`, and the stop names `[1]`.
  const FILE = '/w/child.js';
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  const jsLike: Partial<AdapterPolicy> = {
    supportsReverseStartDebugging: true,
    getDapClientBehavior: () => JsDebugAdapterPolicy.getDapClientBehavior(),
    childAdoption: JsDebugAdapterPolicy.childAdoption
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    sessionManager = new SessionManager(
      { logDirBase: '/tmp/test-sessions', defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true } },
      dependencies
    );
    overridePolicy(sessionManager, jsLike);
    // The operations layer has a lookup of its own (see overridePolicy).
    const facade = sessionManager as unknown as { selectPolicy: (language: string) => AdapterPolicy };
    const original = facade.selectPolicy.bind(sessionManager);
    vi.spyOn(facade, 'selectPolicy').mockImplementation((language) => ({ ...original(language), ...jsLike }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  /** A root with one breakpoint at FILE:5, and the child adopted with its copy. */
  async function adoptedChild() {
    const root = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    await sessionManager.setBreakpoint(root.id, { file: FILE, line: 5 });
    await sessionManager.startDebugging(root.id, 'parent.js');
    await vi.runAllTimersAsync();
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();
    const row = sessionManager.getAllSessions().find((s) => s.parentSessionId === root.id)!;
    const child = sessionManager.getSession(row.id)!;
    const view = dependencies.mockProxyManager.childViews.get(child.id)!;
    const record = Array.from(child.breakpoints.values())[0];
    return { rootId: root.id, child, view, record };
  }

  const answering = (view: MockChildProxyView, breakpoints: Array<Record<string, unknown>>): void => {
    view.setDapRequestHandler(async (command) =>
      command === 'setBreakpoints' ? { success: true, body: { breakpoints } } : { success: true, body: {} });
  };

  it("stamps the adoption's own answer on the child's records, and the bind event that follows moves the record to the line it bound on (#1211)", async () => {
    const { view, record } = await adoptedChild();

    view.simulateEvent('breakpoints-synced', [
      { id: record.id, file: FILE, line: 5, verified: false, adapterId: 1, message: 'breakpoint.provisionalBreakpoint' }
    ]);
    expect(record.adapterId).toBe(1);
    expect(record.verified).toBe(false);

    // The shifted-line shape: a same-line event would match by location on any build.
    view.simulateEvent('breakpoint', { reason: 'changed', breakpoint: { id: 1, verified: true, line: 6, source: { path: FILE } } });
    expect(record).toMatchObject({ adapterId: 1, verified: true, verifiedBy: 'adapter', line: 6 });
  });

  it("still reads the root's own answers as the mirroring connection's: provisional, and never its ids (#495)", async () => {
    const { rootId } = await adoptedChild();
    const rootRecord = Array.from(sessionManager.getSession(rootId)!.breakpoints.values())[0];
    expect(rootRecord.adapterId).toBeUndefined();

    dependencies.mockProxyManager.simulateEvent('breakpoints-synced', [
      { id: rootRecord.id, file: FILE, line: 5, verified: false, adapterId: 9 }
    ]);
    dependencies.mockProxyManager.simulateEvent('breakpoint', {
      reason: 'changed', breakpoint: { id: 9, verified: true, line: 5, source: { path: FILE } }
    });

    expect(rootRecord.adapterId).toBeUndefined();
  });

  it("takes a set_breakpoint on a child from the adapter's own answer: ids, verified state and bound lines", async () => {
    const { child, view, record: first } = await adoptedChild();
    answering(view, [
      { id: 1, verified: true, line: 6, source: { path: FILE } },
      { id: 2, verified: true, line: 8, source: { path: FILE } }
    ]);

    await sessionManager.setBreakpoint(child.id, { file: FILE, line: 8 });

    const second = Array.from(child.breakpoints.values()).find((bp) => bp !== first)!;
    expect(first).toMatchObject({ adapterId: 1, verified: true, line: 6 });
    expect(second).toMatchObject({ adapterId: 2, verified: true, verifiedBy: 'adapter', line: 8 });
  });

  it('an adapter id that two records share addresses neither of them: an event goes by its location, or changes nothing (#1220)', async () => {
    const { child, view, record: first } = await adoptedChild();
    view.simulateEvent('breakpoints-synced', [{ id: first.id, file: FILE, line: 5, verified: false, adapterId: 1 }]);
    view.simulateEvent('breakpoint', { reason: 'changed', breakpoint: { id: 1, verified: true, line: 6, source: { path: FILE } } });
    // js-debug numbers a breakpoint added after the attach from another
    // counter, and gives it the id the earlier one still holds (measured).
    answering(view, [
      { id: 1, verified: true, line: 6, source: { path: FILE } },
      { id: 1, verified: true, line: 8, source: { path: FILE } }
    ]);
    await sessionManager.setBreakpoint(child.id, { file: FILE, line: 8 });
    const second = Array.from(child.breakpoints.values()).find((bp) => bp !== first)!;
    // The answer is positional: each record has its own state, whatever the ids say.
    expect(first).toMatchObject({ adapterId: 1, verified: true, line: 6 });
    expect(second).toMatchObject({ adapterId: 1, verified: true, line: 8 });

    view.simulateEvent('breakpoint', { reason: 'changed', breakpoint: { id: 1, verified: true, line: 8, source: { path: FILE } } });
    expect(first.line).toBe(6);
    expect(second.line).toBe(8);

    view.simulateEvent('breakpoint', { reason: 'changed', breakpoint: { id: 1, verified: false } });
    expect(first.verified).toBe(true);
    expect(second.verified).toBe(true);
  });
});

describe('session-tree truthfulness, turn reduction & release confirmation (issues #1150, #1221)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;

  function setup(env?: Partial<Record<string, string>>): void {
    dependencies = createMockDependencies();
    if (env) {
      dependencies.environment = createMockEnvironment(env);
    }
    sessionManager = new SessionManager(
      { logDirBase: '/tmp/test-sessions', defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true } },
      dependencies
    );
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  const childOf = (parentId: string) => sessionManager.getAllSessions().find((s) => s.parentSessionId === parentId);

  it('surfaces pausedChild with snapshot and truthful message when a child pauses during the launch hold, and waitForStop stays idempotent (#1150 item 1)', async () => {
    const root = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    await sessionManager.setBreakpoint(root.id, { file: '/w/child.py', line: 12 });

    const starting = sessionManager.startDebugging(root.id, '/w/parent.py');
    await vi.advanceTimersByTimeAsync(20);
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r-paused', 5151));
    await vi.advanceTimersByTimeAsync(10);

    const child = childOf(root.id)!;
    const view = dependencies.mockProxyManager.childViews.get(child.id)!;
    view.setDapRequestHandler(async (command) => {
      switch (command) {
        case 'stackTrace':
          return {
            success: true,
            body: { stackFrames: [{ id: 10, name: 'work', source: { path: '/w/child.py' }, line: 12, column: 1 }] }
          };
        case 'scopes':
          return {
            success: true,
            body: { scopes: [{ name: 'Locals', variablesReference: 200, expensive: false }] }
          };
        case 'variables':
          return {
            success: true,
            body: { variables: [{ name: 'i', value: '0', type: 'int', variablesReference: 0 }] }
          };
        default:
          return { success: true, body: {} };
      }
    });
    view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1 });
    await vi.runAllTimersAsync();

    const started = await starting;
    expect(started.success).toBe(true);
    expect(started.state).toBe(SessionState.RUNNING);
    expect(started.data?.pending).toBe(true);
    expect(started.data?.message).not.toContain('has not reached');
    expect(started.data?.message).toContain(`child session 'Subprocess 5151' (${child.id}) is already paused (breakpoint) at /w/child.py:12`);
    expect(started.data?.children).toEqual([
      { sessionId: child.id, name: 'Subprocess 5151', state: SessionState.PAUSED, parentSessionId: root.id }
    ]);
    expect(started.data?.pausedChild).toMatchObject({
      sessionId: child.id,
      name: 'Subprocess 5151',
      state: SessionState.PAUSED,
      reason: 'breakpoint',
      location: { file: '/w/child.py', line: 12, column: 1 },
      snapshot: {
        frames: [{ name: 'work', file: '/w/child.py', line: 12 }],
        locals: { i: '0' }
      }
    });

    // A caller that still invokes wait_for_stop(rootId) receives the exact same stop with full locals.
    const waited = await sessionManager.waitForStop(root.id, 100);
    expect(waited.state).toBe(SessionState.PAUSED);
    expect(waited.data?.sessionId).toBe(child.id);
    expect(waited.data?.snapshot?.locals).toEqual({ i: '0' });
  });

  it('omits pausedChild when a child enters ERROR during the launch hold and names the errored child in message (#1150)', async () => {
    const root = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    await sessionManager.setBreakpoint(root.id, { file: '/w/child.py', line: 12 });

    const starting = sessionManager.startDebugging(root.id, '/w/parent.py');
    await vi.advanceTimersByTimeAsync(20);
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r-err', 6161));
    await vi.advanceTimersByTimeAsync(10);

    const child = childOf(root.id)!;
    const view = dependencies.mockProxyManager.childViews.get(child.id)!;
    view.simulateError(new Error('child socket dropped'));
    await vi.runAllTimersAsync();

    const started = await starting;
    expect(started.state).toBe(SessionState.RUNNING);
    expect(started.data?.pausedChild).toBeUndefined();
    expect(started.data?.message).toContain(`child session 'Subprocess 6161' (${child.id}) ended in an error state`);
    expect(started.data?.message).not.toContain('has not reached');
  });

  it('suppresses root unbound-breakpoint exit warnings and marks unhitBreakpoints verified: true when an adopted child bound the breakpoint (#1150 items 2 & 3)', async () => {
    const root = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    const { breakpoint } = await sessionManager.setBreakpoint(root.id, { file: '/w/fork_only.js', line: 14 });

    const starting = sessionManager.startDebugging(root.id, '/w/parent.js');
    await vi.advanceTimersByTimeAsync(20);
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r-fork', 7171));
    await vi.advanceTimersByTimeAsync(10);

    const child = childOf(root.id)!;
    const view = dependencies.mockProxyManager.childViews.get(child.id)!;
    // Root never verified the fork-only breakpoint; the adopted fork verified it, then exited without hitting it.
    expect(sessionManager.getSession(root.id)!.breakpoints.get(breakpoint.id)!.verified).toBe(false);
    view.simulateEvent('breakpoints-synced', [
      { id: breakpoint.id, file: '/w/fork_only.js', line: 14, verified: true, adapterId: 3 }
    ]);
    view.simulateEvent('terminated');
    dependencies.mockProxyManager.simulateEvent('exited', 0);
    await vi.runAllTimersAsync();

    const started = await starting;
    expect(started.state).toBe(SessionState.STOPPED);
    expect(started.data?.warning).toBeUndefined();
    expect(started.data?.unhitBreakpoints).toEqual([
      { file: '/w/fork_only.js', line: 14, verified: true }
    ]);
    expect(started.data?.message).toContain('Verified but never hit: fork_only.js:14.');
  });

  it.each([
    { language: DebugLanguage.PYTHON, flag: { subProcess: false }, expected: 'subProcess: false' },
    { language: DebugLanguage.JAVASCRIPT, flag: { autoAttachChildProcesses: false }, expected: 'autoAttachChildProcesses: false' }
  ])('qualifies end summary and unbound exit warning when child debugging was opted out ($expected) (#1150 items 2 & 4)', async ({ language, flag, expected }) => {
    const root = await sessionManager.createSession({ language });
    const { breakpoint } = await sessionManager.setBreakpoint(root.id, { file: '/w/child_only.py', line: 9 });

    const starting = sessionManager.startDebugging(root.id, '/w/parent.py', undefined, flag as never);
    await vi.advanceTimersByTimeAsync(20);
    // Simulate a breakpoint that remained unbound in the parent (e.g. JS fork-only file) on JS,
    // and verified-unhit in the parent on Python.
    if (language === DebugLanguage.PYTHON) {
      dependencies.mockProxyManager.simulateEvent('breakpoints-synced', [
        { id: breakpoint.id, file: '/w/child_only.py', line: 9, verified: true, adapterId: 1 }
      ]);
    }
    dependencies.mockProxyManager.simulateEvent('exited', 0);
    await vi.runAllTimersAsync();

    const started = await starting;
    expect(started.state).toBe(SessionState.STOPPED);
    expect(started.data?.message).toContain(`without hitting any breakpoint in the launched process (child-process debugging was off via ${expected}`);
    if (language === DebugLanguage.JAVASCRIPT) {
      expect(started.data?.warning).toContain(`child-process debugging was off (${expected}), so breakpoints in code only a child process loads could not bind`);
    }
  });

  it('propagates grandchild releases up to the root session (#1150 item 5)', async () => {
    setup({ [ 'DEBUG_MCP_MAX_CHILD_SESSIONS' ]: '1' });
    const root = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    await sessionManager.setBreakpoint(root.id, { file: '/w/grandchild.py', line: 5 });
    await sessionManager.startDebugging(root.id, '/w/parent.py');
    await vi.runAllTimersAsync();

    // First child adopts under cap=1.
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r-child', 8001));
    await vi.runAllTimersAsync();
    const child = childOf(root.id)!;
    const childView = dependencies.mockProxyManager.childViews.get(child.id)!;

    // Grandchild reported on child's connection exceeds cap=1 and is released.
    childView.simulateEvent('child-reported', report('r-grandchild', 8002));
    await vi.runAllTimersAsync();

    const rootWait = await sessionManager.waitForStop(root.id, 50);
    const childWait = await sessionManager.waitForStop(child.id, 50);
    expect(rootWait.data?.childrenReleased).toBe(1);
    expect(rootWait.data?.message).toContain('1 child process was released to run undebugged');
    expect(childWait.data?.childrenReleased).toBe(1);
  });

  it('does not count or claim released to run undebugged when the adapter does not confirm a failed adoption release (#1221)', async () => {
    dependencies.mockProxyManager.childReleaseConfirmed = false;
    const origCreateChildView = dependencies.mockProxyManager.createChildView.bind(dependencies.mockProxyManager);
    vi.spyOn(dependencies.mockProxyManager, 'createChildView').mockImplementation((id) => {
      const view = origCreateChildView(id);
      vi.spyOn(view, 'adopt').mockRejectedValue(new Error('adapter socket closed'));
      return view;
    });

    const root = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    await sessionManager.setBreakpoint(root.id, { file: '/w/child.py', line: 12 });
    const starting = sessionManager.startDebugging(root.id, '/w/parent.py');
    await vi.advanceTimersByTimeAsync(20);
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r-unconfirmed', 9001));
    await vi.runAllTimersAsync();

    const started = await starting;
    expect(started.data?.childrenReleased).toBeUndefined();
    expect(started.data?.message).not.toContain('released to run undebugged');
    expect(started.data?.message).toContain(
      '1 child process could not be adopted, and the debug adapter did not confirm releasing it; whether it continued running is not known.'
    );
  });
});
