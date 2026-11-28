/**
 * One launch-shaped operation per session at a time (issue #711).
 *
 * start_debugging, restart_debugging and attach_to_process all tear down
 * whatever proxy the session holds and bring up a new one. The MCP SDK
 * dispatches tool calls concurrently, and the session state alone cannot
 * tell "a launch is being awaited" from "the program is running" — a
 * JavaScript launch projects RUNNING the moment its child session is adopted
 * while start_debugging is still parked on the launch barrier. A second call
 * in that window used to pass the state guard, dispose the barrier the first
 * call was awaiting, and both calls reported success for a proxy that was
 * being torn down.
 *
 * The guard is claimed synchronously, before the operation's first await, so
 * a concurrent call dispatched in the same tick is refused rather than raced.
 * It is shared by the launcher and the attach controller: an attach blocks a
 * launch and vice versa, and `detach_from_process` — which tears the proxy
 * down just as thoroughly — takes the same claim.
 *
 * It also keeps the session's ending in flight (issue #1325): a
 * `close_debug_session` or a `detach_from_process`. An attached target is
 * released by one `disconnect`, and a second one on the same connection,
 * from a close that arrived while a detach waited for its answer, ended
 * debugpy's adapter and the target's debug port with it, while both calls
 * said the target was released. So for one session there is at most one
 * ending in flight: a close or a detach that arrives meanwhile joins it and
 * answers from what it observed, and no second release goes out. While an
 * ending is in flight every launch-shaped call is refused, whoever holds the
 * claim, so none can stop the worker under its release. A close takes the
 * claim as well when it is free; it is never refused, though, and one that
 * finds a launch-shaped call in flight goes ahead without the claim. That
 * call can still answer before the close does, successfully or not: an
 * attach that fails waits for the close before its own teardown, and once
 * it has answered the ending still refuses the next launch-shaped call.
 */
import { ErrorMessages, type InFlightOperation } from '../utils/error-messages.js';
import type { CloseSessionOutcome, DebugResult, DebugResultData, DetachResultData } from './session-manager-core.js';
import type { OperationsContext } from './operations-context.js';
import type { TargetRelease } from './attach/target-release.js';

/**
 * The refusal a launch-shaped operation answers on a child session, or
 * undefined for a root. A child was adopted, not launched, and its run
 * record is its tree's (`ManagedSession.run`): starting, replaying or
 * attaching on a child would write its root's run, and detaching it would be
 * judged by its root's ownership. The tool handlers refuse a child id before
 * they call down (`childSessionRefusal`); this is the same answer for any
 * caller that does not come through them.
 */
export function refuseChildSession(
  session: { id: string; parentSessionId?: string },
  requestedTool: string
): string | undefined {
  return session.parentSessionId
    ? ErrorMessages.childSessionRefused(requestedTool, session.id, session.parentSessionId)
    : undefined;
}

/** The slice of the operations context `run` needs: the session and the log. */
export type InFlightContext = Pick<OperationsContext, 'getSession' | 'logger'>;

/**
 * Re-exported for the session layer. The union is declared next to the refusal
 * text it selects (src/utils/error-messages.ts) so adding an operation is one
 * edit, and so this module does not need a utils → session dependency.
 */
export type { InFlightOperation };

/** The two ways a session is ended on request (issue #1325). */
export type EndingOperation = Extract<InFlightOperation, 'close' | 'detach'>;

/**
 * What an ending did, as an ending that joined it reads it (issue #1325).
 * Every field is what the ending itself observed; one that failed before it
 * observed anything leaves only `operation`, and its joiners act on their own.
 */
export interface EndingRecord {
  operation: EndingOperation;
  /**
   * A plain detach's release, and what the adapter did with it: set once the
   * release was sent, whether or not the detach's cleanup then succeeded (its
   * answer says that), so a close that joins it never sends a second one.
   */
  release?: TargetRelease;
  /** The close the ending made: a close's outcome, or the one a terminating detach makes. */
  closed?: CloseSessionOutcome;
  /** A detach's answer. */
  detached?: DebugResult<DetachResultData>;
}

/** An ending in flight: who it is, and what it did once it is over. */
export interface SessionEnding {
  operation: EndingOperation;
  /** A detach with terminateProcess: it ends the process, so it is not a release a plain ending can join. */
  terminate: boolean;
  /** Settles, never rejects, once the ending is over and the session's claim and record are cleared. */
  over: Promise<EndingRecord>;
}

