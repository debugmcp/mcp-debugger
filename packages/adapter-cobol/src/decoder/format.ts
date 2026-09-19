/**
 * Rendering helpers shared by the per-usage decoders: canonical decimal formatting,
 * hex dumps, and latin1 escaping.
 */

import type { Decoded, SignSeen } from './types.js';

/**
 * Canonical decimal rendering of `mantissa × 10^-scale`: exactly `scale` fraction digits,
 * a leading `-` only when negative, never a `+`, `0` for zero. A negative scale (a `P`
 * picture) expands into trailing zeros.
 *
 *   formatNumeric(-12345n, 2) === '-123.45'
 *   formatNumeric(150000n, 2) === '1500.00'
 *   formatNumeric(0n, 2)      === '0.00'
 *   formatNumeric(12n, -2)    === '1200'
 */
export function formatNumeric(mantissa: bigint, scale: number): string {
  const negative = mantissa < 0n;
  const digits = (negative ? -mantissa : mantissa).toString();
  let body: string;
  if (scale <= 0) {
    body = mantissa === 0n ? '0' : digits + '0'.repeat(-scale);
  } else {
    const padded = digits.padStart(scale + 1, '0');
    const split = padded.length - scale;
    body = `${padded.slice(0, split)}.${padded.slice(split)}`;
  }
  return negative ? `-${body}` : body;
}

/** `0x`-less lowercase hex of every byte, e.g. `4142434445`. */
export function hexOf(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

/** One byte → one char, the way Node's `latin1` decoder does it. */
export function latin1(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += String.fromCharCode(b);
  }
  return out;
}

/** Printable latin1: ASCII 0x20–0x7E and the upper half 0xA0–0xFF. Controls and 0x7F–0x9F are not. */
export function isPrintableLatin1(byte: number): boolean {
  return (byte >= 0x20 && byte <= 0x7e) || byte >= 0xa0;
}

/**
 * Escape bytes for display inside double quotes: `"` and `\` are backslash-escaped,
 * non-printables become `\xNN`, everything else is the latin1 character.
 */
export function escapeLatin1(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    if (b === 0x22) {
      out += '\\"';
    } else if (b === 0x5c) {
      out += '\\\\';
    } else if (isPrintableLatin1(b)) {
      out += String.fromCharCode(b);
    } else {
      out += `\\x${b.toString(16).padStart(2, '0')}`;
    }
  }
  return out;
}

export function quoted(bytes: Uint8Array): string {
  return `"${escapeLatin1(bytes)}"`;
}

export function invalidValue(value: string, reason: string): Decoded {
  return { value, kind: 'invalid', invalid: reason };
}

export function numericValue(mantissa: bigint, scale: number, signSeen: SignSeen): Decoded {
  return {
    value: formatNumeric(mantissa, scale),
    kind: 'numeric',
    numeric: { mantissa, scale, signSeen }
  };
}

export function allBytesAre(bytes: Uint8Array, byte: number): boolean {
  if (bytes.length === 0) {
    return false;
  }
  for (const b of bytes) {
    if (b !== byte) {
      return false;
    }
  }
  return true;
}
