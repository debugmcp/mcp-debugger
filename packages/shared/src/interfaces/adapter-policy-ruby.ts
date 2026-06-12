import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy, AdapterSpecificState, CommandHandling } from './adapter-policy.js';
import { SessionState } from '@debugmcp/shared';
import type { StackFrame, Variable } from '../models/index.js';
import type { DapClientBehavior, DapClientContext, ReverseRequestResult } from './dap-client-behavior.js';

export const RubyAdapterPolicy: AdapterPolicy = {
  name: 'ruby',
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  shouldDeferParentConfigDone: () => false,
  buildChildStartArgs: () => {
    throw new Error('RubyAdapterPolicy does not support child sessions');
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => {
    return evt?.event === 'initialized';
  },
  extractLocalVariables: (
    stackFrames: StackFrame[],
    scopes: Record<number, DebugProtocol.Scope[]>,
    variables: Record<number, Variable[]>
  ): Variable[] => {
    if (!stackFrames || stackFrames.length === 0) {
      return [];
    }

    const topFrame = stackFrames[0];
    const frameScopes = scopes[topFrame.id];
    if (!frameScopes || frameScopes.length === 0) {
      return [];
    }

    // rdbg reports the scope as "Local variables"; prefer the DAP
    // presentationHint so a future rename doesn't break us.
    const localScope = frameScopes.find((scope) =>
      scope.presentationHint === 'locals' || scope.name === 'Local variables'
    );

    if (!localScope) {
      return [];
    }

    return variables[localScope.variablesReference] || [];
  },
  getLocalScopeName: (): string[] => {
    return ['Local variables'];
  },
  getDapAdapterConfiguration: () => {
    return {
      type: 'rdbg'
    };
  },
  resolveExecutablePath: (providedPath?: string) => {
    if (providedPath) {
      return providedPath;
    }

    return process.env.RUBY_PATH || process.env.RUBY_EXECUTABLE || 'ruby';
  },
  getDebuggerConfiguration: () => {
    return {
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsVariableType: true
    };
  },
  isSessionReady: (state: SessionState) => state === SessionState.PAUSED,
  validateExecutable: async (rubyCmd: string): Promise<boolean> => {
    const { spawn } = await import('child_process');

    return new Promise((resolve) => {
      const child = spawn(rubyCmd, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let hasOutput = false;
      child.stdout?.on('data', () => {
        hasOutput = true;
      });
      child.stderr?.on('data', () => {
        hasOutput = true;
      });

      child.on('error', () => resolve(false));
      child.on('exit', (code) => resolve(code === 0 && hasOutput));
    });
  },
  requiresCommandQueueing: (): boolean => false,
  shouldQueueCommand: (): CommandHandling => {
    return {
      shouldQueue: false,
      shouldDefer: false,
      reason: 'Ruby adapter does not queue commands'
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

    return commandStr.includes('rdbg') || argsStr.includes('rdbg');
  },
  getInitializationBehavior: () => {
    return {
      sendLaunchBeforeConfig: true
    };
  },
  // rdbg rejects the DAP-default 'variables' evaluate context
  // ("unknown context: variables"); it accepts 'repl' and 'watch'.
  // 'repl' also permits state-modifying expressions, which is the
  // documented behavior of the evaluate_expression tool.
  getEvaluateContext: (): string => 'repl',
  // rdbg only suspends on attach when the target was started suspended
  // (stop-at-load). Re-attaching to a running target leaves it running, so
  // an explicit pause is required for stopOnEntry to hold.
  getAttachBehavior: () => ({ pauseAfterAttach: true }),
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
  filterStackFrames: (frames: StackFrame[], includeInternals: boolean): StackFrame[] => {
    if (includeInternals) {
      return frames;
    }

    return frames.filter((frame) => {
      const filePath = frame.file || '';
      return !filePath.startsWith('<internal:') && !filePath.includes('/gems/');
    });
  },
  isInternalFrame: (frame: StackFrame): boolean => {
    const filePath = frame.file || '';
    return filePath.startsWith('<internal:') || filePath.includes('/gems/');
  },
  getAdapterSpawnConfig: (payload) => {
    const launchConfig = (payload.launchConfig ?? {}) as Record<string, unknown>;

    // Attach: rdbg is already listening as a DAP server (started with --open),
    // so there is no adapter process to spawn — connect directly.
    if (launchConfig.request === 'attach') {
      const host = typeof launchConfig.host === 'string' && launchConfig.host.length > 0
        ? launchConfig.host
        : '127.0.0.1';
      const port = launchConfig.port;

      if (typeof port !== 'number' || !Number.isInteger(port) || port <= 0 || port > 65535) {
        throw new Error(
          `Ruby attach requires a valid TCP port for the listening rdbg server (got: ${String(port)}). ` +
          `Start the target with: rdbg --open --port <port> <script.rb>`
        );
      }

      return {
        mode: 'connect',
        host,
        port,
        logDir: payload.logDir
      };
    }

    // Launch: the adapter always provides the rdbg command via buildAdapterCommand.
    if (!payload.adapterCommand) {
      throw new Error('RubyAdapterPolicy requires an adapter command for launch (none provided)');
    }

    return {
      mode: 'spawn',
      command: payload.adapterCommand.command,
      args: payload.adapterCommand.args,
      host: payload.adapterHost,
      port: payload.adapterPort,
      logDir: payload.logDir,
      env: payload.adapterCommand.env
    };
  }
};
