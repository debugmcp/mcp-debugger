/**
 * Types for `lifecycle-queue.mjs`, so its TypeScript tests see a real API
 * instead of `@ts-ignore`-ing the import into `any` (issue #562).
 */

/** Serialize backend lifecycle mutations without letting one failure poison the queue. */
export class LifecycleQueue {
  /**
   * The chain every queued operation is appended to. An implementation detail:
   * it is re-pointed on each {@link run} and its resolved value is always
   * discarded, so nothing can be read back off it.
   */
  tail: Promise<unknown>;

  /**
   * Queue `operation` behind everything already queued and run it once its
   * turn comes — whether the operation ahead of it settled or threw.
   *
   * @returns the operation's own result, rejecting exactly as it does. A
   *   rejection is contained here and never blocks the next caller.
   */
  run<T>(operation: () => Promise<T>): Promise<T>;

  /**
   * Resolve once nothing is queued — the bounded, abortable wait behind
   * `BackendManager.whenReady` (issue #716).
   *
   * @param options `timeoutMs` defaults to 0, i.e. "do not wait at all"; every
   *   caller that means to wait passes its own bound.
   * @returns `true` when the queue drained, `false` when `timeoutMs` elapsed
   *   or `signal` aborted first. Never rejects: a failed operation still
   *   drains the queue.
   */
  idle(options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<boolean>;
}
