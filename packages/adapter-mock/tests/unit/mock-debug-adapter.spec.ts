import { describe, it, expect, beforeEach } from 'vitest';
import { DebugFeature, AdapterState, AdapterErrorCode } from '@debugmcp/shared';
import { MockDebugAdapter, MockErrorScenario } from '../../src/mock-debug-adapter.js';
import type { AdapterDependencies } from '@debugmcp/shared';

const createDependencies = (): AdapterDependencies & {
  logger: { debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
} => ({
  fileSystem: {} as any,
  processLauncher: {} as any,
  networkManager: undefined,
  environment: {
    get: () => undefined,
    getAll: () => ({}),
    getCurrentWorkingDirectory: () => '/tmp',
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
});

describe('MockDebugAdapter', () => {
  let deps: ReturnType<typeof createDependencies>;

  beforeEach(() => {
    deps = createDependencies();
  });

  it('initializes successfully and transitions to READY', async () => {
    const adapter = new MockDebugAdapter(deps);

    const states: AdapterState[] = [];
    adapter.on('stateChanged', (_prev, next) => states.push(next));

    await adapter.initialize();

    expect(adapter.getState()).toBe(AdapterState.READY);
    expect(states).toEqual([AdapterState.INITIALIZING, AdapterState.READY]);
    expect(adapter.isReady()).toBe(true);
  });

  it('fails initialization when environment validation reports error scenario', async () => {
    const adapter = new MockDebugAdapter(deps);
    adapter.setErrorScenario(MockErrorScenario.EXECUTABLE_NOT_FOUND);

    await expect(adapter.initialize()).rejects.toThrowError(/Invalid state transition/);
    expect(adapter.getState()).toBe(AdapterState.ERROR);
  });

  it('connects and updates state, with disconnect resetting connection flags', async () => {
    const adapter = new MockDebugAdapter(deps, { connectionDelay: 0 });
    await adapter.initialize();

    await adapter.connect('127.0.0.1', 5678);
    expect(adapter.isConnected()).toBe(true);
    expect(adapter.getState()).toBe(AdapterState.CONNECTED);
    expect(deps.logger.debug).toHaveBeenCalledWith(
      '[MockDebugAdapter] Connect request to 127.0.0.1:5678',
    );

    await adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
    expect(adapter.getCurrentThreadId()).toBeNull();
    expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
  });

  it('throws connection error when timeout scenario enabled', async () => {
    const adapter = new MockDebugAdapter(deps, { connectionDelay: 0 });
    adapter.setErrorScenario(MockErrorScenario.CONNECTION_TIMEOUT);

    await expect(adapter.connect('127.0.0.1', 5678)).rejects.toMatchObject({
      code: AdapterErrorCode.CONNECTION_TIMEOUT,
    });
    expect(adapter.isConnected()).toBe(false);
  });

  it('handles DAP events by tracking thread id and transitions', async () => {
    const adapter = new MockDebugAdapter(deps, { connectionDelay: 0 });
    await adapter.initialize();
    await adapter.connect('127.0.0.1', 5678);

    adapter.handleDapEvent({
      event: 'stopped',
      body: { threadId: 42 },
    } as any);
    expect(adapter.getCurrentThreadId()).toBe(42);
    expect(adapter.getState()).toBe(AdapterState.DEBUGGING);

    adapter.handleDapEvent({
      event: 'terminated',
      body: {},
    } as any);
    expect(adapter.getCurrentThreadId()).toBeNull();
    expect(adapter.getState()).toBe(AdapterState.CONNECTED);
  });

  it('reports feature support based on configuration', () => {
    const adapter = new MockDebugAdapter(deps, {
      supportedFeatures: [DebugFeature.LOG_POINTS],
    });

    expect(adapter.supportsFeature(DebugFeature.LOG_POINTS)).toBe(true);
    expect(adapter.supportsFeature(DebugFeature.SET_VARIABLE)).toBe(false);

    const requirements = adapter.getFeatureRequirements(DebugFeature.CONDITIONAL_BREAKPOINTS);
    expect(requirements).toHaveLength(1);
    expect(requirements[0]).toMatchObject({ required: true });
  });

  it('translates filesystem errors and exposes installation messaging', () => {
    const adapter = new MockDebugAdapter(deps);
    expect(adapter.getInstallationInstructions()).toContain('built-in');
    expect(adapter.getMissingExecutableError()).toContain('Mock executable not found');
    expect(adapter.translateErrorMessage(new Error('ENOENT: missing file'))).toContain('Mock file not found');
  });
});
