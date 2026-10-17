/**
 * Debug MCP Server - Entry Point
 *
 * The `dist/index.js` entry (and, through `scripts/bundle.js`, the Docker
 * bundle's). The npm bundle has its own entry, `packages/mcp-debugger/src/cli-entry.ts`,
 * which imports the same prologue and the same `main()` — never this module
 * (issue #732; see src/main.ts).
 */

// CRITICAL: the prologue (console silencing, argv cleanup) must evaluate before
// ANY other import — it is the first import, and ESM evaluates imports in order.
import './cli/entry-prologue.js';
import { main } from './main.js';
import { reportFatal } from './cli/report-fatal.js';
import { isContainerRuntime } from './utils/container-path-utils.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export { main, createDebugMcpServer } from './main.js';
export type { ServerOptions } from './main.js';

/**
 * Emit an early, file-only breadcrumb when running in stdio mode (useful under Docker/bundling).
 * This avoids console output but gives us deterministic startup traces inside the container.
 */
try {
  // In containers, always emit an early breadcrumb so we can diagnose startup before logger/CLI
  if (isContainerRuntime()) {
    const logDir = '/app/logs';
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch {}
    try {
      const msg = `Bundle entry loaded @ ${new Date().toISOString()} | argv=${JSON.stringify(process.argv)}\n`;
      fs.appendFileSync(path.join(logDir, 'bundle-start.log'), msg);
    } catch {}
  }
} catch {
  // ignore diagnostics write failures
}

// Only execute if this is the main module
// Handle both ESM (import.meta.url) and CJS (require.main) contexts
const isMainModule = (() => {
  // In CJS context (bundled), use require.main check
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    return true;
  }

  // In ESM context, check import.meta.url
  if (typeof import.meta !== 'undefined' && import.meta.url && process.argv[1]) {
    const scriptPath = process.argv[1].replace(/\\/g, '/');
    const moduleUrl = import.meta.url.replace(/\\/g, '/');
    // pathToFileURL produces a well-formed file URL on every platform
    // (Windows paths need file:/// with three slashes and percent-encoding,
    // which naive string composition gets wrong)
    let argvUrl: string | undefined;
    try {
      argvUrl = pathToFileURL(process.argv[1]).href;
    } catch {
      argvUrl = undefined;
    }
    return (argvUrl !== undefined && moduleUrl === argvUrl) ||
           moduleUrl.endsWith(scriptPath) ||
           scriptPath.endsWith('dist/index.js');
  }

  // Fallback: assume it's main if we can't determine otherwise
  return true;
})();

if (isMainModule) {
  main().catch((error: unknown) => {
    // The console is silenced; the logger has the details, stderr gets one line.
    reportFatal(process, 'fatal error during startup', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
