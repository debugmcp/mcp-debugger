import { describe, it, expect } from 'vitest';
import {
  assertLineContent,
  resolveStatement,
  isCommentOrBlank,
  stripTrailingComment
} from '../../../src/utils/breakpoint-resolver.js';

const FILE = '/abs/app.py';
const LINES = [
  'def total_cart():',        // 1
  '    prices = load()',      // 2
  '    total = sum(prices)',  // 3
  '    return total',         // 4
  '',                         // 5
  'def main():',              // 6
];

describe('assertLineContent', () => {
  it('passes when trimmed content matches', () => {
    const result = assertLineContent(LINES, 3, 'total = sum(prices)', FILE);
    expect(result.ok).toBe(true);
  });

  it('passes when the expectation itself has stray whitespace', () => {
    const result = assertLineContent(LINES, 3, '  total = sum(prices)  ', FILE);
    expect(result.ok).toBe(true);
  });

  it('fails with expected/actual and marked context on mismatch', () => {
    const result = assertLineContent(LINES, 4, 'total = sum(prices)', FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.actual).toBe('return total');
    expect(result.message).toContain(
      `line 4 of ${FILE} does not match expectedContent`
    );
    expect(result.message).toContain('Expected: "total = sum(prices)"');
    expect(result.message).toMatch(/Actual:\s+"return total"/);
    // context window with a > marker on the target line
    expect(result.message).toMatch(/>\s+4 \|     return total/);
    expect(result.message).toMatch(/\s+3 \|     total = sum\(prices\)/);
    expect(result.message).toContain('may have changed since you last read it');
    // assert mode must not teach the statement param
    expect(result.message).not.toContain('statement');
  });

  it('appends the statement-mode hint only when requested', () => {
    const result = assertLineContent(LINES, 4, 'total = sum(prices)', FILE, {
      statementHint: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('statement: "total = sum(prices)"');
  });

  it('passes when the expectation is a distinctive substring of the line (issue #367)', () => {
    const result = assertLineContent(LINES, 3, 'sum(prices)', FILE);
    expect(result.ok).toBe(true);
  });

  it('passes when the expectation carries a stale trailing comment (issue #367)', () => {
    const lines = ['    total = sum(prices)'];
    const result = assertLineContent(lines, 1, 'total = sum(prices)  // recompute', FILE);
    expect(result.ok).toBe(true);
  });

  it('passes full-line expectations against a line that gained a trailing comment', () => {
    const lines = ['    total = sum(prices)  # recompute'];
    const result = assertLineContent(lines, 1, 'total = sum(prices)', FILE);
    expect(result.ok).toBe(true);
  });

  it('reports how the expectation matched (issue #379)', () => {
    expect(assertLineContent(LINES, 3, 'total = sum(prices)', FILE)).toEqual({
      ok: true,
      matchQuality: 'exact',
      actual: 'total = sum(prices)'
    });
    expect(assertLineContent(LINES, 3, 'sum(prices)', FILE)).toEqual({
      ok: true,
      matchQuality: 'substring',
      actual: 'total = sum(prices)'
    });
    const gainedComment = assertLineContent(
      ['    total = sum(prices)  # recompute'], 1, 'total = sum(prices)', FILE
    );
    expect(gainedComment).toEqual({
      ok: true,
      matchQuality: 'substring',
      actual: 'total = sum(prices)  # recompute'
    });
    const staleComment = assertLineContent(
      ['    total = sum(prices)'], 1, 'total = sum(prices)  // recompute', FILE
    );
    expect(staleComment).toEqual({
      ok: true,
      matchQuality: 'comment-stripped',
      actual: 'total = sum(prices)'
    });
  });

  it('passes lines that differ only past a comment marker, but says so (issue #379)', () => {
    // The deliberate #367 trade-off: stripTrailingComment is not
    // string-literal-aware, so both sides collapse to `url = "http:`. The
    // match is accepted — but labeled comment-stripped so callers can warn
    // instead of silently reporting a clean assertion.
    const result = assertLineContent(['url = "http://b"'], 1, 'url = "http://a"', FILE);
    expect(result).toEqual({
      ok: true,
      matchQuality: 'comment-stripped',
      actual: 'url = "http://b"'
    });
  });

  it('rejects empty and whitespace-only expectations explicitly', () => {
    for (const expectation of ['', '   ', '\t']) {
      const result = assertLineContent(LINES, 3, expectation, FILE);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.actual).toBeNull();
      expect(result.message).toContain('empty or whitespace-only');
    }
  });

  it('still fails when the expectation matches nothing on the line', () => {
    const result = assertLineContent(LINES, 3, 'total = product(prices)', FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('does not match expectedContent');
  });

  it('fails clearly when the line is beyond end of file', () => {
    const result = assertLineContent(LINES, 200, 'anything', FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.actual).toBeNull();
    expect(result.message).toContain(`line 200 of ${FILE} does not exist`);
    expect(result.message).toContain('6 lines');
  });
});

describe('isCommentOrBlank', () => {
  it('rejects blank and whitespace-only anchors', () => {
    expect(isCommentOrBlank('')).toBe(true);
    expect(isCommentOrBlank('   ')).toBe(true);
  });

  it('rejects common comment prefixes', () => {
    expect(isCommentOrBlank('# compute totals')).toBe(true);
    expect(isCommentOrBlank('// compute totals')).toBe(true);
    expect(isCommentOrBlank('/* block */')).toBe(true);
    expect(isCommentOrBlank('#[derive(Debug)]')).toBe(true); // Rust attribute: non-executable
  });

  it('accepts executable statements including Rust derefs', () => {
    expect(isCommentOrBlank('total = sum(prices)')).toBe(false);
    expect(isCommentOrBlank('*guard = 5;')).toBe(false);
  });
});

describe('resolveStatement', () => {
  const DUP_LINES = [
    'def a():',                 // 1
    '    total = sum(prices)',  // 2
    '',                         // 3
    'def b():',                 // 4
    '    total = sum(prices)',  // 5
    '    return total',         // 6
    'def c():',                 // 7
    '    total = sum(prices)',  // 8
  ];

  it('resolves a unique trimmed match to its line', () => {
    const result = resolveStatement(DUP_LINES, 'return total', FILE);
    expect(result).toEqual({ ok: true, line: 6 });
  });

  it('trims the statement input before matching', () => {
    const result = resolveStatement(DUP_LINES, '   return total  ', FILE);
    expect(result).toEqual({ ok: true, line: 6 });
  });

  it('matches lines with trailing carriage returns', () => {
    const result = resolveStatement(['x = 1\r', 'y = 2\r'], 'y = 2', FILE);
    expect(result).toEqual({ ok: true, line: 2 });
  });

  it('errors on multiple matches, listing every line: content pair', () => {
    const result = resolveStatement(DUP_LINES, 'total = sum(prices)', FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain(`matches 3 lines in ${FILE}`);
    expect(result.message).toContain('2: total = sum(prices)');
    expect(result.message).toContain('5: total = sum(prices)');
    expect(result.message).toContain('8: total = sum(prices)');
    expect(result.message).toContain('nearLine');
  });

  it('uses nearLine to select the closest match, reporting every candidate (issue #379)', () => {
    const result = resolveStatement(DUP_LINES, 'total = sum(prices)', FILE, 6);
    expect(result).toEqual({ ok: true, line: 5, candidates: [2, 5, 8] });
  });

  it('breaks nearLine ties toward the lower line number', () => {
    // nearLine 3.5 is impossible; use equidistant case: matches at 2 and 8 from nearLine 5
    const lines = ['a = 1', 'x()', 'b = 2', 'c = 3', 'd = 4', 'e = 5', 'f = 6', 'x()'];
    const result = resolveStatement(lines, 'x()', FILE, 5);
    expect(result).toEqual({ ok: true, line: 2, candidates: [2, 8] });
  });

  it('omits candidates when the match was unique even with nearLine given', () => {
    const result = resolveStatement(DUP_LINES, 'return total', FILE, 4);
    expect(result).toEqual({ ok: true, line: 6 });
  });

  it('caps the multi-match listing at 20 entries', () => {
    const many = Array.from({ length: 30 }, () => '    retry()');
    const result = resolveStatement(many, 'retry()', FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('matches 30 lines');
    expect(result.message).toContain('20: retry()');
    expect(result.message).not.toContain('21: retry()');
    expect(result.message).toContain('and 10 more');
  });

  it('errors with guidance when nothing matches', () => {
    const result = resolveStatement(DUP_LINES, 'total = sum(price)', FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('not found');
    expect(result.message).toContain('whole line');
  });

  it('rejects blank and comment anchors with a clear error', () => {
    const blank = resolveStatement(DUP_LINES, '   ', FILE);
    expect(blank.ok).toBe(false);
    const comment = resolveStatement(DUP_LINES, '# compute', FILE);
    expect(comment.ok).toBe(false);
    if (comment.ok) return;
    expect(comment.message).toContain('comment or blank');
    expect(comment.message).toContain('executable statement');
  });

  it('rejects multi-line statements up front', () => {
    const result = resolveStatement(DUP_LINES, 'def b():\n    total = sum(prices)', FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('single line');
  });

  describe('substring pass (issue #367)', () => {
    const RUST_LINES = [
      'fn main() {',                                   // 1
      '    let total = compute();  // sum it up',      // 2
      '    // let total = compute();',                 // 3
      '    println!("{}", total);',                    // 4
      '}',                                             // 5
    ];

    it('resolves a unique substring match when no exact match exists', () => {
      const result = resolveStatement(RUST_LINES, 'let total = compute();', FILE);
      expect(result).toEqual({ ok: true, line: 2 });
    });

    it('resolves a distinctive partial-line substring', () => {
      const result = resolveStatement(RUST_LINES, 'println!', FILE);
      expect(result).toEqual({ ok: true, line: 4 });
    });

    it('excludes comment-only lines from substring matching', () => {
      // 'compute()' appears on line 2 (code) and line 3 (commented-out copy);
      // only the code line counts, so the match is unique.
      const result = resolveStatement(RUST_LINES, 'compute()', FILE);
      expect(result).toEqual({ ok: true, line: 2 });
    });

    it('never lets substring matches compete with an exact match', () => {
      const lines = [
        'total = 1',        // 1: substring superset of the target below
        'total',            // 2: exact match
        'subtotal = total', // 3: another substring occurrence
      ];
      const result = resolveStatement(lines, 'total', FILE);
      expect(result).toEqual({ ok: true, line: 2 });
    });

    it('errors on ambiguous substring matches, listing every line', () => {
      const lines = [
        'x = retry(a)',
        'y = retry(b)',
      ];
      const result = resolveStatement(lines, 'retry(', FILE);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.message).toContain(`matches 2 lines in ${FILE}`);
      expect(result.message).toContain('1: x = retry(a)');
      expect(result.message).toContain('2: y = retry(b)');
      expect(result.message).toContain('nearLine');
    });

    it('disambiguates substring matches with nearLine, reporting candidates', () => {
      const lines = [
        'x = retry(a)',
        'noop()',
        'y = retry(b)',
      ];
      const result = resolveStatement(lines, 'retry(', FILE, 3);
      expect(result).toEqual({ ok: true, line: 3, candidates: [1, 3] });
    });

    it('mentions substring matching in the not-found error', () => {
      const result = resolveStatement(RUST_LINES, 'does_not_exist()', FILE);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.message).toContain('not found');
      expect(result.message).toContain('substring');
    });
  });
});

describe('stripTrailingComment', () => {
  it('strips // and # trailing comments', () => {
    expect(stripTrailingComment('let x = 5;  // note').trim()).toBe('let x = 5;');
    expect(stripTrailingComment('x = 5  # note').trim()).toBe('x = 5');
  });

  it('returns the line unchanged when no comment marker is present', () => {
    expect(stripTrailingComment('let x = 5;')).toBe('let x = 5;');
  });

  it('strips at the earliest marker when both are present', () => {
    expect(stripTrailingComment('x = 1 # a // b').trim()).toBe('x = 1');
    expect(stripTrailingComment('x = 1 // a # b').trim()).toBe('x = 1');
  });

  it('is deliberately not string-literal-aware (fails safe)', () => {
    expect(stripTrailingComment('url = "http://x"').trim()).toBe('url = "http:');
  });
});
