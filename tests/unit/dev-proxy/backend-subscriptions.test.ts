/**
 * The dev proxy's backend subscription relay (issue #1025, step 2, PR 5).
 *
 * The proxy keeps the set of output resources the front wants pings for and
 * expresses it to whichever era the backend speaks: a 2025 backend takes one
 * resources/subscribe per URI (and loses them all on restart, so a reopen
 * re-sends them); a 2026-07-28 backend has no resources/subscribe at all — the
 * set becomes ONE subscriptions/listen with the URIs plus the list-changed
 * flags, re-opened whenever the set changes and after every backend restart.
 * The notifications themselves flow through the client's
 * fallbackNotificationHandler exactly as before; the relay never touches them.
 */
import { describe, expect, it, vi } from 'vitest';
import { createSubscriptionRelay } from '../../../tools/dev-proxy/backend-subscriptions.mjs';

type Era = 'legacy' | 'modern';

function fakeClient(era: Era) {
  const closes: Array<ReturnType<typeof vi.fn>> = [];
  const client = {
    getProtocolEra: vi.fn(() => era),
    subscribeResource: vi.fn(async (_params: { uri: string }) => ({})),
    unsubscribeResource: vi.fn(async (_params: { uri: string }) => ({})),
    listen: vi.fn(async (filter: unknown) => {
      const close = vi.fn(async () => {});
      closes.push(close);
      return { honoredFilter: filter, close };
    }),
  };
  return { client, closes };
}

describe('dev-proxy backend subscription relay', () => {
  describe('against a 2025 backend', () => {
    it('forwards subscribe and unsubscribe one URI at a time and never opens a listen', async () => {
      const { client } = fakeClient('legacy');
      const relay = createSubscriptionRelay({ getClient: () => client });

      await relay.subscribe('debug://sessions/a/output');
      await relay.subscribe('debug://sessions/b/output');
      await relay.unsubscribe('debug://sessions/a/output');

      expect(client.subscribeResource.mock.calls.map(([p]) => p.uri)).toEqual([
        'debug://sessions/a/output',
        'debug://sessions/b/output',
      ]);
      expect(client.unsubscribeResource).toHaveBeenCalledWith({ uri: 'debug://sessions/a/output' });
      expect(client.listen).not.toHaveBeenCalled();
      expect(relay.uris()).toEqual(['debug://sessions/b/output']);
    });

    it('re-sends every subscription on reopen: a restarted backend has forgotten them', async () => {
      const { client } = fakeClient('legacy');
      const relay = createSubscriptionRelay({ getClient: () => client });
      await relay.subscribe('debug://sessions/a/output');
      client.subscribeResource.mockClear();

      await relay.reopen();

      expect(client.subscribeResource).toHaveBeenCalledTimes(1);
      expect(client.subscribeResource).toHaveBeenCalledWith({ uri: 'debug://sessions/a/output' });
    });
  });

  describe('against a 2026-07-28 backend', () => {
    it('opens one listen for the set plus the list-changed flags, and re-opens it when the set changes', async () => {
      const { client, closes } = fakeClient('modern');
      const relay = createSubscriptionRelay({ getClient: () => client });

      await relay.subscribe('debug://sessions/a/output');
      expect(client.subscribeResource).not.toHaveBeenCalled();
      expect(client.listen).toHaveBeenCalledTimes(1);
      expect(client.listen).toHaveBeenLastCalledWith({
        resourceSubscriptions: ['debug://sessions/a/output'],
        toolsListChanged: true,
        resourcesListChanged: true,
      });

      await relay.subscribe('debug://sessions/b/output');
      // The previous listen is closed before the next one opens.
      expect(closes[0]).toHaveBeenCalledTimes(1);
      expect(client.listen).toHaveBeenCalledTimes(2);
      expect(client.listen).toHaveBeenLastCalledWith(expect.objectContaining({
        resourceSubscriptions: ['debug://sessions/a/output', 'debug://sessions/b/output'],
      }));

      await relay.unsubscribe('debug://sessions/a/output');
      expect(closes[1]).toHaveBeenCalledTimes(1);
      expect(client.listen).toHaveBeenLastCalledWith(expect.objectContaining({
        resourceSubscriptions: ['debug://sessions/b/output'],
      }));
    });

    it('keeps a listen open for the list-changed notifications even with no URI', async () => {
      const { client } = fakeClient('modern');
      const relay = createSubscriptionRelay({ getClient: () => client });

      await relay.reopen();

      expect(client.listen).toHaveBeenCalledWith({
        resourceSubscriptions: [],
        toolsListChanged: true,
        resourcesListChanged: true,
      });
    });

    it('a duplicate subscribe changes nothing and re-opens nothing', async () => {
      const { client } = fakeClient('modern');
      const relay = createSubscriptionRelay({ getClient: () => client });
      await relay.subscribe('debug://sessions/a/output');

      await relay.subscribe('debug://sessions/a/output');

      expect(client.listen).toHaveBeenCalledTimes(1);
    });

    it('close() ends the open listen and leaves the set in place for the next backend', async () => {
      const { client, closes } = fakeClient('modern');
      const relay = createSubscriptionRelay({ getClient: () => client });
      await relay.subscribe('debug://sessions/a/output');

      await relay.close();
      expect(closes[0]).toHaveBeenCalledTimes(1);
      expect(relay.uris()).toEqual(['debug://sessions/a/output']);

      // The next backend (after a restart) gets the whole set in one listen.
      await relay.reopen();
      expect(client.listen).toHaveBeenCalledTimes(2);
      expect(client.listen).toHaveBeenLastCalledWith(expect.objectContaining({
        resourceSubscriptions: ['debug://sessions/a/output'],
      }));
    });
  });

  it('with no backend client, remembers the set and expresses it on reopen', async () => {
    let client: ReturnType<typeof fakeClient>['client'] | null = null;
    const relay = createSubscriptionRelay({ getClient: () => client });

    await relay.subscribe('debug://sessions/a/output');
    expect(relay.uris()).toEqual(['debug://sessions/a/output']);

    client = fakeClient('modern').client;
    await relay.reopen();
    expect(client.listen).toHaveBeenCalledWith(expect.objectContaining({
      resourceSubscriptions: ['debug://sessions/a/output'],
    }));
  });

  it('reports, not throws, when the backend refuses a subscription', async () => {
    const { client } = fakeClient('legacy');
    client.subscribeResource.mockRejectedValueOnce(new Error('Unknown resource: debug://sessions/x/output'));
    const log = vi.fn();
    const relay = createSubscriptionRelay({ getClient: () => client, log });

    await expect(relay.subscribe('debug://sessions/x/output')).rejects.toThrow('Unknown resource');
    // A refused URI is not remembered: the front was told no.
    expect(relay.uris()).toEqual([]);
  });
});
