/**
 * The Deadline primitive: its two boundaries, what it releases at
 * each, and the ways to break it.
 *
 * Every case runs on a fake monotonic clock: vitest's fake timers fake
 * `performance.now()` together with the timers, which is what the default
 * clock reads; one case injects a clock of its own.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  deadline,
  DeadlineExpired,
  PARENT_GRACE_MS,
  type Deadline,
  type MonotonicClock
} from '@debugmcp/shared';

const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown): void => { unhandled.push(reason); };

beforeEach(() => {
  vi.useFakeTimers();
  unhandled.length = 0;
  process.on('unhandledRejection', onUnhandled);
});

afterEach(async () => {
  vi.useRealTimers();
  // Let any rejection nobody handled surface before the check.
  await new Promise((resolve) => setImmediate(resolve));
  process.off('unhandledRejection', onUnhandled);
  expect(unhandled).toEqual([]);
});

/** How a promise settled, observed without consuming it twice. */
function watch<T>(promise: Promise<T>): { state: 'pending' | 'resolved' | 'rejected'; value?: T; error?: unknown; at?: number } {
  const started = performance.now();
  const outcome: { state: 'pending' | 'resolved' | 'rejected'; value?: T; error?: unknown; at?: number } = { state: 'pending' };
  promise.then(
    (value) => { outcome.state = 'resolved'; outcome.value = value; outcome.at = performance.now() - started; },
    (error: unknown) => { outcome.state = 'rejected'; outcome.error = error; outcome.at = performance.now() - started; }
  );
  return outcome;
}

