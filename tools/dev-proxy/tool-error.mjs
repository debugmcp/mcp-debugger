/**
 * Error classification helpers for the dev-proxy tool-call path (issue #304).
 *
 * Kept separate from dev-proxy.mjs (which runs main() at module top level and
 * therefore cannot be imported safely) so the logic is unit-testable — same
 * pattern as shutdown.mjs and backend-logger.mjs.
 */

// Node syscall codes that mean the backend process/socket is gone. With the
// default Streamable HTTP transport these usually arrive wrapped by undici as
// TypeError('fetch failed') with the syscall error on err.cause.
const TRANSPORT_SYSCALL_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ECONNABORTED',
  'ENOTFOUND',
]);

// MCP SDK transport-level error codes (not JSON-RPC application errors):
// -32000 ConnectionClosed, -32001 RequestTimeout.
const MCP_CONNECTION_CODES = new Set([-32000, -32001]);

/**
 * True when a failed backend tool call indicates the backend itself is
 * unreachable (dead process, refused/reset connection, transport timeout) —
 * the only case where a "restart the backend" hint is honest. A well-formed
 * JSON-RPC error response (e.g. -32602 InvalidParams) is proof the backend is
 * alive and must NOT trigger the hint.
 *
 * @param {unknown} err - the error thrown by BackendManager.callTool
 * @param {string} backendState - BackendManager.state at catch time
 */
export function isBackendUnavailableError(err, backendState) {
  if (backendState !== 'running') {
    return true;
  }
  // Walk the cause chain (bounded — cycles/absurd depth are not our problem):
  // undici and the SDK both wrap the interesting code one level down.
  let e = err;
  for (let depth = 0; e && depth < 4; depth++) {
    const code = /** @type {{code?: unknown}} */ (e).code;
    if (typeof code === 'string' && TRANSPORT_SYSCALL_CODES.has(code)) {
      return true;
    }
    if (typeof code === 'number' && MCP_CONNECTION_CODES.has(code)) {
      return true;
    }
    e = /** @type {{cause?: unknown}} */ (e).cause;
  }
  return false;
}

/**
 * Collapse repeated identical "MCP error <code>: " prefixes to one.
 *
 * The SDK's McpError constructor bakes the prefix into .message; when the
 * backend's already-prefixed message crosses the proxy's SDK Client it gets
 * re-wrapped in a new McpError and prefixed again ("MCP error -32602: MCP
 * error -32602: ..."). Deduping (rather than stripping) keeps the single
 * prefix a direct client would see.
 *
 * @param {unknown} message
 */
export function dedupeMcpErrorPrefix(message) {
  if (typeof message !== 'string') {
    return message;
  }
  return message.replace(/^(MCP error -?\d+: )\1+/, '$1');
}

/**
 * Guard for the resource-passthrough handlers: throw a clean, honest error
 * when the backend cannot serve resource requests instead of dereferencing a
 * null mcpClient (latent NPE noted in issue #304).
 *
 * @param {{state: string, mcpClient: unknown}} backend
 */
export function assertBackendAvailable(backend) {
  if (backend.state !== 'running' || !backend.mcpClient) {
    throw new Error(
      `Backend is ${backend.state} — cannot serve resource requests. Use dev_restart_debugger to start it.`
    );
  }
}
