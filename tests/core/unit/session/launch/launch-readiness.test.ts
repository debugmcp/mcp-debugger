/**
 * waitForLaunchReadiness: which signals settle a launch that was not already
 * ready after the handshake, and what each settlement reports (issue #815
 * added the caller's ceiling and the outcome). These pin the outcomes over a
 * bare proxy-manager emitter.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { SessionState } from '@debugmcp/shared';
import { waitForLaunchReadiness, type LaunchReadinessOutcome } from '../../../../../src/session/launch/launch-readiness.js';

function harness(opts: { stopOnEntry: boolean; state?: SessionState; ceilingMs?: number }) {
  const proxyManager = new EventEmitter();
  const session = { proxyManager, state: opts.state ?? SessionState.INITIALIZING } as any;
  const ctx = {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    getSession: () => session
  } as any;
  const policy = {
    isSessionReady: (state: SessionState, o?: { stopOnEntry?: boolean }) =>
      state === SessionState.PAUSED || (!o?.stopOnEntry && state === SessionState.RUNNING)
  } as any;
  let outcome: LaunchReadinessOutcome | undefined;
  void waitForLaunchReadiness(ctx, {
    session, sessionId: 's1', policy, dapLaunchArgs: { stopOnEntry: opts.stopOnEntry },
    ceilingMs: opts.ceilingMs ?? 30_000
  }).then((settled) => { outcome = settled; });
  return { proxyManager, session, isSettled: () => outcome !== undefined, outcome: () => outcome, logger: ctx.logger };
}

describe('waitForLaunchReadiness', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('settles on adapter-configured when the policy is ready while running', async () => {
    const h = harness({ stopOnEntry: false });
    h.proxyManager.emit('adapter-configured');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.outcome()).toBe('configured');
    expect(h.logger.info).toHaveBeenCalledWith(expect.stringContaining('running (stopOnEntry=false)'));
  });

  it('ignores adapter-configured when the launch asked to stop on entry, and settles on the stop', async () => {
    const h = harness({ stopOnEntry: true });
    h.proxyManager.emit('adapter-configured');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.isSettled()).toBe(false);
    h.proxyManager.emit('stopped', 1, 'entry');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.outcome()).toBe('stopped');
  });

  it('settles on a terminal event', async () => {
    const h = harness({ stopOnEntry: false });
    h.proxyManager.emit('terminated');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.outcome()).toBe('ended');
    expect(h.logger.info).toHaveBeenCalledWith(expect.stringContaining('terminated during startup'));
  });

  it('settles at once when the session is already terminal', async () => {
    const h = harness({ stopOnEntry: false, state: SessionState.STOPPED });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.outcome()).toBe('already-terminal');
  });

  // The ceiling is the caller's (issue #815): 30 s when something is armed to
  // stop the program, a short grace when nothing is.
  it('settles at the given ceiling when nothing arrives, warning about the adapter only while still initializing', async () => {
    const h = harness({ stopOnEntry: false, ceilingMs: 5_000 });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(h.isSettled()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.outcome()).toBe('ceiling');
    expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Timed out waiting for debug adapter'));
  });

  it('reports the ceiling as the program running, not the adapter failing, when the session is RUNNING', async () => {
    const h = harness({ stopOnEntry: false, ceilingMs: 5_000 });
    h.session.state = SessionState.RUNNING;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.outcome()).toBe('ceiling');
    expect(h.logger.warn).not.toHaveBeenCalled();
    expect(h.logger.info).toHaveBeenCalledWith(expect.stringContaining('still running'));
  });
});
