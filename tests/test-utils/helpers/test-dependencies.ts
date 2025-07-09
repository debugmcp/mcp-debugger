/**
 * Test-only dependencies - DO NOT import this file in production code!
 * This file imports Vitest and other test frameworks.
 */
import { vi } from 'vitest';
import { 
  IFileSystem, 
  IProcessManager, 
  INetworkManager, 
  ILogger,
  IProxyManagerFactory,
  IEnvironment
} from '../../../src/interfaces/external-dependencies.js';
import { 
  IProcessLauncher, 
  IDebugTargetLauncher, 
  IProxyProcessLauncher 
} from '../../../src/interfaces/process-interfaces.js';
import { ISessionStoreFactory } from '../../../src/factories/session-store-factory.js';
import { MockSessionStoreFactory } from '../../../src/factories/session-store-factory.js';
import { MockProxyManagerFactory } from '../../../src/factories/proxy-manager-factory.js';
import { MockProxyManager } from '../mocks/mock-proxy-manager.js';
import { DebugMcpServer, DebugMcpServerOptions } from '../../../src/server.js';
import { SessionManagerDependencies } from '../../../src/session/session-manager.js';
import { IPathUtils } from '../../../src/interfaces/path-utils.js';
import { createMockAdapterRegistry } from '../mocks/mock-adapter-registry.js';

/**
 * Creates a DebugMcpServer configured for testing
 * @param options Additional options to override defaults
 * @returns A new DebugMcpServer instance configured for tests
 */
export function createTestServer(options: DebugMcpServerOptions = {}): DebugMcpServer {
  // Always use 'error' log level for tests unless explicitly overridden
  const testOptions: DebugMcpServerOptions = {
    logLevel: 'error',
    ...options
  };
  
  return new DebugMcpServer(testOptions);
}

/**
 * Complete set of application dependencies
 */
export interface Dependencies {
  // Core implementations
  fileSystem: IFileSystem;
  processManager: IProcessManager;
  networkManager: INetworkManager;
  logger: ILogger;
  
  // Process launchers
  processLauncher: IProcessLauncher;
  proxyProcessLauncher: IProxyProcessLauncher;
  debugTargetLauncher: IDebugTargetLauncher;
  
  // Factories
  proxyManagerFactory: IProxyManagerFactory;
  sessionStoreFactory: ISessionStoreFactory;
}

/**
 * Creates test dependencies with fake/mock implementations
 * @returns Complete dependency container for testing
 */
export async function createTestDependencies(): Promise<Dependencies> {
  const logger = createMockLogger();
  const fileSystem = createMockFileSystem();
  const processManager = createMockProcessManager();
  const networkManager = createMockNetworkManager();
  
  // Note: These will be imported from tests/implementations/test/ after we move them
  const { FakeProcessLauncher, FakeProxyProcessLauncher, FakeDebugTargetLauncher } = 
    await import('../../implementations/test/fake-process-launcher.ts');
  
  const processLauncher = new FakeProcessLauncher();
  const proxyProcessLauncher = new FakeProxyProcessLauncher();
  const debugTargetLauncher = new FakeDebugTargetLauncher();
  
  const proxyManagerFactory = new MockProxyManagerFactory();
  proxyManagerFactory.createFn = () => new MockProxyManager();
  const sessionStoreFactory = new MockSessionStoreFactory();
  
  return {
    fileSystem,
    processManager,
    networkManager,
    logger,
    processLauncher,
    proxyProcessLauncher,
    debugTargetLauncher,
    proxyManagerFactory,
    sessionStoreFactory
  };
}

/**
 * Creates mock SessionManager dependencies for testing
 * @returns Complete SessionManagerDependencies with all mocks
 */
export function createMockSessionManagerDependencies(): SessionManagerDependencies {
  return {
    fileSystem: createMockFileSystem(),
    networkManager: createMockNetworkManager(),
    logger: createMockLogger(),
    proxyManagerFactory: new MockProxyManagerFactory(),
    sessionStoreFactory: new MockSessionStoreFactory(),
    debugTargetLauncher: createMockDebugTargetLauncher(),
    environment: createMockEnvironment(),
    pathUtils: createMockPathUtils(),
    adapterRegistry: createMockAdapterRegistry()
  };
}

