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
import { dapSourcePath } from '../utils/dap-source.js';
import { ErrorMessages } from '../utils/error-messages.js';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { resolveExceptionFilters } from '@debugmcp/shared';
import type { AdapterPolicy, ChildAdoptionContract, ChildReport, LanguageSpecificLaunchConfig } from '@debugmcp/shared';
import type { DapConnectionManager } from './dap-proxy-connection-manager.js';
import { createChildSafePolicy } from './child-safe-policy.js';
import type { CdpProxyClient } from './cdp-proxy-client.js';
import { JsTargetServices } from './js-target-services.js';
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
  /**
   * Whether the root session steps through skipped code (issue #1130), as its
   * own start request said: a launch's or an attach's. A child's stepper
   * takes that choice over. Undefined (or absent) when the root cannot say.
   */
  stepsThroughSkippedCode?: () => boolean | undefined;
}

export interface ChildConnectionsOptions {
  messageSender: IMessageSender;
  logger: ILogger;
  /** How long a held report waits for adopt/release before it is released. */
  releaseTimeoutMs?: number;
  /** Absent for a worker whose policy reports no children: adopt() then refuses. */
  adoption?: ChildAdoptionDeps;
  /** DI seam for tests: the CDP socket of a child's target (issues #1130, #1212). */
  cdpClientFactory?: () => CdpProxyClient;
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
  /**
   * The child's own CDP socket and what the proxy runs on it: its stepper
   * (issue #1130) and the channel its logpoints are delivered on (issue
   * #1212). The same composition the program's own target has. Absent for
   * an adapter that has neither (debugpy).
   */
  services?: JsTargetServices;
  /**
   * Set once the adapter reported the child's end while its CDP socket may
   * still hold its last logpoint lines: what the connection sends from then
   * on (the `terminated`, the closed status) leaves after them, in order.
   */
  ending?: Promise<void>;
}

/** Forwarded as-is under the child's session id; `terminated` and `close` have their own handling. */
const FORWARDED_CHILD_EVENTS = ['output', 'stopped', 'continued', 'thread', 'exited', 'breakpoint'] as const;

/** Whether the adapter acknowledged letting a non-adopted child continue running (issue #1221). */
export type ChildReleaseOutcome = 'confirmed' | 'unconfirmed' | 'closed';

const MAX_RECORDED_RELEASE_OUTCOMES = 256;

