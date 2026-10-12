/**
 * selectStopAnchor — the one thread-rescue verdict shared by the attach
 * controller and the frame-anchor resolver (issue #904).
 */
import { describe, it, expect, vi } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { CppAdapterPolicy, JavaAdapterPolicy, type AdapterPolicy, type StackFrame } from '@debugmcp/shared';
import {
  ATTACH_ANCHOR_BOUNDS,
  isProgramNeutralStopReason,
  policyUserFrames,
  reachesProgram,
  selectStopAnchor,
  toStackFrame,
  USER_DIRECTED_STOP_REASONS,
  type StopAnchorInput
} from '../../../../../src/session/inspection/stop-anchor.js';

type Raw = DebugProtocol.StackFrame;

const frame = (id: number, name: string, source?: DebugProtocol.Source, line = 0): Raw => ({
  id, name, line, column: 0, ...(source ? { source } : {})
});

// The measured Windows break-in stack (issue #898): ntdll only, no source anywhere.
const BREAK_IN: Raw[] = [
  frame(1, 'DbgBreakPoint'),
  frame(2, 'DbgUiRemoteBreakin', { name: '@DbgUiRemoteBreakin', sourceReference: 1 }),
  frame(3, 'BaseThreadInitThunk', { name: '@BaseThreadInitThunk', sourceReference: 2 }),
  frame(4, 'RtlUserThreadStart', { name: '@RtlUserThreadStart', sourceReference: 3 })
];
// The program thread: a runtime sleep over main.
const IN_MAIN: Raw[] = [
  frame(5, 'Sleep'),
  frame(6, 'main', { path: '/proj/examples/cpp/pause_test.cpp' }, 20)
];
const WORKER: Raw[] = [frame(7, 'worker', { path: '/proj/examples/cpp/worker.cpp' }, 40)];
const RUNTIME_ONLY: Raw[] = [frame(8, 'NtWaitForWorkViaWorkerFactory', { name: '@NtWaitForWorkViaWorkerFactory', sourceReference: 4 })];

const threads = (...entries: Array<[number, string]>): DebugProtocol.Thread[] =>
  entries.map(([id, name]) => ({ id, name }));

/** A fake unwind over a per-thread record that also records every call. */
function fakeUnwind(stacks: Record<number, Raw[]>, rejecting: number[] = []) {
  const calls: Array<{ threadId: number; timeoutMs: number }> = [];
  const unwind: StopAnchorInput['unwind'] = async (threadId, opts) => {
    calls.push({ threadId, timeoutMs: opts.timeoutMs });
    if (rejecting.includes(threadId)) {
      throw new Error(`thread ${threadId} is running`);
    }
    return stacks[threadId] ?? [];
  };
  return { unwind, calls };
}

const input = (
  stacks: Record<number, Raw[]>,
  overrides: Partial<StopAnchorInput> & Pick<StopAnchorInput, 'threads'>,
  rejecting?: number[]
) => {
  const { unwind, calls } = fakeUnwind(stacks, rejecting);
  const base: StopAnchorInput = { unwind, policy: CppAdapterPolicy, bounds: ATTACH_ANCHOR_BOUNDS, ...overrides };
  return { base, calls };
};

