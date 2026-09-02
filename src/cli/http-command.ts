import type { Logger as WinstonLoggerType } from 'winston';
import type { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { DebugMcpServer } from '../server.js';
import { attachSharedFileTransport } from '../utils/logger.js';
import { SSEOptions } from './setup.js';
import { watchStdinForParentExit } from './stdin-watchdog.js';
import type { ProcessLike } from '../interfaces/process-interfaces.js';

export interface ServerFactoryOptions {
  logLevel?: string;
  logFile?: string;
}

export interface HttpCommandDependencies {
  logger: WinstonLoggerType;
  serverFactory: (options: ServerFactoryOptions) => DebugMcpServer;
  exitProcess?: (code: number) => void;
  /** Injectable stdin for tests; defaults to proc.stdin. */
  stdin?: NodeJS.ReadStream;
  /** Injectable process handle for signals/env/exit (issue #183); defaults to the global process. */
  proc?: ProcessLike;
}

interface SessionData {
  transport: StreamableHTTPServerTransport;
  server: DebugMcpServer;
  /** Timestamp of the last routed request (or stream close) for this session. */
  lastActivity: number;
  /** Open SSE (GET) streams; a session with a live stream is never idle. */
  openStreams: number;
  /**
   * Whether the client ever held a GET stream. A client that had one and lost
   * it without coming back is presumed dead far sooner than one that never
   * opened a stream at all (issue #658).
   */
  hadStream: boolean;
}

/** Idle window before a streamless HTTP session is reaped (issue #337). */
const DEFAULT_STALE_SESSION_MS = 30 * 60 * 1000;
/**
 * Idle window before a session whose SSE stream dropped and never returned is
 * reaped (issue #658). The SDK client re-opens a lost stream within seconds
 * (three attempts, ~1s apart), and a load balancer that cuts idle streams sees
 * the same immediate reconnect, so a session that is still streamless — and
 * has sent nothing — this long after losing its stream belongs to a client
 * that is gone.
 */
const DEFAULT_STREAM_LOST_SESSION_MS = 2 * 60 * 1000;
const DEFAULT_STALE_SWEEP_INTERVAL_MS = 60 * 1000;

function parseNonNegativeMs(
  name: string,
  raw: string | undefined,
  fallback: number,
  logger: WinstonLoggerType
): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    logger.warn(`Ignoring invalid ${name} value "${raw}"; using default ${fallback}ms.`);
    return fallback;
  }
  return parsed;
}

function parseStaleSessionMs(raw: string | undefined, logger: WinstonLoggerType): number {
  return parseNonNegativeMs('MCP_HTTP_STALE_SESSION_MS', raw, DEFAULT_STALE_SESSION_MS, logger);
}

function parseStreamLostSessionMs(raw: string | undefined, logger: WinstonLoggerType): number {
  return parseNonNegativeMs('MCP_HTTP_STREAM_LOST_SESSION_MS', raw, DEFAULT_STREAM_LOST_SESSION_MS, logger);
}

/**
 * Why the sweep is reaping a session, or undefined to leave it alone. Two
 * windows apply, both measured from the last request or stream close:
 * - a session that once held a GET stream and has been streamless since
 *   longer than streamLostMs (issue #658) — its client's death was observed;
 * - any streamless session idle longer than staleMs (issue #337) — the
 *   pure-POST fallback, where liveness is unobservable.
 * A window of 0 disables that path.
 * @internal exported for the reaper tests.
 */
export function classifyIdleSession(
  session: Pick<SessionData, 'openStreams' | 'hadStream' | 'lastActivity'>,
  now: number,
  windows: { staleMs: number; streamLostMs: number }
): 'stream-lost' | 'stale' | undefined {
  if (session.openStreams > 0) {
    return undefined;
  }
  const idleMs = now - session.lastActivity;
  if (session.hadStream && windows.streamLostMs > 0 && idleMs > windows.streamLostMs) {
    return 'stream-lost';
  }
  if (windows.staleMs > 0 && idleMs > windows.staleMs) {
    return 'stale';
  }
  return undefined;
}

/**
 * Sweep cadence override (issue #502): lets tests exercise the reap path in
 * seconds instead of the 60s production default. Disabling the reaper stays
 * the job of MCP_HTTP_STALE_SESSION_MS=0, so only positive values are valid.
 */
function parseSweepIntervalMs(raw: string | undefined, logger: WinstonLoggerType): number {
  if (raw === undefined || raw === '') {
    return DEFAULT_STALE_SWEEP_INTERVAL_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger.warn(`Ignoring invalid MCP_HTTP_STALE_SWEEP_INTERVAL_MS value "${raw}"; using default ${DEFAULT_STALE_SWEEP_INTERVAL_MS}ms.`);
    return DEFAULT_STALE_SWEEP_INTERVAL_MS;
  }
  return parsed;
}

