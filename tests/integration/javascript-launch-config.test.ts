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
  success: boolean; state?: string; warning?: string; message?: string; error?: string;
  data?: { warning?: string; stopOnEntrySuccessful?: boolean; exitCode?: number; dryRun?: boolean };
}
interface Listed { id: string; state: string; exitCode?: number; lastStop?: { reason?: string } }
interface Waited extends Result {
  pending?: boolean; exitCode?: number; lastStop?: { reason?: string }; location?: { file: string; line: number };
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

async function listedSession(): Promise<Listed | undefined> {
  const listed = await call<Result & { sessions: Listed[] }>('list_debug_sessions');
  return listed.sessions.find(session => session.id === sessionId);
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

  it('keeps the session usable after a dry run: the real launch on the same session binds the breakpoint set before it (issue #793)', async () => {
    // Line 9 (`if (process.argv.includes('--exit'))`) runs on both fixture paths.
    const bp = await call('set_breakpoint', { file: scriptPath, line: 9 });
    expect(bp.success, JSON.stringify(bp)).toBe(true);
    const dry = await launch({ dryRunSpawn: true });
    expect(dry.state).toBe('stopped');
    expect(dry.data?.dryRun).toBe(true);
    // Before #793 this call was refused with "Session is terminated: <id>".
    // It lands inside the dry-run worker's exit window, so the launcher's
    // leftover-proxy teardown runs on a still-live proxy every time.
    await launch({ dapLaunchArgs: { stopOnEntry: false } });
    await expect.poll(async () => (await listedSession())?.state, { timeout: 15_000 }).toBe('paused');
    expect((await listedSession())?.lastStop?.reason).toBe('breakpoint');
    const listed = await call<Result & { breakpoints: Array<{ line: number; verified: boolean }> }>('list_breakpoints');
    expect(listed.breakpoints).toEqual([expect.objectContaining({ line: 9, verified: true })]);
  }, 60_000);

  it('accepts a breakpoint set after the program ran to completion and hits it on the relaunch (issue #806)', async () => {
    await launch({ args: ['--exit'], dapLaunchArgs: { stopOnEntry: false } });
    await expect.poll(async () => (await listedSession())?.exitCode, { timeout: 15_000 }).toBe(7);
    expect((await listedSession())?.state).toBe('stopped');
    // Before #806 this call was refused with "Session is terminated: <id>",
    // while remove/list/clear_breakpoints and restart_debugging were accepted.
    const bp = await call('set_breakpoint', { file: scriptPath, line: 9 });
    expect(bp.success, JSON.stringify(bp)).toBe(true);
    const restarted = await call('restart_debugging');
    expect(restarted.success, JSON.stringify(restarted)).toBe(true);
    await expect.poll(async () => (await listedSession())?.state, { timeout: 15_000 }).toBe('paused');
    expect((await listedSession())?.lastStop?.reason).toBe('breakpoint');
  }, 60_000);

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
  it('wait_for_stop answers pending on an idle program, then blocks until a breakpoint set on it is hit (issue #849)', async () => {
    const launched = await launch({ dapLaunchArgs: { stopOnEntry: false } });
    expect(launched.state).toBe('running');
    // Nothing armed: the wait runs out, and says the program is still running.
    const idle = await call<Waited>('wait_for_stop', { timeout: 300 });
    expect(idle, JSON.stringify(idle)).toMatchObject({ success: true, state: 'running', pending: true });
    expect(idle.message).toContain('wait_for_stop');
    // Line 13 is inside the fixture's interval callback, so it is reached
    // again and again by the program that is already running.
    const bp = await call('set_breakpoint', { file: scriptPath, line: 13 });
    expect(bp.success, JSON.stringify(bp)).toBe(true);
    const stopped = await call<Waited>('wait_for_stop', { timeout: 20_000 });
    expect(stopped.state, JSON.stringify(stopped)).toBe('paused');
    expect(stopped.pending).toBeUndefined();
    expect(stopped.lastStop?.reason).toBe('breakpoint');
    expect(stopped.location?.line).toBe(13);
    expect((await listedSession())?.lastStop?.reason).toBe('breakpoint');
    // continue_execution does not wait; wait_for_stop collects the next hit.
    expect((await call('continue_execution')).success).toBe(true);
    const again = await call<Waited>('wait_for_stop', { timeout: 20_000 });
    expect(again.state, JSON.stringify(again)).toBe('paused');
    expect(again.location?.line).toBe(13);
  }, 60_000);

  it('wait_for_stop reports how the program ended, and keeps answering on the finished session (issue #849)', async () => {
    await launch({ args: ['--exit'], dapLaunchArgs: { stopOnEntry: false } });
    const ended = await call<Waited>('wait_for_stop', { timeout: 20_000 });
    expect(ended, JSON.stringify(ended)).toMatchObject({ success: true, state: 'stopped', exitCode: 7 });
    expect(ended.message).toContain('exited with code 7');
    expect(ended.pending).toBeUndefined();
    // The session is over but not closed: the same question gets the same answer.
    const asked = await call<Waited>('wait_for_stop', { timeout: 300 });
    expect(asked).toMatchObject({ success: true, state: 'stopped', exitCode: 7 });
  }, 60_000);

  it('wait_for_stop refuses a session that was never started (issue #849)', async () => {
    const refused = await call<Waited>('wait_for_stop', { timeout: 300 });
    expect(refused.success).toBe(false);
    expect(refused.error).toContain('has not been started');
  });

  it('reports the debuggee exit code for a debugger-on launch (issue #735)', async () => {
    // js-debug never sends `exited`; the code comes from the preload shim's
    // recorded value (#247). The noDebug case above covered only that flag.
    // The poll on list_debug_sessions is the guarantee; the summary branch is
    // reached only when the fixture exits before launch readiness resolves,
    // which js-debug's handshake usually wins.
    const result = await launch({ args: ['--exit'], dapLaunchArgs: { stopOnEntry: false } });
    if (result.state === 'stopped') {
      expect(result.data?.exitCode, JSON.stringify(result)).toBe(7);
      expect(result.message).toContain('exited with code 7');
    }
    await expect.poll(async () => {
      const listed = await call<Result & { sessions: Array<{ id: string; exitCode?: number }> }>('list_debug_sessions');
      return listed.sessions.find(session => session.id === sessionId)?.exitCode;
    }, { timeout: 15_000 }).toBe(7);
  }, 60_000);
});
