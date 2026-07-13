import type { Logger as WinstonLoggerType } from 'winston';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DebugMcpServer } from '../server.js';
import { StdioOptions } from './setup.js';
import type { ProcessLike } from '../interfaces/process-interfaces.js';

export interface ServerFactoryOptions {
  logLevel?: string;
  logFile?: string;
}

export interface StdioCommandDependencies {
  logger: WinstonLoggerType;
  serverFactory: (options: ServerFactoryOptions) => DebugMcpServer;
  exitProcess?: (code: number) => void;
  /** Injectable stdin for tests; defaults to proc.stdin. */
  stdin?: NodeJS.ReadStream;
  /** Injectable process handle for signals/env/exit diagnostics (issue #183); defaults to the global process. */
  proc?: ProcessLike;
}

export async function handleStdioCommand(
  options: StdioOptions,
  dependencies: StdioCommandDependencies
): Promise<void> {
  const proc = dependencies.proc ?? process;
  const { logger, serverFactory, exitProcess = (code: number) => proc.exit(code) } = dependencies;
  
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
    // NOTE: `onclose` relies on an undocumented MCP SDK property
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
    const stdin: NodeJS.ReadableStream = dependencies.stdin ?? proc.stdin;
    stdin.resume();

    // Stdin EOF means the MCP client is gone — exit so we don't leak as an
    // orphan (issue #122; on Windows a dying parent delivers no signal, and
    // the SDK transport never notices EOF).
    // Exception: container mode (MCP_CONTAINER=true), where stdin may close
    // unexpectedly in detached `docker run` setups and the server must stay
    // alive; rely on transport close or signals there (see c251b3ff).
    stdin.on('end', () => {
      if (proc.env.MCP_CONTAINER === 'true') {
        logger.warn('[MCP] Stdin ended; ignoring in container mode and waiting for transport close or signal.');
        return;
      }
      logger.warn('[MCP] Stdin ended; MCP client disconnected — exiting.');
      try { clearInterval(keepAlive); } catch { /* already cleared */ }
      exitProcess(0);
    });

    // Add robust exit/signal diagnostics (logged to file; console output is silenced for protocol safety)
    proc.on('SIGTERM', () => {
      logger.warn('[MCP] SIGTERM received, exiting.');
      try { clearInterval(keepAlive); } catch {}
      exitProcess(0);
    });
    proc.on('SIGINT', () => {
      logger.warn('[MCP] SIGINT received, exiting.');
      try { clearInterval(keepAlive); } catch {}
      exitProcess(0);
    });
    proc.on('exit', (code) => {
      logger.error('[MCP] Process exiting', {
        code,
        argv: proc.argv,
        env_console_silenced: proc.env.CONSOLE_OUTPUT_SILENCED,
        uptime: proc.uptime()
      });
    });
  } catch (error) {
    logger.error('Failed to start server in stdio mode', { error });
    // When console output is silenced we must not write to console as it corrupts transports
    exitProcess(1);
  }
}
