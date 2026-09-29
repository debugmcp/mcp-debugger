/**
 * Types for `release-notes.mjs`, so its TypeScript tests see a real API instead of `any`.
 */

/** Longest section posted whole (GitHub rejects release bodies over 125,000 characters). */
export const DEFAULT_LIMIT: number;

/** Where the full-changelog link points. */
export const DEFAULT_REPO_URL: string;

/** Accept `0.25.0`, `v0.25.0` or `refs/tags/v0.25.0`; returns `0.25.0`. */
export function normalizeVersion(ref: string): string;

/** A `## [version]` section of CHANGELOG.md. */
export interface ChangelogSection {
  /** The heading line, e.g. `## [0.25.0] - 2026-09-29`. */
  heading: string;
  /** The heading line through the line before the next `## [` heading, trailing blanks trimmed. */
  text: string;
}

/** The `## [version]` section, or `null` when there is none. */
export function extractSection(changelog: string, version: string): ChangelogSection | null;

/** The `### Highlights` block, heading included, or `null` when absent or empty. */
export function extractHighlights(sectionText: string): string | null;

/** GitHub's anchor for a Markdown heading line. */
export function headingAnchor(heading: string): string;

/** The release body chosen for a version. */
export interface ReleaseNotes {
  /** `full`: the whole section; `highlights`: the Highlights block and a link to the section. */
  mode: 'full' | 'highlights';
  body: string;
  /** Length of the whole section, whichever mode was chosen. */
  sectionLength: number;
}

/**
 * Choose the release body for a version.
 *
 * @throws {Error} when the section is missing, or over the limit with no usable highlights
 */
export function selectReleaseNotes(
  changelog: string,
  version: string,
  options?: { limit?: number; repoUrl?: string }
): ReleaseNotes;
