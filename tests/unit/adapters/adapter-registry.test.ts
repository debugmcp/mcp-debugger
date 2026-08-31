import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdapterRegistry, getAdapterRegistry, resetAdapterRegistry } from '../../../src/adapters/adapter-registry.js';
import { AdapterNotFoundError, DuplicateRegistrationError, FactoryValidationError } from '@debugmcp/shared';
import { createProductionDependencies } from '../../../src/container/dependencies.js';
import { createMockDependencies } from '../../test-utils/helpers/test-dependencies.js';

// AdapterRegistry.create() dynamically imports the production container.
// Keep this suite on inert dependencies so repeated registry construction
// never attaches real winston transports or accumulates process listeners.
vi.mock('../../../src/container/dependencies.js');
vi.mock('../../../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}));

const createAdapterStub = () => {
  const eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      const handlers = eventHandlers.get(event) ?? [];
      handlers.push(listener);
      eventHandlers.set(event, handlers);
    }),
    once: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      const wrapped = (...args: unknown[]) => {
        listener(...args);
        const handlers = eventHandlers.get(event) ?? [];
        eventHandlers.set(
          event,
          handlers.filter(handler => handler !== wrapped)
        );
      };
      const handlers = eventHandlers.get(event) ?? [];
      handlers.push(wrapped);
      eventHandlers.set(event, handlers);
    }),
    emit: (event: string, ...args: unknown[]) => {
      const handlers = eventHandlers.get(event) ?? [];
      handlers.forEach(handler => handler(...args));
    },
    dispose: vi.fn().mockResolvedValue(undefined)
  };
};

const createFactory = (overrides: Partial<ReturnType<typeof createFactory>> = {}) => {
  const adapter = createAdapterStub();
  return {
    validate: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
    getMetadata: vi.fn().mockReturnValue({ name: 'mock', version: '1.0.0' }),
    createAdapter: vi.fn().mockReturnValue(adapter),
    __adapter: adapter,
    ...overrides
  };
};

