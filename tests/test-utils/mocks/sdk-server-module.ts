/**
 * Partial mock of `@modelcontextprotocol/server` for the unit tests that build
 * a DebugMcpServer without a transport (issue #1025).
 *
 * The v1 SDK kept the Server class (`sdk/server/index.js`) apart from the
 * protocol types (`sdk/types.js`), so automocking the former left McpError and
 * ErrorCode real. The v2 package exports both from one entry, and a plain
 * `vi.mock('@modelcontextprotocol/server')` turns ProtocolError and
 * ProtocolErrorCode into automocks too: every thrown error then carries an
 * empty message and every code is undefined. This factory keeps the real
 * module and automocks only the Server class, which is what those tests mean:
 *
 *   vi.mock('@modelcontextprotocol/server', async () =>
 *     (await import('../../../test-utils/mocks/sdk-server-module.js')).sdkServerModuleMock());
 *
 * The import is dynamic and inside the factory because vi.mock is hoisted
 * above the test file's own imports.
 */
import { vi } from 'vitest';

type SdkServerModule = typeof import('@modelcontextprotocol/server');

export async function sdkServerModuleMock() {
  const actual = await vi.importActual<SdkServerModule>('@modelcontextprotocol/server');
  return { ...actual, Server: vi.mockObject(actual.Server) };
}
