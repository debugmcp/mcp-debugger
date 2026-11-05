/**
 * waitForSessionState: the one wait on a session's state (issue #849). It is
 * level-triggered — it reads the state when asked and again once each burst of
 * state changes has unwound — so a state that is entered and left inside one
 * call stack (an entry stop the core auto-continues) is never reported.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionState, isTerminalSessionState } from '@debugmcp/shared';
import {
  waitForSessionState,
  waitForSubtreeSettle,
  type SettleWaitResult,
  type SessionStateWaitOutcome
} from '../../../../src/session/execution/session-state-wait.js';

const stoppedOrEnded = (state: SessionState) =>
  state === SessionState.PAUSED || isTerminalSessionState(state);

function harness(initial: SessionState) {
  const session = { id: 's1', state: initial };
  let present = true;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  const ctx = {
    getSession: (sessionId: string) => {
      if (!present) throw new Error(`Managed session not found: ${sessionId}`);
      return session;
    },
    onStateChange: (_sessionId: string, listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
  let outcome: SessionStateWaitOutcome | undefined;
  const wait = (timeoutMs: number, signal?: AbortSignal) => {
    void waitForSessionState(ctx as never, 's1', stoppedOrEnded, { timeoutMs, signal })
      .then((settled) => { outcome = settled; });
  };
  return {
    wait,
    outcome: () => outcome,
    setState: (state: SessionState) => { session.state = state; notify(); },
    remove: () => { present = false; notify(); },
    listenerCount: () => listeners.size
  };
}

/** Let queued microtasks (the wait's re-read, the promise continuation) run. */
const settleMicrotasks = () => vi.advanceTimersByTimeAsync(0);

