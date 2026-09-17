/**
 * Centralized error messages for timeout-related errors in the debug server.
 * This ensures consistency between implementation and tests.
 */

/**
 * How far debug-proxy initialization got before the deadline fired, tracked by
 * ProxyManager from the worker's progress statuses (issue #493). Drives the
 * stage-aware proxyInitTimeout message and rides on the timeout Error object
 * so the structured facts reach the tool result.
 */
export interface ProxyInitProgress {
  /** PID of the spawned adapter process; absent in connect mode (no process). */
  adapterPid?: number;
  /** The DAP transport (TCP) to the adapter connected successfully. */
  transportConnected: boolean;
  /** The DAP handshake request that was sent and has not been answered. */
  pendingCommand?: string;
}

/**
 * The refusal lead-in for each operation that takes a session's in-flight
 * claim (issue #711). Declared here, next to the message builder that reads
 * it, so `InFlightGuard` can import the operation union instead of restating
 * it — the guard lives in the session layer and this module must not depend
 * on that direction.
 */
const IN_FLIGHT = {
  launch: 'A launch is already in progress for this session (start_debugging has not returned yet)',
  restart: 'A restart is already in progress for this session (restart_debugging has not returned yet)',
  attach: 'An attach is already in progress for this session (attach_to_process has not returned yet)',
  detach: 'A detach is already in progress for this session (detach_from_process has not returned yet)'
} as const;

/** The launch-shaped operations one session may hold a claim for (issue #711). */
export type InFlightOperation = keyof typeof IN_FLIGHT;

/**
 * The why a session whose current launch runs with the debugger off appends
 * to every answer that would otherwise read in debugger terms (issue #749) —
 * a module constant so the composed messages below can build on it.
 */
const DEBUGGER_OFF_FOR_LAUNCH =
  'the debugger is off for this launch (noDebug is true): breakpoints cannot bind and no stop is expected; ' +
  'drop noDebug and launch again to debug';

