/**
 * Stop-snapshot tests (issue #982).
 *
 * The locals half of the snapshot reuses the get_local_variables pipeline
 * behind a pre-resolved stack: extractLocalsFromResolved never re-resolves,
 * and its maxFrames option caps the per-frame scopes probe so a snapshot on
 * a deep stack does not fan out a scopes request per frame.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '@debugmcp/shared';
import { createMockDependencies, createMockEnvironment } from './session-manager-test-utils.js';

type LocalsInternals = {
  extractLocalsFromResolved(
    sessionId: string,
    stackResult: unknown,
    opts?: { includeSpecial?: boolean; names?: string[]; maxFrames?: number }
  ): Promise<{ variables: Array<{ name: string }>; frame: { name: string } | null }>;
  getStackTraceDetailed(sessionId: string): Promise<{ frames: Array<{ id: number }> }>;
};

function makeManager(env: Record<string, string> = {}) {
  const dependencies = createMockDependencies();
  dependencies.environment = createMockEnvironment({ DEBUG_MCP_NO_REDACT: '', ...env });
  const config: SessionManagerConfig = {
    logDirBase: '/tmp/test-sessions',
    defaultDapLaunchArgs: { stopOnEntry: true, justMyCode: true }
  };
  return { sessionManager: new SessionManager(config, dependencies), dependencies };
}

async function createPausedSession(
  sessionManager: SessionManager,
  dependencies: ReturnType<typeof createMockDependencies>
) {
  const session = await sessionManager.createSession({
    language: DebugLanguage.MOCK,
    executablePath: 'python'
  });
  await sessionManager.startDebugging(session.id, 'test.py');
  await vi.runAllTimersAsync();
  dependencies.mockProxyManager.simulateStopped(1, 'entry');
  return session;
}

/** Ten-frame stack; scopes/variables scripted per frame; counts scopes calls. */
function stubDeepStack(dependencies: ReturnType<typeof createMockDependencies>) {
  const counters = { scopes: 0 };
  dependencies.mockProxyManager.setDapRequestHandler(async (command: string, args?: any) => {
    if (command === 'stackTrace') {
      return {
        success: true,
        body: {
          stackFrames: Array.from({ length: 10 }, (_, i) => ({
            id: i + 1,
            name: `fn_${i}`,
            source: { path: 'test.py' },
            line: 10 + i,
            column: 0
          }))
        }
      };
    }
    if (command === 'scopes') {
      counters.scopes++;
      return {
        success: true,
        body: { scopes: [{ name: 'Locals', variablesReference: 100 + args.frameId, expensive: false }] }
      };
    }
    if (command === 'variables') {
      return {
        success: true,
        body: { variables: [{ name: 'x', value: '1', type: 'int', variablesReference: 0 }] }
      };
    }
    return { success: true, args };
  });
  return counters;
}

describe('extractLocalsFromResolved (issue #982)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('maxFrames caps the per-frame scopes probe on a deep stack', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createPausedSession(sessionManager, dependencies);
    const counters = stubDeepStack(dependencies);

    const internals = sessionManager as unknown as LocalsInternals;
    const stack = await internals.getStackTraceDetailed(session.id);
    expect(stack.frames.length).toBe(10);

    counters.scopes = 0;
    const result = await internals.extractLocalsFromResolved(session.id, stack, { maxFrames: 3 });

    expect(counters.scopes).toBe(3);
    expect(result.variables.map(v => v.name)).toEqual(['x']);
    expect(result.frame?.name).toBe('fn_0');
  });

  it('without maxFrames the probe still covers the whole stack (existing behavior)', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createPausedSession(sessionManager, dependencies);
    const counters = stubDeepStack(dependencies);

    const internals = sessionManager as unknown as LocalsInternals;
    const stack = await internals.getStackTraceDetailed(session.id);

    counters.scopes = 0;
    await internals.extractLocalsFromResolved(session.id, stack, {});
    expect(counters.scopes).toBe(10);
  });

  it('getLocalVariables keeps its public behavior through the split', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createPausedSession(sessionManager, dependencies);
    stubDeepStack(dependencies);

    const result = await sessionManager.getLocalVariables(session.id);
    expect(result.variables.map((v: { name: string }) => v.name)).toEqual(['x']);
    expect(result.frame?.name).toBe('fn_0');
    expect(result.scopeName).toBe('Locals');
  });
});

