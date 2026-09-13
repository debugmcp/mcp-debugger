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
 * launch and vice versa.
 */
import { ErrorMessages } from '../utils/error-messages.js';

export type InFlightOperation = 'launch' | 'restart' | 'attach';

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
}
