/**
 * Deadline: the one primitive every bounded wait takes.
 *
 * The class of defect it removes: a loop that states a bound ("within N ms")
 * and checks it only between awaited steps, so a sleep, a probe or a request
 * in flight when the time runs out keeps the caller waiting past the bound.
 * A loop built on a Deadline cannot do that: its sleeps end at the deadline,
 * its requests are given the time that remains, and what is still in flight
 * is abandoned at a fixed boundary. The plumbing is written, and tested, once.
 *
 * Two boundaries:
 *
 * - The nominal deadline, `budgetMs` after creation. From here no new work
 *   starts (`request` refuses, `sleep` answers `'expired'` at once), every
 *   outstanding `sleep` answers `'expired'`, every outstanding `race`
 *   rejects, and `signal` aborts. This is the "within N ms" an answer states.
 * - The backstop, the nominal deadline plus `PARENT_GRACE_MS` (250 ms, the
 *   grace #1213 measured for a worker's answer to cross IPC). Work started
 *   through `request` before the nominal deadline (a DAP request already
 *   sent, a probe already open) may still answer until here, so its own
 *   timeout diagnostics win; at the backstop it is abandoned: its promise
 *   rejects, its `abandoned` signal aborts (the sender removes its pending
 *   entry there) and a later answer is dropped.
 *
 * Cancellation from outside (the parent deadline is cancelled or disposed,
 * or an `AbortSignal` passed as the parent aborts) and `dispose()` end both
 * boundaries at once: requests are abandoned without waiting for the grace.
 * The parent's own expiry is not a cancellation: it reaches a child as the
 * child's own expiry (a child never outlives its parent's nominal deadline),
 * so a request sent under a child keeps its grace.
 *
 * What is released at which boundary:
 *
 * - at the nominal deadline: the expiry timer; each outstanding `sleep`'s
 *   timer and abort listener; each outstanding `race`'s listener; and, when
 *   no request is outstanding, the rest below as well;
 * - at the backstop (only when requests were outstanding at the nominal
 *   deadline): the backstop timer and each abandoned request's hold. The
 *   listener on an outside parent signal and the link to a parent deadline
 *   go when this deadline and every child under it have let go, so a child
 *   still inside its grace hears a cancellation from above;
 * - on `dispose()`, on cancellation from outside, or when the last
 *   outstanding request settles after the nominal deadline: all of it, at
 *   once, children included. `dispose()` on early completion is what leaves
 *   no timer behind.
 *
 * Promised: an answer within `budgetMs` plus the grace; no timer, listener or
 * hold of the deadline's own left after the backstop (or after `dispose`);
 * a late result never applied; `signal` aborted at the nominal deadline or
 * with its parent. Not promised: that the work under it stops. A callee that
 * ignores its timeout and its `abandoned` signal is still abandoned (the
 * caller is answered), but what it opened is its own to release.
 *
 * Details the contract settles:
 *
 * - A budget of zero or less makes a deadline that is born expired: nothing
 *   is armed, `request` refuses, `sleep` answers `'expired'`. A budget that is
 *   not a finite number, or that exceeds the largest timer delay (2^31 - 1
 *   ms), is a RangeError: a NaN or an overflowing timer would fire at once.
 *   `invalidDeadlineBudget()` states that rule, so a caller can refuse a bad
 *   bound before it does anything the deadline would have had to cover.
 * - Expiry is observed as well as scheduled: `remaining()` and `expired`
 *   read the clock, and a reading at or past the deadline expires it on the
 *   spot, so `expired`, `signal.aborted` and `remaining() === 0` always agree
 *   even when the event loop is late to run the expiry timer.
 * - `dispose()` aborts `signal` too (with the reason `disposed`) and ends the
 *   deadline: an outstanding `sleep` answers `'expired'`, an outstanding
 *   `race` rejects, an outstanding `request` is abandoned. Everything
 *   started under a deadline ends with it.
 * - `deadline(n, { parent: d })` is `d.child(n)`; the child runs on its
 *   parent's clock. A child whose cap reaches its parent's deadline arms no
 *   timer of its own: the parent's expiry is its expiry.
 * - `request` gives `send` the time that remains rounded up to a whole
 *   millisecond (at least 1), which is what a DAP or socket timeout takes.
 */

/** The grace a request already sent has to answer after the nominal deadline (#1213's figure). */
export const PARENT_GRACE_MS = 250;

/** The largest delay a Node timer honours; a longer one fires at once. */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

/**
 * Why `budgetMs` cannot be the budget of a `deadline()`, or undefined when it
 * can (zero and negative can: such a deadline is born expired). The one rule
 * the constructor applies, exported so a caller can refuse a bad bound before
 * it does anything the deadline would then have to cover.
 */
