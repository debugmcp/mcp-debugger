import { expect } from 'vitest';
import type { CobolFieldAttr } from '../../../src/manifest/schema.js';
import { decodeItem } from '../../../src/decoder/index.js';
import type { DecodableItem, DecodeOptions, DecodedKind, DecodedValue, SignSeen } from '../../../src/decoder/index.js';

/** `'30 30 31'` → Uint8Array; whitespace is free-form so vectors can be pasted from hexdumps. */
export function hex(s: string): Uint8Array {
  const parts = s.trim().split(/\s+/).filter((p) => p.length > 0);
  return Uint8Array.from(parts.map((p) => parseInt(p, 16)));
}

/** `[type, digits, scale, flags]` in the order cobc writes `cob_field_attr` initialisers. */
export function attr(type: number, digits: number, scale: number, flags: number, pic?: CobolFieldAttr['pic']): CobolFieldAttr {
  return pic ? { type, digits, scale, flags, pic } : { type, digits, scale, flags };
}

export function item(a: CobolFieldAttr | undefined, size: number, extra: Partial<DecodableItem> = {}): DecodableItem {
  return {
    attr: a,
    size,
    usage: 'DISPLAY',
    level: 5,
    flags: {},
    ...extra
  };
}

export interface Expectation {
  value: string;
  kind: DecodedKind;
  type?: string;
  mantissa?: bigint;
  scale?: number;
  signSeen?: SignSeen;
  invalid?: RegExp;
  text?: string;
}

export interface Vector {
  name: string;
  hex: string;
  attr: CobolFieldAttr | undefined;
  size: number;
  expect: Expectation;
  extra?: Partial<DecodableItem>;
  opts?: DecodeOptions;
}

/** Tests always pin the host byte order so a BE CI box and an LE laptop agree. */
export const LE: DecodeOptions = { hostLittleEndian: true };
export const BE: DecodeOptions = { hostLittleEndian: false };

export function check(decoded: DecodedValue, e: Expectation): void {
  expect(decoded.value).toBe(e.value);
  expect(decoded.kind).toBe(e.kind);
  if (e.type !== undefined) {
    expect(decoded.type).toBe(e.type);
  }
  if (e.mantissa !== undefined) {
    expect(decoded.numeric?.mantissa).toBe(e.mantissa);
  }
  if (e.scale !== undefined) {
    expect(decoded.numeric?.scale).toBe(e.scale);
  }
  if (e.signSeen !== undefined) {
    expect(decoded.numeric?.signSeen).toBe(e.signSeen);
  }
  if (e.invalid !== undefined) {
    expect(decoded.invalid).toMatch(e.invalid);
  }
  if (e.text !== undefined) {
    expect(decoded.text).toBe(e.text);
  }
  if (e.kind === 'invalid') {
    expect(decoded.invalid).toBeTruthy();
  } else {
    expect(decoded.invalid).toBeUndefined();
  }
  if (e.kind !== 'numeric') {
    expect(decoded.numeric).toBeUndefined();
  }
}

export function runVector(v: Vector): DecodedValue {
  const decoded = decodeItem(hex(v.hex), item(v.attr, v.size, v.extra), { ...LE, ...v.opts });
  check(decoded, v.expect);
  return decoded;
}
