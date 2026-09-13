/**
 * In-flight guard for start_debugging / restart_debugging / attach_to_process
 * (issue #711).
 *
 * The MCP SDK dispatches tool calls concurrently and the state machine alone
 * cannot tell "a launch is being awaited" from "the program is running": a
 * JavaScript launch projects RUNNING the moment the child is adopted while
 * start_debugging is still parked on the launch barrier. A second launch-
 * shaped call in that window used to pass the state guard, tear down the
 * barrier the first call was awaiting, and both calls reported success for a
 * proxy that was being torn down. The guard refuses the second call up front.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('SessionManager - in-flight launch guard (issue #711)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    dependencies = createMockDependencies();
    const config: SessionManagerConfig = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: { stopOnEntry: true, justMyCode: true }
    };
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    dependencies.mockProxyManager.reset();
  });

  /**
   * Park the next proxy start until released: the launch (or attach) that
   * reaches it stays in flight, exactly where a concurrent call would find it.
   * `release()` lets the real mock start run; `fail()` rejects it.
   */
  function parkNextProxyStart() {
    const gate = deferred();
    const proxy = dependencies.mockProxyManager;
    const realStart = proxy.start.bind(proxy);
    vi.spyOn(proxy, 'start').mockImplementationOnce(async (config) => {
      await gate.promise;
      return realStart(config);
    });
    return { release: gate.resolve, fail: gate.reject };
  }

  async function createSession() {
    return sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
  }

  it('refuses a second start_debugging while the first is in flight, and leaves the first alone', async () => {
    const session = await createSession();
    const park = parkNextProxyStart();

    const first = sessionManager.startDebugging(session.id, 'test.py');
    const second = await sessionManager.startDebugging(session.id, 'test.py');

    expect(second.success).toBe(false);
    expect(second.error).toMatch(/launch is already in progress/i);
    expect(second.error).toContain('start_debugging');
    // The refused call must not have torn the first launch down
    expect(dependencies.mockProxyManager.stopCalls).toBe(0);

    park.release();
    const result = await first;
    expect(result.success).toBe(true);
    expect(dependencies.mockProxyManager.startCalls).toHaveLength(1);
  });

  it('refuses restart_debugging while a launch is in flight', async () => {
    const session = await createSession();
    const park = parkNextProxyStart();

    const first = sessionManager.startDebugging(session.id, 'test.py');
    const restart = await sessionManager.restartDebugging(session.id);

    expect(restart.success).toBe(false);
    expect(restart.error).toMatch(/launch is already in progress/i);
    expect(restart.error).toContain('restart_debugging');
    expect(dependencies.mockProxyManager.stopCalls).toBe(0);

    park.release();
    await expect(first).resolves.toMatchObject({ success: true });
  });

  it('refuses attach_to_process while a launch is in flight', async () => {
    const session = await createSession();
    const park = parkNextProxyStart();

    const first = sessionManager.startDebugging(session.id, 'test.py');
    const attach = await sessionManager.attachToProcess(session.id, { port: 5678 });

    expect(attach.success).toBe(false);
    expect(attach.error).toMatch(/launch is already in progress/i);
    expect(attach.error).toContain('attach_to_process');
    expect(dependencies.mockProxyManager.stopCalls).toBe(0);

    park.release();
    await expect(first).resolves.toMatchObject({ success: true });
  });

  it('refuses start_debugging and restart_debugging while an attach is in flight, then releases the guard when the attach fails', async () => {
    const session = await createSession();
    const park = parkNextProxyStart();

    const attach = sessionManager.attachToProcess(session.id, { port: 5678 });
    const start = await sessionManager.startDebugging(session.id, 'test.py');
    const restart = await sessionManager.restartDebugging(session.id);

    expect(start.success).toBe(false);
    expect(start.error).toMatch(/attach is already in progress/i);
    expect(restart.success).toBe(false);
    expect(restart.error).toMatch(/attach is already in progress/i);

    park.fail(new Error('adapter exited'));
    const attachResult = await attach;
    expect(attachResult.success).toBe(false);
    expect(attachResult.error).toContain('adapter exited');

    // A failed attach must release the guard: the next launch proceeds
    const next = await sessionManager.startDebugging(session.id, 'test.py');
    expect(next.success).toBe(true);
  });

  it('refuses a second restart_debugging while the first is replaying', async () => {
    const session = await createSession();
    await sessionManager.startDebugging(session.id, 'test.py');
    const park = parkNextProxyStart();

    const first = sessionManager.restartDebugging(session.id);
    const second = await sessionManager.restartDebugging(session.id);

    expect(second.success).toBe(false);
    expect(second.error).toMatch(/restart is already in progress/i);

    park.release();
    await expect(first).resolves.toMatchObject({ success: true });
  });

  it('releases the guard when a launch fails, so the next start is not refused', async () => {
    const session = await createSession();
    dependencies.mockProxyManager.shouldFailStart = true;

    const failed = await sessionManager.startDebugging(session.id, 'test.py');
    expect(failed.success).toBe(false);

    dependencies.mockProxyManager.shouldFailStart = false;
    const next = await sessionManager.startDebugging(session.id, 'test.py');
    expect(next.success).toBe(true);
  });

  it('still lets a sequential second start_debugging supersede the first launch', async () => {
    const session = await createSession();
    await sessionManager.startDebugging(session.id, 'test.py');

    const again = await sessionManager.startDebugging(session.id, 'test.py');

    expect(again.success).toBe(true);
    expect(dependencies.mockProxyManager.stopCalls).toBe(1);
    expect(dependencies.mockProxyManager.startCalls).toHaveLength(2);
  });
});
