/**
 * startDebugging on a launch that ran to completion (issue #701): the result
 * says the program exited, carries its exit code, and lists every line
 * breakpoint it ran past — verified ones included — with the entry-stop hint
 * when one of them was verified.
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

  /** Replace the mock proxy's start with one that ends the program before any stop. */
  function exitDuringStartup(
    exitCode: number | undefined,
    syncedBreakpoints?: Array<{ id: string; file: string; line: number; verified: boolean }>
  ): void {
    dependencies.mockProxyManager.start = vi.fn().mockImplementation(async (startConfig) => {
      setMockProxyRunning(dependencies.mockProxyManager, true);
      dependencies.mockProxyManager.startCalls.push(startConfig);
      process.nextTick(() => {
        if (syncedBreakpoints) {
          dependencies.mockProxyManager.emit('breakpoints-synced', syncedBreakpoints);
        }
        dependencies.mockProxyManager.emit('exited', exitCode);
      });
    }) as any;
  }

  it('reports the exit code and the verified breakpoint the program ran past, with the entry-stop hint', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    const { breakpoint } = await sessionManager.setBreakpoint(session.id, { file: '/work/src/app.ts', line: 91 });
    exitDuringStartup(3, [{ id: breakpoint.id, file: '/work/src/app.ts', line: 91, verified: true }]);

    const startPromise = sessionManager.startDebugging(session.id, '/work/dist/app.js', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    const result = await startPromise;

    expect(result.success).toBe(true);
    expect(result.state).toBe(SessionState.STOPPED);
    expect(result.data?.exitCode).toBe(3);
    expect(result.data?.unhitBreakpoints).toEqual([{ file: '/work/src/app.ts', line: 91, verified: true }]);
    expect(result.data?.message).toMatch(/ran to completion \(exit code 3\) without hitting any breakpoint/);
    expect(result.data?.message).toMatch(/dapLaunchArgs: \{ stopOnEntry: true \}/);
    // The verified breakpoint is not an unbound one: no #467 warning for it
    expect(result.data?.warning ?? '').not.toMatch(/never bound/);
  });

  it('keeps the unbound warning for a breakpoint that never bound and omits the hint', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    const { breakpoint } = await sessionManager.setBreakpoint(session.id, { file: '/work/src/app.ts', line: 91 });
    exitDuringStartup(0, [{ id: breakpoint.id, file: '/work/src/app.ts', line: 91, verified: false }]);

    const startPromise = sessionManager.startDebugging(session.id, '/work/dist/app.js', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    const result = await startPromise;

    expect(result.state).toBe(SessionState.STOPPED);
    expect(result.data?.exitCode).toBe(0);
    expect(result.data?.unhitBreakpoints).toEqual([{ file: '/work/src/app.ts', line: 91, verified: false }]);
    expect(result.data?.message).not.toMatch(/stopOnEntry/);
    expect(result.data?.warning).toMatch(/1 breakpoint\(s\) never bound/);
  });

  it('omits the exit code when the debuggee never reported one', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    exitDuringStartup(undefined);

    const startPromise = sessionManager.startDebugging(session.id, '/work/dist/app.js', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    const result = await startPromise;

    expect(result.state).toBe(SessionState.STOPPED);
    expect(result.data).not.toHaveProperty('exitCode');
    expect(result.data?.unhitBreakpoints).toEqual([]);
    expect(result.data?.message).toBe('Debugging started for /work/dist/app.js. Current state: stopped. The program ran to completion.');
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
