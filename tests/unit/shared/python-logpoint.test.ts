import { describe, it, expect } from 'vitest';
import {
  extractPythonLogMessageGroups,
  validatePythonLogMessage
} from '../../../packages/shared/src/utils/python-logpoint.js';

describe('extractPythonLogMessageGroups', () => {
  it('extracts balanced brace groups with pydevd nested-brace rules', () => {
    expect(extractPythonLogMessageGroups('x={x} stale={ entry!r }')).toEqual([
      { raw: 'x', expression: 'x' },
      { raw: ' entry!r ', expression: 'entry!r' }
    ]);
    expect(extractPythonLogMessageGroups('{{literal}}')).toEqual([
      { raw: '{literal}', expression: '{literal}' }
    ]);
    expect(extractPythonLogMessageGroups("{ {'k': total} }")).toEqual([
      { raw: " {'k': total} ", expression: "{'k': total}" }
    ]);
  });

  it('drops empty and whitespace-only brace groups and ignores stray closing braces', () => {
    expect(extractPythonLogMessageGroups('empty {} blank {   } stray } ok={x}')).toEqual([
      { raw: 'x', expression: 'x' }
    ]);
    expect(extractPythonLogMessageGroups('plain message')).toEqual([]);
  });

  it('returns undefined when braces are unbalanced, matching pydevd whole-message fallback', () => {
    expect(extractPythonLogMessageGroups('open {x!r')).toBeUndefined();
    expect(extractPythonLogMessageGroups('{x!r} and {unclosed')).toBeUndefined();
  });
});

