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
  windowsHide?: boolean;
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
 *
 * Ordering contract: `exit` is emitted only after every `message` the child
 * sent has been forwarded (issue #729). A consumer may therefore treat an
 * `exit` that arrives before an expected status message as that message never
 * having been sent. `exitCode` and `signalCode` are null until that `exit`
 * is emitted and set with it (issue #735): a consumer reading them sees the
 * same exit the event reports, never one still being held back, so "both
 * null" means "running" for as long as the process has not reported its
 * exit — which is what ProxyManager.isRunning() and stop() rely on.
 */
export interface IProxyProcess extends IProcess {
  sessionId: string;
  sendCommand(command: object): void;
  waitForInitialization(timeout?: number): Promise<void>;
}
