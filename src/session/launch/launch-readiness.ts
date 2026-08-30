/**
 * The wait between "the proxy has started" and "the launch is reportable":
 * the adapter's first stop, or its configured-and-running state when the
 * policy says that is ready, or the debuggee ending before either.
 *
 * Never rejects. Every outcome resolves — including the 30-second ceiling,
 * which logs and resolves so the caller reports whatever state the session is
 * in rather than failing a launch that is merely slow. `session.proxyManager`
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

export interface LaunchReadinessInput {
  session: ManagedSession;
  sessionId: string;
  /** The session's adapter policy, for its readiness criteria when it has any. */
  policy: AdapterPolicy;
  dapLaunchArgs?: Partial<CustomLaunchRequestArguments>;
}

/**
 * Wait for the adapter to be configured, the first stop event, or termination.
 */
export function waitForLaunchReadiness(
  ctx: LaunchReadinessContext,
  input: LaunchReadinessInput
): Promise<void> {
  const { session, sessionId, policy, dapLaunchArgs } = input;
  return new Promise<void>((resolve) => {
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

      const handleStopped = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          ctx.logger.info(`[SessionManager] Session ${sessionId} stopped on entry`);
          resolve();
        }
      };

      const handleConfigured = () => {
        const readyOnRunning = policy.isSessionReady
          ? policy.isSessionReady(SessionState.RUNNING, { stopOnEntry: dapLaunchArgs?.stopOnEntry })
          : !dapLaunchArgs?.stopOnEntry;
        if (!resolved && readyOnRunning) {
          resolved = true;
          cleanup();
          ctx.logger.info(
            `[SessionManager] Session ${sessionId} running (stopOnEntry=${dapLaunchArgs?.stopOnEntry ?? false})`
          );
          resolve();
        }
      };

      const handleTerminated = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          ctx.logger.info(`[SessionManager] Session ${sessionId} terminated during startup`);
          resolve();
        }
      };

      const handleExited = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          ctx.logger.info(`[SessionManager] Session ${sessionId} exited during startup`);
          resolve();
        }
      };

      const handleExit = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          ctx.logger.info(`[SessionManager] Session ${sessionId} proxy exited during startup`);
          resolve();
        }
      };

      session.proxyManager?.once('stopped', handleStopped);
      session.proxyManager?.once('adapter-configured', handleConfigured);
      session.proxyManager?.once('terminated', handleTerminated);
      session.proxyManager?.once('exited', handleExited);
      session.proxyManager?.once('exit', handleExit);

      // In case the adapter already reached the desired state before listeners were attached,
      // perform a synchronous state check to avoid waiting for an event that already fired.
      const currentState = ctx.getSession(sessionId).state;
      const readyNow = policy.isSessionReady
        ? policy.isSessionReady(currentState, { stopOnEntry: dapLaunchArgs?.stopOnEntry })
        : currentState === SessionState.PAUSED;
      if (readyNow) {
        resolved = true;
        cleanup();
        resolve();
        return;
      }

      // Also check if already terminated/stopped
      if (currentState === SessionState.STOPPED || currentState === SessionState.ERROR) {
        resolved = true;
        cleanup();
        ctx.logger.info(`[SessionManager] Session ${sessionId} already ${currentState} - skipping readiness wait`);
        resolve();
        return;
      }

      // Timeout after 30 seconds
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          ctx.logger.warn(ErrorMessages.adapterReadyTimeout(30));
          resolve();
        }
      }, 30000);
  });
}
