/**
 * DAP mirror server (issue #217): a per-session, loopback-only TCP DAP
 * server hosted inside the proxy worker so an IDE (VS Code, nvim-dap, any
 * DAP client) can attach as a read-only second client to the live debug
 * session. Read requests are forwarded to the single real adapter
 * connection via the host; execution control and mutation are rejected so
 * the MCP session keeps the wheel.
 *
 * Security model: bind is hard-coded to 127.0.0.1 and every client must
 * present the per-expose random token as `mirrorToken` in its attach (or
 * launch) request arguments. The token authorizes `evaluate` — which can
 * run code in the debuggee — so treat it as an execution capability, not a
 * view-only credential.
 */

import net from 'net';
import crypto from 'crypto';
import { DebugProtocol } from '@vscode/debugprotocol';
import { DapFrameDecoder, encodeDapMessage } from './dap-framing.js';
import type { ILogger } from './dap-proxy-interfaces.js';

// ===== Host interface (implemented by DapProxyWorker) =====

export interface DapMirrorHost {
  /** Forward a read-only request to the live adapter connection. */
  forwardRequest(command: string, args?: unknown): Promise<DebugProtocol.Response>;
  /** Adapter capabilities from the real initialize response, if seen. */
  getCapabilities(): DebugProtocol.Capabilities | undefined;
  /** Body of the most recent stopped event, if the session is paused. */
  getLastStop(): DebugProtocol.StoppedEvent['body'] | undefined;
}

// ===== Minimal structural net types =====
// net.Server / net.Socket satisfy these; unit tests supply EventEmitter fakes.
// (The shared IServer interface cannot express a host-scoped bind, so the
// mirror declares its own.)

export interface MirrorSocket {
  write(data: Buffer | string, cb?: (err?: Error) => void): boolean;
  end(): void;
  destroy(): void;
  destroyed?: boolean;
  on(event: string, handler: (...args: unknown[]) => void): unknown;
  setNoDelay?(noDelay: boolean): void;
  remoteAddress?: string;
}

export interface MirrorNetServer {
  listen(options: { port: number; host: string }, cb: () => void): void;
  close(cb?: (err?: Error) => void): void;
  address(): { port: number } | string | null;
  on(event: string, handler: (...args: unknown[]) => void): unknown;
}

// ===== Public types =====

export interface MirrorEndpoint {
  host: string;
  port: number;
  token: string;
}

export interface DapMirrorServerOptions {
  logger: ILogger;
  /** Injectable listener factory; production default is net.createServer. */
  createServer?: () => MirrorNetServer;
  maxClients?: number;
  authTimeoutMs?: number;
  /** Injectable randomness for deterministic tests. */
  randomBytes?: (size: number) => Buffer;
  timers?: {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  };
}

export interface IDapMirrorServer {
  start(port?: number): Promise<MirrorEndpoint>;
  stop(opts?: { notifyClients?: boolean }): Promise<void>;
  broadcastEvent(event: string, body: unknown): void;
  clientCount(): number;
}

export interface IDapMirrorServerFactory {
  create(host: DapMirrorHost, options: DapMirrorServerOptions): IDapMirrorServer;
}

/**
 * Late-join stopped replay has two triggers: the client's configurationDone
 * (standard DAP handshake order — fires the replay immediately, real IDEs
 * always take this path) and this fallback for minimal scripted clients that
 * skip configurationDone. Short enough that a script attaching and reading
 * events sees the replay promptly (issue #307); an immediate-at-join replay
 * is deliberately avoided so protocol-following IDEs never receive a stopped
 * event before their configuration phase completes.
 */
export const CONFIGURATION_DONE_FALLBACK_MS = 200;

// ===== Request dispatch tables (default-deny) =====

/** Read-only requests forwarded to the real adapter connection. */
const FORWARDED_REQUESTS = new Set([
  'threads',
  'stackTrace',
  'scopes',
  'variables',
  'source',
  'evaluate',
  'exceptionInfo',
  'loadedSources',
  'modules'
]);

/**
 * Breakpoint-configuration requests soft-succeeded so VS Code's attach
 * handshake (initialize → attach → set*Breakpoints → configurationDone)
 * survives; the unverified result renders as hollow breakpoint dots.
 */
const SOFT_BREAKPOINT_REQUESTS = new Set([
  'setBreakpoints',
  'setFunctionBreakpoints',
  'setDataBreakpoints',
  'setInstructionBreakpoints'
]);

const SOFT_BREAKPOINT_MESSAGE =
  'Read-only mirror: breakpoints are managed by the primary mcp-debugger session';

const MIRROR_ERROR_READ_ONLY = 9101;
const MIRROR_ERROR_AUTH = 9102;

