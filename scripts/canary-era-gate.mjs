/**
 * Which published artifacts owe the canary a 2026-07-28 leg (issue #1025).
 *
 * Releases up to 0.26.x speak MCP protocol 2025-11-25 only; 0.27.0 is the
 * first whose npm bundle and Docker image answer `server/discover`. The canary
 * runs against whatever version it is pointed at, so its 2026 legs ask here:
 * before 0.27.0 the leg is skipped with a notice, from 0.27.0 it is strict.
 *
 * A prerelease is judged as its release — `0.27.0-beta.1` is a 0.27.0
 * artifact — so the beta rehearsal runs the leg the final is waiting on. A
 * version that cannot be read throws: guessing "old" would silently turn a
 * strict leg into a skipped one.
 *
 * Dependency-free on purpose, like canary-smoke.mjs, which imports it.
 */

/** The first release whose artifacts serve MCP protocol 2026-07-28. */
export const FIRST_MODERN_ERA_RELEASE = '0.27.0';

const RELEASE_VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/;

/**
 * @param {string} version
 * @returns {[number, number, number]} major, minor, patch — the prerelease suffix dropped
 */
function coreVersion(version) {
  const match = RELEASE_VERSION.exec(version);
  if (!match) {
    throw new Error(`'${version}' is not a release version (expected major.minor.patch, optionally with a prerelease suffix)`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Whether an artifact of this version serves the 2026-07-28 era.
 *
 * @param {string} version an artifact's own version, e.g. `0.27.0` or `0.27.0-beta.1`
 * @returns {boolean}
 */
export function servesModernEra(version) {
  const [major, minor, patch] = coreVersion(version);
  const [firstMajor, firstMinor, firstPatch] = coreVersion(FIRST_MODERN_ERA_RELEASE);
  if (major !== firstMajor) return major > firstMajor;
  if (minor !== firstMinor) return minor > firstMinor;
  return patch >= firstPatch;
}
