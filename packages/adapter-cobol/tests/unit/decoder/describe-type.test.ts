import { describe, expect, it } from 'vitest';
import { COB_FLAG, COB_TYPE } from '../../../src/manifest/attr-constants.js';
import { describeType, formatNumeric, reconstructPictureFromAttr } from '../../../src/decoder/index.js';
import type { DecodableItem } from '../../../src/decoder/index.js';
import { attr, item } from './helpers.js';

const { NUMERIC_DISPLAY, NUMERIC_BINARY, NUMERIC_PACKED, NUMERIC_COMP5, NUMERIC_FLOAT, NUMERIC_DOUBLE, ALPHANUMERIC, GROUP } = COB_TYPE;
const SIGNED = COB_FLAG.HAVE_SIGN;

interface TypeCase {
  name: string;
  item: DecodableItem;
  expect: string;
}

const cases: TypeCase[] = [
  { name: 'signed display with scale, no picture in manifest', item: item(attr(NUMERIC_DISPLAY, 7, 2, SIGNED), 7), expect: 'PIC S9(5)V99' },
  { name: 'manifest picture wins over reconstruction', item: item(attr(NUMERIC_DISPLAY, 7, 2, SIGNED), 7, { picture: 'S9(5)V9(2)' }), expect: 'PIC S9(5)V9(2)' },
  { name: 'single digit uses plain 9 like the cobc listing', item: item(attr(NUMERIC_DISPLAY, 1, 0, 0), 1), expect: 'PIC 9' },
  { name: 'unsigned 9(4)', item: item(attr(NUMERIC_DISPLAY, 4, 0, 0), 4), expect: 'PIC 9(4)' },
  { name: 'separate sign keeps the S and the digit count (size is digits + 1)', item: item(attr(NUMERIC_DISPLAY, 3, 0, 0x7), 4), expect: 'PIC S9(3)' },
  { name: 'V-only fraction', item: item(attr(NUMERIC_DISPLAY, 2, 2, 0), 2), expect: 'PIC V99' },
  { name: 'V9 single fraction digit', item: item(attr(NUMERIC_DISPLAY, 2, 1, 0), 2), expect: 'PIC 9V9' },
  { name: 'scale beyond digits → leading P', item: item(attr(NUMERIC_DISPLAY, 1, 3, 0), 1), expect: 'PIC PP9' },
  { name: 'negative scale → trailing P', item: item(attr(NUMERIC_DISPLAY, 3, -2, SIGNED), 3), expect: 'PIC S9(3)PP' },
  { name: 'scale of four beyond digits → P(4)', item: item(attr(NUMERIC_DISPLAY, 1, 5, 0), 1), expect: 'PIC P(4)9' },
  { name: 'long fraction is counted', item: item(attr(NUMERIC_DISPLAY, 9, 4, SIGNED), 9), expect: 'PIC S9(5)V9(4)' },
  { name: 'V-only long fraction', item: item(attr(NUMERIC_DISPLAY, 6, 6, 0), 6), expect: 'PIC V9(6)' },
  { name: 'display with digits 0 falls back to size', item: item(attr(NUMERIC_DISPLAY, 0, 0, 0), 5), expect: 'PIC 9(5)' },
  { name: 'COMP-3', item: item(attr(NUMERIC_PACKED, 9, 2, SIGNED), 5, { usage: 'COMP-3' }), expect: 'PIC S9(7)V99 COMP-3' },
  { name: 'COMP-6 via NO_SIGN_NIBBLE', item: item(attr(NUMERIC_PACKED, 4, 0, COB_FLAG.NO_SIGN_NIBBLE), 2, { usage: 'COMP-6' }), expect: 'PIC 9(4) COMP-6' },
  { name: 'COMP (binary swap)', item: item(attr(NUMERIC_BINARY, 4, 0, 0x0820), 2, { usage: 'COMP' }), expect: 'PIC 9(4) COMP' },
  { name: 'COMP-5 as type 0x1b', item: item(attr(NUMERIC_COMP5, 9, 0, 0x0041), 4, { usage: 'COMP-5' }), expect: 'PIC S9(9) COMP-5' },
  { name: 'COMP-5 as type 0x11 + REAL_BINARY (attr wins over usage)', item: item(attr(NUMERIC_BINARY, 9, 0, 0x0041), 4, { usage: 'COMP' }), expect: 'PIC S9(9) COMP-5' },
  { name: 'COMP-1 has no picture', item: item(attr(NUMERIC_FLOAT, 15, 8, 0x0201), 4, { usage: 'COMP-1' }), expect: 'COMP-1' },
  { name: 'COMP-2 has no picture', item: item(attr(NUMERIC_DOUBLE, 34, 17, 0x0201), 8, { usage: 'COMP-2' }), expect: 'COMP-2' },
  { name: 'FLOAT-BINARY-32/64 report as COMP-1/COMP-2', item: item(attr(COB_TYPE.NUMERIC_FP_BIN64, 34, 17, 0x0201), 8), expect: 'COMP-2' },
  { name: 'alphanumeric', item: item(attr(ALPHANUMERIC, 0, 0, 0), 20), expect: 'PIC X(20)' },
  { name: 'alphanumeric single byte', item: item(attr(ALPHANUMERIC, 0, 0, 0), 1), expect: 'PIC X' },
  { name: 'alphanumeric with a manifest picture', item: item(attr(ALPHANUMERIC, 0, 0, 0), 12, { picture: 'X(12)' }), expect: 'PIC X(12)' },
  { name: 'group', item: item(attr(GROUP, 0, 0, 0), 25, { usage: 'GROUP', level: 1 }), expect: 'GROUP (25 bytes)' },
  { name: 'no attr at all is a group', item: item(undefined, 13, { usage: 'GROUP', level: 1 }), expect: 'GROUP (13 bytes)' },
  { name: 'pointer', item: item(attr(NUMERIC_BINARY, 0, 0, COB_FLAG.IS_POINTER), 8, { usage: 'POINTER' }), expect: 'POINTER' },
  { name: 'pointer flag wins even with a picture and numeric usage', item: item(attr(NUMERIC_BINARY, 9, 0, COB_FLAG.IS_POINTER | SIGNED), 8, { usage: 'COMP', picture: 'S9(9)' }), expect: 'POINTER' },
  { name: 'INDEX usage is not shown as COMP-5', item: item(attr(NUMERIC_BINARY, 9, 0, 0x0041), 4, { usage: 'INDEX' }), expect: 'INDEX' },
  { name: 'OCCURS max is appended', item: item(attr(ALPHANUMERIC, 0, 0, 0), 3, { occurs: { min: 10, max: 10, elemSize: 3 } }), expect: 'PIC X(3) OCCURS 10' },
  { name: 'OCCURS on a numeric item', item: item(attr(NUMERIC_PACKED, 5, 0, 0), 3, { usage: 'COMP-3', occurs: { min: 1, max: 50, elemSize: 3 } }), expect: 'PIC 9(5) COMP-3 OCCURS 50' },
  { name: 'OCCURS on a group', item: item(attr(GROUP, 0, 0, 0), 40, { usage: 'GROUP', occurs: { min: 0, max: 5, elemSize: 40 } }), expect: 'GROUP (40 bytes) OCCURS 5' },
  { name: 'listing picture that already carries the usage is not suffixed twice', item: item(attr(NUMERIC_PACKED, 4, 0, 0), 3, { usage: 'COMP-3', picture: '9(4) COMP-3' }), expect: 'PIC 9(4) COMP-3' },
  { name: 'listing picture with COMPUTATIONAL-5', item: item(attr(NUMERIC_COMP5, 9, 0, 0x41), 4, { usage: 'COMP-5', picture: 'S9(9) COMPUTATIONAL-5' }), expect: 'PIC S9(9) COMPUTATIONAL-5' },
  { name: 'listing picture with BINARY', item: item(attr(NUMERIC_BINARY, 9, 0, 0x821), 4, { usage: 'COMP', picture: 'S9(9) BINARY' }), expect: 'PIC S9(9) BINARY' },
  { name: 'listing picture with PACKED-DECIMAL', item: item(attr(NUMERIC_PACKED, 9, 0, 1), 5, { usage: 'COMP-3', picture: 'S9(9) PACKED-DECIMAL' }), expect: 'PIC S9(9) PACKED-DECIMAL' },
  { name: 'listing picture with trailing whitespace is trimmed', item: item(attr(NUMERIC_DISPLAY, 3, 0, 0), 3, { picture: '9(3)  ' }), expect: 'PIC 9(3)' },
  { name: 'empty picture string falls back to reconstruction', item: item(attr(NUMERIC_DISPLAY, 3, 0, 0), 3, { picture: '' }), expect: 'PIC 9(3)' },
  { name: 'boolean', item: item(attr(COB_TYPE.BOOLEAN, 8, 0, 0), 1), expect: 'PIC 1(8)' },
  { name: 'boolean with digits 0 uses size * 8', item: item(attr(COB_TYPE.BOOLEAN, 0, 0, 0), 2), expect: 'PIC 1(16)' },
  { name: 'edited from attr.pic', item: item(attr(COB_TYPE.NUMERIC_EDITED, 5, 2, 0, [{ symbol: 'Z', count: 2 }, { symbol: '9', count: 1 }, { symbol: '.', count: 1 }, { symbol: '9', count: 2 }]), 6), expect: 'PIC Z(2)9.9(2)' },
  { name: 'edited without any picture source', item: item(attr(COB_TYPE.ALPHANUMERIC_EDITED, 0, 0, 0), 9), expect: 'PIC (edited, 9 bytes)' },
  { name: 'usage-only fallback when the attr type is unknown but usage says COMP', item: item(attr(0x00, 4, 0, 0), 2, { usage: 'COMP', picture: '9(4)' }), expect: 'PIC 9(4) COMP' },
  { name: 'display never gets a suffix even if usage is mislabelled', item: item(attr(NUMERIC_DISPLAY, 4, 0, 0), 4, { usage: 'COMP' }), expect: 'PIC 9(4)' }
];

