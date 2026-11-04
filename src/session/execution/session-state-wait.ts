/**
 * The one wait on a session's state: resolve when the state satisfies a
 * predicate, or when the caller's timeout or abort signal says to stop
 * waiting (issue #849).
 *
 * Level-triggered, on the session's own state rather than on adapter events.
 * The state is read when the wait begins and again after every change — but
 * the re-read is deferred to a microtask, so it sees the state as the call
 * stack that changed it left it. That is what keeps an auto-continued entry
 * stop out of the answer: the core enters PAUSED and resumes to RUNNING
 * inside one `stopped` handler (`handleAutoContinue` → `continue()`, which
 * writes RUNNING before its first await), and a waiter that settled on the
 * `stopped` event itself would report a stop the caller never sees.
 *
 * Never rejects. A session that is removed while waited on settles as 'gone'.
 *
 * The same primitive (`waitForSettle`) serves the tree-aware wait (the
 * session tree, issue #1081): `waitForSubtreeSettle` subscribes to the
 * session and all its descendants and re-reads the tree's selection
 * (`selectSettledInTree`) after each change, under the same deferral.
 */
import type { SessionState } from '@debugmcp/shared';
import type { ManagedSession } from '../session-store.js';
import type { OperationsContext } from '../operations-context.js';
import { selectSettledInTree } from './tree-settle.js';

export type SessionStateWaitContext = Pick<OperationsContext, 'getSession' | 'onStateChange'>;

/** What the tree-aware wait reads: the session, its descendants, and the tree's change feed. */
export type SubtreeWaitContext = Pick<OperationsContext, 'getSession' | 'onSubtreeChange' | 'descendantsOf'>;

/**
 * How the wait settled: the predicate held, the timeout passed, the caller's
 * signal aborted, or the session no longer exists.
 */
export type SessionStateWaitOutcome = 'matched' | 'timeout' | 'aborted' | 'gone';

export interface SessionStateWaitOptions {
  timeoutMs: number;
  /** Releases the wait early — an MCP request that was cancelled or whose client went away. */
  signal?: AbortSignal;
}

/** A settle wait's answer: what the read selected, or why it stopped reading. */
export type SettleWaitResult<T> =
  | { outcome: 'matched'; value: T }
  | { outcome: Exclude<SessionStateWaitOutcome, 'matched'> };

/**
 * Wait until `read` returns a value: now, or after a change `subscribe`
 * reports, re-read in a microtask. A `read` that throws means what it reads
 * no longer exists ('gone').
 */
export function waitForSettle<T>(
  subscribe: (listener: () => void) => () => void,
  read: () => T | undefined,
  options: SessionStateWaitOptions
): Promise<SettleWaitResult<T>> {
  const { timeoutMs, signal } = options;
  return new Promise<SettleWaitResult<T>>((resolve) => {
    let settled = false;
    let recheckQueued = false;
    // What to undo when the wait settles: the subscription, the abort
    // listener and the timer, each added as it is set up.
    const disposers: Array<() => void> = [];

    const settle = (result: SettleWaitResult<T>) => {
      if (settled) {
        return;
      }
      settled = true;
      for (const dispose of disposers) {
        dispose();
      }
      resolve(result);
    };

    /** Read as things are now; true when that settled the wait. */
    const check = (): boolean => {
      let value: T | undefined;
      try {
        value = read();
      } catch {
        settle({ outcome: 'gone' });
        return true;
      }
      if (value !== undefined) {
        settle({ outcome: 'matched', value });
        return true;
      }
      return false;
    };

    if (signal?.aborted) {
      settle({ outcome: 'aborted' });
      return;
    }
    if (check()) {
      return;
    }

    disposers.push(subscribe(() => {
      if (settled || recheckQueued) {
        return;
      }
      recheckQueued = true;
      queueMicrotask(() => {
        recheckQueued = false;
        if (!settled) {
          check();
        }
      });
    }));
    if (signal) {
      const onAbort = () => settle({ outcome: 'aborted' });
      signal.addEventListener('abort', onAbort, { once: true });
      disposers.push(() => signal.removeEventListener('abort', onAbort));
    }
    const timer = setTimeout(() => settle({ outcome: 'timeout' }), timeoutMs);
    disposers.push(() => clearTimeout(timer));
  });
}

export async function waitForSessionState(
  ctx: SessionStateWaitContext,
  sessionId: string,
  until: (state: SessionState) => boolean,
  options: SessionStateWaitOptions
): Promise<SessionStateWaitOutcome> {
  const result = await waitForSettle(
    (listener) => ctx.onStateChange(sessionId, listener),
    () => {
      const state = ctx.getSession(sessionId).state;
      return until(state) ? state : undefined;
    },
    options
  );
  return result.outcome;
}

/**
 * The tree-aware wait (issue #1081): settles on the session the four-rule
 * selection names — the session itself, or a descendant, including one
 * adopted while waiting — and is 'gone' only when the asked session itself is
 * removed; a descendant's removal is an ordinary change.
 */
export function waitForSubtreeSettle(
  ctx: SubtreeWaitContext,
  sessionId: string,
  options: SessionStateWaitOptions
): Promise<SettleWaitResult<ManagedSession>> {
  return waitForSettle(
    (listener) => ctx.onSubtreeChange(sessionId, listener),
    () => selectSettledInTree(ctx.getSession(sessionId), ctx.descendantsOf(sessionId)),
    options
  );
}
