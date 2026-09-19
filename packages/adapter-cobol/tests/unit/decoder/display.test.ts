import { describe, it } from 'vitest';
import { COB_FLAG, COB_TYPE } from '../../../src/manifest/attr-constants.js';
import { attr, runVector, type Vector } from './helpers.js';

const DISPLAY = COB_TYPE.NUMERIC_DISPLAY;
const SIGNED = COB_FLAG.HAVE_SIGN;
const SEP_TRAILING = COB_FLAG.HAVE_SIGN | COB_FLAG.SIGN_SEPARATE;
const SEP_LEADING = SEP_TRAILING | COB_FLAG.SIGN_LEADING;
const LEADING_OVERPUNCH = COB_FLAG.HAVE_SIGN | COB_FLAG.SIGN_LEADING;

const vectors: Vector[] = [
  {
    // ✔ measured GnuCOBOL 3.2: S9(5)V99 = -123.45 → '001234u' ('5' | 0x40 = 'u')
    name: 'measured: S9(5)V99 = -123.45 with ASCII trailing overpunch',
    hex: '30 30 31 32 33 34 75',
    attr: attr(DISPLAY, 7, 2, SIGNED),
    size: 7,
    expect: { value: '-123.45', kind: 'numeric', type: 'PIC S9(5)V99', mantissa: -12345n, scale: 2, signSeen: 'ascii-overpunch' }
  },
  {
    name: 'signed positive: plain digits, signSeen none',
    hex: '30 30 31 32 33 34 35',
    attr: attr(DISPLAY, 7, 2, SIGNED),
    size: 7,
    expect: { value: '123.45', kind: 'numeric', mantissa: 12345n, scale: 2, signSeen: 'none' }
  },
  {
    name: 'ASCII overpunch p = -0 on the trailing digit',
    hex: '31 32 70',
    attr: attr(DISPLAY, 3, 0, SIGNED),
    size: 3,
    expect: { value: '-120', kind: 'numeric', mantissa: -120n, signSeen: 'ascii-overpunch' }
  },
  {
    name: 'ASCII overpunch y = -9',
    hex: '30 30 79',
    attr: attr(DISPLAY, 3, 0, SIGNED),
    size: 3,
    expect: { value: '-9', kind: 'numeric', mantissa: -9n, signSeen: 'ascii-overpunch' }
  },
  {
    name: 'EBCDIC-style positive overpunch C = +3',
    hex: '31 32 43',
    attr: attr(DISPLAY, 3, 0, SIGNED),
    size: 3,
    expect: { value: '123', kind: 'numeric', mantissa: 123n, signSeen: 'ebcdic-overpunch' }
  },
  {
    name: 'EBCDIC-style negative overpunch L = -3',
    hex: '31 32 4c',
    attr: attr(DISPLAY, 3, 0, SIGNED),
    size: 3,
    expect: { value: '-123', kind: 'numeric', mantissa: -123n, signSeen: 'ebcdic-overpunch' }
  },
  {
    name: 'EBCDIC-style { = +0',
    hex: '31 32 7b',
    attr: attr(DISPLAY, 3, 0, SIGNED),
    size: 3,
    expect: { value: '120', kind: 'numeric', mantissa: 120n, signSeen: 'ebcdic-overpunch' }
  },
  {
    name: 'EBCDIC-style } = -0',
    hex: '31 32 7d',
    attr: attr(DISPLAY, 3, 0, SIGNED),
    size: 3,
    expect: { value: '-120', kind: 'numeric', mantissa: -120n, signSeen: 'ebcdic-overpunch' }
  },
  {
    name: 'EBCDIC-style I = +9 and R = -9 (alphabet bounds)',
    hex: '30 49',
    attr: attr(DISPLAY, 2, 0, SIGNED),
    size: 2,
    expect: { value: '9', kind: 'numeric', mantissa: 9n, signSeen: 'ebcdic-overpunch' }
  },
  {
    name: 'EBCDIC-style R = -9',
    hex: '30 52',
    attr: attr(DISPLAY, 2, 0, SIGNED),
    size: 2,
    expect: { value: '-9', kind: 'numeric', mantissa: -9n, signSeen: 'ebcdic-overpunch' }
  },
  {
    name: 'leading overpunch (SIGN LEADING): q23 = -123',
    hex: '71 32 33',
    attr: attr(DISPLAY, 3, 0, LEADING_OVERPUNCH),
    size: 3,
    expect: { value: '-123', kind: 'numeric', mantissa: -123n, signSeen: 'ascii-overpunch' }
  },
  {
    name: 'leading overpunch: a punched trailing byte is not the sign position → invalid',
    hex: '31 32 75',
    attr: attr(DISPLAY, 3, 0, LEADING_OVERPUNCH),
    size: 3,
    expect: { value: '<invalid display: "12u">', kind: 'invalid', invalid: /byte 2/ }
  },
  {
    name: 'separate trailing sign -',
    hex: '31 32 33 2d',
    attr: attr(DISPLAY, 3, 0, SEP_TRAILING),
    size: 4,
    expect: { value: '-123', kind: 'numeric', mantissa: -123n, signSeen: 'separate' }
  },
  {
    name: 'separate trailing sign +',
    hex: '31 32 33 2b',
    attr: attr(DISPLAY, 3, 0, SEP_TRAILING),
    size: 4,
    expect: { value: '123', kind: 'numeric', mantissa: 123n, signSeen: 'separate' }
  },
  {
    name: 'separate leading sign -',
    hex: '2d 31 32 33',
    attr: attr(DISPLAY, 3, 0, SEP_LEADING),
    size: 4,
    expect: { value: '-123', kind: 'numeric', mantissa: -123n, signSeen: 'separate' }
  },
  {
    name: 'separate leading sign + with scale',
    hex: '2b 30 30 35',
    attr: attr(DISPLAY, 3, 2, SEP_LEADING),
    size: 4,
    expect: { value: '0.05', kind: 'numeric', mantissa: 5n, scale: 2, signSeen: 'separate' }
  },
  {
    name: 'separate sign byte that is not +/- → invalid',
    hex: '31 32 33 20',
    attr: attr(DISPLAY, 3, 0, SEP_TRAILING),
    size: 4,
    expect: { value: '<invalid display: "123 ">', kind: 'invalid', invalid: /trailing sign byte/ }
  },
  {
    name: 'separate sign with a digit in the sign slot → invalid (not silently a 4-digit number)',
    hex: '2d 31 32 33',
    attr: attr(DISPLAY, 3, 0, SEP_TRAILING),
    size: 4,
    expect: { value: '<invalid display: "-123">', kind: 'invalid' }
  },
  {
    name: 'unsigned item with an overpunched byte → invalid',
    hex: '31 32 75',
    attr: attr(DISPLAY, 3, 0, 0),
    size: 3,
    expect: { value: '<invalid display: "12u">', kind: 'invalid', invalid: /overpunched sign on an unsigned item/ }
  },
  {
    name: 'unsigned plain digits',
    hex: '30 30 30 34 32',
    attr: attr(DISPLAY, 5, 0, 0),
    size: 5,
    expect: { value: '42', kind: 'numeric', type: 'PIC 9(5)', mantissa: 42n, signSeen: 'none' }
  },
  {
    name: 'all spaces → zero',
    hex: '20 20 20',
    attr: attr(DISPLAY, 3, 0, 0),
    size: 3,
    expect: { value: '0', kind: 'numeric', mantissa: 0n, signSeen: 'none' }
  },
  {
    name: 'all spaces with scale → 0.00',
    hex: '20 20 20 20 20',
    attr: attr(DISPLAY, 5, 2, SIGNED),
    size: 5,
    expect: { value: '0.00', kind: 'numeric', mantissa: 0n, scale: 2 }
  },
  {
    name: 'BLANK WHEN ZERO flag, all spaces → zero',
    hex: '20 20 20 20',
    attr: attr(DISPLAY, 4, 0, COB_FLAG.BLANK_ZERO),
    size: 4,
    expect: { value: '0', kind: 'numeric', mantissa: 0n }
  },
  {
    name: 'leading spaces on a partially filled field → invalid (only an all-space field is zero)',
    hex: '20 20 31 32',
    attr: attr(DISPLAY, 4, 0, 0),
    size: 4,
    expect: { value: '<invalid display: "  12">', kind: 'invalid', invalid: /byte 0/ }
  },
  {
    name: 'letter in a digit position → invalid with the raw text',
    hex: '31 41 33',
    attr: attr(DISPLAY, 3, 0, 0),
    size: 3,
    expect: { value: '<invalid display: "1A3">', kind: 'invalid' }
  },
  {
    name: 'non-printable byte is escaped in the invalid rendering',
    hex: '31 00 33',
    attr: attr(DISPLAY, 3, 0, 0),
    size: 3,
    expect: { value: '<invalid display: "1\\x003">', kind: 'invalid' }
  },
  {
    name: 'all zeros',
    hex: '30 30 30 30',
    attr: attr(DISPLAY, 4, 0, 0),
    size: 4,
    expect: { value: '0', kind: 'numeric', mantissa: 0n }
  },
  {
    name: 'scale larger than digits (PIC PP9): 9 → 0.009',
    hex: '39',
    attr: attr(DISPLAY, 1, 3, 0),
    size: 1,
    expect: { value: '0.009', kind: 'numeric', type: 'PIC PP9', mantissa: 9n, scale: 3 }
  },
  {
    name: 'negative scale (PIC 9PP): 9 → 900',
    hex: '39',
    attr: attr(DISPLAY, 1, -2, 0),
    size: 1,
    expect: { value: '900', kind: 'numeric', type: 'PIC 9PP', mantissa: 9n, scale: -2 }
  },
  {
    name: 'scale equals digits (PIC V99): 50 → 0.50',
    hex: '35 30',
    attr: attr(DISPLAY, 2, 2, 0),
    size: 2,
    expect: { value: '0.50', kind: 'numeric', type: 'PIC V99', mantissa: 50n, scale: 2 }
  },
  {
    name: '31-digit unsigned display (BigInt path)',
    hex: '31 '.repeat(31),
    attr: attr(DISPLAY, 31, 0, 0),
    size: 31,
    expect: { value: '1'.repeat(31), kind: 'numeric', mantissa: BigInt('1'.repeat(31)) }
  },
  {
    name: '18-digit signed display, negative overpunch',
    hex: '39 '.repeat(17) + '79',
    attr: attr(DISPLAY, 18, 0, SIGNED),
    size: 18,
    expect: { value: '-' + '9'.repeat(18), kind: 'numeric', mantissa: -BigInt('9'.repeat(18)), signSeen: 'ascii-overpunch' }
  },
  {
    name: 'size 0 display item → invalid, not an exception',
    hex: '',
    attr: attr(DISPLAY, 3, 0, 0),
    size: 0,
    expect: { value: '<invalid display: no storage>', kind: 'invalid', invalid: /size 0/ }
  }
];

describe('decodeItem: USAGE DISPLAY numerics', () => {
  for (const v of vectors) {
    it(v.name, () => {
      runVector(v);
    });
  }
});