/** A promise settled from outside. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const why = (error: unknown): string | undefined => (error instanceof DeadlineExpired ? error.why : undefined);

describe('the nominal deadline', () => {
  it('sleep answers "expired" at the deadline, not at the end of its own interval', async () => {
    const d = deadline(1000);
    const sleep = watch(d.sleep(5000));

    await vi.advanceTimersByTimeAsync(500);
    // A sleep that reaches the deadline is the deadline's: no timer of its own.
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(499);
    expect(sleep.state).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(sleep).toMatchObject({ state: 'resolved', value: 'expired', at: 1000 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('sleep answers "slept" when its interval ends first, and leaves only the deadline\'s own timer', async () => {
    const d = deadline(1000);
    const sleep = watch(d.sleep(100));

    await vi.advanceTimersByTimeAsync(100);
    expect(sleep).toMatchObject({ state: 'resolved', value: 'slept', at: 100 });
    expect(vi.getTimerCount()).toBe(1);
    d.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a sleep exactly as long as what remains is the deadline\'s: it answers "expired"', async () => {
    const d = deadline(300);
    await vi.advanceTimersByTimeAsync(200);
    const sleep = watch(d.sleep(100));

    await vi.advanceTimersByTimeAsync(100);
    expect(sleep).toMatchObject({ state: 'resolved', value: 'expired' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('signal aborts at the deadline with a DeadlineExpired naming the budget', async () => {
    const d = deadline(1000, { label: 'stack readiness' });
    const onAbort = vi.fn();
    d.signal.addEventListener('abort', onAbort);

    await vi.advanceTimersByTimeAsync(999);
    expect(d.signal.aborted).toBe(false);
    expect(d.expired).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(onAbort).toHaveBeenCalledOnce();
    expect(d.expired).toBe(true);
    expect(d.remaining()).toBe(0);
    expect(d.signal.reason).toBeInstanceOf(DeadlineExpired);
    expect((d.signal.reason as DeadlineExpired).why).toBe('budget');
    expect((d.signal.reason as DeadlineExpired).message).toBe('stack readiness: the 1000 ms deadline passed');
  });

  it('remaining() counts down and is 0 once expired', async () => {
    const d = deadline(1000);
    expect(d.remaining()).toBe(1000);
    await vi.advanceTimersByTimeAsync(400);
    expect(d.remaining()).toBe(600);
    await vi.advanceTimersByTimeAsync(600);
    expect(d.remaining()).toBe(0);
  });

  it('race rejects at the deadline, and the late result, value or rejection, is swallowed', async () => {
    const d = deadline(500);
    const lateValue = deferred<string>();
    const lateError = deferred<string>();
    const a = watch(d.race(lateValue.promise));
    const b = watch(d.race(lateError.promise));

    await vi.advanceTimersByTimeAsync(500);
    expect(a.state).toBe('rejected');
    expect(why(a.error)).toBe('budget');
    expect(b.state).toBe('rejected');

    lateValue.resolve('late');
    lateError.reject(new Error('late failure'));
    await vi.advanceTimersByTimeAsync(10);
    expect(a.state).toBe('rejected');
    expect(why(b.error)).toBe('budget');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('race settles with its work inside the deadline, and removes its listener', async () => {
    const d = deadline(500);
    const remove = vi.spyOn(d.signal, 'removeEventListener');
    const work = deferred<number>();
    const r = watch(d.race(work.promise));
    work.resolve(7);
    await vi.advanceTimersByTimeAsync(0);

    expect(r).toMatchObject({ state: 'resolved', value: 7 });
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    d.dispose();
  });

  it('race on an expired deadline rejects at once and still swallows the work\'s rejection', async () => {
    const d = deadline(0);
    const work = deferred<number>();
    const r = watch(d.race(work.promise));
    await vi.advanceTimersByTimeAsync(0);
    expect(r.state).toBe('rejected');
    work.reject(new Error('nobody listens'));
  });

  it('expiry is observed as well as scheduled: a clock past the deadline expires it before any timer runs', () => {
    let now = 0;
    const timers: Array<() => void> = [];
    const clock: MonotonicClock = {
      now: () => now,
      setTimeout: (callback) => { timers.push(callback); return timers.length; },
      clearTimeout: () => {}
    };
    const d = deadline(100, { clock });
    now = 99;
    expect(d.expired).toBe(false);
    expect(d.signal.aborted).toBe(false);
    now = 100;
    // No timer has run; reading the clock is enough.
    expect(d.remaining()).toBe(0);
    expect(d.expired).toBe(true);
    expect(d.signal.aborted).toBe(true);
  });

  it('a sleep whose timer runs late, past the deadline, answers "expired"', async () => {
    let now = 0;
    const timers: Array<{ ms: number; callback: () => void }> = [];
    const clock: MonotonicClock = {
      now: () => now,
      setTimeout: (callback, ms) => { timers.push({ ms, callback }); return timers.length; },
      clearTimeout: () => {}
    };
    const d = deadline(100, { clock });
    const sleep = d.sleep(50);
    // The event loop was busy: the sleep's 50 ms timer runs at 120 ms.
    now = 120;
    timers.find((timer) => timer.ms === 50)!.callback();
    expect(await sleep).toBe('expired');
  });
});

describe('budgets that are not ordinary', () => {
  it.each([0, -5])('a budget of %d ms is born expired and arms nothing', async (budget) => {
    const d = deadline(budget);
    expect(vi.getTimerCount()).toBe(0);
    expect(d.signal.aborted).toBe(true);
    expect(d.expired).toBe(true);
    expect(d.signal.aborted).toBe(true);
    expect(d.remaining()).toBe(0);
    expect(d.budgetMs).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(await d.sleep(10)).toBe('expired');
    const send = vi.fn(async () => 'sent');
    await expect(d.request(send)).rejects.toBeInstanceOf(DeadlineExpired);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 2 ** 31])('refuses a budget of %d ms', (budget) => {
    expect(() => deadline(budget)).toThrow(RangeError);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('refuses a child cap that is not a number, and takes an infinite one as no cap', () => {
    const parent = deadline(1000);
    expect(() => parent.child(Number.NaN)).toThrow(RangeError);
    expect(parent.child(Number.POSITIVE_INFINITY).budgetMs).toBe(1000);
    parent.dispose();
  });

  it('dispose twice is dispose once', () => {
    const d = deadline(1000);
    d.dispose();
    expect(() => d.dispose()).not.toThrow();
    expect(d.expired).toBe(true);
    expect((d.signal.reason as DeadlineExpired).why).toBe('disposed');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('[Symbol.dispose] is dispose', () => {
    const d = deadline(1000);
    d[Symbol.dispose]();
    expect(d.expired).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('dispose after early completion leaves no timer', async () => {
    const d = deadline(30_000);
    expect(vi.getTimerCount()).toBe(1);
    expect(await watchAsync(d.request(async () => 'done'))).toBe('done');
    d.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});

async function watchAsync<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(0);
  return promise;
}

describe('children', () => {
  it('a child takes the smaller of its cap and what its parent has left', async () => {
    const parent = deadline(1000);
    await vi.advanceTimersByTimeAsync(300);
    expect(parent.child(200).budgetMs).toBe(200);
    expect(parent.child(5000).budgetMs).toBe(700);
    expect(parent.child().budgetMs).toBe(700);
    expect(deadline(5000, { parent }).budgetMs).toBe(700);
    parent.dispose();
  });

  it('a capped child expires at its cap and the parent runs on', async () => {
    const parent = deadline(1000);
    const child = parent.child(200);
    const sleep = watch(child.sleep(10_000));
    await vi.advanceTimersByTimeAsync(200);
    // Its own timer ends what waits on it, before anyone reads its clock.
    expect(sleep).toMatchObject({ state: 'resolved', value: 'expired', at: 200 });
    expect(child.expired).toBe(true);
    expect(parent.expired).toBe(false);
    parent.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a child expires with its parent, as its own expiry', async () => {
    const parent = deadline(500);
    const child = parent.child(5000);
    // The child ends with its parent: it arms no timer of its own.
    expect(vi.getTimerCount()).toBe(1);
    const sleep = watch(child.sleep(10_000));
    await vi.advanceTimersByTimeAsync(500);
    expect(child.expired).toBe(true);
    expect(why(child.signal.reason)).toBe('budget');
    expect(sleep).toMatchObject({ state: 'resolved', value: 'expired', at: 500 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a child of a cancelled or disposed parent is cancelled, at once', () => {
    const controller = new AbortController();
    const parent = deadline(1000, { parent: controller.signal });
    const child = parent.child(500);
    controller.abort();
    expect(why(parent.signal.reason)).toBe('cancelled');
    expect(why(child.signal.reason)).toBe('cancelled');

    const owner = deadline(1000);
    const underOwner = owner.child();
    owner.dispose();
    expect(why(owner.signal.reason)).toBe('disposed');
    expect(why(underOwner.signal.reason)).toBe('cancelled');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a child made after its parent ended cannot outlive it', async () => {
    const parent = deadline(100);
    await vi.advanceTimersByTimeAsync(100);
    const late = parent.child(1000);
    expect(late.expired).toBe(true);
    expect(why(late.signal.reason)).toBe('budget');
    expect(vi.getTimerCount()).toBe(0);

    const disposed = deadline(100);
    disposed.dispose();
    expect(why(disposed.child(50).signal.reason)).toBe('cancelled');
  });

  it('an outstanding sleep and race end when their deadline is disposed', async () => {
    const d = deadline(1000);
    const sleep = watch(d.sleep(5000));
    const race = watch(d.race(new Promise(() => {})));
    d.dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(sleep).toMatchObject({ state: 'resolved', value: 'expired', at: 0 });
    expect(race.state).toBe('rejected');
    expect(why(race.error)).toBe('disposed');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('an outstanding sleep and race end when their parent aborts', async () => {
    const controller = new AbortController();
    const d = deadline(1000, { parent: controller.signal });
    const sleep = watch(d.sleep(5000));
    const race = watch(d.race(new Promise(() => {})));
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(sleep).toMatchObject({ state: 'resolved', value: 'expired', at: 100 });
    expect(why(race.error)).toBe('cancelled');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('an outstanding sleep and race under a child end when the parent deadline is disposed', async () => {
    const parent = deadline(1000);
    const child = parent.child(800);
    const sleep = watch(child.sleep(5000));
    const race = watch(child.race(new Promise(() => {})));
    parent.dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(sleep).toMatchObject({ state: 'resolved', value: 'expired' });
    expect(why(race.error)).toBe('cancelled');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('requests: the backstop', () => {
  it('gives send what remains, and refuses once expired', async () => {
    const d = deadline(1000);
    await vi.advanceTimersByTimeAsync(250);
    const send = vi.fn(async (timeoutMs: number) => timeoutMs);
    expect(await watchAsync(d.request(send))).toBe(750);
    await vi.advanceTimersByTimeAsync(750);
    const after = vi.fn(async () => 0);
    await expect(d.request(after)).rejects.toBeInstanceOf(DeadlineExpired);
    expect(after).not.toHaveBeenCalled();
  });

  it('rounds what remains up to a whole millisecond, never below 1', async () => {
    let now = 0;
    const clock: MonotonicClock = { now: () => now, setTimeout: () => 0, clearTimeout: () => {} };
    const d = deadline(1000, { clock });
    now = 0.4;
    expect(await d.request(async (timeoutMs) => timeoutMs)).toBe(1000);
    now = 999.9;
    expect(await d.request(async (timeoutMs) => timeoutMs)).toBe(1);
    d.dispose();
  });

  it('an answer at budget + 100 ms wins', async () => {
    const d = deadline(1000);
    const answer = deferred<string>();
    const r = watch(d.request(() => answer.promise));

    await vi.advanceTimersByTimeAsync(1100);
    expect(d.expired).toBe(true);
    expect(r.state).toBe('pending');
    answer.resolve('the worker\'s answer');
    await vi.advanceTimersByTimeAsync(0);
    expect(r).toMatchObject({ state: 'resolved', value: 'the worker\'s answer' });
    // The last outstanding request settled: the backstop timer goes with it.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a worker\'s failure inside the grace wins too, so its own diagnostics reach the caller', async () => {
    const d = deadline(1000);
    const answer = deferred<string>();
    const r = watch(d.request(() => answer.promise));
    await vi.advanceTimersByTimeAsync(1001);
    answer.reject(new Error("Request 'stackTrace' timed out after 1000ms"));
    await vi.advanceTimersByTimeAsync(0);
    expect(r.state).toBe('rejected');
    expect((r.error as Error).message).toBe("Request 'stackTrace' timed out after 1000ms");
  });

  it('no answer through budget + 250 ms: abandoned at the backstop, nothing left, the late answer dropped', async () => {
    const d = deadline(1000, { label: 'probe' });
    const answer = deferred<string>();
    let abandoned: AbortSignal | undefined;
    const r = watch(d.request((_t, signal) => { abandoned = signal; return answer.promise; }));

    await vi.advanceTimersByTimeAsync(1000 + PARENT_GRACE_MS - 1);
    expect(r.state).toBe('pending');
    expect(abandoned!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(r.state).toBe('rejected');
    expect(r.at).toBe(1000 + PARENT_GRACE_MS);
    expect(why(r.error)).toBe('backstop');
    expect((r.error as Error).message).toBe('probe: no answer within the 1000 ms deadline and its 250 ms grace');
    expect(abandoned!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    answer.resolve('too late');
    await vi.advanceTimersByTimeAsync(0);
    expect(why(r.error)).toBe('backstop');
  });

  it('a callee that ignores its timeout and its signal is still abandoned at the backstop', async () => {
    const d = deadline(200);
    const r = watch(d.request(() => new Promise(() => {})));
    await vi.advanceTimersByTimeAsync(200 + PARENT_GRACE_MS);
    expect(r).toMatchObject({ state: 'rejected', at: 200 + PARENT_GRACE_MS });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a late rejection after the backstop is swallowed', async () => {
    const d = deadline(100);
    const answer = deferred<string>();
    const r = watch(d.request(() => answer.promise));
    await vi.advanceTimersByTimeAsync(100 + PARENT_GRACE_MS);
    answer.reject(new Error('late failure'));
    await vi.advanceTimersByTimeAsync(0);
    expect(why(r.error)).toBe('backstop');
  });

  it('an outside abort during the grace abandons the request at once', async () => {
    const controller = new AbortController();
    const d = deadline(1000, { parent: controller.signal });
    let abandoned: AbortSignal | undefined;
    const r = watch(d.request((_t, signal) => { abandoned = signal; return new Promise(() => {}); }));

    await vi.advanceTimersByTimeAsync(1050);
    expect(r.state).toBe('pending');
    controller.abort();
    expect(abandoned!.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(r).toMatchObject({ state: 'rejected', at: 1050 });
    expect(why(r.error)).toBe('cancelled');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('the parent deadline\'s dispose during a child\'s grace abandons the child\'s request at once', async () => {
    const parent = deadline(2000);
    const child = parent.child(1000);
    const r = watch(child.request(() => new Promise(() => {})));
    await vi.advanceTimersByTimeAsync(1100);
    expect(r.state).toBe('pending');
    parent.dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(r).toMatchObject({ state: 'rejected', at: 1100 });
    expect(why(r.error)).toBe('cancelled');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a request under a child that ends with its parent keeps the grace: an answer at budget + 100 ms wins', async () => {
    const parent = deadline(1000);
    const child = parent.child(5000);
    const answer = deferred<string>();
    const r = watch(child.request(() => answer.promise));
    await vi.advanceTimersByTimeAsync(1100);
    answer.resolve('in the grace');
    await vi.advanceTimersByTimeAsync(0);
    expect(r).toMatchObject({ state: 'resolved', value: 'in the grace' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('dispose during the grace abandons a request at once', async () => {
    const d = deadline(1000);
    const r = watch(d.request(() => new Promise(() => {})));
    await vi.advanceTimersByTimeAsync(1100);
    d.dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(r).toMatchObject({ state: 'rejected', at: 1100 });
    expect(why(r.error)).toBe('disposed');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('expiry while a request is wrapped in race: the race rejects at the deadline, the request keeps its grace', async () => {
    const d = deadline(1000);
    const answer = deferred<string>();
    let abandoned: AbortSignal | undefined;
    const request = d.request((_t, signal) => { abandoned = signal; return answer.promise; });
    const raced = watch(d.race(request));
    const direct = watch(request);

    await vi.advanceTimersByTimeAsync(1000);
    expect(raced).toMatchObject({ state: 'rejected', at: 1000 });
    expect(why(raced.error)).toBe('budget');
    expect(direct.state).toBe('pending');
    expect(abandoned!.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(PARENT_GRACE_MS);
    expect(why(direct.error)).toBe('backstop');
    expect(abandoned!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('expiry while a request is wrapped in race, then dispose: the request is abandoned at the dispose', async () => {
    const d = deadline(1000);
    let abandoned: AbortSignal | undefined;
    const request = d.request((_t, signal) => { abandoned = signal; return new Promise<string>(() => {}); });
    const raced = watch(d.race(request));
    await vi.advanceTimersByTimeAsync(1000);
    expect(raced.state).toBe('rejected');
    d.dispose();
    expect(abandoned!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('an outside abort reaches a child inside its grace when the parent holds nothing of its own', async () => {
    const outside = new AbortController();
    const parent = deadline(1000, { parent: outside.signal });
    const child = parent.child();
    let abandoned: AbortSignal | undefined;
    const r = watch(child.request((_t, signal) => { abandoned = signal; return new Promise(() => {}); }));
    await vi.advanceTimersByTimeAsync(1050);
    expect(r.state).toBe('pending');
    outside.abort();
    expect(abandoned!.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(r).toMatchObject({ state: 'rejected', at: 1050 });
    expect(why(r.error)).toBe('cancelled');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a send that reads the clock past the deadline still gets the grace, and the backstop', () => {
    let now = 0;
    const timers: Array<{ ms: number; callback: () => void }> = [];
    const clock: MonotonicClock = {
      now: () => now,
      setTimeout: (callback, ms) => { timers.push({ ms, callback }); return timers.length; },
      clearTimeout: () => {}
    };
    const d = deadline(100, { clock });
    let abandoned: AbortSignal | undefined;
    const r = watch(d.request((_t, signal) => {
      abandoned = signal;
      now = 100; // the deadline passes while the request is being sent
      d.remaining();
      return new Promise(() => {});
    }));
    expect(d.expired).toBe(true);
    const backstop = timers.find((timer) => timer.ms === PARENT_GRACE_MS);
    expect(backstop).toBeDefined();
    backstop!.callback();
    expect(abandoned!.aborted).toBe(true);
    return Promise.resolve().then(() => expect(why(r.error)).toBe('backstop'));
  });

  it('a send that throws rejects with what it threw and holds nothing', async () => {
    const d = deadline(1000);
    await expect(d.request(() => { throw new Error('not sent'); })).rejects.toThrow('not sent');
    await vi.advanceTimersByTimeAsync(1000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('the listener on an outside parent signal is removed at dispose and after the backstop', async () => {
    const early = new AbortController();
    const removeEarly = vi.spyOn(early.signal, 'removeEventListener');
    deadline(1000, { parent: early.signal }).dispose();
    expect(removeEarly).toHaveBeenCalledWith('abort', expect.any(Function));

    const late = new AbortController();
    const removeLate = vi.spyOn(late.signal, 'removeEventListener');
    const d = deadline(100, { parent: late.signal });
    const r = watch(d.request(() => new Promise(() => {})));
    await vi.advanceTimersByTimeAsync(100);
    // Inside the grace the outside signal can still cancel the request.
    expect(removeLate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(PARENT_GRACE_MS);
    expect(r.state).toBe('rejected');
    expect(removeLate).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('children let go of their parent once they are released', async () => {
    const parent = deadline(10_000) as Deadline & { children: Set<unknown> };
    for (let i = 0; i < 50; i++) {
      const child = parent.child(100);
      child.dispose();
    }
    const expiring = parent.child(100);
    await vi.advanceTimersByTimeAsync(100);
    expect(expiring.expired).toBe(true);
    expect(parent.children.size).toBe(0);
    parent.dispose();
  });
});

describe('the invariant', () => {
  it('expired, signal.aborted and remaining() === 0 agree at every step', async () => {
    const d = deadline(300);
    const agree = (): void => {
      const left = d.remaining();
      expect(d.expired).toBe(d.signal.aborted);
      expect(left === 0).toBe(d.expired);
    };
    for (let t = 0; t < 400; t += 50) {
      agree();
      await vi.advanceTimersByTimeAsync(50);
    }
    agree();
  });
});
