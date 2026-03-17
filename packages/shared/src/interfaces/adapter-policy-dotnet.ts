/**
 * DotnetAdapterPolicy - DAP proxy policy for the .NET debug adapter (netcoredbg)
 *
 * This policy encodes all netcoredbg-specific behaviors that the DAP proxy worker
 * needs to know about. It is selected by `selectPolicy()` in
 * `session-manager-data.ts` when the session language is 'dotnet'.
 *
 * ## netcoredbg communication
 *
 * netcoredbg supports DAP over TCP natively via `--server=PORT --interpreter=vscode`.
 * On all platforms, a TCP-to-stdio bridge is used due to a netcoredbg server mode bug.
 *
 * ## DAP sequence
 *
 * netcoredbg follows the standard DAP sequence:
 *   initialize → response → initialized event → attach/launch → configurationDone
 *
 * ## Adapter ID
 *
 * netcoredbg uses `adapterID: 'coreclr'`.
 *
 * ## Scope naming
 *
 * netcoredbg uses `'Locals'` for the local variables scope.
 *
 * ## Compiler-generated variables
 *
 * C# compilers generate variables with names like `<>c__DisplayClass`,
 * `CS$<>`, `<>t__builder`. These are filtered out by `extractLocalVariables`
 * unless `includeSpecial` is true.
 *
 * ## Safety
 *
 * terminateDebuggee is always false when detaching from attached processes.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy, AdapterSpecificState, CommandHandling } from './adapter-policy.js';
import { SessionState } from '@debugmcp/shared';
import type { StackFrame, Variable } from '../models/index.js';
import type { DapClientBehavior, DapClientContext, ReverseRequestResult } from './dap-client-behavior.js';

export const DotnetAdapterPolicy: AdapterPolicy = {
  name: 'dotnet',
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  shouldDeferParentConfigDone: () => false,
  buildChildStartArgs: () => {
    throw new Error('DotnetAdapterPolicy does not support child sessions');
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => {
    return evt?.event === 'initialized';
  },

  /**
   * Extract local variables for .NET, filtering out compiler-generated variables
   */
  extractLocalVariables: (
    stackFrames: StackFrame[],
    scopes: Record<number, DebugProtocol.Scope[]>,
    variables: Record<number, Variable[]>,
    includeSpecial: boolean = false
  ): Variable[] => {
    if (!stackFrames || stackFrames.length === 0) {
      return [];
    }

    const topFrame = stackFrames[0];
    const frameScopes = scopes[topFrame.id];

    if (!frameScopes || frameScopes.length === 0) {
      return [];
    }

    // netcoredbg uses "Locals" for local variables scope
    const localScope = frameScopes.find(scope =>
      scope.name === 'Locals' || scope.name === 'Local'
    );

    if (!localScope) {
      return [];
    }

    let localVars = variables[localScope.variablesReference] || [];

    if (!includeSpecial) {
      localVars = localVars.filter(v => {
        const name = v.name;

        // Filter out C# compiler-generated variables
        if (name.startsWith('<>')) {
          return false;
        }

        // Filter out compiler-generated closure variables
        if (name.startsWith('CS$<>')) {
          return false;
        }

        // Filter out VB.NET compiler-generated variables
        if (name.startsWith('$VB$')) {
          return false;
        }

        // Filter out async state machine fields
        if (name.startsWith('<>t__') || name.startsWith('<>s__')) {
          return false;
        }

        return true;
      });
    }

    return localVars;
  },

  /**
   * netcoredbg uses "Locals" for local variables scope
   */
  getLocalScopeName: (): string[] => {
    return ['Locals'];
  },

  /**
   * Returns the DAP adapter configuration.
   * netcoredbg always uses 'coreclr' as adapter ID,
   * even for .NET Framework (Desktop CLR detection is internal).
   */
  getDapAdapterConfiguration: () => {
    return {
      type: 'coreclr'
    };
  },

  resolveExecutablePath: (providedPath?: string) => {
    if (providedPath) {
      return providedPath;
    }

    // Check environment variable for netcoredbg path
    if (process.env.NETCOREDBG_PATH) {
      return process.env.NETCOREDBG_PATH;
    }

    // Default: netcoredbg (will be resolved by adapter's findNetcoredbgExecutable)
    return 'netcoredbg';
  },

  getDebuggerConfiguration: () => {
    return {
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsVariableType: true
    };
  },

  isSessionReady: (state: SessionState) => state === SessionState.PAUSED,

  /**
   * Validate that netcoredbg is available and functional.
   */
  validateExecutable: async (netcoredbgCmd: string): Promise<boolean> => {
    const { spawn } = await import('child_process');

    return new Promise((resolve) => {
      const child = spawn(netcoredbgCmd, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let hasOutput = false;
      child.stdout?.on('data', () => {
        hasOutput = true;
      });
      child.stderr?.on('data', () => {
        hasOutput = true;
      });

      child.on('error', () => resolve(false));
      child.on('exit', (code) => {
        resolve(code === 0 || hasOutput);
      });
    });
  },

  requiresCommandQueueing: (): boolean => false,

  shouldQueueCommand: (): CommandHandling => {
    return {
      shouldQueue: false,
      shouldDefer: false,
      reason: '.NET adapter does not queue commands'
    };
  },

  createInitialState: (): AdapterSpecificState => {
    return {
      initialized: false,
      configurationDone: false
    };
  },

  updateStateOnCommand: (command: string, _args: unknown, state: AdapterSpecificState): void => {
    if (command === 'configurationDone') {
      state.configurationDone = true;
    }
  },

  updateStateOnEvent: (event: string, _body: unknown, state: AdapterSpecificState): void => {
    if (event === 'initialized') {
      state.initialized = true;
    }
  },

  isInitialized: (state: AdapterSpecificState): boolean => {
    return state.initialized;
  },

  isConnected: (state: AdapterSpecificState): boolean => {
    return state.initialized;
  },

  matchesAdapter: (adapterCommand: { command: string; args: string[] }): boolean => {
    const commandStr = adapterCommand.command.toLowerCase();
    const argsStr = adapterCommand.args.join(' ').toLowerCase();

    return commandStr.includes('netcoredbg') ||
           argsStr.includes('netcoredbg') ||
           argsStr.includes('dotnet');
  },

  getInitializationBehavior: () => {
    return {
      // netcoredbg follows the standard DAP sequence:
      // initialize → initialized event → attach/launch → configurationDone
      sendAttachBeforeInitialized: false
    };
  },

  getDapClientBehavior: (): DapClientBehavior => {
    return {
      handleReverseRequest: async (request: DebugProtocol.Request, context: DapClientContext): Promise<ReverseRequestResult> => {
        if (request.command === 'runInTerminal') {
          context.sendResponse(request, {});
          return { handled: true };
        }
        return { handled: false };
      },

      childRoutedCommands: undefined,
      mirrorBreakpointsToChild: false,
      deferParentConfigDone: false,
      pauseAfterChildAttach: false,
      normalizeAdapterId: undefined,
      childInitTimeout: 5000,
      suppressPostAttachConfigDone: false
    };
  },

  /**
   * Filter stack frames to remove .NET runtime/framework internal frames
   */
  filterStackFrames: (frames: StackFrame[], includeInternals: boolean): StackFrame[] => {
    if (includeInternals) {
      return frames;
    }

    return frames.filter(frame => {
      const filePath = frame.file || '';
      const frameName = frame.name || '';

      // Skip frames with no source file (framework internals)
      if (!filePath) {
        return false;
      }

      // Skip System.* and Microsoft.* runtime frames
      if (frameName.startsWith('System.') || frameName.startsWith('Microsoft.')) {
        return false;
      }

      return true;
    });
  },

  isInternalFrame: (frame: StackFrame): boolean => {
    const filePath = frame.file || '';
    const frameName = frame.name || '';
    return !filePath || frameName.startsWith('System.') || frameName.startsWith('Microsoft.');
  },

  /**
   * Get the configuration for spawning netcoredbg.
   *
   * netcoredbg's --server=PORT mode has a connection bug on all platforms
   * (originally discovered on Windows), so we use a TCP-to-stdio bridge. The adapter's buildAdapterCommand()
   * returns the bridge command, which is passed here via payload.adapterCommand.
   */
  getAdapterSpawnConfig: (payload) => {
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

    // Fallback: try direct netcoredbg (may not work on Windows due to server mode bug)
    const netcoredbgPath = payload.executablePath || 'netcoredbg';

    return {
      command: netcoredbgPath,
      args: [
        '--interpreter=vscode',
        `--server=${payload.adapterPort}`
      ],
      host: payload.adapterHost,
      port: payload.adapterPort,
      logDir: payload.logDir
    };
  }
};
