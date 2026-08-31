/**
 * What makes an attach *real* before it is reported as PAUSED.
 *
 * A completed attach handshake proves only that the adapter accepted the
 * request. `verifyAttachThreads` polls DAP 'threads' until the debugger
 * reports at least one — a debugger that cannot enumerate any threads after
 * attach is not usable, and reporting success would be a lie (issue #124) —
 * and latches the first proxy error/exit so an adapter that dies mid-verify
 * fails fast with its own message rather than a generic "not initialized".
 * Post-attach suspension is coordinated separately by `PauseCoordinator` so
 * attach and the public pause tool share one event-ordering contract.
 */
import { DebugProtocol } from '@vscode/debugprotocol';
import type { ManagedSession } from '../session-store.js';
import type { OperationsContext } from '../operations-context.js';

/** Thread verification narrates its attempts. */
export type AttachVerificationContext = Pick<OperationsContext, 'logger'>;

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
 * Send a DAP 'threads' request bounded by the remaining verification window.
 *
 * The bound is passed to the request itself (`timeoutMs`, honoured end to end
 * by the worker's request tracker) rather than raced against a local timer:
 * a request the deadline abandons is then cancelled everywhere, instead of
 * sitting in the ProxyManager's pending set for the verify-failure stop() to
 * drain — a full stopDrainTimeoutMs wait ending in a spurious "still pending"
 * warning for a request nobody was waiting on.
 */
export async function sendThreadsRequestBounded(
  proxyManager: NonNullable<ManagedSession['proxyManager']>,
  timeoutMs: number
): Promise<DebugProtocol.ThreadsResponse | undefined> {
  return proxyManager.sendDapRequest<DebugProtocol.ThreadsResponse>('threads', {}, { timeoutMs });
}
