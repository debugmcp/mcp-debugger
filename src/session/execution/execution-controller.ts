/**
 * Execution control: stepping, continue, pause, and the thread list.
 *
 * Everything here shares one shape. The DAP request only acknowledges that the
 * debugger accepted the command; the state change arrives later as a `stopped`
 * event handled by the core listener. So each operation registers its
 * listeners BEFORE sending, and settles on whichever comes first — the stop,
 * the debuggee ending, or a grace window elapsing. The grace window is not a
 * deadline on the debuggee: it converts "still running" into an honest
 * `pending: true` success rather than a failure, and the operation completes
 * asynchronously afterwards.
 */
import {
  NO_DEBUG_TARGET_MARKER,
  SessionLifecycleState,
  SessionState
} from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
import { ProxyNotRunningError, SessionTerminatedError } from '../../errors/debug-errors.js';
import { ErrorMessages } from '../../utils/error-messages.js';
import type { ManagedSession } from '../session-store.js';
import type { DebugResult } from '../session-manager-core.js';
import type { ExecutionContext } from '../operations-context.js';

/** What distinguishes the three step flavours: everything else is shared. */
interface StepKind {
  /** The DAP request to send. */
  command: 'next' | 'stepIn' | 'stepOut';
  /** How the operation is named in a ProxyNotRunningError. */
  operation: string;
  /** The `[SM <tag> <id>]` log prefix. */
  logTag: string;
  successMessage: string;
}

const STEP_KINDS = {
  stepOver: {
    command: 'next',
    operation: 'step over',
    logTag: 'stepOver',
    successMessage: 'Step completed.'
  },
  stepInto: {
    command: 'stepIn',
    operation: 'step into',
    logTag: 'stepInto',
    successMessage: 'Step into completed.'
  },
  stepOut: {
    command: 'stepOut',
    operation: 'step out',
    logTag: 'stepOut',
    successMessage: 'Step out completed.'
  }
} as const satisfies Record<string, StepKind>;

export type StepKindName = keyof typeof STEP_KINDS;

/** The per-step options `executeStep` waits on. */
export interface StepOperationOptions {
  command: 'next' | 'stepIn' | 'stepOut';
  threadId: number;
  logTag: string;
  successMessage: string;
  terminatedMessage?: string;
  exitedMessage?: string;
}

export class ExecutionController {
  constructor(private readonly ctx: ExecutionContext) {}

  async stepOver(sessionId: string): Promise<DebugResult> {
    return this.step(sessionId, 'stepOver');
  }

  async stepInto(sessionId: string): Promise<DebugResult> {
    return this.step(sessionId, 'stepInto');
  }

  async stepOut(sessionId: string): Promise<DebugResult> {
    return this.step(sessionId, 'stepOut');
  }

  /**
   * The preamble the three step flavours share: liveness and paused-ness
   * checks, the current thread, and the error handling around the wait.
   */
  private async step(sessionId: string, kind: StepKindName): Promise<DebugResult> {
    const { command, operation, logTag, successMessage } = STEP_KINDS[kind];
    const session = this.ctx.getSession(sessionId);

    // Check if session is terminated
    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

    const threadId = session.proxyManager?.getCurrentThreadId();
    this.ctx.logger.info(
      `[SM ${logTag} ${sessionId}] Entered. Current state: ${session.state}, ThreadID: ${threadId}`
    );

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      throw new ProxyNotRunningError(sessionId, operation);
    }
    if (session.state !== SessionState.PAUSED) {
      this.ctx.logger.warn(`[SM ${logTag} ${sessionId}] Not paused. State: ${session.state}`);
      return { success: false, error: 'Not paused', state: session.state };
    }
    if (typeof threadId !== 'number') {
      this.ctx.logger.warn(`[SM ${logTag} ${sessionId}] No current thread ID.`);
      return { success: false, error: 'No current thread ID', state: session.state };
    }

    this.ctx.logger.info(`[SM ${logTag} ${sessionId}] Sending DAP '${command}' for threadId ${threadId}`);