describe('stop snapshot on arrival answers (issue #982)', () => {
  const SECRET = 'ghp_' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123';

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('a launch paused on a breakpoint carries data.snapshot with frames and locals', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await sessionManager.createSession({
      language: DebugLanguage.MOCK,
      executablePath: 'python'
    });
    stubDeepStack(dependencies);

    const launch = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
    await vi.advanceTimersByTimeAsync(100);
    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
    const result = await launch;

    expect(result.state).toBe('paused');
    expect(result.data?.snapshot?.frames?.[0]).toEqual({ name: 'fn_0', file: 'test.py', line: 10 });
    expect(result.data?.snapshot?.frames).toHaveLength(3);
    expect(result.data?.snapshot?.locals).toEqual({ x: '1' });
    expect(result.data?.snapshot?.exception).toBeUndefined();
    expect(result.data?.location).toEqual({ file: 'test.py', line: 10, column: 0 });
  });

  it('an entry stop carries the landing but no snapshot', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await sessionManager.createSession({
      language: DebugLanguage.MOCK,
      executablePath: 'python'
    });
    stubDeepStack(dependencies);

    const launch = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: true });
    await vi.advanceTimersByTimeAsync(100);
    dependencies.mockProxyManager.simulateStopped(1, 'entry');
    const result = await launch;

    expect(result.state).toBe('paused');
    expect(result.data?.reason).toBe('entry');
    expect(result.data?.location).toBeDefined();
    expect(result.data?.snapshot).toBeUndefined();
  });

  async function pausedOnException(env: Record<string, string> = {}) {
    const { sessionManager, dependencies } = makeManager(env);
    const session = await sessionManager.createSession({
      language: DebugLanguage.MOCK,
      executablePath: 'python'
    });
    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    stubDeepStack(dependencies);
    dependencies.mockProxyManager.simulateStopped(1, 'exception', {
      reason: 'exception',
      description: 'AuthError',
      text: `token ${SECRET} rejected`
    });
    await vi.advanceTimersByTimeAsync(20);
    return { sessionManager, dependencies, sessionId: session.id };
  }

  it('wait_for_stop redacts the emitted lastStop, keeps the stored record raw, and never ships the exception twice', async () => {
    const { sessionManager, sessionId } = await pausedOnException();

    const result = await sessionManager.waitForStop(sessionId, 1000);

    expect(result.success).toBe(true);
    expect(result.data?.lastStop?.text).toContain('<redacted:github-pat>');
    expect(result.data?.lastStop?.text).not.toContain(SECRET);
    // The stored record is untouched: identity guards depend on it.
    expect(sessionManager.getSession(sessionId)?.lastStop?.text).toContain(SECRET);
    // The snapshot rides along, without an exception section: lastStop is it.
    expect(result.data?.snapshot?.frames).toHaveLength(3);
    expect(result.data?.snapshot?.locals).toEqual({ x: '1' });
    expect(result.data?.snapshot?.exception).toBeUndefined();
  });

  it('DEBUG_MCP_NO_SNAPSHOT=1 keeps every answer snapshot-free (lastStop still redacted)', async () => {
    const { sessionManager, sessionId } = await pausedOnException({ DEBUG_MCP_NO_SNAPSHOT: '1' });

    const result = await sessionManager.waitForStop(sessionId, 1000);

    expect(result.data?.snapshot).toBeUndefined();
    expect(result.data?.lastStop?.text).toContain('<redacted:github-pat>');
  });

  it('a locals read that outlives snapshotLocalsTimeoutMs ships the snapshot without locals and says what expired', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await sessionManager.createSession({
      language: DebugLanguage.MOCK,
      executablePath: 'python'
    });
    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    (sessionManager as unknown as { snapshotLocalsTimeoutMs: number }).snapshotLocalsTimeoutMs = 50;
    dependencies.mockProxyManager.setDapRequestHandler(async (command: string, args?: any) => {
      if (command === 'stackTrace') {
        return {
          success: true,
          body: { stackFrames: [{ id: 1, name: 'main', source: { path: 'test.py' }, line: 10, column: 0 }] }
        };
      }
      if (command === 'scopes') {
        return { success: true, body: { scopes: [{ name: 'Locals', variablesReference: 100, expensive: false }] } };
      }
      if (command === 'variables') {
        return new Promise(() => {}); // hangs past the window
      }
      return { success: true, args };
    });
    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
    await vi.advanceTimersByTimeAsync(20);

    const result = await sessionManager.waitForStop(session.id, 1000);

    expect(result.data?.snapshot?.frames).toHaveLength(1);
    expect(result.data?.snapshot?.locals).toBeUndefined();
    expect(result.data?.snapshot?.note).toContain('50ms');
    expect(result.data?.snapshot?.note).toContain('get_local_variables');
  });
});

