import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdapterRegistry } from '../../../src/adapters/adapter-registry.js';
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

const createFactory = (overrides: Partial<ReturnType<typeof getFactory>> = {}) => {
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
    process.env.MCP_CONTAINER = undefined;
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
});
