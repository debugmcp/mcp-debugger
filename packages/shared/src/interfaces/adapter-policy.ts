/**
 * Adapter Policy contracts for adapter-specific DAP behaviors
 *
 * The goal is to keep the DAP transport core generic while exposing
 * adapter-specific quirks and multi-session strategies via a typed policy.
 *
 * Consumers (e.g., proxy/minimal-dap) consult this policy to decide:
 * - whether reverse startDebugging is supported
 * - how to start a child session (launch/attach) when a __pendingTargetId is provided
 * - whether to defer parent configurationDone temporarily
 * - when a child session is considered "ready" (e.g., after 'initialized', or when a 'thread'/'stopped' event is seen)
 *
 * @since 2.1.0
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { ExceptionBreakMode, StackFrame, Variable } from '../models/index.js';
import type { DapClientBehavior } from './dap-client-behavior.js';
import type { SessionState } from '@debugmcp/shared';
import type { LanguageSpecificLaunchConfig } from './debug-adapter.js';

export type ChildSessionStrategy =
  | 'none'                     // No child session expected/created
  | 'launchWithPendingTarget'  // Launch child using __pendingTargetId (js-debug typical)
  | 'attachByPort'             // Attach child by known inspector port
  | 'adoptInParent';           // Adopt pending target in the same parent session

/**
 * Command handling result that determines how the proxy should proceed
 */
export interface CommandHandling {
  shouldQueue: boolean;
  shouldDefer: boolean;
  reason?: string;
}

/**
 * Adapter-specific state that can be managed by each policy
 */
export interface AdapterSpecificState {
  initialized: boolean;
  configurationDone: boolean;
  [key: string]: unknown;
}

/**
 * Context passed to AdapterPolicy.normalizeStopReason (issues #260/#302).
 * See that method's doc comment for the completeness rules.
 */
export interface StopReasonContext {
  /** True while a user-initiated pause request is in flight. */
  pausePending: boolean;
  /**
   * Adapter-assigned ids of ALL user breakpoints (line + function).
   * Present only when both bookkeepings are complete.
   */
  userBreakpointIds?: ReadonlySet<number>;
  /**
   * Adapter-assigned ids of function breakpoints only. Present only when
   * function-breakpoint id bookkeeping is complete.
   */
  functionBreakpointIds?: ReadonlySet<number>;
  /** Line-breakpoint count from the session store — always present. */
  lineBreakpointCount: number;
  /** Function-breakpoint count from the session store — always present. */
  functionBreakpointCount: number;
}

export interface AdapterPolicy {
  /**
   * Identifying name for diagnostics (e.g., 'default', 'js-debug')
   */
  name: string;

  /**
   * Whether the adapter uses reverse startDebugging (adapter asks client to start a child session)
   */
  supportsReverseStartDebugging: boolean;

  /**
   * Static pre-launch knowledge of DAP logpoint (SourceBreakpoint.logMessage)
   * support (issue #235). `true`/`false` gate set_breakpoint synchronously
   * before live capabilities exist; `undefined` means unknown — the request
   * is accepted with a warning and re-checked against the adapter's real
   * capabilities at launch.
   */
  supportsLogPoints?: boolean;

  /**
   * Static pre-launch knowledge of function-breakpoint support (issue #271
   * phase 3). Unlike supportsLogPoints, an explicit policy verdict here wins
   * over live adapter capabilities: the policy also encodes what OUR plumbing
   * can deliver. `false` rejects even if the adapter advertises the DAP
   * capability; `true` combined with functionBreakpointsVia 'cdp' accepts even
   * though the adapter's live capabilities say false (we never send it the DAP
   * request). `undefined` means unknown — accepted with a warning and
   * re-checked against live capabilities.
   */
  supportsFunctionBreakpoints?: boolean;

