/**
 * The owner-key seam (issue #1025, step 2).
 *
 * Debug-session ownership is server-side and never a tool parameter ("the
 * handle is the capability", decided on #1025). Isolation in the sessionless
 * 2026-07-28 era is a view keyed by a per-request identity, and the protocol's
 * identity is the authenticated principal: this module turns an SDK request
 * context into that key. With no authentication in front of the server every
 * request is in the shared anonymous scope — one process is single-tenant,
 * one process per agent is the isolation — and nothing changes for today's
 * users. When an authenticated `http` mode exists, each principal sees only
 * its own sessions with no tool-schema change.
 *
 * The principal claim is `authInfo.clientId`; a deployment that keys on
 * another claim changes this one function.
 */

import type { AuthInfo } from '@modelcontextprotocol/server';

/** A debug session's scope: an authenticated principal, or `undefined` for the shared anonymous scope. */
export type OwnerKey = string | undefined;

/** The slice of the SDK's request context the seam reads. */
export interface OwnerKeySource {
  http?: {
    authInfo?: Partial<AuthInfo>;
  };
}

/** The scope a request acts in. An empty principal counts as anonymous. */
export function ownerKeyOf(callCtx: OwnerKeySource | undefined): OwnerKey {
  const clientId = callCtx?.http?.authInfo?.clientId;
  return clientId ? clientId : undefined;
}

/** Whether a session in `ownerKey`'s scope is visible to a caller in `callerKey`'s. */
export function visibleTo(ownerKey: OwnerKey, callerKey: OwnerKey): boolean {
  return ownerKey === callerKey;
}
