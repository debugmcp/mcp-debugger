/**
 * Session-related data models
 */
import { DebugProtocol } from '@vscode/debugprotocol';

/**
 * Custom launch arguments interface extending DebugProtocol.LaunchRequestArguments
 */
export interface CustomLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  stopOnEntry?: boolean;
  justMyCode?: boolean;
  console?: string;
  cwd?: string;
  env?: Record<string, string>;
}

/**
 * Process identifier type for attach operations
 */
export enum ProcessIdentifierType {
  /** Attach to process by ID (PID) */
  PID = 'pid',
  /** Attach to process by name */
  NAME = 'name',
  /** Attach to remote debugger by host:port */
  REMOTE = 'remote'
}

/**
 * Generic attach configuration (common across languages)
 */
export interface GenericAttachConfig {
  /** Request type */
  request: 'attach';

  /** Process identifier type */
  identifierType?: ProcessIdentifierType;

  /** Process ID (for PID-based attach) */
  processId?: number | string;

  /** Process name (for name-based attach) */
  processName?: string;

  /** Remote host (for remote debugging) */
  host?: string;

  /** Remote port (for remote debugging) */
  port?: number;

  /** Connection timeout in milliseconds */
  timeout?: number;

  /** Source paths for mapping (optional) */
  sourcePaths?: string[];

  /** Stop on entry after attaching */
  stopOnEntry?: boolean;

  /** Just my code (exclude library code) */
  justMyCode?: boolean;

  /** Environment variables */
  env?: Record<string, string>;

  /** Working directory */
  cwd?: string;

  /** Additional language-specific options */
  [key: string]: unknown;
}

/**
 * Language-specific attach configuration (resolved by adapter)
 */
export type LanguageSpecificAttachConfig = Record<string, unknown>;

/**
 * Supported debugger languages
 */
export enum DebugLanguage {
  PYTHON = 'python',
  RUBY = 'ruby',
  JAVASCRIPT = 'javascript',
  RUST = 'rust',
  GO = 'go',
  JAVA = 'java',
  DOTNET = 'dotnet',
  MOCK = 'mock',  // Mock adapter for testing
}

/**
 * Session lifecycle state - represents the session's existence
 */
export enum SessionLifecycleState {
  /** Session is created but not initialized */
  CREATED = 'created',
  /** Session is active and can accept debug operations */
  ACTIVE = 'active',
  /** Session has been terminated and cannot accept operations */
  TERMINATED = 'terminated'
}

/**
 * Execution state - represents the debugger's execution state
 * Only meaningful when SessionLifecycleState is ACTIVE
 */
export enum ExecutionState {
  /** Debug adapter is initializing */
  INITIALIZING = 'initializing',
  /** Program is running */
  RUNNING = 'running',
  /** Program is paused (at breakpoint, step, etc.) */
  PAUSED = 'paused',
  /** Program has terminated but session is still active */
  TERMINATED = 'terminated',
  /** Debug adapter encountered an error */
  ERROR = 'error'
}

/**
 * Debug session state (legacy - for backward compatibility)
 * @deprecated Use SessionLifecycleState and ExecutionState instead
 */
export enum SessionState {
  /** Session is created but not initialized */
  CREATED = 'created',
  /** Session is initializing */
  INITIALIZING = 'initializing',
  /** Session is ready to start debugging */
  READY = 'ready',
  /** Session is running */
  RUNNING = 'running',
  /** Session is paused at a breakpoint */
  PAUSED = 'paused',
  /** Session has stopped */
  STOPPED = 'stopped',
  /** Session encountered an error */
  ERROR = 'error'
}

/**
 * Maps legacy SessionState to new state model
 */
export function mapLegacyState(legacyState: SessionState): { lifecycle: SessionLifecycleState; execution?: ExecutionState } {
  switch (legacyState) {
    case SessionState.CREATED:
      return { lifecycle: SessionLifecycleState.CREATED };
    case SessionState.INITIALIZING:
    case SessionState.READY:
      return { lifecycle: SessionLifecycleState.ACTIVE, execution: ExecutionState.INITIALIZING };
    case SessionState.RUNNING:
      return { lifecycle: SessionLifecycleState.ACTIVE, execution: ExecutionState.RUNNING };
    case SessionState.PAUSED:
      return { lifecycle: SessionLifecycleState.ACTIVE, execution: ExecutionState.PAUSED };
    case SessionState.STOPPED:
      return { lifecycle: SessionLifecycleState.TERMINATED };
    case SessionState.ERROR:
      return { lifecycle: SessionLifecycleState.ACTIVE, execution: ExecutionState.ERROR };
    default: {
      const _exhaustive: never = legacyState;
      throw new Error(`Unknown session state: ${_exhaustive}`);
    }
  }
}

