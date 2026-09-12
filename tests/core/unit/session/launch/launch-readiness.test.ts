/**
 * waitForLaunchReadiness: how a launch settles on the configured signal.
 *
 * For a policy whose child adoption can race the first stop (js-debug:
 * pauseAfterChildAttach), "configured" gives an in-flight first stop a short
 * grace to win, so a breakpoint on a module-load line still reports paused
 * rather than a running that flips a few milliseconds later (issue #704).
 * Every other policy settles on it immediately, as before.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { SessionState } from '@debugmcp/shared';
import {
  waitForLaunchReadiness,
  LAUNCH_CONFIGURED_GRACE_MS
} from '../../../../../src/session/launch/launch-readiness.js';

function harness(opts: { pauseAfterChildAttach: boolean; stopOnEntry: boolean; state?: SessionState }) {
  const proxyManager = new EventEmitter();
  const session = { proxyManager, state: opts.state ?? SessionState.INITIALIZING } as any;
  const ctx = {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    getSession: () => session
  } as any;
  const policy = {
    isSessionReady: (state: SessionState, o?: { stopOnEntry?: boolean }) =>
      state === SessionState.PAUSED || (!o?.stopOnEntry && state === SessionState.RUNNING),
    getDapClientBehavior: () => ({ pauseAfterChildAttach: opts.pauseAfterChildAttach })
  } as any;
  let settled = false;
  const done = waitForLaunchReadiness(ctx, {
    session, sessionId: 's1', policy, dapLaunchArgs: { stopOnEntry: opts.stopOnEntry }
  }).then(() => { settled = true; });
  return { proxyManager, session, done, isSettled: () => settled, logger: ctx.logger };
}

describe('waitForLaunchReadiness on adapter-configured', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('settles immediately for a policy without a child adoption race', async () => {
    const h = harness({ pauseAfterChildAttach: false, stopOnEntry: false });
    h.proxyManager.emit('adapter-configured');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.isSettled()).toBe(true);
  });

  it('holds the configured signal for the grace and settles running when nothing stops', async () => {
    const h = harness({ pauseAfterChildAttach: true, stopOnEntry: false });
    h.proxyManager.emit('adapter-configured');
    await vi.advanceTimersByTimeAsync(LAUNCH_CONFIGURED_GRACE_MS - 1);
    expect(h.isSettled()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.isSettled()).toBe(true);
  });

  it('lets a first stop inside the grace win', async () => {
    const h = harness({ pauseAfterChildAttach: true, stopOnEntry: false });
    h.proxyManager.emit('adapter-configured');
    await vi.advanceTimersByTimeAsync(20);
    h.proxyManager.emit('stopped', 1, 'breakpoint');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.isSettled()).toBe(true);
    expect(h.logger.info).toHaveBeenCalledWith(expect.stringContaining('stopped on entry'));
  });

  it('ignores the configured signal when the launch asked to stop on entry', async () => {
    const h = harness({ pauseAfterChildAttach: true, stopOnEntry: true });
    h.proxyManager.emit('adapter-configured');
    await vi.advanceTimersByTimeAsync(LAUNCH_CONFIGURED_GRACE_MS + 1);
    expect(h.isSettled()).toBe(false);
    h.proxyManager.emit('stopped', 1, 'entry');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.isSettled()).toBe(true);
  });

  it('a terminal event during the grace settles at once', async () => {
    const h = harness({ pauseAfterChildAttach: true, stopOnEntry: false });
    h.proxyManager.emit('adapter-configured');
    await vi.advanceTimersByTimeAsync(20);
    h.proxyManager.emit('terminated');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.isSettled()).toBe(true);
  });
});
