/**
 * Adapter Policy contracts for adapter-specific DAP behaviors
 *
 * The goal is to keep the DAP transport core generic while exposing
 * adapter-specific quirks and multi-session strategies via a typed policy.
 *
 * Consumers (e.g., proxy/minimal-dap) consult this policy to decide:
 * - whether reverse startDebugging is supported
 * - how to start a child session (launch/attach) when a __pendingTargetId is provided
 * - whether to defer parent configurationDone temporarily
 * - when a child session is considered "ready" (e.g., after 'initialized', or when a 'thread'/'stopped' event is seen)
 *
 * @since 2.1.0
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { StackFrame, Variable } from '../models/index.js';
import type { DapClientBehavior } from './dap-client-behavior.js';
import type { SessionState } from '@debugmcp/shared';

export type ChildSessionStrategy =
  | 'none'                     // No child session expected/created
  | 'launchWithPendingTarget'  // Launch child using __pendingTargetId (js-debug typical)
  | 'attachByPort'             // Attach child by known inspector port
  | 'adoptInParent';           // Adopt pending target in the same parent session

/**
 * Command handling result that determines how the proxy should proceed
 */
export interface CommandHandling {
  shouldQueue: boolean;
  shouldDefer: boolean;
  reason?: string;
}

/**
 * Adapter-specific state that can be managed by each policy
 */
export interface AdapterSpecificState {
  initialized: boolean;
  configurationDone: boolean;
  [key: string]: unknown;
}

export interface AdapterPolicy {
  /**
   * Identifying name for diagnostics (e.g., 'default', 'js-debug')
   */
  name: string;

  /**
   * Whether the adapter uses reverse startDebugging (adapter asks client to start a child session)
   */
  supportsReverseStartDebugging: boolean;

  /**
   * Strategy for how to create/attach to the child session when reverse startDebugging occurs
   */
  childSessionStrategy: ChildSessionStrategy;

  /**
   * Whether to defer sending configurationDone in the parent session temporarily
   * to ensure the child session is fully configured before the target resumes.
   * This should return true only for adapters that require it (e.g., js-debug).
   */
  shouldDeferParentConfigDone(parentConfig: Record<string, unknown>): boolean;

  /**
   * Build the child start request (launch or attach) for a given pending target ID.
   * This should include just the necessary args; consumers may sanitize/augment further.
   */
  buildChildStartArgs(
    pendingId: string,
    parentConfig: Record<string, unknown>
  ): { command: 'launch' | 'attach'; args: Record<string, unknown> };

  /**
   * Decide whether an incoming DAP event indicates the child session is ready
   * to surface queries like 'threads'. Defaults to 'initialized' for many adapters.
   * Some adapters (e.g., js-debug) may prefer to wait for 'thread' or 'stopped'.
   */
  isChildReadyEvent(evt: DebugProtocol.Event): boolean;

  /**
   * Filter stack frames to remove internal/framework frames based on adapter-specific logic.
   * This is optional - if not implemented, all frames are returned unfiltered.
   * 
   * @param frames The original stack frames from the debug adapter
   * @param includeInternals Whether to include internal/framework frames
   * @returns The filtered stack frames
   */
  filterStackFrames?(frames: StackFrame[], includeInternals: boolean): StackFrame[];

  /**
   * Check if a stack frame is an internal/framework frame.
   * This is used by filterStackFrames to determine which frames to filter out.
   * 
   * @param frame The stack frame to check
   * @returns True if the frame is internal/framework code, false otherwise
   */
  isInternalFrame?(frame: StackFrame): boolean;

  /**
   * Extract local variables from the raw DAP data based on language-specific logic.
   * This allows each language adapter to define what constitutes "local variables".
   * 
   * @param stackFrames The stack frames from the DAP response
   * @param scopes A map of frame IDs to their scopes
   * @param variables A map of scope references to their variables
   * @param includeSpecial Whether to include special/internal variables
   * @returns The extracted local variables
   */
  extractLocalVariables?(
    stackFrames: StackFrame[],
    scopes: Record<number, DebugProtocol.Scope[]>,
    variables: Record<number, Variable[]>,
    includeSpecial?: boolean
  ): Variable[];

