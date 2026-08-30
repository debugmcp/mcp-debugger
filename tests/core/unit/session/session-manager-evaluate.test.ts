/**
 * evaluateExpression default-frame resolution (coverage sprint).
 *
 * When no frameId is given, the session manager anchors evaluation to the
 * top frame of the current thread's stack — this suite pins the guard rails
 * around that resolution (not paused, no thread, no frames, stack errors).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

function makeManager(launchArgs: { stopOnEntry: boolean } = { stopOnEntry: true }) {
  const dependencies = createMockDependencies();
  const config: SessionManagerConfig = {
    logDirBase: '/tmp/test-sessions',
    defaultDapLaunchArgs: { stopOnEntry: launchArgs.stopOnEntry, justMyCode: true }
  };
  return { sessionManager: new SessionManager(config, dependencies), dependencies };
}

async function createRunningSession(
  sessionManager: SessionManager,
  dependencies: ReturnType<typeof createMockDependencies>,
  opts: { paused?: boolean } = {}
) {
  const session = await sessionManager.createSession({
    language: DebugLanguage.MOCK,
    executablePath: 'python'
  });
  await sessionManager.startDebugging(session.id, 'test.py');
  await vi.runAllTimersAsync();
  if (opts.paused !== false) {
    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
  }
  return session;
}

describe('SessionManager.evaluateExpression default-frame resolution', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('refuses to evaluate while the session is not paused', async () => {
    const { sessionManager, dependencies } = makeManager({ stopOnEntry: false });
    const session = await createRunningSession(sessionManager, dependencies, { paused: false });

    const result = await sessionManager.evaluateExpression(session.id, '1 + 1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not paused');
  });

  it('fails cleanly when no current thread id is known', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createRunningSession(sessionManager, dependencies);
    (dependencies.mockProxyManager as unknown as { _currentThreadId: number | null })._currentThreadId = null;

    const result = await sessionManager.evaluateExpression(session.id, 'x');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to find thread');
  });

  it('anchors evaluation to the top stack frame when frameId is omitted', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createRunningSession(sessionManager, dependencies);

    const evaluateArgs: unknown[] = [];
    dependencies.mockProxyManager.setDapRequestHandler(async (command: string, args?: unknown) => {
      if (command === 'stackTrace') {
        return { body: { stackFrames: [{ id: 99, name: 'top', line: 1, column: 1 }] } };
      }
      if (command === 'evaluate') {
        evaluateArgs.push(args);
        return { body: { result: '2', type: 'int', variablesReference: 0 } };
      }
      return { success: true };
    });

    const result = await sessionManager.evaluateExpression(session.id, '1 + 1');

    expect(result.success).toBe(true);
    expect(evaluateArgs[0]).toMatchObject({ frameId: 99 });
  });

  it('treats an explicit frameId as authoritative without resolving a stack', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createRunningSession(sessionManager, dependencies);
    const commands: string[] = [];
    dependencies.mockProxyManager.setDapRequestHandler(async (command: string, args?: unknown) => {
      commands.push(command);
      if (command === 'evaluate') {
        expect(args).toMatchObject({ expression: 'value', frameId: 314 });
        return { body: { result: 'ok', type: 'string', variablesReference: 0 } };
      }
      return { success: true, body: {} };
    });

    const result = await sessionManager.evaluateExpression(session.id, 'value', 314);

    expect(result.success).toBe(true);
    expect(commands).toEqual(['evaluate']);
  });

  it('uses and discloses the user-frame thread adopted by the shared resolver (#600)', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createRunningSession(sessionManager, dependencies);
    (sessionManager as unknown as {
      pausedStackReadyTimeoutMs: number;
      pausedStackReadyIntervalMs: number;
      selectPolicy: () => unknown;
    }).pausedStackReadyTimeoutMs = 100;
    (sessionManager as unknown as { pausedStackReadyIntervalMs: number })
      .pausedStackReadyIntervalMs = 10;
    (sessionManager as unknown as { selectPolicy: () => unknown }).selectPolicy = () => ({
      filterStackFrames: (frames: Array<{ file?: string }>, includeInternals: boolean) =>
        includeInternals ? frames : frames.filter((frame) => !frame.file?.includes('/runtime/'))
    });
    let evaluatedFrame: number | undefined;
    dependencies.mockProxyManager.setDapRequestHandler(async (command: string, args?: { threadId?: number; frameId?: number }) => {
      if (command === 'stackTrace') {
        if (args?.threadId === 2) {
          return { body: { stackFrames: [{ id: 20, name: 'runtime.wait', source: { path: '/runtime/wait.js' }, line: 1, column: 1 }] } };
        }
        if (args?.threadId === 3) {
          return { body: { stackFrames: [{ id: 30, name: 'handler', source: { path: '/work/app.js' }, line: 8, column: 1 }] } };
        }
        return { body: { stackFrames: [] } };
      }
      if (command === 'threads') {
        return { body: { threads: [{ id: 1, name: 'stopped' }, { id: 2, name: 'runtime' }, { id: 3, name: 'main' }] } };
      }
      if (command === 'evaluate') {
        evaluatedFrame = args?.frameId;
        return { body: { result: '42', type: 'number', variablesReference: 0 } };
      }
      return { success: true, body: {} };
    });

    const result = await sessionManager.evaluateExpression(session.id, 'answer');

    expect(result.success).toBe(true);
    expect(evaluatedFrame).toBe(30);
    expect(result.anchorNote).toMatch(/switched to thread 3/);
    expect(dependencies.mockProxyManager.getCurrentThreadId()).toBe(3);
  });

  it('fails cleanly when the paused thread reports no stack frames', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createRunningSession(sessionManager, dependencies);

    dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
      if (command === 'stackTrace') {
        return { body: { stackFrames: [] } };
      }
      return { success: true };
    });

    const result = await sessionManager.evaluateExpression(session.id, 'x');

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active stack frame');
  });

  it('wraps stack-trace failures in an evaluation error', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createRunningSession(sessionManager, dependencies);

    dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
      if (command === 'stackTrace') {
        throw new Error('stack machine jammed');
      }
      return { success: true };
    });

    const result = await sessionManager.evaluateExpression(session.id, 'x');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to determine current frame');
    expect(result.error).toContain('stack machine jammed');
  });
});
