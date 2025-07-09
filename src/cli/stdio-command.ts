import type { Logger as WinstonLoggerType } from 'winston';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DebugMcpServer } from '../server.js';
import { StdioOptions } from './setup.js';

export interface ServerFactoryOptions {
  logLevel?: string;
  logFile?: string;
}

export interface StdioCommandDependencies {
  logger: WinstonLoggerType;
  serverFactory: (options: ServerFactoryOptions) => DebugMcpServer;
  exitProcess?: (code: number) => void;
}

export async function handleStdioCommand(
  options: StdioOptions, 
  dependencies: StdioCommandDependencies
): Promise<void> {
  const { logger, serverFactory, exitProcess = process.exit } = dependencies;
  
  if (options.logLevel) {
    logger.level = options.logLevel;
  }
  
  logger.info('Starting Debug MCP Server in stdio mode');
  
  try {
    const debugMcpServer = serverFactory({
      logLevel: options.logLevel,
      logFile: options.logFile
    });
    
    // Create stdio transport
    logger.info('[MCP] Creating StdioServerTransport...');
    const transport = new StdioServerTransport();
    
    // Connect MCP server to transport
    logger.info('[MCP] Connecting server to stdio transport...');
    await debugMcpServer.server.connect(transport);
    logger.info('[MCP] Server connected to stdio transport successfully');
    
    // Start the debug server
    await debugMcpServer.start();
    logger.info('Server started successfully in stdio mode');
    
    // Add transport error handling
    transport.onerror = (error) => {
      logger.error('[MCP] Transport error:', { error });
    };
    
    // Keep the process alive
    process.stdin.resume();
  } catch (error) {
    logger.error('Failed to start server in stdio mode', { error });
    // In stdio mode, we must not write to console as it corrupts MCP protocol
    exitProcess(1);
  }
}
