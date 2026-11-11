/**
 * The facade's sink leaves with the facade through the REAL SDK close chain
 * (issue #1025, step 2): a transport close runs `Protocol._onclose` →
 * `server.onclose` → the hub detach the facade installed. The sibling suite
 * mocks the SDK Server and can only invoke `onclose` by hand; this one drives
 * a real Server/Client pair over the in-memory transport, because from PR 2 on
 * (one core per process) this chain is the only thing that lets a closed
 * connection's Server be collected.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { Client } from '@modelcontextprotocol/client';
import { DebugMcpServer } from '../../../../src/server.js';
import { createProtocolServer } from '../../../../src/server/protocol-facade.js';
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

describe('createProtocolServer over a real transport', () => {
  let core: DebugMcpServer;
  let mockSessionManager: MockSessionManager;
  let mockDependencies: Dependencies;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);
    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    mockSessionManager.getSession.mockReturnValue({ id: 'sess-1', name: 'one', language: 'mock' } as any);
    vi.mocked(SessionManager).mockImplementation(function () { return mockSessionManager as any; });
    core = new DebugMcpServer({ logLevel: 'debug' });
  });

  afterEach(async () => {
    mockSessionManager.closeAllSessions.mockResolvedValue(undefined);
    await core.stop();
    vi.clearAllMocks();
  });

  it('detaches its sink when the transport closes, with a live subscription in place', async () => {
    const facade = createProtocolServer(core, { era: 'legacy', deliver: 'instance' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'facade-close-test', version: '0.0.0' });
    await Promise.all([facade.connect(serverTransport), client.connect(clientTransport)]);
    await client.subscribeResource({ uri: URI });
    expect(core.notifications.sinkCount).toBe(1);

    await client.close();

    expect(core.notifications.sinkCount).toBe(0);
  });

  it('detaches its sink when the server side closes', async () => {
    const facade = createProtocolServer(core, { era: 'legacy', deliver: 'instance' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'facade-close-test', version: '0.0.0' });
    await Promise.all([facade.connect(serverTransport), client.connect(clientTransport)]);
    expect(core.notifications.sinkCount).toBe(1);

    await facade.close();

    expect(core.notifications.sinkCount).toBe(0);
    await client.close().catch(() => undefined);
  });
});
