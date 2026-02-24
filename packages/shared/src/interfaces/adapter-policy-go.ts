/**
 * GoAdapterPolicy - policy for Go Debug Adapter (Delve/dlv)
 *
 * Encodes Delve-specific behaviors and variable handling logic.
 * Delve operates in DAP mode via `dlv dap --listen=:port`
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy, AdapterSpecificState, CommandHandling } from './adapter-policy.js';
import { SessionState } from '@debugmcp/shared';
import type { StackFrame, Variable } from '../models/index.js';
import type { DapClientBehavior, DapClientContext, ReverseRequestResult } from './dap-client-behavior.js';

export const GoAdapterPolicy: AdapterPolicy = {
  name: 'go',
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  shouldDeferParentConfigDone: () => false,
  buildChildStartArgs: () => {
    throw new Error('GoAdapterPolicy does not support child sessions');
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => {
    return evt?.event === 'initialized';
  },
  
  /**
   * Extract local variables for Go, filtering out special variables by default
   */
  extractLocalVariables: (
    stackFrames: StackFrame[],
    scopes: Record<number, DebugProtocol.Scope[]>,
    variables: Record<number, Variable[]>,
    includeSpecial: boolean = false
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
    
    // Find the "Locals" scope (Delve uses "Locals")
    const localScope = frameScopes.find(scope => 
      scope.name === 'Locals' || scope.name === 'Local'
    );
    
    if (!localScope) {
      return [];
    }
    
    // Get the variables for this scope
    let localVars = variables[localScope.variablesReference] || [];
    
    // Filter out special variables unless requested
    if (!includeSpecial) {
      localVars = localVars.filter(v => {
        const name = v.name;
        
        // Skip Go internal variables (those starting with underscore typically)
        // Delve shows these explicitly when needed
        if (name.startsWith('_') && name !== '_') {
          return false;
        }
        
        // Skip function closure variables unless explicitly requested
        // (Delve presents these in a separate scope typically)
        
        return true;
      });
    }
    
    return localVars;
  },
  
  /**
   * Go/Delve uses "Locals" for local variables scope, also has "Arguments"
   */
  getLocalScopeName: (): string[] => {
    return ['Locals', 'Arguments'];
  },
  
  getDapAdapterConfiguration: () => {
    return {
      type: 'dlv-dap'  // Delve DAP adapter type
    };
  },
  
  resolveExecutablePath: (providedPath?: string) => {
    // Go/Delve executable path resolution
    // Priority: provided path > DLV_PATH env > default dlv command
    if (providedPath) {
      return providedPath;
    }

    // Check environment variable for Delve path
    if (process.env.DLV_PATH) {
      return process.env.DLV_PATH;
    }

    // Default: 'dlv' on all platforms (installed via go install)
    return 'dlv';
  },
  
  getDebuggerConfiguration: () => {
    return {
      // Go debugger configuration
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsVariableType: true  // Delve supports variable type information
    };
  },

  isSessionReady: (state: SessionState) => state === SessionState.PAUSED,
  
  /**
   * Validate that the dlv executable is available and functional.
   */
  validateExecutable: async (dlvCmd: string): Promise<boolean> => {
    // Import spawn dynamically to avoid issues in browser environments
    const { spawn } = await import('child_process');
    
    return new Promise((resolve) => {
      const child = spawn(dlvCmd, ['version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let hasOutput = false;
      child.stdout?.on('data', () => {
        hasOutput = true;
      });

      child.on('error', () => resolve(false));
      child.on('exit', (code) => {
        // dlv version should exit with 0 and produce output
        resolve(code === 0 && hasOutput);
      });
    });
  },

  /**
   * Go adapter doesn't require command queueing
   */
  requiresCommandQueueing: (): boolean => false,

  /**
   * Go doesn't need to queue commands
   */
  shouldQueueCommand: (): CommandHandling => {
    // Go adapter processes commands immediately
    return {
      shouldQueue: false,
      shouldDefer: false,
      reason: 'Go adapter does not queue commands'
    };
  },

  /**
   * Create initial state for Go adapter
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
   * Check if Go adapter is initialized
   */
  isInitialized: (state: AdapterSpecificState): boolean => {
    return state.initialized;
  },

  /**
   * Check if Go adapter is connected
   */
  isConnected: (state: AdapterSpecificState): boolean => {
    // Go adapter is connected once initialized
    return state.initialized;
  },

  /**
   * Check if this policy applies to the given adapter command
   */
  matchesAdapter: (adapterCommand: { command: string; args: string[] }): boolean => {
    // Check for dlv in command or arguments
    const commandStr = adapterCommand.command.toLowerCase();
    const argsStr = adapterCommand.args.join(' ').toLowerCase();
    
    return commandStr.includes('dlv') || 
           commandStr.endsWith('/dlv') ||
           commandStr === 'dlv' ||
           argsStr.includes('dlv dap') || 
           argsStr.includes('delve');
  },

  /**
   * Go adapter initialization behavior.
   * 
   * Note: Delve has a quirk where it returns "unknown goroutine 1" when
   * stack traces are requested immediately after stopping on entry.
   * This is handled by defaulting stopOnEntry to false in session-manager-operations.ts.
   */
  getInitializationBehavior: () => {
    return {
      // Go/Delve doesn't need deferred configDone
      deferConfigDone: false,
      // Delve returns "unknown goroutine" when stack traces are requested
      // immediately after stopping on entry. Default to false so the program
      // runs until the first breakpoint instead.
      defaultStopOnEntry: false,
      // Delve may send 'initialized' immediately after 'initialize' or after 'launch'.
      // The proxy uses two-phase handling: brief wait before launch, fallback after launch.
      sendLaunchBeforeConfig: true,
    };
  },

  /**
   * Go DAP client behaviors - minimal since Go doesn't use child sessions
   */
  getDapClientBehavior: (): DapClientBehavior => {
    return {
      // Go doesn't handle reverse requests
      handleReverseRequest: async (request: DebugProtocol.Request, context: DapClientContext): Promise<ReverseRequestResult> => {
        // Just acknowledge any reverse requests (shouldn't receive any)
        if (request.command === 'runInTerminal') {
          context.sendResponse(request, {});
          return { handled: true };
        }
        return { handled: false };
      },
      
      // No child session routing needed
      childRoutedCommands: undefined,
      
      // Go-specific behaviors
      mirrorBreakpointsToChild: false,
      deferParentConfigDone: false,
      pauseAfterChildAttach: false,
      
      // No adapter ID normalization needed
      normalizeAdapterId: undefined,
      
      // Standard timeouts
      childInitTimeout: 5000,
      suppressPostAttachConfigDone: false
    };
  },

  /**
   * Filter stack frames to remove internal/runtime frames
   */
  filterStackFrames: (frames: StackFrame[], includeInternals: boolean): StackFrame[] => {
    if (includeInternals) {
      return frames;
    }
    
    return frames.filter(frame => {
      // Filter out Go runtime frames
      const filePath = frame.file || '';
      
      // Skip runtime package frames
      if (filePath.includes('/runtime/')) {
        return false;
      }
      
      // Skip internal testing framework frames
      if (filePath.includes('/testing/')) {
        return false;
      }
      
      return true;
    });
  },

  /**
   * Check if a frame is internal (runtime/testing)
   */
  isInternalFrame: (frame: StackFrame): boolean => {
    const filePath = frame.file || '';
    return filePath.includes('/runtime/') || filePath.includes('/testing/');
  },

  /**
   * Get the configuration for spawning the Go debug adapter (dlv)
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

    // Otherwise, build the dlv dap command
    const dlvPath = payload.executablePath || 'dlv';
    
    return {
      command: dlvPath,
      args: [
        'dap',
        '--listen', `${payload.adapterHost}:${payload.adapterPort}`,
        '--log',
        '--log-output', 'dap',
        '--log-dest', payload.logDir
      ],
      host: payload.adapterHost,
      port: payload.adapterPort,
      logDir: payload.logDir
    };
  }
};
