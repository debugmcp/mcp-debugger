/**
 * The canary runs against published artifacts. Its COBOL (shipped in 0.25.0) and Dart
 * (0.26.0) legs used to pass `--skip-if-missing` to scripts/canary-smoke.mjs, which turns a
 * missing adapter into a `::notice` and a pass — so a release that failed to ship either
 * adapter would still show every leg green (issue #1053). The legs are strict now; the era
 * gate survives only behind an explicit dispatch input for canaries of older versions.
 *
 * Text-level, like the release.yml checks in codelldb-platform-packages.test.ts: the real
 * verification is `gh workflow run canary.yml -f version=x.y.z` after a release.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const yml = readFileSync(new URL('../../../.github/workflows/canary.yml', import.meta.url), 'utf-8');
const smokeInvocations = yml.split('\n').filter((line) => line.includes('scripts/canary-smoke.mjs --lang'));

describe('canary.yml strict language legs (issue #1053)', () => {
  it('runs a smoke cycle for every language the canary covers', () => {
    // mock, python, rust, cobol, dart on the npm legs; the same minus mock's duplicate on docker
    expect(smokeInvocations.length).toBeGreaterThanOrEqual(8);
  });

  it('no smoke invocation carries the literal --skip-if-missing', () => {
    const lenient = smokeInvocations.filter((line) => line.includes('--skip-if-missing'));
    expect(lenient, 'invocations that could pass with a missing adapter').toEqual([]);
  });

  it('the cobol and dart legs, in both jobs, take the era gate from $SKIP_IF_MISSING', () => {
    const gated = smokeInvocations.filter((line) => /--lang (cobol|dart) \$SKIP_IF_MISSING\b/.test(line));
    expect(gated).toHaveLength(4);
  });

  it('declares the allow_missing_languages dispatch input as a boolean that defaults to strict', () => {
    const input = /allow_missing_languages:\n((?:\s{8}.*\n)+)/.exec(yml);
    expect(input, 'workflow_dispatch input').not.toBeNull();
    expect(input![1]).toMatch(/type: boolean/);
    expect(input![1]).toMatch(/default: false/);
  });

  it('derives SKIP_IF_MISSING from that input, empty unless it is true', () => {
    const env = /^\s*SKIP_IF_MISSING: (.*)$/m.exec(yml);
    expect(env, 'workflow env').not.toBeNull();
    expect(env![1]).toContain("inputs.allow_missing_languages == true && '--skip-if-missing' || ''");
  });
});
