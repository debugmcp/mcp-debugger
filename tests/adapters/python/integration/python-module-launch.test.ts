/**
 * A Python *module* launch through the real debugpy (issue #985, M0).
 *
 * `dapLaunchArgs: { module: 'modpkg', cwd }` must reach debugpy as a launch
 * that names the module and no `program`: debugpy refuses the pair
 * ('"program", "module", and "code" are mutually exclusive'), and until M0 the
 * connection manager filled `program` from scriptPath on every launch.
 * scriptPath still names an existing file (the package's `__main__.py`), and
 * `cwd` is what `python -m` puts on `sys.path`, so the module resolves.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ensurePythonOnPath } from './env-utils.js';

const currentDirName = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(currentDirName, '../../../fixtures/python/module-launch');
const mainPath = path.join(fixtureDir, 'modpkg', '__main__.py');
const BREAKPOINT_LINE = 8; // `total = count + 41` in __main__.py

let client: Client | null = null;

async function startTestServer(): Promise<void> {
  const serverScriptPath = path.resolve(currentDirName, '../../../../dist/index.js');
  client = new Client({ name: 'mcp-test-client', version: '0.1.0' }, { capabilities: {} });

  const env: Record<string, string> = {};
  for (const key in process.env) {
    if (process.env[key] !== undefined) env[key] = process.env[key] as string;
  }
  ensurePythonOnPath(env);

  const logFilePath = path.resolve(currentDirName, '../../module_launch_test_server.log');
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

describe('Python module launch (issue #985 M0) @requires-python', () => {
  beforeAll(async () => {
    await startTestServer();
  }, 30000);

  afterAll(async () => {
    await stopTestServer();
  });

  it('launches `python -m modpkg` and pauses at a breakpoint inside the package', async () => {
    const created = await call('create_debug_session', { language: 'python', name: 'module-launch' });
    expect(created.success).toBe(true);
    const sessionId = created.sessionId as string;

    try {
      const bp = await call('set_breakpoint', { sessionId, file: mainPath, line: BREAKPOINT_LINE });
      expect(bp.success).toBe(true);

      const started = await call('start_debugging', {
        sessionId,
        scriptPath: mainPath,
        dapLaunchArgs: { module: 'modpkg', cwd: fixtureDir }
      });
      expect(started.success, JSON.stringify(started)).toBe(true);

      // The launch answers paused when the breakpoint is reached as the program
      // starts (issue #823); otherwise it answers pending and wait_for_stop lands it.
      let state = started.state as string;
      if (state !== 'paused') {
        const waited = await call('wait_for_stop', { sessionId, timeout: 15000 });
        expect(waited.success, JSON.stringify(waited)).toBe(true);
        state = waited.state as string;
      }
      expect(state).toBe('paused');

      // The transform's own word on what happened to `program`.
      expect(JSON.stringify(started)).toMatch(/dapLaunchArgs\.module/);

      const stack = await call('get_stack_trace', { sessionId });
      expect(stack.success).toBe(true);
      const top = stack.stackFrames[0];
      expect(top.file.replace(/\\/g, '/')).toContain('module-launch/modpkg/__main__.py');
      expect(top.line).toBe(BREAKPOINT_LINE);
      expect(top.name).toBe('main');

      const locals = await call('get_local_variables', { sessionId });
      expect(locals.success).toBe(true);
      const greeting = (locals.variables as Array<{ name: string; value: string }>).find(v => v.name === 'greeting');
      expect(greeting?.value).toContain('module launch');

      const resumed = await call('continue_execution', { sessionId });
      expect(resumed.success).toBe(true);
      const ended = await call('wait_for_stop', { sessionId, timeout: 15000 });
      expect(ended.success, JSON.stringify(ended)).toBe(true);
      expect(['stopped', 'terminated']).toContain(ended.state);

      const output = await call('get_output', { sessionId });
      expect(JSON.stringify(output)).toContain('module launch: argv=1 total=42');

      // restart_debugging replays the module launch and the breakpoint binds again.
      const restarted = await call('restart_debugging', { sessionId });
      expect(restarted.success, JSON.stringify(restarted)).toBe(true);
      let restartedState = restarted.state as string;
      if (restartedState !== 'paused') {
        const waited = await call('wait_for_stop', { sessionId, timeout: 15000 });
        restartedState = waited.state as string;
      }
      expect(restartedState).toBe('paused');
      const stackAgain = await call('get_stack_trace', { sessionId });
      expect(stackAgain.stackFrames[0].line).toBe(BREAKPOINT_LINE);
    } finally {
      await call('close_debug_session', { sessionId });
    }
  }, 90000);

  // Without a caller cwd the launcher used to default it to the script's
  // directory — inside the package — so `python -m modpkg` failed with
  // "No module named modpkg". The transform now derives the directory above
  // the top-most package containing the file.
  it('resolves the module from the directory above the package when no cwd is given', async () => {
    const created = await call('create_debug_session', { language: 'python', name: 'module-launch-default-cwd' });
    const sessionId = created.sessionId as string;

    try {
      await call('set_breakpoint', { sessionId, file: mainPath, line: BREAKPOINT_LINE });
      const started = await call('start_debugging', {
        sessionId,
        scriptPath: mainPath,
        dapLaunchArgs: { module: 'modpkg' }
      });
      expect(started.success, JSON.stringify(started)).toBe(true);
      expect(JSON.stringify(started)).toMatch(/cwd/);

      let state = started.state as string;
      if (state !== 'paused') {
        const waited = await call('wait_for_stop', { sessionId, timeout: 15000 });
        state = waited.state as string;
      }
      expect(state).toBe('paused');
      const stack = await call('get_stack_trace', { sessionId });
      expect(stack.stackFrames[0].line).toBe(BREAKPOINT_LINE);
    } finally {
      await call('close_debug_session', { sessionId });
    }
  }, 60000);

  it('runs a code string (python -c) to completion, scriptPath only naming a file', async () => {
    const created = await call('create_debug_session', { language: 'python', name: 'code-launch' });
    const sessionId = created.sessionId as string;

    try {
      const started = await call('start_debugging', {
        sessionId,
        scriptPath: mainPath,
        dapLaunchArgs: { code: 'import sys; print("code launch ok", len(sys.argv))' }
      });
      expect(started.success, JSON.stringify(started)).toBe(true);
      expect(JSON.stringify(started)).toMatch(/dapLaunchArgs\.code/);

      let state = started.state as string;
      if (state === 'running') {
        const waited = await call('wait_for_stop', { sessionId, timeout: 15000 });
        state = waited.state as string;
      }
      expect(['stopped', 'terminated']).toContain(state);
      const output = await call('get_output', { sessionId });
      expect(JSON.stringify(output)).toContain('code launch ok');
    } finally {
      await call('close_debug_session', { sessionId });
    }
  }, 60000);
});
