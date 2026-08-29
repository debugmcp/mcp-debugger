/**
 * Mock adapter registry for testing
 * 
 * Provides reusable mocks for IAdapterRegistry interface with realistic behavior
 */
import { vi } from 'vitest';
import { IAdapterRegistry, AdapterInfo } from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { FakeDebugAdapter } from '../fakes/fake-debug-adapter.js';

/** Options for {@link createMockAdapterRegistry}. */
export interface MockAdapterRegistryOptions {
  /**
   * Replace what `create()` hands back. Defaults to a {@link FakeDebugAdapter} for the
   * requested language.
   */
  createAdapter?: IAdapterRegistry['create'];
}

/**
 * Create a standard mock adapter registry with default behavior
 */
export function createMockAdapterRegistry(
  options: MockAdapterRegistryOptions = {}
): IAdapterRegistry {
  const supportedLanguages = ['python', 'mock'];
  
  // Create realistic adapter info
  const adapterInfoMap = new Map<string, AdapterInfo>([
    ['python', {
      language: DebugLanguage.PYTHON,
      displayName: 'Python Debug Adapter',
      version: '1.0.0',
      author: 'MCP Debug Team',
      description: 'Debug adapter for Python',
      available: true,
      activeInstances: 0,
      registeredAt: new Date(),
      fileExtensions: ['.py']
    }],
    ['mock', {
      language: DebugLanguage.MOCK,
      displayName: 'Mock Debug Adapter',
      version: '1.0.0',
      author: 'MCP Debug Team',
      description: 'Mock adapter for testing',
      available: true,
      activeInstances: 0,
      registeredAt: new Date(),
      fileExtensions: ['.mock', '.js']
    }]
  ]);

  return {
    getSupportedLanguages: vi.fn().mockReturnValue(supportedLanguages),
    
    isLanguageSupported: vi.fn().mockImplementation((lang: string) => 
      supportedLanguages.includes(lang)
    ),
    
    // One conformant fake, not a re-typed literal: FakeDebugAdapter implements
    // IDebugAdapter, so the compiler now catches the drift this block used to carry
    // (a sync transformLaunchConfig, the long-removed translateScriptPath /
    // translateBreakpointPath, and 15 inert EventEmitter stubs in place of a real emitter).
    create: vi.fn<IAdapterRegistry['create']>(async (language, config) => {
      // Branch on the option, not on the result: `createAdapter` returns a Promise, which is
      // never nullish, so a `??` fallback here would be dead code the moment the option is
      // supplied. Awaiting it also lets a stub that resolves nothing fail here, with the
      // language named, instead of as a TypeError deep inside startProxyManager.
      if (options.createAdapter) {
        const adapter = await options.createAdapter(language, config);
        if (!adapter) {
          throw new Error(
            `createMockAdapterRegistry: createAdapter returned no adapter for ${language}`
          );
        }
        return adapter;
      }

      return new FakeDebugAdapter({
        language: language as DebugLanguage,
        name: `${language} Debug Adapter`
      });
    }),

    register: vi.fn().mockResolvedValue(undefined),

    unregister: vi.fn().mockReturnValue(true),

    // Typed discovery surface (issue #435 part 4). Defaults are fail-open
    // neutral and mirror the pre-typed fallback paths: languages from the
    // supported list, entries with attach 'none', and no loadable factory
    // (consumers assume availability when they cannot probe). Tests that
    // need richer behavior override per-test, as before. Implementations
    // (not mockResolvedValue) so the defaults survive mockReset/
    // vi.resetAllMocks — a reset mockResolvedValue returns bare undefined,
    // which TypeErrors consumers that chain .catch() on the result.
    listLanguages: vi.fn(async () => supportedLanguages),

    listAvailableAdapters: vi.fn(async () =>
      supportedLanguages.map((language) => ({
        name: language,
        packageName: `@debugmcp/adapter-${language}`,
        installed: true,
        attach: 'none' as const
      }))
    ),

    getFactory: vi.fn(async () => undefined),

    getFactoryMetadata: vi.fn(async () => undefined),

    // getFactoryResult is deliberately ABSENT: the availability probe prefers
    // it over getFactory, so a default here would shadow the per-test
    // getFactory overrides most suites use. Production-branch coverage lives
    // in the parity fence and the direct probe/gate/registry tests.

    getAdapterInfo: vi.fn().mockImplementation((lang: string) =>
      adapterInfoMap.get(lang)
    ),
    
    getAllAdapterInfo: vi.fn().mockReturnValue(adapterInfoMap),
    
    disposeAll: vi.fn().mockResolvedValue(undefined),
    
    getActiveAdapterCount: vi.fn().mockReturnValue(0)
  };
}

