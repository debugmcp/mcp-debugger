/**
 * The tree-aware wait_for_stop (the session tree, issue #1081): a wait on a
 * session observes it and all its descendants, answers for the session the
 * four-rule selection names (`sessionId`), and lists every descendant with
 * its state (`children`). Built on the child-session harness: a mock worker
 * reports children, each adopted as a session with a MockChildProxyView.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import type { DebugResult, WaitForStopResultData } from '../../../../src/session/session-manager-core.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';
import type { MockChildProxyView } from '../../../test-utils/mocks/mock-proxy-manager.js';

const report = (reportId: string, pid = 4242) => ({
  reportId,
  targetId: String(pid),
  name: `Subprocess ${pid}`,
  configuration: { type: 'python', subProcessId: pid }
});

describe('SessionManager - the tree-aware waitForStop (issue #1081)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  const config: SessionManagerConfig = {
    logDirBase: '/tmp/test-sessions',
    defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true }
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  async function startRoot(): Promise<string> {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    expect(sessionManager.getSession(session.id)!.state).toBe(SessionState.RUNNING);
    return session.id;
  }

  /** Report a child on `on` (the root worker, or a child's view for a grandchild) and return its session and view. */
  async function adopt(on: { simulateEvent: (event: 'child-reported', reported: ReturnType<typeof report>) => void }, parentId: string, pid: number) {
    on.simulateEvent('child-reported', report(`r-${pid}`, pid));
    await vi.runAllTimersAsync();
    const child = sessionManager.getAllSessions().find((s) => s.parentSessionId === parentId && s.name === `Subprocess ${pid}`)!;
    expect(child).toBeDefined();
    const view = dependencies.mockProxyManager.childViews.get(child.id)!;
    return { id: child.id, view };
  }

  const afterStop = () => vi.advanceTimersByTimeAsync(20);
  function track(pending: Promise<DebugResult<WaitForStopResultData>>) {
    let result: DebugResult<WaitForStopResultData> | undefined;
    void pending.then((settled) => { result = settled; });
    return { result: () => result };
  }

  it('a session with no children answers as before, plus sessionId and no children list', async () => {
    const rootId = await startRoot();
    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');

    const result = await sessionManager.waitForStop(rootId);

    expect(result).toMatchObject({ success: true, state: SessionState.PAUSED });
    expect(result.data?.sessionId).toBe(rootId);
    expect(result.data?.children).toBeUndefined();
    expect(result.data?.lastStop).toMatchObject({ reason: 'breakpoint' });
    expect(result.data?.location).toMatchObject({ file: 'test.py', line: 10 });
  });

  it("answers a paused child for a running parent: the child's stop, its landing read on the child, sessionId naming it (rule 2)", async () => {
    const rootId = await startRoot();
    const child = await adopt(dependencies.mockProxyManager, rootId, 4242);
    const wait = track(sessionManager.waitForStop(rootId, 10_000));
    await vi.advanceTimersByTimeAsync(50);
    expect(wait.result()).toBeUndefined();

    child.view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    await afterStop();

    const result = wait.result();
    expect(result).toMatchObject({ success: true, state: SessionState.PAUSED });
    expect(result?.data?.sessionId).toBe(child.id);
    expect(result?.data?.lastStop).toMatchObject({ reason: 'breakpoint', threadId: 1 });
    expect(result?.data?.message).toMatch(/Paused \(breakpoint\)/);
    // The landing was read on the child's connection, never on the root's.
    expect(child.view.dapRequestCalls.some((c) => c.command === 'stackTrace')).toBe(true);
    expect(dependencies.mockProxyManager.dapRequestCalls.some((c) => c.command === 'stackTrace')).toBe(false);
    expect(result?.data?.children).toEqual([
      { sessionId: child.id, name: 'Subprocess 4242', state: SessionState.PAUSED, parentSessionId: rootId }
    ]);
    // The parent is untouched.
    expect(sessionManager.getSession(rootId)!.state).toBe(SessionState.RUNNING);
  });

  it('answers the paused parent before its paused child (rule 1), listing the child as paused', async () => {
    const rootId = await startRoot();
    const child = await adopt(dependencies.mockProxyManager, rootId, 4242);
    child.view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
    await afterStop();

    const result = await sessionManager.waitForStop(rootId);

    expect(result.data?.sessionId).toBe(rootId);
    expect(result.state).toBe(SessionState.PAUSED);
    expect(result.data?.children).toEqual([
      expect.objectContaining({ sessionId: child.id, state: SessionState.PAUSED })
    ]);
  });

  it('selects depth first in adoption order: a paused grandchild of the first child before a paused second child', async () => {
    const rootId = await startRoot();
    const first = await adopt(dependencies.mockProxyManager, rootId, 1001);
    const second = await adopt(dependencies.mockProxyManager, rootId, 1002);
    const grandchild = await adopt(first.view, first.id, 1003);
    second.view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    grandchild.view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    await afterStop();

    const result = await sessionManager.waitForStop(rootId);

    expect(result.data?.sessionId).toBe(grandchild.id);
    expect(result.data?.children?.map((c) => c.sessionId)).toEqual([first.id, grandchild.id, second.id]);
    expect(result.data?.children?.map((c) => c.parentSessionId)).toEqual([rootId, first.id, rootId]);
  });

  it("answers the parent's own end once every child has ended too (rule 3), the children listed as stopped", async () => {
    const rootId = await startRoot();
    const child = await adopt(dependencies.mockProxyManager, rootId, 4242);
    const wait = track(sessionManager.waitForStop(rootId, 10_000));

    child.view.simulateEvent('terminated');
    await afterStop();
    dependencies.mockProxyManager.simulateExited(0);
    await afterStop();

    const result = wait.result();
    expect(result).toMatchObject({ success: true, state: SessionState.STOPPED });
    expect(result?.data?.sessionId).toBe(rootId);
    expect(result?.data?.exitCode).toBe(0);
    expect(result?.data?.children).toEqual([expect.objectContaining({ sessionId: child.id, state: SessionState.STOPPED })]);
  });

  it("a child's end alone never completes the parent's wait (rule 4); the parent's end then does", async () => {
    const rootId = await startRoot();
    const child = await adopt(dependencies.mockProxyManager, rootId, 4242);
    const wait = track(sessionManager.waitForStop(rootId, 10_000));

    child.view.simulateEvent('terminated');
    await vi.advanceTimersByTimeAsync(500);
    expect(sessionManager.getSession(child.id)!.state).toBe(SessionState.STOPPED);
    expect(wait.result()).toBeUndefined();

    dependencies.mockProxyManager.simulateExited(0);
    await afterStop();
    expect(wait.result()).toMatchObject({ success: true, state: SessionState.STOPPED });
    expect(wait.result()?.data?.sessionId).toBe(rootId);
  });

  it('answers a paused child of a parent that has already ended (rule 2 before rule 3)', async () => {
    const rootId = await startRoot();
    const child = await adopt(dependencies.mockProxyManager, rootId, 4242);
    dependencies.mockProxyManager.simulateEvent('terminated');
    await afterStop();
    expect(sessionManager.getSession(rootId)!.state).toBe(SessionState.STOPPED);
    child.view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    await afterStop();

    const result = await sessionManager.waitForStop(rootId);

    expect(result.state).toBe(SessionState.PAUSED);
    expect(result.data?.sessionId).toBe(child.id);
  });

  it('observes a child adopted while it waits', async () => {
    const rootId = await startRoot();
    const wait = track(sessionManager.waitForStop(rootId, 10_000));
    await vi.advanceTimersByTimeAsync(50);

    // Reported and adopted under the wait (no runAllTimers: that would fire the wait's own timeout).
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r-4242', 4242));
    await vi.advanceTimersByTimeAsync(50);
    const child = sessionManager.getAllSessions().find((s) => s.parentSessionId === rootId)!;
    expect(child).toBeDefined();
    expect(wait.result()).toBeUndefined();
    const view = dependencies.mockProxyManager.childViews.get(child.id)!;
    view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    await afterStop();

    expect(wait.result()?.data?.sessionId).toBe(child.id);
    expect(wait.result()?.data?.lastStop).toMatchObject({ reason: 'breakpoint' });
    expect(wait.result()?.data?.children).toEqual([expect.objectContaining({ sessionId: child.id, state: SessionState.PAUSED })]);
  });

  it('a descendant closed while it waits is one descendant fewer, not the end of the wait', async () => {
    const rootId = await startRoot();
    const child = await adopt(dependencies.mockProxyManager, rootId, 4242);
    const wait = track(sessionManager.waitForStop(rootId, 10_000));
    await vi.advanceTimersByTimeAsync(50);

    await sessionManager.closeSession(child.id);
    await afterStop();
    expect(wait.result()).toBeUndefined();

    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
    await afterStop();
    expect(wait.result()).toMatchObject({ success: true, state: SessionState.PAUSED });
    expect(wait.result()?.data?.sessionId).toBe(rootId);
    expect(wait.result()?.data?.children).toBeUndefined();
  });

  it('a wait on a child answers for that child and its own descendants only', async () => {
    const rootId = await startRoot();
    const child = await adopt(dependencies.mockProxyManager, rootId, 4242);
    const grandchild = await adopt(child.view, child.id, 4343);
    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
    grandchild.view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    await afterStop();

    const result = await sessionManager.waitForStop(child.id);

    expect(result.data?.sessionId).toBe(grandchild.id);
    expect(result.data?.children).toEqual([
      { sessionId: grandchild.id, name: 'Subprocess 4343', state: SessionState.PAUSED, parentSessionId: child.id }
    ]);
  });

  it('reselects the ended parent if the selected child resumes during its landing read', async () => {
    const rootId = await startRoot();
    const child = await adopt(dependencies.mockProxyManager, rootId, 4242);
    dependencies.mockProxyManager.simulateEvent('terminated');
    child.view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    const wait = track(sessionManager.waitForStop(rootId, 10_000));
    await vi.advanceTimersByTimeAsync(0);

    await sessionManager.continue(child.id);
    await afterStop();

    expect(wait.result()).toMatchObject({
      success: true,
      state: SessionState.STOPPED,
      data: { sessionId: rootId }
    });
    expect(wait.result()?.data?.pending).toBeUndefined();
  });

  it('keeps waiting if the selected child is closed during its landing read', async () => {
    const rootId = await startRoot();
    const child = await adopt(dependencies.mockProxyManager, rootId, 4242);
    child.view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    const wait = track(sessionManager.waitForStop(rootId, 10_000));
    await vi.advanceTimersByTimeAsync(0);

    await sessionManager.closeSession(child.id);
    await afterStop();
    expect(wait.result()).toBeUndefined();

    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
    await afterStop();
    expect(wait.result()).toMatchObject({ success: true, state: SessionState.PAUSED, data: { sessionId: rootId } });
  });

  it('keeps the original deadline when a selected child resumes during the landing read', async () => {
    const rootId = await startRoot();
    const child = await adopt(dependencies.mockProxyManager, rootId, 4242);
    child.view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    const wait = track(sessionManager.waitForStop(rootId, 100));
    await vi.advanceTimersByTimeAsync(5);
    await sessionManager.continue(child.id);

    await vi.advanceTimersByTimeAsync(94);
    expect(wait.result()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(wait.result()).toMatchObject({
      success: true,
      state: SessionState.RUNNING,
      data: { sessionId: rootId, pending: true }
    });
  });

  it('still honors cancellation after a selected child resumes during the landing read', async () => {
    const rootId = await startRoot();
    const child = await adopt(dependencies.mockProxyManager, rootId, 4242);
    child.view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    const controller = new AbortController();
    const wait = track(sessionManager.waitForStop(rootId, 10_000, controller.signal));
    await vi.advanceTimersByTimeAsync(0);
    await sessionManager.continue(child.id);
    await afterStop();
    expect(wait.result()).toBeUndefined();

    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(wait.result()).toMatchObject({
      success: true,
      state: SessionState.RUNNING,
      data: { sessionId: rootId, pending: true }
    });
  });

  it('does not select another paused child after alternating children exhaust the original deadline', async () => {
    const rootId = await startRoot();
    const first = await adopt(dependencies.mockProxyManager, rootId, 4242);
    const second = await adopt(dependencies.mockProxyManager, rootId, 4343);
    first.view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    second.view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    const wait = track(sessionManager.waitForStop(rootId, 15));

    // The first landing finishes at 10 ms and reselects the second child.
    await vi.advanceTimersByTimeAsync(5);
    await sessionManager.continue(first.id);
    await vi.advanceTimersByTimeAsync(10);
    // The second landing finishes at 20 ms. The first child is paused again,
    // but another selection now would restart work beyond the 15 ms budget.
    first.view.simulateStopped(1, 'breakpoint', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true });
    await sessionManager.continue(second.id);
    await vi.advanceTimersByTimeAsync(5);

    expect(wait.result()).toMatchObject({
      success: true,
      state: SessionState.RUNNING,
      data: {
        sessionId: rootId,
        pending: true,
        children: [
          expect.objectContaining({ sessionId: first.id, state: SessionState.PAUSED }),
          expect.objectContaining({ sessionId: second.id, state: SessionState.RUNNING })
        ]
      }
    });
  });

  it('preserves ended-at-settle for a selected child that naturally ends during the landing read', async () => {
    const rootId = await startRoot();
    const child = await adopt(dependencies.mockProxyManager, rootId, 4242);
    const wait = track(sessionManager.waitForStop(rootId, 10_000));
    child.view.simulateStopped(1, 'exception', { reason: 'exception', threadId: 1, allThreadsStopped: true });
    await vi.advanceTimersByTimeAsync(0);

    child.view.simulateEvent('terminated');
    await afterStop();

    expect(wait.result()).toMatchObject({
      success: true,
      state: SessionState.STOPPED,
      data: { sessionId: child.id, lastStop: { reason: 'exception' } }
    });
    expect(wait.result()?.data?.location).toBeUndefined();
    expect(sessionManager.getSession(child.id)).toBeDefined();
    expect(sessionManager.getSession(rootId)?.state).toBe(SessionState.RUNNING);
  });

  it('the pending answer carries the children and names the session asked for', async () => {
    const rootId = await startRoot();
    const child = await adopt(dependencies.mockProxyManager, rootId, 4242);
    const wait = track(sessionManager.waitForStop(rootId, 1_000));

    await vi.advanceTimersByTimeAsync(1_050);

    const result = wait.result();
    expect(result).toMatchObject({ success: true, state: SessionState.RUNNING });
    expect(result?.data?.pending).toBe(true);
    expect(result?.data?.sessionId).toBe(rootId);
    expect(result?.data?.children).toEqual([expect.objectContaining({ sessionId: child.id, state: SessionState.RUNNING })]);
  });

  it("an errored child is reported for the parent's wait, naming the child", async () => {
    const rootId = await startRoot();
    const child = await adopt(dependencies.mockProxyManager, rootId, 4242);
    const wait = track(sessionManager.waitForStop(rootId, 10_000));

    child.view.simulateError(new Error('connection lost'));
    await afterStop();

    const result = wait.result();
    expect(result).toMatchObject({ success: true, state: SessionState.ERROR });
    expect(result?.data?.sessionId).toBe(child.id);
    expect(result?.data?.message).toMatch(/connection lost/);
    expect(sessionManager.getSession(rootId)!.state).toBe(SessionState.RUNNING);
  });

  it('still refuses a wait on a session that was closed while waiting', async () => {
    const rootId = await startRoot();
    const wait = track(sessionManager.waitForStop(rootId, 10_000));
    await vi.advanceTimersByTimeAsync(50);

    await sessionManager.closeSession(rootId);
    await afterStop();

    expect(wait.result()?.success).toBe(false);
    expect(wait.result()?.error).toMatch(/closed while waiting/);
  });
});
