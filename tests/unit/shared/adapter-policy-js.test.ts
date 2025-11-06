import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
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

  it('marks initialize response when updateStateOnResponse is invoked', () => {
    const state = JsDebugAdapterPolicy.createInitialState() as any;
    expect(state.initializeResponded).toBe(false);

    JsDebugAdapterPolicy.updateStateOnResponse?.('initialize', {}, state);
    expect(state.initializeResponded).toBe(true);
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

  describe('performHandshake', () => {
    it('executes launch flow when proxy is running', async () => {
      vi.useFakeTimers();
      const events = new EventEmitter();
      const sendDapRequest = vi.fn().mockResolvedValue({});

      const proxyManager = Object.assign(events, {
        isRunning: () => true,
        sendDapRequest,
        removeListener: events.removeListener.bind(events)
      });

      const context = {
        proxyManager,
        sessionId: 'session-1',
        dapLaunchArgs: { stopOnEntry: true },
        scriptPath: '/workspace/app.js',
        scriptArgs: ['--flag'],
        breakpoints: new Map([
          ['bp1', { file: '/workspace/app.js', line: 12 }]
        ])
      };

      const handshakePromise = JsDebugAdapterPolicy.performHandshake(context as any);
      await Promise.resolve();
      events.emit('dap-event', { event: 'initialized' });
      await vi.advanceTimersByTimeAsync(0);
      await handshakePromise;
      vi.useRealTimers();

      expect(sendDapRequest).toHaveBeenCalledWith('initialize', expect.any(Object));
      expect(sendDapRequest).toHaveBeenCalledWith('setExceptionBreakpoints', { filters: [] });
      expect(sendDapRequest).toHaveBeenCalledWith(
        'setBreakpoints',
        expect.objectContaining({
          source: { path: '/workspace/app.js' },
          breakpoints: [{ line: 12, condition: undefined }]
        })
      );
      expect(sendDapRequest).toHaveBeenCalledWith('configurationDone', {});
      expect(sendDapRequest.mock.calls.some(([cmd]) => cmd === 'launch')).toBe(true);
    });

    it('uses attach flow when attach port provided', async () => {
      vi.useFakeTimers();
      const events = new EventEmitter();
      const sendDapRequest = vi.fn().mockResolvedValue({});

      const proxyManager = Object.assign(events, {
        isRunning: () => true,
        sendDapRequest,
        removeListener: events.removeListener.bind(events)
      });

      const context = {
        proxyManager,
        sessionId: 'session-2',
        dapLaunchArgs: { request: 'attach', attachSimplePort: 9229, type: 'pwa-node' },
        scriptPath: '/workspace/app.js',
        scriptArgs: [],
        breakpoints: new Map()
      };

      const handshakePromise = JsDebugAdapterPolicy.performHandshake(context as any);
      await Promise.resolve();
      events.emit('dap-event', 'initialized');
      await vi.advanceTimersByTimeAsync(0);
      await handshakePromise;
      vi.useRealTimers();

      expect(sendDapRequest).toHaveBeenCalledWith(
        'attach',
        expect.objectContaining({ request: 'attach', port: 9229 })
      );
      expect(sendDapRequest.mock.calls.some(([cmd]) => cmd === 'launch')).toBe(false);
    });
  });
});
