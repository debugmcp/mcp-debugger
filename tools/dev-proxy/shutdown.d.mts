/**
 * Types for `shutdown.mjs`, so its TypeScript tests see a real API instead of
 * `@ts-ignore`-ing the import into `any` (issue #562).
 *
 * The collaborator types below are deliberately narrower than the Node types
 * the module's JSDoc names (`NodeJS.ReadableStream`, `NodeJS.Process`,
 * `ChildProcess`): they describe exactly the members the module touches, which
 * is what lets the unit tests pass plain `EventEmitter` doubles without a cast
 * while the real `process.stdin` / `process` / a spawned child still satisfy them.
 */

/** Max time to wait for `backend.stop()` before exiting anyway. */
export const STOP_TIMEOUT_MS: number;

/** Hard-exit backstop in case the shutdown sequence itself stalls. */
export const FORCE_EXIT_DELAY_MS: number;

/** Max time to wait for a graceful backend exit before force-killing it. */
export const KILL_GRACE_MS: number;

/** After a force-kill, max time to wait for the `exit` event before giving up. */
export const FORCE_KILL_BAIL_MS: number;

/**
 * True only for the `AbortError` family emitted when an MCP HTTP/SSE transport
 * is intentionally closed. Callers must additionally require an intentional
 * close latch; this predicate alone must never hide a live transport failure.
 */
export function isIntentionalTransportAbort(err: unknown): boolean;

/** The proxy's inbound stdin, subscribed to for client-disconnect signals. */
export interface ShutdownStdin {
  on(event: 'end' | 'close', listener: () => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
}

/** The process the shutdown sequence listens to for signals and exits through. */
export interface ShutdownProcess {
  on(event: 'SIGINT' | 'SIGTERM', listener: () => void): void;
  exit(code?: number): void;
}

/** Backend manager stopped before exit; `stop()` handles every transport mode. */
export interface StoppableBackend {
  stop(): Promise<void>;
}

/** The MCP `Server` whose `onclose` is chained — never `transport.onclose`. */
export interface CloseableServer {
  onclose?: (() => void) | undefined;
}

/** Dependencies of {@link installShutdownHandlers}. */
export interface ShutdownDeps {
  stdin: ShutdownStdin;
  backend: StoppableBackend;
  server?: CloseableServer;
  log?: (msg: string) => void;
  /** Injectable for tests; defaults to `process`. */
  proc?: ShutdownProcess;
  stopTimeoutMs?: number;
  forceExitDelayMs?: number;
}

/**
 * Install handlers that shut the proxy down when the MCP client disconnects.
 *
 * @returns the idempotent shutdown function, callable directly
 */
export function installShutdownHandlers(deps: ShutdownDeps): (reason: string) => Promise<void>;

/** The slice of a spawned child that {@link killChildGracefully} touches. */
export interface KillableChild {
  /** `undefined` when the spawn failed; it is passed straight to `forceKill`. */
  readonly pid?: number | undefined;
  /** `null` while the child is still running. */
  readonly exitCode: number | null;
  once(
    event: 'exit',
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): void;
  kill(signal?: NodeJS.Signals): void;
  /** `null` when the child was spawned without a stdin pipe. */
  readonly stdin: { destroyed: boolean; end(): void } | null;
}

/** Options of {@link killChildGracefully}. */
export interface KillChildOptions {
  log?: (msg: string) => void;
  killTimeoutMs?: number;
  /** Post-force-kill wait before giving up. */
  bailMs?: number;
  /** Injectable for tests; defaults to `process.platform`. */
  platform?: NodeJS.Platform;
  /**
   * Injectable for tests; defaults to `taskkill /F` on win32 and `SIGKILL`
   * elsewhere. Receives `child.pid` verbatim, which may be `undefined`.
   */
  forceKill?: (pid: number | undefined) => void;
}

/**
 * Kill a backend child gracefully (stdin close on win32, `SIGTERM` elsewhere),
 * then by force if it has not exited within `killTimeoutMs`.
 *
 * @returns resolves once the child exited, or once a force-kill was attempted
 *   and no exit surfaced within `bailMs`. A missing or already-exited child
 *   resolves immediately.
 */
export function killChildGracefully(
  child: KillableChild | null,
  opts?: KillChildOptions
): Promise<void>;
