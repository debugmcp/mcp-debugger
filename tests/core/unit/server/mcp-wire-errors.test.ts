/**
 * Protocol errors as an SDK client sees them (issue #659).
 *
 * The SDK's Protocol copies a thrown error's `.message` verbatim into the
 * JSON-RPC error. With the v1 SDK the client-side constructor prefixed
 * `MCP error <code>: ` again, so an error thrown from a request handler used
 * to reach clients doubled; the v2 SDK's client adds nothing. These tests
 * drive the real handlers through a real Server/Client pair over the SDK's
 * in-memory transport and pin the exact client-side message: the reason,
 * once, with the code beside it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Server, InMemoryTransport, ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/server';
import { Client } from '@modelcontextprotocol/client';
import { registerToolHandlers } from '../../../../src/server/tool-dispatch.js';
import { registerPromptHandlers } from '../../../../src/server/prompts.js';
import { registerResourceHandlers } from '../../../../src/server/output-resources.js';
import type { ToolContext } from '../../../../src/server/tool-context.js';
import type { SessionManager } from '../../../../src/session/session-manager.js';
import type { ResourceSubscriptions } from '../../../../src/server/output-resources.js';
import { SessionNotFoundError } from '../../../../src/errors/debug-errors.js';

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
    validateSession: (sessionId: string) => {
      throw new SessionNotFoundError(sessionId);
    },
    ...overrides
  } as unknown as ToolContext;
}

async function connect(server: Server): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'wire-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

async function caught(promise: Promise<unknown>): Promise<ProtocolError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ProtocolError);
    return error as ProtocolError;
  }
  throw new Error('expected the request to be rejected');
}

describe('protocol errors reach SDK clients as the bare reason, with the code beside it', () => {
  let server: Server;
  let client: Client;

  beforeEach(() => {
    server = new Server(
      { name: 'wire-test-server', version: '0.0.0' },
      { capabilities: { tools: {}, prompts: {}, resources: { subscribe: true } } }
    );
  });

  afterEach(async () => {
    await client?.close();
    await server.close();
  });

  it('argument validation (tools/call)', async () => {
    registerToolHandlers(server, fakeContext());
    client = await connect(server);

    const error = await caught(client.callTool({ name: 'set_breakpoint', arguments: { file: '/x.py', line: 1 } }));
    expect(error.code).toBe(ProtocolErrorCode.InvalidParams);
    expect(error.message).toBe('Missing required parameter: sessionId');
  });

  it('a handler rejection that is not an McpError is wrapped once as InternalError', async () => {
    registerToolHandlers(
      server,
      fakeContext({
        getAdapterRegistry: () => {
          throw new Error('registry exploded');
        }
      })
    );
    client = await connect(server);

    const error = await caught(client.callTool({ name: 'list_supported_languages', arguments: {} }));
    expect(error.code).toBe(ProtocolErrorCode.InternalError);
    expect(error.message).toBe('Failed to list supported languages: registry exploded');
  });

  it('an unknown tool', async () => {
    registerToolHandlers(server, fakeContext());
    client = await connect(server);

    const error = await caught(client.callTool({ name: 'no_such_tool', arguments: {} }));
    expect(error.code).toBe(ProtocolErrorCode.MethodNotFound);
    expect(error.message).toBe('Unknown tool: no_such_tool');
  });

  it('an unknown prompt', async () => {
    registerPromptHandlers(server, environment);
    client = await connect(server);

    const error = await caught(client.getPrompt({ name: 'nope' }));
    expect(error.code).toBe(ProtocolErrorCode.InvalidParams);
    expect(error.message).toBe('Unknown prompt: nope');
  });

  it('an unknown resource (read and subscribe)', async () => {
    const sessionManager = {
      getAllSessions: () => [],
      getSessionsVisibleTo: () => [],
      getSession: () => undefined,
      isSessionVisibleTo: () => false
    } as unknown as SessionManager;
    const notifier: ResourceSubscriptions = { subscribe: vi.fn(), unsubscribe: vi.fn() };
    registerResourceHandlers(server, sessionManager, notifier, { readTail: vi.fn() });
    client = await connect(server);

    const uri = 'debug://sessions/ghost/output';
    for (const request of [client.readResource({ uri }), client.subscribeResource({ uri })]) {
      const error = await caught(request);
      expect(error.code).toBe(ProtocolErrorCode.InvalidParams);
      expect(error.message).toBe(`Unknown resource: ${uri}`);
      // SEP-2164: the error names the URI that was asked for, in its data
      // (a SHOULD; the conformance suite's sep-2164-data-uri check).
      expect(error.data).toEqual({ uri });
    }
  });
});
