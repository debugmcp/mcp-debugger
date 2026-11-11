/**
 * Types for `canary-era-gate.mjs`: which published artifacts owe the canary a
 * 2026-07-28 leg (issue #1025).
 */

/** The first release whose artifacts serve MCP protocol 2026-07-28. */
export const FIRST_MODERN_ERA_RELEASE: string;

/**
 * Whether an artifact of this version serves the 2026-07-28 era. A prerelease
 * is judged as its release; a version that is not `major.minor.patch` (with an
 * optional prerelease suffix and an optional leading `v`) throws.
 */
export function servesModernEra(version: string): boolean;
