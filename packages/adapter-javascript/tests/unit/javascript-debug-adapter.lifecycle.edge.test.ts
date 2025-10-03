import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as path from 'path';
import { JavascriptDebugAdapter } from '../../src/index.js';
import { AdapterState } from '@debugmcp/shared';
import * as exec from '../../src/utils/executable-resolver.js';

// Minimal AdapterDependencies stub
const deps = {
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
} as unknown as import('@debugmcp/shared').AdapterDependencies;

describe('JavascriptDebugAdapter.lifecycle (edge)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('initialize logs each warning exactly once and transitions to READY', async () => {
    const adapter = new JavascriptDebugAdapter(deps);
    const initialized = vi.fn();
    adapter.on('initialized', initialized);

    vi.spyOn(adapter, 'validateEnvironment').mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [{ code: 'W1', message: 'w1' }, { code: 'W2', message: 'w2' }]
    });

    await adapter.initialize();

    // Two warnings logged exactly once each
    expect(deps.logger.warn).toHaveBeenCalledTimes(2);
    expect(deps.logger.warn).toHaveBeenNthCalledWith(1, 'w1');
    expect(deps.logger.warn).toHaveBeenNthCalledWith(2, 'w2');

    // Ready state and event emitted
    expect(adapter.getState()).toBe(AdapterState.READY);
    expect(initialized).toHaveBeenCalledTimes(1);
  });

  it('dispose clears per-instance caches: resolveExecutablePath calls findNode again after dispose', async () => {
    const adapter = new JavascriptDebugAdapter(deps);

    const findSpy = vi.spyOn(exec, 'findNode').mockResolvedValue(
      path.resolve(process.platform === 'win32' ? 'C:\\\\node\\\\node.exe' : '/usr/bin/node')
    );

    // First resolve -> calls underlying findNode
    const first = await adapter.resolveExecutablePath();
    expect(typeof first).toBe('string');
    expect(findSpy).toHaveBeenCalledTimes(1);

    // Second resolve without dispose -> uses cache, no additional call
    const second = await adapter.resolveExecutablePath();
    expect(typeof second).toBe('string');
    expect(findSpy).toHaveBeenCalledTimes(1);

    // Dispose clears caches
    await adapter.dispose();
    expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);

    // Resolve again after dispose -> calls findNode again
    const third = await adapter.resolveExecutablePath();
    expect(typeof third).toBe('string');
    expect(findSpy).toHaveBeenCalledTimes(2);
  });
});
