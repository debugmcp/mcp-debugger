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
 * connection produces forwarded under the child's session id — or released
 * by the policy's lever: the request answered `success: false`, on which
 * debugpy unblocks the child itself, or (js-debug, issue #1082, whose report
 * is acked the moment it is held because its answer decides nothing) a
 * throwaway connection that attaches to the target and detaches again. A
 * report nobody answers is released by a safety timer, so a child is never
 * parked forever by a silent parent. Every connection opened here is closed
 * here: the adapter lives while any client socket is open.
 */
import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import path from 'path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { resolveExceptionFilters } from '@debugmcp/shared';
import type { AdapterPolicy, ChildAdoptionContract, ChildReport, LanguageSpecificLaunchConfig } from '@debugmcp/shared';
import type { DapConnectionManager } from './dap-proxy-connection-manager.js';
import { createChildSafePolicy } from './child-safe-policy.js';
import { releaseByThrowawayAttach } from './throwaway-release.js';
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
  /** Releases own sockets too; shutdown must wait until they have detached. */
  private readonly releases = new Set<Promise<void>>();
  private readonly releaseTimeoutMs: number;
  private closing = false;
  /** The policy the connections opened here run (child-safe for an in-session adopter, issue #1082). */
  private connectionPolicy?: AdapterPolicy;

  constructor(private readonly options: ChildConnectionsOptions) {
    super();
    this.releaseTimeoutMs = options.releaseTimeoutMs ?? CHILD_REPORT_RELEASE_TIMEOUT_MS;
  }

  /**
   * Hold every child reported on this connection and tell the parent process.
   * `connectionSessionId` is the session the connection serves: the root's id
   * for the root connection, the child's id for an adopted child (so a
   * grandchild's report is stamped with its spawning session). A report the
   * client relays from another connection (js-debug's program target, whose
   * forks are reported on its own connection) names that connection as
   * `client`: the answer goes there.
   */
  attach(client: IDapClient, connectionSessionId: string): void {
    client.on('child-report', ({ request, report, client: origin }: { request: DebugProtocol.Request; report: ChildReport; client?: IDapClient }) => {
      this.hold(origin ?? client, connectionSessionId, request, report);
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

  /** How many adopted or releasing child connections are open. */
  liveCount(): number {
    return this.clients.size + this.releases.size;
  }

  /**
   * Release a held report so the child runs undebugged, by the policy's
   * lever: answer the adapter `success: false` (debugpy), or attach a
   * throwaway connection and detach again (js-debug; runs on after this
   * returns). Returns false when the report is unknown or already answered.
   */
  release(reportId: string, reason: string): boolean {
    const held = this.takeHeld(reportId);
    if (!held) {
      return false;
    }
    this.options.logger.info(`[ChildConnections] Releasing child ${held.report.targetId} (${held.report.name}): ${reason}`);
    this.giveUp(held, reason);
    return true;
  }

  /** Release held reports and wait for every throwaway socket before the adapter can be stopped. */
  async releaseAllHeld(reason: string): Promise<void> {
    do {
      for (const reportId of Array.from(this.held.keys())) {
        this.release(reportId, reason);
      }
      await Promise.all(this.releases);
      // A released process can report another process before it detaches.
    } while (this.held.size > 0 || this.releases.size > 0);
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
      client = deps.dapClientFactory.create(deps.host, deps.port, this.policyForConnections(deps), { traceLabel: label });
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

      const attach = deps.connectionManager.sendAttachRequest(
        client,
        contract.buildChildAttachArguments(held.report, deps.launchConfig as Readonly<Record<string, unknown>> | undefined)
      );
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
      this.answer(held, true);
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
        }
      }
      // The report is no longer held, so the server's release command that
      // follows finds nothing: let the child go here, by the policy's lever.
      this.giveUp(held, `adoption failed: ${message}`);
      this.emitEmptyIfSo();
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
    await this.releaseAllHeld(reason);
    this.options.logger.info(`[ChildConnections] Closing ${this.clients.size} child connection(s): ${reason}`);
    for (const sessionId of Array.from(this.clients.keys())) {
      await this.close(sessionId, { terminateDebuggee: false });
    }
    await this.releaseAllHeld(reason);
  }

  // ----- internals -----

  private hold(client: IDapClient, connectionSessionId: string, request: DebugProtocol.Request, report: ChildReport): void {
    const throwaway = this.lever() === 'throwaway-attach';
    if (this.closing && !throwaway) {
      client.respondToReverseRequest?.(request, {}, false, 'worker shutdown');
      return;
    }
    const reportId = randomUUID();
    const timer = setTimeout(() => {
      this.release(reportId, `no answer from the server within ${this.releaseTimeoutMs} ms`);
    }, this.releaseTimeoutMs);
    timer.unref?.();
    this.held.set(reportId, { request, report, client, connectionSessionId, timer });
    if (throwaway) {
      // The answer decides nothing for this adapter (a pending target is
      // resolved only by a connection attaching with its id), so answer
      // once, now, and never again for this request.
      client.respondToReverseRequest?.(request, {}, true, undefined);
    }
    if (this.closing) {
      this.release(reportId, 'worker shutdown');
      return;
    }
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

  private lever(): ChildAdoptionContract['releaseLever'] {
    return this.options.adoption?.policy.childAdoption?.releaseLever ?? 'reject-request';
  }

  /** Answer a held request the adapter is still waiting on; a throwaway-lever report was answered when held. */
  private answer(held: HeldReport, success: boolean, message?: string): void {
    if (this.lever() === 'throwaway-attach') {
      return;
    }
    held.client.respondToReverseRequest?.(held.request, {}, success, message);
  }

  /** Let a taken report's child run undebugged, by the policy's lever: refuse the request, or attach and detach. */
  private giveUp(held: HeldReport, reason: string): void {
    if (this.lever() === 'throwaway-attach') {
      const releasing = this.releaseByThrowaway(held, reason)
        .catch((error: unknown) => {
          this.options.logger.error(`[ChildConnections] Failed to release child ${held.report.targetId}: ${error instanceof Error ? error.message : String(error)}`);
        })
        .finally(() => {
          this.releases.delete(releasing);
          this.emitEmptyIfSo();
        });
      this.releases.add(releasing);
    } else {
      held.client.respondToReverseRequest?.(held.request, {}, false, reason);
    }
  }

  /** The policy for a connection opened here: never an in-session adopter (issue #1082). */
  private policyForConnections(deps: ChildAdoptionDeps): AdapterPolicy {
    this.connectionPolicy ??= createChildSafePolicy(deps.policy);
    return this.connectionPolicy;
  }

  /**
   * The throwaway release (issues #501, #1082): a fresh connection attaches
   * to the target so the adapter resumes it, then detaches with the target
   * kept. A process the released child reports in that window is held like
   * any other, stamped with the session the released child was reported on.
   */
  private async releaseByThrowaway(held: HeldReport, reason: string): Promise<void> {
    const deps = this.options.adoption;
    const contract = deps?.policy.childAdoption;
    const { logger } = this.options;
    if (!deps || !contract) {
      logger.warn(`[ChildConnections] Child ${held.report.targetId} (${held.report.name}) cannot be released: this worker opens no connections; it stays parked`);
      return;
    }
    const label = held.report.targetId.slice(0, 8);
    const attachArguments = contract.buildChildAttachArguments(held.report, deps.launchConfig as Readonly<Record<string, unknown>> | undefined);
    const client = deps.dapClientFactory.create(deps.host, deps.port, this.policyForConnections(deps), { traceLabel: `release:${label}` });
    this.attach(client, held.connectionSessionId);
    const released = await releaseByThrowawayAttach({
      client,
      policy: deps.policy,
      attachArguments,
      label,
      logger
    });
    if (released) {
      logger.warn(
        `[ChildConnections] Child ${held.report.targetId} (${held.report.name}) released to run UNDEBUGGED (${reason}) — breakpoints will not bind in that process`
      );
    }
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
    // A cancelled adoption registers its fallback release in its catch.
    // Let that path announce emptiness, after it owns the replacement socket.
    if (!connection.cancelAdoption) {
      this.emitEmptyIfSo();
    }
  }

  private emitEmptyIfSo(): void {
    if (this.liveCount() === 0) {
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
