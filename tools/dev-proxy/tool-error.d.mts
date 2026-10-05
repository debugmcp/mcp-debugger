/**
 * Types for `tool-error.mjs`, so its TypeScript tests see a real API instead
 * of `@ts-ignore`-ing the import into `any` (issue #562).
 */

/**
 * True when a failed backend tool call is not the backend's own answer — a
 * non-`running` state, a transport syscall code (`ECONNREFUSED`/`ECONNRESET`/…),
 * or an MCP transport code (-32000 connection closed, -32001 request timeout)
 * found up to four levels down the `cause` chain. Which hint that earns is
 * `backendFailureHint`'s decision.
 *
 * A well-formed JSON-RPC error such as -32602 is proof the backend is alive
 * and returns `false`: it must never draw the "restart the backend" hint.
 *
 * @param err the error thrown by `BackendManager.callTool`; any shape,
 *   `null`/`undefined` included, since it arrives from a `catch`
 * @param backendState `BackendManager.state` at catch time; anything other
 *   than `'running'` short-circuits to `true`
 */
export function isBackendUnavailableError(err: unknown, backendState: string): boolean;

/**
 * Collapse repeated identical `MCP error <code>: ` prefixes to one, which is
 * what a direct client would see. Differing codes are not duplicates and are
 * left alone.
 */
export function dedupeMcpErrorPrefix(message: string): string;
/**
 * Non-string input is returned unchanged, by identity — the helper sits on an
 * error path where the message may be anything.
 */
export function dedupeMcpErrorPrefix<T>(message: T): T;

/**
 * Guard for the resource-passthrough handlers.
 *
 * @throws {Error} naming the state, when the backend is not `running` or has
 *   no client — rather than dereferencing a null `mcpClient`
 */
export function assertBackendAvailable(backend: { state: string; mcpClient: unknown }): void;

/**
 * How long one backend tool call may take before the proxy gives up on it:
 * above the 600 s a tool's own `timeout` argument may ask for, so the MCP
 * client in front of the proxy is what bounds a slow call (issue #854).
 */
export const BACKEND_CALL_TIMEOUT_MS: number;

/**
 * The request options for one backend tool call: `BACKEND_CALL_TIMEOUT_MS`,
 * and the caller's abort signal when there is one, so a call the client
 * cancelled is cancelled in the backend too.
 */
export function backendCallOptions(signal: AbortSignal | undefined): { timeout: number; signal?: AbortSignal };

/**
 * The hint to put beside a failed backend tool call, or `undefined` when the
 * failure is the backend's own answer. A backend that wants restarting is
 * pointed at `dev_restart_debugger`; one that is mid-start is to be retried,
 * not restarted; a running backend whose call hit the request timeout is
 * reported as a call that was not answered (issue #854).
 */
export function backendFailureHint(
  err: unknown,
  backend: { state: string; needsRestart: boolean; discoveryWaitMs: number }
): string | undefined;
