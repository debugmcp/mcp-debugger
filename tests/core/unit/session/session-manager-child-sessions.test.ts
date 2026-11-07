/**
 * SessionManager and the session tree (issue #1081): a child the worker
 * reports becomes a session of its own, linked by parentSessionId, adopted
 * with the parent's breakpoints under the per-tree cap, and wired like a root.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, JsDebugAdapterPolicy, SessionState, type DapClientBehavior } from '@debugmcp/shared';
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

  async function startRoot(): Promise<string> {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    await sessionManager.setBreakpoint(session.id, { file: '/w/child.py', line: 7 });
    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    return session.id;
  }

  const childOf = (rootId: string) => sessionManager.getAllSessions().find((s) => s.parentSessionId === rootId);
  const releases = () => dependencies.mockProxyManager.dapRequestCalls.filter((c) => c.command === 'childRelease');

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
    root.effectiveBreakOnExceptions = 'all';
    root.launchExceptionFilters = { ids: ['raised'], beyondMode: [], noUncaughtStop: undefined };
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
    expect(child.effectiveBreakOnExceptions).toBe('all');
    expect(child.launchExceptionFilters).toEqual({ ids: ['raised'], beyondMode: [], noUncaughtStop: undefined });
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
      sessionManager.getSession(rootId)!.attachMode = true;

      const outcome = await sessionManager.closeSessionReporting(rootId);

      expect(outcome.closed).toBe(true);
      expect(outcome.released).toBe(true);
      expect(outcome.childrenClosed).toBe(2);
      expect(grandchildView.stopOptions[0]).toEqual({ terminateDebuggee: false });
      expect(childView.stopOptions[0]).toEqual({ terminateDebuggee: false });
      expect(sessionManager.getAllSessions()).toHaveLength(0);
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
      sessionManager.getSession(rootId)!.attachMode = true;
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
      sessionManager.getSession(rootId)!.attachMode = true;

      const detached = await sessionManager.detachFromProcess(rootId);

      expect(detached.success).toBe(true);
      expect(detached.data).toEqual({ message: 'Detached from process (process still running)' });
    });

    it('closing a released child preserves the release outcome and does not claim process termination', async () => {
      const { rootId, childId, grandchildId } = await attachTree();
      await sessionManager.detachFromProcess(rootId);

      const outcome = await sessionManager.closeSessionReporting(childId);

      expect(outcome).toEqual({ closed: true, closedSessionIds: [grandchildId, childId], childrenClosed: 1, released: true });
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

      expect(outcome).toEqual({ closed: true, closedSessionIds: [grandchildId, childId], childrenClosed: 1, released: true });
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

      // A debugpy child carries its own lines: no pointer.
      overridePolicy(sessionManager, { childAdoption: { ...JsDebugAdapterPolicy.childAdoption!, childOutput: 'own-connection' } });
      expect(sessionManager.outputOnFor(childId)).toBeUndefined();
    });

    it('reads child and grandchild output from their own connections under an attach root', async () => {
      const { rootId, childId, grandchildId, childView } = await jsTree();
      sessionManager.getSession(rootId)!.attachMode = true;
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
    async function jsChild(topFrame: Record<string, unknown> | 'fails' = TOP_FRAME, lineNine = FIRST_STATEMENT) {
      overridePolicy(sessionManager, {
        normalizeStopReason: JsDebugAdapterPolicy.normalizeStopReason,
        stopNeedsSourceLine: JsDebugAdapterPolicy.stopNeedsSourceLine,
        getDapClientBehavior: () => ({ pauseAfterChildAttach: true }) as DapClientBehavior
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
      const { childId, view, requests } = await jsChild();
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
    });

    it('keeps a `debugger;` statement at the first statement as the breakpoint it is (#672 still holds)', async () => {
      const { childId, view, requests } = await jsChild(TOP_FRAME, 'debugger;');

      view.simulateStopped(3, 'pause', ENTRY_PAUSE);
      await vi.runAllTimersAsync();

      expect(requests).toContain('stackTrace');
      expect(requests).not.toContain('continue');
      expect(child(childId).state).toBe(SessionState.PAUSED);
      expect(child(childId).lastStop).toMatchObject({ reason: 'breakpoint', rawReason: 'pause', threadId: 3 });
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
