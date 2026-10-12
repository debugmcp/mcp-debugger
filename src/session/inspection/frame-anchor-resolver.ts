/**
 * Resolve the inspection anchor shared by stack, locals, and evaluation.
 *
 * The resolver owns thread selection, bounded stack readiness, adoption, and
 * language-policy filtering. Callers consume the same `StackTraceResult`
 * instead of independently asking the adapter for whichever frame happens to
 * be current at that instant. Which thread a stop is anchored on is the one
 * verdict it shares with the attach controller (`selectStopAnchor`, issue
 * #904); the resolver decides when to ask and what to do with the answer.
 */
import {
  SessionState,
  type AdapterPolicy,
  type DebugLanguage,
  type ILogger,
  type StackFrame
} from '@debugmcp/shared';
import type { DebugProtocol } from '@vscode/debugprotocol';
import path from 'path';
import type { IProxyManager } from '../../proxy/proxy-manager.js';
import type { ManagedSession } from '../session-store.js';
import { debuggerOffWhy } from '../debugger-off.js';
import { ErrorMessages } from '../../utils/error-messages.js';
import {
  isProgramNeutralStopReason,
  policyUserFrames,
  selectStopAnchor,
  toStackFrame,
  USER_DIRECTED_STOP_REASONS,
  type StopAnchorVerdict
} from './stop-anchor.js';

/** The frame fields a tool response names when it says which frame answered. */
export type FrameSummary = Pick<StackFrame, 'name' | 'file' | 'line'>;

export function frameSummary(frame: StackFrame): FrameSummary {
  return { name: frame.name, file: frame.file, line: frame.line };
}

/**
 * The stopped thread's raw frame 0 when the policy classifies it internal
 * while other frames survive the filter (issue #672).
 */
export interface PausedFrameDisclosure {
  frame: StackFrame;
  /**
   * True when it was kept as `frames[0]`; false when it stays hidden and
   * `frames[0]` is the first visible frame instead.
   */
  kept: boolean;
}

export interface StackTraceResult {
  frames: StackFrame[];
  /** Thread whose stack is represented by `frames` (or was queried when empty). */
  threadId?: number;
  totalFrameCount: number;
  hiddenFrameCount: number;
  allFramesInternal: boolean;
  /**
   * True when no frame of the resolved stack is one the policy calls the
   * program's (issue #904): the stop landed outside the program — a pause
   * between event-loop dispatches, a runtime thread no sibling could replace.
   * Read off the per-frame classifier, so it holds for a policy whose filter
   * hands the whole stack back when nothing survives (Java), where
   * `allFramesInternal` stays false. Present only when true.
   */
  noProgramFrame?: boolean;
  /**
   * Present when the frame the debuggee is actually paused in was filtered
   * as internal while ancestors survived (issue #672) — see the keep/hide rule
   * in `resolve`. `pausedFrameNote` states the fact neutrally; each consumer
   * appends the advice that fits its own parameters.
   */
  pausedFrame?: PausedFrameDisclosure;
  pausedFrameNote?: string;
  /** Explanation for an empty result or an adopted sibling thread. */
  note?: string;
}

/**
 * A kept frame whose `file` is a relative label rather than an openable path
 * (the JDI bridge synthesizes `java/io/PrintStream.java` for a class off the
 * sourcePath) gets the same `unresolvedSource` flag the source-map case
 * carries, so nobody feeds it to get_source_context. Placeholders (`<…>`) are
 * self-describing and left alone.
 */
function withUnresolvedLabel(frame: StackFrame): StackFrame {
  if (frame.unresolvedSource || frame.file.startsWith('<') || path.isAbsolute(frame.file)) {
    return frame;
  }
  return { ...frame, unresolvedSource: true };
}

/** One unwind's own timeout during a sibling scan: a thread that cannot be unwound must not cost the window. */
const SIBLING_UNWIND_TIMEOUT_MS = 3_000;

export interface FrameAnchorTunables {
  readonly pausedStackReadyTimeoutMs: number;
  readonly pausedStackReadyIntervalMs: number;
}

