/**
 * describeStopLocation — the one landing read behind the pause, step,
 * wait_for_stop and attach answers (issue #904).
 */
import { describe, it, expect, vi } from 'vitest';
import { SessionState } from '@debugmcp/shared';
import type { StackTraceResult } from '../../../../../src/session/inspection/frame-anchor-resolver.js';
import {
  describeStopLocation,
  landingFields,
  type StopLandingContext
} from '../../../../../src/session/inspection/stop-location.js';

const MAIN = { id: 6, name: 'main', file: '/proj/pause_test.cpp', line: 20, column: 36 };
const IDLE = { id: 0, name: '<anonymous>', file: '<unknown_source>', line: 1, column: 1 };

function result(overrides: Partial<StackTraceResult> = {}): StackTraceResult {
  return { frames: [MAIN], totalFrameCount: 1, hiddenFrameCount: 0, allFramesInternal: false, ...overrides };
}

function context(opts: {
  reason?: string;
  stopThreadId?: number;
  state?: SessionState;
  read?: StackTraceResult | Error;
  stateAfterRead?: SessionState;
}) {
  let state = opts.state ?? SessionState.PAUSED;
  const getStackTraceDetailed = vi.fn(async () => {
    if (opts.stateAfterRead) {
      state = opts.stateAfterRead;
    }
    if (opts.read instanceof Error) {
      throw opts.read;
    }
    return opts.read ?? result();
  });
  const ctx = {
    getStackTraceDetailed,
    getSession: () => ({
      state,
      lastStop: opts.reason === undefined
        ? undefined
        : { reason: opts.reason, timestamp: 1, ...(opts.stopThreadId !== undefined ? { threadId: opts.stopThreadId } : {}) }
    }),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  } as unknown as StopLandingContext;
  return { ctx, getStackTraceDetailed };
}

describe('describeStopLocation (issue #904)', () => {
  it('reads a pause with the readiness option, so an internal-only or frameless thread may be traded for a sibling', async () => {
    const { ctx, getStackTraceDetailed } = context({ reason: 'pause', stopThreadId: 1 });

    await describeStopLocation(ctx, 'sid', 'pause');

    expect(getStackTraceDetailed).toHaveBeenCalledWith('sid', undefined, false, { ensureStackReady: true });
  });

  it.each(['step', 'breakpoint', 'exception', 'entry'])('reads a %s stop plainly: it belongs to its thread', async (reason) => {
    const { ctx, getStackTraceDetailed } = context({ reason, stopThreadId: 1 });

    await describeStopLocation(ctx, 'sid', 'stepOver');

    expect(getStackTraceDetailed).toHaveBeenCalledWith('sid');
  });

  it('answers the first visible frame as location and nothing else on an ordinary landing', async () => {
    const { ctx } = context({ reason: 'step', stopThreadId: 1, read: result({ threadId: 1 }) });

    const landing = await describeStopLocation(ctx, 'sid', 'stepOver');

    expect(landing).toEqual({ location: { file: '/proj/pause_test.cpp', line: 20, column: 36 } });
    expect(landingFields(landing)).toEqual({ location: { file: '/proj/pause_test.cpp', line: 20, column: 36 } });
  });

  it('names the thread and passes the note when the resolver anchored off the reported thread', async () => {
    const note = "The stop was reported on thread 20256, whose 4 frames are all internal/runtime (top: 'DbgBreakPoint'); showing thread 15896, which is in 'main'.";
    const { ctx } = context({ reason: 'pause', stopThreadId: 20256, read: result({ threadId: 15896, note }) });

    const landing = await describeStopLocation(ctx, 'sid', 'pause');

    expect(landing).toEqual({ location: { file: '/proj/pause_test.cpp', line: 20, column: 36 }, threadId: 15896, note });
  });

  it('omits threadId when the answer is on the reported thread, and when the stop named no thread', async () => {
    const same = await describeStopLocation(context({ reason: 'pause', stopThreadId: 7, read: result({ threadId: 7 }) }).ctx, 'sid', 'pause');
    expect(same).not.toHaveProperty('threadId');

    const unnamed = await describeStopLocation(context({ reason: 'pause', read: result({ threadId: 7, note: 'switched' }) }).ctx, 'sid', 'pause');
    expect(unnamed).not.toHaveProperty('threadId');
    expect(unnamed.note).toBe('switched');
  });

  it('says no program frame is active when the shown stack has none, after any resolver note', async () => {
    const { ctx } = context({
      reason: 'pause',
      stopThreadId: 0,
      read: result({ frames: [IDLE], threadId: 0, allFramesInternal: true, noProgramFrame: true })
    });

    const landing = await describeStopLocation(ctx, 'sid', 'pause');

    expect(landing.noProgramFrame).toBe(true);
    expect(landing.location).toEqual({ file: '<unknown_source>', line: 1, column: 1 });
    expect(landing.note).toBe(
      "No program frame is active on thread 0: the only frame is internal/runtime (top: '<anonymous>' <unknown_source>:1). " +
      'The stop landed outside your code: continue_execution and trigger activity, or set a breakpoint; ' +
      'get_stack_trace with includeInternals: true lists the frames.'
    );
    // The flag stays internal; the answer carries the sentence.
    expect(landingFields(landing)).toEqual({ location: { file: '<unknown_source>', line: 1, column: 1 }, note: landing.note });
  });

  it('keeps the resolver note for a frameless landing while the session is still paused', async () => {
    const note = 'The stopped thread reported no stack frames within 3000ms; the target may be paused in native code.';
    const { ctx } = context({ reason: 'pause', stopThreadId: 1, read: result({ frames: [], totalFrameCount: 0, threadId: 1, note }) });

    const landing = await describeStopLocation(ctx, 'sid', 'pause');

    expect(landing).toEqual({ note });
  });

  it('drops the resolver note once the session left PAUSED under the read, so a "not paused" note never rides on a Paused answer', async () => {
    const { ctx } = context({
      reason: 'pause',
      stopThreadId: 1,
      stateAfterRead: SessionState.RUNNING,
      read: result({ frames: [], totalFrameCount: 0, note: 'Cannot get stack trace: session is running.' })
    });

    expect(await describeStopLocation(ctx, 'sid', 'pause')).toEqual({});
  });

  it('answers nothing when the read throws, and logs at debug level', async () => {
    const { ctx } = context({ reason: 'pause', stopThreadId: 1, read: new Error('stackTrace failed') });

    expect(await describeStopLocation(ctx, 'sid', 'pause')).toEqual({});
    expect((ctx.logger.debug as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.stringContaining('Could not capture location'),
      expect.any(Error)
    );
  });
});
