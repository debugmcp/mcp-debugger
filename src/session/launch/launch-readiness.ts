/**
 * The two waits between "the proxy has started and the handshake has run" and
 * "the launch is reportable" (issues #823, #826).
 *
 * 1. Until the program is launched: the session has left INITIALIZING. The
 *    adapter reporting itself configured moves it to RUNNING; a launch that
 *    asked for an entry stop stays INITIALIZING until that stop makes it
 *    PAUSED; a program that ended, or a launch that failed, makes it terminal.
 *    None of that is a guess about what the program will do, so it gets a
 *    generous ceiling — and a ceiling that runs out means the adapter never
 *    answered, which is what the warning has always meant.
 *
 * 2. The hold: a short window in which the launch call keeps its answer back
 *    so that the usual case — a breakpoint reached as the program starts —
 *    is reported by the call itself. The same for every adapter and whatever
 *    is armed; not a limit on the program. A launch that has not stopped when
 *    it elapses is answered as running, and `wait_for_stop` is the explicit
 *    way to wait longer (issue #849).
 *
 * Both waits are on the session's state (`waitForSessionState`), not on the
 * adapter's `stopped` event, so an entry stop the core auto-continues settles
 * neither. Never rejects.
 */
import { SessionState, isTerminalSessionState } from '@debugmcp/shared';
import { ErrorMessages } from '../../utils/error-messages.js';
import type { OperationsContext } from '../operations-context.js';
import { waitForSessionState } from '../execution/session-state-wait.js';

/** The readiness waits read the session's state, subscribe to its changes, and narrate. */
export type LaunchReadinessContext = Pick<OperationsContext, 'logger' | 'getSession' | 'onStateChange'>;

/**
 * How the launch stands when it is answered: paused at its first stop; over
 * (the program ended, the launch failed, or the session was closed); launched
 * and still running when the hold elapsed; or never launched — the adapter did
 * not report within the ceiling.
 */
export type LaunchReadinessOutcome = 'stopped' | 'ended' | 'running' | 'not-launched';

export interface LaunchReadinessInput {
  sessionId: string;
  /** How long the adapter gets to report the program launched, or to deliver a requested entry stop. */
  launchedCeilingMs: number;
  /** How long a launched program's first stop is held for before the launch is answered as running. */
  holdMs: number;
  /**
   * Runs once, when the program is running and before the hold begins — the
   * moment anything that was waiting for a live debuggee can be delivered
   * (breakpoints set while the launch was starting, issue #851). A failure
   * here is logged, never the launch's.
   */
  beforeHold?: () => Promise<void> | void;
}

const stoppedOrEnded = (state: SessionState): boolean =>
  state === SessionState.PAUSED || isTerminalSessionState(state);

export async function waitForLaunchReadiness(
  ctx: LaunchReadinessContext,
  input: LaunchReadinessInput
): Promise<LaunchReadinessOutcome> {
  const { sessionId, launchedCeilingMs, holdMs, beforeHold } = input;

  /** The session's state now, or undefined when it has been removed. */
  const currentState = (): SessionState | undefined => {
    try {
      return ctx.getSession(sessionId).state;
    } catch {
      return undefined;
    }
  };
  const settledOutcome = (state: SessionState | undefined): LaunchReadinessOutcome | undefined => {
    if (state === undefined || isTerminalSessionState(state)) {
      return 'ended';
    }
    return state === SessionState.PAUSED ? 'stopped' : undefined;
  };

  const launched = await waitForSessionState(
    ctx,
    sessionId,
    (state) => state !== SessionState.INITIALIZING,
    { timeoutMs: launchedCeilingMs }
  );
  if (launched === 'timeout') {
    ctx.logger.warn(ErrorMessages.adapterReadyTimeout(launchedCeilingMs / 1000));
    return 'not-launched';
  }

  const afterLaunch = settledOutcome(currentState());
  if (afterLaunch) {
    ctx.logger.info(`[SessionManager] Session ${sessionId} ${afterLaunch} by the time the launch completed`);
    return afterLaunch;
  }

  if (beforeHold) {
    try {
      await beforeHold();
    } catch (error) {
      ctx.logger.warn(
        `[SessionManager] Session ${sessionId}: preparing the launch hold failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  await waitForSessionState(ctx, sessionId, stoppedOrEnded, { timeoutMs: holdMs });
  const afterHold = settledOutcome(currentState());
  if (afterHold) {
    ctx.logger.info(`[SessionManager] Session ${sessionId} ${afterHold} within the launch hold`);
    return afterHold;
  }
  ctx.logger.info(
    `[SessionManager] Session ${sessionId} still running after the ${holdMs}ms launch hold; answering with pending`
  );
  return 'running';
}
