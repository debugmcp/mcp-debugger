import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import * as path from 'path';
import { JsDebugAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-js.js';
import type { StopReasonContext } from '../../../packages/shared/src/interfaces/adapter-policy.js';

describe('JsDebugAdapterPolicy', () => {
  it('normalizes a requested attach pause while preserving real unrequested steps (#597)', () => {
    const normalize = JsDebugAdapterPolicy.normalizeStopReason!;
    const context = (pausePending: boolean, pauseSource?: 'user' | 'attach'): StopReasonContext => ({
      pausePending,
      ...(pauseSource ? { pauseSource } : {}),
      lineBreakpointCount: 0,
      functionBreakpointCount: 0
    });

    expect(normalize('step', { reason: 'step' }, context(true, 'attach'))).toBe('pause');
    expect(normalize('step', { reason: 'step' }, context(false))).toBeUndefined();
  });

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

  it('marks pause child-required but leaves threads parent-fallbackable (issue #513)', () => {
    const behavior = JsDebugAdapterPolicy.getDapClientBehavior();
    // js-debug's root session acks 'pause' as a silent no-op, so a pause
    // falling back to the parent "succeeds" but no stop can ever land
    expect(behavior.childRequiredCommands?.has('pause')).toBe(true);
    // the parent's empty threads response is load-bearing for attach verify
    expect(behavior.childRequiredCommands?.has('threads')).toBe(false);
    // sanity: child-required commands must also be child-routed
    for (const cmd of behavior.childRequiredCommands ?? []) {
      expect(behavior.childRoutedCommands?.has(cmd)).toBe(true);
    }
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

    // Issue #655: node_modules dependency frames are internal too.
    const filtered = JsDebugAdapterPolicy.filterStackFrames(frames as any, false);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].file).toBe('/app/index.js');

    const includeAll = JsDebugAdapterPolicy.filterStackFrames(frames as any, true);
    expect(includeAll).toHaveLength(3);

    // No local fallback: an all-internal stack filters to [] and the
    // session-layer resolver restores the top frame (issue #346).
    expect(JsDebugAdapterPolicy.filterStackFrames!(frames.slice(1) as any, false)).toEqual([]);
  });

  it('normalizes a debugger statement, which js-debug reports as a pause, to a breakpoint stop (#672)', () => {
    const ctx = { pausePending: false, lineBreakpointCount: 0, functionBreakpointCount: 0 };
    expect(
      JsDebugAdapterPolicy.normalizeStopReason!('pause', { reason: 'pause', description: 'Paused on debugger statement' }, ctx)
    ).toBe('breakpoint');
    // An explicit pause keeps its reason.
    expect(JsDebugAdapterPolicy.normalizeStopReason!('pause', { reason: 'pause', description: 'Paused' }, ctx)).toBeUndefined();
    expect(JsDebugAdapterPolicy.normalizeStopReason!('pause', { reason: 'pause' }, ctx)).toBeUndefined();
  });

  it('recognizes async boundary frames (the sourceless line-0 separators) (#672)', () => {
    expect(JsDebugAdapterPolicy.isAsyncBoundaryFrame!({ id: 1, name: 'await', file: '<unknown_source>', line: 0 })).toBe(true);
    expect(JsDebugAdapterPolicy.isAsyncBoundaryFrame!({ id: 2, name: 'HTTPINCOMINGMESSAGE', file: '', line: 0 })).toBe(true);
    expect(JsDebugAdapterPolicy.isAsyncBoundaryFrame!({ id: 3, name: 'handle', file: '/app/x.js', line: 0 })).toBe(false);
    expect(JsDebugAdapterPolicy.isAsyncBoundaryFrame!({ id: 4, name: 'VM123', file: '<unknown_source>', line: 3 })).toBe(false);
  });

  describe('describeUnresolvedSource (issue #816)', () => {
    const hook = JsDebugAdapterPolicy.describeUnresolvedSource!;

    it('names the source map and the attach-side switch for an attach session', () => {
      const text = hook({ count: 2, files: ['../src/a.ts', '../src/b.ts'], attachMode: true });
      expect(text).toMatch(/They are source-mapped/);
      expect(text).toContain('adapterConfig.sourceMaps: false');
      expect(text).not.toContain('adapterLaunchConfig');
    });

    it('names the launch-side switch for a launch session', () => {
      const text = hook({ count: 1, files: ['../src/a.ts'], attachMode: false });
      expect(text).toMatch(/It is source-mapped/);
      expect(text).toContain('adapterLaunchConfig.sourceMaps: false');
      expect(text).not.toContain('adapterConfig.sourceMaps');
    });
  });

  describe('describePendingStop (issue #678)', () => {
    const hook = JsDebugAdapterPolicy.describePendingStop!;
    const depFrame = { id: 1, name: 'handle', file: 'C:\\app\\node_modules\\router\\index.js', line: 160 };
    const internalFrame = { id: 2, name: 'processTicksAndRejections', file: '<node_internals>/internal/process/task_queues', line: 95 };
    const userFrame = { id: 3, name: 'main', file: '/app/src/index.js', line: 12 };
    const launch = (dapLaunchArgs?: Record<string, unknown>, adapterLaunchConfig?: Record<string, unknown>) =>
      ({ ...(dapLaunchArgs ? { dapLaunchArgs } : {}), ...(adapterLaunchConfig ? { adapterLaunchConfig } : {}) });

    it('says nothing for attach sessions (skipFiles is not defaulted there)', () => {
      expect(hook({ operation: 'pause', attachMode: true })).toBeUndefined();
      expect(hook({ operation: 'step', attachMode: true, fromFrame: depFrame })).toBeUndefined();
    });

    // js-debug's resume-on-skipped-frame lives inside its smart-stepper
    // (`getSmartStepDirection` returns early unless launchConfig.smartStep);
    // blackboxing is only the condition it reads. Measured on the #686 build:
    // default skip list + smartStep:false → the pause landed; internals-only
    // skip list + smartStep:true → the #678 chase with node_modules NOT
    // blackboxed.
    describe('pause', () => {
      it('explains a pending pause on the default launch: the smart-stepper is on and internals are skipped', () => {
        const text = hook({ operation: 'pause', attachMode: false, launch: {} });
        expect(text).toMatch(/smart-stepper|smartStep/);
        expect(text).toMatch(/may never land/);
        expect(text).not.toMatch(/does not land/);
        expect(text).toMatch(/justMyCode: false/);
        expect(text).toMatch(/smartStep: false/);
      });

      it('says nothing once the smart-stepper is off, whichever way it was turned off', () => {
        expect(hook({ operation: 'pause', attachMode: false, launch: launch({ justMyCode: false }) })).toBeUndefined();
        expect(hook({ operation: 'pause', attachMode: false, launch: launch(undefined, { smartStep: false }) })).toBeUndefined();
      });

      it('still explains the pause when justMyCode is off but the stepper was forced back on (run B)', () => {
        const text = hook({ operation: 'pause', attachMode: false, launch: launch({ justMyCode: false }, { smartStep: true }) });
        expect(text).toMatch(/smartStep/);
        expect(text).toMatch(/may never land/);
      });

      it('says nothing when the caller list does not skip node internals (the stepper has nothing to step out of)', () => {
        expect(hook({ operation: 'pause', attachMode: false, launch: launch(undefined, { skipFiles: ['**/node_modules/**'] }) })).toBeUndefined();
        expect(hook({ operation: 'pause', attachMode: false, launch: launch(undefined, { skipFiles: [] }) })).toBeUndefined();
      });

      it('lets adapterLaunchConfig win over dapLaunchArgs, as the launcher merge does', () => {
        expect(hook({ operation: 'pause', attachMode: false, launch: launch({ justMyCode: true }, { smartStep: false }) })).toBeUndefined();
        expect(hook({ operation: 'pause', attachMode: false, launch: launch({ justMyCode: false }, { smartStep: true }) })).toBeDefined();
      });
    });

    describe('step', () => {
      it('explains a pending step issued from a blackboxed dependency frame, naming the frame and the justMyCode remedy', () => {
        const text = hook({ operation: 'step', attachMode: false, launch: {}, fromFrame: depFrame });
        expect(text).toMatch(/skipped frame/);
        expect(text).toMatch(/router[\\/]index\.js:160/);
        expect(text).toMatch(/justMyCode: false/);
        expect(text).toMatch(/may never land/);
        expect(text).not.toMatch(/step_out/);
        expect(text).not.toMatch(/only steps out/);
      });

      it('says nothing about a step from a dependency frame once node_modules is not blackboxed or the stepper is off', () => {
        expect(hook({ operation: 'step', attachMode: false, launch: launch({ justMyCode: false }), fromFrame: depFrame })).toBeUndefined();
        expect(hook({ operation: 'step', attachMode: false, launch: launch(undefined, { smartStep: false }), fromFrame: depFrame })).toBeUndefined();
        expect(hook({ operation: 'step', attachMode: false, launch: launch(undefined, { skipFiles: ['<node_internals>/**'] }), fromFrame: depFrame })).toBeUndefined();
      });

      it('explains a step issued from a skipped node-internals frame with the smartStep remedy, never step_out', () => {
        const text = hook({ operation: 'step', attachMode: false, launch: {}, fromFrame: internalFrame });
        expect(text).toMatch(/node internals/i);
        expect(text).toMatch(/smartStep: false/);
        expect(text).not.toMatch(/step_out/);
        expect(text).not.toMatch(/only steps out/);
      });

      it('says nothing about an internals frame when internals are not skipped or the stepper is off', () => {
        expect(hook({ operation: 'step', attachMode: false, launch: launch(undefined, { skipFiles: ['**/node_modules/**'] }), fromFrame: internalFrame })).toBeUndefined();
        expect(hook({ operation: 'step', attachMode: false, launch: launch(undefined, { skipFiles: [] }), fromFrame: internalFrame })).toBeUndefined();
        expect(hook({ operation: 'step', attachMode: false, launch: launch({ justMyCode: false }), fromFrame: internalFrame })).toBeUndefined();
      });

      it('says nothing about a step from user code or a step whose origin frame is unknown', () => {
        expect(hook({ operation: 'step', attachMode: false, launch: {}, fromFrame: userFrame })).toBeUndefined();
        expect(hook({ operation: 'step', attachMode: false, launch: {} })).toBeUndefined();
      });
    });
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

    expect(locals.variables).toEqual([{ name: 'foo', value: '1' }]);
    // Global is on the frame but contributed nothing.
    expect(locals.scopeRefs).toEqual([1]);

    const withSpecial = JsDebugAdapterPolicy.extractLocalVariables(
      frames as any,
      scopes as any,
      variables as any,
      true
    );
    expect(withSpecial.variables.map(variable => variable.name)).toContain('this');
  });

  it('does not relabel Global as locals when no Local or block scope exists (#595)', () => {
    const result = JsDebugAdapterPolicy.extractLocalVariables!(
      [{ id: 9 }] as any,
      { 9: [{ name: 'Global', variablesReference: 90, expensive: true }] } as any,
      { 90: [{ name: 'process', value: 'Process', variablesReference: 1 }] } as any
    );

    expect(result.variables).toEqual([]);
    expect(result.scopeRefs).toEqual([]);
    expect(result.note).toMatch(/get_scopes/);
    expect(result.note).toMatch(/get_variables/);
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
      events.emit('dap-event', 'initialized', {});
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

    it('sends handshake logpoints as compiled conditions, never as a logMessage (issues #235, #850)', async () => {
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
      events.emit('dap-event', 'initialized', {});
      await vi.advanceTimersByTimeAsync(0);
      await handshakePromise;
      vi.useRealTimers();

      const call = sendDapRequest.mock.calls.find(([cmd]) => cmd === 'setBreakpoints');
      expect(call).toBeDefined();
      const sent = (call![1] as { breakpoints: Array<Record<string, unknown>> }).breakpoints;
      expect(sent).toHaveLength(1);
      expect(sent[0].line).toBe(12);
      expect(sent[0].logMessage).toBeUndefined();
      expect(sent[0].condition).toContain('__mcpDebuggerLogpoint');
      expect(sent[0].condition).toContain('"x is "');
    });

    describe('the attach branch is keyed on the request (issue #896)', () => {
      // The MCP path reaches the policy with the transformed config as
      // launchConfig (websocketAddress beside `port: undefined`); an embedder
      // may pass the same keys in dapLaunchArgs.
      const runHandshake = async (
        dapLaunchArgs: Record<string, unknown>,
        launchConfig: Record<string, unknown> | undefined,
        sendDapRequest = vi.fn().mockResolvedValue({})
      ) => {
        vi.useFakeTimers();
        const events = new EventEmitter();
        const proxyManager = Object.assign(events, {
          isRunning: () => true,
          sendDapRequest,
          removeListener: events.removeListener.bind(events)
        });
        const context = {
          proxyManager,
          sessionId: 'session-896',
          dapLaunchArgs,
          scriptPath: 'attach://remote',
          scriptArgs: [],
          breakpoints: new Map(),
          launchConfig
        };
        const outcome = JsDebugAdapterPolicy.performHandshake(context as any).then(
          () => 'resolved' as const,
          (error: unknown) => error
        );
        await Promise.resolve();
        events.emit('dap-event', 'initialized');
        await vi.advanceTimersByTimeAsync(0);
        const result = await outcome;
        vi.useRealTimers();
        return { result, sendDapRequest, events };
      };

      it('takes the attach flow for request: attach with a websocketAddress and no port', async () => {
        const { result, sendDapRequest } = await runHandshake(
          { request: 'attach', type: 'pwa-node' },
          { request: 'attach', host: '127.0.0.1', port: undefined, websocketAddress: 'ws://127.0.0.1:9229/abc-def' }
        );

        expect(result).toBe('resolved');
        const attach = sendDapRequest.mock.calls.find(([cmd]) => cmd === 'attach');
        expect(attach).toBeDefined();
        expect(attach![1]).toEqual(expect.objectContaining({
          request: 'attach',
          websocketAddress: 'ws://127.0.0.1:9229/abc-def',
          continueOnAttach: true,
          attachExistingChildren: true
        }));
        expect(attach![1]).not.toHaveProperty('port');
        expect(attach![1]).not.toHaveProperty('address');
        expect(attach![1]).not.toHaveProperty('program');
        expect(sendDapRequest.mock.calls.some(([cmd]) => cmd === 'launch')).toBe(false);
      });

      it('refuses a port-less attach without a websocketAddress instead of launching', async () => {
        const { result, sendDapRequest, events } = await runHandshake(
          { request: 'attach', type: 'pwa-node' },
          { request: 'attach' }
        );

        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toMatch(/needs a port .* or a websocketAddress/);
        expect(sendDapRequest.mock.calls.some(([cmd]) => cmd === 'attach' || cmd === 'launch')).toBe(false);
        expect(events.listenerCount('dap-event')).toBe(0);
      });

      it('keeps address and port beside a websocketAddress when both are given: js-debug dials the URL', async () => {
        const { sendDapRequest } = await runHandshake(
          { request: 'attach', type: 'pwa-node' },
          { request: 'attach', host: '127.0.0.1', port: 9229, websocketAddress: 'ws://127.0.0.1:9229/abc-def' }
        );

        expect(sendDapRequest).toHaveBeenCalledWith('attach', expect.objectContaining({
          websocketAddress: 'ws://127.0.0.1:9229/abc-def',
          address: '127.0.0.1',
          port: 9229
        }));
      });

      it('accepts a numeric-string port from an embedder', async () => {
        const { result, sendDapRequest } = await runHandshake({ request: 'attach', port: '9229', type: 'pwa-node' }, undefined);

        expect(result).toBe('resolved');
        expect(sendDapRequest).toHaveBeenCalledWith('attach', expect.objectContaining({ port: 9229, address: '127.0.0.1' }));
      });

      it('rethrows the attach request rejection instead of swallowing it', async () => {
        const rejection = Object.assign(new Error('Could not connect to debug target at http://localhost:9229'), { name: 'DapResponseError' });
        const sendDapRequest = vi.fn().mockImplementation(async (cmd: string) => {
          if (cmd === 'attach') throw rejection;
          return {};
        });

        const { result } = await runHandshake({ request: 'attach', attachSimplePort: 9229, type: 'pwa-node' }, undefined, sendDapRequest);

        expect(result).toBe(rejection);
      });

      it('rethrows the launch request rejection instead of swallowing it', async () => {
        const rejection = new Error('launch refused');
        const sendDapRequest = vi.fn().mockImplementation(async (cmd: string) => {
          if (cmd === 'launch') throw rejection;
          return {};
        });

        const { result } = await runHandshake({ request: 'launch', type: 'pwa-node' }, undefined, sendDapRequest);

        expect(result).toBe(rejection);
      });
    });
  });

  describe('toWireBreakpoint (issues #850, #861)', () => {
    it('compiles a logpoint into a condition and keeps the user condition inside it', () => {
      const wire = JsDebugAdapterPolicy.toWireBreakpoint!({ line: 3, logMessage: 'n={n}', condition: 'n > 1' });
      expect(wire.line).toBe(3);
      expect(wire.logMessage).toBeUndefined();
      expect(wire.condition).toContain('__mcpDebuggerLogpoint');
      expect(wire.condition).toContain('\nn > 1\n');
    });

    it('passes plain breakpoints through unchanged, suspendPolicy included', () => {
      expect(JsDebugAdapterPolicy.toWireBreakpoint!({ line: 3 })).toEqual({ line: 3 });
      expect(JsDebugAdapterPolicy.toWireBreakpoint!({ line: 3, condition: 'x', suspendPolicy: 'thread' }))
        .toEqual({ line: 3, condition: 'x', suspendPolicy: 'thread' });
    });

    it('falls back to the plain wire form when the logpoint does not compile, so the adapter reports it', () => {
      expect(JsDebugAdapterPolicy.toWireBreakpoint!({ line: 3, logMessage: 'n={n +}' }))
        .toEqual({ line: 3, logMessage: 'n={n +}' });
    });

    it('validates a logMessage and condition up front (issue #853)', () => {
      expect(JsDebugAdapterPolicy.validateLogMessage!('n={n}', 'n > 1')).toBeUndefined();
      expect(JsDebugAdapterPolicy.validateLogMessage!('n={n +}')).toMatch(/Unexpected token/);
      expect(JsDebugAdapterPolicy.validateLogMessage!('n={n}', 'n >=')).toMatch(/condition/);
    });

    it('does not miss an initialized event emitted before the initialize response settles (issue #242)', async () => {
      vi.useFakeTimers();
      try {
        const events = new EventEmitter();
        // js-debug can emit 'initialized' before the initialize response is
        // processed; the handshake must not burn its 10s window when that happens.
        const sendDapRequest = vi.fn().mockImplementation((cmd: string) => {
          if (cmd === 'initialize') {
            events.emit('dap-event', 'initialized', {});
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

      // Issue #655: the same self-containment for resolveSourceMapLocations.
      expect(defaulted.resolveSourceMapLocations).toEqual(['**', '!**/node_modules/**']);
      const callerList = await runAttachHandshake({
        request: 'attach', attachSimplePort: 9229, type: 'pwa-node',
        resolveSourceMapLocations: ['/app/**']
      });
      expect(callerList.resolveSourceMapLocations).toEqual(['/app/**']);
      const callerNull = await runAttachHandshake({
        request: 'attach', attachSimplePort: 9229, type: 'pwa-node',
        resolveSourceMapLocations: null
      });
      expect(callerNull.resolveSourceMapLocations).toBeNull();
    });
  });
});

describe('JsDebugAdapterPolicy.performHandshake workspace root and pauseForSourceMap (issue #699)', () => {
  async function launchArgsFor(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    vi.useFakeTimers();
    try {
      const events = new EventEmitter();
      const sendDapRequest = vi.fn().mockResolvedValue({});
      const proxyManager = Object.assign(events, {
        isRunning: () => true,
        sendDapRequest,
        removeListener: events.removeListener.bind(events)
      });
      const handshakePromise = JsDebugAdapterPolicy.performHandshake({
        proxyManager,
        sessionId: 'session-699',
        breakpoints: new Map(),
        ...context
      } as any);
      await Promise.resolve();
      events.emit('dap-event', 'initialized', {});
      await vi.advanceTimersByTimeAsync(0);
      await handshakePromise;
      const launch = sendDapRequest.mock.calls.find(([cmd]) => cmd === 'launch');
      expect(launch, 'launch was sent').toBeDefined();
      return launch![1] as Record<string, unknown>;
    } finally {
      vi.useRealTimers();
    }
  }

  it('derives a workspace root for the program and leaves pauseForSourceMap off for a .js program', async () => {
    const args = await launchArgsFor({ dapLaunchArgs: { stopOnEntry: false }, scriptPath: '/workspace/app.js', scriptArgs: [] });
    // no package.json under a path that does not exist: the program directory
    expect(args.__workspaceFolder).toBe('/workspace');
    expect(args.pauseForSourceMap).toBe(false);
  });

  it('keeps pauseForSourceMap on for a TypeScript program run through a transpiler', async () => {
    const args = await launchArgsFor({ dapLaunchArgs: { stopOnEntry: false }, scriptPath: '/workspace/app.ts', scriptArgs: [] });
    expect(args.pauseForSourceMap).toBe(true);
  });

  it('leaves an explicit __workspaceFolder and pauseForSourceMap from the launch config untouched', async () => {
    const args = await launchArgsFor({
      dapLaunchArgs: { stopOnEntry: false },
      scriptPath: '/workspace/app.js',
      scriptArgs: [],
      launchConfig: { program: '/workspace/app.js', cwd: '/workspace', __workspaceFolder: '/root', pauseForSourceMap: true }
    });
    expect(args.__workspaceFolder).toBe('/root');
    expect(args.pauseForSourceMap).toBe(true);
  });

  it('honours the same two keys from dapLaunchArgs when the launch config lacks them (embedder path)', async () => {
    const args = await launchArgsFor({
      dapLaunchArgs: { stopOnEntry: false, __workspaceFolder: '/from-args', pauseForSourceMap: true },
      scriptPath: '/workspace/app.js',
      scriptArgs: []
    });
    expect(args.__workspaceFolder).toBe('/from-args');
    expect(args.pauseForSourceMap).toBe(true);
  });
});

describe('JsDebugAdapterPolicy.generatedFileCandidates (issue #938)', () => {
  const hook = JsDebugAdapterPolicy.generatedFileCandidates!;
  // An absolute project root on either platform (C:\proj or /proj).
  const P = path.resolve(path.sep, 'proj');
  const at = (...parts: string[]) => path.join(P, ...parts);
  /** A candidate the core may trust only once its `.map` names the source. */
  const gen = (...parts: string[]) => ({ path: at(...parts), linkedBy: 'sourceMap' as const });

  it('declines every source js-debug does not bind through a source map', () => {
    for (const name of ['a.js', 'a.mjs', 'a.cjs', 'a.jsx', 'a.py', 'a.d.ts', 'a.d.mts', 'a.d.cts']) {
      expect(hook({ sourcePath: at('src', name) }), name).toBeUndefined();
    }
  });

  it('answers the sibling .js for a TypeScript source asked for with the path alone (the applicability probe)', () => {
    expect(hook({ sourcePath: at('src', 'a.ts') })).toEqual([gen('src', 'a.js')]);
    expect(hook({ sourcePath: at('src', 'B.TS') })).toEqual([gen('src', 'B.js')]);
  });

  it('declines when the launched program is itself a TypeScript source: tsx, ts-node and type stripping build nothing to be stale (issue #950)', () => {
    for (const program of [at('src', 'main.ts'), at('src', 'main.mts'), at('src', 'main.cts'), at('src', 'main.tsx')]) {
      expect(hook({ sourcePath: at('src', 'a.ts'), program, launchConfig: { program } }), program).toBeUndefined();
    }
  });

  it('declines when the launched program is a runner under node_modules: vitest, jest and mocha transform sources in memory (issue #950)', () => {
    const program = at('node_modules', 'vitest', 'vitest.mjs');
    expect(hook({ sourcePath: at('src', 'a.ts'), program, launchConfig: { program } })).toBeUndefined();
  });

  it('keeps answering under a launched .js program: that is the build the source binds through', () => {
    const program = at('dist', 'main.js');
    expect(hook({ sourcePath: at('src', 'a.ts'), program, launchConfig: { program } })).toEqual([gen('src', 'a.js')]);
  });

  it('places the tsconfig outDir candidates first: rootDir-relative, config-dir-relative, then the sibling, deduplicated', () => {
    const candidates = hook({
      sourcePath: at('src', 'a', 'b.ts'),
      tsconfig: { dir: P, outDir: 'dist', rootDir: 'src' }
    });
    expect(candidates).toEqual([
      gen('dist', 'a', 'b.js'),        // outDir/<rel from rootDir>; the src/-stripped form coincides and is deduped
      gen('dist', 'src', 'a', 'b.js'), // outDir/<rel from the tsconfig dir>
      gen('src', 'a', 'b.js')          // sibling
    ]);
  });

  it('strips a leading src/ ahead of the config-dir-relative form when the tsconfig names no rootDir', () => {
    const candidates = hook({ sourcePath: at('src', 'a.ts'), tsconfig: { dir: P, outDir: 'dist' } });
    expect(candidates).toEqual([gen('dist', 'a.js'), gen('dist', 'src', 'a.js'), gen('src', 'a.js')]);
  });

  it('leaves out the rootDir candidate for a source outside rootDir', () => {
    const candidates = hook({ sourcePath: at('tests', 'a.ts'), tsconfig: { dir: P, outDir: 'dist', rootDir: 'src' } });
    expect(candidates).toEqual([gen('dist', 'tests', 'a.js'), gen('tests', 'a.js')]);
  });

  it('resolves outDir and rootDir against the tsconfig directory and accepts absolute ones', () => {
    const candidates = hook({
      sourcePath: at('pkg', 'src', 'a.ts'),
      tsconfig: { dir: at('pkg'), outDir: at('out-abs'), rootDir: 'src' }
    });
    expect(candidates?.[0]?.path).toBe(at('out-abs', 'a.js'));
  });

  it('tries the conventional out dirs under the package when no tsconfig names an outDir', () => {
    const candidates = hook({ sourcePath: at('src', 'a.ts'), packageDir: P });
    expect(candidates).toEqual([
      gen('dist', 'a.js'), gen('dist', 'src', 'a.js'),
      gen('build', 'a.js'), gen('build', 'src', 'a.js'),
      gen('out', 'a.js'), gen('out', 'src', 'a.js'),
      gen('lib', 'a.js'), gen('lib', 'src', 'a.js'),
      gen('src', 'a.js')
    ]);
  });

  it('ignores the conventional out dirs once a tsconfig names an outDir', () => {
    const candidates = hook({ sourcePath: at('src', 'a.ts'), tsconfig: { dir: P, outDir: 'dist' }, packageDir: P })!;
    expect(candidates.some(candidate => candidate.path.includes(`${path.sep}build${path.sep}`))).toBe(false);
    expect(candidates[0].path).toBe(at('dist', 'a.js'));
  });

  it('maps .mts to .mjs, .cts to .cjs and .tsx to .js', () => {
    expect(hook({ sourcePath: at('a.mts') })).toEqual([gen('a.mjs')]);
    expect(hook({ sourcePath: at('a.cts') })).toEqual([gen('a.cjs')]);
    expect(hook({ sourcePath: at('a.tsx') })).toEqual([gen('a.js')]);
  });
});
