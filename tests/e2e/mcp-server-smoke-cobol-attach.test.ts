/**
 * COBOL attach-by-PID smoke test (issue #759, milestone M2)
 *
 * Spawns the prebuilt examples/cobol/pause.cob binary (300 ticks of C$SLEEP),
 * attaches by PID through the COBOL shim over CodeLLDB, and checks what a
 * migrator sees on first contact with a batch job: the process is paused inside
 * libcob / C$SLEEP (no COBOL source at the top of the stack), and the stack,
 * scopes and locals still show PAUSE's WORKING-STORAGE with WS-TICK counting.
 * Once with the symbol manifest regenerated from `sources` at attach time
 * (translate-only `cobc -C`, the binary untouched), once with `manifestDirs`
 * pointing at that regeneration. `detach_from_process` leaves the job alive.
 *
 * Self-skips without cobc (@requires-cobol). On Linux, Yama ptrace scope 1
 * blocks it (the debuggee is a sibling of the tracer, as in the C/C++ attach
 * test); the attach response then reads as an environmental skip.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync, statSync } from 'fs';
import { spawn, type ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { skipIfSpawnBlocked, type SkippableContext } from '../test-utils/helpers/adapter-spawn.js';
import { hasCobolToolchain, prepareCobolExample, cobcEnv } from './cobol-example-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const SKIP_COBOL = !hasCobolToolchain();

type Variable = { name: string; value: string; type?: string };
type Frame = { id?: number; name?: string; file?: string; line?: number };

describe.skipIf(SKIP_COBOL)('MCP Server COBOL Attach Smoke Test @requires-cobol', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;
  let debuggee: ChildProcess | null = null;

  beforeAll(async () => {
    const distEntry = path.join(ROOT, 'dist', 'index.js');
    if (!existsSync(distEntry)) {
      throw new Error(`Debug MCP dist build missing at ${distEntry}. Run "pnpm build" before executing tests.`);
    }
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [distEntry, '--log-level', 'info'],
      env: { ...process.env, NODE_ENV: 'test' }
    });
    mcpClient = new Client({ name: 'cobol-attach-test-client', version: '1.0.0' }, { capabilities: {} });
    await mcpClient.connect(transport);
  }, 30000);

  afterEach(async () => {
    if (sessionId && mcpClient) {
      await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      sessionId = null;
    }
    if (debuggee && !debuggee.killed) {
      debuggee.kill('SIGKILL');
    }
    debuggee = null;
  });

  afterAll(async () => {
    if (mcpClient) {
      await mcpClient.close();
      mcpClient = null;
    }
    if (transport) {
      await transport.close();
      transport = null;
    }
  });

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  async function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    return parseSdkToolResult(await mcpClient!.callTool({ name, arguments: { sessionId, ...args } })) as Record<string, unknown>;
  }

  async function sessionState(): Promise<string | undefined> {
    const res = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
    return ((res.sessions ?? []) as Array<{ id: string; state?: string }>).find(s => s.id === sessionId)?.state;
  }

  async function pollState(want: string, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if ((await sessionState()) === want) {
        return true;
      }
      await wait(400);
    }
    return false;
  }

  async function localsByName(): Promise<Map<string, Variable>> {
    const res = await call('get_local_variables', {});
    return new Map(((res.variables ?? []) as Variable[]).map(v => [v.name, v]));
  }

  /** WS-TICK is PIC 9(9): the shim renders it as a plain decimal. */
  async function readTick(): Promise<number> {
    const tick = (await localsByName()).get('WS-TICK');
    expect(tick, 'WS-TICK in get_local_variables').toBeDefined();
    expect(tick!.value).toMatch(/^\d+$/);
    return Number(tick!.value);
  }

  function spawnPauseExample(): { sourcePath: string; binaryPath: string; pid: number } {
    const { sourcePath, binaryPath } = prepareCobolExample('pause');
    expect(existsSync(binaryPath)).toBe(true);
    // libcob's DLL lives beside cobc on Windows/MSYS2: the example needs that PATH.
    debuggee = spawn(binaryPath, [], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env: cobcEnv() });
    expect(debuggee.pid).toBeDefined();
    return { sourcePath, binaryPath, pid: debuggee.pid! };
  }

  async function attachOrSkip(ctx: SkippableContext, pid: number, adapterConfig: Record<string, unknown>): Promise<void> {
    const attachResponse = await call('attach_to_process', { processId: pid, stopOnEntry: true, adapterConfig });
    if (!attachResponse.success) {
      skipIfSpawnBlocked(ctx, attachResponse, 'COBOL');
      const message = String(attachResponse.message ?? attachResponse.error ?? '').toLowerCase();
      if (message.includes('ptrace') || message.includes('operation not permitted')) {
        ctx.skip();
      }
      throw new Error(`attach_to_process failed: ${JSON.stringify(attachResponse, null, 2)}`);
    }
    expect(await pollState('paused', 20000), 'attached session should be paused (stopOnEntry)').toBe(true);
  }

  /** The newest artifact directory a regeneration for the pause binary produced (beside the binary). */
  function newestPauseArtifactDir(binaryPath: string): string {
    const root = path.join(path.dirname(binaryPath), '.debug-mcp', 'cobol', 'pause-manifest');
    const dirs = readdirSync(root, { withFileTypes: true })
      .filter(d => d.isDirectory() && existsSync(path.join(root, d.name, 'manifest-index.json')))
      .map(d => path.join(root, d.name))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    expect(dirs.length, `artifact directories under ${root}`).toBeGreaterThan(0);
    return dirs[0];
  }

  it(
    'attaches to a running COBOL job, regenerates its manifest from sources and shows WORKING-STORAGE from inside C$SLEEP',
    async (ctx) => {
      const { sourcePath, binaryPath, pid } = spawnPauseExample();
      await wait(1200);
      expect(debuggee!.exitCode).toBeNull();

      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-attach-sources' })).sessionId as string;
      await attachOrSkip(ctx, pid, { program: binaryPath, sources: [sourcePath] });

      // Paused inside libcob / the OS sleep: the visible stack still names the COBOL frame.
      const frames = (await call('get_stack_trace', {})).stackFrames as Frame[];
      const cobolFrame = frames.find(f => (f.file ?? '').toLowerCase().endsWith('pause.cob'));
      expect(cobolFrame, `expected a pause.cob frame in ${JSON.stringify(frames)}`).toBeDefined();
      expect(cobolFrame!.name).toContain('PAUSE');
      expect(cobolFrame!.line).toBeGreaterThanOrEqual(10);
      expect(cobolFrame!.line).toBeLessThanOrEqual(13);

      // The raw top frame is not COBOL; scopes for it are served from the nearest COBOL frame up the stack.
      const raw = (await call('get_stack_trace', { includeInternals: true })).stackFrames as Frame[];
      expect(raw.length).toBeGreaterThan(frames.length);
      const scopes = (await call('get_scopes', { frameId: raw[0].id })).scopes as Array<{ name: string }>;
      expect(scopes.map(s => s.name)).toEqual([expect.stringMatching(/^WORKING-STORAGE of PAUSE \(0000-MAIN, \d+ frames? up\)$/)]);

      const tick1 = await readTick();
      expect(tick1).toBeGreaterThanOrEqual(1);
      expect((await localsByName()).get('WS-ONE')?.value).toBe('1');
      // evaluate walks up too and says so: `3 (evaluated in frame #6 PAUSE: 0000-MAIN …)`.
      expect(String((await call('evaluate_expression', { expression: 'WS-TICK' })).result)).toMatch(new RegExp('^' + tick1 + ' [(]evaluated in frame #[0-9]+ PAUSE'));

      // Let the job run, pause it again: WS-TICK moved on and is read from the new stop.
      expect((await call('continue_execution', {})).success).toBe(true);
      expect(await pollState('running', 5000)).toBe(true);
      await wait(2500);
      expect((await call('pause_execution', {})).success).toBe(true);
      expect(await pollState('paused', 10000)).toBe(true);
      const tick2 = await readTick();
      expect(tick2).toBeGreaterThan(tick1);

      // Detach: the job keeps ticking.
      expect((await call('detach_from_process', {})).success).toBe(true);
      sessionId = null;
      await wait(1000);
      expect(debuggee!.exitCode).toBeNull();
      debuggee!.kill('SIGKILL');
    },
    120000
  );

  it(
    'attaches with manifestDirs from an earlier regeneration, without touching cobc',
    async (ctx) => {
      const { binaryPath, pid } = spawnPauseExample();
      await wait(1200);
      const manifestDir = newestPauseArtifactDir(binaryPath);

      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-attach-manifestdirs' })).sessionId as string;
      await attachOrSkip(ctx, pid, { program: binaryPath, manifestDirs: [manifestDir] });

      expect(await readTick()).toBeGreaterThanOrEqual(1);
      expect((await call('detach_from_process', {})).success).toBe(true);
      sessionId = null;
      await wait(700);
      expect(debuggee!.exitCode).toBeNull();
      debuggee!.kill('SIGKILL');
    },
    120000
  );
});
