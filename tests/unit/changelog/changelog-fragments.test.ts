import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain-JS module without type declarations
import {
  changedManifestKeys,
  collateIntoChangelog,
  isDevDependencyOnlyChange,
  parseFragmentFilename,
  readFragments,
  requiresFragment
} from '../../../scripts/changelog-fragments.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';

/** Shaped like the real file: a non-empty [Unreleased] above a released section. */
const CHANGELOG = `# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- **An existing changed entry** (#478)

### Fixed
- **An existing fixed entry** (#508)
- **An older fixed entry** (#499)

## [0.24.2] - 2026-08-19

### Fixed
- **A released entry that must not move** (#387)
`;

describe('parseFragmentFilename', () => {
  it('reads the id and category from a bare numbered fragment', () => {
    expect(parseFragmentFilename('546.added.md')).toEqual({
      id: 546,
      slug: null,
      category: 'added'
    });
  });

  it('keeps the optional slug that disambiguates two fragments for one issue', () => {
    expect(parseFragmentFilename('546-collation.fixed.md')).toEqual({
      id: 546,
      slug: 'collation',
      category: 'fixed'
    });
  });

  it('rejects a category outside Keep a Changelog and names the valid ones', () => {
    expect(() => parseFragmentFilename('546.tweaked.md'))
      .toThrow(/Unknown changelog category 'tweaked'/);
  });

  it('rejects a fragment with no leading issue number, since the number is what prevents collisions', () => {
    expect(() => parseFragmentFilename('fix-the-thing.fixed.md'))
      .toThrow(/Invalid changelog fragment name/);
  });

  it('rejects a name missing the category segment', () => {
    expect(() => parseFragmentFilename('546.md'))
      .toThrow(/Invalid changelog fragment name/);
  });
});

describe('collateIntoChangelog', () => {
  it('inserts a fragment at the top of its existing category, keeping the entries below it', () => {
    const result = collateIntoChangelog(CHANGELOG, [
      { id: 546, category: 'fixed', body: '**A brand new fixed entry** (#546)' }
    ]);

    const fixedBlock = result.split('### Fixed')[1].split('##')[0];
    expect(fixedBlock.trim().split('\n')).toEqual([
      '- **A brand new fixed entry** (#546)',
      '- **An existing fixed entry** (#508)',
      '- **An older fixed entry** (#499)'
    ]);
  });

  it('creates a missing category heading in Keep a Changelog order, not at the end', () => {
    const result = collateIntoChangelog(CHANGELOG, [
      { id: 546, category: 'added', body: '**A new added entry** (#546)' }
    ]);

    const unreleased = result.split('## [Unreleased]')[1].split('## [0.24.2]')[0];
    const headings = unreleased.split('\n').filter(line => line.startsWith('### '));
    expect(headings).toEqual(['### Added', '### Changed', '### Fixed']);
    expect(unreleased).toContain('- **A new added entry** (#546)');
  });

  it('orders several fragments in one category by descending id', () => {
    const result = collateIntoChangelog(CHANGELOG, [
      { id: 100, category: 'fixed', body: '**Lower id** (#100)' },
      { id: 900, category: 'fixed', body: '**Higher id** (#900)' }
    ]);

    const fixedBlock = result.split('### Fixed')[1].split('##')[0];
    expect(fixedBlock.trim().split('\n').slice(0, 2)).toEqual([
      '- **Higher id** (#900)',
      '- **Lower id** (#100)'
    ]);
  });

  it('leaves released sections untouched', () => {
    const result = collateIntoChangelog(CHANGELOG, [
      { id: 546, category: 'fixed', body: '**A brand new fixed entry** (#546)' }
    ]);

    const released = result.split('## [0.24.2] - 2026-08-19')[1];
    expect(released.trim()).toBe('### Fixed\n- **A released entry that must not move** (#387)');
  });

  it('returns the changelog untouched when there are no fragments', () => {
    expect(collateIntoChangelog(CHANGELOG, [])).toBe(CHANGELOG);
  });

  it('fails loudly rather than silently dropping entries when [Unreleased] is missing', () => {
    expect(() => collateIntoChangelog('# Changelog\n\n## [0.1.0] - 2020-01-01\n', [
      { id: 546, category: 'fixed', body: '**x** (#546)' }
    ])).toThrow(/no "## \[Unreleased\]" section/);
  });
});

