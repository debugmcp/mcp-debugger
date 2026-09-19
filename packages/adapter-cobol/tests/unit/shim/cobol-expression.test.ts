/**
 * The COBOL data-reference grammar, parsed in isolation.
 */
import { describe, expect, it } from 'vitest';
import { parseCobolExpression } from '../../../src/shim/cobol-expression.js';

describe('parseCobolExpression', () => {
  it('parses a bare name, case-insensitively', () => {
    expect(parseCobolExpression('ws-total')).toEqual({ ref: { names: ['WS-TOTAL'], subscripts: [] } });
  });

  it('parses OF/IN qualification, nearest qualifier first', () => {
    expect(parseCobolExpression('WS-ID OF WS-GROUP IN WS-REC')?.ref.names).toEqual(['WS-ID', 'WS-GROUP', 'WS-REC']);
  });

  it('parses subscripts separated by commas or spaces, with identifier offsets', () => {
    expect(parseCobolExpression('WS-CELL(1, 2)')?.ref.subscripts).toEqual([
      { kind: 'int', value: 1 },
      { kind: 'int', value: 2 }
    ]);
    expect(parseCobolExpression('WS-CELL(WS-I + 1 J-2)')?.ref.subscripts).toEqual([
      { kind: 'ident', name: 'WS-I', delta: 1 },
      { kind: 'ident', name: 'J-2', delta: 0 }
    ]);
    expect(parseCobolExpression('WS-CELL(WS-I -1)')?.ref.subscripts).toEqual([{ kind: 'ident', name: 'WS-I', delta: -1 }]);
  });

  it('parses reference modification with and without a length, after subscripts', () => {
    expect(parseCobolExpression('WS-NAME(2:3)')?.ref.refmod).toEqual({ start: { kind: 'int', value: 2 }, length: { kind: 'int', value: 3 } });
    expect(parseCobolExpression('WS-NAME(WS-POS:)')?.ref.refmod).toEqual({ start: { kind: 'ident', name: 'WS-POS' } });
    const both = parseCobolExpression('WS-CELL(3)(1:2)');
    expect(both?.ref.subscripts).toEqual([{ kind: 'int', value: 3 }]);
    expect(both?.ref.refmod).toEqual({ start: { kind: 'int', value: 1 }, length: { kind: 'int', value: 2 } });
  });

  it('parses LENGTH OF / ADDRESS OF and the shim prefixes', () => {
    expect(parseCobolExpression('LENGTH OF WS-REC')).toEqual({ fn: 'LENGTH', ref: { names: ['WS-REC'], subscripts: [] } });
    expect(parseCobolExpression('address of ws-rec of ws-top')?.fn).toBe('ADDRESS');
    expect(parseCobolExpression('/hex WS-REC')?.prefix).toBe('/hex');
    expect(parseCobolExpression('/ADDR WS-REC(2)')?.prefix).toBe('/addr');
    expect(parseCobolExpression('/len LENGTH OF WS-REC')).toEqual({ prefix: '/len', fn: 'LENGTH', ref: { names: ['WS-REC'], subscripts: [] } });
  });

  it('answers undefined for anything that is not a COBOL data reference', () => {
    // `b_17` is a valid COBOL word too (cobc accepts `_`); the resolver forwards it to the engine when no item matches.
    for (const text of ['$rcx', '1 + 2', '42', 'WS-A + 1', 'a->b', 'WS-A(', 'WS-A()', 'OF WS-A', 'WS-A(1)(2)', '12-3', '', '/hexWS-A', 'WS-A(1:2)(3)']) {
      expect(parseCobolExpression(text), text).toBeUndefined();
    }
  });

  it('parses C-looking calls as COBOL references (the resolver decides they are not data items)', () => {
    // `sizeof(int)` is grammatically NAME(SUBSCRIPT); it falls through to the engine when SIZEOF resolves to nothing.
    expect(parseCobolExpression('sizeof(int)')?.ref).toEqual({ names: ['SIZEOF'], subscripts: [{ kind: 'ident', name: 'INT', delta: 0 }] });
  });
});
