import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { createProductionDependencies, Dependencies } from '../../../src/container/dependencies.js';
import { ContainerConfig } from '../../../src/container/types.js';
import { FileSystemImpl, ProcessManagerImpl, NetworkManagerImpl, ProcessLauncherImpl, ProxyProcessLauncherImpl, DebugTargetLauncherImpl } from '../../../src/implementations/index.js';
import { ProxyManagerFactory } from '../../../src/factories/proxy-manager-factory.js';
import { SessionStoreFactory } from '../../../src/factories/session-store-factory.js';
import { createLogger } from '../../../src/utils/logger.js';

// Mock the logger module
vi.mock('../../../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }))
}));

describe('createProductionDependencies', () => {
  const mockCreateLogger = createLogger as MockedFunction<typeof createLogger>;

  beforeEach(() => {
    // Reset the mock before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Dependency Graph Creation', () => {
    it('should create all required services with default config', () => {
      const dependencies = createProductionDependencies();

      // Verify all services are created
      expect(dependencies.fileSystem).toBeDefined();
      expect(dependencies.processManager).toBeDefined();
      expect(dependencies.networkManager).toBeDefined();
      expect(dependencies.logger).toBeDefined();
      expect(dependencies.processLauncher).toBeDefined();
      expect(dependencies.proxyProcessLauncher).toBeDefined();
      expect(dependencies.debugTargetLauncher).toBeDefined();
      expect(dependencies.proxyManagerFactory).toBeDefined();
      expect(dependencies.sessionStoreFactory).toBeDefined();
    });

    it('should create correct implementation types', () => {
      const dependencies = createProductionDependencies();

      // Verify correct types are instantiated
      expect(dependencies.fileSystem).toBeInstanceOf(FileSystemImpl);
      expect(dependencies.processManager).toBeInstanceOf(ProcessManagerImpl);
      expect(dependencies.networkManager).toBeInstanceOf(NetworkManagerImpl);
      expect(dependencies.processLauncher).toBeInstanceOf(ProcessLauncherImpl);
      expect(dependencies.proxyProcessLauncher).toBeInstanceOf(ProxyProcessLauncherImpl);
      expect(dependencies.debugTargetLauncher).toBeInstanceOf(DebugTargetLauncherImpl);
      expect(dependencies.proxyManagerFactory).toBeInstanceOf(ProxyManagerFactory);
      expect(dependencies.sessionStoreFactory).toBeInstanceOf(SessionStoreFactory);
    });

    it('should pass custom config to logger', () => {
      const config: ContainerConfig = {
        logLevel: 'debug',
        logFile: '/custom/log/path.log',
        loggerOptions: {
          maxFiles: 5,
          maxSize: '10MB'
        }
      };

      const dependencies = createProductionDependencies(config);

      // Verify logger was created with custom config
      expect(mockCreateLogger).toHaveBeenCalledWith('debug-mcp', {
        level: 'debug',
        file: '/custom/log/path.log',
        maxFiles: 5,
        maxSize: '10MB'
      });
    });

    it('should use default logger config when no config provided', () => {
      const dependencies = createProductionDependencies();

      // Verify logger was created with default config
      expect(mockCreateLogger).toHaveBeenCalledWith('debug-mcp', {
        level: undefined,
        file: undefined
      });
    });
  });

  describe('Dependency Wiring', () => {
    it('should wire ProcessLauncher with ProcessManager', () => {
      const dependencies = createProductionDependencies();

      // Verify ProcessLauncher received ProcessManager
      const processLauncher = dependencies.processLauncher as ProcessLauncherImpl;
      expect((processLauncher as any).processManager).toBe(dependencies.processManager);
    });

    it('should wire ProxyProcessLauncher with ProcessLauncher', () => {
      const dependencies = createProductionDependencies();

      // Verify ProxyProcessLauncher received ProcessLauncher
      const proxyProcessLauncher = dependencies.proxyProcessLauncher as ProxyProcessLauncherImpl;
      expect((proxyProcessLauncher as any).processLauncher).toBe(dependencies.processLauncher);
    });

    it('should wire DebugTargetLauncher with ProcessLauncher and NetworkManager', () => {
      const dependencies = createProductionDependencies();

      // Verify DebugTargetLauncher received its dependencies
      const debugTargetLauncher = dependencies.debugTargetLauncher as DebugTargetLauncherImpl;
      expect((debugTargetLauncher as any).processLauncher).toBe(dependencies.processLauncher);
      expect((debugTargetLauncher as any).networkManager).toBe(dependencies.networkManager);
    });

    it('should wire ProxyManagerFactory with correct dependencies', () => {
      const dependencies = createProductionDependencies();

      // Verify ProxyManagerFactory received its dependencies
      const proxyManagerFactory = dependencies.proxyManagerFactory as ProxyManagerFactory;
      expect((proxyManagerFactory as any).proxyProcessLauncher).toBe(dependencies.proxyProcessLauncher);
      expect((proxyManagerFactory as any).fileSystem).toBe(dependencies.fileSystem);
      expect((proxyManagerFactory as any).logger).toBe(dependencies.logger);
    });
  });

  describe('Singleton Behavior', () => {
    it('should create new instances on each call', () => {
      const dependencies1 = createProductionDependencies();
      const dependencies2 = createProductionDependencies();

      // Each call should create new instances
      expect(dependencies1.fileSystem).not.toBe(dependencies2.fileSystem);
      expect(dependencies1.processManager).not.toBe(dependencies2.processManager);
      expect(dependencies1.networkManager).not.toBe(dependencies2.networkManager);
      expect(dependencies1.logger).not.toBe(dependencies2.logger);
      expect(dependencies1.processLauncher).not.toBe(dependencies2.processLauncher);
      expect(dependencies1.proxyProcessLauncher).not.toBe(dependencies2.proxyProcessLauncher);
      expect(dependencies1.debugTargetLauncher).not.toBe(dependencies2.debugTargetLauncher);
      expect(dependencies1.proxyManagerFactory).not.toBe(dependencies2.proxyManagerFactory);
      expect(dependencies1.sessionStoreFactory).not.toBe(dependencies2.sessionStoreFactory);
    });

    it('should maintain internal consistency within a single instance', () => {
      const dependencies = createProductionDependencies();

      // Verify internal references are consistent
      const processLauncher = dependencies.processLauncher as ProcessLauncherImpl;
      const proxyProcessLauncher = dependencies.proxyProcessLauncher as ProxyProcessLauncherImpl;
      const debugTargetLauncher = dependencies.debugTargetLauncher as DebugTargetLauncherImpl;

      // These should share the same processLauncher instance
      expect((proxyProcessLauncher as any).processLauncher).toBe(processLauncher);
      expect((debugTargetLauncher as any).processLauncher).toBe(processLauncher);
    });
  });

  describe('Interface Compliance', () => {
    it('should provide all required methods on fileSystem', () => {
      const dependencies = createProductionDependencies();
      const fs = dependencies.fileSystem;

      // Verify all interface methods exist
      expect(fs.readFile).toBeTypeOf('function');
      expect(fs.writeFile).toBeTypeOf('function');
      expect(fs.exists).toBeTypeOf('function');
      expect(fs.mkdir).toBeTypeOf('function');
      expect(fs.readdir).toBeTypeOf('function');
      expect(fs.stat).toBeTypeOf('function');
      expect(fs.unlink).toBeTypeOf('function');
      expect(fs.rmdir).toBeTypeOf('function');
      expect(fs.ensureDir).toBeTypeOf('function');
      expect(fs.ensureDirSync).toBeTypeOf('function');
      expect(fs.pathExists).toBeTypeOf('function');
      expect(fs.remove).toBeTypeOf('function');
      expect(fs.copy).toBeTypeOf('function');
      expect(fs.outputFile).toBeTypeOf('function');
    });

    it('should provide all required methods on processManager', () => {
      const dependencies = createProductionDependencies();
      const pm = dependencies.processManager;

      expect(pm.spawn).toBeTypeOf('function');
      expect(pm.exec).toBeTypeOf('function');
    });

    it('should provide all required methods on networkManager', () => {
      const dependencies = createProductionDependencies();
      const nm = dependencies.networkManager;

      expect(nm.createServer).toBeTypeOf('function');
      expect(nm.findFreePort).toBeTypeOf('function');
    });

    it('should provide all required methods on logger', () => {
      const dependencies = createProductionDependencies();
      const logger = dependencies.logger;

      expect(logger.info).toBeTypeOf('function');
      expect(logger.error).toBeTypeOf('function');
      expect(logger.debug).toBeTypeOf('function');
      expect(logger.warn).toBeTypeOf('function');
    });

    it('should provide all required methods on factories', () => {
      const dependencies = createProductionDependencies();

      expect(dependencies.proxyManagerFactory.create).toBeTypeOf('function');
      expect(dependencies.sessionStoreFactory.create).toBeTypeOf('function');
    });

    it('should provide all required methods on launchers', () => {
      const dependencies = createProductionDependencies();

      expect(dependencies.processLauncher.launch).toBeTypeOf('function');
      expect(dependencies.proxyProcessLauncher.launchProxy).toBeTypeOf('function');
      expect(dependencies.debugTargetLauncher.launchPythonDebugTarget).toBeTypeOf('function');
    });
  });

  describe('Memory Management', () => {
    it('should not create circular dependencies', () => {
      const dependencies = createProductionDependencies();

      // Check that we can stringify without circular reference errors
      // This uses a path-based approach to detect true circular references
      expect(() => {
        // Create a circular reference detector that tracks the path
        const checkCircular = (obj: any, path: any[] = []): void => {
          if (obj && typeof obj === 'object') {
            // Check if this exact object is already in our current path
            if (path.includes(obj)) {
              throw new Error('Circular reference detected');
            }
            
            // Add to path for this traversal
            const newPath = [...path, obj];
            
            // Check own properties only, not prototype chain
            for (const key of Object.keys(obj)) {
              if (obj.hasOwnProperty(key)) {
                checkCircular(obj[key], newPath);
              }
            }
          }
        };

        // Test each top-level dependency separately
        // This prevents cross-contamination between independent branches
        checkCircular(dependencies.fileSystem);
        checkCircular(dependencies.processManager);
        checkCircular(dependencies.networkManager);
        // Skip logger as it may have internal circular refs from winston
        checkCircular(dependencies.processLauncher);
        checkCircular(dependencies.proxyProcessLauncher);
        checkCircular(dependencies.debugTargetLauncher);
        checkCircular(dependencies.proxyManagerFactory);
        checkCircular(dependencies.sessionStoreFactory);
      }).not.toThrow();
    });

    it('should allow garbage collection of created instances', () => {
      // This is more of a design verification than a runtime test
      // We verify that the factory doesn't hold references to created instances
      const dependencies = createProductionDependencies();
      
      // Create instances from factories
      const proxyManager1 = dependencies.proxyManagerFactory.create();
      const proxyManager2 = dependencies.proxyManagerFactory.create();
      const sessionStore1 = dependencies.sessionStoreFactory.create();
      const sessionStore2 = dependencies.sessionStoreFactory.create();

      // Verify instances are independent
      expect(proxyManager1).not.toBe(proxyManager2);
      expect(sessionStore1).not.toBe(sessionStore2);

      // In a real GC test, we would null out references and force GC
      // but that's not reliable in a unit test environment
    });
  });

  describe('Error Scenarios', () => {
    it('should handle logger creation failure gracefully', () => {
      // Mock logger to throw
      mockCreateLogger.mockImplementationOnce(() => {
        throw new Error('Logger creation failed');
      });

      // Creating dependencies should throw
      expect(() => createProductionDependencies()).toThrow('Logger creation failed');
    });

    it('should handle partial config correctly', () => {
      const partialConfig: ContainerConfig = {
        logLevel: 'warn'
        // Missing logFile and loggerOptions
      };

      const dependencies = createProductionDependencies(partialConfig);

      // Should create successfully with partial config
      expect(mockCreateLogger).toHaveBeenCalledWith('debug-mcp', {
        level: 'warn',
        file: undefined
      });
      
      expect(dependencies).toBeDefined();
      expect(dependencies.logger).toBeDefined();
    });
  });
});
