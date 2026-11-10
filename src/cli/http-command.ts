import type { Logger as WinstonLoggerType } from 'winston';
import type { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { createMcpHandler, isInitializeRequest, isLegacyRequest, ProtocolErrorCode } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport, toNodeHandler, toWebRequest } from '@modelcontextprotocol/node';
import { DebugMcpServer, type DebugMcpServerOptions } from '../server.js';
import { createProtocolServer } from '../server/protocol-facade.js';
import { handlerSink } from '../server/notification-hub.js';
import { attachSharedFileTransport } from '../utils/logger.js';
import type { HttpOptions } from './setup.js';
import {
  ALLOWED_HOSTS_ENV_KEY,
  ALLOWED_HOST_FLAG,
  LOOPBACK_HOSTS,
  hostAllowlistMiddleware,
  parseAllowedHosts,
} from './host-allowlist.js';
import { reportFatal } from './report-fatal.js';
import {
  announceListening,
  bindNotice,
  describeListenError,
  resolveBindAddress,
  type ListeningEndpoint,
  type ResolvedBindAddress,
} from './bind-address.js';
import { jsonRpcErrorBody } from './json-rpc-error.js';
import { resolvePort } from './port.js';
import { StartupRefusalError } from './startup-refusal.js';
import { watchStdinForParentExit } from './stdin-watchdog.js';
import type { ProcessLike } from '../interfaces/process-interfaces.js';

export type ServerFactoryOptions = DebugMcpServerOptions;

export interface HttpCommandDependencies {
  logger: WinstonLoggerType;
  serverFactory: (options: ServerFactoryOptions) => DebugMcpServer;
  /** Builds the SDK Server facade over a core (issue #1025, step 2); defaults to createProtocolServer. */
  protocolServerFactory?: typeof createProtocolServer;
  exitProcess?: (code: number) => void;
  /** Injectable stdin for tests; defaults to proc.stdin. */
  stdin?: NodeJS.ReadStream;
  /** Injectable process handle for signals/env/exit (issue #183); defaults to the global process. */
  proc?: ProcessLike;
}

/**
 * One MCP (protocol-level) session of the 2025 era: a connection, not an
 * owner. Its SDK Server facade lives in the transport's onmessage closure and
 * leaves with it; the debug sessions it created belong to the one core
 * (issue #1025, step 2).
 */