export function invalidDeadlineBudget(budgetMs: unknown): string | undefined {
  if (typeof budgetMs !== 'number' || Number.isNaN(budgetMs)) {
    return `the budget must be a number of milliseconds (got ${String(budgetMs)})`;
  }
  if (!Number.isFinite(budgetMs) || budgetMs > MAX_TIMER_DELAY_MS) {
    return `the budget must be finite and at most ${MAX_TIMER_DELAY_MS} ms (got ${budgetMs})`;
  }
  return undefined;
}

/**
 * Time and timers from one source. The default reads `performance.now()`
 * (monotonic within one process, unlike `Date.now()`) and uses the global
 * timers, both looked up at call time so a fake-timer test fakes them
 * together. Across IPC no time point travels: only `remaining()` does.
 */
export interface MonotonicClock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const systemClock: MonotonicClock = {
  now: () => performance.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
};

/**
 * Why a deadline ended, or abandoned a request: `budget` at the nominal
 * deadline, `backstop` for a request still unanswered at the backstop,
 * `cancelled` from outside, `disposed` by its owner.
 */
export type DeadlineEnd = 'budget' | 'backstop' | 'cancelled' | 'disposed';

/** The rejection of `race` and `request`, and the reason `signal` aborts with. */
export class DeadlineExpired extends Error {
  constructor(
    readonly why: DeadlineEnd,
    readonly budgetMs: number,
    readonly label?: string
  ) {
    super(describeEnd(why, budgetMs, label));
    this.name = 'DeadlineExpired';
  }
}

function describeEnd(why: DeadlineEnd, budgetMs: number, label: string | undefined): string {
  const what = label ?? 'deadline';
  switch (why) {
    case 'budget':
      return `${what}: the ${budgetMs} ms deadline passed`;
    case 'backstop':
      return `${what}: no answer within the ${budgetMs} ms deadline and its ${PARENT_GRACE_MS} ms grace`;
    case 'cancelled':
      return `${what}: cancelled`;
    case 'disposed':
      return `${what}: abandoned (its deadline was disposed)`;
  }
}

export interface Deadline extends Disposable {
  /** The "within N ms" an answer may state. A child's is what it was given: min(cap, its parent's remaining time). */
  readonly budgetMs: number;
  readonly label: string | undefined;
  /** Aborts at the nominal deadline, with the parent, or on dispose; its reason is a DeadlineExpired. */
  readonly signal: AbortSignal;
  /** True once the deadline has ended, for any reason. */
  readonly expired: boolean;
  /** Milliseconds to the nominal deadline; 0 once it has ended. */
  remaining(): number;
  /** A deadline of min(capMs, remaining()); the one way to sub-budget. */
  child(capMs?: number, label?: string): Deadline;
  /** Never throws; ends at `ms` or at the deadline, whichever comes first, and leaves no timer either way. */
  sleep(ms: number): Promise<'slept' | 'expired'>;
  /**
   * For a wait on something this deadline did not start: settles with `work`,
   * or rejects with a DeadlineExpired at the nominal deadline. A late result
   * is swallowed, a late rejection included.
   */
  race<T>(work: Promise<T>): Promise<T>;
  /**
   * For work this deadline starts: `send` is called only if time remains,
   * with that time (whole ms, at least 1) and a signal that aborts if the
   * work is abandoned. Settles with the work, or rejects with a
   * DeadlineExpired at the backstop or on cancellation; a late result is
   * swallowed. Refuses (rejects at once, `send` not called) once expired.
   */
  request<T>(send: (timeoutMs: number, abandoned: AbortSignal) => Promise<T>): Promise<T>;
  /** Idempotent; ends the deadline and releases everything it holds, children included. */
  dispose(): void;
}

export interface DeadlineOptions {
  /** A parent Deadline (this becomes its child) or an AbortSignal whose abort cancels this one. */
  parent?: Deadline | AbortSignal;
  clock?: MonotonicClock;
  /** Names the deadline in its DeadlineExpired messages. */
  label?: string;
}

interface Hold {
  abandon(reason: DeadlineExpired): void;
}

class DeadlineImpl implements Deadline {
  readonly budgetMs: number;
  readonly label: string | undefined;
  private readonly clock: MonotonicClock;
  private readonly controller = new AbortController();
  private readonly end: number;
  private readonly parentDeadline: DeadlineImpl | undefined;
  private parentSignal: AbortSignal | undefined;
  /** Children not yet let go; a child unlinks itself once it and its own children have. */
  private readonly children = new Set<DeadlineImpl>();
  /** Requests started through `request` and neither settled nor abandoned. */
  private readonly holds = new Set<Hold>();
  /** Why the nominal deadline ended; undefined while it runs. */
  private ended: Exclude<DeadlineEnd, 'backstop'> | undefined;
  /** This deadline's own timers and holds are let go. */
  private released = false;
  private expiryTimer: unknown;
  private backstopTimer: unknown;

