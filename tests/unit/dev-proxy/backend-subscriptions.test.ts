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

function fakeClient(era: Era, listed: string[] = []) {
  const closes: Array<ReturnType<typeof vi.fn>> = [];
  const client = {
    getProtocolEra: vi.fn(() => era),
    subscribeResource: vi.fn(async (_params: { uri: string }) => ({})),
    unsubscribeResource: vi.fn(async (_params: { uri: string }) => ({})),
    listResources: vi.fn(async () => ({ resources: listed.map((uri) => ({ uri, name: uri })) })),
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

  // A backend restart is the proxy's whole purpose, and it kills every debug
  // session: each subscription a client named before it now points at nothing.
  // A 2025 backend refuses those one by one. The relay used to rethrow the first
  // refusal — aborting the re-expression and keeping the dead URI, so every
  // later reopen failed at the same place.
  describe('re-expressing to a 2025 backend that refuses a URI', () => {
    const A = 'debug://sessions/a/output';
    const B = 'debug://sessions/b/output';
    const PROXY_LOG = 'debug://sessions/b/proxy-log';
    const refusal = (uri: string) => Object.assign(new Error(`Unknown resource: ${uri}`), { code: -32602 });

    it('drops a subscription the client named once the backend refuses it, says so once, and still sends the rest', async () => {
      const { client } = fakeClient('legacy');
      const log = vi.fn();
      const relay = createSubscriptionRelay({ getClient: () => client, log });
      await relay.subscribe(A);
      await relay.subscribe(B);
      client.subscribeResource.mockClear();
      client.subscribeResource.mockImplementation(async ({ uri }: { uri: string }) => {
        if (uri === A) throw refusal(uri);
        return {};
      });

      await expect(relay.reopen()).resolves.toBeUndefined();
      await relay.reopen();

      expect(relay.uris()).toEqual([B]);
      // A was asked once and never again; B was re-sent on both reopens.
      expect(client.subscribeResource.mock.calls.map(([params]) => params.uri)).toEqual([A, B, B]);
      expect(log.mock.calls.filter(([line]) => String(line).includes(A))).toHaveLength(1);
      expect(String(log.mock.calls.find(([line]) => String(line).includes(A))![0])).toContain('Dropped');
    });

    it('asks for a listed resource the backend will not subscribe once, not on every reopen', async () => {
      const { client } = fakeClient('legacy', [B, PROXY_LOG]);
      const log = vi.fn();
      const relay = createSubscriptionRelay({ getClient: () => client, log });
      relay.trackAll(true);
      client.subscribeResource.mockImplementation(async ({ uri }: { uri: string }) => {
        if (uri === PROXY_LOG) throw refusal(uri);
        return {};
      });

      await relay.reopen();
      await relay.refreshKnown();
      await relay.reopen();

      const asked = client.subscribeResource.mock.calls.map(([params]) => params.uri);
      expect(asked.filter((uri) => uri === PROXY_LOG)).toHaveLength(1);
      expect(log.mock.calls.filter(([line]) => String(line).includes(PROXY_LOG))).toHaveLength(1);
    });

    it('asks again for a refused resource once the backend has stopped and started listing it', async () => {
      const { client } = fakeClient('legacy', [PROXY_LOG]);
      const relay = createSubscriptionRelay({ getClient: () => client });
      relay.trackAll(true);
      client.subscribeResource.mockRejectedValueOnce(refusal(PROXY_LOG));
      await relay.reopen();

      client.listResources.mockResolvedValueOnce({ resources: [] });
      await relay.refreshKnown();
      await relay.refreshKnown();

      expect(client.subscribeResource.mock.calls.map(([params]) => params.uri)).toEqual([PROXY_LOG, PROXY_LOG]);
    });

    it('keeps a subscription the backend failed on for another reason, and still sends the rest', async () => {
      const { client } = fakeClient('legacy');
      const log = vi.fn();
      const relay = createSubscriptionRelay({ getClient: () => client, log });
      await relay.subscribe(A);
      await relay.subscribe(B);
      client.subscribeResource.mockClear();
      client.subscribeResource.mockImplementation(async ({ uri }: { uri: string }) => {
        if (uri === A) throw Object.assign(new Error('Internal error'), { code: -32603 });
        return {};
      });

      await expect(relay.reopen()).resolves.toBeUndefined();

      // An internal error says nothing about whether the resource exists: A stays, to be tried again.
      expect(relay.uris()).toEqual([A, B]);
      expect(client.subscribeResource.mock.calls.map(([params]) => params.uri)).toEqual([A, B]);
      expect(log).toHaveBeenCalledWith(expect.stringContaining(A));
      expect(String(log.mock.calls.find(([line]) => String(line).includes(A))![0])).not.toContain('Dropped');
    });

    it('asks again for a listed resource the backend failed on for another reason', async () => {
      const { client } = fakeClient('legacy', [PROXY_LOG]);
      const relay = createSubscriptionRelay({ getClient: () => client });
      relay.trackAll(true);
      client.subscribeResource.mockRejectedValueOnce(Object.assign(new Error('Internal error'), { code: -32603 }));

      await relay.reopen();
      await relay.reopen();

      expect(client.subscribeResource.mock.calls.map(([params]) => params.uri)).toEqual([PROXY_LOG, PROXY_LOG]);
    });

    it('does not mistake a broken connection for a refusal: that failure surfaces and nothing is dropped', async () => {
      const { client } = fakeClient('legacy');
      const relay = createSubscriptionRelay({ getClient: () => client });
      await relay.subscribe(A);
      client.subscribeResource.mockRejectedValue(new Error('Not connected'));

      await expect(relay.reopen()).rejects.toThrow('Not connected');

      expect(relay.uris()).toEqual([A]);
    });

    it('still gives the client its own refusal when it subscribes to a resource that is not there', async () => {
      const { client } = fakeClient('legacy');
      const relay = createSubscriptionRelay({ getClient: () => client });
      client.subscribeResource.mockRejectedValue(refusal(A));

      await expect(relay.subscribe(A)).rejects.toThrow('Unknown resource');

      expect(relay.uris()).toEqual([]);
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

  describe('serialization (review of PR #1118, Important #2)', () => {
    it('two subscribes arriving before either listen settles leave exactly one listen open', async () => {
      const { client, closes } = fakeClient('modern');
      const releases: Array<() => void> = [];
      client.listen.mockImplementation((filter: unknown) => new Promise((resolve) => {
        releases.push(() => {
          const close = vi.fn(async () => {});
          closes.push(close);
          resolve({ honoredFilter: filter, close });
        });
      }));
      const relay = createSubscriptionRelay({ getClient: () => client });

      const first = relay.subscribe('debug://sessions/a/output');
      const second = relay.subscribe('debug://sessions/b/output');
      await vi.waitFor(() => expect(client.listen).toHaveBeenCalledTimes(1));
      // The second subscribe waits for the first to settle rather than racing it.
      expect(client.listen).toHaveBeenCalledTimes(1);

      releases[0]();
      await first;
      await vi.waitFor(() => expect(client.listen).toHaveBeenCalledTimes(2));
      releases[1]();
      await second;

      // The first listen was closed before the second opened; the second stays open.
      expect(closes).toHaveLength(2);
      expect(closes[0]).toHaveBeenCalledTimes(1);
      expect(closes[1]).not.toHaveBeenCalled();
      expect(client.listen).toHaveBeenLastCalledWith(expect.objectContaining({
        resourceSubscriptions: ['debug://sessions/a/output', 'debug://sessions/b/output'],
      }));
    });
  });

  describe('tracking everything the backend lists (review of PR #1118, Important #1)', () => {
    // A 2026-07-28 front client's listen set is served by the SDK entry and never
    // reaches the proxy, so while such a client is pinned the proxy subscribes the
    // backend to every resource it lists; the front's router filters per client.
    it('expresses the listed resources too while track-all is on, refreshes them on request, and drops them when it is off', async () => {
      const { client } = fakeClient('modern', ['debug://sessions/a/output', 'debug://sessions/a/proxy-log']);
      const relay = createSubscriptionRelay({ getClient: () => client });

      relay.trackAll(true);
      await relay.reopen();
      expect(client.listen).toHaveBeenLastCalledWith(expect.objectContaining({
        resourceSubscriptions: ['debug://sessions/a/output', 'debug://sessions/a/proxy-log'],
      }));

      // A new session appeared (resources/list_changed): re-list and re-express.
      client.listResources.mockResolvedValue({ resources: [{ uri: 'debug://sessions/a/output', name: 'a' }, { uri: 'debug://sessions/b/output', name: 'b' }] });
      await relay.refreshKnown();
      expect(client.listen).toHaveBeenLastCalledWith(expect.objectContaining({
        resourceSubscriptions: ['debug://sessions/a/output', 'debug://sessions/b/output'],
      }));

      // The modern pin closed: only what a client asked for by name remains.
      relay.trackAll(false);
      await relay.reopen();
      expect(client.listen).toHaveBeenLastCalledWith(expect.objectContaining({ resourceSubscriptions: [] }));
    });

    it('against a 2025 backend subscribes each listed resource, and a refusal is logged rather than thrown', async () => {
      const { client } = fakeClient('legacy', ['debug://sessions/a/output', 'debug://sessions/a/proxy-log']);
      client.subscribeResource.mockImplementation(async ({ uri }: { uri: string }) => {
        if (uri.endsWith('proxy-log')) throw Object.assign(new Error('Unknown resource: ' + uri), { code: -32602 });
        return {};
      });
      const log = vi.fn();
      const relay = createSubscriptionRelay({ getClient: () => client, log });

      relay.trackAll(true);
      await expect(relay.reopen()).resolves.toBeUndefined();

      expect(client.subscribeResource.mock.calls.map(([p]) => p.uri)).toEqual(['debug://sessions/a/output', 'debug://sessions/a/proxy-log']);
      expect(log).toHaveBeenCalledWith(expect.stringContaining('debug://sessions/a/proxy-log'));
    });

    it('refreshKnown is a no-op while track-all is off', async () => {
      const { client } = fakeClient('modern', ['debug://sessions/a/output']);
      const relay = createSubscriptionRelay({ getClient: () => client });
      await relay.refreshKnown();
      expect(client.listResources).not.toHaveBeenCalled();
      expect(client.listen).not.toHaveBeenCalled();
    });
  });

  it('does not remember a URI whose listen the 2026 backend refused', async () => {
    const { client } = fakeClient('modern');
    client.listen.mockRejectedValueOnce(new Error('listen refused'));
    const relay = createSubscriptionRelay({ getClient: () => client });

    await expect(relay.subscribe('debug://sessions/x/output')).rejects.toThrow('listen refused');
    expect(relay.uris()).toEqual([]);
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
