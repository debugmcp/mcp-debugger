import { describe, expect, it, vi } from 'vitest';
import type { AdapterDependencies, GenericLaunchConfig } from '@debugmcp/shared';
import { JavascriptDebugAdapter } from '../../src/javascript-debug-adapter.js';

function adapter() {
  return new JavascriptDebugAdapter({ logger: { info: vi.fn(), warn: vi.fn() } } as unknown as AdapterDependencies);
}

describe('JavaScript launch diagnostics (#709)', () => {
  it('explains replaced, dropped and malformed options while keeping unknown upstream keys reachable', async () => {
    const subject = adapter();
    const input = { program: '/project/app.js', request: 'unknown', console: 'externalTerminal', name: 'caller', trace: null,
      __pendingTargetId: 'child', attachSimplePort: 1234, outFiles: 'dist/**', runtimeArgs: '--inspect',
      skipFiles: 'x', resolveSourceMapLocations: 42, sourceMapPathOverides: { '*': 'sentinel' } };
    const result = await subject.transformLaunchConfig(input as unknown as GenericLaunchConfig);
    expect(result.console).toBe('internalConsole');
    expect(result).not.toHaveProperty('trace');
    expect(result).not.toHaveProperty('__pendingTargetId');
    expect(result).not.toHaveProperty('runtimeArgs');
    expect(result.sourceMapPathOverides).toEqual(input.sourceMapPathOverides);
    expect(subject.consumeLaunchConfigDiagnostics().map(item => item.key)).toEqual(expect.arrayContaining([
      'request', 'console', 'name', 'trace', '__pendingTargetId', 'attachSimplePort', 'outFiles', 'runtimeArgs', 'skipFiles', 'resolveSourceMapLocations'
    ]));
    expect(subject.consumeLaunchConfigDiagnostics()).toEqual([]);
    expect(input.trace).toBeNull();
  });

  it('accepts explicit empty lists, null source-map locations and matching pinned values', async () => {
    const subject = adapter();
    const result = await subject.transformLaunchConfig({ program: '/project/app.js', outFiles: [], skipFiles: [],
      runtimeArgs: [], resolveSourceMapLocations: null, console: 'internalConsole', type: 'pwa-node', envFile: null
    } as GenericLaunchConfig);
    expect(result).toMatchObject({ outFiles: [], skipFiles: [], resolveSourceMapLocations: null });
    expect(subject.consumeLaunchConfigDiagnostics()).toEqual([]);
  });

  it('filters mixed lists before runtime helpers and resets diagnostics on each transform', async () => {
    const subject = adapter();
    const result = await subject.transformLaunchConfig({ program: '/project/app.js', runtimeArgs: [1, '--no-warnings'],
      skipFiles: [false, 'library/**'], stopOnEntry: 'bad'
    } as unknown as GenericLaunchConfig);
    expect(result).toMatchObject({ runtimeArgs: ['--no-warnings'], skipFiles: ['library/**'], stopOnEntry: false });
    await subject.transformLaunchConfig({ program: '/project/app.js' });
    expect(subject.consumeLaunchConfigDiagnostics()).toEqual([]);
  });

  it('consumes envFile and keeps null env entries in the DAP result', async () => {
    const subject = new JavascriptDebugAdapter({
      logger: { info: vi.fn(), warn: vi.fn() }, fileSystem: { readFile: vi.fn(async () => 'REMOVE=file\nFILE_ONLY=works\n') }
    } as unknown as AdapterDependencies);
    const result = await subject.transformLaunchConfig({ program: '/project/app.js', envFile: 'app.env', env: { REMOVE: null } } as GenericLaunchConfig);
    expect(result.env).toMatchObject({ REMOVE: null, FILE_ONLY: 'works' });
    expect(result).not.toHaveProperty('envFile');
    expect(subject.consumeLaunchConfigDiagnostics()).toEqual([]);
  });
});
