import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import type { LaunchConfigDiagnostic } from '@debugmcp/shared';
import { resolveLaunchEnvironment } from '../../src/utils/launch-environment.js';

function inputs() {
  return {
    inherited: { VALUE: 'inherited', KEEP: 'retained', REMOVE: 'inherited', NODE_ENV: 'test' },
    env: { VALUE: 'explicit', REMOVE: null, EMPTY: '' },
    envFile: 'app.env',
    cwd: path.resolve('project'),
    readFile: vi.fn(async () => 'VALUE=file\nFILE_ONLY=yes\nREMOVE=file\nNODE_ENV=production\nNODE_OPTIONS=--stack-trace-limit=37\n'),
    diagnostics: [] as LaunchConfigDiagnostic[]
  };
}

describe('JavaScript launch environment (#709/#792)', () => {
  it('overlays the file, then explicit strings and null tombstones, without changing its inputs', async () => {
    const args = inputs();
    const original = structuredClone({ inherited: args.inherited, env: args.env });
    const result = await resolveLaunchEnvironment(args);
    expect(result).toEqual({ VALUE: 'explicit', KEEP: 'retained', REMOVE: null, EMPTY: '', FILE_ONLY: 'yes',
      NODE_ENV: 'production', NODE_OPTIONS: '--stack-trace-limit=37' });
    expect(args.readFile).toHaveBeenCalledWith(path.join(args.cwd, 'app.env'));
    expect({ inherited: args.inherited, env: args.env }).toEqual(original);
    expect(args.diagnostics).toEqual([]);
  });

  it('lets the file override inherited values and the NODE_ENV fallback', async () => {
    expect(await resolveLaunchEnvironment({ ...inputs(), env: undefined })).toMatchObject({ VALUE: 'file', NODE_ENV: 'production' });
  });

  it('keeps the existing no-file fallback and does not read a file when none is supplied', async () => {
    const args = { ...inputs(), envFile: undefined, env: { NODE_ENV: null } };
    expect(await resolveLaunchEnvironment(args)).toMatchObject({ NODE_ENV: null });
    expect(await resolveLaunchEnvironment({ ...args, env: undefined })).toMatchObject({ NODE_ENV: 'development' });
    expect(args.readFile).not.toHaveBeenCalled();
  });

  it('retains dotenv syntax: BOM, quotes, comments, multiline values, duplicates and export', async () => {
    const args = { ...inputs(), env: undefined, readFile: vi.fn(async () =>
      '\uFEFFexport QUOTED="x # y"\nMULTI="first\nsecond"\nDUP=first\nDUP=last # comment\nCOLON: value\n') };
    expect(await resolveLaunchEnvironment(args)).toMatchObject({ QUOTED: 'x # y', MULTI: 'first\nsecond', DUP: 'last', COLON: 'value' });
  });

  it('merges Windows aliases and null deletions case-insensitively', async () => {
    const result = await resolveLaunchEnvironment({ ...inputs(), platform: 'win32',
      inherited: { Path: 'inherited', Node_Options: 'old' },
      readFile: async () => 'PATH=file\nNODE_ENV=production\nNODE_OPTIONS=file-options\n',
      env: { path: null, node_env: 'explicit', node_options: 'caller-options' }
    });
    expect(Object.entries(result).filter(([key]) => key.toUpperCase() === 'PATH')).toEqual([['path', null]]);
    expect(result).toMatchObject({ NODE_ENV: 'explicit', NODE_OPTIONS: 'caller-options' });
    expect(Object.keys(result).filter(key => key.toUpperCase() === 'NODE_OPTIONS')).toHaveLength(1);
  });

  it('keeps POSIX names distinct and handles exotic own keys without prototype mutation', async () => {
    const result = await resolveLaunchEnvironment({ ...inputs(), platform: 'linux', envFile: undefined,
      inherited: { Path: 'one', PATH: 'two' }, env: JSON.parse('{"PATH":null,"__proto__":"own value"}') as unknown
    });
    expect(result.Path).toBe('one');
    expect(result.PATH).toBeNull();
    expect(Object.hasOwn(result, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it('warns for a missing file and invalid env entries without exposing their values', async () => {
    const args = { ...inputs(), readFile: vi.fn().mockRejectedValue(Object.assign(new Error('sensitive path'), { code: 'ENOENT' })),
      env: { VALUE: 'explicit', IGNORED: { secret: 'do-not-print' } } };
    expect(await resolveLaunchEnvironment(args)).toMatchObject({ VALUE: 'explicit' });
    expect(args.diagnostics.map(item => item.key)).toEqual(['envFile', 'env']);
    expect(JSON.stringify(args.diagnostics)).not.toMatch(/sensitive path|do-not-print/);
  });

  it('fails an unreadable file instead of silently discarding it', async () => {
    const args = { ...inputs(), readFile: vi.fn().mockRejectedValue(Object.assign(new Error('secret contents'), { code: 'EACCES' })) };
    await expect(resolveLaunchEnvironment(args)).rejects.toThrow('Cannot read envFile (EACCES)');
  });
});
