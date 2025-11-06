import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';

// Mocks for helper modules used by transformLaunchConfig
vi.mock('../../src/utils/config-transformer.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/config-transformer.js')>(
    '../../src/utils/config-transformer.js'
  );
  return {
    ...actual,
    isESMProject: vi.fn(actual.isESMProject),
    hasTsConfigPaths: vi.fn(actual.hasTsConfigPaths),
    determineOutFiles: vi.fn(actual.determineOutFiles)
  };
});

vi.mock('../../src/utils/typescript-detector.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/typescript-detector.js')>(
    '../../src/utils/typescript-detector.js'
  );
  return {
    ...actual,
    detectBinary: vi.fn(actual.detectBinary)
  };
});

import {
  isESMProject,
  hasTsConfigPaths,
  determineOutFiles
} from '../../src/utils/config-transformer.js';

import { detectBinary } from '../../src/utils/typescript-detector.js';
import { JavascriptDebugAdapter } from '../../src/index.js';

// Minimal AdapterDependencies stub for constructor
const deps = {
  logger: {
    info: () => {},
    error: () => {},
    debug: () => {},
    warn: () => {}
  }
} as unknown as import('@debugmcp/shared').AdapterDependencies;

function norm(p: unknown): string {
  return typeof p === 'string' ? p.replace(/\\+/g, '/') : '';
}

