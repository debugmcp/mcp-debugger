/**
 * DartAdapterPolicy — DAP proxy policy for the Dart and Flutter SDK debug adapters
 * (`dart debug_adapter [--test]`, `flutter debug-adapter [--test]`), issue #790.
 *
 * Everything here is measured (docs/dart/spike-notes.md):
 *
 * - The adapters speak stdio only; the Dart adapter package wraps them in a TCP-to-stdio bridge
 *   and hands the bridge command over as `payload.adapterCommand`. There is no sensible fallback
 *   command, so the policy refuses to guess one.
 * - `initialized` arrives in the same chunk as the `initialize` response, and launch/attach wait
 *   for `configurationDone` inside the adapter: send launch before configuration, like Go/.NET.
 * - Capabilities: conditional breakpoints and logpoints yes; function breakpoints, hit conditions,
 *   `exceptionInfo`, `setVariable`, `completions` no. Exception filters `All` / `Unhandled`.
 * - `noDebug: true` really turns the debugger off (no stops, no VM-service URI).
 * - Scopes are `Locals` and `Globals` (plus `Exceptions` at an exception stop); frames below
 *   `main` are SDK internals under `lib/_internal/vm/lib`; async stacks carry `<asynchronous gap>`
 *   label frames at line 0.
 * - A paused idle isolate (attach + pause while it awaits) has an empty stack.
 * - `disconnect` alone is the SDK adapter's forced path: it SIGKILLs the adapter's own tool
 *   processes and leaves a `flutter run` desktop app running (#885). `terminate` (`app.stop`)
 *   is what stops the app, ~1 s, after which the adapter exits by itself — so the worker sends
 *   `terminate` first (terminateBeforeDisconnect).
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy, AdapterSpecificState, CommandHandling, LocalVariableExtraction } from './adapter-policy.js';
import { emptyLocalVariableExtraction, extractionFromScope } from './adapter-policy.js';
import type { StackFrame, Variable } from '../models/index.js';
import type { DapClientBehavior, DapClientContext, ReverseRequestResult } from './dap-client-behavior.js';

export const DART_LOCAL_SCOPE_NAMES = ['Locals'] as const;
export const DART_BRIDGE_BASENAME = 'dap-stdio-bridge';

const ASYNC_GAP = /^<asynchronous gap>$/;
const SDK_INTERNAL_PATH = /[\\/]lib[\\/]_internal[\\/]|[\\/]dart-sdk[\\/]lib[\\/]|^dart:/;

function isAsyncGap(frame: StackFrame): boolean {
  const hint = (frame as { presentationHint?: string }).presentationHint;
  return ASYNC_GAP.test(frame.name ?? '') || (hint === 'label' && !frame.file);
}

/** The `main(` declaration; the VM binds a breakpoint on that line to main's first statement. */
const MAIN_DECLARATION = /\bmain\s*\(/;
/**
 * The line with its string literals blanked and its `//` comment cut, so `main(` inside either
 * does not count. A hand-written scan, linear by construction: CodeQL's polynomial-ReDoS check
 * rejects the regex forms (`(["'])(?:\\.|(?!\1).)*\1` and even the disjoint
 * `"(?:[^"\\]|\\.)*"`) on an unterminated literal full of escaped quotes.
 */
const codeOnly = (line: string): string => {
  let out = '';
  let quote: string | undefined;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote !== undefined) {
      if (ch === '\\') {
        i++; // the escaped character is part of the literal
      } else if (ch === quote) {
        quote = undefined;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += '""';
      continue;
    }
    if (ch === '/' && line[i + 1] === '/') {
      break;
    }
    out += ch;
  }
  return out;
};

/** What the Dart policy learns from the Flutter adapter's events for `hot_reload` (issue #876). */
interface DartLiveUpdateState {
  flutterApp?: { started: boolean; launchMode?: string; supportsRestart?: boolean };
}

