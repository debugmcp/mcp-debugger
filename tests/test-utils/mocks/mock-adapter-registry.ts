/**
 * Mock adapter registry for testing
 * 
 * Provides reusable mocks for IAdapterRegistry interface with realistic behavior
 */
import { vi } from 'vitest';
import { IAdapterRegistry, AdapterInfo } from '../../../src/adapters/adapter-registry-interface.js';
import { DebugLanguage } from '../../../src/session/models.js';

/**
 * Create a standard mock adapter registry with default behavior
 */
export function createMockAdapterRegistry(): IAdapterRegistry {
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
    
    create: vi.fn().mockImplementation(async (language: string) => ({
      language: language as DebugLanguage,
      name: `${language} Debug Adapter`,
      
      // IDebugAdapter lifecycle methods
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
      
      // Adapter configuration - THIS IS THE CRITICAL METHOD
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
    })),
    
    register: vi.fn().mockResolvedValue(undefined),
    
    unregister: vi.fn().mockReturnValue(true),
    
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
