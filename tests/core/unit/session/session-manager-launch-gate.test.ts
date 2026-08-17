/**
 * Launch-gate behavior of SessionManagerOperations.startDebugging (issue #360):
 * - a language whose factory validation reports invalid fails fast with the
 *   availability reason, before any state mutation or proxy teardown
 * - probe failures (throwing validate, missing getFactory) fail open
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManagerOperations } from '../../../../src/session/session-manager-operations.js';
import { SessionLifecycleState, SessionState } from '@debugmcp/shared';
import { createEnvironmentMock } from '../../../test-utils/mocks/environment.js';

class TestableSessionManagerOperations extends SessionManagerOperations {
  protected async handleAutoContinue(_sessionId: string): Promise<void> {
    // no-op for tests
  }
}

describe('SessionManagerOperations launch gate (issue #360)', () => {
  let operations: SessionManagerOperations;
  let mockSessionStore: any;
  let mockDependencies: any;
  let mockSession: any;

  beforeEach(() => {
    const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

    mockSession = {
      id: 'test-session',
      name: 'Test Session',
      language: 'javascript',
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
      proxyManagerFactory: { create: vi.fn() },
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
        getFactory: vi.fn()
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

  it('fails fast with the availability reason when the factory reports invalid', async () => {
    mockDependencies.adapterRegistry.getFactory.mockResolvedValue({
      validate: vi.fn().mockResolvedValue({
        valid: false,
        errors: ['js-debug adapter not found. Run build script to vendor js-debug'],
        warnings: []
      })
    });

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
    mockDependencies.adapterRegistry.getFactory.mockResolvedValue({
      validate: vi.fn().mockResolvedValue({ valid: false, errors: ['no toolchain'], warnings: [] })
    });

    const result = await operations.startDebugging(
      'test-session', '/path/to/script.js', undefined, undefined, true
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('no toolchain');
  });

  it('fails open when validate throws (proceeds into the launch path)', async () => {
    mockDependencies.adapterRegistry.getFactory.mockResolvedValue({
      validate: vi.fn().mockRejectedValue(new Error('probe exploded'))
    });

    const result = await operations.startDebugging('test-session', '/path/to/script.js');

    // The launch proceeds past the gate and fails later for unrelated
    // mock-infrastructure reasons; what matters is that the gate did not
    // block and state moved off CREATED.
    expect(result.error ?? '').not.toContain("Cannot start a 'javascript' debug session");
    expect(mockSessionStore.updateState).toHaveBeenCalled();
  });

  it('fails open when the registry has no getFactory', async () => {
    delete mockDependencies.adapterRegistry.getFactory;

    const result = await operations.startDebugging('test-session', '/path/to/script.js');

    expect(result.error ?? '').not.toContain("Cannot start a 'javascript' debug session");
    expect(mockSessionStore.updateState).toHaveBeenCalled();
  });

  it('caches the probe result across calls (single validate for two launches)', async () => {
    const validate = vi.fn().mockResolvedValue({ valid: false, errors: ['no toolchain'], warnings: [] });
    mockDependencies.adapterRegistry.getFactory.mockResolvedValue({ validate });

    await operations.startDebugging('test-session', '/path/to/script.js');
    await operations.startDebugging('test-session', '/path/to/script.js');

    expect(validate).toHaveBeenCalledTimes(1);
  });
});
