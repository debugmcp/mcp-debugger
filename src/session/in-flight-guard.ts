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
 */
import { ErrorMessages, type InFlightOperation } from '../utils/error-messages.js';
import type { DebugResult, DebugResultData } from './session-manager-core.js';
import type { OperationsContext } from './operations-context.js';

/** The slice of the operations context `run` needs: the session and the log. */
export type InFlightContext = Pick<OperationsContext, 'getSession' | 'logger'>;

/**
 * Re-exported for the session layer. The union is declared next to the refusal
 * text it selects (src/utils/error-messages.ts) so adding an operation is one
 * edit, and so this module does not need a utils → session dependency.
 */
export type { InFlightOperation };

export class InFlightGuard {
  private readonly inFlight = new Map<string, InFlightOperation>();

  /** The operation currently in flight for the session, if any. */
  current(sessionId: string): InFlightOperation | undefined {
    return this.inFlight.get(sessionId);
  }

  /**
   * Claim the session for `operation`. Returns undefined when the claim
   * succeeded, or the refusal message — naming the operation in flight and
   * the tool that was refused — when another operation holds the session.
   * A refusal never touches the existing claim.
   */
  tryAcquire(sessionId: string, operation: InFlightOperation, requestedTool: string): string | undefined {
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
   * The session is resolved BEFORE the claim, so an unknown id throws
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
}
