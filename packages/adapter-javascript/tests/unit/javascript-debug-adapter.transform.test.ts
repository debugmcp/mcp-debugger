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

  it('should transform JS config with defaults', async () => {
    const program = path.resolve('/proj/app.js');
    const cfg = await adapter.transformLaunchConfig({
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
    expect(norm(cfg.runtimeExecutable as string)).toBe(norm(process.execPath));
  });

  it('JS with sourceMaps true applies default outFiles when not provided', async () => {
    const program = path.resolve('/proj/app.js');
    (determineOutFiles as any).mockImplementation((user?: string[]) => {
      if (user && user.length > 0) return user;
      return ['**/*.js', '!**/node_modules/**'];
    });

    const cfg = await adapter.transformLaunchConfig({
      program,
      sourceMaps: true
    } as any);

    expect(cfg.sourceMaps).toBe(true);
    expect(cfg.outFiles).toEqual(['**/*.js', '!**/node_modules/**']);
    expect(cfg.resolveSourceMapLocations).toEqual(['**', '!**/node_modules/**']);
  });

  it('should set TS defaults and outFiles with ts-node present', async () => {
    const program = path.resolve('/proj/app.ts');

    // Synchronous detectBinary used by transformLaunchConfig
    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'ts-node') return '/bin/ts-node';
      return undefined;
    });

    const cfg = await adapter.transformLaunchConfig({
      program
    } as any);

    expect(cfg.sourceMaps).toBe(true);
    expect((cfg.outFiles as string[])).toContain('**/*.js');
    // runtimeExecutable defaults to host Node.js when ts-node is present (hooks added)
    expect(norm(cfg.runtimeExecutable as string)).toBe(norm(process.execPath));
    // runtimeArgs should include ts-node hooks
    const ra = (cfg.runtimeArgs || []) as string[];
    const hasRegister = ra.includes('-r') && ra.includes('ts-node/register');
    const hasTranspile = ra.includes('-r') && ra.includes('ts-node/register/transpile-only');
    expect(hasRegister || hasTranspile).toBe(true);
  });

  it('should use tsx when available (priority over ts-node)', async () => {
    const program = path.resolve('/proj/app.ts');

    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'tsx') return '/bin/tsx';
      return undefined;
    });

    const cfg = await adapter.transformLaunchConfig({
      program
    } as any);

    expect(norm(cfg.runtimeExecutable as string)).toBe(norm('/bin/tsx'));
    expect(cfg.runtimeArgs).toBeUndefined(); // no hooks added when using tsx (aside from user-provided)
  });

  it('should add ts-node ESM loader for ESM project (.mts) when ts-node present', async () => {
    const program = path.resolve('/proj/app.mts');

    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'ts-node') return '/bin/ts-node';
      return undefined;
    });

    (isESMProject as any).mockReturnValue(true);

    const cfg = await adapter.transformLaunchConfig({
      program
    } as any);

    const ra = (cfg.runtimeArgs || []) as string[];
    const idx = ra.findIndex((x) => x === '--loader');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(ra[idx + 1]).toBe('ts-node/esm');
  });

  it('should add tsconfig-paths/register when tsconfig has paths', async () => {
    const program = path.resolve('/proj/app.ts');

    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'ts-node') return '/bin/ts-node';
      return undefined;
    });
    (hasTsConfigPaths as any).mockReturnValue(true);

    const cfg = await adapter.transformLaunchConfig({
      program
    } as any);

    const ra = (cfg.runtimeArgs || []) as string[];
    const findRIdxes = ra.reduce<number[]>((acc, v, i) => (v === '-r' ? acc.concat(i) : acc), []);
    const values = findRIdxes.map((i) => ra[i + 1]);
    expect(values).toContain('tsconfig-paths/register');
  });

  it('should preserve user-provided runtimeArgs and append last', async () => {
    const program = path.resolve('/proj/app.ts');
    (detectBinary as any).mockImplementation((name: string) => {
      if (name === 'ts-node') return '/bin/ts-node';
      return undefined;
    });

    const cfg = await adapter.transformLaunchConfig({
      program,
      runtimeArgs: ['--my-flag']
    } as any);

    const ra = (cfg.runtimeArgs || []) as string[];
    expect(ra[ra.length - 1]).toBe('--my-flag');
  });

  it('runtimeExecutable override: "tsx" results in empty hooks', async () => {
    const program = path.resolve('/proj/app.ts');
    const cfg = await adapter.transformLaunchConfig({
      program,
      runtimeExecutable: 'tsx',
      runtimeArgs: ['--custom']
    } as any);

    expect(cfg.runtimeExecutable).toBe('tsx');
    expect(cfg.runtimeArgs).toEqual(['--custom']); // only user-provided
  });

  it('runtimeExecutable override: "ts-node" results in no duplicate hooks', async () => {
    const program = path.resolve('/proj/app.ts');
    const cfg = await adapter.transformLaunchConfig({
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

  it('JS passes through user-provided outFiles', async () => {
    const program = path.resolve('/proj/app.js');
    const cfg = await adapter.transformLaunchConfig({
      program,
      sourceMaps: true,
      outFiles: ['dist/**/*.js']
    } as any);
    expect(cfg.outFiles).toEqual(['dist/**/*.js']);
  });

  it('env merge should not mutate process.env', async () => {
    const program = path.resolve('/proj/app.js');
    const before = { ...process.env };
    const cfg = await adapter.transformLaunchConfig({
      program,
      env: { CUSTOM_ENV: '1' }
    } as any);

    const env = cfg.env as Record<string, string>;
    expect(env.CUSTOM_ENV).toBe('1');
    expect(process.env.CUSTOM_ENV).toBe(before.CUSTOM_ENV);
  });

  describe('exit code shim injection (issue #247)', () => {
    // The shim resolution consults dependencies.fileSystem.existsSync (same
    // pattern as buildAdapterCommand's vendor lookup)
    const depsWithFs = {
      ...deps,
      fileSystem: { existsSync: () => true }
    } as unknown as import('@debugmcp/shared').AdapterDependencies;

    it('injects MCP_DEBUGGER_EXITCODE_FILE and a NODE_OPTIONS --require of the shim', async () => {
      const withFs = new JavascriptDebugAdapter(depsWithFs);
      const cfg = await withFs.transformLaunchConfig({
        program: path.resolve('/proj/app.js')
      } as any);

      const env = cfg.env as Record<string, string>;
      expect(env.MCP_DEBUGGER_EXITCODE_FILE).toMatch(/mcp-exitcode-[0-9a-f-]+\.txt$/);
      expect(env.NODE_OPTIONS ?? '').toMatch(/--require "[^"]*exitcode-shim\.cjs"/);
      // Forward slashes only: backslash escaping in NODE_OPTIONS is ambiguous on Windows
      const requireArg = /--require "([^"]*)"/.exec(env.NODE_OPTIONS)![1];
      expect(requireArg).not.toContain('\\');
    });

    it('preserves pre-existing NODE_OPTIONS content', async () => {
      const withFs = new JavascriptDebugAdapter(depsWithFs);
      const cfg = await withFs.transformLaunchConfig({
        program: path.resolve('/proj/app.js'),
        env: { NODE_OPTIONS: '--max-old-space-size=2048' }
      } as any);

      const env = cfg.env as Record<string, string>;
      expect(env.NODE_OPTIONS).toContain('--max-old-space-size=2048');
      expect(env.NODE_OPTIONS).toMatch(/--require "[^"]*exitcode-shim\.cjs"/);
    });

    it('does not double-append when NODE_OPTIONS already carries the shim', async () => {
      const withFs = new JavascriptDebugAdapter(depsWithFs);
      const cfg = await withFs.transformLaunchConfig({
        program: path.resolve('/proj/app.js'),
        env: { NODE_OPTIONS: '--require "/prior/exitcode-shim.cjs"' }
      } as any);

      const env = cfg.env as Record<string, string>;
      const occurrences = env.NODE_OPTIONS.match(/exitcode-shim\.cjs/g) ?? [];
      expect(occurrences.length).toBe(1);
    });

    it('skips injection cleanly when the shim asset cannot be resolved', async () => {
      const depsNoShim = {
        ...deps,
        fileSystem: { existsSync: () => false }
      } as unknown as import('@debugmcp/shared').AdapterDependencies;
      const withoutShim = new JavascriptDebugAdapter(depsNoShim);

      const cfg = await withoutShim.transformLaunchConfig({
        program: path.resolve('/proj/app.js')
      } as any);

      const env = cfg.env as Record<string, string>;
      expect(env.MCP_DEBUGGER_EXITCODE_FILE).toBeUndefined();
      expect(env.NODE_OPTIONS ?? '').not.toContain('exitcode-shim');
    });

    it('leaves attach configs untouched', async () => {
      const withFs = new JavascriptDebugAdapter(depsWithFs);
      const cfg = await withFs.transformAttachConfig({
        port: 9229
      } as any);

      const env = (cfg.env ?? {}) as Record<string, string>;
      expect(env.MCP_DEBUGGER_EXITCODE_FILE).toBeUndefined();
      expect(env.NODE_OPTIONS ?? '').not.toContain('exitcode-shim');
    });
  });
});
