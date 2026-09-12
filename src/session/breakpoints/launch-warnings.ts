/**
 * Launch-time breakpoint warnings.
 *
 * Each of these reads session state and returns text (or, for the
 * run-to-completion summary, text plus the structured fields behind it) — no
 * adapter, no proxy, no clock. They were already written that way as methods
 * (their tests called them off the prototype with a bare receiver to prove
 * it); as free functions the purity is the signature rather than a convention.
 */
import path from 'path';
import type { AdapterPolicy } from '@debugmcp/shared';
import { normalizeBreakpointMessage } from '../../utils/breakpoint-message.js';
import type { ManagedSession } from '../session-store.js';

/** One line breakpoint the program ran past without stopping (issue #701). */
export interface UnhitBreakpointSummary {
  file: string;
  /** The line as the adapter bound it (the store's current line). */
  line: number;
  /** The line the caller asked for, when the adapter moved it. */
  requestedLine?: number;
  verified: boolean;
}

/**
 * Ran-to-completion unbound-breakpoint warning (issue #467). Built only
 * when the launch ends in STOPPED: at that point an unverified breakpoint
 * never bound and never will, for bind-late adapters too — so this is a
 * zero-false-positive moment to surface the per-breakpoint diagnostics the
 * store already holds (e.g. the path-remap suggestion CodeLLDB puts in
 * `message`).
 */
export function buildUnboundBreakpointExitWarning(
  session: Pick<ManagedSession, 'breakpoints'>
): string | undefined {
  const unbound = Array.from(session.breakpoints.values()).filter(bp => !bp.verified);
  if (unbound.length === 0) {
    return undefined;
  }
  const parts = unbound.map(bp => {
    // Some stamp paths store the raw js-debug l10n key — translate it
    // rather than showing 'breakpoint.provisionalBreakpoint' (issue #471).
    const message = normalizeBreakpointMessage(bp.message, bp.verified);
    return `${path.basename(bp.file)}:${bp.line}${message ? ` (${message})` : ''}`;
  });
  return (
    `${unbound.length} breakpoint(s) never bound during this run: ${parts.join('; ')}. ` +
    `The program ran to completion without stopping there — check the file path and line, ` +
    `or list_breakpoints for the full per-breakpoint state`
  );
}

/** What a launch reports when it ended STOPPED: a sentence for the message, and the fields behind it. */
export interface RunToCompletionSummary {
  /** Appended to the launch message after "Current state: stopped". */
  summary: string;
  /** Spread into the result's data. */
  data: {
    exitCode?: number;
    unhitBreakpoints?: UnhitBreakpointSummary[];
  };
}

/**
 * Run-to-completion summary (issue #701). Built when the launch ends in
 * STOPPED. Says how the program ended — with its exit code when the debuggee
 * reported one (attach targets, signal-killed debuggees and adapters that
 * send no `exited` leave it undefined) — and, when no stop was recorded,
 * lists every breakpoint it ran past, verified or not, naming the verified
 * ones (the unbound warning, #467, names the unbound ones). A stop that was
 * recorded before the exit — a breakpoint hit whose `stopped` and the
 * `exited` arrived in the same tick — means the breakpoints were not all
 * missed, so the list is withheld and the stop is named instead. Logpoints
 * the adapter supports are not breakpoints the program "missed" (they log
 * and run on) and are left out; a downgraded logpoint (no adapter support)
 * did pause, so it counts.
 */
