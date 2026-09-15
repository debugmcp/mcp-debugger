/** Exercise the published CLI while it debugs a second MCP server (#717). */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { requireCliBundle } from '../test-utils/helpers/cli-bundle.js';
import { parseSdkToolResult } from './smoke-test-utils.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Inherited values that would change what the nested server prints or how it
 * launches: a bind address rewrites the announce line's authority, DEBUG floods
 * the captured output, and NODE_OPTIONS with the exit-code shim markers are
 * what a nested server must scrub itself (issue #731) — kept out of the outer
 * CLI's env so this test starts from a clean outer session either way.
 *
 * Compared upper-cased because `{ ...process.env }` is a plain, case-SENSITIVE
 * object while `process.env` itself is a case-insensitive proxy on Windows — a
 * `delete` by exact name misses a differently-cased inherited key.
 */
const SCRUBBED_ENV = [
  'DEBUG_MCP_SKIP_AUTO_START',
  'MCP_HTTP_BIND',
  'DEBUG',
  'NODE_OPTIONS',
  'MCP_DEBUGGER_EXITCODE_FILE',
  'MCP_DEBUGGER_EXITCODE_CLAIMED',
];

/** Cap on one teardown call, well inside the hooks' own timeout. */
const TEARDOWN_STEP_MS = 10_000;

let debuggerClient: Client | undefined;
let targetClient: Client | undefined;
let sessionId: string | undefined;
let innerDir: string | undefined;

/** Run one teardown call, bounded and swallowing, so it cannot skip the rest. */
async function teardownStep(action: () => Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    action().catch(() => {}),
    new Promise<void>((resolve) => { timer = setTimeout(resolve, TEARDOWN_STEP_MS); }),
  ]);
  clearTimeout(timer);
}

// Registered FIRST so vitest's default `sequence.hooks: 'stack'` runs it LAST.
// This is the heaviest teardown in the suite — the outer CLI owns js-debug and
// the nested server, and orphan reaping is disabled for it — so closing it gets
// its own hook and its own timeout rather than riding inside the session
// teardown's try block, where a hook timeout would skip it entirely.
afterEach(async () => {
  await teardownStep(async () => { await debuggerClient?.close(); });
  debuggerClient = undefined;
}, 30000);

afterEach(async () => {
  await teardownStep(async () => { await targetClient?.close(); });
  if (sessionId) {
    const id = sessionId;
    await teardownStep(async () => {
      await debuggerClient?.callTool({ name: 'close_debug_session', arguments: { sessionId: id } });
    });
  }
  targetClient = undefined;
  sessionId = undefined;
  if (innerDir) {
    rmSync(innerDir, { recursive: true, force: true });
    innerDir = undefined;
  }
}, 30000);

/** Call a tool on the NESTED server (the debuggee), through targetClient. */
async function callNested(name: string, args: Record<string, unknown> = {}) {
  const raw = await targetClient!.callTool({ name, arguments: args });
  expect(raw.isError, JSON.stringify(raw)).not.toBe(true);
  return parseSdkToolResult(raw);
}

async function call(name: string, args: Record<string, unknown> = {}) {
  const raw = await debuggerClient!.callTool({ name, arguments: { sessionId, ...args } });
  expect(raw.isError, JSON.stringify(raw)).not.toBe(true);
  return parseSdkToolResult(raw);
}

/**
 * Drain every output entry produced since `cursor`. `get_output` pages at 100
 * entries by default, so a fixed call only ever sees the first page and a
 * startup line that lands past it would never be read.
 */
async function readOutputSince(cursor: { since: number }): Promise<string> {
  let text = '';
  for (;;) {
    const page = await call('get_output', { since: cursor.since, limit: 1000 });
    text += (page.entries as Array<{ output: string }>).map(entry => entry.output).join('');
    cursor.since = page.nextSince as number;
    if (!page.hasMore) return text;
  }
}

describe('mcp-debugger debugging itself', () => {
  it('starts a nested HTTP server, inspects a paused MCP request, and resumes its response', async () => {
    const env = Object.fromEntries(Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined && !SCRUBBED_ENV.includes(entry[0].toUpperCase())
    ));
    // Scoped to the outer CLI only — the nested launch clears it below. Reaping
    // beside a live server is safe: a proxy whose owner pid is alive is skipped
    // (src/utils/proxy-orphan-reaper.ts).
    env.MCP_SKIP_ORPHAN_REAPERS = '1';

    debuggerClient = new Client({ name: 'self-debug-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [requireCliBundle(root), 'stdio'],
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
      dapLaunchArgs: {
        stopOnEntry: false,
        // The nested server is supervised by the debug session, not by stdin.
        // An empty MCP_SKIP_ORPHAN_REAPERS is not "1"/"true", so the nested
        // server runs its janitor exactly as a standalone one would.
        env: { MCP_EXIT_ON_STDIN_CLOSE: '0', MCP_SKIP_ORPHAN_REAPERS: '' },
      },
    });
    expect(launch.state, JSON.stringify(launch)).toBe('running');

    const cursor = { since: 0 };
    let transcript = '';
    let endpoint: string | undefined;
    await expect.poll(async () => {
      transcript += await readOutputSince(cursor);
      // Loose authority: announceListening prints whatever address was bound,
      // which is only 127.0.0.1 while nothing has widened the bind.
      endpoint = transcript.match(/MCP endpoint available at (http:\/\/[^/\s]+\/mcp)/)?.[1];
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

    // Issue #720: once continued, the listing must not repeat the stop the
    // session just left as if it were still paused.
    let resumed: { state: string; lastStop?: unknown } | undefined;
    await expect.poll(async () => {
      const listed = await call('list_debug_sessions');
      resumed = (listed.sessions as Array<{ id: string; state: string; lastStop?: unknown }>).find(session => session.id === sessionId);
      return resumed?.state;
    }, { timeout: 15000 }).toBe('running');
    expect(resumed, JSON.stringify(resumed)).not.toHaveProperty('lastStop');

    // Issue #731: the nested server inherits the outer session's exit-code shim
    // env; a JavaScript session it launches must still report its debuggee's
    // exit code, with no env workaround on the inner launch.
    innerDir = mkdtempSync(path.join(os.tmpdir(), 'mcp-self-debug-inner-'));
    const innerScript = path.join(innerDir, 'exit-seven.js');
    writeFileSync(innerScript, 'process.exit(7);' + os.EOL);
    const innerId = (await callNested('create_debug_session', { language: 'javascript', name: 'inner' })).sessionId as string;
    const innerLaunch = await callNested('start_debugging', {
      sessionId: innerId, scriptPath: innerScript, dapLaunchArgs: { stopOnEntry: false },
    });
    expect(innerLaunch.success, JSON.stringify(innerLaunch)).toBe(true);
    await expect.poll(async () => {
      const listed = await callNested('list_debug_sessions');
      return (listed.sessions as Array<{ id: string; state: string; exitCode?: number }>).find(session => session.id === innerId);
    }, { timeout: 20000 }).toMatchObject({ state: 'stopped', exitCode: 7 });
    await callNested('close_debug_session', { sessionId: innerId });
  }, 90000);
});
