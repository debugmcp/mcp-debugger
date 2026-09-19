import { describe, it, expect } from 'vitest';
import { COB_FLAG, COB_TYPE, reconstructPicture, usageFor } from '../../../src/manifest/index.js';
import type { CobolFieldAttr } from '../../../src/manifest/index.js';

function attr(type: number, digits = 0, scale = 0, flags = 0): CobolFieldAttr {
  return { type, digits, scale, flags };
}

describe('reconstructPicture', () => {
  it('handles numeric display with and without sign, scale and P positions', () => {
    expect(reconstructPicture(attr(COB_TYPE.NUMERIC_DISPLAY, 5, 0), 5)).toBe('9(5)');
    expect(reconstructPicture(attr(COB_TYPE.NUMERIC_DISPLAY, 1, 0), 1)).toBe('9');
    expect(reconstructPicture(attr(COB_TYPE.NUMERIC_DISPLAY, 7, 2, COB_FLAG.HAVE_SIGN), 7)).toBe('S9(5)V9(2)');
    expect(reconstructPicture(attr(COB_TYPE.NUMERIC_DISPLAY, 3, 3), 3)).toBe('V9(3)');
    expect(reconstructPicture(attr(COB_TYPE.NUMERIC_DISPLAY, 1, 3), 1)).toBe('VP(2)9');
    expect(reconstructPicture(attr(COB_TYPE.NUMERIC_DISPLAY, 3, -2), 3)).toBe('9(3)P(2)');
    expect(reconstructPicture(attr(COB_TYPE.NUMERIC_DISPLAY, 0, 0), 0)).toBeUndefined();
  });

  it('handles binary, packed and floating types by digits', () => {
    expect(reconstructPicture(attr(COB_TYPE.NUMERIC_BINARY, 9, 0, COB_FLAG.HAVE_SIGN), 4)).toBe('S9(9)');
    expect(reconstructPicture(attr(COB_TYPE.NUMERIC_PACKED, 9, 2, COB_FLAG.HAVE_SIGN), 5)).toBe('S9(7)V9(2)');
    expect(reconstructPicture(attr(COB_TYPE.NUMERIC_DOUBLE, 34, 17, COB_FLAG.HAVE_SIGN), 8)).toBe('S9(17)V9(17)');
  });

  it('handles alphanumeric, national, group, pointer and edited', () => {
    expect(reconstructPicture(attr(COB_TYPE.ALPHANUMERIC), 12)).toBe('X(12)');
    expect(reconstructPicture(attr(COB_TYPE.ALPHANUMERIC), 1)).toBe('X');
    expect(reconstructPicture(attr(COB_TYPE.ALPHANUMERIC), 0)).toBeUndefined();
    expect(reconstructPicture(attr(COB_TYPE.NATIONAL), 8)).toBe('N(4)');
    expect(reconstructPicture(attr(COB_TYPE.GROUP), 25)).toBeUndefined();
    expect(reconstructPicture(attr(COB_TYPE.NUMERIC_BINARY, 0, 0, COB_FLAG.IS_POINTER), 8)).toBeUndefined();
    expect(reconstructPicture(attr(COB_TYPE.NUMERIC_EDITED, 6, 2), 7)).toBeUndefined();
    expect(reconstructPicture({ ...attr(COB_TYPE.NUMERIC_EDITED, 6, 2), pic: [{ symbol: 'Z', count: 2 }, { symbol: '9', count: 1 }] }, 3)).toBe('Z(2)9');
    expect(reconstructPicture(undefined, 4)).toBeUndefined();
  });
});

describe('usageFor', () => {
  it('maps libcob types and flags to COBOL usages', () => {
    expect(usageFor(undefined)).toBe('OTHER');
    expect(usageFor(attr(COB_TYPE.GROUP))).toBe('GROUP');
    expect(usageFor(attr(COB_TYPE.NUMERIC_DISPLAY, 5))).toBe('DISPLAY');
    expect(usageFor(attr(COB_TYPE.NUMERIC_BINARY, 9, 0, COB_FLAG.BINARY_SWAP))).toBe('COMP');
    expect(usageFor(attr(COB_TYPE.NUMERIC_BINARY, 9, 0, COB_FLAG.REAL_BINARY))).toBe('COMP-5');
    expect(usageFor(attr(COB_TYPE.NUMERIC_COMP5, 9))).toBe('COMP-5');
    expect(usageFor(attr(COB_TYPE.NUMERIC_PACKED, 9))).toBe('COMP-3');
    expect(usageFor(attr(COB_TYPE.NUMERIC_PACKED, 9, 0, COB_FLAG.NO_SIGN_NIBBLE))).toBe('COMP-6');
    expect(usageFor(attr(COB_TYPE.NUMERIC_FLOAT))).toBe('COMP-1');
    expect(usageFor(attr(COB_TYPE.NUMERIC_DOUBLE))).toBe('COMP-2');
    expect(usageFor(attr(COB_TYPE.NUMERIC_BINARY, 0, 0, COB_FLAG.IS_POINTER))).toBe('POINTER');
    expect(usageFor(attr(COB_TYPE.ALPHANUMERIC))).toBe('DISPLAY');
    expect(usageFor(attr(COB_TYPE.NUMERIC_EDITED))).toBe('DISPLAY');
    expect(usageFor(attr(COB_TYPE.NATIONAL))).toBe('NATIONAL');
    expect(usageFor(attr(COB_TYPE.BOOLEAN))).toBe('OTHER');
  });
});
