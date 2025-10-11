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

export type ChildSessionStrategy =
  | 'none'                     // No child session expected/created
  | 'launchWithPendingTarget'  // Launch child using __pendingTargetId (js-debug typical)
  | 'attachByPort'             // Attach child by known inspector port
  | 'adoptInParent';           // Adopt pending target in the same parent session

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
}

/**
 * Default policy: no reverse startDebugging and no child sessions.
 * Parent configurationDone is never deferred.
 */
export const DefaultAdapterPolicy: AdapterPolicy = {
  name: 'default',
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  shouldDeferParentConfigDone: () => false,
  buildChildStartArgs: (pendingId: string) => {
    // Default policy should not be asked to build child start args.
    // Throwing here helps catch accidental misuse.
    throw new Error(
      `DefaultAdapterPolicy does not support child sessions. PendingId=${pendingId}`
    );
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => {
    // For most adapters, 'initialized' is the earliest readiness signal.
    return evt?.event === 'initialized';
  },
  // Default implementation: Use first non-global scope as locals
  extractLocalVariables: (
    stackFrames: StackFrame[],
    scopes: Record<number, DebugProtocol.Scope[]>,
    variables: Record<number, Variable[]>,
    _includeSpecial?: boolean
  ): Variable[] => {
    // Get the top frame
    if (!stackFrames || stackFrames.length === 0) {
      return [];
    }
    
    const topFrame = stackFrames[0];
    const frameScopes = scopes[topFrame.id];
    
    if (!frameScopes || frameScopes.length === 0) {
      return [];
    }
    
    // Find the first non-global scope (usually the locals)
    const localScope = frameScopes.find(scope => 
      !scope.name.toLowerCase().includes('global')
    );
    
    if (!localScope) {
      return [];
    }
    
    // Return the variables for this scope
    return variables[localScope.variablesReference] || [];
  },
  
  getLocalScopeName: (): string[] => {
    // Common scope names for locals across languages
    return ['Locals', 'Local', 'local'];
  },
  
  getDapAdapterConfiguration: () => {
    return {
      type: 'default'  // Generic/default adapter type
    };
  },
  
  resolveExecutablePath: (providedPath?: string) => {
    // Default policy just returns the provided path as-is
    return providedPath;
  },
  
  getDebuggerConfiguration: () => {
    return {
      // Default configuration - no special requirements
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsVariableType: false
    };
  }
};
