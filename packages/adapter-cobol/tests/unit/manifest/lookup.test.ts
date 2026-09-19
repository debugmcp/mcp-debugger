/**
 * Read-side helpers over a parsed program (issue #759): the branches the golden
 * fixture assertions do not reach — empty references, ancestor chains, line-map
 * rows before the first directive or past the last, and PROCEDURE sections.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseGeneratedC } from '../../../src/manifest/index.js';
import type { CobolProgram } from '../../../src/manifest/index.js';
import { ancestorsOf, findDataItems, findLineMapEntry, findProcRanges } from '../../../src/manifest/lookup.js';

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/cobc/3.2-linux/hello-dw4');

function freshProgram(): CobolProgram {
  const manifest = parseGeneratedC({
    cPath: path.join(FIXTURE, 'hello.c'),
    lstPath: path.join(FIXTURE, 'hello-dw4.lst'),
    generator: { cobcVersion: '3.2-linux', argv: ['cobc', '-x', '-fdump=ALL'] }
  });
  return structuredClone(manifest.programs[0]);
}

describe('lookup helpers', () => {
  const program = freshProgram();

  it('treats an empty or whitespace-only reference as matching nothing', () => {
    expect(findDataItems(program, '')).toEqual([]);
    expect(findDataItems(program, '   ')).toEqual([]);
  });

  it('lists ancestors nearest first, and none for a top-level item', () => {
    const child = program.items.find((i) => i.name === 'WS-ID')!;
    const chain = ancestorsOf(program, child).map((i) => i.name);
    expect(chain[0]).toBe('WS-GROUP');
    expect(chain).toHaveLength(child.qualifiedName.split(' OF ').length - 1);
    const root = program.items[program.roots[0].itemIds[0]];
    expect(ancestorsOf(program, root)).toEqual([]);
  });

  it('finds no line-map row before the first directive or past the last governed line', () => {
    const rows = program.lineMap;
    expect(rows.length).toBeGreaterThan(0);
    expect(findLineMapEntry(program, rows[0].cLine - 1)).toBeUndefined();
    expect(findLineMapEntry(program, rows[0].cLine)).toBe(rows[0]);
    const last = rows[rows.length - 1];
    expect(findLineMapEntry(program, last.cLine)).toBe(last);
    if (last.endCLine !== undefined) {
      expect(findLineMapEntry(program, last.endCLine + 1)).toBeUndefined();
    }
  });

  it('reports the enclosing section and paragraph of a source line', () => {
    const withSection = structuredClone(program);
    const paragraph = withSection.procedure.paragraphs[0];
    withSection.procedure.sections.push({
      name: 'MAIN-SECTION',
      kind: 'section',
      sourceFileId: paragraph.sourceFileId,
      startLine: paragraph.startLine,
      endLine: paragraph.endLine
    });
    const found = findProcRanges(withSection, paragraph.sourceFileId, paragraph.startLine);
    expect(found.section?.name).toBe('MAIN-SECTION');
    expect(found.paragraph?.name).toBe(paragraph.name);
    expect(findProcRanges(withSection, paragraph.sourceFileId + 1, paragraph.startLine)).toEqual({});
  });
});
