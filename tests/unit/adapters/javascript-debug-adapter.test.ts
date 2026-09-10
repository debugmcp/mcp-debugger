import { describe, it, expect } from 'vitest';
import { JavascriptDebugAdapter } from '../../../packages/adapter-javascript/src/javascript-debug-adapter.js';
import { DebugFeature } from '@debugmcp/shared';
import { createMockAdapterDependencies } from '../../test-utils/helpers/adapter-dependencies.js';

const createDependencies = () => createMockAdapterDependencies();

describe('JavascriptDebugAdapter runtime helpers', () => {
  it('translates ENOENT errors into actionable guidance', () => {
    const adapter = new JavascriptDebugAdapter(createDependencies());
    const message = adapter.translateErrorMessage(new Error('ENOENT: spawn node ENOENT'));
    expect(message).toContain('Node.js runtime not found');
  });

  it('supports key debugging features while declining unsupported ones', () => {
    const adapter = new JavascriptDebugAdapter(createDependencies());
    expect(adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)).toBe(true);
    expect(adapter.supportsFeature(DebugFeature.EVALUATE_FOR_HOVERS)).toBe(true);
    expect(adapter.supportsFeature(DebugFeature.DATA_BREAKPOINTS)).toBe(false);
  });

  it('provides a launch barrier for js-debug launch coordination', async () => {
    const adapter = new JavascriptDebugAdapter(createDependencies());
    const barrier = adapter.createLaunchBarrier('launch');
    expect(barrier).toBeDefined();
    expect(barrier?.awaitResponse).toBe(false);
    barrier?.onRequestSent('request-123');

    const waiter = barrier?.waitUntilReady();
    barrier?.onDapEvent('stopped', undefined);
    await expect(waiter).resolves.toBeUndefined();
    barrier?.dispose();
  });

  it('returns undefined launch barrier for non-launch commands', () => {
    const adapter = new JavascriptDebugAdapter(createDependencies());
    expect(adapter.createLaunchBarrier('threads')).toBeUndefined();
  });
});
