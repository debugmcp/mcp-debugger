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
import {
  FLUTTER_EXAMPLES, FLUTTER_PROBE_DIR, bpLine, findFlutterRootSync, flutterDesktopDeviceId, hasFlutterToolchain, prepareFlutterProbe,
} from './dart-example-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const SKIP_FLUTTER = !hasFlutterToolchain();
const DESKTOP = SKIP_FLUTTER ? null : flutterDesktopDeviceId();

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
    const sessions = (res.sessions ?? []) as Array<{ id: string; state?: string; exitCode?: number; lastStop?: { reason?: string; text?: string } }>;
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

  describe.skipIf(!DESKTOP)(`desktop (${DESKTOP ?? 'no desktop device'})`, () => {
    it('flutter run: breaks in build(), reads the widget state, keeps running after continue, and terminates on close', async (ctx) => {
      const line = bpLine(FLUTTER_EXAMPLES.main, 'BUILD');
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
      // Closing the session terminates the app; the Flutter adapter then exits by itself.
      expect((await callToolSafely(mcpClient!, 'close_debug_session', { sessionId })).success).toBe(true);
      sessionId = null;
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
