/**
 * The one question the proxy's JavaScript stepper asks of a caller's source
 * (issues #1130, #1161): can the caller suspend between the call it is
 * making returning and its next break location? Every case below is a shape
 * one of the stepper's reviews found, or a way the scan could be fooled. The
 * scan must err toward "it can": that costs a rescue, never a wrong landing.
 */
import { describe, it, expect } from 'vitest';
import { statementCanSuspend } from '../../src/proxy/js-statement-scan.js';

/** The source, and the 0-based line and column of the call marked `@` (the marker is removed). */
function at(source: string): { lines: string[]; line: number; column: number } {
  const lines = source.split('\n');
  const line = lines.findIndex((text) => text.includes('@'));
  const column = lines[line].indexOf('@');
  lines[line] = lines[line].replace('@', '');
  return { lines, line, column };
}

function suspends(source: string): boolean {
  const { lines, line, column } = at(source);
  return statementCanSuspend(lines, line, column, 0, lines.length - 1);
}

describe('statementCanSuspend', () => {
  describe('a statement that does not await: the caller reaches a break location first', () => {
    it.each([
      ['a plain call', 'async function f() {\n  const got = @inner(id);\n  return got;\n}'],
      ['a call whose line has a comment about await', 'async function f() {\n  const got = @inner(id); // after the await\n}'],
      ['a comment about await on the line before', 'async function f() {\n  const a = 1; // MARK: after the await\n  const lazy = @require("./lazy.cjs");\n}'],
      ['await in a string', 'async function f() {\n  const got = @inner("await me");\n}'],
      ['an await in an earlier statement', 'async function f() {\n  await ready;\n  const got = @inner(id);\n}'],
      ['an await in a later statement', 'async function f() {\n  const got = @inner(id);\n  await done(got);\n}'],
      ['no semicolons, an await on the next statement', 'async function f() {\n  const got = @inner(id)\n  const more = await other(got)\n}'],
      ['no semicolons, an await on the statement before', 'async function f() {\n  const first = await other()\n  const got = @inner(id)\n}'],
      ['an await inside the block before', 'async function f() {\n  try {\n    await a;\n  } finally {\n    b();\n  }\n  const got = @inner(id);\n}'],
      ['an object literal around the call', 'async function f() {\n  const o = {\n    a: @inner(id),\n    b: 2\n  };\n}'],
      ['the call inside an if', 'async function f() {\n  if (ok) {\n    @inner(id);\n  }\n  await later;\n}']
    ])('%s', (_what, source) => {
      expect(suspends(source)).toBe(false);
    });
  });

  describe('a statement that can suspend before its next break location', () => {
    it.each([
      ['the call awaited', 'async function f() {\n  const got = await @inner(id);\n}'],
      ['returned awaited', 'async function f() {\n  return await @inner(id);\n}'],
      ['awaited through a member chain on the next line', 'async function f() {\n  const got = await api\n    .@inner(id);\n}'],
      ['awaited on the line above the argument', 'async function f() {\n  const total = await fetchA(\n    id,\n    @compute(id));\n}'],
      ['an await later in the statement', 'async function f() {\n  const v = @inner(id) + await other();\n}'],
      ['an await in a sibling argument', 'async function f() {\n  use(@inner(id), await other(id));\n}'],
      ['an await in a multi-line object around the call', 'async function f() {\n  return {\n    user: await getUser(id),\n    posts: @inner(id),\n  };\n}'],
      ['a yield', 'function* g() {\n  const got = yield @inner(id);\n}'],
      ['a for await loop anywhere in the function', 'async function f() {\n  for await (const x of xs) {\n    @inner(x);\n  }\n}'],
      ['an await using anywhere in the function', 'async function f() {\n  await using h = open();\n  @inner(1);\n}'],
      ['a nested async callback that awaits', 'async function f() {\n  @inner(items.map(async (i) => { await send(i); }));\n}']
    ])('%s', (_what, source) => {
      expect(suspends(source)).toBe(true);
    });
  });

  describe('errs toward "it can" where it cannot read with confidence', () => {
    it.each([
      ['a template literal with an expression', 'async function f() {\n  const got = @inner(`${id}`);\n}'],
      ['a string that does not end on its line', 'async function f() {\n  const got = @inner("a\\\n b");\n}'],
      ['a regular expression literal', 'async function f() {\n  const got = @inner(/;/.test(id));\n}'],
      ['a call outside the function', 'const got = @inner(id);']
    ])('%s', (_what, source) => {
      const { lines, line, column } = at(source);
      const outside = _what === 'a call outside the function';
      expect(statementCanSuspend(lines, line, column, outside ? line + 1 : 0, lines.length - 1)).toBe(true);
    });

    it('a statement longer than it will scan', () => {
      const body = Array.from({ length: 60 }, (_, i) => `    arg${i},`).join('\n');
      expect(suspends(`async function f() {\n  const got = use(\n${body}\n    @inner(id));\n}`)).toBe(true);
    });
  });
});
