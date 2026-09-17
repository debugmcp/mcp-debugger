/**
 * The debugger-off decision a session carries for one launch (issue #749):
 * `noDebug: true` on an adapter that honours it (issue #710). One gate, one
 * rule for what clears it, and one sentence per state, read by every
 * surface that would otherwise answer in debugger terms — set_breakpoint,
 * list_breakpoints, pause, stepping, inspection, list_debug_sessions — so
 * the wording and the gate cannot drift between them.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import { BREAKPOINT_STOP_REASONS, SessionState } from '@debugmcp/shared';
import { ErrorMessages } from '../utils/error-messages.js';

/** The slice of a session the decision is read from. */
export interface DebuggerOffView {
  state: SessionState;
  launchDebuggerOff?: boolean;
  breakpoints?: ReadonlyMap<string, { verified: boolean }>;
  functionBreakpoints?: ReadonlyMap<string, { verified: boolean }>;
}

/**
 * Whether the adapter has verified a breakpoint of this launch — proof as
 * strong as a stop that this build debugs after all, and it arrives before
 * any hit. Measured: every adapter that honours the flag refuses or unbinds
 * a breakpoint under it (js-debug "Unbound breakpoint", debugpy "Server is
 * not available", Delve "noDebug mode: unable to process 'setBreakpoints'",
 * CodeLLDB "Not supported in noDebug mode"), so a verified record can only
 * come from a build that ignores the flag. Per-launch state (bindings are
 * reset at each launch), so it is consulted on read rather than clearing
 * the record the way a stop does.
 */
export function adapterVerifiedABreakpoint(session: DebuggerOffView): boolean {
  for (const bp of session.breakpoints?.values() ?? []) {
    if (bp.verified) {
      return true;
    }
  }
  for (const bp of session.functionBreakpoints?.values() ?? []) {
    if (bp.verified) {
      return true;
    }
  }
  return false;
}

/**
 * Whether a stop proves the debugger is live after all — this adapter
 * build ignores the flag, or a stale pin — and the record must go. Judged
 * on what the adapter itself reported, not the policy's relabel. Measured
 * on js-debug under `noDebug`: the inspector is attached, so a user pause
 * lands, a step from it lands, and a `debugger;` statement pauses with the
 * adapter's reason 'pause' (relabelled 'breakpoint' by the policy) — while
 * line breakpoints still cannot bind and an uncaught throw does not stop.
 * Proof, then, is: a breakpoint the adapter itself called one, or named in
 * `hitBreakpointIds`; an exception stop; an entry stop.
 */
export function stopProvesDebuggerOn(
  reason: string,
  rawReason: string,
  body: DebugProtocol.StoppedEvent['body'] | undefined
): boolean {
  if ((body?.hitBreakpointIds?.length ?? 0) > 0) {
    return true;
  }
  if (reason === 'entry' || reason === 'exception') {
    return true;
  }
  return BREAKPOINT_STOP_REASONS.has(reason) && BREAKPOINT_STOP_REASONS.has(rawReason);
}

/**
 * Whether the decision applies now: recorded for this launch, and the
 * launch is live — initializing (the proxy is up; a breakpoint set now
 * still goes to the adapter), running, or paused. Over (stopped, error) or
 * never launched (created — a launch refused before the proxy existed
 * leaves the record behind), it describes nothing that is running: a
 * breakpoint set then is an ordinary queued one for the next launch. And
 * not once the adapter has verified a breakpoint (see above).
 */
export function isDebuggerOff(session: DebuggerOffView): boolean {
  return (
    session.launchDebuggerOff === true &&
    (session.state === SessionState.INITIALIZING ||
      session.state === SessionState.RUNNING ||
      session.state === SessionState.PAUSED) &&
    !adapterVerifiedABreakpoint(session)
  );
}

/**
 * The why to place beside an answer, when the decision applies; else
 * nothing. A paused session gets the clause that is still true of it —
 * breakpoints cannot bind — not "no stop is expected".
 */
export function debuggerOffWhy(session: DebuggerOffView): string | undefined {
  if (!isDebuggerOff(session)) {
    return undefined;
  }
  return session.state === SessionState.PAUSED
    ? ErrorMessages.debuggerOffForLaunchPaused
    : ErrorMessages.debuggerOffForLaunch;
}