describe('JavascriptDebugAdapter.transformLaunchConfig', () => {
  let adapter: JavascriptDebugAdapter;
  let envBefore: NodeJS.ProcessEnv;

  beforeEach(() => {
    adapter = new JavascriptDebugAdapter(deps);
    vi.clearAllMocks();
    envBefore = { ...process.env };
  });

  afterEach(() => {
    // restore env
    for (const k of Object.keys(process.env)) {
      delete (process.env as Record<string, string | undefined>)[k];
    }
    for (const [k, v] of Object.entries(envBefore)) {
      (process.env as Record<string, string | undefined>)[k] = v;
    }
    vi.restoreAllMocks();
  });

  it('should transform JS config with defaults', () => {
    const program = path.resolve('/proj/app.js');
    const cfg = adapter.transformLaunchConfig({
      program,
      stopOnEntry: true
    } as any);

    expect(cfg.type).toBe('pwa-node');
    expect(cfg.request).toBe('launch');
    expect(cfg.stopOnEntry).toBe(true);
    expect(cfg.smartStep).toBe(true);
    expect(cfg.sourceMaps).toBe(false);
    expect(norm(cfg.cwd)).toBe(norm(path.dirname(program)));
    expect(Array.isArray(cfg.args)).toBe(true);
    expect((cfg.args as string[]).length).toBe(0);
    expect(cfg.skipFiles).toEqual(['<node_internals>/**', '**/node_modules/**']);

    // env merged with NODE_ENV default 'development'
    const env = cfg.env as Record<string, string>;
    expect(typeof env).toBe('object');
    expect(env.NODE_ENV).toBe('development');
    // Ensure process.env not mutated
    expect(process.env.NODE_ENV).toBe(envBefore.NODE_ENV);
  });

  it('JS with sourceMaps true applies default outFiles when not provided', () => {
    const program = path.resolve('/proj/app.js');
    (determineOutFiles as any).mockImplementation((_p: string, user?: string[]) => {
      if (user && user.length > 0) return user;
      return ['**/*.js', '!**/node_modules/**'];
    });

    const cfg = adapter.transformLaunchConfig({
      program,
      sourceMaps: true
    } as any);

    expect(cfg.sourceMaps).toBe(true);
    expect(cfg.outFiles).toEqual(['**/*.js', '!**/node_modules/**']);
    expect(cfg.resolveSourceMapLocations).toEqual(['**', '!**/node_modules/**']);
  });

  it('should set TS defaults and outFiles with ts-node present', () => {
    const program = path.resolve('/proj/app.ts');

    // Synchronous detectBinary used by transformLaunchConfig
    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'ts-node') return '/bin/ts-node';
      return undefined;
    });

    const cfg = adapter.transformLaunchConfig({
      program
    } as any);

    expect(cfg.sourceMaps).toBe(true);
    expect((cfg.outFiles as string[])).toContain('**/*.js');
    // runtimeExecutable default to 'node' when ts-node is present (hooks added)
    expect(typeof cfg.runtimeExecutable).toBe('string');
    // runtimeArgs should include ts-node hooks
    const ra = (cfg.runtimeArgs || []) as string[];
    const hasRegister = ra.includes('-r') && ra.includes('ts-node/register');
    const hasTranspile = ra.includes('-r') && ra.includes('ts-node/register/transpile-only');
    expect(hasRegister || hasTranspile).toBe(true);
  });

  it('should use tsx when available (priority over ts-node)', () => {
    const program = path.resolve('/proj/app.ts');

    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'tsx') return '/bin/tsx';
      return undefined;
    });

    const cfg = adapter.transformLaunchConfig({
      program
    } as any);

    expect(norm(cfg.runtimeExecutable as string)).toBe(norm('/bin/tsx'));
    expect(cfg.runtimeArgs).toBeUndefined(); // no hooks added when using tsx (aside from user-provided)
  });

  it('should add ts-node ESM loader for ESM project (.mts) when ts-node present', () => {
    const program = path.resolve('/proj/app.mts');

    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'ts-node') return '/bin/ts-node';
      return undefined;
    });

    (isESMProject as any).mockReturnValue(true);

    const cfg = adapter.transformLaunchConfig({
      program
    } as any);

    const ra = (cfg.runtimeArgs || []) as string[];
    const idx = ra.findIndex((x) => x === '--loader');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(ra[idx + 1]).toBe('ts-node/esm');
  });

  it('should add tsconfig-paths/register when tsconfig has paths', () => {
    const program = path.resolve('/proj/app.ts');

    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'ts-node') return '/bin/ts-node';
      return undefined;
    });
    (hasTsConfigPaths as any).mockReturnValue(true);

    const cfg = adapter.transformLaunchConfig({
      program
    } as any);

    const ra = (cfg.runtimeArgs || []) as string[];
    const findRIdxes = ra.reduce<number[]>((acc, v, i) => (v === '-r' ? acc.concat(i) : acc), []);
    const values = findRIdxes.map((i) => ra[i + 1]);
    expect(values).toContain('tsconfig-paths/register');
  });

  it('should preserve user-provided runtimeArgs and append last', () => {
    const program = path.resolve('/proj/app.ts');
    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'ts-node') return '/bin/ts-node';
      return undefined;
    });

    const cfg = adapter.transformLaunchConfig({
      program,
      runtimeArgs: ['--my-flag']
    } as any);

    const ra = (cfg.runtimeArgs || []) as string[];
    expect(ra[ra.length - 1]).toBe('--my-flag');
  });

  it('runtimeExecutable override: "tsx" results in empty hooks', () => {
    const program = path.resolve('/proj/app.ts');
    const cfg = adapter.transformLaunchConfig({
      program,
      runtimeExecutable: 'tsx',
      runtimeArgs: ['--custom']
    } as any);

    expect(cfg.runtimeExecutable).toBe('tsx');
    expect(cfg.runtimeArgs).toEqual(['--custom']); // only user-provided
  });

  it('runtimeExecutable override: "ts-node" results in no duplicate hooks', () => {
    const program = path.resolve('/proj/app.ts');
    const cfg = adapter.transformLaunchConfig({
      program,
      runtimeExecutable: 'ts-node',
      runtimeArgs: ['-r', 'ts-node/register', '-r', 'ts-node/register/transpile-only']
    } as any);

    const ra = (cfg.runtimeArgs || []) as string[];
    // Should be exactly as provided (idempotent)
    const countRegister = ra.filter((x) => x === 'ts-node/register').length;
    const countTranspile = ra.filter((x) => x === 'ts-node/register/transpile-only').length;
    expect(countRegister).toBe(1);
    expect(countTranspile).toBe(1);
  });

  it('JS passes through user-provided outFiles', () => {
    const program = path.resolve('/proj/app.js');
    const cfg = adapter.transformLaunchConfig({
      program,
      sourceMaps: true,
      outFiles: ['dist/**/*.js']
    } as any);
    expect(cfg.outFiles).toEqual(['dist/**/*.js']);
  });

  it('env merge should not mutate process.env', () => {
    const program = path.resolve('/proj/app.js');
    const before = { ...process.env };
    const cfg = adapter.transformLaunchConfig({
      program,
      env: { CUSTOM_ENV: '1' }
    } as any);

    const env = cfg.env as Record<string, string>;
    expect(env.CUSTOM_ENV).toBe('1');
    expect(process.env.CUSTOM_ENV).toBe(before.CUSTOM_ENV);
  });
});
