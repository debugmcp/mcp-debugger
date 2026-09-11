/**
 * Types for `tool-error.mjs`, so its TypeScript tests see a real API instead
 * of `@ts-ignore`-ing the import into `any` (issue #562).
 */

/**
 * True when a failed backend tool call indicates the backend itself is
 * unreachable — a non-`running` state, a transport syscall code
 * (`ECONNREFUSED`/`ECONNRESET`/…), or an MCP transport code (-32000, -32001)
 * found up to four levels down the `cause` chain.
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
