/**
 * CppAdapterPolicy - policy for the C/C++ Debug Adapter (CodeLLDB)
 *
 * Composes the shared LLDB helpers (lldb-policy-shared.ts) with the
 * C/C++-specific pieces: exception-filter presets and the absence of the
 * Rust CRT-trampoline function-breakpoint hint (issue #325).
 *
 * NOT registered in DapProxyWorker's legacy command-shape fallback chain:
 * that chain cannot distinguish two CodeLLDB consumers (rust matches the
 * same command shapes), and every real session carries a `language`, so
 * getPolicyForLanguage('cpp') routes correctly. Language-less payloads fall
 * back to RustAdapterPolicy, whose engine behavior is identical.
 */
import type { AdapterPolicy } from './adapter-policy.js';
import { SessionState } from '@debugmcp/shared';
import {
  normalizeLldbStopReason,
  extractLldbLocalVariables,
  LLDB_LOCAL_SCOPE_NAMES,
  validateCodeLLDBExecutable,
  matchesLldbAdapterCommand,
  buildLldbSpawnConfig,
  lldbCommandHandling,
  createLldbInitialState,
  updateLldbStateOnCommand,
  updateLldbStateOnEvent,
  isLldbInitialized,
  isLldbConnected,
  getLldbDapClientBehavior,
  isLldbInternalFrame,
  filterLldbStackFrames,
  lldbShouldSuppressOutputEvent
} from './lldb-policy-shared.js';

export const CppAdapterPolicy: AdapterPolicy = {
  name: 'cpp',
  supportsLogPoints: true,
  supportsFunctionBreakpoints: true,
  // Unlike Rust (issue #303), a bare 'main' in C/C++ IS the user's entry
  // function — LLDB binds it to the right symbol, so no name hint is needed.
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  buildChildStartArgs: () => {
    throw new Error('CppAdapterPolicy does not support child sessions');
  },
  isChildReadyEvent: (evt): boolean => {
    return evt?.event === 'initialized';
  },

  normalizeStopReason: normalizeLldbStopReason,
  shouldSuppressOutputEvent: lldbShouldSuppressOutputEvent,

  /**
   * Hide LLDB-synthesized symbols and libc/runtime plumbing from stack
   * traces (issue #369); the central issue-#346 fallback keeps the top
   * frame when everything is internal.
   */
  filterStackFrames: filterLldbStackFrames,
  isInternalFrame: isLldbInternalFrame,

  extractLocalVariables: extractLldbLocalVariables,

  getLocalScopeName: (): string[] => [...LLDB_LOCAL_SCOPE_NAMES],

  getDapAdapterConfiguration: () => {
    return {
      type: 'lldb'  // CodeLLDB adapter type
    };
  },

  resolveExecutablePath: (providedPath?: string) => {
    if (providedPath) {
      return providedPath;
    }

    // Defer to adapter for CodeLLDB path resolution
    // (CODELLDB_PATH env var is checked in codelldb-resolver.ts)
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

  shouldQueueCommand: () => lldbCommandHandling('C++/CodeLLDB adapter does not queue commands'),

  createInitialState: createLldbInitialState,
  updateStateOnCommand: updateLldbStateOnCommand,
  updateStateOnEvent: updateLldbStateOnEvent,
  isInitialized: isLldbInitialized,
  isConnected: isLldbConnected,

  matchesAdapter: matchesLldbAdapterCommand,

  getInitializationBehavior: () => {
    return {
      // CodeLLDB emits 'initialized' only AFTER it receives the launch/attach
      // request (verified live: initialize response arrives, then nothing —
      // waiting for 'initialized' before sending attach deadlocks, the same
      // shape as debugpy's issue #145). Launch mode already sends launch
      // first; attach must lead with the attach request too.
      sendAttachBeforeInitialized: true,
      // LLDB has no uncaught-only C++ filter: cpp_throw fires on EVERY
      // throw, and an uncaught exception reaches std::terminate -> SIGABRT,
      // which LLDB stops on natively. So the uniform 'uncaught' launch
      // default (issue #244) maps to NO filters here — the session still
      // pauses at genuinely uncaught exceptions via the abort signal —
      // while breakOnExceptions: 'all' opts into first-chance cpp_throw
      // stops. cpp_catch stays available via explicit filter config but is
      // in neither preset (pure noise for agents).
      exceptionFilters: {
        uncaught: [],
        all: ['cpp_throw']
      },
      defaultExceptionBreakMode: 'uncaught'
    };
  },

  getDapClientBehavior: getLldbDapClientBehavior,

  getAdapterSpawnConfig: (payload, platform: NodeJS.Platform = process.platform, arch: NodeJS.Architecture = process.arch) =>
    buildLldbSpawnConfig(payload, platform, arch)
};
