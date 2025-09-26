/**
 * Central dependency container for the application
 * Manages all dependencies and their wiring for production use
 */
import { ContainerConfig } from './types.js';
import { IFileSystem, IProcessManager, INetworkManager, ILogger, IEnvironment } from '@debugmcp/shared';
import { IProcessLauncher, IDebugTargetLauncher, IProxyProcessLauncher } from '@debugmcp/shared';
import { ISessionStoreFactory } from '../factories/session-store-factory.js';
import { IProxyManagerFactory } from '../factories/proxy-manager-factory.js';
import { IAdapterRegistry } from '@debugmcp/shared';
/**
 * Complete set of application dependencies
 */
export interface Dependencies {
    fileSystem: IFileSystem;
    processManager: IProcessManager;
    networkManager: INetworkManager;
    logger: ILogger;
    environment: IEnvironment;
    processLauncher: IProcessLauncher;
    proxyProcessLauncher: IProxyProcessLauncher;
    debugTargetLauncher: IDebugTargetLauncher;
    proxyManagerFactory: IProxyManagerFactory;
    sessionStoreFactory: ISessionStoreFactory;
    adapterRegistry: IAdapterRegistry;
}
/**
 * Creates production dependencies with real implementations
 * @param config - Configuration for services like logging
 * @returns Complete dependency container for production use
 */
export declare function createProductionDependencies(config?: ContainerConfig): Dependencies;
