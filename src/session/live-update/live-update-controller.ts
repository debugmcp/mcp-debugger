/**
 * `hot_reload`: apply changed code to the running program and keep its state — the adapter's
 * own live update, behind the one policy member `liveUpdate` (issue #876). Java implements it
 * with the JDI bridge's `redefineClasses` (HotSwap; the former `redefine_classes` tool, kept as a
 * deprecated alias); Flutter with the SDK adapter's `hotReload`, gated on the app having started.
 *
 * The DAP round trip is the easy half. The interesting half is what a live update does to
 * breakpoints: new code invalidates line numbers, so statement anchors — content identities, not
 * line numbers — are re-resolved against the source now on disk and the affected files re-sent,
 * so the adapter binds against the NEW line table (issue #464). And a Flutter reload may stop the
 * program before it answers (the reassemble runs `build()`, a breakpoint there fires ~150 ms after
 * the request, and the response is held until the isolate resumes on some platforms — measured),
 * so for such adapters the answer races the stop against the response the way a launch answer
 * does: a short hold, then the landing and the snapshot, or `pending`.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import { SessionState, isSettledSessionState, type HotReloadArgs, type LiveUpdatePolicy } from '@debugmcp/shared';
import { getErrorMessage } from '../../errors/debug-errors.js';
import { ErrorMessages } from '../../utils/error-messages.js';
import { resolveDapTimeoutOverride, withTimeoutHint } from '../dap-request-helpers.js';
import { reresolveAnchors, type AnchorResolution } from '../breakpoints/anchor-resolution.js';
import type { BreakpointController } from '../breakpoints/breakpoint-controller.js';
import type { ManagedSession } from '../session-store.js';
import type { LaunchContext } from '../operations-context.js';
import { waitForSessionState } from '../execution/session-state-wait.js';
import { describeStopLocation, landingFields, type StopLanding } from '../inspection/stop-location.js';
import { composeStopSnapshot } from '../inspection/stop-snapshot.js';

/** What a live update touches: the adapter's answer, the anchors, the session's stop. */
export type LiveUpdateContext = LaunchContext;

/**
 * The `hot_reload` answer. The adapter's own response body is spread in (Java: `redefined`,
 * `redefinedCount`, `skippedNotLoaded`, `failedCount`, `failed`, `scannedFiles`,
 * `newestTimestamp`, `replantedBreakpoints` — the former `redefine_classes` answer, unchanged),
 * beside the fields every update answers.
 */
export interface HotReloadResult {
  success: boolean;
  error?: string;
  /** The session's state when answered: a Flutter reload may have stopped the program. */
  state?: SessionState;
  /** The stop's reason when `state` is paused. */
  reason?: string;
  /** The update went out and neither a stop nor its response arrived within the hold. */
  pending?: boolean;
  /** A note on what the update did or did not do yet (a reload sent to a paused program). */
  note?: string;
  /** Statement-anchored breakpoints re-resolved against the new source (issue #464). */
  anchorResolution?: AnchorResolution;
  warning?: string;
  [key: string]: unknown;
}

export class LiveUpdateController {
  constructor(
    private readonly ctx: LiveUpdateContext,
    private readonly breakpoints: BreakpointController
  ) {}

  async hotReload(sessionId: string, args: HotReloadArgs = {}, timeoutMs?: number): Promise<HotReloadResult> {
    const session = this.ctx.getSession(sessionId);
    const live = this.ctx.selectPolicy(session.language).liveUpdate;
    if (!live) {
      return { success: false, state: session.state, error: ErrorMessages.hotReloadNotSupported(session.language) };
    }
    const timeoutOverride = resolveDapTimeoutOverride(timeoutMs, `SM hotReload ${sessionId}`, this.ctx.logger);
    if (timeoutOverride.error) {
      this.ctx.logger.warn(`[SM hotReload ${sessionId}] ${timeoutOverride.error}`);
      return { success: false, error: timeoutOverride.error };
    }
    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      return { success: false, error: 'No active debug session' };
    }
    // The policy's own refusal: before anything reaches the adapter.
    const plan = live.request(args, session.liveUpdateState);
    if ('refused' in plan) {
      return { success: false, state: session.state, error: plan.refused };
    }
    this.ctx.logger.info(`[SM hotReload ${sessionId}] sending ${plan.command} ${JSON.stringify(plan.args ?? {})}`);
    const proxyManager = session.proxyManager;
    const send = (): Promise<DebugProtocol.Response> =>
      timeoutOverride.timeoutMs !== undefined
        ? proxyManager.sendDapRequest<DebugProtocol.Response>(plan.command, plan.args ?? {}, { timeoutMs: timeoutOverride.timeoutMs })
        : proxyManager.sendDapRequest<DebugProtocol.Response>(plan.command, plan.args ?? {});

    if (!live.mayStopDuringUpdate || session.state === SessionState.PAUSED) {
      // Java: the swap answers and the program is where it was. A Flutter reload sent to a
      // paused program answers at once and reassembles when the program resumes (measured):
      // the same shape, with a note.
      return this.answerResponse(session, live, plan.command, send, session.state === SessionState.PAUSED && live.mayStopDuringUpdate === true);
    }

