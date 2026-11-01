/**
 * Types for `check-docs.mjs`, so its TypeScript tests see a real API (issue #562).
 */

/**
 * Every git-tracked `*.md` under `root` that is still on disk, minus the frozen trees.
 * A file deleted from the working copy but not yet from the index (`pnpm changelog:collate`
 * before `git add -A`) is left out rather than read and crashed on (issue #1056).
 */
export function trackedMarkdown(root?: string): string[];
