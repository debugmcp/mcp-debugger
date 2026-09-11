import type { Logger as WinstonLoggerType } from 'winston';
import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { IncomingMessage, ServerResponse } from 'http';
import { DebugMcpServer } from '../server.js';
import { attachSharedFileTransport } from '../utils/logger.js';
import { SSEOptions } from './setup.js';
import { watchStdinForParentExit } from './stdin-watchdog.js';
import type { ProcessLike } from '../interfaces/process-interfaces.js';
import {
  ALLOWED_HOST_FLAG,
  ALLOWED_HOSTS_ENV_KEY,
  hostAllowlistMiddleware,
  LOOPBACK_HOSTS,
  parseAllowedHosts
} from './host-allowlist.js';
import { reportFatal } from './report-fatal.js';
import { resolvePort } from './port.js';
import { StartupRefusalError } from './startup-refusal.js';
import {
  announceListening,
  bindNotice,
  describeListenError,
  resolveBindAddress,
  type ListeningEndpoint,
  type ResolvedBindAddress,
} from './bind-address.js';

export interface ServerFactoryOptions {
  logLevel?: string;
  logFile?: string;
}

export interface SSECommandDependencies {
  logger: WinstonLoggerType;
  serverFactory: (options: ServerFactoryOptions) => DebugMcpServer;
  exitProcess?: (code: number) => void;
  /** Injectable stdin for tests; defaults to proc.stdin. */
  stdin?: NodeJS.ReadStream;
  /** Injectable process handle for signals/env/exit (issue #183); defaults to the global process. */
  proc?: ProcessLike;
}

interface SessionData {
  transport: SSEServerTransport;
  isClosing?: boolean;
}

