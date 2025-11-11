/**
 * Core Debug Adapter Interface for multi-language debugging support
 * 
 * This interface defines the contract that all language-specific debug adapters
 * must implement. It abstracts the Debug Adapter Protocol (DAP) operations
 * while allowing language-specific implementations.
 * 
 * Design Principles:
 * - Language agnostic
 * - Async-first for all operations
 * - Event-driven for state changes
 * - Minimal overhead (< 5ms per operation)
 * 
 * @since 2.0.0
 */
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import { DebugLanguage } from '../models/index.js';
import type { AdapterLaunchBarrier } from './adapter-launch-barrier.js';

/**
 * Core debug adapter interface that all language adapters must implement
 */
export interface IDebugAdapter extends EventEmitter {
  readonly language: DebugLanguage;
  readonly name: string; // e.g., "Python Debug Adapter", "Node.js Debug Adapter"
  
  // ===== Lifecycle Management =====
  
  /**
   * Initialize the adapter and validate the environment
   */
  initialize(): Promise<void>;
  
  /**
   * Clean up resources and connections
   */
  dispose(): Promise<void>;
  
  // ===== State Management =====
  
  /**
   * Get the current adapter state
   */
  getState(): AdapterState;
  
  /**
   * Check if the adapter is ready for debugging
   */
  isReady(): boolean;
  
  /**
   * Get the current thread ID (if debugging)
   */
  getCurrentThreadId(): number | null;
  
  // ===== Environment Validation =====
  
  /**
   * Validate that the environment is properly configured for debugging
   */
  validateEnvironment(): Promise<ValidationResult>;
  
  /**
   * Get list of required dependencies for this adapter
   */
  getRequiredDependencies(): DependencyInfo[];
  
  // ===== Executable Management =====
  
  /**
   * Resolve the path to the language executable
   * @param preferredPath Optional user-specified path
   */
  resolveExecutablePath(preferredPath?: string): Promise<string>;
  
  /**
   * Get the default executable name for this language
   * @example 'python', 'node', 'go'
   */
  getDefaultExecutableName(): string;
  
  /**
   * Get platform-specific paths to search for the executable
   */
  getExecutableSearchPaths(): string[];
  
  // ===== Adapter Configuration =====
  
  /**
   * Build the command to launch the debug adapter
   */
  buildAdapterCommand(config: AdapterConfig): AdapterCommand;
  
  /**
   * Get the debug adapter module name
   * @example 'debugpy.adapter', 'node-debug2'
   */
  getAdapterModuleName(): string;
  
  /**
   * Get the command to install the debug adapter
   * @example 'pip install debugpy', 'npm install -g node-debug2'
   */
  getAdapterInstallCommand(): string;

  /**
   * Optionally provide a launch barrier that customizes how ProxyManager should
   * coordinate a specific DAP request (e.g., fire-and-forget launches).
   */
  createLaunchBarrier?(command: string, args?: unknown): AdapterLaunchBarrier | undefined;
  
  // ===== Debug Configuration =====
  
  /**
   * Transform generic launch config to language-specific format
   */
  transformLaunchConfig(config: GenericLaunchConfig): LanguageSpecificLaunchConfig;
  
  /**
   * Get default launch configuration for this language
   */
  getDefaultLaunchConfig(): Partial<GenericLaunchConfig>;
  
  // ===== DAP Protocol Operations =====
  
  /**
   * Send a DAP request through the adapter
   */
  sendDapRequest<T extends DebugProtocol.Response>(
    command: string, 
    args?: unknown
  ): Promise<T>;
  
  /**
   * Handle incoming DAP event
   */
  handleDapEvent(event: DebugProtocol.Event): void;
  
  /**
   * Handle incoming DAP response
   */
  handleDapResponse(response: DebugProtocol.Response): void;
  
  // ===== Connection Management =====
  
  /**
   * Connect to the debug adapter
   */
  connect(host: string, port: number): Promise<void>;
  
  /**
   * Disconnect from the debug adapter
   */
  disconnect(): Promise<void>;
  
  /**
   * Check if connected to the debug adapter
   */
  isConnected(): boolean;
  
