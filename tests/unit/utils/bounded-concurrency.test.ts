import { describe, it, expect, vi } from 'vitest';
import { forEachBounded } from '../../../src/utils/bounded-concurrency.js';

/** Records how many calls were in flight at the same time. */
function makeTracker() {
  let inFlight = 0;
  let peak = 0;
  const release: Array<() => void> = [];
  const fn = vi.fn(async () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise<void>((resolve) => release.push(resolve));
    inFlight--;
  });
  const releaseAll = () => {
    while (release.length > 0) release.shift()!();
  };
  return { fn, releaseAll, peak: () => peak };
}

describe('forEachBounded', () => {
  it('does nothing for an empty list', async () => {
    const fn = vi.fn(async () => {});
    await forEachBounded([], 8, fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it('visits every item exactly once, with its index', async () => {
    const seen: Array<[string, number]> = [];
    await forEachBounded(['a', 'b', 'c', 'd', 'e'], 2, async (item, index) => {
      seen.push([item, index]);
    });
    expect(seen.sort((l, r) => l[1] - r[1])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
      ['d', 3],
      ['e', 4],
    ]);
  });

  it('keeps at most `limit` calls in flight', async () => {
    const items = Array.from({ length: 500 }, (_, i) => i);
    let inFlight = 0;
    let peak = 0;
    const fn = vi.fn(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setImmediate(resolve));
      inFlight--;
    });

    await forEachBounded(items, 4, fn);

    expect(fn).toHaveBeenCalledTimes(500);
    expect(peak).toBe(4);
  });

  it('never starts more workers than there are items', async () => {
    const { fn, releaseAll, peak } = makeTracker();
    const done = forEachBounded([1, 2], 32, fn);
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
    releaseAll();
    await done;
    expect(peak()).toBe(2);
  });

  it.each([0, -1, 0.5, Number.NaN])('treats limit %s as sequential', async (limit) => {
    const { fn, releaseAll, peak } = makeTracker();
    const done = forEachBounded([1, 2, 3], limit, fn);
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    expect(peak()).toBe(1);
    releaseAll();
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
    releaseAll();
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(3));
    releaseAll();
    await done;
    expect(peak()).toBe(1);
  });

  it('propagates a rejection from the callback', async () => {
    const boom = new Error('boom');
    await expect(
      forEachBounded([1, 2, 3], 2, async (item) => {
        if (item === 2) throw boom;
      }),
    ).rejects.toBe(boom);
  });
});