export function createSSEApp(
  options: SSEOptions,
  dependencies: SSECommandDependencies
): express.Application {
  const { logger, serverFactory } = dependencies;
  const proc = dependencies.proc ?? process;

  // The same Host/Origin allowlist the Streamable HTTP app runs first (issues
  // #667/#677): a deprecated transport is still a shipped one, and this
  // server spawns processes, attaches to PIDs and evaluates expressions
  // (issue #671). Runs before CORS and every route, so a rejected request is
  // never handled. Throws AllowedHostError for an unusable entry —
  // handleSSECommand turns that into a named startup failure.
  const { hosts: allowedHosts, warnings: allowedHostWarnings } = parseAllowedHosts(
    options.allowedHost,
    proc.env[ALLOWED_HOSTS_ENV_KEY]
  );
  const app = express();
  app.use(hostAllowlistMiddleware(allowedHosts, logger));
  for (const warning of allowedHostWarnings) {
    logger.warn(warning);
  }
  if (allowedHosts.length > LOOPBACK_HOSTS.length) {
    logger.info(
      `SSE Host allowlist extended beyond loopback: ${allowedHosts.join(', ')} ` +
        `(from ${ALLOWED_HOST_FLAG} / ${ALLOWED_HOSTS_ENV_KEY}); this assumes another access control fronts the server.`
    );
  }

  // Bind address (issue #680) and port (issue #689): resolved here, beside the
  // allowlist and before any debug server is built, so an unusable value is
  // refused by name with nothing to tear down; /health reports them and
  // handleSSECommand listens on them. `listening` is overwritten from
  // server.address() once the socket is bound.
  const bind = resolveBindAddress(options.bind, proc.env);
  const listening: ListeningEndpoint = { address: bind.address, port: resolvePort(options.port) };

  // Create a single shared Debug MCP Server instance for all connections
  const sharedDebugServer = serverFactory({
    logLevel: options.logLevel,
    logFile: options.logFile,
  });
  logger.info('Created shared Debug MCP Server instance for SSE mode');

  // Store active SSE transports by session ID
  const sseTransports = new Map<string, SessionData>();

  // CORS middleware
  app.use((req, res, next) => {
    // A request carrying an Origin has already passed the allowlist above:
    // echo that origin (and Vary on it) instead of granting every origin
    // (issue #677 parity).
    const origin = req.headers.origin;
    res.header('Access-Control-Allow-Origin', origin ?? '*');
    if (origin !== undefined) {
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // SSE endpoint - for server-to-client messages
  app.get('/sse', async (req, res) => {
    try {
      // Block EventSource phantom reconnection: eventsource@4.0.0 auto-reconnects
      // ~3s after initial connection when the SSE stream reader returns done.
      // This creates a 2nd session that overwrites Protocol._transport, so responses
      // to the 1st session are lost and tool calls timeout.
      // Returning 204 causes EventSource to permanently close (per SSE spec).
      if (sharedDebugServer.server.transport) {
        logger.info('Blocking phantom SSE reconnection (returning 204)');
        res.status(204).end();
        return;
      }

      // Create SSE transport with the response object
      const transport = new SSEServerTransport('/sse', res as ServerResponse);

      // Connect the shared server to the transport (this automatically calls start())
      await sharedDebugServer.server.connect(transport);

      // Store the transport by session ID
      const sessionId = transport.sessionId;
      const sessionData: SessionData = { transport, isClosing: false };
      sseTransports.set(sessionId, sessionData);

      logger.info(`SSE connection established: ${sessionId}`);
      
      // Keep the connection alive with periodic pings
      const pingInterval = setInterval(() => {
        if (!sseTransports.has(sessionId)) {
          clearInterval(pingInterval);
          return;
        }
        res.write(':ping\n\n');
      }, 30000); // Every 30 seconds
      
      // Handle connection close with guard against infinite recursion
      const closeHandler = () => {
        const session = sseTransports.get(sessionId);
        if (!session || session.isClosing) {
          return; // Already closing or doesn't exist
        }
        
        session.isClosing = true;
        logger.info(`SSE connection closed: ${sessionId}`);
        
        // Clean up ping interval
        clearInterval(pingInterval);
        
        // Remove from map first to prevent any further operations
        sseTransports.delete(sessionId);
        
        // Clean up only the transport, NOT the shared server
        // The shared server persists across connections
        logger.info(`SSE transport cleaned up for session ${sessionId}. Debug sessions remain active.`);
      };
      
      transport.onclose = closeHandler;
      
      // Also handle client disconnect
      req.on('close', closeHandler);
      req.on('end', closeHandler);
      
      // Handle errors
      transport.onerror = (error) => {
        logger.error(`SSE transport error for session ${sessionId}:`, error);
      };
      
    } catch (error) {
      logger.error('Error establishing SSE connection:', error);
      if (!res.headersSent) {
        res.status(500).end();
      }
    }
  });

  // POST endpoint - for client-to-server messages
  app.post('/sse', async (req, res) => {
    try {
      // Extract session ID from query parameter (as per MCP SDK SSE protocol)
      const sessionId = req.query.sessionId as string;
      
      if (!sessionId || !sseTransports.has(sessionId)) {
        logger.warn(`Invalid session ID: ${sessionId}`, { 
          headers: req.headers,
          query: req.query,
          hasSessionId: !!sessionId,
          knownSessions: Array.from(sseTransports.keys())
        });
        res.status(400).json({ 
          jsonrpc: '2.0',
          error: { 
            code: -32600,
            message: 'Invalid session ID' 
          },
          id: null
        });
        return;
      }
      
      const { transport } = sseTransports.get(sessionId)!;
      
      // Handle the POST message through the transport
      await transport.handlePostMessage(req as IncomingMessage, res as ServerResponse);
      
    } catch (error) {
      logger.error('Error handling SSE POST request', { error });
      res.status(500).json({ 
        jsonrpc: '2.0',
        error: { 
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        },
        id: null
      });
    }
  });

  // Add a simple health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      mode: 'sse',
      listening: { ...listening },
      connections: sseTransports.size,
      sessions: Array.from(sseTransports.keys())
    });
  });

  // Expose the transports map and shared server for graceful shutdown
  (app as any).sseTransports = sseTransports; // eslint-disable-line @typescript-eslint/no-explicit-any
  (app as any).bindAddress = bind; // eslint-disable-line @typescript-eslint/no-explicit-any
  (app as any).listening = listening; // eslint-disable-line @typescript-eslint/no-explicit-any
  (app as any).sharedDebugServer = sharedDebugServer; // eslint-disable-line @typescript-eslint/no-explicit-any

  return app;
}

