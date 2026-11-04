/**
 * ChildConnections — the worker-side registry of the children an adapter
 * reports (the session tree, issue #1081; docs/architecture/session-tree.md).
 *
 * One worker serves one adapter process and every connection to it: the root
 * session's and one per adopted child. A child is reported on the connection
 * of the process that spawned it (a `child-report` from MinimalDapClient); the
 * report is held unanswered here while the parent process decides, then
 * adopted — a fresh connection to the same adapter, the child handshake with
 * the parent's breakpoints re-sent before configurationDone, every event the
 * connection produces forwarded under the child's session id — or released,
 * the request answered `success: false`, on which debugpy unblocks the child
 * itself. A report nobody answers is released by a safety timer, so a child is
 * never parked forever by a silent parent. Every connection opened here is
 * closed here: the adapter lives while any client socket is open.
 */
import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import path from 'path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { resolveExceptionFilters } from '@debugmcp/shared';
import type { AdapterPolicy, ChildReport, LanguageSpecificLaunchConfig } from '@debugmcp/shared';
import type { DapConnectionManager } from './dap-proxy-connection-manager.js';
import type {
  BreakpointSyncResult,
  ChildAdoptArgs,
  DapEventMessage,
  ErrorMessage,
  IDapClient,
  IDapClientFactory,
  ILogger,
  IMessageSender,
  StatusMessage
} from './dap-proxy-interfaces.js';

/** The default time a held report waits for the parent process's answer. */
export const CHILD_REPORT_RELEASE_TIMEOUT_MS = 30_000;
/** How long the child handshake waits for `initialized` after its attach. */
export const CHILD_INITIALIZED_TIMEOUT_MS = 15_000;

/** What adopting a child needs: the adapter's address and the handshake helpers the root uses. */
export interface ChildAdoptionDeps {
  dapClientFactory: IDapClientFactory;
  connectionManager: Pick<
    DapConnectionManager,
    'initializeSession' | 'sendAttachRequest' | 'setExceptionBreakpoints' | 'setBreakpoints' | 'sendConfigurationDone' | 'disconnect'
  >;
  policy: AdapterPolicy;
  host: string;
  port: number;
  adapterId: string;
  breakOnExceptions?: 'uncaught' | 'all' | 'none';
  launchConfig?: LanguageSpecificLaunchConfig;
  initializedTimeoutMs?: number;
}

export interface ChildConnectionsOptions {
  messageSender: IMessageSender;
  logger: ILogger;
  /** How long a held report waits for adopt/release before it is released. */
  releaseTimeoutMs?: number;
  /** Absent for a worker whose policy reports no children: adopt() then refuses. */
  adoption?: ChildAdoptionDeps;
}

/** The worker's answer to CHILD_ADOPT_COMMAND. */
export interface ChildAdoptResult {
  sessionId: string;
  capabilities?: DebugProtocol.Capabilities;
}

interface HeldReport {
  request: DebugProtocol.Request;
  report: ChildReport;
  client: IDapClient;
  /** The session id of the connection the report arrived on. */
  connectionSessionId: string;
  timer: NodeJS.Timeout;
}

interface ChildConnection {
  sessionId: string;
  client: IDapClient;
  /** The adapter reported the child's end on this connection. */
  terminatedSeen: boolean;
  /** This worker closed the connection on purpose. */
  closed: boolean;
  /** Cancel a handshake that is still opening this connection. */
  cancelAdoption?: (reason: string) => void;
}

/** Forwarded as-is under the child's session id; `terminated` and `close` have their own handling. */
const FORWARDED_CHILD_EVENTS = ['output', 'stopped', 'continued', 'thread', 'exited', 'breakpoint'] as const;

export class ChildConnections extends EventEmitter {
  private readonly held = new Map<string, HeldReport>();
  /** Adopted child connections by their session id. */
  private readonly clients = new Map<string, ChildConnection>();
  private readonly releaseTimeoutMs: number;
  private closing = false;

  constructor(private readonly options: ChildConnectionsOptions) {
    super();
    this.releaseTimeoutMs = options.releaseTimeoutMs ?? CHILD_REPORT_RELEASE_TIMEOUT_MS;
  }

  /**
   * Hold every child reported on this connection and tell the parent process.
   * `connectionSessionId` is the session the connection serves: the root's id
   * for the root connection, the child's id for an adopted child (so a
   * grandchild's report is stamped with its spawning session).
   */
  attach(client: IDapClient, connectionSessionId: string): void {
    client.on('child-report', ({ request, report }: { request: DebugProtocol.Request; report: ChildReport }) => {
      this.hold(client, connectionSessionId, request, report);
    });
  }

