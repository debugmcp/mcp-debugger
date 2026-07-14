/**
 * High-level process management interfaces for better abstraction and testability
 * These interfaces provide domain-specific abstractions over low-level process operations
 */

import { EventEmitter } from 'events';

/**
 * High-level process interface that abstracts Node.js ChildProcess details
 * Provides a cleaner API focused on what we actually need
 */
export interface IProcess extends EventEmitter {
  pid: number | undefined;
  stdin: NodeJS.WritableStream | null;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  
  send(message: unknown): boolean;
  kill(signal?: string): boolean;
  
  // Lifecycle state
  readonly killed: boolean;
  readonly exitCode: number | null;
  readonly signalCode: string | null;
}

/**
 * Options for launching processes
 * Simplified from Node.js SpawnOptions to focus on what we need
 */
export interface IProcessOptions {
  cwd?: string;
  env?: Record<string, string>;
  shell?: boolean;
  stdio?: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Required for Node.js StdioOptions compatibility
  detached?: boolean;
}

/**
 * Specialized launcher for proxy processes
 * Handles the specific needs of launching and managing proxy processes
 */
export interface IProxyProcessLauncher {
  launchProxy(
    proxyScriptPath: string,
    sessionId: string,
    env?: Record<string, string>
  ): IProxyProcess;
}

/**
 * Represents a launched proxy process
 * Extends IProcess with proxy-specific functionality
 */
export interface IProxyProcess extends IProcess {
  sessionId: string;
  sendCommand(command: object): void;
  waitForInitialization(timeout?: number): Promise<void>;
}

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
}
