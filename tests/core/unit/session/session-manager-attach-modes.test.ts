/**
 * Attach-mode behavior of SessionManagerOperations (issue #331):
 * - direct-connect attach skips local executable resolution
 * - attach on a language declaring modes.attach 'none' fails fast, no state mutation
 * - spawn-mode attach still resolves the local toolchain
 * - launch toolchain failures on attach-capable adapters carry an attach hint
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManagerOperations } from '../../../../src/session/session-manager-operations.js';
import { SessionLifecycleState, SessionState } from '@debugmcp/shared';
import { DebugSessionCreationError } from '../../../../src/errors/debug-errors.js';
import { createEnvironmentMock } from '../../../test-utils/mocks/environment.js';

class TestableSessionManagerOperations extends SessionManagerOperations {
  protected async handleAutoContinue(_sessionId: string): Promise<void> {
    // no-op for tests
  }
}

describe('SessionManagerOperations attach modes', () => {
  let operations: SessionManagerOperations;
  let mockSessionStore: any;
  let mockProxyManager: any;
  let mockDependencies: any;
  let mockSession: any;

  beforeEach(() => {
    const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

    mockProxyManager = {
      isRunning: vi.fn().mockReturnValue(true),
      getCurrentThreadId: vi.fn().mockReturnValue(1),
      sendDapRequest: vi.fn().mockResolvedValue({}),
      stop: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
      removeListener: vi.fn(),
      on: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined)
    };
    mockProxyManager.on.mockImplementation(() => mockProxyManager);
    mockProxyManager.off.mockImplementation(() => mockProxyManager);
    mockProxyManager.once.mockImplementation(() => mockProxyManager);
    mockProxyManager.removeListener.mockImplementation(() => mockProxyManager);

    mockSession = {
      id: 'test-session',
      name: 'Test Session',
      language: 'ruby',
      state: SessionState.CREATED,
      sessionLifecycle: SessionLifecycleState.CREATED,
      proxyManager: undefined,
      breakpoints: new Map(),
      createdAt: new Date(),
      updatedAt: new Date(),
      executablePath: undefined
    };

    mockSessionStore = {
      get: vi.fn().mockReturnValue(mockSession),
      getOrThrow: vi.fn().mockReturnValue(mockSession),
      update: vi.fn(),
      updateState: vi.fn().mockImplementation((_sessionId: string, newState: SessionState) => {
        mockSession.state = newState;
      }),
      delete: vi.fn(),
      remove: vi.fn().mockReturnValue(true),
      getAll: vi.fn().mockReturnValue([mockSession])
    };

    mockDependencies = {
      logger: mockLogger,
      sessionStoreFactory: { create: vi.fn().mockReturnValue(mockSessionStore) },
      proxyManagerFactory: { create: vi.fn().mockReturnValue(mockProxyManager) },
      fileSystem: {
        readFile: vi.fn(),
        exists: vi.fn(),
        pathExists: vi.fn().mockResolvedValue(true),
        ensureDir: vi.fn().mockResolvedValue(undefined),
        ensureDirSync: vi.fn()
      },
      environment: createEnvironmentMock(),
      networkManager: { findFreePort: vi.fn().mockResolvedValue(9000) },
      adapterRegistry: {
        create: vi.fn(),
        getAdapterPolicy: vi.fn().mockReturnValue({
          name: 'default',
          getInitializationBehavior: () => ({})
        })
      }
    };

    operations = new TestableSessionManagerOperations(
      { logDirBase: '/tmp/logs' },
      mockDependencies as any
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('skips executable resolution for direct-connect attach and builds no adapter command', async () => {
    const adapterStub = {
      resolveExecutablePath: vi.fn().mockRejectedValue(new Error('ruby not found')),
      buildAdapterCommand: vi.fn(),
      usesDirectConnectForAttach: vi.fn().mockReturnValue(true),
      supportsAttach: vi.fn().mockReturnValue(true),
      transformAttachConfig: vi.fn().mockImplementation((cfg: unknown) => cfg),
      getDefaultExecutableName: vi.fn().mockReturnValue('ruby')
    };
    mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

    await (operations as any).startProxyManager(
      mockSession,
      'attach://remote',
      undefined,
      { request: 'attach', host: '127.0.0.1', port: 12345 }
    );

    expect(adapterStub.resolveExecutablePath).not.toHaveBeenCalled();
    expect(adapterStub.buildAdapterCommand).not.toHaveBeenCalled();
    expect(mockProxyManager.start).toHaveBeenCalledWith(
      expect.objectContaining({ attachMode: true, executablePath: 'ruby' })
    );
  });

  it('still resolves the local toolchain for spawn-mode attach', async () => {
    mockSession.language = 'java';
    const adapterStub = {
      resolveExecutablePath: vi.fn().mockResolvedValue('java'),
      buildAdapterCommand: vi.fn().mockReturnValue({ command: 'java', args: [] }),
      supportsAttach: vi.fn().mockReturnValue(true),
      transformAttachConfig: vi.fn().mockImplementation((cfg: unknown) => cfg)
    };
    mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

    await (operations as any).startProxyManager(
      mockSession,
      'attach://remote',
      undefined,
      { request: 'attach', port: 5005 }
    );

    expect(adapterStub.resolveExecutablePath).toHaveBeenCalled();
    expect(adapterStub.buildAdapterCommand).toHaveBeenCalled();
    expect(mockProxyManager.start).toHaveBeenCalledWith(
      expect.objectContaining({ attachMode: true, executablePath: 'java' })
    );
  });

  it("fails attach fast with a clean error when the adapter declares attach 'none'", async () => {
    mockSession.language = 'rust';
    mockDependencies.adapterRegistry.getFactoryMetadata = vi
      .fn()
      .mockResolvedValue({ modes: { launch: true, attach: 'none' } });

    const result = await operations.attachToProcess('test-session', { port: 1234 });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Attach mode is not implemented for 'rust'");
    // No state mutation: session must not enter INITIALIZING/ACTIVE
    expect(mockSessionStore.updateState).not.toHaveBeenCalled();
    expect(mockSessionStore.update).not.toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({ attachMode: true })
    );
    expect(mockSession.state).toBe(SessionState.CREATED);
  });

  it('proceeds past the gate when the adapter declares a real attach mechanism', async () => {
    mockDependencies.adapterRegistry.getFactoryMetadata = vi
      .fn()
      .mockResolvedValue({ modes: { launch: true, attach: 'direct-connect' } });
    const adapterStub = {
      resolveExecutablePath: vi.fn(),
      buildAdapterCommand: vi.fn(),
      usesDirectConnectForAttach: vi.fn().mockReturnValue(true),
      supportsAttach: vi.fn().mockReturnValue(true),
      transformAttachConfig: vi.fn().mockImplementation((cfg: unknown) => cfg),
      getDefaultExecutableName: vi.fn().mockReturnValue('ruby')
    };
    mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);
    // Only the gate is under test — let the post-start attach verification fail fast
    mockProxyManager.start.mockRejectedValue(new Error('stop here'));

    const result = await operations.attachToProcess('test-session', {
      host: '127.0.0.1',
      port: 12345
    });

    expect(mockDependencies.adapterRegistry.getFactoryMetadata).toHaveBeenCalledWith('ruby');
    // The gate did not block: the flow reached proxy start (and failed there)
    expect(mockProxyManager.start).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).not.toContain('Attach mode is not implemented');
  });

  describe('adapterConfig passthrough (issue #336)', () => {
    function makeDirectConnectAdapter() {
      return {
        resolveExecutablePath: vi.fn(),
        buildAdapterCommand: vi.fn(),
        usesDirectConnectForAttach: vi.fn().mockReturnValue(true),
        supportsAttach: vi.fn().mockReturnValue(true),
        transformAttachConfig: vi.fn().mockImplementation((cfg: unknown) => cfg),
        getDefaultExecutableName: vi.fn().mockReturnValue('ruby')
      };
    }

    it('attachToProcess merges adapterConfig into the config handed to transformAttachConfig', async () => {
      mockDependencies.adapterRegistry.getFactoryMetadata = vi
        .fn()
        .mockResolvedValue({ modes: { launch: true, attach: 'direct-connect' } });
      const adapterStub = makeDirectConnectAdapter();
      mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false, // skip the post-attach thread-verify poll
        adapterConfig: {
          program: '/proc/1/root/pricer',
          initCommands: ['settings set target.exec-search-paths /proc/1/root']
        }
      });

      expect(result.success).toBe(true);
      const cfg = adapterStub.transformAttachConfig.mock.calls[0][0];
      expect(cfg.program).toBe('/proc/1/root/pricer');
      expect(cfg.initCommands).toEqual(['settings set target.exec-search-paths /proc/1/root']);
      expect(cfg.request).toBe('attach');
      expect(cfg.__attachMode).toBe(true);
      // The wrapper key itself must not leak into the DAP attach arguments.
      expect(cfg.adapterConfig).toBeUndefined();
      expect(mockProxyManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          attachMode: true,
          launchConfig: expect.objectContaining({ program: '/proc/1/root/pricer' })
        })
      );
    });

    it('reserved keys in adapterConfig cannot flip the attach request', async () => {
      // The proxy worker re-reads request/__attachMode from the merged config
      // to choose the DAP sequence AND shutdown semantics (attach must detach
      // with terminateDebuggee=false) — extras must never rewrite them.
      mockDependencies.adapterRegistry.getFactoryMetadata = vi
        .fn()
        .mockResolvedValue({ modes: { launch: true, attach: 'direct-connect' } });
      const adapterStub = makeDirectConnectAdapter();
      mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

      await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { request: 'launch', __attachMode: false, program: '/x' }
      });

      const cfg = adapterStub.transformAttachConfig.mock.calls[0][0];
      expect(cfg.request).toBe('attach');
      expect(cfg.__attachMode).toBe(true);
      expect(cfg.program).toBe('/x');
    });

    it('strips request/__attachMode from launch-path adapterLaunchConfig too', async () => {
      const adapterStub = {
        resolveExecutablePath: vi.fn().mockResolvedValue('ruby'),
        buildAdapterCommand: vi.fn().mockReturnValue({ command: 'rdbg', args: [] }),
        supportsAttach: vi.fn().mockReturnValue(false),
        transformLaunchConfig: vi.fn().mockImplementation(async (cfg: unknown) => cfg)
      };
      mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

      await (operations as any).startProxyManager(
        mockSession,
        'script.rb',
        undefined,
        {},
        false,
        { request: 'attach', __attachMode: true, foo: 1 }
      );

      const cfg = adapterStub.transformLaunchConfig.mock.calls[0][0];
      expect(cfg.foo).toBe(1);
      expect(cfg.request).not.toBe('attach');
      expect(cfg.__attachMode).toBeUndefined();
      expect(mockProxyManager.start).toHaveBeenCalledWith(
        expect.objectContaining({ attachMode: false })
      );
    });
  });

  describe('dropped adapterConfig keys warning (issue #450)', () => {
    function makeDirectConnectAdapter(
      transform: (cfg: unknown) => unknown,
      supportedAttachKeys?: readonly string[]
    ) {
      return {
        resolveExecutablePath: vi.fn(),
        buildAdapterCommand: vi.fn(),
        usesDirectConnectForAttach: vi.fn().mockReturnValue(true),
        supportsAttach: vi.fn().mockReturnValue(true),
        transformAttachConfig: vi.fn().mockImplementation(transform),
        getDefaultExecutableName: vi.fn().mockReturnValue('ruby'),
        ...(supportedAttachKeys ? { supportedAttachKeys } : {})
      };
    }

    beforeEach(() => {
      mockDependencies.adapterRegistry.getFactoryMetadata = vi
        .fn()
        .mockResolvedValue({ modes: { launch: true, attach: 'direct-connect' } });
    });

    it('surfaces adapterConfig keys the attach transform dropped in data.warning', async () => {
      const adapterStub = makeDirectConnectAdapter((cfg) => ({
        request: 'attach',
        keepMe: (cfg as Record<string, unknown>).keepMe
      }));
      mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { localRoot: 'C:\\work\\app', remoteRoot: '/app', keepMe: 1 }
      });

      expect(result.success).toBe(true);
      const warning = (result.data as { warning?: string }).warning;
      expect(warning).toContain('localRoot');
      expect(warning).toContain('remoteRoot');
      expect(warning).not.toContain('keepMe');
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('localRoot')
      );
    });

    it('emits no warning when the transform preserves every adapterConfig key', async () => {
      const adapterStub = makeDirectConnectAdapter((cfg) => cfg);
      mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { pathMappings: [{ localRoot: 'C:\\x', remoteRoot: '/app' }] }
      });

      expect(result.success).toBe(true);
      expect((result.data as { warning?: string }).warning).toBeUndefined();
    });

    it('ignores dropped top-level attach params — only adapterConfig keys are the caller contract', async () => {
      // host/port legitimately vanish into normalized shapes (e.g. debugpy's
      // connect.*) — no warning unless the caller's adapterConfig lost keys.
      const adapterStub = makeDirectConnectAdapter(() => ({
        request: 'attach',
        connect: { host: '127.0.0.1', port: 12345 }
      }));
      mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false
      });

      expect(result.success).toBe(true);
      expect((result.data as { warning?: string }).warning).toBeUndefined();
    });

    it('forwards keys outside supportedAttachKeys with a did-you-mean warning (issue #466)', async () => {
      const adapterStub = makeDirectConnectAdapter(
        (cfg) => cfg,
        ['pathMappings', 'justMyCode']
      );
      mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { pathMapping: [{ localRoot: 'C:\\x', remoteRoot: '/app' }] }
      });

      expect(result.success).toBe(true);
      const warning = (result.data as { warning?: string }).warning;
      expect(warning).toContain('not recognized by mcp-debugger were forwarded to the ruby adapter as-is');
      expect(warning).toContain('pathMapping (did you mean pathMappings?)');
      expect(warning).not.toContain('were ignored');

      // Forwarded means forwarded: the typo'd key must still reach the DAP
      // attach config handed to the proxy.
      const proxyConfig = mockProxyManager.start.mock.calls[0][0];
      expect(proxyConfig.launchConfig).toHaveProperty('pathMapping');
    });

    it('still warns "ignored" for a listed key the transform drops (union with #450)', async () => {
      const adapterStub = makeDirectConnectAdapter(
        (cfg) => ({ request: 'attach', keepMe: (cfg as Record<string, unknown>).keepMe }),
        ['keepMe', 'alsoSupported']
      );
      mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { keepMe: 1, alsoSupported: 2 }
      });

      expect(result.success).toBe(true);
      const warning = (result.data as { warning?: string }).warning;
      expect(warning).toContain('were ignored: alsoSupported');
      expect(warning).not.toContain('keepMe');
    });

    it('reports dropped and forwarded-unrecognized keys in one combined warning', async () => {
      const adapterStub = makeDirectConnectAdapter(
        (cfg) => {
          const c = cfg as Record<string, unknown>;
          return { request: 'attach', keepMe: c.keepMe, mystery: c.mystery };
        },
        ['keepMe']
      );
      mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { keepMe: 1, mystery: 2, localRoot: 'C:\\x' }
      });

      expect(result.success).toBe(true);
      const warning = (result.data as { warning?: string }).warning ?? '';
      expect(warning).toContain('were ignored: localRoot');
      expect(warning).toContain('forwarded to the ruby adapter as-is: mystery');
      expect(warning.indexOf('; ')).toBeGreaterThan(0);
      expect(warning).not.toContain('keepMe');
    });

    it('does not leak a stale warning into a later attach on the same session', async () => {
      const dropAll = makeDirectConnectAdapter(() => ({ request: 'attach' }));
      mockDependencies.adapterRegistry.create.mockResolvedValue(dropAll);

      const first = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { localRoot: 'C:\\x' }
      });
      expect((first.data as { warning?: string }).warning).toContain('localRoot');

      // Simulate detach + re-attach with a clean adapterConfig
      mockSession.proxyManager = undefined;
      mockSession.state = SessionState.CREATED;
      const identity = makeDirectConnectAdapter((cfg) => cfg);
      mockDependencies.adapterRegistry.create.mockResolvedValue(identity);

      const second = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false
      });
      expect((second.data as { warning?: string }).warning).toBeUndefined();
    });
  });

  it('appends an attach hint when launch executable resolution fails on an attach-capable adapter', async () => {
    const adapterStub = {
      resolveExecutablePath: vi.fn().mockRejectedValue(new Error('ruby not found')),
      buildAdapterCommand: vi.fn(),
      supportsAttach: vi.fn().mockReturnValue(true),
      transformLaunchConfig: vi.fn().mockImplementation(async (cfg: unknown) => cfg)
    };
    mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

    await expect(
      (operations as any).startProxyManager(mockSession, 'script.rb')
    ).rejects.toThrow(/attach_to_process/);
  });

  it('omits the attach hint when the adapter has no attach support', async () => {
    mockSession.language = 'go';
    const adapterStub = {
      resolveExecutablePath: vi.fn().mockRejectedValue(new Error('go not found')),
      buildAdapterCommand: vi.fn(),
      transformLaunchConfig: vi.fn().mockImplementation(async (cfg: unknown) => cfg)
    };
    mockDependencies.adapterRegistry.create.mockResolvedValue(adapterStub);

    const failure = await (operations as any)
      .startProxyManager(mockSession, 'main.go')
      .then(
        () => {
          throw new Error('expected startProxyManager to reject');
        },
        (err: unknown) => err
      );

    expect(failure).toBeInstanceOf(DebugSessionCreationError);
    expect((failure as Error).message).not.toContain('attach_to_process');
  });
});
