/**
 * Central dependency container for the application
 * Manages all dependencies and their wiring for production use
 */
import { ContainerConfig } from './types.js';
import { createLogger } from '../utils/logger.js';
import {
  IFileSystem,
  IProcessManager,
  INetworkManager,
  ILogger,
  IEnvironment,
  IAdapterFactory
} from '@debugmcp/shared';
import {
  IProcessLauncher,
  IDebugTargetLauncher,
  IProxyProcessLauncher
} from '@debugmcp/shared';
import { 
  FileSystemImpl, 
  ProcessManagerImpl, 
  NetworkManagerImpl,
  ProcessLauncherImpl,
  ProxyProcessLauncherImpl,
  DebugTargetLauncherImpl 
} from '../implementations/index.js';
import { ProcessEnvironment } from '../implementations/environment-impl.js';
import { ISessionStoreFactory } from '../factories/session-store-factory.js';
import { SessionStoreFactory } from '../factories/session-store-factory.js';
import { ProxyManagerFactory, IProxyManagerFactory } from '../factories/proxy-manager-factory.js';
import { IAdapterRegistry, AdapterRegistryConfig } from '@debugmcp/shared';
import { AdapterRegistry } from '../adapters/adapter-registry.js';

/**
 * Complete set of application dependencies
 */
export interface Dependencies {
  // Core implementations
  fileSystem: IFileSystem;
  processManager: IProcessManager;
  networkManager: INetworkManager;
  logger: ILogger;
  environment: IEnvironment;
  
  // Process launchers
  processLauncher: IProcessLauncher;
  proxyProcessLauncher: IProxyProcessLauncher;
  debugTargetLauncher: IDebugTargetLauncher;
  
  // Factories
  proxyManagerFactory: IProxyManagerFactory;
  sessionStoreFactory: ISessionStoreFactory;
  
  // Adapter support
  adapterRegistry: IAdapterRegistry;
}

/**
 * Creates production dependencies with real implementations
 * @param config - Configuration for services like logging
 * @returns Complete dependency container for production use
 */
export function createProductionDependencies(config: ContainerConfig = {}): Dependencies {
  // Create logger with configuration
  const logger = createLogger('debug-mcp', {
    level: config.logLevel,
    file: config.logFile,
    ...config.loggerOptions
  });
  
  // Create base implementations
  const environment = new ProcessEnvironment();
  const fileSystem = new FileSystemImpl();
  const processManager = new ProcessManagerImpl();
  const networkManager = new NetworkManagerImpl();
  
  // Create process launchers
  const processLauncher = new ProcessLauncherImpl(processManager);
  const proxyProcessLauncher = new ProxyProcessLauncherImpl(processLauncher);
  const debugTargetLauncher = new DebugTargetLauncherImpl(processLauncher, networkManager);
  
  // Create factories
  const proxyManagerFactory = new ProxyManagerFactory(
    proxyProcessLauncher,
    fileSystem,
    logger
  );
  
  const sessionStoreFactory = new SessionStoreFactory();
  
  // Create adapter registry with validation disabled during registration
  // Validation will happen when actually creating adapter instances
  // Enable dynamic adapter loading in production to allow on-demand adapter discovery
  const dynConfig: AdapterRegistryConfig & { enableDynamicLoading?: boolean } = {
    validateOnRegister: false,
    allowOverride: false,
    enableDynamicLoading: true
  };
  const adapterRegistry = new AdapterRegistry(dynConfig);

  // Adapters are loaded dynamically on-demand by the AdapterRegistry via AdapterLoader.
  // In container runtime, pre-register known adapters using dynamic import (fire-and-forget)
  if (process.env.MCP_CONTAINER === 'true') {
    const tryRegister = (lang: 'mock' | 'python', factoryName: string) => {
      const url = new URL(`../node_modules/@debugmcp/adapter-${lang}/dist/index.js`, import.meta.url).href;
      // Fire-and-forget; do not block dependency creation
      import(
        /* webpackIgnore: true */
        url
      ).then((mod: Record<string, unknown>) => {
        const Factory = mod[factoryName] as unknown;
        if (typeof Factory === 'function') {
          // We need a constructor type that returns IAdapterFactory
          type AdapterFactoryConstructor = new () => IAdapterFactory;
          adapterRegistry.register(lang, new (Factory as AdapterFactoryConstructor)());
        }
      }).catch(() => {
        // Optional in container; ignore failures
      });
    };

    tryRegister('mock', 'MockAdapterFactory');
    tryRegister('python', 'PythonAdapterFactory');
  }
  
  return {
    fileSystem,
    processManager,
    networkManager,
    logger,
    environment,
    processLauncher,
    proxyProcessLauncher,
    debugTargetLauncher,
    proxyManagerFactory,
    sessionStoreFactory,
    adapterRegistry
  };
}
