/**
 * What makes an attach *real* before it is reported as PAUSED.
 *
 * A completed attach handshake proves only that the adapter accepted the
 * request. `verifyAttachThreads` polls DAP 'threads' until the debugger
 * reports at least one — a debugger that cannot enumerate any threads after
 * attach is not usable, and reporting success would be a lie (issue #124) —
 * and latches the first proxy error/exit so an adapter that dies mid-verify
 * fails fast with its own message rather than a generic "not initialized".
 * `pauseAfterAttach` then suspends targets whose debugger does not stop them
 * on attach (rdbg; js-debug with continueOnAttach), waiting for the stop to be
 * observed so the PAUSED state is real when it is reported.
 */
import type { AdapterPolicy } from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
import type { ManagedSession } from '../session-store.js';
import type { OperationsContext } from '../operations-context.js';

/** The policy's attach behaviour, as `getAttachBehavior()` declares it. */
export type AttachBehavior = NonNullable<ReturnType<NonNullable<AdapterPolicy['getAttachBehavior']>>>;

/** Thread verification narrates its attempts; the post-attach pause reads its stop window. */
export type AttachVerificationContext = Pick<OperationsContext, 'logger' | 'tunables'>;

export interface AttachVerifyInput {
  proxyManager: NonNullable<ManagedSession['proxyManager']>;
  /** The verification window (the caller's override, else the tunable). */
  verifyTimeoutMs: number;
  pollIntervalMs: number;
}

/**
 * Either the threads the debugger reported, or why it never did — with
 * `proxyGone` distinguishing "the adapter died" from "the deadline passed".
 */
export type AttachVerifyResult =
  | { ok: true; threads: DebugProtocol.Thread[] }
  | { ok: false; proxyGone: boolean; lastFailure: string };

/**
 * Poll DAP 'threads' until the debugger reports at least one thread or the
 * verification window closes. Never throws: every failure mode is a result.
 */
export async function verifyAttachThreads(
  ctx: AttachVerificationContext,
  input: AttachVerifyInput
): Promise<AttachVerifyResult> {
  const { proxyManager, verifyTimeoutMs, pollIntervalMs } = input;
    const deadline = Date.now() + verifyTimeoutMs;

    let threads: DebugProtocol.Thread[] | undefined;
    let lastFailure = 'no threads response received';

    // Some adapters reject the attach only after reporting themselves
    // configured (CodeLLDB does this for e.g. ptrace EPERM). The proxy
    // then dies mid-verify and every remaining 'threads' poll would throw
    // a generic "Proxy not initialized", masking the real error — so latch
    // the first proxy error/exit as the failure and stop polling.
    let proxyGone = false;
    const onProxyError = (err: Error): void => {
      if (!proxyGone) {
        proxyGone = true;
        lastFailure = err.message;
      }
    };
    const onProxyExit = (code: number | null, signal?: string): void => {
      if (!proxyGone) {
        proxyGone = true;
        lastFailure = `debug adapter exited during attach verification (code=${code}${signal ? `, signal=${signal}` : ''})`;
      }
    };
    proxyManager.on('error', onProxyError);
    proxyManager.on('exit', onProxyExit);

    const requestThreads = async (): Promise<void> => {
      const remainingMs = Math.max(deadline - Date.now(), 1);
      const threadsResponse = await sendThreadsRequestBounded(proxyManager, remainingMs);
      if (proxyGone) {
        return;
      }
      if (threadsResponse?.success === false) {
        lastFailure = threadsResponse.message || `'threads' request failed`;
        return;
      }
      const reported = threadsResponse?.body?.threads;
      if (Array.isArray(reported) && reported.length > 0) {
        threads = reported;
      } else {
        lastFailure = 'debugger reported zero threads';
      }
    };

    try {
      // First discovery attempt.
      try {
        await requestThreads();
      } catch (err) {
        if (!proxyGone) {
          lastFailure = err instanceof Error ? err.message : String(err);
        }
        ctx.logger.warn(`[SessionManager] Initial thread discovery for attach failed: ${lastFailure}`);
      }

      // Retry until the deadline if the debugger has not reported threads yet.
      while (!threads && !proxyGone && Date.now() < deadline) {
        const sleepMs = Math.min(pollIntervalMs, Math.max(deadline - Date.now(), 1));
        await new Promise((resolve) => setTimeout(resolve, sleepMs));
        if (proxyGone || Date.now() >= deadline) {
          break;
        }
        try {
          await requestThreads();
        } catch (err) {
          if (!proxyGone) {
            lastFailure = err instanceof Error ? err.message : String(err);
          }
        }
      }
    } finally {
      proxyManager.removeListener('error', onProxyError);
      proxyManager.removeListener('exit', onProxyExit);
    }

  if (!threads) {
    return { ok: false, proxyGone, lastFailure };
  }
  return { ok: true, threads };
}

