import { describe, it, expect } from 'vitest';
import { waitUntil } from '../../test-utils/helpers/test-utils.js';

describe('waitUntil', () => {
  it('resolves immediately when the condition is already true', async () => {
    let polls = 0;
    await waitUntil(() => {
      polls++;
      return true;
    }, { timeout: 200, interval: 10 });
    expect(polls).toBe(1); // checked once, no extra polling
  });

  it('resolves as soon as the condition flips true', async () => {
    let value = false;
    setTimeout(() => {
      value = true;
    }, 40);
    const start = Date.now();
    await waitUntil(() => value, { timeout: 1000, interval: 10 });
    // Returned well before the timeout, shortly after the flip.
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('supports async conditions', async () => {
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 30);
    await waitUntil(async () => ready, { timeout: 1000, interval: 10 });
    expect(ready).toBe(true);
  });

  it('rejects with a clear message on timeout', async () => {
    await expect(
      waitUntil(() => false, { timeout: 60, interval: 10, message: 'server to be ready' })
    ).rejects.toThrow(/Timeout after 60ms waiting for server to be ready/);
  });
});