  // ===== Error Handling =====
  
  /**
   * Get installation instructions for this language's debugger
   */
  getInstallationInstructions(): string;
  
  /**
   * Get error message when executable is missing
   */
  getMissingExecutableError(): string;
  
  /**
   * Translate generic errors to language-specific messages
   */
  translateErrorMessage(error: Error): string;
  
  // ===== Feature Support =====
  
  /**
   * Check if a specific debug feature is supported
   */
  supportsFeature(feature: DebugFeature): boolean;
  
  /**
   * Get requirements for a specific feature
   */
  getFeatureRequirements(feature: DebugFeature): FeatureRequirement[];
  
  /**
   * Get full capability declaration
   */
  getCapabilities(): AdapterCapabilities;
}

// ===== Supporting Types =====

/**
 * Adapter state enumeration
 */
export enum AdapterState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  CONNECTED = 'connected',
  DEBUGGING = 'debugging',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

/**
 * Environment validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  code: string;
  message: string;
  recoverable: boolean;
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  code: string;
  message: string;
}

/**
 * Dependency information
 */
export interface DependencyInfo {
  name: string;
  version?: string;
  required: boolean;
  installCommand?: string;
}

/**
 * Command to launch debug adapter
 */
export interface AdapterCommand {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  sessionId: string;
  executablePath: string;
  adapterHost: string;
  adapterPort: number;
  logDir: string;
  scriptPath: string;
  scriptArgs?: string[];
  launchConfig: GenericLaunchConfig;
}

/**
 * Generic launch configuration (common across languages)
 */
export interface GenericLaunchConfig {
  stopOnEntry?: boolean;
  justMyCode?: boolean;
  env?: Record<string, string>;
  cwd?: string;
  args?: string[];
  // Common debug configuration options
}

/**
 * Language-specific launch configuration
 */
export interface LanguageSpecificLaunchConfig extends GenericLaunchConfig {
  // Language-specific additions
  [key: string]: unknown;
}


/**
 * Debug features enumeration (from DAP spec)
 */
export enum DebugFeature {
  CONDITIONAL_BREAKPOINTS = 'conditionalBreakpoints',
  FUNCTION_BREAKPOINTS = 'functionBreakpoints',
  EXCEPTION_BREAKPOINTS = 'exceptionBreakpoints',
  VARIABLE_PAGING = 'variablePaging',
  EVALUATE_FOR_HOVERS = 'evaluateForHovers',
  SET_VARIABLE = 'setVariable',
  SET_EXPRESSION = 'setExpression',
  DATA_BREAKPOINTS = 'dataBreakpoints',
  DISASSEMBLE_REQUEST = 'disassembleRequest',
  TERMINATE_THREADS_REQUEST = 'terminateThreadsRequest',
  DELAYED_STACK_TRACE_LOADING = 'delayedStackTraceLoading',
  LOADED_SOURCES_REQUEST = 'loadedSourcesRequest',
  LOG_POINTS = 'logPoints',
  TERMINATE_REQUEST = 'terminateRequest',
  RESTART_REQUEST = 'restartRequest',
  EXCEPTION_OPTIONS = 'exceptionOptions',
  EXCEPTION_INFO_REQUEST = 'exceptionInfoRequest',
  STEP_BACK = 'stepBack',
  REVERSE_DEBUGGING = 'reverseDebugging',
  STEP_IN_TARGETS_REQUEST = 'stepInTargetsRequest'
}

/**
 * Feature requirement details
 */
export interface FeatureRequirement {
  type: 'dependency' | 'version' | 'configuration';
  description: string;
  required: boolean;
}

/**
 * Full adapter capabilities (mirrors DAP capabilities)
 */