describe('validatePythonLogMessage', () => {
  describe('debugpy proof table (issue #1334)', () => {
    it.each([
      '{x}',
      '{x != 1}',
      '{items[1:3]}',
      "{d['a:b']}",
      '{(lambda v: v)(x)}',
      '{{literal}}',
      '{repr(x)}',
      '{str(x)}',
      '{ascii(x)}',
      "{format(total, '.2f')}",
      "{ {'k': total} }",
      '{lambda v: v}',
      '{y := 7}',
      "{format(repr(x), '>10')}"
    ])('accepts %s (no syntax error in debugpy)', (logMessage) => {
      expect(validatePythonLogMessage(logMessage)).toBeUndefined();
    });

    it('refuses top-level !r, !s and !a conversions with verbatim guidance and working replacements', () => {
      expect(validatePythonLogMessage('stale={entry!r}')).toBe(
        '{entry!r}: debugpy evaluates the text between braces as a Python expression, and !r is f-string syntax, not an expression; use {repr(entry)} instead.'
      );
      expect(validatePythonLogMessage('{x!r}')).toBe(
        '{x!r}: debugpy evaluates the text between braces as a Python expression, and !r is f-string syntax, not an expression; use {repr(x)} instead.'
      );
      expect(validatePythonLogMessage('{x!s}')).toBe(
        '{x!s}: debugpy evaluates the text between braces as a Python expression, and !s is f-string syntax, not an expression; use {str(x)} instead.'
      );
      expect(validatePythonLogMessage('{x!a}')).toBe(
        '{x!a}: debugpy evaluates the text between braces as a Python expression, and !a is f-string syntax, not an expression; use {ascii(x)} instead.'
      );
    });

    it('refuses top-level format specs with verbatim guidance and format() replacement', () => {
      expect(validatePythonLogMessage('{total:.2f}')).toBe(
        "{total:.2f}: debugpy evaluates the text between braces as a Python expression, and :.2f is f-string syntax, not an expression; use {format(total, '.2f')} instead."
      );
    });

    it('refuses combined top-level conversion and format spec with nested format(repr(...), ...)', () => {
      expect(validatePythonLogMessage('{x!r:>10}')).toBe(
        "{x!r:>10}: debugpy evaluates the text between braces as a Python expression, and !r:>10 is f-string syntax, not an expression; use {format(repr(x), '>10')} instead."
      );
    });
  });

  describe('top-level boundary cases', () => {
    it.each([
      '{items[1:5:2]}',
      '{matrix[1:3, 2:4]}',
      '{(items[1:3])}',
      "{d['a:b']}",
      '{d["a:b"]}',
      "{'''a:b!r'''}",
      '{"""a:b:.2f"""}',
      "{r'a:b!r'}",
      "{b'a:b'}",
      "{rb'a:b'}",
      "{f'{total:.2f}'}",
      '{f"{d["a:b"]}"}',
      '{f"{{a:b}}"}',
      '{f"{{{x}}}"}',
      '{f"\\{x}"}',
      '{f\'{x:"<4}\'}',
      '{ {k: v for k, v in pairs} }',
      '{lambda: 0}',
      '{lambda a, b=1: a + b}',
      '{lambda x: lambda y: x + y}',
      '{lambda x=lambda a: a: x}',
      '{fn if ready else lambda x: x}',
      '{x:=1}',
      '{x != "r"}',
      '{a!=r}',
      '{x # :.2f}',
      '{x # !r}',
      '{land!r}'.replace('!r', ''),
      '{minor}'
    ])('does not misclassify nested or non-format-spec constructs: %s', (logMessage) => {
      expect(validatePythonLogMessage(logMessage)).toBeUndefined();
    });

    it('catches top-level conversions and format specs after nested slices, dicts, lambdas, walrus and floats', () => {
      expect(validatePythonLogMessage('{items[1:3]!r}')).toContain('use {repr(items[1:3])} instead.');
      expect(validatePythonLogMessage("{d['a:b']:.2f}")).toContain("use {format(d['a:b'], '.2f')} instead.");
      expect(validatePythonLogMessage('{(lambda v: v)(total):.2f}')).toContain(
        "use {format((lambda v: v)(total), '.2f')} instead."
      );
      expect(validatePythonLogMessage('{(y := 3.5):.2f}')).toContain("use {format((y := 3.5), '.2f')} instead.");
      expect(validatePythonLogMessage('{1.:.2f}')).toContain("use {format(1., '.2f')} instead.");
      expect(validatePythonLogMessage('{land!r}')).toContain('use {repr(land)} instead.');
      expect(validatePythonLogMessage('{entrée!r}')).toContain('use {repr(entrée)} instead.');
    });

    it('preserves caller spacing when quoting the offending group and trims the replacement operand', () => {
      expect(validatePythonLogMessage('{ entry !r }')).toBe(
        '{ entry !r }: debugpy evaluates the text between braces as a Python expression, and !r is f-string syntax, not an expression; use {repr(entry)} instead.'
      );
    });

    it('wraps unparenthesized top-level tuples so the suggested call takes one value argument', () => {
      expect(validatePythonLogMessage('{a, b!r}')).toContain('use {repr((a, b))} instead.');
      expect(validatePythonLogMessage('{a, b:>10}')).toContain("use {format((a, b), '>10')} instead.");
      // Function call commas are at depth 1, not top-level tuples.
      expect(validatePythonLogMessage('{f(a, b)!r}')).toContain('use {repr(f(a, b))} instead.');
    });

    it('quotes format specs containing colons, hashes, quotes, empty specs and nested dynamic fields', () => {
      expect(validatePythonLogMessage('{dt:%Y-%m-%d %H:%M:%S}')).toContain(
        "use {format(dt, '%Y-%m-%d %H:%M:%S')} instead."
      );
      expect(validatePythonLogMessage('{n:#08x}')).toContain("use {format(n, '#08x')} instead.");
      expect(validatePythonLogMessage("{x:'<10}")).toContain('use {format(x, "\'<10")} instead.');
      expect(validatePythonLogMessage('{x:"\'<10}')).toContain("use {format(x, '\"\\'<10')} instead.");
      expect(validatePythonLogMessage('{total:}')).toBe(
        "{total:}: debugpy evaluates the text between braces as a Python expression, and ':' is f-string syntax, not an expression; use {format(total, '')} instead."
      );
      expect(validatePythonLogMessage('{total:.{prec}f}')).toContain(
        "use {format(total, f'.{prec}f')} instead."
      );
    });

    it('reports the first invalid group in a multi-group message', () => {
      expect(validatePythonLogMessage('ok={x} bad={entry!r} later={total:.2f}')).toContain('{entry!r}');
    });

    it('accepts uncertain or malformed expressions rather than guessing a broken replacement', () => {
      expect(validatePythonLogMessage('open {entry!r')).toBeUndefined();
      expect(validatePythonLogMessage('{(entry!r}')).toBeUndefined();
      expect(validatePythonLogMessage('{entry):.2f}')).toBeUndefined();
      expect(validatePythonLogMessage("{'unterminated:.2f}")).toBeUndefined();
      expect(validatePythonLogMessage('{!r}')).toBeUndefined();
      expect(validatePythonLogMessage('{:.2f}')).toBeUndefined();
      expect(validatePythonLogMessage('{entry=!r}')).toBeUndefined();
      expect(validatePythonLogMessage('{a + !r}')).toBeUndefined();
      expect(validatePythonLogMessage('{obj.:.2f}')).toBeUndefined();
      expect(validatePythonLogMessage('{if x: y}')).toBeUndefined();
      expect(validatePythonLogMessage('{x and:.2f}')).toBeUndefined();
      expect(validatePythonLogMessage('{lambda x!r}')).toBeUndefined();
      expect(validatePythonLogMessage('{a ! b!r}')).toBeUndefined();
      expect(validatePythonLogMessage('{a ! b:.2f}')).toBeUndefined();
      expect(validatePythonLogMessage('{x!repr}')).toBeUndefined();
    });
  });
});
