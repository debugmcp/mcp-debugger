import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialStartupGate } from '../../../tools/dev-proxy/initial-startup.mjs';

afterEach(() => vi.useRealTimers());

describe('dev-proxy initial startup wait', () => {
  it('releases concurrent discovery requests when startup settles and clears its timer', async () => {
    vi.useFakeTimers();
    const gate = createInitialStartupGate(30000);
    const requests = [gate.ready.then(vi.fn()), gate.ready.then(vi.fn())];
    gate.complete();
    await expect(gate.ready).resolves.toBe(true);
    await Promise.all(requests);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds a hung startup once, so later discovery requests do not wait again', async () => {
    vi.useFakeTimers();
    const gate = createInitialStartupGate(30000);
    const settled = vi.fn();
    void gate.ready.then(settled);
    await vi.advanceTimersByTimeAsync(29999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(gate.ready).resolves.toBe(false);
    await expect(gate.ready).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    // Late success is allowed and cannot change an already fulfilled wait.
    gate.complete();
    await expect(gate.ready).resolves.toBe(false);
  });
});
