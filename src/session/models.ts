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
  // Add other common custom arguments here if needed, e.g., console, cwd, env
}

/**
 * Supported debugger languages
 */
export enum DebugLanguage {
  PYTHON = 'python',
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
  /** Whether the breakpoint is verified */
  verified: boolean;
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
export interface DebugSessionInfo {
  id: string;
  language: DebugLanguage;
  name: string;
  state: SessionState;
  createdAt: Date;
  updatedAt?: Date; // Optional, as it might not always be present or needed for list views
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
