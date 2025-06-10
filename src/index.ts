#!/usr/bin/env node
/**
 * Debug MCP Server - Entry Point
 * 
 * This is the main entry point for the Debug MCP Server.
 */

import { createLogger } from './utils/logger.js';
import { DebugMcpServer } from './server.js';
import { setupErrorHandlers } from './cli/error-handlers.js';
import { createCLI, setupStdioCommand, setupSSECommand } from './cli/setup.js';
import { handleStdioCommand } from './cli/stdio-command.js';
import { handleSSECommand } from './cli/sse-command.js';
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
const isMainModule = process.argv[1] && 
  (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || 
   import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')) ||
   import.meta.url.includes('dist/index.js'));

if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error);
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
