/** Real MCP -> js-debug -> Node coverage for #709/#791/#792. Runs in CI. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = path.join(root, 'tests/fixtures/javascript-launch-config');
const scriptPath = path.join(fixture, 'target.cjs');
const scrubbed = new Set(['NODE_OPTIONS', 'DEBUG_MCP_SKIP_AUTO_START', 'MCP_DEBUGGER_EXITCODE_FILE',
  'MCP_DEBUGGER_EXITCODE_CLAIMED', 'DEBUG', 'DAP_TRACE_FILE']);
interface Result {
  success: boolean; state?: string; warning?: string; message?: string;
  data?: { warning?: string; stopOnEntrySuccessful?: boolean; exitCode?: number };
}
let client: Client;
let sessionId: string | undefined;

async function call<T extends Result = Result>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const raw = await client.callTool({ name, arguments: { ...(sessionId ? { sessionId } : {}), ...args } }, undefined, { timeout: 30_000 });
  expect(raw.isError, JSON.stringify(raw)).not.toBe(true);
  const content = raw.content as Array<{ type: string; text?: string }>;
  return JSON.parse(content.find(item => item.type === 'text')!.text!) as T;
}

async function launch(args: Record<string, unknown> = {}): Promise<Result> {
  const result = await call('start_debugging', { scriptPath, ...args });
  expect(result.success, JSON.stringify(result)).toBe(true);
  return result;
}

async function inspect(): Promise<string> {
  const stack = await call<Result & { stackFrames: Array<{ id: number }> }>('get_stack_trace');
  expect(stack.stackFrames.length).toBeGreaterThan(0);
  const result = await call<Result & { result: string }>('evaluate_expression', {
    frameId: stack.stackFrames[0].id,
    expression: "JSON.stringify({value:process.env.MCP_LAUNCH_CONFIG_VALUE,removed:Object.hasOwn(process.env,'MCP_LAUNCH_CONFIG_REMOVE'),fileOnly:process.env.MCP_LAUNCH_CONFIG_FILE_ONLY,nodeEnv:process.env.NODE_ENV,stackLimit:Error.stackTraceLimit})"
  });
  expect(result.success).toBe(true);
  return result.result;
}

beforeEach(async () => {
  client = new Client({ name: 'launch-config-integration', version: '1' });
  const env = Object.fromEntries(Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && !scrubbed.has(entry[0].toUpperCase())
  ));
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'dist/index.js'), 'stdio'],
    cwd: root, env: { ...env, MCP_SKIP_ORPHAN_REAPERS: '1', MCP_EXIT_ON_STDIN_CLOSE: '1',
      MCP_LAUNCH_CONFIG_VALUE: 'inherited', MCP_LAUNCH_CONFIG_REMOVE: 'inherited' }, stderr: 'pipe' });
  transport.stderr?.on('data', () => {});
  await client.connect(transport);
  const created = await call<Result & { sessionId: string }>('create_debug_session', { language: 'javascript', name: 'launch-config' });
  expect(created.success).toBe(true);
  sessionId = created.sessionId;
});

afterEach(async () => {
  try {
    if (sessionId) await client.callTool({ name: 'close_debug_session', arguments: { sessionId } }, undefined, { timeout: 5000 }).catch(() => {});
  } finally {
    sessionId = undefined;
    await client?.close();
  }
}, 15_000);

describe('JavaScript launch configuration', () => {
  it.each([
    [undefined, true], [false, true], [true, false]
  ])('honors adapter entry-stop intent with DAP=%s and adapter=%s', async (dapStop, adapterStop) => {
    const result = await launch({ dapLaunchArgs: { stopOnEntry: dapStop }, adapterLaunchConfig: { stopOnEntry: adapterStop } });
    expect(result.state).toBe(adapterStop ? 'paused' : 'running');
    expect(result.data?.stopOnEntrySuccessful).toBe(adapterStop);
    const restarted = await call('restart_debugging');
    expect(restarted.success, JSON.stringify(restarted)).toBe(true);
    expect(restarted.state).toBe(adapterStop ? 'paused' : 'running');
    expect(restarted.data?.stopOnEntrySuccessful).toBe(adapterStop);
  }, 60_000);

  it('reports configuration handling in the response/output and clears notices on a subsequent launch', async () => {
    const result = await launch({ dapLaunchArgs: { stopOnEntry: true, outFiles: 'dist/**' }, adapterLaunchConfig: {
      console: 'externalTerminal', sourceMapPathOverides: {}, runtimeArgs: '--inspect', trace: null
    } });
    expect(result.state).toBe('paused');
    expect(result.warning).toContain('dapLaunchArgs.outFiles: expected an array of strings');
    expect(result.warning).toContain('adapterLaunchConfig.console: ignored');
    expect(result.warning).toContain('did you mean sourceMapPathOverrides?');
    expect(result.warning).toContain('adapterLaunchConfig.runtimeArgs');
    expect(result.warning).toContain('adapterLaunchConfig.trace');
    const output = await call<Result & { entries: Array<{ output: string }> }>('get_output', { limit: 1000 });
    expect(output.entries.filter(entry => entry.output.includes('dapLaunchArgs.outFiles:'))).toHaveLength(1);
    const clean = await launch({ dapLaunchArgs: { stopOnEntry: true },
      adapterLaunchConfig: { sourceMapPathOverrides: {}, runtimeSourcemapPausePatterns: [] } });
    expect(clean.warning).toBeUndefined();
    const cleanOutput = await call<Result & { entries: Array<{ output: string }> }>('get_output', { limit: 1000 });
    expect(cleanOutput.entries.some(entry => entry.output.includes('dapLaunchArgs.outFiles:'))).toBe(false);
  }, 60_000);

  it('applies file/explicit precedence, null deletion and NODE_OPTIONS in the actual target', async () => {
    const config = { cwd: fixture, envFile: 'environment.env', stopOnEntry: true };
    expect((await launch({ adapterLaunchConfig: config })).state).toBe('paused');
    expect(await inspect()).toContain('"value":"file"');
    expect(await inspect()).toContain('"stackLimit":37');
    expect(await inspect()).toContain('"nodeEnv":"production"');
    expect((await launch({ adapterLaunchConfig: { ...config,
      env: { MCP_LAUNCH_CONFIG_VALUE: 'explicit', MCP_LAUNCH_CONFIG_REMOVE: null, NODE_ENV: 'explicit', NODE_OPTIONS: '--stack-trace-limit=23' }
    } })).state).toBe('paused');
    const actual = await inspect();
    expect(actual).toContain('"value":"explicit"');
    expect(actual).toContain('"removed":false');
    expect(actual).toContain('"fileOnly":"file-only"');
    expect(actual).toContain('"nodeEnv":"explicit"');
    expect(actual).toContain('"stackLimit":23');
  }, 60_000);

  it('preserves available diagnostics on a failed transform', async () => {
    const failed = await call('start_debugging', { scriptPath, adapterLaunchConfig: { envFile: fixture, outFiles: 'bad' } });
    expect(failed.success).toBe(false);
    expect(failed.message).toContain('Cannot read envFile');
    expect(failed.data?.warning).toContain('adapterLaunchConfig.outFiles');
  });

  it('returns configuration diagnostics on dry runs', async () => {
    const dry = await launch({ dryRunSpawn: true, adapterLaunchConfig: { runtimeArgs: 'bad' } });
    expect(dry.warning).toContain('adapterLaunchConfig.runtimeArgs');
  });

  it('keeps noDebug running and preserves exit-code recording with envFile', async () => {
    const result = await launch({ args: ['--exit'], adapterLaunchConfig: {
      noDebug: true, stopOnEntry: true, envFile: path.join(fixture, 'environment.env')
    } });
    expect(result.data?.stopOnEntrySuccessful).toBe(false);
    expect(result.warning).toContain('noDebug');
    await expect.poll(async () => {
      const listed = await call<Result & { sessions: Array<{ id: string; exitCode?: number }> }>('list_debug_sessions');
      return listed.sessions.find(session => session.id === sessionId)?.exitCode;
    }, { timeout: 15_000 }).toBe(7);
  }, 60_000);
});