  /**
   * Delivery mechanism for function breakpoints (issue #295). Absent means
   * 'dap': the standard setFunctionBreakpoints request goes to the adapter,
   * and live capabilities matter. 'cdp' means our proxy delivers them out of
   * band (js-debug: resolved and armed over the requestCDPProxy WebSocket via
   * Debugger.setBreakpointOnFunctionCall), so the adapter's own capability
   * bit is irrelevant to gating and capability-drift checks.
   */
  functionBreakpointsVia?: 'dap' | 'cdp';

  /**
   * High-signal advisory for a function-breakpoint name the adapter is known
   * to mis-resolve or never bind (issues #303/#308) — e.g. Go needs
   * package-qualified names ('main.main'); a bare 'main' on Rust resolves to
   * the C runtime's entry point. The returned text joins the set_breakpoint
   * response warning and the launch-time unbound warning; it never blocks
   * the request. Return undefined for names with no known hazard.
   */
  functionBreakpointNameHint?(name: string): string | undefined;

  /**
   * True when the adapter binds function breakpoints lazily by design
   * (js-debug: CDP re-resolve at pauses for late-loaded modules; Java:
   * ClassPrepareRequest deferral), so verified:false at launch is normal and
   * the launch-time "not bound" warning is suppressed (issue #308). The
   * never-bound-at-exit note applies regardless.
   */
  functionBreakpointsBindLate?: boolean;

  /**
   * Strategy for how to create/attach to the child session when reverse startDebugging occurs
   */
  childSessionStrategy: ChildSessionStrategy;

  /**
   * Build the child start request (launch or attach) for a given pending target ID.
   * This should include just the necessary args; consumers may sanitize/augment further.
   */
  buildChildStartArgs(
    pendingId: string,
    parentConfig: Record<string, unknown>
  ): { command: 'launch' | 'attach'; args: Record<string, unknown> };

  /**
   * Decide whether an incoming DAP event indicates the child session is ready
   * to surface queries like 'threads'. Defaults to 'initialized' for many adapters.
   * Some adapters (e.g., js-debug) may prefer to wait for 'thread' or 'stopped'.
   */
  isChildReadyEvent(evt: DebugProtocol.Event): boolean;

  /**
   * Filter stack frames to remove internal/framework frames based on adapter-specific logic.
   * This is optional - if not implemented, all frames are returned unfiltered.
   * 
   * @param frames The original stack frames from the debug adapter
   * @param includeInternals Whether to include internal/framework frames
   * @returns The filtered stack frames
   */
  filterStackFrames?(frames: StackFrame[], includeInternals: boolean): StackFrame[];

  /**
   * Check if a stack frame is an internal/framework frame.
   * This is used by filterStackFrames to determine which frames to filter out.
   * 
   * @param frame The stack frame to check
   * @returns True if the frame is internal/framework code, false otherwise
   */
  isInternalFrame?(frame: StackFrame): boolean;

  /**
   * Return true to drop a DAP 'output' event that is known adapter-internal
   * noise, not debuggee output (issue #361 — e.g. LLDB's DWARF-parsing
   * error spew on MinGW binaries). Consulted by the session manager's output
   * capture AFTER the standard 'telemetry' category drop; suppressed events
   * are still logged at debug level. Optional — absent means capture
   * everything. Implementations must be conservative: when in doubt, keep
   * the output.
   *
   * @param category The DAP output category ('stdout', 'stderr', 'console', ...)
   * @param text The event's output text (may span multiple lines)
   */
  shouldSuppressOutputEvent?(category: string, text: string): boolean;

  /**
   * Return an attributed explanation for a DAP 'output' event that signals a
   * known adapter-level capability degradation (issue #441 — e.g. CodeLLDB's
   * "Failed to initialize language support for rust" when no rustc is
   * available, which leaves Rust values rendering as raw LLDB structures).
   * Consulted by the session manager's output capture AFTER the event is
   * recorded; the returned text is pushed to the session's output buffer as a
   * `[mcp-debugger] Warning:` entry and, when it arrives before the launch
   * resolves, joined into the start_debugging result's warning. Optional —
   * absent means no annotation. Return undefined for ordinary output.
   *
   * @param category The DAP output category ('stdout', 'stderr', 'console', ...)
   * @param text The event's output text (may span multiple lines)
   */
  annotateOutputEvent?(category: string, text: string): string | undefined;

