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

    const localScope = frameScopes.find((scope) =>
      scope.name === 'Locals' || scope.name === 'Local'
    );

    if (!localScope) {
      return [];
    }

    return variables[localScope.variablesReference] || [];
  },
  getLocalScopeName: (): string[] => {
    return ['Locals', 'Local'];
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

    return commandStr.includes('rdbg') ||
      argsStr.includes('rdbg') ||
      argsStr.includes('--stop-at-load');
  },
  getInitializationBehavior: () => {
    return {
      sendLaunchBeforeConfig: true
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
    if (launchConfig.request === 'attach') {
      const debugPortValue = launchConfig.debugPort;
      let host = '127.0.0.1';
      let port: number | undefined;

      if (typeof debugPortValue === 'number') {
        port = debugPortValue;
      } else if (typeof debugPortValue === 'string') {
        const parts = debugPortValue.split(':');
        if (parts.length === 1) {
          const parsedPort = Number(parts[0]);
          if (!Number.isNaN(parsedPort)) {
            port = parsedPort;
          }
        } else {
          const parsedPort = Number(parts[parts.length - 1]);
          if (!Number.isNaN(parsedPort)) {
            host = parts.slice(0, -1).join(':') || host;
            port = parsedPort;
          }
        }
      }

      return {
        command: '',
        args: [],
        host,
        port: port || payload.adapterPort,
        logDir: payload.logDir,
        connectOnly: true
      };
    }

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

    return {
      command: process.platform === 'win32' ? 'rdbg.bat' : 'rdbg',
      args: [
        '--command',
        '--open',
        '--host', payload.adapterHost,
        '--port', String(payload.adapterPort),
        '--stop-at-load',
        '--',
        payload.executablePath || 'ruby',
        payload.scriptPath
      ],
      host: payload.adapterHost,
      port: payload.adapterPort,
      logDir: payload.logDir
    };
  }
};
