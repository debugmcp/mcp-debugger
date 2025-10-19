import { describe, it, expect } from 'vitest';
import { JsDebugAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-js.js';

describe('JsDebugAdapterPolicy', () => {
  it('builds child start args with pending target id and defaults', () => {
    const result = JsDebugAdapterPolicy.buildChildStartArgs('pending-123', {});
    expect(result.command).toBe('attach');
    expect(result.args).toEqual(
      expect.objectContaining({
        __pendingTargetId: 'pending-123',
        type: 'pwa-node',
        continueOnAttach: true
      })
    );
  });

  it('identifies child readiness events', () => {
    expect(JsDebugAdapterPolicy.isChildReadyEvent({ event: 'thread' } as any)).toBe(true);
    expect(JsDebugAdapterPolicy.isChildReadyEvent({ event: 'stopped' } as any)).toBe(true);
    expect(JsDebugAdapterPolicy.isChildReadyEvent({ event: 'continued' } as any)).toBe(false);
  });

  it('filters internal stack frames when requested', () => {
    const frames = [
      { id: 1, file: '/app/index.js' },
      { id: 2, file: '/app/node_modules/module.js' },
      { id: 3, file: '<node_internals>/inspector' }
    ];

    const filtered = JsDebugAdapterPolicy.filterStackFrames(frames as any, false);
    expect(filtered).toHaveLength(2);
    expect(filtered.find(frame => String(frame.file).includes('<node_internals>'))).toBeUndefined();

    const includeAll = JsDebugAdapterPolicy.filterStackFrames(frames as any, true);
    expect(includeAll).toHaveLength(3);
  });

  it('extracts local variables while excluding special entries', () => {
    const frames = [{ id: 1 }];
    const scopes = {
      1: [
        { name: 'Locals', variablesReference: 1 },
        { name: 'Global', variablesReference: 2 }
      ]
    };
    const variables = {
      1: [
        { name: 'foo', value: '1' },
        { name: 'this', value: '{}' },
        { name: '__proto__', value: '{}' },
        { name: '$internal', value: 'debug' }
      ]
    };

    const locals = JsDebugAdapterPolicy.extractLocalVariables(
      frames as any,
      scopes as any,
      variables as any
    );

    expect(locals).toEqual([{ name: 'foo', value: '1' }]);

    const withSpecial = JsDebugAdapterPolicy.extractLocalVariables(
      frames as any,
      scopes as any,
      variables as any,
      true
    );
    expect(withSpecial.map(variable => variable.name)).toContain('this');
  });

  it('determines command queueing based on initialization state', () => {
    const state = JsDebugAdapterPolicy.createInitialState() as any;

    const beforeInit = JsDebugAdapterPolicy.shouldQueueCommand('launch', state);
    expect(beforeInit.shouldQueue).toBe(true);

    state.initializeResponded = true;
    const beforeConfig = JsDebugAdapterPolicy.shouldQueueCommand('setBreakpoints', state);
    expect(beforeConfig.shouldQueue).toBe(true);

    state.initialized = true;
    state.configurationDone = true;
    const afterConfig = JsDebugAdapterPolicy.shouldQueueCommand('threads', state);
    expect(afterConfig.shouldQueue).toBe(false);
  });

  it('orders queued commands in JS-specific order', () => {
    const commands = [
      { requestId: '1', dapCommand: 'launch' },
      { requestId: '2', dapCommand: 'configurationDone' },
      { requestId: '3', dapCommand: 'setBreakpoints' },
      { requestId: '4', dapCommand: 'evaluate' }
    ];

    const ordered = JsDebugAdapterPolicy.processQueuedCommands(commands);
    expect(ordered.map(cmd => cmd.dapCommand)).toEqual([
      'setBreakpoints',
      'configurationDone',
      'launch',
      'evaluate'
    ]);
  });

  it('tracks initialization state and connectivity', () => {
    const state = JsDebugAdapterPolicy.createInitialState() as any;
    expect(JsDebugAdapterPolicy.isConnected(state)).toBe(false);
    expect(JsDebugAdapterPolicy.isInitialized(state)).toBe(false);

    state.initializeResponded = true;
    JsDebugAdapterPolicy.updateStateOnEvent('initialized', {}, state);
    expect(JsDebugAdapterPolicy.isConnected(state)).toBe(true);
    expect(JsDebugAdapterPolicy.isInitialized(state)).toBe(true);
  });

  it('matches js-debug adapter commands and args', () => {
    expect(
      JsDebugAdapterPolicy.matchesAdapter({ command: 'node', args: ['--inspect', 'js-debug'] })
    ).toBe(true);
    expect(
      JsDebugAdapterPolicy.matchesAdapter({ command: 'python', args: ['-m', 'debugpy.adapter'] })
    ).toBe(false);
  });

  it('provides initialization behavior and defaults', () => {
    const behavior = JsDebugAdapterPolicy.getInitializationBehavior();
    expect(behavior.deferConfigDone).toBe(true);
    expect(behavior.addRuntimeExecutable).toBe(true);

    expect(JsDebugAdapterPolicy.requiresCommandQueueing()).toBe(true);
    expect(JsDebugAdapterPolicy.resolveExecutablePath()).toBe('node');
    expect(JsDebugAdapterPolicy.resolveExecutablePath('/custom/node')).toBe('/custom/node');
  });
});