export class InFlightGuard {
  private readonly inFlight = new Map<string, InFlightOperation>();
  private readonly endings = new Map<string, SessionEnding>();

  /** The operation currently in flight for the session, if any. */
  current(sessionId: string): InFlightOperation | undefined {
    return this.inFlight.get(sessionId);
  }

  /**
   * Claim the session for `operation`. Returns undefined when the claim
   * succeeded, or the refusal message — naming the operation in flight and
   * the tool that was refused — when an ending of the session is in flight
   * or another operation holds the session. A refusal never touches the
   * existing claim.
   *
   * The ending is checked first (issue #1325): a close that came while a
   * launch-shaped call was in flight holds no claim, and that call's release
   * of its own claim must not let the next one start under the close. The
   * two endings ask `ending()` before they claim, and join one in flight.
   */
  tryAcquire(sessionId: string, operation: InFlightOperation, requestedTool: string): string | undefined {
    const ending = this.endings.get(sessionId);
    if (ending) {
      return ErrorMessages.operationInFlight(ending.operation, requestedTool);
    }
    const held = this.inFlight.get(sessionId);
    if (held) {
      return ErrorMessages.operationInFlight(held, requestedTool);
    }
    this.inFlight.set(sessionId, operation);
    return undefined;
  }

  /** Release the session; a no-op when nothing is claimed. */
  release(sessionId: string): void {
    this.inFlight.delete(sessionId);
  }

  /**
   * Run `body` holding the session's claim: the wrapper every public
   * launch-shaped method uses (`startDebugging`, `restartDebugging`,
   * `attachToProcess`, `detachFromProcess`).
   *
   * A child session is refused first (`refuseChildSession`). The session is
   * resolved BEFORE the claim, so an unknown id throws
   * `SessionNotFoundError` without leaving a claim stranded, and so the
   * refusal envelope can report the session's real state. Nothing here
   * awaits before `tryAcquire`, and `body()` is invoked synchronously, so a
   * concurrent call dispatched in the same tick is refused rather than raced.
   * The claim is released in `finally` — a thrown body releases it too.
   */
  async run<TData extends DebugResultData>(
    sessionId: string,
    operation: InFlightOperation,
    requestedTool: string,
    ctx: InFlightContext,
    body: () => Promise<DebugResult<TData>>
  ): Promise<DebugResult<TData>> {
    const session = ctx.getSession(sessionId);
    const child = refuseChildSession(session, requestedTool);
    if (child) {
      ctx.logger.warn(`[SessionManager] ${child}`);
      return { success: false, state: session.state, error: child };
    }
    const refusal = this.tryAcquire(sessionId, operation, requestedTool);
    if (refusal) {
      ctx.logger.warn(`[SessionManager] ${refusal}`);
      return { success: false, state: session.state, error: refusal };
    }
    try {
      return await body();
    } finally {
      this.release(sessionId);
    }
  }

  /** The close or detach in flight for the session, if any (issue #1325): one that arrives now joins it. */
  ending(sessionId: string): SessionEnding | undefined {
    return this.endings.get(sessionId);
  }

  /**
   * Run an ending of the session (issue #1325), registered for joiners from
   * before `body` starts until it is over. Nothing here awaits before the
   * registration and `body()` is invoked synchronously, as in `run`, so an
   * ending dispatched in the same tick joins this one. `claimed` says the
   * caller took the session's claim for it, which is released here, before
   * the joiners are told, so a joiner that goes on to act finds the session
   * free. The record goes when the ending is over, so the session's next run
   * (a detach leaves the row, and it can attach again) has endings of its own.
   */
  async runEnding<T>(
    sessionId: string,
    ending: { operation: EndingOperation; terminate?: boolean; claimed: boolean },
    body: () => Promise<{ answer: T; record: EndingRecord }>
  ): Promise<T> {
    let tell!: (record: EndingRecord) => void;
    const entry: SessionEnding = {
      operation: ending.operation,
      terminate: ending.terminate === true,
      over: new Promise<EndingRecord>((resolve) => { tell = resolve; })
    };
    this.endings.set(sessionId, entry);
    let record: EndingRecord = { operation: ending.operation };
    try {
      const done = await body();
      record = done.record;
      return done.answer;
    } finally {
      if (ending.claimed) {
        this.release(sessionId);
      }
      if (this.endings.get(sessionId) === entry) {
        this.endings.delete(sessionId);
      }
      tell(record);
    }
  }
}