/**
 * Send a DAP 'threads' request bounded by a timeout so a hung request
 * cannot stall attach verification past its deadline. The underlying
 * request keeps its own lifecycle; only the wait here is bounded.
 */
export async function sendThreadsRequestBounded(
  proxyManager: NonNullable<ManagedSession['proxyManager']>,
  timeoutMs: number
): Promise<DebugProtocol.ThreadsResponse | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      proxyManager.sendDapRequest<DebugProtocol.ThreadsResponse>('threads', {}),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`'threads' request did not respond within ${timeoutMs}ms`)),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export interface PauseAfterAttachInput {
  proxyManager: NonNullable<ManagedSession['proxyManager']>;
  /** The policy's attach behaviour; only consulted when `pauseAfterAttach` is set. */
  attachBehavior: AttachBehavior;
  /** The thread verification settled on; the pause targets it unless the policy pauses all. */
  discoveredThreadId: number;
}

/**
 * Issue the explicit post-attach pause and wait (bounded by the
 * `attachPauseStopTimeoutMs` tunable) for the resulting 'stopped' event. A
 * rejected pause means the target is already stopped — fine, no stop event
 * will follow.
 */
export async function pauseAfterAttach(
  ctx: AttachVerificationContext,
  input: PauseAfterAttachInput
): Promise<void> {
  const { proxyManager, attachBehavior, discoveredThreadId } = input;
    let stopSettled = false;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    let onStopped: (() => void) | undefined;
    const stoppedSeen = new Promise<boolean>((resolve) => {
      onStopped = () => {
        if (!stopSettled) {
          stopSettled = true;
          if (stopTimer) clearTimeout(stopTimer);
          resolve(true);
        }
      };
      stopTimer = setTimeout(() => {
        if (!stopSettled) {
          stopSettled = true;
          resolve(false);
        }
      }, ctx.tunables.attachPauseStopTimeoutMs);
      proxyManager.once('stopped', onStopped);
    });
    try {
      // pauseAllThreads (issue #465): threadId 0 asks the adapter for a
      // process-wide suspend — the JDI bridge then re-anchors its
      // stopped event to a thread that can actually report frames,
      // instead of single-thread-suspending whichever id we picked.
      const pauseThreadId = attachBehavior.pauseAllThreads ? 0 : discoveredThreadId;
      await proxyManager.sendDapRequest('pause', { threadId: pauseThreadId });
      ctx.logger.info(`[SessionManager] Sent post-attach pause (threadId=${pauseThreadId})`);
      const stopObserved = await stoppedSeen;
      if (!stopObserved) {
        ctx.logger.warn(
          `[SessionManager] No 'stopped' event within ${ctx.tunables.attachPauseStopTimeoutMs}ms after post-attach pause; reported state may lag the engine`
        );
      }
    } catch (err) {
      // Already stopped (e.g. target was started suspended) — fine.
      ctx.logger.info(
        `[SessionManager] Post-attach pause not needed/accepted: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      stopSettled = true;
      if (stopTimer) clearTimeout(stopTimer);
      if (onStopped) proxyManager.removeListener('stopped', onStopped);
    }
}