export class ChildConnections extends EventEmitter {
  private readonly held = new Map<string, HeldReport>();
  /** Adopted child connections by their session id. */
  private readonly clients = new Map<string, ChildConnection>();
  /** Releases own sockets too; shutdown must wait until they have detached. */
  private readonly releases = new Set<Promise<void>>();
  /** Bounded per-reportId release confirmation outcomes so CHILD_RELEASE_COMMAND can await adopt-failure fallbacks (#1221). */
  private readonly releaseOutcomes = new Map<string, Promise<ChildReleaseOutcome>>();
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
    void this.giveUp(held, reason, reportId);
    return true;
  }

  /**
   * Release a held report — or join the fallback release started by a failed
   * `adopt()` — and report whether the debug adapter confirmed letting the
   * child process continue running (issue #1221).
   */
  async releaseWithConfirmation(
    reportId: string,
    reason: string
  ): Promise<{ held: boolean; released: boolean; closed?: true }> {
    const existing = this.releaseOutcomes.get(reportId);
    if (existing) {
      const outcome = await existing;
      return {
        held: false,
        released: outcome === 'confirmed',
        ...(outcome === 'closed' ? { closed: true } : {})
      };
    }
    const held = this.takeHeld(reportId);
    if (!held) {
      return { held: false, released: false };
    }
    this.options.logger.info(`[ChildConnections] Releasing child ${held.report.targetId} (${held.report.name}): ${reason}`);
    const outcome = await this.giveUp(held, reason, reportId);
    return { held: true, released: outcome === 'confirmed' };
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
    // Once configurationDone is on the wire the adapter may bind the target
    // to this connection; a failure after that is cleaned up differently.
    // "Sent", not "bound": the adapter binds the target a little later.
    let configurationDoneSent = false;
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
      let attachFailed: { error: unknown } | undefined;
      const attachFailure = new Promise<never>((_, reject) => {
        attach.catch((error: unknown) => {
          attachFailed = { error };
          reject(error);
        });
      });
      // Raced wherever the handshake waits below; handled here for the
      // moments when nothing is racing it.
      attachFailure.catch(() => undefined);
      const initializedTimeout = new Promise<never>((_, reject) => {
        initializedTimer = setTimeout(
          () => reject(new Error(`Timeout waiting for initialized event after the child attach (${deps.initializedTimeoutMs ?? CHILD_INITIALIZED_TIMEOUT_MS} ms)`)),
          deps.initializedTimeoutMs ?? CHILD_INITIALIZED_TIMEOUT_MS
        );
      });
      await wait(Promise.race([initializedSeen, attachFailure, initializedTimeout]));
      clearTimeout(initializedTimer);

      // An attach that has already failed ends the handshake where it is
      // (issue #1219). Going on to configurationDone would bind the target
      // to a connection this adoption is about to abandon, and the release
      // by a throwaway attach cannot reach a target that is no longer
      // pending.
      const step = <T>(operation: Promise<T>): Promise<T> => wait(Promise.race([operation, attachFailure]));
      await step(this.sendExceptionBreakpoints(deps, client, childSessionId));
      await step(this.sendBreakpoints(deps, client, childSessionId, args.breakpoints ?? []));
      await step(this.sendFunctionBreakpoints(client, childSessionId, args.functionBreakpoints ?? []));
      // The race above is not a gate: a step that had already settled wins
      // over a failure that arrived with it. This check is the gate.
      const failedBeforeConfigurationDone = attachFailed as { error: unknown } | undefined;
      if (failedBeforeConfigurationDone) {
        throw failedBeforeConfigurationDone.error;
      }
      configurationDoneSent = true;
      await step(deps.connectionManager.sendConfigurationDone(client));
      // Here and not after the attach (issue #1212): the adapter answers
      // `requestCDPProxy` from this moment on, and lets the child run about
      // 20 ms later, right before it answers the attach. Asked now, the
      // logpoint binding is in the child before its first statement. Not
      // awaited: the child is adopted either way, and the socket's replay
      // covers a pause that comes before it is open.
      this.startServices(deps, connection, args.breakpoints ?? []);
      await wait(attach);

      connection.cancelAdoption = undefined;
      this.answer(held, true);
      logger.info(`[ChildConnections] Child ${held.report.targetId} adopted as session ${childSessionId}`);
      return { sessionId: childSessionId, capabilities };
    } catch (error) {
      clearTimeout(initializedTimer);
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[ChildConnections] Adoption of child ${held.report.targetId} as session ${childSessionId} failed: ${message}`);
      // close() marks the connection before it cancels the handshake and
      // sends its own disconnect; that path is left as it was.
      const cancelledByClose = connection?.closed === true;
      if (connection) {
        connection.closed = true;
        connection.cancelAdoption = undefined;
        this.closeServices(connection);
        if (this.clients.get(childSessionId) === connection) {
          this.clients.delete(childSessionId);
        }
      }
      if (client && configurationDoneSent && !cancelledByClose && this.lever() === 'throwaway-attach') {
        // The adapter binds the target to this connection once it has
        // read configurationDone, and a second attach to a target that is
        // no longer pending is never answered (issue #1219: the fork ran
        // to its first breakpoint and stayed there, under a closed socket).
        // So the first lever is the one an adopted child gets: a disconnect
        // on its own connection. It lets a child the adapter has started
        // run on. It is best effort: a target the adapter had not started
        // yet is not resumed by it, and when nothing acknowledges it the
        // throwaway attach follows, for a target that is still pending.
        void this.letGoOnItsConnection(deps, client, held, message, args.reportId);
      } else {
        // The report is no longer held, so the server's release command that
        // follows joins this outcome via `releaseOutcomes`: let the child go
        // here, by the policy's lever (including when close() cancelled the
        // handshake before the target was bound).
        const giveUpOutcome = this.giveUp(held, `adoption failed: ${message}`);
        this.recordReleaseOutcome(
          args.reportId,
          cancelledByClose ? giveUpOutcome.then((): ChildReleaseOutcome => 'closed') : giveUpOutcome
        );
        if (!cancelledByClose) {
          // When close() cancelled the handshake it is still awaiting its own
          // disconnect on connection.client: shutting the client down or
          // announcing empty here would abort that disconnect mid-flight.
          this.emitEmptyIfSo();
          try {
            client?.shutdown(`child adoption failed: ${message}`);
          } catch {
            // best effort
          }
        }
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
    // Before the disconnect below, while the child's CDP socket is still
    // up: letting go of the services is what takes the proxy's things out
    // of a child that runs on (issue #1212; measured, the clear it sends
    // lands). Not awaited: this connection no longer counts as live, and
    // an await here would let the worker's shutdown overtake the
    // disconnect.
    this.closeServices(connection);
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
    this.releaseOutcomes.clear();
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

  private recordReleaseOutcome(reportId: string, outcome: Promise<ChildReleaseOutcome>): Promise<ChildReleaseOutcome> {
    if (!this.releaseOutcomes.has(reportId) && this.releaseOutcomes.size >= MAX_RECORDED_RELEASE_OUTCOMES) {
      const oldest = this.releaseOutcomes.keys().next().value;
      if (oldest !== undefined) {
        this.releaseOutcomes.delete(oldest);
      }
    }
    this.releaseOutcomes.set(reportId, outcome);
    return outcome;
  }

  /** Let a taken report's child run undebugged, by the policy's lever: refuse the request, or attach and detach. */
  private giveUp(held: HeldReport, reason: string, reportId?: string): Promise<ChildReleaseOutcome> {
    let outcomePromise: Promise<ChildReleaseOutcome>;
    if (this.lever() === 'throwaway-attach') {
      outcomePromise = this.releaseByThrowaway(held, reason)
        .then((released): ChildReleaseOutcome => (released ? 'confirmed' : 'unconfirmed'))
        .catch((error: unknown): ChildReleaseOutcome => {
          this.options.logger.error(`[ChildConnections] Failed to release child ${held.report.targetId}: ${error instanceof Error ? error.message : String(error)}`);
          return 'unconfirmed';
        });
      const releasing = outcomePromise
        .then(() => undefined)
        .finally(() => {
          this.releases.delete(releasing);
          this.emitEmptyIfSo();
        });
      this.releases.add(releasing);
    } else {
      try {
        const responder = held.client.respondToReverseRequest;
        if (typeof responder !== 'function') {
          outcomePromise = Promise.resolve('unconfirmed');
        } else {
          const sent = responder.call(held.client, held.request, {}, false, reason);
          outcomePromise = Promise.resolve(sent === false ? 'unconfirmed' : 'confirmed');
        }
      } catch {
        outcomePromise = Promise.resolve('unconfirmed');
      }
    }
    return reportId !== undefined ? this.recordReleaseOutcome(reportId, outcomePromise) : outcomePromise;
  }

  /**
   * A step the child's proxy stepper serves now, or null when it goes to the
   * adapter as it is (issue #1130).
   */
  stepRequest(sessionId: string, command: string, args?: unknown): Promise<DebugProtocol.Response> | null {
    const stepper = this.clients.get(sessionId)?.services?.stepper;
    return stepper?.handles(command, args) ? stepper.request(command, args) : null;
  }

  /**
   * Any other request for the child: one that resumes or ends it ends a
   * step still in flight, and breakpoints on their way to it are looked at
   * for a logpoint (issue #1212: a child that holds one is told when its
   * logpoints cannot be delivered).
   */
  async beforeRequest(sessionId: string, command: string, args?: unknown): Promise<void> {
    const services = this.clients.get(sessionId)?.services;
    if (command === 'setBreakpoints') {
      services?.noteBreakpoints((args as { breakpoints?: unknown[] } | undefined)?.breakpoints);
    }
    await services?.stepper?.beforeRequest(command);
  }

  /**
   * The answer to a `setFunctionBreakpoints` for a child whose adapter has no
   * such request, or null when the request goes to the adapter as it is
   * (issue #1219). An adapter that arms function breakpoints through the CDP
   * bridge (js-debug, issue #295) arms them in the session's own program
   * only: nothing syncs them onto a child's bridge (issue #1226), and the
   * adapter sends nothing back for a request it does not know, so a caller
   * would wait out its deadline. Each one is answered as it is: not armed,
   * with the reason.
   */
  unarmedFunctionBreakpoints(
    sessionId: string,
    command: string,
    args?: unknown
  ): DebugProtocol.SetFunctionBreakpointsResponse | null {
    if (command !== 'setFunctionBreakpoints' || !this.clients.has(sessionId) || !this.functionBreakpointsNeedTheBridge()) {
      return null;
    }
    const asked = (args as { breakpoints?: unknown[] } | undefined)?.breakpoints ?? [];
    return {
      seq: 0,
      type: 'response',
      request_seq: 0,
      command,
      success: true,
      body: {
        breakpoints: asked.map(() => ({ verified: false, message: ErrorMessages.functionBreakpointsNotArmedInChildSession() }))
      }
    };
  }

  /** Whether this adapter's function breakpoints exist only where the CDP bridge is: the session's own program. */
  private functionBreakpointsNeedTheBridge(): boolean {
    return this.options.adoption?.policy.functionBreakpointsVia === 'cdp';
  }

  /**
   * Let go of a child whose adoption failed after configurationDone went
   * out: a disconnect on the connection the target is bound to by then, with
   * the process kept. When the adapter does not acknowledge it (the socket
   * is gone, or the target is not bound to this connection yet and is
   * still pending), the throwaway attach runs as it would have before, so
   * this path releases whatever the old one could. Counted with the
   * releases, so the worker does not stop the adapter underneath it.
   */
  private letGoOnItsConnection(
    deps: ChildAdoptionDeps,
    client: IDapClient,
    held: HeldReport,
    reason: string,
    reportId?: string
  ): Promise<ChildReleaseOutcome> {
    const { logger } = this.options;
    const child = `${held.report.targetId} (${held.report.name})`;
    const outcomePromise = deps.connectionManager
      .disconnect(client, false)
      .then(async (outcome): Promise<ChildReleaseOutcome> => {
        try {
          client.shutdown(`child adoption failed: ${reason}`);
        } catch {
          // best effort
        }
        if (outcome?.answered === false) {
          logger.warn(
            `[ChildConnections] Child ${child}: the adapter did not acknowledge the disconnect after a failed adoption (${outcome.error ?? 'no answer'}); trying the throwaway attach in case the target is still pending`
          );
          const released = await this.releaseByThrowaway(held, `adoption failed: ${reason}`);
          return released ? 'confirmed' : 'unconfirmed';
        }
        logger.warn(
          `[ChildConnections] Child ${child} let go on its own connection (adoption failed: ${reason}) — breakpoints will not bind in that process`
        );
        return 'confirmed';
      })
      .catch((error: unknown): ChildReleaseOutcome => {
        logger.error(`[ChildConnections] Failed to release child ${child}: ${error instanceof Error ? error.message : String(error)}`);
        return 'unconfirmed';
      });
    const releasing = outcomePromise
      .then(() => undefined)
      .finally(() => {
        this.releases.delete(releasing);
        this.emitEmptyIfSo();
      });
    this.releases.add(releasing);
    return reportId !== undefined ? this.recordReleaseOutcome(reportId, outcomePromise) : outcomePromise;
  }

  /**
   * The child's own CDP socket and what the proxy runs on it, for an adapter
   * that hands one out per target (js-debug): the proxy's stepper when the
   * adapter's is kept off (issue #1130), and the channel the child's
   * logpoints are delivered on (issue #1212). One composition, the same the
   * program's own target has. Not fatal: without the socket the child's
   * steps are the engine's plain ones, and the session is told its
   * logpoints are not delivered.
   *
   * A logpoint's line leaves here under the child's session id: it is this
   * process that hit it. Function breakpoints stay unarmed in a child (issue
   * #1219): nothing syncs them onto this socket.
   */
  private startServices(deps: ChildAdoptionDeps, connection: ChildConnection, adopted: readonly unknown[]): void {
    const stepper = deps.policy.getDapClientBehavior().stepsThroughSkippedCode === true;
    const bridge = deps.policy.functionBreakpointsVia === 'cdp';
    if (!stepper && !bridge) {
      return;
    }
    const { client, sessionId } = connection;
    const { logger, cdpClientFactory } = this.options;
    const services = new JsTargetServices({
      stepper,
      bridge,
      sendRequest: (command, args, timeoutMs) => client.sendRequest(command, args, timeoutMs),
      deliverStep: (event) => this.sendEvent(sessionId, event.event, event.body),
      ...(cdpClientFactory ? { cdpClientFactory } : {})
    });
    // The session's choice is the root's: its start request's `smartStep`, a
    // launch's or an attach's. The launch configuration is the fallback for a
    // root that cannot say.
    services.stepper?.setEnabled(
      deps.stepsThroughSkippedCode?.() ?? (deps.launchConfig as { smartStep?: unknown } | undefined)?.smartStep === true
    );
    // Sent as they arrive, never behind `ending`: these lines are what a
    // child's end waits for.
    services.bridge?.on('outputEvent', (event: DebugProtocol.Event) => {
      this.sendEvent(sessionId, 'output', event.body);
    });
    connection.services = services;
    // The breakpoints this child was adopted with went out before the
    // socket existed: say now whether a logpoint was among them.
    services.noteBreakpoints(adopted);
    void services
      .attach({ sendRequest: (command, args, timeoutMs) => client.sendRequest(command, args, timeoutMs) })
      .then(() => {
        logger.info(`[ChildConnections] Child session ${sessionId}: its CDP socket was asked for (stepper ${stepper ? 'on' : 'off'}, logpoint channel ${bridge ? 'on' : 'off'})`);
      });
  }

  private closeServices(connection: ChildConnection): void {
    connection.services?.detach();
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
  private async releaseByThrowaway(held: HeldReport, reason: string): Promise<boolean> {
    const deps = this.options.adoption;
    const contract = deps?.policy.childAdoption;
    const { logger } = this.options;
    if (!deps || !contract) {
      logger.warn(`[ChildConnections] Child ${held.report.targetId} (${held.report.name}) cannot be released: this worker opens no connections; it stays parked`);
      return false;
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
    return released;
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
    // In arrival order, and after a held end once there is one (see `ending`).
    // A link that throws must not take the links after it along: the last
    // one removes the connection, and a root's worker waits for that.
    const held = (send: () => void) => (): void => {
      try {
        send();
      } catch (error) {
        this.options.logger.warn(
          `[ChildConnections] Child session ${sessionId}: a message held behind its end failed to send: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    };
    const inOrder = (send: () => void): void => {
      if (connection.ending) {
        connection.ending = connection.ending.then(held(send));
      } else {
        send();
      }
    };
    for (const event of FORWARDED_CHILD_EVENTS) {
      client.on(event, (body: unknown) => {
        // A step's own pauses and resumes are the stepper's (issue #1130): of
        // their `stopped` events it reports one itself.
        if ((event === 'stopped' || event === 'continued') &&
            connection.services?.stepper?.withholds({ seq: 0, type: 'event', event, body } as DebugProtocol.Event)) {
          return;
        }
        inOrder(() => this.sendEvent(sessionId, event, body));
      });
    }
    client.on('terminated', (body: unknown) => {
      connection.terminatedSeen = true;
      const services = connection.services;
      if (!services?.bridge || connection.closed) {
        inOrder(() => this.sendEvent(sessionId, 'terminated', body));
        return;
      }
      // The child's last logpoint lines come on its CDP socket, and were
      // measured to arrive about 1 ms after this event (issue #1212). The
      // parent takes a child's output until its end: hold the end behind
      // one bounded round trip on that socket.
      const settled = services.settle().catch(() => undefined);
      connection.ending = (connection.ending ?? Promise.resolve())
        .then(() => settled)
        .then(held(() => this.sendEvent(sessionId, 'terminated', body)));
    });
    client.on('error', (error: unknown) => {
      const message: ErrorMessage = {
        type: 'error',
        sessionId,
        message: error instanceof Error ? error.message : String(error)
      };
      this.options.messageSender.send(message);
    });
    // Behind a held end too: closing takes the CDP socket with it, and the
    // connection counts as live until its end has been reported.
    client.on('close', () => inOrder(() => this.onConnectionClosed(connection)));
  }

  private onConnectionClosed(connection: ChildConnection): void {
    this.closeServices(connection);
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
      // The form every route sends a breakpoint's file under (issue #1147).
      const file = dapSourcePath(breakpoint.file);
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
    if (this.functionBreakpointsNeedTheBridge()) {
      // Nothing to send (issue #1219): the adapter has no such request and
      // would leave it unanswered. The parent's copies are reported as
      // they are in this child: not armed.
      const message: StatusMessage = {
        type: 'status',
        status: 'function_breakpoints_synced',
        sessionId,
        functionBreakpoints: functionBreakpoints.map((bp) => ({
          name: bp.name,
          verified: false,
          message: ErrorMessages.functionBreakpointsNotArmedInChildSession()
        }))
      };
      this.options.messageSender.send(message);
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
