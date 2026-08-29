/**
 * Launch-time breakpoint warnings.
 *
 * Each of these reads session state and returns a string — no adapter, no
 * proxy, no clock. They were already written that way as methods (their tests
 * called them off the prototype with a bare receiver to prove it); as free
 * functions the purity is the signature rather than a convention.
 */
import path from 'path';
import type { AdapterPolicy } from '@debugmcp/shared';
import { normalizeBreakpointMessage } from '../../utils/breakpoint-message.js';
import type { ManagedSession } from '../session-store.js';

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