  /**
   * Normalize an adapter-specific DAP stop reason into a canonical reason
   * ('pause', 'breakpoint', 'step', 'exception', ...). Some adapters report
   * misleading raw reasons — e.g. CodeLLDB surfaces a user-initiated pause as
   * reason 'exception' with a SIGSTOP description.
   *
   * Called from the session-manager stopped handler BEFORE the auto-continue
   * decision and before the stop is recorded, so the normalized reason drives
   * both. A policy that also sets pauseAfterChildAttach must therefore be
   * careful not to normalize a first stop into a user-break reason.
   *
   * @param reason The raw DAP stop reason from the adapter
   * @param body The full stopped-event body, if available
   * @param context context.pausePending is true while a user-initiated
   *   pause request is in flight for this session. context.userBreakpointIds
   *   holds the adapter-assigned ids of every user-set breakpoint (line and
   *   function breakpoints combined), and is only present when that
   *   bookkeeping is complete (every breakpoint of both kinds has a known
   *   id) — policies must not infer anything from hitBreakpointIds when it
   *   is absent. context.functionBreakpointIds holds the function-breakpoint
   *   subset under the same completeness rule for its own kind.
   *   context.lineBreakpointCount / functionBreakpointCount come from the
   *   session's own store and are always present — count-based inference
   *   (e.g. "the only user breakpoints are function breakpoints") does not
   *   touch hitBreakpointIds and is legitimate even when the id sets are
   *   absent.
   * @returns The canonical reason, or undefined to keep the raw reason
   */
  normalizeStopReason?(
    reason: string,
    body: DebugProtocol.StoppedEvent['body'] | undefined,
    context: StopReasonContext
  ): string | undefined;

  /**
   * Extract local variables from the raw DAP data based on language-specific logic.
   * This allows each language adapter to define what constitutes "local variables".
   * 
   * @param stackFrames The stack frames from the DAP response
   * @param scopes A map of frame IDs to their scopes
   * @param variables A map of scope references to their variables
   * @param includeSpecial Whether to include special/internal variables
   * @returns The extracted local variables
   */
  extractLocalVariables?(
    stackFrames: StackFrame[],
    scopes: Record<number, DebugProtocol.Scope[]>,
    variables: Record<number, Variable[]>,
    includeSpecial?: boolean
  ): Variable[];

  /**
   * Get the scope name(s) that contain local variables for this language.
   * Different languages may use different names (e.g., "Locals" vs "Local").
   * 
   * @returns The scope name(s) to look for when finding locals
   */
  getLocalScopeName?(): string | string[];

  /**
   * Get DAP adapter configuration including type and future config options.
   * This determines which DAP adapter type to use (e.g., 'pwa-node', 'debugpy').
   * 
   * @returns The DAP adapter configuration
   */
  getDapAdapterConfiguration(): {
    type: string;  // 'pwa-node', 'debugpy', 'mock', etc.
    // Future: could include other DAP-specific configuration
  };

  /**
   * Resolve the executable path for this language.
   * Handles language-specific executable resolution logic.
   *
   * @param providedPath Optional path provided by the user
   * @param platform Platform override for tests (issue #183); implementations default it to process.platform
   * @returns The resolved executable path or undefined
   */
  resolveExecutablePath(providedPath?: string, platform?: NodeJS.Platform): string | undefined;

  /**
   * Get debugger configuration and requirements.
   * Specifies language-specific debugger behavior and capabilities.
   * 
   * @returns Configuration options for the debugger
   */
  getDebuggerConfiguration(): {
    requiresStrictHandshake?: boolean;
    skipConfigurationDone?: boolean;
    supportsVariableType?: boolean;
    // Additional debugger-specific configuration can be added here
  };

  /**
   * Determine if the adapter/session should be considered "ready" after launch/handshake.
   * If omitted, default logic will be used (paused, or running when stopOnEntry=false).
   */
  isSessionReady?(
    state: SessionState,
    options: { stopOnEntry?: boolean }
  ): boolean;

