/**
 * A launch that fails after the proxy started quotes the output the adapter
 * produced before the failure (issue #1036): Delve answers a build failure
 * with "Build error: Check the debug console for details." and the compiler's
 * message is in the DAP output events the session already captured — the
 * agent should not need a second call to learn why the build failed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '@debugmcp/shared';
import { createMockDependencies, setMockProxyRunning } from './session-manager-test-utils.js';

describe('SessionManager.startDebugging - the output before a launch failure (issue #1036)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    const config: SessionManagerConfig = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: { stopOnEntry: false, justMyCode: true }
    };
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(async () => {
    await sessionManager.closeAllSessions();
    vi.useRealTimers();
  });

  const BUILD_LINES = [
    { category: 'stdout', output: 'Building /proj/exit_code\n' },
    {
      category: 'stderr',
      output:
        'Build Error: go build -o /proj/__debug_bin -gcflags all=-N -l /proj/exit_code\n' +
        'main module (example/go-debug-test) does not contain package example/go-debug-test/exit_code (exit status 1)\n'
    }
  ];
  const DELVE_ERROR =
    'Critical initialization error: Failed to launch: Build error: Check the debug console for details. [Adapter command: dlv dap]';

  /** Replace the mock proxy's start with one that forwards output events and then rejects. */
  function failDuringStartup(outputs: Array<{ category: string; output: string }>, error: Error): void {
    dependencies.mockProxyManager.start = vi.fn().mockImplementation(async (startConfig) => {
      setMockProxyRunning(dependencies.mockProxyManager, true);
      dependencies.mockProxyManager.startCalls.push(startConfig);
      for (const body of outputs) {
        dependencies.mockProxyManager.emit('output', body);
      }
      throw error;
    }) as any;
  }

  async function launch(sessionId: string) {
    const started = sessionManager.startDebugging(sessionId, '/proj/exit_code', [], { stopOnEntry: false });
    await vi.runAllTimersAsync();
    return started;
  }

  it("quotes the adapter's output ahead of the failure, after its own error", async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    failDuringStartup(BUILD_LINES, new Error(DELVE_ERROR));

    const result = await launch(session.id);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/^Critical initialization error: Failed to launch: Build error: Check the debug console for details\. \[Adapter command: dlv dap\]/);
    expect(result.error).toMatch(/output before the failure/);
    expect(result.error).toContain('does not contain package example/go-debug-test/exit_code (exit status 1)');
    expect(result.error).toContain('Building /proj/exit_code');
    // The buffer keeps everything; get_output is where the rest is.
    expect(result.error).toMatch(/get_output/);
  });

  it('keeps the error as it is when nothing was captured before the failure', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    failDuringStartup([], new Error(DELVE_ERROR));

    const result = await launch(session.id);

    expect(result.success).toBe(false);
    expect(result.error).toBe(DELVE_ERROR);
  });

  it('quotes only this attempt: a failure before the proxy starts never shows an earlier run\'s output', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    failDuringStartup(BUILD_LINES, new Error(DELVE_ERROR));
    await launch(session.id);

    // The second attempt dies before the proxy starts (the adapter cannot be
    // created), with the first attempt's buffer still on the session.
    vi.mocked(dependencies.adapterRegistry.create).mockRejectedValueOnce(new Error('adapter unavailable'));
    const result = await launch(session.id);

    expect(result.success).toBe(false);
    expect(result.error).toContain('adapter unavailable');
    expect(result.error).not.toMatch(/output before the failure/);
    expect(result.error).not.toContain('does not contain package');
  });

  it('bounds the quote to the last lines', async () => {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK });
    const many = Array.from({ length: 30 }, (_, i) => ({ category: 'stdout', output: `line ${i + 1}\n` }));
    failDuringStartup(many, new Error(DELVE_ERROR));

    const result = await launch(session.id);

    expect(result.error).toContain('line 30');
    expect(result.error).toContain('line 23');
    expect(result.error).not.toContain('line 22\n');
    expect(result.error).toMatch(/last 8 lines/);
  });
});
