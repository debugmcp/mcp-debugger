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
 */
import type { SessionState } from '@debugmcp/shared';
import type { OperationsContext } from '../operations-context.js';

export type SessionStateWaitContext = Pick<OperationsContext, 'getSession' | 'onStateChange'>;

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

export function waitForSessionState(
  ctx: SessionStateWaitContext,
  sessionId: string,
  until: (state: SessionState) => boolean,
  options: SessionStateWaitOptions
): Promise<SessionStateWaitOutcome> {
  const { timeoutMs, signal } = options;
  return new Promise<SessionStateWaitOutcome>((resolve) => {
    let settled = false;
    let recheckQueued = false;
    // What to undo when the wait settles: the subscription, the abort
    // listener and the timer, each added as it is set up.
    const disposers: Array<() => void> = [];

    const settle = (outcome: SessionStateWaitOutcome) => {
      if (settled) {
        return;
      }
      settled = true;
      for (const dispose of disposers) {
        dispose();
      }
      resolve(outcome);
    };

    /** Read the state as it is now; true when that settled the wait. */
    const check = (): boolean => {
      let state: SessionState;
      try {
        state = ctx.getSession(sessionId).state;
      } catch {
        settle('gone');
        return true;
      }
      if (until(state)) {
        settle('matched');
        return true;
      }
      return false;
    };

    if (signal?.aborted) {
      settle('aborted');
      return;
    }
    if (check()) {
      return;
    }

    disposers.push(ctx.onStateChange(sessionId, () => {
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
      const onAbort = () => settle('aborted');
      signal.addEventListener('abort', onAbort, { once: true });
      disposers.push(() => signal.removeEventListener('abort', onAbort));
    }
    const timer = setTimeout(() => settle('timeout'), timeoutMs);
    disposers.push(() => clearTimeout(timer));
  });
}
