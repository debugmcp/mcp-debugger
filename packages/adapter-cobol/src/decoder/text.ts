/**
 * Alphanumeric (`COB_TYPE_ALPHANUMERIC` 0x21 / `_ALL` 0x22), edited pictures (0x23 / 0x24),
 * group items (0x01, or no attr at all), and BOOLEAN (0x02).
 *
 * Text is latin1 — one byte, one character — shown in double quotes with trailing spaces
 * preserved (a COBOL `PIC X(20)` holding `ALICE` really is `"ALICE               "`) and
 * non-printables as `\xNN`. Groups get a short preview, with the three figurative fills
 * (SPACES / LOW-VALUES / HIGH-VALUES) named outright because they are what an
 * uninitialised or freshly INITIALIZEd record looks like.
 */

import { allBytesAre, escapeLatin1, latin1, quoted } from './format.js';
import type { Decoded } from './types.js';

export function decodeText(bytes: Uint8Array, maxTextChars: number): Decoded {
  const limit = Math.max(0, maxTextChars);
  const truncated = bytes.length > limit;
  const shown = truncated ? bytes.subarray(0, limit) : bytes;
  let value = quoted(shown);
  if (truncated) {
    value += ` …(+${bytes.length - limit} bytes)`;
  }
  return { value, kind: 'text', text: latin1(bytes) };
}

export function decodeGroup(bytes: Uint8Array, groupPreviewBytes: number): Decoded {
  const n = bytes.length;
  const text = latin1(bytes);
  if (allBytesAre(bytes, 0x20)) {
    return { value: `SPACES (${n} bytes)`, kind: 'group', text };
  }
  if (allBytesAre(bytes, 0x00)) {
    return { value: `LOW-VALUES (${n} bytes)`, kind: 'group', text };
  }
  if (allBytesAre(bytes, 0xff)) {
    return { value: `HIGH-VALUES (${n} bytes)`, kind: 'group', text };
  }
  const limit = Math.max(0, groupPreviewBytes);
  const truncated = n > limit;
  let value = `"${escapeLatin1(truncated ? bytes.subarray(0, limit) : bytes)}"`;
  if (truncated) {
    value += ` … (${n} bytes)`;
  }
  return { value, kind: 'group', text };
}

/** Bit string, most significant bit of each byte first: `B"10100101"`. */
export function decodeBoolean(bytes: Uint8Array): Decoded {
  let bits = '';
  for (const b of bytes) {
    bits += b.toString(2).padStart(8, '0');
  }
  return { value: `B"${bits}"`, kind: 'boolean' };
}
