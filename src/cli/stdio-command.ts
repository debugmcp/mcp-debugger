import type { Logger as WinstonLoggerType } from 'winston';
import { serveStdio, StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { DebugMcpServer, type DebugMcpServerOptions } from '../server.js';
import { createProtocolServer } from '../server/protocol-facade.js';
import type { StdioOptions } from './setup.js';
import type { ProcessLike } from '../interfaces/process-interfaces.js';

export type ServerFactoryOptions = DebugMcpServerOptions;

/** The whole teardown's bound on exit: a wedged proxy cannot block the process from leaving. */
const SHUTDOWN_GUARD_MS = 5000;
/**
 * The serving handle's own bound inside that guard. Closing the handle ends an
 * open subscriptions/listen stream, which a consumer that stopped reading can
 * hold open; bounded on its own, the core's closeAllSessions() always gets its
 * turn (review of PR #1116).
 */
const HANDLE_CLOSE_TIMEOUT_MS = 1000;

function unrefDelay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

/**
 * The SDK's stdio transport closes itself — on stdin's EOF, but also on a
 * stdout error (the client's end of the pipe is gone) or an oversized frame,
 * with stdin still open — and tells only its own `onclose`, which `serveStdio`
 * owns. This subclass lets the command hear every close of the wire, whatever
 * ended it, so the process never lives on with a dead instance (issue #1025,
 * step 2; review of PR #1116).
 */
class ObservedStdioServerTransport extends StdioServerTransport {
  private notified = false;
  private readonly onWireClosed: () => void;

  constructor(onWireClosed: () => void) {
    super();
    this.onWireClosed = onWireClosed;
  }

  override async close(): Promise<void> {
    await super.close();
    if (this.notified) return;
    this.notified = true;
    this.onWireClosed();
  }
}

export interface StdioCommandDependencies {
  logger: WinstonLoggerType;
  serverFactory: (options: ServerFactoryOptions) => DebugMcpServer;
  /** Builds the SDK Server facade over the core (issue #1025, step 2); defaults to createProtocolServer. */
  protocolServerFactory?: typeof createProtocolServer;
  /** The SDK's stdio serving entry (issue #1025, step 2); defaults to the real one. */
  serveStdio?: typeof serveStdio;
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

    // Keep the event loop alive even if stdin closes (e.g., detached containers).
    // Cleared on shutdown.
    const keepAlive = setInterval(() => {}, 60000);

    // Every exit path must tear down the debug sessions first (issue #337):
    // exiting without DebugMcpServer.stop() → closeAllSessions() leaves the
    // proxy chains — and, for attach sessions, lldb-server's ptrace claim on
    // the target — running with no owner. The serving handle goes first so
    // an open subscriptions/listen stream ends gracefully, bounded on its own
    // so the core always gets its turn; the whole teardown is bounded so a
    // wedged proxy cannot block exit (ProxyManager.stop() is internally
    // bounded but runs serially per session). `serving.handle` is set once the
    // serving entry below has started; shutdown reads it at call time.
    const serving: { handle?: { close(): Promise<void> } } = {};
    let shutdownStarted = false;
    const shutdownAndExit = (code: number, why: string) => {
      if (shutdownStarted) return;
      shutdownStarted = true;
      try { clearInterval(keepAlive); } catch { /* already cleared */ }
      logger.warn(`[MCP] ${why} — stopping debug server and exiting.`);
      const guard = unrefDelay(SHUTDOWN_GUARD_MS);
      const teardown = (async () => {
        if (serving.handle) {
          try {
            const closing = serving.handle.close();
            // A rejection after the bound below has passed has nowhere to go.
            closing.catch(() => {});
            const closed = await Promise.race([
              closing.then(() => true),
              unrefDelay(HANDLE_CLOSE_TIMEOUT_MS).then(() => false)
            ]);
            if (!closed) {
              logger.debug(`[MCP] The stdio serving handle did not close within ${HANDLE_CLOSE_TIMEOUT_MS} ms; stopping the debug server anyway.`, { timeoutMs: HANDLE_CLOSE_TIMEOUT_MS });
            }
          } catch (err) {
            logger.debug('[MCP] Error closing the stdio serving handle during exit:', { err });
          }
        }
        try {
          await debugMcpServer.stop();
        } catch (err) {
          logger.error('[MCP] Error stopping debug server during exit:', { err });
        }
      })();
      void Promise.race([teardown, guard]).finally(() => exitProcess(code));
    };

    // Stdin is the MCP transport here, so any byte on it proves a client was
    // speaking to us — which makes a later EOF mean that client is gone.
    // Nothing else will reap us: on Windows a dying parent delivers no signal,
    // and `keepAlive` above holds the event loop open, so without this the
    // process runs forever (issue #122).
    let sawClientTraffic = false;

    // Container mode keeps one exception, and only one: `docker run` WITHOUT
    // -i, where stdin is already closed before any client speaks and the
    // server must stay alive anyway (c251b3ff, named in fa827ec2/#130).
    // Once traffic has been seen that case is ruled out, so EOF is a real
    // disconnect and the container must exit — otherwise `docker run --rm`
    // never fires and every session leaks a container (issue #633). The
    // transport closing the wire by itself goes through the same gate.
    const onWireGone = (reason: string, clientLeft: boolean): void => {
      // Reads MCP_CONTAINER directly on purpose: `proc` is the injected
      // ProcessLike this command is tested against, not an IEnvironment.
      if (proc.env.MCP_CONTAINER === 'true' && !sawClientTraffic) {
        logger.warn(`[MCP] ${reason} before any client traffic; detached container, staying alive.`);
        return;
      }
      shutdownAndExit(0, clientLeft ? `${reason}; MCP client disconnected` : reason);
    };

    // The exit line is what an operator reads to learn why the server went
    // away, so it says what is true rather than which listener ran first: only
    // a stdin that ended means the client left. The transport also closes the
    // wire by itself after a stdout error or an oversized frame, with the
    // client possibly still there — then the line names that error instead.
    const stdin: NodeJS.ReadableStream = dependencies.stdin ?? proc.stdin;
    let lastTransportError: Error | undefined;
    const onTransportClosed = (): void => {
      const { readableEnded, destroyed } = stdin as { readableEnded?: boolean; destroyed?: boolean };
      if (readableEnded || destroyed) {
        onWireGone('Stdin ended', true);
      } else if (lastTransportError) {
        onWireGone(`Stdio transport closed after an error (${lastTransportError.message})`, false);
      } else {
        onWireGone('Stdio transport closed', false);
      }
    };

    // Create stdio transport
    logger.info('[MCP] Creating StdioServerTransport...');
    const transport = new ObservedStdioServerTransport(onTransportClosed);

    // The SDK's stdio serving entry owns the wire and speaks both protocol
    // eras (issue #1025, step 2): the opening message pins one facade for the
    // connection — a 2026-07-28 client's server/discover lands on a modern
    // instance, a 2025 client's initialize on a legacy one — and the entry
    // itself answers server/discover and serves subscriptions/listen. The
    // factory may run twice: once for a discover probe that a client then
    // abandons for initialize, and once for the pinned instance.
    logger.info('[MCP] Serving stdio in both protocol eras...');
    const protocolServerFactory = dependencies.protocolServerFactory ?? createProtocolServer;
    const serve = dependencies.serveStdio ?? serveStdio;
    serving.handle = serve(
      ({ era }) => protocolServerFactory(debugMcpServer, { era, deliver: 'instance' }),
      {
        transport,
        onerror: (error: Error) => {
          lastTransportError = error;
          logger.error('[MCP] Transport error:', { error });
        }
      }
    );
    logger.info('[MCP] Server connected to stdio transport successfully');

    // Start the debug server
    await debugMcpServer.start();
    logger.info('Server started successfully in stdio mode');

    // Keep the process alive
    stdin.resume();

    // Additive: Node broadcasts each chunk to every 'data' listener and
    // stdin.resume() above already put the stream in flowing mode, so this
    // cannot starve StdioServerTransport's own reader.
    stdin.on('data', () => { sawClientTraffic = true; });

    // 'end' alone misses an abruptly dropped pipe. shutdownAndExit is
    // idempotent, so the usual end-then-close pair — and the transport's own
    // close on the same EOF — cost nothing.
    stdin.on('end', () => onWireGone('Stdin ended', true));
    stdin.on('close', () => onWireGone('Stdin closed', true));
    stdin.on('error', (error: Error) => onWireGone(`Stdin error (${error.message})`, true));

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
