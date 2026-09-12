/**
 * startDebugging on a launch that ended before it could report a pause
 * (issue #701): the result says how the program ended, carries the exit
 * code, and lists the breakpoints it ran past — or names the stop that
 * landed in the same tick as the exit.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';
import type { MockProxyManager } from '../../../test-utils/mocks/mock-proxy-manager.js';

function setMockProxyRunning(proxyManager: MockProxyManager, running: boolean): void {
  (proxyManager as unknown as { _isRunning: boolean })._isRunning = running;
}

describe('SessionManager.startDebugging - run to completion (issue #701)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  let config: SessionManagerConfig;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    config = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true }
    };
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(async () => {
    await sessionManager.closeAllSessions();
    vi.useRealTimers();
  });

  /** Replace the mock proxy's start with one that ends the program during startup. */
  function endDuringStartup(
    exitCode: number | undefined,
    options: {
      synced?: Array<{ id: string; file: string; line: number; verified: boolean }>;
      stopFirst?: { threadId: number; reason: string; hitBreakpointIds?: number[] };
    } = {}
  ): void {
    dependencies.mockProxyManager.start = vi.fn().mockImplementation(async (startConfig) => {
      setMockProxyRunning(dependencies.mockProxyManager, true);
      dependencies.mockProxyManager.startCalls.push(startConfig);
      process.nextTick(() => {
        if (options.synced) {
          dependencies.mockProxyManager.emit('breakpoints-synced', options.synced);
        }
        if (options.stopFirst) {
          dependencies.mockProxyManager.emit('stopped', options.stopFirst.threadId, options.stopFirst.reason, {
            reason: options.stopFirst.reason,
            threadId: options.stopFirst.threadId,
            hitBreakpointIds: options.stopFirst.hitBreakpointIds
          });
        }
        dependencies.mockProxyManager.emit('exited', exitCode);
      });
    }) as any;
  }

  async function launch(sessionId: string) {
    const startPromise = sessionManager.startDebugging(sessionId, '/work/dist/app.js', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    return startPromise;
  }

  it('reports a non-zero exit and the verified breakpoint the program ran past', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    const { breakpoint } = await sessionManager.setBreakpoint(session.id, { file: '/work/src/app.ts', line: 91 });
    endDuringStartup(3, { synced: [{ id: breakpoint.id, file: '/work/src/app.ts', line: 91, verified: true }] });

    const result = await launch(session.id);

    expect(result.success).toBe(true);
    expect(result.state).toBe(SessionState.STOPPED);
    expect(result.data?.exitCode).toBe(3);
    expect(result.data?.unhitBreakpoints).toEqual([{ file: '/work/src/app.ts', line: 91, verified: true }]);
    expect(result.data?.message).toBe(
      'Debugging started for /work/dist/app.js. Current state: stopped. The program exited with code 3 without hitting any breakpoint. Verified but never hit: app.ts:91.'
    );
    // A verified breakpoint is not an unbound one: no #467 warning for it
    expect(result.data?.warning ?? '').not.toMatch(/never bound/);
  });

  it('keeps the unbound warning for a breakpoint that never bound', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    const { breakpoint } = await sessionManager.setBreakpoint(session.id, { file: '/work/src/app.ts', line: 91 });
    endDuringStartup(0, { synced: [{ id: breakpoint.id, file: '/work/src/app.ts', line: 91, verified: false }] });

    const result = await launch(session.id);

    expect(result.state).toBe(SessionState.STOPPED);
    expect(result.data?.exitCode).toBe(0);
    expect(result.data?.unhitBreakpoints).toEqual([{ file: '/work/src/app.ts', line: 91, verified: false }]);
    expect(result.data?.message).toBe(
      'Debugging started for /work/dist/app.js. Current state: stopped. The program ran to completion (exit code 0) without hitting any breakpoint.'
    );
    expect(result.data?.warning).toMatch(/1 breakpoint\(s\) never bound/);
  });

  it('says the exit code went unreported when the debuggee never sent one', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    endDuringStartup(undefined);

    const result = await launch(session.id);

    expect(result.state).toBe(SessionState.STOPPED);
    expect(result.data).not.toHaveProperty('exitCode');
    expect(result.data?.unhitBreakpoints).toEqual([]);
    expect(result.data?.message).toBe(
      'Debugging started for /work/dist/app.js. Current state: stopped. The program ended without reporting an exit code.'
    );
  });

  it('names the stop instead of the breakpoint list when a stop and the exit arrive in one tick', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    const { breakpoint } = await sessionManager.setBreakpoint(session.id, { file: '/work/src/app.ts', line: 91 });
    endDuringStartup(0, {
      synced: [{ id: breakpoint.id, file: '/work/src/app.ts', line: 91, verified: true }],
      stopFirst: { threadId: 1, reason: 'breakpoint', hitBreakpointIds: [7] }
    });

    const result = await launch(session.id);

    expect(result.state).toBe(SessionState.STOPPED);
    expect(result.data).not.toHaveProperty('unhitBreakpoints');
    expect(result.data?.message).toBe(
      'Debugging started for /work/dist/app.js. Current state: stopped. The program ran to completion (exit code 0) after a stop the launch could not report (last stop: breakpoint).'
    );
  });

  it('leaves a launch that paused untouched', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    const startPromise = sessionManager.startDebugging(session.id, '/work/dist/app.js', [], { stopOnEntry: true });
    await vi.runAllTimersAsync();
    const result = await startPromise;

    expect(result.state).toBe(SessionState.PAUSED);
    expect(result.data).not.toHaveProperty('exitCode');
    expect(result.data).not.toHaveProperty('unhitBreakpoints');
    expect(result.data?.message).toBe('Debugging started for /work/dist/app.js. Current state: paused');
  });
});
