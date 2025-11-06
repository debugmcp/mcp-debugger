import { describe, it, expect } from 'vitest';
import { MockAdapterPolicy } from '../../../packages/shared/src/interfaces/adapter-policy-mock.js';

describe('MockAdapterPolicy', () => {
  it('matches adapter commands that contain mock adapter identifiers', () => {
    expect(
      MockAdapterPolicy.matchesAdapter({
        command: '/usr/bin/mock-adapter',
        args: []
      })
    ).toBe(true);

    expect(
      MockAdapterPolicy.matchesAdapter({
        command: '/usr/bin/node',
        args: ['--require', 'mock-adapter']
      })
    ).toBe(true);

    expect(
      MockAdapterPolicy.matchesAdapter({
        command: '/usr/bin/node',
        args: ['--require', 'not-mock']
      })
    ).toBe(false);
  });

  it('tracks initialization and configuration state updates', () => {
    const state = MockAdapterPolicy.createInitialState();
    expect(state.initialized).toBe(false);
    expect(state.configurationDone).toBe(false);

    MockAdapterPolicy.updateStateOnEvent?.('initialized', {}, state);
    expect(state.initialized).toBe(true);
    expect(MockAdapterPolicy.isInitialized(state)).toBe(true);
    expect(MockAdapterPolicy.isConnected(state)).toBe(true);

    MockAdapterPolicy.updateStateOnCommand?.('configurationDone', {}, state);
    expect(state.configurationDone).toBe(true);
  });

  it('extracts variables using the first scope of the top frame', () => {
    const vars = MockAdapterPolicy.extractLocalVariables?.(
      [{ id: 1 }],
      {
        1: [
          {
            name: 'Local',
            variablesReference: 11
          } as any
        ]
      },
      {
        11: [
          { name: 'foo', value: 'bar' },
          { name: 'answer', value: '42' }
        ] as any
      }
    );

    expect(vars).toEqual([
      expect.objectContaining({ name: 'foo' }),
      expect.objectContaining({ name: 'answer' })
    ]);
  });

  it('returns spawn config passthrough when adapterCommand provided', () => {
    const spawn = MockAdapterPolicy.getAdapterSpawnConfig?.({
      executablePath: '/not-used',
      adapterHost: 'localhost',
      adapterPort: 1234,
      logDir: '/tmp',
      scriptPath: '/tmp/script.js',
      adapterCommand: {
        command: 'mock',
        args: ['--test']
      }
    });

    expect(spawn).toMatchObject({
      command: 'mock',
      args: ['--test'],
      host: 'localhost',
      port: 1234
    });

    expect(MockAdapterPolicy.getAdapterSpawnConfig?.({
      executablePath: '',
      adapterHost: '',
      adapterPort: 0,
      logDir: '',
      scriptPath: ''
    })).toBeUndefined();
  });

  it('throws when buildChildStartArgs is called', () => {
    expect(() =>
      MockAdapterPolicy.buildChildStartArgs('pending-1', {})
    ).toThrow(/does not support child sessions/);
  });
});