describe('step answers join the snapshot with changedVariables (issue #983)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  /** Deep-stack stub whose variable values and scopes-call count are mutable/observable. */
  function stubSteppable(dependencies: ReturnType<typeof createMockDependencies>) {
    const state = { x: 1, scopes: 0, autoStopOnNext: false };
    dependencies.mockProxyManager.setDapRequestHandler(async (command: string, args?: any) => {
      if (command === 'stackTrace') {
        return {
          success: true,
          body: {
            stackFrames: Array.from({ length: 10 }, (_, i) => ({
              id: i + 1,
              name: `fn_${i}`,
              source: { path: 'test.py' },
              line: 10 + i,
              column: 0
            }))
          }
        };
      }
      if (command === 'scopes') {
        state.scopes++;
        return {
          success: true,
          body: { scopes: [{ name: 'Locals', variablesReference: 100 + args.frameId, expensive: false }] }
        };
      }
      if (command === 'variables') {
        return {
          success: true,
          body: { variables: [{ name: 'x', value: String(state.x), type: 'int', variablesReference: 0 }] }
        };
      }
      if (command === 'next' && state.autoStopOnNext) {
        setTimeout(() => dependencies.mockProxyManager.simulateStopped(1, 'step'), 1);
      }
      return { success: true, args };
    });
    return state;
  }

  async function steppedOnce(
    sessionManager: SessionManager,
    dependencies: ReturnType<typeof createMockDependencies>,
    sessionId: string
  ) {
    const step = sessionManager.stepOver(sessionId);
    await vi.advanceTimersByTimeAsync(20);
    dependencies.mockProxyManager.simulateStopped(1, 'step');
    await vi.advanceTimersByTimeAsync(30);
    return step;
  }

  it('a step answer carries the snapshot; the next step in the same frame carries only the diff', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createPausedSession(sessionManager, dependencies);
    const state = stubSteppable(dependencies);

    const first = await steppedOnce(sessionManager, dependencies, session.id);
    expect(first.success).toBe(true);
    expect(first.data?.snapshot?.locals).toEqual({ x: '1' });
    expect(first.data?.snapshot?.changedVariables).toBeUndefined();
    expect(first.data?.snapshot?.frames).toHaveLength(3);

    state.x = 2;
    const second = await steppedOnce(sessionManager, dependencies, session.id);
    expect(second.data?.snapshot?.locals).toBeUndefined();
    expect(second.data?.snapshot?.changedVariables).toEqual({ x: { before: '1', after: '2' } });
  });

  it('a pending step carries no snapshot', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createPausedSession(sessionManager, dependencies);
    stubSteppable(dependencies);
    (sessionManager as unknown as { stepGraceMs: number }).stepGraceMs = 50;

    const step = sessionManager.stepOver(session.id);
    await vi.advanceTimersByTimeAsync(200); // grace elapses, no stop
    const result = await step;

    expect(result.success).toBe(true);
    expect(result.data?.pending).toBe(true);
    expect(result.data?.snapshot).toBeUndefined();
  });

  it('a same-line-repeating adapter (Dart) composes the snapshot once per ANSWER, not per landing', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createPausedSession(sessionManager, dependencies);
    const state = stubSteppable(dependencies);
    state.autoStopOnNext = true; // every 'next' lands on the same line -> repeat to the cap
    const basePolicy = (sessionManager as unknown as { selectPolicy(language: string): object }).selectPolicy('mock');
    (sessionManager as unknown as { selectPolicy(language: string): object }).selectPolicy =
      () => ({ ...basePolicy, stepsByTokenPosition: true });

    const step = sessionManager.stepOver(session.id);
    await vi.advanceTimersByTimeAsync(20);
    dependencies.mockProxyManager.simulateStopped(1, 'step'); // first stop; repeats auto-drive
    await vi.advanceTimersByTimeAsync(500);
    const result = await step;

    expect(result.success).toBe(true);
    expect(result.data?.message).toMatch(/stepped \d+ times|8/i);
    // The landing read ran once per repeat; the locals fan-out ran ONCE.
    expect(state.scopes).toBe(3);
    expect(result.data?.snapshot).toBeDefined();
  });

  it('relaunching clears the diff base: the first stop of the new run shows full locals', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createPausedSession(sessionManager, dependencies);
    const state = stubSteppable(dependencies);

    await steppedOnce(sessionManager, dependencies, session.id); // seeds the cache
    expect((sessionManager.getSession(session.id) as { snapshotDiffBase?: unknown }).snapshotDiffBase).toBeDefined();

    // The program ends; the cache survives (termination is not a launch boundary)…
    dependencies.mockProxyManager.simulateEvent('terminated');
    await vi.runAllTimersAsync();
    expect((sessionManager.getSession(session.id) as { snapshotDiffBase?: unknown }).snapshotDiffBase).toBeDefined();

    // …but a relaunch is: same frameKey, new values — full locals, no diff.
    state.x = 5;
    const relaunch = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
    await vi.advanceTimersByTimeAsync(100);
    dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
    await vi.advanceTimersByTimeAsync(50);
    const result = await relaunch;

    expect(result.state).toBe('paused');
    expect(result.data?.snapshot?.locals).toEqual({ x: '5' });
    expect(result.data?.snapshot?.changedVariables).toBeUndefined();
  });
});
