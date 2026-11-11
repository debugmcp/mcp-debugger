/**
 * The canary's 2026-07-28 legs run against published artifacts, and artifacts
 * older than 0.27.0 cannot speak that era (issue #1025). The gate decides from
 * the artifact's own version whether a 2026 leg is owed: skipped with a notice
 * before 0.27.0, strict from it — and a prerelease of 0.27.0 is a 0.27.0
 * artifact, or the beta rehearsal of a release would skip the very check the
 * release is waiting on.
 */
import { describe, expect, it } from 'vitest';
import { FIRST_MODERN_ERA_RELEASE, servesModernEra } from '../../../scripts/canary-era-gate.mjs';

describe('canary era gate (issue #1025)', () => {
  it('names 0.27.0 as the first release that serves 2026-07-28', () => {
    expect(FIRST_MODERN_ERA_RELEASE).toBe('0.27.0');
  });

  it.each(['0.27.0', '0.27.1', '0.28.0', '1.0.0', '10.2.3'])('%s owes the 2026 leg', (version) => {
    expect(servesModernEra(version)).toBe(true);
  });

  it.each(['0.27.0-beta.1', '0.27.0-rc.2', '1.0.0-alpha.1'])('a prerelease counts as its release: %s owes the leg', (version) => {
    expect(servesModernEra(version)).toBe(true);
  });

  it.each(['0.26.0', '0.26.9', '0.25.1', '0.9.99', '0.26.0-beta.1'])('%s predates the era: no leg owed', (version) => {
    expect(servesModernEra(version)).toBe(false);
  });

  it('accepts a leading v, as a tag carries', () => {
    expect(servesModernEra('v0.27.0')).toBe(true);
    expect(servesModernEra('v0.26.0')).toBe(false);
  });

  // A version the gate cannot read must not be read as "old": that would turn
  // a strict leg into a skipped one without anyone deciding so.
  it.each(['', 'latest', 'beta', '0.27', 'x.y.z', '0.27.0.1', ' 0.27.0'])('refuses %j instead of guessing', (version) => {
    expect(() => servesModernEra(version)).toThrow(/is not a release version/);
  });
});
