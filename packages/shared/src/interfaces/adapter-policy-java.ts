/**
 * JavaAdapterPolicy - policy for Java Debug Adapter (JDI bridge / JdiDapServer)
 *
 * JdiDapServer speaks DAP over TCP natively using JDI. It uses a non-standard
 * init ordering (sendLaunchBeforeConfig: true) because JdiDapServer emits
 * "initialized" during the initialize handshake, before the launch request.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy, AdapterSpecificState, CommandHandling, LocalVariableExtraction } from './adapter-policy.js';
import { emptyLocalVariableExtraction, extractionFromScope } from './adapter-policy.js';
import { SessionState } from '@debugmcp/shared';
import type { StackFrame, Variable } from '../models/index.js';
import type { DapClientBehavior, DapClientContext, ReverseRequestResult } from './dap-client-behavior.js';

/** Package prefixes identifying JDK-internal classes in frame names or FQCNs. */
const JDK_INTERNAL_PREFIXES = ['java.', 'javax.', 'sun.', 'jdk.', 'com.sun.'];

export const JavaAdapterPolicy: AdapterPolicy = {
  name: 'java',
  supportsLogPoints: false,
  // JdiDapServer implements setFunctionBreakpoints natively: BreakpointRequests
  // at each concrete overload's entry location, with ClassPrepareRequest
  // deferral for classes not yet loaded (issue #292)
  supportsFunctionBreakpoints: true,
  // Classes not yet loaded bind via ClassPrepareRequest deferral —
  // unverified-at-launch is not a failure here (issue #308).
  functionBreakpointsBindLate: true,
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  buildChildStartArgs: () => {
    throw new Error('JavaAdapterPolicy does not support child sessions');
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => {
    return evt?.event === 'initialized';
  },

  isNonFileSourceIdentifier: (sourceIdentifier: string): boolean => {
    // Java FQCNs (e.g. "com.example.MyClass", "com.example.Outer$Inner")
    // have no path separators and don't end with ".java"
    return !sourceIdentifier.includes('/') &&
           !sourceIdentifier.includes('\\') &&
           !sourceIdentifier.endsWith('.java');
  },

  extractLocalVariables: (
    stackFrames: StackFrame[],
    scopes: Record<number, DebugProtocol.Scope[]>,
    variables: Record<number, Variable[]>,
    _includeSpecial: boolean = false
  ): LocalVariableExtraction => {
    if (!stackFrames || stackFrames.length === 0) {
      return emptyLocalVariableExtraction();
    }

    const topFrame = stackFrames[0];
    const frameScopes = scopes[topFrame.id];

    if (!frameScopes || frameScopes.length === 0) {
      return emptyLocalVariableExtraction();
    }

    // JDI bridge uses "Locals" for the local scope
    const localScope = frameScopes.find(scope =>
      scope.name === 'Locals' || scope.name === 'Local'
    );

    if (!localScope) {
      return emptyLocalVariableExtraction();
    }

    return extractionFromScope(localScope, variables[localScope.variablesReference] || []);
  },

  getLocalScopeName: (): string[] => {
    return ['Locals'];
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
        windowsHide: true,
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

    return commandStr.includes('jdidapserver') ||
           argsStr.includes('jdidapserver') ||
           argsStr.includes('jdi-bridge') ||
           argsStr.includes('java-debug');
  },

  // The JDI bridge does NOT suspend the VM on attach (its attach handler
  // only suspends for stopOnEntry in the DAP args, which the transform does
  // not send) — so without an explicit pause the session reports PAUSED
  // while the JVM keeps running, and every thread refuses stackTrace
  // ("not suspended"), leaving the session uninspectable (issue #465).
  // pauseAllThreads: the bridge's pause-all suspends the whole VM and
  // anchors its stopped event to a thread that can actually report frames.
  // The bridge's pause is idempotent: on a JVM that is already fully
  // suspended (JDWP suspend=y attach) it reports stopped without deepening
  // the JDI suspend count, so a single continue still releases the VM.
  getAttachBehavior: () => ({ pauseAfterAttach: true, pauseAllThreads: true }),

  // JdiDapServer sends "initialized" during initialize (before launch).
  // sendLaunchBeforeConfig tells the proxy to wait for initialized first,
  // then send launch, then breakpoints + configurationDone.
  getInitializationBehavior: () => {
    return {
      sendLaunchBeforeConfig: true,
      // JdiDapServer honors exactly 'caught' and 'uncaught'
      exceptionFilters: {
        uncaught: ['uncaught'],
        all: ['caught', 'uncaught']
      },
      // Launch sessions pause at uncaught exceptions by default (issue #244)
      defaultExceptionBreakMode: 'uncaught'
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

    const filtered = frames.filter(frame => !JavaAdapterPolicy.isInternalFrame!(frame));
    // Never hide the entire stack: a thread parked deep in JDK code (e.g. a
    // pause inside Thread.sleep on a pure-JDK stack) must still show frames.
    return filtered.length > 0 ? filtered : frames;
  },

  isInternalFrame: (frame: StackFrame): boolean => {
    const frameName = frame.name || '';
    const filePath = frame.file || '';

    if (JDK_INTERNAL_PREFIXES.some(p => frameName.startsWith(p))) {
      return true;
    }
    // When a class has no debug info (AbsentInformationException), the JDI
    // bridge emits only source.name = declaring type FQCN and no path, which
    // session-manager maps into `file`. Treat it as a class name only when it
    // doesn't look like a real file path.
    const looksLikeFqcn =
      filePath.length > 0 && JavaAdapterPolicy.isNonFileSourceIdentifier!(filePath);
    if (looksLikeFqcn && JDK_INTERNAL_PREFIXES.some(p => filePath.startsWith(p))) {
      return true;
    }
    return filePath.includes('/jdk/') || filePath.includes('/rt.jar/');
  },

  getAdapterSpawnConfig: (payload) => {
    if (payload.adapterCommand) {
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

    // Default: launch JdiDapServer directly
    return {
      mode: 'spawn',
      command: 'java',
      args: [
        '-cp', 'java/out',
        'JdiDapServer',
        '--port', String(payload.adapterPort)
      ],
      host: payload.adapterHost,
      port: payload.adapterPort,
      logDir: payload.logDir
    };
  }
};
