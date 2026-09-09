/**
 * Resolve the inspection anchor shared by stack, locals, and evaluation.
 *
 * The resolver owns thread selection, bounded stack readiness, adoption, and
 * language-policy filtering. Callers consume the same `StackTraceResult`
 * instead of independently asking the adapter for whichever frame happens to
 * be current at that instant.
 */
import {
  BREAKPOINT_STOP_REASONS,
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
 * Stop reasons where the user asked to be exactly here — a breakpoint they
 * set (the shared breakpoint family), a step they requested. When such a
 * stop lands in a frame the display filter classifies internal (a
 * dependency, most often), hiding it would misreport the stop location and
 * anchor locals/evaluate on an ancestor (issue #672). A `pause` or an
 * `exception` is different: those routinely land in runtime frames (Go's
 * `runtime.gopark`, a JDK sleep, a panic unwinder) where the first user frame
 * is the actionable one, so they keep the filtered anchor and get a
 * disclosure — unless the policy says the visible anchor sits beyond an async
 * boundary, in which case nothing below the paused frame can be evaluated
 * and it is kept whatever the reason.
 */
const USER_DIRECTED_STOP_REASONS: ReadonlySet<string> = new Set([...BREAKPOINT_STOP_REASONS, 'step']);

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

export class FrameAnchorResolver {
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
      return emptyResult(
        `Session is not paused (state: ${session.state}); stack traces are only available while paused.`,
        threadId
      );
    }

    const effectiveThreadId = threadId ?? currentThreadId;
    if (typeof effectiveThreadId !== 'number') {
      this.ctx.logger.warn(`[FrameAnchor ${sessionId}] No effective thread ID to use.`);
      return emptyResult('No stopped thread is known for this session.');
    }
    // The stop this stack belongs to. A new stop landing while the stack is
    // in flight makes the frames stale; the paused-frame rule below only
    // applies when the stop it reasons about is still the current one.
    const stopAtGate = session.lastStop;

    const proxyManager = session.proxyManager;
    try {
      let rawFrames = await this.requestRawStackFrames(sessionId, proxyManager, effectiveThreadId);
      let note: string | undefined;
      let resultThreadId = effectiveThreadId;

      if (rawFrames.length === 0 && opts?.ensureStackReady) {
        const ready = await this.waitForReadyStack(
          sessionId,
          session,
          proxyManager,
          effectiveThreadId
        );
        rawFrames = ready.frames;
        note = ready.note;
        resultThreadId = ready.threadId;
      } else if (rawFrames.length === 0 && typeof threadId === 'number') {
        note = await this.describeFramelessThread(sessionId, proxyManager, threadId);
      }

      let frames: StackFrame[] = rawFrames.map((frame) => {
        const file = frame.source?.path || frame.source?.name || '<unknown_source>';
        // A non-zero sourceReference is the adapter saying "not a file you
        // can open here" (js-debug sets it for every source it could not
        // find on disk — a source-mapped '../src/x.ts' the package never
        // shipped). Placeholder paths (<node_internals>, <eval>) carry one
        // too but are self-describing, so only real-looking paths are
        // flagged (issue #655).
        const unresolvedSource =
          typeof frame.source?.sourceReference === 'number' &&
          frame.source.sourceReference !== 0 &&
          !file.startsWith('<');
        return {
          id: frame.id,
          name: frame.name,
          file,
          line: frame.line,
          column: frame.column,
          ...(unresolvedSource ? { unresolvedSource: true } : {})
        };
      });
      const totalFrameCount = frames.length;
      let allFramesInternal = false;
      let pausedFrame: PausedFrameDisclosure | undefined;
      let pausedFrameNote: string | undefined;
      const policy = this.ctx.selectPolicy(session.language);
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

      this.ctx.logger.info(
        `[FrameAnchor ${sessionId}] Resolved ${frames.length}/${totalFrameCount} frame(s) on thread ${resultThreadId}`
      );
      return {
        frames,
        threadId: resultThreadId,
        totalFrameCount,
        hiddenFrameCount: totalFrameCount - frames.length,
        allFramesInternal,
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
    threadId: number
  ): Promise<DebugProtocol.StackFrame[]> {
    this.ctx.logger.info(`[FrameAnchor ${sessionId}] Sending DAP stackTrace for thread ${threadId}.`);
    const response = await proxyManager.sendDapRequest<DebugProtocol.StackTraceResponse>(
      'stackTrace',
      { threadId }
    );
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
    session: Pick<ManagedSession, 'state'>,
    proxyManager: IProxyManager,
    threadId: number
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
      const scanned = await this.scanThreadsForFrames(sessionId, proxyManager, threadId);
      if (scanned) {
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

  private async describeFramelessThread(
    sessionId: string,
    proxyManager: IProxyManager,
    threadId: number
  ): Promise<string> {
    const threads = await this.listThreadsForScan(sessionId, proxyManager) ?? [];
    const label = (id: number, name?: string): string => name ? `${id} (${name})` : String(id);
    const requested = label(threadId, threads.find((thread) => thread?.id === threadId)?.name);
    const alternative = await this.scanThreadsForFrames(sessionId, proxyManager, threadId, threads);
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

  private async scanThreadsForFrames(
    sessionId: string,
    proxyManager: IProxyManager,
    excludeThreadId: number,
    threads?: DebugProtocol.Thread[]
  ): Promise<{
    threadId: number;
    threadName?: string;
    frames: DebugProtocol.StackFrame[];
  } | null> {
    const candidates = threads ?? await this.listThreadsForScan(sessionId, proxyManager);
    if (!candidates) return null;
    const session = this.ctx.getSession(sessionId);
    const policy = this.ctx.selectPolicy(session.language);
    let runtimeFallback: {
      threadId: number;
      threadName?: string;
      frames: DebugProtocol.StackFrame[];
    } | null = null;
    for (const thread of candidates) {
      if (!thread || typeof thread.id !== 'number' || thread.id === excludeThreadId) continue;
      try {
        const frames = await this.requestRawStackFrames(sessionId, proxyManager, thread.id);
        if (frames.length > 0) {
          const candidate = { threadId: thread.id, threadName: thread.name, frames };
          if (this.hasPolicyUserFrame(frames, policy)) {
            return candidate;
          }
          runtimeFallback ??= candidate;
        }
      } catch {
        // Runtime threads may reject stackTrace; keep probing siblings.
      }
    }
    return runtimeFallback;
  }

  /** Whether a policy recognizes at least one frame as user-inspectable. */
  private hasPolicyUserFrame(
    frames: DebugProtocol.StackFrame[],
    policy: AdapterPolicy
  ): boolean {
    const mapped: StackFrame[] = frames.map((frame) => ({
      id: frame.id,
      name: frame.name,
      // Empty is intentional for classification: policies commonly use a
      // missing source to identify runtime frames.
      file: frame.source?.path || frame.source?.name || '',
      line: frame.line,
      column: frame.column
    }));
    if (policy.isInternalFrame) {
      return mapped.some((frame) => !policy.isInternalFrame!(frame));
    }
    if (policy.filterStackFrames) {
      return policy.filterStackFrames(mapped, false).length > 0;
    }
    return mapped.length > 0;
  }
}
