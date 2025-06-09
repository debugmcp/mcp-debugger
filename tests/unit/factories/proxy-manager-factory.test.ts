import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProxyManagerFactory, MockProxyManagerFactory } from '../../../src/factories/proxy-manager-factory.js';
import { ProxyManager, IProxyManager } from '../../../src/proxy/proxy-manager.js';
import { IProxyProcessLauncher } from '../../../src/interfaces/process-interfaces.js';
import { IFileSystem, ILogger } from '../../../src/interfaces/external-dependencies.js';
import { createMockLogger, createMockFileSystem } from '../../utils/test-dependencies.js';
import { MockProxyManager } from '../../mocks/mock-proxy-manager.js';

describe('ProxyManagerFactory', () => {
  let mockProxyProcessLauncher: IProxyProcessLauncher;
  let mockFileSystem: IFileSystem;
  let mockLogger: ILogger;

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
  });
});
