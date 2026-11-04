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
});