  /**
   * Check if a source identifier is a non-file reference that this adapter
   * can resolve at runtime (e.g., Java FQCNs resolved via vm.classesByName()).
   * When this returns true, the server skips the file existence check.
   *
   * @param sourceIdentifier The source identifier to check
   * @returns True if this is a valid non-file identifier for this adapter
   */
  isNonFileSourceIdentifier?(sourceIdentifier: string): boolean;

  /**
   * Validate that the resolved executable is actually usable for this language.
   * This is language-specific - e.g., Python needs to check for Windows Store aliases.
   *
   * @param executablePath The path to validate
   * @returns Promise resolving to true if valid, false otherwise
   */
  validateExecutable?(executablePath: string): Promise<boolean>;

  /**
   * Perform language-specific handshake after connecting to the debug adapter.
   * Some languages (like JavaScript) require a specific initialization sequence.
   *
   * Contract: the SessionManager invokes this for BOTH launch
   * (startDebugging) and attach (attachToProcess), right after
   * startProxyManager succeeds. A policy that defines this method owns the
   * full DAP start sequence — initialize, configuration and the
   * launch/attach request itself; the proxy worker's built-in launch/attach
   * flow does not run for command-queueing policies. Attach is
   * distinguished from launch by `dapLaunchArgs.request === 'attach'`
   * (and/or `__attachMode: true`) and by the transformed
   * `launchConfig.request`. Policies that do not define this method are
   * unaffected: the proxy worker drives their launch/attach sequence.
   *
   * @param context Context object with session details and helper methods
   * @returns Promise that resolves when handshake is complete
   */
  performHandshake?(context: {
    proxyManager: unknown;  // Will be IProxyManager in implementation
    sessionId: string;
    dapLaunchArgs?: Record<string, unknown>;
    scriptPath: string;
    scriptArgs?: string[];
    breakpoints: Map<string, unknown>;  // Will be Breakpoint in implementation
    launchConfig?: LanguageSpecificLaunchConfig;
    /** Abstract break-on-exception mode requested by the user (issue #220) */
    breakOnExceptions?: ExceptionBreakMode;
  }): Promise<void>;

  /**
   * Determines if commands should be queued before initialization
   * @returns True if this adapter requires command queueing
   */
  requiresCommandQueueing(): boolean;

  /**
   * Determines if a specific command should be queued based on current state
   * @param command The DAP command name
   * @param state Current adapter state
   * @returns Decision on whether to queue the command
   */
  shouldQueueCommand(command: string, state: AdapterSpecificState): CommandHandling;

  /**
   * Process queued commands and return them in the correct order
   * @param commands Currently queued commands (type any to handle full DapCommandPayload)
   * @param state Current adapter state
   * @returns Ordered array of commands to execute
   */
  processQueuedCommands?(
    commands: unknown[],
    state: AdapterSpecificState
  ): unknown[];

  /**
   * Create initial state for this adapter
   * @returns Initial state object
   */
  createInitialState(): AdapterSpecificState;

  /**
   * Update state based on a DAP command being sent
   * @param command The DAP command name
   * @param args Command arguments
   * @param state Current state (will be mutated)
   */
  updateStateOnCommand?(command: string, args: unknown, state: AdapterSpecificState): void;

  /**
   * Update state based on a DAP response being received
   * @param command The DAP command name
   * @param response The raw DAP response payload
   * @param state Current state (will be mutated)
   */
  updateStateOnResponse?(command: string, response: unknown, state: AdapterSpecificState): void;

  /**
   * Update state based on a DAP event being received
   * @param event The DAP event name
   * @param body Event body
   * @param state Current state (will be mutated)
   */
  updateStateOnEvent?(event: string, body: unknown, state: AdapterSpecificState): void;

  /**
   * Check if the adapter is fully initialized and ready for commands
   * @param state Current adapter state
   * @returns True if initialized and ready
   */
  isInitialized(state: AdapterSpecificState): boolean;

