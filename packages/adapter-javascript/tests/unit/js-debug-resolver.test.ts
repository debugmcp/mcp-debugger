import { describe, it, expect } from 'vitest';
import path from 'path';
import { jsDebugCandidatePaths, resolveJsDebugServer } from '../../src/utils/js-debug-resolver.js';

const norm = (p: string): string => p.replace(/\\+/g, '/');

describe('js-debug-resolver', () => {
  const baseDir = path.resolve('/opt/pkg/dist');

  it('probes the sibling-vendor package layout first, then the bundled dist/vendor layout, then containers', () => {
    const candidates = jsDebugCandidatePaths(baseDir).map(norm);
    expect(candidates).toEqual([
      '/opt/pkg/vendor/js-debug/vsDebugServer.cjs',
      '/opt/pkg/vendor/js-debug/vsDebugServer.js',
      '/opt/pkg/dist/vendor/js-debug/vsDebugServer.cjs',
      '/opt/pkg/dist/vendor/js-debug/vsDebugServer.js',
      '/app/packages/adapter-javascript/vendor/js-debug/vsDebugServer.cjs',
      '/app/node_modules/@debugmcp/adapter-javascript/vendor/js-debug/vsDebugServer.cjs'
    ]);
  });

  it('resolves the bundled npx layout (payload under baseDir/vendor) — issue #354', () => {
    const bundled = path.resolve(baseDir, 'vendor/js-debug/vsDebugServer.cjs');
    const resolved = resolveJsDebugServer((p) => p === bundled, baseDir);
    expect(resolved).toBe(bundled);
  });

  it('prefers the package layout over the bundled layout when both exist', () => {
    const resolved = resolveJsDebugServer(() => true, baseDir);
    expect(norm(resolved ?? '')).toBe('/opt/pkg/vendor/js-debug/vsDebugServer.cjs');
  });

  it('returns null when nothing exists', () => {
    expect(resolveJsDebugServer(() => false, baseDir)).toBeNull();
  });

  it('treats probe exceptions as absent and keeps searching', () => {
    const bundled = path.resolve(baseDir, 'vendor/js-debug/vsDebugServer.cjs');
    const resolved = resolveJsDebugServer((p) => {
      if (norm(p).includes('/opt/pkg/vendor/')) {
        throw new Error('EACCES');
      }
      return p === bundled;
    }, baseDir);
    expect(resolved).toBe(bundled);
  });
});
