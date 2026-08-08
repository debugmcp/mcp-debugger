import { describe, it, expect } from 'vitest';
import { assertLineContent } from '../../../src/utils/breakpoint-resolver.js';

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

  it('fails clearly when the line is beyond end of file', () => {
    const result = assertLineContent(LINES, 200, 'anything', FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.actual).toBeNull();
    expect(result.message).toContain(`line 200 of ${FILE} does not exist`);
    expect(result.message).toContain('6 lines');
  });
});