export async function handleSSECommand(
  options: SSEOptions,
  dependencies: SSECommandDependencies
): Promise<void> {
  const proc = dependencies.proc ?? process;
  const { logger, exitProcess = (code: number) => proc.exit(code) } = dependencies;
  
  if (options.logLevel) {
    logger.level = options.logLevel;
  }
  if (options.logFile) {
    // The CLI logger is created before option parsing. Attach the requested
    // shared transport before this module's first warning so its lifecycle
    // lines land beside the DebugMcpServer logs (issue #533).
    attachSharedFileTransport(logger, options.logFile);
  }
  
  try {
    // The factory resolves --port (issue #689) beside --bind and the allowlist,
    // before the shared debug server is built, so an unusable value is
    // refused by name with nothing announced and nothing to tear down.
    const app = createSSEApp(options, dependencies);

    const sharedDebugServer = (app as any).sharedDebugServer as DebugMcpServer; // eslint-disable-line @typescript-eslint/no-explicit-any
    const bind = (app as any).bindAddress as ResolvedBindAddress; // eslint-disable-line @typescript-eslint/no-explicit-any
    const listening = (app as any).listening as ListeningEndpoint; // eslint-disable-line @typescript-eslint/no-explicit-any
    // The requested port; `listening` is rewritten from the bound socket later.
    const port = listening.port;
    logger.warn(
      `SSE transport is deprecated and will be removed in a future release. ` +
        `Switch to: mcp-debugger http -p ${port}`
    );
    logger.info(`Starting Debug MCP Server in SSE mode on port ${port}`);

    // Start the shared debug server (mirrors stdio-command.ts startup)
    await sharedDebugServer.start();

    if (bind.note) {
      logger.info(bind.note);
    }
    const notice = bindNotice(bind, proc.env);
    if (notice?.level === 'warn') {
      logger.warn(notice.message);
    } else if (notice) {
      logger.info(notice.message);
    }
    const server = app.listen(port, bind.address);
    // /health and the startup lines report what the socket actually bound —
    // for -p 0 the OS-assigned port (issue #689). Registered after listen()
    // returns: Node emits 'listening' on a later tick, so `server` is assigned.
    server.on('listening', () => announceListening(server, listening, { logger, proc, label: 'SSE', path: '/sse' }));

    server.on('error', (err: NodeJS.ErrnoException) => {
      const line = describeListenError(err, port, bind);
      logger.error(line);
      reportFatal(proc, line);
      exitProcess(1);
    });

    // Handle graceful shutdown
    let shutdownStarted = false;
    const gracefulShutdown = async () => {
      // Idempotent: stdin end/close and signals may all fire for one shutdown
      if (shutdownStarted) return;
      shutdownStarted = true;
      logger.info('Shutting down SSE server...');

      // Hard-exit fallback (issue #337): a wedged proxy can stall stop() and
      // server.close() waits on open sockets — once shutdown has begun, the
      // process must not park forever holding live proxy chains.
      const hardExit = setTimeout(() => {
        logger.error('Graceful shutdown timed out; forcing exit.');
        exitProcess(1);
      }, 15000);
      hardExit.unref?.();

      // Close all SSE connections
      const sseTransports = (app as any).sseTransports as Map<string, SessionData> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (sseTransports) {
        sseTransports.forEach(({ transport }) => {
          transport.close();
        });
      }

      // Stop the shared debug server, bounded so it cannot stall shutdown
      const sharedDebugServer = (app as any).sharedDebugServer as DebugMcpServer | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (sharedDebugServer) {
        logger.info('Stopping shared Debug MCP Server...');
        const guard = new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 10000);
          timer.unref?.();
        });
        try {
          await Promise.race([sharedDebugServer.stop(), guard]);
        } catch (error) {
          logger.error('Error stopping shared Debug MCP Server:', error);
        }
      }

      server.close(() => {
        clearTimeout(hardExit);
        exitProcess(0);
      });
    };

    proc.on('SIGINT', gracefulShutdown);
    proc.on('SIGTERM', gracefulShutdown);

    // Orphan self-defense (issue #122): when spawned by a supervisor with
    // MCP_EXIT_ON_STDIN_CLOSE=1 and a stdin pipe, shut down gracefully if
    // that pipe closes (supervisor died or asked us to stop). Strictly
    // opt-in — standalone/detached servers are unaffected.
    watchStdinForParentExit({
      stdin: dependencies.stdin ?? proc.stdin,
      logger,
      shutdown: gracefulShutdown,
      exitProcess,
      env: proc.env,
    });
  } catch (error) {
    if (error instanceof StartupRefusalError) {
      // Fail fast and by name (--allowed-host, --bind, --port; issue #667): a
      // silently dropped value would reproduce the discoverability problem
      // each flag exists to fix.
      const line = `${error.message}. The server was not started.`;
      logger.error(line);
      reportFatal(proc, line);
    } else {
      logger.error('Failed to start server in SSE mode', { error });
      reportFatal(proc, 'Failed to start server in SSE mode', error instanceof Error ? error.message : String(error));
    }
    exitProcess(1);
  }
}
