import { describe, expect, it } from 'vitest';
import { COB_TYPE } from '../../../src/manifest/attr-constants.js';
import { decodeItem } from '../../../src/decoder/index.js';
import { attr, BE, item, LE, runVector, type Vector } from './helpers.js';

// cobc emits COMP-2 as {0x14, 34, 17, 0x0201} (IS_FP | HAVE_SIGN); COMP-1 as {0x13, 15, 8, 0x0201}-ish.
const FP_FLAGS = 0x0201;
const COMP1 = attr(COB_TYPE.NUMERIC_FLOAT, 15, 8, FP_FLAGS);
const COMP2 = attr(COB_TYPE.NUMERIC_DOUBLE, 34, 17, FP_FLAGS);
const BIN32 = attr(COB_TYPE.NUMERIC_FP_BIN32, 15, 8, FP_FLAGS);
const BIN64 = attr(COB_TYPE.NUMERIC_FP_BIN64, 34, 17, FP_FLAGS);

// Byte strings generated with Buffer.writeFloatLE / writeDoubleLE, not hand-computed.
const vectors: Vector[] = [
  {
    // ✔ measured GnuCOBOL 3.2 (x86-64): COMP-2 3.14159
    name: 'measured: COMP-2 3.14159 (LE)',
    hex: '6e 86 1b f0 f9 21 09 40',
    attr: COMP2,
    size: 8,
    extra: { usage: 'COMP-2' },
    expect: { value: '3.14159', kind: 'float', type: 'COMP-2' }
  },
  {
    name: 'COMP-2 3.14159 on a BE host',
    hex: '40 09 21 f9 f0 1b 86 6e',
    attr: COMP2,
    size: 8,
    opts: BE,
    expect: { value: '3.14159', kind: 'float' }
  },
  { name: 'COMP-2 1', hex: '00 00 00 00 00 00 f0 3f', attr: COMP2, size: 8, expect: { value: '1', kind: 'float' } },
  { name: 'COMP-2 -2.5', hex: '00 00 00 00 00 00 04 c0', attr: COMP2, size: 8, expect: { value: '-2.5', kind: 'float' } },
  { name: 'COMP-2 0.1 is the shortest round-trip, not 0.1000000000000000055…', hex: '9a 99 99 99 99 99 b9 3f', attr: COMP2, size: 8, expect: { value: '0.1', kind: 'float' } },
  { name: 'COMP-2 1e21 uses exponent form', hex: '50 ef e2 d6 e4 1a 4b 44', attr: COMP2, size: 8, expect: { value: '1e+21', kind: 'float' } },
  { name: 'COMP-2 max double', hex: 'ff ff ff ff ff ff ef 7f', attr: COMP2, size: 8, expect: { value: '1.7976931348623157e+308', kind: 'float' } },
  { name: 'COMP-2 NaN', hex: '00 00 00 00 00 00 f8 7f', attr: COMP2, size: 8, expect: { value: 'NaN', kind: 'float' } },
  { name: 'COMP-2 +Infinity', hex: '00 00 00 00 00 00 f0 7f', attr: COMP2, size: 8, expect: { value: 'Infinity', kind: 'float' } },
  { name: 'COMP-2 -Infinity', hex: '00 00 00 00 00 00 f0 ff', attr: COMP2, size: 8, expect: { value: '-Infinity', kind: 'float' } },
  { name: 'COMP-2 negative zero keeps its sign', hex: '00 00 00 00 00 00 00 80', attr: COMP2, size: 8, expect: { value: '-0', kind: 'float' } },
  { name: 'COMP-2 zero', hex: '00 00 00 00 00 00 00 00', attr: COMP2, size: 8, expect: { value: '0', kind: 'float' } },
  { name: 'FLOAT-BINARY-64 (0x19) decodes like COMP-2', hex: '00 00 00 00 00 00 f0 3f', attr: BIN64, size: 8, expect: { value: '1', kind: 'float', type: 'COMP-2' } },
  {
    name: 'COMP-1 3.14 renders the shortest single-precision digits, not 3.140000104904175',
    hex: 'c3 f5 48 40',
    attr: COMP1,
    size: 4,
    extra: { usage: 'COMP-1' },
    expect: { value: '3.14', kind: 'float', type: 'COMP-1' }
  },
  { name: 'COMP-1 3.14 on a BE host', hex: '40 48 f5 c3', attr: COMP1, size: 4, opts: BE, expect: { value: '3.14', kind: 'float' } },
  { name: 'COMP-1 1', hex: '00 00 80 3f', attr: COMP1, size: 4, expect: { value: '1', kind: 'float' } },
  { name: 'COMP-1 -2.5', hex: '00 00 20 c0', attr: COMP1, size: 4, expect: { value: '-2.5', kind: 'float' } },
  { name: 'COMP-1 0.1', hex: 'cd cc cc 3d', attr: COMP1, size: 4, expect: { value: '0.1', kind: 'float' } },
  { name: 'COMP-1 1e10', hex: 'f9 02 15 50', attr: COMP1, size: 4, expect: { value: '10000000000', kind: 'float' } },
  { name: 'COMP-1 NaN', hex: '00 00 c0 7f', attr: COMP1, size: 4, expect: { value: 'NaN', kind: 'float' } },
  { name: 'COMP-1 +Infinity', hex: '00 00 80 7f', attr: COMP1, size: 4, expect: { value: 'Infinity', kind: 'float' } },
  { name: 'COMP-1 -Infinity', hex: '00 00 80 ff', attr: COMP1, size: 4, expect: { value: '-Infinity', kind: 'float' } },
  { name: 'COMP-1 negative zero', hex: '00 00 00 80', attr: COMP1, size: 4, expect: { value: '-0', kind: 'float' } },
  { name: 'FLOAT-BINARY-32 (0x18) decodes like COMP-1', hex: '00 00 80 3f', attr: BIN32, size: 4, expect: { value: '1', kind: 'float', type: 'COMP-1' } },
  {
    name: 'COMP-1 with the wrong size → invalid',
    hex: '00 00 80',
    attr: COMP1,
    size: 3,
    expect: { value: '<invalid COMP-1: 3 bytes, 0x000080>', kind: 'invalid', invalid: /exactly 4 bytes/ }
  },
  {
    name: 'COMP-2 with the wrong size → invalid',
    hex: '00 00 00 00',
    attr: COMP2,
    size: 4,
    expect: { value: '<invalid COMP-2: 4 bytes, 0x00000000>', kind: 'invalid', invalid: /exactly 8 bytes/ }
  }
];

describe('decodeItem: COMP-1 / COMP-2 floating point', () => {
  for (const v of vectors) {
    it(v.name, () => {
      runVector(v);
    });
  }

  it('reads floats from a Uint8Array view with a non-zero byteOffset (the DataView must honour it)', () => {
    const backing = new Uint8Array([0xaa, 0xbb, 0x00, 0x00, 0x80, 0x3f, 0xcc]);
    const view = backing.subarray(2, 6);
    const decoded = decodeItem(view, item(COMP1, 4, { usage: 'COMP-1' }), LE);
    expect(decoded).toMatchObject({ value: '1', kind: 'float', type: 'COMP-1' });
  });
});
