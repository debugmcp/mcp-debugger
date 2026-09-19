import { describe, it, expect } from 'vitest';
import { parseAttrsAndStorage, reconstructPicture, parseDataExpr, splitTopLevelArgs, unescapeCString } from '../../../src/manifest/index.js';

describe('parseAttrsAndStorage', () => {
  it('parses attributes with tabs, spaces and hex/decimal fields', () => {
    const tables = parseAttrsAndStorage([
      'static const cob_field_attr a_1 =\t{0x10,   7,   2, 0x0001, NULL};',
      'static const cob_field_attr a_2 = {0x21, 0, 0, 0x1000, NULL};',
      'static const cob_field_attr a_3={0x11,9,0,0x0821,NULL};'
    ].join('\n'));
    expect(tables.attrs.get('a_1')).toEqual({ type: 0x10, digits: 7, scale: 2, flags: 0x1 });
    expect(tables.attrs.get('a_2')).toEqual({ type: 0x21, digits: 0, scale: 0, flags: 0x1000 });
    expect(tables.attrs.get('a_3')).toEqual({ type: 0x11, digits: 9, scale: 0, flags: 0x821 });
    expect(tables.diagnostics).toEqual([]);
  });

  it('attaches picture symbol arrays referenced as &p_N and reconstructs the edited picture', () => {
    const tables = parseAttrsAndStorage([
      "static const cob_pic_symbol p_1[] = {{'Z', 3}, {'9', 1}, {'.', 1}, {'9', 2}, {'\\0', 0}};",
      'static const cob_field_attr a_4 =\t{0x24,   6,   2, 0x0000, &p_1};',
      'static const cob_pic_symbol p_2[] =',
      "\t{{'X', 4}, {'\\0', 0}};",
      'static const cob_field_attr a_5 =\t{0x23,   0,   0, 0x0000, p_2};'
    ].join('\n'));
    expect(tables.attrs.get('a_4')?.pic).toEqual([
      { symbol: 'Z', count: 3 },
      { symbol: '9', count: 1 },
      { symbol: '.', count: 1 },
      { symbol: '9', count: 2 }
    ]);
    // Canonical reconstruction: `9(2)`, not the source's `99` (the listing supplies that).
    expect(reconstructPicture(tables.attrs.get('a_4'), 7)).toBe('Z(3)9.9(2)');
    expect(tables.attrs.get('a_5')?.pic).toEqual([{ symbol: 'X', count: 4 }]);
    expect(tables.diagnostics).toEqual([]);
  });

  it('warns about an attr whose picture array is missing', () => {
    const tables = parseAttrsAndStorage('static const cob_field_attr a_9 =\t{0x24, 6, 2, 0x0000, &p_9};');
    expect(tables.attrs.get('a_9')?.pic).toBeUndefined();
    expect(tables.diagnostics.map((d) => d.message)).toEqual([expect.stringContaining('p_9')]);
  });

  it('parses literal constants including casts and escaped strings', () => {
    const tables = parseAttrsAndStorage([
      'static const cob_field c_1\t= {3, (cob_u8_ptr)"100", &a_1};',
      'static const cob_field c_2\t= {8, (cob_u8_t *)"say \\"hi\\"", &a_2};',
      'static const cob_field c_3 = {2, (cob_u8_ptr)"a,b", &a_2};',
      'static const cob_field c_4 = {1, (cob_u8_ptr)"\\000", &a_2};'
    ].join('\n'));
    expect(tables.constants.get('c_1')).toEqual({ symbol: 'c_1', size: 3, text: '100', attrSymbol: 'a_1' });
    expect(tables.constants.get('c_2')?.text).toBe('say "hi"');
    expect(tables.constants.get('c_3')?.text).toBe('a,b');
    expect(tables.constants.get('c_4')?.text).toBe('\0');
  });

  it('parses storage arrays, register ints and linkage pointers with their comments', () => {
    const tables = parseAttrsAndStorage([
      'static int\tb_2;\t/* RETURN-CODE */',
      'static cob_u8_t\tb_17[12] __attribute__((aligned));\t/* WS-ALPHA */',
      'static cob_u8_t b_24[25] __attribute__((aligned));   /* WS-GROUP */',
      'static unsigned char\t*b_9 = NULL;  /* XML-NAMESPACE */',
      'unsigned char\t*b_30 = NULL;',
      'static unsigned char\t*last_b_19;'
    ].join('\r\n'));
    expect(tables.storage.get('b_2')).toEqual({ symbol: 'b_2', kind: 'int', size: 4, comment: 'RETURN-CODE' });
    expect(tables.storage.get('b_17')).toEqual({ symbol: 'b_17', kind: 'array', size: 12, comment: 'WS-ALPHA' });
    expect(tables.storage.get('b_24')).toEqual({ symbol: 'b_24', kind: 'array', size: 25, comment: 'WS-GROUP' });
    expect(tables.storage.get('b_9')).toEqual({ symbol: 'b_9', kind: 'pointer', comment: 'XML-NAMESPACE' });
    expect(tables.storage.get('b_30')).toEqual({ symbol: 'b_30', kind: 'pointer', comment: undefined });
    expect(tables.storage.has('last_b_19')).toBe(false);
  });

  it('parses cob_field tables with plain, offset, NULL and local data expressions', () => {
    const tables = parseAttrsAndStorage([
      'static cob_field f_19\t= {7, b_19, &a_8};\t/* WS-SCALED */',
      'static cob_field f_26\t= {20, b_24 + 4, &a_9};\t/* WS-NAME */',
      'static cob_field f_17\t= {4, NULL, &a_2};\t/* LS-WORK */',
      'static cob_field f_40 = {6, cob_local_ptr + 16, &a_4};',
      'static cob_field f_41 = {4, (cob_u8_t *)&b_2, &a_3};'
    ].join('\n'));
    expect(tables.fields.get('f_19')).toEqual({ symbol: 'f_19', size: 7, dataExpr: 'b_19', attrSymbol: 'a_8', comment: 'WS-SCALED' });
    expect(tables.fields.get('f_26')).toMatchObject({ size: 20, dataExpr: 'b_24 + 4', attrSymbol: 'a_9' });
    expect(tables.fields.get('f_17')).toMatchObject({ dataExpr: 'NULL' });
    expect(tables.fields.get('f_40')).toMatchObject({ dataExpr: 'cob_local_ptr + 16', comment: undefined });
    expect(parseDataExpr(tables.fields.get('f_41')?.dataExpr ?? '')).toEqual({ kind: 'register', symbol: 'b_2', offset: 0 });
  });

  it('ignores unrelated declarations and returns empty tables for empty input', () => {
    const tables = parseAttrsAndStorage('static const char st_1[]\t= "0000-MAIN";\ncob_field\t\tf0;\n');
    expect(tables.attrs.size + tables.constants.size + tables.fields.size + tables.storage.size).toBe(0);
    expect(parseAttrsAndStorage('').diagnostics).toEqual([]);
  });
});