    try {
      return await this.executeStep(session, sessionId, {
        command,
        threadId,
        logTag,
        successMessage,
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.ctx.logger.error(`[SM ${logTag} ${sessionId}] Error during step:`, error);
      this.ctx.updateState(session, SessionState.ERROR);
      return { success: false, error: errorMessage, state: session.state };
    }
  }

  /**
   * Send one step request and wait for whatever ends it. Public because the
   * step preamble and its tests both drive it directly.
   */
  executeStep(
    session: ManagedSession,
    sessionId: string,
    options: StepOperationOptions
  ): Promise<DebugResult> {
    const proxyManager = session.proxyManager;

    if (!proxyManager) {
      return Promise.resolve({
        success: false,
        error: 'Proxy manager unavailable',
        state: session.state,
      });
    }

    const terminatedMessage =
      options.terminatedMessage ?? 'Step completed as session terminated.';
    const exitedMessage = options.exitedMessage ?? 'Step completed as session exited.';

    return new Promise((resolve) => {
      let settled = false;

      const cleanup = () => {
        proxyManager.off('stopped', onStopped);
        proxyManager.off('terminated', onTerminated);
        proxyManager.off('exited', onExited);
        proxyManager.off('exit', onExit);
        clearTimeout(timeout);
      };

      const settle = (result: DebugResult) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(result);
      };

      const success = (message: string, location?: { file: string; line: number; column?: number }) => {
        this.ctx.logger.info(`[SM ${options.logTag} ${sessionId}] ${message} Current state: ${session.state}`);
        const data: { message: string; location?: { file: string; line: number; column?: number } } = { message };
        if (location) {
          data.location = location;
        }
        settle({
          success: true,
          state: session.state,
          data,
        });
      };

      const onStopped = async () => {
        // Try to get current location from stack trace
        let location: { file: string; line: number; column?: number } | undefined;
        try {
          // Wait a brief moment for state to settle after stopped event
          await new Promise(resolve => setTimeout(resolve, 10));

          const stackFrames = await this.ctx.getStackTrace(sessionId);
          if (stackFrames && stackFrames.length > 0) {
            const topFrame = stackFrames[0];
            location = {
              file: topFrame.file,
              line: topFrame.line,
              column: topFrame.column
            };
            this.ctx.logger.debug(`[SM ${options.logTag} ${sessionId}] Captured location: ${location.file}:${location.line}`);
          }
        } catch (error) {
          // Log but don't fail the step operation if we can't get location
          this.ctx.logger.debug(`[SM ${options.logTag} ${sessionId}] Could not capture location:`, error);
        }
        success(options.successMessage, location);
      };

      const onTerminated = () => success(terminatedMessage);
      const onExited = () => success(exitedMessage);
      const onExit = () => success(exitedMessage);

      const timeout = setTimeout(() => {
        this.ctx.logger.info(
          `[SM ${options.logTag} ${sessionId}] Step still running after ${this.ctx.tunables.stepGraceMs}ms grace window; completing asynchronously`
        );
        settle({
          success: true,
          state: session.state,
          data: {
            message: ErrorMessages.stepStillRunning(this.ctx.tunables.stepGraceMs / 1000),
            pending: true,
          },
        });
      }, this.ctx.tunables.stepGraceMs);

      proxyManager.on('stopped', onStopped);
      proxyManager.on('terminated', onTerminated);
      proxyManager.on('exited', onExited);
      proxyManager.on('exit', onExit);

      this.ctx.updateState(session, SessionState.RUNNING);

      proxyManager
        .sendDapRequest(options.command, { threadId: options.threadId })
        .catch((error: unknown) => {
          const errorMessage = getErrorMessage(error);
          this.ctx.logger.error(
            `[SM ${options.logTag} ${sessionId}] Error during step request:`,
            error
          );
          this.ctx.updateState(session, SessionState.ERROR);
          settle({ success: false, error: errorMessage, state: session.state });
        });
    });
  }

  async continue(sessionId: string): Promise<DebugResult> {
    const session = this.ctx.getSession(sessionId);

    // Check if session is terminated
    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

    const threadId = session.proxyManager?.getCurrentThreadId();
    this.ctx.logger.info(
      `[SessionManager continue] Called for session ${sessionId}. Current state: ${session.state}, ThreadID: ${threadId}`
    );

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      throw new ProxyNotRunningError(sessionId, 'continue');
    }
    if (session.state !== SessionState.PAUSED) {
      this.ctx.logger.warn(
        `[SessionManager continue] Session ${sessionId} not paused. State: ${session.state}.`
      );
      return { success: false, error: 'Not paused', state: session.state };
    }
    if (typeof threadId !== 'number') {
      this.ctx.logger.warn(
        `[SessionManager continue] No current thread ID for session ${sessionId}.`
      );
      return { success: false, error: 'No current thread ID', state: session.state };
    }

