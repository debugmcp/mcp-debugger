import { describe, it, expect } from 'vitest';
import { coerceLaunchFlag } from '../../../src/utils/launch-flags.js';

/**
 * One reading of a boolean launch flag for every side that decides on it
 * (issue #746): the launcher's noDebug/stopOnEntry resolution and the
 * worker's #295 stopOnEntry force.
 */
describe('coerceLaunchFlag', () => {
  it('reads the parser-surviving string forms as the parser would', () => {
    expect(coerceLaunchFlag('true')).toBe(true);
    expect(coerceLaunchFlag('false')).toBe(false);
  });

  it('takes anything else by truthiness — how the adapters read it', () => {
    expect(coerceLaunchFlag(true)).toBe(true);
    expect(coerceLaunchFlag(1)).toBe(true);
    expect(coerceLaunchFlag('True')).toBe(true);
    expect(coerceLaunchFlag('yes')).toBe(true);
    expect(coerceLaunchFlag(false)).toBe(false);
    expect(coerceLaunchFlag(0)).toBe(false);
    expect(coerceLaunchFlag('')).toBe(false);
    expect(coerceLaunchFlag(undefined)).toBe(false);
    expect(coerceLaunchFlag(null)).toBe(false);
  });
});