export function createHttpApp(
  options: SSEOptions,
  dependencies: HttpCommandDependencies
): Express {
  const { logger, serverFactory } = dependencies;
  const proc = dependencies.proc ?? process;

  // createMcpExpressApp wires hostHeaderValidation for localhost binds
  const app = createMcpExpressApp();

  const httpSessions = new Map<string, SessionData>();

  // Reap crash-abandoned sessions (issue #337): a client that dies without
  // DELETE leaves its transport registered forever — transport.onclose only
  // fires on explicit close — so its DebugMcpServer and every proxy chain
  // (including lldb-server's ptrace claim on an attach target, or a paused
  // attach target itself) stay alive, invisible to the reconnecting client's
  // fresh session. Sessions holding a live SSE stream are never reaped. A
  // session whose stream dropped and never came back is reaped after
  // MCP_HTTP_STREAM_LOST_SESSION_MS (default 2 min; issue #658) — the SDK
  // client keeps a GET stream open, so its death is observed the moment the
  // socket closes and need not wait out the long window. A pure-POST client,
  // whose liveness is unobservable, is reaped only after
  // MCP_HTTP_STALE_SESSION_MS (default 30 min). 0 disables either path. Both
  // close the transport through the normal onclose path, which stops its
  // server and debug sessions.
  const staleSessionMs = parseStaleSessionMs(proc.env.MCP_HTTP_STALE_SESSION_MS, logger);
  const streamLostSessionMs = parseStreamLostSessionMs(proc.env.MCP_HTTP_STREAM_LOST_SESSION_MS, logger);
  const staleSweepIntervalMs = parseSweepIntervalMs(proc.env.MCP_HTTP_STALE_SWEEP_INTERVAL_MS, logger);
  let staleSweepTimer: NodeJS.Timeout | undefined;
  if (staleSessionMs > 0 || streamLostSessionMs > 0) {
    const windows = { staleMs: staleSessionMs, streamLostMs: streamLostSessionMs };
    staleSweepTimer = setInterval(() => {
      const now = Date.now();
      for (const [sid, session] of httpSessions) {
        const verdict = classifyIdleSession(session, now, windows);
        if (!verdict) {
          continue;
        }
        const idleSeconds = Math.round((now - session.lastActivity) / 1000);
        const held = session.server.sessionManager.getAllSessions()
          .map((debugSession) => `${debugSession.id} (${debugSession.language}, ${debugSession.state})`);
        const holding = held.length > 0 ? `; holding debug session(s) ${held.join(', ')}` : '';
        if (verdict === 'stream-lost') {
          logger.warn(
            `Reaping HTTP session ${sid}: its SSE stream closed ${idleSeconds}s ago and the client neither reconnected nor sent a request (MCP_HTTP_STREAM_LOST_SESSION_MS=${streamLostSessionMs})${holding}.`
          );
        } else {
          logger.warn(`Reaping stale HTTP session ${sid} (idle ${idleSeconds}s, no open streams)${holding}.`);
        }
        try {
          void session.transport.close();
        } catch (err) {
          logger.error(`Error closing stale HTTP session ${sid}`, { error: err });
        }
      }
    }, staleSweepIntervalMs);
    staleSweepTimer.unref?.();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).staleSweepTimer = staleSweepTimer;

  // CORS — Mcp-Session-Id and last-event-id must be exposed for the MCP Inspector
  // and for clients to read the session ID from the Initialize response.
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-Id'
    );
    res.header(
      'Access-Control-Expose-Headers',
      'Mcp-Session-Id, Last-Event-Id, Mcp-Protocol-Version'
    );
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  app.use(express.json({ limit: '10mb' }));

  const handleMcpRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionIdHeader = req.headers['mcp-session-id'];
      const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;

      let transport: StreamableHTTPServerTransport;

      if (sessionId && httpSessions.has(sessionId)) {
        // Existing session — route to its transport
        const session = httpSessions.get(sessionId)!;
        session.lastActivity = Date.now();
        if (req.method === 'GET') {
          // A live SSE stream marks the session as attended; the socket
          // closing (client crash included) is observed immediately.
          session.openStreams++;
          session.hadStream = true;
          res.on('close', () => {
            session.openStreams = Math.max(0, session.openStreams - 1);
            session.lastActivity = Date.now();
            if (session.openStreams === 0) {
              logger.debug(`HTTP session ${sessionId} lost its last SSE stream; reaping in ${streamLostSessionMs}ms unless it returns.`);
            }
          });
        }
        transport = session.transport;
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        // New session — spin up an isolated DebugMcpServer + transport
        const newDebugServer = serverFactory({
          logLevel: options.logLevel,
          logFile: options.logFile,
        });
        await newDebugServer.start();

        // Forward declarations so the closures below can refer to the transport.
        // The SDK assigns its own internal sessionId before invoking onsessioninitialized.
        let createdTransport: StreamableHTTPServerTransport | null = null;

        const newTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid: string) => {
            if (createdTransport) {
              httpSessions.set(sid, {
                transport: createdTransport,
                server: newDebugServer,
                lastActivity: Date.now(),
                openStreams: 0,
                hadStream: false,
              });
              logger.info(`HTTP session initialized: ${sid}`);
            }
          },
        });
        createdTransport = newTransport;

        newTransport.onclose = () => {
          const sid = newTransport.sessionId;
          if (!sid) return;
          const session = httpSessions.get(sid);
          if (!session) return;
          httpSessions.delete(sid);
          logger.info(`HTTP session closed: ${sid}`);
          session.server.stop().catch((err) => {
            logger.error(`Error stopping debug server for session ${sid}:`, err);
          });
        };

        newTransport.onerror = (error: Error) => {
          const sid = newTransport.sessionId ?? '<pre-init>';
          logger.error(`HTTP transport error for session ${sid}`, error);
        };

        await newDebugServer.server.connect(newTransport);
        transport = newTransport;
      } else {
        logger.warn('Rejecting MCP request: missing or unknown session ID', {
          method: req.method,
          hasSessionId: !!sessionId,
          isInit: req.method === 'POST' && isInitializeRequest(req.body),
        });
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Bad Request: missing or unknown Mcp-Session-Id, and this is not an initialize request',
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req as IncomingMessage, res as ServerResponse, req.body);
    } catch (error) {
      logger.error('Error handling MCP request', { error });
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : 'Unknown error',
          },
          id: null,
        });
      }
    }
  };

  app.post('/mcp', handleMcpRequest);
  app.get('/mcp', handleMcpRequest);
  app.delete('/mcp', handleMcpRequest);

  // /health names what each HTTP session holds (issue #658): an orphaned
  // session's debug sessions are invisible to every other MCP client, so
  // this is the operator's only view of a paused attach target short of ps.
  app.get('/health', (_req: Request, res: Response) => {
    const now = Date.now();
    res.json({
      status: 'ok',
      mode: 'http',
      connections: httpSessions.size,
      sessions: Array.from(httpSessions.keys()),
      details: Array.from(httpSessions, ([id, session]) => ({
        id,
        openStreams: session.openStreams,
        streamLost: session.hadStream && session.openStreams === 0,
        idleMs: now - session.lastActivity,
        debugSessions: session.server.sessionManager.getAllSessions().map((debugSession) => ({
          id: debugSession.id,
          name: debugSession.name,
          language: debugSession.language,
          state: debugSession.state,
        })),
      })),
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).httpSessions = httpSessions;

  return app;
}

export async function handleHttpCommand(
  options: SSEOptions,
  dependencies: HttpCommandDependencies
): Promise<void> {
  const proc = dependencies.proc ?? process;
  const { logger, exitProcess = (code: number) => proc.exit(code) } = dependencies;

  if (options.logLevel) {
    logger.level = options.logLevel;
  }
  if (options.logFile) {
    // The CLI logger predates option parsing, so --log-file never reached it;
    // with console silenced in http mode that made this module's lines (the
    // stale-session reaper's especially) invisible in the operator's log
    // (issue #502).
    attachSharedFileTransport(logger, options.logFile);
  }

  const port = parseInt(options.port, 10);
  logger.info(`Starting Debug MCP Server in HTTP (Streamable HTTP) mode on port ${port}`);

  try {
    const app = createHttpApp(options, dependencies);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const httpSessions = (app as any).httpSessions as Map<string, SessionData>;

    const server = app.listen(port, () => {
      logger.info(`Debug MCP Server (HTTP) listening on port ${port}`);
      logger.info(`MCP endpoint available at http://localhost:${port}/mcp`);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use. Another instance may be running.`);
      } else {
        logger.error(`Server error: ${err.message}`);
      }
      exitProcess(1);
    });

    let shutdownStarted = false;
    const gracefulShutdown = async () => {
      // Idempotent: stdin end/close and signals may all fire for one shutdown
      if (shutdownStarted) return;
      shutdownStarted = true;
      logger.info('Shutting down HTTP server...');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const staleSweepTimer = (app as any).staleSweepTimer as NodeJS.Timeout | undefined;
      if (staleSweepTimer) {
        clearInterval(staleSweepTimer);
      }

      // Hard-exit fallback (issue #337): server.close() waits on open
      // sockets and a wedged proxy can stall stop() — once shutdown has
      // begun, the process must not park forever holding live proxy chains.
      const hardExit = setTimeout(() => {
        logger.error('Graceful shutdown timed out; forcing exit.');
        exitProcess(1);
      }, 15000);
      hardExit.unref?.();

      // Close every active transport and stop its DebugMcpServer, bounded
      // so one wedged session cannot stall the whole shutdown.
      const stopWork = (async () => {
        for (const { transport, server: debugServer } of httpSessions.values()) {
          try {
            await transport.close();
          } catch (err) {
            logger.error('Error closing transport during shutdown', { error: err });
          }
          try {
            await debugServer.stop();
          } catch (err) {
            logger.error('Error stopping debug server during shutdown', { error: err });
          }
        }
      })();
      const guard = new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 10000);
        timer.unref?.();
      });
      await Promise.race([stopWork, guard]);
      httpSessions.clear();

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
    logger.error('Failed to start server in HTTP mode', { error });
    exitProcess(1);
  }
}
