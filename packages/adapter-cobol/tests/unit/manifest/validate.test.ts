/**
 * The structural validator over deliberately broken copies of a golden fixture
 * program (issue #759). Each invariant is violated in isolation and must show up
 * as an `error` diagnostic; the untouched fixture must validate clean.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseGeneratedC } from '../../../src/manifest/index.js';
import type { CobolDataItem, CobolProgram } from '../../../src/manifest/index.js';
import { validateProgram } from '../../../src/manifest/validate.js';

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/cobc/3.2-linux/hello-dw4');

function freshProgram(): CobolProgram {
  const manifest = parseGeneratedC({
    cPath: path.join(FIXTURE, 'hello.c'),
    lstPath: path.join(FIXTURE, 'hello-dw4.lst'),
    generator: { cobcVersion: '3.2-linux', argv: ['cobc', '-x', '-fdump=ALL'] }
  });
  return structuredClone(manifest.programs[0]);
}

function messages(program: CobolProgram): string[] {
  return validateProgram(program).map((d) => d.message);
}

function only(program: CobolProgram, predicate: (item: CobolDataItem) => boolean, what: string): CobolDataItem {
  const found = program.items.find(predicate);
  if (!found) {
    throw new Error(`fixture has no ${what}`);
  }
  return found;
}

/** An elementary item inside a group, with a real size and no OCCURS of its own. */
function nestedLeaf(program: CobolProgram): CobolDataItem {
  return only(
    program,
    (i) => i.parentId !== undefined && i.children.length === 0 && i.level < 66 && i.size > 0 && !i.occurs && i.occursDims.length === 0,
    'nested elementary item'
  );
}

describe('validateProgram', () => {
  it('accepts the golden fixture as parsed', () => {
    const program = freshProgram();
    expect(validateProgram(program)).toEqual([]);
  });

  it('reports an item whose id is not its position', () => {
    const program = freshProgram();
    program.items[3].id = 99;
    expect(messages(program)).toContain('item id 99 does not match its position 3');
  });

  it('reports a storage item with neither size nor size expression', () => {
    const program = freshProgram();
    const leaf = nestedLeaf(program);
    leaf.size = 0;
    expect(messages(program)).toContain('item has neither a size nor a size expression');
  });

  it('reports a dangling parentId and a parent that does not list its child', () => {
    const program = freshProgram();
    const leaf = nestedLeaf(program);
    const parent = program.items[leaf.parentId!];
    parent.children = parent.children.filter((id) => id !== leaf.id);
    expect(messages(program)).toContain(`parent ${parent.name} does not list this item as a child`);

    const orphaned = freshProgram();
    nestedLeaf(orphaned).parentId = 999;
    expect(messages(orphaned)).toContain('parentId 999 does not exist');
  });

  it('reports a child that does not point back to its parent', () => {
    const program = freshProgram();
    const leaf = nestedLeaf(program);
    const parent = program.items[leaf.parentId!];
    const stranger = program.roots[0].itemIds.find((id) => id !== parent.id)!;
    parent.children.push(stranger);
    expect(messages(program)).toContain(`child ${stranger} does not point back to this item`);
  });

  it('reports bytes that fall outside the parent', () => {
    const program = freshProgram();
    const leaf = nestedLeaf(program);
    const parent = program.items[leaf.parentId!];
    leaf.offset = parent.offset + parent.size;
    expect(messages(program)).toContainEqual(expect.stringMatching(/fall outside parent/));
  });

  it('reports an OCCURS extent larger than the parent', () => {
    const program = freshProgram();
    const table = only(program, (i) => i.occurs !== undefined && i.parentId !== undefined, 'OCCURS item');
    table.occurs!.max = 100_000;
    expect(messages(program)).toContainEqual(expect.stringMatching(/^OCCURS 100000 x \d+ bytes exceeds parent/));
  });

  it('reports a subscript dimension that names a non-OCCURS item', () => {
    const program = freshProgram();
    const subscripted = only(program, (i) => i.occursDims.length > 0 && !i.occurs, 'item under an OCCURS');
    const plain = program.roots[0].itemIds.find((id) => !program.items[id].occurs)!;
    subscripted.occursDims[0].itemId = plain;
    expect(messages(program)).toContain(`occurs dimension refers to ${plain}, which is not an OCCURS item`);
  });

  it('reports a REDEFINES target that is missing or at another address', () => {
    const program = freshProgram();
    const redefiner = only(program, (i) => i.redefinesItemId !== undefined, 'REDEFINES item');
    redefiner.redefinesItemId = 999;
    expect(messages(program)).toContain('redefinesItemId 999 does not exist');

    const moved = freshProgram();
    const other = only(moved, (i) => i.redefinesItemId !== undefined, 'REDEFINES item');
    const elsewhere = moved.items.find((i) => i.id !== other.id && i.level < 66 && i.offset !== other.offset)!;
    other.redefinesItemId = elsewhere.id;
    expect(messages(moved)).toContain(`REDEFINES target ${elsewhere.name} is at a different address`);
  });

  it('reports a level-88 item without a condition', () => {
    const program = freshProgram();
    const condition = only(program, (i) => i.level === 88, 'level-88 item');
    delete condition.condition;
    expect(messages(program)).toContain('level-88 item has no condition');
  });

  it('reports root ids that do not exist or are not top-level', () => {
    const program = freshProgram();
    const nested = nestedLeaf(program);
    program.roots[0].itemIds.push(999, nested.id);
    const found = messages(program);
    expect(found).toContain(`root id 999 in ${program.roots[0].section} does not exist`);
    expect(found).toContain('root item is not top-level');
    expect(validateProgram(program).find((d) => d.message === 'root item is not top-level')).toMatchObject({
      level: 'error',
      program: program.programId,
      item: nested.name
    });
  });
});