export const DartAdapterPolicy = {
  name: 'dart',
  supportsLogPoints: true,
  supportsFunctionBreakpoints: false,
  honoursNoDebug: true,
  terminateBeforeDisconnect: true,
  // The Flutter adapter advertises `supportsRestartRequest` once the app has started (a
  // `capabilities` event) and its `restart` is a hot restart: main() re-runs in the same
  // process and build() re-hits ~0.4 s later (issue #876). The Dart CLI adapter never
  // advertises it, so a Dart program keeps the relaunch.
  restartViaDapRequest: true,
  // Flutter hot reload (issue #876): the SDK adapter's `hotReload` request, once the app has
  // started — learned from the adapter's `flutter.appStart` / `flutter.appStarted` events,
  // which the worker forwards for this. The reassemble runs build(), so a breakpoint there
  // fires ~150 ms after the request, before the response on some platforms. A Dart CLI
  // program has no Flutter app: refused by name.
  liveUpdate: {
    events: ['flutter.appStart', 'flutter.appStarted'],
    resumeCommands: ['hotReload'],
    onEvent: (state: unknown, event: string, body: unknown): DartLiveUpdateState => {
      const current = (state ?? {}) as DartLiveUpdateState;
      const params = (body ?? {}) as Record<string, unknown>;
      if (event === 'flutter.appStart') {
        return { ...current, flutterApp: { started: false, launchMode: typeof params.launchMode === 'string' ? params.launchMode : undefined, supportsRestart: params.supportsRestart === true } };
      }
      if (event === 'flutter.appStarted') {
        return { ...current, flutterApp: { ...(current.flutterApp ?? { started: false }), started: true } };
      }
      return current;
    },
    request: (args, state): { command: string } | { refused: string } => {
      if (args.classesDir !== undefined || args.sinceTimestamp !== undefined) {
        return { refused: 'classesDir and sinceTimestamp are the Java hot-swap arguments; a Flutter hot reload takes none' };
      }
      const app = (state as DartLiveUpdateState | undefined)?.flutterApp;
      if (!app) {
        return { refused: 'this session runs `dart`, not `flutter run` or `flutter attach`: hot reload is a Flutter feature (a Dart CLI program has no widget tree to reassemble)' };
      }
      if (!app.started) {
        return { refused: 'the Flutter app has not reported appStarted yet; call wait_for_stop or get_output, then retry' };
      }
      return { command: 'hotReload' };
    },
    changed: () => true,
    mayStopDuringUpdate: true,
  },
  // `next` stops once per token position: app.dart:29 (`counter.value + 2`)
  // took three step_overs, columns 16, 26 and 32 (issue #879).
  stepsByTokenPosition: true,
  // The adapter pauses each new isolate at start, reports it as an entry stop and resumes it
  // itself 1 ms later (measured) — the worker holds it and drops it with that resume; a durable
  // one (a VM started with --pause_isolates_on_start) is still reported.
  suppressesAdapterEntryStop: true,
  entryBreakpointLine: (sourceText: string): number | undefined => {
    const lines = sourceText.split(/\r?\n/);
    const idx = lines.findIndex((l) => MAIN_DECLARATION.test(codeOnly(l)));
    return idx >= 0 ? idx + 1 : undefined;
  },
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  buildChildStartArgs: () => {
    throw new Error('DartAdapterPolicy does not support child sessions');
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => evt?.event === 'initialized',

  extractLocalVariables: (
    stackFrames: StackFrame[],
    scopes: Record<number, DebugProtocol.Scope[]>,
    variables: Record<number, Variable[]>,
    _includeSpecial: boolean = false
  ): LocalVariableExtraction => {
    if (!stackFrames || stackFrames.length === 0) return emptyLocalVariableExtraction();
    const frameScopes = scopes[stackFrames[0].id];
    if (!frameScopes || frameScopes.length === 0) return emptyLocalVariableExtraction();
    const local = frameScopes.find((s) => (DART_LOCAL_SCOPE_NAMES as readonly string[]).includes(s.name));
    if (!local) return emptyLocalVariableExtraction();
    return extractionFromScope(local, variables[local.variablesReference] || []);
  },

  getLocalScopeName: (): string[] => [...DART_LOCAL_SCOPE_NAMES],

  getDapAdapterConfiguration: () => ({ type: 'dart' }),

  resolveExecutablePath: (providedPath?: string): string => providedPath || 'dart',

  getDebuggerConfiguration: () => ({
    requiresStrictHandshake: false,
    skipConfigurationDone: false,
    supportsVariableType: true
  }),

  requiresCommandQueueing: (): boolean => false,

  shouldQueueCommand: (): CommandHandling => ({ shouldQueue: false, shouldDefer: false, reason: 'Dart adapter does not queue commands' }),

  createInitialState: (): AdapterSpecificState => ({ initialized: false, configurationDone: false }),

  updateStateOnCommand: (command: string, _args: unknown, state: AdapterSpecificState): void => {
    if (command === 'configurationDone') state.configurationDone = true;
  },

  updateStateOnEvent: (event: string, _body: unknown, state: AdapterSpecificState): void => {
    if (event === 'initialized') state.initialized = true;
  },

  isInitialized: (state: AdapterSpecificState): boolean => state.initialized,
  isConnected: (state: AdapterSpecificState): boolean => state.initialized,

  /** The adapter is always reached through the bridge; the bridge's basename is the signature. */
  matchesAdapter: (adapterCommand: { command: string; args: string[] }): boolean =>
    adapterCommand.args.some((a) => a.toLowerCase().includes(DART_BRIDGE_BASENAME)),

  getInitializationBehavior: () => ({
    // `initialized` follows the initialize response immediately, and the adapter answers
    // launch/attach only after configurationDone (measured) — debugpy's shape. The default
    // flow configures as soon as `initialized` arrives while the launch stays pending; the
    // launch-before-config flow would wait for a launch response that cannot come first.
    sendLaunchBeforeConfig: false,
    // Attach answers after configurationDone too: send it first, configure while it is pending.
    sendAttachBeforeInitialized: true,
    exceptionFilters: {
      uncaught: ['Unhandled'],
      all: ['All']
    },
    defaultExceptionBreakMode: 'uncaught'
  }),

  getDapClientBehavior: (): DapClientBehavior => ({
    handleReverseRequest: async (request: DebugProtocol.Request, context: DapClientContext): Promise<ReverseRequestResult> => {
      // Never expected: the launch transform strips `console`, so the adapter owns the debuggee.
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
  }),

  /** Attaching to a running isolate reports no stop; `pause` answers in a few ms (measured). */
  getAttachBehavior: () => ({ pauseAfterAttach: true }),

  isAsyncBoundaryFrame: (frame: StackFrame): boolean => isAsyncGap(frame),

  isInternalFrame: (frame: StackFrame): boolean => {
    if (isAsyncGap(frame)) return true;
    const file = frame.file || '';
    return !file || SDK_INTERNAL_PATH.test(file);
  },

  filterStackFrames: (frames: StackFrame[], includeInternals: boolean): StackFrame[] =>
    includeInternals ? frames : frames.filter((f) => !DartAdapterPolicy.isInternalFrame(f)),

  getAdapterSpawnConfig: (payload) => {
    if (!payload.adapterCommand) {
      throw new Error('Dart adapter spawn config requires the stdio bridge command from DartDebugAdapter.buildAdapterCommand (the SDK debug adapters speak stdio only)');
    }
    return {
      mode: 'spawn',
      command: payload.adapterCommand.command,
      args: payload.adapterCommand.args,
      host: payload.adapterHost,
      port: payload.adapterPort,
      logDir: payload.logDir,
      env: payload.adapterCommand.env,
      cwd: payload.adapterCommand.cwd
    };
  }
} satisfies AdapterPolicy;