interface SessionData {
  transport: NodeStreamableHTTPServerTransport;
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

/** Largest JSON-RPC request body accepted; also named in the 413 the parser answers with (issue #670). */
const JSON_BODY_LIMIT = '10mb';
/** The same limit in bytes, for the SDK's classifier and modern handler (their default is 4 MiB). */
const JSON_BODY_LIMIT_BYTES = 10 * 1024 * 1024;

/** A modern-era `subscriptions/listen` request: its response is a long-lived stream, so the process is attended while it is open. */
function isListenRequest(body: unknown): boolean {
  return typeof body === 'object' && body !== null && (body as { method?: unknown }).method === 'subscriptions/listen';
}

/** Idle window before a streamless HTTP session is reaped (issue #337). */
const DEFAULT_STALE_SESSION_MS = 30 * 60 * 1000;
/**
 * The per-debug-session idle policy's default on http (issue #1025, step 2):
 * a debug-session tree no tool call has named for this long is closed, unless
 * a client is attending the process. MCP_DEBUG_SESSION_IDLE_MS overrides it.
 */
const DEFAULT_DEBUG_SESSION_IDLE_MS = 30 * 60 * 1000;
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
  options: HttpOptions,
  dependencies: HttpCommandDependencies
): Express {
  const { logger, serverFactory } = dependencies;
  const protocolServerFactory = dependencies.protocolServerFactory ?? createProtocolServer;
  const proc = dependencies.proc ?? process;

  // The app is built here rather than with the SDK's createMcpExpressApp()
  // (issues #667, #670). That helper installs its own express.json() at the
  // 100 KB default ahead of everything else — so the 10 MB parser below was
  // never reached — and its Host check answers a fixed "Invalid Host: <name>"
  // that names neither the cause nor the remedy. The allowlist middleware
  // mirrors the SDK's comparison and runs first, so a rejected request is
  // never parsed (the order the SDK's own v1.x branch has since adopted).
  // Throws AllowedHostError for an unusable --allowed-host/env entry:
  // handleHttpCommand turns that into a named startup failure.
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
      `HTTP Host allowlist extended beyond loopback: ${allowedHosts.join(', ')} ` +
        `(from ${ALLOWED_HOST_FLAG} / ${ALLOWED_HOSTS_ENV_KEY}); this assumes another access control fronts the server.`
    );
  }

  // Bind address (issue #680) and port (issue #689): resolved here, beside the
  // allowlist, so /health can report what the operator exposed;
  // handleHttpCommand listens on them. Either throws a named error for an
  // unusable value — a named startup failure. `listening` is overwritten from
  // server.address() once the socket is bound, so an OS-assigned port (-p 0)
  // shows up too.
  const bind = resolveBindAddress(options.bind, proc.env);
  const listening: ListeningEndpoint = { address: bind.address, port: resolvePort(options.port) };

  const httpSessions = new Map<string, SessionData>();

  // One core for the process (issue #1025, step 2): the dependency container,
  // the SessionManager and every debug session, shared by every MCP session's
  // facade. Built here, after the refusal gates above, so a refused flag never
  // constructs one; handleHttpCommand starts it before listening.
  const core = serverFactory({
    logLevel: options.logLevel,
    logFile: options.logFile,
    debugSessionIdle: { defaultMs: DEFAULT_DEBUG_SESSION_IDLE_MS },
  });
  // The 2026-07-28 leg (issue #1025, step 2): the SDK's sessionless handler,
  // strict — a 2025-era request that reaches it is refused with the supported
  // versions — behind the request classifier in handleMcpRequest, which sends
  // 2025-shaped traffic to the sessionful app below. One facade per request,
  // delivering nothing itself: the handler's notifier is this leg's hub sink,
  // routing to the open subscriptions/listen streams. Host/Origin stay ours
  // (the allowlist middleware runs first); the body limit matches the parser's.
  const modern = createMcpHandler(
    ({ era }) => protocolServerFactory(core, { era, deliver: 'external' }),
    {
      legacy: 'reject',
      maxRequestBodySize: JSON_BODY_LIMIT_BYTES,
      onerror: (error: Error) => {
        logger.error('Modern-era MCP handler error', { error });
      },
    }
  );
  core.notifications.addSink(handlerSink(modern.notify));
  const modernNode = toNodeHandler(modern, {
    onerror: (error: Error) => {
      logger.error('Modern-era MCP request failed', { error });
    },
  });
  /** Requests served per era since start, for /health and the #1025 telemetry. */
  const requests = { legacy: 0, modern: 0 };
  /** Open modern subscriptions/listen streams (their responses are long-lived). */
  let modernListenStreams = 0;

  // While any client holds an open SSE stream — a 2025 session's GET stream or
  // a 2026 subscriptions/listen stream — the process is attended and the idle
  // policy closes nothing. One predicate for the supplier and /health.
  const attended = (): boolean => {
    if (modernListenStreams > 0) {
      return true;
    }
    for (const session of httpSessions.values()) {
      if (session.openStreams > 0) {
        return true;
      }
    }
    return false;
  };
  core.setAttendedSupplier(attended);

  // Reap crash-abandoned MCP sessions (issue #337): a client that dies without
  // DELETE leaves its transport registered forever — transport.onclose only
  // fires on explicit close — so its SSE stream bookkeeping and its SDK Server
  // facade would stay alive. Sessions holding a live SSE stream are never
  // reaped. A session whose stream dropped and never came back is reaped after
  // MCP_HTTP_STREAM_LOST_SESSION_MS (default 2 min; issue #658) — the SDK
  // client keeps a GET stream open, so its death is observed the moment the
  // socket closes and need not wait out the long window. A pure-POST client,
  // whose liveness is unobservable, is reaped only after
  // MCP_HTTP_STALE_SESSION_MS (default 30 min). 0 disables either path. Both
  // close the transport through the normal onclose path. The debug sessions
  // such a client created are the core's and answer to the per-debug-session
  // idle policy (MCP_DEBUG_SESSION_IDLE_MS), not to this sweep (issue #1025).
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
        if (verdict === 'stream-lost') {
          logger.warn(
            `Reaping HTTP session ${sid}: its SSE stream closed ${idleSeconds}s ago and the client neither reconnected nor sent a request (MCP_HTTP_STREAM_LOST_SESSION_MS=${streamLostSessionMs}).`
          );
        } else {
          logger.warn(`Reaping stale HTTP session ${sid} (idle ${idleSeconds}s, no open streams).`);
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
  // and for clients to read the session ID from the Initialize response. The
  // 2026-07-28 revision requires Mcp-Method and Mcp-Name on every POST and
  // mirrors tool parameters into Mcp-Param-* headers, so a browser preflight's
  // own requested headers are echoed back as allowed.
  app.use((req: Request, res: Response, next: NextFunction) => {
    // A request carrying an Origin has already passed the allowlist above:
    // echo that origin (and Vary on it) instead of granting every origin.
    const origin = req.headers.origin;
    res.header('Access-Control-Allow-Origin', origin ?? '*');
    if (origin !== undefined) {
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    const requestedHeaders = req.headers['access-control-request-headers'];
    const requested = Array.isArray(requestedHeaders) ? requestedHeaders.join(', ') : requestedHeaders;
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Mcp-Method, Mcp-Name, Last-Event-Id' +
        (requested ? `, ${requested}` : '')
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

  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  const handleMcpRequest = async (req: Request, res: Response): Promise<void> => {
    // Set when this request opens a new MCP session, so a handshake the SDK
    // refuses — or a transport fault during it — does not leave its transport
    // and facade behind (issue #1025).
    let opening: NodeStreamableHTTPServerTransport | undefined;
    try {
      const sessionIdHeader = req.headers['mcp-session-id'];
      const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;

      // Which era is this request? The SDK's own classifier decides (issue
      // #1025, step 2): a POST carrying the 2026 per-request envelope — or a
      // modern protocol header the strict handler must refuse — is the modern
      // leg's; anything 2025-shaped (initialize, a session id, GET, DELETE, a
      // claim-less POST) stays with the sessionful app below, unchanged. The
      // body Express already parsed is handed on so nothing re-reads the stream.
      const body = req.method === 'POST' ? req.body : undefined;
      const probe = await toWebRequest(req, body, { maxRequestBodySize: JSON_BODY_LIMIT_BYTES });
      if (!(await isLegacyRequest(probe, body, { maxRequestBodySize: JSON_BODY_LIMIT_BYTES }))) {
        requests.modern++;
        if (isListenRequest(body)) {
          modernListenStreams++;
          res.once('close', () => {
            modernListenStreams = Math.max(0, modernListenStreams - 1);
          });
        }
        await modernNode(req, res, body);
        return;
      }
      requests.legacy++;

      let transport: NodeStreamableHTTPServerTransport;

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
        // New MCP session: a legacy-era SDK Server facade over the one core
        // (issue #1025, step 2), connected to its own sessionful transport.
        const facade = protocolServerFactory(core, { era: 'legacy', deliver: 'instance' });

        // Forward declarations so the closures below can refer to the transport.
        // The SDK assigns its own internal sessionId before invoking onsessioninitialized.
        let createdTransport: NodeStreamableHTTPServerTransport | null = null;

        const newTransport = new NodeStreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid: string) => {
            if (createdTransport) {
              httpSessions.set(sid, {
                transport: createdTransport,
                lastActivity: Date.now(),
                openStreams: 0,
                hadStream: false,
              });
              logger.info(`HTTP session initialized: ${sid}`);
            }
          },
        });
        createdTransport = newTransport;

        // Set BEFORE facade.connect(): the SDK wraps a transport.onclose that
        // is already in place and then runs its own teardown, which is what
        // reaches server.onclose and detaches the facade's notification sink.
        // Assigning after connect() would replace that wrapper (issue #1025).
        // The debug sessions this client created live on in the core under the
        // idle policy; the MCP session was only a connection.
        newTransport.onclose = () => {
          const sid = newTransport.sessionId;
          if (!sid) return;
          if (!httpSessions.delete(sid)) return;
          logger.info(`HTTP session closed: ${sid}`);
        };

        newTransport.onerror = (error: Error) => {
          const sid = newTransport.sessionId ?? '<pre-init>';
          logger.error(`HTTP transport error for session ${sid}`, error);
        };

        await facade.connect(newTransport);
        transport = newTransport;
        opening = newTransport;
      } else if (sessionId) {
        logger.warn('Rejecting MCP request: unknown session ID', { method: req.method });
        res.status(404).json(jsonRpcErrorBody(-32001, 'Session not found'));
        return;
      } else {
        logger.warn('Rejecting MCP request: missing session ID', {
          method: req.method,
          hasSessionId: !!sessionId,
          isInit: req.method === 'POST' && isInitializeRequest(req.body),
        });
        res.status(400).json(
          jsonRpcErrorBody(
            ProtocolErrorCode.InvalidRequest,
            'Bad Request: missing Mcp-Session-Id, and this is not an initialize request'
          )
        );
        return;
      }

      await transport.handleRequest(req as IncomingMessage, res as ServerResponse, req.body);
    } catch (error) {
      logger.error('Error handling MCP request', { error });
      if (!res.headersSent) {
        res.status(500).json(
          jsonRpcErrorBody(ProtocolErrorCode.InternalError, 'Internal error', error instanceof Error ? error.message : 'Unknown error')
        );
      }
    } finally {
      if (opening && !opening.sessionId) {
        // The handshake did not complete (the SDK refused it, or the transport
        // threw): nothing registered this transport, so nothing would ever close
        // it. Closing it runs the facade's onclose chain and detaches its
        // notification sink from the process-wide hub.
        logger.debug('Closing the transport of an initialize that did not complete');
        await opening.close().catch((err: unknown) => {
          logger.debug('Error closing an uninitialized transport', { error: err });
        });
      }
    }
  };

  app.post('/mcp', handleMcpRequest);
  app.get('/mcp', handleMcpRequest);
  app.delete('/mcp', handleMcpRequest);

  // /health names every MCP session (a connection) and every debug session of
  // the process (issues #658, #1025): the operator's view of a paused attach
  // target short of ps, and of whether a client is attending.
  app.get('/health', (_req: Request, res: Response) => {
    const now = Date.now();
    const sessions = Array.from(httpSessions, ([id, session]) => ({
      id,
      openStreams: session.openStreams,
      streamLost: session.hadStream && session.openStreams === 0,
      idleMs: now - session.lastActivity,
    }));
    res.json({
      status: 'ok',
      mode: 'http',
      listening: { ...listening },
      connections: httpSessions.size,
      attended: attended(),
      listenStreams: modernListenStreams,
      requests: { ...requests },
      sessions: Array.from(httpSessions.keys()),
      details: sessions,
      debugSessions: core.sessionManager.getAllSessions().map((debugSession) => {
        const idleMs = core.sessionManager.idleMsOf(debugSession.id, now);
        return {
          id: debugSession.id,
          name: debugSession.name,
          language: debugSession.language,
          state: debugSession.state,
          ...(debugSession.parentSessionId ? { parentSessionId: debugSession.parentSessionId } : {}),
          ...(idleMs !== undefined ? { idleMs } : {}),
        };
      }),
    });
  });

  // An error reaching this point would otherwise fall through to Express's
  // HTML error page, which an MCP client cannot read (issue #670). Answer in
  // the JSON-RPC shape whatever the cause: body-parser tags its failures with
  // an HTTP status (a decompression failure carries no `type`, so the status
  // is the reliable discriminator); anything else is a server fault. Express
  // recognizes an error handler by its four parameters.
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const failure = classifyRequestError(err);
    if (failure.status >= 500) {
      logger.error(`Unhandled error on ${req.method} ${req.path}: ${failure.detail}`, { error: err });
    }
    res.status(failure.status).json(jsonRpcErrorBody(failure.code, failure.message));
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).httpSessions = httpSessions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).core = core;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).modernHandler = modern;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).bindAddress = bind;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).listening = listening;

  return app;
}

