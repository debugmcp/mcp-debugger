/**
 * Which MCP protocol era a packaged-artifact smoke speaks (issue #1025).
 *
 * The Docker image and the npx bundle serve both eras, and until this helper
 * their smokes only ever spoke the older one: an SDK client's default opens
 * with `initialize` (2025-11-25). `modern` pins 2026-07-28, so the same smoke
 * can prove the packaged server answers `server/discover` and runs a debug
 * session sessionlessly.
 */
import { StdioClientTransport, type StdioServerParameters } from '@modelcontextprotocol/client/stdio';

export type SmokeProtocol = 'legacy' | 'modern';

export const MODERN_PROTOCOL_VERSION = '2026-07-28';

/**
 * A stdio transport the SDK negotiates on in place. For its exact base
 * StdioClientTransport the SDK runs `server/discover` on a disposable sibling
 * process spawned from the same parameters — here a second
 * `docker run --name <same>` that collides with the first, or a second CLI
 * process writing the same log file. A subclass probes on the connection
 * itself (documented SDK behaviour; the dev proxy's BackendStdioTransport
 * rests on the same rule).
 */
export class InPlaceStdioClientTransport extends StdioClientTransport {}

export function stdioTransportFor(protocol: SmokeProtocol | undefined, params: StdioServerParameters): StdioClientTransport {
  return protocol === 'modern' ? new InPlaceStdioClientTransport(params) : new StdioClientTransport(params);
}

/** The SDK client options for the era: `modern` pins it, so a server that cannot speak it fails the connect instead of falling back. */
export function clientOptionsFor(protocol: SmokeProtocol | undefined) {
  return protocol === 'modern'
    ? { capabilities: {}, versionNegotiation: { mode: { pin: MODERN_PROTOCOL_VERSION } } } as const
    : { capabilities: {} };
}
