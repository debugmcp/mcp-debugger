/**
 * COMP-1 (`COB_TYPE_NUMERIC_FLOAT` 0x13, IEEE-754 binary32), COMP-2 (`COB_TYPE_NUMERIC_DOUBLE`
 * 0x14, binary64) and their ISO spellings FLOAT-BINARY-32 (0x18) / FLOAT-BINARY-64 (0x19).
 * Always host byte order. Rendered with the shortest decimal that round-trips to the same
 * bit pattern, so `COMP-2 3.14159` (measured `6e 86 1b f0 f9 21 09 40` on x86-64) shows
 * as `3.14159`, not `3.1415899999999999`.
 */

import { hexOf, invalidValue } from './format.js';
import type { Decoded } from './types.js';

function renderDouble(x: number): string {
  if (Object.is(x, -0)) {
    return '-0';
  }
  // ECMAScript Number::toString is specified to produce the shortest round-tripping digits.
  return String(x);
}

/** Shortest decimal `s` with `Math.fround(Number(s)) === x`; String() alone would print the double expansion. */
function renderSingle(x: number): string {
  if (!Number.isFinite(x) || Object.is(x, -0) || x === 0) {
    return renderDouble(x);
  }
  for (let precision = 1; precision <= 9; precision++) {
    const candidate = Number(x.toPrecision(precision));
    if (Math.fround(candidate) === x) {
      return String(candidate);
    }
  }
  return String(x);
}

function floatValue(value: string): Decoded {
  return { value, kind: 'float' };
}

export function decodeFloat32(bytes: Uint8Array, hostLittleEndian: boolean): Decoded {
  if (bytes.length !== 4) {
    return invalidValue(`<invalid COMP-1: ${bytes.length} bytes, 0x${hexOf(bytes)}>`, 'COMP-1 needs exactly 4 bytes');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, 4);
  return floatValue(renderSingle(view.getFloat32(0, hostLittleEndian)));
}

export function decodeFloat64(bytes: Uint8Array, hostLittleEndian: boolean): Decoded {
  if (bytes.length !== 8) {
    return invalidValue(`<invalid COMP-2: ${bytes.length} bytes, 0x${hexOf(bytes)}>`, 'COMP-2 needs exactly 8 bytes');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, 8);
  return floatValue(renderDouble(view.getFloat64(0, hostLittleEndian)));
}