/** What to answer for an error that escaped the request pipeline (see the error handler above). */
function classifyRequestError(err: unknown): { status: number; code: number; message: string; detail: string } {
  const candidate = (typeof err === 'object' && err !== null ? err : {}) as {
    status?: unknown;
    type?: unknown;
    message?: unknown;
    expose?: unknown;
  };
  const detail = typeof candidate.message === 'string' ? candidate.message : String(err);
  const status =
    typeof candidate.status === 'number' && candidate.status >= 400 && candidate.status < 600 ? candidate.status : 500;
  if (status >= 500) {
    return { status, code: ProtocolErrorCode.InternalError, message: 'Internal error', detail };
  }
  if (candidate.type === 'entity.too.large') {
    return { status, code: ProtocolErrorCode.InvalidRequest, message: `Request body too large (limit ${JSON_BODY_LIMIT})`, detail };
  }
  if (candidate.type === 'entity.parse.failed') {
    return { status, code: ProtocolErrorCode.ParseError, message: `Parse error: ${detail}`, detail };
  }
  // http-errors marks 4xx messages as safe to expose; anything else stays generic.
  return { status, code: ProtocolErrorCode.InvalidRequest, message: candidate.expose === false ? 'Bad Request' : detail, detail };
}

export async function handleHttpCommand(
  options: HttpOptions,
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

  try {
    // The factory resolves --port (issue #689) beside --bind and the allowlist,
    // so an unusable value is refused by name before anything is announced.
    const app = createHttpApp(options, dependencies);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const httpSessions = (app as any).httpSessions as Map<string, SessionData>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (app as any).core as DebugMcpServer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modernHandler = (app as any).modernHandler as { close: () => Promise<void> };
    // The one core (issue #1025, step 2): started once, before anything can
    // reach it; its idle sweep is armed here.
    await core.start();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bind = (app as any).bindAddress as ResolvedBindAddress;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listening = (app as any).listening as ListeningEndpoint;
    // The requested port; `listening` is rewritten from the bound socket later.
    const port = listening.port;
    logger.info(`Starting Debug MCP Server in HTTP (Streamable HTTP) mode on port ${port}`);

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
    server.on('listening', () => announceListening(server, listening, { logger, proc, label: 'HTTP', path: '/mcp' }));

    server.on('error', (err: NodeJS.ErrnoException) => {
      const line = describeListenError(err, port, bind);
      logger.error(line);
      reportFatal(proc, line);
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
        reportFatal(proc, 'Graceful shutdown timed out; forcing exit.');
        exitProcess(1);
      }, 15000);
      hardExit.unref?.();

      // Close the modern handler (its listen streams end gracefully), then every
      // active transport, then the one core (every debug session with it),
      // bounded so one wedged proxy cannot stall the whole shutdown. Transports
      // before the core: no request lands on a core that is closing.
      const stopWork = (async () => {
        try {
          await modernHandler.close();
        } catch (err) {
          logger.error('Error closing the modern-era handler during shutdown', { error: err });
        }
        for (const { transport } of httpSessions.values()) {
          try {
            await transport.close();
          } catch (err) {
            logger.error('Error closing transport during shutdown', { error: err });
          }
        }
        try {
          await core.stop();
        } catch (err) {
          logger.error('Error stopping debug server during shutdown', { error: err });
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
    if (error instanceof StartupRefusalError) {
      // Fail fast and by name (--allowed-host, --bind, --port): a silently
      // dropped value would reproduce the very discoverability problem each
      // flag exists to fix.
      const line = `${error.message}. The server was not started.`;
      logger.error(line);
      reportFatal(proc, line);
    } else {
      logger.error('Failed to start server in HTTP mode', { error });
      reportFatal(proc, 'Failed to start server in HTTP mode', error instanceof Error ? error.message : String(error));
    }
    exitProcess(1);
  }
}
