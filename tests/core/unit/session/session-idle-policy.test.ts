/**
 * The per-debug-session idle policy (issue #1025, step 2), decided on the
 * issue and in docs/architecture/session-tree.md: with no protocol-level
 * session to end a debug session, a tree whose root has seen no tool call for
 * the window is closed through the normal close cascade. Only roots have a
 * clock (a child goes with its root); a tool call naming any session in the
 * tree refreshes the root; an in-flight wait_for_stop holds the root; and the
 * sweep is skipped entirely while a client is attending the process.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

const report = (reportId: string, pid = 4242) => ({
  reportId,
  targetId: String(pid),
  name: `Subprocess ${pid}`,
  configuration: { type: 'python', subProcessId: pid }
});

const WINDOW = 30 * 60 * 1000;

describe('SessionManager idle policy (issue #1025, step 2)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  const config: SessionManagerConfig = {
    logDirBase: '/tmp/test-sessions',
    defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true }
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(1_000_000);
    dependencies = createMockDependencies();
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  const now = () => Date.now();
  const ids = () => sessionManager.getAllSessions().map((s) => s.id);

  async function startRoot(): Promise<string> {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    await sessionManager.setBreakpoint(session.id, { file: '/w/child.py', line: 7 });
    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    return session.id;
  }

  async function adoptChild(rootId: string): Promise<string> {
    dependencies.mockProxyManager.simulateEvent('child-reported', report('r1'));
    await vi.runAllTimersAsync();
    const child = sessionManager.getAllSessions().find((s) => s.parentSessionId === rootId);
    expect(child).toBeDefined();
    return child!.id;
  }

  it('a root with no activity for the window is closed, and the sweep names it', async () => {
    const rootId = await startRoot();
    const closeSpy = vi.spyOn(sessionManager, 'closeSession');

    const closed = await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });

    expect(closed).toEqual([rootId]);
    expect(closeSpy).toHaveBeenCalledWith(rootId);
    expect(ids()).not.toContain(rootId);
    expect(dependencies.logger.info).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`Closing idle debug session ${rootId} \\(idle \\d+s\\)`))
    );
  });

  it('a root that saw a tool call inside the window is kept', async () => {
    const rootId = await startRoot();
    vi.setSystemTime(now() + WINDOW - 1000);
    sessionManager.touchActivity(rootId);

    const closed = await sessionManager.sweepIdle(WINDOW, { now: now() + 5000 });

    expect(closed).toEqual([]);
    expect(ids()).toContain(rootId);
  });

  it('a tool call naming a child refreshes the root, so the tree is kept', async () => {
    const rootId = await startRoot();
    const childId = await adoptChild(rootId);
    vi.setSystemTime(now() + WINDOW - 1000);
    sessionManager.touchActivity(childId);

    const closed = await sessionManager.sweepIdle(WINDOW, { now: now() + 5000 });

    expect(closed).toEqual([]);
    expect(ids()).toEqual(expect.arrayContaining([rootId, childId]));
    expect(sessionManager.idleMsOf(childId, now() + 5000)).toBe(sessionManager.idleMsOf(rootId, now() + 5000));
  });

  it('a child under an active root never expires on a clock of its own', async () => {
    const rootId = await startRoot();
    const childId = await adoptChild(rootId);
    // Nothing ever named the child; the root is active.
    vi.setSystemTime(now() + WINDOW * 3);
    sessionManager.touchActivity(rootId);

    const closed = await sessionManager.sweepIdle(WINDOW, { now: now() + 1000 });

    expect(closed).toEqual([]);
    expect(ids()).toContain(childId);
  });

  it('the root expiry cascades to the children through the normal close path', async () => {
    const rootId = await startRoot();
    const childId = await adoptChild(rootId);

    const closed = await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });

    expect(closed).toEqual([rootId]);
    expect(ids()).not.toContain(rootId);
    expect(ids()).not.toContain(childId);
  });

  it('an in-flight wait_for_stop on a child holds the root until it is released', async () => {
    const rootId = await startRoot();
    const childId = await adoptChild(rootId);
    const release = sessionManager.holdIdle(childId);

    expect(await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 })).toEqual([]);
    expect(ids()).toContain(rootId);

    release();
    expect(await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 })).toEqual([rootId]);
  });

  it('two overlapping holds release independently', async () => {
    const rootId = await startRoot();
    const releaseA = sessionManager.holdIdle(rootId);
    const releaseB = sessionManager.holdIdle(rootId);

    releaseA();
    releaseA(); // idempotent
    expect(await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 })).toEqual([]);

    releaseB();
    expect(await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 })).toEqual([rootId]);
  });

  it('nothing expires while a client is attending the process; the first unattended sweep closes an idle root', async () => {
    const rootId = await startRoot();

    expect(await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW * 4, attended: true })).toEqual([]);
    expect(ids()).toContain(rootId);

    expect(await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW * 4, attended: false })).toEqual([rootId]);
  });

  it('a window of zero disables the policy', async () => {
    const rootId = await startRoot();

    expect(await sessionManager.sweepIdle(0, { now: now() + WINDOW * 100 })).toEqual([]);
    expect(ids()).toContain(rootId);
  });

  it('holding or touching an unknown session is a no-op', async () => {
    expect(() => sessionManager.touchActivity('nope')).not.toThrow();
    const release = sessionManager.holdIdle('nope');
    expect(() => release()).not.toThrow();
    expect(sessionManager.idleMsOf('nope')).toBeUndefined();
  });

  it('a closed root leaves no clock behind', async () => {
    const rootId = await startRoot();
    await sessionManager.closeSession(rootId);

    expect(sessionManager.idleMsOf(rootId)).toBeUndefined();
    expect(await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 })).toEqual([]);
  });
});
