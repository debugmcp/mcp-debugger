/**
 * DotnetAdapterPolicy - policy for .NET Debug Adapter (vsdbg)
 *
 * Encodes vsdbg-specific behaviors and variable handling logic.
 * vsdbg communicates via stdio (not TCP), so the adapter uses a
 * TCP-to-stdio bridge script to integrate with ProxyManager.
 *
 * Critical safety: Always sets terminateDebuggee=false on detach
 * to never kill attached processes (especially NinjaTrader).
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

    // vsdbg uses "Locals" for local variables scope
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

        // Filter out C# compiler-generated variables (display class, iterator state, etc.)
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
   * .NET/vsdbg uses "Locals" for local variables scope
   */
  getLocalScopeName: (): string[] => {
    return ['Locals'];
  },

  /**
   * Returns the DAP adapter configuration.
   * Defaults to 'coreclr' for .NET Core / .NET 5+.
   * For .NET Framework 4.x (e.g., NinjaTrader), callers should pass
   * dapLaunchArgs.type = 'clr' to override.
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

    // Check environment variable for vsdbg path
    if (process.env.VSDBG_PATH) {
      return process.env.VSDBG_PATH;
    }

    // Default: vsdbg (will be resolved by adapter's findVsdbgExecutable)
    return 'vsdbg';
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
   * Validate that vsdbg is available and functional.
   */
  validateExecutable: async (vsdbgCmd: string): Promise<boolean> => {
    const { spawn } = await import('child_process');

    return new Promise((resolve) => {
      // vsdbg --version outputs version info
      const child = spawn(vsdbgCmd, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
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
        // vsdbg --version should produce output
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

    return commandStr.includes('vsdbg') ||
           commandStr.includes('netcoredbg') ||
           argsStr.includes('vsdbg') ||
           argsStr.includes('netcoredbg') ||
           argsStr.includes('dotnet');
  },

  getInitializationBehavior: () => {
    return {
      // vsdbg sends 'initialized' only AFTER processing the 'attach' request.
      // The proxy must NOT wait for 'initialized' before sending 'attach'.
      sendAttachBeforeInitialized: true
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
   * Get the configuration for spawning the .NET debug adapter.
   * Uses a TCP-to-stdio bridge since vsdbg only speaks stdio.
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

    // Build bridge command: node vsdbg-bridge.js --vsdbg <path> --host <host> --port <port>
    const vsdbgPath = payload.executablePath || 'vsdbg';

    return {
      command: 'node',
      args: [
        // Bridge script will be resolved relative to the adapter package
        'vsdbg-bridge.js',
        '--vsdbg', vsdbgPath,
        '--host', payload.adapterHost,
        '--port', String(payload.adapterPort)
      ],
      host: payload.adapterHost,
      port: payload.adapterPort,
      logDir: payload.logDir
    };
  }
};
