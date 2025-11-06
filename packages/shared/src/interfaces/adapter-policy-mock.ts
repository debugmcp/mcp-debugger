/**
 * MockAdapterPolicy - policy for Mock Debug Adapter (testing)
 *
 * Encodes mock adapter behaviors for testing purposes.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy, AdapterSpecificState, CommandHandling } from './adapter-policy.js';
import type { StackFrame, Variable } from '../models/index.js';
import type { DapClientBehavior } from './dap-client-behavior.js';

export const MockAdapterPolicy: AdapterPolicy = {
  name: 'mock',
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  shouldDeferParentConfigDone: () => false,
  buildChildStartArgs: () => {
    throw new Error('MockAdapterPolicy does not support child sessions');
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => {
    return evt?.event === 'initialized';
  },
  
  /**
   * Mock adapter doesn't need stack frame filtering
   */
  filterStackFrames: (frames: StackFrame[]): StackFrame[] => {
    // Mock adapter returns all frames as-is
    return frames;
  },
  
  /**
   * Extract local variables for mock adapter (simple implementation)
   */
  extractLocalVariables: (
    stackFrames: StackFrame[],
    scopes: Record<number, DebugProtocol.Scope[]>,
    variables: Record<number, Variable[]>
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
    
    // Find the first scope (mock adapter has simple scopes)
    const localScope = frameScopes[0];
    
    if (!localScope) {
      return [];
    }
    
    // Return all variables for mock adapter
    return variables[localScope.variablesReference] || [];
  },
  
  /**
   * Mock adapter uses simple scope names
   */
  getLocalScopeName: (): string[] => {
    return ['Local', 'Locals'];
  },
  
  getDapAdapterConfiguration: () => {
    return {
      type: 'mock'  // Mock adapter type for testing
    };
  },
  
  resolveExecutablePath: (providedPath?: string) => {
    // Mock adapter doesn't need a real executable
    // Return 'mock' as a placeholder
    return providedPath || 'mock';
  },
  
  getDebuggerConfiguration: () => {
    return {
      // Mock adapter configuration for testing
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsVariableType: false  // Mock adapter has simple variable support
    };
  },

  /**
   * Mock adapter doesn't require command queueing
   */
  requiresCommandQueueing: (): boolean => false,

  /**
   * Mock adapter doesn't queue commands
   */
  shouldQueueCommand: (): CommandHandling => {
    // Mock adapter processes commands immediately
    return {
      shouldQueue: false,
      shouldDefer: false,
      reason: 'Mock adapter does not queue commands'
    };
  },

  /**
   * Create initial state for mock adapter
   */
  createInitialState: (): AdapterSpecificState => {
    return {
      initialized: false,
      configurationDone: false
    };
  },

  /**
   * Update state when a command is sent
   */
  updateStateOnCommand: (command: string, _args: unknown, state: AdapterSpecificState): void => {
    if (command === 'configurationDone') {
      state.configurationDone = true;
    }
  },

  /**
   * Update state when an event is received
   */
  updateStateOnEvent: (event: string, _body: unknown, state: AdapterSpecificState): void => {
    if (event === 'initialized') {
      state.initialized = true;
    }
  },

  /**
   * Check if mock adapter is initialized
   */
  isInitialized: (state: AdapterSpecificState): boolean => {
    return state.initialized;
  },

  /**
   * Check if mock adapter is connected
   */
  isConnected: (state: AdapterSpecificState): boolean => {
    // Mock adapter is connected once initialized
    return state.initialized;
  },

  /**
   * Check if this policy applies to the given adapter command
   */
  matchesAdapter: (adapterCommand: { command: string; args: string[] }): boolean => {
    // Check for mock adapter in command or arguments
    const commandStr = adapterCommand.command.toLowerCase();
    const argsStr = adapterCommand.args.join(' ').toLowerCase();
    
    return commandStr.includes('mock-adapter') || 
           argsStr.includes('mock-adapter');
  },

  /**
   * Mock adapter has no special initialization requirements
   */
  getInitializationBehavior: () => {
    return {};  // Mock adapter has no special initialization requirements
  },

  /**
   * Mock DAP client behaviors - minimal for testing
   */
  getDapClientBehavior: (): DapClientBehavior => {
    return {
      // Mock doesn't handle reverse requests
      handleReverseRequest: undefined,
      
      // No child session routing needed for mock
      childRoutedCommands: undefined,
      
      // Mock-specific behaviors (all disabled)
      mirrorBreakpointsToChild: false,
      deferParentConfigDone: false,
      pauseAfterChildAttach: false,
      
      // No adapter ID normalization needed
      normalizeAdapterId: undefined,
      
      // Standard timeouts
      childInitTimeout: 1000, // Shorter for testing
      suppressPostAttachConfigDone: false
    };
  },

  /**
   * Get the configuration for spawning the mock debug adapter (for testing)
   */
  getAdapterSpawnConfig: (payload) => {
    // If a custom adapter command was provided, use it directly
    if (payload.adapterCommand) {
      return {
        command: payload.adapterCommand.command,
        args: payload.adapterCommand.args,
        host: payload.adapterHost,
        port: payload.adapterPort,
        logDir: payload.logDir,
        env: payload.adapterCommand.env
      };
    }

    // Mock adapter doesn't spawn a real process, return undefined
    // The proxy worker should handle this case appropriately for testing
    return undefined;
  }
};
