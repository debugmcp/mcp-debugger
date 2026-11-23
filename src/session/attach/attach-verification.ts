/**
 * What makes an attach real before success is reported, with or without a pause.
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
import { lastAdapterStderrLine, quotesAdapterStderrLine } from '../launch/proxy-failure-diagnostics.js';

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

/** What the window's own timer resolves with: told apart from any response. */
const WINDOW_CLOSED = Symbol('attach verification window closed');
/** What a latched proxy error/exit resolves with so in-flight waits end at once. */
const PROXY_GONE = Symbol('attach verification proxy gone');
/** How long past its bound a probe's own answer is still waited for (the worker's timeout crossing the IPC channel). */
const PROBE_ANSWER_GRACE_MS = 250;

/**
 * Poll DAP 'threads' until the debugger reports at least one thread or the
 * verification window closes. Never throws: every failure mode is a result.
 * Returns by the window's end (plus a short grace) whatever the worker does.
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
    let notifyProxyGone!: () => void;
    const gone = new Promise<typeof PROXY_GONE>((resolve) => {
      notifyProxyGone = () => resolve(PROXY_GONE);
    });
    const onProxyError = (err: Error): void => {
      if (!proxyGone) {
        proxyGone = true;
        lastFailure = err.message;
        notifyProxyGone();
      }
    };
    // How the adapter ended, in its own terms (issue #897): a real process
    // exit always carries a code or a signal, so a codeless unexpected exit
    // is the socket dropping (js-debug does that after "Could not connect to
    // debug target", with its process still alive); an expected one is the
    // target ending under the debugger's feet. The proxy worker's own exit
    // arrives through the same event and reads as an adapter exit here, as
    // it always has.
    const onProxyExit = (code: number | null, signal?: string, expected?: boolean): void => {
      if (!proxyGone) {
        proxyGone = true;
        lastFailure = expected === true
          ? 'it reported the session as ended'
          : code === null && !signal
            ? 'it closed its DAP connection'
            : `it exited (code=${code}${signal ? `, signal=${signal}` : ''})`;
        notifyProxyGone();
      }
    };
    proxyManager.on('error', onProxyError);
    proxyManager.on('exit', onProxyExit);

    const requestThreads = async (): Promise<void> => {
      const remainingMs = Math.max(deadline - Date.now(), 1);
      const probe = sendThreadsRequestBounded(proxyManager, remainingMs);
      // The window is the caller's (issue #1213). The request's own bound is
      // kept by the worker; a worker that answers nothing at all is caught
      // only by the parent's backstop, a margin later, and its error then
      // named a longer time than the window that had been asked for
      // ("within 20000ms (last failure: … within 25s)"). So the wait ends
      // with the window — or the moment the proxy reports an error or exit —
      // while the worker's own answer, a little after its bound, still gets
      // the grace to arrive and be the failure that is quoted.
      let windowClosed: NodeJS.Timeout | undefined;
      const closed = new Promise<typeof WINDOW_CLOSED>((resolve) => {
        windowClosed = setTimeout(() => resolve(WINDOW_CLOSED), remainingMs + PROBE_ANSWER_GRACE_MS);
      });
      let threadsResponse: DebugProtocol.ThreadsResponse | undefined;
      try {
        const settled = await Promise.race([probe, closed, gone]);
        if (settled === WINDOW_CLOSED || settled === PROXY_GONE) {
          // Nobody waits for it any more; its late rejection is not an error of this call.
          probe.catch(() => undefined);
          if (settled === WINDOW_CLOSED && !proxyGone) {
            lastFailure = `the debug adapter did not answer 'threads' before the window closed`;
          }
          return;
        }
        threadsResponse = settled;
      } finally {
        clearTimeout(windowClosed);
      }
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
        let sleepTimer: NodeJS.Timeout | undefined;
        try {
          await Promise.race([
            new Promise<void>((resolve) => {
              sleepTimer = setTimeout(resolve, sleepMs);
            }),
            gone
          ]);
        } finally {
          clearTimeout(sleepTimer);
        }
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
    if (proxyGone) {
      // Read now rather than in the handler: the in-flight 'threads' request
      // settles only once the parent has processed the worker's last message,
      // which is the one that carries the tail (issue #897).
      const line = lastAdapterStderrLine(proxyManager.getAdapterStderrTail?.());
      if (line && !quotesAdapterStderrLine(lastFailure, line)) {
        lastFailure = `${lastFailure}; its last stderr line: "${line}"`;
      }
    }
    return { ok: false, proxyGone, lastFailure };
  }
  return { ok: true, threads };
}

/**
 * Send a DAP 'threads' request bounded by the remaining verification window.
 *
 * The bound is passed to the request itself (`timeoutMs`, honoured end to end
 * by the worker's request tracker): a request its own deadline ends is then
 * cancelled everywhere, instead of sitting in the ProxyManager's pending set
 * for the verify-failure stop() to drain.
 *
 * `verifyAttachThreads` also stops waiting when the window closes (issue
 * #1213). That only ever abandons a request in the one case the bound cannot
 * cover, a worker that answers nothing at all, and there the price named
 * above is paid on purpose: the stop() that follows drains the abandoned
 * request for stopDrainTimeoutMs and logs it as still pending. It is paid
 * once, in a teardown that already has to wait out an unresponsive worker,
 * and it is less than the five seconds the parent's backstop used to add to
 * the verification itself.
 */
export async function sendThreadsRequestBounded(
  proxyManager: NonNullable<ManagedSession['proxyManager']>,
  timeoutMs: number
): Promise<DebugProtocol.ThreadsResponse | undefined> {
  return proxyManager.sendDapRequest<DebugProtocol.ThreadsResponse>('threads', {}, { timeoutMs });
}
