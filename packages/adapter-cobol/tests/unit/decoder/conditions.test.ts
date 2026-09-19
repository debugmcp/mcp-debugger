import { describe, expect, it } from 'vitest';
import { COB_FLAG, COB_TYPE } from '../../../src/manifest/attr-constants.js';
import type { CobolConditionValue, CobolDataItem } from '../../../src/manifest/schema.js';
import { decodeItem, evaluateCondition } from '../../../src/decoder/index.js';
import type { DecodableItem, DecodedValue } from '../../../src/decoder/index.js';
import { attr, hex, item, LE } from './helpers.js';

type Condition = NonNullable<CobolDataItem['condition']>;

/** `values('1', ['5', '9'])` → VALUE 1, 5 THRU 9. */
function values(...entries: Array<string | [string, string]>): Condition {
  const list: CobolConditionValue[] = entries.map((e) =>
    typeof e === 'string' ? { lo: e, resolved: true } : { lo: e[0], hi: e[1], resolved: true }
  );
  return { values: list, raw: list.map((v) => (v.hi ? `${v.lo} THRU ${v.hi}` : v.lo)).join(' ') };
}

const SIGNED = COB_FLAG.HAVE_SIGN;

function numericParent(bytes: string, digits: number, scale: number, flags = 0): [DecodedValue, DecodableItem] {
  const parentItem = item(attr(COB_TYPE.NUMERIC_DISPLAY, digits, scale, flags), digits + (flags & COB_FLAG.SIGN_SEPARATE ? 1 : 0));
  return [decodeItem(hex(bytes), parentItem, LE), parentItem];
}

function textParent(bytes: string, opts?: { maxTextChars?: number }): [DecodedValue, DecodableItem] {
  const size = hex(bytes).length;
  const parentItem = item(attr(COB_TYPE.ALPHANUMERIC, 0, 0, 0), size);
  return [decodeItem(hex(bytes), parentItem, { ...LE, ...opts }), parentItem];
}

function groupParent(bytes: string): [DecodedValue, DecodableItem] {
  const size = hex(bytes).length;
  const parentItem = item(attr(COB_TYPE.GROUP, 0, 0, 0), size, { usage: 'GROUP', level: 1 });
  return [decodeItem(hex(bytes), parentItem, { ...LE, groupPreviewBytes: 2 }), parentItem];
}

