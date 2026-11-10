/**
 * The owner-key seam (issue #1025, step 2): the one place that turns a
 * request's identity into the scope a debug session belongs to. With no
 * authentication in front of the server every request is in the shared
 * anonymous scope, which is today's single-tenant behaviour; an authenticated
 * principal scopes its sessions to itself with no tool-schema change.
 */
import { describe, expect, it } from 'vitest';
import { ownerKeyOf, visibleTo } from '../../../../src/server/owner-key.js';

describe('ownerKeyOf', () => {
  it('is the authenticated principal when the request carried one', () => {
    expect(ownerKeyOf({ http: { authInfo: { clientId: 'agent-a', token: 't', scopes: [] } } })).toBe('agent-a');
  });

  it('is the shared anonymous scope when nothing authenticated the request', () => {
    expect(ownerKeyOf(undefined)).toBeUndefined();
    expect(ownerKeyOf({})).toBeUndefined();
    expect(ownerKeyOf({ http: {} })).toBeUndefined();
    expect(ownerKeyOf({ http: { authInfo: { clientId: '', token: 't', scopes: [] } } })).toBeUndefined();
  });
});

describe('visibleTo', () => {
  it('a session is visible to callers in its own scope only', () => {
    expect(visibleTo('agent-a', 'agent-a')).toBe(true);
    expect(visibleTo('agent-a', 'agent-b')).toBe(false);
    expect(visibleTo('agent-a', undefined)).toBe(false);
    expect(visibleTo(undefined, 'agent-a')).toBe(false);
  });

  it('the anonymous scope is a scope of its own', () => {
    expect(visibleTo(undefined, undefined)).toBe(true);
  });
});
