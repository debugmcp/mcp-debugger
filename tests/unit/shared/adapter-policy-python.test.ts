import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PythonAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-python.js';

describe('PythonAdapterPolicy', () => {
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

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
    Object.defineProperty(process, 'platform', {
      value: 'win32'
    });
    expect(PythonAdapterPolicy.resolveExecutablePath()).toBe('python');

    Object.defineProperty(process, 'platform', {
      value: 'linux'
    });
    expect(PythonAdapterPolicy.resolveExecutablePath()).toBe('python3');
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

  it('returns empty initialization behavior', () => {
    expect(PythonAdapterPolicy.getInitializationBehavior()).toEqual({});
  });
});
