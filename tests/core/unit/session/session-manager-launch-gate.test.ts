/**
 * Launch-gate behavior of SessionManagerOperations.startDebugging (issue #360):
 * - a language whose factory validation reports invalid fails fast with the
 *   availability reason, before any state mutation or proxy teardown
 * - probe failures (throwing validate, missing getFactory) fail open
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  createMockLogger,
  createMockNetworkManager
} from '../../../test-utils/helpers/test-dependencies.js';
import { createMockFileSystem } from '../../../test-utils/helpers/test-utils.js';
import { createMockAdapterRegistry } from '../../../test-utils/mocks/mock-adapter-registry.js';
import {
  createPartialSessionStore,
  type PartialSessionStoreMock
} from '../../../test-utils/mocks/session-doubles.js';

class TestableSessionManagerOperations extends SessionManagerOperations {
  protected async handleAutoContinue(_sessionId: string): Promise<void> {
    // no-op for tests
  }
}

/**
 * The launch gate's availability probe (`ProbeableAdapterFactory` in
 * src/utils/language-availability.ts) drives `validate()`; it also calls
 * `getMetadata()`, but inside a try/catch that warns and falls back to the
 * registry entry's attach declaration, so the missing member only exercises
 * that fallback. `createAdapter` is never reached. The double is deliberately
 * partial behind one overlap-checked cast.
 */
function probeOnlyFactory(validate: IAdapterFactory['validate']): IAdapterFactory {
  const partial: Pick<IAdapterFactory, 'validate'> = { validate };
  return partial as IAdapterFactory;
}

describe('SessionManagerOperations launch gate (issue #360)', () => {
  let operations: SessionManagerOperations;
  let mockSessionStore: PartialSessionStoreMock;
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

    mockSessionStore = createPartialSessionStore(mockSession);

    // Pre-configured helper: pathExists/ensureDir already answer true/undefined.
    const fileSystem = createMockFileSystem();
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
        vi.fn<IAdapterFactory['validate']>().mockResolvedValue({
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
        vi.fn<IAdapterFactory['validate']>().mockResolvedValue({ valid: false, errors: ['no toolchain'], warnings: [] })
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
      probeOnlyFactory(vi.fn<IAdapterFactory['validate']>().mockRejectedValue(new Error('probe exploded')))
    );

    const result = await operations.startDebugging('test-session', '/path/to/script.js');

    // The launch proceeds past the gate and fails later for unrelated
    // mock-infrastructure reasons; what matters is that the gate did not
    // block and state moved off CREATED. Adapter creation (AdapterLease.acquire)
    // sits past the gate, so its having run is the positive proof.
    expect(result.error ?? '').not.toContain("Cannot start a 'javascript' debug session");
    expect(mockSessionStore.updateState).toHaveBeenCalled();
    expect(mockDependencies.adapterRegistry.create).toHaveBeenCalled();
  });

  it('fails open when the registry has no getFactory', async () => {
    Reflect.deleteProperty(mockDependencies.adapterRegistry, 'getFactory');

    const result = await operations.startDebugging('test-session', '/path/to/script.js');

    expect(result.error ?? '').not.toContain("Cannot start a 'javascript' debug session");
    expect(mockSessionStore.updateState).toHaveBeenCalled();
    expect(mockDependencies.adapterRegistry.create).toHaveBeenCalled();
  });

  it('caches the probe result across calls (single validate for two launches)', async () => {
    const validate = vi.fn<IAdapterFactory['validate']>().mockResolvedValue({ valid: false, errors: ['no toolchain'], warnings: [] });
    vi.mocked(mockDependencies.adapterRegistry.getFactory).mockResolvedValue(
      probeOnlyFactory(validate)
    );

    await operations.startDebugging('test-session', '/path/to/script.js');
    await operations.startDebugging('test-session', '/path/to/script.js');

    expect(validate).toHaveBeenCalledTimes(1);
  });
});
