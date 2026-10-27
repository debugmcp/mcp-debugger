/**
 * Flutter smoke test through the MCP server (issue #790, M2): `flutter debug-adapter --test` for
 * widget and integration tests, `flutter debug-adapter` for `flutter run -d <desktop>`. Measured
 * through the real server on 2026-10-09 (Flutter 3.47.7, Windows): a widget-test breakpoint and a
 * desktop `build()` breakpoint each take ~30 s from a cold example (kernel compile, runner build)
 * and a few seconds warm; a `flutter test` session ends with `terminated` only, so the session is
 * `stopped` without an exit code. Self-skips without a Flutter SDK; the desktop cases also skip
 * when `flutter devices` lists no desktop target, on Linux without a display, and anywhere with
 * `MCP_SKIP_FLUTTER_DESKTOP=1` (CI's ubuntu lane sets it and runs the widget tests only). The
 * tool lists the host desktop whenever the platform feature flag is on, so a Windows box with
 * Flutter but no Visual Studio still reaches the runner build and fails there: install the
 * toolchain `flutter doctor` names, or set the variable.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { skipIfSpawnBlocked } from '../test-utils/helpers/adapter-spawn.js';
import { killProcesses, listPidsByImage, waitForProcessesToExit } from '../test-utils/helpers/process-table.js';
import {
  FLUTTER_EXAMPLES, FLUTTER_PROBE_DIR, bpLine, findFlutterRootSync, flutterDesktopDeviceId, flutterRunMachine, flutterWebDeviceId, hasFlutterToolchain, prepareFlutterProbe,
} from './dart-example-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const SKIP_FLUTTER = !hasFlutterToolchain();
const DESKTOP = SKIP_FLUTTER ? null : flutterDesktopDeviceId();
const WEB = SKIP_FLUTTER ? null : flutterWebDeviceId();

interface Variable { name: string; value: string; type?: string; variablesReference?: number }
interface Frame { id?: number; file?: string; name?: string; line?: number }

describe.skipIf(SKIP_FLUTTER)('MCP Server Flutter Debugging Smoke Test @requires-flutter', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    const distEntry = path.join(ROOT, 'dist', 'index.js');
    if (!existsSync(distEntry)) {
      throw new Error(`Debug MCP dist build missing at ${distEntry}. Run "pnpm build" before executing tests.`);
    }
    prepareFlutterProbe();
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [distEntry, '--log-level', 'info'],
      // The adapter finds Flutter the way the helper did; FLUTTER_ROOT makes that explicit.
      env: { ...process.env, NODE_ENV: 'test', FLUTTER_ROOT: findFlutterRootSync() ?? '' }
    });
    mcpClient = new Client({ name: 'flutter-smoke-test-client', version: '1.0.0' }, { capabilities: {} });
    await mcpClient.connect(transport);
  }, 600000);

  afterEach(async () => {
    if (sessionId && mcpClient) {
      await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      sessionId = null;
    }
  });

  afterAll(async () => {
    await mcpClient?.close();
    mcpClient = null;
    await transport?.close();
    transport = null;
  });

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  async function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    return parseSdkToolResult(await mcpClient!.callTool({ name, arguments: { sessionId, ...args } })) as Record<string, unknown>;
  }

  async function frames(): Promise<Frame[]> {
    const res = await call('get_stack_trace', { includeInternals: false });
    return (res.stackFrames ?? []) as Frame[];
  }

  async function getSession() {
    const res = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
    const sessions = (res.sessions ?? []) as Array<{ id: string; state?: string; exitCode?: number; endNote?: string; lastStop?: { reason?: string; text?: string; threadId?: number } }>;
    return sessions.find(s => s.id === sessionId);
  }

  async function pollState(want: string, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const snap = await getSession();
      if (snap?.state === want) return snap;
      await wait(250);
    }
    return undefined;
  }

  async function locals(): Promise<Map<string, Variable>> {
    const res = await call('get_local_variables', {}) as { success?: boolean; variables?: Variable[] };
    expect(res.success).toBe(true);
    return new Map((res.variables ?? []).map(v => [v.name, v]));
  }

  async function evaluate(expression: string): Promise<string> {
    return String((await call('evaluate_expression', { expression })).result);
  }

  async function output(): Promise<string> {
    const res = await callToolSafely(mcpClient!, 'get_output', { sessionId });
    const entries = ((res as { entries?: Array<{ text?: string; output?: string }> }).entries ?? []);
    return entries.map(e => e.text ?? e.output ?? '').join('');
  }

  async function startOrSkip(ctx: { skip: (reason?: string) => void }, args: Record<string, unknown>) {
    const res = await call('start_debugging', args);
    if (!res.success) {
      skipIfSpawnBlocked(ctx as never, res, 'Flutter');
      throw new Error(`start_debugging failed: ${JSON.stringify(res, null, 2)}`);
    }
    return res;
  }

  /**
   * `wait_for_stop` in slices under the MCP client's 60 s request cap: a cold compile or a
   * runner build can keep the first stop away for longer than that, and a single long
   * server-side wait then fails on the client side, not the debugger's.
   */
  async function waitForPause(timeoutMs: number, what: string) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const slice = Math.min(45_000, Math.max(1_000, deadline - Date.now()));
      const waited = await call('wait_for_stop', { timeout: slice });
      if (waited.state === 'paused') return (await getSession())!;
      const stillRunning = waited.pending === true || waited.state === 'running';
      if (!stillRunning || Date.now() >= deadline) {
        throw new Error(`${what}: wait_for_stop answered ${JSON.stringify(waited)}; output tail: ${(await output()).slice(-600)}`);
      }
    }
  }

  /** The launch answers `pending` while the test VM compiles; the first stop is what matters. */
  async function firstStop(launched: Record<string, unknown>, timeoutMs: number) {
    if (launched.state === 'paused') return (await getSession())!;
    return waitForPause(timeoutMs, 'first stop');
  }


  async function createSession(name: string) {
    sessionId = (await call('create_debug_session', { language: 'dart', name })).sessionId as string;
    expect(sessionId).toBeDefined();
  }

  it('widget test: breaks in the test body, inspects the tester and the widget tree, finishes with a terminated-only end', async (ctx) => {
    const line = bpLine(FLUTTER_EXAMPLES.widgetTest, 'WIDGET');
    await createSession('flutter-widget-test');
    expect((await call('set_breakpoint', { file: FLUTTER_EXAMPLES.widgetTest, line })).success).toBe(true);
    const launched = await startOrSkip(ctx, {
      scriptPath: FLUTTER_EXAMPLES.widgetTest, args: ['--name', 'increments'], dapLaunchArgs: { stopOnEntry: false, cwd: FLUTTER_PROBE_DIR },
    });
    expect(await output()).toContain('runner: flutter-test');

    const paused = await firstStop(launched, 120000);
    expect(paused.lastStop?.reason).toBe('breakpoint');
    const top = (await frames())[0];
    expect(top.file?.toLowerCase()).toBe(FLUTTER_EXAMPLES.widgetTest.toLowerCase());
    expect(top.line).toBe(line);
    expect(top.name).toContain('main');

    expect((await locals()).get('tester')?.value).toContain('WidgetTester');
    expect(await evaluate('find.text("count: 0").evaluate().length')).toBe('1');

    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    const stopped = await pollState('stopped', 60000);
    expect(stopped, 'the test run should finish').toBeDefined();
    // `flutter test` sends `terminated` without `exited`: no exit code, the ✓ line says it passed.
    expect(await output()).toContain('✓ increments');
    expect(await output()).toContain('counter=1');
  }, 240000);

  it('widget test: stops at entry on the test file\'s main when asked', async (ctx) => {
    await createSession('flutter-widget-entry');
    const launched = await startOrSkip(ctx, {
      scriptPath: FLUTTER_EXAMPLES.widgetTest, args: ['--name', 'increments'], dapLaunchArgs: { stopOnEntry: true, cwd: FLUTTER_PROBE_DIR },
    });
    const paused = await firstStop(launched, 120000);
    expect(paused.lastStop?.reason).toBe('entry');
    const top = (await frames())[0];
    expect(top.file?.toLowerCase()).toBe(FLUTTER_EXAMPLES.widgetTest.toLowerCase());
    expect(top.name).toBe('main');
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    expect(await pollState('stopped', 60000), 'the test run should finish').toBeDefined();
  }, 240000);

  describe.skipIf(!WEB)(`web (${WEB ?? 'no browser device'})`, () => {
    it('flutter run in the browser: breaks in build(), reads the widget state, hot-reloads and hot-restarts in place, and ends on close', async (ctx) => {
      const line = bpLine(FLUTTER_EXAMPLES.main, 'BUILD');
      await createSession('flutter-web');
      expect((await call('set_breakpoint', { file: FLUTTER_EXAMPLES.main, line })).success).toBe(true);
      const launched = await startOrSkip(ctx, {
        scriptPath: FLUTTER_EXAMPLES.main,
        // Headless: what CI's runner takes; measured on Windows at the same first-stop time as a windowed Chrome.
        dapLaunchArgs: { stopOnEntry: false, cwd: FLUTTER_PROBE_DIR, deviceId: WEB, toolArgs: ['--web-browser-flag=--headless=new'] },
      });
      expect(await output()).toContain('runner: flutter');

      // The web build (dwds) takes ~20 s warm; the launch answers pending and wait_for_stop collects the stop.
      const paused = await firstStop(launched, 240000);
      expect(paused.lastStop?.reason).toBe('breakpoint');
      const top = (await frames())[0];
      expect(top.name).toMatch(/build$/);
      expect(top.line).toBe(line);
      expect(await evaluate('counter')).toBe('0');
      expect(await output()).toContain('Connected to the VM Service.');

      // Hot reload: the reassemble lands on build() again, in-call (issue #876).
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      await wait(1000);
      const reloaded = await call('hot_reload', {});
      expect(reloaded.success, JSON.stringify(reloaded)).toBe(true);
      const afterReload = reloaded.state === 'paused' ? (await getSession())! : await waitForPause(30000, 'the build() breakpoint after the hot reload');
      expect(afterReload.lastStop?.reason).toBe('breakpoint');

      // Hot restart through restart_debugging: main() re-runs in the same browser session (issue #876).
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      await wait(500);
      const restarted = await call('restart_debugging', {});
      expect(restarted.success, JSON.stringify(restarted)).toBe(true);
      expect((restarted.data as { hotRestart?: boolean } | undefined)?.hotRestart).toBe(true);
      const afterRestart = restarted.state === 'paused' ? (await getSession())! : await waitForPause(30000, 'the build() breakpoint after the hot restart');
      expect(afterRestart.lastStop?.reason).toBe('breakpoint');
      expect(await evaluate('counter')).toBe('0');

      expect((await callToolSafely(mcpClient!, 'close_debug_session', { sessionId })).success).toBe(true);
      sessionId = null;
    }, 400000);
  });

  it('a launch whose deviceId matches no device ends with the devices flutter found, in wait_for_stop and the listing (issue #877)', async (ctx) => {
    await createSession('flutter-bogus-device');
    await startOrSkip(ctx, { scriptPath: FLUTTER_EXAMPLES.main, dapLaunchArgs: { stopOnEntry: false, cwd: FLUTTER_PROBE_DIR, deviceId: 'bogus' } });
    // Measured: the tool prints its device list and exits ~3 s after the launch answered.
    const ended = await call('wait_for_stop', { timeout: 30000 });
    expect(ended.state).toBe('stopped');
    expect(String(ended.message)).toMatch(/'bogus' matched no device/);
    // The handler hoists the adapter's reading of the end beside the message (its own keys).
    const devices = (ended.availableDevices ?? []) as Array<{ id: string }>;
    expect(devices.map((d) => d.id)).toEqual(expect.arrayContaining([DESKTOP ?? 'chrome']));
    const listed = await getSession();
    expect(String(listed?.endNote)).toMatch(/matched no device/);
  }, 120000);

  describe.skipIf(!DESKTOP)(`desktop (${DESKTOP ?? 'no desktop device'})`, () => {
    it('flutter run: breaks in build(), reads the widget state, keeps running after continue, and terminates on close', async (ctx) => {
      const line = bpLine(FLUTTER_EXAMPLES.main, 'BUILD');
      const appsBefore = await listPidsByImage('flutter_probe');
      await createSession('flutter-desktop');
      expect((await call('set_breakpoint', { file: FLUTTER_EXAMPLES.main, line })).success).toBe(true);
      const launched = await startOrSkip(ctx, {
        scriptPath: FLUTTER_EXAMPLES.main, dapLaunchArgs: { stopOnEntry: false, cwd: FLUTTER_PROBE_DIR, deviceId: DESKTOP },
      });
      expect(await output()).toContain('runner: flutter');

      const paused = await firstStop(launched, 180000);
      expect(paused.lastStop?.reason).toBe('breakpoint');
      const top = (await frames())[0];
      expect(top.name).toBe('_ProbeAppState.build');
      expect(top.line).toBe(line);
      const vars = await locals();
      expect(vars.has('this')).toBe(true);
      expect(vars.has('context')).toBe(true);
      expect(await evaluate('counter')).toBe('0');
      expect(await evaluate('this.history.length')).toBe('0');

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      await wait(1500);
      expect((await getSession())?.state).toBe('running');
      const appPids = (await listPidsByImage('flutter_probe')).filter((pid) => !appsBefore.includes(pid));
      expect(appPids, 'the desktop app is on the process table while the session runs').not.toEqual([]);

      // Closing the session must end the app, not only the session: the SDK adapter's
      // `disconnect` SIGKILLs its own tool processes and leaves the app it started running;
      // only a DAP `terminate` (`app.stop`) reaches it, so the worker sends one first and the
      // adapter then exits by itself (issue #885). Asserted on the process table, because the
      // tool's answer was already truthful about the session when the app survived.
      expect((await callToolSafely(mcpClient!, 'close_debug_session', { sessionId })).success).toBe(true);
      sessionId = null;
      const survivors = await waitForProcessesToExit(appPids, { timeoutMs: 5000, image: 'flutter_probe' });
      if (survivors.length > 0) await killProcesses(survivors);
      expect(survivors, 'flutter_probe survived close_debug_session (issue #885)').toEqual([]);
    }, 300000);

    it('attach: an app another flutter run started, by its app.debugPort URI — the timer breakpoint hits, detach leaves it running (issue #882)', async (ctx) => {
      const line = bpLine(FLUTTER_EXAMPLES.main, 'TICK');
      const appsBefore = await listPidsByImage('flutter_probe');
      const external = flutterRunMachine(DESKTOP!);
      try {
        expect(await external.waitFor('app.debugPort', 180000), 'app.debugPort from flutter run --machine').not.toBeNull();
        await external.waitFor('app.started', 60000);
        await createSession('flutter-desktop-attach');
        expect((await call('set_breakpoint', { file: FLUTTER_EXAMPLES.main, line })).success).toBe(true);
        const attached = await call('attach_to_process', {
          stopOnEntry: false, adapterConfig: { runner: 'flutter', deviceId: DESKTOP, cwd: FLUTTER_PROBE_DIR, vmServiceUri: external.wsUri },
        });
        if (!attached.success) skipIfSpawnBlocked(ctx as never, attached, 'Flutter');
        expect(attached.success, JSON.stringify(attached)).toBe(true);

        // The probe's periodic timer reaches the breakpoint on its own: no tap, no hot reload.
        const paused = await waitForPause(60000, 'the timer breakpoint after attach');
        expect(paused.lastStop?.reason).toBe('breakpoint');
        const top = (await frames())[0];
        expect(top.line).toBe(line);
        expect(top.name).toBe('_ProbeAppState.initState.<anonymous closure>');
        expect(await evaluate('ticks')).toMatch(/^\d+$/);

        expect((await call('detach_from_process', {})).success).toBe(true);
        sessionId = null;
        await wait(1000);
        expect(external.alive, 'the app keeps running after detach').toBe(true);
      } finally {
        await external.stop();
        const leftovers = (await listPidsByImage('flutter_probe')).filter((pid) => !appsBefore.includes(pid));
        if (leftovers.length > 0) await killProcesses(leftovers);
      }
    }, 300000);

    it('restart_debugging is a hot restart: the DAP restart Flutter advertises re-runs main() in under a few seconds, breakpoints hold, the process stays (issue #876)', async (ctx) => {
      const line = bpLine(FLUTTER_EXAMPLES.main, 'BUILD');
      const appsBefore = await listPidsByImage('flutter_probe');
      await createSession('flutter-desktop-hot-restart');
      expect((await call('set_breakpoint', { file: FLUTTER_EXAMPLES.main, line })).success).toBe(true);
      const launched = await startOrSkip(ctx, {
        scriptPath: FLUTTER_EXAMPLES.main, dapLaunchArgs: { stopOnEntry: false, cwd: FLUTTER_PROBE_DIR, deviceId: DESKTOP },
      });
      const first = await firstStop(launched, 180000);
      expect(first.lastStop?.reason).toBe('breakpoint');
      const threadBefore = first.lastStop?.threadId;
      const appPids = (await listPidsByImage('flutter_probe')).filter((pid) => !appsBefore.includes(pid));
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      await wait(500);

      const started = Date.now();
      const restarted = await call('restart_debugging', {});
      expect(restarted.success, JSON.stringify(restarted)).toBe(true);
      const data = restarted.data as { hotRestart?: boolean; outputReset?: boolean; pending?: boolean; reason?: string } | undefined;
      expect(data?.hotRestart, 'the adapter advertised restart, so no relaunch').toBe(true);
      expect(data?.outputReset, 'same process: the output buffer is kept').toBeUndefined();
      // The re-run main() reaches build() again: measured ~0.4 s after the request on this box.
      const again = restarted.state === 'paused' ? (await getSession())! : await waitForPause(30000, 'the build() breakpoint after the hot restart');
      expect(Date.now() - started).toBeLessThan(20000);
      expect(again.lastStop?.reason).toBe('breakpoint');
      expect(again.lastStop?.threadId, 'a hot restart runs a new isolate').not.toBe(threadBefore);
      expect((await frames())[0].line).toBe(line);
      expect(await evaluate('counter')).toBe('0');
      const bps = (await call('list_breakpoints', {})).breakpoints as Array<{ verified?: boolean }>;
      expect(bps.every((b) => b.verified === true), 'breakpoints re-verified after the restart').toBe(true);
      expect((await listPidsByImage('flutter_probe')).filter((pid) => !appsBefore.includes(pid)), 'the same app process').toEqual(appPids);

      expect((await callToolSafely(mcpClient!, 'close_debug_session', { sessionId })).success).toBe(true);
      sessionId = null;
      const survivors = await waitForProcessesToExit(appPids, { timeoutMs: 5000, image: 'flutter_probe' });
      if (survivors.length > 0) await killProcesses(survivors);
      expect(survivors).toEqual([]);
    }, 300000);

    it('hot_reload: the reassemble lands on the build() breakpoint within the call, state survives, the process stays (issue #876)', async (ctx) => {
      const line = bpLine(FLUTTER_EXAMPLES.main, 'BUILD');
      const appsBefore = await listPidsByImage('flutter_probe');
      await createSession('flutter-desktop-hot-reload');
      expect((await call('set_breakpoint', { file: FLUTTER_EXAMPLES.main, line })).success).toBe(true);
      const launched = await startOrSkip(ctx, {
        scriptPath: FLUTTER_EXAMPLES.main, dapLaunchArgs: { stopOnEntry: false, cwd: FLUTTER_PROBE_DIR, deviceId: DESKTOP },
      });
      const first = await firstStop(launched, 180000);
      expect(first.lastStop?.reason).toBe('breakpoint');
      const appPids = (await listPidsByImage('flutter_probe')).filter((pid) => !appsBefore.includes(pid));
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      await wait(1200);

      const started = Date.now();
      const reloaded = await call('hot_reload', {});
      expect(reloaded.success, JSON.stringify(reloaded)).toBe(true);
      // Measured: the reassemble runs build() ~150 ms after the request, so the answer is the stop.
      const again = reloaded.state === 'paused' ? (await getSession())! : await waitForPause(30000, 'the build() breakpoint after the hot reload');
      expect(Date.now() - started).toBeLessThan(20000);
      expect(again.lastStop?.reason).toBe('breakpoint');
      expect((await frames())[0].line).toBe(line);
      // State survives a hot reload: the timer kept counting since launch (a hot restart would
      // have reset it), the counter kept its value.
      expect(Number(await evaluate('ticks'))).toBeGreaterThanOrEqual(1);
      expect(await evaluate('counter')).toBe('0');
      expect((await listPidsByImage('flutter_probe')).filter((pid) => !appsBefore.includes(pid)), 'the same app process').toEqual(appPids);

      expect((await callToolSafely(mcpClient!, 'close_debug_session', { sessionId })).success).toBe(true);
      sessionId = null;
      const survivors = await waitForProcessesToExit(appPids, { timeoutMs: 5000, image: 'flutter_probe' });
      if (survivors.length > 0) await killProcesses(survivors);
      expect(survivors).toEqual([]);
    }, 300000);

    it('integration test on the desktop: the test\'s tap hits the app\'s breakpoint', async (ctx) => {
      const testLine = bpLine(FLUTTER_EXAMPLES.integrationTest, 'INTEGRATION');
      const appLine = bpLine(FLUTTER_EXAMPLES.main, 'INCREMENT');
      await createSession('flutter-integration');
      expect((await call('set_breakpoint', { file: FLUTTER_EXAMPLES.integrationTest, line: testLine })).success).toBe(true);
      expect((await call('set_breakpoint', { file: FLUTTER_EXAMPLES.main, line: appLine })).success).toBe(true);
      const launched = await startOrSkip(ctx, {
        scriptPath: FLUTTER_EXAMPLES.integrationTest, dapLaunchArgs: { stopOnEntry: false, cwd: FLUTTER_PROBE_DIR, deviceId: DESKTOP },
      });
      expect(await output()).toContain('runner: flutter-test');

      const atTest = await firstStop(launched, 180000);
      expect(atTest.lastStop?.reason).toBe('breakpoint');
      expect((await frames())[0].line).toBe(testLine);

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      await waitForPause(60000, "the app's breakpoint on the test's tap");
      const top = (await frames())[0];
      expect(top.file?.toLowerCase()).toBe(FLUTTER_EXAMPLES.main.toLowerCase());
      expect(top.line).toBe(appLine);
      expect(top.name).toBe('_ProbeAppState.increment.<anonymous closure>');
      expect(await evaluate('counter')).toBe('0');

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect(await pollState('stopped', 90000), 'the integration test should finish').toBeDefined();
      expect(await output()).toContain('✓ device increment');
    }, 400000);
  });
});