  constructor(
    budgetMs: number,
    clock: MonotonicClock,
    label: string | undefined,
    parentDeadline?: DeadlineImpl,
    parentSignal?: AbortSignal
  ) {
    // A child's cap may be infinite (no cap); a root's budget follows the one rule.
    const invalid = parentDeadline
      ? (typeof budgetMs !== 'number' || Number.isNaN(budgetMs) ? invalidDeadlineBudget(budgetMs) : undefined)
      : invalidDeadlineBudget(budgetMs);
    if (invalid) {
      throw new RangeError(`deadline: ${invalid}`);
    }
    this.clock = clock;
    this.label = label;
    this.parentDeadline = parentDeadline;
    const granted = parentDeadline ? Math.min(budgetMs, parentDeadline.remaining()) : budgetMs;
    this.budgetMs = Math.max(0, granted);
    this.end = clock.now() + this.budgetMs;

    if (parentDeadline) {
      if (parentDeadline.ended !== undefined) {
        // Born under an ended parent: its expiry is this one's, its cancellation too.
        this.finish(parentDeadline.ended === 'budget' ? 'budget' : 'cancelled');
        return;
      }
      parentDeadline.children.add(this);
    }
    if (parentSignal) {
      if (parentSignal.aborted) {
        this.finish('cancelled');
        return;
      }
      this.parentSignal = parentSignal;
      parentSignal.addEventListener('abort', this.onParentSignal, { once: true });
    }
    if (this.budgetMs <= 0) {
      this.finish('budget');
      return;
    }
    // A child that ends with its parent needs no timer: the parent's expiry reaches it.
    if (!parentDeadline || this.end < parentDeadline.end) {
      this.expiryTimer = clock.setTimeout(() => {
        this.expiryTimer = undefined;
        this.finish('budget');
      }, this.budgetMs);
    }
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get expired(): boolean {
    if (this.ended === undefined) {
      this.observe();
    }
    return this.ended !== undefined;
  }

  remaining(): number {
    if (this.ended !== undefined) {
      return 0;
    }
    const left = this.observe();
    return this.ended !== undefined ? 0 : left;
  }

  child(capMs?: number, label?: string): Deadline {
    return new DeadlineImpl(capMs ?? Number.POSITIVE_INFINITY, this.clock, label ?? this.label, this);
  }

  sleep(ms: number): Promise<'slept' | 'expired'> {
    if (this.expired) {
      return Promise.resolve('expired');
    }
    const delay = Number.isNaN(ms) ? 0 : Math.max(0, ms);
    return new Promise((resolve) => {
      let timer: unknown;
      const onEnd = (): void => {
        if (timer !== undefined) {
          this.clock.clearTimeout(timer);
          timer = undefined;
        }
        resolve('expired');
      };
      // A sleep that would reach the deadline is the deadline's: no timer of its own.
      if (delay < this.remaining()) {
        timer = this.clock.setTimeout(() => {
          timer = undefined;
          this.signal.removeEventListener('abort', onEnd);
          resolve(this.expired ? 'expired' : 'slept');
        }, delay);
      }
      if (this.ended !== undefined) {
        onEnd();
        return;
      }
      this.signal.addEventListener('abort', onEnd, { once: true });
    });
  }

  race<T>(work: Promise<T>): Promise<T> {
    if (this.expired) {
      Promise.resolve(work).then(undefined, () => {});
      return Promise.reject(this.signal.reason as DeadlineExpired);
    }
    return new Promise<T>((resolve, reject) => {
      const onEnd = (): void => reject(this.signal.reason as DeadlineExpired);
      this.signal.addEventListener('abort', onEnd, { once: true });
      Promise.resolve(work).then(
        (value) => {
          this.signal.removeEventListener('abort', onEnd);
          resolve(value);
        },
        (error: unknown) => {
          this.signal.removeEventListener('abort', onEnd);
          reject(error);
        }
      );
    });
  }

  request<T>(send: (timeoutMs: number, abandoned: AbortSignal) => Promise<T>): Promise<T> {
    if (this.expired) {
      return Promise.reject(this.signal.reason as DeadlineExpired);
    }
    const timeoutMs = Math.max(1, Math.ceil(this.remaining()));
    const abandoned = new AbortController();
    let resolveOuter!: (value: T) => void;
    let rejectOuter!: (reason: unknown) => void;
    const outer = new Promise<T>((resolve, reject) => {
      resolveOuter = resolve;
      rejectOuter = reject;
    });
    const hold: Hold = {
      abandon: (reason) => {
        abandoned.abort(reason);
        rejectOuter(reason);
      }
    };
    // Held before it is sent, so an expiry that `send` itself observes still arms the backstop.
    this.holds.add(hold);
    const settled = (): boolean => {
      if (!this.holds.delete(hold)) {
        return false; // abandoned already: the late result is swallowed
      }
      if (this.ended !== undefined && this.holds.size === 0) {
        this.release();
      }
      return true;
    };
    let work: Promise<T>;
    try {
      work = Promise.resolve(send(timeoutMs, abandoned.signal));
    } catch (error) {
      if (settled()) rejectOuter(error);
      return outer;
    }
    work.then(
      (value) => {
        if (settled()) resolveOuter(value);
      },
      (error: unknown) => {
        if (settled()) rejectOuter(error);
      }
    );
    return outer;
  }

  dispose(): void {
    this.cancel('disposed');
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  /** Read the clock; expire on the spot when it says the time is up. */
  private observe(): number {
    const left = this.end - this.clock.now();
    if (left <= 0) {
      this.finish('budget');
      return 0;
    }
    return left;
  }

  private readonly onParentSignal = (): void => {
    this.parentSignal = undefined;
    this.cancel('cancelled');
  };

  /** The nominal end: abort the signal, end the children the same way, and hold only what was sent. */
  private finish(why: Exclude<DeadlineEnd, 'backstop'>): void {
    if (this.ended !== undefined) {
      return;
    }
    this.ended = why;
    if (this.expiryTimer !== undefined) {
      this.clock.clearTimeout(this.expiryTimer);
      this.expiryTimer = undefined;
    }
    const reason = new DeadlineExpired(why, this.budgetMs, this.label);
    this.controller.abort(reason);
    if (why !== 'budget') {
      for (const child of [...this.children]) {
        child.cancel('cancelled');
      }
      this.abandonAll(reason);
      this.release();
      return;
    }
    // The parent's expiry is the child's own expiry, grace included.
    for (const child of [...this.children]) {
      child.finish('budget');
    }
    if (this.holds.size === 0) {
      this.release();
      return;
    }
    const untilBackstop = Math.max(0, this.end + PARENT_GRACE_MS - this.clock.now());
    this.backstopTimer = this.clock.setTimeout(() => {
      this.backstopTimer = undefined;
      this.abandonAll(new DeadlineExpired('backstop', this.budgetMs, this.label));
      this.release();
    }, untilBackstop);
  }

  /** Cancellation from outside, or dispose: both boundaries end now, for this deadline and its children. */
  private cancel(why: 'cancelled' | 'disposed'): void {
    if (this.ended === undefined) {
      this.finish(why);
      return;
    }
    for (const child of [...this.children]) {
      child.cancel('cancelled');
    }
    if (!this.released) {
      this.abandonAll(new DeadlineExpired(why, this.budgetMs, this.label));
      this.release();
    }
  }

  private abandonAll(reason: DeadlineExpired): void {
    const holds = [...this.holds];
    this.holds.clear();
    for (const hold of holds) {
      hold.abandon(reason);
    }
  }

  /** Let go of this deadline's own timers; its links go once its children have let go of theirs. */
  private release(): void {
    if (this.released) {
      return;
    }
    this.released = true;
    if (this.expiryTimer !== undefined) {
      this.clock.clearTimeout(this.expiryTimer);
      this.expiryTimer = undefined;
    }
    if (this.backstopTimer !== undefined) {
      this.clock.clearTimeout(this.backstopTimer);
      this.backstopTimer = undefined;
    }
    this.unlinkIfIdle();
  }

  /**
   * Drop the listener on an outside parent signal and the link to a parent
   * deadline once nothing under this deadline can still be cancelled: a
   * child inside its grace must still hear a cancellation from above.
   */
  private unlinkIfIdle(): void {
    if (!this.released || this.children.size > 0) {
      return;
    }
    if (this.parentSignal) {
      this.parentSignal.removeEventListener('abort', this.onParentSignal);
      this.parentSignal = undefined;
    }
    const parent = this.parentDeadline;
    if (parent && parent.children.delete(this)) {
      parent.unlinkIfIdle();
    }
  }
}

/**
 * A deadline `budgetMs` from now. With a Deadline as `parent` it is
 * `parent.child(budgetMs)`: the smaller of the two, on the parent's clock.
 * With an AbortSignal, that signal's abort cancels it.
 */
export function deadline(budgetMs: number, opts: DeadlineOptions = {}): Deadline {
  const { parent, clock, label } = opts;
  if (parent !== undefined && typeof (parent as Deadline).child === 'function') {
    return (parent as Deadline).child(budgetMs, label);
  }
  return new DeadlineImpl(budgetMs, clock ?? systemClock, label, undefined, parent as AbortSignal | undefined);
}
