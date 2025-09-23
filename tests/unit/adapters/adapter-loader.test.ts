/**
 * Unit tests for AdapterLoader
 *
 * Tests dynamic loading, caching, fallback mechanisms, and error handling
 * for the adapter loading system.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AdapterLoader, AdapterMetadata } from '../../../src/adapters/adapter-loader.js';
import { IAdapterFactory } from '@debugmcp/shared';
import { createLogger } from '../../../src/utils/logger.js';

// Mock the dynamic imports and createRequire
vi.mock('module', () => ({
  createRequire: vi.fn()
}));

// Create a mock adapter factory
const createMockAdapterFactory = (name: string) => ({
  getMetadata: () => ({ name, version: '1.0.0' }),
  createAdapter: vi.fn(),
  validate: vi.fn().mockResolvedValue({ valid: true })
});

describe('AdapterLoader', () => {
  let adapterLoader: AdapterLoader;
  let mockLogger: any;
  let mockModuleLoader: ModuleLoader;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    mockModuleLoader = {
      load: vi.fn()
    };
    adapterLoader = new AdapterLoader(mockLogger, mockModuleLoader);

    // Clear the cache between tests
    (adapterLoader as any).cache.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('loadAdapter', () => {
    it('should successfully load and cache an adapter', async () => {
      const mockFactory = createMockAdapterFactory('python');
      const mockFactoryClass = vi.fn().mockReturnValue(mockFactory);
      const mockModule = { PythonAdapterFactory: mockFactoryClass };

      // Configure mock module loader
      (mockModuleLoader.load as Mock).mockImplementation((path: string) => {
        if (path === '@debugmcp/adapter-python') {
          return Promise.resolve(mockModule);
        }
        throw new Error(`Module not found: ${path}`);
      });

      const factory = await adapterLoader.loadAdapter('python');

      expect(factory).toBe(mockFactory);
      expect(mockFactoryClass).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Loaded adapter 'python' from @debugmcp/adapter-python")
      );

      // Test caching - second call should return cached instance
      const factory2 = await adapterLoader.loadAdapter('python');
      expect(factory2).toBe(mockFactory);
    });

    it('should use fallback paths when primary import fails', async () => {
      const mockFactory = createMockAdapterFactory('mock');
      const mockFactoryClass = vi.fn().mockReturnValue(mockFactory);
      const mockModule = { MockAdapterFactory: mockFactoryClass };

      let loadCount = 0;
      (mockModuleLoader.load as Mock).mockImplementation((path: string) => {
        loadCount++;
        if (loadCount === 1 && path === '@debugmcp/adapter-mock') {
          // First attempt fails
          throw new Error('Module not found');
        } else if (path.includes('node_modules/@debugmcp/adapter-mock')) {
          // Fallback succeeds
          return Promise.resolve(mockModule);
        }
        throw new Error(`Module not found: ${path}`);
      });

      const factory = await adapterLoader.loadAdapter('mock');

      expect(factory).toBe(mockFactory);
      expect(mockFactoryClass).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Primary import failed for @debugmcp/adapter-mock, trying fallback URL')
      );
    });

    it('should try createRequire as final fallback', async () => {
      const mockFactory = createMockAdapterFactory('mock');
      const mockFactoryClass = vi.fn().mockReturnValue(mockFactory);
      const mockModule = { MockAdapterFactory: mockFactoryClass };

      // Module loader will fail on all paths
      (mockModuleLoader.load as Mock).mockRejectedValue(new Error('Import failed'));

      const mockRequire = vi.fn().mockReturnValue(mockModule);
      const { createRequire } = await import('module');
      vi.mocked(createRequire).mockReturnValue(mockRequire);

      const factory = await adapterLoader.loadAdapter('mock');

      expect(factory).toBe(mockFactory);
      expect(mockFactoryClass).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Loaded via createRequire from')
      );
    });

    it('should throw helpful error when adapter is not installed', async () => {
      (mockModuleLoader.load as Mock).mockImplementation((path: string) => {
        const error = new Error('Module not found');
        (error as any).code = 'ERR_MODULE_NOT_FOUND';
        throw error;
      });

      const { createRequire } = await import('module');
      const mockRequire = vi.fn().mockImplementation(() => {
        const error = new Error('Module not found');
        (error as any).code = 'MODULE_NOT_FOUND';
        throw error;
      });
      vi.mocked(createRequire).mockReturnValue(mockRequire);

      await expect(adapterLoader.loadAdapter('nonexistent')).rejects.toThrow(
        "Failed to load adapter for 'nonexistent' from package '@debugmcp/adapter-nonexistent'. Adapter not installed. Install with: npm install @debugmcp/adapter-nonexistent"
      );

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should throw error when factory class is not found', async () => {
      const mockModule = { SomeOtherClass: vi.fn() }; // Missing factory class

      (mockModuleLoader.load as Mock).mockResolvedValue(mockModule);

      const { createRequire } = await import('module');
      vi.mocked(createRequire).mockReturnValue(vi.fn().mockImplementation(() => {
        throw new Error('Module not found');
      }));

      await expect(adapterLoader.loadAdapter('python')).rejects.toThrow(
        'Factory class PythonAdapterFactory not found in @debugmcp/adapter-python'
      );
    });

    it('should handle general loading errors', async () => {
      (mockModuleLoader.load as Mock).mockRejectedValue(new Error('Network error'));

      const { createRequire } = await import('module');
      const mockRequire = vi.fn().mockImplementation(() => {
        throw new Error('Network error');
      });
      vi.mocked(createRequire).mockReturnValue(mockRequire);

      await expect(adapterLoader.loadAdapter('python')).rejects.toThrow(
        /Failed to load adapter for 'python' from package '@debugmcp\/adapter-python'/
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('isAdapterAvailable', () => {
    it('should return true when adapter can be loaded', async () => {
      const mockFactory = createMockAdapterFactory('python');
      const mockFactoryClass = vi.fn().mockReturnValue(mockFactory);
      const mockModule = { PythonAdapterFactory: mockFactoryClass };

      (mockModuleLoader.load as Mock).mockResolvedValue(mockModule);

      const available = await adapterLoader.isAdapterAvailable('python');
      expect(available).toBe(true);
    });

    it('should return false when adapter cannot be loaded', async () => {
      (mockModuleLoader.load as Mock).mockRejectedValue(new Error('Module not found'));

      const { createRequire } = await import('module');
      const mockRequire = vi.fn().mockImplementation(() => {
        throw new Error('Module not found');
      });
      vi.mocked(createRequire).mockReturnValue(mockRequire);

      const available = await adapterLoader.isAdapterAvailable('nonexistent');
      expect(available).toBe(false);
    });

    it('should cache successful availability checks', async () => {
      const mockFactory = createMockAdapterFactory('mock');
      const mockFactoryClass = vi.fn().mockReturnValue(mockFactory);
      const mockModule = { MockAdapterFactory: mockFactoryClass };

      (mockModuleLoader.load as Mock).mockResolvedValue(mockModule);

      // First check
      await adapterLoader.isAdapterAvailable('mock');
      // Second check (should use cache)
      await adapterLoader.isAdapterAvailable('mock');

      // Load should only be called once due to caching
      expect(mockModuleLoader.load).toHaveBeenCalledTimes(1);
    });
  });

  describe('listAvailableAdapters', () => {
    it('should return metadata for known adapters with availability status', async () => {
      // Setup mocks for different availability scenarios
      const mockPythonFactory = createMockAdapterFactory('python');
      const pythonModule = { PythonAdapterFactory: vi.fn(() => mockPythonFactory) };

      (mockModuleLoader.load as Mock).mockImplementation((path: string) => {
        if (path === '@debugmcp/adapter-python') {
          return Promise.resolve(pythonModule);
        }
        throw new Error('Module not found');
      });

      const { createRequire } = await import('module');
      const mockRequire = vi.fn().mockImplementation(() => {
        throw new Error('Module not found');
      });
      vi.mocked(createRequire).mockReturnValue(mockRequire);

      const adapters = await adapterLoader.listAvailableAdapters();

      expect(adapters).toHaveLength(2);

      const pythonAdapter = adapters.find(a => a.name === 'python');
      expect(pythonAdapter).toEqual({
        name: 'python',
        packageName: '@debugmcp/adapter-python',
        description: 'Python debugger using debugpy',
        installed: true
      });

      const mockAdapter = adapters.find(a => a.name === 'mock');
      expect(mockAdapter).toEqual({
        name: 'mock',
        packageName: '@debugmcp/adapter-mock',
        description: 'Mock adapter for testing',
        installed: false
      });
    });
  });

  describe('private methods behavior', () => {
    it('should generate correct package names', () => {
      // Test the package name generation indirectly through loadAdapter
      expect(adapterLoader['getPackageName']('python')).toBe('@debugmcp/adapter-python');
      expect(adapterLoader['getPackageName']('Mock')).toBe('@debugmcp/adapter-mock');
    });

    it('should generate correct factory class names', () => {
      // Test the factory class name generation indirectly
      expect(adapterLoader['getFactoryClassName']('python')).toBe('PythonAdapterFactory');
      expect(adapterLoader['getFactoryClassName']('mock')).toBe('MockAdapterFactory');
    });

    it('should generate correct fallback paths', () => {
      const paths = adapterLoader['getFallbackModulePaths']('python');
      expect(paths).toHaveLength(2);
      expect(paths[0]).toContain('node_modules/@debugmcp/adapter-python');
      expect(paths[1]).toContain('packages/adapter-python');
    });
  });

  describe('caching behavior', () => {
    it('should maintain separate cache entries for different languages', async () => {
      const mockPythonFactory = createMockAdapterFactory('python');
      const mockMockFactory = createMockAdapterFactory('mock');

      (mockModuleLoader.load as Mock).mockImplementation((path: string) => {
        if (path === '@debugmcp/adapter-python') {
          return Promise.resolve({ PythonAdapterFactory: vi.fn().mockReturnValue(mockPythonFactory) });
        } else if (path === '@debugmcp/adapter-mock') {
          return Promise.resolve({ MockAdapterFactory: vi.fn().mockReturnValue(mockMockFactory) });
        }
        throw new Error('Module not found');
      });

      const pythonFactory = await adapterLoader.loadAdapter('python');
      const mockFactory = await adapterLoader.loadAdapter('mock');

      expect(pythonFactory).toBe(mockPythonFactory);
      expect(mockFactory).toBe(mockMockFactory);
      expect(pythonFactory).not.toBe(mockFactory);

      // Verify both are cached
      expect(await adapterLoader.loadAdapter('python')).toBe(mockPythonFactory);
      expect(await adapterLoader.loadAdapter('mock')).toBe(mockMockFactory);
    });
  });
});