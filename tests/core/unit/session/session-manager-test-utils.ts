/**
 * Shared test utilities for SessionManager tests
 */
import { vi } from 'vitest';
import { SessionManager, SessionManagerDependencies } from '../../../../src/session/session-manager.js';
import type { SessionStore } from '../../../../src/session/session-store.js';
import { MockProxyManager } from '../../../test-utils/mocks/mock-proxy-manager.js';
import { SessionStoreFactory } from '../../../../src/factories/session-store-factory.js';
import {
  IFileSystem,
  INetworkManager,
  ILogger,
  IProxyManagerFactory,
  IEnvironment
} from '../../../../src/interfaces/external-dependencies.js';
import { createMockFileSystem, createMockLogger } from '../../../test-utils/helpers/test-utils.js';
import { DebugLanguage, IAdapterRegistry, type AdapterPolicy } from '@debugmcp/shared';
import { createMockAdapterRegistry as createCentralizedMockAdapterRegistry } from '../../../test-utils/mocks/mock-adapter-registry.js';

/**
 * Create a mock environment for testing
 */
export function createMockEnvironment(overrides?: Partial<Record<string, string>>): IEnvironment {
  return {
    get: vi.fn((key: string) => overrides?.[key] ?? process.env[key]),
    getAll: vi.fn(() => ({ ...process.env, ...overrides })),
    getCurrentWorkingDirectory: vi.fn(() => process.cwd())
  };
}

/**
 * Create a mock adapter registry for testing
 * Uses the centralized mock to ensure consistency
 */
export function createMockAdapterRegistry(): IAdapterRegistry {
  return createCentralizedMockAdapterRegistry();
}

/**
 * Create mock dependencies for testing
 */
export function createMockDependencies(): SessionManagerDependencies & { 
  mockProxyManager: MockProxyManager;
  mockFileSystem: IFileSystem;
  mockLogger: ILogger;
  mockNetworkManager: INetworkManager;
  mockEnvironment: IEnvironment;
} {
  const mockProxyManager = new MockProxyManager();
  const mockFileSystem = createMockFileSystem();
  const mockLogger = createMockLogger();
  const mockEnvironment = createMockEnvironment();
  
  const mockNetworkManager: INetworkManager = {
    createServer: vi.fn(),
    findFreePort: vi.fn().mockResolvedValue(12345)
  };
  
  const mockProxyManagerFactory: IProxyManagerFactory = {
    create: vi.fn().mockReturnValue(mockProxyManager)
  };
  
  const mockSessionStoreFactory = new SessionStoreFactory();
  
  const mockPathUtils = {
    isAbsolute: vi.fn((p: string) => p.startsWith('/') || /^[A-Za-z]:/.test(p)),
    resolve: vi.fn((...args: string[]) => args.join('/')),
    join: vi.fn((...args: string[]) => args.join('/')),
    dirname: vi.fn((p: string) => p.substring(0, p.lastIndexOf('/'))),
    basename: vi.fn((p: string) => p.substring(p.lastIndexOf('/') + 1)),
    sep: '/'
  };
  
  const mockAdapterRegistry = createMockAdapterRegistry();
  
  return {
    mockProxyManager,
    mockFileSystem,
    mockLogger,
    mockNetworkManager,
    mockEnvironment,
    fileSystem: mockFileSystem,
    networkManager: mockNetworkManager,
    logger: mockLogger,
    environment: mockEnvironment,
    proxyManagerFactory: mockProxyManagerFactory,
    sessionStoreFactory: mockSessionStoreFactory,
    pathUtils: mockPathUtils,
    adapterRegistry: mockAdapterRegistry
  };
}

/**
 * Overlay hooks on the session store's adapter policy.
 *
 * The store's lookup is the seam the session layer reads policy from —
 * function-breakpoint name resolution and the launch warnings both go through
 * it — so a test that wants a policy behavior overrides it here rather than
 * standing up a real adapter.
 */
export function overridePolicy(
  sessionManager: SessionManager,
  overrides: Partial<AdapterPolicy>
): void {
  const store = (sessionManager as unknown as { sessionStore: SessionStore }).sessionStore;
  const original = store.selectPolicy.bind(store);
  vi.spyOn(store, 'selectPolicy').mockImplementation((language: DebugLanguage) => ({
    ...original(language),
    ...overrides
  }));
}

/**
 * A session with a live, paused debuggee — the state in which breakpoint
 * changes reach the wire. `clearDapCalls` (default true) drops the launch's
 * own DAP traffic so a test asserts only on the requests it caused.
 *
 * Requires fake timers (`vi.useFakeTimers`): the launch is driven by
 * `runAllTimersAsync`.
 */
export async function createPausedSession(
  sessionManager: SessionManager,
  dependencies: ReturnType<typeof createMockDependencies>,
  options?: { clearDapCalls?: boolean }
) {
  const session = await sessionManager.createSession({
    language: DebugLanguage.MOCK,
    executablePath: 'python'
  });

  await sessionManager.startDebugging(session.id, 'test.py');
  await vi.runAllTimersAsync();

  // Simulate being paused with a thread ID
  dependencies.mockProxyManager.simulateStopped(1, 'entry');

  if (options?.clearDapCalls !== false) {
    dependencies.mockProxyManager.dapRequestCalls = [];
  }

  return session;
}
