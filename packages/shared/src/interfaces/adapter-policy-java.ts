/**
 * JavaAdapterPolicy - policy for Java Debug Adapter (kotlin-debug-adapter / KDA)
 *
 * Encodes KDA-specific behaviors for Java debugging.
 * KDA is a JDI-based DAP server; the stdio-tcp bridge exposes it on a TCP port.
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

  extractLocalVariables: (
    stackFrames: StackFrame[],
    scopes: Record<number, DebugProtocol.Scope[]>,
    variables: Record<number, Variable[]>,
    _includeSpecial: boolean = false
  ): Variable[] => {
    if (!stackFrames || stackFrames.length === 0) {
      return [];
    }

    const topFrame = stackFrames[0];
    const frameScopes = scopes[topFrame.id];

    if (!frameScopes || frameScopes.length === 0) {
      return [];
    }

    // KDA uses "Local Variables" for the local scope
    const localScope = frameScopes.find(scope =>
      scope.name === 'Local Variables' || scope.name === 'Local' || scope.name === 'Locals'
    );

    if (!localScope) {
      return [];
    }

    return variables[localScope.variablesReference] || [];
  },

  getLocalScopeName: (): string[] => {
    return ['Local Variables', 'Local'];
  },

  getDapAdapterConfiguration: () => {
    return {
      type: 'java'
    };
  },

  resolveExecutablePath: (providedPath?: string) => {
    if (providedPath) {
      return providedPath;
    }

    if (process.env.JAVA_HOME) {
      const sep = process.platform === 'win32' ? '\\' : '/';
      const ext = process.platform === 'win32' ? '.exe' : '';
      return `${process.env.JAVA_HOME}${sep}bin${sep}java${ext}`;
    }

    return 'java';
  },

  getDebuggerConfiguration: () => {
    return {
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsVariableType: true
    };
  },

  isSessionReady: (state: SessionState) => state === SessionState.PAUSED,

  validateExecutable: async (javaCmd: string): Promise<boolean> => {
    const { spawn } = await import('child_process');

    return new Promise((resolve) => {
      const child = spawn(javaCmd, ['-version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let hasOutput = false;
      child.stderr?.on('data', () => {
        hasOutput = true;
      });
      child.stdout?.on('data', () => {
        hasOutput = true;
      });

      child.on('error', () => resolve(false));
      child.on('exit', (code) => {
        resolve(code === 0 && hasOutput);
      });
    });
  },

  requiresCommandQueueing: (): boolean => false,

  shouldQueueCommand: (): CommandHandling => {
    return {
      shouldQueue: false,
      shouldDefer: false,
      reason: 'Java adapter does not queue commands'
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

    return commandStr.includes('kotlin-debug-adapter') ||
           commandStr.includes('kda') ||
           commandStr.includes('stdio-tcp-bridge') ||
           argsStr.includes('kotlin-debug-adapter') ||
           argsStr.includes('kda') ||
           argsStr.includes('java-debug');
  },

  getInitializationBehavior: () => {
    return {
      deferConfigDone: false,
      defaultStopOnEntry: true,
      sendLaunchBeforeConfig: false,
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

    return frames.filter(frame => {
      const filePath = frame.file || '';
      const frameName = frame.name || '';

      // Filter out JDK internal frames
      if (frameName.startsWith('java.') || frameName.startsWith('javax.') || frameName.startsWith('sun.')) {
        return false;
      }
      if (filePath.includes('/jdk/') || filePath.includes('/rt.jar/')) {
        return false;
      }

      return true;
    });
  },

  isInternalFrame: (frame: StackFrame): boolean => {
    const frameName = frame.name || '';
    return frameName.startsWith('java.') || frameName.startsWith('javax.') || frameName.startsWith('sun.');
  },

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

    // Default: launch the stdio-tcp bridge which wraps kotlin-debug-adapter
    return {
      command: 'node',
      args: [
        'stdio-tcp-bridge.js',
        '--port', String(payload.adapterPort)
      ],
      host: payload.adapterHost,
      port: payload.adapterPort,
      logDir: payload.logDir
    };
  }
};
