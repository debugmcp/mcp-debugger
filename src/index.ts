/**
 * Debug MCP Server - Entry Point
 * 
 * This is the main entry point for the Debug MCP Server.
 */

// CRITICAL: Console silencing MUST be first - before ANY imports
// This prevents stdout pollution in stdio mode which breaks MCP protocol
(() => {
  // Handle both quoted and unquoted stdio arguments
  const hasStdio = process.argv.some(arg =>
    arg === 'stdio' ||
    arg === '"stdio"' ||
    arg === '"\'stdio\'"' ||
    arg.includes('stdio')
  );

  // Auto-detect STDIO mode:
  // 1. Explicit stdio argument
  // 2. Environment variable set
  // 3. No transport argument specified (default is STDIO)
  // 4. stdin is a pipe (typical for MCP STDIO mode)
  const hasTransportArg = process.argv.some(arg =>
    arg === '--transport' || arg.includes('transport')
  );
  const isStdinPipe = !process.stdin.isTTY;
  const shouldSilenceConsole = hasStdio ||
                               process.env.DEBUG_MCP_STDIO === '1' ||
                               (!hasTransportArg && isStdinPipe);

  if (shouldSilenceConsole) {
    // Set env flag immediately so any early imports see it
    if (hasStdio || shouldSilenceConsole) {
      process.env.DEBUG_MCP_STDIO = '1';
    }
    
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
  }
})();

// Clean argv before any code processes it - strip quotes from all arguments
process.argv = process.argv.map(arg => 
  typeof arg === 'string' ? arg.replace(/^["'](.*)["']$/, '$1') : arg
);

import { createLogger } from './utils/logger.js';
import { DebugMcpServer } from './server.js';
import { setupErrorHandlers } from './cli/error-handlers.js';
import { createCLI, setupStdioCommand, setupSSECommand } from './cli/setup.js';
import { handleStdioCommand } from './cli/stdio-command.js';
import { handleSSECommand } from './cli/sse-command.js';
import { getVersion } from './cli/version.js';
import fs from 'fs';
import path from 'path';

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
  if (process.env.MCP_CONTAINER === 'true') {
    const logDir = '/app/logs';
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch {}
    try {
      const msg = `Bundle entry loaded @ ${new Date().toISOString()} | argv=${JSON.stringify(process.argv)}\n`;
      fs.appendFileSync(path.join(logDir, 'bundle-start.log'), msg);
    } catch {}
  }
  // Preserve explicit stdio flag for downstream components
  if (process.argv.includes('stdio')) {
    process.env.DEBUG_MCP_STDIO = '1';
  }
} catch {
  // ignore diagnostics write failures
}

// Main execution function
export async function main(): Promise<void> {
  const logger = createLogger('debug-mcp:cli');
  
  // Setup error handlers
  setupErrorHandlers({ logger });
  
  // Create CLI
  const program = createCLI('debug-mcp-server', 'Step-through debugging MCP server for LLMs', getVersion());
  
  // Setup commands
  setupStdioCommand(program, (options) => 
    handleStdioCommand(options, { logger, serverFactory: createDebugMcpServer })
  );
  
  setupSSECommand(program, (options) =>
    handleSSECommand(options, { logger, serverFactory: createDebugMcpServer })
  );
  
  // Parse command line arguments
  program.parse();
}

// Only execute if this is the main module
// Check if the script is being run directly (not imported)
// Handle both ESM (import.meta.url) and CJS (__filename) contexts
const isMainModule = (() => {
  // In CJS context (bundled), use require.main check
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    return true;
  }
  
  // In ESM context, check import.meta.url
  if (typeof import.meta !== 'undefined' && import.meta.url && process.argv[1]) {
    const scriptPath = process.argv[1].replace(/\\/g, '/');
    const moduleUrl = import.meta.url.replace(/\\/g, '/');
    return moduleUrl === `file://${scriptPath}` || 
           moduleUrl.endsWith(scriptPath) ||
           scriptPath.endsWith('dist/index.js');
  }
  
  // Fallback: assume it's main if we can't determine otherwise
  return true;
})();

if (isMainModule) {
  main().catch((error) => {
    // In stdio mode, we must not write to console
    const isStdio = process.argv.includes('stdio') || process.env.DEBUG_MCP_STDIO === '1';
    if (!isStdio) {
      console.error('Fatal error:', error);
    }
    process.exit(1);
  });
}

// Export for testing
export { 
  setupErrorHandlers, 
  createCLI, 
  setupStdioCommand, 
  setupSSECommand,
  handleStdioCommand,
  handleSSECommand
};