  /**
   * Check if the adapter connection is ready to accept DAP commands
   * @param state Current adapter state
   * @returns True if connected and ready
   */
  isConnected(state: AdapterSpecificState): boolean;

  /**
   * Determine the adapter type from adapter command
   * @param adapterCommand Command used to spawn the adapter
   * @returns True if this policy applies to the given adapter
   */
  matchesAdapter(adapterCommand: { command: string; args: string[] }): boolean;

  /**
   * Get initialization behavior flags for this adapter.
   * This combines multiple initialization quirks into a single method to reduce interface bloat.
   * @returns Object with initialization behavior flags
   */
  getInitializationBehavior(): {
    /** Whether to defer configurationDone until after launch/attach */
    deferConfigDone?: boolean;
    /** Whether to add runtimeExecutable to launch arguments */
    addRuntimeExecutable?: boolean;
    /** Whether to track initialize response separately from initialized event */
    trackInitializeResponse?: boolean;
    /** Whether to ensure initial stop after launch/attach */
    requiresInitialStop?: boolean;
    /** Override default stopOnEntry when user hasn't explicitly set it */
    defaultStopOnEntry?: boolean;
    /** Whether the adapter sends 'initialized' before receiving 'launch', requiring
     *  the proxy to defer initialized handling and send launch before configurationDone. */
    sendLaunchBeforeConfig?: boolean;
    /** Whether the adapter requires attach to be sent BEFORE the initialized event.
     *  Some adapters send initialized only AFTER processing the attach request, so waiting
     *  for initialized before sending attach causes a deadlock. */
    sendAttachBeforeInitialized?: boolean;
    /** Concrete DAP exceptionBreakpointFilters IDs per abstract breakOnExceptions
     *  mode (issue #220). Omitted (or an empty array for a mode) means the mode
     *  is unsupported for this adapter and setExceptionBreakpoints is skipped. */
    exceptionFilters?: {
      uncaught: string[];
      all: string[];
    };
    /** Default breakOnExceptions mode applied to LAUNCH sessions when the user
     *  did not specify one (issue #244). Attach sessions never receive a
     *  default — pausing a process you attached to is surprising. Omit for
     *  adapters without a usable uncaught filter (e.g. Ruby) so crashing
     *  scripts keep running to termination. Mirrors defaultStopOnEntry. */
    defaultExceptionBreakMode?: ExceptionBreakMode;
  };

  /**
   * Get DAP client-specific behavior configuration.
   * This groups all DAP client behaviors (reverse requests, child sessions, etc.)
   * @returns DAP client behavior configuration
   */
  getDapClientBehavior(): DapClientBehavior;

  /**
   * DAP evaluate context to use for evaluate_expression.
   * Most adapters accept 'variables'; some (rdbg) only accept contexts like
   * 'repl'/'watch'. Defaults to 'variables' when not implemented.
   */
  getEvaluateContext?(): string;

  /**
   * Attach-mode behavior tweaks.
   * pauseAfterAttach: send an explicit DAP 'pause' after attaching when
   * stopOnEntry is requested. Needed for debuggers (rdbg) that do NOT
   * suspend the target on attach when it is already running — without it the
   * session would report PAUSED while the target keeps executing.
   */
  getAttachBehavior?(): { pauseAfterAttach?: boolean };

  /**
   * Get the configuration for starting the debug adapter connection.
   * Policies return either a 'spawn' config (start an adapter process, then
   * connect to it) or a 'connect' config (an external DAP server is already
   * listening — e.g. attach to a remote rdbg — so connect directly without
   * spawning anything).
   * @param payload The initialization payload containing ports, paths, etc.
   * @param platform Platform override for tests (issue #186); implementations default it to process.platform
   * @param arch Architecture override for tests (issue #186); implementations default it to process.arch
   * @returns Spawn or connect configuration, or undefined if not applicable
   */
  getAdapterSpawnConfig?(payload: AdapterSpawnPayload, platform?: NodeJS.Platform, arch?: NodeJS.Architecture): AdapterSpawnConfig | undefined;
}