export interface FrameAnchorContext {
  readonly logger: ILogger;
  readonly tunables: FrameAnchorTunables;
  getSession(sessionId: string): ManagedSession;
  selectPolicy(language: string | DebugLanguage): AdapterPolicy;
}

export interface ResolveFrameAnchorOptions {
  ensureStackReady?: boolean;
}

function emptyResult(note?: string, threadId?: number): StackTraceResult {
  return {
    frames: [],
    totalFrameCount: 0,
    hiddenFrameCount: 0,
    allFramesInternal: false,
    ...(typeof threadId === 'number' ? { threadId } : {}),
    ...(note ? { note } : {})
  };
}

type StopRecord = NonNullable<ManagedSession['lastStop']>;

interface SiblingStack {
  threadId: number;
  threadName?: string;
  frames: DebugProtocol.StackFrame[];
}

function threadLabel(id: number, threads: DebugProtocol.Thread[] | undefined): string {
  const name = threads?.find((thread) => thread?.id === id)?.name;
  return name ? `${id} (${name})` : String(id);
}

export class FrameAnchorResolver {
  /**
   * The verdict on an internal-only stop, once per stop: a stop that no
   * sibling can improve on (an idle js-debug pause) is scanned when first
   * resolved, not again by every locals or evaluate read that follows. Keyed
   * by the stop record itself, which the core replaces on every stop.
   */
  private readonly verdicts = new WeakMap<StopRecord, { verdict: StopAnchorVerdict; threads: DebugProtocol.Thread[] }>();

  constructor(private readonly ctx: FrameAnchorContext) {}

  async resolve(
    sessionId: string,
    threadId?: number,
    includeInternals = false,
    opts?: ResolveFrameAnchorOptions
  ): Promise<StackTraceResult> {
    const session = this.ctx.getSession(sessionId);
    const currentThreadId = session.proxyManager?.getCurrentThreadId();
    this.ctx.logger.info(
      `[FrameAnchor ${sessionId}] Requested threadId=${threadId}, currentThreadId=${currentThreadId}, state=${session.state}, includeInternals=${includeInternals}`
    );

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      this.ctx.logger.warn(`[FrameAnchor ${sessionId}] No active proxy.`);
      return emptyResult('No active debug process for this session.', threadId);
    }
    if (session.state !== SessionState.PAUSED) {
      this.ctx.logger.warn(`[FrameAnchor ${sessionId}] Session not paused: ${session.state}.`);
      // With the why, when the launch runs with the debugger off (issue #749).
      return emptyResult(ErrorMessages.stackTraceNotPaused(session.state, debuggerOffWhy(session)), threadId);
    }

    const effectiveThreadId = threadId ?? currentThreadId;
    if (typeof effectiveThreadId !== 'number') {
      this.ctx.logger.warn(`[FrameAnchor ${sessionId}] No effective thread ID to use.`);
      return emptyResult('No stopped thread is known for this session.');
    }
    // The stop this stack belongs to. A new stop landing while the stack is
    // in flight makes the frames stale; the paused-frame rule below and every
    // adoption only apply when the stop they reason about is still current.
    const stopAtGate = session.lastStop;

