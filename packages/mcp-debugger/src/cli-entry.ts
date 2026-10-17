#!/usr/bin/env node
/**
 * Publishable CLI entry for the npx bundle.
 *
 * Imports, in order: the entry prologue (console silencing and argv cleanup —
 * the same module `src/index.ts` evaluates first, so both entries behave
 * identically), the batteries-included adapter registrations, then `main()`
 * from `src/main.ts`. It must never import `src/index.ts`: inside the bundle
 * every module shares `import.meta.url`, so index.ts's main-module check is
 * true for a `node cli.mjs` launch and would start a second server on the same
 * stdin (issues #717, #732; `tests/integration/cli/single-entrypoint.test.ts`).
 */
import '../../../src/cli/entry-prologue.js';
// Static imports of every adapter so esbuild bundles them ("batteries included").
import './batteries-included.js';
import { main } from '../../../src/main.js';
import { reportFatal } from '../../../src/cli/report-fatal.js';

main().catch((error: unknown) => {
  // The console is silenced, so the message goes to stderr as one line.
  reportFatal(process, 'fatal error during startup', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
