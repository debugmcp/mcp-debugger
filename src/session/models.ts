/**
 * Session-related data models
 */

/**
 * Supported debugger languages
 */
export enum DebugLanguage {
  PYTHON = 'python',
}

/**
 * Debug session state
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
 * Debug session configuration
 */
export interface SessionConfig {
  /** Programming language */
  language: DebugLanguage;
  /** Session name */
  name: string;
  /** Optional Python executable path, if language is Python */
  pythonPath?: string;
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
  /** Session state */
  state: SessionState;
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
