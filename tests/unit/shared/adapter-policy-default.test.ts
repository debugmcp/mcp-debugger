import { describe, it, expect } from 'vitest';
import { DefaultAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy.js';

describe('DefaultAdapterPolicy', () => {
  it('exposes safe no-op behaviors', () => {
    expect(DefaultAdapterPolicy.name).toBe('default');
    expect(DefaultAdapterPolicy.supportsReverseStartDebugging).toBe(false);
    expect(DefaultAdapterPolicy.childSessionStrategy).toBe('none');
    expect(DefaultAdapterPolicy.shouldDeferParentConfigDone({})).toBe(false);
    expect(() => DefaultAdapterPolicy.buildChildStartArgs('pending', {})).toThrow();
    expect(DefaultAdapterPolicy.isChildReadyEvent({ event: 'initialized' } as any)).toBe(false);
    expect(DefaultAdapterPolicy.getDapAdapterConfiguration().type).toBe('default');
    expect(DefaultAdapterPolicy.resolveExecutablePath('/bin/node')).toBe('/bin/node');
    expect(DefaultAdapterPolicy.getDebuggerConfiguration()).toEqual({});
    expect(DefaultAdapterPolicy.requiresCommandQueueing()).toBe(false);
    expect(DefaultAdapterPolicy.matchesAdapter({ command: '', args: [] })).toBe(false);
    expect(DefaultAdapterPolicy.getInitializationBehavior()).toEqual({});
    expect(DefaultAdapterPolicy.getDapClientBehavior()).toEqual({});
  });

  it('tracks state transitions via createInitialState', () => {
    const state = DefaultAdapterPolicy.createInitialState();
    expect(state.initialized).toBe(false);
    expect(state.configurationDone).toBe(false);
    expect(DefaultAdapterPolicy.isInitialized(state)).toBe(false);
    expect(DefaultAdapterPolicy.isConnected(state)).toBe(false);

    DefaultAdapterPolicy.updateStateOnCommand?.('configurationDone', {}, state);
    expect(state.configurationDone).toBe(false); // default no-op

    DefaultAdapterPolicy.updateStateOnEvent?.('initialized', {}, state);
    expect(state.initialized).toBe(false);
  });
});
