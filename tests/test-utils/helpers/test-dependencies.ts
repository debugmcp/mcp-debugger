/**
 * Test-only dependencies - DO NOT import this file in production code!
 * This file imports Vitest and other test frameworks.
 */
import { vi } from 'vitest';
import type {
  IEnvironment,
  IFileSystem,
  ILogger,
  INetworkManager,
  IProcessManager,
  IProxyProcessLauncher
} from '@debugmcp/shared';
import type { Dependencies } from '../../../src/container/dependencies.js';
import { MockSessionStoreFactory } from '../../../src/factories/session-store-factory.js';
import { MockProxyManagerFactory } from '../../../src/factories/proxy-manager-factory.js';
import { MockProxyManager } from '../mocks/mock-proxy-manager.js';
import { createMockAdapterRegistry } from '../mocks/mock-adapter-registry.js';

/**
 * Creates a complete set of mock dependencies for testing
 * All methods are vi.fn() mocks with proper typing
 * @returns The container's Dependencies with all methods mocked
 */
export function createMockDependencies(): Dependencies {
  const fileSystem = createMockFileSystem();
  const processManager = createMockProcessManager();
  const networkManager = createMockNetworkManager();
  const logger = createMockLogger();
  const environment = createMockEnvironment();

  const proxyProcessLauncher = createMockProxyProcessLauncher();

  const proxyManagerFactory = new MockProxyManagerFactory();
  proxyManagerFactory.createFn = () => new MockProxyManager();
  const sessionStoreFactory = new MockSessionStoreFactory();
  const adapterRegistry = createMockAdapterRegistry();

  return {
    fileSystem,
    processManager,
    networkManager,
    logger,
    environment,
    proxyProcessLauncher,
    proxyManagerFactory,
    sessionStoreFactory,
    adapterRegistry
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
    readTail: vi.fn(),
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

export function createMockProxyProcessLauncher(): IProxyProcessLauncher {
  return {
    launchProxy: vi.fn()
  };
}

export function createMockEnvironment(): IEnvironment {
  return {
    get: vi.fn((key: string) => process.env[key]),
    getAll: vi.fn(() => ({ ...process.env })),
    getCurrentWorkingDirectory: vi.fn(() => process.cwd())
  };
}
