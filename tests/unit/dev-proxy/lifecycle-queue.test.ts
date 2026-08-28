import { describe, expect, it, vi } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain-JS module without type declarations
import { LifecycleQueue } from '../../../tools/dev-proxy/lifecycle-queue.mjs';

describe('dev-proxy LifecycleQueue', () => {
  it('serializes a restart submitted while initial startup is still running', async () => {
    const queue = new LifecycleQueue();
    const events: string[] = [];
    let finishStart!: () => void;
    const startGate = new Promise<void>((resolve) => { finishStart = resolve; });

    const start = queue.run(async () => {
      events.push('start:begin');
      await startGate;
      events.push('start:end');
    });
    const restart = queue.run(async () => {
      events.push('restart:begin');
      events.push('restart:end');
    });

    await vi.waitFor(() => expect(events).toEqual(['start:begin']));
    finishStart();
    await Promise.all([start, restart]);
    expect(events).toEqual(['start:begin', 'start:end', 'restart:begin', 'restart:end']);
  });

  it('continues with the next lifecycle operation after a failure', async () => {
    const queue = new LifecycleQueue();
    const failed = queue.run(async () => { throw new Error('startup failed'); });
    const recovered = queue.run(async () => 'restarted');

    await expect(failed).rejects.toThrow('startup failed');
    await expect(recovered).resolves.toBe('restarted');
  });
});
