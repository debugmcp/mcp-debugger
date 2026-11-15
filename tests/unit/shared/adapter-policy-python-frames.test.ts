/**
 * Issue #1143: a frame's name is the function's name, and nothing else.
 *
 * At a user-unhandled exception stop pydevd lists the traceback's frames,
 * the ones the exception has already left, above the frame execution is
 * really paused in, and marks that one by appending " (Current frame)" to its
 * name. The marker broke anything that compares a frame name with a function
 * name. The Python policy takes it off and says the same thing as data: the
 * frames above it carry `unwound: true`, so the first frame without the flag
 * is the live one, as on every other stop.
 *
 * Measured (debugpy 1.8, pytest preset, tests/fixtures/python/pytest-project):
 *   test_assert_fails        test_assert_fails (Current frame)
 *   test_assert_in_helper    check_positive | test_assert_in_helper (Current frame)
 *   test_decorated           test_decorated | wrapper (Current frame)
 *   test_key_error_escapes   days_in | prorate | test_key_error_escapes (Current frame)
 *   test_fixture_raises      broken_fixture (Current frame)
 */
import { describe, it, expect } from 'vitest';
import { PythonAdapterPolicy, type StackFrame } from '@debugmcp/shared';

const frame = (id: number, name: string, line = 10): StackFrame => ({ id, name, file: '/proj/tests/test_billing.py', line });
const normalize = (frames: StackFrame[]): StackFrame[] => PythonAdapterPolicy.normalizeStackFrames!(frames);

describe('PythonAdapterPolicy.normalizeStackFrames (issue #1143)', () => {
  it('takes the marker off a live frame 0 and flags nothing', () => {
    expect(normalize([frame(1, 'test_assert_fails (Current frame)', 16), frame(2, 'pytest_pyfunc_call', 194)])).toEqual([
      frame(1, 'test_assert_fails', 16),
      frame(2, 'pytest_pyfunc_call', 194)
    ]);
  });

  it('flags the frames above the marked one as unwound, and only those', () => {
    expect(
      normalize([
        frame(1, 'days_in', 7),
        frame(2, 'prorate', 11),
        frame(3, 'test_key_error_escapes (Current frame)', 42),
        frame(4, 'pytest_pyfunc_call', 194)
      ])
    ).toEqual([
      { ...frame(1, 'days_in', 7), unwound: true },
      { ...frame(2, 'prorate', 11), unwound: true },
      frame(3, 'test_key_error_escapes', 42),
      frame(4, 'pytest_pyfunc_call', 194)
    ]);
  });

  it('flags the test function itself when a decorator\'s wrapper is the live frame', () => {
    expect(normalize([frame(1, 'test_decorated', 60), frame(2, 'wrapper (Current frame)', 53)])).toEqual([
      { ...frame(1, 'test_decorated', 60), unwound: true },
      frame(2, 'wrapper', 53)
    ]);
  });

  it('hands back the same frames when pydevd marked none: an ordinary stop', () => {
    const frames = [frame(1, 'main', 3), frame(2, '<module>', 9)];

    expect(normalize(frames)).toBe(frames);
  });

  it('only reads the marker at the end of a name', () => {
    const frames = [frame(1, 'report (Current frame) totals', 3)];

    expect(normalize(frames)).toBe(frames);
  });

  it('reads past a frame the adapter sent without a name', () => {
    const nameless = { id: 1, file: '/proj/a.py', line: 1 } as unknown as StackFrame;

    expect(normalize([nameless])).toEqual([nameless]);
    expect(normalize([nameless, frame(2, 'main (Current frame)', 3)])).toEqual([
      { ...nameless, unwound: true },
      frame(2, 'main', 3)
    ]);
  });

  it('does not change the frames it was given', () => {
    const given = [frame(1, 'check_positive', 16), frame(2, 'test_assert_in_helper (Current frame)', 20)];
    const copy = structuredClone(given);

    normalize(given);

    expect(given).toEqual(copy);
  });
});
