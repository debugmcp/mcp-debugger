/**
 * The dev proxy's stdio transport to its backend (issue #1025, step 2).
 *
 * Being a subclass is the first point. Under `auto` negotiation the SDK probes
 * server/discover on a disposable SIBLING process spawned from the same
 * parameters, but only for its exact base StdioClientTransport — "subclasses
 * probe in place", on the connection itself. A sibling here would be a second
 * backend; in place, the backend starts once, a 2026-07-28 server pins the
 * modern era, and a 2025 server answers the probe with "method not found" and
 * gets `initialize` on the same pipe.
 *
 * The shutdown signal is the second. Negotiating in place, the SDK does not
 * watch the signal given to connect() (measured, client 2.4.0): a start still
 * negotiating when the proxy shuts down hangs until the probe gives up, and the
 * backend it spawned outlives the proxy. With its base transport the SDK closes
 * the transport itself on that abort; this class does the same, which ends the
 * child and fails the pending negotiation at once, so the start's own failure
 * path can clean up.
 *
 * Kept in its own module so unit tests can import it without executing the
 * dev-proxy entry point (dev-proxy.mjs runs main() at module top level).
 */
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

export class BackendStdioTransport extends StdioClientTransport {
  /** Removes the abort listener; a no-op once it has run. */
  #detach = () => {};

  /**
   * @param {ConstructorParameters<typeof StdioClientTransport>[0]} params
   * @param {{ signal?: AbortSignal }} [options] `signal`: the proxy's shutdown signal.
   */
  constructor(params, { signal } = {}) {
    super(params);
    if (signal) {
      const onAbort = () => {
        void this.close().catch(() => {});
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.#detach = () => {
        signal.removeEventListener('abort', onAbort);
        this.#detach = () => {};
      };
    }
  }

  /**
   * Stop listening to the shutdown signal. The proxy starts a transport per
   * backend start and the signal lives as long as the proxy, so a transport
   * that is done must let go of it: `close()` does, and the owner calls this
   * when the backend has gone by itself (the SDK then reports `onclose`
   * without `close()` ever running).
   */
  detachFromSignal() {
    this.#detach();
  }

  /** @override */
  async close() {
    this.#detach();
    return super.close();
  }
}
