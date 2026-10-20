/** Real MCP -> js-debug -> Node coverage for #709/#791/#792. Runs in CI. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle } from '../test-utils/helpers/mcp-stdio-client.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = path.join(root, 'tests/fixtures/javascript-launch-config');
const scriptPath = path.join(fixture, 'target.cjs');
interface Result {
  success: boolean; state?: string; warning?: string; message?: string; error?: string;
  data?: { warning?: string; stopOnEntrySuccessful?: boolean; exitCode?: number; dryRun?: boolean; command?: string };
}
interface Output extends Result { entries: Array<{ seq: number; category: string; output: string }> }
interface LastStop { reason?: string; rawReason?: string; threadId?: number; description?: string; text?: string; timestamp?: number }
interface Listed { id: string; state: string; exitCode?: number; lastStop?: LastStop }
interface Waited extends Result {
  pending?: boolean; exitCode?: number; lastStop?: LastStop; location?: { file: string; line: number };
  context?: { lineContent: string };
}
interface BreakpointRecord {
  id: string; line: number; verified: boolean; verifiedBy?: string; adapterId?: number; message?: string; boundFile?: string; boundLine?: number;
}
let server: StdioClientHandle;

const call = <T extends Result = Result>(name: string, args: Record<string, unknown> = {}): Promise<T> => server.call<T>(name, args);

async function launch(args: Record<string, unknown> = {}): Promise<Result> {
  const result = await call('start_debugging', { scriptPath, ...args });
  expect(result.success, JSON.stringify(result)).toBe(true);
  return result;
}

async function listedSession(): Promise<Listed | undefined> {
  const listed = await call<Result & { sessions: Listed[] }>('list_debug_sessions');
  return listed.sessions.find(session => session.id === server.sessionId);
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
  server = await startStdioClient({
    name: 'launch-config-integration',
    env: { MCP_LAUNCH_CONFIG_VALUE: 'inherited', MCP_LAUNCH_CONFIG_REMOVE: 'inherited' }
  });
  await server.createSession('javascript', 'launch-config');
});

afterEach(async () => {
  await server?.close();
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
    // A dry run is a query (issue #812): the fresh session stays `created`,
    // and the answer names the js-debug adapter command the launch would run.
    expect(dry.state).toBe('created');
    expect(dry.data?.dryRun).toBe(true);
    expect(dry.data?.command).toMatch(/\S/);
    // Before #793 this call was refused with "Session is terminated: <id>".
    await launch({ dapLaunchArgs: { stopOnEntry: false } });
    await expect.poll(async () => (await listedSession())?.state, { timeout: 15_000 }).toBe('paused');
    expect((await listedSession())?.lastStop?.reason).toBe('breakpoint');
    const listed = await call<Result & { breakpoints: Array<{ line: number; verified: boolean }> }>('list_breakpoints');
    expect(listed.breakpoints).toEqual([expect.objectContaining({ line: 9, verified: true })]);
  }, 60_000);

  it('leaves a paused program paused: a dry run on a live session tears nothing down and keeps its records (issue #812)', async () => {
    const bp = await call('set_breakpoint', { file: scriptPath, line: 9 });
    expect(bp.success, JSON.stringify(bp)).toBe(true);
    await launch({ dapLaunchArgs: { stopOnEntry: false } });
    await expect.poll(async () => (await listedSession())?.state, { timeout: 15_000 }).toBe('paused');
    const outputBefore = await call<Output>('get_output');
    expect(outputBefore.entries.length).toBeGreaterThan(0);

    // Measured before the fix: this call killed the program, cleared the stop
    // and emptied the output, and answered success with state "stopped".
    const dry = await launch({ dryRunSpawn: true });
    expect(dry.state).toBe('paused');
    expect(dry.data?.dryRun).toBe(true);
    expect(dry.data?.command).toMatch(/\S/);

    const listed = await listedSession();
    expect(listed?.state).toBe('paused');
    expect(listed?.lastStop?.reason).toBe('breakpoint');
    const stack = await call<Result & { stackFrames: Array<{ line: number }> }>('get_stack_trace');
    expect(stack.success, JSON.stringify(stack)).toBe(true);
    expect(stack.stackFrames.length).toBeGreaterThan(0);
    const outputAfter = await call<Output>('get_output');
    expect(outputAfter.entries).toEqual(outputBefore.entries);
    // The program is still there to drive: it continues into its interval loop.
    const resumed = await call('continue_execution');
    expect(resumed.success, JSON.stringify(resumed)).toBe(true);
    await expect.poll(async () => (await listedSession())?.state, { timeout: 15_000 }).toBe('running');
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
      return listed.sessions.find(session => session.id === server.sessionId)?.exitCode;
    }, { timeout: 15_000 }).toBe(7);
  }, 60_000);
  it('answers pending for a breakpoint the program reaches only later, and wait_for_stop collects it (issue #823)', async () => {
    // Line 13 runs every 100 ms; the condition holds from the 25th tick, well
    // after the launch's short hold. Before #823 a JavaScript launch answered
    // a bare `running` here — no `pending`, no word about the breakpoint —
    // while every other adapter held the call open for up to 30 s.
    const bp = await call('set_breakpoint', { file: scriptPath, line: 13, condition: '(globalThis.launchConfigTicks ?? 0) >= 25' });
    expect(bp.success, JSON.stringify(bp)).toBe(true);
    const launched: Waited = await launch({ dapLaunchArgs: { stopOnEntry: false } });
    expect(launched.state, JSON.stringify(launched)).toBe('running');
    expect(launched.pending).toBe(true);
    expect(launched.message).toContain('1 breakpoint(s)');
    expect(launched.message).toContain('wait_for_stop');
    const stopped = await call<Waited>('wait_for_stop', { timeout: 20_000 });
    expect(stopped.state, JSON.stringify(stopped)).toBe('paused');
    expect(stopped.lastStop?.reason).toBe('breakpoint');
    expect(stopped.location?.line).toBe(13);
  }, 60_000);

  it('answers a breakpoint reached as the program starts from the launch itself (issue #823)', async () => {
    // Line 9 runs at module load. The launch normally answers with the stop;
    // on a machine slow enough to outlast the hold it answers pending and
    // wait_for_stop has the stop — either way the caller ends up paused there.
    const bp = await call('set_breakpoint', { file: scriptPath, line: 9 });
    expect(bp.success, JSON.stringify(bp)).toBe(true);
    const launched: Waited = await launch({ dapLaunchArgs: { stopOnEntry: false } });
    const stopped = launched.pending ? await call<Waited>('wait_for_stop', { timeout: 20_000 }) : launched;
    expect(stopped.state, JSON.stringify(stopped)).toBe('paused');
    // Issue #875: twice under load this case stopped at target.cjs:2 (the
    // program's first statement) as a `breakpoint` stop. The core never
    // auto-continues a breakpoint stop, so that is js-debug's own module-entry
    // breakpoint (set at 1:1 for every file with a user breakpoint) reported
    // as a hit instead of being swallowed. Record what tells that apart from
    // a line-9 breakpoint bound elsewhere: a leaked entry break carries an
    // empty hitBreakpointIds, leaving the line-9 record verified by the
    // adapter, not by the hit (`verifiedBy: 'adapter'`, not `'hit'`).
    const session = await listedSession();
    const listed = await call<Result & { breakpoints: BreakpointRecord[] }>('list_breakpoints');
    const stack = await call<Result & { stackFrames: Array<{ line: number; file?: string; name?: string }> }>('get_stack_trace');
    const evidence = JSON.stringify({ launched, stopped, lastStop: session?.lastStop, breakpoints: listed.breakpoints, top: stack.stackFrames[0] });
    expect(session?.lastStop?.reason, evidence).toBe('breakpoint');
    expect(stack.stackFrames[0]?.line, evidence).toBe(9);
    // The answer that reported the stop — the launch itself, or the wait —
    // names where it is (issue #951): the launch answer carries the same
    // location (and context) wait_for_stop does.
    expect(stopped.location?.line, evidence).toBe(9);
    expect(stopped.context?.lineContent, evidence).toContain("process.argv.includes('--exit')");
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
      return listed.sessions.find(session => session.id === server.sessionId)?.exitCode;
    }, { timeout: 15_000 }).toBe(7);
  }, 60_000);
});
