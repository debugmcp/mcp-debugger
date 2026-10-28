/**
 * What a launch has armed that could stop it (issue #815): the pausing line
 * breakpoints, the function breakpoints, a requested entry stop and a
 * caught-exception filter. It words the answer of a launch, or of a
 * wait_for_stop, whose program is still running — what has not been reached
 * yet, or that nothing is armed — and decides nothing else: how long a
 * launch holds its answer does not depend on it (issues #823, #826). An
 * uncaught-exception filter (the launch default on most adapters) is left
 * out: it stops the program only at a crash, which is not a stop a caller
 * is waiting for, and counting it would make every launch armed.
 *
 * The exception arming itself — the filter ids the mode resolves to on this
 * policy, and whether an uncaught exception will stop the program at all —
 * is settled once per launch or attach by `recordExceptionArming` (issues
 * #985, #1032) and read back here, so the launch answer, the wait_for_stop
 * answer and the wire cannot drift apart.
 */
import { resolveExceptionFilters, type AdapterPolicy, type ExceptionBreakMode } from '@debugmcp/shared';
import type { ManagedSession } from '../session-store.js';
import type { NoUncaughtStop } from '../../utils/error-messages.js';

export type ArmingSession = Pick<
  ManagedSession,
  'breakpoints' | 'functionBreakpoints' | 'adapterCapabilities' | 'effectiveBreakOnExceptions' | 'launchExceptionFilters'
>;

/**
 * The exception arming of one launch or attach: the DAP filter ids the
 * resolved mode arms on this policy (the same resolver the worker sends), the
 * ids beyond the mode's table (issue #985: a pytest module launch adds
 * `userUnhandled` to the `uncaught` default), and — when no uncaught
 * exception will stop the program — why (issue #1032).
 */
export interface ExceptionArming {
  readonly ids: readonly string[];
  readonly beyondMode: readonly string[];
  /**
   * Why no uncaught exception will stop the program, or undefined when one
   * will: the caller opted out (`'none'`); the adapter has no uncaught-only
   * filter and its engine does not stop on its own (rdbg; CodeLLDB on
   * Windows, where abort() ends the process with exit code 3); or the adapter
   * has one and nobody asked for it (an attach with no mode).
   */
  readonly noUncaughtStop: NoUncaughtStop | undefined;
}

export function describeExceptionArming(
  policy: AdapterPolicy,
  mode: ExceptionBreakMode | undefined,
  launchConfig?: Record<string, unknown>
): ExceptionArming {
  // The launch-aware answer, and the mode's table alone (the resolver without
  // a launch config), so the ids the launch added beyond the table are known.
  const ids = resolveExceptionFilters(policy, mode, launchConfig);
  const tableIds = resolveExceptionFilters(policy, mode);
  return {
    ids,
    beyondMode: ids.filter(id => !tableIds.includes(id)),
    noUncaughtStop: noUncaughtStopOf(policy, mode, ids)
  };
}

/** `describeExceptionArming`, recorded on the session for the answers that read it. */
export function recordExceptionArming(
  session: Pick<ManagedSession, 'launchExceptionFilters'>,
  policy: AdapterPolicy,
  mode: ExceptionBreakMode | undefined,
  launchConfig?: Record<string, unknown>
): ExceptionArming {
  const arming = describeExceptionArming(policy, mode, launchConfig);
  session.launchExceptionFilters = arming;
  return arming;
}

/** The abstract modes this policy resolves to at least one filter id — what a caller could ask for instead. */
export function supportedExceptionModes(policy: AdapterPolicy): readonly ExceptionBreakMode[] {
  return (['uncaught', 'all'] as const).filter(mode => resolveExceptionFilters(policy, mode).length > 0);
}

function noUncaughtStopOf(
  policy: AdapterPolicy,
  mode: ExceptionBreakMode | undefined,
  ids: readonly string[]
): NoUncaughtStop | undefined {
  if (mode === 'none') {
    return 'opted-out';
  }
  // Read the way the resolver reads the table — a policy double may answer
  // no behavior at all, and the verdict then has nothing to say against it.
  const behavior = policy.getInitializationBehavior?.() ?? {};
  // A filter is armed, or the engine stops at an uncaught exception with none
  // (CodeLLDB on POSIX: std::terminate → SIGABRT is a signal stop).
  if (ids.length > 0 || behavior.stopsOnUncaughtWithoutFilter === true) {
    return undefined;
  }
  // The adapter has the filter, nobody asked for it: an attach with no mode.
  if (mode === undefined && (behavior.exceptionFilters?.uncaught.length ?? 0) > 0) {
    return 'not-requested';
  }
  return 'unavailable';
}