/**
 * Maps new state model to legacy SessionState
 */
export function mapToLegacyState(lifecycle: SessionLifecycleState, execution?: ExecutionState): SessionState {
  if (lifecycle === SessionLifecycleState.CREATED) {
    return SessionState.CREATED;
  }
  if (lifecycle === SessionLifecycleState.TERMINATED) {
    return SessionState.STOPPED;
  }
  // ACTIVE state - check execution state
  switch (execution) {
    case ExecutionState.INITIALIZING:
      return SessionState.INITIALIZING;
    case ExecutionState.RUNNING:
      return SessionState.RUNNING;
    case ExecutionState.PAUSED:
      return SessionState.PAUSED;
    case ExecutionState.TERMINATED:
      return SessionState.STOPPED;
    case ExecutionState.ERROR:
      return SessionState.ERROR;
    default:
      return SessionState.READY;
  }
}

/**
 * Debug session configuration
 */
export interface SessionConfig {
  /** Programming language */
  language: DebugLanguage;
  /** Session name */
  name: string;
  /** Optional executable path for the language runtime */
  executablePath?: string;
}

/**
 * Breakpoint definition
 */
export interface Breakpoint {
  /** Unique identifier */
  id: string;
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Conditional expression (if any) */
  condition?: string;
  /** Logpoint: log this interpolated message instead of pausing (DAP logMessage) */
  logMessage?: string;
  /** Suspend policy: 'all' suspends all threads (default), 'thread' only suspends the event thread */
  suspendPolicy?: 'all' | 'thread';
  /** Whether the breakpoint is verified */
  verified: boolean;
  /** Validation message from DAP adapter */
  message?: string;
  /** Breakpoint id assigned by the debug adapter (from setBreakpoints responses / breakpoint events) */
  adapterId?: number;
  /**
   * The line originally requested by the client, recorded before the adapter
   * had a chance to bind elsewhere. Present only in assert/content addressing
   * modes (issue #271); `line` !== `requestedLine` means the adapter snapped
   * the breakpoint. Never sent to the adapter.
   */
  requestedLine?: number;
  /**
   * Content anchor this breakpoint was addressed by (issue #271).
   * restart_debugging re-resolves the anchor against the current file so the
   * breakpoint survives the edit that was the point of the session. Never
   * sent to the adapter.
   */
  anchor?: {
    statement: string;
    nearLine?: number;
  };
}

/**
 * Function breakpoint (issue #271, phase 3): addressed by symbol name via DAP
 * setFunctionBreakpoints. Session-global (not file-scoped); names survive
 * file edits better than lines or statements.
 */
export interface FunctionBreakpoint {
  /** Unique identifier (same UUID namespace as line breakpoints) */
  id: string;
  /** Symbol name the breakpoint is addressed by */
  functionName: string;
  /** Conditional expression (if any) */
  condition?: string;
  /** Whether the breakpoint is verified */
  verified: boolean;
  /** Validation message from DAP adapter */
  message?: string;
  /** Breakpoint id assigned by the debug adapter */
  adapterId?: number;
  /** Source file the adapter bound the function to (from the DAP response) */
  boundFile?: string;
  /** Line the adapter bound the function to (from the DAP response) */
  boundLine?: number;
}

/**
 * Debug session information
 */
export interface DebugSession {
  /** Unique session ID */
  id: string;
  /** Programming language */
  language: DebugLanguage;
  /** Session name */
  name: string;
  /** Session state (legacy) */
  state: SessionState;
  /** Session lifecycle state */
  sessionLifecycle: SessionLifecycleState;
  /** Execution state */
  executionState?: ExecutionState;
  /** Current file */
  currentFile?: string;
  /** Current line */
  currentLine?: number;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** Active breakpoints mapped by ID */
  breakpoints: Map<string, Breakpoint>;
}

