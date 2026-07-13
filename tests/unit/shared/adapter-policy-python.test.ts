import { describe, it, expect, vi } from 'vitest';
import { PythonAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-python.js';

describe('PythonAdapterPolicy', () => {
  it('rejects child session support', () => {
    expect(() => PythonAdapterPolicy.buildChildStartArgs('', {})).toThrow(/does not support child sessions/);
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

    expect(locals).toEqual([
      { name: 'value', value: '10' },
      { name: '__name__', value: '__main__' }
    ]);
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
      sendAttachBeforeInitialized: true
    });
  });

  it('pauses the target after attach', () => {
    // debugpy does not suspend a running target on attach, so an explicit
    // pause is required for the session to land in a truthful PAUSED state.
    expect(PythonAdapterPolicy.getAttachBehavior?.()).toEqual({ pauseAfterAttach: true });
  });

  describe('getAdapterSpawnConfig', () => {
    const basePayload = {
      executablePath: 'python',
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
