import { describe, it } from 'vitest';
import { COB_FLAG, COB_TYPE } from '../../../src/manifest/attr-constants.js';
import { attr, BE, LE, runVector, type Vector } from './helpers.js';

const BINARY = COB_TYPE.NUMERIC_BINARY;
const COMP5 = COB_TYPE.NUMERIC_COMP5;
// cobc's real flag sets: 0x0821 = BINARY_TRUNC | BINARY_SWAP | HAVE_SIGN, 0x0820 unsigned, 0x0041 = REAL_BINARY | HAVE_SIGN.
const SWAP_SIGNED = 0x0821;
const SWAP_UNSIGNED = 0x0820;
const NATIVE_SIGNED = 0x0041;
const SIGNED = COB_FLAG.HAVE_SIGN;

const vectors: Vector[] = [
  {
    // ✔ measured GnuCOBOL 3.2 (x86-64): S9(9) COMP = -123456789
    name: 'measured: S9(9) COMP = -123456789 stored big-endian (BINARY_SWAP)',
    hex: 'f8 a4 32 eb',
    attr: attr(BINARY, 9, 0, SWAP_SIGNED),
    size: 4,
    expect: { value: '-123456789', kind: 'numeric', type: 'PIC S9(9) COMP', mantissa: -123456789n, signSeen: 'none' }
  },
  {
    // ✔ measured GnuCOBOL 3.2: 9(4) COMP = 6
    name: 'measured: 9(4) COMP = 6',
    hex: '00 06',
    attr: attr(BINARY, 4, 0, SWAP_UNSIGNED),
    size: 2,
    expect: { value: '6', kind: 'numeric', type: 'PIC 9(4) COMP', mantissa: 6n }
  },
  {
    // ✔ measured GnuCOBOL 3.2 (x86-64): S9(9) COMP-5 = 987654321, type 0x1b
    name: 'measured: S9(9) COMP-5 = 987654321 in host (LE) order, type 0x1b',
    hex: 'b1 68 de 3a',
    attr: attr(COMP5, 9, 0, NATIVE_SIGNED),
    size: 4,
    expect: { value: '987654321', kind: 'numeric', type: 'PIC S9(9) COMP-5', mantissa: 987654321n }
  },
  {
    // ✔ the generated code also spells COMP-5 as {0x11, 9, 0, 0x0041}
    name: 'measured: COMP-5 spelled as type 0x11 + REAL_BINARY',
    hex: 'b1 68 de 3a',
    attr: attr(BINARY, 9, 0, NATIVE_SIGNED),
    size: 4,
    expect: { value: '987654321', kind: 'numeric', type: 'PIC S9(9) COMP-5', mantissa: 987654321n }
  },
  {
    name: 'COMP-5 on a big-endian host reads the same bytes big-endian',
    hex: '3a de 68 b1',
    attr: attr(COMP5, 9, 0, NATIVE_SIGNED),
    size: 4,
    opts: BE,
    expect: { value: '987654321', kind: 'numeric', mantissa: 987654321n }
  },
  {
    name: 'native wins over a stray BINARY_SWAP on a REAL_BINARY item',
    hex: 'b1 68 de 3a',
    attr: attr(BINARY, 9, 0, NATIVE_SIGNED | COB_FLAG.BINARY_SWAP),
    size: 4,
    expect: { value: '987654321', kind: 'numeric', mantissa: 987654321n }
  },
  {
    name: 'COMP without SWAP on an LE host is little-endian (binary-byteorder: native)',
    hex: '34 12',
    attr: attr(BINARY, 4, 0, 0),
    size: 2,
    expect: { value: '4660', kind: 'numeric', mantissa: 4660n }
  },
  {
    name: 'COMP without SWAP on a BE host is big-endian',
    hex: '12 34',
    attr: attr(BINARY, 4, 0, 0),
    size: 2,
    opts: BE,
    expect: { value: '4660', kind: 'numeric', mantissa: 4660n }
  },
  // --- every size, signed and unsigned, SWAP (big-endian) ---
  { name: '1 byte unsigned 0xff = 255', hex: 'ff', attr: attr(BINARY, 2, 0, SWAP_UNSIGNED), size: 1, expect: { value: '255', kind: 'numeric', mantissa: 255n } },
  { name: '1 byte signed 0xff = -1', hex: 'ff', attr: attr(BINARY, 2, 0, SWAP_SIGNED), size: 1, expect: { value: '-1', kind: 'numeric', mantissa: -1n } },
  { name: '1 byte signed 0x80 = -128', hex: '80', attr: attr(BINARY, 2, 0, SWAP_SIGNED), size: 1, expect: { value: '-128', kind: 'numeric', mantissa: -128n } },
  { name: '2 bytes signed BE 0x8000 = -32768', hex: '80 00', attr: attr(BINARY, 4, 0, SWAP_SIGNED), size: 2, expect: { value: '-32768', kind: 'numeric', mantissa: -32768n } },
  { name: '2 bytes unsigned BE 0x8000 = 32768', hex: '80 00', attr: attr(BINARY, 4, 0, SWAP_UNSIGNED), size: 2, expect: { value: '32768', kind: 'numeric', mantissa: 32768n } },
  { name: '4 bytes unsigned BE 0xffffffff', hex: 'ff ff ff ff', attr: attr(BINARY, 9, 0, SWAP_UNSIGNED), size: 4, expect: { value: '4294967295', kind: 'numeric', mantissa: 4294967295n } },
  { name: '4 bytes signed BE 0xffffffff = -1', hex: 'ff ff ff ff', attr: attr(BINARY, 9, 0, SWAP_SIGNED), size: 4, expect: { value: '-1', kind: 'numeric', mantissa: -1n } },
  {
    name: '8 bytes signed BE: 10^18 - 1 (18-digit path)',
    hex: '0d e0 b6 b3 a7 63 ff ff',
    attr: attr(BINARY, 18, 0, SWAP_SIGNED),
    size: 8,
    expect: { value: '999999999999999999', kind: 'numeric', type: 'PIC S9(18) COMP', mantissa: 999999999999999999n }
  },
  {
    name: '8 bytes signed BE: INT64 min',
    hex: '80 00 00 00 00 00 00 00',
    attr: attr(BINARY, 18, 0, SWAP_SIGNED),
    size: 8,
    expect: { value: '-9223372036854775808', kind: 'numeric', mantissa: -9223372036854775808n }
  },
  {
    name: '8 bytes unsigned BE: UINT64 max',
    hex: 'ff ff ff ff ff ff ff ff',
    attr: attr(BINARY, 18, 0, SWAP_UNSIGNED),
    size: 8,
    expect: { value: '18446744073709551615', kind: 'numeric', mantissa: 18446744073709551615n }
  },
  // --- every size in host (LE) order without SWAP ---
  { name: '2 bytes signed LE 00 80 = -32768', hex: '00 80', attr: attr(BINARY, 4, 0, SIGNED), size: 2, expect: { value: '-32768', kind: 'numeric', mantissa: -32768n } },
  { name: '4 bytes signed LE -123456789', hex: 'eb 32 a4 f8', attr: attr(BINARY, 9, 0, SIGNED), size: 4, expect: { value: '-123456789', kind: 'numeric', mantissa: -123456789n } },
  {
    name: '8 bytes signed LE: 10^18 - 1',
    hex: 'ff ff 63 a7 b3 b6 e0 0d',
    attr: attr(BINARY, 18, 0, SIGNED),
    size: 8,
    expect: { value: '999999999999999999', kind: 'numeric', mantissa: 999999999999999999n }
  },
  // --- scale ---
  {
    name: 'binary with scale: S9(3)V99 COMP = -123.45',
    hex: 'ff ff cf c7',
    attr: attr(BINARY, 5, 2, SWAP_SIGNED),
    size: 4,
    expect: { value: '-123.45', kind: 'numeric', type: 'PIC S9(3)V99 COMP', mantissa: -12345n, scale: 2 }
  },
  {
    name: 'binary with negative scale: 9(3)PP COMP = 700',
    hex: '00 07',
    attr: attr(BINARY, 3, -2, SWAP_UNSIGNED),
    size: 2,
    expect: { value: '700', kind: 'numeric', type: 'PIC 9(3)PP COMP', mantissa: 7n, scale: -2 }
  },
  {
    name: 'binary zero with scale → 0.00',
    hex: '00 00 00 00',
    attr: attr(BINARY, 5, 2, SWAP_SIGNED),
    size: 4,
    expect: { value: '0.00', kind: 'numeric', mantissa: 0n, scale: 2 }
  },
  // --- unsupported / invalid sizes ---
  {
    name: 'binary size 3 → unsupported with the raw hex',
    hex: '01 02 03',
    attr: attr(BINARY, 5, 0, SWAP_SIGNED),
    size: 3,
    expect: { value: '<binary size 3 unsupported: 0x010203>', kind: 'unsupported' }
  },
  {
    name: 'binary size 16 → unsupported',
    hex: '00 '.repeat(16),
    attr: attr(BINARY, 36, 0, SWAP_SIGNED),
    size: 16,
    expect: { value: `<binary size 16 unsupported: 0x${'00'.repeat(16)}>`, kind: 'unsupported' }
  },
  {
    name: 'attr says binary but size 0 → invalid',
    hex: '',
    attr: attr(BINARY, 9, 0, SWAP_SIGNED),
    size: 0,
    expect: { value: '<invalid binary: no storage>', kind: 'invalid', invalid: /size 0/ }
  }
];

