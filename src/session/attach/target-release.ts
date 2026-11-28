/**
 * Releasing an attached target: the one detach both `detach_from_process` and
 * `close_debug_session` send for a session that borrowed its program (issue
 * #1325). It used to be two: detach sent its own `disconnect` and waited
 * 10 s, close left it to the worker's shutdown, which waited 1 s and then
 * closed the connection. An adapter that belongs to the target (one the
 * worker dialed rather than started) can end itself when its client leaves
 * before it has answered, and one that answers only once the target is free
 * then took the target's debug port with it whenever a close came while the
 * target was busy for more than a second. Both endings now send the same
 * request under the same bound, before the worker is stopped.
 */
import type { ILogger } from '@debugmcp/shared';
import type { IProxyManager } from '../../proxy/proxy-manager.js';

/**
 * How long a detach waits for the adapter to acknowledge it (issue #1148).
 * Sized by measurement: every attach-capable adapter answers a detaching
 * disconnect in 0 to 15 ms on an idle target (413 ms at most across a day
 * of launch-mode runs), and the worker may spend up to 2 s on the resume it
 * sends ahead of one. An adapter that answers only once the target is free
 * answers after the target's busy call: within the bound for a call shorter
 * than it. When it expires the worker is stopped anyway, which closes the
 * connection, and the answer says the release was not confirmed. It used to
 * wait the full request timeout, 30 s, and then answer "process still
 * running".
 */
export const DETACH_ACKNOWLEDGEMENT_TIMEOUT_MS = 10_000;

/** What became of an attached target's release, as the worker saw the adapter answer it. */
export type TargetRelease =
  /** The adapter acknowledged the detach: by its response, or by `terminated` in reply. */
  | { fate: 'released' }
  /** The adapter reported that the program exited. */
  | { fate: 'program-ended' }
  /** Nothing acknowledged it, and why. */
  | { fate: 'unconfirmed'; reason: string };

/** The reason a release that ran out of time gives, in the bound's own unit. */
export function noAnswerWithin(timeoutMs: number): string {
  return `no answer within ${timeoutMs} ms`;
}

/**
 * Send the detaching disconnect through the session's worker and read back
 * what the adapter did with it: the worker's report of this request, or,
 * when no report came, the request's own outcome.
 */
export async function releaseAttachedTarget(
  proxyManager: IProxyManager,
  logger: Pick<ILogger, 'warn'>,
  timeoutMs: number = DETACH_ACKNOWLEDGEMENT_TIMEOUT_MS
): Promise<TargetRelease> {
  let failure: string | undefined;
  try {
    await proxyManager.sendDapRequest('disconnect', { terminateDebuggee: false }, { timeoutMs });
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    logger.warn('[SessionManager] Disconnect request failed, continuing with cleanup:', error);
  }
  // Only a report of this request: a worker shutting down by itself (the
  // adapter sent `terminated` unasked) reports its own disconnect, which
  // says nothing about a detach that arrived as it went.
  const reported = proxyManager.getDetachResult();
  const report = reported?.trigger === 'detach' ? reported : undefined;
  if (report?.debuggeeExited) {
    return { fate: 'program-ended' };
  }
  if (report ? report.acknowledged : failure === undefined) {
    return { fate: 'released' };
  }
  const why = report?.error ?? failure ?? 'the debug adapter did not answer the detach';
  // The worker's and the client's own timeouts word the same expiry their
  // own ways; the answer states the bound.
  const reason = /timed out/i.test(why) ? noAnswerWithin(timeoutMs) : why;
  return { fate: 'unconfirmed', reason };
}