/**
 * Capability flags force-disabled in the initialize response so IDE UIs
 * hide control affordances instead of offering buttons that would only be
 * rejected.
 */
const MASKED_CAPABILITIES: ReadonlyArray<keyof DebugProtocol.Capabilities> = [
  'supportsRestartRequest',
  'supportsTerminateRequest',
  'supportsTerminateThreadsRequest',
  'supportsSetVariable',
  'supportsSetExpression',
  'supportsStepBack',
  'supportsRestartFrame',
  'supportsGotoTargetsRequest',
  'supportsDataBreakpoints',
  'supportsInstructionBreakpoints',
  'supportsFunctionBreakpoints',
  'supportsWriteMemoryRequest',
  'supportsReadMemoryRequest',
  'supportsDisassembleRequest',
  'supportsBreakpointLocationsRequest',
  'supportsCompletionsRequest',
  'supportsStepInTargetsRequest',
  'supportsSingleThreadExecutionRequests',
  'supportSuspendDebuggee',
  'supportTerminateDebuggee'
];

type ClientPhase = 'awaiting-initialize' | 'awaiting-join' | 'configuring' | 'ready';

const sha256 = (value: string): Buffer => crypto.createHash('sha256').update(value).digest();

// ===== Per-client connection =====

/** Exported for unit tests; not part of the worker-facing API. */
export class MirrorClientConnection {
  private phase: ClientPhase = 'awaiting-initialize';
  private nextSeq = 1;
  private terminatedSent = false;
  private closed = false;
  private configurationDoneFallback: NodeJS.Timeout | null = null;
  private readonly decoder: DapFrameDecoder;

  constructor(
    private readonly socket: MirrorSocket,
    private readonly server: DapMirrorServer,
    private readonly host: DapMirrorHost,
    private readonly token: string,
    private readonly logger: ILogger,
    private readonly timers: {
      setTimeout: typeof setTimeout;
      clearTimeout: typeof clearTimeout;
    }
  ) {
    this.decoder = new DapFrameDecoder({
      onError: (error, context) => {
        this.logger.warn(`[DapMirror] Malformed frame from mirror client (${context}): ${error.message}`);
        if (context === 'header' || context === 'overflow') {
          // Framing is unrecoverable once the byte stream is corrupt, and a
          // client advertising an over-cap frame is equally untrustworthy
          // (issue #402).
          this.close();
        }
      }
    });
    socket.setNoDelay?.(true);
    socket.on('data', (data) => this.handleData(data as Buffer));
    socket.on('error', (err) => {
      this.logger.debug(`[DapMirror] Mirror client socket error: ${(err as Error)?.message}`);
      this.close();
    });
    socket.on('close', () => this.close());
  }

  get isAuthenticated(): boolean {
    return this.phase === 'configuring' || this.phase === 'ready';
  }

  get hasTerminatedBeenSent(): boolean {
    return this.terminatedSent;
  }

  private handleData(data: Buffer): void {
    for (const message of this.decoder.push(data)) {
      if (message.type === 'request') {
        void this.handleRequest(message as DebugProtocol.Request);
      }
      // Responses/events from a DAP *client* are not expected; ignore.
    }
  }

  private async handleRequest(request: DebugProtocol.Request): Promise<void> {
    const command = request.command;
    this.logger.debug(`[DapMirror] Mirror client request: ${command} (seq ${request.seq})`);

    // Auth gate: before the token has been validated only the handshake
    // requests are honored.
    if (!this.isAuthenticated && !['initialize', 'attach', 'launch', 'disconnect'].includes(command)) {
      this.sendErrorResponse(request, MIRROR_ERROR_AUTH, 'Not authenticated: attach with a valid mirrorToken first');
      return;
    }

    switch (command) {
      case 'initialize':
        this.sendResponse(request, this.buildCapabilityMask());
        this.phase = this.phase === 'awaiting-initialize' ? 'awaiting-join' : this.phase;
        this.sendEvent('initialized', undefined);
        return;
      case 'attach':
      case 'launch':
        this.handleJoin(request);
        return;
      case 'configurationDone':
        this.sendResponse(request, {});
        this.clearFallbackTimer();
        if (this.phase === 'configuring') {
          this.phase = 'ready';
          this.synthesizeStoppedIfPaused();
        }
        return;
      case 'disconnect':
        // Never forwarded — a forwarded disconnect would tear down the real
        // session. terminateDebuggee is deliberately ignored.
        this.sendResponse(request, {});
        this.close();
        return;
      case 'cancel':
        this.sendResponse(request, {});
        return;
      default:
        break;
    }

    if (SOFT_BREAKPOINT_REQUESTS.has(command)) {
      const args = (request.arguments ?? {}) as { breakpoints?: Array<{ line?: number }> };
      const requested = Array.isArray(args.breakpoints) ? args.breakpoints : [];
      this.sendResponse(request, {
        breakpoints: requested.map((bp) => ({
          verified: false,
          ...(typeof bp?.line === 'number' ? { line: bp.line } : {}),
          message: SOFT_BREAKPOINT_MESSAGE
        }))
      });
      return;
    }
    if (command === 'setExceptionBreakpoints') {
      this.sendResponse(request, {});
      return;
    }
    if (command === 'breakpointLocations') {
      this.sendResponse(request, { breakpoints: [] });
      return;
    }

    if (FORWARDED_REQUESTS.has(command)) {
      try {
        const response = await this.host.forwardRequest(command, request.arguments);
        this.sendResponse(request, response?.body ?? {}, response?.success !== false, response?.message);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.sendErrorResponse(request, MIRROR_ERROR_READ_ONLY, message, false);
      }
      return;
    }

    // Default deny: execution control, mutation, and anything unlisted.
    this.sendErrorResponse(
      request,
      MIRROR_ERROR_READ_ONLY,
      `The mcp-debugger mirror is read-only; '${command}' is controlled by the primary session`,
      false
    );
  }

