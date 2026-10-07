/**
 * Types for `js-debug-helpers.js`, so its TypeScript tests see a real API
 * instead of the import falling back to `any` (issue #562).
 */

/**
 * Normalize a path for display or comparison by converting backslashes to
 * forward slashes. Not for fs operations — logs and tests only.
 *
 * Returns `''` for anything that is not a string at runtime; the tests exercise
 * that path with a deliberate cast.
 */
export function normalizePath(p: string): string;

/** One entry of a GitHub release's `assets` array, as the selector reads it. */
export interface ReleaseAsset {
  name?: string;
  browser_download_url?: string;
  url?: string;
  download_url?: string;
}

/** The asset the vendoring script will download. */
export interface SelectedAsset {
  url: string;
  name: string;
  /** `.vsix` counts as `zip`; `.tar.gz` counts as `tgz`. */
  type: 'tgz' | 'zip';
}

/**
 * Select the best js-debug asset from a GitHub release. Precedence is
 * server > dap > generic `js-debug*`, and within each, `tgz` over `zip`.
 *
 * @throws {Error} when no asset matches, naming the ones that were available
 */
export function selectBestAsset(assets: readonly ReleaseAsset[]): SelectedAsset;

/** The `js-debug` entry of `vendor-manifest.json`, as the pin reader sees it. */
export interface JsDebugPin {
  version?: string;
  upstream?: string;
  /** asset file name → expected sha256 of the archive */
  assets?: Record<string, string>;
}

/**
 * The asset a pinned vendoring downloads straight from
 * `<upstream>/releases/download/<tag>/<asset>` — outside the GitHub REST
 * quota (issues #867, #813). `null` when the API has to resolve the release
 * (`latest`, a version override, or a pin that names no archive).
 */
export function pinnedAssetCandidate(pin: JsDebugPin, version: string): SelectedAsset | null;
