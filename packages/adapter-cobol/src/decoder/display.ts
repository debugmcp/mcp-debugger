/**
 * USAGE DISPLAY numerics (zoned decimal, `COB_TYPE_NUMERIC_DISPLAY` 0x10): one ASCII digit
 * per byte, sign either in a separate `+`/`-` byte or overpunched on the leading/trailing digit.
 *
 * Measured (GnuCOBOL 3.2, default sign convention): `S9(5)V99 = -123.45` is stored as
 * `30 30 31 32 33 34 75` — the trailing digit `5` (0x35) has 0x40 set → `u`. Positive
 * values are plain digits. The EBCDIC-style alphabet (`{`/`A`–`I` positive, `}`/`J`–`R`
 * negative) is what `-fsign=EBCDIC` and most mainframe data files use; both are accepted
 * and `signSeen` records which one was found.
 *
 * libcob itself validates nothing here (`COB_D2I(x)` is `x & 0x0F`), so the "invalid"
 * verdicts below are the debugger's own diagnostics. Leading blanks are accepted as
 * zero positions, as in libcob arithmetic; embedded/trailing blanks and other malformed
 * bytes retain their diagnostic rendering.
 */

import { COB_FLAG, hasFlag } from '../manifest/attr-constants.js';
import type { CobolFieldAttr } from '../manifest/schema.js';
import { allBytesAre, invalidValue, numericValue, quoted } from './format.js';
import type { Decoded, SignSeen } from './types.js';

interface Overpunch {
  digit: number;
  negative: boolean;
  alphabet: SignSeen;
}

const ASCII_ZERO = 0x30;
const ASCII_NINE = 0x39;
const SPACE = 0x20;
const PLUS = 0x2b;
const MINUS = 0x2d;

/** Decode an overpunched sign byte; undefined when the byte is not in either alphabet. */
function decodeOverpunch(byte: number): Overpunch | undefined {
  // GnuCOBOL/ASCII: negative digit = '0'..'9' | 0x40 → 'p'..'y'. Positive digits are plain.
  if (byte >= 0x70 && byte <= 0x79) {
    return { digit: byte - 0x70, negative: true, alphabet: 'ascii-overpunch' };
  }
  // EBCDIC-style: '{' = +0, 'A'..'I' = +1..9, '}' = -0, 'J'..'R' = -1..9.
  if (byte === 0x7b) {
    return { digit: 0, negative: false, alphabet: 'ebcdic-overpunch' };
  }
  if (byte >= 0x41 && byte <= 0x49) {
    return { digit: byte - 0x40, negative: false, alphabet: 'ebcdic-overpunch' };
  }
  if (byte === 0x7d) {
    return { digit: 0, negative: true, alphabet: 'ebcdic-overpunch' };
  }
  if (byte >= 0x4a && byte <= 0x52) {
    return { digit: byte - 0x49, negative: true, alphabet: 'ebcdic-overpunch' };
  }
  return undefined;
}

export function decodeDisplay(bytes: Uint8Array, attr: CobolFieldAttr): Decoded {
  const n = bytes.length;
  if (n === 0) {
    return invalidValue('<invalid display: no storage>', 'display item has size 0');
  }
  const signed = hasFlag(attr.flags, COB_FLAG.HAVE_SIGN);
  const separate = signed && hasFlag(attr.flags, COB_FLAG.SIGN_SEPARATE);
  const leading = hasFlag(attr.flags, COB_FLAG.SIGN_LEADING);

  // BLANK WHEN ZERO, or simply an all-space field (MOVE SPACES, an unfilled record): zero.
  if (allBytesAre(bytes, SPACE)) {
    return numericValue(0n, attr.scale, 'none');
  }

  const invalid = (reason: string): Decoded => invalidValue(`<invalid display: ${quoted(bytes)}>`, reason);

  let negative = false;
  let signSeen: SignSeen = 'none';
  let digitStart = 0;
  let digitEnd = n;

  if (separate) {
    if (n < 2) {
      return invalid('separate sign needs a sign byte and at least one digit');
    }
    const signByte = bytes[leading ? 0 : n - 1];
    if (signByte === MINUS) {
      negative = true;
    } else if (signByte !== PLUS) {
      return invalid(`separate ${leading ? 'leading' : 'trailing'} sign byte is not '+' or '-'`);
    }
    signSeen = 'separate';
    if (leading) {
      digitStart = 1;
    } else {
      digitEnd = n - 1;
    }
  }

  const overpunchIndex = signed && !separate ? (leading ? digitStart : digitEnd - 1) : -1;
  let mantissa = 0n;
  let leadingBlanks = true;
  for (let i = digitStart; i < digitEnd; i++) {
    const b = bytes[i];
    if (b === SPACE && leadingBlanks) continue;
    leadingBlanks = false;
    let digit: number;
    if (b >= ASCII_ZERO && b <= ASCII_NINE) {
      digit = b - ASCII_ZERO;
    } else if (i === overpunchIndex) {
      const punch = decodeOverpunch(b);
      if (!punch) {
        return invalid(`sign byte 0x${b.toString(16).padStart(2, '0')} is neither a digit nor an overpunch`);
      }
      digit = punch.digit;
      negative = punch.negative;
      signSeen = punch.alphabet;
    } else {
      return invalid(`byte ${i} (0x${b.toString(16).padStart(2, '0')}) is not a digit${
        !signed && decodeOverpunch(b) ? ' (overpunched sign on an unsigned item)' : ''
      }`);
    }
    mantissa = mantissa * 10n + BigInt(digit);
  }

  return numericValue(negative ? -mantissa : mantissa, attr.scale, signSeen);
}
