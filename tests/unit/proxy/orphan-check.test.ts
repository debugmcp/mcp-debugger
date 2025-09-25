import { describe, it, expect } from 'vitest';
import { shouldExitAsOrphan } from '../../../src/proxy/utils/orphan-check.js';

describe('shouldExitAsOrphan (unit)', () => {
  it('does NOT exit in containers when ppid === 1 (desired behavior) - FAILS with current buggy impl', () => {
    const inContainer = true;
    const ppid = 1;
    // Desired: should NOT exit in containers just because PPID is 1
    expect(shouldExitAsOrphan(ppid, inContainer)).toBe(false);
  });

  it('exits when not in container and ppid === 1 (keep legacy heuristic outside containers)', () => {
    const inContainer = false;
    const ppid = 1;
    expect(shouldExitAsOrphan(ppid, inContainer)).toBe(true);
  });

  it('does NOT exit when ppid !== 1 regardless of container flag', () => {
    expect(shouldExitAsOrphan(123, true)).toBe(false);
    expect(shouldExitAsOrphan(123, false)).toBe(false);
  });
});
