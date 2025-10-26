import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import path from 'path';
import { AdapterRegistry } from '../../../src/adapters/adapter-registry.js';
import { DebugLanguage, AdapterState, DuplicateRegistrationError, FactoryValidationError, AdapterNotFoundError } from '@debugmcp/shared';
import type { AdapterConfig, IDebugAdapter } from '@debugmcp/shared';

const createProductionDependenciesMock = vi.fn().mockImplementation(() => ({
  fileSystem: {},
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  environment: {},
  processLauncher: {},
  networkManager: {}
}));

vi.mock('../../../src/container/dependencies.js', () => ({
  createProductionDependencies: createProductionDependenciesMock
}));

class StubAdapter extends EventEmitter implements IDebugAdapter {
  language = DebugLanguage.PYTHON;
  name = 'Stub Adapter';
  initialize = vi.fn().mockResolvedValue(undefined);
  dispose = vi.fn().mockResolvedValue(undefined);
  getState = vi.fn().mockReturnValue(AdapterState.READY);
  isReady = vi.fn().mockReturnValue(true);
  getCurrentThreadId = vi.fn().mockReturnValue(null);
  validateEnvironment = vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] });
  getRequiredDependencies = vi.fn().mockReturnValue([]);
  resolveExecutablePath = vi.fn().mockResolvedValue('python');
  getDefaultExecutableName = vi.fn().mockReturnValue('python');
  getExecutableSearchPaths = vi.fn().mockReturnValue([]);
  buildAdapterCommand = vi.fn().mockReturnValue({ command: 'python', args: [] });
  getAdapterModuleName = vi.fn().mockReturnValue('debugpy.adapter');
  getAdapterInstallCommand = vi.fn().mockReturnValue('pip install debugpy');
  transformLaunchConfig = vi.fn().mockImplementation(config => config);
  getDefaultLaunchConfig = vi.fn().mockReturnValue({});
  sendDapRequest = vi.fn().mockResolvedValue({} as any);
  handleDapEvent = vi.fn();
  handleDapResponse = vi.fn();
  connect = vi.fn().mockResolvedValue(undefined);
  disconnect = vi.fn().mockResolvedValue(undefined);
  isConnected = vi.fn().mockReturnValue(false);
  getInstallationInstructions = vi.fn().mockReturnValue('');
  getMissingExecutableError = vi.fn().mockReturnValue('');
  translateErrorMessage = vi.fn().mockImplementation((error: Error) => error.message);
  supportsFeature = vi.fn().mockReturnValue(false);
  getFeatureRequirements = vi.fn().mockReturnValue([]);
  getCapabilities = vi.fn().mockReturnValue({} as any);
}

const makeFactory = () => {
  const createAdapter = vi.fn().mockImplementation(() => new StubAdapter());
  return {
    createAdapter,
    getMetadata: vi.fn().mockReturnValue({
      language: 'python',
      displayName: 'Python',
      version: '1.0.0',
      author: 'Test',
      description: 'Test adapter'
    }),
    validate: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] })
  };
};

const baseConfig: AdapterConfig = {
  sessionId: 'session-1',
  executablePath: 'python',
  adapterHost: '127.0.0.1',
  adapterPort: 5678,
  logDir: path.join(process.cwd(), '.logs'),
  scriptPath: path.join(process.cwd(), 'app.py'),
  launchConfig: {}
};

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