  /**
   * Get the scope name(s) that contain local variables for this language.
   * Different languages may use different names (e.g., "Locals" vs "Local").
   * 
   * @returns The scope name(s) to look for when finding locals
   */
  getLocalScopeName?(): string | string[];

  /**
   * Get DAP adapter configuration including type and future config options.
   * This determines which DAP adapter type to use (e.g., 'pwa-node', 'debugpy').
   * 
   * @returns The DAP adapter configuration
   */
  getDapAdapterConfiguration(): {
    type: string;  // 'pwa-node', 'debugpy', 'mock', etc.
    // Future: could include other DAP-specific configuration
  };

  /**
   * Resolve the executable path for this language.
   * Handles language-specific executable resolution logic.
   * 
   * @param providedPath Optional path provided by the user
   * @returns The resolved executable path or undefined
   */
  resolveExecutablePath(providedPath?: string): string | undefined;

  /**
   * Get debugger configuration and requirements.
   * Specifies language-specific debugger behavior and capabilities.
   * 
   * @returns Configuration options for the debugger
   */
  getDebuggerConfiguration(): {
    requiresStrictHandshake?: boolean;
    skipConfigurationDone?: boolean;
    supportsVariableType?: boolean;
    // Additional debugger-specific configuration can be added here
  };

  /**
   * Determine if the adapter/session should be considered "ready" after launch/handshake.
   * If omitted, default logic will be used (paused, or running when stopOnEntry=false).
   */
  isSessionReady?(
    state: SessionState,
    options: { stopOnEntry?: boolean }
  ): boolean;

  /**
   * Validate that the resolved executable is actually usable for this language.
   * This is language-specific - e.g., Python needs to check for Windows Store aliases.
   * 
   * @param executablePath The path to validate
   * @returns Promise resolving to true if valid, false otherwise
   */
  validateExecutable?(executablePath: string): Promise<boolean>;

  /**
   * Perform language-specific handshake after connecting to the debug adapter.
   * Some languages (like JavaScript) require a specific initialization sequence.
   * 
   * @param context Context object with session details and helper methods
   * @returns Promise that resolves when handshake is complete
   */
  performHandshake?(context: {
    proxyManager: unknown;  // Will be IProxyManager in implementation
    sessionId: string;
    dapLaunchArgs?: Record<string, unknown>;
    scriptPath: string;
    scriptArgs?: string[];
    breakpoints: Map<string, unknown>;  // Will be Breakpoint in implementation
  }): Promise<void>;

  /**
   * Determines if commands should be queued before initialization
   * @returns True if this adapter requires command queueing
   */
  requiresCommandQueueing(): boolean;

  /**
   * Determines if a specific command should be queued based on current state
   * @param command The DAP command name
   * @param state Current adapter state
   * @returns Decision on whether to queue the command
   */
  shouldQueueCommand(command: string, state: AdapterSpecificState): CommandHandling;

  /**
   * Process queued commands and return them in the correct order
   * @param commands Currently queued commands (type any to handle full DapCommandPayload)
   * @param state Current adapter state
   * @returns Ordered array of commands to execute
   */
  processQueuedCommands?(
    commands: unknown[],
    state: AdapterSpecificState
  ): unknown[];

  /**
   * Create initial state for this adapter
   * @returns Initial state object
   */
  createInitialState(): AdapterSpecificState;

  /**
   * Update state based on a DAP command being sent
   * @param command The DAP command name
   * @param args Command arguments
   * @param state Current state (will be mutated)
   */
  updateStateOnCommand?(command: string, args: unknown, state: AdapterSpecificState): void;

