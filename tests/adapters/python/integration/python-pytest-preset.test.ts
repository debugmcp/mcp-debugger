/**
 * The pytest preset end to end (issue #985 M1): `start_debugging { scriptPath:
 * <test file>, testRunner: "pytest", testTarget }` runs the test under a real
 * debugpy and pytest, and the launch answer is the autopsy — paused at the
 * failing assert with snapshot.exception, frames and locals — while a passing
 * test runs to completion. The matrix behind these cases is measured in
 * docs/python/spike-notes-pytest.md; the fixture project is
 * tests/fixtures/python/pytest-project.
 *
 * Needs pytest importable by the Python the server picks (CI installs
 * requirements/pytest.txt); skipped otherwise.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ensurePythonOnPath } from './env-utils.js';

const currentDirName = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(currentDirName, '../../../fixtures/python/pytest-project');
const testFile = path.join(projectDir, 'tests', 'test_billing.py');
const ASSERT_LINE = 16; // `assert remaining == expected` in test_assert_fails

function pytestAvailable(): boolean {
  const env: Record<string, string> = {};
  for (const key in process.env) {
    if (process.env[key] !== undefined) env[key] = process.env[key] as string;
  }
  ensurePythonOnPath(env);
  for (const python of [process.env.PYTHON_PATH, 'python', 'python3'].filter((p): p is string => Boolean(p))) {
    try {
      const probe = spawnSync(python, ['-c', 'import pytest, debugpy'], { env, timeout: 20000, stdio: 'ignore', windowsHide: true });
      if (probe.status === 0) return true;
    } catch {
      // try the next spelling
    }
  }
  return false;
}

let client: Client | null = null;

async function startTestServer(): Promise<void> {
  const serverScriptPath = path.resolve(currentDirName, '../../../../dist/index.js');
  client = new Client({ name: 'mcp-test-client', version: '0.1.0' }, { capabilities: {} });
  const env: Record<string, string> = {};
  for (const key in process.env) {
    if (process.env[key] !== undefined) env[key] = process.env[key] as string;
  }
  ensurePythonOnPath(env);
  const logFilePath = path.resolve(currentDirName, '../../pytest_preset_test_server.log');
  try {
    if (fs.existsSync(logFilePath)) fs.unlinkSync(logFilePath);
  } catch { /* best effort */ }
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverScriptPath, '--log-level', 'debug', '--log-file', logFilePath],
    env
  });
  await client.connect(transport);
}

