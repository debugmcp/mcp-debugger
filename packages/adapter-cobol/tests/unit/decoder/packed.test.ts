import { describe, it } from 'vitest';
import { COB_FLAG, COB_TYPE } from '../../../src/manifest/attr-constants.js';
import { attr, runVector, type Vector } from './helpers.js';

const PACKED = COB_TYPE.NUMERIC_PACKED;
const SIGNED = COB_FLAG.HAVE_SIGN;
const COMP6 = COB_FLAG.NO_SIGN_NIBBLE;

const vectors: Vector[] = [
  {
    // ✔ measured GnuCOBOL 3.2
    name: 'measured: S9(7)V99 COMP-3 = -12345.67',
    hex: '00 12 34 56 7d',
    attr: attr(PACKED, 9, 2, SIGNED),
    size: 5,
    expect: { value: '-12345.67', kind: 'numeric', type: 'PIC S9(7)V99 COMP-3', mantissa: -1234567n, scale: 2, signSeen: 'nibble' }
  },
  {
    // ✔ measured GnuCOBOL 3.2
    name: 'measured: S9(7)V99 COMP-3 = +1500.00',
    hex: '00 01 50 00 0c',
    attr: attr(PACKED, 9, 2, SIGNED),
    size: 5,
    expect: { value: '1500.00', kind: 'numeric', mantissa: 150000n, scale: 2, signSeen: 'nibble' }
  },
  {
    // ✔ the S0C7 case: ASCII 'ABCDE' moved over a packed field
    name: 'measured: text over a packed field is the S0C7 case',
    hex: '41 42 43 44 45',
    attr: attr(PACKED, 9, 2, SIGNED),
    size: 5,
    // every digit nibble of 'ABCDE' happens to be 0–9 (4,1,4,2,…); what fails is the sign nibble 0x5
    expect: { value: '<invalid packed: 0x4142434445>', kind: 'invalid', invalid: /sign nibble is 0x5/ }
  },
  {
    name: 'odd digit count 9(3) COMP-3 in 2 bytes, F sign',
    hex: '12 3f',
    attr: attr(PACKED, 3, 0, 0),
    size: 2,
    expect: { value: '123', kind: 'numeric', type: 'PIC 9(3) COMP-3', mantissa: 123n, signSeen: 'nibble' }
  },
  {
    name: 'even digit count 9(4) COMP-3 in 3 bytes with a leading pad nibble',
    hex: '01 23 4f',
    attr: attr(PACKED, 4, 0, 0),
    size: 3,
    expect: { value: '1234', kind: 'numeric', type: 'PIC 9(4) COMP-3', mantissa: 1234n }
  },
  { name: 'sign nibble C (positive)', hex: '12 3c', attr: attr(PACKED, 3, 0, SIGNED), size: 2, expect: { value: '123', kind: 'numeric', mantissa: 123n } },
  { name: 'sign nibble F (positive/unsigned)', hex: '12 3f', attr: attr(PACKED, 3, 0, SIGNED), size: 2, expect: { value: '123', kind: 'numeric', mantissa: 123n } },
  { name: 'sign nibble A (positive alternate)', hex: '12 3a', attr: attr(PACKED, 3, 0, SIGNED), size: 2, expect: { value: '123', kind: 'numeric', mantissa: 123n } },
  { name: 'sign nibble E (positive alternate)', hex: '12 3e', attr: attr(PACKED, 3, 0, SIGNED), size: 2, expect: { value: '123', kind: 'numeric', mantissa: 123n } },
  { name: 'sign nibble D (negative)', hex: '12 3d', attr: attr(PACKED, 3, 0, SIGNED), size: 2, expect: { value: '-123', kind: 'numeric', mantissa: -123n } },
  { name: 'sign nibble B (negative alternate)', hex: '12 3b', attr: attr(PACKED, 3, 0, SIGNED), size: 2, expect: { value: '-123', kind: 'numeric', mantissa: -123n } },
  {
    name: 'digit nibble in the sign position → invalid',
    hex: '12 34',
    attr: attr(PACKED, 3, 0, SIGNED),
    size: 2,
    expect: { value: '<invalid packed: 0x1234>', kind: 'invalid', invalid: /sign nibble is 0x4/ }
  },
  {
    name: 'negative sign nibble on an unsigned item → invalid (an unsigned COMP-3 is stored with F)',
    hex: '12 3d',
    attr: attr(PACKED, 3, 0, 0),
    size: 2,
    expect: { value: '<invalid packed: 0x123d>', kind: 'invalid', invalid: /negative sign nibble 0xd on an unsigned item/ }
  },
  {
    name: 'positive C nibble on an unsigned item is accepted',
    hex: '12 3c',
    attr: attr(PACKED, 3, 0, 0),
    size: 2,
    expect: { value: '123', kind: 'numeric', mantissa: 123n }
  },
  {
    name: 'COMP-6 (no sign nibble): every nibble is a digit',
    hex: '12 34',
    attr: attr(PACKED, 4, 0, COMP6),
    size: 2,
    expect: { value: '1234', kind: 'numeric', type: 'PIC 9(4) COMP-6', mantissa: 1234n, signSeen: 'none' }
  },
  {
    name: 'COMP-6 with odd digits pads the leading nibble',
    hex: '01 23',
    attr: attr(PACKED, 3, 0, COMP6),
    size: 2,
    expect: { value: '123', kind: 'numeric', type: 'PIC 9(3) COMP-6', mantissa: 123n }
  },
  {
    name: 'COMP-6 with a hex nibble → invalid',
    hex: '1a 23',
    attr: attr(PACKED, 4, 0, COMP6),
    size: 2,
    expect: { value: '<invalid packed: 0x1a23>', kind: 'invalid' }
  },
  {
    name: 'packed zero with scale → 0.00',
    hex: '00 00 0c',
    attr: attr(PACKED, 4, 2, SIGNED),
    size: 3,
    expect: { value: '0.00', kind: 'numeric', mantissa: 0n, scale: 2 }
  },
  {
    name: 'negative zero nibble D on zero renders as 0 (BigInt has no -0)',
    hex: '00 0d',
    attr: attr(PACKED, 3, 0, SIGNED),
    size: 2,
    expect: { value: '0', kind: 'numeric', mantissa: 0n }
  },
  {
    name: '31-digit signed COMP-3 (16 bytes, BigInt path)',
    hex: '12 34 56 78 90 12 34 56 78 90 12 34 56 78 90 1c',
    attr: attr(PACKED, 31, 0, SIGNED),
    size: 16,
    expect: { value: '1234567890123456789012345678901', kind: 'numeric', mantissa: 1234567890123456789012345678901n }
  },
  {
    name: '18-digit signed COMP-3 negative with scale 4',
    hex: '09 99 99 99 99 99 99 99 99 9d',
    attr: attr(PACKED, 18, 4, SIGNED),
    size: 10,
    expect: { value: '-99999999999999.9999', kind: 'numeric', mantissa: -BigInt('9'.repeat(18)), scale: 4 }
  },
  {
    name: 'negative scale on packed (PIC 9(3)PP COMP-3)',
    hex: '12 3f',
    attr: attr(PACKED, 3, -2, 0),
    size: 2,
    expect: { value: '12300', kind: 'numeric', type: 'PIC 9(3)PP COMP-3', mantissa: 123n, scale: -2 }
  },
  {
    name: 'attr says packed but size 0 → invalid, never an exception',
    hex: '',
    attr: attr(PACKED, 5, 0, SIGNED),
    size: 0,
    expect: { value: '<invalid packed: no storage>', kind: 'invalid', invalid: /size 0/ }
  }
];

describe('decodeItem: COMP-3 / COMP-6 packed decimal', () => {
  for (const v of vectors) {
    it(v.name, () => {
      runVector(v);
    });
  }
});
