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
import { serveStdio } from '@modelcontextprotocol/server/stdio';
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

/**
 * Who is connected, in the server's own log (issue #1025, step 2). A 2025
 * client is named by the `Client initialized` line its handshake writes. A
 * 2026-07-28 client has no handshake — its name, version and protocol
 * revision ride on every request — so the facade names it on the first
 * request that reaches a handler, once per distinct client per process: a
 * stdio connection logs one line, and so does an `http` client however many
 * per-request facades serve it.
 */
describe('a 2026-07-28 client is identified in the log', () => {
  let core: DebugMcpServer;
  let mockSessionManager: MockSessionManager;
  let mockDependencies: Dependencies;
  const closers: Array<() => Promise<unknown>> = [];

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);
    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function () { return mockSessionManager as any; });
    core = new DebugMcpServer();
  });

  afterEach(async () => {
    for (const close of closers.splice(0)) await close().catch(() => undefined);
    mockSessionManager.closeAllSessions.mockResolvedValue(undefined);
    await core.stop();
    vi.clearAllMocks();
  });

  /** One client over the SDK's stdio entry, the way the stdio command serves it. */
  async function connect(name: string, mode: 'legacy' | { pin: string }): Promise<Client> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const handle = serveStdio(({ era }) => createProtocolServer(core, { era, deliver: 'instance' }), { transport: serverTransport });
    const client = new Client({ name, version: '1.2.3' }, { versionNegotiation: { mode } });
    await client.connect(clientTransport);
    closers.push(() => client.close(), () => handle.close());
    return client;
  }

  const identified = () =>
    vi.mocked(mockDependencies.logger.info).mock.calls.filter(([message]) => message === '[MCP Server] Client identified');

  it('names the client and its protocol revision on its first handled request, and only once', async () => {
    const client = await connect('era-client', { pin: '2026-07-28' });
    expect(identified()).toHaveLength(0);

    await client.listPrompts();
    await client.listPrompts();
    await client.listResources();

    expect(identified()).toEqual([
      ['[MCP Server] Client identified', { era: 'modern', protocolVersion: '2026-07-28', client: 'era-client 1.2.3' }]
    ]);
  });

  it('logs the same client once per process, and a different client once more', async () => {
    await (await connect('era-client', { pin: '2026-07-28' })).listPrompts();
    await (await connect('era-client', { pin: '2026-07-28' })).listPrompts();
    await (await connect('other-client', { pin: '2026-07-28' })).listPrompts();

    expect(identified().map(([, meta]) => (meta as { client: string }).client)).toEqual(['era-client 1.2.3', 'other-client 1.2.3']);
  });

  it('leaves a 2025 client to its Client initialized line', async () => {
    await (await connect('legacy-client', 'legacy')).listPrompts();

    expect(identified()).toHaveLength(0);
    expect(mockDependencies.logger.info).toHaveBeenCalledWith(
      '[MCP Server] Client initialized',
      expect.objectContaining({ client: 'legacy-client 1.2.3' })
    );
  });

  it('names a client that sent no client info by its protocol revision alone', () => {
    core.noteModernClient({ protocolVersion: '2026-07-28' });

    expect(identified()).toEqual([
      ['[MCP Server] Client identified', { era: 'modern', protocolVersion: '2026-07-28', client: undefined }]
    ]);
  });

  it('keeps a bounded set of identities: past it, a new one is logged at debug and not remembered', () => {
    for (let i = 0; i < 300; i++) core.noteModernClient({ protocolVersion: '2026-07-28', client: `client-${i} 1.0.0` });

    expect(identified()).toHaveLength(256);
    expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
      '[MCP Server] Client identified',
      expect.objectContaining({ client: 'client-299 1.0.0' })
    );
  });
});
