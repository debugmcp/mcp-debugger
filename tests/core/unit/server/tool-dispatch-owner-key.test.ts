/**
 * The owner-key gate in the tools/call dispatch (issue #1025, step 2). It
 * replaces the #939 foreign-session refusal: with one shared core per process
 * there is no "other server", only scopes. For a caller, a session outside
 * its scope does not exist, so the dispatch gives no answer of its own: it
 * runs the call with that session hidden from every lookup and the tool's
 * handler answers as it answers an unknown id. That equivalence is pinned,
 * tool by tool over the real session store, in owner-scope-contract.test.ts;
 * this suite pins the dispatch's own mechanics over a fake context — which
 * calls run hidden, which refresh the idle clock, and that
 * `create_debug_session` is never gated and stamps the caller's scope. The
 * caller's scope is read off the SDK request context (`ctx.http.authInfo`);
 * with no authentication configured every caller is anonymous and sees
 * everything, as before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerToolHandlers } from '../../../../src/server/tool-dispatch.js';
import type { ToolContext } from '../../../../src/server/tool-context.js';
import { SessionNotFoundError } from '../../../../src/errors/debug-errors.js';
import { isSessionHidden } from '../../../../src/session/session-scope.js';

// create_debug_session's launch-toolchain gate probes the adapter registry;
// this suite is about the dispatch, so the gate answers "available".
vi.mock('../../../../src/utils/language-availability.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/language-availability.js')>()),
  checkLaunchToolchain: vi.fn(async () => ({ available: true }))
}));

const OWN = 'dbg-own';
const FOREIGN = 'dbg-foreign';

const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
/** What `holdForCall` hands back: the release the dispatch calls when the call answers (issue #1127). */
const releaseHold = vi.fn();
const environment = {
  get: (): string | undefined => undefined,
  getAll: () => ({}),
  getCurrentWorkingDirectory: () => '/'
};

function fakeContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    logger,
    environment,
    getSessionName: () => 'sess',
    getSupportedLanguagesAsync: async () => ['mock'],
    getAdapterRegistry: () => ({}),
    validationCache: {},
    sessionManager: {
      getSession: vi.fn((id: string) => (id === OWN || id === FOREIGN ? { id } : undefined)),
      // OWN belongs to agent-a, FOREIGN to agent-b; the anonymous scope owns nothing here.
      isSessionVisibleTo: vi.fn((id: string, key: string | undefined) =>
        id === OWN ? key === 'agent-a' : id === FOREIGN ? key === 'agent-b' : false),
      getSessionsVisibleTo: vi.fn(() => []),
      idleExpiryOf: vi.fn(() => undefined),
      holdForCall: vi.fn(() => releaseHold),
      idleCloseInFlight: vi.fn((): Promise<void> | undefined => undefined)
    },
    validateSession: (sessionId: string) => {
      throw new SessionNotFoundError(sessionId);
    },
    closeDebugSession: vi.fn(async (id: string) => ({ closed: id === OWN, closedSessionIds: id === OWN ? [OWN] : [] })),
    createDebugSession: vi.fn(async () => ({ id: 'dbg-new', name: 'new', language: 'mock', state: 'created', createdAt: new Date() })),
    notifications: { forgetUri: vi.fn(), resourcesChanged: vi.fn() },
    ...overrides
  } as unknown as ToolContext;
}

type CallTool = (request: unknown, callCtx?: unknown) => Promise<{ content: Array<{ type: string; text?: string }> }>;

function dispatcher(ctx: ToolContext): CallTool {
  let call: CallTool | undefined;
  const recorder = {
    setRequestHandler: vi.fn((method: string, handler: unknown) => {
      if (method === 'tools/call') {
        call = handler as CallTool;
      }
    })
  };
  registerToolHandlers(recorder as unknown as Parameters<typeof registerToolHandlers>[0], ctx);
  if (!call) {
    throw new Error('tools/call handler not registered');
  }
  return call;
}

/** The SDK's per-request context: an authenticated caller carries authInfo; an anonymous one carries none. */
const callCtxFor = (clientId?: string) => ({
  mcpReq: { signal: new AbortController().signal },
  ...(clientId !== undefined ? { http: { authInfo: { clientId, token: 't', scopes: [] } } } : {})
});

async function answer(call: CallTool, name: string, args: Record<string, unknown>, clientId?: string): Promise<Record<string, unknown>> {
  const raw = await call({ method: 'tools/call', params: { name, arguments: args } }, callCtxFor(clientId));
  return JSON.parse(raw.content[0].text!) as Record<string, unknown>;
}

