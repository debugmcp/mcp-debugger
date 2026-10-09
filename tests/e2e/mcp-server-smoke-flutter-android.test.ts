/**
 * Flutter on an Android emulator through the MCP server (issue #790, M3): `flutter run -d
 * emulator-NNNN` with a breakpoint in `build()`, and an `integration_test` on the emulator whose
 * tap hits the app's breakpoint. Measured through the real server on 2026-10-09 (Flutter 3.47.7,
 * Windows, AVD `mcp_api35` booted headless, Gradle warm): the `build()` breakpoint in ~21 s, the
 * integration test's breakpoints in ~28 s; the first `flutter run` after a fresh APK install once
 * ended without a stop, so the helper installs the APK up front and stops the app and clears
 * port forwards before every launch.
 *
 * Opt-in by booting an emulator (`flutter emulators --launch <id>`); self-skips without Flutter,
 * adb, an online emulator, or with `MCP_SKIP_FLUTTER_ANDROID=1`. CI never runs it.
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
  FLUTTER_EXAMPLES, FLUTTER_PROBE_DIR, bpLine, findFlutterRootSync, flutterEmulatorDeviceId, hasFlutterToolchain,
  prepareFlutterAndroid, resetAndroidApp,
} from './dart-example-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const EMULATOR = hasFlutterToolchain() ? flutterEmulatorDeviceId() : null;

interface Frame { id?: number; file?: string; name?: string; line?: number }

describe.skipIf(!EMULATOR)(`MCP Server Flutter Android Smoke Test @requires-flutter @requires-emulator (${EMULATOR ?? 'no emulator online'})`, () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    const distEntry = path.join(ROOT, 'dist', 'index.js');
    if (!existsSync(distEntry)) {
      throw new Error(`Debug MCP dist build missing at ${distEntry}. Run "pnpm build" before executing tests.`);
    }
    prepareFlutterAndroid(EMULATOR!);
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [distEntry, '--log-level', 'info'],
      env: { ...process.env, NODE_ENV: 'test', FLUTTER_ROOT: findFlutterRootSync() ?? '' }
    });
    mcpClient = new Client({ name: 'flutter-android-smoke-test-client', version: '1.0.0' }, { capabilities: {} });
    await mcpClient.connect(transport);
  }, 1_200_000);

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
    const sessions = (res.sessions ?? []) as Array<{ id: string; state?: string; exitCode?: number; lastStop?: { reason?: string } }>;
    return sessions.find(s => s.id === sessionId);
  }

  async function pollState(want: string, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const snap = await getSession();
      if (snap?.state === want) return snap;
      await wait(500);
    }
    return undefined;
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
    resetAndroidApp(EMULATOR!);
    const res = await call('start_debugging', args);
    if (!res.success) {
      skipIfSpawnBlocked(ctx as never, res, 'Flutter');
      throw new Error(`start_debugging failed: ${JSON.stringify(res, null, 2)}`);
    }
    return res;
  }

  async function firstStop(launched: Record<string, unknown>, timeoutMs: number) {
    if (launched.state === 'paused') return (await getSession())!;
    const waited = await call('wait_for_stop', { timeout: timeoutMs });
    expect(waited.state, `first stop (wait_for_stop answered ${JSON.stringify(waited)}; output: ${(await output()).slice(-600)})`).toBe('paused');
    return (await getSession())!;
  }

  async function createSession(name: string) {
    sessionId = (await call('create_debug_session', { language: 'dart', name })).sessionId as string;
    expect(sessionId).toBeDefined();
  }

  it('flutter run on the emulator: breaks in build(), reads the widget state, keeps running after continue', async (ctx) => {
    const line = bpLine(FLUTTER_EXAMPLES.main, 'BUILD');
    await createSession('flutter-android');
    expect((await call('set_breakpoint', { file: FLUTTER_EXAMPLES.main, line })).success).toBe(true);
    const launched = await startOrSkip(ctx, {
      scriptPath: FLUTTER_EXAMPLES.main, dapLaunchArgs: { stopOnEntry: false, cwd: FLUTTER_PROBE_DIR, deviceId: EMULATOR },
    });
    const paused = await firstStop(launched, 300000);
    expect(paused.lastStop?.reason).toBe('breakpoint');
    const top = (await frames())[0];
    expect(top.name).toBe('_ProbeAppState.build');
    expect(top.line).toBe(line);
    expect(await evaluate('counter')).toBe('0');
    expect(await output()).toContain('Connected to the VM Service.');

    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    await wait(1500);
    expect((await getSession())?.state).toBe('running');
    expect((await callToolSafely(mcpClient!, 'close_debug_session', { sessionId })).success).toBe(true);
    sessionId = null;
  }, 600000);

  it('integration test on the emulator: the test\'s tap hits the app\'s breakpoint, and the run finishes', async (ctx) => {
    const testLine = bpLine(FLUTTER_EXAMPLES.integrationTest, 'INTEGRATION');
    const appLine = bpLine(FLUTTER_EXAMPLES.main, 'INCREMENT');
    await createSession('flutter-android-integration');
    expect((await call('set_breakpoint', { file: FLUTTER_EXAMPLES.integrationTest, line: testLine })).success).toBe(true);
    expect((await call('set_breakpoint', { file: FLUTTER_EXAMPLES.main, line: appLine })).success).toBe(true);
    const launched = await startOrSkip(ctx, {
      scriptPath: FLUTTER_EXAMPLES.integrationTest, dapLaunchArgs: { stopOnEntry: false, cwd: FLUTTER_PROBE_DIR, deviceId: EMULATOR },
    });
    const atTest = await firstStop(launched, 300000);
    expect(atTest.lastStop?.reason).toBe('breakpoint');
    expect((await frames())[0].line).toBe(testLine);

    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    const atApp = await call('wait_for_stop', { timeout: 120000 });
    expect(atApp.state, JSON.stringify(atApp)).toBe('paused');
    const top = (await frames())[0];
    expect(top.file?.toLowerCase()).toBe(FLUTTER_EXAMPLES.main.toLowerCase());
    expect(top.line).toBe(appLine);
    expect(await evaluate('counter')).toBe('0');

    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    expect(await pollState('stopped', 180000), 'the integration test should finish').toBeDefined();
    expect(await output()).toContain('✓ device increment');
  }, 900000);
});