describe('evaluateCondition: numeric parents', () => {
  it('single value equality', () => {
    const [p, i] = numericParent('30 30 35', 3, 0);
    expect(evaluateCondition(values('5'), p, i)).toBe('true');
    expect(evaluateCondition(values('6'), p, i)).toBe('false');
    expect(evaluateCondition(values('05'), p, i)).toBe('true');
  });

  it('THRU is inclusive at both ends', () => {
    const [p, i] = numericParent('30 31 30', 3, 0);
    expect(evaluateCondition(values(['1', '10']), p, i)).toBe('true');
    expect(evaluateCondition(values(['10', '20']), p, i)).toBe('true');
    expect(evaluateCondition(values(['11', '20']), p, i)).toBe('false');
    expect(evaluateCondition(values(['1', '9']), p, i)).toBe('false');
  });

  it('OR across the VALUE list', () => {
    const [p, i] = numericParent('30 30 37', 3, 0);
    expect(evaluateCondition(values('1', '3', ['5', '9']), p, i)).toBe('true');
    expect(evaluateCondition(values('1', '3', ['8', '9']), p, i)).toBe('false');
  });

  it('decimal literals against a scaled parent compare exactly', () => {
    // ✔ measured S9(5)V99 = -123.45
    const [p, i] = numericParent('30 30 31 32 33 34 75', 7, 2, SIGNED);
    expect(evaluateCondition(values('-123.45'), p, i)).toBe('true');
    expect(evaluateCondition(values('-123.450'), p, i)).toBe('true');
    expect(evaluateCondition(values('-123.4'), p, i)).toBe('false');
    expect(evaluateCondition(values(['-200', '-100']), p, i)).toBe('true');
    expect(evaluateCondition(values(['-123.44', '0']), p, i)).toBe('false');
    expect(evaluateCondition(values(['-123.46', '-123.44']), p, i)).toBe('true');
    expect(evaluateCondition(values('+5', '.5', '-.5'), p, i)).toBe('false');
  });

  it('literals with more fraction digits than the parent scale still compare', () => {
    const [p, i] = numericParent('35', 1, 1); // 0.5
    expect(evaluateCondition(values('0.50'), p, i)).toBe('true');
    expect(evaluateCondition(values('.5'), p, i)).toBe('true');
    expect(evaluateCondition(values(['0.499', '0.501']), p, i)).toBe('true');
    expect(evaluateCondition(values('0.51'), p, i)).toBe('false');
  });

  it('negative-scale (P) parents compare at their expanded value', () => {
    const [p, i] = numericParent('37', 1, -2); // 700
    expect(evaluateCondition(values('700'), p, i)).toBe('true');
    expect(evaluateCondition(values('7'), p, i)).toBe('false');
  });

  it('ZERO / ZEROS / ZEROES are numeric zero', () => {
    const [zero, i] = numericParent('30 30 30', 3, 0);
    for (const fig of ['ZERO', 'ZEROS', 'ZEROES', 'zero']) {
      expect(evaluateCondition(values(fig), zero, i)).toBe('true');
    }
    const [five] = numericParent('30 30 35', 3, 0);
    expect(evaluateCondition(values('ZERO'), five, i)).toBe('false');
  });

  it('all-spaces parent is zero and matches ZERO', () => {
    const [p, i] = numericParent('20 20 20', 3, 0);
    expect(evaluateCondition(values('ZERO'), p, i)).toBe('true');
    expect(evaluateCondition(values('0'), p, i)).toBe('true');
  });

  it('a non-numeric literal on a numeric parent is unknown, not false', () => {
    const [p, i] = numericParent('30 30 35', 3, 0);
    expect(evaluateCondition(values('SPACES'), p, i)).toBe('<unknown: non-numeric literal "SPACES" on a numeric item>');
    expect(evaluateCondition(values('Y'), p, i)).toMatch(/^<unknown: non-numeric literal "Y"/);
    expect(evaluateCondition(values(['1', 'Z']), p, i)).toMatch(/^<unknown: non-numeric literal "Z"/);
    expect(evaluateCondition(values('.'), p, i)).toMatch(/^<unknown/);
  });

  it('a true match beats an unknown entry; an unknown entry beats false', () => {
    const [p, i] = numericParent('30 30 35', 3, 0);
    expect(evaluateCondition(values('Y', '5'), p, i)).toBe('true');
    expect(evaluateCondition(values('4', 'Y', '6'), p, i)).toMatch(/^<unknown: non-numeric literal "Y"/);
  });

  it('binary and packed parents work the same way (they share the mantissa/scale contract)', () => {
    const packedItem = item(attr(COB_TYPE.NUMERIC_PACKED, 9, 2, SIGNED), 5, { usage: 'COMP-3' });
    const packed = decodeItem(hex('00 12 34 56 7d'), packedItem, LE); // ✔ -12345.67
    expect(evaluateCondition(values(['-20000', '-10000']), packed, packedItem)).toBe('true');
    const binItem = item(attr(COB_TYPE.NUMERIC_BINARY, 9, 0, 0x0821), 4, { usage: 'COMP' });
    const bin = decodeItem(hex('f8 a4 32 eb'), binItem, LE); // ✔ -123456789
    expect(evaluateCondition(values('-123456789'), bin, binItem)).toBe('true');
  });
});

