/**
 * Launch-gate behavior of SessionManagerOperations.startDebugging (issue #360):
 * - a language whose factory validation reports invalid fails fast with the
 *   availability reason, before any state mutation or proxy teardown
 * - probe failures (throwing validate, missing getFactory) fail open
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { SessionManagerOperations } from '../../../../src/session/session-manager-operations.js';
import type { SessionManagerDependencies } from '../../../../src/session/session-manager-core.js';
import { SessionStore, type ManagedSession } from '../../../../src/session/session-store.js';
import { MockProxyManagerFactory } from '../../../../src/factories/proxy-manager-factory.js';
import {
  DebugLanguage,
  SessionLifecycleState,
  SessionState,
  type IAdapterFactory
} from '@debugmcp/shared';
import {
  createMockEnvironment,
  createMockFileSystem,
  createMockLogger,
  createMockNetworkManager
} from '../../../test-utils/helpers/test-dependencies.js';
import { createMockAdapterRegistry } from '../../../test-utils/mocks/mock-adapter-registry.js';

class TestableSessionManagerOperations extends SessionManagerOperations {
  protected async handleAutoContinue(_sessionId: string): Promise<void> {
    // no-op for tests
  }
}

/** The store members these tests drive. Deliberately partial: the rest of SessionStore is never reached. */
type PartialSessionStore = Pick<
  SessionStore,
  'get' | 'getOrThrow' | 'update' | 'updateState' | 'remove' | 'getAll'
>;

/**
 * The launch gate's availability probe reads only `validate()` off the factory
 * (`ProbeableAdapterFactory`); `createAdapter`/`getMetadata` are never reached,
 * so the double is deliberately partial behind one overlap-checked cast.
 */
function probeOnlyFactory(validate: IAdapterFactory['validate']): IAdapterFactory {
  const partial: Pick<IAdapterFactory, 'validate'> = { validate };
  return partial as IAdapterFactory;
}

describe('SessionManagerOperations launch gate (issue #360)', () => {
  let operations: SessionManagerOperations;
  let mockSessionStore: { [K in keyof PartialSessionStore]: Mock<PartialSessionStore[K]> };
  let mockDependencies: SessionManagerDependencies;
  let mockSession: ManagedSession;

  beforeEach(() => {
    mockSession = {
      id: 'test-session',
      name: 'Test Session',
      language: DebugLanguage.JAVASCRIPT,
      state: SessionState.CREATED,
      sessionLifecycle: SessionLifecycleState.CREATED,
      proxyManager: undefined,
      breakpoints: new Map(),
      functionBreakpoints: new Map(),
      createdAt: new Date(),
      updatedAt: new Date(),
      executablePath: undefined
    };

    mockSessionStore = {
      get: vi.fn<PartialSessionStore['get']>().mockReturnValue(mockSession),
      getOrThrow: vi.fn<PartialSessionStore['getOrThrow']>().mockReturnValue(mockSession),
      update: vi.fn<PartialSessionStore['update']>(),
      updateState: vi.fn<PartialSessionStore['updateState']>().mockImplementation(
        (_sessionId: string, newState: SessionState) => {
          mockSession.state = newState;
        }
      ),
      remove: vi.fn<PartialSessionStore['remove']>().mockReturnValue(true),
      getAll: vi.fn<PartialSessionStore['getAll']>().mockReturnValue([mockSession])
    };

    const fileSystem = createMockFileSystem();
    vi.mocked(fileSystem.pathExists).mockResolvedValue(true);
    vi.mocked(fileSystem.ensureDir).mockResolvedValue(undefined);
    const networkManager = createMockNetworkManager();
    vi.mocked(networkManager.findFreePort).mockResolvedValue(9000);

    mockDependencies = {
      logger: createMockLogger(),
      fileSystem,
      networkManager,
      environment: createMockEnvironment(),
      adapterRegistry: createMockAdapterRegistry(),
      // No createFn: nothing here reaches proxy creation on purpose (the gate is
      // under test), and the fail-open cases fail loudly there if they do.
      proxyManagerFactory: new MockProxyManagerFactory(),
      // One sanctioned cast: the store double is deliberately partial (see PartialSessionStore).
      sessionStoreFactory: { create: vi.fn(() => mockSessionStore as unknown as SessionStore) }
    };

    operations = new TestableSessionManagerOperations({ logDirBase: '/tmp/logs' }, mockDependencies);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fails fast with the availability reason when the factory reports invalid', async () => {
    vi.mocked(mockDependencies.adapterRegistry.getFactory).mockResolvedValue(
      probeOnlyFactory(
        vi.fn().mockResolvedValue({
          valid: false,
          errors: ['js-debug adapter not found. Run build script to vendor js-debug'],
          warnings: []
        })
      )
    );

    const result = await operations.startDebugging('test-session', '/path/to/script.js');

    expect(result.success).toBe(false);
    expect(result.error).toContain('js-debug adapter not found');
    expect(result.error).toContain("Cannot start a 'javascript' debug session");
    // No state mutation happened: still CREATED, no lifecycle update, no launch recorded
    expect(mockSession.state).toBe(SessionState.CREATED);
    expect(mockSessionStore.updateState).not.toHaveBeenCalled();
    expect(mockSessionStore.update).not.toHaveBeenCalled();
    expect(mockSession.lastLaunch).toBeUndefined();
    expect(mockDependencies.adapterRegistry.create).not.toHaveBeenCalled();
  });

  it('gates dryRunSpawn launches too', async () => {
    vi.mocked(mockDependencies.adapterRegistry.getFactory).mockResolvedValue(
      probeOnlyFactory(
        vi.fn().mockResolvedValue({ valid: false, errors: ['no toolchain'], warnings: [] })
      )
    );

    const result = await operations.startDebugging(
      'test-session', '/path/to/script.js', undefined, undefined, true
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('no toolchain');
  });

  it('fails open when validate throws (proceeds into the launch path)', async () => {
    vi.mocked(mockDependencies.adapterRegistry.getFactory).mockResolvedValue(
      probeOnlyFactory(vi.fn().mockRejectedValue(new Error('probe exploded')))
    );

    const result = await operations.startDebugging('test-session', '/path/to/script.js');

    // The launch proceeds past the gate and fails later for unrelated
    // mock-infrastructure reasons; what matters is that the gate did not
    // block and state moved off CREATED.
    expect(result.error ?? '').not.toContain("Cannot start a 'javascript' debug session");
    expect(mockSessionStore.updateState).toHaveBeenCalled();
  });

  it('fails open when the registry has no getFactory', async () => {
    Reflect.deleteProperty(mockDependencies.adapterRegistry, 'getFactory');

    const result = await operations.startDebugging('test-session', '/path/to/script.js');

    expect(result.error ?? '').not.toContain("Cannot start a 'javascript' debug session");
    expect(mockSessionStore.updateState).toHaveBeenCalled();
  });

  it('caches the probe result across calls (single validate for two launches)', async () => {
    const validate = vi.fn().mockResolvedValue({ valid: false, errors: ['no toolchain'], warnings: [] });
    vi.mocked(mockDependencies.adapterRegistry.getFactory).mockResolvedValue(
      probeOnlyFactory(validate)
    );

    await operations.startDebugging('test-session', '/path/to/script.js');
    await operations.startDebugging('test-session', '/path/to/script.js');

    expect(validate).toHaveBeenCalledTimes(1);
  });
});
