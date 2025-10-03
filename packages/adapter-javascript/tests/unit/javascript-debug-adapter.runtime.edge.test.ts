/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import { JavascriptDebugAdapter } from '../../src/index.js';
import * as tsdetUtil from '../../src/utils/typescript-detector.js';
import * as cfg from '../../src/utils/config-transformer.js';

// Minimal AdapterDependencies stub
const deps = {
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
} as unknown as import('@debugmcp/shared').AdapterDependencies;

function norm(p: unknown): string {
  return typeof p === 'string' ? (p as string).replace(/\\+/g, '/') : '';
}

describe('JavascriptDebugAdapter private runtime helpers (edge coverage)', () => {
  let adapter: JavascriptDebugAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    adapter = new JavascriptDebugAdapter(deps);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('determineRuntimeExecutable (private)', () => {
    it('non-TS returns node', async () => {
      const exec = await (adapter as any).determineRuntimeExecutable(false);
      expect(exec).toBe('node');
    });

    it('TS with tsx present returns tsx path', async () => {
      vi.spyOn(tsdetUtil, 'detectTsRunners').mockResolvedValue({ tsx: '/bin/tsx', tsNode: undefined });
      const exec = await (adapter as any).determineRuntimeExecutable(true);
      expect(norm(exec)).toBe(norm('/bin/tsx'));
    });

    it('TS with only ts-node present returns node (hooks handled elsewhere)', async () => {
      vi.spyOn(tsdetUtil, 'detectTsRunners').mockResolvedValue({ tsx: undefined, tsNode: '/bin/ts-node' });
      const exec = await (adapter as any).determineRuntimeExecutable(true);
      expect(exec).toBe('node');
      expect(deps.logger.warn).not.toHaveBeenCalled();
    });

    it('TS with no runners logs a warning and returns node', async () => {
      vi.spyOn(tsdetUtil, 'detectTsRunners').mockResolvedValue({ tsx: undefined, tsNode: undefined });
      const exec = await (adapter as any).determineRuntimeExecutable(true);
      expect(exec).toBe('node');
      expect(deps.logger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('determineRuntimeArgs (private)', () => {
    it('non-TS: returns normalized/deduped user args only', async () => {
      const out: string[] = await (adapter as any).determineRuntimeArgs(false, {
        runtimeArgs: ['-r', 'mod', '-r', 'mod', '--loader', 'ld', '--loader', 'ld']
      });
      // Dedup pairs/loader
      const countPair = (arr: string[], flag: string, val: string) => {
        let c = 0;
        for (let i = 0; i < arr.length - 1; i++) {
          if (arr[i] === flag && arr[i + 1] === val) c++;
        }
        return c;
      };
      expect(countPair(out, '-r', 'mod')).toBe(1);
      expect(countPair(out, '--loader', 'ld')).toBe(1);
    });

    it('TS with override tsx: preserve user args only (no hooks)', async () => {
      const out: string[] = await (adapter as any).determineRuntimeArgs(true, {
        program: path.resolve('/proj/app.ts'),
        cwd: path.resolve('/proj'),
        runtimeExecutable: 'tsx',
        runtimeArgs: ['--custom']
      });
      expect(out).toEqual(['--custom']);
    });

    it('TS with override ts-node: preserve user args only (no hooks)', async () => {
      const out: string[] = await (adapter as any).determineRuntimeArgs(true, {
        program: path.resolve('/proj/app.ts'),
        cwd: path.resolve('/proj'),
        runtimeExecutable: 'ts-node',
        runtimeArgs: ['-r', 'ts-node/register']
      });
      // No additional hooks added and no duplication
      const countPair = (arr: string[], flag: string, val: string) => {
        let c = 0;
        for (let i = 0; i < arr.length - 1; i++) {
          if (arr[i] === flag && arr[i + 1] === val) c++;
        }
        return c;
      };
      expect(countPair(out, '-r', 'ts-node/register')).toBe(1);
    });

    it('TS no override, tsx present: no hooks added', async () => {
      vi.spyOn(adapter as any, 'detectTypeScriptRunners').mockResolvedValue({ tsx: '/bin/tsx', tsNode: undefined });
      const out: string[] = await (adapter as any).determineRuntimeArgs(true, {
        program: path.resolve('/proj/app.ts'),
        cwd: path.resolve('/proj'),
        runtimeArgs: []
      });
      expect(out).toEqual([]);
    });

    it('TS with ts-node present adds hooks; ESM and tsconfig-paths when applicable; dedup with user args', async () => {
      vi.spyOn(adapter as any, 'detectTypeScriptRunners').mockResolvedValue({ tsx: undefined, tsNode: '/bin/ts-node' });
      vi.spyOn(cfg, 'isESMProject').mockReturnValue(true);
      vi.spyOn(cfg, 'hasTsConfigPaths').mockReturnValue(true);

      const out: string[] = await (adapter as any).determineRuntimeArgs(true, {
        program: path.resolve('/proj/app.ts'),
        cwd: path.resolve('/proj'),
        runtimeArgs: [
          // include duplicates to ensure dedupe
          '-r', 'ts-node/register',
          '--loader', 'ts-node/esm'
        ]
      });

      const countPair = (arr: string[], flag: string, val: string) => {
        let c = 0;
        for (let i = 0; i < arr.length - 1; i++) {
          if (arr[i] === flag && arr[i + 1] === val) c++;
        }
        return c;
      };

      expect(countPair(out, '-r', 'ts-node/register')).toBe(1);
      expect(countPair(out, '-r', 'ts-node/register/transpile-only')).toBe(1);
      expect(countPair(out, '--loader', 'ts-node/esm')).toBe(1);
      expect(countPair(out, '-r', 'tsconfig-paths/register')).toBe(1);
    });

    it('TS with ts-node present but no ESM/paths only adds core ts-node hooks', async () => {
      vi.spyOn(adapter as any, 'detectTypeScriptRunners').mockResolvedValue({ tsx: undefined, tsNode: '/bin/ts-node' });
      vi.spyOn(cfg, 'isESMProject').mockReturnValue(false);
      vi.spyOn(cfg, 'hasTsConfigPaths').mockReturnValue(false);

      const out: string[] = await (adapter as any).determineRuntimeArgs(true, {
        program: path.resolve('/proj/app.ts'),
        cwd: path.resolve('/proj'),
        runtimeArgs: []
      });

      const has = (flag: string, val: string) => {
        for (let i = 0; i < out.length - 1; i++) {
          if (out[i] === flag && out[i + 1] === val) return true;
        }
        return false;
      };

      expect(has('-r', 'ts-node/register')).toBe(true);
      expect(has('-r', 'ts-node/register/transpile-only')).toBe(true);
      // No loader or tsconfig-paths
      expect(out.includes('--loader')).toBe(false);
      expect(out.includes('tsconfig-paths/register')).toBe(false);
    });
  });

  describe('misc small helpers', () => {
    it('getAdapterModuleName/getAdapterInstallCommand/getDefaultLaunchConfig', () => {
      expect(adapter.getAdapterModuleName()).toBe('js-debug');
      expect(adapter.getAdapterInstallCommand()).toMatch(/@vscode\/js-debug/);
      const def = adapter.getDefaultLaunchConfig();
      expect(typeof def).toBe('object');
      expect(typeof (def as any).cwd).toBe('string');
    });

    it('getDefaultExecutableName/getExecutableSearchPaths', () => {
      expect(adapter.getDefaultExecutableName()).toBe('node');
      const paths = adapter.getExecutableSearchPaths();
      expect(Array.isArray(paths)).toBe(true);
    });

    it('resolveExecutablePath preferredPath overrides cache deterministically', async () => {
      // First set a cached value by calling without preferredPath
      const first = await adapter.resolveExecutablePath();
      expect(typeof first).toBe('string');

      // Now override with a custom path via preferredPath
      const custom = path.resolve('/custom/node');
      // Spy findNode to return the custom value when called with preferred
      const findNode = await import('../../src/utils/executable-resolver.js');
      const spy = vi.spyOn(findNode, 'findNode').mockResolvedValue(custom);

      const overridden = await adapter.resolveExecutablePath(custom);
      expect(norm(overridden)).toBe(norm(custom));
      spy.mockRestore();
    });
  });
});
