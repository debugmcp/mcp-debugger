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
 *
 * THE SETTLE CONTRACT (issue #574). Two rules:
 *
 * 1. The stop path owns the settle. Once a `stopped` event has been observed,
 *    no other path may answer — not the grace timer, not a rejected request.
 *    Reading where the debuggee landed takes a DAP round trip, and every one
 *    of those paths would otherwise report, with more or less confidence,
 *    that the thing that demonstrably happened did not.
 *
 *    One deliberate asymmetry, and the reason rule 2 exists: pause's ended
 *    handler stands down for the stop path, because its wording ('Session
 *    ended before pause took effect') contradicts a stop that was observed.
 *    executeStep's do not — 'Step completed as session terminated./exited.'
 *    is already what rule 2 would have the stop path say, so letting them
 *    answer first is the same answer, sooner. Both ends obey rule 2; they
 *    differ only in which path is allowed to deliver it.
 * 2. Ended-at-settle. Whoever does settle reads `session.state` at settle
 *    time. A session that reached a terminal state (STOPPED or ERROR) while
 *    the answer was being assembled is reported as ended — terminal state,
 *    ended wording, the stop reason if one was recorded, and no location,
 *    because there is no longer a stack to have read. Rule 1 without rule 2 is
 *    how "Paused" came to be returned alongside `state: 'stopped'`.
 */
import { getErrorMessage } from '../../errors/debug-errors.js';
import {
  NO_DEBUG_TARGET_MARKER,
  SessionLifecycleState,
  SessionState
} from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
import { ProxyNotRunningError, SessionTerminatedError } from '../../errors/debug-errors.js';
import { ErrorMessages } from '../../utils/error-messages.js';
import type { ManagedSession } from '../session-store.js';
import type {
  DebugResult,
  PauseResultData,
  StepResultData,
  StopLocation
} from '../session-manager-core.js';
import type { ExecutionContext } from '../operations-context.js';
import type { PauseCoordinator } from './pause-coordinator.js';

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

/**
 * Is the session over?
 *
 * A function rather than an inline comparison because `pause()` asks twice,
 * either side of an await, and an inline check would be narrowed away by
 * control-flow analysis — which cannot see that the core mutates the session
 * while the await is in flight.
 */
function isTerminated(session: ManagedSession): boolean {
  return session.sessionLifecycle === SessionLifecycleState.TERMINATED;
}

/**
 * Rule 2's wording for pause: the pause took effect, and the session ended
 * before the stack that would say where could be read.
 */
const PAUSED_THEN_ENDED_MESSAGE = 'Paused; the session ended before the stack could be read';

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
  constructor(
    private readonly ctx: ExecutionContext,
    private readonly pauseCoordinator: PauseCoordinator
  ) {}

  async stepOver(sessionId: string): Promise<DebugResult<StepResultData>> {
    return this.step(sessionId, 'stepOver');
  }

  async stepInto(sessionId: string): Promise<DebugResult<StepResultData>> {
    return this.step(sessionId, 'stepInto');
  }

  async stepOut(sessionId: string): Promise<DebugResult<StepResultData>> {
    return this.step(sessionId, 'stepOut');
  }

  /**
   * The preamble the three step flavours share: liveness and paused-ness
   * checks, the current thread, and the error handling around the wait.
   */
  private async step(sessionId: string, kind: StepKindName): Promise<DebugResult<StepResultData>> {
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
  ): Promise<DebugResult<StepResultData>> {
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

    // Rule 2's wording for this step flavour: the step landed, but the stack
    // read that would say where outlived the session.
    const endedDuringReadMessage =
      `${options.successMessage.replace(/\.$/, '')}; the session ended before the stack could be read`;

    return new Promise((resolve) => {
      let settled = false;
      // Rule 1's flag: "a stop has been observed, the stop path owns the
      // settle". Set as the first statement of onStopped, so every other path
      // can tell "nothing stopped" from "stopped, still resolving where".
      let stopSeen = false;

      const cleanup = () => {
        proxyManager.off('stopped', onStopped);
        proxyManager.off('terminated', onTerminated);
        proxyManager.off('exited', onExited);
        proxyManager.off('exit', onExit);
        clearTimeout(timeout);
      };

      const settle = (result: DebugResult<StepResultData>) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(result);
      };

      const success = (message: string, location?: StopLocation) => {
        this.ctx.logger.info(`[SM ${options.logTag} ${sessionId}] ${message} Current state: ${session.state}`);
        const data: StepResultData = { message };
        if (location) {
          data.location = location;
        }
        settle({
          success: true,
          state: session.state,
          data,
        });
      };

      /** Rule 2: has the session reached a terminal state by settle time? */
      const sessionEnded = () =>
        session.state === SessionState.STOPPED || session.state === SessionState.ERROR;

      const onStopped = async () => {
        stopSeen = true;
        clearTimeout(timeout);
        // Try to get current location from stack trace
        let location: StopLocation | undefined;
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
        // Rule 2. An ended event that reached the listeners below has already
        // settled with its own wording; this covers the endings that did not
        // (handlers torn down by the core, an exit mapped straight to ERROR).
        if (sessionEnded()) {
          success(endedDuringReadMessage);
          return;
        }
        success(options.successMessage, location);
      };

      const onTerminated = () => success(terminatedMessage);
      const onExited = () => success(exitedMessage);
      const onExit = () => success(exitedMessage);

      const timeout = setTimeout(() => {
        // Rule 1: the stop already arrived, so onStopped owns the settle and
        // will report where it landed. "Still executing" from here would be a
        // lie the caller has no way to correct.
        // Trade-off: past this point the answer is bounded by the stackTrace
        // round trip (a 30s DAP request timeout plus the proxy's 5s parent
        // margin) rather than by this 5s window. Worth it — a slow truthful
        // answer beats a fast wrong one — but it IS the ceiling, which is why
        // the stand-down is logged.
        if (stopSeen) {
          this.ctx.logger.debug(
            `[SM ${options.logTag} ${sessionId}] Grace window elapsed but the stop is already being resolved; standing down`
          );
          return;
        }
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
          // Rule 1. A proxy that dies just after the stop rejects the still
          // pending step request; failing the call would deny a step that
          // demonstrably landed. The stop path settles, under rule 2.
          if (stopSeen) {
            this.ctx.logger.debug(
              `[SM ${options.logTag} ${sessionId}] Step request rejected after the stop was observed; standing down: ${errorMessage}`
            );
            return;
          }
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

  async pause(sessionId: string, threadId?: number): Promise<DebugResult<PauseResultData>> {
    const session = this.ctx.getSession(sessionId);

    if (isTerminated(session)) {
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

    // Snapshot the current lastStop so result paths can tell whether the stop
    // they observe belongs to THIS pause (handleStopped replaces the object)
    // rather than reporting a stale earlier stop. Taken BEFORE the
    // threads-discovery await below: a stop delivered during that await has
    // already replaced session.lastStop, so a snapshot taken afterwards would
    // compare this pause's own stop against itself and report no reason at
    // all — the very case the post-response race branch exists for (#574).
    const lastStopBefore = session.lastStop;
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

    // Re-check after the await: the session can close, terminate or exit
    // while the threads request is in flight, and the listener registration
    // below would then throw a TypeError on a null handle instead of the
    // failure the pre-flight checks report for the same condition (#574).
    // Lifecycle first, and in the same order as the pre-flight checks: the
    // core flips the lifecycle to TERMINATED for exactly the endings that
    // also clear the handle, and 'session is over' is the more useful of the
    // two answers.
    if (isTerminated(session)) {
      throw new SessionTerminatedError(sessionId);
    }
    const proxyManager = session.proxyManager;
    if (!proxyManager || !proxyManager.isRunning()) {
      throw new ProxyNotRunningError(sessionId, 'pause');
    }

    const outcome = await this.pauseCoordinator.requestPause({
      session,
      proxyManager,
      threadId: effectiveThreadId,
      timeoutMs: this.ctx.tunables.pauseGraceMs,
      source: 'user'
    });
    // The await above lets asynchronous proxy events mutate session.state;
    // keeping this behind a function also prevents TypeScript from retaining
    // the RUNNING-only narrowing established before dispatch.
    const sessionEnded = () =>
      session.state === SessionState.STOPPED || session.state === SessionState.ERROR;

    /** The stop reason, but only when core recorded a NEW stop for this pause. */
    const ownStopReason = (): Pick<PauseResultData, 'stopReason' | 'rawStopReason'> => {
      if (!session.lastStop || session.lastStop === lastStopBefore) {
        return {};
      }
      return {
        stopReason: session.lastStop.reason,
        ...(session.lastStop.rawReason ? { rawStopReason: session.lastStop.rawReason } : {})
      };
    };

    if (outcome.status === 'observed') {
      let location: StopLocation | undefined;
      try {
        await new Promise(resolve => setTimeout(resolve, 10));
        const [topFrame] = await this.ctx.getStackTrace(sessionId);
        if (topFrame) {
          location = { file: topFrame.file, line: topFrame.line, column: topFrame.column };
        }
      } catch (error) {
        this.ctx.logger.debug(`[SessionManager pause ${sessionId}] Could not capture location:`, error);
      }

      if (sessionEnded()) {
        return {
          success: true,
          state: session.state,
          data: { message: PAUSED_THEN_ENDED_MESSAGE, ...ownStopReason() }
        };
      }
      this.ctx.logger.info(
        `[SessionManager pause] Paused session ${sessionId}. Current state: ${session.state}`
      );
      return {
        success: true,
        state: session.state,
        data: {
          message: 'Paused',
          ...ownStopReason(),
          ...(location ? { location } : {})
        }
      };
    }

    if (outcome.status === 'pending') {
      this.ctx.logger.info(
        `[SessionManager pause] No stopped event within ${this.ctx.tunables.pauseGraceMs}ms grace window in session ${sessionId}; completing asynchronously`
      );
      return {
        success: true,
        state: session.state,
        data: {
          message: ErrorMessages.pausePending(this.ctx.tunables.pauseGraceMs / 1000),
          pending: true
        }
      };
    }

    if (outcome.ended || sessionEnded()) {
      return {
        success: true,
        state: session.state,
        data: { message: 'Session ended before pause took effect' }
      };
    }

    const errorMessage = getErrorMessage(outcome.error);
    this.ctx.logger.error(
      `[SessionManager pause] Error sending 'pause' for session ${sessionId}: ${errorMessage}`
    );
    if (errorMessage.includes(NO_DEBUG_TARGET_MARKER)) {
      return { success: false, error: errorMessage, state: session.state };
    }
    throw outcome.error instanceof Error ? outcome.error : new Error(errorMessage);
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
