/**
 * Protocol errors as an SDK client sees them (issue #659).
 *
 * The SDK's Protocol copies a thrown error's `.message` verbatim into the
 * JSON-RPC error and the client-side McpError constructor prefixes
 * `MCP error <code>: ` again, so an McpError thrown from a request handler
 * used to reach clients doubled. These tests drive the real handlers through
 * a real Server/Client pair over the SDK's in-memory transport and pin the
 * exact client-side message: one prefix, then the reason.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpError, ErrorCode as McpErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { registerToolHandlers } from '../../../../src/server/tool-dispatch.js';
import { registerPromptHandlers } from '../../../../src/server/prompts.js';
import { registerResourceHandlers } from '../../../../src/server/output-resources.js';
import type { ToolContext } from '../../../../src/server/tool-context.js';
import type { SessionManager } from '../../../../src/session/session-manager.js';
import type { OutputResourceNotifier } from '../../../../src/server/output-resources.js';
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

async function caught(promise: Promise<unknown>): Promise<McpError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(McpError);
    return error as McpError;
  }
  throw new Error('expected the request to be rejected');
}

describe('protocol errors reach SDK clients with a single MCP error prefix', () => {
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
    expect(error.code).toBe(McpErrorCode.InvalidParams);
    expect(error.message).toBe(`MCP error ${McpErrorCode.InvalidParams}: Missing required parameter: sessionId`);
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
    expect(error.code).toBe(McpErrorCode.InternalError);
    expect(error.message).toBe(
      `MCP error ${McpErrorCode.InternalError}: Failed to list supported languages: registry exploded`
    );
  });

  it('an unknown tool', async () => {
    registerToolHandlers(server, fakeContext());
    client = await connect(server);

    const error = await caught(client.callTool({ name: 'no_such_tool', arguments: {} }));
    expect(error.code).toBe(McpErrorCode.MethodNotFound);
    expect(error.message).toBe(`MCP error ${McpErrorCode.MethodNotFound}: Unknown tool: no_such_tool`);
  });

  it('an unknown prompt', async () => {
    registerPromptHandlers(server, environment);
    client = await connect(server);

    const error = await caught(client.getPrompt({ name: 'nope' }));
    expect(error.code).toBe(McpErrorCode.InvalidParams);
    expect(error.message).toBe(`MCP error ${McpErrorCode.InvalidParams}: Unknown prompt: nope`);
  });

  it('an unknown resource (read and subscribe)', async () => {
    const sessionManager = {
      getAllSessions: () => [],
      getSession: () => undefined
    } as unknown as SessionManager;
    const notifier = { subscribe: vi.fn(), unsubscribe: vi.fn() } as unknown as OutputResourceNotifier;
    registerResourceHandlers(server, sessionManager, notifier, { readTail: vi.fn() });
    client = await connect(server);

    const uri = 'debug://sessions/ghost/output';
    for (const request of [client.readResource({ uri }), client.subscribeResource({ uri })]) {
      const error = await caught(request);
      expect(error.code).toBe(McpErrorCode.InvalidParams);
      expect(error.message).toBe(`MCP error ${McpErrorCode.InvalidParams}: Unknown resource: ${uri}`);
    }
  });
});
