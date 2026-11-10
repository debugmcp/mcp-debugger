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
 * @property {(filter: { resourceSubscriptions: string[], toolsListChanged: boolean, resourcesListChanged: boolean }) => Promise<{ close(): Promise<void> }>} listen
 */

/**
 * @param {{ getClient: () => RelayClient | null | undefined, log?: (msg: string) => void }} deps
 */
export function createSubscriptionRelay({ getClient, log = () => {} }) {
  /** @type {Set<string>} */
  const uris = new Set();
  /** The modern-era listen currently open, if any. */
  /** @type {{ close(): Promise<void> } | null} */
  let open = null;

  const isModern = (client) => client?.getProtocolEra?.() === 'modern';

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

  /** Express the whole set to the current backend, whichever era it speaks. */
  const express = async () => {
    const client = getClient();
    if (!client) return;
    if (isModern(client)) {
      await closeOpen();
      open = await client.listen({
        resourceSubscriptions: [...uris],
        toolsListChanged: true,
        resourcesListChanged: true,
      });
      return;
    }
    for (const uri of uris) await client.subscribeResource({ uri });
  };

  return {
    uris: () => [...uris],

    /** @param {string} uri */
    async subscribe(uri) {
      if (uris.has(uri)) return;
      const client = getClient();
      if (client && !isModern(client)) {
        // A refusal (an unknown resource) is the front client's answer: not remembered.
        await client.subscribeResource({ uri });
        uris.add(uri);
        return;
      }
      uris.add(uri);
      if (client) await express();
    },

    /** @param {string} uri */
    async unsubscribe(uri) {
      if (!uris.delete(uri)) return;
      const client = getClient();
      if (!client) return;
      if (!isModern(client)) {
        await client.unsubscribeResource({ uri });
        return;
      }
      await express();
    },

    /** After a backend (re)connect: the new backend knows nothing of the set yet. */
    reopen: express,

    /** Before a backend goes away: end the open listen; the set stays for the next one. */
    close: closeOpen,
  };
}
