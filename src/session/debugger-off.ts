/**
 * The debugger-off decision a session carries for one launch (issue #749):
 * `noDebug: true` on an adapter that honours it (issue #710). One gate and
 * one sentence, read by every surface that would otherwise answer in
 * debugger terms — set_breakpoint, list_breakpoints, pause, stepping,
 * inspection, list_debug_sessions — so the wording and the gate cannot
 * drift between them.
 */
import { SessionState, USER_BREAK_REASONS } from '@debugmcp/shared';
import { ErrorMessages } from '../utils/error-messages.js';

/** The slice of a session (or its public projection) the decision is read from. */
export interface DebuggerOffView {
  state: SessionState;
  debuggerDisabled?: boolean;
}

/**
 * Stops only a live debugger produces: a breakpoint or exception the user
 * asked for, or an entry stop. A `stopped` with one of these reasons clears
 * the decision — the adapter build debugs after all. Neither `pause` nor
 * `step` is among them: measured on js-debug under `noDebug`, a user pause
 * lands (the inspector is attached) and so does a step taken from it, while
 * line breakpoints still cannot bind — they prove nothing about binding.
 */
export const DEBUGGER_ON_STOP_REASONS: ReadonlySet<string> = new Set([
  ...USER_BREAK_REASONS,
  'entry'
]);

/**
 * Whether the decision applies now: recorded for this launch, and the
 * launch is running or paused. Over (stopped, error) or not yet launched
 * (created — a launch refused before the proxy existed leaves the record
 * behind — initializing, ready), it describes nothing that is running: a
 * breakpoint set then is an ordinary queued one for the next launch.
 */
export function isDebuggerOff(session: DebuggerOffView): boolean {
  return (
    session.debuggerDisabled === true &&
    (session.state === SessionState.RUNNING || session.state === SessionState.PAUSED)
  );
}

/** The why to place beside an answer, when the decision applies; else nothing. */
export function debuggerOffWhy(session: DebuggerOffView): string | undefined {
  return isDebuggerOff(session) ? ErrorMessages.debuggerOffForLaunch : undefined;
}
