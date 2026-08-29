import { describe, expect, it } from 'vitest';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  compare,
  isTestTreePath,
  parseDiagnostics,
  pathsOutsideTestTrees,
  unusableRunReason,
  verdict
} from '../../../scripts/typecheck-tests-ratchet.mjs';
import type { RatchetComparison } from '../../../scripts/typecheck-tests-ratchet.mjs';
import { isSameEntry } from '../../../scripts/lib/is-main.mjs';

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
  comparison: RatchetComparison;
  expected: 'regressed' | 'stale' | 'ok';
}

const VERDICT_CASES: VerdictCase[] = [
  {
    name: 'a clean run passes',
    comparison: { regressed: [], improved: [] },
    expected: 'ok'
  },
  {
    name: 'new errors fail',
    comparison: { regressed: ['a.test.ts'], improved: [] },
    expected: 'regressed'
  },
  {
    name: 'a shrunken count fails as a stale baseline — there is no lenient mode',
    comparison: { regressed: [], improved: ['a.test.ts'] },
    expected: 'stale'
  },
  {
    name: 'new errors are reported ahead of a stale baseline',
    comparison: { regressed: ['b.test.ts'], improved: ['a.test.ts'] },
    expected: 'regressed'
  }
];

describe('verdict', () => {
  for (const testCase of VERDICT_CASES) {
    it(testCase.name, () => {
      expect(verdict(testCase.comparison)).toBe(testCase.expected);
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
    const parsed = parseDiagnostics('tests\\unit\\b.test.ts(1,1): error TS7006: nope', ROOT);

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

describe('pathsOutsideTestTrees', () => {
  const OWNED: string[] = [
    'tests/unit/a.test.ts',
    'tests/core/unit/server/b.test.ts',
    'packages/adapter-go/tests/unit/c.test.ts'
  ];
  const FOREIGN: string[] = [
    'tsconfig.spec.json',
    'src/session/session-manager.ts',
    'packages/shared/src/index.ts',
    '../outside-the-repo/d.ts',
    'testsuite/not-really-tests.ts'
  ];

  for (const owned of OWNED) {
    it(`owns ${owned}`, () => {
      expect(isTestTreePath(owned)).toBe(true);
    });
  }

  for (const foreign of FOREIGN) {
    it(`disowns ${foreign}`, () => {
      expect(isTestTreePath(foreign)).toBe(false);
    });
  }

  it('reports every foreign key, sorted, and nothing else', () => {
    expect(pathsOutsideTestTrees([...OWNED, ...FOREIGN])).toEqual([...FOREIGN].sort());
  });

  it('is empty for a run confined to the test trees', () => {
    expect(pathsOutsideTestTrees(OWNED)).toEqual([]);
  });
});

describe('unusableRunReason', () => {
  const DIAGNOSTICS: string = 'tests/unit/a.test.ts(3,4): error TS2345: nope';

  it('accepts a clean run', () => {
    expect(unusableRunReason(0, '')).toBeNull();
  });

  it('accepts the normal case: exit 2 with diagnostics', () => {
    expect(unusableRunReason(2, DIAGNOSTICS)).toBeNull();
  });

  it('rejects exit 1 even when a clean prefix of diagnostics was printed', () => {
    // An externally terminated tsc on Windows reports {status: 1, signal: null}; taking its
    // truncated output at face value would read as a large improvement.
    expect(unusableRunReason(1, DIAGNOSTICS)).toMatch(/neither 0 .* nor 2/);
  });

  it('rejects a null status', () => {
    expect(unusableRunReason(null, DIAGNOSTICS)).toMatch(/did not complete/);
  });

  it('rejects a TS1xxx syntax error, which skips the semantic pass entirely', () => {
    const output: string = 'tests/unit/a.test.ts(3,4): error TS1005: \';\' expected.';

    expect(unusableRunReason(2, output)).toMatch(/syntax error/);
  });

  it('rejects a non-zero exit that reported nothing parseable', () => {
    expect(unusableRunReason(2, 'error TS5083: Cannot read file.')).toMatch(/without reporting/);
  });
});

describe('isSameEntry', () => {
  const linked: string = path.resolve('/link/scripts/ratchet.mjs');
  const real: string = path.resolve('/real/scripts/ratchet.mjs');
  const other: string = path.resolve('/real/scripts/other.mjs');

  /** Stands in for `fs.realpathSync`: `/link/...` is a symlink (or junction) to `/real/...`. */
  const resolve = (target: string): string => (target === linked ? real : target);

  it('matches when argv[1] reaches the module through a symlink', () => {
    // Node hands out a realpath-resolved import.meta.url but leaves argv[1] as typed, so the
    // old `import.meta.url === pathToFileURL(argv[1]).href` idiom silently skipped main().
    expect(isSameEntry(pathToFileURL(real).href, linked, resolve)).toBe(true);
    expect(pathToFileURL(real).href === pathToFileURL(linked).href).toBe(false);
  });

  it('matches the plain, unlinked case', () => {
    expect(isSameEntry(pathToFileURL(real).href, real, resolve)).toBe(true);
  });

  it('does not match a different entry point', () => {
    expect(isSameEntry(pathToFileURL(real).href, other, resolve)).toBe(false);
  });

  it('does not match when there is no entry point at all', () => {
    expect(isSameEntry(pathToFileURL(real).href, undefined, resolve)).toBe(false);
  });
});
