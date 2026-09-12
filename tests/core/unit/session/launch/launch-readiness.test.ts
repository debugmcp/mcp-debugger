/**
 * waitForLaunchReadiness: which signals settle a launch that was not already
 * ready after the handshake. The module had no direct tests before; these
 * pin the four outcomes over a bare proxy-manager emitter.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { SessionState } from '@debugmcp/shared';
import { waitForLaunchReadiness } from '../../../../../src/session/launch/launch-readiness.js';

function harness(opts: { stopOnEntry: boolean; state?: SessionState }) {
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
  let settled = false;
  void waitForLaunchReadiness(ctx, {
    session, sessionId: 's1', policy, dapLaunchArgs: { stopOnEntry: opts.stopOnEntry }
  }).then(() => { settled = true; });
  return { proxyManager, isSettled: () => settled, logger: ctx.logger };
}

describe('waitForLaunchReadiness', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('settles on adapter-configured when the policy is ready while running', async () => {
    const h = harness({ stopOnEntry: false });
    h.proxyManager.emit('adapter-configured');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.isSettled()).toBe(true);
    expect(h.logger.info).toHaveBeenCalledWith(expect.stringContaining('running (stopOnEntry=false)'));
  });

  it('ignores adapter-configured when the launch asked to stop on entry, and settles on the stop', async () => {
    const h = harness({ stopOnEntry: true });
    h.proxyManager.emit('adapter-configured');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.isSettled()).toBe(false);
    h.proxyManager.emit('stopped', 1, 'entry');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.isSettled()).toBe(true);
  });

  it('settles on a terminal event', async () => {
    const h = harness({ stopOnEntry: false });
    h.proxyManager.emit('terminated');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.isSettled()).toBe(true);
    expect(h.logger.info).toHaveBeenCalledWith(expect.stringContaining('terminated during startup'));
  });

  it('settles at the ceiling when nothing arrives, with a warning', async () => {
    const h = harness({ stopOnEntry: false });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(h.isSettled()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.isSettled()).toBe(true);
    expect(h.logger.warn).toHaveBeenCalled();
  });
});