/**
 * Create a mock adapter registry that simulates errors
 * Useful for testing error handling paths
 */
export function createMockAdapterRegistryWithErrors(): IAdapterRegistry {
  const mock = createMockAdapterRegistry();
  
  // Override to simulate no languages supported
  mock.getSupportedLanguages = vi.fn().mockReturnValue([]);
  mock.isLanguageSupported = vi.fn().mockReturnValue(false);
  mock.listLanguages = vi.fn(async () => []);
  mock.listAvailableAdapters = vi.fn(async () => []);
  mock.create = vi.fn().mockRejectedValue(new Error('Adapter not found'));
  mock.getAdapterInfo = vi.fn().mockReturnValue(undefined);
  mock.getAllAdapterInfo = vi.fn().mockReturnValue(new Map());
  
  return mock;
}

/**
 * Create a mock adapter registry with specific language support
 * @param languages Array of supported language names
 */
export function createMockAdapterRegistryWithLanguages(languages: string[]): IAdapterRegistry {
  const mock = createMockAdapterRegistry();
  
  mock.getSupportedLanguages = vi.fn().mockReturnValue(languages);
  mock.isLanguageSupported = vi.fn().mockImplementation((lang: string) =>
    languages.includes(lang)
  );
  mock.listLanguages = vi.fn(async () => languages);
  mock.listAvailableAdapters = vi.fn(async () =>
    languages.map((language) => ({
      name: language,
      packageName: `@debugmcp/adapter-${language}`,
      installed: true,
      attach: 'none' as const
    }))
  );

  // Update adapter info to match languages
  const adapterInfoMap = new Map<string, AdapterInfo>();
  languages.forEach(lang => {
    adapterInfoMap.set(lang, {
      language: lang as DebugLanguage,
      displayName: `${lang} Debug Adapter`,
      version: '1.0.0',
      author: 'MCP Debug Team',
      description: `Debug adapter for ${lang}`,
      available: true,
      activeInstances: 0,
      registeredAt: new Date()
    });
  });
  
  mock.getAdapterInfo = vi.fn().mockImplementation((lang: string) => 
    adapterInfoMap.get(lang)
  );
  mock.getAllAdapterInfo = vi.fn().mockReturnValue(adapterInfoMap);
  
  return mock;
}

/**
 * Helper to verify adapter registry mock was called correctly
 */
export function expectAdapterRegistryLanguageCheck(
  mock: IAdapterRegistry, 
  language: string,
  expectedCalls: number = 1
): void {
  expect(mock.isLanguageSupported).toHaveBeenCalledWith(language);
  expect(mock.isLanguageSupported).toHaveBeenCalledTimes(expectedCalls);
}

/**
 * Helper to verify adapter creation
 */
export function expectAdapterCreation(
  mock: IAdapterRegistry,
  language: string
): void {
  expect(mock.create).toHaveBeenCalledWith(
    language,
    expect.objectContaining({
      sessionId: expect.any(String),
      executablePath: expect.any(String)
    })
  );
}

/**
 * Reset all mock functions on an adapter registry mock
 */
export function resetAdapterRegistryMock(mock: IAdapterRegistry): void {
  Object.values(mock).forEach(value => {
    if (typeof value === 'function' && 'mockReset' in value) {
      const mockFn = value as ReturnType<typeof vi.fn>;
      mockFn.mockReset();
    }
  });
}