describe('c-text helpers', () => {
  it('splits argument lists at depth 0 only, honouring strings', () => {
    expect(splitTopLevelArgs('77, "RETURN-CODE", COB_SET_FLD (f0, 4, (cob_u8_t *)&b_2, &a_17), 0, 0')).toEqual([
      '77', '"RETURN-CODE"', 'COB_SET_FLD (f0, 4, (cob_u8_t *)&b_2, &a_17)', '0', '0'
    ]);
    expect(splitTopLevelArgs('1, "a, b", 2')).toEqual(['1', '"a, b"', '2']);
    expect(splitTopLevelArgs('')).toEqual([]);
  });

  it('parses the data address shapes cobc emits', () => {
    expect(parseDataExpr('b_17')).toEqual({ kind: 'symbol', symbol: 'b_17', offset: 0 });
    expect(parseDataExpr('b_24 + 24')).toEqual({ kind: 'symbol', symbol: 'b_24', offset: 24 });
    expect(parseDataExpr('(b_24 + 4LL)')).toEqual({ kind: 'symbol', symbol: 'b_24', offset: 4 });
    expect(parseDataExpr('cob_local_ptr + 16')).toEqual({ kind: 'local', symbol: 'cob_local_ptr', offset: 16 });
    expect(parseDataExpr('cob_local_ptr')).toEqual({ kind: 'local', symbol: 'cob_local_ptr', offset: 0 });
    expect(parseDataExpr('(cob_u8_t *)&b_2')).toEqual({ kind: 'register', symbol: 'b_2', offset: 0 });
    expect(parseDataExpr('NULL')).toEqual({ kind: 'null', symbol: '', offset: 0 });
    expect(parseDataExpr('b_30 + 4LL * (x - 1)')).toBeUndefined();
  });

  it('decodes C escapes', () => {
    expect(unescapeCString('C:\\\\work\\\\x.cpy')).toBe('C:\\work\\x.cpy');
    expect(unescapeCString('a\\"b\\n\\x41\\101')).toBe('a"b\nAA');
  });
});
