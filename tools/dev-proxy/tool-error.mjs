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
// -32000 ConnectionClosed, -32001 RequestTimeout. The second does not by
// itself mean the backend is gone — see backendFailureHint, which tells a
// running backend that was slow to answer apart from an unreachable one.
const MCP_CONNECTION_CODES = new Set([-32000, -32001]);

/**
 * True when a failed backend tool call is not the backend's own answer: the
 * backend is unreachable (dead process, refused/reset connection) or the
 * call got no answer in time (request timeout). These are the only cases that
 * get a hint at all — which hint is backendFailureHint's decision, and only a
 * backend that wants restarting is told to restart. A well-formed JSON-RPC
 * error response (e.g. -32602 InvalidParams) is proof the backend is alive
 * and must NOT trigger one.
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
 * How long one backend tool call may take before the proxy gives up on it
 * (issue #854). The SDK client's default is 60 s, which cut off every call
 * that is slow by design: the server lets a caller ask evaluate_expression,
 * redefine_classes and wait_for_stop for up to 600 s. The MCP client in front
 * of the proxy enforces its own request timeout, so this only has to stay
 * out of the way — the tool maximum plus room for the answer to travel.
 */
export const BACKEND_CALL_TIMEOUT_MS = 660_000;

/**
 * The request options for one backend tool call: the timeout above, and the
 * caller's abort signal so a call the client cancelled (or abandoned) is
 * cancelled in the backend too instead of running on for nobody.
 *
 * @param {AbortSignal | undefined} signal
 */
export function backendCallOptions(signal) {
  return { timeout: BACKEND_CALL_TIMEOUT_MS, ...(signal ? { signal } : {}) };
}

/** True when the SDK gave up waiting for the backend's answer (-32001), anywhere in the cause chain. */
function isRequestTimeout(err) {
  let e = err;
  for (let depth = 0; e && depth < 4; depth++) {
    if (/** @type {{code?: unknown}} */ (e).code === -32001) {
      return true;
    }
    e = /** @type {{cause?: unknown}} */ (e).cause;
  }
  return false;
}

/**
 * The hint to put beside a failed backend tool call, or undefined when the
 * failure is the backend's own answer (issue #304). Three honest cases:
 * the backend wants restarting; a start or restart is still in flight
 * (retry, do not restart — #716); or the backend is running and simply did
 * not answer this call in time, which is not "did not settle" (issue #854).
 *
 * @param {unknown} err - the error thrown by BackendManager.callTool
 * @param {{state: string, needsRestart: boolean, discoveryWaitMs: number}} backend
 */
export function backendFailureHint(err, backend) {
  if (!isBackendUnavailableError(err, backend.state)) {
    return undefined;
  }
  if (backend.needsRestart) {
    return `The mcp-debugger backend is not reachable (state: ${backend.state}). Use dev_server_status to check, or dev_restart_debugger to restart it.`;
  }
  if (backend.state === 'running' && isRequestTimeout(err)) {
    return `The mcp-debugger backend is running but did not answer this call within ${BACKEND_CALL_TIMEOUT_MS / 1000}s; the call may still be executing there. Use dev_server_status to watch it — do NOT restart it.`;
  }
  return `The mcp-debugger backend is ${backend.state} and did not settle within ${backend.discoveryWaitMs}ms. Retry the call; use dev_server_status to watch it — do NOT restart it.`;
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