export interface AdapterCapabilities {
  supportsConfigurationDoneRequest?: boolean;
  supportsFunctionBreakpoints?: boolean;
  supportsConditionalBreakpoints?: boolean;
  supportsHitConditionalBreakpoints?: boolean;
  supportsEvaluateForHovers?: boolean;
  exceptionBreakpointFilters?: ExceptionBreakpointFilter[];
  supportsStepBack?: boolean;
  supportsSetVariable?: boolean;
  supportsRestartFrame?: boolean;
  supportsGotoTargetsRequest?: boolean;
  supportsStepInTargetsRequest?: boolean;
  supportsCompletionsRequest?: boolean;
  completionTriggerCharacters?: string[];
  supportsModulesRequest?: boolean;
  additionalModuleColumns?: DebugProtocol.ColumnDescriptor[];
  supportedChecksumAlgorithms?: DebugProtocol.ChecksumAlgorithm[];
  supportsRestartRequest?: boolean;
  supportsExceptionOptions?: boolean;
  supportsValueFormattingOptions?: boolean;
  supportsExceptionInfoRequest?: boolean;
  supportTerminateDebuggee?: boolean;
  supportSuspendDebuggee?: boolean;
  supportsDelayedStackTraceLoading?: boolean;
  supportsLoadedSourcesRequest?: boolean;
  supportsLogPoints?: boolean;
  supportsTerminateThreadsRequest?: boolean;
  supportsSetExpression?: boolean;
  supportsTerminateRequest?: boolean;
  supportsDataBreakpoints?: boolean;
  supportsReadMemoryRequest?: boolean;
  supportsWriteMemoryRequest?: boolean;
  supportsDisassembleRequest?: boolean;
  supportsCancelRequest?: boolean;
  supportsBreakpointLocationsRequest?: boolean;
  supportsClipboardContext?: boolean;
  supportsSteppingGranularity?: boolean;
  supportsInstructionBreakpoints?: boolean;
  supportsExceptionFilterOptions?: boolean;
  supportsSingleThreadExecutionRequests?: boolean;
}

/**
 * Exception breakpoint filter
 */
export interface ExceptionBreakpointFilter {
  filter: string;
  label: string;
  description?: string;
  default?: boolean;
  supportsCondition?: boolean;
  conditionDescription?: string;
}

// ===== Error Handling =====

/**
 * Base adapter error class
 */
export class AdapterError extends Error {
  constructor(
    message: string,
    public code: AdapterErrorCode,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

/**
 * Adapter error codes
 */
export enum AdapterErrorCode {
  // Environment errors
  ENVIRONMENT_INVALID = 'ENVIRONMENT_INVALID',
  EXECUTABLE_NOT_FOUND = 'EXECUTABLE_NOT_FOUND',
  ADAPTER_NOT_INSTALLED = 'ADAPTER_NOT_INSTALLED',
  INCOMPATIBLE_VERSION = 'INCOMPATIBLE_VERSION',
  
  // Connection errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_LOST = 'CONNECTION_LOST',
  
  // Protocol errors
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',
  
  // Runtime errors
  DEBUGGER_ERROR = 'DEBUGGER_ERROR',
  SCRIPT_NOT_FOUND = 'SCRIPT_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// ===== Adapter Events =====

/**
 * Events emitted by debug adapters
 */
export interface AdapterEvents {
  // DAP events
  'stopped': (event: DebugProtocol.StoppedEvent) => void;
  'continued': (event: DebugProtocol.ContinuedEvent) => void;
  'terminated': (event: DebugProtocol.TerminatedEvent) => void;
  'exited': (event: DebugProtocol.ExitedEvent) => void;
  'thread': (event: DebugProtocol.ThreadEvent) => void;
  'output': (event: DebugProtocol.OutputEvent) => void;
  'breakpoint': (event: DebugProtocol.BreakpointEvent) => void;
  'module': (event: DebugProtocol.ModuleEvent) => void;
  
  // Adapter lifecycle events
  'initialized': () => void;
  'connected': () => void;
  'disconnected': () => void;
  'error': (error: AdapterError) => void;
  
  // State change events
  'stateChanged': (oldState: AdapterState, newState: AdapterState) => void;
}

// ===== Migration Helpers =====

/**
 * Configuration migration utilities
 */
export interface ConfigMigration {
  /**
   * Transform old Python-specific config to generic config
   */
  migratePythonConfig(oldConfig: Record<string, unknown>): GenericLaunchConfig;
  
  /**
   * Check if a config needs migration
   */
  needsMigration(config: Record<string, unknown>): boolean;
}
