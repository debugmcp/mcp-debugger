import { StdioClientTransport, type StdioServerParameters } from '@modelcontextprotocol/client/stdio';

/**
 * The dev proxy's stdio transport to its backend: a subclass of the SDK's, so
 * `auto` negotiation probes on the backend's own pipe, that closes itself when
 * the proxy's shutdown signal aborts (the SDK's in-place negotiation does not
 * watch connect()'s signal).
 */
export class BackendStdioTransport extends StdioClientTransport {
  constructor(params: StdioServerParameters, options?: { signal?: AbortSignal });
  /** Stop listening to the shutdown signal; `close()` does this too. Idempotent. */
  detachFromSignal(): void;
}
