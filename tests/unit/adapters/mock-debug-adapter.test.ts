import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockDebugAdapter, MockErrorScenario } from '../../../packages/adapter-mock/src/mock-debug-adapter.js';
import { AdapterState, DebugFeature, type AdapterDependencies } from '@debugmcp/shared';

const createDependencies = (): AdapterDependencies => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  environment: {},
  fileSystem: {} as unknown as AdapterDependencies['fileSystem'],
  processLauncher: {} as unknown as AdapterDependencies['processLauncher'],
  networkManager: {} as unknown as AdapterDependencies['networkManager']
});

describe('MockDebugAdapter behaviour', () => {
  let adapter: MockDebugAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new MockDebugAdapter(createDependencies(), {
      supportedFeatures: [DebugFeature.CONDITIONAL_BREAKPOINTS, DebugFeature.LOG_POINTS],
      connectionDelay: 0
    });
  });

  it('transitions through ready, connected and disconnected states', async () => {
    await adapter.initialize();
    expect(adapter.getState()).toBe(AdapterState.READY);

    await adapter.connect('127.0.0.1', 9000);
    expect(adapter.getState()).toBe(AdapterState.CONNECTED);

    await adapter.disconnect();
    expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
  });

  it('reports feature support based on configuration', () => {
    expect(adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)).toBe(true);
    expect(adapter.supportsFeature(DebugFeature.DATA_BREAKPOINTS)).toBe(false);
  });

  it('translates filesystem ENOENT errors into user-friendly messages', () => {
    const message = adapter.translateErrorMessage(new Error('ENOENT: file missing'));
    expect(message).toContain('Mock file not found');
  });

  it('surfaces configured error scenarios during connect', async () => {
    adapter.setErrorScenario(MockErrorScenario.CONNECTION_TIMEOUT);
    await expect(adapter.connect('127.0.0.1', 9100)).rejects.toThrow(/Connection timeout/);
  });
});
