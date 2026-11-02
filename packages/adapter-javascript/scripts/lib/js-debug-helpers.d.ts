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
  /** canonical server file name → expected sha256 of the file extracted from the pinned archive */
  derived?: Record<string, string>;
}

/**
 * The asset a pinned vendoring downloads straight from
 * `<upstream>/releases/download/<tag>/<asset>` — outside the GitHub REST
 * quota (issues #867, #813). `null` when the API has to resolve the release
 * (`latest`, a version override, or a pin that names no archive).
 */
export function pinnedAssetCandidate(pin: JsDebugPin, version: string): SelectedAsset | null;

/** The manifest the vendor script writes beside the artifact (`vendor/js-debug/manifest.json`). */
export interface VendoredManifest {
  source?: string;
  version?: string;
  original?: string;
  [key: string]: unknown;
}

/** Whether the vendored artifact can be kept, and why. */
export interface VendoredVerdict {
  current: boolean;
  reason: string;
}

/**
 * Whether the vendored artifact already matches what this run would vendor
 * (issue #1049): the vendored manifest's version against the requested one,
 * a local override only while `JS_DEBUG_LOCAL_PATH` still names it, and
 * `latest` kept as is. `null` (no manifest) is never current.
 */
export function vendoredArtifactIsCurrent(
  manifest: VendoredManifest | null | undefined,
  requestedVersion: string,
  env: Record<string, string | undefined>
): VendoredVerdict;

/**
 * The digest the extracted server file must match when the archive digest was
 * enforced, or `null` when it was not (issue #1049).
 *
 * @throws {Error} when the archive was pinned but the manifest has no derived digest for `name`
 */
export function pinnedDerivedDigest(pin: JsDebugPin, archiveWasPinned: boolean, name: string): string | null;
