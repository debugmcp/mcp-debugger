/**
 * Factory for creating ProxyManager instances
 * Enables dependency injection and easy mocking for tests
 */
import { IProxyManager, ProxyManager } from '../proxy/proxy-manager.js';
import { IProxyProcessLauncher } from '../interfaces/process-interfaces.js';
import { IFileSystem, ILogger } from '../interfaces/external-dependencies.js';

/**
 * Interface for ProxyManager factory
 */
export interface IProxyManagerFactory {
  create(): IProxyManager;
}

/**
 * Production implementation of ProxyManager factory
 */
export class ProxyManagerFactory implements IProxyManagerFactory {
  constructor(
    private proxyProcessLauncher: IProxyProcessLauncher,
    private fileSystem: IFileSystem,
    private logger: ILogger
  ) {}
  
  create(): IProxyManager {
    return new ProxyManager(
      this.proxyProcessLauncher,
      this.fileSystem,
      this.logger
    );
  }
}

/**
 * Mock implementation of ProxyManager factory for testing
 * This creates a simple stub that should be replaced by test code
 * with the actual MockProxyManager from tests/mocks/mock-proxy-manager.ts
 */
export class MockProxyManagerFactory implements IProxyManagerFactory {
  public createdManagers: IProxyManager[] = [];
  public createFn?: () => IProxyManager;
  
  create(): IProxyManager {
    if (this.createFn) {
      const manager = this.createFn();
      this.createdManagers.push(manager);
      return manager;
    }
    
    // Return a minimal stub if no custom create function is provided
    throw new Error('MockProxyManagerFactory requires createFn to be set in tests');
  }
}