describe('requiresFragment (the CI gate)', () => {
  it('requires a fragment when a PR changes src/', () => {
    expect(requiresFragment(['src/server.ts'], []).required).toBe(true);
  });

  it('is satisfied once the PR adds any changelog.d/ file', () => {
    const result = requiresFragment(['src/server.ts', 'changelog.d/546.fixed.md'], []);
    expect(result.required).toBe(false);
  });

  it('does not require a fragment for a docs-only PR', () => {
    expect(requiresFragment(['README.md', 'docs/ruby/README.md'], []).required).toBe(false);
  });

  it('does not require a fragment for a test-only PR', () => {
    expect(requiresFragment(['tests/unit/proxy/proxy-manager.start.test.ts'], []).required).toBe(false);
  });

  it('requires a fragment for packages/ and tools/ changes too', () => {
    expect(requiresFragment(['packages/adapter-ruby/src/x.ts'], []).required).toBe(true);
    expect(requiresFragment(['tools/dev-proxy/dev-proxy.mjs'], []).required).toBe(true);
  });

  it('lets the no-changelog label release a PR that genuinely needs no entry', () => {
    const result = requiresFragment(['src/server.ts'], ['no-changelog']);
    expect(result.required).toBe(false);
    expect(result.reason).toMatch(/no-changelog/);
  });

  it('names the offending paths so the failure message is actionable', () => {
    expect(requiresFragment(['src/server.ts', 'README.md'], []).reason).toContain('src/server.ts');
  });

  it('does not demand a fragment for a test-only change inside a package', () => {
    const result = requiresFragment(
      ['packages/adapter-ruby/tests/unit/ruby-utils.test.ts'],
      []
    );
    expect(result.required).toBe(false);
  });

  it('still demands one when a package changes both source and tests', () => {
    const result = requiresFragment(
      [
        'packages/adapter-ruby/src/utils/ruby-utils.ts',
        'packages/adapter-ruby/tests/unit/ruby-utils.test.ts'
      ],
      []
    );
    expect(result.required).toBe(true);
    expect(result.offenders).toEqual(['packages/adapter-ruby/src/utils/ruby-utils.ts']);
  });
});

/** Minimal adapter manifest, shaped like a real one under `packages/`. */
function manifest(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    name: '@debugmcp/adapter-ruby',
    version: '0.24.2',
    dependencies: { '@debugmcp/shared': 'workspace:*', which: '^5.0.0' },
    devDependencies: { '@types/node': '^26.2.0', eslint: '^10.8.1' },
    ...overrides
  });
}

/** A resolver over a fixed `{ file: [before, after] }` map, as requiresFragment expects. */
function resolverOver(
  pairs: Record<string, [string, string]>
): (file: string) => { base: string, head: string } | null {
  return (file: string) => {
    const pair = pairs[file];
    return pair ? { base: pair[0], head: pair[1] } : null;
  };
}

const RUBY_MANIFEST = 'packages/adapter-ruby/package.json';
const GO_MANIFEST = 'packages/adapter-go/package.json';

describe('changedManifestKeys / isDevDependencyOnlyChange (issue #629)', () => {
  it('reports nothing changed when only devDependencies moved', () => {
    const before = manifest();
    const after = manifest({ devDependencies: { '@types/node': '^26.4.0', eslint: '^10.9.1' } });

    expect(changedManifestKeys(before, after)).toEqual([]);
    expect(isDevDependencyOnlyChange(before, after)).toBe(true);
  });

  it('names a runtime dependency bump, which a consumer of the package can observe', () => {
    const after = manifest({ dependencies: { '@debugmcp/shared': 'workspace:*', which: '^6.0.0' } });

    expect(changedManifestKeys(manifest(), after)).toEqual(['dependencies']);
    expect(isDevDependencyOnlyChange(manifest(), after)).toBe(false);
  });

  it('catches a version bump, so a release bump cannot slip through as toolchain churn', () => {
    expect(changedManifestKeys(manifest(), manifest({ version: '0.25.0' }))).toEqual(['version']);
  });

  it('catches a key that only one side has, such as a newly published bin', () => {
    expect(changedManifestKeys(manifest(), manifest({ bin: { rdbg: './cli.js' } }))).toEqual(['bin']);
  });

  it('ignores key reordering, comparing values rather than serialized text', () => {
    const before = JSON.stringify({ name: 'x', version: '1.0.0', dependencies: { a: '^1' } });
    const after = JSON.stringify({ dependencies: { a: '^1' }, version: '1.0.0', name: 'x' });

    expect(isDevDependencyOnlyChange(before, after)).toBe(true);
  });

  it('throws on unparseable JSON rather than reporting a silent no-change', () => {
    expect(() => changedManifestKeys('{not json', manifest())).toThrow();
  });
});

