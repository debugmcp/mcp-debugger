/**
 * The dev proxy's client-facing server behind the SDK's stdio entry (issue
 * #1025, step 2, PR 5), in process over the in-memory transport. `serveStdio`
 * pins one front instance per connection in whichever era the client opens;
 * the front's handlers forward to the backend, answer the dev tools locally,
 * and the relay target (`current()`) follows the pinned instance so backend
 * notifications reach the client in the era it speaks.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import { Client } from '@modelcontextprotocol/client';
import { createFront } from '../../../tools/dev-proxy/front-server.mjs';

const URI = 'debug://sessions/sess-1/output';
const DEV_TOOLS = [{ name: 'dev_server_status', description: 'status', inputSchema: { type: 'object', properties: {} } }];

function fakeBackend(overrides: Record<string, unknown> = {}) {
  const mcpClient = {
    listTools: vi.fn(async () => ({ tools: [{ name: 'backend_tool', description: 'from the backend', inputSchema: { type: 'object', properties: {} } }] })),
    listResources: vi.fn(async () => ({ resources: [{ uri: URI, name: 'out' }] })),
    readResource: vi.fn(async (params: { uri: string }) => ({ contents: [{ uri: params.uri, text: 'hello' }] })),
  };
  return {
    state: 'running',
    mcpClient,
    ensureStarted: vi.fn(async () => {}),
    whenReady: vi.fn(async () => true),
    callTool: vi.fn(async (name: string) => ({ content: [{ type: 'text', text: `backend handled ${name}` }] })),
    ...overrides,
  };
}

function fakeRelay() {
  return { subscribe: vi.fn(async () => {}), unsubscribe: vi.fn(async () => {}) };
}

describe('dev-proxy front behind serveStdio (issue #1025, step 2)', () => {
  let handle: StdioServerHandle | undefined;
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close().catch(() => undefined);
    await handle?.close().catch(() => undefined);
    handle = undefined;
    client = undefined;
  });

  function serve(deps: Partial<Parameters<typeof createFront>[0]> = {}) {
    const backend = fakeBackend();
    const relay = fakeRelay();
    const handleDevTool = vi.fn(async (name: string) => ({ content: [{ type: 'text', text: `dev ${name}` }] }));
    const front = createFront({ backend, relay, devTools: DEV_TOOLS, handleDevTool, log: () => {}, ...deps } as any);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    handle = serveStdio(front.factory, { transport: serverTransport });
    return { front, backend, relay, handleDevTool, clientTransport };
  }

  it('a 2026-07-28 client lands on a modern pin, and tools/list merges the backend tools with the dev tools after a deferred start', async () => {
    const { backend, clientTransport } = serve();
    client = new Client({ name: 'modern', version: '0.0.0' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } });
    await client.connect(clientTransport);

    expect(client.getProtocolEra()).toBe('modern');
    // Connecting alone never starts the backend: a disposable probe sibling
    // connects exactly like this and must not spawn one.
    expect(backend.ensureStarted).not.toHaveBeenCalled();

    const listed = await client.listTools();
    expect(listed.tools.map((t) => t.name)).toEqual(['backend_tool', 'dev_server_status']);
    expect(backend.ensureStarted).toHaveBeenCalledTimes(1);
    expect(backend.ensureStarted.mock.invocationCallOrder[0]).toBeLessThan(backend.whenReady.mock.invocationCallOrder[0]);
  });

  it('a 2025 client lands on a legacy pin; its resources/subscribe and unsubscribe reach the relay', async () => {
    const { relay, clientTransport } = serve();
    client = new Client({ name: 'legacy', version: '0.0.0' }, { versionNegotiation: { mode: 'legacy' } });
    await client.connect(clientTransport);

    expect(client.getProtocolEra()).toBe('legacy');
    await client.subscribeResource({ uri: URI });
    expect(relay.subscribe).toHaveBeenCalledWith(URI);
    await client.unsubscribeResource({ uri: URI });
    expect(relay.unsubscribe).toHaveBeenCalledWith(URI);
  });

  it('answers the dev tools locally and forwards every other call to the backend, starting it first', async () => {
    const { backend, handleDevTool, clientTransport } = serve();
    client = new Client({ name: 'legacy', version: '0.0.0' }, { versionNegotiation: { mode: 'legacy' } });
    await client.connect(clientTransport);

    const status = await client.callTool({ name: 'dev_server_status', arguments: {} });
    expect(status.content).toEqual([{ type: 'text', text: 'dev dev_server_status' }]);
    expect(handleDevTool).toHaveBeenCalledWith('dev_server_status', {});
    expect(backend.ensureStarted).not.toHaveBeenCalled();

    const forwarded = await client.callTool({ name: 'backend_tool', arguments: { a: 1 } });
    expect(forwarded.content).toEqual([{ type: 'text', text: 'backend handled backend_tool' }]);
    expect(backend.ensureStarted).toHaveBeenCalledTimes(1);
    expect(backend.callTool).toHaveBeenCalledWith('backend_tool', { a: 1 }, expect.anything());
  });

  it('the relay target follows the pinned instance: a legacy client hears a relayed resources/updated', async () => {
    const { front, clientTransport } = serve();
    client = new Client({ name: 'legacy', version: '0.0.0' }, { versionNegotiation: { mode: 'legacy' } });
    const updated: string[] = [];
    client.setNotificationHandler('notifications/resources/updated', async (n) => { updated.push(n.params.uri); });
    await client.connect(clientTransport);
    expect(front.current()).not.toBeNull();

    await front.notify({ method: 'notifications/resources/updated', params: { uri: URI } });
    await vi.waitFor(() => expect(updated).toEqual([URI]));
  });

  it('a modern client hears a relayed resources/updated on its listen stream, and list changes through the typed senders', async () => {
    const { front, clientTransport } = serve();
    client = new Client({ name: 'modern', version: '0.0.0' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } });
    const updated: string[] = [];
    const listChanges: string[] = [];
    client.setNotificationHandler('notifications/resources/updated', async (n) => { updated.push(n.params.uri); });
    client.setNotificationHandler('notifications/tools/list_changed', async (n) => { listChanges.push(n.method); });
    await client.connect(clientTransport);
    const subscription = await client.listen({ resourceSubscriptions: [URI], toolsListChanged: true });

    await front.notify({ method: 'notifications/resources/updated', params: { uri: URI } });
    await front.sendToolListChanged();
    await vi.waitFor(() => expect(updated).toEqual([URI]));
    await vi.waitFor(() => expect(listChanges).toEqual(['notifications/tools/list_changed']));
    await subscription.close();
  });

  it('a notification with no pinned instance is dropped, not thrown', async () => {
    const { front } = serve();
    expect(front.current()).toBeNull();
    await expect(front.notify({ method: 'notifications/resources/list_changed' })).resolves.toBeUndefined();
    await expect(front.sendToolListChanged()).resolves.toBeUndefined();
  });

  it('clears the relay target when the pinned instance closes', async () => {
    const { front, clientTransport } = serve();
    client = new Client({ name: 'legacy', version: '0.0.0' }, { versionNegotiation: { mode: 'legacy' } });
    await client.connect(clientTransport);
    expect(front.current()).not.toBeNull();

    await client.close();
    client = undefined;
    await vi.waitFor(() => expect(front.current()).toBeNull());
  });
});
