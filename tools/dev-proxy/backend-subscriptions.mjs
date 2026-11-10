/**
 * The backend subscription relay (issue #1025, step 2, PR 5).
 *
 * The proxy keeps the set of output resources its client wants pings for and
 * expresses it to whichever protocol era the backend speaks:
 *
 * - a 2025 backend takes one `resources/subscribe` per URI, and forgets them
 *   all when it restarts, so `reopen()` re-sends the set;
 * - a 2026-07-28 backend has no `resources/subscribe` at all — the set becomes
 *   ONE `subscriptions/listen` carrying the URIs plus the list-changed flags,
 *   re-opened whenever the set changes and after every backend restart (the
 *   list-changed flags keep a listen open even with no URI, so a new debug
 *   session's `resources/list_changed` still reaches the client).
 *
 * Two sources feed the set. A 2025 front client names what it wants through
 * `resources/subscribe` (`subscribe`/`unsubscribe`). A 2026-07-28 front
 * client's listen set is served by the SDK's stdio entry and never reaches the
 * proxy, so while such a client is pinned (`trackAll(true)`) the relay also
 * tracks every resource the backend lists — re-read on each
 * `resources/list_changed` (`refreshKnown`) — and the front's own router
 * delivers each client only what it listened for.
 *
 * Every expression against the backend is serialized: two subscribes arriving
 * back-to-back must not both open a listen and leak the first one.
 *
 * A 2025 backend can refuse a URI, and re-expression has to survive that. A
 * restart ends every debug session, so each subscription a client named before
 * it points at nothing afterwards: a refused named URI is dropped, said once,
 * and the rest are still sent. A listed resource the backend will not
 * subscribe (its proxy-log tails) is asked once and remembered until the
 * backend stops listing it. Only the answer "that resource is not here"
 * (InvalidParams, or the older resource-not-found code) counts as a refusal:
 * any other error answer leaves the subscription in place to be tried again,
 * and a failed connection still surfaces. (A 2026 backend's listen takes any
 * URI, so a dead one named there simply never fires.)
 *
 * The notifications themselves arrive through the client's
 * `fallbackNotificationHandler` exactly as before (the v2 client passes
 * listen-stream change notifications through to its registered handlers); the
 * relay never touches them.
 */

/**
 * @typedef {object} RelayClient
 * @property {() => 'legacy' | 'modern'} [getProtocolEra]
 * @property {(params: { uri: string }) => Promise<unknown>} subscribeResource
 * @property {(params: { uri: string }) => Promise<unknown>} unsubscribeResource
 * @property {() => Promise<{ resources?: Array<{ uri: string }> }>} listResources
 * @property {(filter: { resourceSubscriptions: string[], toolsListChanged: boolean, resourcesListChanged: boolean }) => Promise<{ close(): Promise<void> }>} listen
 */

/**
 * @param {{ getClient: () => RelayClient | null | undefined, log?: (msg: string) => void }} deps
 */