describe('requiresFragment manifest carve-out (issue #629)', () => {
  it('lets a devDependency-only bump across several manifests through', () => {
    const after = manifest({ devDependencies: { '@types/node': '^26.4.0', eslint: '^10.9.1' } });
    const result = requiresFragment(
      [RUBY_MANIFEST, GO_MANIFEST, 'pnpm-lock.yaml'],
      [],
      resolverOver({ [RUBY_MANIFEST]: [manifest(), after], [GO_MANIFEST]: [manifest(), after] })
    );

    expect(result.required).toBe(false);
    expect(result.offenders).toEqual([]);
  });

  it('still demands a fragment for the one manifest that moved a runtime dependency', () => {
    const devOnly = manifest({ devDependencies: { eslint: '^10.9.1' } });
    const runtime = manifest({ dependencies: { which: '^6.0.0' } });
    const result = requiresFragment(
      [RUBY_MANIFEST, GO_MANIFEST],
      [],
      resolverOver({ [RUBY_MANIFEST]: [manifest(), devOnly], [GO_MANIFEST]: [manifest(), runtime] })
    );

    expect(result.required).toBe(true);
    expect(result.offenders).toEqual([GO_MANIFEST]);
  });

  it('names the keys that kept a manifest on the list, so the failure is actionable', () => {
    const result = requiresFragment(
      [GO_MANIFEST],
      [],
      resolverOver({ [GO_MANIFEST]: [manifest(), manifest({ version: '0.25.0' })] })
    );

    expect(result.reason).toContain('changed: version');
  });

  it('keeps a manifest the resolver cannot place, since added or deleted is user-visible', () => {
    const result = requiresFragment([RUBY_MANIFEST], [], resolverOver({}));
    expect(result.required).toBe(true);
  });

  it('keeps a manifest whose JSON will not parse rather than guessing it is harmless', () => {
    const result = requiresFragment(
      [RUBY_MANIFEST],
      [],
      resolverOver({ [RUBY_MANIFEST]: ['{ truncated', manifest()] })
    );

    expect(result.required).toBe(true);
  });

  it('keeps a manifest when the resolver itself throws', () => {
    const result = requiresFragment([RUBY_MANIFEST], [], () => { throw new Error('no such rev'); });
    expect(result.required).toBe(true);
  });

  it('never clears a real source change riding alongside a devDependency bump', () => {
    const after = manifest({ devDependencies: { eslint: '^10.9.1' } });
    const result = requiresFragment(
      [RUBY_MANIFEST, 'packages/adapter-ruby/src/ruby-debug-adapter.ts'],
      [],
      resolverOver({ [RUBY_MANIFEST]: [manifest(), after] })
    );

    expect(result.required).toBe(true);
    expect(result.offenders).toEqual(['packages/adapter-ruby/src/ruby-debug-adapter.ts']);
  });

  it('is unchanged without a resolver, so the pre-#629 path-only behaviour still holds', () => {
    expect(requiresFragment([RUBY_MANIFEST], []).required).toBe(true);
  });

  it('only ever inspects package.json, not every file under a package', () => {
    const result = requiresFragment(
      ['packages/adapter-ruby/src/index.ts'],
      [],
      () => { throw new Error('resolver must not be consulted for a source file'); }
    );

    expect(result.required).toBe(true);
  });
});

describe('readFragments', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-fragments-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads fragments newest id first and ignores the directory README', () => {
    fs.writeFileSync(path.join(dir, 'README.md'), '# not a fragment');
    fs.writeFileSync(path.join(dir, '100.fixed.md'), '**Older** (#100)\n');
    fs.writeFileSync(path.join(dir, '900.added.md'), '**Newer** (#900)\n');

    expect(readFragments(dir).map((f: { id: number }) => f.id)).toEqual([900, 100]);
  });

  it('refuses an empty fragment rather than emitting a blank bullet', () => {
    fs.writeFileSync(path.join(dir, '546.fixed.md'), '   \n');
    expect(() => readFragments(dir)).toThrow(/is empty/);
  });

  it('returns nothing when the directory does not exist yet', () => {
    expect(readFragments(path.join(dir, 'absent'))).toEqual([]);
  });

  it('collates what it reads into a well-formed section', () => {
    fs.writeFileSync(path.join(dir, '546.added.md'), '**A new thing** (#546)\n');
    fs.writeFileSync(path.join(dir, '547.fixed.md'), '**A fix** (#547)\n');

    const result = collateIntoChangelog(CHANGELOG, readFragments(dir));
    const unreleased = result.split('## [Unreleased]')[1].split('## [0.24.2]')[0];

    expect(unreleased.split('\n').filter(l => l.startsWith('### '))).toEqual([
      '### Added', '### Changed', '### Fixed'
    ]);
    expect(unreleased).toContain('- **A new thing** (#546)');
    expect(unreleased).toContain('- **A fix** (#547)');
    expect(unreleased).toContain('- **An existing fixed entry** (#508)');
  });
});
