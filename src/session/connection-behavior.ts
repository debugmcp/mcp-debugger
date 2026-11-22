/**
 * The DAP client behaviour of the connection a session talks through
 * (issue #1211).
 *
 * An adapter policy describes a language's adapter. One part of it describes
 * a connection instead: `getDapClientBehavior()`. js-debug's root connection
 * adopts the program itself as an in-session child, routes commands to it and
 * mirrors breakpoints to it, so its own answers are provisional (issues #495,
 * #500). Every other connection of the same worker (the program's target, an
 * adopted fork, a grandchild) runs the child-safe derivative of the policy
 * (`createChildSafePolicy`, the function the worker builds those clients
 * with): no in-session adoption, no routing, no mirroring. There the
 * adapter's answers are the truth for that process.
 *
 * An adopted child is a session whose connection is one of those. Reading
 * its language's policy gives the ROOT connection's behaviour, and a child
 * was treated as a launch root that way: its breakpoints never received the
 * adapter's ids, and one that bound on another line stayed unverified after
 * it had paused the child. So the session and server layers read client
 * behaviour through this function and nowhere else
 * (`tests/unit/architecture/connection-behaviour-seam.test.ts`), and
 * `tests/unit/proxy/child-safe-policy.test.ts` pins that the derivative
 * changes nothing but that behaviour and the in-session adoption flags,
 * which those layers never read.
 *
 * For an adapter that adopts nothing in-session (debugpy and every other
 * one today) the derivative is the policy itself, and this is its behaviour.
 */
import type { AdapterPolicy, DapClientBehavior } from '@debugmcp/shared';
import { createChildSafePolicy } from '../proxy/child-safe-policy.js';
import type { ManagedSession } from './session-store.js';

export function connectionBehaviorOf(
  session: Pick<ManagedSession, 'parentSessionId'>,
  policy: AdapterPolicy | undefined
): Partial<DapClientBehavior> {
  if (!policy) {
    return {};
  }
  const own = session.parentSessionId !== undefined ? createChildSafePolicy(policy) : policy;
  return own.getDapClientBehavior?.() ?? {};
}
