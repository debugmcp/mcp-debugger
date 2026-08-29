import { describe, expect, it } from 'vitest';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain-JS module without type declarations
import { compare, parseDiagnostics, verdict } from '../../../scripts/typecheck-tests-ratchet.mjs';

/**
 * A repo root that is genuinely absolute on whichever platform runs this:
 * `C:\repo` on Windows, `/repo` on Linux CI.
 */
const ROOT: string = path.resolve('/repo');

/** Build the `file -> diagnostic lines` map `compare` consumes, from plain counts. */
function withCounts(counts: Record<string, number>): Map<string, string[]> {
  return new Map(
    Object.entries(counts).map(([file, count]): [string, string[]] => [
      file,
      Array.from({ length: count }, (_unused, index) => `${file}(${index + 1},1): error TS2345: x`)
    ])
  );
}

interface CompareCase {
  name: string;
  now: Record<string, number>;
  baseline: Record<string, number>;
  regressed: string[];
  improved: string[];
}

const COMPARE_CASES: CompareCase[] = [
  {
    name: 'a file with no baseline entry regresses as soon as it has any error',
    now: { 'a.test.ts': 1 },
    baseline: {},
    regressed: ['a.test.ts'],
    improved: []
  },
  {
    name: 'a baselined file that vanished reads as an improvement, not a regression',
    now: {},
    baseline: { 'a.test.ts': 3 },
    regressed: [],
    improved: ['a.test.ts']
  },
  {
    name: 'an unchanged count is neither',
    now: { 'a.test.ts': 3 },
    baseline: { 'a.test.ts': 3 },
    regressed: [],
    improved: []
  },
  {
    name: 'a count that went up regresses',
    now: { 'a.test.ts': 4 },
    baseline: { 'a.test.ts': 3 },
    regressed: ['a.test.ts'],
    improved: []
  },
  {
    name: 'a count that went down improves',
    now: { 'a.test.ts': 2 },
    baseline: { 'a.test.ts': 3 },
    regressed: [],
    improved: ['a.test.ts']
  },
  {
    name: 'moving errors between files is caught on the file that gained them',
    now: { 'a.test.ts': 1, 'b.test.ts': 5 },
    baseline: { 'a.test.ts': 5, 'b.test.ts': 1, 'c.test.ts': 2 },
    regressed: ['b.test.ts'],
    improved: ['a.test.ts', 'c.test.ts']
  }
];

describe('compare', () => {
  for (const testCase of COMPARE_CASES) {
    it(testCase.name, () => {
      expect(compare(withCounts(testCase.now), testCase.baseline)).toEqual({
        regressed: testCase.regressed,
        improved: testCase.improved
      });
    });
  }
});

interface VerdictCase {
  name: string;
  regressed: string[];
  improved: string[];
  strict: boolean;
  expected: string;
}

const VERDICT_CASES: VerdictCase[] = [
  { name: 'clean run passes locally', regressed: [], improved: [], strict: false, expected: 'ok' },
  { name: 'clean run passes in CI', regressed: [], improved: [], strict: true, expected: 'ok' },
  {
    name: 'new errors fail locally',
    regressed: ['a.test.ts'], improved: [], strict: false, expected: 'regressed'
  },
  {
    name: 'new errors fail in CI',
    regressed: ['a.test.ts'], improved: [], strict: true, expected: 'regressed'
  },
  {
    name: 'a shrunken count is only a hint locally',
    regressed: [], improved: ['a.test.ts'], strict: false, expected: 'ok'
  },
  {
    name: 'a shrunken count is a stale baseline in CI',
    regressed: [], improved: ['a.test.ts'], strict: true, expected: 'stale'
  },
  {
    name: 'new errors are reported ahead of a stale baseline',
    regressed: ['b.test.ts'], improved: ['a.test.ts'], strict: true, expected: 'regressed'
  }
];

describe('verdict', () => {
  for (const testCase of VERDICT_CASES) {
    it(testCase.name, () => {
      const comparison = { regressed: testCase.regressed, improved: testCase.improved };
      expect(verdict(comparison, testCase.strict)).toBe(testCase.expected);
    });
  }
});

describe('parseDiagnostics', () => {
  it('keys diagnostics by a repo-relative, forward-slash path', () => {
    // On Windows this is a drive-letter path with backslashes; on Linux, a POSIX path.
    const file: string = path.join(ROOT, 'tests', 'unit', 'a.test.ts');
    const parsed = parseDiagnostics(`${file}(3,4): error TS2345: nope`, ROOT);

    expect([...parsed.keys()]).toEqual(['tests/unit/a.test.ts']);
  });

  it('normalises backslash separators even where the platform separator is /', () => {
    const parsed = parseDiagnostics(
      'tests\\unit\\b.test.ts(1,1): error TS7006: nope',
      ROOT
    );

    expect([...parsed.keys()]).toEqual(['tests/unit/b.test.ts']);
  });

  it('ignores related-information lines, which carry no error token', () => {
    const output: string = [
      'tests/unit/a.test.ts(3,4): error TS2345: Argument of type X is not assignable.',
      "  tests/unit/a.test.ts(9,1): The expected type comes from property 'y'.",
      '  Type X is not assignable to type Y.'
    ].join('\n');

    const parsed = parseDiagnostics(output, ROOT);

    expect(parsed.get('tests/unit/a.test.ts')).toHaveLength(1);
  });

  it('keeps a path that itself contains parentheses', () => {
    const parsed = parseDiagnostics(
      'tests/unit/fixture (copy).test.ts(12,3): error TS2322: nope',
      ROOT
    );

    expect([...parsed.keys()]).toEqual(['tests/unit/fixture (copy).test.ts']);
  });

  it('collects every diagnostic for one file under a single key', () => {
    const output: string = [
      'tests/unit/a.test.ts(3,4): error TS2345: first',
      'tests/unit/b.test.ts(1,1): error TS2322: other file',
      'tests/unit/a.test.ts(8,2): error TS18048: second'
    ].join('\r\n');

    const parsed = parseDiagnostics(output, ROOT);

    expect(parsed.get('tests/unit/a.test.ts')).toHaveLength(2);
    expect(parsed.get('tests/unit/b.test.ts')).toHaveLength(1);
  });
});