describe('waitForSessionState', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('matches at once when the state already satisfies the predicate, without subscribing', async () => {
    const h = harness(SessionState.PAUSED);
    h.wait(30_000);
    await settleMicrotasks();
    expect(h.outcome()).toBe('matched');
    expect(h.listenerCount()).toBe(0);
  });

  it('matches when a later state change satisfies the predicate, and unsubscribes', async () => {
    const h = harness(SessionState.RUNNING);
    h.wait(30_000);
    await settleMicrotasks();
    expect(h.outcome()).toBeUndefined();
    h.setState(SessionState.PAUSED);
    await settleMicrotasks();
    expect(h.outcome()).toBe('matched');
    expect(h.listenerCount()).toBe(0);
  });

  it('matches a terminal state the same way', async () => {
    const h = harness(SessionState.RUNNING);
    h.wait(30_000);
    h.setState(SessionState.STOPPED);
    await settleMicrotasks();
    expect(h.outcome()).toBe('matched');
  });

  it('does not report a state entered and left within one call stack', async () => {
    const h = harness(SessionState.INITIALIZING);
    h.wait(30_000);
    // The core's auto-continue: PAUSED for the entry stop, RUNNING again
    // before the stopped handler returns.
    h.setState(SessionState.PAUSED);
    h.setState(SessionState.RUNNING);
    await settleMicrotasks();
    expect(h.outcome()).toBeUndefined();
    expect(h.listenerCount()).toBe(1);
    // The stop the caller does see.
    h.setState(SessionState.PAUSED);
    await settleMicrotasks();
    expect(h.outcome()).toBe('matched');
  });

  it('times out when nothing matches, and unsubscribes', async () => {
    const h = harness(SessionState.RUNNING);
    h.wait(1_000);
    await vi.advanceTimersByTimeAsync(999);
    expect(h.outcome()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.outcome()).toBe('timeout');
    expect(h.listenerCount()).toBe(0);
  });

  it('ignores a state change that arrives after it settled', async () => {
    const h = harness(SessionState.RUNNING);
    h.wait(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    h.setState(SessionState.PAUSED);
    await settleMicrotasks();
    expect(h.outcome()).toBe('timeout');
  });

  it('reports an abort, and releases its timer and subscription', async () => {
    const h = harness(SessionState.RUNNING);
    const controller = new AbortController();
    h.wait(30_000, controller.signal);
    await settleMicrotasks();
    controller.abort();
    await settleMicrotasks();
    expect(h.outcome()).toBe('aborted');
    expect(h.listenerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports an abort that happened before the wait began', async () => {
    const h = harness(SessionState.RUNNING);
    const controller = new AbortController();
    controller.abort();
    h.wait(30_000, controller.signal);
    await settleMicrotasks();
    expect(h.outcome()).toBe('aborted');
    expect(h.listenerCount()).toBe(0);
  });

  it('reports a session that was removed while it waited', async () => {
    const h = harness(SessionState.RUNNING);
    h.wait(30_000);
    await settleMicrotasks();
    h.remove();
    await settleMicrotasks();
    expect(h.outcome()).toBe('gone');
    expect(h.listenerCount()).toBe(0);
  });

  it('reports a session that does not exist when the wait begins', async () => {
    const h = harness(SessionState.RUNNING);
    h.remove();
    h.wait(30_000);
    await settleMicrotasks();
    expect(h.outcome()).toBe('gone');
  });
});

/**
 * waitForSubtreeSettle: the same wait over a session and its descendants (the
 * session tree, issue #1081). It re-reads the tree's selection after every
 * change to the session or any descendant, with the same microtask deferral,
 * and resolves with the session the selection names.
 */
function treeHarness() {
  type Node = { id: string; state: SessionState; parentSessionId?: string };
  const nodes = new Map<string, Node>([['root', { id: 'root', state: SessionState.RUNNING }]]);
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  const ctx = {
    getSession: (sessionId: string) => {
      const found = nodes.get(sessionId);
      if (!found) throw new Error(`Managed session not found: ${sessionId}`);
      return found;
    },
    onSubtreeChange: (_sessionId: string, listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    descendantsOf: (sessionId: string) => [...nodes.values()].filter((n) => n.parentSessionId === sessionId)
  };
  let result: SettleWaitResult<Node> | undefined;
  return {
    wait: (timeoutMs: number) => {
      void waitForSubtreeSettle(ctx as never, 'root', { timeoutMs })
        .then((settled) => { result = settled as SettleWaitResult<Node>; });
    },
    result: () => result,
    adopt: (id: string, state: SessionState) => { nodes.set(id, { id, state, parentSessionId: 'root' }); notify(); },
    setState: (id: string, state: SessionState) => { nodes.get(id)!.state = state; notify(); },
    remove: (id: string) => { nodes.delete(id); notify(); },
    listenerCount: () => listeners.size
  };
}

describe('waitForSubtreeSettle', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('resolves with the descendant that paused after the wait began, and unsubscribes', async () => {
    const h = treeHarness();
    h.wait(30_000);
    h.adopt('child', SessionState.RUNNING);
    await settleMicrotasks();
    expect(h.result()).toBeUndefined();
    h.setState('child', SessionState.PAUSED);
    await settleMicrotasks();
    expect(h.result()).toEqual({ outcome: 'matched', value: expect.objectContaining({ id: 'child' }) });
    expect(h.listenerCount()).toBe(0);
  });

  it('does not report a descendant state entered and left within one call stack', async () => {
    const h = treeHarness();
    h.adopt('child', SessionState.RUNNING);
    h.wait(30_000);
    h.setState('child', SessionState.PAUSED);
    h.setState('child', SessionState.RUNNING);
    await settleMicrotasks();
    expect(h.result()).toBeUndefined();
    expect(h.listenerCount()).toBe(1);
  });

  it('treats a descendant that is removed as a change, not as the wait being gone', async () => {
    const h = treeHarness();
    h.adopt('child', SessionState.RUNNING);
    h.wait(30_000);
    h.remove('child');
    await settleMicrotasks();
    expect(h.result()).toBeUndefined();
    h.setState('root', SessionState.PAUSED);
    await settleMicrotasks();
    expect(h.result()).toEqual({ outcome: 'matched', value: expect.objectContaining({ id: 'root' }) });
  });

  it('reports the asked session being removed as gone', async () => {
    const h = treeHarness();
    h.wait(30_000);
    h.remove('root');
    await settleMicrotasks();
    expect(h.result()).toEqual({ outcome: 'gone' });
    expect(h.listenerCount()).toBe(0);
  });

  it('times out like the single-session wait', async () => {
    const h = treeHarness();
    h.wait(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(h.result()).toEqual({ outcome: 'timeout' });
    expect(h.listenerCount()).toBe(0);
  });
});