    // The program is running and the update may stop it before it answers: race the stop
    // against the response under the launch hold (issues #823, #826), and never wait on a
    // response the stop itself may be holding back.
    const response = send().then(
      (r) => ({ kind: 'response' as const, response: r }),
      (error: unknown) => ({ kind: 'error' as const, error })
    );
    const hold = waitForSessionState(this.ctx, sessionId, isSettledSessionState, { timeoutMs: this.ctx.tunables.launchHoldMs })
      .then(() => ({ kind: 'hold' as const }));
    const first = await Promise.race([response, hold]);
    if (first.kind === 'error') {
      return { success: false, state: this.ctx.getSession(sessionId).state, error: withTimeoutHint(getErrorMessage(first.error)) };
    }
    if (first.kind === 'response') {
      // Answered first: the stop, if the reassemble lands on one, follows within the hold.
      await waitForSessionState(this.ctx, sessionId, isSettledSessionState, { timeoutMs: this.ctx.tunables.launchHoldMs });
    } else {
      // The stop (or the hold) came first; the response is collected when it arrives.
      void response.then((settled) => {
        if (settled.kind === 'error') {
          this.ctx.logger.warn(`[SM hotReload ${sessionId}] ${plan.command} answered an error after the stop: ${getErrorMessage(settled.error)}`);
        } else {
          this.ctx.logger.info(`[SM hotReload ${sessionId}] ${plan.command} answered after the stop`);
        }
      });
    }
    const current = this.ctx.getSession(sessionId);
    const after = await this.afterUpdate(current, live, first.kind === 'response' ? first.response : undefined);
    const body = first.kind === 'response' ? ((first.response?.body ?? {}) as Record<string, unknown>) : {};
    return {
      success: true,
      ...body,
      ...after,
      ...(await this.describeState(current, first.kind !== 'response')),
    };
  }

  /** The plain path: await the response and answer it, with the anchor pass when code changed. */
  private async answerResponse(
    session: ManagedSession,
    live: LiveUpdatePolicy,
    command: string,
    send: () => Promise<DebugProtocol.Response>,
    reloadWhilePaused: boolean
  ): Promise<HotReloadResult> {
    const sessionId = session.id;
    try {
      const response = await send();
      const body = response?.body as Record<string, unknown> | undefined;
      if (!body) {
        return { success: false, error: `No response body from ${command}` };
      }
      const after = await this.afterUpdate(this.ctx.getSession(sessionId), live, response);
      return {
        success: true,
        ...body,
        ...after,
        state: this.ctx.getSession(sessionId).state,
        ...(reloadWhilePaused
          ? { note: 'The program is paused: the reloaded code runs when it resumes (continue_execution). A breakpoint the reassemble reaches is then reported as a stop.' }
          : {}),
      };
    } catch (error) {
      this.ctx.logger.error(`[SM hotReload ${sessionId}] Error: ${getErrorMessage(error)}`);
      return { success: false, error: withTimeoutHint(getErrorMessage(error)) };
    }
  }

  /**
   * Statement anchors are content identities and new code invalidates line numbers (issue
   * #464): re-resolve them against the source on disk — which IS what the edit → recompile →
   * reload loop just changed — and re-send the affected files so the adapter binds the moved
   * lines against the new line table. After the update by construction.
   */
  private async afterUpdate(
    session: ManagedSession,
    live: LiveUpdatePolicy,
    response: DebugProtocol.Response | undefined
  ): Promise<Pick<HotReloadResult, 'anchorResolution' | 'warning'>> {
    if (!live.changed(response)) {
      return {};
    }
    const anchorResolution = await reresolveAnchors(session, this.ctx);
    const warnings: string[] = [];
    if (anchorResolution && anchorResolution.moved.length > 0) {
      const movedFiles = [...new Set(anchorResolution.moved.map((m) => m.file))];
      for (const file of movedFiles) {
        const { warning } = await this.breakpoints.syncBreakpointsForFile(session, file);
        if (warning) {
          warnings.push(warning);
        }
      }
    }
    if (anchorResolution && anchorResolution.stale.length > 0) {
      warnings.push(
        `${anchorResolution.stale.length} statement-anchored breakpoint(s) could not be re-resolved ` +
        'against the new source and keep their previous line — see anchorResolution.stale'
      );
    }
    return {
      ...(anchorResolution ? { anchorResolution } : {}),
      ...(warnings.length > 0 ? { warning: warnings.join('; ') } : {}),
    };
  }

  /** The session's state for the answer: the landing and snapshot of a stop, or `pending` while running. */
  private async describeState(session: ManagedSession, raced: boolean): Promise<Partial<HotReloadResult>> {
    const state = session.state;
    if (state === SessionState.PAUSED) {
      const landing: StopLanding = await describeStopLocation(this.ctx, session.id, 'launch');
      const snapshot = await composeStopSnapshot(this.ctx, session.id, landing.stackResult, 'launch');
      return {
        state,
        reason: session.lastStop?.reason ?? 'unknown',
        ...landingFields(landing),
        ...(snapshot ? { snapshot } : {}),
      };
    }
    if (state === SessionState.RUNNING && raced) {
      return {
        state,
        pending: true,
        note: 'The update went out and the program is still running: no stop within the hold. Call wait_for_stop for a stop it may land on, or read get_output.',
      };
    }
    return { state };
  }
}