export function createSubscriptionRelay({ getClient, log = () => {} }) {
  /** What front clients asked for by name. @type {Set<string>} */
  const uris = new Set();
  /** What the backend lists, while a 2026 front client is pinned. @type {string[]} */
  let known = [];
  let trackingAll = false;
  /** Listed resources the backend refused to subscribe; asked once each. @type {Set<string>} */
  const refused = new Set();
  /** The modern-era listen currently open, if any. @type {{ close(): Promise<void> } | null} */
  let open = null;
  /** Serializes every expression against the backend. @type {Promise<void>} */
  let tail = Promise.resolve();

  /** @template T @param {() => Promise<T>} work @returns {Promise<T>} */
  const serialize = (work) => {
    const run = tail.then(work, work);
    tail = run.then(() => undefined, () => undefined);
    return run;
  };

  const isModern = (client) => {
    try {
      return client?.getProtocolEra?.() === 'modern';
    } catch {
      return false;
    }
  };

  const wanted = () => [...new Set([...uris, ...(trackingAll ? known : [])])];

  const closeOpen = async () => {
    const current = open;
    open = null;
    if (!current) return;
    try {
      await current.close();
    } catch (err) {
      log(`Ignoring listen close error: ${err?.message ?? err}`);
    }
  };

  /** Re-read what the backend lists (only while tracking everything). */
  const relist = async (client) => {
    if (!trackingAll) {
      known = [];
      return;
    }
    const listed = await client.listResources();
    known = (listed?.resources ?? [])
      .map((resource) => resource?.uri)
      .filter((uri) => typeof uri === 'string');
    // A refusal is remembered only while the backend still lists the resource.
    for (const uri of refused) {
      if (!known.includes(uri)) refused.delete(uri);
    }
  };

  /** The backend answered (a JSON-RPC error, numeric code), as opposed to the connection failing (the SDK's string codes). */
  const isAnswer = (err) => typeof err?.code === 'number';
  /** "That resource is not here": InvalidParams (-32602), or the resource-not-found code older servers used (-32002). */
  const saysGone = (err) => err?.code === -32602 || err?.code === -32002;

  /**
   * Re-express one URI to a 2025 backend. A refusal never stops the others: a
   * URI the client named is dropped (the resource is gone), a listed one is
   * remembered so it is not asked again. Any other error answer changes
   * nothing, and a failed connection is thrown.
   */
  const subscribeOne = async (client, uri) => {
    const named = uris.has(uri);
    if (!named && refused.has(uri)) return;
    try {
      await client.subscribeResource({ uri });
    } catch (err) {
      if (!isAnswer(err)) throw err;
      if (!saysGone(err)) {
        // The backend is alive and failed for another reason: no evidence the
        // resource is gone. Keep it, say so, and try again on the next pass.
        log(`Backend could not subscribe ${uri} (${err?.message ?? err}); will retry`);
        return;
      }
      if (named) {
        uris.delete(uri);
        log(`Dropped the subscription to ${uri}: the backend no longer has it (${err?.message ?? err})`);
      } else {
        refused.add(uri);
        log(`Backend refused a tracked subscription for ${uri}: ${err?.message ?? err}`);
      }
    }
  };

  /** Express the whole wanted set to the backend in its era. */
  const express = async (client) => {
    if (isModern(client)) {
      await closeOpen();
      open = await client.listen({
        resourceSubscriptions: wanted(),
        toolsListChanged: true,
        resourcesListChanged: true,
      });
      return;
    }
    for (const uri of wanted()) await subscribeOne(client, uri);
  };

  return {
    uris: () => [...uris],

    /**
     * Track everything the backend lists (a 2026 front client is pinned) or stop.
     * The next `reopen()`/`refreshKnown()` applies it; `refreshKnown()` right away
     * expresses it to a backend that is already connected.
     * @param {boolean} enabled
     */
    trackAll(enabled) {
      trackingAll = Boolean(enabled);
      if (!trackingAll) {
        known = [];
        refused.clear();
      }
    },

    /** @param {string} uri */
    async subscribe(uri) {
      if (uris.has(uri)) return;
      return serialize(async () => {
        if (uris.has(uri)) return;
        const client = getClient();
        if (!client) {
          uris.add(uri);
          return;
        }
        if (!isModern(client)) {
          // A refusal (an unknown resource) is the front client's answer: not remembered.
          await client.subscribeResource({ uri });
          uris.add(uri);
          return;
        }
        uris.add(uri);
        try {
          await express(client);
        } catch (err) {
          uris.delete(uri);
          throw err;
        }
      });
    },

    /** @param {string} uri */
    async unsubscribe(uri) {
      if (!uris.has(uri)) return;
      return serialize(async () => {
        if (!uris.delete(uri)) return;
        const client = getClient();
        if (!client) return;
        if (!isModern(client)) {
          await client.unsubscribeResource({ uri });
          return;
        }
        await express(client);
      });
    },

    /** After a backend (re)connect: the new backend knows nothing of the set yet. */
    reopen() {
      return serialize(async () => {
        const client = getClient();
        if (!client) return;
        await relist(client);
        await express(client);
      });
    },

    /** The backend's resource list changed: re-read it and express what is new. */
    refreshKnown() {
      return serialize(async () => {
        if (!trackingAll) return;
        const client = getClient();
        if (!client) return;
        const before = new Set(known);
        await relist(client);
        if (isModern(client)) {
          await express(client);
          return;
        }
        for (const uri of known) {
          if (before.has(uri) || uris.has(uri)) continue;
          await subscribeOne(client, uri);
        }
      });
    },

    /** Before a backend goes away: end the open listen; the set stays for the next one. */
    close() {
      return serialize(closeOpen);
    },
  };
}
