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
