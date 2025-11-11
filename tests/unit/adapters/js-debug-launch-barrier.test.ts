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

    barrier.onProxyStatus('adapter_connected', { status: 'adapter_connected' });
    await vi.advanceTimersByTimeAsync(500);

    await expect(waitPromise).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith('[JavascriptAdapter] js-debug adapter connected; treating launch as ready');
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

  it('ignores duplicate readiness signals after settlement', async () => {
    const barrier = new JsDebugLaunchBarrier(logger, 2000);
    const waitPromise = barrier.waitUntilReady();

    barrier.onDapEvent('stopped', undefined);
    await waitPromise;

    barrier.onProxyStatus('adapter_connected', {});
    barrier.onProxyExit(0, null);

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    barrier.dispose();
  });
});
