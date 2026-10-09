/**
 * Dart attach smoke test (issue #790): a program started with the VM service enabled, attached by
 * service-info file (durable entry stop because the target set --pause_isolates_on_start) and by a
 * no-auth host:port. Detach leaves the target running. Self-skips without a Dart SDK.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { spawn, type ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { skipIfSpawnBlocked } from '../test-utils/helpers/adapter-spawn.js';
import { DART_EXAMPLES, DART_PROBE_DIR, bpLine, dartEnv, findDartSync, hasDartToolchain, prepareDartProbe } from './dart-example-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const SKIP_DART = !hasDartToolchain();

describe.skipIf(SKIP_DART)('MCP Server Dart Attach Smoke Test @requires-dart', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;
  let target: ChildProcess | null = null;
  let tmp: string;

  beforeAll(async () => {
    const distEntry = path.join(ROOT, 'dist', 'index.js');
    if (!existsSync(distEntry)) throw new Error(`Debug MCP dist build missing at ${distEntry}. Run "pnpm build" first.`);
    prepareDartProbe();
    tmp = mkdtempSync(path.join(os.tmpdir(), 'mcp-dart-attach-'));
    transport = new StdioClientTransport({ command: process.execPath, args: [distEntry, '--log-level', 'info'], env: { ...process.env, NODE_ENV: 'test' } });
    mcpClient = new Client({ name: 'dart-attach-test-client', version: '1.0.0' }, { capabilities: {} });
    await mcpClient.connect(transport);
  }, 120000);

  afterEach(async () => {
    if (sessionId && mcpClient) {
      await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      sessionId = null;
    }
    if (target && target.exitCode === null) {
      try { target.kill('SIGKILL'); } catch { /* gone */ }
    }
    target = null;
  });

  afterAll(async () => {
    await mcpClient?.close();
    await transport?.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  async function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    return parseSdkToolResult(await mcpClient!.callTool({ name, arguments: { sessionId, ...args } })) as Record<string, unknown>;
  }

  async function getSession() {
    const res = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
    const sessions = (res.sessions ?? []) as Array<{ id: string; state?: string; lastStop?: { reason?: string } }>;
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

  function startTarget(vmArgs: string[]): ChildProcess {
    const dart = findDartSync()!;
    const child = spawn(dart, [...vmArgs, 'run', DART_EXAMPLES.pause], { cwd: DART_PROBE_DIR, env: dartEnv(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    child.stdout?.on('data', () => { /* drain */ });
    child.stderr?.on('data', () => { /* drain */ });
    target = child;
    return child;
  }

  async function attachOrSkip(ctx: { skip: (reason?: string) => void }, args: Record<string, unknown>) {
    const res = await call('attach_to_process', args);
    if (!res.success) {
      skipIfSpawnBlocked(ctx as never, res, 'Dart');
      throw new Error(`attach_to_process failed: ${JSON.stringify(res, null, 2)}`);
    }
    return res;
  }

  it('attaches by service-info file to a target paused at start, hits a breakpoint, and detaches leaving it alive', async (ctx) => {
    const info = path.join(tmp, 'vm-info.json');
    rmSync(info, { force: true });
    const child = startTarget(['--enable-vm-service=0', '--pause_isolates_on_start', `--write-service-info=${info}`]);
    const deadline = Date.now() + 20000;
    while (!existsSync(info) && Date.now() < deadline) await wait(100);
    expect(existsSync(info), 'the VM should have written its service-info file').toBe(true);

    sessionId = (await call('create_debug_session', { language: 'dart', name: 'dart-attach-info' })).sessionId as string;
    const line = bpLine(DART_EXAMPLES.pause, 'TICK');
    expect((await call('set_breakpoint', { file: DART_EXAMPLES.pause, line })).success).toBe(true);
    await attachOrSkip(ctx, { adapterConfig: { vmServiceInfoFile: info, cwd: DART_PROBE_DIR } });

    const paused = await pollState('paused', 30000);
    expect(paused, 'attach should report the entry pause').toBeDefined();

    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    await wait(300);
    const atBp = await pollState('paused', 20000);
    expect(atBp?.lastStop?.reason).toBe('breakpoint');
    const frames = ((await call('get_stack_trace', { includeInternals: false })).stackFrames ?? []) as Array<{ line?: number }>;
    expect(frames[0]?.line).toBe(line);
    expect(String((await call('evaluate_expression', { expression: 'tick' })).result)).toMatch(/^\d+$/);

    expect((await call('detach_from_process', {})).success).toBe(true);
    await wait(1000);
    expect(child.exitCode, 'detach must leave the target running').toBeNull();
  }, 90000);

  it('attaches by host and port to a running VM started without auth codes, then pauses it', async (ctx) => {
    const port = 8181 + Math.floor(Math.random() * 1000);
    startTarget([`--enable-vm-service=${port}`, '--disable-service-auth-codes']);
    await wait(2500);

    sessionId = (await call('create_debug_session', { language: 'dart', name: 'dart-attach-port' })).sessionId as string;
    const res = await attachOrSkip(ctx, { host: '127.0.0.1', port, adapterConfig: { cwd: DART_PROBE_DIR } });
    expect(String(res.message ?? '')).not.toMatch(/ignored/i);

    // The post-attach pause lands in the event loop: a stop with no user frame is still a stop.
    const paused = await pollState('paused', 30000);
    expect(paused, 'attach should leave the target paused').toBeDefined();
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    await wait(500);
    expect((await getSession())?.state).toBe('running');
  }, 90000);
});
