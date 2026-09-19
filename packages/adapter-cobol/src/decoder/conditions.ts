/**
 * Level-88 condition names: `88 IS-ACTIVE VALUE 'A' 'B' 'M' THRU 'P'.` is true when the
 * parent's current value matches any listed literal or falls inside any `THRU` range.
 *
 * Numeric parents compare as exact decimals (mantissa/scale, no floating point); text and
 * group parents compare the COBOL way — the shorter operand space-padded to the longer,
 * then byte for byte in the native (ASCII/latin1) collating sequence. Figurative constants
 * fill the parent's whole length: `VALUE LOW-VALUES` against a 4-byte field means four
 * 0x00 bytes, never `\0` plus three spaces.
 *
 * Results are the strings `'true'` / `'false'` because they are shown as variable values;
 * anything the decoder cannot decide comes back as `<unknown: reason>`.
 */

import type { CobolConditionValue, CobolDataItem } from '../manifest/schema.js';
import type { DecodableItem, DecodedNumeric, DecodedValue } from './types.js';

type Condition = NonNullable<CobolDataItem['condition']>;

interface Decimal {
  mantissa: bigint;
  scale: number;
}

const DECIMAL_LITERAL = /^([+-])?(\d*)(?:\.(\d*))?$/;

const NUMERIC_FIGURATIVES: ReadonlySet<string> = new Set(['ZERO', 'ZEROS', 'ZEROES']);

function figurativeFill(name: string): string | undefined {
  switch (name) {
    case 'SPACE':
    case 'SPACES':
      return ' ';
    case 'ZERO':
    case 'ZEROS':
    case 'ZEROES':
      return '0';
    case 'LOW-VALUE':
    case 'LOW-VALUES':
      return '\u0000';
    case 'HIGH-VALUE':
    case 'HIGH-VALUES':
      return '\u00ff';
    case 'QUOTE':
    case 'QUOTES':
      return '"';
    default:
      return undefined;
  }
}

function parseDecimal(text: string): Decimal | undefined {
  const trimmed = text.trim();
  if (NUMERIC_FIGURATIVES.has(trimmed.toUpperCase())) {
    return { mantissa: 0n, scale: 0 };
  }
  const match = DECIMAL_LITERAL.exec(trimmed);
  if (!match) {
    return undefined;
  }
  const [, sign, whole = '', fraction = ''] = match;
  if (whole === '' && fraction === '') {
    return undefined;
  }
  const mantissa = BigInt(`${whole}${fraction}` || '0');
  return { mantissa: sign === '-' ? -mantissa : mantissa, scale: fraction.length };
}

