/**
 * Types for `typecheck-tests-ratchet.mjs`, so its TypeScript tests see a real API
 * instead of `@ts-ignore`-ing the import into `any` (issue #562).
 */

/** Why a tsc run cannot be trusted, or `null` when it can. */
export function unusableRunReason(status: number | null, output: string): string | null;

/** Why an all-clear run cannot be trusted, or `null` when it can. */
export function emptyRunReason(
  currentFiles: number,
  baselineFiles: number,
  allowEmpty: boolean
): string | null;

/** Group tsc diagnostics by the repo-relative, forward-slash file that produced them. */
export function parseDiagnostics(output: string, root: string): Map<string, string[]>;

/** Does this key name a file in a tree the ratchet owns? */
export function isTestTreePath(file: string): boolean;

/** Keys that name something outside the test trees, sorted. */
export function pathsOutsideTestTrees(keys: Iterable<string>): string[];

/** Per-file comparison of a run against the recorded baseline. */
export interface RatchetComparison {
  regressed: string[];
  improved: string[];
}

/** Compare the current run against the baseline. */
export function compare(
  current: Map<string, string[]>,
  baseline: Record<string, number>
): RatchetComparison;

/** What a comparison means for this run. */
export function verdict(comparison: RatchetComparison): 'regressed' | 'stale' | 'ok';
