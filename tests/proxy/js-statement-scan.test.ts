/**
 * The one question the proxy's JavaScript stepper asks of a caller's source
 * (issues #1130, #1161): can the caller suspend between the call it is
 * making returning and its next break location? Every case below is a shape
 * one of the stepper's reviews found, or a way the scan could be fooled. The
 * scan must err toward "it can": that costs a rescue, never a wrong landing.
 */
import { describe, it, expect } from 'vitest';
import { functionKind, statementCanSuspend } from '../../src/proxy/js-statement-scan.js';

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
      ['a nested async callback that awaits', 'async function f() {\n  @inner(items.map(async (i) => { await send(i); }));\n}'],
      ['an await around a spread object', 'async function f(id) {\n  const v = await {\n    ...{ a: @work(id) }\n  };\n}'],
      ['an await before an object argument that closes on its own line', 'async function f(id) {\n  const v = await wrap(function () {\n    return 1;\n  }\n  , @work(id));\n}'],
      ['an await before an arrow argument', 'async function f(id) {\n  const v = await both(() => {\n    return 1;\n  }, @work(id));\n}'],
      ['a line that ends in await', 'async function f(id) {\n  const v = await\n    @work(id);\n}']
    ])('%s', (_what, source) => {
      expect(suspends(source)).toBe(true);
    });
  });

  describe('an async generator', () => {
    it('awaits the value it returns: a return of the call can suspend', () => {
      const { lines, line, column } = at('async function* g(id) {\n  noop();\n  return @work(id);\n}');
      expect(statementCanSuspend(lines, line, column, 0, lines.length - 1, { asyncGenerator: true })).toBe(true);
      expect(statementCanSuspend(lines, line, column, 0, lines.length - 1)).toBe(false);
    });

    it('reads a return that ends its line as part of the statement on the next', () => {
      const { lines, line, column } = at('async function* g(id) {\n  noop();\n  return (\n    @work(id));\n}');
      expect(statementCanSuspend(lines, line, column, 0, lines.length - 1, { asyncGenerator: true })).toBe(true);
    });
  });

  describe('a block comment', () => {
    it('is not read as code', () => {
      expect(suspends('async function f(id) {\n  /* await later */ const v = @work(id);\n}')).toBe(false);
    });
  });

  describe('errs toward "it can" where it cannot read with confidence', () => {
    it.each([
      ['a template literal with an expression', 'async function f() {\n  const got = @inner(`${id}`);\n}'],
      ['a string that does not end on its line', 'async function f() {\n  const got = @inner("a\\\n b");\n}'],
      ['a regular expression literal', 'async function f() {\n  const got = @inner(/;/.test(id));\n}'],
      ['a regular expression with slashes after a paren', 'async function f(id, s) {\n  if (s) /\\/\\//.test(s) && await use(@work(id));\n}'],
      ['a template that spans lines', 'async function f(id) {\n  const css = await `\n  .a { color: ${@work(id)}; }\n`;\n}'],
      ['a block comment that hides an await', 'async function f(id) {\n  const v = /* x */ await /* y */ @work(id);\n}'],
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

/**
 * What a function is, read from the header V8's functionLocation points at:
 * the parameter list of a function or a method, the first token of an arrow.
 * Columns below are where V8 points (measured on Node 24 for the first
 * group; the rest follow the same rule).
 */
describe('functionKind', () => {
  /** The header, with the position V8 points at marked `@` (the marker is removed). */
  function kindOf(source: string): { async: boolean; generator: boolean } | null {
    const { lines, line, column } = at(source);
    return functionKind(lines, line, column);
  }
  const plain = { async: false, generator: false };
  const isAsync = { async: true, generator: false };
  const generator = { async: false, generator: true };
  const asyncGenerator = { async: true, generator: true };

  it.each([
    ['function plainDecl@() { }', plain],
    ['const plainExpr = function @() { };', plain],
    ['const plainArrow = @() => { };', plain],
    ['async function asyncDecl@() { }', isAsync],
    ['const asyncExpr = async function @() { };', isAsync],
    ['const asyncArrow = @async () => { };', isAsync],
    ['const asyncArrowBare = @async a => { };', isAsync],
    ['function* genDecl@() { }', generator],
    ['const genExpr = function* @() { };', generator],
    ['async function* asyncGen@() { }', asyncGenerator],
    ['  method@() { }', plain],
    ['  async asyncMethod@() { }', isAsync],
    ['  *genMethod@() { }', generator],
    ['  async *asyncGenMethod@() { }', asyncGenerator],
    ['  static async staticAsync@() { }', isAsync],
    ['  get prop@() { return 1; }', plain],
    ['  objPlain@() { },', plain],
    ['  arrowProp: @async () => { }', isAsync],
    ['Module.prototype.require = function@(id) {', plain],
    ['run(function inner@() { }, async function next() { });', plain],
    ['run(function inner() { }, async function next@() { });', isAsync],
    ['  constructor@(a) { }', plain],
    ['  #secret@() { }', plain],
    ['  async #secret@() { }', isAsync],
    ['  async() { }'.replace('()', '@()'), plain]
  ])('%s', (source, expected) => {
    expect(kindOf(source)).toEqual(expected);
  });

  it.each([
    ['a string key holding a colon', "  async 'GET /users/:id'@(req) { }", isAsync],
    ['a string key holding a comma', "  async 'a,b'@(x) { }", isAsync],
    ['a computed key holding a colon', "  async [Symbol.for('a:b')]@(x) { }", isAsync],
    ['a generator with a computed key holding a comma', "  *[Symbol.for('g,h')]@() { }", generator],
    ['a static async computed key', "  static async ['s:A']@(x) { }", isAsync],
    ['an async generator computed key', '  async *[Symbol.asyncIterator]@() { }', asyncGenerator],
    ['a plain string key holding the word async', "  'async (x)'@(x) { }", plain]
  ])('a key the old read lost: %s', (_what, source, expected) => {
    expect(kindOf(source)).toEqual(expected);
  });

  it.each([
    ['a function header split across lines', 'async function\nname@(x) { }', isAsync],
    ['a generator header split across lines', 'function*\nname@() { }', generator],
    ['a comment inside the header', 'async /* the handler */ function handler@(req) { }', isAsync]
  ])('reads %s', (_what, source, expected) => {
    expect(kindOf(source)).toEqual(expected);
  });

  it('does not know a header it cannot read with confidence: a computed key with a template expression', () => {
    expect(kindOf('  async [`k${1}`]@(x) { }')).toBeNull();
  });
});
