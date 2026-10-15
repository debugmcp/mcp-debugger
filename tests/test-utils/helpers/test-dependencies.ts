/**
 * Test-only dependencies - DO NOT import this file in production code!
 * This file imports Vitest and other test frameworks.
 */
import { vi } from 'vitest';
import type {
  IEnvironment,
  ILogger,
  INetworkManager,
  IProcessManager,
  IProxyProcessLauncher
} from '@debugmcp/shared';
import { createMockFileSystem } from './test-utils.js';
import type { Dependencies } from '../../../src/container/dependencies.js';
import { MockSessionStoreFactory } from '../../../src/factories/session-store-factory.js';
import { MockProxyManagerFactory } from '../../../src/factories/proxy-manager-factory.js';
import { MockProxyManager } from '../mocks/mock-proxy-manager.js';
import { createMockAdapterRegistry } from '../mocks/mock-adapter-registry.js';

// The one mock file system lives in test-utils.ts (issue #742); re-exported here so the
// container-shaped helpers and their importers keep one import path.
export { createMockFileSystem };

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