/**
 * Input payload for AdapterPolicy.getAdapterSpawnConfig.
 */
export interface AdapterSpawnPayload {
  executablePath: string;
  adapterHost: string;
  adapterPort: number;
  logDir: string;
  scriptPath: string;
  launchConfig?: LanguageSpecificLaunchConfig;
  adapterCommand?: { command: string; args: string[]; env?: Record<string, string>; cwd?: string };
}

/**
 * Result of AdapterPolicy.getAdapterSpawnConfig — a discriminated union:
 * - mode 'spawn': the worker spawns the adapter process, then connects to host:port
 * - mode 'connect': a DAP server is already listening; connect directly to host:port
 */
export type AdapterSpawnConfig =
  | {
      mode: 'spawn';
      command: string;
      args: string[];
      host: string;
      port: number;
      logDir: string;
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      /**
       * Forward the adapter process's stdio as synthesized DAP 'output'
       * events (issue #222). Opt-in for adapters whose launch-mode debuggee
       * inherits the adapter process's stdio instead of having it converted
       * to DAP output events — e.g. rdbg -c (all platforms) and CodeLLDB's
       * console mode on Windows. Policies that leave this unset keep the
       * existing behavior: adapter stdio is drained to logs only.
       */
      forwardStdio?: {
        /**
         * stderr lines matching this pattern are adapter diagnostics (e.g.
         * rdbg's `DEBUGGER: ` banners): still logged, never forwarded as
         * debuggee output.
         */
        excludeStderrLinePattern?: RegExp;
      };
      /**
       * The adapter process's exit code IS the debuggee's exit code (issue
       * #258): rdbg -c runs the debuggee under the adapter process, so its
       * exit status propagates. Lets the worker synthesize a DAP 'exited'
       * event for adapters that never send one, giving the session a
       * recorded debuggee exit code like Python/js. Deliberately separate
       * from forwardStdio: CodeLLDB forwards stdio too, but its exit code
       * is its own, not the debuggee's.
       */
      adapterExitCodeIsDebuggeeExitCode?: boolean;
    }
  | {
      mode: 'connect';
      host: string;
      port: number;
      logDir: string;
    };

/**
 * DefaultAdapterPolicy is a lightweight placeholder used while the worker is
 * determining which concrete adapter policy to activate. It purposefully
 * implements the smallest safe surface so real adapters cannot accidentally
 * rely on it for behaviour.
 */
export const DefaultAdapterPolicy: AdapterPolicy = {
  name: 'default',
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  buildChildStartArgs: (pendingId: string) => {
    throw new Error(
      `DefaultAdapterPolicy is a placeholder and cannot start child sessions (pendingId=${pendingId}).`
    );
  },
  isChildReadyEvent: () => false,
  getDapAdapterConfiguration: () => ({
    type: 'default'
  }),
  resolveExecutablePath: (providedPath?: string) => providedPath,
  getDebuggerConfiguration: () => ({}),
  requiresCommandQueueing: () => false,
  shouldQueueCommand: (): CommandHandling => ({
    shouldQueue: false,
    shouldDefer: false,
    reason: 'DefaultAdapterPolicy is inactive until a real adapter is selected'
  }),
  createInitialState: (): AdapterSpecificState => ({
    initialized: false,
    configurationDone: false
  }),
  isInitialized: () => false,
  isConnected: () => false,
  matchesAdapter: () => false,
  getInitializationBehavior: () => ({}),
  getDapClientBehavior: (): DapClientBehavior => ({})
};

/**
 * Resolve an abstract break-on-exception mode to the concrete DAP
 * exceptionBreakpointFilters IDs for the given adapter policy (issue #220).
 * Returns [] when the mode is unset, 'none', or unsupported by the policy —
 * callers skip the setExceptionBreakpoints request in that case.
 */
export function resolveExceptionFilters(
  policy: AdapterPolicy,
  mode: ExceptionBreakMode | undefined
): string[] {
  if (!mode || mode === 'none') {
    return [];
  }
  return policy.getInitializationBehavior().exceptionFilters?.[mode] ?? [];
}
