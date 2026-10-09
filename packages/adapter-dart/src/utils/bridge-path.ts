/**
 * Where the bundled `dap-stdio-bridge.js` lives, per distribution layout. The same walk the
 * .NET bridge and the COBOL shim use:
 *
 * 1. this package's own `dist/` (dev checkout, published npm package, Docker node_modules copy)
 * 2. the npx bundle (`packages/mcp-debugger/dist/cli.mjs` inlines the adapter, and `bundle-cli.js`
 *    copies the bridge to `dist/packages/adapter-dart/dist/bridge/`)
 * 3. the monorepo relative to this package
 * 4. the current working directory
 * 5. the Docker image paths
 */
import path from 'node:path';

const REL = ['bridge', 'dap-stdio-bridge.js'] as const;

export function bridgePathCandidates(fromDir: string, cwd: string): string[] {
  return [
    path.join(fromDir, ...REL),
    path.join(fromDir, 'packages', 'adapter-dart', 'dist', ...REL),
    path.join(fromDir, '..', '..', '..', '..', 'packages', 'adapter-dart', 'dist', ...REL),
    path.join(cwd, 'packages', 'adapter-dart', 'dist', ...REL),
    `/app/packages/adapter-dart/dist/${REL.join('/')}`,
    `/app/node_modules/@debugmcp/adapter-dart/dist/${REL.join('/')}`,
  ];
}

export function resolveBridgePath(fromDir: string, cwd: string, exists: (p: string) => boolean): string {
  const candidates = bridgePathCandidates(fromDir, cwd);
  const found = candidates.find((p) => exists(p));
  if (found) return found;
  throw new Error(`dap-stdio-bridge.js not found (searched: ${candidates.join(', ')}). Run: pnpm --filter @debugmcp/adapter-dart run build`);
}
