import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdapterRegistry, getAdapterRegistry, resetAdapterRegistry } from '../../../src/adapters/adapter-registry.js';
import { AdapterNotFoundError, DuplicateRegistrationError, FactoryValidationError } from '@debugmcp/shared';

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
  const originalEnv = process.env.MCP_CONTAINER;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.MCP_CONTAINER;
  });

  afterEach(() => {
    process.env.MCP_CONTAINER = originalEnv;
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
      const registry = new AdapterRegistry({ enableDynamicLoading: true } as any);
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
      const registry = new AdapterRegistry({ enableDynamicLoading: true } as any);
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
        installed: true
      }]);
    });

    it('merges loader metadata with registered, overriding installed status', async () => {
      const registry = new AdapterRegistry({ enableDynamicLoading: true } as any);
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
      const registry = new AdapterRegistry({ enableDynamicLoading: true } as any);
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
    it('unregister emits error when adapter disposal fails', async () => {
      const registry = new AdapterRegistry();
      const adapterStub = createAdapterStub();
      adapterStub.dispose.mockRejectedValue(new Error('dispose failed'));

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

      // Let the async disposal error propagate
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('dispose');
    });

    it('disposeAll resolves even when adapter disposal fails', async () => {
      const registry = new AdapterRegistry();
      const adapterStub = createAdapterStub();
      adapterStub.dispose.mockRejectedValue(new Error('dispose boom'));

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
