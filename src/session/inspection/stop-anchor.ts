/**
 * One verdict on which thread a stop is anchored on (issue #904).
 *
 * A debugger names the thread it stopped on, but that thread is not always
 * the program's: CodeLLDB reports a Windows attach or pause on the break-in
 * thread the OS injects (an ntdll-only stack, issues #761/#817/#898), a
 * .NET stop can land on a thread whose stack has not materialised (issue
 * #496), and js-debug's pause on an idle server lands on a frame with no
 * source at all (issue #900). The attach controller and the frame-anchor
 * resolver each used to carry their own copy of the rescue; this module is
 * the one they share. It decides, it does not act: the callers move the
 * anchor (`setCurrentThreadId`) and word the disclosure.
 *
 * The scan is bounded on three axes — threads unwound, one unwind's own
 * timeout, and a total budget — because every candidate costs a DAP round
 * trip and a running sibling (a Dart isolate, say) may reject or stall it.
 */
import type { AdapterPolicy, StackFrame } from '@debugmcp/shared';
import { BREAKPOINT_STOP_REASONS } from '@debugmcp/shared';
import type { DebugProtocol } from '@vscode/debugprotocol';

/**
 * Stop reasons where the user asked to be exactly here — a breakpoint they
 * set (the shared breakpoint family), a step they requested. Such a stop is
 * never re-anchored, and when it lands in a frame the display filter
 * classifies internal the frame is kept (issue #672).
 */
export const USER_DIRECTED_STOP_REASONS: ReadonlySet<string> = new Set([...BREAKPOINT_STOP_REASONS, 'step']);

/**
 * Whether a stop reason says nothing about *where* the program should be:
 * a pause (the user's, the attach's, or the Windows break-in the policies
 * normalise to `pause`) stops the program wherever it happens to be, so the
 * reported thread is merely the one the debugger chose to name. Only such a
 * stop may be anchored on a sibling thread; a breakpoint, step, exception or
 * entry stop belongs to the thread it was reported on.
 */
export function isProgramNeutralStopReason(reason: string | undefined): boolean {
  return reason === 'pause';
}

/**
 * The resolver's frame mapping, shared so the scan classifies the same
 * `StackFrame` the display filters see. A non-zero DAP `sourceReference` on
 * a real-looking path is the adapter saying "not a file you can open here"
 * (js-debug for a source-mapped original it never found on disk, issue
 * #655; CodeLLDB for a native frame without debug info, which it names
 * `@symbol`, issue #816). Placeholders (`<node_internals>`, `<eval>`) carry
 * one too but are self-describing, so only real-looking paths are flagged.
 */
export function toStackFrame(frame: DebugProtocol.StackFrame): StackFrame {
  const file = frame.source?.path || frame.source?.name || '<unknown_source>';
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
}

/**
 * The frames a policy calls the program's: `isInternalFrame` when the policy
 * has one, else what `filterStackFrames` keeps, else every frame. Read off
 * the per-frame classifier first because a policy's filter may hand the
 * whole stack back when nothing survives (Java does), which would make an
 * all-runtime stack look like a program stack.
 */
export function policyUserFrames(frames: StackFrame[], policy: AdapterPolicy): StackFrame[] {
  if (policy.isInternalFrame) {
    return frames.filter((frame) => !policy.isInternalFrame!(frame));
  }
  if (policy.filterStackFrames) {
    return policy.filterStackFrames(frames, false);
  }
  return frames;
}

/**
 * A frame whose `file` names a source rather than a label the debugger made
 * up for native or sourceless code (`@symbol`, `<unknown_source>`,
 * `<node_internals>`). A relative label such as the JDI bridge's
 * `java/lang/Thread.java` still counts: whether it is program code is the
 * policy's call, below.
 */
function namesASource(file: string): boolean {
  return file.length > 0 && !file.startsWith('@') && !file.startsWith('<');
}

/**
 * Whether a stack reaches the program: some frame both names a source and
 * is one the policy calls the program's. A path alone is not enough (the
 * JDI bridge gives a JDK frame a path; LLDB knows the Windows runtime by
 * name), and the policy alone is not enough either (its runtime patterns
 * are a list, and a thread-pool worker it has never heard of must not win
 * over the thread in `main`).
 */
export function reachesProgram(rawFrames: DebugProtocol.StackFrame[], policy: AdapterPolicy): boolean {
  const frames = rawFrames.map(toStackFrame);
  return policyUserFrames(frames, policy).some((frame) => namesASource(frame.file));
}

export interface StopAnchorBounds {
  /** How many listed threads may be unwound, the stopped thread included. */
  readonly maxThreads: number;
  /** One unwind's own timeout: a thread that cannot be unwound must not cost the whole budget. */
  readonly unwindTimeoutMs: number;
  /** The whole scan's budget. */
  readonly budgetMs: number;
}

