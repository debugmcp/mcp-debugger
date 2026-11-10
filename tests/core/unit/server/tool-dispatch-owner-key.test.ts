/**
 * The owner-key gate in the tools/call dispatch (issue #1025, step 2). It
 * replaces the #939 foreign-session refusal: with one shared core per process
 * there is no "other server", only scopes. A session outside the caller's
 * scope answers exactly as an unknown id would, so nothing about its existence
 * leaks; a session in scope reaches its handler untouched. The caller's scope
 * is read off the SDK request context (`ctx.http.authInfo`); with no
 * authentication configured every caller is anonymous and sees everything, as
 * before. Decided in front of every handler so all tools say it the same way;
 * only tools whose schema takes a `sessionId` are gated, and
 * `create_debug_session` is never refused — it stamps the caller's scope.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerToolHandlers } from '../../../../src/server/tool-dispatch.js';
import type { ToolContext } from '../../../../src/server/tool-context.js';
import { SessionNotFoundError } from '../../../../src/errors/debug-errors.js';

// create_debug_session's launch-toolchain gate probes the adapter registry;
// this suite is about the dispatch, so the gate answers "available".
vi.mock('../../../../src/utils/language-availability.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/language-availability.js')>()),
  checkLaunchToolchain: vi.fn(async () => ({ available: true }))
}));

const OWN = 'dbg-own';
const FOREIGN = 'dbg-foreign';

const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
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
      touchActivity: vi.fn()
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

  it('close_debug_session answers exactly as an unknown id and never reaches the handler', async () => {
    const ctx = fakeContext();
    const call = dispatcher(ctx);

    const result = await answer(call, 'close_debug_session', { sessionId: FOREIGN }, 'agent-a');

    expect(result).toEqual({ success: false, error: `Session not found: ${FOREIGN}` });
    expect(ctx.closeDebugSession).not.toHaveBeenCalled();
  });

  it.each(['step_over', 'get_output', 'wait_for_stop'])('%s answers the same way', async (tool) => {
    const call = dispatcher(fakeContext());

    const result = await answer(call, tool, { sessionId: FOREIGN }, 'agent-a');

    expect(result).toEqual({ success: false, error: `Session not found: ${FOREIGN}` });
  });

  it('hot_reload answers the same way instead of its own protocol error', async () => {
    const call = dispatcher(fakeContext());

    const result = await answer(call, 'hot_reload', { sessionId: FOREIGN, classesDir: '/classes' }, 'agent-a');

    expect(result).toEqual({ success: false, error: `Session not found: ${FOREIGN}` });
  });

  it('an anonymous caller does not see a keyed session', async () => {
    const ctx = fakeContext();
    const call = dispatcher(ctx);

    const result = await answer(call, 'close_debug_session', { sessionId: OWN });

    expect(result).toEqual({ success: false, error: `Session not found: ${OWN}` });
    expect(ctx.closeDebugSession).not.toHaveBeenCalled();
  });

  it('a session in the caller scope reaches its handler and refreshes its activity clock', async () => {
    const ctx = fakeContext();
    const call = dispatcher(ctx);

    const result = await answer(call, 'close_debug_session', { sessionId: OWN }, 'agent-a');

    expect(result).toMatchObject({ success: true });
    expect(ctx.closeDebugSession).toHaveBeenCalledWith(OWN);
    expect(ctx.sessionManager.touchActivity).toHaveBeenCalledWith(OWN);
  });

  it('an id nobody holds passes through to the handler, which answers its own not-found', async () => {
    const ctx = fakeContext();
    const call = dispatcher(ctx);

    const result = await answer(call, 'close_debug_session', { sessionId: 'dbg-nobody' }, 'agent-a');

    expect(result).toEqual({ success: false, message: 'Failed to close debug session: dbg-nobody' });
    expect(ctx.closeDebugSession).toHaveBeenCalledWith('dbg-nobody');
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
        touchActivity: vi.fn()
      } as unknown as ToolContext['sessionManager']
    });
    const call = dispatcher(ctx);

    const raw = await call({ method: 'tools/call', params: { name: 'close_debug_session', arguments: { sessionId: OWN } } });

    expect(JSON.parse(raw.content[0].text!)).toMatchObject({ success: true });
    expect(ctx.sessionManager.isSessionVisibleTo).toHaveBeenCalledWith(OWN, undefined);
  });
});