/**
 * Creates a complete set of mock dependencies for testing
 * All methods are vi.fn() mocks with proper typing
 * @returns Dependencies with all methods mocked
 */
export function createMockDependencies(): Dependencies {
  const fileSystem = createMockFileSystem();
  const processManager = createMockProcessManager();
  const networkManager = createMockNetworkManager();
  const logger = createMockLogger();
  
  const processLauncher = createMockProcessLauncher();
  const proxyProcessLauncher = createMockProxyProcessLauncher();
  const debugTargetLauncher = createMockDebugTargetLauncher();
  
  const proxyManagerFactory = new MockProxyManagerFactory();
  proxyManagerFactory.createFn = () => new MockProxyManager();
  const sessionStoreFactory = new MockSessionStoreFactory();
  
  return {
    fileSystem,
    processManager,
    networkManager,
    logger,
    processLauncher,
    proxyProcessLauncher,
    debugTargetLauncher,
    proxyManagerFactory,
    sessionStoreFactory
  };
}

// Mock creation helpers

export function createMockLogger(): ILogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  };
}

export function createMockFileSystem(): IFileSystem {
  return {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    exists: vi.fn(),
    existsSync: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    rmdir: vi.fn(),
    ensureDir: vi.fn(),
    ensureDirSync: vi.fn(),
    pathExists: vi.fn(),
    remove: vi.fn(),
    copy: vi.fn(),
    outputFile: vi.fn()
  };
}

export function createMockProcessManager(): IProcessManager {
  return {
    spawn: vi.fn(),
    exec: vi.fn()
  };
}

export function createMockNetworkManager(): INetworkManager {
  return {
    createServer: vi.fn(),
    findFreePort: vi.fn().mockResolvedValue(5678)
  };
}

export function createMockProcessLauncher(): IProcessLauncher {
  return {
    launch: vi.fn()
  };
}

export function createMockProxyProcessLauncher(): IProxyProcessLauncher {
  return {
    launchProxy: vi.fn()
  };
}

export function createMockDebugTargetLauncher(): IDebugTargetLauncher {
  return {
    launchPythonDebugTarget: vi.fn()
  };
}

export function createMockEnvironment(): IEnvironment {
  return {
    get: vi.fn((key: string) => process.env[key]),
    getAll: vi.fn(() => ({ ...process.env })),
    getCurrentWorkingDirectory: vi.fn(() => process.cwd())
  };
}

export function createMockPathUtils(): IPathUtils {
  return {
    isAbsolute: vi.fn((p: string) => {
      if (process.platform === 'win32') {
        return /^[A-Za-z]:[\\\/]/.test(p) || /^\\\\/.test(p);
      } else {
        return p.startsWith('/');
      }
    }),
    resolve: vi.fn((...args: string[]) => {
      return args.join('/').replace(/\/+/g, '/');
    }),
    join: vi.fn((...args: string[]) => args.join('/')),
    dirname: vi.fn((p: string) => {
      const lastSlash = p.lastIndexOf('/');
      return lastSlash === -1 ? '.' : p.substring(0, lastSlash);
    }),
    basename: vi.fn((p: string, ext?: string) => {
      const lastSlash = p.lastIndexOf('/');
      const base = lastSlash === -1 ? p : p.substring(lastSlash + 1);
      if (ext && base.endsWith(ext)) {
        return base.substring(0, base.length - ext.length);
      }
      return base;
    }),
    sep: '/'
  };
}

/**
 * Create a full adapter registry for testing
 * @returns Adapter registry with Python adapter
 */
export async function createFullAdapterRegistry() {
  // Dynamic imports to avoid require() usage
  const { getAdapterRegistry, resetAdapterRegistry } = await import('../../../src/adapters/adapter-registry.js');
  const { PythonAdapterFactory } = await import('../../../src/adapters/python/python-adapter-factory.js');
  const { MockAdapterFactory } = await import('../../../src/adapters/mock/mock-adapter-factory.js');
  
  // Reset any existing registry
  resetAdapterRegistry();
  
  // Get a fresh registry instance
  const registry = getAdapterRegistry();
  
  // Register adapters
  await registry.register('python', new PythonAdapterFactory());
  await registry.register('mock', new MockAdapterFactory());
  
  return registry;
}
