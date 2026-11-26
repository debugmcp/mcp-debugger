/**
 * waitForLaunchReadiness: the two waits between "the handshake has run" and
 * "the launch is reportable" (issues #823, #826). First the program has to be
 * launched — the session leaves INITIALIZING — which gets a generous ceiling
 * because it is not a guess; then its first stop is held for a short window,
 * the same for every adapter and whatever is armed. Both waits are on the
 * session's state, so a stop the core auto-continues settles neither.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionState } from '@debugmcp/shared';
import { waitForLaunchReadiness, type LaunchReadinessOutcome } from '../../../../../src/session/launch/launch-readiness.js';

function harness(opts: {
  state?: SessionState;
  launchedCeilingMs?: number;
  holdMs?: number;
  beforeHold?: () => Promise<void> | void;
}) {
  const session = { id: 's1', state: opts.state ?? SessionState.INITIALIZING };
  let present = true;
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of [...listeners]) listener(); };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const ctx = {
    logger,
    getSession: (sessionId: string) => {
      if (!present) throw new Error(`Managed session not found: ${sessionId}`);
      return session;
    },
    onStateChange: (_sessionId: string, listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
  let outcome: LaunchReadinessOutcome | undefined;
  void waitForLaunchReadiness(ctx as never, {
    sessionId: 's1',
    launchedCeilingMs: opts.launchedCeilingMs ?? 30_000,
    holdMs: opts.holdMs ?? 1_000,
    ...(opts.beforeHold ? { beforeHold: opts.beforeHold } : {})
  }).then((settled) => { outcome = settled; });
  return {
    outcome: () => outcome,
    setState: (state: SessionState) => { session.state = state; notify(); },
    remove: () => { present = false; notify(); },
    listenerCount: () => listeners.size,
    logger
  };
}

const settleMicrotasks = () => vi.advanceTimersByTimeAsync(0);

describe('waitForLaunchReadiness', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  describe('until the program is launched', () => {
    it('keeps waiting while the session is initializing, well past the hold', async () => {
      const h = harness({ holdMs: 1_000 });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(h.outcome()).toBeUndefined();
    });

    it('answers "not-launched" at the ceiling and warns that the adapter did not become ready', async () => {
      const h = harness({ launchedCeilingMs: 30_000 });
      await vi.advanceTimersByTimeAsync(29_999);
      expect(h.outcome()).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(h.outcome()).toBe('not-launched');
      expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Timed out waiting for debug adapter'));
      expect(h.listenerCount()).toBe(0);
    });

    it('answers "stopped" for the entry stop of a stopOnEntry launch, which leaves INITIALIZING as PAUSED', async () => {
      const h = harness({});
      await vi.advanceTimersByTimeAsync(5_000); // a slow start is not a missed hold
      h.setState(SessionState.PAUSED);
      await settleMicrotasks();
      expect(h.outcome()).toBe('stopped');
    });

    it('answers "ended" for a program that finished before it was ever seen running', async () => {
      const h = harness({});
      h.setState(SessionState.STOPPED);
      await settleMicrotasks();
      expect(h.outcome()).toBe('ended');
    });

    it('answers "ended" for a launch that failed into ERROR', async () => {
      const h = harness({});
      h.setState(SessionState.ERROR);
      await settleMicrotasks();
      expect(h.outcome()).toBe('ended');
    });

    it('answers "ended" when the session is closed underneath the launch', async () => {
      const h = harness({});
      h.remove();
      await settleMicrotasks();
      expect(h.outcome()).toBe('ended');
    });
  });

  describe('the hold for the first stop', () => {
    it('starts only once the program is running, and answers "running" when it elapses', async () => {
      const h = harness({ holdMs: 1_000 });
      await vi.advanceTimersByTimeAsync(4_000);
      h.setState(SessionState.RUNNING);
      await vi.advanceTimersByTimeAsync(999);
      expect(h.outcome()).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(h.outcome()).toBe('running');
      expect(h.logger.warn).not.toHaveBeenCalled();
      expect(h.listenerCount()).toBe(0);
    });

    it('answers "stopped" for a stop that lands inside the hold', async () => {
      const h = harness({ state: SessionState.RUNNING, holdMs: 1_000 });
      await vi.advanceTimersByTimeAsync(400);
      h.setState(SessionState.PAUSED);
      await settleMicrotasks();
      expect(h.outcome()).toBe('stopped');
    });

    it('answers "ended" for a program that finishes inside the hold', async () => {
      const h = harness({ state: SessionState.RUNNING, holdMs: 1_000 });
      await vi.advanceTimersByTimeAsync(400);
      h.setState(SessionState.STOPPED);
      await settleMicrotasks();
      expect(h.outcome()).toBe('ended');
    });

    it('is not settled by an entry stop the core auto-continues', async () => {
      const h = harness({ holdMs: 1_000 });
      // Forced entry stop of a launch that asked for none: PAUSED and RUNNING
      // again inside one stopped event.
      h.setState(SessionState.PAUSED);
      h.setState(SessionState.RUNNING);
      await settleMicrotasks();
      expect(h.outcome()).toBeUndefined();
      await vi.advanceTimersByTimeAsync(300);
      h.setState(SessionState.PAUSED); // the stop the caller armed
      await settleMicrotasks();
      expect(h.outcome()).toBe('stopped');
    });

    it('answers at once when the launch is already paused or already over', async () => {
      const paused = harness({ state: SessionState.PAUSED });
      const over = harness({ state: SessionState.STOPPED });
      await settleMicrotasks();
      expect(paused.outcome()).toBe('stopped');
      expect(over.outcome()).toBe('ended');
    });
  });

  describe('beforeHold', () => {
    it('runs once, after the program is running and before the hold begins', async () => {
      const events: string[] = [];
      let release!: () => void;
      const beforeHold = vi.fn(() => {
        events.push('beforeHold');
        return new Promise<void>((resolve) => { release = resolve; });
      });
      const h = harness({ holdMs: 1_000, beforeHold });
      await vi.advanceTimersByTimeAsync(2_000);
      expect(beforeHold).not.toHaveBeenCalled();

      h.setState(SessionState.RUNNING);
      await settleMicrotasks();
      expect(beforeHold).toHaveBeenCalledTimes(1);

      // The hold has not begun while the hook is in flight.
      await vi.advanceTimersByTimeAsync(5_000);
      expect(h.outcome()).toBeUndefined();
      release();
      await vi.advanceTimersByTimeAsync(999);
      expect(h.outcome()).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(h.outcome()).toBe('running');
    });

    it('is skipped when the launch is already paused or over: there is no hold to prepare', async () => {
      const beforeHold = vi.fn();
      const h = harness({ state: SessionState.PAUSED, beforeHold });
      await settleMicrotasks();
      expect(h.outcome()).toBe('stopped');
      expect(beforeHold).not.toHaveBeenCalled();
    });

    it('does not fail the launch when it throws', async () => {
      const beforeHold = vi.fn(async () => { throw new Error('resync refused'); });
      const h = harness({ state: SessionState.RUNNING, holdMs: 1_000, beforeHold });
      await vi.advanceTimersByTimeAsync(1_000);
      expect(h.outcome()).toBe('running');
      expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('resync refused'));
    });
  });

  describe('the tree-aware launch hold (I2, issue #1150)', () => {
    function treeHarness(opts: {
      state?: SessionState;
      holdMs?: number;
      launchedCeilingMs?: number;
    } = {}) {
      const root = { id: 'root', state: opts.state ?? SessionState.RUNNING };
      const children: Array<{ id: string; state: SessionState }> = [];
      let present = true;
      const stateListeners = new Set<() => void>();
      const subtreeListeners = new Set<() => void>();
      const notifyState = () => { for (const l of [...stateListeners]) l(); };
      const notifySubtree = () => { for (const l of [...subtreeListeners]) l(); };
      const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
      const ctx = {
        logger,
        getSession: (sessionId: string) => {
          if (!present && sessionId === 'root') throw new Error(`Managed session not found: ${sessionId}`);
          if (sessionId === 'root') return root;
          const child = children.find((c) => c.id === sessionId);
          if (!child) throw new Error(`Managed session not found: ${sessionId}`);
          return child;
        },
        onStateChange: (_sessionId: string, listener: () => void) => {
          stateListeners.add(listener);
          return () => { stateListeners.delete(listener); };
        },
        onSubtreeChange: (_sessionId: string, listener: () => void) => {
          subtreeListeners.add(listener);
          return () => { subtreeListeners.delete(listener); };
        },
        descendantsOf: () => [...children]
      };
      let outcome: LaunchReadinessOutcome | undefined;
      void waitForLaunchReadiness(ctx as never, {
        sessionId: 'root',
        launchedCeilingMs: opts.launchedCeilingMs ?? 30_000,
        holdMs: opts.holdMs ?? 1_000
      }).then((settled) => { outcome = settled; });
      return {
        outcome: () => outcome,
        setRootState: (state: SessionState) => { root.state = state; notifyState(); notifySubtree(); },
        addChild: (id: string, state: SessionState) => {
          const child = { id, state };
          children.push(child);
          notifySubtree();
          return child;
        },
        setChildState: (id: string, state: SessionState) => {
          const child = children.find((c) => c.id === id);
          if (child) child.state = state;
          notifySubtree();
        },
        removeRoot: () => { present = false; notifyState(); notifySubtree(); },
        subtreeListenerCount: () => subtreeListeners.size
      };
    }

    it('ends the hold after the 50 ms grace when a child pauses 100 ms into a 1,000 ms hold', async () => {
      const h = treeHarness({ holdMs: 1_000 });
      await vi.advanceTimersByTimeAsync(100);
      expect(h.outcome()).toBeUndefined();

      h.addChild('c1', SessionState.PAUSED);
      await vi.advanceTimersByTimeAsync(49);
      expect(h.outcome()).toBeUndefined();

      await vi.advanceTimersByTimeAsync(1);
      expect(h.outcome()).toBe('running');
      expect(h.subtreeListenerCount()).toBe(0);
    });

    it('clears the grace and keeps the hold going when a paused child resumes inside the 50 ms grace', async () => {
      const h = treeHarness({ holdMs: 1_000 });
      await vi.advanceTimersByTimeAsync(100);
      h.addChild('c1', SessionState.PAUSED);
      await vi.advanceTimersByTimeAsync(20);
      expect(h.outcome()).toBeUndefined();

      // Child resumes inside the 50 ms grace: the grace timer must be cleared.
      h.setChildState('c1', SessionState.RUNNING);
      await vi.advanceTimersByTimeAsync(100);
      expect(h.outcome()).toBeUndefined();

      // Still waiting until the full 1,000 ms hold elapses.
      await vi.advanceTimersByTimeAsync(779);
      expect(h.outcome()).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(h.outcome()).toBe('running');
      expect(h.subtreeListenerCount()).toBe(0);
    });

    it('lets a root that stops inside the descendant grace win immediately with "stopped"', async () => {
      const h = treeHarness({ holdMs: 1_000 });
      await vi.advanceTimersByTimeAsync(100);
      h.addChild('c1', SessionState.PAUSED);
      await vi.advanceTimersByTimeAsync(20);
      expect(h.outcome()).toBeUndefined();

      h.setRootState(SessionState.PAUSED);
      await settleMicrotasks();
      expect(h.outcome()).toBe('stopped');
      expect(h.subtreeListenerCount()).toBe(0);
    });

    it('ends immediately when the root stops first before any child pauses', async () => {
      const h = treeHarness({ holdMs: 1_000 });
      await vi.advanceTimersByTimeAsync(80);
      h.addChild('c1', SessionState.RUNNING);
      h.setRootState(SessionState.PAUSED);
      await settleMicrotasks();
      expect(h.outcome()).toBe('stopped');
    });

    it('handles zero holdMs and root removal during the tree hold cleanly', async () => {
      const zero = treeHarness({ holdMs: 0 });
      await settleMicrotasks();
      expect(zero.outcome()).toBe('running');

      const removed = treeHarness({ holdMs: 1_000 });
      await vi.advanceTimersByTimeAsync(50);
      removed.removeRoot();
      await settleMicrotasks();
      expect(removed.outcome()).toBe('ended');
      expect(removed.subtreeListenerCount()).toBe(0);
    });

    it('is idempotent when finish() is triggered twice in the same tick', async () => {
      const root = { id: 'root', state: SessionState.RUNNING };
      const dispose = vi.fn();
      let evalCalls = 0;
      const ctx = {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        getSession: () => {
          evalCalls += 1;
          // On the tree hold's initial evaluate(), advance timers so holdTimer
          // calls finish() first, then return PAUSED so evaluate() calls finish()
          // a second time in the same tick.
          if (evalCalls === 3) {
            vi.advanceTimersByTime(1_000);
            root.state = SessionState.PAUSED;
          }
          return root;
        },
        onStateChange: () => () => {},
        onSubtreeChange: () => dispose,
        descendantsOf: () => []
      };

      const outcome = await waitForLaunchReadiness(ctx as never, {
        sessionId: 'root',
        launchedCeilingMs: 30_000,
        holdMs: 1_000
      });
      expect(outcome).toBe('stopped');
      expect(dispose).toHaveBeenCalledTimes(1);
    });
  });
});
