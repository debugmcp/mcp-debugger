/**
 * Debug MCP Server - Entry Point
 * 
 * This is the main entry point for the Debug MCP Server.
 */

// CRITICAL: Console silencing MUST be first - before ANY imports
// This prevents stdout pollution which can:
// 1. Break MCP protocol in stdio mode
// 2. Corrupt IPC channels when spawning proxy processes in SSE mode
// Console output MUST always be silenced to ensure reliable operation
(() => {
  // Always silence console output to prevent protocol corruption
  process.env.CONSOLE_OUTPUT_SILENCED = '1';
  
  const noop = () => {};
  console.log = noop;
  console.error = noop;
  console.warn = noop;
  console.info = noop;
  console.debug = noop;
  console.trace = noop;
  console.dir = noop;
  console.table = noop;
  console.group = noop;
  console.groupEnd = noop;
  console.time = noop;
  console.timeEnd = noop;
  console.assert = noop;
  
  // Suppress process warnings
  process.removeAllListeners('warning');
  process.on('warning', noop);
})();

// Clean argv before any code processes it - strip quotes from all arguments
process.argv = process.argv.map(arg => 
  typeof arg === 'string' ? arg.replace(/^["'](.*)["']$/, '$1') : arg
);

import { createLogger } from './utils/logger.js';
import { runStartupJanitor } from './utils/startup-janitor.js';
import { DebugMcpServer } from './server.js';
import { setupErrorHandlers } from './cli/error-handlers.js';
import {
  createCLI,
  setupStdioCommand,
  setupSSECommand,
  setupHttpCommand,
  setupCheckRustBinaryCommand,
  setupDoctorCommand,
} from './cli/setup.js';
import { handleStdioCommand } from './cli/stdio-command.js';
import { handleCheckRustBinaryCommand } from './cli/commands/check-rust-binary.js';
import { getVersion } from './cli/version.js';
import { isContainerRuntime } from './utils/container-path-utils.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export interface ServerOptions {
  logLevel?: string;
  logFile?: string;
}

// Factory function for creating server instances
export function createDebugMcpServer(options: ServerOptions): DebugMcpServer {
  return new DebugMcpServer(options);
}

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
  // Environment flag is already set unconditionally above
} catch {
  // ignore diagnostics write failures
}

// Main execution function
export async function main(): Promise<void> {
  const logger = createLogger('debug-mcp:cli');

  // Stamp our PID so the Java adapter (and other future child-spawning
  // adapters) can mark debuggee processes with our identity. The reaper
  // below uses this to decide which orphans from prior runs are ours to kill.
  process.env.MCP_DEBUGGER_MAIN_PID = String(process.pid);

  // Best-effort cleanup of debris from prior crashed runs (orphan JVMs and
  // proxy workers, stale session logs) runs fire-and-forget from the
  // server-starting command actions below — never for --version/--help, and
  // never blocking the transport from coming up (issue #399). Safe alongside
  // the live server: reapers only kill processes whose recorded owner pid is
  // dead. MCP_SKIP_ORPHAN_REAPERS=1 skips the process scans entirely.
  const kickStartupJanitor = () => {
    void runStartupJanitor({ logger }).catch(() => {
      // runStartupJanitor logs its own failures; this guard is belt-and-suspenders.
    });
  };

  // Setup error handlers
  setupErrorHandlers({ logger });
  
  // Create CLI
  const program = createCLI('debug-mcp-server', 'Step-through debugging MCP server for LLMs', getVersion());
  
  // Setup commands
  setupStdioCommand(program, (options) => {
    kickStartupJanitor();
    return handleStdioCommand(options, { logger, serverFactory: createDebugMcpServer });
  });

  // The SSE/HTTP command modules pull in express and the SDK's HTTP transport
  // stacks; import them only when their subcommand actually runs so stdio mode
  // (the common case) never pays for them (issue #400).
  setupSSECommand(program, async (options) => {
    kickStartupJanitor();
    const { handleSSECommand } = await import('./cli/sse-command.js');
    return handleSSECommand(options, { logger, serverFactory: createDebugMcpServer });
  });

  setupHttpCommand(program, async (options) => {
    kickStartupJanitor();
    const { handleHttpCommand } = await import('./cli/http-command.js');
    return handleHttpCommand(options, { logger, serverFactory: createDebugMcpServer });
  });

  setupCheckRustBinaryCommand(program, (binaryPath, options) =>
    handleCheckRustBinaryCommand(binaryPath, options)
  );

  // Doctor is a diagnostic, not a server: no janitor (issue #399 contract),
  // lazy import so stdio startup never pays for it (issue #400 pattern), and
  // the exit code lands on process.exitCode rather than a throw (main().catch
  // would collapse every failure to 1).
  setupDoctorCommand(program, async (languages, options) => {
    const { handleDoctorCommand } = await import('./cli/commands/doctor/index.js');
    process.exitCode = await handleDoctorCommand(languages, options);
  });

  // Parse command line arguments
  await program.parseAsync();
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
  const skipAutoStart = process.env.DEBUG_MCP_SKIP_AUTO_START === '1';
  if (!skipAutoStart) {
    main().catch(() => {
      // Console output is always silenced - errors go to the logger
      // Never write to console as it can corrupt protocols
      process.exit(1);
    });
  }
}

// Export for testing. handleSSECommand/handleHttpCommand are deliberately not
// re-exported: their modules are lazy-imported inside the command actions
// (issue #400) and consumers import them from their own modules directly.
export {
  setupErrorHandlers,
  createCLI,
  setupStdioCommand,
  setupSSECommand,
  setupHttpCommand,
  setupCheckRustBinaryCommand,
  setupDoctorCommand,
  handleStdioCommand,
  handleCheckRustBinaryCommand
};
