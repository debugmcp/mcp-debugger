/**
 * The facade served through the SDK's stdio entry (issue #1025, step 2), in
 * process over the in-memory transport: `serveStdio(factory, { transport })`
 * pins one facade per connection in whichever era the client opens. A
 * 2026-07-28 client lands on a modern pin and hears list changes on its
 * subscriptions/listen stream through the facade's own `sendResourceListChanged`
 * (the SDK routes it); a 2025 client lands on a legacy pin and keeps
 * resources/subscribe with its coalesced resources/updated pings.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import { Client } from '@modelcontextprotocol/client';
import { DebugMcpServer } from '../../../../src/server.js';
import { createProtocolServer } from '../../../../src/server/protocol-facade.js';
import { OUTPUT_UPDATE_DEBOUNCE_MS } from '../../../../src/server/notification-hub.js';
import { TOOL_NAMES } from '../../../../src/server/tool-schemas.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies, type Dependencies } from '../../../../src/container/dependencies.js';
import {
  createMockDependencies,
  createMockSessionManager,
  type MockSessionManager
} from './server-test-helpers.js';

vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

const URI = 'debug://sessions/sess-1/output';

describe('createProtocolServer behind serveStdio (issue #1025, step 2)', () => {
  let core: DebugMcpServer;
  let mockSessionManager: MockSessionManager;
  let mockDependencies: Dependencies;
  let handle: StdioServerHandle | undefined;
  let client: Client | undefined;
  let outputCapturedListener: ((sessionId: string) => void) | undefined;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);
    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    mockSessionManager.getSession.mockReturnValue({ id: 'sess-1', name: 'one', language: 'mock' } as any);
    mockSessionManager.getAllSessions.mockReturnValue([]);
    mockSessionManager.on.mockImplementation((event: string, listener: (...args: any[]) => void) => {
      if (event === 'output-captured') {
        outputCapturedListener = listener;
      }
    });
    vi.mocked(SessionManager).mockImplementation(function () { return mockSessionManager as any; });
    core = new DebugMcpServer({ logLevel: 'debug' });
  });

  afterEach(async () => {
    await client?.close().catch(() => undefined);
    await handle?.close().catch(() => undefined);
    mockSessionManager.closeAllSessions.mockResolvedValue(undefined);
    await core.stop();
    vi.clearAllMocks();
    handle = undefined;
    client = undefined;
    outputCapturedListener = undefined;
  });

  function serve(): InMemoryTransport {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    handle = serveStdio(
      ({ era }) => createProtocolServer(core, { era, deliver: 'instance' }),
      { transport: serverTransport }
    );
    return clientTransport;
  }

  it('a 2026-07-28 client lands on a modern pin and hears list changes on its listen stream', async () => {
    const clientTransport = serve();
    client = new Client({ name: 'modern-test', version: '0.0.0' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } });
    await client.connect(clientTransport);

    expect(client.getProtocolEra()).toBe('modern');
    expect(client.getNegotiatedProtocolVersion()).toBe('2026-07-28');
    expect(core.notifications.sinkCount).toBe(1);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([...TOOL_NAMES].sort());

    const changes: string[] = [];
    client.setNotificationHandler('notifications/resources/list_changed', () => { changes.push('list_changed'); });
    const subscription = await client.listen({ resourcesListChanged: true });
    expect(subscription.honoredFilter.resourcesListChanged).toBe(true);

    core.notifications.resourcesChanged();
    await vi.waitFor(() => expect(changes).toEqual(['list_changed']));

    await subscription.close();
  });

  it('a 2025 client lands on a legacy pin and keeps resources/subscribe with coalesced pings', async () => {
    const clientTransport = serve();
    client = new Client({ name: 'legacy-test', version: '0.0.0' });
    await client.connect(clientTransport);

    expect(client.getProtocolEra()).toBe('legacy');
    const pings: string[] = [];
    client.setNotificationHandler('notifications/resources/updated', (notification) => {
      pings.push((notification.params as { uri: string }).uri);
    });
    await client.subscribeResource({ uri: URI });

    outputCapturedListener!('sess-1');
    outputCapturedListener!('sess-1');
    await new Promise((resolve) => setTimeout(resolve, OUTPUT_UPDATE_DEBOUNCE_MS + 50));
    await vi.waitFor(() => expect(pings).toEqual([URI]));
  });

  it('the handle closing detaches the pinned facade from the hub', async () => {
    const clientTransport = serve();
    client = new Client({ name: 'modern-test', version: '0.0.0' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } });
    await client.connect(clientTransport);
    expect(core.notifications.sinkCount).toBe(1);

    await handle!.close();
    handle = undefined;

    await vi.waitFor(() => expect(core.notifications.sinkCount).toBe(0));
  });
});
