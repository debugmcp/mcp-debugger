/**
 * Single source of truth for locating the vendored js-debug DAP server.
 *
 * The vendor payload lives in different places depending on how the adapter
 * is deployed (issue #354/#364 — the npx CLI bundle inlines every module into
 * dist/cli.mjs, so import.meta.url-relative '../vendor' resolves outside the
 * package while the payload is copied to dist/vendor):
 *  - source/dist package layout:  <pkg>/vendor/js-debug (sibling of src|dist)
 *  - bundled npx CLI:             <bundle>/dist/vendor/js-debug (baseDir itself)
 *  - container images:            /app/... fallbacks
 */
import path from 'path';

/**
 * Ordered candidate paths for the js-debug entry point, resolved against
 * baseDir (the importing module's directory). Callers apply their own
 * existence probe (sync or async) over this list.
 */
export function jsDebugCandidatePaths(baseDir: string): string[] {
  return [
    // Package layout: vendor/ is a sibling of src/ (unit tests) and dist/ (built package)
    path.resolve(baseDir, '../vendor/js-debug/vsDebugServer.cjs'),
    path.resolve(baseDir, '../vendor/js-debug/vsDebugServer.js'),
    // Bundled npx distribution: everything is inlined into dist/cli.mjs, so
    // baseDir IS the dist dir and the payload sits at dist/vendor
    path.resolve(baseDir, 'vendor/js-debug/vsDebugServer.cjs'),
    path.resolve(baseDir, 'vendor/js-debug/vsDebugServer.js'),
    // Container builds
    '/app/packages/adapter-javascript/vendor/js-debug/vsDebugServer.cjs',
    '/app/node_modules/@debugmcp/adapter-javascript/vendor/js-debug/vsDebugServer.cjs'
  ];
}

/**
 * Resolve the js-debug entry point with a synchronous existence probe.
 * Returns null when no candidate exists.
 */
export function resolveJsDebugServer(
  existsFn: (p: string) => boolean,
  baseDir: string
): string | null {
  for (const candidate of jsDebugCandidatePaths(baseDir)) {
    try {
      if (existsFn(candidate)) {
        return candidate;
      }
    } catch {
      // Treat probe failures as "not present" and keep searching
    }
  }
  return null;
}
