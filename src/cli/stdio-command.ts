import type { Logger as WinstonLoggerType } from 'winston';
import { DebugMcpServer } from '../server.js';
import { StdioOptions } from './setup.js';

export interface StdioCommandDependencies {
  logger: WinstonLoggerType;
  serverFactory: (options: any) => DebugMcpServer;
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
    
    await debugMcpServer.start();
    logger.info('Server started successfully in stdio mode');
  } catch (error) {
    logger.error('Failed to start server in stdio mode', { error });
    exitProcess(1);
  }
}
