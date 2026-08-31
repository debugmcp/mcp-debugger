/**
 * Changelog fragment tooling (issue #546).
 *
 * Every PR used to prepend its entry to the same line under `### Fixed` in
 * CHANGELOG.md, so any two concurrent PRs conflicted regardless of what they
 * actually changed. Fragments give each PR its own file, which makes the
 * collision structurally impossible.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { isDeepStrictEqual } from 'util';
import { isMain } from './lib/is-main.mjs';

/** Keep a Changelog categories, in the order they must appear in a release. */
export const CATEGORIES = ['added', 'changed', 'deprecated', 'removed', 'fixed', 'security'];

const FRAGMENT_FILENAME = /^(\d+)(?:-([a-z0-9-]+))?\.([a-z]+)\.md$/;

/**
 * Parse a fragment filename into its id, optional slug, and category.
 *
 * @param {string} filename bare filename, e.g. `546.added.md`
 * @returns {{ id: number, slug: string | null, category: string }}
 * @throws {Error} when the name or category is not valid
 */
export function parseFragmentFilename(filename) {
  const match = FRAGMENT_FILENAME.exec(filename);
  if (!match) {
    throw new Error(
      `Invalid changelog fragment name '${filename}'. ` +
      `Expected <issue-number>[-<slug>].<category>.md, e.g. 546.added.md`
    );
  }

  const [, id, slug, category] = match;
  if (!CATEGORIES.includes(category)) {
    throw new Error(
      `Unknown changelog category '${category}' in '${filename}'. ` +
      `Expected one of: ${CATEGORIES.join(', ')}`
    );
  }

  return { id: Number(id), slug: slug ?? null, category };
}

/** Directory holding pending fragments, relative to the repo root. */
export const FRAGMENT_DIR = 'changelog.d';

/** Label that excuses a PR from the fragment requirement. */
export const SKIP_LABEL = 'no-changelog';

/** Changes under these roots are user-visible and need a changelog entry. */
const USER_VISIBLE_ROOTS = ['src/', 'packages/', 'tools/'];

/**
 * Root-level files that are user-visible despite not sitting under one of those roots.
 *
 * The root manifest is `private: true`, but its `dependencies` and `optionalDependencies` are
 * exactly what `dist/index.js` and the Docker image run — registering the C/C++ adapter in
 * `optionalDependencies` (78912fc8) shipped a whole language and the gate said nothing (#630).
 *
 * `pnpm-lock.yaml` is deliberately NOT here, and it is not an oversight: every dependency PR
 * touches the lockfile, devDependency-only ones included, so gating on it would undo #629 the
 * day after it landed. It also has no top-level keys to classify. The accepted cost is that a
 * purely transitive change — a `pnpm.overrides` pin — goes ungated.
 */
const USER_VISIBLE_FILES = ['package.json'];

/**
 * Manifest keys that describe what a consumer receives. Everything else in a `package.json` is
 * plumbing: `scripts`, `devDependencies`, `packageManager`, `workspaces`, `pnpm`.
 *
 * An allowlist rather than "everything but devDependencies" (#629's rule) because the root
 * manifest carries 104 npm scripts: measured over 130 root-manifest commits, the deny-rule
 * demands a fragment for 115 of them and this allowlist for 40 (#630).
 *
 * `version` is absent on purpose. A release PR bumps it across every manifest, and the
 * changelog entry for a release is the collated section itself — requiring a *fragment* for
 * the bump that cuts the release would be circular.
 */
export const SHIPPING_SURFACE_KEYS = [
  'dependencies', 'optionalDependencies', 'peerDependencies',
  'bin', 'main', 'exports', 'files', 'engines', 'type'
];

/**
 * Tests live inside `packages/`, so a package's test-only change would
 * otherwise trip the gate. Test churn is not user-visible.
 */
function isTestPath(file) {
  return file.includes('/tests/') || /\.(test|spec)\.[cm]?[jt]sx?$/.test(file);
}