  /** Whether `sessionId` names an adopted child connection of this worker. */
  has(sessionId: string): boolean {
    return this.clients.has(sessionId);
  }

  /** The adopted child's client, for routing its requests. */
  clientOf(sessionId: string): IDapClient | undefined {
    return this.clients.get(sessionId)?.client;
  }

  /** How many adopted child connections are open. */
  liveCount(): number {
    return this.clients.size;
  }

  /**
   * Release a held report: answer the adapter `success: false` so the child
   * runs undebugged. Returns false when the report is unknown or already
   * answered.
   */
  release(reportId: string, reason: string): boolean {
    const held = this.takeHeld(reportId);
    if (!held) {
      return false;
    }
    this.options.logger.info(`[ChildConnections] Releasing child ${held.report.targetId} (${held.report.name}): ${reason}`);
    held.client.respondToReverseRequest?.(held.request, {}, false, reason);
    return true;
  }

  /** Release every report still held (worker shutdown). */
  releaseAllHeld(reason: string): void {
    for (const reportId of Array.from(this.held.keys())) {
      this.release(reportId, reason);
    }
  }

  /**
   * Adopt a held report as the connection of `childSessionId`: connect to
   * the adapter, run the child handshake in the adapter's order (debugpy:
   * initialize → attach → initialized → breakpoints → configurationDone, the
   * attach answered only after configurationDone), then answer the held
   * request. On any failure the request is released instead and the
   * connection torn down.
   */
  async adopt(childSessionId: string, args: ChildAdoptArgs): Promise<ChildAdoptResult> {
    const deps = this.options.adoption;
    const contract = deps?.policy.childAdoption;
    if (!deps || !contract) {
      throw new Error('this adapter reports no child processes');
    }
    if (this.closing) {
      throw new Error('child connections are shutting down');
    }
    if (this.clients.has(childSessionId)) {
      throw new Error(`child session ${childSessionId} already has a connection`);
    }
    const held = this.takeHeld(args.reportId);
    if (!held) {
      throw new Error(`unknown or already answered child report ${args.reportId}`);
    }

    const { logger } = this.options;
    const label = `child:${childSessionId.slice(0, 8)}`;
    let client: IDapClient | undefined;
    let connection: ChildConnection | undefined;
    let initializedTimer: NodeJS.Timeout | undefined;
    let onInitialized: (() => void) | undefined;
    try {
      client = deps.dapClientFactory.create(deps.host, deps.port, deps.policy, { traceLabel: label });
      let cancelAdoption!: (reason: string) => void;
      const cancelled = new Promise<never>((_, reject) => {
        cancelAdoption = (reason) => reject(new Error(reason));
      });
      const wait = <T>(operation: Promise<T>): Promise<T> => Promise.race([operation, cancelled]);
      connection = { sessionId: childSessionId, client, terminatedSeen: false, closed: false, cancelAdoption };
      // Own the socket before connect yields: close/closeAll must also reach
      // pending handshakes, and a root ending must wait for them.
      this.clients.set(childSessionId, connection);
      this.wireChildEvents(connection);
      // A grandchild is reported on this connection: it is this child's.
      this.attach(client, childSessionId);
      logger.info(`[ChildConnections] Adopting child ${held.report.targetId} (${held.report.name}) as session ${childSessionId}`);
      await wait(client.connect());

      const initializedSeen = new Promise<void>((resolve) => {
        onInitialized = resolve;
        client!.once('initialized', onInitialized);
      });
      const capabilities = await wait(deps.connectionManager.initializeSession(client, childSessionId, deps.adapterId));

      const attach = deps.connectionManager.sendAttachRequest(client, contract.buildChildAttachArguments(held.report));
      const attachFailure = new Promise<never>((_, reject) => {
        attach.catch(reject);
      });
      const initializedTimeout = new Promise<never>((_, reject) => {
        initializedTimer = setTimeout(
          () => reject(new Error(`Timeout waiting for initialized event after the child attach (${deps.initializedTimeoutMs ?? CHILD_INITIALIZED_TIMEOUT_MS} ms)`)),
          deps.initializedTimeoutMs ?? CHILD_INITIALIZED_TIMEOUT_MS
        );
      });
      await wait(Promise.race([initializedSeen, attachFailure, initializedTimeout]));
      clearTimeout(initializedTimer);

      await wait(this.sendExceptionBreakpoints(deps, client, childSessionId));
      await wait(this.sendBreakpoints(deps, client, childSessionId, args.breakpoints ?? []));
      await wait(this.sendFunctionBreakpoints(client, childSessionId, args.functionBreakpoints ?? []));
      await wait(deps.connectionManager.sendConfigurationDone(client));
      await wait(attach);

      connection.cancelAdoption = undefined;
      held.client.respondToReverseRequest?.(held.request, {}, true, undefined);
      logger.info(`[ChildConnections] Child ${held.report.targetId} adopted as session ${childSessionId}`);
      return { sessionId: childSessionId, capabilities };
    } catch (error) {
      clearTimeout(initializedTimer);
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[ChildConnections] Adoption of child ${held.report.targetId} as session ${childSessionId} failed: ${message}`);
      if (connection) {
        connection.closed = true;
        connection.cancelAdoption = undefined;
        if (this.clients.get(childSessionId) === connection) {
          this.clients.delete(childSessionId);
          this.emitEmptyIfSo();
        }
      }
      held.client.respondToReverseRequest?.(held.request, {}, false, `adoption failed: ${message}`);
      try {
        client?.shutdown(`child adoption failed: ${message}`);
      } catch {
        // best effort
      }
      throw error;
    } finally {
      clearTimeout(initializedTimer);
      if (onInitialized) {
        client?.off('initialized', onInitialized);
      }
    }
  }

  /**
   * Close an adopted child's connection: `terminateDebuggee` true ends the
   * child (an explicit close, debugpy's measured semantics), false lets it
   * run on (the worker going down). Returns false for an unknown session.
   */
  async close(sessionId: string, options: { terminateDebuggee: boolean }): Promise<boolean> {
    const connection = this.clients.get(sessionId);
    if (!connection) {
      return false;
    }
    // A grandchild can be reported just as this child is closed. Release it
    // while its reporting socket still exists; its safety timer cannot
    // answer the reverse request after that socket has been destroyed.
    for (const [reportId, held] of this.held) {
      if (held.connectionSessionId === sessionId) {
        this.release(reportId, 'reporting child session closed');
      }
    }
    connection.closed = true;
    this.clients.delete(sessionId);
    connection.cancelAdoption?.('child session closed during adoption');
    const deps = this.options.adoption;
    try {
      await deps?.connectionManager.disconnect(connection.client, options.terminateDebuggee);
    } catch (error) {
      this.options.logger.warn(
        `[ChildConnections] Disconnecting child session ${sessionId} failed (best effort): ${error instanceof Error ? error.message : String(error)}`
      );
    }
    try {
      connection.client.shutdown('child session closed');
    } catch {
      // best effort
    }
    this.emitEmptyIfSo();
    return true;
  }

  /** Close every adopted connection without ending the children (the worker is going down). */
  async closeAll(reason: string): Promise<void> {
    this.closing = true;
    this.releaseAllHeld(reason);
    this.options.logger.info(`[ChildConnections] Closing ${this.clients.size} child connection(s): ${reason}`);
    for (const sessionId of Array.from(this.clients.keys())) {
      await this.close(sessionId, { terminateDebuggee: false });
    }
  }

  // ----- internals -----

  private hold(client: IDapClient, connectionSessionId: string, request: DebugProtocol.Request, report: ChildReport): void {
    if (this.closing) {
      client.respondToReverseRequest?.(request, {}, false, 'worker shutdown');
      return;
    }
    const reportId = randomUUID();
    const timer = setTimeout(() => {
      this.release(reportId, `no answer from the server within ${this.releaseTimeoutMs} ms`);
    }, this.releaseTimeoutMs);
    timer.unref?.();
    this.held.set(reportId, { request, report, client, connectionSessionId, timer });
    this.options.logger.info(
      `[ChildConnections] Holding child ${report.targetId} (${report.name}) reported on session ${connectionSessionId} as ${reportId}`
    );
    const message: StatusMessage = {
      type: 'status',
      status: 'child_reported',
      sessionId: connectionSessionId,
      reportId,
      targetId: report.targetId,
      name: report.name,
      configuration: report.configuration
    };
    this.options.messageSender.send(message);
  }

  private takeHeld(reportId: string): HeldReport | undefined {
    const held = this.held.get(reportId);
    if (!held) {
      return undefined;
    }
    this.held.delete(reportId);
    clearTimeout(held.timer);
    return held;
  }

  private wireChildEvents(connection: ChildConnection): void {
    const { client, sessionId } = connection;
    for (const event of FORWARDED_CHILD_EVENTS) {
      client.on(event, (body: unknown) => this.sendEvent(sessionId, event, body));
    }
    client.on('terminated', (body: unknown) => {
      connection.terminatedSeen = true;
      this.sendEvent(sessionId, 'terminated', body);
    });
    client.on('error', (error: unknown) => {
      const message: ErrorMessage = {
        type: 'error',
        sessionId,
        message: error instanceof Error ? error.message : String(error)
      };
      this.options.messageSender.send(message);
    });
    client.on('close', () => this.onConnectionClosed(connection));
  }

  private onConnectionClosed(connection: ChildConnection): void {
    if (this.clients.get(connection.sessionId) !== connection) {
      // Closed by this worker already (close()/closeAll()), reported then.
      return;
    }
    this.clients.delete(connection.sessionId);
    connection.cancelAdoption?.('child connection closed during adoption');
    const message: StatusMessage = {
      type: 'status',
      status: 'dap_connection_closed',
      sessionId: connection.sessionId,
      expected: connection.terminatedSeen || connection.closed
    };
    this.options.messageSender.send(message);
    this.emitEmptyIfSo();
  }

  private emitEmptyIfSo(): void {
    if (this.clients.size === 0) {
      this.emit('empty');
    }
  }

  private sendEvent(sessionId: string, event: string, body: unknown): void {
    const message: DapEventMessage = { type: 'dapEvent', sessionId, event, body };
    this.options.messageSender.send(message);
  }

  private async sendExceptionBreakpoints(deps: ChildAdoptionDeps, client: IDapClient, sessionId: string): Promise<void> {
    const mode = deps.breakOnExceptions;
    if (!mode || mode === 'none') {
      return;
    }
    const filters = resolveExceptionFilters(deps.policy, mode, deps.launchConfig);
    if (filters.length === 0) {
      return;
    }
    try {
      await deps.connectionManager.setExceptionBreakpoints(client, filters);
    } catch (error) {
      this.options.logger.warn(
        `[ChildConnections] setExceptionBreakpoints on child session ${sessionId} failed (continuing without): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /** The parent's breakpoints, per file, echoed as the launch echoes its own (issue #439). */
  private async sendBreakpoints(
    deps: ChildAdoptionDeps,
    client: IDapClient,
    sessionId: string,
    breakpoints: NonNullable<ChildAdoptArgs['breakpoints']>
  ): Promise<void> {
    const grouped = new Map<string, NonNullable<ChildAdoptArgs['breakpoints']>>();
    for (const breakpoint of breakpoints) {
      const file = path.resolve(breakpoint.file);
      if (!grouped.has(file)) {
        grouped.set(file, []);
      }
      grouped.get(file)!.push(breakpoint);
    }
    const syncResults: BreakpointSyncResult[] = [];
    for (const [file, group] of grouped) {
      const response = await deps.connectionManager.setBreakpoints(client, file, group, deps.policy);
      const answered = response.body?.breakpoints ?? [];
      group.forEach((breakpoint, i) => {
        syncResults.push({
          ...(breakpoint.id !== undefined ? { id: breakpoint.id } : {}),
          file: breakpoint.file,
          line: breakpoint.line,
          verified: answered[i]?.verified === true,
          ...(typeof answered[i]?.id === 'number' ? { adapterId: answered[i].id } : {}),
          ...(typeof answered[i]?.line === 'number' ? { boundLine: answered[i].line } : {}),
          ...(answered[i]?.message !== undefined ? { message: answered[i].message } : {})
        });
      });
    }
    if (syncResults.length > 0) {
      const message: StatusMessage = { type: 'status', status: 'breakpoints_synced', sessionId, breakpoints: syncResults };
      this.options.messageSender.send(message);
    }
  }

  private async sendFunctionBreakpoints(
    client: IDapClient,
    sessionId: string,
    functionBreakpoints: NonNullable<ChildAdoptArgs['functionBreakpoints']>
  ): Promise<void> {
    if (functionBreakpoints.length === 0) {
      return;
    }
    try {
      const response = await client.sendRequest<DebugProtocol.SetFunctionBreakpointsResponse>('setFunctionBreakpoints', {
        breakpoints: functionBreakpoints.map((bp) => ({
          name: bp.name,
          ...(bp.condition !== undefined ? { condition: bp.condition } : {})
        }))
      });
      const results = response.body?.breakpoints ?? [];
      const message: StatusMessage = {
        type: 'status',
        status: 'function_breakpoints_synced',
        sessionId,
        functionBreakpoints: functionBreakpoints.map((bp, i) => ({
          name: bp.name,
          verified: results[i]?.verified === true,
          ...(typeof results[i]?.id === 'number' ? { id: results[i].id } : {}),
          ...(typeof results[i]?.line === 'number' ? { line: results[i].line } : {}),
          ...(results[i]?.source?.path ? { source: results[i].source.path } : {}),
          ...(results[i]?.message !== undefined ? { message: results[i].message } : {})
        }))
      };
      this.options.messageSender.send(message);
    } catch (error) {
      this.options.logger.warn(
        `[ChildConnections] setFunctionBreakpoints on child session ${sessionId} failed (continuing without): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
