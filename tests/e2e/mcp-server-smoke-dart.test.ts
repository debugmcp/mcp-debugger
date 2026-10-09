/**
 * Dart launch smoke test through the MCP server (issue #790): the SDK's `dart debug_adapter`
 * behind the stdio bridge. Every expectation here was first measured in the M0 spike
 * (docs/dart/spike-notes.md). Self-skips without a Dart SDK.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { skipIfSpawnBlocked } from '../test-utils/helpers/adapter-spawn.js';
import { DART_EXAMPLES, DART_PROBE_DIR, bpLine, hasDartToolchain, prepareDartProbe } from './dart-example-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const SKIP_DART = !hasDartToolchain();

interface Variable { name: string; value: string; type?: string; variablesReference?: number }
interface Frame { id?: number; file?: string; name?: string; line?: number }

describe.skipIf(SKIP_DART)('MCP Server Dart Debugging Smoke Test @requires-dart', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    const distEntry = path.join(ROOT, 'dist', 'index.js');
    if (!existsSync(distEntry)) {
      throw new Error(`Debug MCP dist build missing at ${distEntry}. Run "pnpm build" before executing tests.`);
    }
    prepareDartProbe();
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [distEntry, '--log-level', 'info'],
      env: { ...process.env, NODE_ENV: 'test' }
    });
    mcpClient = new Client({ name: 'dart-smoke-test-client', version: '1.0.0' }, { capabilities: {} });
    await mcpClient.connect(transport);
  }, 120000);

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
      skipIfSpawnBlocked(ctx as never, res, 'Dart');
      throw new Error(`start_debugging failed: ${JSON.stringify(res, null, 2)}`);
    }
    return res;
  }

  async function createSession(name: string) {
    sessionId = (await call('create_debug_session', { language: 'dart', name })).sessionId as string;
    expect(sessionId).toBeDefined();
  }

  it('launches a pubspec-less file, breaks, inspects, steps and runs to exit 0', async (ctx) => {
    const line = bpLine(DART_EXAMPLES.hello, 'HELLO');
    await createSession('dart-hello');
    expect((await call('set_breakpoint', { file: DART_EXAMPLES.hello, line })).success).toBe(true);
    await startOrSkip(ctx, { scriptPath: DART_EXAMPLES.hello, dapLaunchArgs: { stopOnEntry: false } });

    const paused = await pollState('paused', 30000);
    expect(paused, 'session should pause at the breakpoint').toBeDefined();
    expect(paused!.lastStop?.reason).toBe('breakpoint');
    const top = (await frames())[0];
    expect(top.file?.toLowerCase()).toBe(DART_EXAMPLES.hello.toLowerCase());
    expect(top.line).toBe(line);
    expect(top.name).toBe('main');

    const vars = await locals();
    expect(vars.get('greeting')?.value).toBe('"hello"');
    expect(await evaluate('greeting')).toBe('"hello"');
    expect(await evaluate('greeting.length')).toBe('5');

    expect((await call('step_over', {})).success).toBe(true);
    await pollState('paused', 10000);
    expect([line, line + 1]).toContain((await frames())[0].line);

    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    const stopped = await pollState('stopped', 20000);
    expect(stopped, 'program should run to completion').toBeDefined();
    expect(stopped!.exitCode).toBe(0);
    expect(await output()).toContain('hello mcp-debugger');
  }, 90000);

  it('steps across an await and sees a spawned isolate complete', async (ctx) => {
    const mainLine = bpLine(DART_EXAMPLES.app, 'MAIN');
    const afterAwait = bpLine(DART_EXAMPLES.app, 'AFTER-AWAIT');
    const afterIsolate = bpLine(DART_EXAMPLES.app, 'AFTER-ISOLATE');
    await createSession('dart-app');
    for (const line of [mainLine, afterAwait, afterIsolate]) {
      expect((await call('set_breakpoint', { file: DART_EXAMPLES.app, line })).success).toBe(true);
    }
    await startOrSkip(ctx, { scriptPath: DART_EXAMPLES.app, dapLaunchArgs: { stopOnEntry: false } });

    expect(await pollState('paused', 30000)).toBeDefined();
    expect((await frames())[0].line).toBe(mainLine);
    const atMain = await locals();
    expect(atMain.get('base')?.value).toBe('40');
    expect(atMain.get('counter')?.value).toBe('Counter');
    expect(await evaluate('counter.value')).toBe('40');

    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    await wait(300);
    expect(await pollState('paused', 20000)).toBeDefined();
    expect((await frames())[0].line).toBe(afterAwait);
    expect(await evaluate('doubled')).toBe('84');

    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    await wait(300);
    expect(await pollState('paused', 20000)).toBeDefined();
    expect((await frames())[0].line).toBe(afterIsolate);
    expect(await evaluate('fromIsolate')).toMatch(/List \(3 items\)|\[1, 4, 9\]/);

    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    const stopped = await pollState('stopped', 20000);
    expect(stopped?.exitCode).toBe(0);
    const out = await output();
    expect(out).toContain('squares=[1, 4, 9]');
    expect(out).toContain('to-stderr');
    expect(out).toContain('last line without newline');
  }, 120000);

  it('runs one package:test case under the dart-test runner with a breakpoint in its body', async (ctx) => {
    const line = bpLine(DART_EXAMPLES.mathTest, 'TEST');
    await createSession('dart-test');
    expect((await call('set_breakpoint', { file: DART_EXAMPLES.mathTest, line })).success).toBe(true);
    await startOrSkip(ctx, { scriptPath: DART_EXAMPLES.mathTest, args: ['-n', 'adds numbers'], dapLaunchArgs: { stopOnEntry: false } });

    const paused = await pollState('paused', 60000);
    expect(paused, 'the test isolate should pause at the breakpoint').toBeDefined();
    expect((await frames())[0].line).toBe(line);
    expect((await locals()).get('base')?.value).toBe('40');

    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    const stopped = await pollState('stopped', 60000);
    expect(stopped?.exitCode).toBe(0);
    expect(await output()).toMatch(/adds numbers/);
  }, 120000);

  it('pauses on the uncaught exception only, with the exception text, and exits 255', async (ctx) => {
    await createSession('dart-throws');
    await startOrSkip(ctx, { scriptPath: DART_EXAMPLES.throws, dapLaunchArgs: { stopOnEntry: false }, breakOnExceptions: 'uncaught' });
    const paused = await pollState('paused', 30000);
    expect(paused?.lastStop?.reason).toBe('exception');
    expect(String(paused?.lastStop?.text ?? '')).toContain('ArgumentError');
    expect((await frames())[0].name).toBe('divide');
    expect(await evaluate('b')).toBe('0');
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    const stopped = await pollState('stopped', 20000);
    expect(stopped?.exitCode).toBe(255);
  }, 90000);

  it('logs a logpoint without stopping, then terminates the running program', async (ctx) => {
    const line = bpLine(DART_EXAMPLES.pause, 'TICK');
    await createSession('dart-logpoint');
    const bp = await call('set_breakpoint', { file: DART_EXAMPLES.pause, line, logMessage: 'tick is {tick}' });
    expect(bp.success).toBe(true);
    await startOrSkip(ctx, { scriptPath: DART_EXAMPLES.pause, dapLaunchArgs: { stopOnEntry: false } });
    await wait(1500);
    expect((await getSession())?.state).toBe('running');
    expect(await output()).toMatch(/tick is \d+/);
  }, 60000);

  it('honours noDebug: breakpoints do not stop the program', async (ctx) => {
    const line = bpLine(DART_EXAMPLES.hello, 'HELLO');
    await createSession('dart-nodebug');
    expect((await call('set_breakpoint', { file: DART_EXAMPLES.hello, line })).success).toBe(true);
    await startOrSkip(ctx, { scriptPath: DART_EXAMPLES.hello, dapLaunchArgs: { noDebug: true } });
    const stopped = await pollState('stopped', 20000);
    expect(stopped?.exitCode).toBe(0);
    expect(await output()).toContain('hello mcp-debugger');
  }, 60000);

  it('reports the dart row in doctor', async () => {
    const { spawnSync } = await import('child_process');
    const r = spawnSync(process.execPath, [path.join(ROOT, 'dist', 'index.js'), 'doctor', 'dart', '--json'], { encoding: 'utf8', cwd: DART_PROBE_DIR, env: { ...process.env, NODE_ENV: 'test' } });
    expect(r.status).toBe(0);
    const report = JSON.parse(r.stdout) as { languages: Array<{ language: string; verdict?: string; runtime?: { label?: string; version?: string } }> };
    const row = report.languages.find(l => l.language === 'dart');
    expect(row?.verdict).toBe('ok');
    expect(row?.runtime?.label).toBe('Dart SDK');
    expect(row?.runtime?.version).toMatch(/^\d+\.\d+\.\d+/);
  }, 60000);
});
