/**
 * Two latent defects in release.yml, read while preparing v0.26.0 (issue #1055):
 *
 * 1. `publish_if_missing()` treated any `npm view` failure as "not published" and
 *    published; a registry hiccup mid-loop would re-publish an existing version, which
 *    npm rejects after earlier packages already went out. The CodeLLDB platform loop
 *    beside it already told a true E404 from a transient error; the helper now does too,
 *    with a bounded retry.
 * 2. Four jobs decided "is this a prerelease?" four ways: docker-publish withheld
 *    `latest` for -alpha/-beta/-rc, npm-publish and create-release only for -alpha/-beta,
 *    the registry job for anything with a '-'. An -rc tag would have moved npm `latest`
 *    and created a full GitHub Release while Docker `latest` stayed put. One predicate now
 *    lives on build-and-test's outputs and every consumer reads it.
 *
 * Text-level, like the release.yml checks in codelldb-platform-packages.test.ts: a
 * workflow change is verified for real by the next beta rehearsal.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const yml = readFileSync(new URL('../../../.github/workflows/release.yml', import.meta.url), 'utf-8');

/** The text of one top-level job, from its `  name:` key to the next job. */
function job(name: string): string {
  const match = new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z-]+:\\n|$(?![\\s\\S]))`, 'm').exec(yml);
  if (!match) throw new Error(`job ${name} not found in release.yml`);
  return match[1];
}

describe('release.yml publish_if_missing (issue #1055)', () => {
  const helper = /publish_if_missing\(\) \{([\s\S]*?)\n\s*\}\n/.exec(yml)?.[1] ?? '';

  it('exists', () => {
    expect(helper).not.toBe('');
  });

  it('publishes only on a true E404, like the CodeLLDB platform loop', () => {
    expect(helper).toMatch(/grep -q "E404"/);
    // The old shape: `if npm view … >/dev/null 2>&1; then skip else publish` — any failure published.
    expect(helper).not.toMatch(/if npm view [^\n]*>\/dev\/null 2>&1; then/);
  });

  it('retries a non-404 failure a bounded number of times, then fails the step', () => {
    expect(helper).toMatch(/for attempt in 1 2 3/);
    expect(helper).toMatch(/return 1/);
  });
});

describe('release.yml prerelease predicate (issue #1055)', () => {
  it('build-and-test exposes one prerelease output, decided from the release ref', () => {
    const build = job('build-and-test');
    expect(build).toMatch(/outputs:\n\s+prerelease: \$\{\{ steps\.release\.outputs\.prerelease \}\}/);
    expect(build).toMatch(/id: release\n/);
    expect(build).toMatch(/echo "prerelease=true" >> "\$GITHUB_OUTPUT"/);
    expect(build).toMatch(/echo "prerelease=false" >> "\$GITHUB_OUTPUT"/);
  });

  it('no job spells the suffix lists out any more', () => {
    for (const literal of ['*"-beta"*', '*"-alpha"*', '*"-rc"*']) {
      expect(yml, `release.yml still tests ${literal}`).not.toContain(literal);
    }
  });

  it.each(['docker-publish', 'npm-publish', 'mcp-registry-publish', 'create-release'])(
    '%s reads needs.build-and-test.outputs.prerelease',
    (name) => {
      expect(job(name)).toContain('needs.build-and-test.outputs.prerelease');
    }
  );

  it.each(['mcp-registry-publish', 'create-release'])(
    '%s lists build-and-test in needs, or the output is invisible to it',
    (name) => {
      const needs = /needs: \[([^\]]*)\]/.exec(job(name))?.[1] ?? '';
      expect(needs.split(',').map((s) => s.trim())).toContain('build-and-test');
    }
  );

  it('the registry job keeps skipping prereleases', () => {
    expect(job('mcp-registry-publish')).toMatch(/if: \$\{\{ needs\.build-and-test\.outputs\.prerelease != 'true' \}\}/);
  });
});