    const proxyManager = session.proxyManager;
    const policy = this.ctx.selectPolicy(session.language);
    try {
      let rawFrames = await this.requestRawStackFrames(sessionId, proxyManager, effectiveThreadId);
      let note: string | undefined;
      let resultThreadId = effectiveThreadId;

      if (rawFrames.length === 0 && opts?.ensureStackReady) {
        const ready = await this.waitForReadyStack(
          sessionId,
          session,
          proxyManager,
          effectiveThreadId,
          stopAtGate,
          policy
        );
        rawFrames = ready.frames;
        note = ready.note;
        resultThreadId = ready.threadId;
      } else if (rawFrames.length === 0 && typeof threadId === 'number') {
        note = await this.describeFramelessThread(sessionId, proxyManager, threadId, policy);
      } else if (
        rawFrames.length > 0 &&
        opts?.ensureStackReady &&
        isProgramNeutralStopReason(stopAtGate?.reason) &&
        this.isStoppedThread(stopAtGate, currentThreadId, effectiveThreadId) &&
        policyUserFrames(rawFrames.map(toStackFrame), policy).length === 0
      ) {
        // A pause reported on a thread whose stack is all runtime (the
        // break-in thread Windows injects, issue #898) says nothing about
        // where the program is; a sibling in the program's code does. Only a
        // program-neutral stop may move: a breakpoint, step, exception or
        // entry stop belongs to the thread it was reported on. Only an
        // implicit read may move, and `ensureStackReady` is what the implicit
        // reads pass (the server facade names the current thread when it
        // passes it; a caller's explicit threadId comes without the option).
        const adopted = await this.adoptProgramThread(
          sessionId,
          session,
          proxyManager,
          effectiveThreadId,
          rawFrames,
          stopAtGate,
          policy
        );
        if (adopted) {
          rawFrames = adopted.frames;
          resultThreadId = adopted.threadId;
          note = adopted.note;
        }
      }

      let frames: StackFrame[] = rawFrames.map(toStackFrame);
      const totalFrameCount = frames.length;
      let allFramesInternal = false;
      let pausedFrame: PausedFrameDisclosure | undefined;
      let pausedFrameNote: string | undefined;
      if (policy.filterStackFrames) {
        const filtered = policy.filterStackFrames(frames, includeInternals);
        const rawTop = frames[0];
        if (filtered.length === 0 && frames.length > 0) {
          allFramesInternal = true;
          frames = [rawTop];
        } else if (
          filtered.length > 0 &&
          filtered[0].id !== rawTop.id &&
          session.lastStop === stopAtGate &&
          this.isStoppedThread(stopAtGate, currentThreadId, resultThreadId)
        ) {
          // The paused frame itself was filtered out while ancestors survived
          // (issue #672). Only the stopped thread's top frame is "where the
          // debuggee paused": a sibling thread parked in runtime code is
          // simply filtered as before.
          const visible = filtered[0];
          const hiddenAbove = frames.slice(1, frames.indexOf(visible));
          const crossesAsyncBoundary =
            policy.isAsyncBoundaryFrame !== undefined &&
            hiddenAbove.some((frame) => policy.isAsyncBoundaryFrame!(frame));
          const where = `'${rawTop.name}' (${rawTop.file}:${rawTop.line})`;
          if (USER_DIRECTED_STOP_REASONS.has(stopAtGate?.reason ?? '') || crossesAsyncBoundary) {
            const kept = withUnresolvedLabel(rawTop);
            frames = [kept, ...filtered];
            pausedFrame = { frame: kept, kept: true };
            pausedFrameNote =
              `Paused inside an internal frame ${where}; kept as frame 0 so locals and evaluate ` +
              `anchor on the actual stop location.`;
          } else {
            frames = filtered;
            pausedFrame = { frame: rawTop, kept: false };
            pausedFrameNote =
              `Paused inside an internal frame ${where}, hidden by default; inspection anchors on ` +
              `'${visible.name}' (${visible.file}:${visible.line}).`;
          }
        } else {
          frames = filtered;
        }
      }
      const noProgramFrame = frames.length > 0 && policyUserFrames(frames, policy).length === 0;

      // An implicit read answered from a thread other than the one the stop
      // named — the attach controller or an earlier resolve moved the anchor
      // there — says so, so the stop's thread in list_threads is not a
      // puzzle. Never on an explicit threadId (read without the readiness
      // option): the caller chose it.
      if (
        !note &&
        opts?.ensureStackReady &&
        typeof stopAtGate?.threadId === 'number' &&
        resultThreadId !== stopAtGate.threadId &&
        session.lastStop === stopAtGate
      ) {
        note = `The stop was reported on thread ${stopAtGate.threadId}; inspection is anchored on thread ${resultThreadId}.`;
      }

      this.ctx.logger.info(
        `[FrameAnchor ${sessionId}] Resolved ${frames.length}/${totalFrameCount} frame(s) on thread ${resultThreadId}`
      );
      return {
        frames,
        threadId: resultThreadId,
        totalFrameCount,
        hiddenFrameCount: totalFrameCount - frames.length,
        allFramesInternal,
        ...(noProgramFrame ? { noProgramFrame } : {}),
        ...(pausedFrame ? { pausedFrame, pausedFrameNote } : {}),
        ...(note ? { note } : {})
      };
    } catch (error) {
      this.ctx.logger.error(`[FrameAnchor ${sessionId}] Error getting stack trace:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Whether the resolved stack belongs to the thread the stop event named.
   * When the stop carried no thread id, "the stopped thread" is the thread
   * that was current when this resolve began — the same answer whether the
   * caller named it explicitly (get_stack_trace does) or resolved implicitly
   * (locals and evaluate do), so the consumers agree on frame 0. A readiness
   * adoption of a sibling within this call is not it.
   */
  private isStoppedThread(
    stop: ManagedSession['lastStop'],
    currentThreadId: number | null | undefined,
    resultThreadId: number
  ): boolean {
    const stoppedThreadId = stop?.threadId;
    if (typeof stoppedThreadId === 'number') {
      return resultThreadId === stoppedThreadId;
    }
    return typeof currentThreadId === 'number' && resultThreadId === currentThreadId;
  }

  private async requestRawStackFrames(
    sessionId: string,
    proxyManager: IProxyManager,
    threadId: number,
    opts?: { timeoutMs?: number }
  ): Promise<DebugProtocol.StackFrame[]> {
    this.ctx.logger.info(`[FrameAnchor ${sessionId}] Sending DAP stackTrace for thread ${threadId}.`);
    // Two arguments when no timeout is asked for: the plain read is what
    // every consumer and test of the resolver has always seen.
    const response = typeof opts?.timeoutMs === 'number'
      ? await proxyManager.sendDapRequest<DebugProtocol.StackTraceResponse>(
        'stackTrace',
        { threadId },
        { timeoutMs: opts.timeoutMs }
      )
      : await proxyManager.sendDapRequest<DebugProtocol.StackTraceResponse>('stackTrace', { threadId });
    if (response?.success === false) {
      throw new Error(response.message || `DAP 'stackTrace' request failed`);
    }
    if (!response?.body?.stackFrames) {
      this.ctx.logger.warn(
        `[FrameAnchor ${sessionId}] No stackFrames in response body. Response:`,
        response
      );
      throw new Error(`DAP 'stackTrace' response did not include stack frames`);
    }
    return response.body.stackFrames;
  }

  private async waitForReadyStack(
    sessionId: string,
    session: Pick<ManagedSession, 'state' | 'lastStop'>,
    proxyManager: IProxyManager,
    threadId: number,
    stopAtGate: ManagedSession['lastStop'],
    policy: AdapterPolicy
  ): Promise<{ frames: DebugProtocol.StackFrame[]; threadId: number; note?: string }> {
    const { pausedStackReadyTimeoutMs, pausedStackReadyIntervalMs } = this.ctx.tunables;
    const deadline = Date.now() + pausedStackReadyTimeoutMs;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pausedStackReadyIntervalMs));
      if (session.state !== SessionState.PAUSED) {
        return {
          frames: [],
          threadId,
          note: 'The session left the paused state while waiting for the stack; it is no longer paused.'
        };
      }
      const frames = await this.requestRawStackFrames(sessionId, proxyManager, threadId);
      if (frames.length > 0) {
        return { frames, threadId };
      }
      const scanned = await this.scanSiblings(sessionId, proxyManager, threadId, policy, deadline - Date.now());
      if (scanned) {
        // A stop that landed during the scan has re-anchored the session
        // itself; adopting now would clobber it with a stale verdict.
        if (session.lastStop !== stopAtGate || session.state !== SessionState.PAUSED) {
          this.ctx.logger.info(
            `[FrameAnchor ${sessionId}] The stop changed while scanning for a framed thread; not adopting thread ${scanned.threadId}.`
          );
          return {
            frames: [],
            threadId,
            note: 'A new stop landed while the stack was being read; ask again.'
          };
        }
        proxyManager.setCurrentThreadId(scanned.threadId);
        this.ctx.logger.info(
          `[FrameAnchor ${sessionId}] Thread ${threadId} stayed frameless; adopted thread ${scanned.threadId}.`
        );
        return {
          frames: scanned.frames,
          threadId: scanned.threadId,
          note: `The stopped thread ${threadId} reported no stack frames; switched to thread ${scanned.threadId}, which has one.`
        };
      }
    }
    this.ctx.logger.warn(
      `[FrameAnchor ${sessionId}] Stack stayed empty for ${pausedStackReadyTimeoutMs}ms on thread ${threadId}.`
    );
    return {
      frames: [],
      threadId,
      note: `The stopped thread reported no stack frames within ${pausedStackReadyTimeoutMs}ms; the target may be paused in native code. Try get_stack_trace with a threadId from list_threads, or continue_execution followed by pause_execution to re-anchor the session on a reportable thread.`
    };
  }

  /**
   * The thread to show for a program-neutral stop reported on a thread whose
   * stack is all runtime (issue #898): the first sibling whose stack reaches
   * the program, by the shared verdict, within the readiness window. The
   * verdict is kept per stop so later reads of the same stop do not scan
   * again. Undefined when no sibling reaches the program, when the stop
   * changed under the scan, or when the verdict is the reported thread.
   */
  private async adoptProgramThread(
    sessionId: string,
    session: Pick<ManagedSession, 'state' | 'lastStop'>,
    proxyManager: IProxyManager,
    stoppedThreadId: number,
    stoppedFrames: DebugProtocol.StackFrame[],
    stopAtGate: ManagedSession['lastStop'],
    policy: AdapterPolicy
  ): Promise<{ frames: DebugProtocol.StackFrame[]; threadId: number; note: string } | undefined> {
    const remembered = stopAtGate ? this.verdicts.get(stopAtGate) : undefined;
    const { verdict, threads } = remembered ?? await this.verdictFor(
      sessionId,
      proxyManager,
      stoppedThreadId,
      stoppedFrames,
      policy,
      this.ctx.tunables.pausedStackReadyTimeoutMs
    );
    if (!remembered && stopAtGate) {
      this.verdicts.set(stopAtGate, { verdict, threads });
    }
    const programThreadId = verdict.programThreadId;
    if (programThreadId === undefined || programThreadId === stoppedThreadId) {
      return undefined;
    }
    const frames = verdict.stacks.get(programThreadId) ?? [];
    if (frames.length === 0) {
      return undefined;
    }
    if (session.lastStop !== stopAtGate || session.state !== SessionState.PAUSED) {
      this.ctx.logger.info(
        `[FrameAnchor ${sessionId}] The stop changed while scanning for the program thread; not adopting thread ${programThreadId}.`
      );
      return undefined;
    }
    proxyManager.setCurrentThreadId(programThreadId);
    const reportedTop = toStackFrame(stoppedFrames[0]);
    const landing = policyUserFrames(frames.map(toStackFrame), policy)[0] ?? toStackFrame(frames[0]);
    this.ctx.logger.info(
      `[FrameAnchor ${sessionId}] Stop on thread ${stoppedThreadId} has no program frame; adopted thread ${programThreadId} in '${landing.name}'.`
    );
    const count = stoppedFrames.length;
    return {
      frames,
      threadId: programThreadId,
      note:
        `The stop was reported on thread ${threadLabel(stoppedThreadId, threads)}, whose ${count} frame${count === 1 ? ' is' : 's are all'} ` +
        `internal/runtime (top: '${reportedTop.name}'); showing thread ${threadLabel(programThreadId, threads)}, ` +
        `which is in '${landing.name}' (${landing.file}:${landing.line}).`
    };
  }

  private async verdictFor(
    sessionId: string,
    proxyManager: IProxyManager,
    stoppedThreadId: number,
    stoppedFrames: DebugProtocol.StackFrame[],
    policy: AdapterPolicy,
    budgetMs: number,
    threads?: DebugProtocol.Thread[]
  ): Promise<{ verdict: StopAnchorVerdict; threads: DebugProtocol.Thread[] }> {
    const listed = threads ?? await this.listThreadsForScan(sessionId, proxyManager) ?? [];
    const verdict = await selectStopAnchor({
      stoppedThreadId,
      stoppedFrames,
      threads: listed,
      policy,
      // Every listed thread, as the readiness scan always has (a .NET process
      // may list its one user thread twentieth); each unwind under its own
      // short timeout, all within the window the caller has left.
      bounds: { maxThreads: Number.POSITIVE_INFINITY, unwindTimeoutMs: SIBLING_UNWIND_TIMEOUT_MS, budgetMs: Math.max(budgetMs, 0) },
      unwind: (threadId, { timeoutMs }) => this.requestRawStackFrames(sessionId, proxyManager, threadId, { timeoutMs }),
      log: (message) => this.ctx.logger.debug(`[FrameAnchor ${sessionId}] ${message}`)
    });
    return { verdict, threads: listed };
  }

  /**
   * For a stopped thread with no frames: the first sibling whose stack reaches
   * the program, else the first with any frames at all (issue #496 — any stack
   * beats none). Null when nothing has frames.
   */
  private async scanSiblings(
    sessionId: string,
    proxyManager: IProxyManager,
    excludeThreadId: number,
    policy: AdapterPolicy,
    budgetMs: number,
    threads?: DebugProtocol.Thread[]
  ): Promise<SiblingStack | null> {
    const { verdict, threads: listed } = await this.verdictFor(
      sessionId,
      proxyManager,
      excludeThreadId,
      [],
      policy,
      budgetMs,
      threads
    );
    const chosen = verdict.programThreadId ?? verdict.framedSiblingId;
    if (chosen === undefined || chosen === excludeThreadId) {
      return null;
    }
    const frames = verdict.stacks.get(chosen) ?? [];
    if (frames.length === 0) {
      return null;
    }
    return { threadId: chosen, threadName: listed.find((thread) => thread?.id === chosen)?.name, frames };
  }

  private async describeFramelessThread(
    sessionId: string,
    proxyManager: IProxyManager,
    threadId: number,
    policy: AdapterPolicy
  ): Promise<string> {
    const threads = await this.listThreadsForScan(sessionId, proxyManager) ?? [];
    const label = (id: number, name?: string): string => name ? `${id} (${name})` : String(id);
    const requested = label(threadId, threads.find((thread) => thread?.id === threadId)?.name);
    const alternative = await this.scanSiblings(
      sessionId,
      proxyManager,
      threadId,
      policy,
      this.ctx.tunables.pausedStackReadyTimeoutMs,
      threads
    );
    if (alternative) {
      return (
        `Thread ${requested} reported no stack frames; thread ${label(alternative.threadId, alternative.threadName)} has frames. ` +
        `Try get_stack_trace with threadId ${alternative.threadId}.`
      );
    }
    return (
      `Thread ${requested} reported no stack frames (it may be a native/runtime thread, or its stack may not have materialized yet). ` +
      'Retry, or try get_stack_trace with another threadId from list_threads.'
    );
  }

  private async listThreadsForScan(
    sessionId: string,
    proxyManager: IProxyManager
  ): Promise<DebugProtocol.Thread[] | null> {
    try {
      const response = await proxyManager.sendDapRequest<DebugProtocol.ThreadsResponse>('threads', {});
      const threads = response?.body?.threads;
      return Array.isArray(threads) ? threads : null;
    } catch (error) {
      this.ctx.logger.warn(
        `[FrameAnchor ${sessionId}] Could not list threads: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }
}
