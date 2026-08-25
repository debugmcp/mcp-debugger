/**
 * SessionManager redefineClasses tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

describe('SessionManager - redefineClasses', () => {
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

  async function createRunningSession() {
    const session = await sessionManager.createSession({
      language: DebugLanguage.MOCK,
      executablePath: 'python'
    });

    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();

    // Simulate being paused so session is active
    dependencies.mockProxyManager.simulateStopped(1, 'entry');

    // Clear previous calls
    dependencies.mockProxyManager.dapRequestCalls = [];

    return session;
  }

  it('should send redefineClasses DAP request and return result', async () => {
    const session = await createRunningSession();

    dependencies.mockProxyManager.setDapRequestHandler(async (command: string, args?: any) => {
      if (command === 'redefineClasses') {
        return {
          success: true,
          body: {
            redefined: ['com.example.Foo', 'com.example.Bar'],
            redefinedCount: 2,
            skippedNotLoaded: 3,
            failedCount: 0,
            scannedFiles: 5,
            newestTimestamp: 1711500000000,
          }
        };
      }
      return { success: true };
    });

    const result = await sessionManager.redefineClasses(
      session.id,
      '/path/to/classes',
      1711400000000
    );

    expect(result.success).toBe(true);
    expect(result.redefined).toEqual(['com.example.Foo', 'com.example.Bar']);
    expect(result.redefinedCount).toBe(2);
    expect(result.skippedNotLoaded).toBe(3);
    expect(result.failedCount).toBe(0);
    expect(result.scannedFiles).toBe(5);
    expect(result.newestTimestamp).toBe(1711500000000);

    const dapCall = dependencies.mockProxyManager.dapRequestCalls.find(
      c => c.command === 'redefineClasses'
    );
    expect(dapCall).toBeDefined();
    expect(dapCall!.args).toEqual({
      classesDir: '/path/to/classes',
      sinceTimestamp: 1711400000000,
    });
  });

  it('should return failures without blocking successful redefinitions', async () => {
    const session = await createRunningSession();

    dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
      if (command === 'redefineClasses') {
        return {
          success: true,
          body: {
            redefined: ['com.example.Foo'],
            redefinedCount: 1,
            skippedNotLoaded: 0,
            failedCount: 1,
            failed: [{ fqcn: 'com.example.Bar', error: 'UnsupportedOperationException: schema change' }],
            scannedFiles: 2,
            newestTimestamp: 1711500000000,
          }
        };
      }
      return { success: true };
    });

    const result = await sessionManager.redefineClasses(session.id, '/path/to/classes');

    expect(result.success).toBe(true);
    expect(result.redefinedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.failed).toEqual([
      { fqcn: 'com.example.Bar', error: 'UnsupportedOperationException: schema change' }
    ]);
  });

  it('should default sinceTimestamp to 0', async () => {
    const session = await createRunningSession();

    dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
      if (command === 'redefineClasses') {
        return {
          success: true,
          body: {
            redefined: [],
            redefinedCount: 0,
            skippedNotLoaded: 0,
            failedCount: 0,
            scannedFiles: 0,
            newestTimestamp: 0,
          }
        };
      }
      return { success: true };
    });

    await sessionManager.redefineClasses(session.id, '/path/to/classes');

    const dapCall = dependencies.mockProxyManager.dapRequestCalls.find(
      c => c.command === 'redefineClasses'
    );
    expect(dapCall!.args.sinceTimestamp).toBe(0);
  });

  it('should return error when proxy is not running', async () => {
    const session = await sessionManager.createSession({
      language: DebugLanguage.MOCK,
      executablePath: 'python'
    });

    // Session created but not started — no proxy running
    const result = await sessionManager.redefineClasses(session.id, '/path/to/classes');

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active debug session');
  });

  it('should return error when DAP request fails', async () => {
    const session = await createRunningSession();

    dependencies.mockProxyManager.shouldFailDapRequests = true;

    const result = await sessionManager.redefineClasses(session.id, '/path/to/classes');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error when response has no body', async () => {
    const session = await createRunningSession();

    dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
      if (command === 'redefineClasses') {
        return { success: true };
      }
      return { success: true };
    });

    const result = await sessionManager.redefineClasses(session.id, '/path/to/classes');

    expect(result.success).toBe(false);
    expect(result.error).toContain('No response body');
  });

  it('should throw for non-existent session', async () => {
    await expect(
      sessionManager.redefineClasses('nonexistent', '/path/to/classes')
    ).rejects.toThrow();
  });

  it('forwards a timeout override to the DAP request (issue #142)', async () => {
    const session = await createRunningSession();

    dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
      if (command === 'redefineClasses') {
        return {
          success: true,
          body: {
            redefined: [],
            redefinedCount: 0,
            skippedNotLoaded: 0,
            failedCount: 0,
            scannedFiles: 0,
            newestTimestamp: 0,
          }
        };
      }
      return { success: true };
    });

    await sessionManager.redefineClasses(session.id, '/path/to/classes', 0, 120000);

    const dapCall = dependencies.mockProxyManager.dapRequestCalls.find(
      c => c.command === 'redefineClasses'
    );
    expect(dapCall).toBeDefined();
    expect(dapCall!.options).toEqual({ timeoutMs: 120000 });
  });

  it('rejects a non-positive timeout override', async () => {
    const session = await createRunningSession();

    const result = await sessionManager.redefineClasses(session.id, '/path/to/classes', 0, -5);

    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
    expect(dependencies.mockProxyManager.dapRequestCalls).toHaveLength(0);
  });

  it('appends a hint naming the timeout arg when the request times out', async () => {
    const session = await createRunningSession();

    dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
      if (command === 'redefineClasses') {
        throw new Error("Request 'redefineClasses' timed out after 30s");
      }
      return { success: true };
    });

    const result = await sessionManager.redefineClasses(session.id, '/path/to/classes');

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    expect(result.error).toContain("larger 'timeout'");
  });
});

describe('SessionManager - redefineClasses anchor re-resolution (issue #464)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    sessionManager = new SessionManager(
      { logDirBase: '/tmp/test-sessions', defaultDapLaunchArgs: { stopOnEntry: true, justMyCode: true } },
      dependencies
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  async function createSessionWithAnchoredBp() {
    const session = await sessionManager.createSession({
      language: DebugLanguage.MOCK,
      executablePath: 'python'
    });
    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    dependencies.mockProxyManager.simulateStopped(1, 'entry');

    await sessionManager.setBreakpoint(session.id, {
      file: '/proj/RedefineTarget.java',
      line: 11,
      anchor: { statement: 'return 42/99;' }
    });
    dependencies.mockProxyManager.dapRequestCalls = [];
    return session;
  }

  it('re-resolves statement anchors against the new source and re-sends the file', async () => {
    const session = await createSessionWithAnchoredBp();

    // Post-swap source: a 3-line-longer header shifts the statement 11 -> 14.
    const newSource = [
      ...Array.from({ length: 13 }, (_, i) => `// header ${i + 1}`),
      '        return 42/99;',
      '    }'
    ].join('\n');
    (dependencies.mockFileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(newSource);

    dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
      if (command === 'redefineClasses') {
        return {
          success: true,
          body: { redefined: ['RedefineTarget'], redefinedCount: 1, skippedNotLoaded: 0, failedCount: 0, scannedFiles: 1, newestTimestamp: 1, replantedBreakpoints: 1 }
        };
      }
      if (command === 'setBreakpoints') {
        return { success: true, body: { breakpoints: [{ verified: true, line: 14, id: 7 }] } };
      }
      return { success: true };
    });

    const result = await sessionManager.redefineClasses(session.id, '/classes');

    expect(result.success).toBe(true);
    expect(result.anchorResolution?.moved).toEqual([
      expect.objectContaining({ file: '/proj/RedefineTarget.java', from: 11, to: 14, statement: 'return 42/99;' })
    ]);
    expect(result.anchorResolution?.stale).toEqual([]);

    // The moved line was re-sent to the adapter AFTER the redefine.
    const calls = dependencies.mockProxyManager.dapRequestCalls;
    const redefineIdx = calls.findIndex(c => c.command === 'redefineClasses');
    const setBpIdx = calls.findIndex(c => c.command === 'setBreakpoints');
    expect(setBpIdx).toBeGreaterThan(redefineIdx);
    expect((calls[setBpIdx].args as { breakpoints?: Array<{ line: number }> }).breakpoints).toEqual([
      expect.objectContaining({ line: 14 })
    ]);

    // The store reflects the moved line.
    const bps = sessionManager.listBreakpoints(session.id);
    expect(bps[0].line).toBe(14);
  });

  it('reports a stale anchor with a warning when the statement is gone', async () => {
    const session = await createSessionWithAnchoredBp();

    (dependencies.mockFileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      'public class RedefineTarget {\n    // statement deleted entirely\n}\n'
    );

    dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
      if (command === 'redefineClasses') {
        return {
          success: true,
          body: { redefined: ['RedefineTarget'], redefinedCount: 1, skippedNotLoaded: 0, failedCount: 0, scannedFiles: 1, newestTimestamp: 1, replantedBreakpoints: 1 }
        };
      }
      return { success: true };
    });

    const result = await sessionManager.redefineClasses(session.id, '/classes');

    expect(result.success).toBe(true);
    expect(result.anchorResolution?.moved).toEqual([]);
    expect(result.anchorResolution?.stale).toEqual([
      expect.objectContaining({ file: '/proj/RedefineTarget.java', line: 11, reason: 'statement not found' })
    ]);
    expect(result.warning).toMatch(/could not be re-resolved/);
  });

  it('skips anchor work entirely when nothing was redefined', async () => {
    const session = await createSessionWithAnchoredBp();

    dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
      if (command === 'redefineClasses') {
        return {
          success: true,
          body: { redefined: [], redefinedCount: 0, skippedNotLoaded: 1, failedCount: 0, scannedFiles: 1, newestTimestamp: 1 }
        };
      }
      return { success: true };
    });

    const result = await sessionManager.redefineClasses(session.id, '/classes');

    expect(result.success).toBe(true);
    expect(result.anchorResolution).toBeUndefined();
    expect(dependencies.mockFileSystem.readFile).not.toHaveBeenCalled();
  });
});
