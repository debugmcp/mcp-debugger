/**
 * CodeLLDB-generic policy helpers shared by every LLDB-backed adapter policy
 * (rust, cpp). These encode engine-level quirks — they are identical for any
 * language debugged through CodeLLDB, so both policies compose them instead
 * of copy-pasting (issue #325).
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import type {
  AdapterSpawnConfig,
  AdapterSpawnPayload,
  AdapterSpecificState,
  CommandHandling,
  LocalVariableExtraction,
  StopReasonContext
} from './adapter-policy.js';
import { emptyLocalVariableExtraction, extractionFromScope } from './adapter-policy.js';
import type { StackFrame, Variable } from '../models/index.js';
import type { DapClientBehavior, DapClientContext, ReverseRequestResult } from './dap-client-behavior.js';

/** CodeLLDB names the locals scope "Local" or "Locals" depending on version. */
export const LLDB_LOCAL_SCOPE_NAMES = ['Local', 'Locals'] as const;

/**
 * Three CodeLLDB stop-reason quirks are normalized here:
 *
 * 1. A user-initiated pause is reported as reason 'exception': POSIX
 *    delivers it via SIGSTOP; Windows via DebugBreakProcess, whose
 *    injected break-in thread raises EXCEPTION_BREAKPOINT 0x80000003
 *    (issue #275). Map both back to 'pause'. A post-attach pause may carry
 *    any platform-specific exception detail, so its generation-scoped
 *    intent is authoritative; public pauses retain the narrower Windows
 *    detail checks so coincident real exceptions are not mislabeled.
 *
 * 2. An exception-filter hit (rust_panic, cpp_throw) is reported as reason
 *    'breakpoint' because CodeLLDB implements filters as internal
 *    breakpoints (issue #260). Live capture (CodeLLDB 1.11.8): the stopped
 *    body is only {allThreadsStopped, hitBreakpointIds, reason, threadId} —
 *    no description/text to match on — so the discriminator is that the hit
 *    ids are disjoint from every user-set breakpoint id. Both sides must
 *    be known: no hitBreakpointIds (e.g. a step completion mislabeled as
 *    'breakpoint', the issue #255 trace) or no userBreakpointIds
 *    (incomplete bookkeeping) means keep the raw reason. The asymmetry is
 *    deliberate — a missed filter hit merely keeps the cosmetic
 *    'breakpoint' label, while a false 'exception' would mislead callers.
 *
 * 3. A function-breakpoint hit is also reported as plain 'breakpoint'
 *    (issue #302): CodeLLDB does not distinguish. When every hit id is a
 *    known function-breakpoint id, relabel to 'function breakpoint' —
 *    matching debugpy/delve, which send it natively. Mixed line+function
 *    hits keep 'breakpoint' (DAP convention: the plain reason wins).
 */
export function normalizeLldbStopReason(
  reason: string,
  body: DebugProtocol.StoppedEvent['body'] | undefined,
  context: StopReasonContext
): string | undefined {
  if (reason === 'breakpoint') {
    const hitIds = body?.hitBreakpointIds;
    if (!Array.isArray(hitIds) || hitIds.length === 0 || !context.userBreakpointIds) {
      return undefined;
    }
    const hitsUserBreakpoint = hitIds.some((id) => context.userBreakpointIds!.has(id));
    if (!hitsUserBreakpoint) {
      return 'exception';
    }
    if (
      context.functionBreakpointIds &&
      hitIds.every((id) => context.functionBreakpointIds!.has(id))
    ) {
      return 'function breakpoint';
    }
    return undefined;
  }
  if (reason !== 'exception') {
    return undefined;
  }
  const detail = `${body?.description ?? ''} ${body?.text ?? ''}`;
  if (/SIGSTOP/i.test(detail)) {
    return 'pause';
  }
  if (context.pauseSource === 'attach') {
    return 'pause';
  }
  // Windows delivers a user-initiated pause via DebugBreakProcess: the
  // injected break-in thread raises EXCEPTION_BREAKPOINT (0x80000003),
  // which CodeLLDB reports as an exception stop (issue #275; captured
  // description: "Exception 0x80000003 encountered at address 0x…").
  // Gated on pausePending so a genuine __debugbreak()/int3 in user code
  // with no pause in flight stays an exception stop.
  if (context.pausePending && /0x80000003/i.test(detail)) {
    return 'pause';
  }
  if (context.pausePending && detail.trim() === '') {
    return 'pause';
  }
  return undefined;
}

/**
 * Extract local variables from the LLDB "Local"/"Locals" scope of the top
 * frame, filtering LLDB-internal names ($…, __…, _lldb…, _debug…) unless
 * includeSpecial is set.
 */
