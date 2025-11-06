import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JavascriptDebugAdapter } from '../../src/index.js';
import { AdapterState } from '@debugmcp/shared';

// Minimal AdapterDependencies stub
const deps = {
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
} as unknown as import('@debugmcp/shared').AdapterDependencies;

describe('JavascriptDebugAdapter.connection', () => {
  let adapter: JavascriptDebugAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    adapter = new JavascriptDebugAdapter(deps);
  });

  it('connect sets connected=true, transitions to CONNECTED, emits connected', async () => {
    const events: string[] = [];
    adapter.on('connected', () => events.push('connected'));

    await adapter.connect('127.0.0.1', 12345);

    expect(adapter.isConnected()).toBe(true);
    expect(adapter.getState()).toBe(AdapterState.CONNECTED);
    expect(events).toEqual(['connected']);
  });

  it('disconnect sets connected=false, clears thread, transitions to DISCONNECTED, emits disconnected', async () => {
    await adapter.connect('127.0.0.1', 12345);
    const events: string[] = [];
    adapter.on('disconnected', () => events.push('disconnected'));

    await adapter.disconnect();

    expect(adapter.isConnected()).toBe(false);
    expect(adapter.getCurrentThreadId()).toBeNull();
    expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
    expect(events).toEqual(['disconnected']);
  });
});
