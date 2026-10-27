/**
 * `hot_reload` at the SessionManager layer (issue #876): one controller over the policy's
 * `liveUpdate` member. The Java cases are the former `redefine_classes` suite, byte-for-byte in
 * what they assert about the request and the answer; the Flutter-shaped cases drive a policy
 * whose request may stop the program before it answers (the reassemble hits a breakpoint), so the
 * answer races the stop against the response the way a launch answer does.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DartAdapterPolicy, DebugLanguage, JavaAdapterPolicy, MockAdapterPolicy, SessionState, type AdapterPolicy } from '@debugmcp/shared';
import { createMockDependencies, overridePolicy } from './session-manager-test-utils.js';

describe('SessionManager - hot_reload (issue #876)', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  let config: SessionManagerConfig;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    config = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: { stopOnEntry: true, justMyCode: true }
    };
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  /** Both policy lookups: the facade's (the controller reads it) and the store's (the core's event handler reads it). */
  function usePolicy(overrides: Partial<AdapterPolicy>) {
    overridePolicy(sessionManager, overrides);
    vi.spyOn(sessionManager as unknown as { selectPolicy: (l: string) => AdapterPolicy }, 'selectPolicy')
      .mockReturnValue({ ...MockAdapterPolicy, ...overrides } as AdapterPolicy);
  }

  async function createRunningSession() {
    const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    dependencies.mockProxyManager.simulateStopped(1, 'entry');
    dependencies.mockProxyManager.dapRequestCalls = [];
    return session;
  }

  describe('refusals', () => {
    it('refuses a language whose policy has no live update, by name, without touching the adapter', async () => {
      const session = await createRunningSession();
      const result = await sessionManager.hotReload(session.id, {});
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/hot_reload is not supported by the mock adapter/);
      expect(dependencies.mockProxyManager.dapRequestCalls).toEqual([]);
    });

    it("answers the policy's own refusal, without touching the adapter", async () => {
      usePolicy({ liveUpdate: DartAdapterPolicy.liveUpdate });
      const session = await createRunningSession();
      const result = await sessionManager.hotReload(session.id, {});
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/runs `dart`/);
      expect(dependencies.mockProxyManager.dapRequestCalls).toEqual([]);
    });

    it('returns an error when the proxy is not running', async () => {
      usePolicy({ liveUpdate: JavaAdapterPolicy.liveUpdate });
      const session = await sessionManager.createSession({ language: DebugLanguage.MOCK, executablePath: 'python' });
      const result = await sessionManager.hotReload(session.id, { classesDir: '/path/to/classes' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No active debug session');
    });

    it('throws for a non-existent session', async () => {
      await expect(sessionManager.hotReload('nonexistent', { classesDir: '/path/to/classes' })).rejects.toThrow();
    });
  });

  describe('java: redefineClasses (the former redefine_classes answer)', () => {
    beforeEach(() => usePolicy({ liveUpdate: JavaAdapterPolicy.liveUpdate }));

    it('sends redefineClasses and returns the bridge\'s answer', async () => {
      const session = await createRunningSession();
      dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'redefineClasses') {
          return { success: true, body: { redefined: ['com.example.Foo', 'com.example.Bar'], redefinedCount: 2, skippedNotLoaded: 3, failedCount: 0, scannedFiles: 5, newestTimestamp: 1711500000000 } };
        }
        return { success: true };
      });

      const result = await sessionManager.hotReload(session.id, { classesDir: '/path/to/classes', sinceTimestamp: 1711400000000 });

      expect(result.success).toBe(true);
      expect(result.redefined).toEqual(['com.example.Foo', 'com.example.Bar']);
      expect(result.redefinedCount).toBe(2);
      expect(result.skippedNotLoaded).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.scannedFiles).toBe(5);
      expect(result.newestTimestamp).toBe(1711500000000);
      const dapCall = dependencies.mockProxyManager.dapRequestCalls.find((c) => c.command === 'redefineClasses');
      expect(dapCall!.args).toEqual({ classesDir: '/path/to/classes', sinceTimestamp: 1711400000000 });
    });

    it('returns failures without blocking successful redefinitions', async () => {
      const session = await createRunningSession();
      dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'redefineClasses') {
          return { success: true, body: { redefined: ['com.example.Foo'], redefinedCount: 1, skippedNotLoaded: 0, failedCount: 1, failed: [{ fqcn: 'com.example.Bar', error: 'UnsupportedOperationException: schema change' }], scannedFiles: 2, newestTimestamp: 1711500000000 } };
        }
        return { success: true };
      });
      const result = await sessionManager.hotReload(session.id, { classesDir: '/path/to/classes' });
      expect(result.success).toBe(true);
      expect(result.redefinedCount).toBe(1);
      expect(result.failed).toEqual([{ fqcn: 'com.example.Bar', error: 'UnsupportedOperationException: schema change' }]);
    });

    it('defaults sinceTimestamp to 0', async () => {
      const session = await createRunningSession();
      dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => (
        command === 'redefineClasses' ? { success: true, body: { redefined: [], redefinedCount: 0, skippedNotLoaded: 0, failedCount: 0, scannedFiles: 0, newestTimestamp: 0 } } : { success: true }
      ));
      await sessionManager.hotReload(session.id, { classesDir: '/path/to/classes' });
      expect(dependencies.mockProxyManager.dapRequestCalls.find((c) => c.command === 'redefineClasses')!.args.sinceTimestamp).toBe(0);
    });

    it('refuses without classesDir, before any request', async () => {
      const session = await createRunningSession();
      const result = await sessionManager.hotReload(session.id, {});
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/classesDir/);
      expect(dependencies.mockProxyManager.dapRequestCalls).toEqual([]);
    });

    it('returns an error when the request fails, and when the answer has no body', async () => {
      const session = await createRunningSession();
      dependencies.mockProxyManager.shouldFailDapRequests = true;
      const failed = await sessionManager.hotReload(session.id, { classesDir: '/path/to/classes' });
      expect(failed.success).toBe(false);
      expect(failed.error).toBeDefined();

      dependencies.mockProxyManager.shouldFailDapRequests = false;
      dependencies.mockProxyManager.setDapRequestHandler(async () => ({ success: true }));
      const bodiless = await sessionManager.hotReload(session.id, { classesDir: '/path/to/classes' });
      expect(bodiless.success).toBe(false);
      expect(bodiless.error).toContain('No response body');
    });
  });

  describe('flutter-shaped: hotReload, which may stop the program before it answers', () => {
    beforeEach(() => usePolicy({ liveUpdate: DartAdapterPolicy.liveUpdate }));

    async function startedFlutterSession() {
      const session = await createRunningSession();
      // What the worker forwards once the app is up (policy liveUpdate.events).
      dependencies.mockProxyManager.emit('dap-event', 'flutter.appStart', { launchMode: 'run', supportsRestart: true });
      dependencies.mockProxyManager.emit('dap-event', 'flutter.appStarted', {});
      return session;
    }

    it('learns the app has started from the forwarded events, then sends hotReload', async () => {
      const session = await startedFlutterSession();
      dependencies.mockProxyManager.setDapRequestHandler(async () => ({ success: true, body: {} }));
      const resultPromise = sessionManager.hotReload(session.id, {});
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(dependencies.mockProxyManager.dapRequestCalls.map((c) => c.command)).toEqual(['hotReload']);
    });

    it('answers the stop the reassemble lands on, even while the adapter still holds the response', async () => {
      const session = await startedFlutterSession();
      dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'hotReload') {
          // Measured on web: the response waits for the paused isolate to resume.
          await new Promise((resolve) => setTimeout(resolve, 60_000));
          return { success: true, body: {} };
        }
        return { success: true };
      });
      await sessionManager.continue(session.id);
      await vi.advanceTimersByTimeAsync(10);
      const resultPromise = sessionManager.hotReload(session.id, {});
      await vi.advanceTimersByTimeAsync(50);
      dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
      await vi.advanceTimersByTimeAsync(50);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.state).toBe(SessionState.PAUSED);
      expect(result.reason).toBe('breakpoint');
      await vi.runAllTimersAsync();
    });

    it('answers running with pending when neither a stop nor the response arrives within the hold', async () => {
      const session = await startedFlutterSession();
      dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'hotReload') {
          await new Promise((resolve) => setTimeout(resolve, 60_000));
          return { success: true, body: {} };
        }
        return { success: true };
      });
      // The session is paused at entry from createRunningSession; a reload sent while paused
      // leaves it paused (measured) — so resume it first to shape the running case.
      await sessionManager.continue(session.id);
      await vi.advanceTimersByTimeAsync(10);
      const resultPromise = sessionManager.hotReload(session.id, {});
      await vi.advanceTimersByTimeAsync(5_000);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.pending).toBe(true);
      expect(result.state).toBe(SessionState.RUNNING);
      await vi.runAllTimersAsync();
    });
  });
});