async function stopTestServer(): Promise<void> {
  if (client) {
    try { await client.close(); } catch { /* best effort */ }
  }
  client = null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseToolResult = (raw: any): any => {
  if (!raw?.content?.[0] || raw.content[0].type !== 'text') {
    throw new Error(`Invalid tool result: ${JSON.stringify(raw)}`);
  }
  return JSON.parse(raw.content[0].text);
};

async function call(name: string, args: Record<string, unknown>) {
  if (!client) throw new Error('MCP client not initialized');
  return parseToolResult(await client.callTool({ name, arguments: args }));
}

/** The launch answer, landed: a `running` answer is waited out (the hold is short, pytest's start-up is not). */
async function landed(sessionId: string, answer: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (answer.state !== 'running') return answer;
  const waited = await call('wait_for_stop', { sessionId, timeout: 30000 });
  expect(waited.success, JSON.stringify(waited)).toBe(true);
  return waited;
}

async function withSession<T>(name: string, body: (sessionId: string) => Promise<T>): Promise<T> {
  const created = await call('create_debug_session', { language: 'python', name });
  expect(created.success).toBe(true);
  const sessionId = created.sessionId as string;
  try {
    return await body(sessionId);
  } finally {
    await call('close_debug_session', { sessionId });
  }
}

const preset = (testTarget: string, extra: Record<string, unknown> = {}) => ({
  scriptPath: testFile,
  testRunner: 'pytest',
  testTarget,
  ...extra
});

describe.skipIf(!pytestAvailable())('pytest preset (issue #985 M1) @requires-python', () => {
  beforeAll(async () => {
    await startTestServer();
  }, 30000);

  afterAll(async () => {
    await stopTestServer();
  });

  it('answers a failing assert as the autopsy: paused in the test frame with the exception, frames and locals', async () => {
    await withSession('pytest-assert', async (sessionId) => {
      const started = await call('start_debugging', { sessionId, ...preset('test_assert_fails') });
      expect(started.success, JSON.stringify(started)).toBe(true);
      expect(started.warning).toMatch(/testRunner: pytest/);
      expect(started.warning).toMatch(/python -m pytest/);
      expect(started.warning).toContain('pytest.ini');

      const answer = await landed(sessionId, started);
      expect(answer.state).toBe('paused');
      const snapshot = answer.snapshot as { exception?: { type?: string; message?: string }; frames: Array<{ file: string; line: number; name: string }>; locals?: Record<string, string> };
      // pydevd's "(note: full exception trace is shown but execution is paused at …)" is stripped.
      expect(snapshot.exception?.type).toBe('AssertionError');
      expect(snapshot.exception?.message).toContain('20.0 == 21.0');
      expect(snapshot.frames[0].file.replace(/\\/g, '/')).toContain('pytest-project/tests/test_billing.py');
      expect(snapshot.frames[0].line).toBe(ASSERT_LINE);
      expect(snapshot.locals?.remaining).toBe('20.0');
      expect(snapshot.locals?.expected).toBe('21.0');

      const listed = await call('list_debug_sessions', {});
      const session = (listed.sessions as Array<{ id: string; lastStop?: { reason: string } }>).find(s => s.id === sessionId);
      expect(session?.lastStop?.reason).toBe('exception');

      // The run ends with pytest's exit code once the stop is released.
      await call('continue_execution', { sessionId });
      const ended = await call('wait_for_stop', { sessionId, timeout: 30000 });
      expect(['stopped', 'terminated']).toContain(ended.state);
      expect(ended.exitCode).toBe(1);

      // restart_debugging replays the preset: the same assert pauses again.
      const restarted = await landed(sessionId, await call('restart_debugging', { sessionId }));
      expect(restarted.state, JSON.stringify(restarted)).toBe('paused');
      expect((restarted.snapshot as { exception?: { type?: string } }).exception?.type).toBe('AssertionError');
    });
  }, 120000);

  it('runs a passing test to completion with exit code 0', async () => {
    await withSession('pytest-passes', async (sessionId) => {
      const started = await call('start_debugging', { sessionId, ...preset('test_passes') });
      expect(started.success, JSON.stringify(started)).toBe(true);
      const answer = await landed(sessionId, started);
      expect(['stopped', 'terminated']).toContain(answer.state);
      expect(answer.exitCode).toBe(0);
    });
  }, 90000);

  it('does not stop on an exception pytest.raises expects', async () => {
    await withSession('pytest-raises', async (sessionId) => {
      const started = await call('start_debugging', { sessionId, ...preset('test_raises_around_helper') });
      expect(started.success, JSON.stringify(started)).toBe(true);
      const answer = await landed(sessionId, started);
      expect(['stopped', 'terminated']).toContain(answer.state);
      expect(answer.exitCode).toBe(0);
    });
  }, 90000);

  it("lets a failing test run to its exit under breakOnExceptions 'none'", async () => {
    await withSession('pytest-none', async (sessionId) => {
      const started = await call('start_debugging', { sessionId, ...preset('test_assert_fails', { breakOnExceptions: 'none' }) });
      expect(started.success, JSON.stringify(started)).toBe(true);
      const answer = await landed(sessionId, started);
      expect(['stopped', 'terminated']).toContain(answer.state);
      expect(answer.exitCode).toBe(1);
    });
  }, 90000);

  it('refuses a runner Python has no preset for, by name, leaving the session untouched', async () => {
    await withSession('pytest-jest', async (sessionId) => {
      const refused = await call('start_debugging', { sessionId, scriptPath: testFile, testRunner: 'jest' });
      expect(refused.success).toBe(false);
      expect(refused.message).toContain("'jest'");
      expect(refused.message).toContain('pytest');
      const listed = await call('list_debug_sessions', {});
      const session = (listed.sessions as Array<{ id: string; state: string }>).find(s => s.id === sessionId);
      expect(session?.state).toBe('created');
    });
  }, 30000);

  it('describes the preset in a dry run: the module target and the expansion, nothing started', async () => {
    await withSession('pytest-dry-run', async (sessionId) => {
      const dry = await call('start_debugging', { sessionId, ...preset('test_assert_fails', { dryRunSpawn: true }) });
      expect(dry.success, JSON.stringify(dry)).toBe(true);
      expect(dry.state).toBe('created');
      expect(dry.data.dryRun).toBe(true);
      expect(dry.data.script).toBe('module: pytest');
      expect(dry.warning).toMatch(/testRunner: pytest/);
      expect(dry.warning).toContain('test_billing.py::test_assert_fails');
    });
  }, 60000);
});
