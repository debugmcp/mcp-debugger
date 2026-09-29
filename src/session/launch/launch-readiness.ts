/**
 * The wait between "the proxy has started" and "the launch is reportable":
 * the adapter's first stop, or its configured-and-running state when the
 * policy says that is ready, or the debuggee ending before either — or the
 * caller's ceiling running out, in which case the launch is reported as it is.
 *
 * Never rejects. Every outcome resolves, with a word on how it settled, so
 * the caller can say "still running" for a ceiling rather than failing a
 * launch that is merely slow (issue #815). The ceiling is the caller's: every
 * policy but js-debug is ready only on a pause, and the real proxy reports
 * adapter-configured before this wait can listen, so a launch with nothing
 * armed to stop it would otherwise sit out the full 30 s. `session.proxyManager`
 * is read lazily on every access because a terminal event handler may null
 * it while the wait is in flight.
 */
import { SessionState, type AdapterPolicy } from '@debugmcp/shared';
import { ErrorMessages } from '../../utils/error-messages.js';
import type { CustomLaunchRequestArguments } from '../session-manager-core.js';
import type { ManagedSession } from '../session-store.js';
import type { OperationsContext } from '../operations-context.js';

/** The readiness wait re-reads the session's state and narrates how it settled. */
export type LaunchReadinessContext = Pick<OperationsContext, 'logger' | 'getSession'>;

/**
 * How the wait settled: the first stop, the configured-and-running state the
 * policy accepts, the debuggee or proxy ending, the ceiling running out, or a
 * session that was already terminal when the wait began.
 */
export type LaunchReadinessOutcome = 'stopped' | 'configured' | 'ended' | 'ceiling' | 'already-terminal';

export interface LaunchReadinessInput {
  session: ManagedSession;
  sessionId: string;
  /** The session's adapter policy, for its readiness criteria when it has any. */
  policy: AdapterPolicy;
  dapLaunchArgs?: Partial<CustomLaunchRequestArguments>;
  /**
   * How long the first stop gets before the launch is answered as it is: the
   * launcher's arming decides (issue #815) — the full ceiling when something
   * can stop the program, a short grace window when nothing can.
   */
  ceilingMs: number;
}

/**
 * Wait for the adapter to be configured, the first stop event, termination,
 * or the ceiling.
 */
export function waitForLaunchReadiness(
  ctx: LaunchReadinessContext,
  input: LaunchReadinessInput
): Promise<LaunchReadinessOutcome> {
  const { session, sessionId, policy, dapLaunchArgs, ceilingMs } = input;
  return new Promise<LaunchReadinessOutcome>((resolve) => {
      let resolved = false;
      // eslint-disable-next-line prefer-const -- assigned after cleanup/handlers are defined
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        session.proxyManager?.removeListener('stopped', handleStopped);
        session.proxyManager?.removeListener('adapter-configured', handleConfigured);
        session.proxyManager?.removeListener('terminated', handleTerminated);
        session.proxyManager?.removeListener('exited', handleExited);
        session.proxyManager?.removeListener('exit', handleExit);
      };

      const settle = (outcome: LaunchReadinessOutcome, narration: string) => {
        if (resolved) {
          return;
        }
        resolved = true;
        cleanup();
        ctx.logger.info(`[SessionManager] Session ${sessionId} ${narration}`);
        resolve(outcome);
      };

      const handleStopped = () => settle('stopped', 'stopped on entry');

      const handleConfigured = () => {
        const readyOnRunning = policy.isSessionReady
          ? policy.isSessionReady(SessionState.RUNNING, { stopOnEntry: dapLaunchArgs?.stopOnEntry })
          : !dapLaunchArgs?.stopOnEntry;
        if (readyOnRunning) {
          settle('configured', `running (stopOnEntry=${dapLaunchArgs?.stopOnEntry ?? false})`);
        }
      };

      const handleTerminated = () => settle('ended', 'terminated during startup');
      const handleExited = () => settle('ended', 'exited during startup');
      const handleExit = () => settle('ended', 'proxy exited during startup');

      // The caller decided readiness synchronously just before this call and
      // nothing has been awaited since, so the only state worth re-checking
      // is a launch that is already terminal — settled here before any
      // listener is registered, so it costs no registrations to remove.
      const currentState = ctx.getSession(sessionId).state;
      if (currentState === SessionState.STOPPED || currentState === SessionState.ERROR) {
        resolved = true;
        ctx.logger.info(`[SessionManager] Session ${sessionId} already ${currentState} - skipping readiness wait`);
        resolve('already-terminal');
        return;
      }

      session.proxyManager?.once('stopped', handleStopped);
      session.proxyManager?.once('adapter-configured', handleConfigured);
      session.proxyManager?.once('terminated', handleTerminated);
      session.proxyManager?.once('exited', handleExited);
      session.proxyManager?.once('exit', handleExit);

      // The ceiling: a program that is running has simply not stopped — the
      // caller says so with pending: true. A session still initializing here
      // is the adapter not answering, which is what the warning has always
      // meant.
      timeoutId = setTimeout(() => {
        if (resolved) {
          return;
        }
        resolved = true;
        cleanup();
        const seconds = ceilingMs / 1000;
        if (session.state === SessionState.RUNNING || session.state === SessionState.PAUSED) {
          ctx.logger.info(
            `[SessionManager] Session ${sessionId} still running after the ${seconds}s readiness ceiling; answering with pending`
          );
        } else {
          ctx.logger.warn(ErrorMessages.adapterReadyTimeout(seconds));
        }
        resolve('ceiling');
      }, ceilingMs);
  });
}
