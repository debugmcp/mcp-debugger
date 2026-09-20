/**
 * Golden assertions over the real cobc output fixtures (3.2 win32, 3.2 linux, 3.1.2 linux).
 *
 * The three versions differ in spelling (`COB_SET_FLD(` vs `COB_SET_FLD (`), in whether
 * paragraphs get C labels, in whether RETURN-CODE is dumped, and in which copybooks get
 * `#line` attribution — the manifest must come out the same shape regardless.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseGeneratedC, findDataItems, findLineMapEntry, findProcRanges, COB_FLAG, hasFlag } from '../../../src/manifest/index.js';
import type { CobolDataItem, CobolManifest, CobolProgram } from '../../../src/manifest/index.js';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/cobc');

interface VersionFacts {
  dir: string;
  /** Body-function parameter carrying the first USING item (cobc numbers fields differently per version). */
  linkageSymbol: string;
  /** 3.2 emits `PARAGRAPH_<NAME>_l_<n>:` labels; 3.1.2 emits `cob_nop ();`. */
  labels: boolean;
  /** 3.1.2 attributes no `#line` to VALUE initialisation, so a data-only copybook never appears. */
  copybooks: string[];
  /** 3.1.2 writes no level-88 comments into the dump; the 88s come from the listing without VALUEs. */
  conditionValues: boolean;
}

const VERSIONS: VersionFacts[] = [
  { dir: '3.2-win32', linkageSymbol: 'b_19', labels: true, copybooks: ['procpara.cpy', 'wsrec.cpy'], conditionValues: true },
  { dir: '3.2-linux', linkageSymbol: 'b_19', labels: true, copybooks: ['procpara.cpy', 'wsrec.cpy'], conditionValues: true },
  { dir: '3.1.2-linux', linkageSymbol: 'b_10', labels: false, copybooks: ['procpara.cpy'], conditionValues: false }
];

