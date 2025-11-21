/**
 * RustAdapterPolicy - policy for Rust Debug Adapter (CodeLLDB)
 *
 * Encodes CodeLLDB specific behaviors and variable handling logic.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import type { AdapterPolicy, AdapterSpecificState, CommandHandling } from './adapter-policy.js';
import { SessionState } from '@debugmcp/shared';
import type { StackFrame, Variable } from '../models/index.js';
import type { DapClientBehavior, DapClientContext, ReverseRequestResult } from './dap-client-behavior.js';

export interface RustAdapterPolicyInterface {
  requiresCompilation: true;
  supportsCargo: true;
  defaultBuildCommand: 'cargo build';
  supportedExtensions: ['.rs'];
  supportsDebugging: true;
  defaultDebugTarget: 'debug';
  releaseBuildCommand: 'cargo build --release';
  testCommand: 'cargo test';
}

export const RustAdapterPolicy: AdapterPolicy = {
  name: 'rust',
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  shouldDeferParentConfigDone: () => false,
  buildChildStartArgs: () => {
    throw new Error('RustAdapterPolicy does not support child sessions');
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => {
    return evt?.event === 'initialized';
  },
  
  /**
   * Extract local variables for Rust, filtering out special variables by default
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
    
    // Find the "Local" scope (CodeLLDB uses "Local" or "Locals")
    const localScope = frameScopes.find(scope => 
      scope.name === 'Local' || scope.name === 'Locals'
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
        
        // Skip LLDB internal variables
        if (name.startsWith('$') || name.startsWith('__')) {
          return false;
        }
        
        // Skip debugger internal variables
        if (name.startsWith('_lldb') || name.startsWith('_debug')) {
          return false;
        }
        
        return true;
      });
    }
    
    return localVars;
  },
  
  /**
   * Rust/CodeLLDB uses "Local" or "Locals" for local variables scope
   */
  getLocalScopeName: (): string[] => {
    return ['Local', 'Locals'];
  },
  
  getDapAdapterConfiguration: () => {
    return {
      type: 'lldb'  // CodeLLDB adapter type
    };
  },
  
  resolveExecutablePath: (providedPath?: string) => {
    if (providedPath) {
      return providedPath;
    }

    if (process.env.CARGO_PATH) {
      return process.env.CARGO_PATH;
    }

    // Defer to adapter for auto-detection (cargo / rustc)
    return undefined;
  },
  
  getDebuggerConfiguration: () => {
    return {
      // CodeLLDB debugger configuration
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsVariableType: true,  // CodeLLDB supports variable type information
      supportsValueFormat: true,    // CodeLLDB supports value formatting
      supportsMemoryReferences: true // CodeLLDB supports memory references
    };
  },

  isSessionReady: (state: SessionState) => state === SessionState.PAUSED,
  
  /**
   * Validate that the CodeLLDB adapter is available and executable
   */
  validateExecutable: async (codelldbPath: string): Promise<boolean> => {
    // Import fs/spawn dynamically to avoid issues in browser environments
    const fs = await import('fs/promises');
    const { spawn } = await import('child_process');
    
    try {
      // First check if the file exists
      await fs.access(codelldbPath, fs.constants.F_OK);
      
      // Try to execute with version flag
      return new Promise((resolve) => {
        const child = spawn(codelldbPath, ['--version'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });

        child.on('error', () => resolve(false));
        child.on('exit', (code) => {
          // CodeLLDB should return 0 and output version info
          resolve(code === 0 && output.includes('codelldb'));
        });
      });
    } catch {
      return false;
    }
  },

  /**
   * Rust adapter doesn't require command queueing
   */
  requiresCommandQueueing: (): boolean => false,

  /**
   * Rust doesn't need to queue commands
   */
  shouldQueueCommand: (): CommandHandling => {
    // CodeLLDB adapter processes commands immediately
    return {
      shouldQueue: false,
      shouldDefer: false,
      reason: 'Rust/CodeLLDB adapter does not queue commands'
    };
  },

  /**
   * Create initial state for Rust adapter
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
   * Check if Rust adapter is initialized
   */
  isInitialized: (state: AdapterSpecificState): boolean => {
    return state.initialized;
  },

  /**
   * Check if Rust adapter is connected
   */
  isConnected: (state: AdapterSpecificState): boolean => {
    // Rust adapter is connected once initialized
    return state.initialized;
  },

  /**
   * Check if this policy applies to the given adapter command
   */
  matchesAdapter: (adapterCommand: { command: string; args: string[] }): boolean => {
    // Check for CodeLLDB in command or arguments
    const commandStr = adapterCommand.command.toLowerCase();
    const argsStr = adapterCommand.args.join(' ').toLowerCase();
    
    return commandStr.includes('codelldb') || 
           commandStr.includes('lldb-server') ||
           argsStr.includes('codelldb') || 
           argsStr.includes('lldb');
  },

  /**
   * Rust adapter has no special initialization requirements
   */
  getInitializationBehavior: () => {
    return {};  // CodeLLDB doesn't need any special initialization quirks
  },

  /**
   * Rust DAP client behaviors - minimal since Rust doesn't use child sessions
   */
  getDapClientBehavior: (): DapClientBehavior => {
    return {
      // Rust doesn't handle reverse requests
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
      
      // Rust-specific behaviors
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
   * Get the configuration for spawning the Rust debug adapter (CodeLLDB)
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

    // Otherwise, use the vendored CodeLLDB
    const platform = process.platform;
    const arch = process.arch;
    
    let platformDir = '';
    if (platform === 'win32') {
      platformDir = 'win32-x64';
    } else if (platform === 'darwin') {
      platformDir = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
    } else if (platform === 'linux') {
      platformDir = arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
    }
    
    const codelldbPath = payload.executablePath ||
      path.resolve(
        process.cwd(),
        'packages',
        'adapter-rust',
        'vendor',
        'codelldb',
        platformDir,
        'adapter',
        `codelldb${platform === 'win32' ? '.exe' : ''}`
      );
    
    // CodeLLDB uses stdio for communication by default
    return {
      command: codelldbPath,
      args: [
        '--port', String(payload.adapterPort)
      ],
      host: payload.adapterHost,
      port: payload.adapterPort,
      logDir: payload.logDir,
      env: {
        ...process.env,
        // Windows specific: enable native PDB reader
        ...(platform === 'win32' ? { LLDB_USE_NATIVE_PDB_READER: '1' } : {})
      }
    };
  }
};
