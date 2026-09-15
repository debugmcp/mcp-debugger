/**
 * InFlightGuard (issue #711): one launch-shaped operation per session at a
 * time, claimed synchronously so same-tick concurrent calls are refused.
 */
import { describe, it, expect, vi } from 'vitest';
import { SessionState } from '@debugmcp/shared';
import { InFlightGuard, type InFlightContext } from '../../../../src/session/in-flight-guard.js';
import { createMockLogger } from '../../../test-utils/helpers/test-utils.js';

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
    guard.tryAcquire('detach', 'detach', 'detach_from_process');

    expect(guard.tryAcquire('launch', 'launch', 'start_debugging')).toMatch(/^A launch is already in progress/);
    expect(guard.tryAcquire('restart', 'launch', 'start_debugging')).toMatch(/^A restart is already in progress/);
    expect(guard.tryAcquire('attach', 'launch', 'start_debugging')).toMatch(/^An attach is already in progress/);
    expect(guard.tryAcquire('detach', 'launch', 'start_debugging')).toMatch(/^A detach is already in progress/);
  });

  describe('run', () => {
    const contextFor = (state = SessionState.RUNNING, getSession?: () => never): InFlightContext =>
      ({
        logger: createMockLogger(),
        getSession: getSession ?? (() => ({ state }))
      }) as unknown as InFlightContext;

    it('runs the body under the claim and releases it afterwards', async () => {
      const guard = new InFlightGuard();
      const body = vi.fn(async () => {
        expect(guard.current('s1')).toBe('launch');
        return { success: true, state: SessionState.RUNNING };
      });

      const result = await guard.run('s1', 'launch', 'start_debugging', contextFor(), body);

      expect(result).toEqual({ success: true, state: SessionState.RUNNING });
      expect(guard.current('s1')).toBeUndefined();
    });

    it('refuses without running the body, reporting the session state', async () => {
      const guard = new InFlightGuard();
      guard.tryAcquire('s1', 'attach', 'attach_to_process');
      const body = vi.fn();
      const ctx = contextFor(SessionState.INITIALIZING);

      const result = await guard.run('s1', 'launch', 'start_debugging', ctx, body);

      expect(body).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.state).toBe(SessionState.INITIALIZING);
      expect(result.error).toMatch(/attach is already in progress/i);
      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('attach is already in progress'));
      // The refusal left the existing claim alone
      expect(guard.current('s1')).toBe('attach');
    });

    it('releases the claim when the body throws', async () => {
      const guard = new InFlightGuard();

      await expect(
        guard.run('s1', 'launch', 'start_debugging', contextFor(), async () => {
          throw new Error('proxy died');
        })
      ).rejects.toThrow('proxy died');

      expect(guard.current('s1')).toBeUndefined();
    });

    it('leaves no claim behind when the session does not exist', async () => {
      const guard = new InFlightGuard();
      const ctx = contextFor(SessionState.RUNNING, () => {
        throw new Error('Session not found');
      });
      const body = vi.fn();

      await expect(guard.run('gone', 'launch', 'start_debugging', ctx, body)).rejects.toThrow(
        'Session not found'
      );

      expect(body).not.toHaveBeenCalled();
      expect(guard.current('gone')).toBeUndefined();
    });
  });

  it('release is idempotent and safe on an unknown session', () => {
    const guard = new InFlightGuard();
    expect(() => guard.release('never-claimed')).not.toThrow();
    guard.tryAcquire('s1', 'launch', 'start_debugging');
    guard.release('s1');
    expect(() => guard.release('s1')).not.toThrow();
  });
});