describe('AdapterRegistry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('MCP_CONTAINER', undefined);
    const dependencies = {
      ...createMockDependencies(),
      environment: {
        get: vi.fn((key: string) => process.env[key]),
        getAll: vi.fn(() => ({ ...process.env })),
        getCurrentWorkingDirectory: vi.fn(() => process.cwd())
      }
    };
    vi.mocked(createProductionDependencies).mockReturnValue(dependencies as any);
  });

  it('registers and unregisters factories (with validation)', async () => {
    const registry = new AdapterRegistry();
    const factory = createFactory();

    await registry.register('mock', factory as any);
    expect(factory.validate).toHaveBeenCalled();

    const unregistered = registry.unregister('mock');
    expect(unregistered).toBe(true);
    expect(registry.unregister('mock')).toBe(false);
  });

  it('throws when duplicate registration not allowed', async () => {
    const registry = new AdapterRegistry();
    const factory = createFactory();

    await registry.register('mock', factory as any);
    await expect(registry.register('mock', factory as any)).rejects.toThrow(DuplicateRegistrationError);
  });

  it('throws FactoryValidationError when validation fails', async () => {
    const registry = new AdapterRegistry();
    const factory = createFactory({
      validate: vi.fn().mockResolvedValue({
        valid: false,
        errors: [{ message: 'nope' }],
        warnings: []
      })
    });

    await expect(registry.register('mock', factory as any)).rejects.toThrow(FactoryValidationError);
  });

  it('creates adapter via registered factory and enforces max instances', async () => {
    const registry = new AdapterRegistry({ maxInstancesPerLanguage: 1 });
    const adapterStub = createAdapterStub();
    const factory = createFactory({
      createAdapter: vi.fn().mockReturnValue(adapterStub)
    });

    await registry.register('mock', factory as any);

    const adapterConfig = {
      sessionId: 's1',
      adapterHost: '127.0.0.1',
      adapterPort: 9000,
      logDir: '/tmp/logs',
      scriptPath: '/tmp/app.js',
      executablePath: '',
      launchConfig: {}
    };

    const adapter = await registry.create('mock', adapterConfig);
    expect(factory.createAdapter).toHaveBeenCalled();
    expect(registry.getActiveAdapterCount()).toBe(1);

    await expect(registry.create('mock', adapterConfig)).rejects.toThrow(/Maximum adapter instances/);

    await adapter.dispose();
    expect(adapterStub.dispose).toHaveBeenCalled();
  });

  it('skips environment initialization for direct-connect attach sessions (issue #331)', async () => {
    const registry = new AdapterRegistry();
    const adapterStub = createAdapterStub();
    const factory = createFactory({
      createAdapter: vi.fn().mockReturnValue(adapterStub),
      getMetadata: vi.fn().mockReturnValue({
        name: 'ruby',
        version: '1.0.0',
        modes: { launch: true, attach: 'direct-connect' }
      })
    });

    await registry.register('ruby', factory as any);

    const baseConfig = {
      sessionId: 's1',
      adapterHost: '127.0.0.1',
      adapterPort: 9000,
      logDir: '/tmp/logs',
      scriptPath: 'attach://remote',
      executablePath: '',
      launchConfig: {}
    };

    await registry.create('ruby', { ...baseConfig, attachMode: true });
    expect(adapterStub.initialize).not.toHaveBeenCalled();

    // Launch (or attach on non-direct-connect adapters) still initializes
    await registry.create('ruby', { ...baseConfig, attachMode: false });
    expect(adapterStub.initialize).toHaveBeenCalledTimes(1);
  });

  it('dynamically loads adapters when enabled and initial lookup fails', async () => {
    const loadedAdapter = createAdapterStub();
    const loadedFactory = createFactory({
      createAdapter: vi.fn().mockReturnValue(loadedAdapter)
    });

    const registry = new AdapterRegistry({ enableDynamicLoading: true });
    const loadSpy = vi.spyOn(registry as any, 'loader', 'get').mockReturnValue({
      loadAdapter: vi.fn().mockResolvedValue(loadedFactory)
    });

    const adapter = await registry.create('dynamic', {
      sessionId: 's1',
      adapterHost: '127.0.0.1',
      adapterPort: 9000,
      logDir: '/tmp/logs',
      scriptPath: '/tmp/app.js',
      executablePath: '',
      launchConfig: {}
    });

    expect(loadSpy).toHaveBeenCalled();
    expect(adapter).toBeDefined();
  });

  it('throws AdapterNotFoundError when dynamic load fails', async () => {
    const registry = new AdapterRegistry({ enableDynamicLoading: true });
    vi.spyOn(registry as any, 'loader', 'get').mockReturnValue({
      loadAdapter: vi.fn().mockRejectedValue(new Error('missing'))
    });

    await expect(
      registry.create('missing', {
        sessionId: 's1',
        adapterHost: '127.0.0.1',
        adapterPort: 9000,
        logDir: '/tmp/logs',
        scriptPath: '/tmp/app.js',
        executablePath: '',
        launchConfig: {}
      })
    ).rejects.toBeInstanceOf(AdapterNotFoundError);
  });

  describe('getFactory / getFactoryResult', () => {
    it('returns a registered factory without touching the loader', async () => {
      const registry = new AdapterRegistry();
      const factory = createFactory();
      await registry.register('mock', factory as any);

      await expect(registry.getFactory('mock')).resolves.toBe(factory);
      await expect(registry.getFactoryResult('mock')).resolves.toEqual({ factory });
    });

    it('returns a loader-cached factory', async () => {
      const cached = createFactory();
      const registry = new AdapterRegistry({ enableDynamicLoading: true });
      vi.spyOn(registry as any, 'loader', 'get').mockReturnValue({
        getCachedFactory: vi.fn().mockReturnValue(cached),
        loadAdapter: vi.fn()
      });

      await expect(registry.getFactory('python')).resolves.toBe(cached);
      await expect(registry.getFactoryResult('python')).resolves.toEqual({ factory: cached });
    });

    it('surfaces the loader error through getFactoryResult while getFactory stays fail-open', async () => {
      const registry = new AdapterRegistry({ enableDynamicLoading: true });
      vi.spyOn(registry as any, 'loader', 'get').mockReturnValue({
        getCachedFactory: vi.fn().mockReturnValue(undefined),
        loadAdapter: vi.fn().mockRejectedValue(new Error('Failed to load adapter: corrupted dist'))
      });

      await expect(registry.getFactory('python')).resolves.toBeUndefined();

      const result = await registry.getFactoryResult('python');
      expect(result.factory).toBeUndefined();
      expect(result.loadError).toBeInstanceOf(Error);
      expect(result.loadError?.message).toContain('corrupted dist');
    });

    it('reports dynamicLoadingDisabled for an unregistered language when loading is off', async () => {
      const registry = new AdapterRegistry();

      await expect(registry.getFactory('python')).resolves.toBeUndefined();
      await expect(registry.getFactoryResult('python')).resolves.toEqual({ dynamicLoadingDisabled: true });
    });
  });

  describe('discovery hardening (issue #435 part 4 review)', () => {
    it('routes the listAvailableAdapters fallback warning through the injected config logger', async () => {
      const warn = vi.fn();
      const registry = new AdapterRegistry({ enableDynamicLoading: true, logger: { warn } });
      vi.spyOn(registry as any, 'loader', 'get').mockReturnValue({
        listAvailableAdapters: vi.fn().mockRejectedValue(new Error('loader exploded'))
      });

      await registry.listAvailableAdapters();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('loader exploded'));
    });

    it('routes the listLanguages fallback warning through the injected config logger', async () => {
      const warn = vi.fn();
      const registry = new AdapterRegistry({ enableDynamicLoading: true, logger: { warn } });
      vi.spyOn(registry as any, 'loader', 'get').mockReturnValue({
        listAvailableAdapters: vi.fn().mockRejectedValue(new Error('loader exploded'))
      });

      await registry.listLanguages();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('loader exploded'));
    });

    it('keeps listing when a registered factory getMetadata throws (attach falls back to none)', async () => {
      // A plain-JS third-party factory can stay registered with a throwing
      // getMetadata: register() sets the factories map BEFORE the emit that
      // calls getMetadata(), and production registration sites swallow the
      // rejection. One bad factory must not then reject the whole listing
      // (which would kill every doctor verdict).
      const registry = new AdapterRegistry();
      const factory = createFactory({
        getMetadata: vi.fn(() => {
          throw new Error('metadata exploded');
        })
      });
      await registry.register('mock', factory as any).catch(() => undefined);

      const adapters = await registry.listAvailableAdapters();

      expect(adapters).toEqual([
        expect.objectContaining({ name: 'mock', installed: true, attach: 'none' })
      ]);
    });
  });

  it('auto-disposes adapters on state change and clears timers', async () => {
    vi.useFakeTimers();

    const registry = new AdapterRegistry({
      autoDispose: true,
      autoDisposeTimeout: 1000
    });

    const adapterStub = createAdapterStub();
    const factory = createFactory({
      createAdapter: vi.fn().mockReturnValue(adapterStub)
    });

    await registry.register('mock', factory as any);

    const adapter = await registry.create('mock', {
      sessionId: 's1',
      adapterHost: '127.0.0.1',
      adapterPort: 9000,
      logDir: '/tmp',
      scriptPath: '/tmp/app.js',
      executablePath: '',
      launchConfig: {}
    });

    // Trigger disconnect state to start timer
    adapterStub.emit('stateChanged', 'debugging', 'disconnected');
    expect(adapterStub.dispose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(adapterStub.dispose).toHaveBeenCalled();

    // Re-activate and ensure timer clears
    adapterStub.dispose.mockClear();
    adapterStub.emit('stateChanged', 'connected', 'debugging');
    vi.advanceTimersByTime(1000);
    expect(adapterStub.dispose).not.toHaveBeenCalled();

    await adapter.dispose();
    vi.useRealTimers();
  });

  it('disposeAll waits for active adapters and clears factories', async () => {
    const registry = new AdapterRegistry();
    const adapterStub = createAdapterStub();

    const factory = createFactory({
      createAdapter: vi.fn().mockReturnValue(adapterStub)
    });

    await registry.register('mock', factory as any);
    const adapter = await registry.create('mock', {
      sessionId: 's1',
      adapterHost: '127.0.0.1',
      adapterPort: 9000,
      logDir: '/tmp',
      scriptPath: '/tmp/app.js',
      executablePath: '',
      launchConfig: {}
    });

    const disposeAllPromise = registry.disposeAll();
    await disposeAllPromise;

    expect(adapterStub.dispose).toHaveBeenCalled();
    expect(registry.getActiveAdapterCount()).toBe(0);
    expect(() => adapter.dispose()).not.toThrow();
  });

  it('allows override registration when allowOverride is true', async () => {
    const registry = new AdapterRegistry({ allowOverride: true });
    const factory1 = createFactory();
    const factory2 = createFactory();

    await registry.register('mock', factory1 as any);
    await registry.register('mock', factory2 as any);

    expect(registry.getSupportedLanguages()).toEqual(['mock']);
  });

  describe('listLanguages', () => {
    it('returns only registered languages without dynamic loading', async () => {
      const registry = new AdapterRegistry();
      const factory = createFactory();

      await registry.register('mock', factory as any);

      const languages = await registry.listLanguages();
      expect(languages).toEqual(['mock']);
    });

    it('merges registered and dynamically discovered installed languages', async () => {
      const registry = new AdapterRegistry({ enableDynamicLoading: true });
      const factory = createFactory();
      await registry.register('mock', factory as any);

      vi.spyOn(registry as any, 'loader', 'get').mockReturnValue({
        listAvailableAdapters: vi.fn().mockResolvedValue([
          { name: 'python', installed: true },
          { name: 'go', installed: false }
        ])
      });

      const languages = await registry.listLanguages();
      expect(languages).toContain('mock');
      expect(languages).toContain('python');
      // go is not installed, so it should not be listed
      expect(languages).not.toContain('go');
    });

    it('falls back to registered languages when loader throws', async () => {
      const registry = new AdapterRegistry({ enableDynamicLoading: true });
      const factory = createFactory();
      await registry.register('mock', factory as any);

      vi.spyOn(registry as any, 'loader', 'get').mockReturnValue({
        listAvailableAdapters: vi.fn().mockRejectedValue(new Error('loader error'))
      });

      const languages = await registry.listLanguages();
      expect(languages).toEqual(['mock']);
    });
  });

  describe('listAvailableAdapters', () => {
    it('returns minimal metadata without dynamic loading', async () => {
      const registry = new AdapterRegistry();
      const factory = createFactory();
      await registry.register('mock', factory as any);

      const adapters = await registry.listAvailableAdapters();
      expect(adapters).toEqual([{
        name: 'mock',
        packageName: '@debugmcp/adapter-mock',
        description: undefined,
        installed: true,
        attach: 'none'
      }]);
    });

    it('merges loader metadata with registered, overriding installed status', async () => {
      const registry = new AdapterRegistry({ enableDynamicLoading: true });
      const factory = createFactory();
      await registry.register('mock', factory as any);

      vi.spyOn(registry as any, 'loader', 'get').mockReturnValue({
        listAvailableAdapters: vi.fn().mockResolvedValue([
          { name: 'mock', packageName: '@debugmcp/adapter-mock', installed: false, description: 'Mock' },
          { name: 'python', packageName: '@debugmcp/adapter-python', installed: true, description: 'Python' }
        ])
      });

      const adapters = await registry.listAvailableAdapters();
      const mockAdapter = adapters.find(a => a.name === 'mock');
      const pythonAdapter = adapters.find(a => a.name === 'python');

      // Registered adapter overrides installed to true
      expect(mockAdapter?.installed).toBe(true);
      expect(pythonAdapter?.installed).toBe(true);
    });

    it('falls back to registered adapters when loader throws', async () => {
      const registry = new AdapterRegistry({ enableDynamicLoading: true });
      const factory = createFactory();
      await registry.register('mock', factory as any);

      vi.spyOn(registry as any, 'loader', 'get').mockReturnValue({
        listAvailableAdapters: vi.fn().mockRejectedValue(new Error('fail'))
      });

      const adapters = await registry.listAvailableAdapters();
      expect(adapters).toHaveLength(1);
      expect(adapters[0].name).toBe('mock');
      expect(adapters[0].installed).toBe(true);
    });
  });

  describe('getAdapterInfo and getAllAdapterInfo', () => {
    it('getAdapterInfo returns metadata for registered language', async () => {
      const registry = new AdapterRegistry();
      const factory = createFactory();
      await registry.register('mock', factory as any);

      const info = registry.getAdapterInfo('mock');
      expect(info).toBeDefined();
      expect(info!.language).toBe('mock');
      expect(info!.available).toBe(true);
      expect(info!.activeInstances).toBe(0);
    });

    it('getAdapterInfo returns undefined for unknown language', () => {
      const registry = new AdapterRegistry();
      expect(registry.getAdapterInfo('unknown')).toBeUndefined();
    });

    it('getAllAdapterInfo returns map of all registered adapters', async () => {
      const registry = new AdapterRegistry();
      await registry.register('mock', createFactory() as any);
      await registry.register('python', createFactory() as any);

      const all = registry.getAllAdapterInfo();
      expect(all.size).toBe(2);
      expect(all.has('mock')).toBe(true);
      expect(all.has('python')).toBe(true);
    });
  });

  describe('disposal error handling', () => {
    it('unregister reports a synchronous adapter disposal throw without escaping', async () => {
      const registry = new AdapterRegistry();
      const adapterStub = createAdapterStub();
      adapterStub.dispose.mockImplementation(() => {
        throw new Error('dispose failed synchronously');
      });

      const factory = createFactory({
        createAdapter: vi.fn().mockReturnValue(adapterStub)
      });

      await registry.register('mock', factory as any);
      await registry.create('mock', {
        sessionId: 's1',
        adapterHost: '127.0.0.1',
        adapterPort: 9000,
        logDir: '/tmp',
        scriptPath: '/tmp/app.js',
        executablePath: '',
        launchConfig: {}
      });

      const errors: Error[] = [];
      registry.on('error', (err: Error) => errors.push(err));

      const result = registry.unregister('mock');
      expect(result).toBe(true);

      await Promise.resolve();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('dispose failed synchronously');
    });

    it('disposeAll resolves when adapter disposal throws synchronously', async () => {
      const registry = new AdapterRegistry();
      const adapterStub = createAdapterStub();
      adapterStub.dispose.mockImplementation(() => {
        throw new Error('dispose boom synchronously');
      });

      const factory = createFactory({
        createAdapter: vi.fn().mockReturnValue(adapterStub)
      });

      await registry.register('mock', factory as any);
      await registry.create('mock', {
        sessionId: 's1',
        adapterHost: '127.0.0.1',
        adapterPort: 9000,
        logDir: '/tmp',
        scriptPath: '/tmp/app.js',
        executablePath: '',
        launchConfig: {}
      });

      // disposeAll should not reject
      await expect(registry.disposeAll()).resolves.toBeUndefined();
      expect(registry.getActiveAdapterCount()).toBe(0);
    });

    it('auto-dispose reports a synchronous adapter disposal throw without leaking from the timer', async () => {
      vi.useFakeTimers();
      try {
        const registry = new AdapterRegistry({ autoDispose: true, autoDisposeTimeout: 10 });
        const adapterStub = createAdapterStub();
        adapterStub.dispose.mockImplementation(() => {
          throw new Error('idle dispose threw synchronously');
        });
        const factory = createFactory({ createAdapter: vi.fn().mockReturnValue(adapterStub) });
        const errors: Error[] = [];
        registry.on('error', (error: Error) => errors.push(error));

        await registry.register('mock', factory as any);
        await registry.create('mock', {
          sessionId: 's1',
          adapterHost: '127.0.0.1',
          adapterPort: 9000,
          logDir: '/tmp',
          scriptPath: '/tmp/app.js',
          executablePath: '',
          launchConfig: {}
        });

        adapterStub.emit('stateChanged', 'debugging', 'disconnected');
        await vi.advanceTimersByTimeAsync(10);

        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain('idle dispose threw synchronously');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('singleton helpers', () => {
    afterEach(() => {
      resetAdapterRegistry();
    });

    it('getAdapterRegistry returns same instance on repeated calls', () => {
      const a = getAdapterRegistry();
      const b = getAdapterRegistry();
      expect(a).toBe(b);
    });

    it('resetAdapterRegistry creates a new instance', () => {
      const a = getAdapterRegistry();
      resetAdapterRegistry();
      const b = getAdapterRegistry();
      expect(a).not.toBe(b);
    });
  });
});
