/**
 * RustAdapterPolicy - policy for Rust Debug Adapter (CodeLLDB)
 *
 * Encodes CodeLLDB specific behaviors and variable handling logic.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
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

export const RustAdapterPolicy: AdapterPolicy = {
  name: 'rust',
  supportsLogPoints: true,
  supportsFunctionBreakpoints: true,
  /**
   * A bare 'main' resolves to the C runtime's main trampoline, not the
   * crate's fn main() (issue #303): LLDB finds the CRT symbol first, the
   * session "successfully" pauses at a source-less frame (@main), and
   * CodeLLDB reports no binding location we could check after the fact —
   * so warn at set time. Other bare names resolve fine via LLDB.
   */
  functionBreakpointNameHint: (name: string): string | undefined => {
    if (name === 'main') {
      return "On Rust targets a bare 'main' usually binds to the C runtime's entry point, not your fn main() — the debugger would pause in startup code with no source. Use the crate-qualified name, e.g. 'my_crate::main'";
    }
    return undefined;
  },
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  buildChildStartArgs: () => {
    throw new Error('RustAdapterPolicy does not support child sessions');
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => {
    return evt?.event === 'initialized';
  },

  /**
   * CodeLLDB stop-reason quirks (issues #260/#275/#302) — shared with every
   * LLDB-backed policy; see normalizeLldbStopReason for the full rules.
   */
  normalizeStopReason: normalizeLldbStopReason,
  shouldSuppressOutputEvent: lldbShouldSuppressOutputEvent,

  /**
   * Hide LLDB-synthesized symbols and libc/runtime plumbing from stack
   * traces (issue #369); the central issue-#346 fallback keeps the top
   * frame when everything is internal.
   */
  filterStackFrames: filterLldbStackFrames,
  isInternalFrame: isLldbInternalFrame,

  /**
   * Extract local variables for Rust, filtering out special variables by default
   */
  extractLocalVariables: extractLldbLocalVariables,

  /**
   * Rust/CodeLLDB uses "Local" or "Locals" for local variables scope
   */
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
      // CodeLLDB debugger configuration
      requiresStrictHandshake: false,
      skipConfigurationDone: false,
      supportsVariableType: true,  // CodeLLDB supports variable type information
      supportsValueFormat: true,    // CodeLLDB supports value formatting
      supportsMemoryReferences: true // CodeLLDB supports memory references
    };
  },

  isSessionReady: (state: SessionState) => state === SessionState.PAUSED,
  
  /**
   * Validate that the CodeLLDB adapter is available and executable
   */
  validateExecutable: validateCodeLLDBExecutable,

  /**
   * Rust adapter doesn't require command queueing
   */
  requiresCommandQueueing: (): boolean => false,

  /**
   * Rust doesn't need to queue commands
   */
  shouldQueueCommand: () => lldbCommandHandling('Rust/CodeLLDB adapter does not queue commands'),

  createInitialState: createLldbInitialState,
  updateStateOnCommand: updateLldbStateOnCommand,
  updateStateOnEvent: updateLldbStateOnEvent,
  isInitialized: isLldbInitialized,
  isConnected: isLldbConnected,

  /**
   * Check if this policy applies to the given adapter command
   */
  matchesAdapter: matchesLldbAdapterCommand,

  /**
   * Rust adapter has no special initialization requirements
   */
  getInitializationBehavior: () => {
    return {
      // CodeLLDB filter IDs. Note (issue #260): CodeLLDB 1.11.8 advertises
      // only cpp_throw/cpp_catch in exceptionBreakpointFilters, yet
      // setExceptionBreakpoints with rust_panic still succeeds and fires
      // (legacy acceptance, confirmed live). Keep rust_panic; the capability
      // drift warning in session-manager-core is the early alarm if a future
      // CodeLLDB drops the legacy id.
      exceptionFilters: {
        uncaught: ['rust_panic'],
        all: ['rust_panic', 'cpp_throw']
      },
      // Launch sessions pause at panics by default (issue #244)
      defaultExceptionBreakMode: 'uncaught'
    };
  },

  /**
   * Rust DAP client behaviors - minimal since Rust doesn't use child sessions
   */
  getDapClientBehavior: getLldbDapClientBehavior,

  /**
   * Get the configuration for spawning the Rust debug adapter (CodeLLDB).
   * Shared with every LLDB-backed policy — see buildLldbSpawnConfig for the
   * win32 forwardStdio rationale (issue #223) and the vendor fallback path.
   */
  getAdapterSpawnConfig: (payload, platform: NodeJS.Platform = process.platform, arch: NodeJS.Architecture = process.arch) =>
    buildLldbSpawnConfig(payload, platform, arch)
};