describe('evaluateCondition: text and group parents', () => {
  it('OR of single characters with space padding', () => {
    const [p, i] = textParent('59 20'); // "Y "
    expect(evaluateCondition(values('N', 'Y'), p, i)).toBe('true');
    expect(evaluateCondition(values('N'), p, i)).toBe('false');
    expect(evaluateCondition(values('Y '), p, i)).toBe('true');
    expect(evaluateCondition(values('Y  '), p, i)).toBe('true');
  });

  it('a literal longer than the parent compares against the space-padded parent', () => {
    const [p, i] = textParent('41 42'); // "AB"
    expect(evaluateCondition(values('AB  '), p, i)).toBe('true');
    expect(evaluateCondition(values('ABC'), p, i)).toBe('false');
  });

  it('THRU on text is a byte-wise range', () => {
    const [p, i] = textParent('4d'); // "M"
    expect(evaluateCondition(values(['A', 'Z']), p, i)).toBe('true');
    expect(evaluateCondition(values(['N', 'Z']), p, i)).toBe('false');
    expect(evaluateCondition(values(['A', 'M']), p, i)).toBe('true');
    const [code, ci] = textParent('41 35'); // "A5"
    expect(evaluateCondition(values(['A0', 'A9']), code, ci)).toBe('true');
    expect(evaluateCondition(values(['B0', 'B9']), code, ci)).toBe('false');
  });

  it('numeric literals against a text parent compare as their digits', () => {
    const [p, i] = textParent('30 31'); // "01"
    expect(evaluateCondition(values('01'), p, i)).toBe('true');
    expect(evaluateCondition(values('1'), p, i)).toBe('false');
  });

  it('figurative constants fill the whole parent', () => {
    const [spaces, si] = textParent('20 20 20 20');
    expect(evaluateCondition(values('SPACES'), spaces, si)).toBe('true');
    expect(evaluateCondition(values('SPACE'), spaces, si)).toBe('true');
    expect(evaluateCondition(values('LOW-VALUES'), spaces, si)).toBe('false');

    const [low, li] = textParent('00 00 00');
    expect(evaluateCondition(values('LOW-VALUES'), low, li)).toBe('true');
    expect(evaluateCondition(values('LOW-VALUE'), low, li)).toBe('true');
    expect(evaluateCondition(values('SPACES'), low, li)).toBe('false');

    const [high, hi] = textParent('ff ff');
    expect(evaluateCondition(values('HIGH-VALUES'), high, hi)).toBe('true');
    expect(evaluateCondition(values('HIGH-VALUE'), high, hi)).toBe('true');

    const [zeros, zi] = textParent('30 30 30');
    expect(evaluateCondition(values('ZEROS'), zeros, zi)).toBe('true');
    expect(evaluateCondition(values('ZERO'), zeros, zi)).toBe('true');
    expect(evaluateCondition(values('ZEROES'), zeros, zi)).toBe('true');

    const [quotes, qi] = textParent('22 22');
    expect(evaluateCondition(values('QUOTES'), quotes, qi)).toBe('true');
    expect(evaluateCondition(values('QUOTE'), quotes, qi)).toBe('true');

    // A partial low-value field is neither LOW-VALUES nor SPACES.
    const [mixed, mi] = textParent('00 20');
    expect(evaluateCondition(values('LOW-VALUES'), mixed, mi)).toBe('false');
    expect(evaluateCondition(values('SPACES'), mixed, mi)).toBe('false');
  });

  it("ALL 'x' repeats to the parent length", () => {
    const [p, i] = textParent('58 58 58'); // "XXX"
    expect(evaluateCondition(values("ALL 'X'"), p, i)).toBe('true');
    expect(evaluateCondition(values('ALL "X"'), p, i)).toBe('true');
    expect(evaluateCondition(values("ALL 'Y'"), p, i)).toBe('false');
    const [ab, abi] = textParent('41 42 41 42 41'); // "ABABA"
    expect(evaluateCondition(values("ALL 'AB'"), ab, abi)).toBe('true');
    const [stars, sti] = textParent('2a 2a');
    expect(evaluateCondition(values('ALL *'), stars, sti)).toBe('true');
    expect(evaluateCondition(values('ALL SPACES'), stars, sti)).toBe('false');
    // An empty repeat unit compares as an empty (space-padded) string, never loops.
    expect(evaluateCondition(values("ALL ''"), stars, sti)).toBe('false');
    expect(evaluateCondition(values("ALL ''"), ...textParent('20 20'))).toBe('true');
  });

  it('unquoted literal text is taken as-is (the manifest strips quotes)', () => {
    const [p, i] = textParent('41 43 54 49 56 45'); // "ACTIVE"
    expect(evaluateCondition(values('ACTIVE'), p, i)).toBe('true');
    expect(evaluateCondition(values('active'), p, i)).toBe('false');
  });

  it('compares the full text even when the shown value is truncated', () => {
    const [p, i] = textParent('41 42 43 44 45 46', { maxTextChars: 2 });
    expect(p.value).toBe('"AB" …(+4 bytes)');
    expect(evaluateCondition(values('ABCDEF'), p, i)).toBe('true');
    expect(evaluateCondition(values('AB'), p, i)).toBe('false');
  });

  it('group parents compare as text over their full content', () => {
    const [spaces, si] = groupParent('20 20 20 20 20');
    expect(evaluateCondition(values('SPACES'), spaces, si)).toBe('true');
    const [rec, ri] = groupParent('48 45 4c 4c 4f'); // "HELLO", preview cut at 2
    expect(rec.value).toBe('"HE" … (5 bytes)');
    expect(evaluateCondition(values('HELLO'), rec, ri)).toBe('true');
    expect(evaluateCondition(values('HE'), rec, ri)).toBe('false');
    expect(evaluateCondition(values(['HA', 'HZ']), rec, ri)).toBe('true');
  });

  it('falls back to unescaping value when text is missing (hand-built DecodedValue)', () => {
    const parentItem = item(attr(COB_TYPE.ALPHANUMERIC, 0, 0, 0), 4);
    const handBuilt: DecodedValue = { value: '"A\\x00\\"\\\\"', type: 'PIC X(4)', kind: 'text' };
    expect(evaluateCondition(values('A "\\'), handBuilt, parentItem)).toBe('true');
    expect(evaluateCondition(values('A'), handBuilt, parentItem)).toBe('false');
  });

  it('an empty parent uses the item size for figurative fills', () => {
    const parentItem = item(attr(COB_TYPE.ALPHANUMERIC, 0, 0, 0), 3);
    const empty: DecodedValue = { value: '""', type: 'PIC X(3)', kind: 'text', text: '' };
    expect(evaluateCondition(values('SPACES'), empty, parentItem)).toBe('true');
    expect(evaluateCondition(values('LOW-VALUES'), empty, parentItem)).toBe('false');
  });
});

