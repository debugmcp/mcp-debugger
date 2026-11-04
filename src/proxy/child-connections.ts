/**
 * ChildConnections — the worker-side registry of the children an adapter
 * reports (the session tree, issue #1081; docs/architecture/session-tree.md).
 *
 * One worker serves one adapter process and every connection to it: the root
 * session's and one per adopted child. A child is reported on the connection
 * of the process that spawned it (a `child-report` from MinimalDapClient); the
 * report is held unanswered here while the parent process decides, then
 * adopted (a fresh connection to the same adapter) or released — the request
 * answered `success: false`, on which debugpy unblocks the child itself. A
 * report nobody answers is released by a safety timer, so a child is never
 * parked forever by a silent parent.
 */
import { randomUUID } from 'node:crypto';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { ChildReport } from '@debugmcp/shared';
import type { IDapClient, ILogger, IMessageSender, StatusMessage } from './dap-proxy-interfaces.js';

/** The default time a held report waits for the parent process's answer. */
export const CHILD_REPORT_RELEASE_TIMEOUT_MS = 30_000;

export interface ChildConnectionsOptions {
  messageSender: IMessageSender;
  logger: ILogger;
  /** How long a held report waits for adopt/release before it is released. */
  releaseTimeoutMs?: number;
}

interface HeldReport {
  request: DebugProtocol.Request;
  report: ChildReport;
  client: IDapClient;
  /** The session id of the connection the report arrived on. */
  connectionSessionId: string;
  timer: NodeJS.Timeout;
}

export class ChildConnections {
  private readonly held = new Map<string, HeldReport>();
  /** Adopted child connections by their session id. */
  private readonly clients = new Map<string, IDapClient>();
  private readonly releaseTimeoutMs: number;

  constructor(private readonly options: ChildConnectionsOptions) {
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
    const held = this.held.get(reportId);
    if (!held) {
      return false;
    }
    this.held.delete(reportId);
    clearTimeout(held.timer);
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

  private hold(client: IDapClient, connectionSessionId: string, request: DebugProtocol.Request, report: ChildReport): void {
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
}
