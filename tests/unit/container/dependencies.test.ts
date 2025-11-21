import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const createLoggerMock = vi.fn(() => ({
  info: vi.fn(),
  warn: vi.fn()
}));

const fileSystemInstance = { tag: 'fs' };
const processManagerInstance = { tag: 'pm' };
const networkManagerInstance = { tag: 'net' };
const processLauncherInstance = { tag: 'pl' };
const proxyProcessLauncherInstance = { tag: 'proxy-pl' };
const debugTargetLauncherInstance = { tag: 'debug-pl' };
const proxyManagerFactoryInstance = { tag: 'proxy-factory' };
const sessionStoreFactoryInstance = { tag: 'session-factory' };

const registerMock = vi.fn();
const getSupportedLanguagesMock = vi.fn(() => []);

vi.mock('../../../src/utils/logger.js', () => ({
  createLogger: createLoggerMock
}));

vi.mock('../../../src/implementations/index.js', () => ({
  FileSystemImpl: vi.fn(() => fileSystemInstance),
  ProcessManagerImpl: vi.fn(() => processManagerInstance),
  NetworkManagerImpl: vi.fn(() => networkManagerInstance),
  ProcessLauncherImpl: vi.fn(() => processLauncherInstance),
  ProxyProcessLauncherImpl: vi.fn(() => proxyProcessLauncherInstance),
  DebugTargetLauncherImpl: vi.fn(() => debugTargetLauncherInstance)
}));

const environmentInstance = { tag: 'env' };
vi.mock('../../../src/implementations/environment-impl.js', () => ({
  ProcessEnvironment: vi.fn(() => environmentInstance)
}));

vi.mock('../../../src/factories/proxy-manager-factory.js', () => ({
  ProxyManagerFactory: vi.fn(() => proxyManagerFactoryInstance),
  ProxyManagerFactoryDependencies: {}
}));

vi.mock('../../../src/factories/session-store-factory.js', () => ({
  SessionStoreFactory: vi.fn(() => sessionStoreFactoryInstance)
}));

class AdapterRegistryMock {
  public config;
  constructor(config: unknown) {
    this.config = config;
  }
  register = registerMock;
  getSupportedLanguages = getSupportedLanguagesMock;
}

vi.mock('../../../src/adapters/adapter-registry.js', () => ({
  AdapterRegistry: AdapterRegistryMock
}));

const isLanguageDisabledMock = vi.fn(() => false);

vi.mock('../../../src/utils/language-config.js', () => ({
  isLanguageDisabled: (...args: unknown[]) => isLanguageDisabledMock(...args)
}));

const { createProductionDependencies } = await import('../../../src/container/dependencies.js');

const originalEnv = { ...process.env };
const BUNDLED_ADAPTERS_KEY = '__DEBUG_MCP_BUNDLED_ADAPTERS__';

beforeEach(() => {
  process.env = { ...originalEnv };
  createLoggerMock.mockClear().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn()
  });
  registerMock.mockClear();
  getSupportedLanguagesMock.mockClear().mockReturnValue([]);
  isLanguageDisabledMock.mockReset().mockReturnValue(false);
  delete (globalThis as Record<string, unknown>)[BUNDLED_ADAPTERS_KEY];
});

afterEach(() => {
  process.env = originalEnv;
  delete (globalThis as Record<string, unknown>)[BUNDLED_ADAPTERS_KEY];
});

describe('createProductionDependencies', () => {
  it('wires core services with provided configuration', () => {
    const dependencies = createProductionDependencies({
      logLevel: 'debug',
      logFile: '/tmp/debug.log',
      loggerOptions: { extra: true }
    });

    expect(createLoggerMock).toHaveBeenCalledWith('debug-mcp', {
      level: 'debug',
      file: '/tmp/debug.log',
      extra: true
    });

    expect(dependencies).toMatchObject({
      fileSystem: fileSystemInstance,
      processManager: processManagerInstance,
      networkManager: networkManagerInstance,
      logger: createLoggerMock.mock.results[0]?.value,
      environment: environmentInstance,
      processLauncher: processLauncherInstance,
      proxyProcessLauncher: proxyProcessLauncherInstance,
      debugTargetLauncher: debugTargetLauncherInstance,
      proxyManagerFactory: proxyManagerFactoryInstance,
      sessionStoreFactory: sessionStoreFactoryInstance,
      adapterRegistry: expect.any(AdapterRegistryMock)
    });

    const registry = dependencies.adapterRegistry as AdapterRegistryMock;
    expect(registry.config).toEqual(
      expect.objectContaining({
        validateOnRegister: false,
        allowOverride: false,
        enableDynamicLoading: true
      })
    );
  });

  it('registers bundled adapters and logs async failures', async () => {
    const firstFactoryInstance = { instance: 'first' };
    const secondFactoryInstance = { instance: 'second' };

    class FirstFactory {
      constructor() {
        return firstFactoryInstance;
      }
    }
    class SecondFactory {
      constructor() {
        return secondFactoryInstance;
      }
    }

    registerMock.mockImplementationOnce(() => undefined);
    registerMock.mockImplementationOnce(() => Promise.reject(new Error('boom')));

    const logger = {
      info: vi.fn(),
      warn: vi.fn()
    };
    createLoggerMock.mockReturnValue(logger);

    (globalThis as Record<string, unknown>)[BUNDLED_ADAPTERS_KEY] = [
      { language: 'alpha', factoryCtor: FirstFactory as unknown as new () => unknown },
      { language: 'beta', factoryCtor: SecondFactory as unknown as new () => unknown }
    ];

    createProductionDependencies();

    expect(registerMock).toHaveBeenNthCalledWith(1, 'alpha', firstFactoryInstance);
    expect(registerMock).toHaveBeenNthCalledWith(2, 'beta', secondFactoryInstance);

    await Promise.resolve();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to register bundled adapter 'beta':")
    );
  });

  it('skips container adapters when disabled via environment', () => {
    process.env.MCP_CONTAINER = 'true';
    isLanguageDisabledMock.mockReturnValue(true);

    const logger = {
      info: vi.fn(),
      warn: vi.fn()
    };
    createLoggerMock.mockReturnValue(logger);

    createProductionDependencies();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Skipping bundled adapter 'python'")
    );

    // Disabled adapters should not trigger register calls
    expect(registerMock).toHaveBeenCalledTimes(0);
  });
});
