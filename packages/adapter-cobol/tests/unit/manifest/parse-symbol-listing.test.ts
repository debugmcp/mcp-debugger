import { describe, it, expect } from 'vitest';
import { mergeListingIntoProgram, parseSymbolListing, splitPictureColumn } from '../../../src/manifest/index.js';
import type { CobolDataItem, CobolProgram } from '../../../src/manifest/index.js';

const LISTING = [
  'GnuCOBOL 3.2.0          /work/cobol/examples/call Sat Sep 19 2026 14:46:06  Page 0001',
  '',
  'LINE    PG/LN  A...B............................................................',
  '',
  '000001         IDENTIFICATION DIVISION.',
  '000002         PROGRAM-ID. CALLMAIN.',
  '000005         COPY "wsrec.cpy".',
  '000001C        01  CP-REC.',
  'GnuCOBOL 3.2.0          /work/cobol/examples/call Sat Sep 19 2026 14:46:06  Page 0002',
  '',
  'SIZE  TYPE           LVL  NAME                           PICTURE',
  '',
  '      WORKING-STORAGE SECTION',
  '',
  '00022 GROUP          01   WS-ARG-REC',
  '00004 NUMERIC        05   WS-ARG-A                       S9(9) COMP',
  '00010 ALPHANUMERIC   05   WS-ARG-NAME                    X(10)',
  '00020 GROUP          05   WS-ENTRY                       OCCURS 5',
  '00001 ALPHANUMERIC   05   WS-ITEM                        X, OCCURS 1 TO 9',
  '00008 NUMERIC        01   WS-ALT                         9(8), REDEFINES WS-RAW',
  '00007 NUMERIC EDITED 01   WS-EDIT                        ZZ9.99',
  '00008 NUMERIC        01   WS-DOUBLE                      S9(17)V9(17) COMP-2',
  '00004 INDEX          01   WS-INDEX',
  '      CONDITIONAL    88   WS-STATUS-ACTIVE',
  '',
  '',
  '0 warnings in compilation group',
  '0 errors in compilation group',
  '\fGnuCOBOL 3.2.0          /work/cobol/examples/call Sat Sep 19 2026 14:46:06  Page 0001',
  '000002         PROGRAM-ID. CALLSUB.',
  'GnuCOBOL 3.2.0          /work/cobol/examples/call Sat Sep 19 2026 14:46:06  Page 0002',
  '',
  'SIZE  TYPE           LVL  NAME                           PICTURE',
  '',
  '      LOCAL-STORAGE SECTION',
  '',
  '00006 ALPHANUMERIC   01   LS-TAG                         X(6)',
  '',
  '      LINKAGE SECTION',
  '',
  '00022 GROUP          01   LK-ARG-REC',
  '00004 NUMERIC        05   LK-A                           S9(9) COMP',
  '',
  '0 warnings in compilation group'
].join('\r\n');

describe('parseSymbolListing', () => {
  const listing = parseSymbolListing(LISTING);

  it('yields one table per program, keyed by PROGRAM-ID', () => {
    expect(listing.diagnostics).toEqual([]);
    expect(listing.programs.map((p) => p.programId)).toEqual(['CALLMAIN', 'CALLSUB']);
    expect(listing.programs[0].rows.map((r) => r.name)).toEqual([
      'WS-ARG-REC', 'WS-ARG-A', 'WS-ARG-NAME', 'WS-ENTRY', 'WS-ITEM', 'WS-ALT', 'WS-EDIT', 'WS-DOUBLE', 'WS-INDEX', 'WS-STATUS-ACTIVE'
    ]);
    expect(listing.programs[1].rows.map((r) => [r.section, r.name])).toEqual([
      ['LOCAL-STORAGE', 'LS-TAG'],
      ['LINKAGE', 'LK-ARG-REC'],
      ['LINKAGE', 'LK-A']
    ]);
  });

  it('splits size, type, level, picture, usage and clauses per row', () => {
    const rows = listing.programs[0].rows;
    expect(rows[0]).toEqual({ section: 'WORKING-STORAGE', size: 22, type: 'GROUP', level: 1, name: 'WS-ARG-REC', clauses: [] });
    expect(rows[1]).toMatchObject({ size: 4, type: 'NUMERIC', level: 5, picture: 'S9(9)', usageText: 'COMP', clauses: [] });
    expect(rows[3]).toMatchObject({ size: 20, type: 'GROUP', name: 'WS-ENTRY', clauses: ['OCCURS 5'] });
    expect(rows[3].picture).toBeUndefined();
    expect(rows[4]).toMatchObject({ picture: 'X', clauses: ['OCCURS 1 TO 9'] });
    expect(rows[5]).toMatchObject({ picture: '9(8)', clauses: ['REDEFINES WS-RAW'] });
    expect(rows[6]).toMatchObject({ type: 'NUMERIC EDITED', picture: 'ZZ9.99' });
    expect(rows[7]).toMatchObject({ picture: 'S9(17)V9(17)', usageText: 'COMP-2' });
    expect(rows[8]).toMatchObject({ type: 'INDEX', name: 'WS-INDEX' });
    expect(rows[8].picture).toBeUndefined();
    expect(rows[9]).toEqual({ section: 'WORKING-STORAGE', type: 'CONDITIONAL', level: 88, name: 'WS-STATUS-ACTIVE', clauses: [] });
  });

  it('returns no programs for text without a symbol table', () => {
    expect(parseSymbolListing('nothing here\n').programs).toEqual([]);
  });

  it('splits picture columns', () => {
    expect(splitPictureColumn('S9(5)V99')).toEqual({ picture: 'S9(5)V99', clauses: [] });
    expect(splitPictureColumn('9(4) COMP-3')).toEqual({ picture: '9(4)', usageText: 'COMP-3', clauses: [] });
    expect(splitPictureColumn('OCCURS 5')).toEqual({ clauses: ['OCCURS 5'] });
    expect(splitPictureColumn('')).toEqual({ clauses: [] });
  });
});

