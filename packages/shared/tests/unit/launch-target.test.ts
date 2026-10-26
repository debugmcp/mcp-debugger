/**
 * The launch-target predicate behind `AdapterPolicy.launchTargetKeys`
 * (issue #985): what counts as "the launch config already names what runs",
 * so the connection manager leaves `program` out instead of filling it from
 * scriptPath, and the launcher leaves `cwd` for the adapter to derive.
 */
import { describe, it, expect } from 'vitest';
import { launchTargetKeysOf, namesLaunchTarget, DefaultAdapterPolicy, PythonAdapterPolicy, type AdapterPolicy } from '../../src/index.js';

describe('launchTargetKeysOf', () => {
  it('is program alone for a policy that declares nothing, and for no policy at all', () => {
    expect(launchTargetKeysOf(DefaultAdapterPolicy as AdapterPolicy)).toEqual(['program']);
    expect(launchTargetKeysOf(undefined)).toEqual(['program']);
  });

  it("is the policy's own list when it declares one", () => {
    expect(launchTargetKeysOf(PythonAdapterPolicy)).toEqual(['program', 'module', 'code']);
  });
});

describe('namesLaunchTarget', () => {
  const keys = ['program', 'module', 'code'];

  it('is false for no config, an absent key, an empty string and an empty array', () => {
    expect(namesLaunchTarget(undefined, keys)).toBe(false);
    expect(namesLaunchTarget({}, keys)).toBe(false);
    expect(namesLaunchTarget({ module: '' }, keys)).toBe(false);
    expect(namesLaunchTarget({ code: [] }, keys)).toBe(false);
    expect(namesLaunchTarget({ cwd: '/proj' }, keys)).toBe(false);
  });

  it('is true for a non-empty string or array under any of the keys', () => {
    expect(namesLaunchTarget({ module: 'pytest' }, keys)).toBe(true);
    expect(namesLaunchTarget({ code: ['import x', 'x.run()'] }, keys)).toBe(true);
    expect(namesLaunchTarget({ program: '/proj/a.py' }, keys)).toBe(true);
  });

  it('only looks under the given keys', () => {
    expect(namesLaunchTarget({ module: 'pytest' }, ['program'])).toBe(false);
  });
});
