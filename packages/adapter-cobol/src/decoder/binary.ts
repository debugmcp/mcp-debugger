/**
 * COMP / BINARY / COMP-4 (`COB_TYPE_NUMERIC_BINARY` 0x11), COMP-5 (`COB_TYPE_NUMERIC_COMP5`
 * 0x1b, or 0x11 with `COB_FLAG_REAL_BINARY` — cobc emits both spellings), and POINTER
 * (`COB_FLAG_IS_POINTER` on a 0x11 attr).
 *
 * Byte order: cobc sets `COB_FLAG_BINARY_SWAP` on COMP items when the dialect's
 * `binary-byteorder` is big-endian (the default) and the host is little-endian, so SWAP
 * means "the bytes are big-endian". COMP-5/REAL_BINARY items are always host order and
 * never carry SWAP; native wins if both were ever present.
 *
 * Measured (GnuCOBOL 3.2, x86-64): `S9(9) COMP = -123456789` → `f8 a4 32 eb`,
 * `9(4) COMP = 6` → `00 06`, `S9(9) COMP-5 = 987654321` → `b1 68 de 3a`.
 */

import { COB_FLAG, COB_TYPE, hasFlag } from '../manifest/attr-constants.js';
import type { CobolFieldAttr } from '../manifest/schema.js';
import { hexOf, invalidValue, numericValue } from './format.js';
import type { Decoded } from './types.js';

const BINARY_SIZES = new Set([1, 2, 4, 8]);

/** Unsigned integer from bytes in the given order. */
function readUnsigned(bytes: Uint8Array, bigEndian: boolean): bigint {
  let v = 0n;
  if (bigEndian) {
    for (let i = 0; i < bytes.length; i++) {
      v = (v << 8n) | BigInt(bytes[i]);
    }
  } else {
    for (let i = bytes.length - 1; i >= 0; i--) {
      v = (v << 8n) | BigInt(bytes[i]);
    }
  }
  return v;
}

export function isBigEndianBinary(attr: CobolFieldAttr, hostLittleEndian: boolean): boolean {
  const native = attr.type === COB_TYPE.NUMERIC_COMP5 || hasFlag(attr.flags, COB_FLAG.REAL_BINARY);
  if (!native && hasFlag(attr.flags, COB_FLAG.BINARY_SWAP)) {
    return true;
  }
  return !hostLittleEndian;
}

export function decodeBinary(bytes: Uint8Array, attr: CobolFieldAttr, hostLittleEndian: boolean): Decoded {
  const n = bytes.length;
  if (!BINARY_SIZES.has(n)) {
    return {
      value: `<binary size ${n} unsupported: 0x${hexOf(bytes)}>`,
      kind: 'unsupported'
    };
  }
  const unsigned = readUnsigned(bytes, isBigEndianBinary(attr, hostLittleEndian));
  const bits = BigInt(n * 8);
  const signed = hasFlag(attr.flags, COB_FLAG.HAVE_SIGN);
  const value = signed && (unsigned >> (bits - 1n)) & 1n ? unsigned - (1n << bits) : unsigned;
  return numericValue(value, attr.scale, 'none');
}

/** `0x` + the pointer's hex, host order, zero-padded to its full width. */
export function decodePointer(bytes: Uint8Array, hostLittleEndian: boolean): Decoded {
  const n = bytes.length;
  if (n === 0) {
    return invalidValue('<invalid pointer: no storage>', 'pointer item has size 0');
  }
  const raw = readUnsigned(bytes, !hostLittleEndian);
  return {
    value: `0x${raw.toString(16).padStart(n * 2, '0')}`,
    kind: 'pointer'
  };
}
