/**
 * JavaAdapterPolicy - policy for Java Debug Adapter (jdb)
 *
 * Encodes jdb specific behaviors and variable handling logic.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy, AdapterSpecificState, CommandHandling } from './adapter-policy.js';
import { SessionState } from '@debugmcp/shared';
import type { StackFrame, Variable } from '../models/index.js';
import type { DapClientBehavior, DapClientContext, ReverseRequestResult } from './dap-client-behavior.js';

export const JavaAdapterPolicy: AdapterPolicy = {
  name: 'java',
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  shouldDeferParentConfigDone: () => false,
  buildChildStartArgs: () => {
    throw new Error('JavaAdapterPolicy does not support child sessions');
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => {
    return evt?.event === 'initialized';
  },

  /**
   * Extract local variables for Java
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

    // Find the "Local" scope (Java uses "Local")
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
        // Filter out Java special/internal variables
        const name = v.name;

        // Skip 'this' unless specifically requested
        if (name === 'this' && !includeSpecial) {
          return false;
        }

        return true;
      });
    }

    return localVars;
  },

  /**
   * Java uses "Local" for local variables scope
   */
  getLocalScopeName: (): string[] => {
    return ['Local', 'Locals'];
  },

  getDapAdapterConfiguration: () => {
    return {
      type: 'java'  // Java Debug Adapter Protocol type
    };
  },

  resolveExecutablePath: (providedPath?: string) => {
    // Java-specific executable path resolution
    // Priority: provided path > JAVA_HOME/bin/java > default java command
    if (providedPath) {
      return providedPath;
    }

    // Check JAVA_HOME environment variable
    if (process.env.JAVA_HOME) {
      const javaBin = process.platform === 'win32' ? 'java.exe' : 'java';
      return `${process.env.JAVA_HOME}/bin/${javaBin}`;
    }

    // Default to 'java' command
    return 'java';
  },

  getDebuggerConfiguration: () => {
    return {
      // Java debugger configuration
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsVariableType: true  // Java supports variable type information
    };
  },

  isSessionReady: (state: SessionState) => state === SessionState.PAUSED,

  /**
   * Validate that a Java command is a real Java executable
   */
  validateExecutable: async (javaCmd: string): Promise<boolean> => {
    // Import spawn dynamically to avoid issues in browser environments
    const { spawn } = await import('child_process');

    return new Promise((resolve) => {
      const child = spawn(javaCmd, ['-version'], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      child.on('error', () => resolve(false));
      child.on('exit', (code) => {
        resolve(code === 0);
      });
    });
  },

  /**
   * Java adapter doesn't require command queueing
   */
  requiresCommandQueueing: (): boolean => false,

  /**
   * Java doesn't need to queue commands
   */
  shouldQueueCommand: (): CommandHandling => {
    // Java adapter processes commands immediately
    return {
      shouldQueue: false,
      shouldDefer: false,
      reason: 'Java adapter does not queue commands'
    };
  },

  /**
   * Create initial state for Java adapter
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
   * Check if Java adapter is initialized
   */
  isInitialized: (state: AdapterSpecificState): boolean => {
    return state.initialized;
  },

  /**
   * Check if Java adapter is connected
   */
  isConnected: (state: AdapterSpecificState): boolean => {
    // Java adapter is connected once initialized
    return state.initialized;
  },

  /**
   * Check if this policy applies to the given adapter command
   */
  matchesAdapter: (adapterCommand: { command: string; args: string[] }): boolean => {
    // Check for jdb-dap-server in arguments
    const argsStr = adapterCommand.args.join(' ').toLowerCase();

    return argsStr.includes('jdb-dap-server') ||
           argsStr.includes('jdb');
  },

  /**
   * Java adapter has no special initialization requirements
   */
  getInitializationBehavior: () => {
    return {};  // Java doesn't need any special initialization quirks
  },

  /**
   * Java DAP client behaviors - minimal since Java doesn't use child sessions
   */
  getDapClientBehavior: (): DapClientBehavior => {
    return {
      // Java doesn't handle reverse requests
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

      // Java-specific behaviors
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
   * Get the configuration for spawning the Java debug adapter (jdb-dap-server)
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

    // This shouldn't happen for Java since we always provide adapterCommand
    throw new Error('Java adapter requires adapterCommand to be provided');
  }
};
