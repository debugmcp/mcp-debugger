import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import { JsDebugAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-js.js';

describe('JsDebugAdapterPolicy', () => {
  it('declares late-binding function breakpoints (issue #308)', () => {
    // CDP re-resolve at pauses for late-loaded modules: unverified at
    // launch is by design, so the launch-time unbound warning must skip js.
    expect(JsDebugAdapterPolicy.functionBreakpointsBindLate).toBe(true);
  });

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
          breakpoints: [{ line: 12 }]
        })
      );
      expect(sendDapRequest).toHaveBeenCalledWith('configurationDone', {});
      expect(sendDapRequest.mock.calls.some(([cmd]) => cmd === 'launch')).toBe(true);
    });

    it('forwards logMessage on handshake breakpoints (issue #235)', async () => {
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
        dapLaunchArgs: { stopOnEntry: false },
        scriptPath: '/workspace/app.js',
        breakpoints: new Map([
          ['bp1', { file: '/workspace/app.js', line: 12, logMessage: 'x is {x}' }]
        ])
      };

      const handshakePromise = JsDebugAdapterPolicy.performHandshake(context as any);
      await Promise.resolve();
      events.emit('dap-event', { event: 'initialized' });
      await vi.advanceTimersByTimeAsync(0);
      await handshakePromise;
      vi.useRealTimers();

      expect(sendDapRequest).toHaveBeenCalledWith(
        'setBreakpoints',
        expect.objectContaining({
          breakpoints: [{ line: 12, logMessage: 'x is {x}' }]
        })
      );
    });

    it('does not miss an initialized event emitted before the initialize response settles (issue #242)', async () => {
      vi.useFakeTimers();
      try {
        const events = new EventEmitter();
        // js-debug can emit 'initialized' before the initialize response is
        // processed; the handshake must not burn its 10s window when that happens.
        const sendDapRequest = vi.fn().mockImplementation((cmd: string) => {
          if (cmd === 'initialize') {
            events.emit('dap-event', { event: 'initialized' });
          }
          return Promise.resolve({});
        });

        const proxyManager = Object.assign(events, {
          isRunning: () => true,
          sendDapRequest,
          removeListener: events.removeListener.bind(events)
        });

        const context = {
          proxyManager,
          sessionId: 'session-3',
          dapLaunchArgs: { stopOnEntry: false },
          scriptPath: '/workspace/app.js',
          scriptArgs: [],
          breakpoints: new Map()
        };

        const handshakePromise = JsDebugAdapterPolicy.performHandshake(context as any);
        let done = false;
        handshakePromise.then(() => { done = true; });
        await vi.advanceTimersByTimeAsync(0);

        expect(done).toBe(true);
        expect(events.listenerCount('dap-event')).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('removes the initialized listener when the wait times out (issue #242)', async () => {
      vi.useFakeTimers();
      try {
        const events = new EventEmitter();
        const sendDapRequest = vi.fn().mockResolvedValue({});

        const proxyManager = Object.assign(events, {
          isRunning: () => true,
          sendDapRequest,
          removeListener: events.removeListener.bind(events)
        });

        const context = {
          proxyManager,
          sessionId: 'session-4',
          dapLaunchArgs: { stopOnEntry: false },
          scriptPath: '/workspace/app.js',
          scriptArgs: [],
          breakpoints: new Map()
        };

        const handshakePromise = JsDebugAdapterPolicy.performHandshake(context as any);
        let done = false;
        handshakePromise.then(() => { done = true; });
        // Never emit 'initialized' — the 10s timeout path must still complete
        // the handshake and must not leak the dap-event listener.
        await vi.advanceTimersByTimeAsync(10000);

        expect(done).toBe(true);
        expect(events.listenerCount('dap-event')).toBe(0);
      } finally {
        vi.useRealTimers();
      }
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

    it('defaults autoAttachChildProcesses to false in attach args, keeping a caller value (issue #501)', async () => {
      const runAttachHandshake = async (dapLaunchArgs: Record<string, unknown>) => {
        vi.useFakeTimers();
        try {
          const events = new EventEmitter();
          const sendDapRequest = vi.fn().mockResolvedValue({});
          const proxyManager = Object.assign(events, {
            isRunning: () => true,
            sendDapRequest,
            removeListener: events.removeListener.bind(events)
          });
          const context = {
            proxyManager,
            sessionId: 'session-501',
            dapLaunchArgs,
            scriptPath: '/workspace/app.js',
            scriptArgs: [],
            breakpoints: new Map()
          };

          const handshakePromise = JsDebugAdapterPolicy.performHandshake(context as any);
          await Promise.resolve();
          events.emit('dap-event', 'initialized');
          await vi.advanceTimersByTimeAsync(0);
          await handshakePromise;

          const attachCall = sendDapRequest.mock.calls.find(([cmd]) => cmd === 'attach');
          return attachCall?.[1] as Record<string, unknown>;
        } finally {
          vi.useRealTimers();
        }
      };

      const defaulted = await runAttachHandshake({
        request: 'attach', attachSimplePort: 9229, type: 'pwa-node'
      });
      expect(defaulted.autoAttachChildProcesses).toBe(false);

      const optedIn = await runAttachHandshake({
        request: 'attach', attachSimplePort: 9229, type: 'pwa-node',
        autoAttachChildProcesses: true
      });
      expect(optedIn.autoAttachChildProcesses).toBe(true);
    });
  });
});