describe('evaluateCondition: floating-point parents', () => {
  it('compares as numbers', () => {
    const parentItem = item(attr(COB_TYPE.NUMERIC_DOUBLE, 34, 17, 0x0201), 8, { usage: 'COMP-2' });
    const p = decodeItem(hex('6e 86 1b f0 f9 21 09 40'), parentItem, LE); // ✔ 3.14159
    expect(evaluateCondition(values(['3', '4']), p, parentItem)).toBe('true');
    expect(evaluateCondition(values('3.14159'), p, parentItem)).toBe('true');
    expect(evaluateCondition(values('3.14'), p, parentItem)).toBe('false');
    expect(evaluateCondition(values('ZERO'), p, parentItem)).toMatch(/^<unknown: non-numeric literal "ZERO" on a floating-point item>/);
    expect(evaluateCondition(values(['1', 'X']), p, parentItem)).toMatch(/^<unknown: non-numeric literal "X"/);
  });

  it('NaN parent is unknown', () => {
    const parentItem = item(attr(COB_TYPE.NUMERIC_DOUBLE, 34, 17, 0x0201), 8, { usage: 'COMP-2' });
    const p = decodeItem(hex('00 00 00 00 00 00 f8 7f'), parentItem, LE);
    expect(evaluateCondition(values('0'), p, parentItem)).toBe('<unknown: parent is NaN>');
  });
});

describe('evaluateCondition: undecidable parents', () => {
  it('invalid parent', () => {
    const [p, i] = numericParent('31 41 33', 3, 0);
    expect(p.kind).toBe('invalid');
    expect(evaluateCondition(values('1'), p, i)).toBe('<unknown: parent invalid>');
  });

  it('unsupported parent', () => {
    const parentItem = item(attr(COB_TYPE.NUMERIC_L_DOUBLE, 0, 0, 0x0201), 16);
    const p = decodeItem(new Uint8Array(16), parentItem, LE);
    expect(evaluateCondition(values('0'), p, parentItem)).toBe('<unknown: parent unsupported>');
  });

  it('pointer and boolean parents', () => {
    const ptrItem = item(attr(COB_TYPE.NUMERIC_BINARY, 0, 0, COB_FLAG.IS_POINTER), 8, { usage: 'POINTER' });
    const ptr = decodeItem(new Uint8Array(8), ptrItem, LE);
    expect(evaluateCondition(values('0'), ptr, ptrItem)).toBe('<unknown: cannot compare a pointer item>');
    const boolItem = item(attr(COB_TYPE.BOOLEAN, 8, 0, 0), 1);
    const bool = decodeItem(hex('01'), boolItem, LE);
    expect(evaluateCondition(values('1'), bool, boolItem)).toBe('<unknown: cannot compare a boolean item>');
  });

  it('empty VALUE list', () => {
    const [p, i] = numericParent('30 30 35', 3, 0);
    expect(evaluateCondition({ values: [], raw: '' }, p, i)).toBe('<unknown: condition has no VALUE list>');
  });

  it('numeric kind without a mantissa (hand-built)', () => {
    const parentItem = item(attr(COB_TYPE.NUMERIC_DISPLAY, 3, 0, 0), 3);
    const handBuilt: DecodedValue = { value: '5', type: 'PIC 9(3)', kind: 'numeric' };
    expect(evaluateCondition(values('5'), handBuilt, parentItem)).toBe('<unknown: numeric parent carries no mantissa>');
  });
});
