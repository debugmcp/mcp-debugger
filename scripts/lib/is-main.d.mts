/** Types for `is-main.mjs`, so TypeScript callers (tests) see a real API. */

/**
 * Pure core of `isMain`: do these two paths name the same file once symlinks resolve?
 */
export function isSameEntry(
  moduleUrl: string,
  entry: string | undefined,
  resolve: (target: string) => string
): boolean;

/** Was this module the one Node was started with? Defaults `entry` to `process.argv[1]`. */
export function isMain(moduleUrl: string, entry?: string): boolean;