/**
 * Subset of DebugSession for list operations (if needed, otherwise use DebugSession)
 */
/**
 * Details of the most recent user-visible stop (issue #214).
 * Auto-continued entry stops are not recorded.
 */
export interface SessionStopInfo {
  /** DAP stop reason, e.g. 'breakpoint', 'exception', 'step', 'pause', 'entry' */
  reason: string;
  /**
   * The adapter-reported reason before policy normalization (e.g. CodeLLDB's
   * 'exception' for a SIGSTOP-delivered pause). Present only when
   * normalization changed the reason.
   */
  rawReason?: string;
  threadId?: number;
  /** Epoch milliseconds when the stop was observed */
  timestamp: number;
  /** DAP stopped-event description, e.g. the exception class ('ZeroDivisionError') */
  description?: string;
  /** DAP stopped-event text, e.g. the exception message ('division by zero') */
  text?: string;
  /**
   * Best-effort DAP exceptionInfo enrichment for exception stops (issue #243).
   * Requested asynchronously after the pause, so it may appear a moment after
   * the stop is first observable; absent when the adapter doesn't support
   * exceptionInfo or the request failed.
   */
  exceptionInfo?: SessionStopExceptionInfo;
}

/**
 * Lean projection of the DAP exceptionInfo response merged into
 * SessionStopInfo (issue #243).
 */
export interface SessionStopExceptionInfo {
  /** Adapter-specific exception identifier, e.g. the exception class */
  exceptionId: string;
  /** DAP ExceptionBreakMode: 'never' | 'always' | 'unhandled' | 'userUnhandled' */
  breakMode: string;
  description?: string;
  details?: {
    message?: string;
    typeName?: string;
    fullTypeName?: string;
    stackTrace?: string;
  };
}

/**
 * Abstract break-on-exception mode (issue #220). Mapped per-language to
 * concrete DAP exceptionBreakpointFilters by the adapter policy.
 */
export type ExceptionBreakMode = 'uncaught' | 'all' | 'none';

/**
 * One captured debuggee output event (issue #218).
 * Buffered per launch; exposed via the get_output tool and the
 * debug://sessions/{id}/output resource.
 */
export interface SessionOutputEntry {
  /** Monotonic per-launch sequence number, starting at 1 */
  seq: number;
  /** DAP output category: 'stdout', 'stderr', 'console', 'important', ... ('console' when the adapter omits it) */
  category: string;
  /** Output text as emitted by the adapter (chunking is adapter-defined; may end with a newline) */
  output: string;
  /** Epoch milliseconds when the server received the event */
  timestamp: number;
  /** Present and true when the entry exceeded the per-entry size cap and was cut */
  truncated?: boolean;
  /** Present and true when secret-shaped values were masked in this entry (issue #237) */
  redacted?: boolean;
}

export interface DebugSessionInfo {
  id: string;
  language: DebugLanguage;
  name: string;
  state: SessionState;
  createdAt: Date;
  updatedAt?: Date; // Optional, as it might not always be present or needed for list views
  /** Why the session last stopped; present after the first user-visible stop */
  lastStop?: SessionStopInfo;
  /** Debuggee exit code from the DAP 'exited' event, when the adapter reports one */
  exitCode?: number;
  /**
   * Live DAP mirror endpoint from expose_session (issue #217), host/port
   * only — the attach token is returned solely by the expose_session tool.
   */
  exposure?: { host: string; port: number };
}


/**
 * Variable information
 */
export interface Variable {
  /** Variable name */
  name: string;
  /** Variable value */
  value: string;
  /** Variable type */
  type: string;
  /** Whether the variable is expandable */
  expandable: boolean;
  /** Variable children (for complex objects) */
  children?: Variable[];
  /** Present and true when the value was masked as a secret (issue #237) */
  redacted?: boolean;
}

/**
 * Stack frame information
 */
export interface StackFrame {
  /** Frame ID */
  id: number;
  /** Frame name */
  name: string;
  /** Source file */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column?: number;
}

/**
 * Debug location information
 */
export interface DebugLocation {
  /** Source file */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column?: number;
  /** Source code around the location */
  sourceLines?: string[];
  /** The specific line number in the source lines array that corresponds to the current location */
  sourceLine?: number;
}
