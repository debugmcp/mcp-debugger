/**
 * CobolAdapterPolicy - policy for the COBOL Debug Adapter (GnuCOBOL + CodeLLDB
 * behind the COBOL DAP shim, issue #759)
 *
 * The engine is CodeLLDB, so this composes the shared LLDB helpers exactly as
 * the C/C++ policy does. What differs is what the *shim* in front of CodeLLDB
 * presents: COBOL-shaped scopes (WORKING-STORAGE / LOCAL-STORAGE / LINKAGE /
 * FILE), decoded COBOL values, and a `cobol_runtime_error` exception filter
 * implemented as a function breakpoint on libcob's `cob_runtime_error`.
 *
 * Third CodeLLDB consumer: like cpp, this policy is NOT in DapProxyWorker's
 * legacy command-shape fallback chain — every real session carries a
 * `language`, and `matchesAdapter` only recognises the shim's own argv so a
 * language-less payload can never be mistaken for rust/cpp.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy, LocalVariableExtraction } from './adapter-policy.js';
import { emptyLocalVariableExtraction } from './adapter-policy.js';
import { SessionState } from '@debugmcp/shared';
import type { StackFrame, Variable } from '../models/index.js';
import {
  normalizeLldbStopReason,
  validateCodeLLDBExecutable,
  buildLldbSpawnConfig,
  lldbCommandHandling,
  createLldbInitialState,
  updateLldbStateOnCommand,
  updateLldbStateOnEvent,
  isLldbInitialized,
  isLldbConnected,
  getLldbDapClientBehavior,
  isLldbInternalFrame,
  lldbShouldSuppressOutputEvent
} from './lldb-policy-shared.js';

/**
 * Scopes the COBOL shim synthesises for a frame that belongs to a COBOL program,
 * in the order they are reported; LOCAL-STORAGE, LINKAGE and FILE only when the
 * program has items there.
 */
export const COBOL_SCOPE_NAMES = ['WORKING-STORAGE', 'LOCAL-STORAGE', 'LINKAGE', 'FILE'] as const;

/** The exception filter the shim advertises; breaks on libcob's `cob_runtime_error`. */
export const COBOL_RUNTIME_ERROR_FILTER = 'cobol_runtime_error';

/** Source files the shim maps stops to. Generated C (`.c`, `.c.h`, `.c.l.h`) is never user code here. */
const COBOL_SOURCE_PATTERN = /\.(cob|cbl|cobol|cpy|copy)$/i;
/** `<prog>.c`, `<prog>.c.h`, `<prog>.c.l.h` and the nested-program `<prog>.c.l<N>.h` locals headers. */
const GENERATED_C_PATTERN = /\.c(\.h|\.l\d*\.h)?$/i;

/**
 * `get_local_variables` for COBOL is the union of the shim's data-division
 * scopes of the anchor frame, in declaration order (WORKING-STORAGE first).
 * Plural `scopeRefs` follow the js-debug Block+Local precedent. For a frame
 * outside COBOL (paused inside libcob or C$SLEEP after an attach, a C helper)
 * the shim serves the nearest COBOL program's sections under names that say
 * so — `WORKING-STORAGE of PAYROLL (frame #3)` — and those count here too.
 * Only a stack with no COBOL program above the frame, or one without a
 * symbol manifest, yields an empty extraction with a note rather than the
 * engine's C locals.
 */
/** A data-division scope name as the shim emits it: bare for a COBOL frame, `<SECTION> of <PROGRAM-ID> (frame #N)` when served for a frame above it. */
export function isCobolScopeName(name: string): boolean {
  return COBOL_SCOPE_NAMES.some((section) => name === section || name.startsWith(`${section} of `));
}

export function extractCobolLocalVariables(
  stackFrames: StackFrame[],
  scopes: Record<number, DebugProtocol.Scope[]>,
  variables: Record<number, Variable[]>
): LocalVariableExtraction {
  if (!stackFrames || stackFrames.length === 0) {
    return emptyLocalVariableExtraction();
  }
  const frameScopes = scopes[stackFrames[0].id] ?? [];
  if (frameScopes.length === 0) {
    // Contract: nothing read means the plain empty extraction, no note.
    return emptyLocalVariableExtraction();
  }
  const cobolScopes = frameScopes.filter((scope) => isCobolScopeName(scope.name));
  if (cobolScopes.length === 0) {
    // The engine reported scopes (Local/Static/…) but the shim added no COBOL
    // ones: no COBOL program on the stack above this frame, or no symbol manifest.
    return emptyLocalVariableExtraction(
      'No COBOL data division scopes at this frame (no COBOL program on the stack above it, or no symbol manifest for it).'
    );
  }
  const collected: Variable[] = [];
  const scopeRefs: number[] = [];
  for (const scope of cobolScopes) {
    const vars = variables[scope.variablesReference] ?? [];
    if (vars.length > 0) {
      collected.push(...vars);
      scopeRefs.push(scope.variablesReference);
    }
  }
  return collected.length > 0 ? { variables: collected, scopeRefs } : emptyLocalVariableExtraction();
}

