/**
 * The session tree with real debugpy (issue #1081): a Python launch with
 * `dapLaunchArgs.subProcess: true` used to park every child the program
 * spawned until a debug client attached, which this server never did
 * (#1005). The worker now holds debugpy's report and the server adopts or
 * releases it, so the program runs to its end either way.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';
import { ensurePythonOnPath } from './env-utils.js';

const currentDirName = path.dirname(fileURLToPath(import.meta.url));
const inheritFixture = path.resolve(currentDirName, '../../../fixtures/python/subprocess-inherit/spawn_child.py');

let client: Client | null = null;

async function startTestServer(): Promise<void> {
  const serverScriptPath = path.resolve(currentDirName, '../../../../dist/index.js');
  client = new Client({ name: 'mcp-test-client', version: '0.1.0' }, { capabilities: {} });

  const env: Record<string, string> = {};
  for (const key in process.env) {
    if (process.env[key] !== undefined) env[key] = process.env[key] as string;
  }
  ensurePythonOnPath(env);

  const logFilePath = path.resolve(currentDirName, '../../subprocess_tree_test_server.log');
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

describe('Python child processes under subProcess: true (the session tree, issue #1081) @requires-python', () => {
  beforeAll(async () => {
    await startTestServer();
  }, 30000);

  afterAll(async () => {
    await stopTestServer();
  });

  it('a launch that spawns a child with sub-process debugging on runs to its end instead of parking', async () => {
    const created = await call('create_debug_session', { language: 'python', name: 'subprocess-tree-release' });
    expect(created.success).toBe(true);
    const sessionId = created.sessionId as string;

    try {
      const started = await call('start_debugging', {
        sessionId,
        scriptPath: inheritFixture,
        breakOnExceptions: 'none',
        dapLaunchArgs: { stopOnEntry: false, subProcess: true }
      });
      expect(started.success, JSON.stringify(started)).toBe(true);

      let ended = started;
      if (started.state === 'running') {
        ended = await call('wait_for_stop', { sessionId, timeout: 30000 });
      }
      const output = await call('get_output', { sessionId });
      const transcript = JSON.stringify(output);

      expect(['stopped', 'terminated'], JSON.stringify(ended)).toContain(ended.state);
      expect(transcript).toContain('child exit 0 child ok');
      expect(ended.exitCode ?? ended.data?.exitCode, transcript).toBe(0);
    } finally {
      await call('close_debug_session', { sessionId });
    }
  }, 60000);
});
