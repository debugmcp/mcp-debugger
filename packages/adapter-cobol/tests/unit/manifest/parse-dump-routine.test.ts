import { describe, it, expect } from 'vitest';
import { parseAttrsAndStorage, parseDumpRoutine, splitLines } from '../../../src/manifest/index.js';
import type { CobolDataItem, DumpRoutineResult } from '../../../src/manifest/index.js';

const HEADERS = [
  'static const cob_field_attr a_1 =\t{0x01,   0,   0, 0x0000, NULL};',
  'static const cob_field_attr a_2 =\t{0x10,   4,   0, 0x0000, NULL};',
  'static const cob_field_attr a_3 =\t{0x1b,   9,   0, 0x0041, NULL};',
  'static const cob_field_attr a_4 =\t{0x21,   0,   0, 0x0000, NULL};',
  'static const cob_field_attr a_5 =\t{0x11,   9,   0, 0x0821, NULL};',
  'static const cob_field c_1\t= {1, (cob_u8_ptr)"A", &a_4};',
  'static const cob_field c_2\t= {1, (cob_u8_ptr)"C", &a_4};',
  'static const cob_field c_3\t= {1, (cob_u8_ptr)"X", &a_4};',
  'static int\tb_2;\t/* RETURN-CODE */',
  'static cob_u8_t\tb_10[40] __attribute__((aligned));\t/* WS-TAB */',
  'static cob_u8_t\tb_5[2] __attribute__((aligned));\t/* WS-CNT */',
  'static cob_u8_t\tb_6[9] __attribute__((aligned));\t/* WS-ODO */',
  'static cob_u8_t\tb_7[80] __attribute__((aligned));\t/* REC */',
  'static unsigned char\t*b_8 = NULL;  /* WS-BASED */',
  'static cob_field f_3\t= {4, NULL, &a_5};\t/* LK-VALUE */',
  'static cob_field f_5\t= {2, b_5, &a_2};\t/* WS-CNT */',
  'static cob_field f_11\t= {4, b_10 + 4, &a_2};\t/* WS-VAL2 */'
].join('\n');

function run(dumpLines: string[], joiner = '\n'): DumpRoutineResult {
  const text = ['  P_dump:', ...dumpLines, '  cob_dump_output ("END OF DUMP - T");', '    return 0;'].join(joiner);
  return parseDumpRoutine({ lines: splitLines(text), tables: parseAttrsAndStorage(HEADERS), programId: 'T' });
}

function byName(result: DumpRoutineResult, name: string): CobolDataItem {
  const found = result.items.find((i) => i.name === name);
  if (!found) {
    throw new Error(`no item ${name}; have ${result.items.map((i) => i.name).join(', ')}`);
  }
  return found;
}

