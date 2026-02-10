/**
 * Shared test utilities for SessionManager tests
 */
import { vi } from 'vitest';
import { SessionManagerDependencies } from '../../../../src/session/session-manager.js';
import { MockProxyManager } from '../../../test-utils/mocks/mock-proxy-manager.js';
import { SessionStoreFactory } from '../../../../src/factories/session-store-factory.js';
import { 
  IFileSystem, 
  INetworkManager, 
  ILogger,
  IProxyManagerFactory,
  IEnvironment
} from '../../../../src/interfaces/external-dependencies.js';
import { IDebugTargetLauncher } from '../../../../src/interfaces/process-interfaces.js';
import { createMockFileSystem, createMockLogger } from '../../../test-utils/helpers/test-utils.js';
import { IAdapterRegistry } from '@debugmcp/shared';
import { createMockAdapterRegistry as createCentralizedMockAdapterRegistry } from '../../../test-utils/mocks/mock-adapter-registry.js';

// Mock modules that SessionManager may import transitively during tests
vi.mock('./dist/implementations/index.js', () => ({
  FileSystemImpl: vi.fn(),
  ProcessManagerImpl: vi.fn(),
  NetworkManagerImpl: vi.fn(),
  ProcessLauncherImpl: vi.fn(),
  ProxyProcessLauncherImpl: vi.fn(),
  DebugTargetLauncherImpl: vi.fn(),
})); 

vi.mock('./dist/proxy/proxy-manager.js', () => ({ 
  ProxyManager: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    sendDapRequest: vi.fn().mockResolvedValue({ success: true }),
    isRunning: vi.fn().mockReturnValue(false),
    getCurrentThreadId: vi.fn().mockReturnValue(null),
  })),
}));

/**
 * Create a mock environment for testing
 */
export function createMockEnvironment(overrides?: Partial<Record<string, string>>): IEnvironment {
  return {
    get: vi.fn((key: string) => overrides?.[key] || process.env[key]),
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
  
  const mockDebugTargetLauncher: IDebugTargetLauncher = {
    launchPythonDebugTarget: vi.fn().mockResolvedValue({ 
      process: { pid: 1234 } as unknown as any, 
      debugPort: 5678,
      terminate: vi.fn().mockResolvedValue(undefined)
    })
  };
  
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
    debugTargetLauncher: mockDebugTargetLauncher,
    pathUtils: mockPathUtils,
    adapterRegistry: mockAdapterRegistry
  };
}
