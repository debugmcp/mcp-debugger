import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JsDebugLaunchBarrier } from '../../../packages/adapter-javascript/src/utils/js-debug-launch-barrier.js';

const createLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
});

describe('JsDebugLaunchBarrier', () => {
  let logger: ReturnType<typeof createLogger>;

  beforeEach(() => {
    vi.useFakeTimers();
    logger = createLogger();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('resolves when a stopped event arrives', async () => {
    const barrier = new JsDebugLaunchBarrier(logger, 2000);
    const waitPromise = barrier.waitUntilReady();

    barrier.onDapEvent('stopped', undefined);

    await expect(waitPromise).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith('[JavascriptAdapter] js-debug launch confirmed by stopped event');
    barrier.dispose();
  });

  it('resolves shortly after adapter_connected status', async () => {
    const barrier = new JsDebugLaunchBarrier(logger, 2000);
    const waitPromise = barrier.waitUntilReady();

    barrier.onProxyStatus('adapter_connected');
    await vi.advanceTimersByTimeAsync(500);

    await expect(waitPromise).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith('[JavascriptAdapter] js-debug adapter connected; treating launch as ready');
    barrier.dispose();
  });

  it('resolves shortly after adapter_configured_and_launched (the child adoption, issue #704)', async () => {
    const barrier = new JsDebugLaunchBarrier(logger, 5000);
    const waitPromise = barrier.waitUntilReady();

    barrier.onProxyStatus('adapter_configured_and_launched');
    await vi.advanceTimersByTimeAsync(499);
    let settled = false;
    void waitPromise.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(waitPromise).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith(
      '[JavascriptAdapter] js-debug child adopted with no stop in flight; treating launch as ready'
    );
    barrier.dispose();
  });

  it('lets a stop that lands inside the adoption window win (issue #704)', async () => {
    const barrier = new JsDebugLaunchBarrier(logger, 5000);
    const waitPromise = barrier.waitUntilReady();

    barrier.onProxyStatus('adapter_configured_and_launched');
    await vi.advanceTimersByTimeAsync(20);
    barrier.onDapEvent('stopped', undefined);

    await expect(waitPromise).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith('[JavascriptAdapter] js-debug launch confirmed by stopped event');
    expect(logger.info).not.toHaveBeenCalledWith(
      '[JavascriptAdapter] js-debug child adopted with no stop in flight; treating launch as ready'
    );
    barrier.dispose();
  });

  it('ignores statuses that are not readiness signals', async () => {
    const barrier = new JsDebugLaunchBarrier(logger, 1000);
    const waitPromise = barrier.waitUntilReady();

    barrier.onProxyStatus('breakpoints_synced');
    await vi.advanceTimersByTimeAsync(600);
    let settled = false;
    void waitPromise.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(400);
    await expect(waitPromise).resolves.toBeUndefined();
    barrier.dispose();
  });

  it('falls back to timeout when no events arrive', async () => {
    const barrier = new JsDebugLaunchBarrier(logger, 1500);
    const waitPromise = barrier.waitUntilReady();

    await vi.advanceTimersByTimeAsync(1500);

    await expect(waitPromise).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith('[JavascriptAdapter] js-debug launch timeout after 1500ms, proceeding anyway');
    barrier.dispose();
  });

  it('rejects if proxy exits before readiness', async () => {
    const barrier = new JsDebugLaunchBarrier(logger, 5000);
    const waitPromise = barrier.waitUntilReady();

    barrier.onProxyExit(1, 'SIGTERM');

    await expect(waitPromise).rejects.toThrow(/Proxy exited before js-debug launch completed/);
    barrier.dispose();
  });

  it('resolves when a terminated event arrives (issue #242)', async () => {
    const barrier = new JsDebugLaunchBarrier(logger, 5000);
    const waitPromise = barrier.waitUntilReady();
    let state = 'pending';
    waitPromise.then(() => { state = 'resolved'; }, () => { state = 'rejected'; });

    barrier.onDapEvent('terminated', undefined);
    await vi.advanceTimersByTimeAsync(0);

    expect(state).toBe('resolved');
    await expect(waitPromise).resolves.toBeUndefined();
    barrier.dispose();
  });

  it('resolves when an exited event arrives (issue #242)', async () => {
    const barrier = new JsDebugLaunchBarrier(logger, 5000);
    const waitPromise = barrier.waitUntilReady();
    let state = 'pending';
    waitPromise.then(() => { state = 'resolved'; }, () => { state = 'rejected'; });

    barrier.onDapEvent('exited', { exitCode: 1 });
    await vi.advanceTimersByTimeAsync(0);

    expect(state).toBe('resolved');
    await expect(waitPromise).resolves.toBeUndefined();
    barrier.dispose();
  });

  it('rejects a still-pending wait when disposed before readiness (issue #242)', async () => {
    const barrier = new JsDebugLaunchBarrier(logger, 5000);
    const waitPromise = barrier.waitUntilReady();
    let state = 'pending';
    waitPromise.then(() => { state = 'resolved'; }, () => { state = 'rejected'; });

    barrier.dispose();
    await vi.advanceTimersByTimeAsync(0);

    expect(state).toBe('rejected');
    await expect(waitPromise).rejects.toThrow(/disposed before readiness/);
  });

  it('dispose after settlement does not reject the resolved wait', async () => {
    const barrier = new JsDebugLaunchBarrier(logger, 2000);
    const waitPromise = barrier.waitUntilReady();

    barrier.onDapEvent('stopped', undefined);
    await waitPromise;

    barrier.dispose();
    await expect(barrier.waitUntilReady()).resolves.toBeUndefined();
  });

  it('dispose is idempotent', async () => {
    const barrier = new JsDebugLaunchBarrier(logger, 5000);
    const waitPromise = barrier.waitUntilReady();

    barrier.dispose();
    barrier.dispose();

    await expect(waitPromise).rejects.toThrow(/disposed before readiness/);
  });

  it('does not produce an unhandled rejection when disposed without an awaiter', () => {
    // Mirrors the ProxyManager sendCommand-throw path: the barrier is disposed
    // before waitUntilReady() is ever awaited. Vitest fails the run on
    // unhandled rejections, so finishing cleanly is the assertion.
    const barrier = new JsDebugLaunchBarrier(logger, 5000);
    barrier.dispose();
  });

  it('ignores duplicate readiness signals after settlement', async () => {
    const barrier = new JsDebugLaunchBarrier(logger, 2000);
    const waitPromise = barrier.waitUntilReady();

    barrier.onDapEvent('stopped', undefined);
    await waitPromise;

    barrier.onProxyStatus('adapter_connected');
    barrier.onProxyExit(0, null);

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    barrier.dispose();
  });
});
