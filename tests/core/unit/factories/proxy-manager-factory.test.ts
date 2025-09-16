import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProxyManagerFactory, MockProxyManagerFactory } from '../../../../src/factories/proxy-manager-factory.js';
import { ProxyManager, IProxyManager } from '../../../../src/proxy/proxy-manager.js';
import { IProxyProcessLauncher } from '../../../../src/interfaces/process-interfaces.js';
import { IFileSystem, ILogger } from '../../../../src/interfaces/external-dependencies.js';
import { createMockLogger, createMockFileSystem } from '../../../test-utils/helpers/test-dependencies.js';
import { MockProxyManager } from '../../../test-utils/mocks/mock-proxy-manager.js';
import { IDebugAdapter } from '@debugmcp/shared';
import { createMockAdapterRegistry } from '../../../test-utils/mocks/mock-adapter-registry.js';
import { DebugLanguage } from '@debugmcp/shared';

describe('ProxyManagerFactory', () => {
  let mockProxyProcessLauncher: IProxyProcessLauncher;
  let mockFileSystem: IFileSystem;
  let mockLogger: ILogger;

  // Helper function to create a mock debug adapter
  function createMockDebugAdapter(): IDebugAdapter {
    return {
      language: DebugLanguage.MOCK,
      name: 'Mock Debug Adapter',
      
      // Lifecycle methods
      initialize: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn().mockResolvedValue(undefined),
      
      // State management
      getState: vi.fn().mockReturnValue('ready'),
      isReady: vi.fn().mockReturnValue(true),
      getCurrentThreadId: vi.fn().mockReturnValue(1),
      
      // Environment validation
      validateEnvironment: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
      getRequiredDependencies: vi.fn().mockReturnValue([]),
      
      // Executable management
      resolveExecutablePath: vi.fn().mockResolvedValue('mock-executable'),
      getDefaultExecutableName: vi.fn().mockReturnValue('mock'),
      getExecutableSearchPaths: vi.fn().mockReturnValue([]),
      
      // Adapter configuration
      buildAdapterCommand: vi.fn().mockImplementation((config) => ({
        command: config.executablePath || 'node',
        args: ['mock-adapter.js', '--port', String(config.adapterPort)],
        env: {}
      })),
      getAdapterModuleName: vi.fn().mockReturnValue('mock-adapter'),
      getAdapterInstallCommand: vi.fn().mockReturnValue('echo "Mock adapter built-in"'),
      
      // Debug configuration
      transformLaunchConfig: vi.fn().mockImplementation(config => config),
      getDefaultLaunchConfig: vi.fn().mockReturnValue({}),
      
      // Path translation
      translateScriptPath: vi.fn().mockImplementation(path => path),
      translateBreakpointPath: vi.fn().mockImplementation(path => path),
      
      // DAP protocol operations
      sendDapRequest: vi.fn().mockResolvedValue({}),
      handleDapEvent: vi.fn(),
      handleDapResponse: vi.fn(),
      
      // Connection management
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      
      // Error handling
      getInstallationInstructions: vi.fn().mockReturnValue('Mock adapter needs no installation'),
      getMissingExecutableError: vi.fn().mockReturnValue('Mock executable not found'),
      translateErrorMessage: vi.fn().mockImplementation(err => err.message),
      
      // Feature support
      supportsFeature: vi.fn().mockReturnValue(true),
      getFeatureRequirements: vi.fn().mockReturnValue([]),
      getCapabilities: vi.fn().mockReturnValue({}),
      
      // EventEmitter methods
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      removeListener: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
      setMaxListeners: vi.fn(),
      getMaxListeners: vi.fn().mockReturnValue(10),
      listeners: vi.fn().mockReturnValue([]),
      rawListeners: vi.fn().mockReturnValue([]),
      listenerCount: vi.fn().mockReturnValue(0),
      prependListener: vi.fn(),
      prependOnceListener: vi.fn(),
      eventNames: vi.fn().mockReturnValue([]),
      addListener: vi.fn()
    } as unknown as IDebugAdapter;
  }

  beforeEach(() => {
    mockProxyProcessLauncher = {
      launchProxy: vi.fn()
    };
    mockFileSystem = createMockFileSystem();
    mockLogger = createMockLogger();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ProxyManagerFactory', () => {
    it('should create ProxyManager with correct dependencies', () => {
      const factory = new ProxyManagerFactory(
        mockProxyProcessLauncher,
        mockFileSystem,
        mockLogger
      );

      const manager = factory.create();

      // Verify it returns an instance of ProxyManager
      expect(manager).toBeInstanceOf(ProxyManager);
      
      // Verify the interface methods exist
      expect(manager.start).toBeTypeOf('function');
      expect(manager.stop).toBeTypeOf('function');
      expect(manager.sendDapRequest).toBeTypeOf('function');
      expect(manager.isRunning).toBeTypeOf('function');
      expect(manager.getCurrentThreadId).toBeTypeOf('function');
    });

    it('should create independent instances on multiple calls', () => {
      const factory = new ProxyManagerFactory(
        mockProxyProcessLauncher,
        mockFileSystem,
        mockLogger
      );

      const manager1 = factory.create();
      const manager2 = factory.create();

      // Verify they are different instances
      expect(manager1).not.toBe(manager2);
      
      // Both should be ProxyManager instances
      expect(manager1).toBeInstanceOf(ProxyManager);
      expect(manager2).toBeInstanceOf(ProxyManager);
    });

    it('should not retain references to created instances', () => {
      const factory = new ProxyManagerFactory(
        mockProxyProcessLauncher,
        mockFileSystem,
        mockLogger
      );

      // Create some managers
      const managers: IProxyManager[] = [];
      for (let i = 0; i < 3; i++) {
        managers.push(factory.create());
      }

      // Factory should not have any internal state tracking created instances
      // This is verified by the fact that ProxyManagerFactory has no instance arrays
      // and each create() call returns a new instance
      expect(managers[0]).not.toBe(managers[1]);
      expect(managers[1]).not.toBe(managers[2]);
      expect(managers[0]).not.toBe(managers[2]);
    });

    it('should pass the same dependencies to all created instances', () => {
      const factory = new ProxyManagerFactory(
        mockProxyProcessLauncher,
        mockFileSystem,
        mockLogger
      );

      // We can't directly inspect the dependencies passed to ProxyManager
      // but we can verify the factory maintains the same references
      const factoryDeps = {
        proxyProcessLauncher: (factory as any).proxyProcessLauncher,
        fileSystem: (factory as any).fileSystem,
        logger: (factory as any).logger
      };

      expect(factoryDeps.proxyProcessLauncher).toBe(mockProxyProcessLauncher);
      expect(factoryDeps.fileSystem).toBe(mockFileSystem);
      expect(factoryDeps.logger).toBe(mockLogger);
    });

    it('should create ProxyManager with provided adapter', () => {
      const factory = new ProxyManagerFactory(
        mockProxyProcessLauncher,
        mockFileSystem,
        mockLogger
      );
      const mockAdapter = createMockDebugAdapter();

      const manager = factory.create(mockAdapter);

      // Verify it returns an instance of ProxyManager
      expect(manager).toBeInstanceOf(ProxyManager);
      
      // Verify the interface methods exist
      expect(manager.start).toBeTypeOf('function');
      expect(manager.stop).toBeTypeOf('function');
      expect(manager.sendDapRequest).toBeTypeOf('function');
      expect(manager.isRunning).toBeTypeOf('function');
      expect(manager.getCurrentThreadId).toBeTypeOf('function');
    });

    it('should create ProxyManager with null when no adapter provided', () => {
      const factory = new ProxyManagerFactory(
        mockProxyProcessLauncher,
        mockFileSystem,
        mockLogger
      );

      const manager = factory.create();

      // Verify it returns an instance of ProxyManager
      expect(manager).toBeInstanceOf(ProxyManager);
      // Implementation uses "adapter || null" so it passes null when no adapter
      // We can't directly verify the null was passed, but we can verify the manager works
      expect(manager.start).toBeTypeOf('function');
    });

    it('should create different instances for different adapters', () => {
      const factory = new ProxyManagerFactory(
        mockProxyProcessLauncher,
        mockFileSystem,
        mockLogger
      );
      const adapter1 = createMockDebugAdapter();
      const adapter2 = createMockDebugAdapter();

      const manager1 = factory.create(adapter1);
      const manager2 = factory.create(adapter2);

      // Verify they are different instances
      expect(manager1).not.toBe(manager2);
      
      // Both should be ProxyManager instances
      expect(manager1).toBeInstanceOf(ProxyManager);
      expect(manager2).toBeInstanceOf(ProxyManager);
    });

    it('should not mutate dependencies between create calls', () => {
      const factory = new ProxyManagerFactory(
        mockProxyProcessLauncher,
        mockFileSystem,
        mockLogger
      );

      const adapter1 = createMockDebugAdapter();
      const adapter2 = createMockDebugAdapter();

      factory.create();
      factory.create(adapter1);
      factory.create(adapter2);

      // Verify factory's internal dependencies haven't changed
      const factoryDeps = {
        proxyProcessLauncher: (factory as any).proxyProcessLauncher,
        fileSystem: (factory as any).fileSystem,
        logger: (factory as any).logger
      };

      expect(factoryDeps.proxyProcessLauncher).toBe(mockProxyProcessLauncher);
      expect(factoryDeps.fileSystem).toBe(mockFileSystem);
      expect(factoryDeps.logger).toBe(mockLogger);
    });
  });

  describe('MockProxyManagerFactory', () => {
    it('should throw error when createFn is not set', () => {
      const factory = new MockProxyManagerFactory();

      expect(() => factory.create()).toThrow('MockProxyManagerFactory requires createFn to be set in tests');
    });

    it('should use provided createFn to create instances', () => {
      const factory = new MockProxyManagerFactory();
      const mockManager = new MockProxyManager();

      factory.createFn = vi.fn().mockReturnValue(mockManager);

      const result = factory.create();

      expect(factory.createFn).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockManager);
    });

    it('should track created managers', () => {
      const factory = new MockProxyManagerFactory();
      const mockManager1 = new MockProxyManager();
      const mockManager2 = new MockProxyManager();

      factory.createFn = vi.fn()
        .mockReturnValueOnce(mockManager1)
        .mockReturnValueOnce(mockManager2);

      expect(factory.createdManagers).toHaveLength(0);

      const result1 = factory.create();
      expect(factory.createdManagers).toHaveLength(1);
      expect(factory.createdManagers[0]).toBe(mockManager1);

      const result2 = factory.create();
      expect(factory.createdManagers).toHaveLength(2);
      expect(factory.createdManagers[1]).toBe(mockManager2);
    });

    it('should allow createFn to be called multiple times', () => {
      const factory = new MockProxyManagerFactory();
      const mockManager = new MockProxyManager();

      factory.createFn = vi.fn().mockReturnValue(mockManager);

      factory.create();
      factory.create();
      factory.create();

      expect(factory.createFn).toHaveBeenCalledTimes(3);
      expect(factory.createdManagers).toHaveLength(3);
      expect(factory.createdManagers.every(m => m === mockManager)).toBe(true);
    });

    it('should maintain independent state between factory instances', () => {
      const factory1 = new MockProxyManagerFactory();
      const factory2 = new MockProxyManagerFactory();

      const mockManager1 = new MockProxyManager();
      const mockManager2 = new MockProxyManager();

      factory1.createFn = () => mockManager1;
      factory2.createFn = () => mockManager2;

      factory1.create();
      factory2.create();

      expect(factory1.createdManagers).toHaveLength(1);
      expect(factory1.createdManagers[0]).toBe(mockManager1);
      
      expect(factory2.createdManagers).toHaveLength(1);
      expect(factory2.createdManagers[0]).toBe(mockManager2);
    });

    it('should track the last adapter used', () => {
      const factory = new MockProxyManagerFactory();
      const mockManager = new MockProxyManager();
      const mockAdapter = createMockDebugAdapter();
      
      factory.createFn = vi.fn().mockReturnValue(mockManager);
      
      // Initially should be undefined
      expect(factory.lastAdapter).toBeUndefined();
      
      // Create without adapter
      factory.create();
      expect(factory.lastAdapter).toBeUndefined();
      
      // Create with adapter
      factory.create(mockAdapter);
      expect(factory.lastAdapter).toBe(mockAdapter);
    });

    it('should pass adapter to createFn', () => {
      const factory = new MockProxyManagerFactory();
      const mockManager = new MockProxyManager();
      const mockAdapter = createMockDebugAdapter();
      
      const createFnSpy = vi.fn().mockReturnValue(mockManager);
      factory.createFn = createFnSpy;
      
      // Create without adapter
      factory.create();
      expect(createFnSpy).toHaveBeenCalledWith(undefined);
      
      // Create with adapter
      factory.create(mockAdapter);
      expect(createFnSpy).toHaveBeenCalledWith(mockAdapter);
      expect(createFnSpy).toHaveBeenCalledTimes(2);
    });

    it('should track adapter even when createFn throws', () => {
      const factory = new MockProxyManagerFactory();
      const mockAdapter = createMockDebugAdapter();
      
      // Don't set createFn, so it will throw
      
      expect(() => factory.create(mockAdapter)).toThrow('MockProxyManagerFactory requires createFn to be set in tests');
      
      // But adapter should still be tracked
      expect(factory.lastAdapter).toBe(mockAdapter);
    });

    it('should update lastAdapter on each call', () => {
      const factory = new MockProxyManagerFactory();
      const mockManager = new MockProxyManager();
      const adapter1 = createMockDebugAdapter();
      const adapter2 = createMockDebugAdapter();
      
      factory.createFn = vi.fn().mockReturnValue(mockManager);
      
      // Create with first adapter
      factory.create(adapter1);
      expect(factory.lastAdapter).toBe(adapter1);
      
      // Create with second adapter
      factory.create(adapter2);
      expect(factory.lastAdapter).toBe(adapter2);
      
      // Create without adapter
      factory.create();
      expect(factory.lastAdapter).toBeUndefined();
    });

    it('should handle createFn that uses adapter parameter', () => {
      const factory = new MockProxyManagerFactory();
      const mockAdapter = createMockDebugAdapter();
      
      // Create distinct managers for testing
      const managerForNoAdapter = new MockProxyManager();
      const managerForAdapter = new MockProxyManager();
      
      // Create a createFn that returns different managers based on adapter
      factory.createFn = (adapter?: IDebugAdapter) => {
        return adapter ? managerForAdapter : managerForNoAdapter;
      };
      
      const result1 = factory.create();
      const result2 = factory.create(mockAdapter);
      
      // Verify different managers were returned based on adapter
      expect(result1).toBe(managerForNoAdapter);
      expect(result2).toBe(managerForAdapter);
      expect(factory.createdManagers).toHaveLength(2);
      expect(factory.createdManagers[0]).toBe(managerForNoAdapter);
      expect(factory.createdManagers[1]).toBe(managerForAdapter);
    });
  });
});
