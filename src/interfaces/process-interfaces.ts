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