beforeEach(() => {
  createProductionDependenciesMock.mockClear();
  createProductionDependenciesMock.mockReturnValue({
    fileSystem: {},
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    environment: {},
    processLauncher: {},
    networkManager: {}
  });
  registry = new AdapterRegistry({ autoDispose: false });
});

  it('registers factories and creates adapters', async () => {
    const factory = makeFactory();
    await registry.register('python', factory);

    expect(registry.getSupportedLanguages()).toContain('python');

    const adapter = await registry.create('python', baseConfig);

    expect(factory.createAdapter).toHaveBeenCalled();
    expect((adapter as StubAdapter).initialize).toHaveBeenCalled();
    expect(registry.getActiveAdapterCount()).toBe(1);
  });

  it('prevents duplicate registrations by default', async () => {
    const factory = makeFactory();
    await registry.register('python', factory);

    await expect(registry.register('python', makeFactory())).rejects.toThrow(DuplicateRegistrationError);
  });

  it('throws when factory validation fails', async () => {
    const invalidFactory = {
      createAdapter: vi.fn(),
      getMetadata: vi.fn().mockReturnValue({
        language: 'go',
        displayName: 'Go',
        version: '0.1.0',
        author: 'Test',
        description: 'Invalid adapter'
      }),
      validate: vi.fn().mockResolvedValue({ valid: false, errors: ['missing binary'], warnings: [] })
    };

    await expect(registry.register('go', invalidFactory)).rejects.toThrow(FactoryValidationError);
  });

  it('throws when creating an adapter for an unknown language', async () => {
    await expect(registry.create('ruby', baseConfig)).rejects.toThrow(AdapterNotFoundError);
  });

  it('enforces maximum instances per language', async () => {
    const limitedRegistry = new AdapterRegistry({ maxInstancesPerLanguage: 1, autoDispose: false, validateOnRegister: false });
    const factory = makeFactory();
    await limitedRegistry.register('python', factory);

    (limitedRegistry as unknown as { activeAdapters: Map<string, Set<IDebugAdapter>> }).activeAdapters.set(
      'python',
      new Set([new StubAdapter()])
    );

    expect(createProductionDependenciesMock).not.toHaveBeenCalled();
    await expect(limitedRegistry.create('python', baseConfig)).rejects.toThrow(/Maximum adapter instances/);
    expect(createProductionDependenciesMock).not.toHaveBeenCalled();
  });

  it('unregisters factories and disposes active adapters', async () => {
    const factory = makeFactory();
    await registry.register('python', factory);

    const adapter = (await registry.create('python', baseConfig)) as StubAdapter;
    adapter.dispose.mockResolvedValue(undefined);

    const result = registry.unregister('python');

    expect(result).toBe(true);
    expect(adapter.dispose).toHaveBeenCalled();
    expect(registry.isLanguageSupported('python')).toBe(false);
  });

  it('disposes all adapters and clears registry state', async () => {
    const factory = makeFactory();
    await registry.register('python', factory);
    await registry.create('python', baseConfig);

    await registry.disposeAll();

    expect(registry.getSupportedLanguages()).toHaveLength(0);
    expect(registry.getActiveAdapterCount()).toBe(0);
  });

  it('reports available adapters when dynamic loading is disabled', async () => {
    const python = makeFactory();
    const mock = makeFactory();

    await registry.register('python', python);
    await registry.register('mock', mock);

    const available = await registry.listAvailableAdapters();

    expect(available).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'python', installed: true }),
        expect.objectContaining({ name: 'mock', installed: true })
      ])
    );
  });

  it('returns registered languages when dynamic loading disabled', async () => {
    const factory = makeFactory();
    await registry.register('python', factory);

    const languages = await registry.listLanguages();

    expect(languages).toEqual(['python']);
  });

  it('auto-disposes idle adapters after the timeout', async () => {
    vi.useFakeTimers();
    const autoRegistry = new AdapterRegistry({ autoDisposeTimeout: 50, validateOnRegister: false });
    const factory = makeFactory();
    await autoRegistry.register('python', factory);

    const adapter = (await autoRegistry.create('python', baseConfig)) as StubAdapter;
    adapter.dispose.mockResolvedValue(undefined);

    adapter.emit('stateChanged', AdapterState.READY, AdapterState.DISCONNECTED);
    await vi.advanceTimersByTimeAsync(60);

    expect(adapter.dispose).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