const pointerVectors: Vector[] = [
  {
    name: 'pointer, 8 bytes, LE host: hex in host order, zero-padded',
    hex: '78 56 34 12 fd 7f 00 00',
    attr: attr(BINARY, 0, 0, COB_FLAG.IS_POINTER),
    size: 8,
    extra: { usage: 'POINTER' },
    expect: { value: '0x00007ffd12345678', kind: 'pointer', type: 'POINTER' }
  },
  {
    name: 'pointer, 8 bytes, BE host',
    hex: '78 56 34 12 fd 7f 00 00',
    attr: attr(BINARY, 0, 0, COB_FLAG.IS_POINTER),
    size: 8,
    opts: BE,
    expect: { value: '0x78563412fd7f0000', kind: 'pointer', type: 'POINTER' }
  },
  {
    name: 'null pointer',
    hex: '00 00 00 00 00 00 00 00',
    attr: attr(BINARY, 0, 0, COB_FLAG.IS_POINTER),
    size: 8,
    expect: { value: '0x0000000000000000', kind: 'pointer' }
  },
  {
    name: '32-bit pointer',
    hex: '10 20 30 40',
    attr: attr(BINARY, 0, 0, COB_FLAG.IS_POINTER | COB_FLAG.HAVE_SIGN),
    size: 4,
    expect: { value: '0x40302010', kind: 'pointer', type: 'POINTER' }
  },
  {
    name: 'IS_POINTER wins over a numeric type byte and never applies a scale',
    hex: 'ff ff ff ff ff ff ff ff',
    attr: attr(BINARY, 18, 2, COB_FLAG.IS_POINTER | COB_FLAG.HAVE_SIGN | COB_FLAG.BINARY_SWAP),
    size: 8,
    expect: { value: '0xffffffffffffffff', kind: 'pointer' }
  },
  {
    name: 'usage POINTER without an attr is still a pointer (type and value agree)',
    hex: '10 20 30 40 00 00 00 00',
    attr: undefined,
    size: 8,
    extra: { usage: 'POINTER' },
    expect: { value: '0x0000000040302010', kind: 'pointer', type: 'POINTER' }
  },
  {
    name: 'pointer with size 0 → invalid',
    hex: '',
    attr: attr(BINARY, 0, 0, COB_FLAG.IS_POINTER),
    size: 0,
    expect: { value: '<invalid pointer: no storage>', kind: 'invalid' }
  }
];

describe('decodeItem: COMP / COMP-5 binary', () => {
  for (const v of vectors) {
    it(v.name, () => {
      runVector(v);
    });
  }
});

describe('decodeItem: POINTER', () => {
  for (const v of pointerVectors) {
    it(v.name, () => {
      runVector(v);
    });
  }
});

describe('decodeItem: host endianness default', () => {
  it('LE and BE options disagree on a 2-byte native binary, so the pin in tests is load-bearing', () => {
    runVector({ name: 'le', hex: '01 00', attr: attr(BINARY, 4, 0, 0), size: 2, opts: LE, expect: { value: '1', kind: 'numeric' } });
    runVector({ name: 'be', hex: '01 00', attr: attr(BINARY, 4, 0, 0), size: 2, opts: BE, expect: { value: '256', kind: 'numeric' } });
  });
});
