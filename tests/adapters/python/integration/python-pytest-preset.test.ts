/**
 * The pytest preset end to end (issue #985 M1): `start_debugging { scriptPath:
 * <test file>, testRunner: "pytest", testTarget }` runs the test under a real
 * debugpy and pytest, and the launch answer is the autopsy — paused at the
 * failing assert with the exception, frames and locals — while a passing
 * test runs to completion. The matrix behind these cases is measured in
 * docs/python/spike-notes-pytest.md; the fixture project is
 * tests/fixtures/python/pytest-project.
 *
 * Two answer shapes land the autopsy (issue #1006): when pytest reaches the
 * assert inside the 1 s launch hold, `start_debugging` answers paused with
 * `snapshot.exception`; when pytest's start-up outlasts the hold (measured
 * 551–963 ms on an idle Windows box, over 1 s under load), the launch answers
 * `pending` and the `wait_for_stop` that lands it carries the stop record
 * (`lastStop`) instead — its snapshot omits the exception on purpose (#982).
 * `landed()` and `exceptionOf()` read whichever came.
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

/**
 * The minor version of the Python the server will pick (3.11 → 11), or 0 when
 * none has pytest and debugpy. pydevd's exception machinery has two
 * implementations — frame tracing up to 3.11, `sys.monitoring` from 3.12 —
 * and one measured shape differs between them (see the pytest.raises case).
 */
function pythonMinorWithPytest(): number {
  const env: Record<string, string> = {};
  for (const key in process.env) {
    if (process.env[key] !== undefined) env[key] = process.env[key] as string;
  }
  ensurePythonOnPath(env);
  for (const python of [process.env.PYTHON_PATH, 'python', 'python3'].filter((p): p is string => Boolean(p))) {
    try {
      const probe = spawnSync(python, ['-c', 'import sys, pytest, debugpy; print(sys.version_info[1])'], {
        env, timeout: 20000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true
      });
      const minor = Number.parseInt(String(probe.stdout).trim(), 10);
      if (probe.status === 0 && Number.isFinite(minor)) return minor;
    } catch {
      // try the next spelling
    }
  }
  return 0;
}

const pythonMinor = pythonMinorWithPytest();

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

/**
 * The exit code wherever the answer carries it: a launch that ends within its
 * hold answers `stopped` with `data.exitCode` (fast machines), a wait_for_stop
 * answer carries `exitCode` at the top level.
 */
const exitCodeOf = (answer: Record<string, unknown>): unknown =>
  answer.exitCode ?? (answer.data as { exitCode?: unknown } | undefined)?.exitCode;

interface StopRecord {
  text?: string;
  description?: string;
  exceptionInfo?: { exceptionId?: string; description?: string; details?: { typeName?: string; message?: string } };
}

/** pydevd appends "(note: full exception trace is shown but execution is paused at: …)" to the type name it reports. */
const withoutPausedAtNote = (name: string | undefined): string | undefined => name?.split(/\s+\(note:/)[0]?.trim();

/**
 * The exception wherever the landed answer carries it (issue #1006): a launch
 * answer's `snapshot.exception` (the hold caught the stop), else the
 * wait_for_stop answer's `lastStop` — the merged `exceptionInfo` when debugpy's
 * enrichment had landed, else the stopped event's own pair (`text` is the type,
 * `description` the message). The snapshot composer strips pydevd's paused-at
 * note from the type; the raw record carries it in `text`, `exceptionId` and
 * `details.typeName` alike, so it is stripped here on every path.
 */
function exceptionOf(answer: Record<string, unknown>): { type?: string; message?: string } {
  const snapshot = answer.snapshot as { exception?: { type?: string; message?: string } } | undefined;
  if (snapshot?.exception) return snapshot.exception;
  const stop = answer.lastStop as StopRecord | undefined;
  const info = stop?.exceptionInfo;
  return {
    type: withoutPausedAtNote(info?.details?.typeName ?? info?.exceptionId ?? stop?.text),
    message: info?.details?.message ?? info?.description ?? stop?.description
  };
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

describe.skipIf(pythonMinor === 0)('pytest preset (issue #985 M1) @requires-python', () => {
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
      expect(answer.state, JSON.stringify(answer)).toBe('paused');
      const snapshot = answer.snapshot as { frames: Array<{ file: string; line: number; name: string }>; locals?: Record<string, string> };
      // Either shape names the exception (the snapshot strips pydevd's "(note: … paused at …)"; the raw record is read around it).
      const exception = exceptionOf(answer);
      expect(exception.type, JSON.stringify(answer)).toBe('AssertionError');
      expect(exception.message).toContain('20.0 == 21.0');
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
      expect(exceptionOf(restarted).type, JSON.stringify(restarted)).toBe('AssertionError');
    });
  }, 120000);

  it('runs a passing test to completion with exit code 0', async () => {
    await withSession('pytest-passes', async (sessionId) => {
      const started = await call('start_debugging', { sessionId, ...preset('test_passes') });
      expect(started.success, JSON.stringify(started)).toBe(true);
      const answer = await landed(sessionId, started);
      expect(['stopped', 'terminated']).toContain(answer.state);
      expect(exitCodeOf(answer), JSON.stringify(answer)).toBe(0);
    });
  }, 90000);

  // Measured on both of pydevd's implementations (docs/python/spike-notes-pytest.md):
  // `sys.monitoring` (3.12+) only sees the exception unwind out of the test
  // frame, which a handled `pytest.raises` never does; frame tracing (≤3.11)
  // decides at the raise and does not count the `with` handler as a catch, so
  // the expected exception pauses once and the test then passes.
  it('handles an exception pytest.raises expects: no stop on 3.12+, one stop then a pass on 3.11', async () => {
    await withSession('pytest-raises', async (sessionId) => {
      const started = await call('start_debugging', { sessionId, ...preset('test_raises_around_helper') });
      expect(started.success, JSON.stringify(started)).toBe(true);
      let answer = await landed(sessionId, started);
      if (pythonMinor <= 11) {
        expect(answer.state, JSON.stringify(answer)).toBe('paused');
        expect(exceptionOf(answer).type, JSON.stringify(answer)).toBe('KeyError');
        await call('continue_execution', { sessionId });
        answer = await call('wait_for_stop', { sessionId, timeout: 30000 });
      }
      expect(['stopped', 'terminated']).toContain(answer.state);
      expect(exitCodeOf(answer), JSON.stringify(answer)).toBe(0);
    });
  }, 90000);

  it("lets a failing test run to its exit under breakOnExceptions 'none'", async () => {
    await withSession('pytest-none', async (sessionId) => {
      const started = await call('start_debugging', { sessionId, ...preset('test_assert_fails', { breakOnExceptions: 'none' }) });
      expect(started.success, JSON.stringify(started)).toBe(true);
      const answer = await landed(sessionId, started);
      expect(['stopped', 'terminated']).toContain(answer.state);
      expect(exitCodeOf(answer), JSON.stringify(answer)).toBe(1);
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
