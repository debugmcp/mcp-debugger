import { describe, it, expect, beforeEach, vi } from 'vitest';

import { JavascriptDebugAdapter } from '../../src/index.js';
import { AdapterState, AdapterError, AdapterErrorCode } from '@debugmcp/shared';

// Minimal AdapterDependencies stub
const deps = {
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
} as unknown as import('@debugmcp/shared').AdapterDependencies;

describe('JavascriptDebugAdapter.lifecycle', () => {
  let adapter: JavascriptDebugAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    adapter = new JavascriptDebugAdapter(deps);
  });

  it('initialize success: transitions INITIALIZING -> READY and emits initialized once', async () => {
    const states: Array<{ from: AdapterState; to: AdapterState }> = [];
    adapter.on('stateChanged', (oldState: AdapterState, newState: AdapterState) => {
      states.push({ from: oldState, to: newState });
    });
    const initialized = vi.fn();
    adapter.on('initialized', initialized);

    vi.spyOn(adapter, 'validateEnvironment').mockResolvedValue({
      valid: true,
      errors: [],
      warnings: []
    });

    await adapter.initialize();

    expect(states.some(s => s.to === AdapterState.INITIALIZING)).toBe(true);
    expect(states.some(s => s.to === AdapterState.READY)).toBe(true);
    expect(adapter.getState()).toBe(AdapterState.READY);
    expect(initialized).toHaveBeenCalledTimes(1);
  });

  it('initialize failure: throws AdapterError with ENVIRONMENT_INVALID and transitions to ERROR', async () => {
    vi.spyOn(adapter, 'validateEnvironment').mockResolvedValue({
      valid: false,
      errors: [{ code: 'X', message: 'X', recoverable: false }],
      warnings: []
    });

    let thrown: unknown;
    try {
      await adapter.initialize();
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(AdapterError);
    const err = thrown as AdapterError;
    expect(err.code).toBe(AdapterErrorCode.ENVIRONMENT_INVALID);
    expect(adapter.getState()).toBe(AdapterState.ERROR);
  });

  it('dispose resets state, emits disconnected (if connected) then disposed', async () => {
    // Prepare initialized and connected state
    vi.spyOn(adapter, 'validateEnvironment').mockResolvedValue({
      valid: true,
      errors: [],
      warnings: []
    });
    await adapter.initialize();
    await adapter.connect('127.0.0.1', 12345);

    const events: string[] = [];
    adapter.on('disconnected', () => events.push('disconnected'));
    adapter.on('disposed', () => events.push('disposed'));

    await adapter.dispose();

    // Expect order: disconnected (since was connected), then disposed
    expect(events[0]).toBe('disconnected');
    expect(events[1]).toBe('disposed');

    expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
    expect(adapter.isConnected()).toBe(false);
    expect(adapter.getCurrentThreadId()).toBeNull();
  });
});
