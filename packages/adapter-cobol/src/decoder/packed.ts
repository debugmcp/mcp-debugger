/**
 * COMP-3 / PACKED-DECIMAL (`COB_TYPE_NUMERIC_PACKED` 0x12) and COMP-6 (same type with
 * `COB_FLAG_NO_SIGN_NIBBLE`): two BCD digits per byte, high nibble first. Unless the item
 * is COMP-6, the low nibble of the last byte is the sign: C/F/A/E positive, D/B negative.
 *
 * Measured (GnuCOBOL 3.2): `S9(7)V99 COMP-3 = -12345.67` → `00 12 34 56 7d`,
 * `+1500.00` → `00 01 50 00 0c`. Unsigned items are stored with an F sign nibble.
 *
 * A non-BCD digit nibble is the classic S0C7 (data exception) case — text moved over a
 * packed field — and is rendered as `<invalid packed: 0x…>` with the raw hex so the user
 * can see the ASCII underneath.
 */

import { COB_FLAG, hasFlag } from '../manifest/attr-constants.js';
import type { CobolFieldAttr } from '../manifest/schema.js';
import { hexOf, invalidValue, numericValue } from './format.js';
import type { Decoded } from './types.js';

export function decodePacked(bytes: Uint8Array, attr: CobolFieldAttr): Decoded {
  const n = bytes.length;
  if (n === 0) {
    return invalidValue('<invalid packed: no storage>', 'packed item has size 0');
  }
  const noSignNibble = hasFlag(attr.flags, COB_FLAG.NO_SIGN_NIBBLE);
  const signed = hasFlag(attr.flags, COB_FLAG.HAVE_SIGN);
  const invalid = (reason: string): Decoded => invalidValue(`<invalid packed: 0x${hexOf(bytes)}>`, reason);

  const digitNibbles = noSignNibble ? n * 2 : n * 2 - 1;
  let mantissa = 0n;
  for (let i = 0; i < digitNibbles; i++) {
    const byte = bytes[i >> 1];
    const nibble = i % 2 === 0 ? byte >> 4 : byte & 0x0f;
    if (nibble > 9) {
      return invalid(`nibble ${i} is 0x${nibble.toString(16)}, not a decimal digit`);
    }
    mantissa = mantissa * 10n + BigInt(nibble);
  }

  if (noSignNibble) {
    return numericValue(mantissa, attr.scale, 'none');
  }

  const signNibble = bytes[n - 1] & 0x0f;
  let negative: boolean;
  switch (signNibble) {
    case 0xc:
    case 0xf:
    case 0xa:
    case 0xe:
      negative = false;
      break;
    case 0xd:
    case 0xb:
      negative = true;
      break;
    default:
      return invalid(`sign nibble is 0x${signNibble.toString(16)}, not one of C/F/A/E/D/B`);
  }
  if (negative && !signed) {
    return invalid(`negative sign nibble 0x${signNibble.toString(16)} on an unsigned item`);
  }
  return numericValue(negative ? -mantissa : mantissa, attr.scale, 'nibble');
}
