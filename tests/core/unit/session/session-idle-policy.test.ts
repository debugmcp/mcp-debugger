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
import { DebugLanguage, JsDebugAdapterPolicy, SessionState } from '@debugmcp/shared';
import { createMockDependencies, overridePolicy } from './session-manager-test-utils.js';

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
    // The close the sweep runs is the one close_debug_session answers from.
    const closeSpy = vi.spyOn(sessionManager, 'closeSessionReporting');

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

  it('adopting a child is activity: it refreshes the root clock', async () => {
    const rootId = await startRoot();
    vi.setSystemTime(now() + WINDOW - 1000);
    await adoptChild(rootId);

    const closed = await sessionManager.sweepIdle(WINDOW, { now: now() + 5000 });

    expect(closed).toEqual([]);
    expect(ids()).toContain(rootId);
  });

  it('attendance is asked again before each close, so a client arriving mid-sweep stops the rest', async () => {
    const a = (await sessionManager.createSession({ language: DebugLanguage.MOCK })).id;
    const b = (await sessionManager.createSession({ language: DebugLanguage.MOCK })).id;
    let attended = false;
    vi.spyOn(sessionManager, 'closeSessionReporting').mockImplementation(async (id: string) => {
      attended = true;
      return { closed: true, closedSessionIds: [id] };
    });

    const closed = await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1, attended: () => attended });

    expect(closed).toHaveLength(1);
    expect([a, b]).toContain(closed[0]);
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

  // What an expiry leaves behind (issue #1025, the second look): the agent that
  // comes back to a closed session is told what happened, not "not found".
  describe('the record an expiry leaves', () => {
    it('names when a launch root was closed, how long it sat idle, the window, and that its program was ended', async () => {
      const rootId = await startRoot();
      const at = now() + WINDOW + 60_000;
      const idleMs = sessionManager.idleMsOf(rootId, at);
      expect(idleMs).toBeGreaterThan(WINDOW);

      await sessionManager.sweepIdle(WINDOW, { now: at });

      expect(sessionManager.idleExpiryOf(rootId, undefined)).toEqual({
        sessionId: rootId,
        rootId,
        closedAt: at,
        idleMs,
        windowMs: WINDOW,
        outcome: 'ended'
      });
    });

    /** Mark a row an attach root, the way attach_to_process does. */
    const markAttached = (id: string): void =>
      (sessionManager as unknown as { sessionStore: { update(id: string, patch: object): void } })
        .sessionStore.update(id, { attachMode: true });

    it('says an attach root was released: its target keeps running', async () => {
      // A live session (the mock launch stands in for a connected target).
      const rootId = await startRoot();
      markAttached(rootId);

      await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });

      expect(sessionManager.idleExpiryOf(rootId, undefined)?.outcome).toBe('released');
    });

    // "Its program was ended" is only true when there was one. A session the
    // policy removes with nothing running in it says so instead.
    it('says a session that never launched had no program: nothing was ended', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });

      await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });

      expect(sessionManager.idleExpiryOf(session.id, undefined)?.outcome).toBe('closed');
    });

    it('says a root whose program had already ended had none left to end', async () => {
      const rootId = await startRoot();
      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      expect(sessionManager.getSession(rootId)!.state).toBe(SessionState.STOPPED);

      await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });

      expect(sessionManager.idleExpiryOf(rootId, undefined)?.outcome).toBe('closed');
    });

    it('does not call an attach root\'s target released when the target was already gone', async () => {
      const rootId = await startRoot();
      markAttached(rootId);
      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      expect(sessionManager.getSession(rootId)!.state).toBe(SessionState.STOPPED);

      await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });

      expect(sessionManager.idleExpiryOf(rootId, undefined)?.outcome).toBe('closed');
    });

    it('under a live attach root, a child that had already ended is not called released', async () => {
      const rootId = await startRoot();
      markAttached(rootId);
      const childId = await adoptChild(rootId);
      dependencies.mockProxyManager.childViews.get(childId)!.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      expect(sessionManager.getSession(childId)!.state).toBe(SessionState.STOPPED);

      await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });

      expect(sessionManager.idleExpiryOf(childId, undefined)?.outcome).toBe('closed');
      expect(sessionManager.idleExpiryOf(rootId, undefined)?.outcome).toBe('released');
    });

    it('a child released by an earlier detach is still recorded as released: its process runs on', async () => {
      const rootId = await startRoot();
      const childId = await adoptChild(rootId);
      // What the detach cascade leaves on a released child's retained row.
      (sessionManager as unknown as { sessionStore: { update(id: string, patch: object): void } })
        .sessionStore.update(childId, { programEndExplanation: { note: 'Released', data: { released: true } } });
      dependencies.mockProxyManager.childViews.get(childId)!.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      expect(sessionManager.getSession(childId)!.state).toBe(SessionState.STOPPED);

      await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });

      expect(sessionManager.idleExpiryOf(childId, undefined)?.outcome).toBe('released');
    });

    it('records a released JavaScript child separately from its ended launch root', async () => {
      const rootId = await startRoot();
      const childId = await adoptChild(rootId);
      const childView = dependencies.mockProxyManager.childViews.get(childId)!;
      // Adopt through the mock fixture, then use js-debug's measured close
      // semantics: disconnecting a fork releases it, even under a launch root.
      overridePolicy(sessionManager, { childAdoption: JsDebugAdapterPolicy.childAdoption });

      await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });

      expect(childView.stopOptions[0]).toEqual({ terminateDebuggee: false });
      expect(sessionManager.idleExpiryOf(rootId, undefined)?.outcome).toBe('ended');
      expect(sessionManager.idleExpiryOf(childId, undefined)?.outcome).toBe('released');
    });

    it('records a later child as ended when it terminates while an earlier close waits', async () => {
      const rootId = await startRoot();
      const firstId = await adoptChild(rootId);
      dependencies.mockProxyManager.simulateEvent('child-reported', report('r2', 4343));
      await vi.runAllTimersAsync();
      const secondId = sessionManager.getAllSessions()
        .find((session) => session.parentSessionId === rootId && session.id !== firstId)!.id;
      const firstView = dependencies.mockProxyManager.childViews.get(firstId)!;
      const secondView = dependencies.mockProxyManager.childViews.get(secondId)!;
      overridePolicy(sessionManager, { childAdoption: JsDebugAdapterPolicy.childAdoption });

      let finishFirst!: () => void;
      let firstStarted!: () => void;
      const started = new Promise<void>((resolve) => { firstStarted = resolve; });
      const stopFirst = firstView.stop.bind(firstView);
      vi.spyOn(firstView, 'stop').mockImplementation(async (options) => {
        firstStarted();
        await new Promise<void>((resolve) => { finishFirst = resolve; });
        await stopFirst(options);
      });

      const closing = sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });
      await started;
      // This event's real handler clears the later child's connection before
      // the cascade reaches it; it was not released by the idle close.
      secondView.simulateEvent('terminated');
      expect(sessionManager.getSession(secondId)!.proxyManager).toBeUndefined();
      finishFirst();
      await closing;

      expect(sessionManager.idleExpiryOf(firstId, undefined)?.outcome).toBe('released');
      expect(sessionManager.idleExpiryOf(secondId, undefined)?.outcome).toBe('ended');
      expect(sessionManager.idleExpiryOf(rootId, undefined)?.outcome).toBe('ended');
    });

    it('records every session the expiry took with its root', async () => {
      const rootId = await startRoot();
      const childId = await adoptChild(rootId);

      await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });

      expect(sessionManager.idleExpiryOf(childId, undefined)).toMatchObject({ sessionId: childId, rootId });
    });

    it('is visible in the owner scope only', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, ownerKey: 'agent-b' });

      await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });

      expect(sessionManager.idleExpiryOf(session.id, 'agent-b')).toMatchObject({ sessionId: session.id });
      expect(sessionManager.idleExpiryOf(session.id, 'agent-a')).toBeUndefined();
      expect(sessionManager.idleExpiryOf(session.id, undefined)).toBeUndefined();
    });

    it('is not left by a close the agent asked for', async () => {
      const rootId = await startRoot();

      await sessionManager.closeSession(rootId);

      expect(sessionManager.idleExpiryOf(rootId, undefined)).toBeUndefined();
    });

    it('is bounded: the oldest records go first', async () => {
      const created: string[] = [];
      for (let i = 0; i < 201; i++) {
        created.push((await sessionManager.createSession({ language: DebugLanguage.MOCK })).id);
      }

      await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });

      expect(sessionManager.idleExpiryOf(created[0], undefined)).toBeUndefined();
      expect(sessionManager.idleExpiryOf(created[1], undefined)).toBeDefined();
      expect(sessionManager.idleExpiryOf(created[200], undefined)).toBeDefined();
    });

    it('the log says what the close did to the program', async () => {
      const rootId = await startRoot();

      await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });

      expect(dependencies.mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Idle debug session ${rootId} closed: its program was ended`)
      );
    });

    it('the log does not claim a program was ended when none was running', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });

      await sessionManager.sweepIdle(WINDOW, { now: now() + WINDOW + 1 });

      expect(dependencies.mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Idle debug session ${session.id} closed: it had no running program`)
      );
    });
  });
});