/**
 * Which shipping-surface keys moved between two `package.json` texts?
 *
 * This is the whole judgement the gate makes about a manifest: it asks what actually moved
 * rather than trusting the file's path, so toolchain churn (a linter, a types package, a test
 * runner) stays silent while a change to what ships does not.
 *
 * Compared with `isDeepStrictEqual` rather than by string, so a manifest whose keys a tool
 * happened to reorder does not read as a change.
 *
 * @param {string} baseText `package.json` before the change
 * @param {string} headText `package.json` after the change
 * @returns {string[]} the {@link SHIPPING_SURFACE_KEYS} that differ; empty if none
 * @throws {SyntaxError} when either side is not valid JSON
 */
export function changedShippingKeys(baseText, headText) {
  const base = JSON.parse(baseText);
  const head = JSON.parse(headText);

  return SHIPPING_SURFACE_KEYS
    .filter(key => !isDeepStrictEqual(base[key], head[key]))
    .sort();
}

/**
 * Classify one candidate path, given a way to read its before/after content.
 *
 * Returns the non-devDependency keys that moved (empty = exempt), or `null` to keep the file
 * an offender. Every uncertain case returns `null`: a gate that errs toward silence is worse
 * than no gate at all.
 *
 * @param {string} file repo-relative path
 * @param {((file: string) => { base: string, head: string } | null) | null} resolveManifest
 * @returns {string[] | null}
 */
function manifestVerdict(file, resolveManifest) {
  if (!resolveManifest || path.basename(file) !== 'package.json') return null;

  let pair;
  try {
    pair = resolveManifest(file);
  } catch {
    return null;  // resolver blew up (no git, bad rev) — do not clear the file on a guess
  }
  // No pair means the manifest was added or deleted: a package appeared or went away.
  if (!pair) return null;

  try {
    return changedShippingKeys(pair.base, pair.head);
  } catch {
    return null;  // unparseable JSON — cannot prove nothing shipped changed
  }
}

/** One offender line, naming the keys that kept a manifest on the list. */
function describeOffender(file, movedKeys) {
  const changed = movedKeys.get(file);
  return changed ? `  ${file}  (changed: ${changed.join(', ')})` : `  ${file}`;
}

/**
 * Decide whether a pull request must add a changelog fragment.
 *
 * `resolveManifest` is injected rather than read from git in here so the classification stays
 * pure and testable, the way `isSameEntry` in ./lib/is-main.mjs takes its path resolver.
 * Omit it and the gate falls back to path-only classification: every non-test path under a
 * user-visible root, plus the root manifest, is an offender. That is the strict direction, so
 * the fallback can only ever over-report.
 *
 * @param {string[]} changedFiles repo-relative paths changed by the PR
 * @param {string[]} labels PR label names
 * @param {((file: string) => { base: string, head: string } | null) | null} [resolveManifest]
 *   reads a changed `package.json` on both sides of the diff; `null` when unavailable
 * @returns {{ required: boolean, reason: string, offenders: string[] }}
 */
export function requiresFragment(changedFiles, labels = [], resolveManifest = null) {
  const candidates = changedFiles.filter(
    file =>
      (USER_VISIBLE_ROOTS.some(root => file.startsWith(root)) || USER_VISIBLE_FILES.includes(file))
      && !isTestPath(file)
  );

  // A manifest that moved no shipping-surface key is toolchain churn, not a user-visible
  // change (#629, #630). Remember what did move, so the message can say why one was kept.
  const movedKeys = new Map();
  const offenders = candidates.filter(file => {
    const changed = manifestVerdict(file, resolveManifest);
    if (changed === null) return true;
    if (changed.length === 0) return false;
    movedKeys.set(file, changed);
    return true;
  });

  if (offenders.length === 0) {
    return {
      required: false,
      reason: candidates.length === 0
        ? 'No changes under src/, packages/, or tools/, or to the root manifest.'
        : 'The changed manifests moved no shipping-surface key.',
      offenders
    };
  }

  if (changedFiles.some(file => file.startsWith(`${FRAGMENT_DIR}/`))) {
    return { required: false, reason: `A ${FRAGMENT_DIR}/ fragment is present.`, offenders };
  }

  if (labels.includes(SKIP_LABEL)) {
    return {
      required: false,
      reason: `Exempt: the '${SKIP_LABEL}' label is applied.`,
      offenders
    };
  }

  return {
    required: true,
    reason:
      `These changes are user-visible but no ${FRAGMENT_DIR}/ fragment was added:\n` +
      offenders.map(file => describeOffender(file, movedKeys)).join('\n'),
    offenders
  };
}