export function extractLldbLocalVariables(
  stackFrames: StackFrame[],
  scopes: Record<number, DebugProtocol.Scope[]>,
  variables: Record<number, Variable[]>,
  includeSpecial: boolean = false
): LocalVariableExtraction {
  if (!stackFrames || stackFrames.length === 0) {
    return emptyLocalVariableExtraction();
  }

  const topFrame = stackFrames[0];
  const frameScopes = scopes[topFrame.id];

  if (!frameScopes || frameScopes.length === 0) {
    return emptyLocalVariableExtraction();
  }

  const localScope = frameScopes.find((scope) =>
    (LLDB_LOCAL_SCOPE_NAMES as readonly string[]).includes(scope.name)
  );

  if (!localScope) {
    return emptyLocalVariableExtraction();
  }

  let localVars = variables[localScope.variablesReference] || [];

  if (!includeSpecial) {
    localVars = localVars.filter((v) => {
      const name = v.name;

      // Skip LLDB internal variables
      if (name.startsWith('$') || name.startsWith('__')) {
        return false;
      }

      // Skip debugger internal variables
      if (name.startsWith('_lldb') || name.startsWith('_debug')) {
        return false;
      }

      return true;
    });
  }

  return extractionFromScope(localScope, localVars);
}

/**
 * Symbols LLDB synthesizes for stripped/unnamed code regions, e.g.
 * '___lldb_unnamed_symbol3688'. Frame names sometimes arrive with a leading
 * '@' (CodeLLDB renders source-less frames as '@symbol'), which is stripped
 * before matching.
 */
const LLDB_UNNAMED_SYMBOL_PATTERN = /^_*_lldb_unnamed_symbol/;

/** glibc internal aliases, e.g. '__GI___clock_nanosleep'. */
const GLIBC_INTERNAL_PATTERN = /^__GI_/;

/**
 * libc/runtime entry and thread plumbing — internal only when the frame also
 * lacks user source (see isLldbInternalFrame).
 */
const LIBC_RUNTIME_NAME_PATTERNS = [
  /^__libc_/,
  /^_start$/,
  /^__clone/,
  /^clone3?$/
];

/**
 * Common syscall wrappers that show up above user code in blocked/sleeping
 * threads. A user function may legitimately share one of these names, so
 * these only count as internal when the frame has no user source.
 */
const SYSCALL_WRAPPER_NAMES = new Set([
  'clock_nanosleep',
  'nanosleep',
  'usleep',
  'sleep',
  'poll',
  'ppoll',
  'epoll_wait',
  'epoll_pwait',
  'select',
  'pselect',
  'read',
  'write',
  'pread',
  'pwrite',
  'accept',
  'accept4',
  'recv',
  'recvfrom',
  'recvmsg',
  'send',
  'sendto',
  'sendmsg',
  'wait4',
  'waitpid',
  'futex_wait',
  'futex_wake',
  'sigwait',
  'sigtimedwait',
  'pause'
]);

/**
 * Source paths that mark a frame as non-user code: system libraries and
 * headers, glibc build-tree paths (sysdeps/nptl), and rustc's std sources.
 * Only consulted for name-matched frames — a plain user frame that happens
 * to live under /usr is never hidden by path alone.
 */
const SYSTEM_SOURCE_PATH_PATTERNS = [
  '/usr/lib',
  '/lib/',
  '/lib64/',
  '/usr/include/',
  '../sysdeps/',
  './nptl/',
  '/rustc/'
];

function isSystemOrMissingSource(file: string | undefined): boolean {
  if (!file || file === '<unknown_source>') {
    return true;
  }
  return SYSTEM_SOURCE_PATH_PATTERNS.some((pattern) => file.includes(pattern));
}

/**
 * Classify an LLDB stack frame as debugger/libc/runtime-internal (issue
 * #369). Two rule classes:
 *
 * 1. Pure-name rules — LLDB-synthesized unnamed symbols and glibc '__GI_'
 *    aliases are internal regardless of source (they never carry user
 *    source anyway).
 * 2. Name+source rules — libc runtime plumbing and syscall wrappers are
 *    internal only when the frame ALSO has no user source (absent,
 *    '<unknown_source>', or a system path). A user function named e.g.
 *    'nanosleep' with workspace source is kept.
 */