  private handleJoin(request: DebugProtocol.Request): void {
    if (this.isAuthenticated) {
      this.sendErrorResponse(request, MIRROR_ERROR_AUTH, 'Already attached to this mirror session');
      return;
    }
    const candidate = (request.arguments as { mirrorToken?: unknown } | undefined)?.mirrorToken;
    const valid =
      typeof candidate === 'string' &&
      crypto.timingSafeEqual(sha256(candidate), sha256(this.token));
    if (!valid) {
      this.logger.warn('[DapMirror] Mirror client rejected: invalid or missing mirrorToken');
      this.sendErrorResponse(request, MIRROR_ERROR_AUTH, 'mcp-debugger mirror: invalid or missing mirrorToken', true);
      this.close();
      return;
    }
    this.phase = 'configuring';
    this.sendResponse(request, {});
    // Clients that skip configurationDone still deserve the late-join
    // stopped event; a short fallback covers them.
    this.configurationDoneFallback = this.timers.setTimeout(() => {
      this.configurationDoneFallback = null;
      if (this.phase === 'configuring') {
        this.phase = 'ready';
        this.synthesizeStoppedIfPaused();
      }
    }, CONFIGURATION_DONE_FALLBACK_MS);
  }

  private buildCapabilityMask(): DebugProtocol.Capabilities {
    const mask: DebugProtocol.Capabilities = { ...(this.host.getCapabilities() ?? {}) };
    mask.supportsConfigurationDoneRequest = true;
    for (const flag of MASKED_CAPABILITIES) {
      (mask as Record<string, unknown>)[flag] = false;
    }
    // Don't imply the mirror can arm exception breaking.
    mask.exceptionBreakpointFilters = [];
    return mask;
  }

  private clearFallbackTimer(): void {
    if (this.configurationDoneFallback) {
      this.timers.clearTimeout(this.configurationDoneFallback);
      this.configurationDoneFallback = null;
    }
  }

  private synthesizeStoppedIfPaused(): void {
    const lastStop = this.host.getLastStop();
    if (!lastStop) {
      return;
    }
    this.sendEvent('stopped', {
      ...lastStop,
      // Focus the paused frame in the joining IDE.
      preserveFocusHint: false
    });
  }

  sendEvent(event: string, body: unknown): void {
    if (event === 'terminated') {
      this.terminatedSent = true;
    }
    this.writeMessage({
      seq: this.nextSeq++,
      type: 'event',
      event,
      ...(body !== undefined ? { body } : {})
    } as DebugProtocol.Event);
  }

  private sendResponse(
    request: DebugProtocol.Request,
    body: unknown,
    success: boolean = true,
    errorMessage?: string
  ): void {
    this.writeMessage({
      seq: this.nextSeq++,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success,
      ...(success ? { body } : { message: errorMessage ?? 'Request failed', body: {} })
    } as DebugProtocol.Response);
  }

  private sendErrorResponse(
    request: DebugProtocol.Request,
    id: number,
    message: string,
    showUser: boolean = false
  ): void {
    this.writeMessage({
      seq: this.nextSeq++,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: false,
      message,
      body: {
        error: {
          id,
          format: message,
          showUser
        }
      }
    } as DebugProtocol.Response);
  }

  private writeMessage(message: DebugProtocol.ProtocolMessage): void {
    if (this.closed || this.socket.destroyed) {
      return;
    }
    this.socket.write(encodeDapMessage(message));
  }

  /** Graceful close: flush, FIN, then a destroy backstop. */
  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.clearFallbackTimer();
    try {
      this.socket.end();
    } catch {
      /* socket already gone */
    }
    this.timers.setTimeout(() => {
      try {
        if (!this.socket.destroyed) {
          this.socket.destroy();
        }
      } catch {
        /* socket already gone */
      }
    }, 500);
    this.server.removeClient(this);
  }
}

