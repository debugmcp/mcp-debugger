/**
 * A session id another DebugMcpServer in this process owns answers with that
 * fact, whatever tool named it (issue #939). Streamable HTTP runs one server
 * per MCP client session; before this gate every tool said a plain
 * `Session not found` — or `Failed to close debug session`, or a protocol
 * error from hot_reload — and the caller read "gone" while the program
 * kept running under a client it could not reach. The gate sits in the
 * tools/call dispatch, in front of every handler, consulting the hook the
 * HTTP layer injects (`describeForeignSession`); a server without the hook
 * (stdio, SSE) dispatches exactly as before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerToolHandlers } from '../../../../src/server/tool-dispatch.js';
import type { ToolContext } from '../../../../src/server/tool-context.js';
import { SessionNotFoundError } from '../../../../src/errors/debug-errors.js';

const FOREIGN_ID = 'dbg-other';
const EXPLANATION = `Session ${FOREIGN_ID} belongs to another MCP client session: each Streamable HTTP client sees only the debug sessions it created.`;

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
    sessionManager: { getSession: vi.fn(() => undefined) },
    describeForeignSession: vi.fn((sessionId: string) => (sessionId === FOREIGN_ID ? EXPLANATION : undefined)),
    validateSession: (sessionId: string) => {
      throw new SessionNotFoundError(sessionId);
    },
    closeDebugSession: vi.fn(async () => false),
    outputResources: { forgetSession: vi.fn(), notifyListChanged: vi.fn() },
    ...overrides
  } as unknown as ToolContext;
}

async function connect(server: Server): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'foreign-session-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

async function answer(client: Client, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const raw = await client.callTool({ name, arguments: args });
  const text = (raw.content as Array<{ type: string; text?: string }>)[0]?.text;
  return JSON.parse(text!) as Record<string, unknown>;
}

describe('tools/call on a session id another server owns (issue #939)', () => {
  let server: Server;
  let client: Client;

  beforeEach(() => {
    server = new Server({ name: 'foreign-session-server', version: '0.0.0' }, { capabilities: { tools: {} } });
  });

  afterEach(async () => {
    await client?.close();
    await server.close();
  });

  it('close_debug_session answers the explanation and never reaches the handler', async () => {
    const ctx = fakeContext();
    registerToolHandlers(server, ctx);
    client = await connect(server);

    expect(await answer(client, 'close_debug_session', { sessionId: FOREIGN_ID })).toEqual({ success: false, error: EXPLANATION });
    expect(ctx.closeDebugSession).not.toHaveBeenCalled();
  });

  it.each(['step_over', 'get_output', 'wait_for_stop'])('%s answers the explanation instead of its own "not found"', async (tool) => {
    registerToolHandlers(server, fakeContext());
    client = await connect(server);

    expect(await answer(client, tool, { sessionId: FOREIGN_ID })).toEqual({ success: false, error: EXPLANATION });
  });

  it('hot_reload answers the explanation instead of a protocol error', async () => {
    registerToolHandlers(server, fakeContext());
    client = await connect(server);

    expect(await answer(client, 'hot_reload', { sessionId: FOREIGN_ID, classesDir: '/classes' }))
      .toEqual({ success: false, error: EXPLANATION });
  });

  it('an id nobody holds keeps the tool\'s own wording', async () => {
    const ctx = fakeContext();
    registerToolHandlers(server, ctx);
    client = await connect(server);

    expect(await answer(client, 'close_debug_session', { sessionId: 'dbg-nobody' }))
      .toEqual({ success: false, message: 'Failed to close debug session: dbg-nobody' });
    expect(ctx.describeForeignSession).toHaveBeenCalledWith('dbg-nobody');
  });

  it('a session this server holds is dispatched without consulting the other servers', async () => {
    const ctx = fakeContext({
      sessionManager: { getSession: vi.fn(() => ({ id: FOREIGN_ID })) } as unknown as ToolContext['sessionManager'],
      closeDebugSession: vi.fn(async () => true)
    });
    registerToolHandlers(server, ctx);
    client = await connect(server);

    expect(await answer(client, 'close_debug_session', { sessionId: FOREIGN_ID })).toMatchObject({ success: true });
    expect(ctx.describeForeignSession).not.toHaveBeenCalled();
    expect(ctx.closeDebugSession).toHaveBeenCalledWith(FOREIGN_ID);
  });

  it('a stray sessionId on a tool whose schema has none (create_debug_session) is never gated', async () => {
    // The SDK does not validate arguments against inputSchema, so an agent
    // carrying a stale id across MCP sessions can send it anywhere; the one
    // tool that must always work must not be refused for it.
    const ctx = fakeContext({
      // The launch-toolchain probe fails open when it cannot probe (no registry).
      getAdapterRegistry: () => undefined,
      createDebugSession: vi.fn(async () => ({ id: 'dbg-new', name: 'fresh', language: 'mock', state: 'created' }))
    } as unknown as Partial<ToolContext>);
    registerToolHandlers(server, ctx);
    client = await connect(server);

    expect(await answer(client, 'create_debug_session', { language: 'mock', sessionId: FOREIGN_ID }))
      .toMatchObject({ success: true, sessionId: 'dbg-new' });
    expect(ctx.describeForeignSession).not.toHaveBeenCalled();
  });

  it('a server without the hook (stdio, SSE) dispatches as before', async () => {
    const ctx = fakeContext({ describeForeignSession: undefined });
    registerToolHandlers(server, ctx);
    client = await connect(server);

    expect(await answer(client, 'close_debug_session', { sessionId: FOREIGN_ID }))
      .toEqual({ success: false, message: `Failed to close debug session: ${FOREIGN_ID}` });
    expect(ctx.closeDebugSession).toHaveBeenCalledWith(FOREIGN_ID);
  });
});
