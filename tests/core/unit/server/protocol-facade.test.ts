/**
 * The protocol facade (issue #1025, step 2): one cheap SDK `Server` per
 * connection or request over the one shared DebugMcpServer core. It carries
 * the eight MCP handlers, the error and initialized hooks, and one
 * notification sink that lives exactly as long as the facade does. The core
 * never constructs a Server itself any more.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/server';
import { DebugMcpServer } from '../../../../src/server.js';
import { createProtocolServer } from '../../../../src/server/protocol-facade.js';
import { OUTPUT_UPDATE_DEBOUNCE_MS } from '../../../../src/server/notification-hub.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies, type Dependencies } from '../../../../src/container/dependencies.js';
import { getVersion } from '../../../../src/cli/version.js';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  getResourceHandlers,
  type MockServer,
  type MockSessionManager
} from './server-test-helpers.js';

vi.mock('@modelcontextprotocol/server', async () =>
  (await import('../../../test-utils/mocks/sdk-server-module.js')).sdkServerModuleMock());
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');
vi.mock('../../../../src/cli/version.js', () => ({ getVersion: vi.fn(() => '1.2.3-test') }));

const URI = 'debug://sessions/sess-1/output';

describe('createProtocolServer', () => {
  let core: DebugMcpServer;
  let mockServers: MockServer[];
  let mockSessionManager: MockSessionManager;
  let mockDependencies: Dependencies;
  let outputCapturedListener: ((sessionId: string) => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);

    mockServers = [];
    vi.mocked(Server).mockImplementation(function () {
      const s = createMockServer();
      mockServers.push(s);
      return s as any;
    });

    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    mockSessionManager.on.mockImplementation((event: string, listener: (...args: any[]) => void) => {
      if (event === 'output-captured') {
        outputCapturedListener = listener;
      }
    });
    vi.mocked(SessionManager).mockImplementation(function () { return mockSessionManager as any; });

    core = new DebugMcpServer({ logLevel: 'debug' });
  });

  afterEach(async () => {
    mockSessionManager.closeAllSessions.mockResolvedValue(undefined);
    await core.stop();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
    outputCapturedListener = undefined;
  });

  const legacy = () => createProtocolServer(core, { era: 'legacy', deliver: 'instance' });

  it('the core constructs no SDK Server of its own', () => {
    expect(Server).not.toHaveBeenCalled();
    expect(mockServers).toHaveLength(0);
  });

  it('builds the Server with the release identity, the capabilities and the mode-gated instructions', () => {
    legacy();

    expect(Server).toHaveBeenCalledTimes(1);
    expect(Server).toHaveBeenCalledWith(
      { name: 'debug-mcp-server', version: '1.2.3-test' },
      {
        capabilities: { tools: {}, resources: { subscribe: true, listChanged: true }, prompts: {} },
        instructions: expect.stringContaining('mcp-debugger drives real step-through debuggers')
      }
    );
    expect(vi.mocked(Server).mock.calls[0][1]?.instructions).toBe(core.instructions);
  });

  it('reads the release version once, on the core, not per facade (the version helper walks the file system)', () => {
    expect(core.version).toBe('1.2.3-test');
    const callsAfterCore = vi.mocked(getVersion).mock.calls.length;

    legacy();
    legacy();

    expect(vi.mocked(getVersion).mock.calls.length).toBe(callsAfterCore);
    expect(vi.mocked(Server).mock.calls[0][0]).toEqual({ name: 'debug-mcp-server', version: core.version });
  });

  it('two legacy facades over one core are pinged only for their own subscriptions', async () => {
    legacy();
    legacy();
    const [a, b] = mockServers;
    mockSessionManager.getSession.mockImplementation((id: string) => ({ id, name: id, language: 'mock' }) as any);
    await getResourceHandlers(a).subscribeHandler({ method: 'resources/subscribe', params: { uri: URI } });
    await getResourceHandlers(b).subscribeHandler({ method: 'resources/subscribe', params: { uri: 'debug://sessions/sess-2/output' } });

    outputCapturedListener!('sess-1');
    outputCapturedListener!('sess-2');
    await vi.advanceTimersByTimeAsync(OUTPUT_UPDATE_DEBOUNCE_MS + 10);

    expect(a.sendResourceUpdated).toHaveBeenCalledTimes(1);
    expect(a.sendResourceUpdated).toHaveBeenCalledWith({ uri: URI });
    expect(b.sendResourceUpdated).toHaveBeenCalledTimes(1);
    expect(b.sendResourceUpdated).toHaveBeenCalledWith({ uri: 'debug://sessions/sess-2/output' });
  });

  it('registers exactly the eight MCP handlers', () => {
    legacy();

    const [server] = mockServers;
    const methods = server.setRequestHandler.mock.calls.map(([method]: unknown[]) => method).sort();
    expect(methods).toEqual([
      'prompts/get',
      'prompts/list',
      'resources/list',
      'resources/read',
      'resources/subscribe',
      'resources/unsubscribe',
      'tools/call',
      'tools/list'
    ]);
  });

  it('routes SDK errors to the core logger', () => {
    legacy();
    const [server] = mockServers;
    expect(server.onerror).toBeDefined();

    const testError = new Error('Test error');
    server.onerror!(testError);

    expect(mockDependencies.logger.error).toHaveBeenCalledWith('Server error', { error: testError });
  });

  it('logs the negotiated protocol version and client on a legacy initialize (issue #1025)', () => {
    legacy();
    const [server] = mockServers;
    server.getNegotiatedProtocolVersion.mockReturnValue('2025-11-25');
    server.getClientVersion.mockReturnValue({ name: 'claude-code', version: '2.1.300' });

    expect(server.oninitialized).toBeDefined();
    server.oninitialized!();

    expect(mockDependencies.logger.info).toHaveBeenCalledWith('[MCP Server] Client initialized', {
      protocolVersion: '2025-11-25',
      client: 'claude-code 2.1.300'
    });
  });

  it('a legacy instance facade pings only the output URIs it subscribed to, and only while it is open', async () => {
    const facade = legacy();
    const [server] = mockServers;
    expect(core.notifications.sinkCount).toBe(1);
    mockSessionManager.getSession.mockReturnValue({ id: 'sess-1', name: 'one', language: 'mock' } as any);
    const { subscribeHandler } = getResourceHandlers(server);
    await subscribeHandler({ method: 'resources/subscribe', params: { uri: URI } });

    outputCapturedListener!('sess-1');
    outputCapturedListener!('sess-2');
    await vi.advanceTimersByTimeAsync(OUTPUT_UPDATE_DEBOUNCE_MS + 10);

    expect(server.sendResourceUpdated).toHaveBeenCalledTimes(1);
    expect(server.sendResourceUpdated).toHaveBeenCalledWith({ uri: URI });

    // The facade's own close detaches its sink
    expect(facade.onclose).toBeDefined();
    facade.onclose!();
    expect(core.notifications.sinkCount).toBe(0);
    outputCapturedListener!('sess-1');
    await vi.advanceTimersByTimeAsync(OUTPUT_UPDATE_DEBOUNCE_MS + 10);
    expect(server.sendResourceUpdated).toHaveBeenCalledTimes(1);
  });

  it('a modern instance facade (a stdio pin) pings every output URI; the SDK filters by the listen set', async () => {
    createProtocolServer(core, { era: 'modern', deliver: 'instance' });
    const [server] = mockServers;

    outputCapturedListener!('sess-1');
    await vi.advanceTimersByTimeAsync(OUTPUT_UPDATE_DEBOUNCE_MS + 10);

    expect(server.sendResourceUpdated).toHaveBeenCalledWith({ uri: URI });
  });

  it('an external-delivery facade (a per-request HTTP instance) registers no sink', async () => {
    createProtocolServer(core, { era: 'modern', deliver: 'external' });
    const [server] = mockServers;
    expect(core.notifications.sinkCount).toBe(0);

    outputCapturedListener!('sess-1');
    core.notifications.resourcesChanged();
    await vi.advanceTimersByTimeAsync(OUTPUT_UPDATE_DEBOUNCE_MS + 10);

    expect(server.sendResourceUpdated).not.toHaveBeenCalled();
    expect(server.sendResourceListChanged).not.toHaveBeenCalled();
  });

  it('two facades on one core both hear a list change', () => {
    legacy();
    legacy();
    const [a, b] = mockServers;

    core.notifications.resourcesChanged();

    expect(a.sendResourceListChanged).toHaveBeenCalledTimes(1);
    expect(b.sendResourceListChanged).toHaveBeenCalledTimes(1);
  });

  it('is cheap: a second facade over a built core takes well under the per-request budget', () => {
    legacy();
    vi.useRealTimers();
    const started = performance.now();
    legacy();
    const elapsed = performance.now() - started;

    // Generous bound (the per-request HTTP leg builds one per call; a loaded
    // CI runner pauses for GC): the dispatch index and the version string are
    // built once per core, not per facade.
    expect(elapsed).toBeLessThan(50);
  });
});