describe('selectStopAnchor (issue #904)', () => {
  it('unwinds the stopped thread first, then threads named main, then listed order', async () => {
    const { base, calls } = input(
      { 6660: BREAK_IN, 5128: WORKER, 9: IN_MAIN },
      { stoppedThreadId: 6660, threads: threads([5128, 'thread #1'], [6660, 'thread #3'], [9, 'main']) }
    );

    const verdict = await selectStopAnchor(base);

    expect(verdict.programThreadId).toBe(9);
    expect(verdict.stopped).toBe('internal-only');
    expect(calls.map((call) => call.threadId)).toEqual([6660, 9]);
  });

  it('a stopped thread whose stack reaches the program ends the scan at once', async () => {
    const { base, calls } = input(
      { 37436: IN_MAIN, 5128: RUNTIME_ONLY },
      { stoppedThreadId: 37436, threads: threads([5128, 'thread #1'], [37436, 'thread #2']) }
    );

    const verdict = await selectStopAnchor(base);

    expect(verdict).toMatchObject({ programThreadId: 37436, stopped: 'program' });
    expect(calls.map((call) => call.threadId)).toEqual([37436]);
  });

  it('uses the stopped frames the caller already read and never re-unwinds that thread', async () => {
    const { base, calls } = input(
      { 6660: [], 9: IN_MAIN },
      { stoppedThreadId: 6660, stoppedFrames: BREAK_IN, threads: threads([6660, 'thread #3'], [9, 'main']) }
    );

    const verdict = await selectStopAnchor(base);

    expect(verdict.programThreadId).toBe(9);
    expect(verdict.stacks.get(6660)).toBe(BREAK_IN);
    expect(calls.map((call) => call.threadId)).toEqual([9]);
  });

  it('keeps the reported thread and reports internal-only when no listed stack reaches the program', async () => {
    const { base } = input(
      { 6660: BREAK_IN, 5128: RUNTIME_ONLY },
      { stoppedThreadId: 6660, threads: threads([5128, 'thread #1'], [6660, 'thread #3']) }
    );

    const verdict = await selectStopAnchor(base);

    expect(verdict.programThreadId).toBeUndefined();
    expect(verdict.stopped).toBe('internal-only');
    // The runtime sibling has frames: a frameless stop could still adopt it.
    expect(verdict.framedSiblingId).toBe(5128);
  });

  it('reports a frameless stopped thread and names the first sibling with any frames', async () => {
    const { base } = input(
      { 1: [], 2: RUNTIME_ONLY, 3: IN_MAIN },
      { stoppedThreadId: 1, threads: threads([1, 'stopped'], [2, 'runtime'], [3, 'program']) }
    );

    const verdict = await selectStopAnchor(base);

    expect(verdict).toMatchObject({ stopped: 'frameless', framedSiblingId: 2, programThreadId: 3 });
  });

  it('reports a stopped thread missing from the list as unlisted and still unwinds it first (#758)', async () => {
    const { base, calls } = input(
      { 77: [], 9: IN_MAIN },
      { stoppedThreadId: 77, threads: threads([9, 'main']) }
    );

    const verdict = await selectStopAnchor(base);

    expect(verdict.stopped).toBe('unlisted');
    expect(verdict.programThreadId).toBe(9);
    expect(calls.map((call) => call.threadId)).toEqual([77, 9]);
  });

  it('caps the scan at maxThreads, the stopped thread included', async () => {
    const stacks: Record<number, Raw[]> = { 1: BREAK_IN, 2: RUNTIME_ONLY, 3: RUNTIME_ONLY, 4: IN_MAIN };
    const { base, calls } = input(stacks, {
      stoppedThreadId: 1,
      threads: threads([1, 'a'], [2, 'b'], [3, 'c'], [4, 'd']),
      bounds: { ...ATTACH_ANCHOR_BOUNDS, maxThreads: 3 }
    });

    const verdict = await selectStopAnchor(base);

    expect(calls.map((call) => call.threadId)).toEqual([1, 2, 3]);
    expect(verdict.programThreadId).toBeUndefined();
  });

  it('gives every unwind its own timeout and stops when the budget is spent', async () => {
    const { base, calls } = input(
      { 1: BREAK_IN, 2: RUNTIME_ONLY, 3: IN_MAIN },
      { stoppedThreadId: 1, threads: threads([1, 'a'], [2, 'b'], [3, 'c']), bounds: { maxThreads: 16, unwindTimeoutMs: 250, budgetMs: 10_000 } }
    );
    await selectStopAnchor(base);
    expect(calls.every((call) => call.timeoutMs <= 250)).toBe(true);

    const spent = input(
      { 1: BREAK_IN, 3: IN_MAIN },
      { stoppedThreadId: 1, stoppedFrames: BREAK_IN, threads: threads([1, 'a'], [3, 'c']), bounds: { maxThreads: 16, unwindTimeoutMs: 250, budgetMs: 0 }, log: vi.fn() }
    );
    const verdict = await selectStopAnchor(spent.base);
    expect(spent.calls).toHaveLength(0);
    expect(verdict).toMatchObject({ stopped: 'internal-only' });
    expect(verdict.programThreadId).toBeUndefined();
    expect(spent.base.log).toHaveBeenCalledWith(expect.stringContaining('budget spent'));
  });

  it('skips a thread whose unwind rejects, as a running sibling does', async () => {
    const { base, calls } = input(
      { 1: BREAK_IN, 2: [], 3: IN_MAIN },
      { stoppedThreadId: 1, threads: threads([1, 'a'], [2, 'running isolate'], [3, 'c']), log: vi.fn() },
      [2]
    );

    const verdict = await selectStopAnchor(base);

    expect(verdict.programThreadId).toBe(3);
    expect(calls.map((call) => call.threadId)).toEqual([1, 2, 3]);
    expect(verdict.stacks.has(2)).toBe(false);
    expect(base.log).toHaveBeenCalledWith(expect.stringContaining('thread 2 could not be unwound'));
  });

  it('with no stopped thread, prefers a thread named main over listed order', async () => {
    const { base } = input({ 5128: WORKER, 9: IN_MAIN }, { threads: threads([5128, 'thread #1'], [9, 'main']) });

    const verdict = await selectStopAnchor(base);

    expect(verdict.programThreadId).toBe(9);
    expect(verdict.stopped).toBe('frameless');
  });
});