export interface LaunchArming {
  /** True when anything below can stop the program before it ends. */
  armed: boolean;
  /** Pausing line breakpoints (logpoints the adapter runs on are left out). */
  lineBreakpoints: number;
  /**
   * Logpoints downgraded to pausing breakpoints because the adapter does not
   * advertise supportsLogPoints (issue #469) — or has not said yet.
   */
  logpointsThatPause: number;
  functionBreakpoints: number;
  stopOnEntry: boolean;
  /** `breakOnExceptions: 'all'` — the one mode that stops on an exception the program survives. */
  pausesOnCaughtExceptions: boolean;
  /**
   * Exception-filter ids the launch armed beyond its mode's table (issue
   * #985: a pytest module launch adds `userUnhandled` to the `uncaught`
   * default). They stop on an exception the program survives — a failing
   * test — so they count as armed.
   */
  extraExceptionFilters: readonly string[];
  /** The armed clauses in one phrase ("2 breakpoint(s) and an entry stop"); '' when unarmed. */
  summary: string;
  /**
   * Logpoints the adapter runs on (issue #865). They never stop the program,
   * so they are not armed and not in `summary` — but an answer that says
   * "no breakpoints" to a caller who set one reads as "it was not
   * registered", so they are counted and worded apart.
   */
  logpoints: number;
  /** "1 logpoint(s) that log without stopping"; undefined when there are none. */
  loggingSummary?: string;
  /**
   * Why no uncaught exception will stop the program (issues #1009, #1032),
   * or undefined when one will — the `'uncaught'` default on an adapter that
   * has the filter, or an engine that stops at a crash on its own. Not armed
   * (see the header), but it decides what the unarmed answer may promise:
   * read from the recorded exception arming; a session with none recorded
   * falls back to the mode (`'none'` opted out, anything else stops).
   */
  noUncaughtStop?: NoUncaughtStop;
}

export function describeLaunchArming(session: ArmingSession, stopOnEntry: boolean | undefined): LaunchArming {
  // The same rule as the run-to-completion summary: a logpoint runs on only
  // when the adapter advertises supportsLogPoints; before the handshake has
  // said so, it counts as a stop the program can meet.
  const logpointsRunOn = session.adapterCapabilities?.supportsLogPoints === true;
  let lineBreakpoints = 0;
  let logpointsThatPause = 0;
  let logpoints = 0;
  for (const bp of session.breakpoints.values()) {
    if (bp.logMessage === undefined) {
      lineBreakpoints++;
    } else if (logpointsRunOn) {
      logpoints++;
    } else {
      logpointsThatPause++;
    }
  }
  const functionBreakpoints = session.functionBreakpoints?.size ?? 0;
  const pausesOnCaughtExceptions = session.effectiveBreakOnExceptions === 'all';
  const extraExceptionFilters = session.launchExceptionFilters?.beyondMode ?? [];
  const entry = stopOnEntry === true;
  const noUncaughtStop = session.launchExceptionFilters
    ? session.launchExceptionFilters.noUncaughtStop
    : session.effectiveBreakOnExceptions === 'none' ? 'opted-out' : undefined;

  const clauses: string[] = [];
  if (lineBreakpoints > 0) {
    clauses.push(`${lineBreakpoints} breakpoint(s)`);
  }
  if (logpointsThatPause > 0) {
    clauses.push(`${logpointsThatPause} logpoint(s) downgraded to pausing breakpoint(s)`);
  }
  if (functionBreakpoints > 0) {
    clauses.push(`${functionBreakpoints} function breakpoint(s)`);
  }
  if (entry) {
    clauses.push('an entry stop');
  }
  if (pausesOnCaughtExceptions) {
    clauses.push("breakOnExceptions: 'all'");
  }
  if (extraExceptionFilters.length > 0) {
    clauses.push(`the exception filter(s) ${extraExceptionFilters.join(', ')} the launch armed (they pause on an exception the program survives)`);
  }

  return {
    armed: clauses.length > 0,
    lineBreakpoints,
    logpointsThatPause,
    functionBreakpoints,
    stopOnEntry: entry,
    pausesOnCaughtExceptions,
    extraExceptionFilters,
    summary: joinClauses(clauses),
    logpoints,
    ...(logpoints > 0 ? { loggingSummary: `${logpoints} logpoint(s) that log without stopping` } : {}),
    ...(noUncaughtStop ? { noUncaughtStop } : {})
  };
}

/** "a", "a and b", "a, b and c" — the launch warnings' list shape. */
function joinClauses(clauses: string[]): string {
  if (clauses.length <= 1) {
    return clauses[0] ?? '';
  }
  return `${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`;
}
