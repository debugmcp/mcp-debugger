import { afterEach, describe, expect, it, vi } from 'vitest';
import { LifecycleQueue } from '../../../tools/dev-proxy/lifecycle-queue.mjs';

afterEach(() => vi.useRealTimers());

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

describe('dev-proxy LifecycleQueue.idle (issue #716)', () => {
  it('resolves at once when nothing is queued', async () => {
    await expect(new LifecycleQueue().idle({ timeoutMs: 30000 })).resolves.toBe(true);
  });

  it('waits for an in-flight operation and clears its deadline timer', async () => {
    vi.useFakeTimers();
    const queue = new LifecycleQueue();
    let finish!: () => void;
    const running = queue.run(() => new Promise<void>((resolve) => { finish = resolve; }));
    const idle = queue.idle({ timeoutMs: 30000 });

    await vi.advanceTimersByTimeAsync(29000);
    finish();

    await expect(idle).resolves.toBe(true);
    await running;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('follows an operation queued while it is already waiting', async () => {
    const queue = new LifecycleQueue();
    let finishFirst!: () => void;
    const first = queue.run(() => new Promise<void>((resolve) => { finishFirst = resolve; }));
    const idle = queue.idle({ timeoutMs: 30000 });
    await vi.waitFor(() => expect(finishFirst).toBeTypeOf('function'));

    // Slow enough that an idle() which only awaited the tail it captured would
    // resolve while this is still running.
    let secondDone = false;
    const second = queue.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      secondDone = true;
    });
    finishFirst();

    await expect(idle).resolves.toBe(true);
    expect(secondDone).toBe(true);
    await Promise.all([first, second]);
  });

  it('gives up at the deadline, leaving no timer behind', async () => {
    vi.useFakeTimers();
    const queue = new LifecycleQueue();
    queue.run(() => new Promise<void>(() => {}));
    const idle = queue.idle({ timeoutMs: 15000 });

    await vi.advanceTimersByTimeAsync(14999);
    await vi.advanceTimersByTimeAsync(1);

    await expect(idle).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops waiting when the caller aborts, and never starts for an aborted signal', async () => {
    const queue = new LifecycleQueue();
    queue.run(() => new Promise<void>(() => {}));

    const controller = new AbortController();
    const idle = queue.idle({ timeoutMs: 30000, signal: controller.signal });
    controller.abort();
    await expect(idle).resolves.toBe(false);

    await expect(queue.idle({ timeoutMs: 30000, signal: controller.signal })).resolves.toBe(false);
  });
});
