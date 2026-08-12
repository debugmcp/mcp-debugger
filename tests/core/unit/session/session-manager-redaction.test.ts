/**
 * Session-layer secret redaction tests (issue #237).
 *
 * Redaction hooks live in the session layer — the single point upstream of
 * both tool results and log lines — so getVariables, evaluateExpression and
 * output capture are covered here, with DEBUG_MCP_NO_REDACT=1 restoring raw
 * values.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionOutputEntry } from '@debugmcp/shared';
import { createMockDependencies, createMockEnvironment } from './session-manager-test-utils.js';

const GH_PAT = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123';

function makeManager(noRedact: '' | '1') {
  const dependencies = createMockDependencies();
  // '' forces the default-on path even if the developer's real environment
  // sets DEBUG_MCP_NO_REDACT (the mock env falls back to process.env).
  dependencies.environment = createMockEnvironment({ DEBUG_MCP_NO_REDACT: noRedact });
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

function stubSecretVariables(dependencies: ReturnType<typeof createMockDependencies>) {
  dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
    if (command === 'variables') {
      return {
        success: true,
        body: {
          variables: [
            { name: 'gh_token', value: GH_PAT, type: 'str', variablesReference: 0 },
            { name: 'password', value: 'hunter2blue', type: 'str', variablesReference: 0 },
            { name: 'count', value: '42', type: 'int', variablesReference: 0 }
          ]
        }
      };
    }
    if (command === 'evaluate') {
      return { success: true, body: { result: `'${GH_PAT}'`, type: 'str', variablesReference: 0 } };
    }
    return { success: true };
  });
}

describe('SessionManager - secret redaction (issue #237)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('getVariables', () => {
    it('masks credential-shaped and sensitive-name values by default', async () => {
      const { sessionManager, dependencies } = makeManager('');
      const session = await createPausedSession(sessionManager, dependencies);
      stubSecretVariables(dependencies);

      const variables = await sessionManager.getVariables(session.id, 100);

      expect(variables).toHaveLength(3);
      expect(variables[0]).toMatchObject({
        name: 'gh_token',
        value: '<redacted:github-pat>',
        redacted: true
      });
      expect(variables[1]).toMatchObject({
        name: 'password',
        value: '<redacted:sensitive-name>',
        redacted: true
      });
      expect(variables[2]).toMatchObject({ name: 'count', value: '42' });
      expect(variables[2].redacted).toBeUndefined();
    });

    it('returns raw values when DEBUG_MCP_NO_REDACT=1', async () => {
      const { sessionManager, dependencies } = makeManager('1');
      const session = await createPausedSession(sessionManager, dependencies);
      stubSecretVariables(dependencies);

      const variables = await sessionManager.getVariables(session.id, 100);

      expect(variables[0]).toMatchObject({ name: 'gh_token', value: GH_PAT });
      expect(variables[0].redacted).toBeUndefined();
      expect(variables[1]).toMatchObject({ name: 'password', value: 'hunter2blue' });
    });
  });

  describe('evaluateExpression', () => {
    it('masks secret-shaped results and attaches redaction metadata', async () => {
      const { sessionManager, dependencies } = makeManager('');
      const session = await createPausedSession(sessionManager, dependencies);
      stubSecretVariables(dependencies);

      const result = await sessionManager.evaluateExpression(session.id, 'gh_token', 1);

      expect(result.success).toBe(true);
      expect(result.result).toBe("'<redacted:github-pat>'");
      expect(result.redaction).toBeDefined();
      expect(result.redaction?.rules).toContain('github-pat');
      expect(result.redaction?.notice).toContain('DEBUG_MCP_NO_REDACT=1');
    });

    it('masks results when the expression itself names a secret (config.password)', async () => {
      const { sessionManager, dependencies } = makeManager('');
      const session = await createPausedSession(sessionManager, dependencies);
      dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'evaluate') {
          return { success: true, body: { result: "'hunter2blue'", type: 'str', variablesReference: 0 } };
        }
        return { success: true };
      });

      const result = await sessionManager.evaluateExpression(session.id, 'config.password', 1);

      expect(result.result).toBe('<redacted:sensitive-name>');
      expect(result.redaction?.rules).toContain('sensitive-name');
    });

    it('returns raw results when DEBUG_MCP_NO_REDACT=1', async () => {
      const { sessionManager, dependencies } = makeManager('1');
      const session = await createPausedSession(sessionManager, dependencies);
      stubSecretVariables(dependencies);

      const result = await sessionManager.evaluateExpression(session.id, 'gh_token', 1);

      expect(result.result).toBe(`'${GH_PAT}'`);
      expect(result.redaction).toBeUndefined();
    });
  });

  describe('output capture', () => {
    it('masks secrets in output events at write time and flags the entry', async () => {
      const { sessionManager, dependencies } = makeManager('');
      const session = await createPausedSession(sessionManager, dependencies);

      const captured: SessionOutputEntry[] = [];
      sessionManager.on('output-captured', (_sessionId: string, entry: SessionOutputEntry) => {
        captured.push(entry);
      });

      dependencies.mockProxyManager.emit('output', {
        category: 'stdout',
        output: `token: ${GH_PAT}\nready\n`
      });

      expect(captured).toHaveLength(1);
      expect(captured[0].output).toBe('token: <redacted:github-pat>\nready\n');
      expect(captured[0].redacted).toBe(true);
      expect(session).toBeDefined();
    });

    it('leaves benign output untouched and unflagged', async () => {
      const { sessionManager, dependencies } = makeManager('');
      await createPausedSession(sessionManager, dependencies);

      const captured: SessionOutputEntry[] = [];
      sessionManager.on('output-captured', (_sessionId: string, entry: SessionOutputEntry) => {
        captured.push(entry);
      });

      dependencies.mockProxyManager.emit('output', { category: 'stdout', output: 'hello world\n' });

      expect(captured).toHaveLength(1);
      expect(captured[0].output).toBe('hello world\n');
      expect(captured[0].redacted).toBeUndefined();
    });

    it('passes secrets through raw when DEBUG_MCP_NO_REDACT=1', async () => {
      const { sessionManager, dependencies } = makeManager('1');
      await createPausedSession(sessionManager, dependencies);

      const captured: SessionOutputEntry[] = [];
      sessionManager.on('output-captured', (_sessionId: string, entry: SessionOutputEntry) => {
        captured.push(entry);
      });

      dependencies.mockProxyManager.emit('output', { category: 'stdout', output: `token: ${GH_PAT}\n` });

      expect(captured).toHaveLength(1);
      expect(captured[0].output).toBe(`token: ${GH_PAT}\n`);
      expect(captured[0].redacted).toBeUndefined();
    });
  });
});
