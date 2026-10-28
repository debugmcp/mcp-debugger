/**
 * Execution control: stepping, continue, pause, waiting for a stop, and the
 * thread list.
 *
 * The operations that drive the debuggee — step, continue, pause — share one
 * shape. The DAP request only acknowledges that the debugger accepted the
 * command; the state change arrives later as a `stopped` event handled by the
 * core listener. So each of them registers its listeners BEFORE sending, and
 * settles on whichever comes first — the stop, the debuggee ending, or a grace
 * window elapsing. The grace window is not a deadline on the debuggee: it
 * converts "still running" into an honest `pending: true` success rather than
 * a failure, and the operation completes asynchronously afterwards.
 *
 * `waitForStop` (issue #849) is the explicit continuation of that `pending`
 * answer, and the one operation here that sends nothing: it waits on the
 * session's state through `waitForSessionState` for as long as its caller
 * says. It registers no event listeners, so rule 1 below has nothing to
 * arbitrate for it; it does obey rule 2.
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
  isSessionTerminated,
  isSettledSessionState,
  isTerminalSessionState,
  NO_DEBUG_TARGET_MARKER,
  redactStopInfo,
  SessionState,
  USER_BREAK_REASONS,
  type SessionStopInfo,
  type StackFrame
} from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
import { ProxyNotRunningError, SessionTerminatedError } from '../../errors/debug-errors.js';
import { ErrorMessages } from '../../utils/error-messages.js';
import type { ManagedSession } from '../session-store.js';
import type {
  DebugResult,
  PauseResultData,
  StepResultData,
  StopLocation,
  WaitForStopResultData
} from '../session-manager-core.js';
import { debuggerOffWhy, isDebuggerOff, type DebuggerOffView } from '../debugger-off.js';
import { samePath } from '../breakpoints/hit-verification.js';
import type { ExecutionContext } from '../operations-context.js';
import { describeStopLocation, landingFields, type StopLanding } from '../inspection/stop-location.js';
import { composeStopSnapshot } from '../inspection/stop-snapshot.js';
import type { PauseCoordinator } from './pause-coordinator.js';
import { waitForSessionState } from './session-state-wait.js';
import { resolveDapTimeoutOverride } from '../dap-request-helpers.js';
import { describeProgramEnd } from '../breakpoints/launch-warnings.js';
import { describeLaunchArming } from '../launch/launch-arming.js';

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
    successMessage: 'Stepped over'
  },
  stepInto: {
    command: 'stepIn',
    operation: 'step into',
    logTag: 'stepInto',
    successMessage: 'Stepped into'
  },
  stepOut: {
    command: 'stepOut',
    operation: 'step out',
    logTag: 'stepOut',
    successMessage: 'Stepped out'
  }
} as const satisfies Record<string, StepKind>;

export type StepKindName = keyof typeof STEP_KINDS;

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
  /**
   * The adapter policy's explanation for a step that may never land (issue
   * #678), appended to the grace-window message. Computed by the step preamble
   * before the request is sent, because it depends on the frame the step was
   * issued from.
   */
  pendingHint?: string;
  /**
   * Where the step was issued from (issue #678), when the preamble read it —
   * only for policies with `describePendingStop`, which need the frame anyway.
   * A breakpoint stop on this very file+line is the lost-step signature the
   * response then names.
   */
  origin?: StopLocation;
  /**
   * Hands each landing read to the caller (issue #983). A same-line-repeating
   * step (Dart, issue #879) reads a landing per attempt; the step snapshot
   * must be composed ONCE, from the final one — so `step()` sinks them here
   * and composes after the repeat loop, never inside it.
   */
  onLanding?: (landing: StopLanding) => void;
}

/**
 * The most DAP steps one step_over sends for an adapter that stops once per
 * token position (issue #879). The longest measured line took three.
 */
const MAX_SAME_LINE_STEPS = 8;

