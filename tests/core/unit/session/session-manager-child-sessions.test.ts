/**
 * SessionManager and the session tree (issue #1081): a child the worker
 * reports becomes a session of its own, linked by parentSessionId, adopted
 * with the parent's breakpoints under the per-tree cap, and wired like a root.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies, createMockEnvironment } from './session-manager-test-utils.js';
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
});