  /**
   * Update state based on a DAP response being received
   * @param command The DAP command name
   * @param response The raw DAP response payload
   * @param state Current state (will be mutated)
   */
  updateStateOnResponse?(command: string, response: unknown, state: AdapterSpecificState): void;

  /**
   * Update state based on a DAP event being received
   * @param event The DAP event name
   * @param body Event body
   * @param state Current state (will be mutated)
   */
  updateStateOnEvent?(event: string, body: unknown, state: AdapterSpecificState): void;

  /**
   * Check if the adapter is fully initialized and ready for commands
   * @param state Current adapter state
   * @returns True if initialized and ready
   */
  isInitialized(state: AdapterSpecificState): boolean;

  /**
   * Check if the adapter connection is ready to accept DAP commands
   * @param state Current adapter state
   * @returns True if connected and ready
   */
  isConnected(state: AdapterSpecificState): boolean;

  /**
   * Determine the adapter type from adapter command
   * @param adapterCommand Command used to spawn the adapter
   * @returns True if this policy applies to the given adapter
   */
  matchesAdapter(adapterCommand: { command: string; args: string[] }): boolean;

  /**
   * Get initialization behavior flags for this adapter.
   * This combines multiple initialization quirks into a single method to reduce interface bloat.
   * @returns Object with initialization behavior flags
   */
  getInitializationBehavior(): {
    /** Whether to defer configurationDone until after launch/attach */
    deferConfigDone?: boolean;
    /** Whether to add runtimeExecutable to launch arguments */
    addRuntimeExecutable?: boolean;
    /** Whether to track initialize response separately from initialized event */
    trackInitializeResponse?: boolean;
    /** Whether to ensure initial stop after launch/attach */
    requiresInitialStop?: boolean;
  };

  /**
   * Get DAP client-specific behavior configuration.
   * This groups all DAP client behaviors (reverse requests, child sessions, etc.)
   * @returns DAP client behavior configuration
   */
  getDapClientBehavior(): DapClientBehavior;

  /**
   * Get the configuration for spawning the debug adapter process.
   * This allows each policy to define how to spawn its adapter.
   * @param payload The initialization payload containing ports, paths, etc.
   * @returns Configuration for spawning the adapter, or undefined if not applicable
   */
  getAdapterSpawnConfig?(payload: {
    executablePath: string;
    adapterHost: string;
    adapterPort: number;
    logDir: string;
    scriptPath: string;
    adapterCommand?: { command: string; args: string[]; env?: Record<string, string> };
  }): {
    command: string;
    args: string[];
    host: string;
    port: number;
    logDir: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } | undefined;
}

/**
 * DefaultAdapterPolicy is a lightweight placeholder used while the worker is
 * determining which concrete adapter policy to activate. It purposefully
 * implements the smallest safe surface so real adapters cannot accidentally
 * rely on it for behaviour.
 */
export const DefaultAdapterPolicy: AdapterPolicy = {
  name: 'default',
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  shouldDeferParentConfigDone: () => false,
  buildChildStartArgs: (pendingId: string) => {
    throw new Error(
      `DefaultAdapterPolicy is a placeholder and cannot start child sessions (pendingId=${pendingId}).`
    );
  },
  isChildReadyEvent: () => false,
  getDapAdapterConfiguration: () => ({
    type: 'default'
  }),
  resolveExecutablePath: (providedPath?: string) => providedPath,
  getDebuggerConfiguration: () => ({}),
  requiresCommandQueueing: () => false,
  shouldQueueCommand: (): CommandHandling => ({
    shouldQueue: false,
    shouldDefer: false,
    reason: 'DefaultAdapterPolicy is inactive until a real adapter is selected'
  }),
  createInitialState: (): AdapterSpecificState => ({
    initialized: false,
    configurationDone: false
  }),
  isInitialized: () => false,
  isConnected: () => false,
  matchesAdapter: () => false,
  getInitializationBehavior: () => ({}),
  getDapClientBehavior: (): DapClientBehavior => ({})
};