describe('parseDumpRoutine', () => {
  it('reports found=false when there is no dump routine', () => {
    const result = parseDumpRoutine({ lines: ['int x;', 'return 0;'], tables: parseAttrsAndStorage(''), programId: 'T' });
    expect(result.found).toBe(false);
    expect(result.items).toEqual([]);
  });

  it('accepts both COB_SET_FLD spellings, tabs, and CRLF input', () => {
    const result = run([
      '\tcob_dump_output("WORKING-STORAGE");',
      '\tcob_dump_field_ext (77, "RETURN-CODE", COB_SET_FLD (f0, 4, (cob_u8_t *)&b_2, &a_3), 0, 0);',
      '\tcob_dump_field_ext ( 1, "WS-TAB",\tCOB_SET_FLD(f0, 40, b_10, &a_1), 0, 0);'
    ], '\r\n');
    expect(result.found).toBe(true);
    expect(result.diagnostics).toEqual([]);
    const rc = byName(result, 'RETURN-CODE');
    expect(rc).toMatchObject({ level: 77, size: 4, usage: 'COMP-5', picture: 'S9(9)' });
    expect(rc.storage).toEqual({ kind: 'register', symbol: 'b_2' });
    const tab = byName(result, 'WS-TAB');
    expect(tab.storage).toEqual({ kind: 'static', symbol: 'b_10' });
    expect(tab).toMatchObject({ size: 40, usage: 'GROUP' });
    expect(result.roots).toEqual([{ section: 'WORKING-STORAGE', itemIds: [rc.id, tab.id] }]);
  });

  it('nests OCCURS two levels deep with dimensions outermost first', () => {
    const result = run([
      '  cob_dump_output ("WORKING-STORAGE");',
      '  cob_dump_field_ext ( 1, "WS-TAB", COB_SET_FLD (f0, 40, b_10, &a_1), 0, 0);',
      '  {',
      '    int i_1;',
      '    int max_1 = 2;',
      '    for (i_1=0; i_1 < max_1; i_1++)',
      '    {',
      '      cob_dump_field_ext ( 5, "WS-ROW", COB_SET_FLD (f0, 20, b_10, &a_1), 0, 1, i_1, 20UL); /* OCCURS 1 2 */',
      '      {',
      '        int i_2;',
      '        int max_2 = 5;',
      '        for (i_2=0; i_2 < max_2; i_2++)',
      '        {',
      '          cob_dump_field_ext (10, "WS-COL", COB_SET_FLD (f0, 4, b_10, &a_1), 0, 2, i_1, 20UL, i_2, 4UL); /* OCCURS 1 5 */',
      '          cob_dump_field_ext (15, "WS-VAL", COB_SET_FLD (f0, 4, b_10, &a_2), 0, 2, i_1, 20UL, i_2, 4UL);',
      '        }',
      '      }',
      '    }',
      '  }',
      '  cob_dump_field_ext ( 1, "WS-AFTER", COB_SET_FLD (f0, 4, b_10, &a_2), 0, 0);'
    ]);
    expect(result.diagnostics).toEqual([]);
    const row = byName(result, 'WS-ROW');
    const col = byName(result, 'WS-COL');
    const val = byName(result, 'WS-VAL');
    expect(row.occurs).toEqual({ min: 1, max: 2, elemSize: 20 });
    expect(col.occurs).toEqual({ min: 1, max: 5, elemSize: 4 });
    expect(val.occurs).toBeUndefined();
    expect(col.occursDims).toEqual([
      { itemId: row.id, elemSize: 20, max: 2 },
      { itemId: col.id, elemSize: 4, max: 5 }
    ]);
    expect(val.occursDims).toEqual(col.occursDims);
    expect(val.parentId).toBe(col.id);
    expect(col.parentId).toBe(row.id);
    expect(row.parentId).toBe(byName(result, 'WS-TAB').id);
    expect(byName(result, 'WS-AFTER').occursDims).toEqual([]);
    expect(byName(result, 'WS-AFTER').parentId).toBeUndefined();
  });

  it('records OCCURS DEPENDING ON with a runtime size expression and the depending item', () => {
    const result = run([
      '  cob_dump_output ("WORKING-STORAGE");',
      '  cob_dump_field_ext ( 1, "WS-CNT", &f_5, 0, 0);',
      '  cob_dump_field_ext ( 1, "WS-ODO", COB_SET_FLD (f0, cob_get_numdisp (b_5, 2), b_6, &a_1), 0, 0);',
      '  {',
      '    int i_1;',
      '    int max_1 = cob_get_numdisp (b_5, 2);',
      '    if (max_1 > 9) max_1 = 9;',
      '    for (i_1=0; i_1 < max_1; i_1++)',
      '    {',
      '      cob_dump_field_ext ( 5, "WS-ITEM", COB_SET_FLD (f0, 1, b_6, &a_4), 0, 1, i_1, 1UL); /* OCCURS 1 9 */',
      '    }',
      '  }'
    ]);
    expect(result.diagnostics).toEqual([]);
    const cnt = byName(result, 'WS-CNT');
    const odo = byName(result, 'WS-ODO');
    const entry = byName(result, 'WS-ITEM');
    expect(cnt.fieldSymbol).toBe('f_5');
    expect(odo).toMatchObject({ size: 9, sizeExpr: 'cob_get_numdisp (b_5, 2)', usage: 'GROUP' });
    expect(entry.occurs).toEqual({
      min: 1,
      max: 9,
      elemSize: 1,
      dependingExpr: 'cob_get_numdisp (b_5, 2)',
      dependingOnItemId: cnt.id
    });
  });

  it('falls back to the max declaration when the OCCURS comment is absent', () => {
    const result = run([
      '  cob_dump_output ("WORKING-STORAGE");',
      '  cob_dump_field_ext ( 1, "WS-TAB", COB_SET_FLD (f0, 40, b_10, &a_1), 0, 0);',
      '  {',
      '    int i_1;',
      '    int max_1 = 10;',
      '    for (i_1=0; i_1 < max_1; i_1++)',
      '    {',
      '      cob_dump_field_ext ( 5, "WS-ROW", COB_SET_FLD (f0, 4, b_10, &a_2), 0, 1, i_1, 4UL);',
      '    }',
      '  }'
    ]);
    expect(byName(result, 'WS-ROW').occurs).toEqual({ min: 10, max: 10, elemSize: 4 });
  });

  it('skips the NULL arm of a LINKAGE guard and binds NULL-data fields through COB_SET_DATA', () => {
    const lines = [
      '  cob_move ((cob_field *)&c_1, COB_SET_DATA (f_3, b_9));',
      '  P_dump:',
      '  {',
      '    cob_field f0;',
      '    memset(&f0,0,sizeof(f0));',
      '    cob_dump_output ("WORKING-STORAGE");',
      '    cob_dump_output ("LOCAL-STORAGE");',
      '    cob_dump_field_ext ( 1, "LS-TAG", COB_SET_FLD (f0, 6, cob_local_ptr + 16, &a_4), 0, 0);',
      '    b_9 = last_b_9;',
      '    cob_dump_output ("LINKAGE");',
      '    /* Check LINKAGE address for LK-VALUE */',
      '    if (b_9 == NULL)',
      '    {',
      '      cob_dump_field_ext ( 1, "LK-VALUE", &f_3, 0, 0);',
      '    }',
      '    else',
      '    {',
      '      cob_dump_field_ext ( 1, "LK-VALUE", &f_3, 0, 0);',
      '      cob_dump_field_ext ( 5, "LK-SUB", COB_SET_FLD (f0, 2, b_9 + 2, &a_2), 0, 0);',
      '    }',
      '    /* Check LINKAGE address for LK-OTHER */',
      '    if (b_12 == NULL)',
      '    {',
      '      cob_dump_field_ext ( 1, "LK-OTHER", COB_SET_FLD (f0, 4, NULL, &a_5), 0, 0);',
      '    }',
      '    else',
      '    {',
      '      cob_dump_field_ext ( 1, "LK-OTHER", COB_SET_FLD (f0, 4, b_12, &a_5), 0, 0);',
      '    }',
      '  }',
      '  cob_dump_output ("END OF DUMP - T");'
    ];
    const result = parseDumpRoutine({ lines, tables: parseAttrsAndStorage(HEADERS), programId: 'T' });
    expect(result.diagnostics).toEqual([]);
    expect(result.items.filter((i) => i.name === 'LK-VALUE')).toHaveLength(1);
    expect(result.items.filter((i) => i.name === 'LK-OTHER')).toHaveLength(1);
    const value = byName(result, 'LK-VALUE');
    expect(value.storage).toEqual({ kind: 'linkage', symbol: 'b_9' });
    expect(value).toMatchObject({ section: 'LINKAGE', size: 4, usage: 'COMP', fieldSymbol: 'f_3' });
    expect(byName(result, 'LK-SUB')).toMatchObject({ offset: 2, parentId: value.id });
    expect(byName(result, 'LK-OTHER').storage).toEqual({ kind: 'linkage', symbol: 'b_12' });
    const tag = byName(result, 'LS-TAG');
    expect(tag.storage).toEqual({ kind: 'local', symbol: 'cob_local_ptr' });
    expect(tag).toMatchObject({ section: 'LOCAL-STORAGE', offset: 16, size: 6 });
    expect(result.roots.map((r) => r.section)).toEqual(['WORKING-STORAGE', 'LOCAL-STORAGE', 'LINKAGE']);
  });

  it('attaches level-88 conditions with THRU and OR values resolved from the constants', () => {
    const result = run([
      '  cob_dump_output ("WORKING-STORAGE");',
      '  cob_dump_field_ext ( 1, "WS-FLAG", COB_SET_FLD (f0, 1, b_10, &a_4), 0, 0);',
      '  /* cob_dump_field_ext (88, "WS-RANGE", COB_SET_FLD (f0, 1, b_10, &a_4), 0, 0); VALUE (cob_field *)&c_1 THRU (cob_field *)&c_2 OR (cob_field *)&c_3 */',
      '  /* cob_dump_field_ext (88, "WS-BLANK", COB_SET_FLD (f0, 1, b_10, &a_4), 0, 0); VALUE &cob_all_space */',
      '  /* cob_dump_field_ext (88, "WS-ODD", COB_SET_FLD (f0, 1, b_10, &a_4), 0, 0); VALUE (cob_field *)&c_99 */',
      '  cob_dump_field_ext ( 1, "WS-NEXT", COB_SET_FLD (f0, 4, b_10 + 1, &a_2), 0, 0);'
    ]);
    expect(result.diagnostics).toEqual([]);
    const flag = byName(result, 'WS-FLAG');
    expect(flag.children.map((id) => result.items[id].name)).toEqual(['WS-RANGE', 'WS-BLANK', 'WS-ODD']);
    const range = byName(result, 'WS-RANGE');
    expect(range).toMatchObject({ level: 88, parentId: flag.id, usage: flag.usage, offset: 0, size: 1 });
    expect(range.condition).toEqual({
      values: [
        { lo: 'A', hi: 'C', resolved: true, kind: 'literal' },
        { lo: 'X', resolved: true, kind: 'literal' }
      ],
      raw: '(cob_field *)&c_1 THRU (cob_field *)&c_2 OR (cob_field *)&c_3'
    });
    expect(byName(result, 'WS-BLANK').condition?.values).toEqual([{ lo: 'SPACE', resolved: true, kind: 'figurative' }]);
    expect(byName(result, 'WS-ODD').condition?.values).toEqual([{ lo: '(cob_field *)&c_99', resolved: false }]);
    // The 88s do not disturb the level stack: WS-NEXT is a new root, not a child of WS-FLAG.
    expect(byName(result, 'WS-NEXT').parentId).toBeUndefined();
  });

  it('splits a VALUE list on OR and THRU only outside quoted literals', () => {
    const result = run([
      '  cob_dump_output ("WORKING-STORAGE");',
      '  cob_dump_field_ext ( 1, "WS-WORD", COB_SET_FLD (f0, 8, b_10, &a_4), 0, 0);',
      "  /* cob_dump_field_ext (88, \"WS-EITHER\", COB_SET_FLD (f0, 8, b_10, &a_4), 0, 0); VALUE 'A OR B'  OR  'C THRU D' THRU 'E' */"
    ]);
    const values = byName(result, 'WS-EITHER').condition?.values ?? [];
    expect(values.map((v) => [v.lo, v.hi])).toEqual([
      ["'A OR B'", undefined],
      ["'C THRU D'", "'E'"]
    ]);
  });

  it('resolves REDEFINES at root and nested levels and keeps flags from the tail', () => {
    const result = run([
      '  cob_dump_output ("WORKING-STORAGE");',
      '  cob_dump_field_ext ( 1, "WS-RAW", COB_SET_FLD (f0, 8, b_10, &a_4), 0, 0);',
      '  /* cob_dump_field_ext ( 1, "WS-ALT", COB_SET_FLD (f0, 8, b_10, &a_2), 0, 0); REDEFINES */',
      '  /* cob_dump_field_ext ( 1, "WS-ALT2", COB_SET_FLD (f0, 8, b_10, &a_2), 0, 0); REDEFINES */',
      '  cob_dump_field_ext ( 1, "WS-GRP", COB_SET_FLD (f0, 8, b_10 + 8, &a_1), 0, 0);',
      '  cob_dump_field_ext ( 5, "WS-A", COB_SET_FLD (f0, 4, b_10 + 8, &a_2), 0, 0);',
      '  /* cob_dump_field_ext ( 5, "WS-B", COB_SET_FLD (f0, 4, b_10 + 8, &a_2), 0, 0); REDEFINES */',
      '  /* cob_dump_field_ext ( 1, "WS-BASED", COB_SET_FLD (f0, 4, b_8, &a_2), 0, 0); BASED */',
      '  /* cob_dump_field_ext ( 1, "WS-EXT", COB_SET_FLD (f0, 4, b_8, &a_2), 0, 0); EXTERNAL GLOBAL */',
      '  /* cob_dump_field_ext ( 1, "WS-LOST", COB_SET_FLD (f0, 4, b_10 + 20, &a_2), 0, 0); REDEFINES */'
    ]);
    const raw = byName(result, 'WS-RAW');
    expect(byName(result, 'WS-ALT').redefinesItemId).toBe(raw.id);
    expect(byName(result, 'WS-ALT2').redefinesItemId).toBe(raw.id);
    expect(byName(result, 'WS-B').redefinesItemId).toBe(byName(result, 'WS-A').id);
    expect(byName(result, 'WS-B').parentId).toBe(byName(result, 'WS-GRP').id);
    const based = byName(result, 'WS-BASED');
    expect(based.flags).toEqual({ based: true });
    expect(based.storage).toEqual({ kind: 'linkage', symbol: 'b_8' });
    expect(byName(result, 'WS-EXT').flags).toEqual({ external: true, global: true });
    expect(byName(result, 'WS-LOST').redefinesItemId).toBeUndefined();
    expect(result.diagnostics).toEqual([
      { level: 'warn', message: 'REDEFINES tag but no earlier sibling shares its storage', program: 'T', item: 'WS-LOST' }
    ]);
  });

  it('records FILE section records under their FD', () => {
    const result = run([
      '  cob_dump_file ("FD MYFILE", h_MYFILE);',
      '  cob_dump_field_ext ( 1, "REC", COB_SET_FLD (f0, 80, b_7, &a_1), 0, 0);',
      '  cob_dump_field_ext ( 5, "REC-KEY", COB_SET_FLD (f0, 4, b_7, &a_2), 0, 0);',
      '  cob_dump_output ("WORKING-STORAGE");',
      '  cob_dump_field_ext ( 1, "WS-X", COB_SET_FLD (f0, 4, b_10, &a_2), 0, 0);'
    ]);
    expect(result.diagnostics).toEqual([]);
    const rec = byName(result, 'REC');
    expect(result.files).toEqual([{ name: 'MYFILE', handle: 'h_MYFILE', recordItemIds: [rec.id] }]);
    expect(rec).toMatchObject({ section: 'FILE', fileName: 'MYFILE' });
    expect(byName(result, 'REC-KEY')).toMatchObject({ section: 'FILE', fileName: 'MYFILE', parentId: rec.id });
    expect(byName(result, 'WS-X').section).toBe('WORKING-STORAGE');
    expect(result.roots).toEqual([
      { section: 'FILE', itemIds: [rec.id] },
      { section: 'WORKING-STORAGE', itemIds: [byName(result, 'WS-X').id, byName(result, 'RETURN-CODE').id] }
    ]);
  });

  it('synthesizes RETURN-CODE from the storage declaration when the dump omits it', () => {
    const result = run([
      '  cob_dump_output ("WORKING-STORAGE");',
      '  cob_dump_field_ext ( 1, "WS-X", COB_SET_FLD (f0, 4, b_10, &a_2), 0, 0);'
    ]);
    const rc = byName(result, 'RETURN-CODE');
    expect(rc).toMatchObject({ level: 77, size: 4, usage: 'COMP-5' });
    expect(rc.storage).toEqual({ kind: 'register', symbol: 'b_2' });
    expect(result.roots[0].itemIds).toEqual([byName(result, 'WS-X').id, rc.id]);
  });

  it('turns unknown fields and attrs into diagnostics instead of throwing', () => {
    const result = run([
      '  cob_dump_output ("WORKING-STORAGE");',
      '  cob_dump_field_ext ( 1, "WS-MISSING", &f_404, 0, 0);',
      '  cob_dump_field_ext ( 1, "WS-NOATTR", COB_SET_FLD (f0, 4, b_10, &a_404), 0, 0);',
      '  cob_dump_output ("SOMETHING-ELSE");'
    ]);
    expect(result.items.map((i) => i.name)).toEqual(['WS-NOATTR', 'RETURN-CODE']);
    expect(byName(result, 'WS-NOATTR').usage).toBe('OTHER');
    expect(result.diagnostics.map((d) => d.message)).toEqual([
      expect.stringContaining('f_404'),
      expect.stringContaining('a_404'),
      expect.stringContaining('SOMETHING-ELSE')
    ]);
  });
});
