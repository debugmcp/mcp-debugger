/**
 * Debugger provider interface
 * 
 * This file defines the interface that all language-specific debugger providers must implement.
 */

import { Breakpoint, DebugLocation, StackFrame, Variable } from '../session/models.js'; // Removed DebugSession

/**
 * Debug session configuration
 */
export interface DebuggerConfig {
  /** Session ID */
  sessionId: string;
  /** Debug adapter path or command */
  adapterPath?: string;
  /** Additional configuration options */
  options?: Record<string, unknown>;
}

/**
 * Debug execution result
 */
export interface DebugResult {
  /** Success status */
  success: boolean;
  /** Error message (if any) */
  error?: string;
  /** Current file path */
  currentFile?: string;
  /** Current line number */
  currentLine?: number;
  /** Current state */
  state: string;
  /** Debug location details */
  location?: DebugLocation;
  /** Additional result data */
  data?: Record<string, unknown>;
}

/**
 * Debugger provider interface
 */
export interface DebuggerProvider {
  /**
   * Initialize the debugger
   * 
   * @param config - Debugger configuration
   * @returns True if initialized successfully
   */
  initialize(config: DebuggerConfig): Promise<boolean>;
  
  /**
   * Set a breakpoint
   * 
   * @param file - File path
   * @param line - Line number
   * @param condition - Optional condition
   * @returns The created breakpoint
   */
  setBreakpoint(file: string, line: number, condition?: string): Promise<Breakpoint>;
  
  /**
   * Remove a breakpoint
   * 
   * @param id - Breakpoint ID
   * @returns True if removed successfully
   */
  removeBreakpoint(id: string): Promise<boolean>;
  
  /**
   * Start debugging
   * 
   * @param scriptPath - Path to the script to debug
   * @param args - Command line arguments
   * @returns Debug execution result
   */
  startDebugging(scriptPath: string, args?: string[]): Promise<DebugResult>;
  
  /**
   * Step over the current line
   * 
   * @returns Debug execution result
   */
  stepOver(): Promise<DebugResult>;
  
  /**
   * Step into a function call
   * 
   * @returns Debug execution result
   */
  stepInto(): Promise<DebugResult>;
  
  /**
   * Step out of the current function
   * 
   * @returns Debug execution result
   */
  stepOut(): Promise<DebugResult>;
  
  /**
   * Continue execution to the next breakpoint
   * 
   * @returns Debug execution result
   */
  continue(): Promise<DebugResult>;
  
  /**
   * Pause execution
   * 
   * @returns Debug execution result
   */
  pause(): Promise<DebugResult>;
  
  /**
   * Get variables in the current scope
   * 
   * @param scope - Variable scope (local, global, etc.)
   * @returns List of variables
   */
  getVariables(scope?: string): Promise<Variable[]>;
  
  /**
   * Evaluate an expression in the current context
   * 
   * @param expression - Expression to evaluate
   * @returns Evaluation result
   */
  evaluateExpression(expression: string): Promise<unknown>;
  
  /**
   * Get the current stack trace
   * 
   * @returns Stack frames
   */
  getStackTrace(): Promise<StackFrame[]>;
  
  /**
   * Get source code around a location
   * 
   * @param file - File path
   * @param line - Line number
   * @param linesContext - Number of context lines
   * @returns Debug location with source
   */
  getSourceContext(file: string, line: number, linesContext?: number): Promise<DebugLocation>;
  
  /**
   * Terminate the debugging session
   * 
   * @returns True if terminated successfully
   */
  terminate(): Promise<boolean>;
}
