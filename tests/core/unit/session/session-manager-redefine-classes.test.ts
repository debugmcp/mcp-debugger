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
});
