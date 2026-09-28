/**
 * Unit tests for AdapterLoader
 *
 * Tests dynamic loading, caching, fallback mechanisms, and error handling
 * for the adapter loading system.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import path from 'path';
import { pathToFileURL } from 'url';
import { AdapterLoader, createDefaultPackageResolver } from '../../../src/adapters/adapter-loader.js';
import type { ModuleLoader, PackageResolver } from '../../../src/adapters/adapter-loader.js';
import type { Mock } from 'vitest';

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
      const mockFactoryClass = vi.fn().mockImplementation(function() { return mockFactory; });
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
      const mockFactoryClass = vi.fn().mockImplementation(function() { return mockFactory; });
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
      const mockFactoryClass = vi.fn().mockImplementation(function() { return mockFactory; });
      const mockModule = { MockAdapterFactory: mockFactoryClass };

      // Module loader will fail on all paths
      (mockModuleLoader.load as Mock).mockRejectedValue(new Error('Import failed'));

      const mockRequire = vi.fn().mockReturnValue(mockModule) as unknown as NodeJS.Require;
      const { createRequire } = await import('module');
      vi.mocked(createRequire as any).mockReturnValue(mockRequire as any);

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
      }) as unknown as NodeJS.Require;
      vi.mocked(createRequire as any).mockReturnValue(mockRequire as any);

      // The resolver is injected: the verdict must not depend on what this
      // machine has on disk (a real language name in a built tree would
      // otherwise flip it to "installed but importing it failed").
      const resolver: PackageResolver = { isInstalled: vi.fn().mockResolvedValue(false) };
      const loader = new AdapterLoader(mockLogger, mockModuleLoader, resolver);

      await expect(loader.loadAdapter('nonexistent')).rejects.toThrow(
        "Failed to load adapter for 'nonexistent' from package '@debugmcp/adapter-nonexistent'. Adapter not installed. Install with: npm install @debugmcp/adapter-nonexistent"
      );

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    // Issue #795: a package that IS on disk but whose import fails (a missing
    // transitive dependency, measured with `dotenv` removed from an installed
    // adapter-javascript) must not be reported as "Adapter not installed" —
    // and the primary import's error, the one naming the real cause, must
    // survive the fallback attempts instead of being discarded.
    it('names the missing dependency when the adapter package is installed but its import fails (issue #795)', async () => {
      const primary = Object.assign(
        new Error("Cannot find package 'dotenv' imported from /app/node_modules/@debugmcp/adapter-javascript/dist/utils/launch-environment.js"),
        { code: 'ERR_MODULE_NOT_FOUND' }
      );
      (mockModuleLoader.load as Mock).mockRejectedValue(primary);
      const { createRequire } = await import('module');
      // The fallback candidates' errors only say the candidate path is absent.
      const mockRequire = vi.fn().mockImplementation(() => {
        throw Object.assign(new Error("Cannot find module '/app/packages/adapter-javascript/dist/index.js'"), { code: 'MODULE_NOT_FOUND' });
      }) as unknown as NodeJS.Require;
      vi.mocked(createRequire as any).mockReturnValue(mockRequire as any);
      const resolver: PackageResolver = { isInstalled: vi.fn().mockResolvedValue(true) };
      const loader = new AdapterLoader(mockLogger, mockModuleLoader, resolver);

      const failure: Error & { cause?: unknown } = await loader.loadAdapter('javascript').then(
        () => { throw new Error('expected loadAdapter to reject'); },
        (error: unknown) => error as Error & { cause?: unknown }
      );

      expect(failure).toBeInstanceOf(Error);
      expect(failure.message).toContain("Failed to load adapter for 'javascript' from package '@debugmcp/adapter-javascript'");
      expect(failure.message).toContain("Cannot find package 'dotenv' imported from");
      expect(failure.message).toContain("its dependency 'dotenv' is missing");
      expect(failure.message).not.toContain('Adapter not installed');
      expect(failure.cause).toBe(primary);
      expect(resolver.isInstalled).toHaveBeenCalledWith('@debugmcp/adapter-javascript', expect.any(Array));
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("dependency 'dotenv'"));
    });

    it('still reports a genuinely absent package as not installed, with the primary error as cause (issue #795)', async () => {
      const primary = Object.assign(
        new Error("Cannot find package '@debugmcp/adapter-nonexistent' imported from /app/dist/adapters/adapter-loader.js"),
        { code: 'ERR_MODULE_NOT_FOUND' }
      );
      (mockModuleLoader.load as Mock).mockRejectedValue(primary);
      const { createRequire } = await import('module');
      vi.mocked(createRequire as any).mockReturnValue(vi.fn().mockImplementation(() => {
        throw Object.assign(new Error('Cannot find module'), { code: 'MODULE_NOT_FOUND' });
      }) as any);
      const resolver: PackageResolver = { isInstalled: vi.fn().mockResolvedValue(false) };
      const loader = new AdapterLoader(mockLogger, mockModuleLoader, resolver);

      const failure: Error & { cause?: unknown } = await loader.loadAdapter('nonexistent').then(
        () => { throw new Error('expected loadAdapter to reject'); },
        (error: unknown) => error as Error & { cause?: unknown }
      );

      expect(failure.message).toBe(
        "Failed to load adapter for 'nonexistent' from package '@debugmcp/adapter-nonexistent'. Adapter not installed. Install with: npm install @debugmcp/adapter-nonexistent"
      );
      expect(failure.cause).toBe(primary);
    });

    it('surfaces the fallback import error when only it names the real cause (issue #795, source-checkout layout)', async () => {
      // node_modules/@debugmcp/adapter-javascript absent, packages/adapter-javascript/dist
      // present, dotenv missing: the primary error only says the bare specifier
      // is absent; the ESM fallback's error is the one that names dotenv.
      const primary = Object.assign(
        new Error("Cannot find package '@debugmcp/adapter-javascript' imported from /app/dist/adapters/adapter-loader.js"),
        { code: 'ERR_MODULE_NOT_FOUND' }
      );
      const fallback = Object.assign(
        new Error("Cannot find package 'dotenv' imported from /app/packages/adapter-javascript/dist/utils/launch-environment.js"),
        { code: 'ERR_MODULE_NOT_FOUND' }
      );
      (mockModuleLoader.load as Mock).mockImplementation(async (specifier: string) => {
        if (specifier === '@debugmcp/adapter-javascript') throw primary;
        throw fallback;
      });
      const { createRequire } = await import('module');
      vi.mocked(createRequire as any).mockReturnValue(vi.fn().mockImplementation((fsPath: string) => {
        throw Object.assign(new Error(`Cannot find module '${fsPath}'`), { code: 'MODULE_NOT_FOUND' });
      }) as any);
      const resolver: PackageResolver = { isInstalled: vi.fn().mockResolvedValue(true) };
      const loader = new AdapterLoader(mockLogger, mockModuleLoader, resolver);

      const failure: Error & { cause?: unknown } = await loader.loadAdapter('javascript').then(
        () => { throw new Error('expected loadAdapter to reject'); },
        (error: unknown) => error as Error & { cause?: unknown }
      );

      expect(failure.message).toContain("Cannot find package 'dotenv' imported from");
      expect(failure.message).toContain("its dependency 'dotenv' is missing");
      expect(failure.message).not.toContain("Cannot find package '@debugmcp/adapter-javascript'");
      expect(failure.cause).toBe(fallback);
      // Every attempt is on the record at warn level, not only under debug logging.
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/Cannot find package '@debugmcp\/adapter-javascript'[\s\S]*Cannot find package 'dotenv'/)
      );
    });

    it('does not call a missing file inside the package a dependency (issue #795)', async () => {
      // A nested dependency's broken main, or the package's own dist, is a
      // path — the message keeps Node's words but adds no dependency note.
      const primary = Object.assign(
        new Error("Cannot find module '/app/node_modules/@debugmcp/adapter-javascript/node_modules/foo/lib/index.js' imported from /app/node_modules/@debugmcp/adapter-javascript/dist/index.js"),
        { code: 'ERR_MODULE_NOT_FOUND' }
      );
      (mockModuleLoader.load as Mock).mockRejectedValue(primary);
      const { createRequire } = await import('module');
      vi.mocked(createRequire as any).mockReturnValue(vi.fn().mockImplementation((fsPath: string) => {
        throw Object.assign(new Error(`Cannot find module '${fsPath}'`), { code: 'MODULE_NOT_FOUND' });
      }) as any);
      const resolver: PackageResolver = { isInstalled: vi.fn().mockResolvedValue(true) };
      const loader = new AdapterLoader(mockLogger, mockModuleLoader, resolver);

      const failure: Error = await loader.loadAdapter('javascript').then(
        () => { throw new Error('expected loadAdapter to reject'); },
        (error: unknown) => error as Error
      );

      expect(failure.message).toContain(
        "The package is installed but importing it failed: Cannot find module '/app/node_modules/@debugmcp/adapter-javascript/node_modules/foo/lib/index.js'"
      );
      expect(failure.message).not.toContain('its dependency');
    });

    it('should throw error when factory class is not found', async () => {
      const mockModule = { SomeOtherClass: vi.fn() }; // Missing factory class

      (mockModuleLoader.load as Mock).mockResolvedValue(mockModule);

      const { createRequire } = await import('module');
      vi.mocked(createRequire as any).mockReturnValue(vi.fn().mockImplementation(() => {
        throw new Error('Module not found');
      }) as any);

      await expect(adapterLoader.loadAdapter('python')).rejects.toThrow(
        'Factory class PythonAdapterFactory not found in @debugmcp/adapter-python'
      );
    });

    it('should handle general loading errors', async () => {
      (mockModuleLoader.load as Mock).mockRejectedValue(new Error('Network error'));

      const { createRequire } = await import('module');
      const mockRequire = vi.fn().mockImplementation(() => {
        throw new Error('Network error');
      }) as unknown as NodeJS.Require;
      vi.mocked(createRequire as any).mockReturnValue(mockRequire as any);

      await expect(adapterLoader.loadAdapter('python')).rejects.toThrow(
        /Failed to load adapter for 'python' from package '@debugmcp\/adapter-python'/
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should successfully load and cache a javascript adapter', async () => {
      const mockFactory = createMockAdapterFactory('javascript');
      const mockFactoryClass = vi.fn().mockImplementation(function() { return mockFactory; });
      const mockModule = { JavascriptAdapterFactory: mockFactoryClass };

      // Configure mock module loader
      (mockModuleLoader.load as Mock).mockImplementation((path: string) => {
        if (path === '@debugmcp/adapter-javascript') {
          return Promise.resolve(mockModule);
        }
        throw new Error(`Module not found: ${path}`);
      });

      const factory = await adapterLoader.loadAdapter('javascript');

      expect(factory).toBe(mockFactory);
      expect(mockFactoryClass).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Loaded adapter 'javascript' from @debugmcp/adapter-javascript")
      );

      // Test caching - second call should return cached instance
      const factory2 = await adapterLoader.loadAdapter('javascript');
      expect(factory2).toBe(mockFactory);
    });

    it('should use fallback paths when primary import fails for javascript', async () => {
      const mockFactory = createMockAdapterFactory('javascript');
      const mockFactoryClass = vi.fn().mockImplementation(function() { return mockFactory; });
      const mockModule = { JavascriptAdapterFactory: mockFactoryClass };

      let loadCount = 0;
      (mockModuleLoader.load as Mock).mockImplementation((path: string) => {
        loadCount++;
        if (loadCount === 1 && path === '@debugmcp/adapter-javascript') {
          // First attempt fails
          throw new Error('Module not found');
        } else if (path.includes('node_modules/@debugmcp/adapter-javascript')) {
          // Fallback succeeds
          return Promise.resolve(mockModule);
        }
        throw new Error(`Module not found: ${path}`);
      });

      const factory = await adapterLoader.loadAdapter('javascript');

      expect(factory).toBe(mockFactory);
      expect(mockFactoryClass).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Primary import failed for @debugmcp/adapter-javascript, trying fallback URL')
      );
    });
  });

  // Load-based isAdapterAvailable tests were replaced by the metadata-only
  // probe describe below (issue #401): the probe never imports adapter modules.

  describe('listAvailableAdapters', () => {
    it('should return metadata for known adapters with availability status', async () => {
      // Only the python package is present on disk (metadata-only probe)
      const mockResolver: PackageResolver = {
        isInstalled: vi.fn().mockImplementation(
          async (pkg: string) => pkg === '@debugmcp/adapter-python'
        )
      };
      adapterLoader = new AdapterLoader(mockLogger, mockModuleLoader, mockResolver);

      const adapters = await adapterLoader.listAvailableAdapters();

      expect(adapters).toHaveLength(10);

      const pythonAdapter = adapters.find(a => a.name === 'python');
      expect(pythonAdapter).toEqual({
        name: 'python',
        packageName: '@debugmcp/adapter-python',
        description: 'Python debugger using debugpy',
        installed: true,
        attach: 'direct-connect'
      });

      const mockAdapter = adapters.find(a => a.name === 'mock');
      expect(mockAdapter).toEqual({
        name: 'mock',
        packageName: '@debugmcp/adapter-mock',
        description: 'Mock adapter for testing',
        installed: false,
        attach: 'none'
      });

      const jsAdapter = adapters.find(a => a.name === 'javascript');
      expect(jsAdapter).toEqual({
        name: 'javascript',
        packageName: '@debugmcp/adapter-javascript',
        description: 'JavaScript/TypeScript debugger using js-debug',
        installed: false,
        attach: 'spawn'
      });

      const rubyAdapter = adapters.find(a => a.name === 'ruby');
      expect(rubyAdapter).toEqual({
        name: 'ruby',
        packageName: '@debugmcp/adapter-ruby',
        description: 'Ruby debugger using rdbg',
        installed: false,
        attach: 'direct-connect'
      });

      const rustAdapter = adapters.find(a => a.name === 'rust');
      expect(rustAdapter).toEqual({
        name: 'rust',
        packageName: '@debugmcp/adapter-rust',
        description: 'Rust debugger using CodeLLDB',
        installed: false,
        attach: 'none'
      });

      const goAdapter = adapters.find(a => a.name === 'go');
      expect(goAdapter).toEqual({
        name: 'go',
        packageName: '@debugmcp/adapter-go',
        description: 'Go debugger using Delve',
        installed: false,
        attach: 'none'
      });

      const javaAdapter = adapters.find(a => a.name === 'java');
      expect(javaAdapter).toEqual({
        name: 'java',
        packageName: '@debugmcp/adapter-java',
        description: 'Java debugger using JDI bridge',
        installed: false,
        attach: 'spawn'
      });

      const dotnetAdapter = adapters.find(a => a.name === 'dotnet');
      expect(dotnetAdapter).toEqual({
        name: 'dotnet',
        packageName: '@debugmcp/adapter-dotnet',
        description: '.NET/C# debugger using netcoredbg',
        installed: false,
        attach: 'spawn'
      });

      const cppAdapter = adapters.find(a => a.name === 'cpp');
      expect(cppAdapter).toEqual({
        name: 'cpp',
        packageName: '@debugmcp/adapter-cpp',
        description: 'C/C++ debugger using CodeLLDB',
        installed: false,
        attach: 'spawn'
      });

      const cobolAdapter = adapters.find(a => a.name === 'cobol');
      expect(cobolAdapter).toEqual({
        name: 'cobol',
        packageName: '@debugmcp/adapter-cobol',
        description: 'COBOL debugger using GnuCOBOL and CodeLLDB',
        installed: false,
        attach: 'spawn'
      });
    });

    it('should include javascript with installed true when available', async () => {
      const spy = vi.spyOn(adapterLoader, 'isAdapterAvailable');
      spy.mockImplementation(async (language: string) => language === 'javascript');

      const adapters = await adapterLoader.listAvailableAdapters();
      const jsAdapter = adapters.find(a => a.name === 'javascript');

      expect(jsAdapter).toEqual({
        name: 'javascript',
        packageName: '@debugmcp/adapter-javascript',
        description: 'JavaScript/TypeScript debugger using js-debug',
        installed: true,
        attach: 'spawn'
      });
    });
  });

  // Monorepo fallback: a package that doesn't node-resolve but exists under
  // packages/adapter-*/dist is still reported installed — via the default
  // resolver's fs fallback, with no module import (issue #401).
  it('should mark javascript installed:true when resolved from monorepo packages fallback', async () => {
    const resolver = createDefaultPackageResolver({
      resolve: vi.fn().mockImplementation(() => {
        throw Object.assign(new Error('Module not found'), { code: 'MODULE_NOT_FOUND' });
      }),
      access: vi.fn().mockImplementation(async (p: string) => {
        // Only the monorepo packages/ copy of adapter-javascript exists
        const normalized = p.replace(/\\/g, '/');
        if (!normalized.includes('packages/adapter-javascript/dist/index.js')) {
          throw new Error('ENOENT');
        }
      })
    });
    adapterLoader = new AdapterLoader(mockLogger, mockModuleLoader, resolver);

    const adapters = await adapterLoader.listAvailableAdapters();
    const jsAdapter = adapters.find(a => a.name === 'javascript');
    expect(jsAdapter).toEqual({
      name: 'javascript',
      packageName: '@debugmcp/adapter-javascript',
      description: 'JavaScript/TypeScript debugger using js-debug',
      installed: true,
      attach: 'spawn'
    });
    // The probe must not have imported anything
    expect(mockModuleLoader.load).not.toHaveBeenCalled();
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
      expect(adapterLoader['getFactoryClassName']('javascript')).toBe('JavascriptAdapterFactory');
    });

    it('should generate correct fallback paths', () => {
      const paths = adapterLoader['getFallbackModulePaths']('python');
      expect(paths).toHaveLength(2);
      expect(paths[0]).toContain('node_modules/@debugmcp/adapter-python');
      expect(paths[1]).toContain('packages/adapter-python');
    });
  });

  describe('metadata-only availability probe (issue #401)', () => {
    let mockResolver: { isInstalled: Mock };

    beforeEach(() => {
      mockResolver = { isInstalled: vi.fn().mockResolvedValue(false) };
      adapterLoader = new AdapterLoader(mockLogger, mockModuleLoader, mockResolver as PackageResolver);
    });

    it('reports availability without importing or instantiating the adapter package', async () => {
      mockResolver.isInstalled.mockResolvedValue(true);

      const available = await adapterLoader.isAdapterAvailable('python');

      expect(available).toBe(true);
      expect(mockResolver.isInstalled).toHaveBeenCalledWith(
        '@debugmcp/adapter-python',
        expect.arrayContaining([expect.stringContaining('adapter-python')])
      );
      expect(mockModuleLoader.load).not.toHaveBeenCalled();
    });

    it('reports installed:false without importing when the resolver finds nothing', async () => {
      const available = await adapterLoader.isAdapterAvailable('nonexistent');

      expect(available).toBe(false);
      expect(mockModuleLoader.load).not.toHaveBeenCalled();
    });

    it('short-circuits to true for an already-loaded factory without re-probing', async () => {
      const mockFactory = createMockAdapterFactory('mock');
      (mockModuleLoader.load as Mock).mockResolvedValue({
        MockAdapterFactory: vi.fn().mockImplementation(function() { return mockFactory; })
      });
      await adapterLoader.loadAdapter('mock');

      const available = await adapterLoader.isAdapterAvailable('mock');

      expect(available).toBe(true);
      expect(mockResolver.isInstalled).not.toHaveBeenCalled();
    });

    it('listAvailableAdapters reports all ten adapters without importing any module', async () => {
      mockResolver.isInstalled.mockImplementation(
        async (pkg: string) => pkg === '@debugmcp/adapter-python'
      );

      const adapters = await adapterLoader.listAvailableAdapters();

      expect(adapters).toHaveLength(10);
      expect(mockModuleLoader.load).not.toHaveBeenCalled();
      expect(adapters.filter(a => a.installed).map(a => a.name)).toEqual(['python']);
      expect(adapters.find(a => a.name === 'python')).toEqual({
        name: 'python',
        packageName: '@debugmcp/adapter-python',
        description: 'Python debugger using debugpy',
        installed: true,
        attach: 'direct-connect'
      });
    });
  });

  describe('createDefaultPackageResolver', () => {
    it('reports installed when the package name resolves', async () => {
      const resolver = createDefaultPackageResolver({
        resolve: vi.fn().mockReturnValue('/fake/node_modules/@debugmcp/adapter-python/dist/index.js'),
        access: vi.fn().mockRejectedValue(new Error('should not be reached'))
      });

      await expect(resolver.isInstalled('@debugmcp/adapter-python', [])).resolves.toBe(true);
    });

    it('treats an exports-map rejection as installed (package present, ESM-only exports)', async () => {
      const resolve = vi.fn().mockImplementation(() => {
        throw Object.assign(new Error('not exported'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
      });
      const access = vi.fn().mockRejectedValue(new Error('should not be reached'));
      const resolver = createDefaultPackageResolver({ resolve, access });

      await expect(resolver.isInstalled('@debugmcp/adapter-cpp', [])).resolves.toBe(true);
      expect(access).not.toHaveBeenCalled();
    });

    it('reports installed when only the package manifest resolves (built output wiped, package on disk)', async () => {
      // "npm install" would answer "up to date" here; the verdict must be the
      // installed-but-broken one whose advice (rebuild) applies (issue #795).
      const resolve = vi.fn().mockImplementation((id: string) => {
        if (id === '@debugmcp/adapter-python/package.json') return '/fake/node_modules/@debugmcp/adapter-python/package.json';
        throw Object.assign(new Error('nope'), { code: 'MODULE_NOT_FOUND' });
      });
      const access = vi.fn().mockRejectedValue(new Error('ENOENT'));
      const resolver = createDefaultPackageResolver({ resolve, access });

      await expect(resolver.isInstalled('@debugmcp/adapter-python', [])).resolves.toBe(true);
      expect(access).not.toHaveBeenCalled();
    });

    it('reports installed when a fallback package directory has its manifest but no dist', async () => {
      const resolve = vi.fn().mockImplementation(() => {
        throw Object.assign(new Error('nope'), { code: 'MODULE_NOT_FOUND' });
      });
      const access = vi.fn().mockImplementation(async (p: string) => {
        if (!p.endsWith('package.json')) throw new Error('ENOENT');
      });
      const resolver = createDefaultPackageResolver({ resolve, access });
      const candidate = pathToFileURL(path.resolve('/repo/packages/adapter-python/dist/index.js')).href;

      await expect(resolver.isInstalled('@debugmcp/adapter-python', [candidate])).resolves.toBe(true);
      expect(access).toHaveBeenCalledWith(path.resolve('/repo/packages/adapter-python/package.json'));
    });

    it('falls back to fs access over the monorepo fallback paths', async () => {
      const resolve = vi.fn().mockImplementation(() => {
        throw Object.assign(new Error('nope'), { code: 'MODULE_NOT_FOUND' });
      });
      const access = vi.fn().mockImplementation(async (p: string) => {
        if (!p.includes('packages') || !p.includes('adapter-javascript')) {
          throw new Error('ENOENT');
        }
      });
      const resolver = createDefaultPackageResolver({ resolve, access });

      // pathToFileURL keeps the URLs convertible back to paths on every
      // platform (bare file:///repo/... has no drive letter and throws in
      // fileURLToPath on Windows).
      const fallbackUrls = [
        pathToFileURL(path.resolve('/repo/node_modules/@debugmcp/adapter-javascript/dist/index.js')).href,
        pathToFileURL(path.resolve('/repo/packages/adapter-javascript/dist/index.js')).href
      ];
      await expect(resolver.isInstalled('@debugmcp/adapter-javascript', fallbackUrls)).resolves.toBe(true);
      // candidate 1's entry, candidate 1's package.json, candidate 2's entry
      expect(access).toHaveBeenCalledTimes(3);
    });

    it('reports not installed when nothing resolves', async () => {
      const resolver = createDefaultPackageResolver({
        resolve: vi.fn().mockImplementation(() => { throw new Error('nope'); }),
        access: vi.fn().mockRejectedValue(new Error('ENOENT'))
      });

      await expect(resolver.isInstalled(
        '@debugmcp/adapter-nonexistent',
        [pathToFileURL(path.resolve('/repo/packages/adapter-nonexistent/dist/index.js')).href]
      )).resolves.toBe(false);
    });
  });

  describe('caching behavior', () => {
    it('should maintain separate cache entries for different languages', async () => {
      const mockPythonFactory = createMockAdapterFactory('python');
      const mockMockFactory = createMockAdapterFactory('mock');

      (mockModuleLoader.load as Mock).mockImplementation((path: string) => {
        if (path === '@debugmcp/adapter-python') {
          return Promise.resolve({ PythonAdapterFactory: vi.fn().mockImplementation(function() { return mockPythonFactory; }) });
        } else if (path === '@debugmcp/adapter-mock') {
          return Promise.resolve({ MockAdapterFactory: vi.fn().mockImplementation(function() { return mockMockFactory; }) });
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
