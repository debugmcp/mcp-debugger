/**
 * Golden assertions over `examples/cobol/shapes.cob` compiled with `-std=ibm --tlines=0`
 * by GnuCOBOL 3.2 (win32 + linux) and 3.1.2 (linux) — the data shapes the #760 review
 * found unpinned: INDEXED BY index-names (level-0 dump calls), an FD with two record
 * layouts, LOCAL-STORAGE group subordinates (no address in the dump), an ODO table under
 * odoslide (`(cob_uli_t)(2)` element sizes), referenced EXTERNAL and BASED items
 * (`COB_SET_DATA`), an edited picture with a comma, a 35-character name (the listing prints
 * 30), a lower-case PROGRAM-ID, and a listing whose paged form crosses a page boundary.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseGeneratedC, findDataItems } from '../../../src/manifest/index.js';
import type { CobolDataItem, CobolManifest, CobolProgram } from '../../../src/manifest/index.js';
import { parseSymbolListing } from '../../../src/manifest/parse-symbol-listing.js';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/cobc');
const VERSIONS = ['3.2-win32', '3.2-linux', '3.1.2-linux'] as const;

function parseShapes(version: string): CobolManifest {
  const dir = path.join(FIXTURES, version, 'shapes');
  return parseGeneratedC({
    cPath: path.join(dir, 'shapes.c'),
    lstPath: path.join(dir, 'shapes.lst'),
    generator: { cobcVersion: version, argv: ['cobc', '-x', '-fdump=ALL', '-std=ibm', '--tlines=0'] }
  });
}

function item(program: CobolProgram, name: string): CobolDataItem {
  const matches = program.items.filter((i) => i.name === name);
  if (matches.length !== 1) {
    throw new Error(`expected exactly one item named ${name}, found ${matches.length}`);
  }
  return matches[0];
}

function childNames(program: CobolProgram, parent: CobolDataItem): string[] {
  return parent.children.map((id) => program.items[id].name);
}

describe.each(VERSIONS)('shapes fixture %s', (version) => {
  const manifest = parseShapes(version);
  const program = manifest.programs[0];

  it('parses one program, upper-cased, with no diagnostics', () => {
    expect(manifest.programs).toHaveLength(1);
    expect(program.programId).toBe('SHAPES');
    expect(program.cFunction).toBe('shapes_');
    expect(manifest.diagnostics).toEqual([]);
  });

  it('keeps an INDEXED BY table under its group and lists the index-name as its own root', () => {
    const table = item(program, 'WS-TABLE');
    expect(childNames(program, table)).toEqual(['WS-ENTRY']);
    const entry = item(program, 'WS-ENTRY');
    expect(entry.occurs).toEqual({ min: 1, max: 5, elemSize: 6 });
    expect(childNames(program, entry)).toEqual(['WS-AMOUNT', 'WS-CODE']);
    const amount = item(program, 'WS-AMOUNT');
    expect(amount.occursDims).toEqual([{ itemId: entry.id, elemSize: 6, max: 5 }]);
    expect(amount.storage.symbol).toBe(table.storage.symbol);
    expect(findDataItems(program, 'WS-AMOUNT OF WS-TABLE')).toHaveLength(1);

    const index = item(program, 'WS-IX');
    expect(index.level).toBe(0);
    expect(index.parentId).toBeUndefined();
    expect(index.children).toEqual([]);
    expect(index.storage.kind).toBe('register');
    expect(index.size).toBe(4);
    const ws = program.roots.find((r) => r.section === 'WORKING-STORAGE')!;
    // 3.2 dumps RETURN-CODE first; 3.1.2 does not dump it at all.
    const names = ws.itemIds.map((id) => program.items[id].name).filter((n) => n !== 'RETURN-CODE');
    expect(names.slice(0, 3)).toEqual(['WS-TABLE', 'WS-IX', 'WS-COUNT']);
  });

  it('reads the element size of items inside an ODO table under odoslide', () => {
    const row = item(program, 'WS-ROW');
    expect(row.occurs).toMatchObject({ min: 1, max: 9, elemSize: 2, dependingOnItemId: item(program, 'WS-COUNT').id });
    const col = item(program, 'WS-COL');
    expect(col.occursDims).toEqual([{ itemId: row.id, elemSize: 2, max: 9 }]);
    expect(col.size).toBe(2);
  });

  it('derives LOCAL-STORAGE subordinate addresses from the group layout', () => {
    const group = item(program, 'LS-G');
    expect(group.storage).toEqual({ kind: 'local', symbol: 'cob_local_ptr' });
    expect(group.offset).toBe(16);
    expect(group.sizeExpr).toBeDefined();
    expect(group.size).toBe(14);
    expect(childNames(program, group)).toEqual(['LS-G1', 'LS-G2', 'LS-COUNT', 'LS-TBL']);
    const offsets = group.children.map((id) => [program.items[id].name, program.items[id].storage.kind, program.items[id].offset]);
    expect(offsets).toEqual([
      ['LS-G1', 'local', 16],
      ['LS-G2', 'local', 18],
      ['LS-COUNT', 'local', 20],
      ['LS-TBL', 'local', 21]
    ]);
    const table = item(program, 'LS-TBL');
    expect(table.occurs).toMatchObject({ min: 1, max: 3, elemSize: 3, dependingOnItemId: item(program, 'LS-COUNT').id });
    expect(item(program, 'LS-A')).toMatchObject({ storage: { kind: 'local', symbol: 'cob_local_ptr' }, offset: 0, size: 4 });
  });

  it('records referenced EXTERNAL and BASED items through their runtime pointers', () => {
    const external = item(program, 'WS-EXT');
    expect(external.storage.kind).toBe('linkage');
    expect(external.size).toBe(10);
    expect(external.flags.external).toBe(true);
    const based = item(program, 'WS-BASED');
    expect(based.storage.kind).toBe('linkage');
    expect(based.size).toBe(4);
    expect(based.flags.based).toBe(true);
  });

  it('models a two-layout FD as a record area redefined by each 01 record', () => {
    const file = program.files.find((f) => f.name === 'REC-FILE')!;
    const record = item(program, 'REC-FILE RECORD');
    expect(record.level).toBe(0);
    expect(record.section).toBe('FILE');
    expect(record.size).toBe(24);
    expect(file.recordItemIds).toContain(record.id);
    const a = item(program, 'REC-A');
    const b = item(program, 'REC-B');
    expect(a.parentId).toBeUndefined();
    expect(a.redefinesItemId).toBe(record.id);
    expect(b.redefinesItemId).toBe(record.id);
    expect(childNames(program, a)).toEqual(['REC-A-KEY', 'REC-A-BODY']);
    expect(item(program, 'REC-B-AMOUNT')).toMatchObject({ offset: 4, size: 8, storage: { symbol: record.storage.symbol } });
  });

  it('takes pictures from the listing past a comma and a 30-column name', () => {
    expect(item(program, 'WS-EDITED').picture).toBe('ZZ,ZZ9.99');
    expect(item(program, 'WS-A-VERY-LONG-DATA-NAME-OF-THIRTY-FIVE').picture).toBe('X(3)');
    expect(item(program, 'WS-F40').picture).toBe('9(2)');
  });

  it('records every PROCEDURE DIVISION statement location', () => {
    const statements = program.procedure.statements;
    const own = statements.filter((s) => s.sourceFileId === program.sourceFileId);
    expect(own.length).toBeGreaterThanOrEqual(15);
    expect(own.map((s) => s.verb)).toContain('MOVE');
    expect(own.map((s) => s.verb)).toContain('DISPLAY');
    expect(own.some((s) => s.verb === 'SET' && s.line === 93)).toBe(true);
    expect(own.every((s) => s.line >= program.procedureDivisionLine!)).toBe(true);
    expect(program.procedure.paragraphs.map((p) => p.name)).toEqual(['0000-MAIN']);
  });
});

describe('paged listing (default --tlines)', () => {
  it('keeps one symbol table across cobc page breaks', () => {
    const text = readFileSync(path.join(FIXTURES, '3.2-win32', 'shapes', 'shapes-paged.lst'), 'latin1');
    const listing = parseSymbolListing(text);
    expect(listing.programs).toHaveLength(1);
    const rows = listing.programs[0].rows;
    expect(listing.programs[0].programId).toBe('SHAPES');
    expect(rows.map((r) => r.name)).toContain('WS-F01');
    expect(rows.map((r) => r.name)).toContain('LS-TBL');
    const unpaged = parseSymbolListing(readFileSync(path.join(FIXTURES, '3.2-win32', 'shapes', 'shapes.lst'), 'latin1'));
    expect(rows).toEqual(unpaged.programs[0].rows);
  });
});
