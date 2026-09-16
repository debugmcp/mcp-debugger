/**
 * App-local process interfaces.
 *
 * `ProcessLike` is the only process interface declared here. The child-process
 * contracts (`IProcess`, `IProcessOptions`, `IProxyProcessLauncher`,
 * `IProxyProcess`) live in `@debugmcp/shared`; the app-local copies were
 * removed in #692 because identical-today duplicates drift silently.
 */

/**
 * Minimal handle on the CURRENT process (issue #183).
 *
 * Structurally satisfied by the global `process` and by EventEmitter-backed
 * fakes (see tests/test-utils/mocks/fake-current-process.ts). Members are
 * deliberately widened relative to NodeJS.Process where the exact Node types
 * (tty stream intersections, `never` returns, per-event listener overloads)
 * would make fakes unimplementable:
 *  - stdin/stdout are the generic stream interfaces (readline only needs these)
 *  - exit returns void instead of never
 *  - on/removeListener/listeners use EventEmitter's general signatures
 *
 * `send` is optional exactly like NodeJS.Process['send']: absence of the
 * member models a process spawned without an IPC channel, and IPC-mode
 * detection remains `typeof proc.send === 'function'`.
 */
export interface ProcessLike {
  /* eslint-disable @typescript-eslint/no-explicit-any -- general EventEmitter signatures; required for structural compat with NodeJS.Process */
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- must match EventEmitter#listeners return type for assignability
  listeners(event: string | symbol): Function[];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- must match EventEmitter#rawListeners return type for assignability
  rawListeners(event: string | symbol): Function[];
  listenerCount(event: string | symbol): number;

  exit(code?: number): void;
  send?(message: unknown): boolean;
  connected: boolean;

  env: NodeJS.ProcessEnv;
  argv: string[];
  uptime(): number;

  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  /** Optional: only startup-failure reporting writes here (issue #667); fakes may omit it. */
  stderr?: NodeJS.WritableStream;
}
