/**
 * The notification hub (issue #1025, step 2): one process-wide coalescer for
 * resources/updated pings and one fan-out point for resources/list_changed,
 * feeding however many protocol facades (or an HTTP handler's notifier) are
 * alive. Replaces the per-server OutputResourceNotifier, whose subscription
 * set and SDK Server were one object — a shape a per-request facade cannot
 * hold.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NotificationHub,
  OUTPUT_UPDATE_DEBOUNCE_MS,
  facadeSink,
  type NotificationSink
} from '../../../../src/server/notification-hub.js';
import { FacadeSubscriptions } from '../../../../src/server/output-resources.js';

const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
const URI = 'debug://sessions/sess-1/output';
const OTHER = 'debug://sessions/sess-2/output';

function fakeSink() {
  return {
    resourceUpdated: vi.fn<(uri: string) => void>(),
    resourcesChanged: vi.fn<() => void>(),
    forget: vi.fn<(uri: string) => void>()
  } satisfies NotificationSink;
}

describe('NotificationHub', () => {
  let hub: NotificationHub;

  beforeEach(() => {
    vi.useFakeTimers();
    hub = new NotificationHub(logger);
  });

  afterEach(() => {
    hub.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('coalesces a burst of updates for one URI into a single delivery per sink', async () => {
    const sink = fakeSink();
    hub.addSink(sink);

    for (let i = 0; i < 50; i++) {
      hub.resourceUpdated(URI);
    }
    expect(sink.resourceUpdated).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(OUTPUT_UPDATE_DEBOUNCE_MS + 10);

    expect(sink.resourceUpdated).toHaveBeenCalledTimes(1);
    expect(sink.resourceUpdated).toHaveBeenCalledWith(URI);

    // A later burst gets its own delivery
    hub.resourceUpdated(URI);
    await vi.advanceTimersByTimeAsync(OUTPUT_UPDATE_DEBOUNCE_MS + 10);
    expect(sink.resourceUpdated).toHaveBeenCalledTimes(2);
  });

  it('keeps one timer per URI, so two sessions ping independently', async () => {
    const sink = fakeSink();
    hub.addSink(sink);

    hub.resourceUpdated(URI);
    hub.resourceUpdated(OTHER);
    await vi.advanceTimersByTimeAsync(OUTPUT_UPDATE_DEBOUNCE_MS + 10);

    expect(sink.resourceUpdated.mock.calls.map(([uri]) => uri).sort()).toEqual([URI, OTHER].sort());
  });

  it('fans a delivery out to every sink and reports how many are attached', async () => {
    const a = fakeSink();
    const b = fakeSink();
    hub.addSink(a);
    hub.addSink(b);
    expect(hub.sinkCount).toBe(2);

    hub.resourceUpdated(URI);
    await vi.advanceTimersByTimeAsync(OUTPUT_UPDATE_DEBOUNCE_MS + 10);
    hub.resourcesChanged();

    expect(a.resourceUpdated).toHaveBeenCalledWith(URI);
    expect(b.resourceUpdated).toHaveBeenCalledWith(URI);
    expect(a.resourcesChanged).toHaveBeenCalledTimes(1);
    expect(b.resourcesChanged).toHaveBeenCalledTimes(1);
  });

  it('stops delivering to a sink once its remover has run', async () => {
    const sink = fakeSink();
    const remove = hub.addSink(sink);
    remove();
    expect(hub.sinkCount).toBe(0);

    hub.resourceUpdated(URI);
    await vi.advanceTimersByTimeAsync(OUTPUT_UPDATE_DEBOUNCE_MS + 10);
    hub.resourcesChanged();

    expect(sink.resourceUpdated).not.toHaveBeenCalled();
    expect(sink.resourcesChanged).not.toHaveBeenCalled();
  });

  it('forgetUri cancels the pending ping and tells every sink to drop the URI', async () => {
    const sink = fakeSink();
    hub.addSink(sink);
    hub.resourceUpdated(URI);

    hub.forgetUri(URI);
    await vi.advanceTimersByTimeAsync(OUTPUT_UPDATE_DEBOUNCE_MS + 10);

    expect(sink.resourceUpdated).not.toHaveBeenCalled();
    expect(sink.forget).toHaveBeenCalledWith(URI);
  });

  it('dispose cancels every pending ping and detaches every sink', async () => {
    const sink = fakeSink();
    hub.addSink(sink);
    hub.resourceUpdated(URI);
    hub.resourceUpdated(OTHER);

    hub.dispose();
    await vi.advanceTimersByTimeAsync(OUTPUT_UPDATE_DEBOUNCE_MS + 10);

    expect(sink.resourceUpdated).not.toHaveBeenCalled();
    expect(hub.sinkCount).toBe(0);
  });

  it('a sink that throws or rejects is logged at debug and never blocks its siblings', async () => {
    const broken: NotificationSink = {
      resourceUpdated: vi.fn(async () => { throw new Error('transport gone'); }),
      resourcesChanged: vi.fn(() => { throw new Error('closed'); })
    };
    const healthy = fakeSink();
    hub.addSink(broken);
    hub.addSink(healthy);

    hub.resourceUpdated(URI);
    await vi.advanceTimersByTimeAsync(OUTPUT_UPDATE_DEBOUNCE_MS + 10);
    expect(() => hub.resourcesChanged()).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);

    expect(healthy.resourceUpdated).toHaveBeenCalledWith(URI);
    expect(healthy.resourcesChanged).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send resources/updated'),
      expect.objectContaining({ error: expect.any(Error) })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send resources/list_changed'),
      expect.objectContaining({ error: expect.any(Error) })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('facadeSink', () => {
  const server = () => ({
    sendResourceUpdated: vi.fn().mockResolvedValue(undefined),
    sendResourceListChanged: vi.fn().mockResolvedValue(undefined)
  });

  it('with a subscription filter, pings only the URIs that facade subscribed to', async () => {
    const s = server();
    const subscriptions = new FacadeSubscriptions();
    subscriptions.subscribe(URI);
    const sink = facadeSink(s, subscriptions);

    await sink.resourceUpdated(URI);
    await sink.resourceUpdated(OTHER);

    expect(s.sendResourceUpdated).toHaveBeenCalledTimes(1);
    expect(s.sendResourceUpdated).toHaveBeenCalledWith({ uri: URI });
  });

  it('without a filter (a modern-era pin, where the SDK filters), pings every URI', async () => {
    const s = server();
    const sink = facadeSink(s);

    await sink.resourceUpdated(URI);
    await sink.resourceUpdated(OTHER);

    expect(s.sendResourceUpdated).toHaveBeenCalledTimes(2);
  });

  it('list changes are sent regardless of subscriptions, and forget drops the URI from the filter', async () => {
    const s = server();
    const subscriptions = new FacadeSubscriptions();
    subscriptions.subscribe(URI);
    const sink = facadeSink(s, subscriptions);

    await sink.resourcesChanged();
    sink.forget?.(URI);
    await sink.resourceUpdated(URI);

    expect(s.sendResourceListChanged).toHaveBeenCalledTimes(1);
    expect(s.sendResourceUpdated).not.toHaveBeenCalled();
    expect(subscriptions.has(URI)).toBe(false);
  });

  it('returns the send promise so the hub can observe a rejection', async () => {
    const s = server();
    s.sendResourceUpdated.mockRejectedValue(new Error('not connected'));
    const sink = facadeSink(s);

    await expect(sink.resourceUpdated(URI)).rejects.toThrow('not connected');
  });
});
