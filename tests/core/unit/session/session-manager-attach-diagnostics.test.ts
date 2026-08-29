/**
 * Issue #561: a failed `attach_to_process` now writes the same structured
 * failure record a failed `start_debugging` writes.
 *
 * Before this, attach logged only `Failed to attach to process for session X`
 * plus the bare error and returned the #551 pointers. When the proxy died
 * during initialization, the adapter's own complaint lived only in the proxy
 * log, and nothing told anyone to go read it — the exact failure mode the
 * launch path had already been given a log tail for.
 *
 * The tail belongs in the log and nowhere else: `data` is what an agent reads
 * back, and its shape is pinned by the #551 suites.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import type { ProxyInitProgress } from '../../../../src/utils/error-messages.js';
import { createMockDependencies } from './session-manager-test-utils.js';

const initProgress: ProxyInitProgress = { transportConnected: true, pendingCommand: 'initialize' };

describe('SessionManager - attach failure diagnostics (issue #561)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    dependencies = createMockDependencies();
    const config: SessionManagerConfig = { logDirBase: path.join('/tmp', 'attach-diagnostics') };
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  /** Attach a session whose proxy dies during initialization. */
  async function attachAgainstADyingProxy(proxyLogContent: string) {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    vi.mocked(dependencies.mockFileSystem.readFile).mockResolvedValue(proxyLogContent);
    vi.spyOn(dependencies.mockProxyManager, 'start').mockRejectedValue(
      Object.assign(new Error('Debug proxy initialization did not complete within 30s'), {
        initProgress
      })
    );

    const result = await sessionManager.attachToProcess(session.id, {
      port: 5678,
      host: '127.0.0.1'
    });

    return { session, result };
  }

  it('logs the same errorDetails record the launch path logs, tail included', async () => {
    const { session, result } = await attachAgainstADyingProxy(
      ['[Worker] connecting to 127.0.0.1:5678', 'ECONNREFUSED — nothing is listening'].join('\n')
    );

    expect(result.success).toBe(false);
    expect(result.state).toBe(SessionState.ERROR);
    expect(dependencies.mockLogger.error).toHaveBeenCalledWith(
      `[SessionManager] Detailed error in attachToProcess for session ${session.id}:`,
      expect.objectContaining({
        message: 'Debug proxy initialization did not complete within 30s',
        initProgress,
        proxyLogTail: expect.stringContaining('ECONNREFUSED — nothing is listening')
      })
    );
  });

  it('keeps the log tail out of the tool result, whose shape callers depend on', async () => {
    const { result } = await attachAgainstADyingProxy('a very long proxy log');

    expect(result.data).toEqual({
      initProgress,
      proxyLogPath: expect.stringContaining('proxy-')
    });
  });

  it('points at the proxy log the proxy actually writes', async () => {
    const { session, result } = await attachAgainstADyingProxy('log content');

    const { proxyLogPath } = result.data as { proxyLogPath: string };
    expect(path.basename(proxyLogPath)).toBe(`proxy-${session.id}.log`);
    expect(dependencies.mockFileSystem.readFile).toHaveBeenCalledWith(proxyLogPath, 'utf-8');
  });

  it('still reports the failure when the proxy log cannot be read', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    vi.mocked(dependencies.mockFileSystem.readFile).mockRejectedValue(new Error('permission denied'));
    vi.spyOn(dependencies.mockProxyManager, 'start').mockRejectedValue(new Error('adapter exited'));

    const result = await sessionManager.attachToProcess(session.id, { port: 5678 });

    expect(result.error).toContain('adapter exited');
    expect(dependencies.mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Detailed error in attachToProcess'),
      expect.objectContaining({
        proxyLogTail: '<<Failed to read proxy log: permission denied>>'
      })
    );
  });
});
