/**
 * JavaAdapterPolicy - policy for Java Debug Adapter (JDI bridge / JdiDapServer)
 *
 * JdiDapServer speaks DAP over TCP natively using JDI. It uses a non-standard
 * init ordering (sendLaunchBeforeConfig: true) because JdiDapServer emits
 * "initialized" during the initialize handshake, before the launch request.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import type { AdapterPolicy, AdapterSpecificState, CommandHandling, GeneratedFileCandidate, GeneratedFileContext, LocalVariableExtraction, UnresolvedSourceContext } from './adapter-policy.js';
import { emptyLocalVariableExtraction, extractionFromScope } from './adapter-policy.js';
import type { StackFrame, Variable } from '../models/index.js';
import type { DapClientBehavior, DapClientContext, ReverseRequestResult } from './dap-client-behavior.js';

/** Package prefixes identifying JDK-internal classes in frame names or FQCNs. */
const JDK_INTERNAL_PREFIXES = ['java.', 'javax.', 'sun.', 'jdk.', 'com.sun.'];

/** How many trailing directories of a source's path are tried as its package path under a classpath entry (issue #950). */
const MAX_PACKAGE_DEPTH = 8;
/** A classpath entry that is an archive: a class inside it has no file of its own to stamp. */
const ARCHIVE_ENTRY = /\.(jar|zip)$/i;

/**
 * The classpath directories a launch runs against, absolute (issue #950): the
 * launch config's `classpath` — the platform's delimiter-joined string or an
 * array; `.` when it names none, as the JDI bridge defaults it — resolved
 * against the launch `cwd`. Archives and wildcard entries are skipped, and so
 * is a relative entry when no cwd is known to resolve it against.
 */
function classpathDirectories(launchConfig: Record<string, unknown>): string[] {
  const raw = launchConfig.classpath;
  const entries = Array.isArray(raw)
    ? raw.filter((entry): entry is string => typeof entry === 'string')
    : typeof raw === 'string' && raw.length > 0
      ? raw.split(path.delimiter)
      : ['.'];
  const cwd = typeof launchConfig.cwd === 'string' && launchConfig.cwd.length > 0 ? launchConfig.cwd : undefined;
  const dirs: string[] = [];
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (trimmed.length === 0 || trimmed.includes('*') || ARCHIVE_ENTRY.test(trimmed)) {
      continue;
    }
    if (path.isAbsolute(trimmed)) {
      dirs.push(trimmed);
    } else if (cwd !== undefined) {
      dirs.push(path.resolve(cwd, trimmed));
    }
  }
  return dirs;
}

export const JavaAdapterPolicy = {
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

  /**
   * Where a `.java` binds (issue #950): the `.class` whose LineNumberTable
   * JDI resolves the line through. The adapter never compiles user code, so
   * every launch is a prebuilt one. The class file is `<classpath dir>/<package
   * path>/<Name>.class`, and the package path mirrors the source's directory
   * chain under every build tool and under `javac -d`, so the last k
   * directories of the source's path are tried under each classpath
   * directory, deepest first (the most specific match wins), then the sibling
   * `<Name>.class` a bare `javac Foo.java` emits. A source's inner classes are
   * emitted with the outer, so the outer file's mtime stands for all. Unknown
   * before a launch: the classpath is the launch's.
   */
  generatedFileCandidates: (info: GeneratedFileContext): GeneratedFileCandidate[] | undefined => {
    const { sourcePath, launchConfig } = info;
    if (launchConfig === undefined || path.extname(sourcePath).toLowerCase() !== '.java') {
      return undefined;
    }
    const classFile = `${path.basename(sourcePath, path.extname(sourcePath))}.class`;
    const dir = path.dirname(sourcePath);
    const segments = path.relative(path.parse(dir).root, dir).split(/[\\/]/).filter(segment => segment.length > 0);
    const candidates: string[] = [];
    for (const entry of classpathDirectories(launchConfig)) {
      for (let depth = Math.min(MAX_PACKAGE_DEPTH, segments.length); depth >= 0; depth--) {
        candidates.push(path.join(entry, ...segments.slice(segments.length - depth), classFile));
      }
    }
    candidates.push(path.join(dir, classFile));
    // Dedupe: a classpath entry that is the source directory coincides with the sibling.
    const seen = new Set<string>();
    return candidates
      .filter(candidate => {
        const normalized = path.normalize(candidate);
        const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .map(candidate => ({ path: candidate, linkedBy: 'launch' as const }));
  },

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

  /**
   * An unresolvedSource frame under the JDI bridge (issues #672/#816) is a
   * class the bridge has no file path for: `resolveSourcePath` knows a path
   * only for classes a breakpoint was set in, and names every other one by
   * package path (`java/io/PrintStream.java`, `com/example/Foo.java`). The
   * class may well have source — it is the path the bridge lacks.
   */
  describeUnresolvedSource: (info: UnresolvedSourceContext): string => {
    const example = info.files[0] ? ` (${info.files[0]})` : '';
    return (
      `${info.count === 1 ? 'It is a class' : 'They are classes'} the JDI bridge names by package path${example} ` +
      'because it has no file path for them: a breakpoint set in a class\'s source file teaches the bridge its ' +
      "path, and the JDK's own classes have no source on this host."
    );
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
} satisfies AdapterPolicy;