/** Same line of the same file, with the breakpoint layer's path equality (exact, Windows-folded). */
function isSameLine(a: StopLocation, b: StopLocation): boolean {
  return a.line === b.line && samePath(a.file, b.file);
}

/**
 * The step/continue refusal for a session that is not paused, with the why
 * when the session's launch runs with the debugger off (issue #749).
 */
function notPausedError(session: DebuggerOffView): string {
  return ErrorMessages.notPaused(debuggerOffWhy(session));
}

/**
 * A pause the adapter answered with an error, with the why beside the
 * adapter's own words when the launch runs with the debugger off (issue
 * #749). The adapter's error travels as the cause exactly as it was
 * thrown — an Error, or whatever else the bridge rejected with.
 */
function withDebuggerOffWhy(session: DebuggerOffView, error: unknown, message: string): { error: Error; message: string } {
  const err = error instanceof Error ? error : new Error(message);
  const why = debuggerOffWhy(session);
  if (!why) {
    return { error: err, message: err.message };
  }
  const composed = ErrorMessages.withDebuggerOffWhy(err.message, why);
  return { error: new Error(composed, { cause: error }), message: composed };
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
    if (isSessionTerminated(session)) {
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
      return { success: false, error: notPausedError(session), state: session.state };
    }
    if (typeof threadId !== 'number') {
      this.ctx.logger.warn(`[SM ${logTag} ${sessionId}] No current thread ID.`);
      return { success: false, error: 'No current thread ID', state: session.state };
    }

    // An adapter whose `next` stops once per token position (issue #879):
    // the step is repeated while it stops on the line it left, so the origin
    // (and its frame depth) is read for it as well.
    const repeatsOnSameLine =
      kind === 'stepOver' && this.ctx.selectPolicy(session.language).stepsByTokenPosition === true;
    const origin = await this.readStepOrigin(session, sessionId, threadId, repeatsOnSameLine);
    const fromFrame = origin?.frame;
    const pendingHint = await this.describePendingStop(session, sessionId, 'step', fromFrame);

    // Re-check after the awaits — the origin read is a real DAP round trip
    // — in the order and spirit of pause()'s re-check (#574): a
    // continue_execution or a second step can have resumed the thread, or
    // the session can have ended, in the meantime. Without this the step
    // would go to a running thread and its rejection would flip a healthy
    // session to ERROR.
    if (isSessionTerminated(session)) {
      throw new SessionTerminatedError(sessionId);
    }
    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      throw new ProxyNotRunningError(sessionId, operation);
    }
    if (session.state !== SessionState.PAUSED) {
      this.ctx.logger.warn(`[SM ${logTag} ${sessionId}] No longer paused after the origin read. State: ${session.state}`);
      return { success: false, error: notPausedError(session), state: session.state };
    }

    this.ctx.logger.info(`[SM ${logTag} ${sessionId}] Sending DAP '${command}' for threadId ${threadId}`);

    try {
      // The last landing read, whatever attempt made it (issue #983): the
      // snapshot is composed once per ANSWER, after any same-line repeats.
      let finalLanding: StopLanding | undefined;
      const stepOptions: StepOperationOptions = {
        command,
        threadId,
        logTag,
        successMessage,
        ...(pendingHint ? { pendingHint } : {}),
        ...(fromFrame ? { origin: { file: fromFrame.file, line: fromFrame.line, column: fromFrame.column } } : {}),
        onLanding: (landing) => { finalLanding = landing; },
      };
      const first = await this.executeStep(session, sessionId, stepOptions);
      const result = repeatsOnSameLine && origin
        ? await this.repeatWhileOnOriginLine(session, sessionId, stepOptions, origin, first)
        : first;
      if (
        result.success &&
        result.data !== undefined &&
        !result.data.pending &&
        session.state === SessionState.PAUSED
      ) {
        const snapshot = await composeStopSnapshot(
          this.ctx, sessionId, finalLanding?.stackResult, logTag
        );
        if (snapshot) {
          return { ...result, data: { ...result.data, snapshot } };
        }
      }
      return result;
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

    // The stop recorded before this step was sent; a different object in
    // onStopped is THIS step's stop, whose reason says whether the step ended
    // it or something else did (issue #678) — the same discipline pause uses.
    const lastStopBefore = session.lastStop;

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

      const success = (message: string, landing?: StopLanding, stop?: Pick<StepResultData, 'stopReason' | 'rawStopReason'>) => {
        this.ctx.logger.info(`[SM ${options.logTag} ${sessionId}] ${message} Current state: ${session.state}`);
        const data: StepResultData = { message, ...stop, ...(landing ? landingFields(landing) : {}) };
        settle({
          success: true,
          state: session.state,
          data,
        });
      };

      /** Rule 2: has the session reached a terminal state by settle time? */
      const sessionEnded = () =>
        isTerminalSessionState(session.state);

      const onStopped = async () => {
        stopSeen = true;
        clearTimeout(timeout);
        // Where the step landed, through the resolver (issue #904): a failed
        // read answers no location and never fails the step.
        const landing = await describeStopLocation(this.ctx, sessionId, options.logTag);
        options.onLanding?.(landing);
        const location = landing.location;
        // Rule 2. An ended event that reached the listeners below has already
        // settled with its own wording; this covers the endings that did not
        // (handlers torn down by the core, an exit mapped straight to ERROR).
        if (sessionEnded()) {
          success(endedDuringReadMessage);
          return;
        }
        // A stop recorded for THIS step whose reason is not the step: name it,
        // and for a breakpoint or exception say so in the wording too — with
        // the lost-step signature when it is on the line the step left from.
        const ownStop = session.lastStop && session.lastStop !== lastStopBefore ? session.lastStop : undefined;
        if (ownStop && ownStop.reason !== 'step') {
          const stop = {
            stopReason: ownStop.reason,
            ...(ownStop.rawReason ? { rawStopReason: ownStop.rawReason } : {})
          };
          const backAtOrigin = options.origin !== undefined && location !== undefined && isSameLine(options.origin, location);
          const message = USER_BREAK_REASONS.has(ownStop.reason)
            ? ErrorMessages.stepStoppedOn(options.successMessage, ownStop.reason, { backAtOrigin })
            : options.successMessage;
          success(message, landing, stop);
          return;
        }
        success(options.successMessage, landing);
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
        const stillRunning = ErrorMessages.stepStillRunning(this.ctx.tunables.stepGraceMs / 1000);
        settle({
          success: true,
          state: session.state,
          data: {
            message: options.pendingHint ? `${stillRunning} ${options.pendingHint}` : stillRunning,
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
    if (isSessionTerminated(session)) {
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
      return { success: false, error: notPausedError(session), state: session.state };
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
      // Revert to PAUSED — the VM didn't actually resume. Only from RUNNING,
      // though: the debuggee can end while the request is in flight (and the
      // adapter then rejects it precisely BECAUSE the session is gone), which
      // leaves the session STOPPED/ERROR. A terminal state is not something a
      // failed resume can undo, and reverting it resurrected finished
      // sessions as paused (issue #720).
      //
      // Phrased as "unless terminal" rather than "only from RUNNING" because
      // the guard above narrowed session.state to PAUSED for the compiler and
      // the await is precisely where that narrowing stops holding. The only
      // other state reachable here is PAUSED itself — a breakpoint that fired
      // during the await — where the revert is a no-op.
      if (!isTerminalSessionState(session.state)) {
        this.ctx.updateState(session, SessionState.PAUSED);
      }
      const errorMessage = getErrorMessage(error);
      this.ctx.logger.error(
        `[SessionManager continue] Error sending 'continue' to proxy for session ${sessionId}: ${errorMessage}`
      );
      throw error;
    }
  }

  async pause(sessionId: string, threadId?: number): Promise<DebugResult<PauseResultData>> {
    const session = this.ctx.getSession(sessionId);

    if (isSessionTerminated(session)) {
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
      // With the why while the launch is still initializing with the
      // debugger off (issue #749) — every other surface carries it in that
      // state.
      const why = debuggerOffWhy(session);
      const refusal = `Cannot pause in state: ${session.state}`;
      return {
        success: false,
        error: why ? ErrorMessages.withDebuggerOffWhy(refusal, why) : refusal,
        state: session.state
      };
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
    if (isSessionTerminated(session)) {
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
      isTerminalSessionState(session.state);

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
      // Where the pause landed, through the resolver (issue #904): a pause
      // reported on a thread with no program frame shows the sibling in the
      // program's code (issue #898), or says that no program frame is
      // active (issue #900), in note.
      const landing = await describeStopLocation(this.ctx, sessionId, 'pause');

      if (sessionEnded()) {
        return {
          success: true,
          state: session.state,
          data: { message: PAUSED_THEN_ENDED_MESSAGE, ...ownStopReason() }
        };
      }
      // The snapshot behind the landing (issue #982): same resolver result,
      // bounded locals; a session that moved on under the read answers none.
      const snapshot = await composeStopSnapshot(this.ctx, sessionId, landing.stackResult, 'pause');
      // The compose is a real wait (locals read, bounded by its tunable): a
      // debuggee that ended under it must get the ended wording, exactly as
      // one that ended under the landing read does (#574's rule 2).
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
          ...landingFields(landing),
          ...(snapshot ? { snapshot } : {})
        }
      };
    }

    if (outcome.status === 'pending') {
      this.ctx.logger.info(
        `[SessionManager pause] No stopped event within ${this.ctx.tunables.pauseGraceMs}ms grace window in session ${sessionId}; completing asynchronously`
      );
      const hint = await this.describePendingStop(session, sessionId, 'pause');
      // With the debugger off for this launch the why is known (issue #749):
      // one message that promises no stop, with the policy's own explanation
      // kept — on js-debug a pause can land under the flag, and #678's
      // advice is what makes it.
      if (isDebuggerOff(session)) {
        return {
          success: true,
          state: session.state,
          data: {
            message: ErrorMessages.pausePendingDebuggerOff(this.ctx.tunables.pauseGraceMs / 1000, hint),
            pending: true
          }
        };
      }
      const pausePending = ErrorMessages.pausePending(this.ctx.tunables.pauseGraceMs / 1000);
      return {
        success: true,
        state: session.state,
        data: {
          message: hint ? `${pausePending} ${hint}` : pausePending,
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
    // The adapter's answer stands — a refusal (CodeLLDB under noDebug), or
    // no debug target yet (js-debug before the child adopts) — with the why
    // beside it when the launch runs with the debugger off (issue #749).
    const answered = withDebuggerOffWhy(session, outcome.error, errorMessage);
    if (errorMessage.includes(NO_DEBUG_TARGET_MARKER)) {
      return { success: false, error: answered.message, state: session.state };
    }
    throw answered.error;
  }

  async listThreads(sessionId: string): Promise<Array<{ id: number; name: string }>> {
    const session = this.ctx.getSession(sessionId);

    if (isSessionTerminated(session)) {
      throw new SessionTerminatedError(sessionId);
    }

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      throw new ProxyNotRunningError(sessionId, 'list threads');
    }

    const response = await session.proxyManager.sendDapRequest<DebugProtocol.ThreadsResponse>('threads', {});
    // A failed DAP response must not be flattened into an empty-but-successful
    // thread list (issue #124): propagate the failure to the caller.
    if (response?.success === false) {
      throw new Error(response.message || `DAP 'threads' request failed`);
    }
    return (response?.body?.threads ?? []).map(t => ({ id: t.id, name: t.name }));
  }

  /**
   * Block until the session next pauses or ends, or the caller's timeout
   * passes (issue #849) — the explicit wait behind every `pending: true` and
   * behind `continue_execution`, which does not wait at all.
   *
   * The wait is on the session's state, not on the adapter's `stopped`
   * event, so a stop the core auto-continues is not reported. The answer is
   * built from the session as it is once the wait has settled (and, for a
   * pause, once the stack has been read): a session that is already paused or
   * already over answers at once; a wait that ran out, or whose caller went
   * away, answers `pending: true` with the session still live.
   */
  async waitForStop(
    sessionId: string,
    timeoutMs?: number,
    signal?: AbortSignal
  ): Promise<DebugResult<WaitForStopResultData>> {
    const session = this.ctx.getSession(sessionId);

    const timeoutCheck = resolveDapTimeoutOverride(timeoutMs, 'SessionManager waitForStop', this.ctx.logger);
    if (timeoutCheck.error) {
      return { success: false, error: timeoutCheck.error, state: session.state };
    }
    if (session.state === SessionState.CREATED) {
      return { success: false, error: ErrorMessages.waitForStopNotStarted(), state: session.state };
    }
    const waitMs = timeoutCheck.timeoutMs ?? this.ctx.tunables.waitForStopDefaultMs;

    // The stop on record before this wait began. A different record afterwards
    // is a stop that landed during it — the discipline step and pause use to
    // tell their own stop from an earlier one.
    const lastStopBefore = session.lastStop;

    const outcome = await waitForSessionState(
      this.ctx,
      sessionId,
      isSettledSessionState,
      { timeoutMs: waitMs, signal }
    );
    if (outcome === 'gone') {
      return {
        success: false,
        error: ErrorMessages.sessionClosedWhileWaiting(sessionId),
        state: SessionState.STOPPED
      };
    }

    // Where it stopped, best effort: the same short settle and stack read a
    // step or a pause does. It is a DAP round trip, so the state is read
    // again afterwards rather than trusted across it.
    const landing: StopLanding = session.state === SessionState.PAUSED
      ? await describeStopLocation(this.ctx, sessionId, 'waitForStop')
      : {};
    const location = landing.location;
    // The stop this wait settled on, pinned at the landing read: the compose
    // below is a real wait, and a NEW stop landing under it belongs to the
    // next wait_for_stop, not to this answer — one answer, one stop.
    const stopAtLanding = session.lastStop;
    // The snapshot behind the landing (issue #982). The exception section is
    // omitted on purpose: this answer carries the full (redacted) lastStop,
    // and the same message must never ship twice. The composer's own
    // stop-identity gate answers no snapshot if the stop changed under it.
    const snapshot = await composeStopSnapshot(
      this.ctx, sessionId, landing.stackResult, 'waitForStop', { omitException: true }
    );
    // Emit a redacted copy of the stop record (issue #982); the stored record
    // keeps its identity — the exceptionInfo merge and `lastStop !== before`
    // guards depend on it.
    const emitStop = (stop: SessionStopInfo): SessionStopInfo =>
      this.ctx.redactionEnabled() ? redactStopInfo(stop) : stop;

    const state = session.state;
    // Rule 2 of the settle contract: a session that is over by now is
    // reported as ended, with the stop that landed during this wait if there
    // was one — an exception stop and the exit can arrive in one tick. A stop
    // from before the wait is not this wait's to report: the program was
    // resumed past it.
    const stopDuringWait =
      session.lastStop && session.lastStop !== lastStopBefore ? { lastStop: emitStop(session.lastStop) } : {};
    if (state === SessionState.PAUSED && stopAtLanding) {
      const where = location ? ` at ${location.file}:${location.line}` : '';
      return {
        success: true,
        state,
        data: {
          message: `Paused (${stopAtLanding.reason})${where}`,
          lastStop: emitStop(stopAtLanding),
          ...landingFields(landing),
          ...(snapshot ? { snapshot } : {})
        }
      };
    }
    if (state === SessionState.ERROR) {
      const detail = session.lastProxyError ? `: ${session.lastProxyError}` : '';
      return {
        success: true,
        state,
        data: { message: `The debug session ended in an error state${detail}`, ...stopDuringWait }
      };
    }
    if (state === SessionState.STOPPED) {
      return {
        success: true,
        state,
        data: {
          // The adapter's reading of the end joins the sentence and the data (issue #877).
          message: `${describeProgramEnd(session.exitCode)}.${session.programEndExplanation?.note ? ` ${session.programEndExplanation.note}` : ''}`,
          ...(typeof session.exitCode === 'number' ? { exitCode: session.exitCode } : {}),
          ...(session.programEndExplanation ? { programEnd: session.programEndExplanation } : {}),
          ...stopDuringWait
        }
      };
    }
    this.ctx.logger.info(
      `[SessionManager waitForStop] Session ${sessionId} still ${state} after ${waitMs}ms (${outcome}); answering with pending`
    );
    // What is armed now words the answer: with something armed, that it stays
    // armed; with nothing, no pause is promised. An entry stop is not part of
    // it — that belongs to the launch, which is behind a running program.
    const arming = describeLaunchArming(session, false);
    return {
      success: true,
      state,
      data: {
        message: ErrorMessages.waitForStopPending(
          waitMs / 1000,
          state === SessionState.INITIALIZING ? 'initializing' : 'running',
          {
            ...(arming.armed ? { armedSummary: arming.summary } : {}),
            ...(arming.loggingSummary ? { loggingSummary: arming.loggingSummary } : {}),
            ...(debuggerOffWhy(session) ? { debuggerOffWhy: debuggerOffWhy(session) } : {}),
            uncaughtStops: arming.uncaughtStops
          }
        ),
        pending: true
      }
    };
  }

  /**
   * The raw frame a step is about to be issued from (issue #678) — internals
   * included, no readiness wait — read only for policies with
   * `describePendingStop`, whose explanation depends on it, so other adapters
   * pay nothing. The same frame is the step's `origin`. The read is bounded to
   * a fraction of the step grace window: a wedged stackTrace (a js child
   * mid-teardown) must not hold the step for the 30s DAP request timeout. A
   * failed or late read costs the explanation and the origin, never the step.
   */
  private async readStepOrigin(
    session: ManagedSession,
    sessionId: string,
    threadId: number,
    forSameLineRepeat: boolean
  ): Promise<{ frame: StackFrame; depth: number } | undefined> {
    if (!forSameLineRepeat && !this.ctx.selectPolicy(session.language).describePendingStop) {
      return undefined;
    }
    return this.readTopFrame(sessionId, threadId);
  }

  /**
   * For an adapter that stops once per token position (issue #879): send the
   * step again while it stopped, as a plain step, on the origin's file and
   * line at the origin's frame depth, up to MAX_SAME_LINE_STEPS. Anything
   * else is a real landing and ends it at once: a breakpoint or exception
   * (stopReason set), a pending step, an ended session, another line, or the
   * same line in another frame (a recursive call returning to its caller).
   */
  private async repeatWhileOnOriginLine(
    session: ManagedSession,
    sessionId: string,
    stepOptions: StepOperationOptions,
    origin: { frame: StackFrame; depth: number },
    first: DebugResult<StepResultData>
  ): Promise<DebugResult<StepResultData>> {
    let result = first;
    let steps = 1;
    for (;;) {
      const data = result.data;
      const onOriginLine =
        result.success &&
        session.state === SessionState.PAUSED &&
        data !== undefined &&
        !data.pending &&
        data.stopReason === undefined &&
        data.location !== undefined &&
        isSameLine(origin.frame, data.location);
      if (!onOriginLine) {
        break;
      }
      if (steps >= MAX_SAME_LINE_STEPS) {
        return {
          ...result,
          data: { ...data!, message: ErrorMessages.stepRepeatedOnSameLine(stepOptions.successMessage, steps, { stillOnLine: true }) }
        };
      }
      // The thread the caller stepped, not whichever thread is current now:
      // another isolate stopping meanwhile must not be stepped in its place.
      const threadId = stepOptions.threadId;
      if (!session.proxyManager?.isRunning()) {
        break;
      }
      const here = await this.readTopFrame(sessionId, threadId);
      // Re-check after the read, as the step preamble does: a continue or
      // another step may have resumed the thread meanwhile.
      if (!here || here.depth !== origin.depth || session.state !== SessionState.PAUSED) {
        break;
      }
      this.ctx.logger.info(
        `[SM ${stepOptions.logTag} ${sessionId}] Still on ${origin.frame.file}:${origin.frame.line} after step ${steps}; stepping again (the adapter stops per token position)`
      );
      // No origin on a repeat: the program has moved within the line, so a
      // breakpoint that ends it is not the lost-step "back at the line the
      // step was issued from" signature the origin exists to name.
      const { origin: _origin, ...repeatOptions } = stepOptions;
      result = await this.executeStep(session, sessionId, repeatOptions);
      steps += 1;
    }
    const last = result.data;
    if (steps > 1 && result.success && last !== undefined && !last.pending && last.stopReason === undefined) {
      return { ...result, data: { ...last, message: ErrorMessages.stepRepeatedOnSameLine(stepOptions.successMessage, steps) } };
    }
    return result;
  }

  /**
   * The stop's top frame and how many frames are under it, bounded to a
   * fraction of the step grace window like the origin read; undefined when
   * the read failed or was late.
   */
  private async readTopFrame(sessionId: string, threadId: number): Promise<{ frame: StackFrame; depth: number } | undefined> {
    const boundMs = Math.max(1, Math.floor(this.ctx.tunables.stepGraceMs / 5));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), boundMs);
    });
    try {
      const detailed = await Promise.race([
        this.ctx.getStackTraceDetailed(sessionId, threadId, true, { ensureStackReady: false }),
        late
      ]);
      if (!detailed) {
        this.ctx.logger.debug(`[SM step ${sessionId}] Origin frame read exceeded ${boundMs}ms; stepping without it`);
        return undefined;
      }
      const frame = detailed.frames[0];
      return frame ? { frame, depth: detailed.frames.length } : undefined;
    } catch (error) {
      this.ctx.logger.debug(`[SM step ${sessionId}] Could not read the origin frame for the pending-stop explanation:`, error);
      return undefined;
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  /**
   * The adapter policy's explanation for a pause or step that may never stop
   * (issue #678), or undefined when it has none. A throwing hook only costs
   * the explanation.
   */
  private async describePendingStop(
    session: ManagedSession,
    sessionId: string,
    operation: 'pause' | 'step',
    fromFrame?: StackFrame
  ): Promise<string | undefined> {
    const policy = this.ctx.selectPolicy(session.language);
    if (!policy.describePendingStop) {
      return undefined;
    }
    try {
      // The launcher's merge order: defaults under the caller's dapLaunchArgs,
      // adapterLaunchConfig on top (proxy-launcher.ts). lastLaunch records the
      // caller's input only, so the defaults layer is re-applied here.
      const launch = session.lastLaunch
        ? {
            dapLaunchArgs: { ...this.ctx.defaultDapLaunchArgs, ...(session.lastLaunch.dapLaunchArgs ?? {}) },
            adapterLaunchConfig: session.lastLaunch.adapterLaunchConfig
          }
        : undefined;
      return policy.describePendingStop({
        operation,
        attachMode: session.attachMode === true,
        launch,
        ...(fromFrame ? { fromFrame } : {})
      }) || undefined;
    } catch (error) {
      this.ctx.logger.debug(`[SM ${operation} ${sessionId}] Pending-stop explanation failed:`, error);
      return undefined;
    }
  }

}
