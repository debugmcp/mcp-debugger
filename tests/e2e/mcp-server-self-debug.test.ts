/** Exercise the published CLI while it debugs a second MCP server (#717). */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { parseSdkToolResult } from './smoke-test-utils.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
let debuggerClient: Client | undefined;
let targetClient: Client | undefined;
let sessionId: string | undefined;

afterEach(async () => {
  try {
    await targetClient?.close();
    if (sessionId) {
      await debuggerClient?.callTool({ name: 'close_debug_session', arguments: { sessionId } });
    }
  } finally {
    await debuggerClient?.close();
    debuggerClient = targetClient = undefined;
    sessionId = undefined;
  }
});

async function call(name: string, args: Record<string, unknown> = {}) {
  const raw = await debuggerClient!.callTool({ name, arguments: { sessionId, ...args } });
  expect(raw.isError, JSON.stringify(raw)).not.toBe(true);
  return parseSdkToolResult(raw);
}

describe('mcp-debugger debugging itself', () => {
  it('starts a nested HTTP server, inspects a paused MCP request, and resumes its response', async () => {
    const env = Object.fromEntries(Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    ));
    env.MCP_SKIP_ORPHAN_REAPERS = '1';
    delete env.DEBUG_MCP_SKIP_AUTO_START;
    debuggerClient = new Client({ name: 'self-debug-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(root, 'packages/mcp-debugger/dist/cli.mjs'), 'stdio'],
      cwd: root,
      env,
      stderr: 'pipe',
    });
    transport.stderr?.on('data', () => {});
    await debuggerClient.connect(transport);
    sessionId = (await call('create_debug_session', { language: 'javascript', name: 'self-debug' })).sessionId;
    expect(sessionId).toBeDefined();

    const launch = await call('start_debugging', {
      scriptPath: path.join(root, 'dist/index.js'),
      args: ['http', '--port', '0'],
      // The nested server is supervised by the debug session, not by stdin.
      dapLaunchArgs: { stopOnEntry: false, env: { MCP_EXIT_ON_STDIN_CLOSE: '0' } },
    });
    expect(launch.state, JSON.stringify(launch)).toBe('running');

    let endpoint: string | undefined;
    await expect.poll(async () => {
      const output = await call('get_output');
      const text = (output.entries as Array<{ output: string }>).map(entry => entry.output).join('');
      endpoint = text.match(/MCP endpoint available at (http:\/\/127\.0\.0\.1:\d+\/mcp)/)?.[1];
      return endpoint;
    }, { timeout: 15000 }).toBeDefined();
    const health = await fetch(new URL('/health', endpoint!), { signal: AbortSignal.timeout(5000) });
    expect((await health.json() as { status: string }).status).toBe('ok');

    targetClient = new Client({ name: 'nested-test-client', version: '1.0.0' });
    await targetClient.connect(new StreamableHTTPClientTransport(new URL(endpoint!)));
    const file = path.join(root, 'src/cli/http-command.ts');
    const line = readFileSync(file, 'utf8').split('\n').findIndex(text => text.includes("const sessionIdHeader = req.headers['mcp-session-id'];")) + 1;
    expect(line).toBeGreaterThan(0);
    const bp = await call('set_breakpoint', { file, line, condition: "req.body?.method === 'tools/list'" });
    expect(bp.success, JSON.stringify(bp)).toBe(true);

    // The target's response stays in flight while the outer debugger inspects it.
    // Observe rejection immediately so cleanup cannot leave an unhandled promise.
    const response = targetClient.listTools().then(
      result => ({ result, error: undefined }),
      error => ({ result: undefined, error })
    );
    await expect.poll(async () => {
      const listed = await call('list_debug_sessions');
      return (listed.sessions as Array<{ id: string; state: string }>).find(session => session.id === sessionId)?.state;
    }, { timeout: 15000 }).toBe('paused');

    const stack = await call('get_stack_trace');
    expect(stack.stopReason).toBe('breakpoint');
    expect((stack.stackFrames as Array<{ file: string; line: number }>)[0]).toMatchObject({
      file: expect.stringMatching(/http-command\.ts$/i), line,
    });
    expect((await call('evaluate_expression', { expression: "req.body.method === 'tools/list'" })).result).toBe('true');
    expect((await call('evaluate_expression', { expression: 'process.env.DEBUG_MCP_SKIP_AUTO_START' })).result).toBe('undefined');
    expect((await call('step_over')).state).toBe('paused');
    await call('continue_execution');
    const completed = await response;
    expect(completed.error).toBeUndefined();
    expect(completed.result?.tools.map(tool => tool.name)).toContain('start_debugging');
  }, 60000);
});