export function isLldbInternalFrame(frame: StackFrame): boolean {
  // CodeLLDB renders source-less frames as '@symbol' — strip the sigil.
  const name = (frame.name ?? '').replace(/^@/, '');

  if (LLDB_UNNAMED_SYMBOL_PATTERN.test(name) || GLIBC_INTERNAL_PATTERN.test(name)) {
    return true;
  }

  const nameMatches =
    LIBC_RUNTIME_NAME_PATTERNS.some((pattern) => pattern.test(name)) ||
    SYSCALL_WRAPPER_NAMES.has(name);
  return nameMatches && isSystemOrMissingSource(frame.file);
}

/**
 * Filter LLDB stack frames through isLldbInternalFrame. Deliberately no
 * empty-result fallback here — the central guarantee in
 * session-manager-data (issue #346) restores the top frame when every
 * frame is internal, and duplicating it would mask that annotation.
 */
export function filterLldbStackFrames(frames: StackFrame[], includeInternals: boolean): StackFrame[] {
  if (includeInternals) {
    return frames;
  }
  return frames.filter((frame) => !isLldbInternalFrame(frame));
}

/**
 * LLDB's own DWARF-parser diagnostics (issue #361). MinGW/g++-generated
 * debug info routinely trips LLDB's DWARF parser into printing multi-line
 * "error: ..." spew on stderr ("DIE has DW_AT_ranges ... range extraction
 * failed", "DW_TAG_member '...' refers to type ... which extends beyond the
 * bounds ..."), even though debugging then works perfectly. These are
 * adapter internals, not debuggee output — filter them out of the captured
 * output buffer the same way 'telemetry' events are.
 *
 * Patterns are anchored on DWARF-specific tokens (DIE / DW_AT_ / DW_TAG_ /
 * "please file a bug") so genuine program stderr containing the word
 * "error:" is never eaten.
 */
const LLDB_DWARF_NOISE_PATTERNS: RegExp[] = [
  // "error: <module> [0x...]: DIE has DW_AT_ranges(...) attribute, but ..."
  /^error:\s+.*\bDIE\b.*\bDW_AT_/,
  // "error: <module> 0x...: DW_TAG_member '...' refers to type ... which extends beyond the bounds ..."
  /^error:\s+.*\bDW_TAG_\w+\b/,
  // Generic DWARF diagnostic shape: "error: <module> 0x...: ... DW_AT_..."
  /^error:\s+\S+.*\bDW_(AT|TAG|FORM)_\w+/,
  // Continuation lines of the multi-line DIE diagnostic (LLDB wraps it; the
  // pieces can arrive trimmed or even as separate line-buffered events)
  /\bplease file a bug and attach the file\b/,
  /^start of this error message$/,
  /\brange extraction failed\b/,
  /\binvalid range list offset\b/,
  /\bextends beyond the bounds of 0x[0-9a-f]+\b/
];

/**
 * Suppress a DAP output event when it is purely LLDB DWARF-parser noise.
 * Multi-line events are dropped only when EVERY non-empty line matches a
 * noise pattern — mixed content always passes through untouched (never
 * partially rewritten).
 */
export function lldbShouldSuppressOutputEvent(category: string, text: string): boolean {
  if (category !== 'stderr' && category !== 'console') {
    return false;
  }
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0) {
    return false;
  }
  return lines.every((line) => LLDB_DWARF_NOISE_PATTERNS.some((pattern) => pattern.test(line)));
}

/**
 * CodeLLDB's lang_support/__init__.py prints this when a language module's
 * init throws — for Rust, typically because `rustc --print=sysroot` is not
 * available to locate the formatter scripts (issue #441). The session keeps
 * working, but &str/String/collection values render as raw LLDB structures.
 */
const LLDB_RUST_LANG_SUPPORT_FAILURE = /Failed to initialize language support for rust/i;

/**
 * Annotate a DAP output event that signals CodeLLDB failed to load its Rust
 * language support, so the degraded value rendering is attributable instead
 * of reading as a debugger bug. Returns undefined for everything else.
 */
export function lldbAnnotateOutputEvent(category: string, text: string): string | undefined {
  if (category !== 'stderr' && category !== 'console') {
    return undefined;
  }
  if (!LLDB_RUST_LANG_SUPPORT_FAILURE.test(text)) {
    return undefined;
  }
  return (
    'Rust type summaries are unavailable for this session: CodeLLDB could not load the ' +
    'Rust formatter scripts (no rustc on PATH and no valid CODELLDB_RUST_SYSROOT). ' +
    'String/&str/Vec values will render as raw LLDB structures. Set CODELLDB_RUST_SYSROOT ' +
    "to a directory whose lib/rustlib/etc contains the Rust toolchain's LLDB formatters, " +
    'or install rustc.'
  );
}

/**
 * Validate that a CodeLLDB binary exists and answers --version with output
 * containing 'codelldb'.
 */