/** Title-case heading text for a category, e.g. `fixed` -> `### Fixed`. */
function heading(category) {
  return `### ${category[0].toUpperCase()}${category.slice(1)}`;
}

/**
 * Fold fragments into the `## [Unreleased]` section of a changelog.
 *
 * Entries are inserted at the top of their category, newest id first, which
 * matches how the section has always been written by hand. Released sections
 * below are never touched. A category that does not exist yet is created in
 * Keep a Changelog order so the section cannot grow a duplicate heading
 * (the malformed structure found in #462).
 *
 * @param {string} changelog full CHANGELOG.md text
 * @param {Array<{ id: number, category: string, body: string }>} fragments
 * @returns {string} the updated changelog text
 */
export function collateIntoChangelog(changelog, fragments) {
  if (fragments.length === 0) return changelog;

  const lines = changelog.split('\n');
  const unreleasedStart = lines.findIndex(line => /^## \[Unreleased\]/.test(line));
  if (unreleasedStart === -1) {
    throw new Error('CHANGELOG.md has no "## [Unreleased]" section to collate into');
  }

  // The Unreleased section runs until the next release heading (`## [x.y.z]`).
  let unreleasedEnd = lines.length;
  for (let i = unreleasedStart + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { unreleasedEnd = i; break; }
  }

  const section = lines.slice(unreleasedStart, unreleasedEnd);
  const byCategory = new Map();
  for (const fragment of fragments) {
    if (!byCategory.has(fragment.category)) byCategory.set(fragment.category, []);
    byCategory.get(fragment.category).push(fragment);
  }

  for (const [category, entries] of byCategory) {
    const bullets = entries
      .slice()
      .sort((a, b) => b.id - a.id)
      .map(entry => `- ${entry.body.trim()}`);

    const headingIndex = section.findIndex(line => line.trim() === heading(category));
    if (headingIndex !== -1) {
      section.splice(headingIndex + 1, 0, ...bullets);
      continue;
    }

    section.splice(newCategoryIndex(section, category), 0, heading(category), ...bullets, '');
  }

  return [...lines.slice(0, unreleasedStart), ...section, ...lines.slice(unreleasedEnd)].join('\n');
}

/**
 * Where a not-yet-present category heading belongs: before the first existing
 * category that sorts after it, so the section stays in Keep a Changelog order.
 */
function newCategoryIndex(section, category) {
  const rank = CATEGORIES.indexOf(category);
  for (let i = 0; i < section.length; i++) {
    const existing = CATEGORIES.findIndex(candidate => section[i].trim() === heading(candidate));
    if (existing !== -1 && existing > rank) return i;
  }
  return section.length;
}

/**
 * Read every fragment in `dir`, newest id first.
 *
 * @param {string} dir
 * @returns {Array<{ id: number, slug: string | null, category: string, body: string, file: string }>}
 */
export function readFragments(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter(name => name.endsWith('.md') && name !== 'README.md')
    .map(name => {
      const parsed = parseFragmentFilename(name);
      const file = path.join(dir, name);
      const body = fs.readFileSync(file, 'utf-8').trim();
      if (!body) throw new Error(`Changelog fragment '${name}' is empty`);
      return { ...parsed, body, file };
    })
    .sort((a, b) => b.id - a.id);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function runCheck(root) {
  const fragments = readFragments(path.join(root, FRAGMENT_DIR));
  for (const fragment of fragments) {
    console.log(`ok  ${path.basename(fragment.file)}  (${fragment.category})`);
  }
  console.log(`${fragments.length} pending changelog fragment(s).`);
}

function runCollate(root) {
  const dir = path.join(root, FRAGMENT_DIR);
  const fragments = readFragments(dir);
  if (fragments.length === 0) {
    console.log('No changelog fragments to collate.');
    return;
  }

  const changelogPath = path.join(root, 'CHANGELOG.md');
  const collated = collateIntoChangelog(fs.readFileSync(changelogPath, 'utf-8'), fragments);
  fs.writeFileSync(changelogPath, collated);

  for (const fragment of fragments) {
    fs.rmSync(fragment.file);
    console.log(`collated ${path.basename(fragment.file)} -> ### ${fragment.category}`);
  }
  console.log(`Collated ${fragments.length} fragment(s) into CHANGELOG.md [Unreleased].`);
}

/**
 * Read one path on both sides of the diff, or `null` when it does not exist on both.
 *
 * `mergeBase` rather than the base branch tip mirrors the three-dot `git diff A...B` the
 * workflow uses to build CHANGED_FILES, so this sees exactly the change the gate is judging.
 *
 * @param {string} mergeBase
 * @param {string} headSha
 * @returns {(file: string) => { base: string, head: string } | null}
 */
export function gitManifestResolver(mergeBase, headSha) {
  // stderr is piped, not inherited: a manifest missing on one side is an expected outcome
  // handled below, and letting git's `fatal:` reach the log once per file only adds noise.
  const show = rev => execFileSync('git', ['show', rev],
    { encoding: 'utf-8', maxBuffer: 32e6, stdio: ['ignore', 'pipe', 'pipe'] });

  return file => {
    try {
      // A manifest missing on either side was added or deleted, which is user-visible.
      return { base: show(`${mergeBase}:${file}`), head: show(`${headSha}:${file}`) };
    } catch {
      return null;
    }
  };
}

/**
 * Build the manifest resolver for the CI gate, or `null` when the revisions are not known.
 *
 * Absent BASE_REF/HEAD_SHA — a developer running `--ci` by hand — the gate falls back to the
 * pre-#629 path-only behaviour rather than guessing at revisions.
 *
 * @returns {((file: string) => { base: string, head: string } | null) | null}
 */
function resolverFromEnv() {
  const baseRef = (process.env.BASE_REF || '').trim();
  const headSha = (process.env.HEAD_SHA || '').trim();
  if (!baseRef || !headSha) return null;

  try {
    const mergeBase = execFileSync('git', ['merge-base', baseRef, headSha],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return gitManifestResolver(mergeBase, headSha);
  } catch (error) {
    // Refusing here would fail PRs for an unrelated reason; the path-only gate is the safe
    // fallback, since it can only ever be stricter than the manifest-aware one.
    console.warn(`Changelog gate: could not resolve ${baseRef}...${headSha}, ` +
      `falling back to path-only classification. (${error instanceof Error ? error.message : error})`);
    return null;
  }
}

/** CI gate. Reads the changed-file list and PR labels from the environment. */
function runCi() {
  const changedFiles = (process.env.CHANGED_FILES || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const labels = (process.env.PR_LABELS || '')
    .split(',')
    .map(label => label.trim())
    .filter(Boolean);

  const verdict = requiresFragment(changedFiles, labels, resolverFromEnv());
  if (!verdict.required) {
    console.log(`Changelog gate: ${verdict.reason}`);
    return;
  }

  console.error(`\nChangelog fragment required (issue #546).\n\n${verdict.reason}\n`);
  console.error(
    `Add a file to ${FRAGMENT_DIR}/ named <issue-number>.<category>.md — for example\n` +
    `${FRAGMENT_DIR}/546.fixed.md — containing the entry text without a leading "- ".\n` +
    `Categories: ${CATEGORIES.join(', ')}.\n\n` +
    `See ${FRAGMENT_DIR}/README.md. If this PR genuinely needs no entry (pure refactor,\n` +
    `CI-internal change), apply the '${SKIP_LABEL}' label.\n`
  );
  process.exitCode = 1;
}

const MODES = { '--check': runCheck, '--collate': runCollate, '--ci': runCi };

if (isMain(import.meta.url)) {
  const mode = process.argv[2] ?? '--check';
  const run = MODES[mode];
  if (!run) {
    console.error(`Usage: node scripts/changelog-fragments.mjs [${Object.keys(MODES).join('|')}]`);
    process.exit(2);
  }

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    run(root);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
