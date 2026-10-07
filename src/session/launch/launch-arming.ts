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
 */
import type { ManagedSession } from '../session-store.js';

export type ArmingSession = Pick<
  ManagedSession,
  'breakpoints' | 'functionBreakpoints' | 'adapterCapabilities' | 'effectiveBreakOnExceptions'
>;

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
  const entry = stopOnEntry === true;

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

  return {
    armed: clauses.length > 0,
    lineBreakpoints,
    logpointsThatPause,
    functionBreakpoints,
    stopOnEntry: entry,
    pausesOnCaughtExceptions,
    summary: joinClauses(clauses),
    logpoints,
    ...(logpoints > 0 ? { loggingSummary: `${logpoints} logpoint(s) that log without stopping` } : {})
  };
}

/** "a", "a and b", "a, b and c" — the launch warnings' list shape. */
function joinClauses(clauses: string[]): string {
  if (clauses.length <= 1) {
    return clauses[0] ?? '';
  }
  return `${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`;
}