    try {
      this.ctx.logger.info(
        `[SessionManager continue] Sending DAP 'continue' for session ${sessionId}, threadId ${threadId}.`
      );
      // Set RUNNING *before* sending the DAP request so that concurrent
      // operations (e.g. getStackTrace polling) see the correct state.
      // If a breakpoint fires during the await, the handleStopped callback
      // will set state back to PAUSED before the await resolves.
      this.ctx.updateState(session, SessionState.RUNNING);
      await session.proxyManager.sendDapRequest('continue', { threadId });

      this.ctx.logger.info(
        `[SessionManager continue] DAP 'continue' sent, session ${sessionId} state is ${session.state}.`
      );
      return { success: true, state: session.state };
    } catch (error) {
      // Revert to PAUSED — the VM didn't actually resume
      this.ctx.updateState(session, SessionState.PAUSED);
      const errorMessage = getErrorMessage(error);
      this.ctx.logger.error(
        `[SessionManager continue] Error sending 'continue' to proxy for session ${sessionId}: ${errorMessage}`
      );
      throw error;
    }
  }

  async pause(sessionId: string, threadId?: number): Promise<DebugResult> {
    const session = this.ctx.getSession(sessionId);

    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

    this.ctx.logger.info(
      `[SessionManager pause] Called for session ${sessionId}. Current state: ${session.state}`
    );

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      throw new ProxyNotRunningError(sessionId, 'pause');
    }

    if (session.state === SessionState.PAUSED) {
      return {
        success: true,
        state: session.state,
        data: {
          message: 'Already paused',
          ...(session.lastStop?.reason ? { stopReason: session.lastStop.reason } : {}),
          ...(session.lastStop?.rawReason ? { rawStopReason: session.lastStop.rawReason } : {})
        }
      };
    }

    if (session.state !== SessionState.RUNNING) {
      return { success: false, error: `Cannot pause in state: ${session.state}`, state: session.state };
    }

    this.ctx.logger.debug(`[SessionManager] pauseExecution: sending DAP pause for session=${sessionId} currentState=${session.state}`);
    // DAP pause request: threadId 0 should pause all threads per DAP spec,
    // but some adapters (e.g. netcoredbg) reject threadId=0 with E_INVALIDARG.
    // When no explicit threadId is provided, discover one via a threads request.
    let effectiveThreadId = threadId ?? 0;
    if (effectiveThreadId === 0) {
      try {
        const threadsResp = await session.proxyManager.sendDapRequest<DebugProtocol.ThreadsResponse>('threads', {});
        const threads = threadsResp?.body?.threads;
        if (Array.isArray(threads) && threads.length > 0 && typeof threads[0]?.id === 'number') {
          effectiveThreadId = threads[0].id;
          this.ctx.logger.info(`[SessionManager pause] Auto-discovered threadId=${effectiveThreadId} for pause`);
        } else if (Array.isArray(threads) && threads.length === 0) {
          // Tell-tale for child-session adapters (issue #513): on a policy
          // that routes 'threads' to a child session, an empty list usually
          // means the request hit the parent (root) session — the pause below
          // goes through the same routing, where child-required handling
          // waits for/rejects on the missing child.
          this.ctx.logger.info(
            `[SessionManager pause] threads returned empty for session ${sessionId}; proceeding with threadId=0`
          );
        }
      } catch {
        // threads request failed — fall through with threadId=0
      }
    }

    const proxyManager = session.proxyManager;

    // Snapshot the current lastStop so result paths can tell whether the stop
    // they observe belongs to THIS pause (handleStopped replaces the object)
    // rather than reporting a stale earlier stop.
    const lastStopBefore = session.lastStop;
    // Flag the in-flight pause so policy stop-reason normalization can use it
    // (e.g. CodeLLDB reports pauses as 'exception'/SIGSTOP). handleStopped
    // clears it on every stop; clear it here too on error/terminate paths.
    session.pausePending = true;

    // The pause response only acknowledges the request; the state transition
    // to PAUSED happens when the asynchronous 'stopped' event is handled by
    // the core handleStopped listener. Adapters differ on whether the event
    // arrives before or after the response, so listen for it (registered
    // BEFORE sending the request) and only settle once the stop is observed.
    return new Promise<DebugResult>((resolve, reject) => {
      let settled = false;
      let stopEventSeen = false;

      const cleanup = () => {
        proxyManager.off('stopped', onStopped);
        proxyManager.off('terminated', onEnded);
        proxyManager.off('exited', onEnded);
        proxyManager.off('exit', onEnded);
        clearTimeout(timeout);
      };

      const settle = (result: DebugResult) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(result);
      };

      const onStopped = async () => {
        stopEventSeen = true;
        // Try to get current location from stack trace
        let location: { file: string; line: number; column?: number } | undefined;
        try {
          // Wait a brief moment for state to settle after stopped event
          await new Promise(resolve => setTimeout(resolve, 10));

          const stackFrames = await this.ctx.getStackTrace(sessionId);
          if (stackFrames && stackFrames.length > 0) {
            const topFrame = stackFrames[0];
            location = {
              file: topFrame.file,
              line: topFrame.line,
              column: topFrame.column
            };
          }
        } catch (error) {
          this.ctx.logger.debug(`[SessionManager pause ${sessionId}] Could not capture location:`, error);
        }
        this.ctx.logger.info(
          `[SessionManager pause] Paused session ${sessionId}. Current state: ${session.state}`
        );
        const data: {
          message: string;
          stopReason?: string;
          rawStopReason?: string;
          location?: { file: string; line: number; column?: number };
        } = { message: 'Paused' };
        // Only report the stop reason when handleStopped recorded a NEW stop
        // for this pause — never echo a stale earlier stop.
        if (session.lastStop && session.lastStop !== lastStopBefore) {
          data.stopReason = session.lastStop.reason;
          if (session.lastStop.rawReason) {
            data.rawStopReason = session.lastStop.rawReason;
          }
        }
        if (location) {
          data.location = location;
        }
        settle({ success: true, state: session.state, data });
      };

      const onEnded = () => {
        session.pausePending = false;
        settle({
          success: true,
          state: session.state,
          data: { message: 'Session ended before pause took effect' }
        });
      };

      const timeout = setTimeout(() => {
        this.ctx.logger.info(
          `[SessionManager pause] No stopped event within ${this.ctx.tunables.pauseGraceMs}ms grace window in session ${sessionId}; completing asynchronously`
        );
        // session.pausePending stays armed on purpose: the pause was
        // delivered and the stop may land whenever the debuggee next runs
        // (e.g. an idle server, issue #513) — that late stop must still be
        // normalized to 'pause'. handleStopped clears the flag on any stop.
        settle({
          success: true,
          state: session.state,
          data: {
            message: ErrorMessages.pausePending(this.ctx.tunables.pauseGraceMs / 1000),
            pending: true,
          },
        });
      }, this.ctx.tunables.pauseGraceMs);

      proxyManager.on('stopped', onStopped);
      proxyManager.on('terminated', onEnded);
      proxyManager.on('exited', onEnded);
      proxyManager.on('exit', onEnded);

      proxyManager
        .sendDapRequest('pause', { threadId: effectiveThreadId })
        .then(() => {
          this.ctx.logger.info(
            `[SessionManager pause] DAP 'pause' sent for session ${sessionId}. Waiting for stopped event.`
          );
          // Guard: if the stopped event fired before the listeners above were
          // registered (e.g. during the threads-discovery await), the state is
          // already PAUSED and no further event will arrive.
          if (session.state === SessionState.PAUSED && !stopEventSeen) {
            const raceData: { message: string; stopReason?: string; rawStopReason?: string } = { message: 'Paused' };
            if (session.lastStop && session.lastStop !== lastStopBefore) {
              raceData.stopReason = session.lastStop.reason;
              if (session.lastStop.rawReason) {
                raceData.rawStopReason = session.lastStop.rawReason;
              }
            }
            settle({ success: true, state: session.state, data: raceData });
          }
        })
        .catch((error: unknown) => {
          session.pausePending = false;
          const errorMessage = getErrorMessage(error);
          this.ctx.logger.error(
            `[SessionManager pause] Error sending 'pause' for session ${sessionId}: ${errorMessage}`
          );
          if (!settled) {
            settled = true;
            cleanup();
            // A pause with no debuggable target to run against (issue #513)
            // is an actionable state, not a protocol failure — return the
            // structured shape other unpausable states use
            if (errorMessage.includes(NO_DEBUG_TARGET_MARKER)) {
              resolve({ success: false, error: errorMessage, state: session.state });
              return;
            }
            reject(error instanceof Error ? error : new Error(errorMessage));
          }
        });
    });
  }

  async listThreads(sessionId: string): Promise<Array<{ id: number; name: string }>> {
    const session = this.ctx.getSession(sessionId);

    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      throw new ProxyNotRunningError(sessionId, 'listThreads');
    }

    const response = await session.proxyManager.sendDapRequest<DebugProtocol.ThreadsResponse>('threads', {});
    // A failed DAP response must not be flattened into an empty-but-successful
    // thread list (issue #124): propagate the failure to the caller.
    if (response?.success === false) {
      throw new Error(response.message || `DAP 'threads' request failed`);
    }
    return (response?.body?.threads ?? []).map(t => ({ id: t.id, name: t.name }));
  }
}
