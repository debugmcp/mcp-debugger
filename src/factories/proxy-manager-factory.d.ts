/**
 * Factory for creating ProxyManager instances
 * Enables dependency injection and easy mocking for tests
 */
import { IProxyManager } from '../proxy/proxy-manager.js';
import { IProxyProcessLauncher } from '@debugmcp/shared';
import { IFileSystem, ILogger } from '@debugmcp/shared';
import { IDebugAdapter } from '@debugmcp/shared';
/**
 * Interface for ProxyManager factory
 */
export interface IProxyManagerFactory {
    create(adapter?: IDebugAdapter): IProxyManager;
}
/**
 * Production implementation of ProxyManager factory
 */
export declare class ProxyManagerFactory implements IProxyManagerFactory {
    private proxyProcessLauncher;
    private fileSystem;
    private logger;
    constructor(proxyProcessLauncher: IProxyProcessLauncher, fileSystem: IFileSystem, logger: ILogger);
    create(adapter?: IDebugAdapter): IProxyManager;
}
/**
 * Mock implementation of ProxyManager factory for testing
 * This creates a simple stub that should be replaced by test code
 * with the actual MockProxyManager from tests/mocks/mock-proxy-manager.ts
 */
export declare class MockProxyManagerFactory implements IProxyManagerFactory {
    createdManagers: IProxyManager[];
    createFn?: (adapter?: IDebugAdapter) => IProxyManager;
    lastAdapter?: IDebugAdapter;
    create(adapter?: IDebugAdapter): IProxyManager;
}