export function buildRunToCompletionSummary(
  session: Pick<ManagedSession, 'breakpoints' | 'functionBreakpoints' | 'exitCode' | 'lastStop' | 'adapterCapabilities'>
): RunToCompletionSummary {
  const exitCode = session.exitCode;
  const ended =
    typeof exitCode !== 'number'
      ? 'The program ended without reporting an exit code'
      : exitCode === 0
        ? 'The program ran to completion (exit code 0)'
        : `The program exited with code ${exitCode}`;
  const data: RunToCompletionSummary['data'] = typeof exitCode === 'number' ? { exitCode } : {};

  if (session.lastStop) {
    return {
      summary: `${ended} after a stop the launch could not report (last stop: ${session.lastStop.reason}).`,
      data
    };
  }

  const logpointsRunOn = session.adapterCapabilities?.supportsLogPoints === true;
  const unhitBreakpoints: UnhitBreakpointSummary[] = [];
  for (const bp of session.breakpoints.values()) {
    if (logpointsRunOn && bp.logMessage !== undefined) {
      continue;
    }
    unhitBreakpoints.push({
      file: bp.file,
      line: bp.line,
      ...(typeof bp.requestedLine === 'number' && bp.requestedLine !== bp.line ? { requestedLine: bp.requestedLine } : {}),
      verified: bp.verified
    });
  }
  const unhitFunctions = Array.from(session.functionBreakpoints?.values() ?? []);
  data.unhitBreakpoints = unhitBreakpoints;

  if (unhitBreakpoints.length === 0 && unhitFunctions.length === 0) {
    return { summary: `${ended}.`, data };
  }
  const verifiedNames = [
    ...unhitBreakpoints.filter(bp => bp.verified).map(bp => `${path.basename(bp.file)}:${bp.line}`),
    ...unhitFunctions.filter(bp => bp.verified).map(bp => `function '${bp.functionName}'`)
  ];
  const verifiedClause = verifiedNames.length > 0
    ? ` Verified but never hit: ${verifiedNames.join(', ')}.`
    : '';
  return { summary: `${ended} without hitting any breakpoint.${verifiedClause}`, data };
}

/**
 * Launch-time logpoint-downgrade warning (issue #469). A logpoint accepted
 * pre-launch under unknown policy support ("it will be validated against
 * the adapter's capabilities at launch") gets its promised verdict here:
 * when the live adapter does not advertise supportsLogPoints, the logpoint
 * has been silently downgraded to a pausing breakpoint — say so in the
 * start_debugging response instead of only in the server log.
 */
export function buildLogpointDowngradeLaunchWarning(
  session: Pick<ManagedSession, 'breakpoints' | 'adapterCapabilities' | 'language'>
): string | undefined {
  const caps = session.adapterCapabilities;
  if (!caps || caps.supportsLogPoints === true) {
    return undefined;
  }
  const downgraded: string[] = [];
  for (const bp of session.breakpoints.values()) {
    if (bp.logMessage !== undefined) {
      downgraded.push(`${path.basename(bp.file)}:${bp.line}`);
    }
  }
  if (downgraded.length === 0) {
    return undefined;
  }
  return (
    `Logpoint(s) at ${downgraded.join(', ')} were downgraded to pausing breakpoints: ` +
    `the ${session.language} adapter does not advertise supportsLogPoints, so the ` +
    `logMessage will not be logged and the program will PAUSE at those lines instead ` +
    `of running through them`
  );
}

/**
 * Launch-time unbound-function-breakpoint warning (issue #308). Called
 * after the post-launch re-sync, when verified state is fresh. Returns
 * undefined for bind-late policies (js/java) — unverified-at-launch is
 * their designed deferral, not a failure.
 *
 * The policy is a parameter because the caller resolves it from the session
 * store, whose lookup throws for an unknown language.
 */
export function buildFunctionBreakpointLaunchWarning(
  session: Pick<ManagedSession, 'functionBreakpoints'>,
  policy: AdapterPolicy | undefined
): string | undefined {
  if ((session.functionBreakpoints?.size ?? 0) === 0) {
    return undefined;
  }
  if (policy?.functionBreakpointsBindLate === true) {
    return undefined;
  }
  const parts: string[] = [];
  for (const bp of session.functionBreakpoints.values()) {
    if (bp.verified) {
      continue;
    }
    const hint = policy?.functionBreakpointNameHint?.(bp.functionName) ?? bp.message;
    parts.push(`'${bp.functionName}'${hint ? ` (${hint})` : ''}`);
  }
  if (parts.length === 0) {
    return undefined;
  }
  return (
    `Function breakpoint(s) not bound at launch: ${parts.join('; ')}. ` +
    `The adapter could not resolve the name, so the program will not stop there — ` +
    `check the symbol name; list_breakpoints shows the current state`
  );
}