describe('tools/call on a session outside the caller scope (issue #1025, step 2)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  /** A context whose close handler records whether the dispatch hid the session it was asked about. */
  function contextRecordingScope(): { ctx: ToolContext; hiddenAtHandler: () => boolean | undefined } {
    let hidden: boolean | undefined;
    const ctx = fakeContext({
      closeDebugSession: vi.fn(async (id: string) => {
        hidden = isSessionHidden(id);
        return { closed: false, closedSessionIds: [] };
      })
    } as unknown as Partial<ToolContext>);
    return { ctx, hiddenAtHandler: () => hidden };
  }

  it('a session outside the caller scope is hidden for the whole call: the handler runs and answers for itself', async () => {
    const { ctx, hiddenAtHandler } = contextRecordingScope();

    const result = await answer(dispatcher(ctx), 'close_debug_session', { sessionId: FOREIGN }, 'agent-a');

    // The handler's own not-found answer, not a sentence of the dispatch's.
    expect(result).toEqual({ success: false, message: `Failed to close debug session: ${FOREIGN}` });
    expect(hiddenAtHandler()).toBe(true);
    expect(isSessionHidden(FOREIGN)).toBe(false);
  });

  it('a call on a session outside the caller scope refreshes no idle clock', async () => {
    const ctx = fakeContext();

    await answer(dispatcher(ctx), 'close_debug_session', { sessionId: FOREIGN }, 'agent-a');

    // It neither stamps nor holds the tree against the idle policy, nor waits on a close of it (issue #1127).
    expect(ctx.sessionManager.holdForCall).not.toHaveBeenCalled();
    expect(ctx.sessionManager.idleCloseInFlight).not.toHaveBeenCalled();
  });

  it('an anonymous caller does not see a keyed session', async () => {
    const { ctx, hiddenAtHandler } = contextRecordingScope();

    await answer(dispatcher(ctx), 'close_debug_session', { sessionId: OWN });

    expect(hiddenAtHandler()).toBe(true);
    expect(ctx.sessionManager.holdForCall).not.toHaveBeenCalled();
  });

  it('a session in the caller scope is not hidden from its own call', async () => {
    const { ctx, hiddenAtHandler } = contextRecordingScope();

    await answer(dispatcher(ctx), 'close_debug_session', { sessionId: OWN }, 'agent-a');

    expect(hiddenAtHandler()).toBe(false);
  });

  it('a session in the caller scope reaches its handler and refreshes its activity clock', async () => {
    const ctx = fakeContext();
    const call = dispatcher(ctx);

    const result = await answer(call, 'close_debug_session', { sessionId: OWN }, 'agent-a');

    expect(result).toMatchObject({ success: true });
    expect(ctx.closeDebugSession).toHaveBeenCalledWith(OWN);
    expect(ctx.sessionManager.holdForCall).toHaveBeenCalledWith(OWN);
  });

  it('a session in the caller scope is held against the idle policy until its call answers, then its clock restarts (issue #1127)', async () => {
    let heldAtHandler: boolean | undefined;
    const ctx = fakeContext({
      closeDebugSession: vi.fn(async (id: string) => {
        heldAtHandler = vi.mocked(ctx.sessionManager.holdForCall).mock.calls.length === 1 && releaseHold.mock.calls.length === 0;
        return { closed: true, closedSessionIds: [id] };
      })
    } as unknown as Partial<ToolContext>);

    await answer(dispatcher(ctx), 'close_debug_session', { sessionId: OWN }, 'agent-a');

    expect(heldAtHandler).toBe(true);
    expect(ctx.sessionManager.holdForCall).toHaveBeenCalledWith(OWN);
    // The release is what restarts the clock (SessionManagerCore.holdForCall).
    expect(releaseHold).toHaveBeenCalledTimes(1);
    // A close of the tree in flight is asked about with the caller's key: only its scope waits.
    expect(ctx.sessionManager.idleCloseInFlight).toHaveBeenCalledWith(OWN, 'agent-a');
  });

  it('the hold is released when the handler throws', async () => {
    const ctx = fakeContext({
      closeDebugSession: vi.fn(async () => {
        throw new Error('boom');
      })
    } as unknown as Partial<ToolContext>);

    await dispatcher(ctx)({ method: 'tools/call', params: { name: 'close_debug_session', arguments: { sessionId: OWN } } }, callCtxFor('agent-a')).catch(() => undefined);

    expect(ctx.sessionManager.holdForCall).toHaveBeenCalledWith(OWN);
    expect(releaseHold).toHaveBeenCalledTimes(1);
  });

  it('waits once for a close of the tree that is in flight, then goes on: a mark that outlived its close cannot hang the call', async () => {
    const over = Promise.resolve();
    const ctx = fakeContext();
    // The mark never clears: the dispatch must not wait for the same close twice.
    vi.mocked(ctx.sessionManager.idleCloseInFlight).mockReturnValue(over);

    const result = await answer(dispatcher(ctx), 'close_debug_session', { sessionId: OWN }, 'agent-a');

    expect(result).toMatchObject({ success: true });
    expect(ctx.sessionManager.holdForCall).toHaveBeenCalledWith(OWN);
  });

  it('waits again when a second close of the tree started while it waited for the first', async () => {
    const first = Promise.resolve();
    const second = Promise.resolve();
    const ctx = fakeContext();
    vi.mocked(ctx.sessionManager.idleCloseInFlight)
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
      .mockReturnValue(undefined);

    await answer(dispatcher(ctx), 'close_debug_session', { sessionId: OWN }, 'agent-a');

    // Asked until no close is in flight: the hold is taken in the turn that saw none.
    expect(ctx.sessionManager.idleCloseInFlight).toHaveBeenCalledTimes(3);
    expect(ctx.sessionManager.holdForCall).toHaveBeenCalledTimes(1);
  });

  it('an id nobody holds passes through to the handler, which answers its own not-found', async () => {
    const ctx = fakeContext();
    const call = dispatcher(ctx);

    const result = await answer(call, 'close_debug_session', { sessionId: 'dbg-nobody' }, 'agent-a');

    expect(result).toEqual({ success: false, message: 'Failed to close debug session: dbg-nobody' });
    expect(ctx.closeDebugSession).toHaveBeenCalledWith('dbg-nobody');
  });

  it('a stray sessionId on a tool whose schema takes none refreshes nothing', async () => {
    const ctx = fakeContext();
    const call = dispatcher(ctx);

    const result = await answer(call, 'list_debug_sessions', { sessionId: FOREIGN }, 'agent-a');

    expect(result).toMatchObject({ success: true });
    expect(ctx.sessionManager.holdForCall).not.toHaveBeenCalled();
  });

  it("a stray sessionId the caller DOES own, on a tool that takes none, holds nothing either: the tool's schema decides", async () => {
    const ctx = fakeContext();

    const result = await answer(dispatcher(ctx), 'list_debug_sessions', { sessionId: OWN }, 'agent-a');

    expect(result).toMatchObject({ success: true });
    expect(ctx.sessionManager.holdForCall).not.toHaveBeenCalled();
    expect(ctx.sessionManager.idleCloseInFlight).not.toHaveBeenCalled();
  });

  it('create_debug_session is never gated and stamps the caller scope on the new session', async () => {
    const ctx = fakeContext();
    const call = dispatcher(ctx);

    const result = await answer(call, 'create_debug_session', { language: 'mock', sessionId: FOREIGN }, 'agent-a');

    expect(result).toMatchObject({ success: true, sessionId: 'dbg-new' });
    expect(ctx.createDebugSession).toHaveBeenCalledWith(expect.objectContaining({ language: 'mock', ownerKey: 'agent-a' }));
  });

  it('an anonymous create_debug_session carries no key at all', async () => {
    const ctx = fakeContext();
    const call = dispatcher(ctx);

    await answer(call, 'create_debug_session', { language: 'mock' });

    const params = vi.mocked(ctx.createDebugSession).mock.calls[0][0] as Record<string, unknown>;
    expect(params).not.toHaveProperty('ownerKey');
  });

  it('with no request context at all (the unit suites), every session is in scope', async () => {
    const ctx = fakeContext({
      sessionManager: {
        getSession: vi.fn(() => ({ id: OWN })),
        isSessionVisibleTo: vi.fn(() => true),
        holdForCall: vi.fn(() => releaseHold),
        idleCloseInFlight: vi.fn((): Promise<void> | undefined => undefined)
      } as unknown as ToolContext['sessionManager']
    });
    const call = dispatcher(ctx);

    const raw = await call({ method: 'tools/call', params: { name: 'close_debug_session', arguments: { sessionId: OWN } } });

    expect(JSON.parse(raw.content[0].text!)).toMatchObject({ success: true });
    expect(ctx.sessionManager.isSessionVisibleTo).toHaveBeenCalledWith(OWN, undefined);
  });
});