function makeItem(id: number, name: string, level: number, size: number, extra: Partial<CobolDataItem> = {}): CobolDataItem {
  return {
    id,
    name,
    qualifiedName: name,
    level,
    section: 'WORKING-STORAGE',
    children: [],
    storage: { kind: 'static', symbol: `b_${id}` },
    offset: 0,
    size,
    usage: 'DISPLAY',
    occursDims: [],
    flags: {},
    ...extra
  };
}

function makeProgram(items: CobolDataItem[]): CobolProgram {
  return {
    programId: 'CALLMAIN',
    cFunction: 'CALLMAIN_',
    cEntry: 'CALLMAIN',
    kind: 'program',
    isMain: true,
    sourceFileId: 0,
    generated: { c: 'main.c' },
    items,
    roots: [],
    files: [],
    procedure: { sections: [], statements: [], paragraphs: [] },
    lineMap: []
  };
}

describe('mergeListingIntoProgram', () => {
  const listing = parseSymbolListing(LISTING).programs[0];

  it('overlays pictures and usage from matching rows in order', () => {
    const program = makeProgram([
      makeItem(0, 'RETURN-CODE', 77, 4, { storage: { kind: 'register', symbol: 'b_2' } }),
      makeItem(1, 'WS-ARG-REC', 1, 22, { usage: 'GROUP' }),
      makeItem(2, 'WS-ARG-A', 5, 4, { picture: 'S9(9)', usage: 'COMP' }),
      makeItem(3, 'WS-ENTRY', 5, 4, { usage: 'GROUP', occurs: { min: 1, max: 5, elemSize: 4 } }),
      makeItem(4, 'WS-ITEM', 5, 1, { picture: 'X(1)', occurs: { min: 1, max: 9, elemSize: 1 } }),
      makeItem(5, 'WS-INDEX', 1, 4, { usage: 'COMP' })
    ]);
    const diagnostics = mergeListingIntoProgram(program, listing);
    expect(program.items[4].picture).toBe('X');
    expect(program.items[5].usage).toBe('INDEX');
    expect(program.items[1].picture).toBeUndefined();
    // Rows the dump did not produce (WS-ARG-NAME, WS-ALT, …) are skipped over silently,
    // except level-88 rows, which become placeholder conditions under the nearest variable.
    expect(program.items).toHaveLength(7);
    const placeholder = program.items[6];
    expect(placeholder).toMatchObject({
      id: 6,
      name: 'WS-STATUS-ACTIVE',
      qualifiedName: 'WS-STATUS-ACTIVE OF WS-INDEX',
      level: 88,
      parentId: 5,
      usage: 'INDEX',
      size: 4,
      condition: { values: [], raw: '' }
    });
    expect(placeholder.storage).toEqual({ kind: 'static', symbol: 'b_5' });
    expect(program.items[5].children).toEqual([6]);
    expect(diagnostics).toEqual([
      expect.objectContaining({ level: 'warn', item: 'WS-STATUS-ACTIVE', message: expect.stringContaining('VALUE') })
    ]);
  });

  it('does not duplicate a level-88 the dump already produced', () => {
    const program = makeProgram([
      makeItem(0, 'WS-INDEX', 1, 4),
      makeItem(1, 'WS-STATUS-ACTIVE', 88, 4, { parentId: 0, condition: { values: [{ lo: 'A', resolved: true }], raw: '' } })
    ]);
    program.items[0].children = [1];
    const diagnostics = mergeListingIntoProgram(program, listing);
    expect(program.items).toHaveLength(2);
    expect(diagnostics).toEqual([]);
  });

  it('reports items the listing lacks and size disagreements without throwing', () => {
    const program = makeProgram([
      makeItem(0, 'WS-ARG-REC', 1, 22, { usage: 'GROUP' }),
      makeItem(1, 'WS-ARG-A', 5, 8),
      makeItem(2, 'WS-NOT-LISTED', 5, 1)
    ]);
    const diagnostics = mergeListingIntoProgram(program, listing);
    expect(diagnostics).toEqual([
      { level: 'warn', message: 'listing size 4 differs from dumped size 8', program: 'CALLMAIN', item: 'WS-ARG-A' },
      { level: 'warn', message: 'listing has no row for level 5 WS-NOT-LISTED', program: 'CALLMAIN', item: 'WS-NOT-LISTED' }
    ]);
  });
});
