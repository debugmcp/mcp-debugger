import { describe, it, expect, vi } from 'vitest';
import { PythonAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-python.js';
import type { AdapterSpawnPayload } from '../../../packages/shared/src/interfaces/adapter-policy.js';

describe('PythonAdapterPolicy', () => {
  it('rejects child session support', () => {
    expect(() => PythonAdapterPolicy.buildChildStartArgs()).toThrow(/does not support child sessions/);
  });

  it('extracts local variables while filtering special entries', () => {
    const frames = [{ id: 1 }];
    const scopes = {
      1: [
        { name: 'Locals', variablesReference: 1 }
      ]
    };
    const variables = {
      1: [
        { name: 'value', value: '10' },
        { name: 'special variables', value: '...' },
        { name: '__name__', value: '__main__' },
        { name: '_pydevd_bundle', value: 'internal' }
      ]
    };

    const locals = PythonAdapterPolicy.extractLocalVariables(
      frames as any,
      scopes as any,
      variables as any
    );

    expect(locals.variables).toEqual([
      { name: 'value', value: '10' },
      { name: '__name__', value: '__main__' }
    ]);
    expect(locals.scopeRefs).toEqual([1]);
  });

  it('resolves executable path using precedence rules', () => {
    vi.stubEnv('PYTHON_PATH', '/custom/python');
    expect(PythonAdapterPolicy.resolveExecutablePath()).toBe('/custom/python');
    expect(PythonAdapterPolicy.resolveExecutablePath('/explicit/python')).toBe('/explicit/python');

    vi.stubEnv('PYTHON_PATH', undefined);
    expect(PythonAdapterPolicy.resolveExecutablePath(undefined, 'win32')).toBe('python');
    expect(PythonAdapterPolicy.resolveExecutablePath(undefined, 'linux')).toBe('python3');
  });

  it('does not queue commands and reports initialization state', () => {
    expect(PythonAdapterPolicy.requiresCommandQueueing()).toBe(false);
    expect(PythonAdapterPolicy.shouldQueueCommand().shouldQueue).toBe(false);

    const state = PythonAdapterPolicy.createInitialState();
    expect(PythonAdapterPolicy.isInitialized(state)).toBe(false);

    PythonAdapterPolicy.updateStateOnEvent('initialized', {}, state);
    expect(PythonAdapterPolicy.isInitialized(state)).toBe(true);
    expect(PythonAdapterPolicy.isConnected(state)).toBe(true);

    PythonAdapterPolicy.updateStateOnCommand('configurationDone', {}, state);
    expect(state.configurationDone).toBe(true);
  });

  it('matches debugpy adapter commands', () => {
    expect(
      PythonAdapterPolicy.matchesAdapter({ command: 'python', args: ['-m', 'debugpy.adapter'] })
    ).toBe(true);
    expect(
      PythonAdapterPolicy.matchesAdapter({ command: 'node', args: ['--inspect'] })
    ).toBe(false);
  });

  it('requires attach to be sent before the initialized event (debugpy ordering)', () => {
    // debugpy only emits 'initialized' AFTER it receives the attach request;
    // waiting for the event before sending attach deadlocks (issue #145).
    expect(PythonAdapterPolicy.getInitializationBehavior()).toEqual({
      sendAttachBeforeInitialized: true,
      exceptionFilters: {
        uncaught: ['uncaught'],
        all: ['raised', 'uncaught']
      },
      defaultExceptionBreakMode: 'uncaught'
    });
  });

  it('pauses the target after attach', () => {
    // debugpy does not suspend a running target on attach, so an explicit
    // pause is required for the session to land in a truthful PAUSED state.
    expect(PythonAdapterPolicy.getAttachBehavior?.()).toEqual({ pauseAfterAttach: true });
  });

  describe('getAdapterSpawnConfig', () => {
    // scriptPath is required by AdapterSpawnPayload but never read by this
    // policy — the debuggee script reaches debugpy through the launch config.
    const basePayload: AdapterSpawnPayload = {
      executablePath: 'python',
      scriptPath: '/workspace/app.py',
      adapterHost: '127.0.0.1',
      adapterPort: 40000,
      logDir: '/logs'
    };

    it('returns connect mode for attach using the connect object', () => {
      const config = PythonAdapterPolicy.getAdapterSpawnConfig!({
        ...basePayload,
        launchConfig: { request: 'attach', connect: { host: '10.0.0.5', port: 5679 } }
      });

      expect(config).toEqual({ mode: 'connect', host: '10.0.0.5', port: 5679, logDir: '/logs' });
    });

    it('returns connect mode for attach using top-level host/port', () => {
      const config = PythonAdapterPolicy.getAdapterSpawnConfig!({
        ...basePayload,
        launchConfig: { request: 'attach', host: '192.168.1.2', port: 5680 }
      });

      expect(config).toEqual({ mode: 'connect', host: '192.168.1.2', port: 5680, logDir: '/logs' });
    });

    it('defaults the attach host to 127.0.0.1', () => {
      const config = PythonAdapterPolicy.getAdapterSpawnConfig!({
        ...basePayload,
        launchConfig: { request: 'attach', port: 5681 }
      });

      expect(config).toMatchObject({ mode: 'connect', host: '127.0.0.1', port: 5681 });
    });

    it('rejects attach without a valid port, pointing at debugpy --listen', () => {
      expect(() =>
        PythonAdapterPolicy.getAdapterSpawnConfig!({
          ...basePayload,
          launchConfig: { request: 'attach' }
        })
      ).toThrow(/debugpy --listen/);
    });

    it('still spawns debugpy.adapter for launch', () => {
      const config = PythonAdapterPolicy.getAdapterSpawnConfig!({
        ...basePayload,
        launchConfig: { request: 'launch' }
      });

      expect(config.mode).toBe('spawn');
      expect(config).toMatchObject({
        command: 'python',
        args: expect.arrayContaining(['-m', 'debugpy.adapter'])
      });
    });

    it('uses a provided adapterCommand verbatim for launch', () => {
      const config = PythonAdapterPolicy.getAdapterSpawnConfig!({
        ...basePayload,
        launchConfig: { request: 'launch' },
        adapterCommand: { command: 'py', args: ['-m', 'debugpy.adapter'], env: { A: '1' } }
      });

      expect(config).toMatchObject({ mode: 'spawn', command: 'py' });
    });
  });
});

describe('PythonAdapterPolicy child adoption (the session tree, issue #1081)', () => {
  const configuration = {
    type: 'python',
    name: 'Subprocess 37012',
    subProcessId: 37012,
    program: 'C:\work\parent.py',
    cwd: 'C:\work',
    redirectOutput: true,
    justMyCode: true,
    connect: { host: '127.0.0.1', port: 5678 }
  };
  const startDebugging = {
    seq: 7,
    type: 'request' as const,
    command: 'startDebugging',
    arguments: { request: 'attach', configuration }
  };
  function context() {
    return {
      sendResponse: vi.fn(),
      createChildSession: vi.fn(async () => {}),
      activeChildren: new Map<string, unknown>(),
      adoptedTargets: new Set<string>()
    };
  }

  it('pins the contract: advertise, reject to release, own output, terminate on close', () => {
    expect(PythonAdapterPolicy.childAdoption).toMatchObject({
      advertiseStartDebugging: true,
      releaseLever: 'reject-request',
      childOutput: 'own-connection',
      closeChild: 'terminate'
    });
  });

  it('attaches with the configuration as delivered, redirecting the child output to its own connection', () => {
    const args = PythonAdapterPolicy.childAdoption!.buildChildAttachArguments({
      targetId: '37012',
      name: 'Subprocess 37012',
      configuration: { ...configuration, redirectOutput: false }
    });
    expect(args).toMatchObject({ ...configuration, redirectOutput: true });
  });

  it('recognises a debugpy child report and leaves it unanswered for the worker to hold', async () => {
    const ctx = context();
    const result = await PythonAdapterPolicy.getDapClientBehavior().handleReverseRequest!(startDebugging, ctx);
    expect(result).toEqual({
      handled: true,
      childReport: { targetId: '37012', name: 'Subprocess 37012', configuration }
    });
    expect(ctx.sendResponse).not.toHaveBeenCalled();
  });

  it('leaves a startDebugging without a subProcessId unhandled', async () => {
    const ctx = context();
    const result = await PythonAdapterPolicy.getDapClientBehavior().handleReverseRequest!(
      { ...startDebugging, arguments: { request: 'attach', configuration: { type: 'python', name: 'x' } } },
      ctx
    );
    expect(result).toEqual({ handled: false });
    expect(ctx.sendResponse).not.toHaveBeenCalled();
  });

  it('still acknowledges runInTerminal', async () => {
    const ctx = context();
    const result = await PythonAdapterPolicy.getDapClientBehavior().handleReverseRequest!(
      { seq: 8, type: 'request', command: 'runInTerminal', arguments: {} },
      ctx
    );
    expect(result).toEqual({ handled: true });
    expect(ctx.sendResponse).toHaveBeenCalledWith(expect.objectContaining({ command: 'runInTerminal' }), {});
  });
});