function parseFixture(version: string, program: string, cFile: string, lstFile: string): CobolManifest {
  const dir = path.join(FIXTURES, version, program);
  return parseGeneratedC({
    cPath: path.join(dir, cFile),
    lstPath: path.join(dir, lstFile),
    generator: { cobcVersion: version, argv: ['cobc', '-x', '-fdump=ALL'] }
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

function sourceEndingWith(manifest: CobolManifest, suffix: string): CobolManifest['sources'][number] {
  const matches = manifest.sources.filter((s) => s.path.endsWith(suffix));
  if (matches.length !== 1) {
    throw new Error(`expected exactly one source ending with ${suffix}, found ${matches.length}`);
  }
  return matches[0];
}

describe.each(VERSIONS)('cobc fixtures $dir', (facts) => {
  describe('hello-dw4', () => {
    const manifest = parseFixture(facts.dir, 'hello-dw4', 'hello.c', 'hello-dw4.lst');
    const program = manifest.programs[0];

    it('is one main program with the expected identity', () => {
      expect(manifest.schemaVersion).toBe(1);
      expect(manifest.programs).toHaveLength(1);
      expect(program.programId).toBe('HELLO');
      expect(program.cFunction).toBe('HELLO_');
      expect(program.cEntry).toBe('HELLO');
      expect(program.isMain).toBe(true);
      expect(program.kind).toBe('program');
      expect(manifest.generator.dumpComments).toBe(true);
      expect(manifest.generator.cobcVersion).toBe(facts.dir);
      expect(manifest.sources).toHaveLength(1);
      expect(manifest.sources[0].kind).toBe('program');
      expect(manifest.sources[0].path.endsWith('hello.cob')).toBe(true);
      expect(program.sourceFileId).toBe(manifest.sources[0].id);
      expect(program.generated.c.endsWith('hello.c')).toBe(true);
      expect(program.generated.lst?.endsWith('hello-dw4.lst')).toBe(true);
    });

    it('reports no diagnostics beyond the listing-sourced conditions', () => {
      if (facts.conditionValues) {
        expect(manifest.diagnostics).toEqual([]);
      } else {
        expect(manifest.diagnostics.map((d) => [d.level, d.item])).toEqual([
          ['warn', 'WS-STATUS-ACTIVE'],
          ['warn', 'WS-STATUS-CLOSED']
        ]);
      }
    });

    it('yields exactly the WORKING-STORAGE roots in declaration order', () => {
      const roots = program.roots.find((r) => r.section === 'WORKING-STORAGE');
      expect(program.roots).toHaveLength(1);
      const names = (roots?.itemIds ?? []).map((id) => program.items[id].name).filter((n) => n !== 'RETURN-CODE');
      expect(names).toEqual([
        'WS-ALPHA', 'WS-U', 'WS-SCALED', 'WS-BINARY', 'WS-PACKED', 'WS-COMP5', 'WS-DOUBLE', 'WS-GROUP',
        'WS-TABLE', 'WS-COUNT', 'WS-ODO', 'WS-RAW', 'WS-ALT', 'WS-TOTAL', 'WS-IDX'
      ]);
      expect(program.items.map((i) => i.id)).toEqual(program.items.map((_, index) => index));
      expect(new Set(program.items.map((i) => i.qualifiedName)).size).toBe(program.items.length);
    });

    it('describes the elementary items from their attrs and the listing', () => {
      const alpha = item(program, 'WS-ALPHA');
      expect(alpha).toMatchObject({ level: 1, section: 'WORKING-STORAGE', size: 12, picture: 'X(12)', usage: 'DISPLAY', offset: 0 });
      expect(alpha.storage.kind).toBe('static');
      expect(alpha.storage.symbol).toMatch(/^b_\d+$/);

      expect(item(program, 'WS-U')).toMatchObject({ size: 5, picture: '9(5)', usage: 'DISPLAY' });

      const scaled = item(program, 'WS-SCALED');
      expect(scaled.attr).toEqual({ type: 0x10, digits: 7, scale: 2, flags: 0x1 });
      expect(scaled).toMatchObject({ size: 7, picture: 'S9(5)V99', usage: 'DISPLAY' });
      expect(scaled.fieldSymbol).toMatch(/^f_\d+$/);

      const binary = item(program, 'WS-BINARY');
      expect(binary.attr?.type).toBe(0x11);
      expect(binary.size).toBe(4);
      expect(hasFlag(binary.attr?.flags ?? 0, COB_FLAG.BINARY_SWAP)).toBe(true);
      expect(binary.usage).toBe('COMP');

      expect(item(program, 'WS-PACKED')).toMatchObject({ size: 5, usage: 'COMP-3' });
      expect(item(program, 'WS-PACKED').attr?.type).toBe(0x12);
      expect(item(program, 'WS-COMP5').usage).toBe('COMP-5');
      expect(item(program, 'WS-DOUBLE')).toMatchObject({ size: 8, usage: 'COMP-2' });
      expect(item(program, 'WS-DOUBLE').attr?.type).toBe(0x14);
      expect(item(program, 'WS-TOTAL')).toMatchObject({ size: 5, usage: 'COMP-3', picture: 'S9(7)V99' });
      expect(item(program, 'WS-IDX')).toMatchObject({ size: 2, usage: 'COMP', picture: '9(4)' });
    });

    it('builds the group tree with offsets and level-88 conditions', () => {
      const group = item(program, 'WS-GROUP');
      expect(group).toMatchObject({ usage: 'GROUP', size: 25, level: 1 });
      expect(group.picture).toBeUndefined();
      expect(childNames(program, group)).toEqual(['WS-ID', 'WS-NAME', 'WS-STATUS']);

      const id = item(program, 'WS-ID');
      const name = item(program, 'WS-NAME');
      const status = item(program, 'WS-STATUS');
      expect(id).toMatchObject({ offset: 0, size: 4, parentId: group.id, qualifiedName: 'WS-ID OF WS-GROUP' });
      expect(name).toMatchObject({ offset: 4, size: 20, parentId: group.id });
      expect(status).toMatchObject({ offset: 24, size: 1, parentId: group.id });
      expect(id.storage.symbol).toBe(group.storage.symbol);
      expect(status.storage.symbol).toBe(group.storage.symbol);

      expect(childNames(program, status)).toEqual(['WS-STATUS-ACTIVE', 'WS-STATUS-CLOSED']);
      const active = item(program, 'WS-STATUS-ACTIVE');
      const closed = item(program, 'WS-STATUS-CLOSED');
      expect(active).toMatchObject({ level: 88, parentId: status.id, offset: 24, size: 1, usage: 'DISPLAY' });
      expect(active.storage).toEqual(status.storage);
      if (facts.conditionValues) {
        expect(active.condition?.values).toEqual([{ lo: 'A', resolved: true, kind: 'literal' }]);
        expect(closed.condition?.values).toEqual([
          { lo: 'C', resolved: true, kind: 'literal' },
          { lo: 'X', resolved: true, kind: 'literal' }
        ]);
        expect(closed.condition?.raw).toContain('OR');
      } else {
        expect(active.condition).toEqual({ values: [], raw: '' });
        expect(closed.condition).toEqual({ values: [], raw: '' });
      }
    });

    it('records OCCURS tables with subscript dimensions', () => {
      const table = item(program, 'WS-TABLE');
      const entry = item(program, 'WS-ENTRY');
      const amount = item(program, 'WS-AMOUNT');
      expect(childNames(program, table)).toEqual(['WS-ENTRY']);
      expect(entry.occurs).toEqual({ min: 1, max: 5, elemSize: 4 });
      expect(entry.occursDims).toEqual([{ itemId: entry.id, elemSize: 4, max: 5 }]);
      expect(amount.parentId).toBe(entry.id);
      expect(amount.occurs).toBeUndefined();
      expect(amount.occursDims).toEqual([{ itemId: entry.id, elemSize: 4, max: 5 }]);
      expect(amount).toMatchObject({ size: 4, picture: '9(4)', offset: 0 });
    });

    it('records OCCURS DEPENDING ON with the depending item resolved', () => {
      const count = item(program, 'WS-COUNT');
      const odo = item(program, 'WS-ODO');
      const odoItem = item(program, 'WS-ITEM');
      expect(count).toMatchObject({ size: 1, picture: '9' });
      expect(odo.sizeExpr).toMatch(/cob_get_numdisp/);
      expect(odo.size).toBe(9);
      expect(odoItem.occurs).toMatchObject({ min: 1, max: 9, elemSize: 1, dependingOnItemId: count.id });
      expect(odoItem.occurs?.dependingExpr).toMatch(/cob_get_numdisp/);
      expect(odoItem.occursDims).toEqual([{ itemId: odoItem.id, elemSize: 1, max: 9 }]);
    });

    it('links REDEFINES to the redefined sibling', () => {
      const raw = item(program, 'WS-RAW');
      const alt = item(program, 'WS-ALT');
      expect(raw).toMatchObject({ size: 8, picture: 'X(8)' });
      expect(alt).toMatchObject({ size: 8, picture: '9(8)', redefinesItemId: raw.id });
      expect(alt.storage).toEqual(raw.storage);
      expect(alt.offset).toBe(raw.offset);
      expect(raw.redefinesItemId).toBeUndefined();
    });

    it('exposes RETURN-CODE as a level-77 register in every version', () => {
      const rc = item(program, 'RETURN-CODE');
      expect(rc).toMatchObject({ level: 77, size: 4, usage: 'COMP-5', section: 'WORKING-STORAGE' });
      expect(rc.storage.kind).toBe('register');
      expect(rc.storage.symbol).toMatch(/^b_\d+$/);
    });

    it('maps paragraphs to their source lines', () => {
      const paragraphs = program.procedure.paragraphs;
      expect(paragraphs.map((p) => [p.name, p.startLine])).toEqual([
        ['0000-MAIN', 31],
        ['1000-INIT', 36],
        ['2000-COMPUTE', 41],
        ['3000-REPORT', 47]
      ]);
      expect(paragraphs.map((p) => p.endLine)).toEqual([35, 40, 46, 49]);
      expect(paragraphs.every((p) => p.sourceFileId === program.sourceFileId)).toBe(true);
      expect(program.procedure.sections).toEqual([]);
      expect(program.procedureDivisionLine).toBe(31);
      if (facts.labels) {
        expect(paragraphs[1].cLabel).toBe('PARAGRAPH_1000__INIT_l_5');
      } else {
        expect(paragraphs[1].cLabel).toBeUndefined();
      }
      // The `l_N` label id a PERFORM frame's perform_through names. 3.2 spells it in every range
      // label; 3.1.2 emits `l_N:` only for a jump target, so the entry paragraph has none there.
      expect(paragraphs.slice(1).map((p) => p.labelId)).toEqual([5, 6, 7]);
      expect(paragraphs[0].labelId).toBe(facts.labels ? 4 : undefined);
    });

    it('records the #line map with COBOL rows only', () => {
      const row37 = program.lineMap.find((r) => r.line === 37);
      expect(row37).toBeDefined();
      expect(row37?.sourceFileId).toBe(program.sourceFileId);
      expect(program.lineMap.every((r) => r.cLine > 0 && (r.endCLine ?? r.cLine) >= r.cLine)).toBe(true);
      const cLines = program.lineMap.map((r) => r.cLine);
      expect([...cLines].sort((a, b) => a - b)).toEqual(cLines);
      // The row's own generated line maps back to it; the self-reset line after it does not.
      expect(findLineMapEntry(program, row37?.cLine ?? 0)).toBe(row37);
      expect(findLineMapEntry(program, (row37?.endCLine ?? 0) + 1)).toBeUndefined();
      expect(findProcRanges(program, program.sourceFileId, 37).paragraph?.name).toBe('1000-INIT');
    });

    it('resolves qualified data references', () => {
      expect(findDataItems(program, 'WS-ID OF WS-GROUP').map((i) => i.id)).toEqual([item(program, 'WS-ID').id]);
      expect(findDataItems(program, 'ws-amount in ws-table')).toHaveLength(1);
      expect(findDataItems(program, 'WS-ID OF WS-TABLE')).toEqual([]);
      expect(findDataItems(program, 'NOPE')).toEqual([]);
      expect(findDataItems(program, 'WS-ID   OF\tWS-GROUP')).toHaveLength(1);
      // Two names with no qualifier keyword between them, or a dangling keyword, are not references.
      expect(findDataItems(program, 'WS-ID WS-GROUP')).toEqual([]);
      expect(findDataItems(program, 'OF WS-GROUP')).toEqual([]);
      expect(findDataItems(program, 'WS-ID OF')).toEqual([]);
    });
  });

  describe('calls', () => {
    const main = parseFixture(facts.dir, 'calls', 'main.c', 'calls.lst');
    const sub = parseFixture(facts.dir, 'calls', 'sub.c', 'calls.lst');

    it('parses the caller as the main program', () => {
      expect(main.programs).toHaveLength(1);
      expect(main.programs[0]).toMatchObject({ programId: 'CALLMAIN', isMain: true, cFunction: 'CALLMAIN_', cEntry: 'CALLMAIN' });
      expect(item(main.programs[0], 'WS-ARG-REC').size).toBe(22);
      expect(main.diagnostics).toEqual([]);
    });

    it('parses the callee with LOCAL-STORAGE and LINKAGE sections', () => {
      expect(sub.programs).toHaveLength(1);
      const program = sub.programs[0];
      expect(program).toMatchObject({ programId: 'CALLSUB', isMain: false, cFunction: 'CALLSUB_', cEntry: 'CALLSUB' });
      expect(sub.diagnostics).toEqual([]);

      const tag = item(program, 'LS-TAG');
      expect(tag).toMatchObject({ section: 'LOCAL-STORAGE', offset: 16, size: 6, picture: 'X(6)' });
      expect(tag.storage).toEqual({ kind: 'local', symbol: 'cob_local_ptr' });
      const work = item(program, 'LS-WORK');
      expect(work.storage).toEqual({ kind: 'local', symbol: 'cob_local_ptr' });
      expect(work).toMatchObject({ offset: 0, size: 4, usage: 'COMP' });

      const rec = item(program, 'LK-ARG-REC');
      expect(rec).toMatchObject({ section: 'LINKAGE', size: 22, usage: 'GROUP', offset: 0 });
      expect(rec.storage).toEqual({ kind: 'linkage', symbol: facts.linkageSymbol });
      expect(childNames(program, rec)).toEqual(['LK-A', 'LK-B', 'LK-SUM', 'LK-NAME']);
      expect(item(program, 'LK-A')).toMatchObject({ offset: 0, size: 4 });
      expect(item(program, 'LK-B')).toMatchObject({ offset: 4, size: 4 });
      expect(item(program, 'LK-SUM')).toMatchObject({ offset: 8, size: 4 });
      expect(item(program, 'LK-NAME')).toMatchObject({ offset: 12, size: 10 });
      expect(item(program, 'LK-NAME').storage.kind).toBe('linkage');

      const sections = program.roots.map((r) => r.section);
      expect(sections).toEqual(expect.arrayContaining(['WORKING-STORAGE', 'LOCAL-STORAGE', 'LINKAGE']));
      expect(program.roots.find((r) => r.section === 'LINKAGE')?.itemIds).toEqual([rec.id]);
      expect(program.roots.find((r) => r.section === 'LOCAL-STORAGE')?.itemIds).toEqual([work.id, tag.id]);
      expect(program.procedure.paragraphs.map((p) => [p.name, p.startLine, p.endLine])).toEqual([['0000-SUB-MAIN', 14, 18]]);
    });
  });

  describe('copybook', () => {
    const manifest = parseFixture(facts.dir, 'copybook', 'main.c', 'copybook.lst');
    const program = manifest.programs[0];

    it('lists the program source and every copybook that received #line attribution', () => {
      expect(manifest.diagnostics).toEqual([]);
      expect(manifest.sources).toHaveLength(1 + facts.copybooks.length);
      expect(sourceEndingWith(manifest, 'main.cob').kind).toBe('program');
      expect(sourceEndingWith(manifest, 'main.cob').id).toBe(program.sourceFileId);
      for (const copybook of facts.copybooks) {
        expect(sourceEndingWith(manifest, copybook).kind).toBe('copybook');
      }
    });

    it('attributes the copybook paragraph to the copybook file', () => {
      const paragraph = program.procedure.paragraphs.find((p) => p.name === '9000-FROM-COPYBOOK');
      expect(paragraph).toMatchObject({ sourceFileId: sourceEndingWith(manifest, 'procpara.cpy').id, startLine: 1, endLine: 3 });
      const mainParagraph = program.procedure.paragraphs.find((p) => p.name === '0000-MAIN');
      expect(mainParagraph).toMatchObject({ sourceFileId: program.sourceFileId, startLine: 8, endLine: 12 });
      expect(program.procedureDivisionLine).toBe(8);
    });

    it('parses the copybook data items', () => {
      const rec = item(program, 'CP-REC');
      expect(childNames(program, rec)).toEqual(['CP-CODE', 'CP-QTY', 'CP-PRICE']);
      expect(item(program, 'CP-QTY')).toMatchObject({ usage: 'COMP-3', picture: '9(4)', size: 3, offset: 3 });
      expect(item(program, 'CP-PRICE')).toMatchObject({ picture: 'S9(5)V99', offset: 6, size: 7 });
      expect(item(program, 'WS-DONE')).toMatchObject({ size: 1, picture: 'X' });
    });
  });

  describe('dyn-mod1', () => {
    const manifest = parseFixture(facts.dir, 'dyn-mod1', 'mod1.c', 'dyn-mod1.lst');

    it('parses a -m module with only LINKAGE', () => {
      expect(manifest.diagnostics).toEqual([]);
      expect(manifest.programs).toHaveLength(1);
      const program = manifest.programs[0];
      expect(program).toMatchObject({ programId: 'MOD1', isMain: false, kind: 'program', cFunction: 'MOD1_', cEntry: 'MOD1' });
      const value = item(program, 'LK-VALUE');
      expect(value).toMatchObject({ section: 'LINKAGE', size: 4, usage: 'COMP', picture: 'S9(9)', offset: 0 });
      expect(value.storage.kind).toBe('linkage');
      expect(value.storage.symbol).toMatch(/^b_\d+$/);
      expect(program.roots.find((r) => r.section === 'LINKAGE')?.itemIds).toEqual([value.id]);
    });
  });

  describe('rterror', () => {
    const manifest = parseFixture(facts.dir, 'rterror', 'rterror.c', 'rterror.lst');

    it('parses an elementary OCCURS item', () => {
      expect(manifest.diagnostics).toEqual([]);
      const program = manifest.programs[0];
      const table = item(program, 'WS-TABLE');
      const cell = item(program, 'WS-CELL');
      expect(table.size).toBe(9);
      expect(cell.occurs).toEqual({ min: 1, max: 3, elemSize: 3 });
      expect(cell).toMatchObject({ parentId: table.id, size: 3, picture: '9(3)' });
      expect(cell.occursDims).toEqual([{ itemId: cell.id, elemSize: 3, max: 3 }]);
      expect(program.procedure.paragraphs).toEqual([
        expect.objectContaining({ name: '0000-MAIN', startLine: 10, endLine: 15 })
      ]);
    });
  });
});

describe('parseGeneratedC file handling', () => {
  it('reads through an injected reader and reports unreadable optional files as diagnostics', () => {
    const dir = path.join(FIXTURES, '3.2-linux', 'hello-dw4');
    const reads: string[] = [];
    const manifest = parseGeneratedC({
      cPath: path.join(dir, 'hello.c'),
      generator: { cobcVersion: '3.2', argv: [] },
      readFile: (p) => {
        reads.push(path.basename(p));
        if (p.endsWith('.c.l.h')) {
          throw new Error('nope');
        }
        return readFileSync(p, 'latin1');
      }
    });
    expect(reads).toEqual(['hello.c', 'hello.c.h', 'hello.c.l.h']);
    expect(manifest.diagnostics.some((d) => d.message.includes('cannot read .c.l.h'))).toBe(true);
    // Without the .c.l.h, `&f_N` items cannot be resolved but COB_SET_FLD items still are.
    const program = manifest.programs[0];
    expect(program.items.some((i) => i.name === 'WS-ALPHA')).toBe(true);
    expect(program.items.some((i) => i.name === 'WS-SCALED')).toBe(false);
    expect(manifest.diagnostics.some((d) => d.item === 'WS-SCALED')).toBe(true);
    // Only the files that were read are recorded as inputs.
    expect(program.generated.h?.endsWith('hello.c.h')).toBe(true);
    expect(program.generated.lh).toBeUndefined();
    expect(program.generated.lst).toBeUndefined();
  });
});
