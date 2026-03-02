/**
 * DotnetAdapterPolicy - DAP proxy policy for the .NET debug adapter (vsdbg)
 *
 * This policy encodes all vsdbg-specific behaviors that the DAP proxy worker
 * needs to know about. It is selected by `selectPolicy()` in
 * `session-manager-data.ts` when the session language is 'dotnet'.
 *
 * ## Why vsdbg needs special handling
 *
 * vsdbg (Microsoft's .NET debugger, bundled with the VS Code C# extension)
 * differs from other DAP adapters in several important ways:
 *
 * 1. **Stdio-only communication**: vsdbg uses stdin/stdout for DAP messages
 *    (with --interpreter=vscode), but mcp-debugger's proxy communicates
 *    via TCP. A TCP-to-stdio bridge (vsdbg-bridge.ts) translates between them.
 *
 * 2. **Proprietary handshake**: vsdbg sends a `handshake` reverse request
 *    with a challenge that must be signed using vsda.node (a native module
 *    from the C# extension). The bridge handles this automatically.
 *
 * 3. **Reversed attach sequence**: Most DAP adapters send the `initialized`
 *    event after `initialize` but before `attach`. vsdbg sends `initialized`
 *    only AFTER processing the `attach` request. The `sendAttachBeforeInitialized`
 *    flag tells the proxy worker to use this reversed sequence. Without it,
 *    the proxy deadlocks waiting for an event that never comes.
 *
 * 4. **Scope naming**: vsdbg uses `'Locals'` (capital L) for the local
 *    variables scope, unlike Python's `'Locals'` or JavaScript's `'Local'`.
 *
 * 5. **Compiler-generated variables**: C# compilers generate variables with
 *    names like `<>c__DisplayClass`, `CS$<>`, `<>t__builder` for closures,
 *    async state machines, and display classes. These are filtered out by
 *    `extractLocalVariables` unless `includeSpecial` is true.
 *
 * ## Safety
 *
 * terminateDebuggee is always false when detaching from attached processes.
 * The proxy worker auto-detaches safely on session close for attach-mode
 * sessions, preventing accidental process termination.
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
   * Uses 'coreclr' for .NET Core / .NET 5+.
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
