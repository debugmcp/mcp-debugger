// Bundle the COBOL DAP shim into one self-contained file (issue #759).
//
// The shim runs as a separate Node process spawned by the adapter, and the
// NPX distribution ships no node_modules, so `dist/shim/cobol-shim.js` must
// carry everything it imports (the framing codec from @debugmcp/shared, the
// decoder and manifest modules of this package). esbuild tree-shakes the ESM
// graph, so only what the shim reaches is inlined.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(pkgRoot, 'src', 'shim', 'cobol-shim.ts');
const outfile = path.join(pkgRoot, 'dist', 'shim', 'cobol-shim.js');

if (!fs.existsSync(entry)) {
  console.warn(`[adapter-cobol] shim entry ${entry} not found; skipping shim bundle`);
  process.exit(0);
}

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: 'inline',
  logLevel: 'info',
  banner: {
    js: [
      '// Self-contained COBOL DAP shim (bundled by scripts/bundle-shim.mjs). Do not edit.',
      "import { createRequire as __createRequire } from 'node:module';",
      'const require = __createRequire(import.meta.url);'
    ].join('\n')
  }
});