describe('reachesProgram', () => {
  it('needs a frame that both names a source and is one the policy calls the program', () => {
    expect(reachesProgram(IN_MAIN, CppAdapterPolicy)).toBe(true);
    expect(reachesProgram(WORKER, CppAdapterPolicy)).toBe(true);
    // Placeholders the debugger made up: '@symbol' labels and sourceless frames.
    expect(reachesProgram(BREAK_IN, CppAdapterPolicy)).toBe(false);
    expect(reachesProgram(RUNTIME_ONLY, CppAdapterPolicy)).toBe(false);
    expect(reachesProgram([frame(1, '<anonymous>', undefined, 1)], CppAdapterPolicy)).toBe(false);
  });

  it('a relative label counts as a source when the policy calls the frame the program (Java without debug info)', () => {
    const userWithoutPath = [frame(1, 'com.acme.Worker.run', { name: 'Worker.java' }, 12)];
    const jdkOnly = [frame(2, 'java.lang.Thread.run', { path: 'java/lang/Thread.java' }, 833)];
    expect(reachesProgram(userWithoutPath, JavaAdapterPolicy)).toBe(true);
    // A path alone is not enough: the JDI bridge gives JDK frames one too.
    expect(reachesProgram(jdkOnly, JavaAdapterPolicy)).toBe(false);
  });

  it('a filterStackFrames-only policy classifies through its filter; a bare policy counts any sourced frame', () => {
    const filterOnly = {
      filterStackFrames: (frames: StackFrame[]) => frames.filter((f) => !f.name.startsWith('runtime.'))
    } as unknown as AdapterPolicy;
    const runtime = [frame(1, 'runtime.gopark', { path: '/usr/lib/go/src/runtime/proc.go' }, 1)];
    const user = [...runtime, frame(2, 'main.main', { path: '/proj/main.go' }, 7)];
    expect(reachesProgram(runtime, filterOnly)).toBe(false);
    expect(reachesProgram(user, filterOnly)).toBe(true);
    expect(reachesProgram(runtime, {} as AdapterPolicy)).toBe(true);
  });
});

describe('policyUserFrames and toStackFrame', () => {
  it('reads the per-frame classifier before the filter, so a filter that hands the stack back cannot hide an all-runtime stack', () => {
    const handsBack = {
      isInternalFrame: (f: StackFrame) => f.name.startsWith('java.'),
      filterStackFrames: (frames: StackFrame[]) => {
        const kept = frames.filter((f) => !f.name.startsWith('java.'));
        return kept.length > 0 ? kept : frames;
      }
    } as unknown as AdapterPolicy;
    const jdk = [frame(1, 'java.lang.Thread.run', { path: 'java/lang/Thread.java' }, 833)].map(toStackFrame);
    expect(policyUserFrames(jdk, handsBack)).toEqual([]);
    expect(handsBack.filterStackFrames!(jdk, false)).toHaveLength(1);
  });

  it('maps a frame the way the resolver does: path, else name, else <unknown_source>; the unresolved flag only on real-looking paths', () => {
    expect(toStackFrame(frame(1, 'f', { path: '/a/b.ts' }, 3))).toMatchObject({ file: '/a/b.ts', line: 3 });
    expect(toStackFrame(frame(2, 'g', { name: '@sym', sourceReference: 9 }))).toMatchObject({ file: '@sym', unresolvedSource: true });
    expect(toStackFrame(frame(3, '<anonymous>', undefined, 1))).toMatchObject({ file: '<unknown_source>' });
    expect(toStackFrame(frame(4, 'h', { path: '<node_internals>/x.js', sourceReference: 2 }))).not.toHaveProperty('unresolvedSource');
  });
});

describe('stop reason sets', () => {
  it('only a pause is program-neutral; breakpoints and steps are user-directed', () => {
    expect(isProgramNeutralStopReason('pause')).toBe(true);
    for (const reason of ['breakpoint', 'step', 'exception', 'entry', undefined]) {
      expect(isProgramNeutralStopReason(reason)).toBe(false);
    }
    expect(USER_DIRECTED_STOP_REASONS.has('breakpoint')).toBe(true);
    expect(USER_DIRECTED_STOP_REASONS.has('step')).toBe(true);
    expect(USER_DIRECTED_STOP_REASONS.has('pause')).toBe(false);
  });
});
