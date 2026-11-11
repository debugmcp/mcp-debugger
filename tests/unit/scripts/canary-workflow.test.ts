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

/**
 * Every leg above opens with `initialize`: the 2025 era. From 0.27.0 the published artifacts
 * serve protocol 2026-07-28 too (issue #1025), and the release is not done until the canary
 * has seen the published npm bundle and the published image do it. So each job runs one more
 * cycle in that era — added beside the 2025-era legs, never instead of them: most clients
 * still speak 2025-11-25 to a new release. The driver skips the leg for an artifact older
 * than 0.27.0 and holds everything from 0.27.0 (prereleases included) to it, deciding from
 * the artifact's own version (scripts/canary-era-gate.mjs).
 */
describe('canary.yml 2026-07-28 legs (issue #1025)', () => {
  const modern = smokeInvocations.filter((line) => line.includes('--era 2026-07-28'));

  it('runs one 2026-07-28 cycle in the npm job and one in the docker job', () => {
    expect(modern).toHaveLength(2);
  });

  it('keeps every 2025-era leg: the 2026 cycles are additions', () => {
    expect(smokeInvocations.length - modern.length).toBeGreaterThanOrEqual(8);
  });

  it('gates each 2026 cycle on the version of the artifact under test', () => {
    for (const line of modern) {
      expect(line).toContain('--artifact-version "$ARTIFACT_VERSION"');
    }
  });

  it('reads that version from the installed package in the npm job and from the registry in the docker job', () => {
    expect(yml).toContain('ARTIFACT_VERSION="$(node -p "require(process.argv[1]).version" "$(npm root -g)/@debugmcp/mcp-debugger/package.json")"');
    expect(yml).toContain('ARTIFACT_VERSION="$(npm view "@debugmcp/mcp-debugger@${CANARY_VERSION}" version)"');
    expect(yml.split('\n').filter((line) => line.includes('echo "ARTIFACT_VERSION=$ARTIFACT_VERSION" >> "$GITHUB_ENV"'))).toHaveLength(2);
  });
});
