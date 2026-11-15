/**
 * What counts as a program frame (issue #1131): one the adapter's policy does
 * not call internal AND that names a source. A frame the debugger can only
 * name by symbol (`@core::ops::function::FnOnce::call_once`), or not at all
 * (`<unknown_source>`), cannot be opened at a line, so a stop whose frames are
 * all of that kind has no program frame, whatever the policy's list of
 * runtime names happens to cover.
 *
 * The verdict, the sentence that reports it, and the two fields that tell a
 * caller a `file` is a label rather than a path.
 */
import { describe, it, expect, vi } from 'vitest';
import { CppAdapterPolicy, JavaAdapterPolicy, SessionState, type StackFrame } from '@debugmcp/shared';
import { frameSummary, type StackTraceResult } from '../../../../../src/session/inspection/frame-anchor-resolver.js';
import { programFrames } from '../../../../../src/session/inspection/stop-anchor.js';
import {
  describeStopLocation,
  landingFields,
  type StopLandingContext
} from '../../../../../src/session/inspection/stop-location.js';
import { ErrorMessages } from '../../../../../src/utils/error-messages.js';

const frame = (id: number, name: string, file: string, extra: Partial<StackFrame> = {}): StackFrame =>
  ({ id, name, file, line: 6, column: 0, ...extra });

describe('programFrames (issue #1131)', () => {
  const names = (frames: StackFrame[]) => frames.map((entry) => entry.name);

  it('keeps a frame the policy does not call internal and that names a source', () => {
    const frames = [
      frame(1, 'Sleep', '@Sleep'),
      frame(2, 'main', '/proj/examples/cpp/pause_test.cpp')
    ];
    expect(names(programFrames(frames, CppAdapterPolicy))).toEqual(['main']);
  });

  it.each([
    ['a symbol label', '@core::ops::function::FnOnce::call_once'],
    ['a section label', '@.text'],
    ['the placeholder for no source at all', '<unknown_source>'],
    ['an empty file', '']
  ])('drops a frame whose file is %s, although its name matches no runtime pattern', (_what, file) => {
    expect(programFrames([frame(1, 'core::ops::function::FnOnce::call_once', file)], CppAdapterPolicy)).toEqual([]);
  });

  it('drops a frame the policy calls internal although it has a path', () => {
    expect(programFrames([frame(1, '__libc_start_main', './nptl/libc_start_call_main.c')], CppAdapterPolicy)).toEqual([]);
  });

  it('counts a relative source: whether it is program code stays the policy\'s call', () => {
    const frames = [
      frame(1, 'java.lang.Thread.sleep', 'java/lang/Thread.java'),
      frame(2, 'com.acme.App.main', 'com/acme/App.java')
    ];
    expect(names(programFrames(frames, JavaAdapterPolicy))).toEqual(['com.acme.App.main']);
  });
});

describe('frameSummary (issue #1131)', () => {
  it('says when the file it names is a label, not a path', () => {
    const label = frame(1, 'core::ops::function::FnOnce::call_once', '@core::ops::function::FnOnce::call_once', { unresolvedSource: true });
    expect(frameSummary(label)).toEqual({
      name: 'core::ops::function::FnOnce::call_once',
      file: '@core::ops::function::FnOnce::call_once',
      line: 6,
      unresolvedSource: true
    });
  });

  it('adds nothing for a frame with a path', () => {
    expect(frameSummary(frame(2, 'main', '/proj/src/main.rs'))).toEqual({ name: 'main', file: '/proj/src/main.rs', line: 6 });
  });
});

describe('ErrorMessages.stopWithoutProgramFrame (issue #1131)', () => {
  const top = { name: 'core::ops::function::FnOnce::call_once', file: '@core::ops::function::FnOnce::call_once', line: 6 };

  it('does not call a frame without source runtime, and does not claim the stop is outside the caller\'s code', () => {
    const sentence = ErrorMessages.stopWithoutProgramFrame(4264, 10, top, { framesUnseen: true, sourceless: true });

    expect(sentence).toBe(
      "No program frame is active on thread 4264: all 10 frames are internal/runtime or have no source " +
      "(top: 'core::ops::function::FnOnce::call_once' @core::ops::function::FnOnce::call_once:6). " +
      "Code without source is a runtime's or a library's, or your own built without debug information. " +
      'continue_execution and trigger activity, or set a breakpoint in a source file; ' +
      'get_stack_trace with includeInternals: true lists the frames.'
    );
    expect(sentence).not.toContain('outside your code');
  });

  it('one frame, nothing more to list', () => {
    expect(ErrorMessages.stopWithoutProgramFrame(undefined, 1, top, { sourceless: true })).toBe(
      "No program frame is active: the only frame has no source " +
      "(top: 'core::ops::function::FnOnce::call_once' @core::ops::function::FnOnce::call_once:6). " +
      "Code without source is a runtime's or a library's, or your own built without debug information. " +
      'continue_execution and trigger activity, or set a breakpoint in a source file.'
    );
  });

  it('keeps the runtime wording when every frame is one the policy calls internal', () => {
    expect(ErrorMessages.stopWithoutProgramFrame(7, 4, { name: '__tmainCRTStartup', file: '@__tmainCRTStartup', line: 51 }, { framesUnseen: true })).toBe(
      "No program frame is active on thread 7: all 4 frames are internal/runtime (top: '__tmainCRTStartup' @__tmainCRTStartup:51). " +
      'The stop landed outside your code: continue_execution and trigger activity, or set a breakpoint; ' +
      'get_stack_trace with includeInternals: true lists the frames.'
    );
  });
});

describe('describeStopLocation on a stop where no frame has source (issue #1131)', () => {
  function context(read: StackTraceResult) {
    return {
      getStackTraceDetailed: vi.fn(async () => read),
      getSession: () => ({ state: SessionState.PAUSED, lastStop: { reason: 'step', timestamp: 1, threadId: 4264 } }),
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    } as unknown as StopLandingContext;
  }
  const callOnce = frame(1, 'core::ops::function::FnOnce::call_once', '@core::ops::function::FnOnce::call_once', { unresolvedSource: true });
  const shortBacktrace = frame(2, 'std::sys::backtrace::__rust_begin_short_backtrace', '@.text', { unresolvedSource: true });

  it('flags the location as a label and carries the no-source sentence', async () => {
    const read: StackTraceResult = {
      frames: [callOnce, shortBacktrace],
      threadId: 4264,
      totalFrameCount: 10,
      hiddenFrameCount: 4,
      allFramesInternal: false,
      noProgramFrame: true,
      sourcelessFrames: true
    };

    const landing = await describeStopLocation(context(read), 'sid', 'stepOut');

    expect(landing.location).toEqual({ file: '@core::ops::function::FnOnce::call_once', line: 6, column: 0, unresolvedSource: true });
    expect(landing.noProgramFrame).toBe(true);
    expect(landing.note).toBe(ErrorMessages.stopWithoutProgramFrame(4264, 10, callOnce, { framesUnseen: true, sourceless: true }));
    expect(landingFields(landing).location).toEqual(landing.location);
  });

  it('leaves a location with a path as it was', async () => {
    const main = frame(6, 'main', '/proj/src/main.rs');
    const landing = await describeStopLocation(
      context({ frames: [main], threadId: 4264, totalFrameCount: 1, hiddenFrameCount: 0, allFramesInternal: false }),
      'sid',
      'stepOver'
    );

    expect(landing.location).toEqual({ file: '/proj/src/main.rs', line: 6, column: 0 });
    expect(landing).not.toHaveProperty('note');
  });
});
