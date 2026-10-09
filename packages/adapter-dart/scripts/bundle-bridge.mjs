// Bundle the TCP-to-stdio bridge into one self-contained file (issue #790).
//
// The bridge runs as a separate Node process spawned by the Dart adapter, and the NPX
// distribution ships no node_modules next to it, so `dist/bridge/dap-stdio-bridge.js` must be
// standalone. It only uses Node built-ins, but bundling keeps the ESM import graph in one file.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(pkgRoot, 'src', 'bridge', 'dap-stdio-bridge.ts');
const outfile = path.join(pkgRoot, 'dist', 'bridge', 'dap-stdio-bridge.js');

if (!fs.existsSync(entry)) {
  console.warn(`[adapter-dart] bridge entry ${entry} not found; skipping bridge bundle`);
  process.exit(0);
}

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: false,
  logLevel: 'info',
  banner: {
    js: [
      '// Self-contained DAP stdio bridge for the Dart/Flutter SDK debug adapters (bundled by scripts/bundle-bridge.mjs). Do not edit.',
      "import { createRequire as __createRequire } from 'node:module';",
      'const require = __createRequire(import.meta.url);'
    ].join('\n')
  }
});
