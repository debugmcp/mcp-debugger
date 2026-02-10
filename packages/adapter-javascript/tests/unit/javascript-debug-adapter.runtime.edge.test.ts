/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import { JavascriptDebugAdapter } from '../../src/index.js';

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
