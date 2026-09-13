/**
 * InFlightGuard (issue #711): one launch-shaped operation per session at a
 * time, claimed synchronously so same-tick concurrent calls are refused.
 */
import { describe, it, expect } from 'vitest';
import { InFlightGuard } from '../../../../src/session/in-flight-guard.js';

describe('InFlightGuard', () => {
  it('claims a free session and reports nothing in flight afterwards', () => {
    const guard = new InFlightGuard();

    expect(guard.tryAcquire('s1', 'launch', 'start_debugging')).toBeUndefined();
    expect(guard.current('s1')).toBe('launch');

    guard.release('s1');
    expect(guard.current('s1')).toBeUndefined();
  });

  it('refuses a claim on a held session with a message naming both operations', () => {
    const guard = new InFlightGuard();
    guard.tryAcquire('s1', 'launch', 'start_debugging');

    const refusal = guard.tryAcquire('s1', 'attach', 'attach_to_process');

    expect(refusal).toMatch(/launch is already in progress/i);
    expect(refusal).toContain('attach_to_process');
    // The refusal did not steal the claim
    expect(guard.current('s1')).toBe('launch');
  });

  it('keeps sessions independent', () => {
    const guard = new InFlightGuard();
    guard.tryAcquire('s1', 'restart', 'restart_debugging');

    expect(guard.tryAcquire('s2', 'launch', 'start_debugging')).toBeUndefined();
  });

  it("describes each held operation in the caller's vocabulary", () => {
    const guard = new InFlightGuard();
    guard.tryAcquire('launch', 'launch', 'start_debugging');
    guard.tryAcquire('restart', 'restart', 'restart_debugging');
    guard.tryAcquire('attach', 'attach', 'attach_to_process');

    expect(guard.tryAcquire('launch', 'launch', 'start_debugging')).toMatch(/^A launch is already in progress/);
    expect(guard.tryAcquire('restart', 'launch', 'start_debugging')).toMatch(/^A restart is already in progress/);
    expect(guard.tryAcquire('attach', 'launch', 'start_debugging')).toMatch(/^An attach is already in progress/);
  });

  it('release is idempotent and safe on an unknown session', () => {
    const guard = new InFlightGuard();
    expect(() => guard.release('never-claimed')).not.toThrow();
    guard.tryAcquire('s1', 'launch', 'start_debugging');
    guard.release('s1');
    expect(() => guard.release('s1')).not.toThrow();
  });
});
