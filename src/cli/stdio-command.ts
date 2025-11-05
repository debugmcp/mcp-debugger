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
    // Keep the event loop alive even if stdin closes (e.g., detached containers).
    // Cleared on transport close or signals.
    const keepAlive = setInterval(() => {}, 60000);
    
    // Connect MCP server to transport
    logger.info('[MCP] Connecting server to stdio transport...');
    await debugMcpServer.server.connect(transport);
    logger.info('[MCP] Server connected to stdio transport successfully');

    // Ensure deterministic shutdown on transport close
    const transportWithClose = transport as unknown as { onclose?: () => void };
    transportWithClose.onclose = () => {
      logger.warn('[MCP] Transport closed; exiting.');
      try { clearInterval(keepAlive); } catch {}
      exitProcess(0);
    };
    
    // Start the debug server
    await debugMcpServer.start();
    logger.info('Server started successfully in stdio mode');
    
    // Add transport error handling
    transport.onerror = (error) => {
      logger.error('[MCP] Transport error:', { error });
    };
    
    // Keep the process alive
    process.stdin.resume();

    // Exit policy for stdin end:
    // - If server hasn't started yet, do not exit immediately (wait to see if transport connects).
    // - If transport isn't connected, exit (no client will connect).
    // - If transport is connected, keep running (client controls lifecycle).
    // In containerized stdio mode, stdin may close unexpectedly.
    // Do not exit on stdin end; rely on transport close or signals for shutdown.
    process.stdin.on('end', () => {
      logger.warn('[MCP] Stdin ended; ignoring in stdio mode and waiting for transport close or signal.');
    });

    // Add robust exit/signal diagnostics (logged to file; console output is silenced for protocol safety)
    process.on('SIGTERM', () => {
      logger.warn('[MCP] SIGTERM received, exiting.');
      try { clearInterval(keepAlive); } catch {}
      exitProcess(0);
    });
    process.on('SIGINT', () => {
      logger.warn('[MCP] SIGINT received, exiting.');
      try { clearInterval(keepAlive); } catch {}
      exitProcess(0);
    });
    process.on('exit', (code) => {
      logger.error('[MCP] Process exiting', {
        code,
        argv: process.argv,
        env_console_silenced: process.env.CONSOLE_OUTPUT_SILENCED,
        uptime: process.uptime()
      });
    });
  } catch (error) {
    logger.error('Failed to start server in stdio mode', { error });
    // When console output is silenced we must not write to console as it corrupts transports
    exitProcess(1);
  }
}
