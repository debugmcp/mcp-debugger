/**
 * Unit tests for pure step-provenance, adapter step-description filtering, and
 * snapshot call-identity helpers (issues #1180, #1182, #1183, #1184).
 */
import { describe, it, expect } from 'vitest';
import type { StackFrame } from '@debugmcp/shared';
import {
  buildSnapshotFrameKey,
  canonicalFrameName,
  captureStepOrigin,
  compareStepOriginAndLanding,
  hasUnresolvedCallerUnwind,
  meaningfulStepStopDescription,
  stepOutReenteredOriginFrame
} from '../../../../../src/session/execution/step-provenance.js';

function frame(id: number, name: string, file: string, line: number, extra: Partial<StackFrame> = {}): StackFrame {
  return { id, name, file, line, column: 1, ...extra };
}

describe('step-provenance (issues #1180, #1182, #1183, #1184)', () => {
  describe('canonicalFrameName', () => {
    it('strips COBOL active PERFORM call-site suffixes while leaving ordinary names untouched', () => {
      expect(canonicalFrameName('A2: VIA-TIMES (PERFORM BUMP-PARA)')).toBe('A2: VIA-TIMES');
      expect(canonicalFrameName('A2: VIA-TIMES')).toBe('A2: VIA-TIMES');
      expect(canonicalFrameName('global.key')).toBe('global.key');
    });
  });

  describe('captureStepOrigin', () => {
    it('returns undefined for an empty stack', () => {
      expect(captureStepOrigin([], {}, 1)).toBeUndefined();
    });

    it('keeps a runtime-only origin and preserves a pause across an async boundary', () => {
      const runtime = frame(1, 'runtime.wait', '/runtime/wait.js', 2);
      const boundary = frame(2, 'await', '<async>', 0);
      const caller = frame(3, 'caller', '/proj/app.js', 10);
      const onlyRuntime = captureStepOrigin([runtime], { filterStackFrames: () => [] }, 1, 'pause');
      expect(onlyRuntime?.visibleFrames).toEqual([runtime]);

      const paused = captureStepOrigin([runtime, boundary, caller], {
        filterStackFrames: (frames: StackFrame[]) => frames.filter((f) => f.name === 'caller'),
        isAsyncBoundaryFrame: (f: StackFrame) => f.name === 'await'
      }, 1, 'pause');
      expect(paused?.visibleFrames).toEqual([runtime, caller]);
      expect(paused?.rawDepth).toBe(3);
    });

    it('keeps rawTop/rawDepth and reproduces the #672 keep-top-frame rule on user-directed stops', () => {
      const internalTop = frame(1, 'java.lang.Math.max', 'java/lang/Math.java', 2020);
      const userCaller = frame(2, 'StepInto.viaPastLib', '/proj/StepInto.java', 13);
      const userMain = frame(3, 'StepInto.main', '/proj/StepInto.java', 35);
      const policy = {
        filterStackFrames: (frames: StackFrame[]) => frames.filter((f) => !f.name.startsWith('java.'))
      };

      const atStep = captureStepOrigin([internalTop, userCaller, userMain], policy, 1, 'step');
      expect(atStep?.rawTop).toEqual(internalTop);
      expect(atStep?.rawDepth).toBe(3);
      expect(atStep?.visibleFrames).toEqual([internalTop, userCaller, userMain]);

      const atPause = captureStepOrigin([internalTop, userCaller, userMain], policy, 1, 'pause');
      expect(atPause?.visibleFrames).toEqual([userCaller, userMain]);
    });
  });

  describe('compareStepOriginAndLanding', () => {
    it('makes no provenance claim without an origin, live frames, or a program landing', () => {
      const caller = frame(1, 'caller', '/proj/app.py', 10);
      const unwound = frame(2, 'raised', '/proj/app.py', 4, { unwound: true });
      const origin = captureStepOrigin([caller], {}, 1);
      expect(compareStepOriginAndLanding('stepInto', undefined, [caller])).toBeUndefined();
      expect(compareStepOriginAndLanding('stepInto', origin, [], {})).toBeUndefined();
      expect(compareStepOriginAndLanding('stepInto', origin, [unwound])).toBeUndefined();
      expect(compareStepOriginAndLanding('stepInto', captureStepOrigin([unwound], {}, 1), [caller])).toBeUndefined();
      expect(compareStepOriginAndLanding('stepInto', origin, [caller], { noProgramFrame: true })).toBeUndefined();
    });

    it('ignores traceback-only frames when measuring a live step_out return', () => {
      const unwound = frame(1, 'raised', '/proj/app.py', 4, { unwound: true });
      const caller = frame(2, 'caller', '/proj/app.py', 10);
      const main = frame(3, 'main', '/proj/app.py', 20);
      const origin = captureStepOrigin([unwound, caller, main], {}, 1);
      expect(compareStepOriginAndLanding('stepOut', origin, [main])).toBeUndefined();
    });

    it('discloses stacks sharing only the outermost entry without confusing an ordinary caller return', () => {
      const main = frame(3, '<main>', '/proj/app.rb', 30);
      const origin = captureStepOrigin([
        frame(1, 'fiber_leaf', '/proj/app.rb', 5), frame(2, 'fiber_caller', '/proj/app.rb', 10), main
      ], {}, 1);
      expect(compareStepOriginAndLanding('stepOver', origin, [
        frame(4, 'other_leaf', '/proj/app.rb', 15), frame(5, 'other_caller', '/proj/app.rb', 20), main
      ])).toBe(
        "The stack at the stop shares only '<main>' with the stack where the step started (from 'fiber_leaf', now in 'other_leaf')."
      );
      expect(compareStepOriginAndLanding('stepOut', origin, [
        frame(2, 'fiber_caller', '/proj/app.rb', 11), main
      ])).toBeUndefined();
    });

    it('says nothing for normal step_over, step_into a callee, and step_out to immediate caller', () => {
      const originInLeaf = captureStepOrigin(
        [frame(1, 'leaf', '/proj/app.py', 10), frame(2, 'caller', '/proj/app.py', 20), frame(3, 'main', '/proj/app.py', 30)],
        {},
        1
      );
      // Normal step_over inside leaf
      expect(
        compareStepOriginAndLanding('stepOver', originInLeaf, [
          frame(1, 'leaf', '/proj/app.py', 11),
          frame(2, 'caller', '/proj/app.py', 20),
          frame(3, 'main', '/proj/app.py', 30)
        ])
      ).toBeUndefined();

      // Normal step_into deeper callee
      expect(
        compareStepOriginAndLanding('stepInto', originInLeaf, [
          frame(0, 'deeper', '/proj/app.py', 2),
          frame(1, 'leaf', '/proj/app.py', 10),
          frame(2, 'caller', '/proj/app.py', 20),
          frame(3, 'main', '/proj/app.py', 30)
        ])
      ).toBeUndefined();

      // Normal step_out to immediate caller
      expect(
        compareStepOriginAndLanding('stepOut', originInLeaf, [
          frame(2, 'caller', '/proj/app.py', 21),
          frame(3, 'main', '/proj/app.py', 30)
        ])
      ).toBeUndefined();
    });

    it('treats a COBOL PERFORM return as a normal 1-frame step_out despite the caller losing its (PERFORM ...) suffix', () => {
      const origin = captureStepOrigin(
        [
          frame(1, 'A2: BUMP-PARA', '/proj/a2.cob', 48),
          frame(2, 'A2: VIA-TIMES (PERFORM BUMP-PARA)', '/proj/a2.cob', 30),
          frame(3, 'A2: MAIN-PARA (PERFORM VIA-TIMES)', '/proj/a2.cob', 22)
        ],
        {},
        1
      );
      const landing = [
        frame(2, 'A2: VIA-TIMES', '/proj/a2.cob', 31),
        frame(3, 'A2: MAIN-PARA (PERFORM VIA-TIMES)', '/proj/a2.cob', 22)
      ];
      expect(compareStepOriginAndLanding('stepOut', origin, landing)).toBeUndefined();
    });

    it('discloses when step_out lands back in the function stepped out of at the same depth (issues #1180, #1196, #1328)', () => {
      const stack = [
        frame(1, 'global.key', '/proj/cb.cjs', 3),
        frame(2, 'global.viaMap', '/proj/cb.cjs', 7),
        frame(3, '<anonymous>', '/proj/cb.cjs', 10)
      ];
      const origin = captureStepOrigin(stack, {}, 1);
      const note = compareStepOriginAndLanding('stepOut', origin, stack);
      expect(note).toBe(
        "The stop is in 'global.key' at the same call-stack depth as before step_out (either that call has not returned or 'global.key' was called again)."
      );
    });

    it('discloses when step_out lands in a frame above the origin function slot without assuming the same activation (Go deferred recover / loop re-entry)', () => {
      const origin = captureStepOrigin(
        [frame(1, 'main.work', '/proj/main.go', 15), frame(2, 'main.main', '/proj/main.go', 30)],
        {},
        1
      );
      const landing = [
        frame(0, 'main.work.func1', '/proj/main.go', 12),
        frame(1, 'main.work', '/proj/main.go', 15),
        frame(2, 'main.main', '/proj/main.go', 30)
      ];
      const note = compareStepOriginAndLanding('stepOut', origin, landing);
      expect(note).toBe(
        "'main.work' (where step_out was issued) is on the stack 1 frame(s) below the stop (either that call has not returned or 'main.work' was called again)."
      );
    });

    it('discloses when step_out drops more than one frame on the same call stack (issues #1180, #1191, #1195)', () => {
      const origin = captureStepOrigin(
        [
          frame(1, 'thrower', '/proj/app.js', 9),
          frame(2, 'catcher', '/proj/app.js', 14),
          frame(3, 'viaThrow', '/proj/app.js', 21),
          frame(4, 'main', '/proj/app.js', 30)
        ],
        {},
        1
      );
      const landing = [frame(3, 'viaThrow', '/proj/app.js', 22), frame(4, 'main', '/proj/app.js', 30)];
      expect(compareStepOriginAndLanding('stepOut', origin, landing)).toBe(
        "The stop is 2 frames below 'thrower' (where step_out was issued)."
      );
    });

    it('discloses when step_into does not stop inside a called function, and names returned calls from changedVariables (issues #1180, #1184, #1328)', () => {
      const origin = captureStepOrigin(
        [frame(1, 'Leave.ViaProp', '/proj/Leave.cs', 41), frame(2, 'Leave.Main', '/proj/Leave.cs', 88)],
        {},
        1
      );

      // Same line (e.g. Dart `var x = f();` #1200, or JS multi-statement line after a skipped call)
      expect(
        compareStepOriginAndLanding('stepInto', origin, [
          frame(1, 'Leave.ViaProp', '/proj/Leave.cs', 41),
          frame(2, 'Leave.Main', '/proj/Leave.cs', 88)
        ])
      ).toBe('The step did not stop inside a called function; execution is still on the starting line.');

      // Next line with policy step-filter hint (#1184, #1328)
      expect(
        compareStepOriginAndLanding(
          'stepInto',
          origin,
          [frame(1, 'Leave.ViaProp', '/proj/Leave.cs', 42), frame(2, 'Leave.Main', '/proj/Leave.cs', 88)],
          { stepFilterHint: 'If the line invoked a property accessor or operator, netcoredbg steps over it.' }
        )
      ).toBe(
        'The step did not stop inside a called function. If the line invoked a property accessor or operator, netcoredbg steps over it.'
      );

      // Python `(return) <name>` in changedVariables (#1328): names returned call(s) without contradicting them
      expect(
        compareStepOriginAndLanding(
          'stepInto',
          origin,
          [frame(1, 'Leave.ViaProp', '/proj/Leave.cs', 42), frame(2, 'Leave.Main', '/proj/Leave.cs', 88)],
          {
            stepFilterHint: 'If the line called into Python library or dependency code, debugpy ran through it without stopping.',
            changedVariables: {
              '(return) join': { after: "'a/b'", new: true },
              joined: { after: "'a/b'", new: true }
            }
          }
        )
      ).toBe(
        "The step did not stop inside a called function ('join' returned). If the line called into Python library or dependency code, debugpy ran through it without stopping."
      );

      // Updated `(return) <name>` from a second call on a later step (`before` + `after`) counts,
      // while `gone: true` and truncation-shifted `{ after }` (neither `new` nor `before`) do not.
      expect(
        compareStepOriginAndLanding(
          'stepInto',
          origin,
          [frame(1, 'Leave.ViaProp', '/proj/Leave.cs', 41), frame(2, 'Leave.Main', '/proj/Leave.cs', 88)],
          {
            changedVariables: {
              '(return) join': { before: "'a/b'", after: "'c/d'" },
              '(return) dirname': { after: "'c'", new: true },
              '(return) old': { before: "'x'", gone: true },
              '(return) shifted': { after: "'y'" }
            }
          }
        )
      ).toBe("The step did not stop inside a called function ('join', 'dirname' returned); execution is still on the starting line.");

      // Suppressed when JS stepper already provided a walk-limit note
      expect(
        compareStepOriginAndLanding(
          'stepInto',
          origin,
          [frame(1, 'Leave.ViaProp', '/proj/Leave.cs', 42), frame(2, 'Leave.Main', '/proj/Leave.cs', 88)],
          { hasStepperWalkNote: true }
        )
      ).toBeUndefined();
    });

    it('discloses stacks sharing no frame (Ruby fiber switch #1198) while allowing step_into bar(foo()) on main', () => {
      const fiberOrigin = captureStepOrigin([frame(1, 'block in Object#gen_enum', '/proj/enum.rb', 13)], {}, 1);
      const mainLanding = [
        frame(2, 'Object#consume_enum', '/proj/enum.rb', 24),
        frame(3, 'Object#via_enum', '/proj/enum.rb', 28),
        frame(4, '<main>', '/proj/enum.rb', 93)
      ];
      expect(compareStepOriginAndLanding('stepOut', fiberOrigin, mainLanding)).toBe(
        "The stack at the stop shares no frame with the stack where the step started (from 'block in Object#gen_enum', now in 'Object#consume_enum')."
      );

      // Normal step_into from `return x` inside `foo` (or a tail-return leaf inside `foo`) into `bar` on `bar(foo())` in `main` at line 10
      const fooUnderMain = captureStepOrigin(
        [frame(1, 'foo', '/proj/app.py', 4), frame(2, 'main', '/proj/app.py', 10)],
        {},
        1
      );
      const leafUnderFooUnderMain = captureStepOrigin(
        [frame(0, 'leaf', '/proj/app.py', 2), frame(1, 'foo', '/proj/app.py', 4), frame(2, 'main', '/proj/app.py', 10)],
        {},
        1
      );
      const barUnderMain = [frame(3, 'bar', '/proj/app.py', 8), frame(2, 'main', '/proj/app.py', 10)];
      expect(compareStepOriginAndLanding('stepInto', fooUnderMain, barUnderMain)).toBeUndefined();
      expect(compareStepOriginAndLanding('stepInto', leafUnderFooUnderMain, barUnderMain)).toBeUndefined();
    });
  });

  describe('meaningfulStepStopDescription (issue #1182)', () => {
    it.each([undefined, '', '   ', 'Paused', 'paused', 'Paused on step', 'step', 'Stepped', 'Stepped over'])(
      'ignores boilerplate description %j',
      (desc) => {
        expect(meaningfulStepStopDescription(desc)).toBeUndefined();
      }
    );

    it('preserves adapter descriptions that carry actual detail (COBOL PERFORM / step bounds)', () => {
      expect(
        meaningfulStepStopDescription('returned from BUMP-PARA to VIA-TIMES (3 times through the performed range)')
      ).toBe('returned from BUMP-PARA to VIA-TIMES (3 times through the performed range)');
      expect(meaningfulStepStopDescription('stepped over the PERFORM at a2.cob:30')).toBe(
        'stepped over the PERFORM at a2.cob:30'
      );
    });
  });

  describe('snapshot call-identity helpers (issue #1183)', () => {
    it('separates identical call stacks on distinct threads', () => {
      const stack = [frame(1, 'worker', '/proj/app.py', 4), frame(2, 'run', '/proj/app.py', 10)];
      expect(buildSnapshotFrameKey(stack[0], stack, 1)).not.toBe(buildSnapshotFrameKey(stack[0], stack, 2));
      expect(buildSnapshotFrameKey(stack[0], stack, 1)).toBe(buildSnapshotFrameKey(stack[0], stack, 1));
    });

    it('distinguishes calls to the same function from different call-site lines while matching within one call', () => {
      const callA1 = [frame(1, 'key', '/proj/cb.cjs', 3), frame(2, 'viaMap', '/proj/cb.cjs', 7)];
      const callA2 = [frame(1, 'key', '/proj/cb.cjs', 4), frame(2, 'viaMap', '/proj/cb.cjs', 7)];
      const callB = [frame(1, 'key', '/proj/cb.cjs', 3), frame(2, 'viaMap', '/proj/cb.cjs', 12)];

      expect(buildSnapshotFrameKey(callA1[0], callA1)).toBe(buildSnapshotFrameKey(callA2[0], callA2));
      expect(buildSnapshotFrameKey(callA1[0], callA1)).not.toBe(buildSnapshotFrameKey(callB[0], callB));
    });

    it('flags step_out landings that re-enter the origin frame at the same depth', () => {
      const stack = [frame(1, 'global.key', '/proj/cb.cjs', 3), frame(2, 'global.viaMap', '/proj/cb.cjs', 7)];
      const origin = captureStepOrigin(stack, {}, 1);
      expect(stepOutReenteredOriginFrame('stepOut', origin, stack)).toBe(true);
      expect(stepOutReenteredOriginFrame('stepOver', origin, stack)).toBe(false);
      expect(stepOutReenteredOriginFrame('stepOut', undefined, stack)).toBe(false);
      expect(stepOutReenteredOriginFrame('stepOut', captureStepOrigin([stack[0]], {}, 1), stack)).toBe(false);
      expect(stepOutReenteredOriginFrame('stepOut', { rawDepth: 0, visibleFrames: [], threadId: 1 }, [])).toBe(false);
    });

    it('detects garbage caller unwind frames (MinGW g++ closing-brace stop, issue #1204)', () => {
      const healthy = [frame(1, 'leaf', '/proj/a.cpp', 10), frame(2, 'main', '/proj/a.cpp', 20)];
      const brokenHex = [
        frame(1, 'leaf', '/proj/a.cpp', 10),
        frame(2, '50000061', '<unknown_source>', 0, { unresolvedSource: true })
      ];
      const brokenAt = [
        frame(1, 'leaf', '/proj/a.cpp', 10),
        frame(2, '@0x00401234', '@0x00401234', 0, { unresolvedSource: true })
      ];
      expect(hasUnresolvedCallerUnwind(healthy)).toBe(false);
      expect(hasUnresolvedCallerUnwind(brokenHex)).toBe(true);
      expect(hasUnresolvedCallerUnwind(brokenAt)).toBe(true);
      expect(hasUnresolvedCallerUnwind([healthy[0]])).toBe(false);
      expect(hasUnresolvedCallerUnwind([
        healthy[0], frame(2, 'nativeCaller', '<unknown_source>', 0)
      ])).toBe(false);
    });
  });
});
