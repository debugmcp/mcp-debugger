/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import { JavascriptDebugAdapter } from '../../src/index.js';
import * as cfg from '../../src/utils/config-transformer.js';
import * as tsdet from '../../src/utils/typescript-detector.js';

// Minimal AdapterDependencies stub
const deps = {
  logger: {
    info: () => {},
    error: () => {},
    debug: () => {},
    warn: () => {}
  }
} as unknown as import('@debugmcp/shared').AdapterDependencies;

function norm(p: unknown): string {
  return typeof p === 'string' ? (p as string).replace(/\\+/g, '/') : '';
}

describe('JavascriptDebugAdapter.transformLaunchConfig (edge cases)', () => {
  let adapter: JavascriptDebugAdapter;

  beforeEach(() => {
    adapter = new JavascriptDebugAdapter(deps);
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runtimeExecutable override: custom absolute path -> skip auto-detection and only include user runtimeArgs', async () => {
    const program = path.resolve('/proj/app.ts');
    const customExec = path.resolve('/custom/node');
    const cfgOut = await adapter.transformLaunchConfig({
      program,
      runtimeExecutable: customExec,
      runtimeArgs: ['--custom']
    } as any);

    expect(norm(cfgOut.runtimeExecutable)).toBe(norm(customExec));
    expect(cfgOut.runtimeArgs).toEqual(['--custom']);
  });

  it('override "tsx" while user added ts-node hooks -> preserve user args, do not auto-add more (dedup applied)', async () => {
    const program = path.resolve('/proj/app.ts');
    const userArgs = [
      '-r', 'ts-node/register',
      '-r', 'ts-node/register/transpile-only',
      '--loader', 'ts-node/esm'
    ];
    const cfgOut = await adapter.transformLaunchConfig({
      program,
      runtimeExecutable: 'tsx',
      runtimeArgs: userArgs.slice()
    } as any);

    // Still 'tsx'
    expect(cfgOut.runtimeExecutable).toBe('tsx');

    // Hooks preserved, not duplicated
    const ra = (cfgOut.runtimeArgs || []) as string[];
    const countPair = (flag: string, val: string) => {
      let c = 0;
      for (let i = 0; i < ra.length - 1; i++) {
        if (ra[i] === flag && ra[i + 1] === val) c++;
      }
      return c;
    };
    expect(countPair('-r', 'ts-node/register')).toBe(1);
    expect(countPair('-r', 'ts-node/register/transpile-only')).toBe(1);
    expect(countPair('--loader', 'ts-node/esm')).toBe(1);
  });

  it('deduplication: when user provides duplicate hooks and adapter would add them, ensure no duplicates present', async () => {
    const program = path.resolve('/proj/app.ts');

    // Make ts-node available synchronously for transformLaunchConfig
    const spy = vi.spyOn(tsdet, 'detectBinary').mockImplementation((name: 'tsx' | 'ts-node') => {
      if (name === 'ts-node') return '/bin/ts-node';
      return undefined;
    });
    // Force ESM + tsconfig paths to true so adapter would try to add loader and tsconfig-paths
    vi.spyOn(cfg, 'isESMProject').mockReturnValue(true);
    vi.spyOn(cfg, 'hasTsConfigPaths').mockReturnValue(true);

    const userArgs = [
      '-r', 'ts-node/register',
      '-r', 'ts-node/register', // duplicate
      '-r', 'ts-node/register/transpile-only',
      '--loader', 'ts-node/esm',
      '--loader', 'ts-node/esm', // duplicate
      '-r', 'tsconfig-paths/register',
      '-r', 'tsconfig-paths/register' // duplicate
    ];

    const out = await adapter.transformLaunchConfig({
      program,
      runtimeArgs: userArgs
    } as any);

    const ra = (out.runtimeArgs || []) as string[];

    // Count occurrences of each pair after normalization/dedupe
    const countPair = (flag: string, val: string) => {
      let c = 0;
      for (let i = 0; i < ra.length - 1; i++) {
        if (ra[i] === flag && ra[i + 1] === val) c++;
      }
      return c;
    };

    expect(countPair('-r', 'ts-node/register')).toBe(1);
    expect(countPair('-r', 'ts-node/register/transpile-only')).toBe(1);
    expect(countPair('--loader', 'ts-node/esm')).toBe(1);
    expect(countPair('-r', 'tsconfig-paths/register')).toBe(1);

    spy.mockRestore();
  });

  it('TS detection for .cts: when ts-node present and ESM project, include --loader ts-node/esm', async () => {
    const program = path.resolve('/proj/app.cts');

    vi.spyOn(tsdet, 'detectBinary').mockImplementation((name: 'tsx' | 'ts-node') => {
      if (name === 'ts-node') return '/bin/ts-node';
      return undefined;
    });
    vi.spyOn(cfg, 'isESMProject').mockReturnValue(true);

    const out = await adapter.transformLaunchConfig({ program } as any);
    const ra = (out.runtimeArgs || []) as string[];
    const idx = ra.findIndex(x => x === '--loader');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(ra[idx + 1]).toBe('ts-node/esm');
  });

  it('JS sourceMaps false without outFiles -> outFiles omitted', async () => {
    const program = path.resolve('/proj/app.js');

    const out = await adapter.transformLaunchConfig({
      program,
      sourceMaps: false
    } as any);

    expect(out.sourceMaps).toBe(false);
    expect((out as any).outFiles).toBeUndefined();
  });

  it('skipFiles merge/dedupe with defaults', async () => {
    const program = path.resolve('/proj/app.js');
    const out = await adapter.transformLaunchConfig({
      program,
      skipFiles: ['**/*.spec.js', '**/node_modules/**'] // includes a default to test dedupe
    } as any);

    const sf = (out.skipFiles || []) as string[];
    const expected = ['**/*.spec.js', '<node_internals>/**', '**/node_modules/**'];
    expect([...sf].sort()).toEqual([...expected].sort());
  });
});
