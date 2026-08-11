/**
 * SessionManager exposeSession / unexposeSession tests (issue #217)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

describe('SessionManager - exposeSession/unexposeSession', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  let config: SessionManagerConfig;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    config = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: {
        stopOnEntry: true,
        justMyCode: true
      }
    };

    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  async function createLaunchedSession(options?: { paused?: boolean }) {
    const session = await sessionManager.createSession({
      language: DebugLanguage.MOCK,
      executablePath: 'python'
    });

    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();

    if (options?.paused !== false) {
      dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
    }

    dependencies.mockProxyManager.dapRequestCalls = [];
    return session;
  }

  it('exposes a paused session: forwards mirrorExpose and returns the endpoint', async () => {
    const session = await createLaunchedSession();

    const result = await sessionManager.exposeSession(session.id);

    expect(result.success).toBe(true);
    expect(result.host).toBe('127.0.0.1');
    expect(result.port).toBe(43117);
    expect(result.token).toBe('mock-mirror-token');

    const dapCall = dependencies.mockProxyManager.dapRequestCalls.find(
      c => c.command === 'mirrorExpose'
    );
    expect(dapCall).toBeDefined();
    expect(dapCall!.args).toEqual({});

    const managed = sessionManager.getSession(session.id);
    expect(managed?.exposure).toMatchObject({
      host: '127.0.0.1',
      port: 43117,
      token: 'mock-mirror-token'
    });
    expect(typeof managed?.exposure?.exposedAt).toBe('number');
  });

  it('projects the endpoint into getAllSessions without the token', async () => {
    const session = await createLaunchedSession();
    await sessionManager.exposeSession(session.id);

    const [info] = sessionManager.getAllSessions().filter(s => s.id === session.id);
    expect(info.exposure).toEqual({ host: '127.0.0.1', port: 43117 });
    expect(JSON.stringify(info)).not.toContain('mock-mirror-token');
  });

  it('allows exposing a running (not paused) session', async () => {
    const session = await createLaunchedSession({ paused: false });

    const result = await sessionManager.exposeSession(session.id);

    expect(result.success).toBe(true);
    expect(result.port).toBe(43117);
  });

  it('returns a friendly error for a session that was never launched', async () => {
    const session = await sessionManager.createSession({
      language: DebugLanguage.MOCK,
      executablePath: 'python'
    });

    const result = await sessionManager.exposeSession(session.id);

    expect(result.success).toBe(false);
    expect(result.error).toContain('start_debugging or attach_to_process');
    expect(dependencies.mockProxyManager.dapRequestCalls).toHaveLength(0);
  });

  it('forwards every expose to the worker (idempotency lives worker-side)', async () => {
    const session = await createLaunchedSession();

    const first = await sessionManager.exposeSession(session.id);
    const second = await sessionManager.exposeSession(session.id);

    expect(first).toEqual(second);
    const calls = dependencies.mockProxyManager.dapRequestCalls.filter(
      c => c.command === 'mirrorExpose'
    );
    expect(calls).toHaveLength(2);
  });

  it('rejects a malformed mirrorExpose response body', async () => {
    const session = await createLaunchedSession();
    dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
      if (command === 'mirrorExpose') {
        return { success: true }; // no body
      }
      return { success: true };
    });

    const result = await sessionManager.exposeSession(session.id);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Malformed');
    expect(sessionManager.getSession(session.id)?.exposure).toBeUndefined();
  });

  it('surfaces DAP failures, with the timeout hint on timeouts', async () => {
    const session = await createLaunchedSession();
    dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
      if (command === 'mirrorExpose') {
        throw new Error("Request 'mirrorExpose' timed out after 30s");
      }
      return { success: true };
    });

    const result = await sessionManager.exposeSession(session.id);

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  });

  it('unexposes: forwards mirrorUnexpose and clears the record', async () => {
    const session = await createLaunchedSession();
    await sessionManager.exposeSession(session.id);

    const result = await sessionManager.unexposeSession(session.id);

    expect(result.success).toBe(true);
    expect(result.wasExposed).toBe(true);
    expect(result.closedClients).toBe(0);
    expect(sessionManager.getSession(session.id)?.exposure).toBeUndefined();
    expect(
      dependencies.mockProxyManager.dapRequestCalls.some(c => c.command === 'mirrorUnexpose')
    ).toBe(true);
  });

  it('unexpose without a prior expose still forwards and succeeds', async () => {
    const session = await createLaunchedSession();
    dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
      if (command === 'mirrorUnexpose') {
        return { success: true, body: { closed: false, closedClients: 0 } };
      }
      return { success: true };
    });

    const result = await sessionManager.unexposeSession(session.id);

    expect(result.success).toBe(true);
    expect(result.wasExposed).toBe(false);
    expect(
      dependencies.mockProxyManager.dapRequestCalls.some(c => c.command === 'mirrorUnexpose')
    ).toBe(true);
  });

  it('unexpose after the proxy stopped clears the stale record without a DAP call', async () => {
    const session = await createLaunchedSession();
    await sessionManager.exposeSession(session.id);
    dependencies.mockProxyManager.dapRequestCalls = [];

    await dependencies.mockProxyManager.stop();

    const result = await sessionManager.unexposeSession(session.id);

    expect(result.success).toBe(true);
    expect(result.wasExposed).toBe(false);
    expect(dependencies.mockProxyManager.dapRequestCalls).toHaveLength(0);
    expect(sessionManager.getSession(session.id)?.exposure).toBeUndefined();
  });

  it('the projection hides the endpoint once the proxy is no longer running', async () => {
    const session = await createLaunchedSession();
    await sessionManager.exposeSession(session.id);

    await dependencies.mockProxyManager.stop();

    const [info] = sessionManager.getAllSessions().filter(s => s.id === session.id);
    expect(info.exposure).toBeUndefined();
  });

  it('a relaunch clears the previous exposure record', async () => {
    const session = await createLaunchedSession();
    await sessionManager.exposeSession(session.id);
    expect(sessionManager.getSession(session.id)?.exposure).toBeDefined();

    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();

    expect(sessionManager.getSession(session.id)?.exposure).toBeUndefined();
    const [info] = sessionManager.getAllSessions().filter(s => s.id === session.id);
    expect(info.exposure).toBeUndefined();
  });

  it('throws for a non-existent session', async () => {
    await expect(sessionManager.exposeSession('nonexistent')).rejects.toThrow();
    await expect(sessionManager.unexposeSession('nonexistent')).rejects.toThrow();
  });
});
