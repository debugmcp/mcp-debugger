import type { Logger as WinstonLoggerType } from 'winston';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { DebugMcpServer, type DebugMcpServerOptions } from '../server.js';
import { createProtocolServer } from '../server/protocol-facade.js';
import type { StdioOptions } from './setup.js';
import type { ProcessLike } from '../interfaces/process-interfaces.js';

export type ServerFactoryOptions = DebugMcpServerOptions;

export interface StdioCommandDependencies {
  logger: WinstonLoggerType;
  serverFactory: (options: ServerFactoryOptions) => DebugMcpServer;
  /** Builds the SDK Server facade over the core (issue #1025, step 2); defaults to createProtocolServer. */
  protocolServerFactory?: typeof createProtocolServer;
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
    
    // Connect a legacy-era protocol facade over the core to the transport
    // (issue #1025, step 2): the core owns no SDK Server of its own.
    logger.info('[MCP] Connecting server to stdio transport...');
    const protocolServerFactory = dependencies.protocolServerFactory ?? createProtocolServer;
    const facade = protocolServerFactory(debugMcpServer, { era: 'legacy', deliver: 'instance' });
    await facade.connect(transport);
    logger.info('[MCP] Server connected to stdio transport successfully');

    // Every exit path must tear down the debug sessions first (issue #337):
    // exiting without DebugMcpServer.stop() → closeAllSessions() leaves the
    // proxy chains — and, for attach sessions, lldb-server's ptrace claim on
    // the target — running with no owner. Bounded so a wedged proxy cannot
    // block exit (ProxyManager.stop() is internally bounded but runs
    // serially per session).
    let shutdownStarted = false;
    const shutdownAndExit = (code: number, why: string) => {
      if (shutdownStarted) return;
      shutdownStarted = true;
      try { clearInterval(keepAlive); } catch { /* already cleared */ }
      logger.warn(`[MCP] ${why} — stopping debug server and exiting.`);
      const guard = new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 5000);
        timer.unref?.();
      });
      void Promise.race([
        debugMcpServer.stop().catch((err) => {
          logger.error('[MCP] Error stopping debug server during exit:', { err });
        }),
        guard
      ]).finally(() => exitProcess(code));
    };

    // Ensure deterministic shutdown on transport close (the Transport
    // contract's own hook; the v1 SDK left it undocumented)
    transport.onclose = () => {
      shutdownAndExit(0, 'Transport closed');
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

    // Stdin is the MCP transport here, so any byte on it proves a client was
    // speaking to us — which makes a later EOF mean that client is gone.
    // Nothing else will reap us: on Windows a dying parent delivers no signal,
    // the SDK transport never notices EOF, and `keepAlive` above holds the
    // event loop open, so without this the process runs forever (issue #122).
    let sawClientTraffic = false;
    // Additive: Node broadcasts each chunk to every 'data' listener and
    // stdin.resume() above already put the stream in flowing mode, so this
    // cannot starve StdioServerTransport's own reader.
    stdin.on('data', () => { sawClientTraffic = true; });

    // Container mode keeps one exception, and only one: `docker run` WITHOUT
    // -i, where stdin is already closed before any client speaks and the
    // server must stay alive anyway (c251b3ff, named in fa827ec2/#130).
    // Once traffic has been seen that case is ruled out, so EOF is a real
    // disconnect and the container must exit — otherwise `docker run --rm`
    // never fires and every session leaks a container (issue #633).
    const onStdinGone = (reason: string): void => {
      // Reads MCP_CONTAINER directly on purpose: `proc` is the injected
      // ProcessLike this command is tested against, not an IEnvironment.
      if (proc.env.MCP_CONTAINER === 'true' && !sawClientTraffic) {
        logger.warn('[MCP] Stdin closed before any client traffic; detached container, staying alive.');
        return;
      }
      shutdownAndExit(0, reason);
    };

    // 'end' alone misses an abruptly dropped pipe. shutdownAndExit is
    // idempotent, so the usual end-then-close pair costs nothing.
    stdin.on('end', () => onStdinGone('Stdin ended; MCP client disconnected'));
    stdin.on('close', () => onStdinGone('Stdin closed; MCP client disconnected'));
    stdin.on('error', (error: Error) =>
      onStdinGone(`Stdin error (${error.message}); MCP client disconnected`));

    // Add robust exit/signal diagnostics (logged to file; console output is silenced for protocol safety)
    proc.on('SIGTERM', () => {
      shutdownAndExit(0, 'SIGTERM received');
    });
    proc.on('SIGINT', () => {
      shutdownAndExit(0, 'SIGINT received');
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
