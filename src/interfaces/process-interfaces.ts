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
  
  send(message: any): boolean;
  kill(signal?: string): boolean;
  
  // Lifecycle state
  readonly killed: boolean;
  readonly exitCode: number | null;
  readonly signalCode: string | null;
}

/**
 * General purpose process launcher
 * Provides a higher-level API than raw spawn/exec
 */
export interface IProcessLauncher {
  launch(command: string, args: string[], options?: IProcessOptions): IProcess;
}

/**
 * Options for launching processes
 * Simplified from Node.js SpawnOptions to focus on what we need
 */
export interface IProcessOptions {
  cwd?: string;
  env?: Record<string, string>;
  shell?: boolean;
  stdio?: any; // Keep flexible for IPC support
  detached?: boolean;
}

/**
 * Specialized launcher for Python debug targets
 * Encapsulates the complexity of launching debugpy-enabled Python processes
 */
export interface IDebugTargetLauncher {
  launchPythonDebugTarget(
    scriptPath: string,
    args: string[],
    pythonPath?: string,
    debugPort?: number
  ): Promise<IDebugTarget>;
}

/**
 * Represents a launched debug target
 * Encapsulates the process and debug connection details
 */
export interface IDebugTarget {
  process: IProcess;
  debugPort: number;
  terminate(): Promise<void>;
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
 * Factory for creating process launchers
 * Allows for easy swapping between production and test implementations
 */
export interface IProcessLauncherFactory {
  createProcessLauncher(): IProcessLauncher;
  createDebugTargetLauncher(): IDebugTargetLauncher;
  createProxyProcessLauncher(): IProxyProcessLauncher;
}
