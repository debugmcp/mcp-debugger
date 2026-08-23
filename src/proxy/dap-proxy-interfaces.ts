/**
 * Core interfaces and types for the DAP Proxy system
 * These abstractions enable dependency injection and testability
 */

import { ChildProcess, SpawnOptions } from 'child_process';
import { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy, LanguageSpecificLaunchConfig } from '@debugmcp/shared';
import type { IDapMirrorServerFactory } from './dap-mirror-server.js';

// ===== Core Message Types =====

export interface ProxyInitPayload {
  cmd: 'init';
  sessionId: string;
  /** Debug language for this session; selects the adapter policy directly.
   *  Optional for backward compatibility — absent on legacy payloads, where
   *  the policy is inferred from adapterCommand instead. */
  language?: string;
  executablePath: string;
  adapterHost: string;
  adapterPort: number;
  logDir: string;
  scriptPath: string;
  scriptArgs?: string[];
  stopOnEntry?: boolean;
  justMyCode?: boolean;
  initialBreakpoints?: { id?: string; file: string; line: number; condition?: string; logMessage?: string; suspendPolicy?: 'all' | 'thread' }[];
  initialFunctionBreakpoints?: { name: string; condition?: string }[];
  dryRunSpawn?: boolean;
  /** Effective log level for the per-session proxy logger; absent on legacy
   *  payloads, where the worker keeps its historical 'debug' default (issue #403) */
  logLevel?: string;
  /** Abstract break-on-exception mode; resolved to concrete DAP filters via the adapter policy (issue #220) */
  breakOnExceptions?: 'uncaught' | 'all' | 'none';
  launchConfig?: LanguageSpecificLaunchConfig;
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
  /**
   * Per-request timeout override (ms) for the worker request tracker and the
   * DAP socket. Absent = layer defaults (30s). Issue #142.
   */
  timeoutMs?: number;
}

export interface TerminatePayload {
  cmd: 'terminate';
  sessionId?: string;
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
  /** Adapter initialize response body, on 'adapter_capabilities' (issue #243) */
  capabilities?: DebugProtocol.Capabilities;
  /**
   * Pre-launch setFunctionBreakpoints results in request order, on
   * 'function_breakpoints_synced' (issue #302). Carries the adapter-assigned
   * ids to the parent, whose store otherwise learns them only from the
   * post-launch re-sync — too late for a stop that hits a function
   * breakpoint immediately at launch.
   */
  functionBreakpoints?: FunctionBreakpointSyncResult[];
  /**
   * Pre-launch setBreakpoints results, on 'breakpoints_synced' (issue #439).
   * For a launch that never pauses (logpoint-only short program) the
   * post-launch re-sync is gated off — the session is already STOPPED — so
   * this is the only path that ever stamps verified/adapterId in the store.
   */
  breakpoints?: BreakpointSyncResult[];
}

/** One entry of StatusMessage.breakpoints (issue #439). */
export interface BreakpointSyncResult {
  /**
   * Store breakpoint id echoed from the init payload — an exact-match key
   * immune to the worker's path.resolve canonicalization. Absent on legacy
   * payloads that carried no id.
   */
  id?: string;
  /** Requested file, as sent in initialBreakpoints (pre-resolution) */
  file: string;
  /** Requested line */
  line: number;
  verified: boolean;
  /** Adapter-assigned breakpoint id */
  adapterId?: number;
  /** Line the adapter actually bound (may differ from requested) */
  boundLine?: number;
  message?: string;
}

/** One entry of StatusMessage.functionBreakpoints (issue #302). */
export interface FunctionBreakpointSyncResult {
  name: string;
  verified: boolean;
  id?: number;
  line?: number;
  source?: string;
  /**
   * On terminal statuses (issue #258): true when the worker had already seen
   * orderly debuggee termination (a terminated/exited DAP event was forwarded
   * or shutdown was underway), so the parent can distinguish a normal
   * teardown from an adapter dying or dropping the socket mid-run.
   */
  expected?: boolean;
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
  readFile(path: string, encoding: 'utf8'): Promise<string>;
  remove(path: string): Promise<void>;
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
  sendRequest<T = unknown>(command: string, args?: unknown, timeoutMs?: number): Promise<T>;
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
  /**
   * Record the session's break-on-exception mode so DAP child sessions can
   * apply the same exception filters (issue #220). Optional: only
   * MinimalDapClient (js-debug child sessions) implements it.
   */
  setExceptionBreakMode?(mode: 'uncaught' | 'all' | 'none'): void;
  /**
   * Resolves once all child-session events enqueued so far (output included)
   * have been forwarded (issue #366). Optional: only MinimalDapClient
   * implements it. Absent method or an undefined return both mean the client
   * has no child sessions — nothing to flush (issue #378).
   */
  flushChildEvents?(): Promise<void> | undefined;
}

/**
 * Factory for creating DAP clients
 */
export interface IDapClientFactory {
  create(host: string, port: number, policy?: AdapterPolicy): IDapClient;
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
  (sessionId: string, logDir: string, level?: string): Promise<ILogger>;
}

// ===== Configuration Types =====

/**
 * Configuration for spawning the debug adapter
 */
export interface AdapterConfig {
  executablePath: string;
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
  track(requestId: string, command: string, timeoutMs?: number): void;
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
  /**
   * Factory for the per-session DAP mirror listener (issue #217). Optional:
   * a worker without it answers mirrorExpose with a clean error, and unit
   * tests that don't exercise the mirror need no fake.
   */
  mirrorServerFactory?: IDapMirrorServerFactory;
}

// ===== DAP mirror pseudo-commands (issue #217) =====
// Sent by the parent through the normal `dap` envelope and intercepted at
// the top of DapProxyWorker.handleDapCommand — they never reach the adapter.

export const MIRROR_EXPOSE_COMMAND = 'mirrorExpose';
export const MIRROR_UNEXPOSE_COMMAND = 'mirrorUnexpose';

// IPC watchdog message types sent by the worker (dap-proxy-core.ts) and
// matched by ProxyManager.handleProxyMessage — shared so the coupling is
// compiler-checked rather than a keep-in-sync comment.
export const IPC_HEARTBEAT = 'ipc-heartbeat';
export const IPC_HEARTBEAT_TICK = 'ipc-heartbeat-tick';

// ===== DAP Types Extensions =====

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
