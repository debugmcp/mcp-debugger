/**
 * Attach-mode behavior of SessionManagerOperations (issue #331):
 * - direct-connect attach skips local executable resolution
 * - attach on a language declaring modes.attach 'none' fails fast, no state mutation
 * - spawn-mode attach still resolves the local toolchain
 * - launch toolchain failures on attach-capable adapters carry an attach hint
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManagerOperations } from '../../../../src/session/session-manager-operations.js';
import type { SessionManagerDependencies } from '../../../../src/session/session-manager-core.js';
import { SessionStore, type ManagedSession } from '../../../../src/session/session-store.js';
import { MockProxyManagerFactory } from '../../../../src/factories/proxy-manager-factory.js';
import type { IProxyManager } from '../../../../src/proxy/proxy-manager.js';
import { DebugLanguage, SessionLifecycleState, SessionState } from '@debugmcp/shared';
import { DebugSessionCreationError } from '../../../../src/errors/debug-errors.js';
import {
  createMockEnvironment,
  createMockLogger,
  createMockNetworkManager
} from '../../../test-utils/helpers/test-dependencies.js';
import { createMockFileSystem } from '../../../test-utils/helpers/test-utils.js';
import { createMockAdapterRegistry } from '../../../test-utils/mocks/mock-adapter-registry.js';
import {
  createPartialSessionStore,
  type PartialSessionStoreMock,
  type ProxyManagerMocks
} from '../../../test-utils/mocks/session-doubles.js';
import {
  FakeDebugAdapter,
  type DefinedAttachMembers
} from '../../../test-utils/fakes/fake-debug-adapter.js';
import { internals } from '../../../test-utils/helpers/operations-internals.js';
import type {
  AdapterMetadata,
  ExceptionBreakMode,
  GenericAttachConfig,
  LanguageSpecificAttachConfig,
  LanguageSpecificLaunchConfig
} from '@debugmcp/shared';

class TestableSessionManagerOperations extends SessionManagerOperations {
  protected async handleAutoContinue(_sessionId: string): Promise<void> {
    // no-op for tests
  }
}

/**
 * Factory metadata as the attach gate reads it: only `modes.attach` is consulted
 * (attach-controller.ts), so the five required strings are neutral filler.
 */
function metadataWithModes(modes: AdapterMetadata['modes']): AdapterMetadata {
  return {
    language: 'test',
    displayName: 'Test Adapter',
    version: '0.0.0',
    author: 'test',
    description: 'test',
    modes
  };
}

/**
 * The adapter shape most of these tests want: Ruby-flavoured, attach-capable and
 * direct-connect, so the launcher skips executable resolution and builds no adapter
 * command. Built on the conformant fake, so every member is the one `IDebugAdapter`
 * declares -- the hand-rolled literals this replaces were only ever checked by the
 * `any`-typed registry mock they were handed to.
 */
function makeDirectConnectRubyAdapter(
  overrides: {
    transform?: (cfg: GenericAttachConfig) => LanguageSpecificAttachConfig;
    supportedAttachKeys?: readonly string[];
    resolveExecutablePath?: (preferredPath?: string) => Promise<string>;
  } = {}
): FakeDebugAdapter & DefinedAttachMembers {
  return new FakeDebugAdapter({
    language: DebugLanguage.RUBY,
    getDefaultExecutableName: () => 'ruby',
    resolveExecutablePath: overrides.resolveExecutablePath
  }).withAttachSupport({
    directConnect: true,
    transform: overrides.transform,
    supportedAttachKeys: overrides.supportedAttachKeys
  });
}