export async function validateCodeLLDBExecutable(codelldbPath: string): Promise<boolean> {
  // Import fs/spawn dynamically to avoid issues in browser environments
  const fs = await import('fs/promises');
  const { spawn } = await import('child_process');

  try {
    await fs.access(codelldbPath, fs.constants.F_OK);

    return new Promise((resolve) => {
      const child = spawn(codelldbPath, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.on('error', () => resolve(false));
      child.on('exit', (code) => {
        resolve(code === 0 && output.includes('codelldb'));
      });
    });
  } catch {
    return false;
  }
}

/** Command-shape match for CodeLLDB spawns (legacy language-less fallback). */
export function matchesLldbAdapterCommand(adapterCommand: { command: string; args: string[] }): boolean {
  const commandStr = adapterCommand.command.toLowerCase();
  const argsStr = adapterCommand.args.join(' ').toLowerCase();

  return commandStr.includes('codelldb') ||
         commandStr.includes('lldb-server') ||
         argsStr.includes('codelldb') ||
         argsStr.includes('lldb');
}

/**
 * Spawn configuration for CodeLLDB: use the adapter-built command verbatim
 * when present, otherwise fall back to the shared vendored tree in
 * @debugmcp/codelldb-common. Windows only (issue #223): CodeLLDB's console
 * mode performs no stdio redirection, and unlike POSIX (where LLDB holds the
 * debuggee's stdio pipes and CodeLLDB emits DAP output events from the
 * STDOUT/STDERR process broadcasts), LLDB on Windows lets the debuggee
 * inherit the adapter process's pipes. Forward those as output events there;
 * on POSIX the channels are exclusive, so this stays off to avoid noise.
 */
export function buildLldbSpawnConfig(
  payload: AdapterSpawnPayload,
  platform: NodeJS.Platform = process.platform,
  arch: NodeJS.Architecture = process.arch
): AdapterSpawnConfig {
  const forwardStdio = platform === 'win32' ? {} : undefined;

  // If a custom adapter command was provided, use it directly
  if (payload.adapterCommand) {
    return {
      mode: 'spawn',
      command: payload.adapterCommand.command,
      args: payload.adapterCommand.args,
      host: payload.adapterHost,
      port: payload.adapterPort,
      logDir: payload.logDir,
      env: payload.adapterCommand.env,
      forwardStdio
    };
  }

  // Otherwise, use the vendored CodeLLDB
  let platformDir = '';
  if (platform === 'win32') {
    platformDir = arch === 'arm64' ? 'win32-arm64' : 'win32-x64';
  } else if (platform === 'darwin') {
    platformDir = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  } else if (platform === 'linux') {
    platformDir = arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const codelldbPath = payload.executablePath ||
    path.resolve(
      process.cwd(),
      'packages',
      'codelldb-common',
      'vendor',
      'codelldb',
      platformDir,
      'adapter',
      `codelldb${platform === 'win32' ? '.exe' : ''}`
    );

  // CodeLLDB is spawned with TCP port for DAP communication
  return {
    mode: 'spawn',
    command: codelldbPath,
    args: [
      '--port', String(payload.adapterPort)
    ],
    host: payload.adapterHost,
    port: payload.adapterPort,
    logDir: payload.logDir,
    env: {
      ...process.env,
      // Windows specific: enable native PDB reader
      ...(platform === 'win32' ? { LLDB_USE_NATIVE_PDB_READER: '1' } : {})
    },
    forwardStdio
  };
}

/** CodeLLDB processes commands immediately — no queueing. */
export function lldbCommandHandling(reason: string): CommandHandling {
  return {
    shouldQueue: false,
    shouldDefer: false,
    reason
  };
}

export function createLldbInitialState(): AdapterSpecificState {
  return {
    initialized: false,
    configurationDone: false
  };
}

export function updateLldbStateOnCommand(command: string, _args: unknown, state: AdapterSpecificState): void {
  if (command === 'configurationDone') {
    state.configurationDone = true;
  }
}

export function updateLldbStateOnEvent(event: string, _body: unknown, state: AdapterSpecificState): void {
  if (event === 'initialized') {
    state.initialized = true;
  }
}

export function isLldbInitialized(state: AdapterSpecificState): boolean {
  return state.initialized;
}

export function isLldbConnected(state: AdapterSpecificState): boolean {
  // LLDB adapters are connected once initialized
  return state.initialized;
}

/** Minimal DAP client behavior — CodeLLDB uses no child sessions. */
export function getLldbDapClientBehavior(): DapClientBehavior {
  return {
    // No reverse requests expected; acknowledge runInTerminal defensively
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
}
