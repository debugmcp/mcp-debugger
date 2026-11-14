import { SessionState, type AdapterPolicy, type ILogger } from '@debugmcp/shared';
import type { IProxyManager } from '../../proxy/proxy-manager.js';
import type { ManagedSession } from '../session-store.js';
import { isDapRequestTimeout } from '../dap-request-helpers.js';
import { armPauseIntent, clearPauseIntent, getCurrentPauseIntent, type PauseIntent } from './pause-intent.js';

/**
 * How long the wake evaluation may take before the pause is requested without
 * its answer (issue #1146). A target busy in native code answers neither; the
 * evaluation stays queued ahead of the pause there, so the order still holds.
 */
const PAUSE_WAKE_TIMEOUT_MS = 1000;

export type PauseOutcome =
  | { status: 'observed' }
  | { status: 'pending' }
  | { status: 'rejected'; error: unknown; ended?: true };

export interface CoordinatePauseInput {
  session: ManagedSession;
  proxyManager: IProxyManager;
  threadId: number;
  timeoutMs: number;
  source: 'user' | 'attach';
}

export interface PauseCoordinatorContext {
  logger: ILogger;
  selectPolicy(language: ManagedSession['language']): AdapterPolicy;
}

/**
 * Own the low-level pause race shared by pause_execution and attach.
 * Listeners and generation-scoped intent are installed before the request;
 * callers decide how the three outcomes map onto their public result shape.
 *
 * A pause is real or absent (issue #1146): for a policy with a wake
 * expression the coordinator first gives the program something to run, so
 * the pause lands on the program's own event loop instead of staying armed
 * for whatever the debugger evaluates next.
 */
export class PauseCoordinator {
  constructor(private readonly ctx: PauseCoordinatorContext) {}

  async requestPause(input: CoordinatePauseInput): Promise<PauseOutcome> {
    const { session, proxyManager, threadId, timeoutMs, source } = input;

    // A stop may have landed while the caller was discovering a thread.
    if (session.state === SessionState.PAUSED) {
      clearPauseIntent(session);
      return { status: 'observed' };
    }
    const sessionPaused = () => session.state === SessionState.PAUSED;

    let stoppedSeen = false;
    let endedSeen = false;
    let resolveEvent: ((value: 'stopped' | 'ended') => void) | undefined;
    let event = new Promise<'stopped' | 'ended'>((resolve) => {
      resolveEvent = resolve;
    });
    const onStopped = () => {
      stoppedSeen = true;
      resolveEvent?.('stopped');
    };
    const onEnded = () => {
      endedSeen = true;
      resolveEvent?.('ended');
    };

    // Listener registration precedes the wake, the intent and the request.
    proxyManager.on('stopped', onStopped);
    proxyManager.on('terminated', onEnded);
    proxyManager.on('exited', onEnded);
    proxyManager.on('exit', onEnded);
    let intent: PauseIntent | undefined;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      proxyManager.off('stopped', onStopped);
      proxyManager.off('terminated', onEnded);
      proxyManager.off('exited', onEnded);
      proxyManager.off('exit', onEnded);
    };
    const observed = (): PauseOutcome => {
      clearPauseIntent(session, intent);
      return { status: 'observed' };
    };
    const rejected = (error: unknown, ended = false): PauseOutcome => {
      clearPauseIntent(session, intent);
      return { status: 'rejected', error, ...(ended ? { ended: true as const } : {}) };
    };
    /**
     * A pause request that got no answer is not a refusal: it may still be
     * queued in a target busy in native code, and arms when that returns.
     * Where breakpoint requests wait on the intent (issue #1146) it stays, so
     * they keep waiting and the stop it produces is still read as this
     * pause. Elsewhere it is cleared as before: a stale intent would relabel
     * some later, unrelated stop.
     */
    const unanswered = (error: unknown): PauseOutcome =>
      this.holdsBreakpointsOnIntent(session) ? { status: 'rejected', error } : rejected(error);

    try {
      // An intent that is still armed is a pause waiting in the target, and
      // the wake is itself an evaluation: exactly what that pause fires in.
      if (getCurrentPauseIntent(session) === undefined) {
        await this.wakeBeforePause(session, proxyManager);
        if (sessionPaused() && session.lastStop) {
          return observed();
        }
        if (endedSeen) {
          return rejected(new Error('Session ended before pause took effect'), true);
        }
        if (stoppedSeen) {
          // A stop came and went during the wake: no intent was armed, so
          // the core treated it as its own (it auto-continues a launch's
          // entry stop). It is not this pause's answer; listen afresh.
          stoppedSeen = false;
          event = new Promise<'stopped' | 'ended'>((resolve) => {
            resolveEvent = resolve;
          });
        }
      }
      intent = armPauseIntent(session, source);

      const request = proxyManager
        .sendDapRequest('pause', { threadId })
        .then(() => ({ kind: 'accepted' as const }))
        .catch((error: unknown) => ({ kind: 'rejected' as const, error }));

      const first = await Promise.race([
        event.then((kind) => ({ kind } as const)),
        request
      ]);

      if (first.kind === 'stopped') {
        return observed();
      }
      if (first.kind === 'ended') {
        return rejected(new Error('Session ended before pause took effect'), true);
      }
      if (first.kind === 'rejected') {
        if (stoppedSeen || (sessionPaused() && session.lastStop)) {
          return observed();
        }
        const message = first.error instanceof Error ? first.error.message : String(first.error);
        return isDapRequestTimeout(message) ? unanswered(first.error) : rejected(first.error);
      }

      this.ctx.logger.info(
        `[PauseCoordinator] DAP pause accepted for session ${session.id}; waiting for stopped event`
      );
      if (stoppedSeen || (sessionPaused() && session.lastStop)) {
        return observed();
      }
      if (endedSeen) {
        return rejected(new Error('Session ended before pause took effect'), true);
      }

      const afterAcceptance = await Promise.race([
        event,
        new Promise<'timeout'>((resolve) => {
          timeout = setTimeout(() => resolve('timeout'), timeoutMs);
        })
      ]);
      if (afterAcceptance === 'stopped') {
        return observed();
      }
      if (afterAcceptance === 'ended') {
        return rejected(new Error('Session ended before pause took effect'), true);
      }

      // A delivered pause may stop later when the target next executes. Keep
      // this exact generation's intent armed for core stop normalization.
      return { status: 'pending' };
    } finally {
      cleanup();
    }
  }

  /** Whether the session's policy holds breakpoint requests on an armed pause (issue #1146). Never throws. */
  private holdsBreakpointsOnIntent(session: ManagedSession): boolean {
    try {
      return this.ctx.selectPolicy(session.language).holdsBreakpointsWhilePauseArmed === true;
    } catch {
      return false;
    }
  }

  /**
   * Give an idle program something to run before the pause is requested
   * (issue #1146). Never throws and never waits long: a wake that is refused
   * or unanswered costs the pause nothing but its help.
   */
  private async wakeBeforePause(session: ManagedSession, proxyManager: IProxyManager): Promise<void> {
    let expression: string | undefined;
    try {
      expression = this.ctx.selectPolicy(session.language).pauseWakeExpression;
    } catch {
      return;
    }
    if (!expression) {
      return;
    }
    try {
      await proxyManager.sendDapRequest(
        'evaluate',
        { expression, context: 'repl' },
        { timeoutMs: PAUSE_WAKE_TIMEOUT_MS }
      );
    } catch (error) {
      this.ctx.logger.info(
        `[PauseCoordinator] Wake evaluation before pause got no usable answer for session ${session.id} (${error instanceof Error ? error.message : String(error)}); requesting the pause without it`
      );
    }
  }
}
