/**
 * The dev proxy's client-facing server (issue #1025, step 2, PR 5).
 *
 * Served through the SDK's stdio entry (`serveStdio(front.factory, …)`), which
 * owns the wire, answers a client's `server/discover` probe itself, and pins one
 * instance per connection in whichever protocol era the client opens with: a
 * probing client (Claude Code's v2 runtime) lands on 2026-07-28, an `initialize`
 * client on the 2025 era. The factory may run twice — once for a probe instance
 * a client abandons for `initialize`, once for the pinned one — so the relay
 * target (`current()`) is the newest instance that has not closed.
 *
 * The handlers forward to the backend and answer the dev tools locally. The
 * backend is started by the first request that reaches a handler
 * (`backend.ensureStarted()`): a disposable probe sibling never reaches one, so
 * it never spawns a backend of its own.
 */
import { Server } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { assertBackendAvailable, backendFailureHint, dedupeMcpErrorPrefix } from './tool-error.mjs';

/**
 * @typedef {object} FrontBackend
 * @property {string} state
 * @property {{ listTools(): Promise<{ tools?: unknown[] }>, listResources(): Promise<unknown>, readResource(params: unknown): Promise<unknown> } | null} mcpClient
 * @property {() => unknown} [ensureStarted]
 * @property {(options?: { signal?: AbortSignal }) => Promise<boolean>} whenReady
 * @property {(name: string, args: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>} callTool
 * @property {() => boolean} [needsRestart]
 * @property {{ pending: number }} [lifecycleQueue]
 * @property {boolean} [buildInProgress]
 */

/**
 * @param {object} deps
 * @param {FrontBackend} deps.backend
 * @param {{ subscribe(uri: string): Promise<void>, unsubscribe(uri: string): Promise<void> }} deps.relay
 * @param {unknown[]} deps.devTools
 * @param {(name: string, args: Record<string, unknown>) => Promise<unknown>} deps.handleDevTool
 * @param {number} [deps.discoveryWaitMs]
 * @param {(msg: string) => void} [deps.log]
 */
export function createFront({ backend, relay, devTools, handleDevTool, discoveryWaitMs, log = () => {} }) {
  /** @type {Server | null} */
  let current = null;

  const signalOf = (ctx) => ctx?.mcpReq?.signal;

  /** The backend's start is on demand; waiting for it is bounded by `whenReady`. */
  const ready = async (ctx) => {
    void backend.ensureStarted?.();
    await backend.whenReady({ signal: signalOf(ctx) });
  };

  const running = () => backend.state === 'running' && backend.mcpClient;

  const factory = ({ era }) => {
    const server = new Server(
      { name: 'dev-proxy', version: '1.0.0' },
      { capabilities: { tools: { listChanged: true }, resources: { subscribe: true, listChanged: true } } }
    );

    // ListTools: forward live to backend, fall back to dev-tools-only when the backend
    // is down. The wait keeps the first inventory from being taken before the backend
    // has started (issue #716); a cancelled request stops waiting with the client.
    server.setRequestHandler('tools/list', async (_request, ctx) => {
      await ready(ctx);
      if (running()) {
        try {
          const result = await backend.mcpClient.listTools();
          return { tools: [...(result.tools || []), ...devTools] };
        } catch (err) {
          log(`Live tools/list failed: ${err.message}`);
        }
      }
      return { tools: [...devTools] };
    });

    // CallTool: route dev_* locally, forward everything else to the backend.
    server.setRequestHandler('tools/call', async (request, ctx) => {
      const { name, arguments: args } = request.params;

      // Dev tools are always handled locally — status and recovery stay callable
      // while a start or restart is still in flight.
      if (name.startsWith('dev_')) {
        return await handleDevTool(name, args ?? {});
      }

      void backend.ensureStarted?.();
      try {
        return await backend.callTool(name, args || {}, { signal: signalOf(ctx) });
      } catch (err) {
        // A well-formed JSON-RPC error from a running backend (e.g. -32602
        // InvalidParams) proves the backend is alive — pass it through without
        // the restart hint, which would send agents on a false detour (#304).
        const body = { error: dedupeMcpErrorPrefix(err.message) };
        // Only a stopped backend wants restarting. Telling an agent to restart
        // one that is mid-start queues a second restart that kills it (#716),
        // and a running backend that was merely slow is neither (#854).
        const hint = backendFailureHint(err, {
          state: backend.state,
          needsRestart: backend.needsRestart?.() ?? false,
          discoveryWaitMs,
        });
        if (hint) {
          body.hint = hint;
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
          isError: true,
        };
      }
    });

    // Resources: passthrough to the backend (issue #218); subscriptions go through
    // the relay, which expresses them in the backend's era and re-sends them after
    // a restart (issue #1025, step 2).
    server.setRequestHandler('resources/list', async (_request, ctx) => {
      await ready(ctx);
      if (running()) {
        try {
          return await backend.mcpClient.listResources();
        } catch (err) {
          log(`Live resources/list failed: ${err.message}`);
        }
      }
      return { resources: [] };
    });

    server.setRequestHandler('resources/read', async (request, ctx) => {
      await ready(ctx);
      assertBackendAvailable(backend);
      return await backend.mcpClient.readResource(request.params);
    });

    server.setRequestHandler('resources/subscribe', async (request, ctx) => {
      await ready(ctx);
      assertBackendAvailable(backend);
      await relay.subscribe(request.params.uri);
      return {};
    });

    server.setRequestHandler('resources/unsubscribe', async (request) => {
      await relay.unsubscribe(request.params.uri);
      return {};
    });

    // The newest instance is the relay target; a discarded probe closing later
    // must not clear a newer pin.
    const previousClose = server.onclose;
    server.onclose = () => {
      if (current === server) current = null;
      previousClose?.();
    };
    current = server;
    log(`Front instance built for the ${era} era`);
    return server;
  };

  /**
   * Relay a backend notification to the pinned instance through its typed
   * senders, so the SDK routes it in the client's era (a 2026 client's listen
   * stream, a 2025 client's session). Dropped, not thrown, with no client pinned.
   */
  const notify = async (notification) => {
    const target = current;
    if (!target) return;
    switch (notification.method) {
      case 'notifications/resources/updated':
        await target.sendResourceUpdated({ uri: notification.params?.uri });
        return;
      case 'notifications/resources/list_changed':
        await target.sendResourceListChanged();
        return;
      case 'notifications/tools/list_changed':
        await target.sendToolListChanged();
        return;
      default:
        await target.notification(notification);
    }
  };

  return {
    factory,
    current: () => current,
    notify,
    sendToolListChanged: async () => {
      await current?.sendToolListChanged();
    },
  };
}

/**
 * The SDK's stdio transport closes itself — on stdin's EOF, but also on a stdout
 * error (the client's end of the pipe is gone) or an oversized frame, with stdin
 * still open — and tells only its own `onclose`, which `serveStdio` owns. This
 * subclass lets the proxy hear every close of the wire, whatever ended it, so
 * the process never lives on with a dead instance (issue #1025, step 2).
 */
export class ObservedStdioServerTransport extends StdioServerTransport {
  #notified = false;
  #onWireClosed;

  /** @param {() => void} onWireClosed */
  constructor(onWireClosed) {
    super();
    this.#onWireClosed = onWireClosed;
  }

  async close() {
    await super.close();
    if (this.#notified) return;
    this.#notified = true;
    this.#onWireClosed();
  }
}
