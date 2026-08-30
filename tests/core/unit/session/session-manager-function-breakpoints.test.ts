/**
 * Function-breakpoint name resolution and by-name removal (issue #559).
 *
 * The session layer owns the name a function-breakpoint request addresses —
 * set_breakpoint and remove_breakpoint get the same answer from the same
 * policy, which is what makes a rewritten record removable under the name it
 * was created with (issue #550).
 *
 * A by-name removal deletes every match and re-sends the surviving set ONCE.
 * DAP setFunctionBreakpoints is replace-all for the whole session, so removing
 * N matches one at a time meant N replace-all round trips, N copies of any
 * live-sync warning, and a window in which the not-yet-deleted duplicates were
 * still armed in the debuggee.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DebugLanguage,
  GoAdapterPolicy,
  type AdapterPolicy
} from '@debugmcp/shared';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { SessionNotFoundError } from '../../../../src/errors/debug-errors.js';
import type { SessionStore } from '../../../../src/session/session-store.js';
import {
  createMockDependencies,
  createPausedSession,
  overridePolicy as overrideStorePolicy
} from './session-manager-test-utils.js';

describe('SessionManager - function breakpoint names (#559)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    sessionManager = new SessionManager(
      {
        logDirBase: '/tmp/test-sessions',
        defaultDapLaunchArgs: { stopOnEntry: true, justMyCode: true }
      },
      dependencies
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  /** Overlay policy hooks on the session store's lookup (shared recipe). */
  function overridePolicy(overrides: Partial<AdapterPolicy>): void {
    overrideStorePolicy(sessionManager, overrides);
  }

  function createSession() {
    return sessionManager.createSession({
      language: DebugLanguage.MOCK,
      executablePath: 'python'
    });
  }

  /** A session with a live, paused debuggee — the state that syncs to DAP. */
  function createLiveSession() {
    return createPausedSession(sessionManager, dependencies);
  }

  function functionBreakpointRequests() {
    return dependencies.mockProxyManager.dapRequestCalls.filter(
      (call) => call.command === 'setFunctionBreakpoints'
    );
  }

  function namesInRequest(index: number): string[] {
    const args = functionBreakpointRequests()[index]?.args as
      | { breakpoints?: Array<{ name: string }> }
      | undefined;
    return (args?.breakpoints ?? []).map((bp) => bp.name);
  }

  function storedFunctionNames(sessionId: string): string[] {
    return Array.from(sessionManager.getSession(sessionId)!.functionBreakpoints.values())
      .map((bp) => bp.functionName);
  }

  describe('removeFunctionBreakpointsByName', () => {
    it('removes every match with exactly ONE setFunctionBreakpoints request', async () => {
      const session = await createLiveSession();
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'compute' });
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'compute', condition: 'i > 2' });
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'compute' });
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'survivor' });
      dependencies.mockProxyManager.dapRequestCalls = [];

      const result = await sessionManager.removeFunctionBreakpointsByName(session.id, 'compute');

      expect(result.removed).toHaveLength(3);
      expect(result.functionName).toBe('compute');
      // The removal speaks the resolution's vocabulary: the caller's name
      // always, and `normalized` only when a rewrite happened — that, not a
      // missing requestedName, is what the response discloses on.
      expect(result.requestedName).toBe('compute');
      expect(result.normalized).toBeUndefined();
      // The whole point of the fix: three matches, one replace-all re-send,
      // and it already carries only the survivor — no window in which a
      // not-yet-deleted duplicate is still armed.
      expect(functionBreakpointRequests()).toHaveLength(1);
      expect(namesInRequest(0)).toEqual(['survivor']);
      expect(storedFunctionNames(session.id)).toEqual(['survivor']);
    });

    it('reports the matches in name order, not store insertion order', async () => {
      // Ordering is only observable when the literal and the rewritten name
      // both match, so this is the multi-match case with a rewrite.
      overridePolicy({
        normalizeFunctionBreakpointName: (name: string) =>
          name === 'main' ? { name: 'main.main', note: 'Auto-qualified to main.main' } : undefined
      });
      const session = await createLiveSession();
      // Stored normalized-first: the response must not leak that order. The
      // pre-#559 removal built its matches from listFunctionBreakpoints,
      // which sorts by functionName; this one sorts the same way.
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'main.main' });
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'main' });
      dependencies.mockProxyManager.dapRequestCalls = [];

      const result = await sessionManager.removeFunctionBreakpointsByName(session.id, 'main');

      expect(result.removed.map((bp) => bp.functionName)).toEqual(['main', 'main.main']);
      expect(functionBreakpointRequests()).toHaveLength(1);
      expect(storedFunctionNames(session.id)).toEqual([]);
    });

    it('logs one removal record per breakpoint', async () => {
      const session = await createLiveSession();
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'compute' });
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'compute' });

      await sessionManager.removeFunctionBreakpointsByName(session.id, 'compute');

      const removals = vi.mocked(dependencies.mockLogger.info).mock.calls.filter(
        ([message, meta]) =>
          message === 'debug:breakpoint' &&
          (meta as { event?: string; functionName?: string } | undefined)?.event === 'removed' &&
          (meta as { functionName?: string } | undefined)?.functionName === 'compute'
      );
      expect(removals).toHaveLength(2);
    });

    it('reports a failed live sync once, not once per match', async () => {
      const session = await createLiveSession();
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'compute' });
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'compute' });
      dependencies.mockProxyManager.shouldFailDapRequests = true;

      const result = await sessionManager.removeFunctionBreakpointsByName(session.id, 'compute');

      expect(result.removed).toHaveLength(2);
      expect(result.warning).toBe(
        'Breakpoint state updated, but live sync failed: Mock DAP request failure: setFunctionBreakpoints'
      );
      // The store is still the source of truth even when the wire fails.
      expect(storedFunctionNames(session.id)).toEqual([]);
    });

    it('removes nothing without touching the wire when no record matches', async () => {
      const session = await createLiveSession();
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'survivor' });
      dependencies.mockProxyManager.dapRequestCalls = [];

      const result = await sessionManager.removeFunctionBreakpointsByName(session.id, 'compute');

      expect(result.removed).toEqual([]);
      expect(functionBreakpointRequests()).toHaveLength(0);
      expect(storedFunctionNames(session.id)).toEqual(['survivor']);
    });

    it('names the requested and the normalized function when nothing matches', async () => {
      overridePolicy({
        normalizeFunctionBreakpointName: (name: string) =>
          name === 'main' ? { name: 'main.main', note: 'Auto-qualified to main.main' } : undefined
      });
      const session = await createSession();

      const result = await sessionManager.removeFunctionBreakpointsByName(session.id, 'main');

      expect(result.removed).toEqual([]);
      expect(result.functionName).toBe('main.main');
      expect(result.requestedName).toBe('main');
      expect(result.normalized).toEqual({ name: 'main.main', note: 'Auto-qualified to main.main' });
      // A rewrite explains itself; the advisory hint is for names that got none.
      expect(result.warning).toBeUndefined();
    });

    it('offers the policy hint when an un-rewritten name matches nothing', async () => {
      overridePolicy({
        functionBreakpointNameHint: (name: string) =>
          name.includes('.') ? undefined : `for func ${name} in package main use 'main.${name}'`
      });
      const session = await createSession();

      const result = await sessionManager.removeFunctionBreakpointsByName(session.id, 'compute');

      expect(result.removed).toEqual([]);
      expect(result.functionName).toBe('compute');
      expect(result.requestedName).toBe('compute');
      expect(result.normalized).toBeUndefined();
      expect(result.warning).toBe("for func compute in package main use 'main.compute'");
    });

    it('removes a record stored under the literal name the policy rewrites', async () => {
      overridePolicy({
        normalizeFunctionBreakpointName: (name: string) =>
          name === 'main' ? { name: 'main.main', note: 'Auto-qualified to main.main' } : undefined
      });
      const session = await createSession();
      // setFunctionBreakpoint stores the name it is given: resolution is the
      // caller's job, so a record can exist under the bare name.
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'main' });
      expect(storedFunctionNames(session.id)).toEqual(['main']);

      const result = await sessionManager.removeFunctionBreakpointsByName(session.id, 'main');

      expect(result.removed.map((bp) => bp.functionName)).toEqual(['main']);
      expect(result.functionName).toBe('main.main');
      expect(result.requestedName).toBe('main');
      expect(storedFunctionNames(session.id)).toEqual([]);
    });

    it('round-trips a bare Go name through the real GoAdapterPolicy (issue #550)', async () => {
      overridePolicy({
        normalizeFunctionBreakpointName: GoAdapterPolicy.normalizeFunctionBreakpointName,
        functionBreakpointNameHint: GoAdapterPolicy.functionBreakpointNameHint
      });
      const session = await createSession();
      const { effectiveName } = sessionManager.resolveFunctionBreakpointName(session.id, 'main');
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: effectiveName });
      expect(storedFunctionNames(session.id)).toEqual(['main.main']);

      const result = await sessionManager.removeFunctionBreakpointsByName(session.id, 'main');

      expect(result.removed.map((bp) => bp.functionName)).toEqual(['main.main']);
      expect(result.functionName).toBe('main.main');
      expect(result.requestedName).toBe('main');
      expect(storedFunctionNames(session.id)).toEqual([]);
    });
  });

  describe('resolveFunctionBreakpointName', () => {
    it('returns the requested name when the policy has nothing to say', async () => {
      const session = await createSession();

      const resolution = sessionManager.resolveFunctionBreakpointName(session.id, 'compute');

      expect(resolution.requestedName).toBe('compute');
      expect(resolution.effectiveName).toBe('compute');
      expect(resolution.normalized).toBeUndefined();
      expect(resolution.hint).toBeUndefined();
    });

    it('applies a policy-certain rewrite and drops the hint (issue #467)', async () => {
      overridePolicy({
        normalizeFunctionBreakpointName: (name: string) =>
          name === 'main' ? { name: 'main.main', note: 'Auto-qualified to main.main' } : undefined,
        functionBreakpointNameHint: (name: string) => `hint for ${name}`
      });
      const session = await createSession();

      const resolution = sessionManager.resolveFunctionBreakpointName(session.id, 'main');

      expect(resolution.effectiveName).toBe('main.main');
      expect(resolution.normalized).toEqual({
        name: 'main.main',
        note: 'Auto-qualified to main.main'
      });
      expect(resolution.hint).toBeUndefined();
    });

    it('throws for an unknown session id', () => {
      // Policy failures are swallowed; a missing session is not one of them —
      // the resolution reports it like every other entry point on the slice.
      expect(() =>
        sessionManager.resolveFunctionBreakpointName('no-such-session', 'main')
      ).toThrow(SessionNotFoundError);
    });

    it('swallows a policy lookup that throws', async () => {
      const session = await createSession();
      const store = (sessionManager as unknown as { sessionStore: SessionStore }).sessionStore;
      vi.spyOn(store, 'selectPolicy').mockImplementation(() => {
        throw new Error('policy lookup exploded');
      });

      const resolution = sessionManager.resolveFunctionBreakpointName(session.id, 'main');

      expect(resolution.effectiveName).toBe('main');
      expect(resolution.normalized).toBeUndefined();
      expect(resolution.hint).toBeUndefined();
    });

    it('swallows policy hooks that throw', async () => {
      overridePolicy({
        normalizeFunctionBreakpointName: () => {
          throw new Error('normalize exploded');
        },
        functionBreakpointNameHint: () => {
          throw new Error('hint exploded');
        }
      });
      const session = await createSession();

      const resolution = sessionManager.resolveFunctionBreakpointName(session.id, 'main');

      expect(resolution.effectiveName).toBe('main');
      expect(resolution.normalized).toBeUndefined();
      expect(resolution.hint).toBeUndefined();
    });
  });
});
