/**
 * pytest-xdist workers as child sessions (issue #1081): `python -m pytest -n 2`
 * under debugpy starts two execnet workers; with sub-process debugging on by
 * default each becomes a child debug session, a breakpoint set on the launch
 * session before the run stops the worker that runs the test, and the run
 * completes. Launched as a module, not through the pytest preset: the preset
 * keeps xdist off (`-p no:xdist`) so a failing test's stop lands in-process,
 * where the launch answer can carry it (issue #985).
 *
 * Skipped when the session's Python has no pytest-xdist (CI installs
 * requirements/pytest.txt, which pins it).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';
import { ensurePythonOnPath } from './env-utils.js';

const currentDirName = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(currentDirName, '../../../fixtures/python/pytest-project');
const testFile = path.join(projectDir, 'tests', 'test_billing.py');
/** `assert prorate(30, 10, plan) == 20.0` in test_passes. */
const TEST_PASSES_LINE = 10;
const PYTHON = process.env.PYTHON_PATH ?? process.env.PYTHON_EXECUTABLE ?? (process.platform === 'win32' ? 'python' : 'python3');

function xdistAvailable(): boolean {
  try {
    const probe = spawnSync(PYTHON, ['-c', 'import xdist, pytest, debugpy'], { encoding: 'utf8', timeout: 20000 });
    return probe.status === 0;
  } catch {
    return false;
  }
}

async function pollUntil<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs: number, intervalMs = 250): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = await read();
  while (!accept(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    last = await read();
  }
  return last;
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

  const logFilePath = path.resolve(currentDirName, '../../pytest_xdist_test_server.log');
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

type Row = { id: string; state: string; parentSessionId?: string; name?: string };

describe.skipIf(!xdistAvailable())('pytest-xdist workers as child sessions (issue #1081) @requires-python', () => {
  beforeAll(async () => {
    await startTestServer();
  }, 30000);

  afterAll(async () => {
    await stopTestServer();
  });

  it('`pytest -n 2` yields two child sessions, the worker running the test stops on its breakpoint, and the run completes', async () => {
    const created = await call('create_debug_session', { language: 'python', name: 'pytest-xdist' });
    expect(created.success).toBe(true);
    const rootId = created.sessionId as string;
    try {
      const bp = await call('set_breakpoint', { sessionId: rootId, file: testFile, line: TEST_PASSES_LINE });
      expect(bp.success, JSON.stringify(bp)).toBe(true);

      const started = await call('start_debugging', {
        sessionId: rootId,
        scriptPath: testFile,
        breakOnExceptions: 'none',
        dapLaunchArgs: { stopOnEntry: false, module: 'pytest', cwd: projectDir },
        args: ['-n', '2', 'tests/test_billing.py::test_passes']
      });
      expect(started.success, JSON.stringify(started)).toBe(true);

      // The worker that drew the test stops on the breakpoint re-sent to it.
      const stop = await call('wait_for_stop', { sessionId: rootId, timeout: 60000 });
      expect(stop.state, JSON.stringify(stop)).toBe('paused');
      expect(stop.sessionId, JSON.stringify(stop)).toBeDefined();
      expect(stop.sessionId).not.toBe(rootId);
      const workerId = stop.sessionId as string;
      expect(JSON.stringify(stop.location ?? stop)).toMatch(/test_billing\.py/);
      expect(stop.location?.line ?? stop.lastStop?.line).toBe(TEST_PASSES_LINE);
      expect(stop.children, JSON.stringify(stop)).toEqual(
        expect.arrayContaining([expect.objectContaining({ sessionId: workerId, state: 'paused', parentSessionId: rootId })])
      );

      // Both workers are sessions of their own.
      const listing = await pollUntil(
        async () => (await call('list_debug_sessions', {})).sessions as Row[],
        (rows) => rows.filter((s) => s.parentSessionId === rootId).length === 2,
        30000
      );
      const workers = listing.filter((s) => s.parentSessionId === rootId);
      expect(workers, JSON.stringify(listing)).toHaveLength(2);
      for (const worker of workers) expect(worker.name).toMatch(/^Subprocess \d+$/);

      const resumed = await call('continue_execution', { sessionId: workerId });
      expect(resumed.success, JSON.stringify(resumed)).toBe(true);
      const ended = await call('wait_for_stop', { sessionId: rootId, timeout: 60000 });
      expect(ended.state, JSON.stringify(ended)).toBe('stopped');
      expect(ended.sessionId).toBe(rootId);
      expect(ended.exitCode, JSON.stringify(ended)).toBe(0);
      expect(ended.children, JSON.stringify(ended)).toHaveLength(2);
      for (const child of ended.children as Row[]) expect((child as { state: string }).state).toBe('stopped');
      const output = JSON.stringify(await call('get_output', { sessionId: rootId }));
      expect(output).toMatch(/2 workers/);
      expect(output).toMatch(/1 passed/);
    } finally {
      await call('close_debug_session', { sessionId: rootId });
    }
  }, 180000);
});