describe('SessionManagerOperations attach modes', () => {
  let operations: SessionManagerOperations;
  let mockSessionStore: PartialSessionStoreMock;
  // Never installed on a ManagedSession here, so just the stubs (see session-doubles.ts).
  let mockProxyManager: ProxyManagerMocks;
  let mockDependencies: SessionManagerDependencies;
  let mockSession: ManagedSession;

  beforeEach(() => {
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
      language: DebugLanguage.RUBY,
      state: SessionState.CREATED,
      sessionLifecycle: SessionLifecycleState.CREATED,
      proxyManager: undefined,
      breakpoints: new Map(),
      functionBreakpoints: new Map(),
      createdAt: new Date(),
      updatedAt: new Date(),
      executablePath: undefined
    };

    mockSessionStore = createPartialSessionStore(mockSession);

    // Pre-configured helper: pathExists/ensureDir already answer true/undefined.
    const fileSystem = createMockFileSystem();
    const networkManager = createMockNetworkManager();
    vi.mocked(networkManager.findFreePort).mockResolvedValue(9000);
    const proxyManagerFactory = new MockProxyManagerFactory();
    // One sanctioned cast: the proxy double is deliberately partial (see ProxyManagerMocks).
    proxyManagerFactory.createFn = () => mockProxyManager as unknown as IProxyManager;

    mockDependencies = {
      logger: createMockLogger(),
      fileSystem,
      networkManager,
      environment: createMockEnvironment(),
      adapterRegistry: createMockAdapterRegistry(),
      proxyManagerFactory,
      // One sanctioned cast: the store double is deliberately partial (see PartialSessionStore).
      sessionStoreFactory: { create: vi.fn(() => mockSessionStore as unknown as SessionStore) }
    };

    operations = new TestableSessionManagerOperations({ logDirBase: '/tmp/logs' }, mockDependencies);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('skips executable resolution for direct-connect attach and builds no adapter command', async () => {
    const adapterStub = makeDirectConnectRubyAdapter({
      resolveExecutablePath: async () => {
        throw new Error('ruby not found');
      }
    });
    vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

    await internals(operations).proxyLauncher.start(mockSession, {
      scriptPath: 'attach://remote',
      dapLaunchArgs: { request: 'attach', host: '127.0.0.1', port: 12345 }
    });

    expect(adapterStub.resolveExecutablePath).not.toHaveBeenCalled();
    expect(adapterStub.buildAdapterCommand).not.toHaveBeenCalled();
    expect(mockProxyManager.start).toHaveBeenCalledWith(
      expect.objectContaining({ attachMode: true, executablePath: 'ruby' })
    );
  });

  it('still resolves the local toolchain for spawn-mode attach', async () => {
    mockSession.language = DebugLanguage.JAVA;
    const adapterStub = new FakeDebugAdapter({
      language: DebugLanguage.JAVA,
      resolveExecutablePath: async () => 'java',
      buildAdapterCommand: () => ({ command: 'java', args: [] })
    }).withAttachSupport();
    vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

    await internals(operations).proxyLauncher.start(mockSession, {
      scriptPath: 'attach://remote',
      dapLaunchArgs: { request: 'attach', port: 5005 }
    });

    expect(adapterStub.resolveExecutablePath).toHaveBeenCalled();
    expect(adapterStub.buildAdapterCommand).toHaveBeenCalled();
    expect(mockProxyManager.start).toHaveBeenCalledWith(
      expect.objectContaining({ attachMode: true, executablePath: 'java' })
    );
  });

  it("fails attach fast with a clean error when the adapter declares attach 'none'", async () => {
    mockSession.language = DebugLanguage.RUST;
    vi.mocked(mockDependencies.adapterRegistry.getFactoryMetadata).mockResolvedValue(
      metadataWithModes({ launch: true, attach: 'none' })
    );

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
    vi.mocked(mockDependencies.adapterRegistry.getFactoryMetadata).mockResolvedValue(
      metadataWithModes({ launch: true, attach: 'direct-connect' })
    );
    const adapterStub = makeDirectConnectRubyAdapter();
    vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);
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
    it('attachToProcess merges adapterConfig into the config handed to transformAttachConfig', async () => {
      vi.mocked(mockDependencies.adapterRegistry.getFactoryMetadata).mockResolvedValue(
        metadataWithModes({ launch: true, attach: 'direct-connect' })
      );
      const adapterStub = makeDirectConnectRubyAdapter();
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false, // skip the post-attach thread-verify poll
        adapterConfig: {
          program: '/proc/1/root/pricer',
          initCommands: ['settings set target.exec-search-paths /proc/1/root'],
          token: 'attach-secret-must-not-be-echoed'
        }
      });

      expect(result.success).toBe(true);
      expect(JSON.stringify(result)).not.toContain('attach-secret-must-not-be-echoed');
      expect(result.data).not.toHaveProperty('attachConfig');
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

    it('anchors on the thread of the stop the debugger already reported, not the first listed thread (#759 attach)', async () => {
      // CodeLLDB stops the target on attach and reports the stop before the threads are
      // listed; on Windows the first listed thread is a thread-pool worker. No
      // pause-after-attach behaviour: a C/C++-flavoured direct-connect adapter.
      mockSession.language = DebugLanguage.CPP;
      vi.mocked(mockDependencies.adapterRegistry.getFactoryMetadata).mockResolvedValue(
        metadataWithModes({ launch: true, attach: 'direct-connect' })
      );
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(
        new FakeDebugAdapter({ language: DebugLanguage.CPP }).withAttachSupport({ directConnect: true })
      );
      const setCurrentThreadId = vi.fn();
      (mockProxyManager as unknown as { setCurrentThreadId: typeof setCurrentThreadId }).setCurrentThreadId = setCurrentThreadId;
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string, args?: unknown) => {
        if (command === 'threads') {
          mockSession.state = SessionState.PAUSED;
          mockSession.lastStop = { reason: 'exception', threadId: 37436, timestamp: Date.now() };
          return { success: true, body: { threads: [{ id: 5128, name: 'thread #1' }, { id: 37436, name: 'thread #2' }] } };
        }
        if (command === 'stackTrace') {
          const { threadId } = args as { threadId: number };
          // The stop thread's stack reaches the program's source; the first listed one is a worker.
          return { success: true, body: { stackFrames: threadId === 37436
            ? [{ id: 1, name: 'cob_sys_sleep', line: 0, column: 0 }, { id: 2, name: 'PAUSE_', line: 12, column: 0, source: { path: '/proj/pause.cob' } }]
            : [{ id: 3, name: 'NtWaitForWorkViaWorkerFactory', line: 0, column: 0, source: { name: '@NtWaitForWorkViaWorkerFactory' } }] } };
        }
        return {};
      });

      const result = await operations.attachToProcess('test-session', { host: '127.0.0.1', port: 12345, stopOnEntry: true });

      expect(result.success).toBe(true);
      expect(setCurrentThreadId).toHaveBeenCalledWith(37436);
      // The stop thread was checked first and won; no other thread was unwound.
      expect(mockProxyManager.sendDapRequest.mock.calls.filter(([command]) => command === 'stackTrace')).toHaveLength(1);
    });

    it('moves off a reported stop thread whose stack never reaches user code, to the first listed thread whose stack does (Windows attach break-in)', async () => {
      mockSession.language = DebugLanguage.CPP;
      vi.mocked(mockDependencies.adapterRegistry.getFactoryMetadata).mockResolvedValue(
        metadataWithModes({ launch: true, attach: 'direct-connect' })
      );
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(
        new FakeDebugAdapter({ language: DebugLanguage.CPP }).withAttachSupport({ directConnect: true })
      );
      const setCurrentThreadId = vi.fn();
      (mockProxyManager as unknown as { setCurrentThreadId: typeof setCurrentThreadId }).setCurrentThreadId = setCurrentThreadId;
      const stacks: Record<number, unknown[]> = {
        // CodeLLDB reports the attach stop on the break-in thread Windows injects: ntdll only.
        6660: [{ id: 1, name: 'DbgBreakPoint', line: 0, column: 0 }, { id: 2, name: 'DbgUiRemoteBreakin', line: 0, column: 0, source: { name: '@DbgUiRemoteBreakin' } }],
        5128: [{ id: 3, name: 'NtWaitForWorkViaWorkerFactory', line: 0, column: 0 }],
        9: [{ id: 4, name: 'Sleep', line: 0, column: 0 }, { id: 5, name: 'main', line: 20, column: 0, source: { path: '/proj/examples/cpp/pause_test.cpp' } }]
      };
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string, args?: unknown) => {
        if (command === 'threads') {
          mockSession.state = SessionState.PAUSED;
          mockSession.lastStop = { reason: 'exception', threadId: 6660, description: 'Exception 0x80000003 encountered at address 0x7ffb59163ab0', timestamp: Date.now() };
          return { success: true, body: { threads: [{ id: 5128, name: 'thread #1' }, { id: 6660, name: 'thread #3' }, { id: 9, name: 'thread #2' }] } };
        }
        if (command === 'stackTrace') {
          return { success: true, body: { stackFrames: stacks[(args as { threadId: number }).threadId] ?? [] } };
        }
        return {};
      });

      await operations.attachToProcess('test-session', { host: '127.0.0.1', port: 12345, stopOnEntry: true });

      expect(setCurrentThreadId).toHaveBeenCalledWith(9);
      expect(mockDependencies.logger.info).toHaveBeenCalledWith(expect.stringContaining('the first thread whose stack reaches user code (the stop was reported on 6660)'));
    });

    it('keeps the reported stop thread when no listed thread reaches user code', async () => {
      mockSession.language = DebugLanguage.CPP;
      vi.mocked(mockDependencies.adapterRegistry.getFactoryMetadata).mockResolvedValue(
        metadataWithModes({ launch: true, attach: 'direct-connect' })
      );
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(
        new FakeDebugAdapter({ language: DebugLanguage.CPP }).withAttachSupport({ directConnect: true })
      );
      const setCurrentThreadId = vi.fn();
      (mockProxyManager as unknown as { setCurrentThreadId: typeof setCurrentThreadId }).setCurrentThreadId = setCurrentThreadId;
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          mockSession.state = SessionState.PAUSED;
          mockSession.lastStop = { reason: 'exception', threadId: 6660, timestamp: Date.now() };
          return { success: true, body: { threads: [{ id: 5128, name: 'thread #1' }, { id: 6660, name: 'thread #3' }] } };
        }
        if (command === 'stackTrace') {
          return { success: true, body: { stackFrames: [{ id: 1, name: 'NtWaitForWorkViaWorkerFactory', line: 0, column: 0 }] } };
        }
        return {};
      });

      await operations.attachToProcess('test-session', { host: '127.0.0.1', port: 12345, stopOnEntry: true });

      expect(setCurrentThreadId).toHaveBeenCalledWith(6660);
    });

    it('falls back to the thread named main, else the first thread, when no stop was observed', async () => {
      mockSession.language = DebugLanguage.CPP;
      vi.mocked(mockDependencies.adapterRegistry.getFactoryMetadata).mockResolvedValue(
        metadataWithModes({ launch: true, attach: 'direct-connect' })
      );
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(
        new FakeDebugAdapter({ language: DebugLanguage.CPP }).withAttachSupport({ directConnect: true })
      );
      const setCurrentThreadId = vi.fn();
      (mockProxyManager as unknown as { setCurrentThreadId: typeof setCurrentThreadId }).setCurrentThreadId = setCurrentThreadId;
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) =>
        command === 'threads'
          ? { success: true, body: { threads: [{ id: 5128, name: 'thread #1' }, { id: 9, name: 'main' }] } }
          : {}
      );

      await operations.attachToProcess('test-session', { host: '127.0.0.1', port: 12345, stopOnEntry: true });

      expect(setCurrentThreadId).toHaveBeenCalledWith(9);
    });

    it('reserved keys in adapterConfig cannot flip the attach request', async () => {
      // The proxy worker re-reads request/__attachMode from the merged config
      // to choose the DAP sequence AND shutdown semantics (attach must detach
      // with terminateDebuggee=false) — extras must never rewrite them.
      vi.mocked(mockDependencies.adapterRegistry.getFactoryMetadata).mockResolvedValue(
        metadataWithModes({ launch: true, attach: 'direct-connect' })
      );
      const adapterStub = makeDirectConnectRubyAdapter();
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

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
      const adapterStub = new FakeDebugAdapter({
        language: DebugLanguage.RUBY,
        resolveExecutablePath: async () => 'ruby',
        buildAdapterCommand: () => ({ command: 'rdbg', args: [] }),
        // Declared but answering "no": not the same as never being asked.
        supportsAttach: () => false
      });
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

      await internals(operations).proxyLauncher.start(mockSession, {
        scriptPath: 'script.rb',
        dapLaunchArgs: {},
        dryRunSpawn: false,
        adapterLaunchConfig: { request: 'attach', __attachMode: true, foo: 1 }
      });

      // The launcher merges the caller's adapter extras into the generic config,
      // so the recorded argument carries keys GenericLaunchConfig does not name.
      const cfg = adapterStub.transformLaunchConfig.mock.calls[0][0] as Record<string, unknown>;
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
      transform: (cfg: GenericAttachConfig) => LanguageSpecificAttachConfig,
      supportedAttachKeys?: readonly string[]
    ) {
      return makeDirectConnectRubyAdapter({ transform, supportedAttachKeys });
    }

    beforeEach(() => {
      vi.mocked(mockDependencies.adapterRegistry.getFactoryMetadata).mockResolvedValue(
        metadataWithModes({ launch: true, attach: 'direct-connect' })
      );
    });

    it('surfaces adapterConfig keys the attach transform dropped in data.warning', async () => {
      const adapterStub = makeDirectConnectAdapter((cfg) => ({
        request: 'attach',
        keepMe: (cfg as Record<string, unknown>).keepMe
      }));
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { localRoot: 'C:\\work\\app', remoteRoot: '/app', keepMe: 1 }
      });

      expect(result.success).toBe(true);
      const warning = result.data?.warning;
      expect(warning).toContain('localRoot');
      expect(warning).toContain('remoteRoot');
      expect(warning).not.toContain('keepMe');
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('localRoot')
      );
    });

    it('does not report a key the adapter declares it consumes, even though the transform did not echo it (#759)', async () => {
      // The COBOL transform turns `sources`/`manifestDirs` into a manifest regeneration
      // and a private shim block: used, absent from the attach request, not dropped.
      const adapterStub = makeDirectConnectAdapter((cfg) => {
        const { sources: _sources, manifestDirs: _dirs, ...rest } = cfg as GenericAttachConfig & { sources?: string[]; manifestDirs?: string[] };
        void _sources; void _dirs;
        return rest;
      });
      adapterStub.supportedAttachKeys = ['program', 'sources', 'manifestDirs'];
      adapterStub.consumedAttachKeys = ['sources', 'manifestDirs'];
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { sources: ['/proj/src/payroll.cob'], manifestDirs: ['/proj/m'] }
      });

      expect(result.success).toBe(true);
      expect(result.data?.warning).toBeUndefined();
      expect(mockSession.attachDroppedConfigKeys).toBeUndefined();
    });

    it('never suggests a key for itself when a supported key really was dropped', async () => {
      const adapterStub = makeDirectConnectAdapter((cfg) => {
        const { manifestDirs: _dirs, ...rest } = cfg as GenericAttachConfig & { manifestDirs?: string[] };
        void _dirs;
        return rest;
      });
      adapterStub.supportedAttachKeys = ['program', 'manifestDirs'];
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { manifestDirs: ['/proj/m'] }
      });

      expect(result.data?.warning).toContain('manifestDirs');
      expect(result.data?.warning).not.toContain('did you mean manifestDirs');
    });

    it('emits no warning when the transform preserves every adapterConfig key', async () => {
      const adapterStub = makeDirectConnectAdapter((cfg) => cfg);
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { pathMappings: [{ localRoot: 'C:\\x', remoteRoot: '/app' }] }
      });

      expect(result.success).toBe(true);
      expect(result.data?.warning).toBeUndefined();
    });

    it('ignores dropped top-level attach params — only adapterConfig keys are the caller contract', async () => {
      // host/port legitimately vanish into normalized shapes (e.g. debugpy's
      // connect.*) — no warning unless the caller's adapterConfig lost keys.
      const adapterStub = makeDirectConnectAdapter(() => ({
        request: 'attach',
        connect: { host: '127.0.0.1', port: 12345 }
      }));
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false
      });

      expect(result.success).toBe(true);
      expect(result.data?.warning).toBeUndefined();
    });

    it('forwards keys outside supportedAttachKeys with a did-you-mean warning (issue #466)', async () => {
      const adapterStub = makeDirectConnectAdapter(
        (cfg) => cfg,
        ['pathMappings', 'justMyCode']
      );
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { pathMapping: [{ localRoot: 'C:\\x', remoteRoot: '/app' }] }
      });

      expect(result.success).toBe(true);
      const warning = result.data?.warning;
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
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { keepMe: 1, alsoSupported: 2 }
      });

      expect(result.success).toBe(true);
      const warning = result.data?.warning;
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
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { keepMe: 1, mystery: 2, localRoot: 'C:\\x' }
      });

      expect(result.success).toBe(true);
      const warning = result.data?.warning ?? '';
      expect(warning).toContain('were ignored: localRoot');
      expect(warning).toContain('forwarded to the ruby adapter as-is: mystery');
      expect(warning.indexOf('; ')).toBeGreaterThan(0);
      expect(warning).not.toContain('keepMe');
    });

    it('does not leak a stale warning into a later attach on the same session', async () => {
      const dropAll = makeDirectConnectAdapter(() => ({ request: 'attach' }));
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(dropAll);

      const first = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false,
        adapterConfig: { localRoot: 'C:\\x' }
      });
      expect(first.data?.warning).toContain('localRoot');

      // Simulate detach + re-attach with a clean adapterConfig
      mockSession.proxyManager = undefined;
      mockSession.state = SessionState.CREATED;
      const identity = makeDirectConnectAdapter((cfg) => cfg);
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(identity);

      const second = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false
      });
      expect(second.data?.warning).toBeUndefined();
    });
  });

  describe('post-attach breakpoint re-sync (issue #500)', () => {
    beforeEach(() => {
      vi.mocked(mockDependencies.adapterRegistry.getFactoryMetadata).mockResolvedValue(
        metadataWithModes({ launch: true, attach: 'direct-connect' })
      );
      vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(makeDirectConnectRubyAdapter());
    });

    it('re-sends every queued breakpoint file with forceFreshEcho after a successful attach', async () => {
      mockSession.breakpoints.set('bp-1', { id: 'bp-1', file: '/abs/app.js', line: 11, verified: false });
      mockSession.breakpoints.set('bp-2', { id: 'bp-2', file: '/abs/app.js', line: 22, verified: false });
      mockSession.breakpoints.set('bp-3', { id: 'bp-3', file: '/abs/lib.js', line: 5, verified: false });

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false
      });
      expect(result.success).toBe(true);

      const sbCalls = mockProxyManager.sendDapRequest.mock.calls.filter(
        (c: unknown[]) => c[0] === 'setBreakpoints'
      );
      expect(sbCalls).toHaveLength(2);
      // `mock.calls` of a bare vi.fn is `any[][]`, so naming the argument shape
      // here is an annotation on an `any`, not an assertion.
      type SetBreakpointsArgs = { source: { path: string }; breakpoints: unknown[]; __mcpForceFreshEcho?: boolean };
      const byPath = Object.fromEntries(
        sbCalls.map((c): [string, SetBreakpointsArgs] => {
          const args: SetBreakpointsArgs = c[1];
          return [args.source.path, args];
        })
      );
      expect(byPath['/abs/app.js'].breakpoints).toHaveLength(2);
      expect(byPath['/abs/lib.js'].breakpoints).toHaveLength(1);
      // The reserved key asks a child-mirroring proxy for an authoritative
      // echo even when js-debug diffs the re-send to a no-op (issue #500).
      expect(byPath['/abs/app.js'].__mcpForceFreshEcho).toBe(true);
      expect(byPath['/abs/lib.js'].__mcpForceFreshEcho).toBe(true);
    });

    it('a failing re-sync does not fail the attach', async () => {
      mockSession.breakpoints.set('bp-1', { id: 'bp-1', file: '/abs/app.js', line: 11, verified: false });
      mockProxyManager.sendDapRequest.mockImplementation(async (command: string) => {
        if (command === 'setBreakpoints') {
          throw new Error('adapter rejected setBreakpoints');
        }
        return {};
      });

      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false
      });
      expect(result.success).toBe(true);
    });

    it('sends no re-sync traffic when no breakpoints are queued', async () => {
      const result = await operations.attachToProcess('test-session', {
        host: '127.0.0.1',
        port: 12345,
        stopOnEntry: false
      });
      expect(result.success).toBe(true);
      const sbCalls = mockProxyManager.sendDapRequest.mock.calls.filter(
        (c: unknown[]) => c[0] === 'setBreakpoints'
      );
      expect(sbCalls).toHaveLength(0);
    });
  });

  it('appends an attach hint when launch executable resolution fails on an attach-capable adapter', async () => {
    const adapterStub = new FakeDebugAdapter({
      language: DebugLanguage.RUBY,
      resolveExecutablePath: async () => {
        throw new Error('ruby not found');
      }
    }).withAttachSupport();
    vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

    await expect(
      internals(operations).proxyLauncher.start(mockSession, { scriptPath: 'script.rb' })
    ).rejects.toThrow(/attach_to_process/);
  });

  it('omits the attach hint when the adapter has no attach support', async () => {
    mockSession.language = DebugLanguage.GO;
    const adapterStub = new FakeDebugAdapter({
      language: DebugLanguage.GO,
      resolveExecutablePath: async () => {
        throw new Error('go not found');
      }
    });
    vi.mocked(mockDependencies.adapterRegistry.create).mockResolvedValue(adapterStub);

    const failure = await internals(operations).proxyLauncher
      .start(mockSession, { scriptPath: 'main.go' })
      .then(
        () => {
          throw new Error('expected ProxyLauncher.start to reject');
        },
        (err: unknown) => err
      );

    expect(failure).toBeInstanceOf(DebugSessionCreationError);
    expect((failure as Error).message).not.toContain('attach_to_process');
  });
});
