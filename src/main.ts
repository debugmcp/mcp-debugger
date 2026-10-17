/**
 * Debug MCP Server - `main()`
 *
 * Side-effect free on import (issue #732): importing this module starts
 * nothing and touches neither the console nor argv. The entries own those —
 * `src/index.ts` (the `dist/index.js` entry and the Docker bundle's) and the
 * npm bundle's `cli-entry.ts` both import `src/cli/entry-prologue.ts` first and
 * then call `main()`. Keeping `main()` out of `src/index.ts` is what lets the
 * bundle import it directly: inside the bundle every module shares
 * `import.meta.url`, so index.ts's main-module check would be true for a
 * `node cli.mjs` launch and start a second server on the same stdin (#717).
 */
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

export interface ServerOptions {
  logLevel?: string;
  logFile?: string;
}

// Factory function for creating server instances
export function createDebugMcpServer(options: ServerOptions): DebugMcpServer {
  return new DebugMcpServer(options);
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
