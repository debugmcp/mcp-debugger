/**
 * Session-layer `names` filter tests (issue #237, least-privilege half).
 *
 * getVariables/getLocalVariables accept an optional exact-match,
 * case-sensitive list of variable names; only matching variables are
 * returned (and only they are redacted/logged).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '@debugmcp/shared';
import { createMockDependencies, createMockEnvironment } from './session-manager-test-utils.js';

function makeManager() {
  const dependencies = createMockDependencies();
  dependencies.environment = createMockEnvironment({ DEBUG_MCP_NO_REDACT: '' });
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

function stubVariables(dependencies: ReturnType<typeof createMockDependencies>) {
  dependencies.mockProxyManager.setDapRequestHandler(async (command: string, args?: any) => {
    if (command === 'variables') {
      return {
        success: true,
        body: {
          variables: [
            { name: 'user', value: "'ada'", type: 'str', variablesReference: 0 },
            { name: 'User', value: "'ADA'", type: 'str', variablesReference: 0 },
            { name: 'total', value: '99', type: 'int', variablesReference: 0 }
          ]
        }
      };
    }
    if (command === 'stackTrace') {
      return {
        success: true,
        body: { stackFrames: [{ id: 1, name: 'main', source: { path: 'test.py' }, line: 10, column: 0 }] }
      };
    }
    if (command === 'scopes') {
      return {
        success: true,
        body: { scopes: [{ name: 'Locals', variablesReference: 100, expensive: false }] }
      };
    }
    return { success: true, args };
  });
}

describe('SessionManager - names filter (issue #237)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('getVariables returns only the requested names, case-sensitively', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createPausedSession(sessionManager, dependencies);
    stubVariables(dependencies);

    const variables = await sessionManager.getVariables(session.id, 100, ['user', 'missing']);

    expect(variables.map(v => v.name)).toEqual(['user']);
  });

  it('getVariables without names returns everything (unchanged behavior)', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createPausedSession(sessionManager, dependencies);
    stubVariables(dependencies);

    const variables = await sessionManager.getVariables(session.id, 100);

    expect(variables).toHaveLength(3);
  });

  it('getLocalVariables filters the extracted locals by names', async () => {
    const { sessionManager, dependencies } = makeManager();
    const session = await createPausedSession(sessionManager, dependencies);
    stubVariables(dependencies);

    const result = await sessionManager.getLocalVariables(session.id, false, ['total']);

    expect(result.variables.map((v: { name: string }) => v.name)).toEqual(['total']);
  });
});
