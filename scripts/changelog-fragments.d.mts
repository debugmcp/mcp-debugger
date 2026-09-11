/**
 * Types for `changelog-fragments.mjs`, so its TypeScript tests see a real API
 * instead of `@ts-ignore`-ing the import into `any` (issue #562).
 */

/** Keep a Changelog categories, in the order they must appear in a release. */
export type ChangelogCategory =
  | 'added'
  | 'changed'
  | 'deprecated'
  | 'removed'
  | 'fixed'
  | 'security';

/** Keep a Changelog categories, in the order they must appear in a release. */
export const CATEGORIES: readonly ChangelogCategory[];

/** Directory holding pending fragments, relative to the repo root. */
export const FRAGMENT_DIR: string;

/** Label that excuses a PR from the fragment requirement. */
export const SKIP_LABEL: string;

/** Manifest keys that describe what a consumer receives (issues #629, #630). */
export const SHIPPING_SURFACE_KEYS: readonly string[];

/** A fragment filename decomposed into its parts. */
export interface FragmentName {
  /** Issue number the fragment belongs to. */
  id: number;
  /** Optional slug disambiguating two fragments for one issue; `null` when absent. */
  slug: string | null;
  category: ChangelogCategory;
}

/**
 * Parse a fragment filename into its id, optional slug, and category.
 *
 * @throws {Error} when the name or category is not valid
 */
export function parseFragmentFilename(filename: string): FragmentName;

/**
 * Which {@link SHIPPING_SURFACE_KEYS} moved between two `package.json` texts?
 *
 * @throws {SyntaxError} when either side is not valid JSON
 */
export function changedShippingKeys(baseText: string, headText: string): string[];

/**
 * Reads one changed `package.json` on both sides of the diff, or returns `null`
 * when it does not exist on both (added or deleted, which is user-visible).
 */
export type ManifestResolver = (file: string) => { base: string; head: string } | null;

/** What the CI gate decided about a pull request. */
export interface FragmentRequirement {
  required: boolean;
  /** Human-readable justification, printed by the gate either way. */
  reason: string;
  /** The user-visible paths that were not excused. */
  offenders: string[];
}

/**
 * Decide whether a pull request must add a changelog fragment.
 *
 * Omit `resolveManifest` (or pass `null`) for the strict, path-only classification.
 */
export function requiresFragment(
  changedFiles: string[],
  labels?: string[],
  resolveManifest?: ManifestResolver | null
): FragmentRequirement;

/** The minimum a fragment must carry to be folded into a changelog section. */
export interface CollatableFragment {
  id: number;
  category: ChangelogCategory;
  /** Entry text without a leading `- `. */
  body: string;
}

/**
 * Fold fragments into the `## [Unreleased]` section of a changelog.
 *
 * @returns the updated changelog text
 * @throws {Error} when the changelog has no `## [Unreleased]` section
 */
export function collateIntoChangelog(
  changelog: string,
  fragments: readonly CollatableFragment[]
): string;

/** A fragment read off disk: its parsed name, its body, and where it came from. */
export interface Fragment extends FragmentName, CollatableFragment {
  /** Path the fragment was read from, as passed to `fs.rmSync` after collation. */
  file: string;
}

/**
 * Read every fragment in `dir`, newest id first. Returns `[]` when `dir` is absent.
 *
 * @throws {Error} when a fragment name is invalid or its body is empty
 */
export function readFragments(dir: string): Fragment[];

/** Build a {@link ManifestResolver} backed by `git show` at two revisions. */
export function gitManifestResolver(mergeBase: string, headSha: string): ManifestResolver;
