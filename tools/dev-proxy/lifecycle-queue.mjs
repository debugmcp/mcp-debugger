/** Serialize backend lifecycle mutations without letting one failure poison the queue. */
export class LifecycleQueue {
  constructor() {
    this.tail = Promise.resolve();
    /** Operations queued or running: lets a reader tell "stopped" from "stopped, restart queued". */
    this.pending = 0;
  }

  /** @template T @param {() => Promise<T>} operation @returns {Promise<T>} */
  run(operation) {
    this.pending++;
    const result = this.tail.then(operation, operation).finally(() => { this.pending--; });
    this.tail = result.catch(() => {});
    return result;
  }

  /**
   * Resolve once nothing is queued.
   *
   * Observes {@link tail} rather than queueing a no-op behind it: a no-op
   * would make every waiter a lifecycle operation of its own, serializing
   * readers behind writers and delaying whatever is queued next.
   *
   * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
   * @returns {Promise<boolean>} true when the queue drained, false when
   *   `timeoutMs` elapsed or `signal` aborted first.
   */
  async idle({ timeoutMs = 0, signal } = {}) {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    let awaited;
    // An operation queued while we waited re-points the tail — follow it, or
    // a restart submitted mid-wait would look like an idle queue.
    while (awaited !== this.tail) {
      if (signal?.aborted) return false;
      const remaining = deadline - Date.now();
      if (remaining <= 0) return false;
      awaited = this.tail;
      if (!(await raceDeadline(awaited, remaining, signal))) return false;
    }
    return true;
  }
}

/**
 * True when `promise` settled first, false on deadline or abort. Leaves no
 * timer and no abort listener behind either way.
 *
 * @param {Promise<unknown>} promise
 * @param {number} timeoutMs
 * @param {AbortSignal} [signal]
 * @returns {Promise<boolean>}
 */
function raceDeadline(promise, timeoutMs, signal) {
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const onAbort = () => finish(false);
    const finish = (drained) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(drained);
    };

    timer = setTimeout(() => finish(false), timeoutMs);
    timer.unref?.();
    signal?.addEventListener('abort', onAbort, { once: true });
    promise.then(() => finish(true), () => finish(true));
  });
}
