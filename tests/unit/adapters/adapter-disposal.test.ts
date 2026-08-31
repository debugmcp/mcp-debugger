import { describe, expect, it, vi } from 'vitest';
import type { IDebugAdapter } from '@debugmcp/shared';
import { disposeAdapterSafely } from '../../../src/adapters/adapter-disposal.js';

describe('disposeAdapterSafely', () => {
  it.each([
    ['synchronous throw', () => { throw new Error('sync dispose failure'); }],
    ['asynchronous rejection', () => Promise.reject(new Error('async dispose failure'))]
  ])('reports a %s and resolves', async (_label, dispose) => {
    const reporter = vi.fn();
    const adapter = { dispose } as unknown as IDebugAdapter;

    await expect(disposeAdapterSafely(adapter, reporter)).resolves.toBeUndefined();

    expect(reporter).toHaveBeenCalledWith(expect.any(Error));
  });

  it('remains total when the reporter itself throws', async () => {
    const adapter = {
      dispose: () => { throw new Error('dispose failed'); }
    } as unknown as IDebugAdapter;

    await expect(
      disposeAdapterSafely(adapter, () => { throw new Error('reporter failed'); })
    ).resolves.toBeUndefined();
  });
});