export const ErrorMessages = {
  /**
   * Error message for DAP request timeouts
   * Occurs when: A Debug Adapter Protocol request doesn't receive a response within the timeout period
   * Used in: src/proxy/proxy-manager.ts
   * Default timeout: 35 seconds
   * @param command - The DAP command that timed out (e.g., 'stackTrace', 'variables')
   * @param timeout - The timeout duration in seconds
   */
  dapRequestTimeout: (command: string, timeout: number) =>
    `Debug adapter did not respond to '${command}' request within ${timeout}s. ` +
    `This typically means the debug adapter has crashed or lost connection. ` +
    `Try restart_debugging to relaunch the session. If the problem persists, check the debug adapter logs.`,

  /**
   * Hint appended to timeout failures on operations that accept a per-request
   * 'timeout' tool argument (evaluate_expression, redefine_classes)
   * Occurs when: A DAP request times out but the operation may simply need more time than the default allows
   * Used in: src/session/session-manager-operations.ts
   * Note: DAP has no cancel — the debuggee keeps executing the operation after the timeout fires
   */
  dapRequestTimeoutHint: () =>
    `If the operation is expected to take this long, retry with a larger 'timeout' (ms) argument. ` +
    `Note the operation may still be running in the debuggee.`,

  /**
   * Error message for proxy initialization timeouts
   * Occurs when: The debug proxy process fails to initialize within the timeout period
   * Used in: src/proxy/proxy-manager.ts
   * Default timeout: 30 seconds
   *
   * The first sentence is an invariant prefix (pinned by tests and quoted in
   * docs); the rest reflects how far initialization actually got (issue #493).
   * The install-hint wording survives only for the case it correctly
   * describes: nothing ever spawned or connected. Blaming a missing install
   * when the adapter demonstrably connected and answered events sent agents
   * to verify healthy toolchains with nowhere to go afterwards.
   *
   * @param timeout - The timeout duration in seconds
   * @param progress - How far initialization got (issue #493); omit for the generic message
   */
  proxyInitTimeout: (timeout: number, progress?: ProxyInitProgress) => {
    const base = `Debug proxy initialization did not complete within ${timeout}s.`;
    if (progress?.transportConnected) {
      const pidNote = progress.adapterPid !== undefined
        ? ` The adapter process is running (PID ${progress.adapterPid}).`
        : '';
      if (progress.pendingCommand) {
        return `${base} Connected to the debug adapter, but the "${progress.pendingCommand}" request ` +
          `never received a response.${pidNote} This is an adapter-side protocol stall, not a missing ` +
          `install — the adapter started and accepted the connection. Retrying usually succeeds; ` +
          `if it recurs, capture a DAP trace (DAP_TRACE=1) of the failing launch.`;
      }
      return `${base} Connected to the debug adapter and the DAP handshake began, but initialization ` +
        `stalled before completing.${pidNote}`;
    }
    if (progress?.adapterPid !== undefined) {
      return `${base} The adapter process spawned (PID ${progress.adapterPid}) but the DAP connection ` +
        `was never established. Check that the adapter's port is reachable and nothing is blocking ` +
        `loopback TCP connections.`;
    }
    return `${base} ` +
      `This may indicate that the debug adapter failed to start or is not properly configured. ` +
      `Check that the required debug adapter is installed and accessible.`;
  },
  
  /**
   * Informational message for step operations still executing after the grace window
   * Occurs when: A step operation (stepOver, stepInto, stepOut) doesn't receive a 'stopped' event
   * within the grace window — usually because the step runs long-lived user code, which is not an error
   * Used in: src/session/session-manager-operations.ts
   * Default grace window: 5 seconds
   * @param graceSeconds - The grace window duration in seconds
   */
  stepStillRunning: (graceSeconds: number) =>
    `Step dispatched; the program is still executing after ${graceSeconds}s ` +
    `(e.g. stepping over a long-running call). The session remains 'running' and will ` +
    `become 'paused' when the step completes. Check the session state, or call ` +
    `pause_execution to interrupt.`,

  /**
   * A step whose recorded stop is a breakpoint or an exception rather than
   * the step (issue #678). Neutral by design: js-debug and debugpy both report
   * 'breakpoint' when a step lands on a line that carries one (the routine
   * case), and the same reason comes back when js-debug resumed a lost step
   * and the next request re-hit the breakpoint (the case that motivated the
   * disclosure: the response used to read "Stepped over" at the very line the
   * step left from). So the wording only names the reason and points at
   * stopReason; `backAtOrigin` adds the lost-step signature — the stop is on
   * the very line the step was issued from (also true of a single-line loop)
   * — when the caller knows the origin. `location` keeps its display
   * semantics (the first visible frame, #672); nothing is claimed about it.
   * Used in: src/session/execution/execution-controller.ts
   *
   * @param stepped - The step's own wording ('Stepped over', ...)
   * @param reason - The recorded stop reason (e.g. 'breakpoint', 'exception')
   * @param opts.backAtOrigin - The stop is on the file+line the step left from
   */
  stepStoppedOn: (stepped: string, reason: string, opts?: { backAtOrigin?: boolean }) =>
    `${stepped}; stopped on '${reason}' rather than on the step itself (see stopReason).` +
    (opts?.backAtOrigin ? ' The program is back at the line the step was issued from.' : ''),

  /**
   * Informational message for pause requests not yet honored within the grace window
   * Occurs when: A pause request is acknowledged but no 'stopped' event arrives within the grace
   * window — the target may be blocked in native code or a syscall, which is not an error
   * Used in: src/session/session-manager-operations.ts
   * Default grace window: 5 seconds
   * @param graceSeconds - The grace window duration in seconds
   */
  pausePending: (graceSeconds: number) =>
    `Pause requested; no 'stopped' event within ${graceSeconds}s ` +
    `(the program may be blocked in native code or a syscall). The session will report ` +
    `'paused' once the stop lands. Check the session state to confirm.`,


  /**
   * The why a session whose current launch runs with the debugger off appends
   * to every answer that would otherwise read in debugger terms (issue #749):
   * `dapLaunchArgs.noDebug` on an adapter that honours it (issue #710) —
   * an unverified breakpoint, a pause that never lands, "not paused" from
   * stepping and inspection. Names the fact and the remedy, never the
   * adapter's own answer, which stays as it came. "No stop is expected"
   * rather than "cannot come": js-debug still lands a pause under the flag.
   * Used in: src/server/handlers/breakpoint-tools.ts, src/server/handlers/inspection-tools.ts,
   *   src/session/execution/execution-controller.ts, src/session/inspection/frame-anchor-resolver.ts,
   *   src/session/inspection/expression-evaluator.ts
   */
  debuggerOffForLaunch: DEBUGGER_OFF_FOR_LAUNCH,

  /**
   * The same why for a session that is paused (issue #749): a stop did land
   * — js-debug lands a pause under noDebug — so only the binding clause is
   * still true of it.
   * Used in: src/session/debugger-off.ts
   */
  debuggerOffForLaunchPaused:
    'the debugger is off for this launch (noDebug is true): breakpoints cannot bind; ' +
    'drop noDebug and launch again to debug',

  /**
   * The pending-pause message for a session whose launch runs with the
   * debugger off (issue #749): the pause was sent and accepted, no stop came
   * within the grace window, and — unlike `pausePending` — no stop is
   * promised, since none is expected. The policy's own explanation (#678:
   * js-debug's smart-stepper, which can also keep a pause from landing
   * under the flag) rides along when there is one.
   * Used in: src/session/execution/execution-controller.ts
   * @param graceSeconds - The grace window duration in seconds
   * @param policyHint - The adapter policy's explanation, when it has one
   */
  pausePendingDebuggerOff: (graceSeconds: number, policyHint?: string) =>
    `Pause requested; no 'stopped' event within ${graceSeconds}s — ${DEBUGGER_OFF_FOR_LAUNCH}. ` +
    `Check the session state in case a stop lands anyway.` +
    (policyHint ? ` ${policyHint}` : ''),

  /**
   * An adapter's own answer with the debugger-off why beside it (issue
   * #749): a refused pause, or one that found no debug target yet.
   * Used in: src/session/execution/execution-controller.ts
   */
  withDebuggerOffWhy: (adapterMessage: string, why: string) => `${adapterMessage} (${why})`,

  /**
   * The step/continue refusal for a session that is not paused, with the
   * why when the launch runs with the debugger off (issue #749).
   * Used in: src/session/execution/execution-controller.ts
   */
  notPaused: (why?: string) => (why ? `Not paused: ${why}` : 'Not paused'),

  /**
   * The evaluate refusal for a session that is not paused, with the why
   * when the launch runs with the debugger off (issue #749).
   * Used in: src/session/inspection/expression-evaluator.ts
   */
  cannotEvaluateNotPaused: (why?: string) =>
    why
      ? `Cannot evaluate: debugger not paused (${why})`
      : 'Cannot evaluate: debugger not paused. Ensure the debugger is stopped at a breakpoint.',

  /**
   * The empty stack trace's note for a session that is not paused, with the
   * why when the launch runs with the debugger off (issue #749).
   * Used in: src/session/inspection/frame-anchor-resolver.ts
   */
  stackTraceNotPaused: (state: string, why?: string) =>
    `Session is not paused (state: ${state}); stack traces are only available while paused${why ? `; ${why}` : ''}.`,

  /**
   * get_local_variables with no frame and the session not paused, with the
   * why when the launch runs with the debugger off (issue #749).
   * Used in: src/server/handlers/inspection-tools.ts
   */
  noStackFramesNotPaused: (why?: string) =>
    why ? `No stack frames available; ${why}.` : 'No stack frames available. The debugger may not be paused.',

  /**
   * Suffix appended to the attach message when the post-attach pause was
   * requested (explicitly or by the default) but no 'stopped' event arrived
   * within the bounded wait, so the response reports state "running" with
   * pending:true while the target will still freeze on its next dispatch
   * (issue #654: attaching to a live server without stopOnEntry:false froze
   * it seconds later with nothing in the response saying a pause was coming)
   * Used in: src/session/attach/attach-controller.ts, src/server/handlers/session-tools.ts
   */
  attachPausePending:
    'post-attach pause pending — the target stops when it next executes code (pass stopOnEntry: false to attach without pausing)',

  /**
   * Error message for attach verification failures
   * Occurs when: After an attach handshake, the debugger does not report any
   * threads within the verification window — either the attach is dead
   * (issue #124) or the target is slow to become debuggable (issue #143)
   * Used in: src/session/session-manager-operations.ts
   * Default window: 20 seconds, overridable per call via 'verifyTimeout'
   * @param timeoutMs - The verification window in milliseconds
   * @param lastFailure - The last observed failure while polling 'threads'
   */
  attachVerifyFailed: (timeoutMs: number, lastFailure: string) =>
    `Attach did not become debuggable: no threads reported within ${timeoutMs}ms ` +
    `(last failure: ${lastFailure}). If the target is just slow to become debuggable ` +
    `(e.g. a busy or warming JVM), retry with a larger 'verifyTimeout' (ms) on attach_to_process.`,

  /**
   * Error message for attaches rejected by the debug adapter itself
   * Occurs when: The adapter rejects the attach after reporting itself
   * configured (e.g. CodeLLDB on ptrace EPERM) and the proxy dies mid-verify —
   * a retry with a larger timeout cannot help
   * Used in: src/session/session-manager-operations.ts
   * @param failure - The adapter's error, or the proxy exit description
   */
  attachAdapterFailed: (failure: string) =>
    `Attach failed: the debug adapter reported an error and exited during attach verification: ${failure}`,

  /**
   * Error message for adapter ready timeouts
   * Occurs when: Waiting for the debug adapter to be configured times out
   * Used in: src/session/session-manager.ts (logged as warning)
   * Default timeout: 30 seconds
   * @param timeout - The timeout duration in seconds
   */
  adapterReadyTimeout: (timeout: number) =>
    `Timed out waiting for debug adapter to be ready after ${timeout}s. ` +
    `The adapter may have failed to start properly. ` +
    `Check the debug logs for more details.`,

  /**
   * Error message for attach on a language whose adapter has no attach implementation
   * Occurs when: attach_to_process is called for a language whose adapter declares
   * modes.attach === 'none' (e.g. rust, go, mock)
   * Used in: src/session/session-manager-operations.ts
   * @param language - The session's language
   */
  attachModeNotSupported: (language: string) =>
    `Attach mode is not implemented for '${language}'. ` +
    `Use start_debugging to launch the program instead. ` +
    `See list_supported_languages for per-mode availability.`,

  /**
   * Hint appended to launch-toolchain failures on attach-capable languages
   * Occurs when: resolving the language executable for a launch fails, but the
   * adapter supports attach (which may not need the local toolchain at all)
   * Used in: src/session/session-manager-operations.ts
   * @param language - The session's language
   */
  attachMayStillWork: (language: string) =>
    `Attach mode may still be available for '${language}': start the target under its ` +
    `debug server (e.g. rdbg --open, python -m debugpy --listen) and use attach_to_process.`,

  /**
   * Error message for launches gated on a known-unavailable adapter (issue #360)
   * Occurs when: create_debug_session/start_debugging target a language whose
   * toolchain probe already reports unavailable — proceeding would "succeed"
   * while silently running nothing
   * Used in: src/session/session-manager-operations.ts, src/server.ts
   * @param language - The session's language
   * @param reason - The availability reason from the factory validation
   */
  launchUnavailable: (language: string, reason: string) =>
    `Cannot start a '${language}' debug session: ${reason} ` +
    `See list_supported_languages for per-mode availability, or run ` +
    `'mcp-debugger doctor ${language}' on the server host for a diagnosis.`,

  /**
   * A launch-shaped call arrived while another one on the same session had
   * not returned yet (issue #711). `held` is the operation in flight.
   *
   * "Wait for it to complete" is the right advice for every pairing but one:
   * restart_debugging on a session whose attach is still in flight will not
   * become available when the attach finishes — restart replays a launch
   * configuration and an attach session has none. That pairing gets the
   * terminal answer the post-attach `session.attachMode` check would give,
   * which `attachMode` is written too late (after the attach's first awaits)
   * to deliver on its own.
   */
  operationInFlight: (held: InFlightOperation, requestedTool: string) => {
    const inFlight = IN_FLIGHT[held];
    if (held === 'attach' && requestedTool === 'restart_debugging') {
      return `${inFlight}, and restart_debugging is never available for an attach session: ` +
        `there is no launch configuration to replay. Detach and re-attach instead.`;
    }
    return `${inFlight}; wait for it to complete before calling ${requestedTool}.`;
  },

  /**
   * Reason strings for per-mode availability reporting in list_supported_languages
   * Used in: src/utils/language-availability.ts and tests
   */
  modeUnavailableReason: {
    disabled: (language: string) =>
      `Language '${language}' is disabled in this runtime via DEBUG_MCP_DISABLE_LANGUAGES.`,
    notInstalled: (packageName: string) =>
      `Adapter package ${packageName} is not installed.`,
    attachNotImplemented: (language: string) =>
      `The '${language}' adapter does not implement attach mode.`,
    /** Launch-gate fallback when validation failed with an empty errors list */
    launchFallback: (language: string) =>
      `The '${language}' debug adapter is not available in this runtime.`,
  },
};
