/**
 * Core interfaces and types for the DAP Proxy system
 * These abstractions enable dependency injection and testability
 */

import { ChildProcess, SpawnOptions } from 'child_process';
import { DebugProtocol } from '@vscode/debugprotocol';

// ===== Core Message Types =====

export interface ProxyInitPayload {
  cmd: 'init';
  sessionId: string;
  pythonPath: string;
  adapterHost: string;
  adapterPort: number;
  logDir: string;
  scriptPath: string;
  scriptArgs?: string[];
  stopOnEntry?: boolean;
  justMyCode?: boolean;
  initialBreakpoints?: { file: string; line: number; condition?: string }[];
  dryRunSpawn?: boolean;
  // Adapter command info for language-agnostic adapter spawning
  adapterCommand?: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };
}

export interface DapCommandPayload {
  cmd: 'dap';
  requestId: string;
  dapCommand: string;
  dapArgs?: unknown;
  sessionId: string;
}

export interface TerminatePayload {
  cmd: 'terminate';
  sessionId: string;
}

export type ParentCommand = ProxyInitPayload | DapCommandPayload | TerminatePayload;

// ===== Response Types =====

export interface ProxyMessage {
  type: 'status' | 'dapResponse' | 'dapEvent' | 'error';
  sessionId: string;
  [key: string]: unknown;
}

export interface StatusMessage extends ProxyMessage {
  type: 'status';
  status: string;
  code?: number | null;
  signal?: NodeJS.Signals | null;
  command?: string;
  script?: string;
}

export interface DapResponseMessage extends ProxyMessage {
  type: 'dapResponse';
  requestId: string;
  success: boolean;
  body?: unknown;
  response?: DebugProtocol.Response;
  error?: string;
}

export interface DapEventMessage extends ProxyMessage {
  type: 'dapEvent';
  event: string;
  body: unknown;
}

export interface ErrorMessage extends ProxyMessage {
  type: 'error';
  message: string;
}

// ===== Core Abstractions =====

/**
 * Logger interface for dependency injection
 */
export interface ILogger {
  info(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
}

/**
 * File system operations abstraction
 */
export interface IFileSystem {
  ensureDir(path: string): Promise<void>;
  pathExists(path: string): Promise<boolean>;
}

/**
 * Process spawning abstraction
 */
export interface IProcessSpawner {
  spawn(command: string, args: string[], options: SpawnOptions): ChildProcess;
}

/**
 * DAP client abstraction matching MinimalDapClient interface
 */
export interface IDapClient {
  connect(): Promise<void>;
  sendRequest<T = unknown>(command: string, args?: unknown): Promise<T>;
  disconnect(): void;
  /**
   * Reject all pending requests, clear timers, dispose resources.
   * Should be idempotent.
   */
  shutdown(reason?: string): void;
  on(event: string, handler: (...args: any[]) => void): void; // eslint-disable-line @typescript-eslint/no-explicit-any
  off(event: string, handler: (...args: any[]) => void): void; // eslint-disable-line @typescript-eslint/no-explicit-any
  once(event: string, handler: (...args: any[]) => void): void; // eslint-disable-line @typescript-eslint/no-explicit-any
  removeAllListeners(): void;
}

/**
 * Factory for creating DAP clients
 */
export interface IDapClientFactory {
  create(host: string, port: number): IDapClient;
}

/**
 * Message sender abstraction for IPC communication
 */
export interface IMessageSender {
  send(message: unknown): void;
}

/**
 * Logger factory for delayed initialization
 */
export interface ILoggerFactory {
  (sessionId: string, logDir: string): Promise<ILogger>;
}

// ===== Configuration Types =====

/**
 * Configuration for spawning the debugpy adapter
 */
export interface AdapterConfig {
  pythonPath: string;
  host: string;
  port: number;
  logDir: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Spawn result from adapter manager
 */
export interface AdapterSpawnResult {
  process: ChildProcess;
  pid: number;
}

// ===== State Management =====

/**
 * Proxy worker state for state machine pattern
 */
export enum ProxyState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  CONNECTED = 'connected',
  SHUTTING_DOWN = 'shutting_down',
  TERMINATED = 'terminated'
}

/**
 * Request tracking information
 */
export interface TrackedRequest {
  requestId: string;
  command: string;
  timer: NodeJS.Timeout;
  timestamp: number;
}

/**
 * Request tracker interface
 */
export interface IRequestTracker {
  track(requestId: string, command: string, timeoutMs: number): void;
  complete(requestId: string): void;
  clear(): void;
  getPending(): Map<string, TrackedRequest>;
}

// ===== Worker Dependencies =====

/**
 * All dependencies needed by DapProxyWorker
 */
export interface DapProxyDependencies {
  loggerFactory: ILoggerFactory;
  fileSystem: IFileSystem;
  processSpawner: IProcessSpawner;
  dapClientFactory: IDapClientFactory;
  messageSender: IMessageSender;
}

// ===== DAP Types Extensions =====

/**
 * Extended launch arguments with required program field
 */
export interface ExtendedLaunchArgs extends DebugProtocol.LaunchRequestArguments {
  program: string;
  stopOnEntry?: boolean;
  noDebug?: boolean;
  args?: string[];
  cwd?: string;
  console?: string;
  justMyCode?: boolean;
  [key: string]: unknown;
}

/**
 * Extended initialize arguments with our custom fields
 */
export interface ExtendedInitializeArgs extends DebugProtocol.InitializeRequestArguments {
  clientID: string;
  clientName: string;
  adapterID: string;
  pathFormat: 'path';
  linesStartAt1: boolean;
  columnsStartAt1: boolean;
  supportsVariableType: boolean;
  supportsRunInTerminalRequest: boolean;
  locale: string;
}
