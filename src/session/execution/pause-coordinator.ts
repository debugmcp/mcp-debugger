import { SessionState, type ILogger } from '@debugmcp/shared';
import type { IProxyManager } from '../../proxy/proxy-manager.js';
import type { ManagedSession } from '../session-store.js';
import { armPauseIntent, clearPauseIntent } from './pause-intent.js';

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
}

/**
 * Own the low-level pause race shared by pause_execution and attach.
 * Listeners and generation-scoped intent are installed before the request;
 * callers decide how the three outcomes map onto their public result shape.
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
    const event = new Promise<'stopped' | 'ended'>((resolve) => {
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

    // Listener registration precedes both intent and request dispatch.
    proxyManager.on('stopped', onStopped);
    proxyManager.on('terminated', onEnded);
    proxyManager.on('exited', onEnded);
    proxyManager.on('exit', onEnded);
    const intent = armPauseIntent(session, source);

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

    try {
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
        return rejected(first.error);
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
}
