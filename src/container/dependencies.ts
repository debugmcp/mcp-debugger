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
  IEnvironment
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
import { IAdapterRegistry } from '@debugmcp/shared';
import { AdapterRegistry } from '../adapters/adapter-registry.js';
import { MockAdapterFactory } from '../../packages/adapter-mock/dist/index.js';
import { PythonAdapterFactory } from '../adapters/python/python-adapter-factory.js';
import { DebugLanguage } from '@debugmcp/shared';

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
  const adapterRegistry = new AdapterRegistry({
    validateOnRegister: false,
    allowOverride: false
  });
  
  // Register Python adapter for real Python debugging
  const pythonAdapterFactory = new PythonAdapterFactory();
  adapterRegistry.register(DebugLanguage.PYTHON, pythonAdapterFactory);
  
  // Register mock adapter for testing purposes
  const mockAdapterFactory = new MockAdapterFactory();
  adapterRegistry.register(DebugLanguage.MOCK, mockAdapterFactory);
  
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
