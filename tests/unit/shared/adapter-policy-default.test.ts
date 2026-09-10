import { describe, it, expect } from 'vitest';
import { DefaultAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy.js';

describe('DefaultAdapterPolicy', () => {
  it('exposes safe no-op behaviors', () => {
    expect(DefaultAdapterPolicy.name).toBe('default');
    expect(DefaultAdapterPolicy.supportsReverseStartDebugging).toBe(false);
    expect(DefaultAdapterPolicy.childSessionStrategy).toBe('none');
    expect(() => DefaultAdapterPolicy.buildChildStartArgs('pending')).toThrow();
    // The placeholder's predicates ignore their inputs entirely — they are
    // written as zero-arity arrows, so there is no event/state/command shape
    // to hand them; the verdict is constant.
    expect(DefaultAdapterPolicy.isChildReadyEvent()).toBe(false);
    expect(DefaultAdapterPolicy.getDapAdapterConfiguration().type).toBe('default');
    expect(DefaultAdapterPolicy.resolveExecutablePath('/bin/node')).toBe('/bin/node');
    expect(DefaultAdapterPolicy.getDebuggerConfiguration()).toEqual({});
    expect(DefaultAdapterPolicy.requiresCommandQueueing()).toBe(false);
    expect(DefaultAdapterPolicy.matchesAdapter()).toBe(false);
    expect(DefaultAdapterPolicy.getInitializationBehavior()).toEqual({});
    expect(DefaultAdapterPolicy.getDapClientBehavior()).toEqual({});
  });

  it('tracks state transitions via createInitialState', () => {
    const state = DefaultAdapterPolicy.createInitialState();
    expect(state.initialized).toBe(false);
    expect(state.configurationDone).toBe(false);
    expect(DefaultAdapterPolicy.isInitialized()).toBe(false);
    expect(DefaultAdapterPolicy.isConnected()).toBe(false);

    // The placeholder declares NO state-mutation hooks. This used to be
    // written as `updateStateOnCommand?.('configurationDone', {}, state)`
    // followed by an assertion that the state was unchanged — but the
    // optional call never fired, so the assertion only ever re-read the
    // untouched initial state. Assert what is actually true: the hooks are
    // absent, so a real adapter can never accidentally inherit them.
    expect('updateStateOnCommand' in DefaultAdapterPolicy).toBe(false);
    expect('updateStateOnResponse' in DefaultAdapterPolicy).toBe(false);
    expect('updateStateOnEvent' in DefaultAdapterPolicy).toBe(false);
    expect(state.configurationDone).toBe(false);
    expect(state.initialized).toBe(false);
  });
});