// ===== Server =====

export class DapMirrorServer implements IDapMirrorServer {
  private server: MirrorNetServer | null = null;
  private endpoint: MirrorEndpoint | null = null;
  private clients = new Set<MirrorClientConnection>();
  private authTimers = new Map<MirrorClientConnection, NodeJS.Timeout>();
  private stopped = false;

  private readonly logger: ILogger;
  private readonly createServer: () => MirrorNetServer;
  private readonly maxClients: number;
  private readonly authTimeoutMs: number;
  private readonly randomBytes: (size: number) => Buffer;
  private readonly timers: {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  };

  constructor(
    private readonly host: DapMirrorHost,
    options: DapMirrorServerOptions
  ) {
    this.logger = options.logger;
    this.createServer = options.createServer ?? (() => net.createServer() as unknown as MirrorNetServer);
    this.maxClients = options.maxClients ?? 4;
    this.authTimeoutMs = options.authTimeoutMs ?? 30_000;
    this.randomBytes = options.randomBytes ?? crypto.randomBytes;
    this.timers = options.timers ?? { setTimeout, clearTimeout };
  }

  start(port: number = 0): Promise<MirrorEndpoint> {
    if (this.endpoint) {
      return Promise.resolve(this.endpoint);
    }
    if (this.stopped) {
      return Promise.reject(new Error('Mirror server already stopped'));
    }
    const token = this.randomBytes(24).toString('base64url');
    const server = this.createServer();
    this.server = server;

    return new Promise<MirrorEndpoint>((resolve, reject) => {
      let settled = false;
      server.on('error', (err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        if (!settled) {
          settled = true;
          this.server = null;
          reject(error);
          return;
        }
        this.logger.warn(`[DapMirror] Listener error: ${error.message}`);
      });
      server.on('connection', (rawSocket) => this.handleConnection(rawSocket as MirrorSocket, token));
      server.listen({ port, host: '127.0.0.1' }, () => {
        settled = true;
        const address = server.address();
        if (!address || typeof address === 'string' || typeof address.port !== 'number') {
          this.server = null;
          server.close();
          reject(new Error('Mirror listener reported no port'));
          return;
        }
        this.endpoint = { host: '127.0.0.1', port: address.port, token };
        this.logger.info(`[DapMirror] Mirror endpoint listening on 127.0.0.1:${address.port}`);
        resolve(this.endpoint);
      });
    });
  }

  private handleConnection(socket: MirrorSocket, token: string): void {
    if (this.stopped) {
      socket.destroy();
      return;
    }
    if (this.clients.size >= this.maxClients) {
      this.logger.info(`[DapMirror] Rejecting mirror client: max clients (${this.maxClients}) reached`);
      socket.destroy();
      return;
    }
    const client = new MirrorClientConnection(socket, this, this.host, token, this.logger, this.timers);
    this.clients.add(client);
    this.logger.info(`[DapMirror] Mirror client connected (${this.clients.size} active)`);
    // Reap clients that never authenticate.
    const authTimer = this.timers.setTimeout(() => {
      this.authTimers.delete(client);
      if (!client.isAuthenticated) {
        this.logger.info('[DapMirror] Disconnecting mirror client: authentication timeout');
        client.close();
      }
    }, this.authTimeoutMs);
    this.authTimers.set(client, authTimer);
  }

  /** Called by MirrorClientConnection when its socket closes. */
  removeClient(client: MirrorClientConnection): void {
    const timer = this.authTimers.get(client);
    if (timer) {
      this.timers.clearTimeout(timer);
      this.authTimers.delete(client);
    }
    if (this.clients.delete(client)) {
      this.logger.info(`[DapMirror] Mirror client disconnected (${this.clients.size} active)`);
    }
  }

  broadcastEvent(event: string, body: unknown): void {
    for (const client of this.clients) {
      // Only clients past the token gate receive session events.
      if (client.isAuthenticated) {
        client.sendEvent(event, body);
      }
    }
  }

  clientCount(): number {
    return this.clients.size;
  }

  async stop(opts?: { notifyClients?: boolean }): Promise<void> {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    this.endpoint = null;

    for (const client of [...this.clients]) {
      if (opts?.notifyClients && client.isAuthenticated && !client.hasTerminatedBeenSent) {
        client.sendEvent('terminated', {});
      }
      client.close();
    }
    this.clients.clear();
    for (const timer of this.authTimers.values()) {
      this.timers.clearTimeout(timer);
    }
    this.authTimers.clear();

    const server = this.server;
    this.server = null;
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    this.logger.info('[DapMirror] Mirror endpoint closed');
  }
}