/**
 * User code is what the shim maps back to a COBOL source. Everything the
 * compiler generated (`<prog>.c`, the `HELLO` entry wrapper, `main`, the
 * inline `cob_*` runtime checks) and every libcob frame is plumbing.
 */
export function isCobolInternalFrame(frame: StackFrame): boolean {
  if (isLldbInternalFrame(frame)) {
    return true;
  }
  const name = (frame.name ?? '').replace(/^@/, '');
  const file = frame.file ?? '';
  if (COBOL_SOURCE_PATTERN.test(file)) {
    return false;
  }
  if (/^cob_/.test(name)) {
    return true;
  }
  return GENERATED_C_PATTERN.test(file);
}

export function filterCobolStackFrames(frames: StackFrame[], includeInternals: boolean): StackFrame[] {
  if (includeInternals) {
    return frames;
  }
  return frames.filter((frame) => !isCobolInternalFrame(frame));
}

/** The shim is spawned as `node …/cobol-shim.js … -- <codelldb> …`. */
export function matchesCobolShimCommand(adapterCommand: { command: string; args: string[] }): boolean {
  return adapterCommand.args.some((arg) => /cobol-shim(\.c?js)?$/i.test(arg));
}

export const CobolAdapterPolicy = {
  name: 'cobol',
  // The shim forwards `noDebug` to CodeLLDB untouched, so the measured
  // CodeLLDB behaviour applies (issue #746): `initialized` still arrives,
  // breakpoint requests are refused with "Not supported in noDebug mode",
  // the launch response waits for configurationDone, the program runs.
  honoursNoDebug: true,
  // Logpoints would need `{WS-NAME}` interpolation through the shim; until
  // that is measured, the engine's C-level logpoints stay off (milestone M3).
  supportsLogPoints: false,
  // Paragraph/section names are C labels, not functions; PROGRAM-ID entry
  // points map to C functions but are not exposed yet (milestone M3).
  supportsFunctionBreakpoints: false,
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  buildChildStartArgs: () => {
    throw new Error('CobolAdapterPolicy does not support child sessions');
  },
  isChildReadyEvent: (evt): boolean => {
    return evt?.event === 'initialized';
  },

  normalizeStopReason: normalizeLldbStopReason,
  shouldSuppressOutputEvent: lldbShouldSuppressOutputEvent,

  filterStackFrames: filterCobolStackFrames,
  isInternalFrame: isCobolInternalFrame,

  extractLocalVariables: extractCobolLocalVariables,

  getLocalScopeName: (): string[] => [...COBOL_SCOPE_NAMES],

  getDapAdapterConfiguration: () => {
    return {
      type: 'lldb'
    };
  },

  resolveExecutablePath: (providedPath?: string) => {
    if (providedPath) {
      return providedPath;
    }
    // Defer to the adapter: cobc is only needed for source launch, CodeLLDB
    // comes from the vendored tree / CODELLDB_PATH / platform packages.
    return undefined;
  },

  getDebuggerConfiguration: () => {
    return {
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsVariableType: true,
      supportsValueFormat: true,
      supportsMemoryReferences: true
    };
  },

  isSessionReady: (state: SessionState) => state === SessionState.PAUSED,

  validateExecutable: validateCodeLLDBExecutable,

  requiresCommandQueueing: (): boolean => false,

  shouldQueueCommand: () => lldbCommandHandling('COBOL/CodeLLDB adapter does not queue commands'),

  createInitialState: createLldbInitialState,
  updateStateOnCommand: updateLldbStateOnCommand,
  updateStateOnEvent: updateLldbStateOnEvent,
  isInitialized: isLldbInitialized,
  isConnected: isLldbConnected,

  matchesAdapter: matchesCobolShimCommand,

  getInitializationBehavior: () => {
    return {
      // CodeLLDB emits 'initialized' only after launch/attach (see cpp);
      // the shim does not change that ordering.
      sendAttachBeforeInitialized: true,
      // One filter, implemented by the shim as a function breakpoint on
      // libcob's exported `cob_runtime_error` — every runtime check
      // (subscript, ODO, reference modification, non-numeric data) calls it
      // right before the abort, so the stop lands with the offending
      // paragraph one frame up. STOP RUN never reaches it. Uncaught and all
      // presets are the same because COBOL has no catch semantics here.
      exceptionFilters: {
        uncaught: [COBOL_RUNTIME_ERROR_FILTER],
        all: [COBOL_RUNTIME_ERROR_FILTER]
      },
      defaultExceptionBreakMode: 'uncaught'
    };
  },

  getDapClientBehavior: getLldbDapClientBehavior,

  getAdapterSpawnConfig: (payload, platform: NodeJS.Platform = process.platform, arch: NodeJS.Architecture = process.arch) =>
    buildLldbSpawnConfig(payload, platform, arch)
} satisfies AdapterPolicy;