describe('describeType', () => {
  for (const c of cases) {
    it(c.name, () => {
      expect(describeType(c.item)).toBe(c.expect);
    });
  }
});

describe('reconstructPictureFromAttr', () => {
  it('numeric pictures', () => {
    expect(reconstructPictureFromAttr(attr(NUMERIC_DISPLAY, 5, 2, SIGNED), 5)).toBe('S9(3)V99');
    expect(reconstructPictureFromAttr(attr(NUMERIC_DISPLAY, 1, 0, 0), 1)).toBe('9');
    expect(reconstructPictureFromAttr(attr(NUMERIC_DISPLAY, 6, 6, 0), 6)).toBe('V9(6)');
    expect(reconstructPictureFromAttr(attr(NUMERIC_BINARY, 18, 0, SIGNED), 8)).toBe('S9(18)');
    expect(reconstructPictureFromAttr(attr(NUMERIC_PACKED, 3, 1, 0), 2)).toBe('9(2)V9');
    expect(reconstructPictureFromAttr(attr(NUMERIC_COMP5, 4, 0, 0x41), 2)).toBe('S9(4)');
  });

  it('text and boolean pictures', () => {
    expect(reconstructPictureFromAttr(attr(ALPHANUMERIC, 0, 0, 0), 12)).toBe('X(12)');
    expect(reconstructPictureFromAttr(attr(ALPHANUMERIC, 0, 0, 0), 1)).toBe('X');
    expect(reconstructPictureFromAttr(attr(COB_TYPE.ALPHANUMERIC_ALL, 0, 0, 0), 3)).toBe('X(3)');
    expect(reconstructPictureFromAttr(attr(COB_TYPE.BOOLEAN, 3, 0, 0), 1)).toBe('1(3)');
    expect(reconstructPictureFromAttr(attr(COB_TYPE.NATIONAL, 0, 0, 0), 6)).toBe('N(3)');
  });

  it('edited pictures come from attr.pic, count 1 is the bare symbol', () => {
    expect(reconstructPictureFromAttr(attr(COB_TYPE.NUMERIC_EDITED, 0, 0, 0, [{ symbol: '$', count: 1 }, { symbol: 'Z', count: 4 }, { symbol: '9', count: 1 }]), 6)).toBe('$Z(4)9');
    expect(reconstructPictureFromAttr(attr(COB_TYPE.NATIONAL_EDITED, 0, 0, 0, [{ symbol: 'N', count: 2 }, { symbol: '/', count: 1 }]), 6)).toBe('N(2)/');
    expect(reconstructPictureFromAttr(attr(COB_TYPE.NUMERIC_EDITED, 0, 0, 0, []), 6)).toBeUndefined();
    expect(reconstructPictureFromAttr(attr(COB_TYPE.NUMERIC_EDITED, 0, 0, 0), 6)).toBeUndefined();
  });

  it('undefined for groups, pointers, floats, unknowns and empty items', () => {
    expect(reconstructPictureFromAttr(attr(GROUP, 0, 0, 0), 10)).toBeUndefined();
    expect(reconstructPictureFromAttr(attr(NUMERIC_BINARY, 0, 0, COB_FLAG.IS_POINTER), 8)).toBeUndefined();
    expect(reconstructPictureFromAttr(attr(NUMERIC_FLOAT, 15, 8, 0x201), 4)).toBeUndefined();
    expect(reconstructPictureFromAttr(attr(NUMERIC_DOUBLE, 34, 17, 0x201), 8)).toBeUndefined();
    expect(reconstructPictureFromAttr(attr(0x15, 0, 0, 0), 16)).toBeUndefined();
    expect(reconstructPictureFromAttr(attr(ALPHANUMERIC, 0, 0, 0), 0)).toBeUndefined();
    expect(reconstructPictureFromAttr(attr(NUMERIC_BINARY, 0, 0, 0), 4)).toBeUndefined();
  });
});

describe('formatNumeric', () => {
  const cases: Array<[bigint, number, string]> = [
    [-12345n, 2, '-123.45'],
    [150000n, 2, '1500.00'],
    [0n, 2, '0.00'],
    [5n, 0, '5'],
    [12n, -2, '1200'],
    [0n, 0, '0'],
    [0n, -2, '0'],
    [-5n, 3, '-0.005'],
    [5n, 1, '0.5'],
    [-1n, 0, '-1'],
    [123n, 3, '0.123'],
    [123n, 4, '0.0123'],
    [-123n, 5, '-0.00123'],
    [1234567890123456789012345678901n, 0, '1234567890123456789012345678901'],
    [-1234567890123456789012345678901n, 10, '-123456789012345678901.2345678901'],
    [9n, -18, '9000000000000000000']
  ];
  for (const [mantissa, scale, expected] of cases) {
    it(`formatNumeric(${mantissa}n, ${scale}) === '${expected}'`, () => {
      expect(formatNumeric(mantissa, scale)).toBe(expected);
    });
  }
});
