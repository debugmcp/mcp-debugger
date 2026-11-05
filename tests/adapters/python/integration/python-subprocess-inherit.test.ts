/**
 * A Python debuggee that spawns a child with an inherited stderr (issue #993).
 *
 * On Windows the adapter used to run under a sibling `pythonw.exe` (#215), and
 * debugpy's launch `python` defaults to the adapter's own interpreter, so the
 * launcher and the debuggee ran windowless too — with stale Win32 standard
 * handles. Any child the debuggee spawned with an inherited standard handle
 * (pytest-xdist's execnet workers, `subprocess.run` without capture,
 * `multiprocessing`) then died inside `subprocess` with
 * `OSError: [WinError 6] The handle is invalid`. The adapter now runs under
 * the session's interpreter on the hidden console the proxy's `windowsHide`
 * spawn gives it (#931), which the launcher and the debuggee inherit.
 *
 * On every platform the cases also prove the sub-process default (issues
 * #1005/#1081): with debugpy's sub-process debugging on — the default since
 * the session tree's last step — the child is reported, adopted as a child
 * debug session and runs to its end; `dapLaunchArgs: { subProcess: false }`
 * opts the launch out and the child runs undebugged, as it did before.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';
import { ensurePythonOnPath } from './env-utils.js';

const currentDirName = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(currentDirName, '../../../fixtures/python/subprocess-inherit/spawn_child.py');

let client: Client | null = null;

async function startTestServer(): Promise<void> {
  const serverScriptPath = path.resolve(currentDirName, '../../../../dist/index.js');
  client = new Client({ name: 'mcp-test-client', version: '0.1.0' }, { capabilities: {} });

  const env: Record<string, string> = {};
  for (const key in process.env) {
    if (process.env[key] !== undefined) env[key] = process.env[key] as string;
  }
  ensurePythonOnPath(env);

  const logFilePath = path.resolve(currentDirName, '../../subprocess_inherit_test_server.log');
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

describe('Python debuggee spawning a child with an inherited stderr (issue #993) @requires-python', () => {
  beforeAll(async () => {
    await startTestServer();
  }, 30000);

  afterAll(async () => {
    await stopTestServer();
  });

  it('runs the child to completion under the session interpreter', async () => {
    const created = await call('create_debug_session', { language: 'python', name: 'subprocess-inherit' });
    expect(created.success).toBe(true);
    const sessionId = created.sessionId as string;

    try {
      // No exception filter: a spawn failure must show up as the debuggee's own
      // traceback and non-zero exit, not as a pause this case would have to read.
      // No subProcess key: sub-process debugging is on by default (issue
      // #1081), so the child is reported, adopted as a child session and runs
      // to its end — before the tree this launch never ended (#1005).
      const started = await call('start_debugging', {
        sessionId,
        scriptPath: fixturePath,
        breakOnExceptions: 'none',
        dapLaunchArgs: { stopOnEntry: false }
      });
      expect(started.success, JSON.stringify(started)).toBe(true);
      expect(started.warning ?? '').not.toContain('subProcess');

      let ended = started;
      if (started.state === 'running') {
        ended = await call('wait_for_stop', { sessionId, timeout: 30000 });
      }
      const output = await call('get_output', { sessionId });
      const transcript = JSON.stringify(output);

      expect(['stopped', 'terminated'], JSON.stringify(ended)).toContain(ended.state);
      expect(transcript).not.toContain('WinError 6');
      expect(transcript).toContain('child exit 0 child ok');
      // A launch that ends inside the hold answers with the exit code under
      // data; wait_for_stop carries it at the top level.
      expect(ended.exitCode ?? ended.data?.exitCode, transcript).toBe(0);
      // The child was a session of its own, ended by now.
      const children = (ended.children ?? ended.data?.children) as Array<{ state: string; parentSessionId: string }> | undefined;
      expect(children, JSON.stringify(ended)).toHaveLength(1);
      expect(children![0].state).toBe('stopped');
      expect(children![0].parentSessionId).toBe(sessionId);

      if (process.platform === 'win32') {
        // The fixture prints the basename of sys.executable: python.exe, never pythonw.exe.
        expect(transcript).toMatch(/interpreter=python(\d+(\.\d+)*)?\.exe/);
        expect(transcript).not.toContain('interpreter=pythonw');
      }
    } finally {
      await call('close_debug_session', { sessionId });
    }
  }, 60000);

  it('runs the child undebugged under an explicit subProcess: false, and says so', async () => {
    const created = await call('create_debug_session', { language: 'python', name: 'subprocess-inherit-opt-out' });
    expect(created.success).toBe(true);
    const sessionId = created.sessionId as string;

    try {
      const started = await call('start_debugging', {
        sessionId,
        scriptPath: fixturePath,
        breakOnExceptions: 'none',
        dapLaunchArgs: { stopOnEntry: false, subProcess: false }
      });
      expect(started.success, JSON.stringify(started)).toBe(true);
      expect(started.warning, JSON.stringify(started)).toMatch(/dapLaunchArgs\.subProcess: forwarded — the Python children this program starts run undebugged/);

      let ended = started;
      if (started.state === 'running') {
        ended = await call('wait_for_stop', { sessionId, timeout: 30000 });
      }
      const transcript = JSON.stringify(await call('get_output', { sessionId }));
      expect(['stopped', 'terminated'], JSON.stringify(ended)).toContain(ended.state);
      expect(transcript).toContain('child exit 0 child ok');
      expect(ended.exitCode ?? ended.data?.exitCode, transcript).toBe(0);
      // No child session was ever made.
      expect(ended.children ?? ended.data?.children).toBeUndefined();
      const listing = await call('list_debug_sessions', {});
      expect((listing.sessions as Array<{ parentSessionId?: string }>).some((s) => s.parentSessionId === sessionId)).toBe(false);
    } finally {
      await call('close_debug_session', { sessionId });
    }
  }, 60000);
});