/** The attach controller's bounds (issues #761/#817): sized for the verify window. */
export const ATTACH_ANCHOR_BOUNDS: StopAnchorBounds = {
  maxThreads: 16,
  unwindTimeoutMs: 3_000,
  budgetMs: 10_000
};

export interface StopAnchorInput {
  /** The thread the debugger reported the stop on, when it named one. */
  stoppedThreadId?: number;
  /** That thread's frames when the caller has already read them; it is then never re-unwound. */
  stoppedFrames?: DebugProtocol.StackFrame[];
  /** The threads the debugger lists. */
  threads: DebugProtocol.Thread[];
  /** One thread's stack, under the given timeout. A rejection skips the thread. */
  unwind: (threadId: number, opts: { timeoutMs: number }) => Promise<DebugProtocol.StackFrame[]>;
  policy: AdapterPolicy;
  bounds: StopAnchorBounds;
  log?: (message: string) => void;
}

export interface StopAnchorVerdict {
  /**
   * The first listed thread whose stack reaches the program — the stopped
   * thread first, then threads named `main`, then listed order. Absent when
   * none does within the bounds.
   */
  programThreadId?: number;
  /**
   * The first thread other than the stopped one that has frames at all,
   * whatever they are: the fallback for a stop whose own thread reports no
   * stack (issue #496), where any stack beats none.
   */
  framedSiblingId?: number;
  /** What the stopped thread's own stack says. */
  stopped: 'program' | 'internal-only' | 'frameless' | 'unlisted';
  /** Every stack the scan read, by thread id, so a caller never unwinds twice. */
  stacks: Map<number, DebugProtocol.StackFrame[]>;
}

/**
 * Order the candidates: the stopped thread first, then threads named `main`
 * (the JVM's name for the program thread; CodeLLDB names none), then the
 * rest as listed. A stopped thread missing from the list is still unwound
 * first: a stop can race the thread-list response (#758).
 */
function orderCandidates(threads: DebugProtocol.Thread[], stoppedThreadId: number | undefined): number[] {
  const listed = threads.filter((thread) => thread && typeof thread.id === 'number');
  const others = listed.filter((thread) => thread.id !== stoppedThreadId);
  return [
    ...(typeof stoppedThreadId === 'number' ? [stoppedThreadId] : []),
    ...others.filter((thread) => thread.name === 'main').map((thread) => thread.id),
    ...others.filter((thread) => thread.name !== 'main').map((thread) => thread.id)
  ];
}

export async function selectStopAnchor(input: StopAnchorInput): Promise<StopAnchorVerdict> {
  const { stoppedThreadId, threads, unwind, policy, bounds, log } = input;
  const stacks = new Map<number, DebugProtocol.StackFrame[]>();
  if (typeof stoppedThreadId === 'number' && input.stoppedFrames) {
    stacks.set(stoppedThreadId, input.stoppedFrames);
  }
  const listed = typeof stoppedThreadId === 'number' && threads.some((thread) => thread?.id === stoppedThreadId);
  let stopped: StopAnchorVerdict['stopped'] = typeof stoppedThreadId === 'number' && !listed ? 'unlisted' : 'frameless';
  let programThreadId: number | undefined;
  let framedSiblingId: number | undefined;

  const deadline = Date.now() + bounds.budgetMs;
  const candidates = orderCandidates(threads, stoppedThreadId).slice(0, bounds.maxThreads);
  for (const threadId of candidates) {
    let frames = stacks.get(threadId);
    if (!frames) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        log?.(`stop-anchor scan: budget spent before thread ${threadId}; keeping the reported thread`);
        break;
      }
      try {
        frames = await unwind(threadId, { timeoutMs: Math.min(bounds.unwindTimeoutMs, remaining) });
      } catch (error) {
        log?.(`stop-anchor scan: thread ${threadId} could not be unwound (${error instanceof Error ? error.message : String(error)})`);
        continue;
      }
      stacks.set(threadId, frames);
    }
    const reaches = frames.length > 0 && reachesProgram(frames, policy);
    if (threadId === stoppedThreadId) {
      stopped = frames.length === 0 ? (listed ? 'frameless' : 'unlisted') : reaches ? 'program' : 'internal-only';
    } else if (frames.length > 0 && framedSiblingId === undefined) {
      framedSiblingId = threadId;
    }
    if (reaches) {
      programThreadId = threadId;
      break;
    }
  }

  return {
    ...(programThreadId !== undefined ? { programThreadId } : {}),
    ...(framedSiblingId !== undefined ? { framedSiblingId } : {}),
    stopped,
    stacks
  };
}
