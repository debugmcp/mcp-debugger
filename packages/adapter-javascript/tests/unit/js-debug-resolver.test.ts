import { describe, it, expect } from 'vitest';
import path from 'path';
import { jsDebugCandidatePaths, resolveJsDebugServer } from '../../src/utils/js-debug-resolver.js';

// Windows-safe: build every expectation through path.resolve so drive-letter
// prefixes (D:\opt\...) match what the resolver produces.
const baseDir = path.resolve('/opt/pkg/dist');
const pkgVendorCjs = path.resolve(baseDir, '../vendor/js-debug/vsDebugServer.cjs');
const pkgVendorJs = path.resolve(baseDir, '../vendor/js-debug/vsDebugServer.js');
const bundledCjs = path.resolve(baseDir, 'vendor/js-debug/vsDebugServer.cjs');
const bundledJs = path.resolve(baseDir, 'vendor/js-debug/vsDebugServer.js');

describe('js-debug-resolver', () => {
  it('probes the sibling-vendor package layout first, then the bundled dist/vendor layout, then containers', () => {
    const candidates = jsDebugCandidatePaths(baseDir);
    expect(candidates.slice(0, 4)).toEqual([pkgVendorCjs, pkgVendorJs, bundledCjs, bundledJs]);
    expect(candidates.slice(4)).toEqual([
      '/app/packages/adapter-javascript/vendor/js-debug/vsDebugServer.cjs',
      '/app/node_modules/@debugmcp/adapter-javascript/vendor/js-debug/vsDebugServer.cjs'
    ]);
  });

  it('resolves the bundled npx layout (payload under baseDir/vendor) — issue #354', () => {
    const resolved = resolveJsDebugServer((p) => p === bundledCjs, baseDir);
    expect(resolved).toBe(bundledCjs);
  });

  it('prefers the package layout over the bundled layout when both exist', () => {
    const resolved = resolveJsDebugServer(() => true, baseDir);
    expect(resolved).toBe(pkgVendorCjs);
  });

  it('returns null when nothing exists', () => {
    expect(resolveJsDebugServer(() => false, baseDir)).toBeNull();
  });

  it('treats probe exceptions as absent and keeps searching', () => {
    const resolved = resolveJsDebugServer((p) => {
      if (p === pkgVendorCjs || p === pkgVendorJs) {
        throw new Error('EACCES');
      }
      return p === bundledCjs;
    }, baseDir);
    expect(resolved).toBe(bundledCjs);
  });
});
