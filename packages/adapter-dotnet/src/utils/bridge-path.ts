/**
 * Where the built `netcoredbg-bridge.js` lives, per distribution layout — the walk the Dart
 * bridge (`adapter-dart/src/utils/bridge-path.ts`) and the COBOL shim share, plus the
 * source-tree sibling (issue #743):
 *
 * 1. this package's own `dist/utils` (dev checkout, published npm package, Docker node_modules copy)
 * 2. the package's `dist/utils` reached from its `src/` — a vitest run or an embed from source,
 *    from any cwd (the same path as 1 when running from `dist/`, so it is deduplicated)
 * 3. the npx bundle (`packages/mcp-debugger/dist/cli.mjs` inlines the adapter and `bundle-cli.js`
 *    copies the bridge to `dist/packages/adapter-dotnet/dist/utils/`)
 * 4. the project root from `node_modules/@debugmcp/adapter-dotnet/dist` (a dependant's checkout)
 * 5. the current working directory
 * 6. the Docker image paths
 */
import path from 'node:path';

const REL = ['utils', 'netcoredbg-bridge.js'] as const;

export function bridgePathCandidates(fromDir: string, cwd: string): string[] {
  const candidates = [
    path.join(fromDir, ...REL),
    path.join(fromDir, '..', 'dist', ...REL),
    path.join(fromDir, 'packages', 'adapter-dotnet', 'dist', ...REL),
    path.join(fromDir, '..', '..', '..', '..', 'packages', 'adapter-dotnet', 'dist', ...REL),
    path.join(cwd, 'packages', 'adapter-dotnet', 'dist', ...REL),
    `/app/packages/adapter-dotnet/dist/${REL.join('/')}`,
    `/app/node_modules/@debugmcp/adapter-dotnet/dist/${REL.join('/')}`,
  ];
  return [...new Set(candidates)];
}
