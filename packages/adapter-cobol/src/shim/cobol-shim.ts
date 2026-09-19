/**
 * COBOL DAP shim — process entry (issue #759).
 *
 * Spawned by CobolDebugAdapter as
 *   node cobol-shim.js --port <n> [--manifest-dir <dir>]* [--log <file>]
 *        [--stdin-file <file>] [--engine-scopes] [--ref-check strict|warn] -- <codelldb> [args…]
 *
 * No logic lives here: argv parsing is `parseShimArgs` (shared with the adapter's
 * round-trip tests), everything else is `createCobolShim`.
 */
import { parseShimArgs } from '../shim-protocol.js';
import { createCobolShim } from './shim-core.js';

const { cleanup } = createCobolShim(parseShimArgs(process.argv.slice(2)));

process.on('SIGTERM', () => {
  cleanup();
});
