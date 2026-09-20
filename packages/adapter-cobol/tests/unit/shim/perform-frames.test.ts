/**
 * Reading libcob's PERFORM stack through the engine: the line entry a return address
 * resolves to comes back from `/py` in whatever shape CodeLLDB reprs it.
 */
import { describe, expect, it } from 'vitest';
import { parseLineEntry } from '../../../src/shim/perform-frames.js';

describe('parseLineEntry', () => {
  it('reads a bare `path|line`', () => {
    expect(parseLineEntry('/work/cobol/build/hello.c|163')).toEqual({ path: '/work/cobol/build/hello.c', line: 163 });
  });

  it('undoes a single-quoted repr with doubled backslashes', () => {
    expect(parseLineEntry("'C:\\\\work\\\\cobol\\\\hello.c|140'")).toEqual({ path: 'C:\\work\\cobol\\hello.c', line: 140 });
  });

  it('undoes the double-quoted repr Python uses for a path holding an apostrophe', () => {
    expect(parseLineEntry('"C:\\\\Users\\\\O\'Brien\\\\work\\\\hello.c|126"')).toEqual({ path: "C:\\Users\\O'Brien\\work\\hello.c", line: 126 });
  });

  it('refuses a result without a line', () => {
    expect(parseLineEntry('None')).toBeUndefined();
    expect(parseLineEntry('|0')).toBeUndefined();
  });
});
