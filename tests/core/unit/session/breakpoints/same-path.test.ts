/**
 * One file under two spellings is one file to the breakpoint records too
 * (issue #1147).
 *
 * A breakpoint's file goes to the adapter in the host's own spelling
 * (`dapSourcePath`), and the adapter answers with what it was sent. A path
 * typed with a `..` segment or a doubled separator therefore came back
 * "bound in another file", and `list_breakpoints` reported a `boundFile` that
 * was only the breakpoint's own file, spelled differently.
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import type { Breakpoint } from '@debugmcp/shared';
import { applyBoundLocation, samePath } from '../../../../../src/session/breakpoints/hit-verification.js';

const onWindows = process.platform === 'win32';
/** A path of this machine, with a `..` segment in it, and the form it is sent under. */
const typed = onWindows ? 'C:/proj/pause_test/../pause_test/PauseTest.cs' : '/proj/pause_test/../pause_test/PauseTest.cs';
const sent = path.resolve(typed);

const record = (file: string): Breakpoint => ({ id: 'b1', file, line: 9, verified: false } as Breakpoint);

describe('samePath (issue #1147)', () => {
  it('takes a path and the form it is sent to the adapter under for the same file', () => {
    expect(sent).not.toBe(typed);
    expect(samePath(typed, sent)).toBe(true);
    expect(samePath(sent, typed)).toBe(true);
  });

  it.runIf(onWindows)('also when the adapter answers in its own case and separators', () => {
    expect(samePath('C:/proj/pause_test/../pause_test/PauseTest.cs', 'c:\\proj\\pause_test\\PauseTest.cs')).toBe(true);
    // Doubled separators, as a path pasted out of a JSON string has them.
    expect(samePath('C:\\\\proj\\\\pause_test\\\\PauseTest.cs', 'C:\\proj\\pause_test\\PauseTest.cs')).toBe(true);
  });

  it('still tells two files apart', () => {
    expect(samePath(typed, path.resolve(path.dirname(sent), 'Other.cs'))).toBe(false);
    expect(samePath('/app/a.py', '/app/b.py')).toBe(false);
  });

  it('leaves a path of another system as it was: equal only when identical', () => {
    const foreign = onWindows ? '/app/src/../src/main.py' : 'C:/proj/src/../src/main.cs';
    const resolvedElsewhere = onWindows ? '/app/src/main.py' : 'C:/proj/src/main.cs';
    expect(samePath(foreign, foreign)).toBe(true);
    expect(samePath(foreign, resolvedElsewhere)).toBe(false);
  });
});

describe('applyBoundLocation (issue #1147)', () => {
  it('records no boundFile when the adapter answers with the breakpoint\'s own file in the form it was sent', () => {
    const breakpoint = record(typed);

    applyBoundLocation(breakpoint, sent, 9);

    expect(breakpoint.boundFile).toBeUndefined();
    expect(breakpoint.boundLine).toBeUndefined();
  });

  it('still records where a breakpoint bound when that is another file', () => {
    const breakpoint = record(typed);
    const generated = path.resolve(path.dirname(sent), 'PauseTest.g.cs');

    applyBoundLocation(breakpoint, generated, 41);

    expect(breakpoint.boundFile).toBe(generated);
    expect(breakpoint.boundLine).toBe(41);
  });
});