/** Compare two exact decimals: -1, 0 or 1. Both are raised to the larger scale first. */
function compareDecimals(a: Decimal, b: Decimal): number {
  const scale = Math.max(a.scale, b.scale);
  const left = a.mantissa * 10n ** BigInt(scale - a.scale);
  const right = b.mantissa * 10n ** BigInt(scale - b.scale);
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Turn a VALUE literal into the string it compares as against a text parent of
 * `length` bytes. A manifest that classified the VALUE (schema `kind`, issue
 * #759) is authoritative — `'SPACES'` in quotes is the six-letter word, not all
 * spaces; without `kind`, bare figurative names are treated as figurative.
 */
function resolveTextLiteral(literal: string, length: number, kind?: CobolConditionValue['kind']): string {
  if (kind === 'literal') {
    return literal;
  }
  const upper = literal.trim().toUpperCase();
  const fill = figurativeFill(upper);
  if (fill !== undefined && kind !== 'all') {
    return fill.repeat(Math.max(length, 1));
  }
  const all = /^ALL\s+(.+)$/i.exec(literal.trim()) ?? (kind === 'all' ? [literal, literal] : null);
  if (all) {
    const inner = all[1].trim();
    const unquoted = /^(['"])(.*)\1$/.exec(inner);
    const unit = unquoted ? unquoted[2] : figurativeFill(inner.toUpperCase()) ?? inner;
    if (unit.length === 0) {
      return '';
    }
    const target = Math.max(length, unit.length);
    return unit.repeat(Math.ceil(target / unit.length)).slice(0, target);
  }
  return literal;
}

/** COBOL alphanumeric comparison: pad the shorter with spaces, compare bytewise. */
function compareText(a: string, b: string): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const left = i < a.length ? a.charCodeAt(i) : 0x20;
    const right = i < b.length ? b.charCodeAt(i) : 0x20;
    if (left !== right) {
      return left < right ? -1 : 1;
    }
  }
  return 0;
}

/** Recover the full content when the decoder did not attach `text` (defensive: it always does). */
function unescapeValue(value: string): string {
  const body = value.startsWith('"') && value.lastIndexOf('"') > 0 ? value.slice(1, value.lastIndexOf('"')) : value;
  return body.replace(/\\x([0-9a-f]{2})|\\(["\\])/gi, (_m, hex: string | undefined, ch: string | undefined) =>
    hex !== undefined ? String.fromCharCode(parseInt(hex, 16)) : ch ?? ''
  );
}

type Match = boolean | string;

function matchNumeric(value: CobolConditionValue, parent: DecodedNumeric): Match {
  const lo = parseDecimal(value.lo);
  if (!lo) {
    return `<unknown: non-numeric literal ${JSON.stringify(value.lo)} on a numeric item>`;
  }
  const current: Decimal = { mantissa: parent.mantissa, scale: parent.scale };
  if (value.hi === undefined) {
    return compareDecimals(current, lo) === 0;
  }
  const hi = parseDecimal(value.hi);
  if (!hi) {
    return `<unknown: non-numeric literal ${JSON.stringify(value.hi)} on a numeric item>`;
  }
  return compareDecimals(current, lo) >= 0 && compareDecimals(current, hi) <= 0;
}

function matchFloat(value: CobolConditionValue, current: number): Match {
  const lo = Number(value.lo.trim());
  if (Number.isNaN(lo)) {
    return `<unknown: non-numeric literal ${JSON.stringify(value.lo)} on a floating-point item>`;
  }
  if (value.hi === undefined) {
    return current === lo;
  }
  const hi = Number(value.hi.trim());
  if (Number.isNaN(hi)) {
    return `<unknown: non-numeric literal ${JSON.stringify(value.hi)} on a floating-point item>`;
  }
  return current >= lo && current <= hi;
}

function matchText(value: CobolConditionValue, current: string, length: number): Match {
  const lo = resolveTextLiteral(value.lo, length, value.kind);
  if (value.hi === undefined) {
    return compareText(current, lo) === 0;
  }
  const hi = resolveTextLiteral(value.hi, length, value.kind);
  return compareText(current, lo) >= 0 && compareText(current, hi) <= 0;
}

/**
 * Evaluate a level-88 condition against its parent's decoded value. OR semantics across
 * the VALUE list: any match → `'true'`; otherwise the first undecidable entry's reason;
 * otherwise `'false'`.
 */
export function evaluateCondition(
  cond: Condition,
  parent: DecodedValue,
  parentItem: DecodableItem
): 'true' | 'false' | string {
  if (parent.kind === 'invalid') {
    return '<unknown: parent invalid>';
  }
  if (parent.kind === 'unsupported') {
    return '<unknown: parent unsupported>';
  }
  if (parent.kind === 'pointer' || parent.kind === 'boolean') {
    return `<unknown: cannot compare a ${parent.kind} item>`;
  }
  if (cond.values.length === 0) {
    return '<unknown: condition has no VALUE list>';
  }

  let matcher: (value: CobolConditionValue) => Match;
  if (parent.kind === 'numeric') {
    const numeric = parent.numeric;
    if (!numeric) {
      return '<unknown: numeric parent carries no mantissa>';
    }
    matcher = (value) => matchNumeric(value, numeric);
  } else if (parent.kind === 'float') {
    const current = Number(parent.value);
    if (Number.isNaN(current)) {
      return '<unknown: parent is NaN>';
    }
    matcher = (value) => matchFloat(value, current);
  } else {
    const current = parent.text ?? unescapeValue(parent.value);
    const length = current.length > 0 ? current.length : parentItem.size;
    matcher = (value) => matchText(value, current, length);
  }

  let unknown: string | undefined;
  for (const value of cond.values) {
    const result = matcher(value);
    if (result === true) {
      return 'true';
    }
    if (typeof result === 'string' && unknown === undefined) {
      unknown = result;
    }
  }
  return unknown ?? 'false';
}
