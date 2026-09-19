/**
 * COBOL Adapter Smoke Test via MCP Interface (issue #759)
 *
 * GnuCOBOL + CodeLLDB behind the COBOL DAP shim. Self-skips without cobc
 * (@requires-cobol) and on environments that block spawning CodeLLDB.
 * Every expected value below was measured in the M0 spike
 * (docs/cobol/spike-notes.md) — the bytes GnuCOBOL 3.1.2/3.2 store for
 * examples/cobol/hello.cob at line 46.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, rmSync, mkdtempSync, writeFileSync } from 'fs';
import os from 'os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { skipIfSpawnBlocked } from '../test-utils/helpers/adapter-spawn.js';
import {
  hasCobolToolchain,
  prepareCobolExample,
  cobolSourcePath,
  cobolExtraSources,
  cobolCopybookDir,
  COBOL_EXAMPLES_DIR
} from './cobol-example-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const SKIP_COBOL = !hasCobolToolchain();

// examples/cobol/hello.cob
const HELLO_BP_LINE = 32;        // PERFORM 1000-INIT (first statement of 0000-MAIN)
const HELLO_COMPUTE_LINE = 46;   // ADD WS-SCALED TO WS-TOTAL — WS-TABLE/WS-TOTAL populated, WS-SCALED untouched
// examples/cobol/copybook/procpara.cpy
const COPYBOOK_BP_LINE = 2;      // COMPUTE CP-PRICE = CP-PRICE * CP-QTY
// examples/cobol/rterror.cob
const RTERROR_LINE = 13;         // ADD WS-CELL(WS-IDX) TO WS-SUM with WS-IDX = 5 (max 3)
// examples/cobol/s0c7.cob
const S0C7_BP_LINE = 11;         // ADD WS-PACKED TO WS-RESULT — WS-PACKED REDEFINES "ABCDE"
// examples/cobol/calls/sub.cob
const SUB_BP_LINE = 16;          // MOVE LS-WORK TO LK-SUM — after ADD, before the MOVEs

type Variable = { name: string; value: string; type?: string; variablesReference?: number; expandable?: boolean };

describe.skipIf(SKIP_COBOL)('MCP Server COBOL Debugging Smoke Test @requires-cobol', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

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
    mcpClient = new Client({ name: 'cobol-smoke-test-client', version: '1.0.0' }, { capabilities: {} });
    await mcpClient.connect(transport);
    console.log('[COBOL Smoke Test] MCP client connected');
  }, 30000);

  afterEach(async () => {
    if (sessionId && mcpClient) {
      await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      sessionId = null;
    }
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

  async function fetchStackTrace(): Promise<Array<{ id?: number; file?: string; name?: string; line?: number }>> {
    const res = await call('get_stack_trace', { includeInternals: false });
    return (res.stackFrames ?? []) as Array<{ id?: number; file?: string; name?: string; line?: number }>;
  }

  const isCobolFrame = (frame: { file?: string }) =>
    typeof frame.file === 'string' && /\.(cob|cbl|cpy)$/i.test(frame.file) && frame.file.replace(/\\/g, '/').includes('/examples/cobol/');

  async function getSession(): Promise<{ state?: string; exitCode?: number; lastStop?: { reason?: string; description?: string; text?: string } } | undefined> {
    const res = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
    const sessions = (res.sessions ?? []) as Array<{ id: string; state?: string; exitCode?: number; lastStop?: { reason?: string; description?: string; text?: string } }>;
    return sessions.find(s => s.id === sessionId);
  }

  async function pollState(want: string, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const snap = await getSession();
      if (snap?.state === want) return snap;
      await wait(300);
    }
    return undefined;
  }

  /** Continue past any launch-time stop until a COBOL frame sits at `line` in a file whose basename matches. */
  async function reachCobolLine(line: number, fileBasename: string): Promise<boolean> {
    await wait(500);
    for (let attempt = 0; attempt < 12; attempt++) {
      const frames = await fetchStackTrace();
      const frame = frames.find(f => isCobolFrame(f) && path.basename(f.file!).toLowerCase() === fileBasename.toLowerCase());
      if (frame && frame.line === line) return true;
      const snap = await getSession();
      if (snap?.state === 'paused') {
        await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      } else if (snap?.state === 'stopped') {
        return false;
      }
      await wait(400);
    }
    return false;
  }

  async function localsByName(): Promise<Map<string, Variable>> {
    const res = await call('get_local_variables', {}) as { success?: boolean; variables?: Variable[] };
    expect(res.success).toBe(true);
    return new Map((res.variables ?? []).map(v => [v.name, v]));
  }

  async function children(ref: number): Promise<Map<string, Variable>> {
    const res = await call('get_variables', { scope: ref }) as { success?: boolean; variables?: Variable[] };
    expect(res.success).toBe(true);
    return new Map((res.variables ?? []).map(v => [v.name, v]));
  }

  async function startOrSkip(ctx: { skip: (reason?: string) => void }, args: Record<string, unknown>, label: string) {
    const startResponse = await call('start_debugging', args);
    if (!startResponse.success) {
      skipIfSpawnBlocked(ctx as never, startResponse, 'COBOL');
      throw new Error(`${label} start_debugging failed: ${JSON.stringify(startResponse, null, 2)}`);
    }
    expect(String(startResponse.message ?? '').toLowerCase()).not.toContain('proxy exited');
    return startResponse;
  }

  it(
    'source-launches hello.cob and shows COBOL-shaped WORKING-STORAGE at a breakpoint',
    async (ctx) => {
      const sourcePath = cobolSourcePath('hello');
      rmSync(path.join(COBOL_EXAMPLES_DIR, '.debug-mcp'), { recursive: true, force: true });

      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-source' })).sessionId as string;
      expect(sessionId).toBeDefined();
      expect((await call('set_breakpoint', { file: sourcePath, line: HELLO_COMPUTE_LINE })).success).toBe(true);

      await startOrSkip(ctx, { scriptPath: sourcePath, dapLaunchArgs: { stopOnEntry: false } }, 'source');
      expect(await reachCobolLine(HELLO_COMPUTE_LINE, 'hello.cob'), 'session should pause at the COBOL breakpoint line').toBe(true);
      expect(existsSync(path.join(COBOL_EXAMPLES_DIR, '.debug-mcp', 'cobol', 'hello')), 'adapter should compile into .debug-mcp/cobol/').toBe(true);

      const frames = await fetchStackTrace();
      const top = frames.find(isCobolFrame)!;
      expect(top.name).toContain('HELLO');
      expect(top.name).toContain('2000-COMPUTE');
      expect(top.line).toBe(HELLO_COMPUTE_LINE);

      // Every measured byte encoding decodes to its COBOL value.
      const ws = await localsByName();
      expect(ws.get('WS-ALPHA')?.value).toBe('"HELLO       "');
      expect(ws.get('WS-U')?.value).toBe('12345');
      expect(ws.get('WS-SCALED')?.value).toBe('-123.45');
      expect(ws.get('WS-SCALED')?.type).toContain('S9(5)V99');
      expect(ws.get('WS-BINARY')?.value).toBe('-123456789');
      expect(ws.get('WS-PACKED')?.value).toBe('-12345.67');
      expect(ws.get('WS-PACKED')?.type).toContain('COMP-3');
      expect(ws.get('WS-COMP5')?.value).toBe('987654321');
      expect(ws.get('WS-DOUBLE')?.value).toMatch(/^3\.14159/);
      expect(ws.get('WS-TOTAL')?.value).toBe('1500.00');
      expect(ws.get('WS-IDX')?.value).toBe('6');
      expect(ws.get('WS-COUNT')?.value).toBe('3');
      expect(ws.get('WS-RAW')?.value).toBe('"00001234"');
      expect(ws.get('WS-ALT')?.value).toBe('1234');
      expect(ws.get('WS-ALT')?.type).toContain('REDEFINES');
      expect(ws.has('b_17'), 'generated-C names must not leak into WORKING-STORAGE').toBe(false);

      // Groups expand; 88-levels evaluate against their parent.
      const group = ws.get('WS-GROUP')!;
      expect(group.variablesReference).toBeGreaterThan(0);
      const groupChildren = await children(group.variablesReference!);
      expect(groupChildren.get('WS-ID')?.value).toBe('42');
      expect(groupChildren.get('WS-NAME')?.value).toBe('"ALICE               "');
      expect(groupChildren.get('WS-STATUS')?.value).toBe('"A"');
      expect(groupChildren.get('WS-STATUS-ACTIVE')?.value).toBe('true');
      expect(groupChildren.get('WS-STATUS-CLOSED')?.value).toBe('false');

      // OCCURS: WS-TABLE -> WS-ENTRY(1..5) -> WS-AMOUNT = index * 100.
      const table = await children(ws.get('WS-TABLE')!.variablesReference!);
      const entry = table.get('WS-ENTRY')!;
      expect(entry.variablesReference).toBeGreaterThan(0);
      const entries = await children(entry.variablesReference!);
      const third = entries.get('WS-ENTRY(3)')!;
      expect(third, `expected WS-ENTRY(3) among ${[...entries.keys()].join(', ')}`).toBeDefined();
      const thirdChildren = await children(third.variablesReference!);
      expect(thirdChildren.get('WS-AMOUNT')?.value).toBe('300');

      // OCCURS DEPENDING ON follows the live count (WS-COUNT = 3, "ABC").
      const odo = await children(ws.get('WS-ODO')!.variablesReference!);
      const items = await children(odo.get('WS-ITEM')!.variablesReference!);
      expect([...items.keys()].filter(k => k.startsWith('WS-ITEM(')).length).toBe(3);
      expect(items.get('WS-ITEM(1)')?.value).toBe('"A"');

      // evaluate_expression speaks COBOL.
      expect(String((await call('evaluate_expression', { expression: 'WS-ID OF WS-GROUP' })).result)).toBe('42');
      expect(String((await call('evaluate_expression', { expression: 'WS-AMOUNT(3)' })).result)).toBe('300');
      expect(String((await call('evaluate_expression', { expression: 'WS-NAME(1:5)' })).result)).toBe('"ALICE"');
      expect(String((await call('evaluate_expression', { expression: 'ws-scaled' })).result)).toBe('-123.45');
      expect(String((await call('evaluate_expression', { expression: '/hex WS-PACKED' })).result)).toBe('0x001234567d');

      // step_over is statement-granular: line 46 ends 2000-COMPUTE (PERFORMed
      // from line 33), so the next COBOL statement is line 34 in 0000-MAIN.
      const stepResponse = await call('step_over', {});
      expect(stepResponse.success).toBe(true);
      await wait(300);
      const afterStep = (await fetchStackTrace()).find(isCobolFrame)!;
      expect(afterStep.file?.toLowerCase().endsWith('hello.cob')).toBe(true);
      expect([34, 47, 48]).toContain(afterStep.line);

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      const stopped = await pollState('stopped', 20000);
      expect(stopped, 'program should run to completion').toBeDefined();
      expect(stopped!.exitCode).toBe(0);

      const outputResult = await callToolSafely(mcpClient!, 'get_output', { sessionId });
      const entriesOut = (outputResult.entries ?? []) as Array<{ output: string }>;
      const marker = entriesOut.find(e => e.output.includes('COBOL_DEBUG_MARKER'));
      expect(marker, 'DISPLAY output should be captured').toBeDefined();
      expect(marker!.output).toContain('total=+0001376.55');
    },
    120000
  );

  it(
    'debugs a prebuilt executable and regenerates the manifest from sources',
    async (ctx) => {
      const { sourcePath, binaryPath } = prepareCobolExample('hello');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-prebuilt' })).sessionId as string;
      expect((await call('set_breakpoint', { file: sourcePath, line: HELLO_BP_LINE })).success).toBe(true);

      await startOrSkip(ctx, {
        scriptPath: binaryPath,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { sources: [sourcePath] }
      }, 'prebuilt');
      expect(await reachCobolLine(HELLO_BP_LINE, 'hello.cob')).toBe(true);

      const ws = await localsByName();
      expect(ws.get('WS-ALPHA')?.value).toBe('"HELLO       "');
      expect(ws.get('WS-TOTAL')?.value).toBe('0.00');

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      const stopped = await pollState('stopped', 20000);
      expect(stopped?.exitCode).toBe(0);
    },
    120000
  );

  it(
    'binds a breakpoint inside a PROCEDURE DIVISION copybook',
    async (ctx) => {
      const sourcePath = cobolSourcePath('copybook');
      const copybook = path.join(cobolCopybookDir('copybook')!, 'procpara.cpy');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-copybook' })).sessionId as string;
      expect((await call('set_breakpoint', { file: copybook, line: COPYBOOK_BP_LINE })).success).toBe(true);

      await startOrSkip(ctx, {
        scriptPath: sourcePath,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { copybookDirs: [cobolCopybookDir('copybook')] }
      }, 'copybook');
      expect(await reachCobolLine(COPYBOOK_BP_LINE, 'procpara.cpy'), 'should pause inside the copybook').toBe(true);

      const top = (await fetchStackTrace()).find(isCobolFrame)!;
      expect(top.name).toContain('9000-FROM-COPYBOOK');
      const ws = await localsByName();
      const rec = await children(ws.get('CP-REC')!.variablesReference!);
      expect(rec.get('CP-QTY')?.value).toBe('12');
      expect(rec.get('CP-PRICE')?.value).toBe('19.99');

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect((await pollState('stopped', 20000))?.exitCode).toBe(0);
    },
    120000
  );

  it(
    'pauses on a libcob runtime error (subscript out of bounds) before the abort',
    async (ctx) => {
      const sourcePath = cobolSourcePath('rterror');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-rterror' })).sessionId as string;

      await startOrSkip(ctx, {
        scriptPath: sourcePath,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { runtimeChecks: true }
      }, 'runtime-error');

      const paused = await pollState('paused', 30000);
      expect(paused, 'session should pause at the runtime error').toBeDefined();
      expect(paused!.lastStop?.reason).toBe('exception');
      expect(`${paused!.lastStop?.description ?? ''} ${paused!.lastStop?.text ?? ''}`).toMatch(/runtime error|out of bounds/i);

      // The generated-C frame is mapped back to the offending COBOL statement.
      const top = (await fetchStackTrace()).find(isCobolFrame)!;
      expect(top, 'a COBOL frame should be visible').toBeDefined();
      expect(top.file?.toLowerCase().endsWith('rterror.cob')).toBe(true);
      expect(top.line).toBe(RTERROR_LINE);
      const ws = await localsByName();
      expect(ws.get('WS-IDX')?.value).toBe('5');

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      const stopped = await pollState('stopped', 20000);
      expect(stopped?.exitCode).toBe(1);
    },
    120000
  );

  it(
    'renders invalid packed data instead of failing (the S0C7 analogue)',
    async (ctx) => {
      const sourcePath = cobolSourcePath('s0c7');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-s0c7' })).sessionId as string;
      expect((await call('set_breakpoint', { file: sourcePath, line: S0C7_BP_LINE })).success).toBe(true);
      await startOrSkip(ctx, { scriptPath: sourcePath, dapLaunchArgs: { stopOnEntry: false } }, 's0c7');
      expect(await reachCobolLine(S0C7_BP_LINE, 's0c7.cob')).toBe(true);

      const ws = await localsByName();
      expect(ws.get('WS-RAW')?.value).toBe('"ABCDE"');
      expect(ws.get('WS-PACKED')?.value).toMatch(/invalid packed: 0x4142434445/i);

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect(await pollState('stopped', 20000)).toBeDefined();
    },
    120000
  );

  it(
    'feeds ACCEPT FROM SYSIN from stdinFile',
    async (ctx) => {
      const sourcePath = cobolSourcePath('sysin');
      const dir = mkdtempSync(path.join(os.tmpdir(), 'cobol-sysin-'));
      const stdinFile = path.join(dir, 'input.txt');
      writeFileSync(stdinFile, 'hello from sysin\n');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-sysin' })).sessionId as string;

      await startOrSkip(ctx, {
        scriptPath: sourcePath,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { stdinFile }
      }, 'stdin');
      const stopped = await pollState('stopped', 30000);
      expect(stopped, 'program should read stdin and finish').toBeDefined();
      expect(stopped!.exitCode).toBe(0);
      const outputResult = await callToolSafely(mcpClient!, 'get_output', { sessionId });
      const entriesOut = (outputResult.entries ?? []) as Array<{ output: string }>;
      expect(entriesOut.some(e => e.output.includes('line=hello from sysin'))).toBe(true);
    },
    120000
  );

  it(
    'shows LINKAGE and LOCAL-STORAGE in a CALLed program and steps out to the caller',
    async (ctx) => {
      const mainSource = cobolSourcePath('calls');
      const [subSource] = cobolExtraSources('calls');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-calls' })).sessionId as string;
      expect((await call('set_breakpoint', { file: subSource, line: SUB_BP_LINE })).success).toBe(true);

      await startOrSkip(ctx, {
        scriptPath: mainSource,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { sources: [subSource] }
      }, 'calls');
      expect(await reachCobolLine(SUB_BP_LINE, 'sub.cob')).toBe(true);

      const frames = await fetchStackTrace();
      expect(frames[0].name).toContain('CALLSUB');
      expect(frames.some(f => (f.name ?? '').includes('CALLMAIN')), 'caller frame should be visible').toBe(true);

      const locals = await localsByName();
      expect(locals.get('LS-TAG')?.value).toBe('"LOCAL "');
      expect(locals.get('LS-WORK')?.value).toBe('1234');
      const rec = await children(locals.get('LK-ARG-REC')!.variablesReference!);
      expect(rec.get('LK-A')?.value).toBe('1000');
      expect(rec.get('LK-B')?.value).toBe('234');
      expect(rec.get('LK-NAME')?.value).toBe('"CALLER    "');

      expect((await call('step_out', {})).success).toBe(true);
      await wait(500);
      const afterOut = (await fetchStackTrace()).find(isCobolFrame)!;
      expect(afterOut.file?.toLowerCase().endsWith('main.cob'), `expected main.cob, got ${afterOut.file}:${afterOut.line}`).toBe(true);

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect((await pollState('stopped', 20000))?.exitCode).toBe(0);
    },
    120000
  );

  it(
    'completes a noDebug launch through the shim (issue #746 behaviour preserved)',
    async (ctx) => {
      const { sourcePath, binaryPath } = prepareCobolExample('hello');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-nodebug' })).sessionId as string;
      expect((await call('set_breakpoint', { file: sourcePath, line: HELLO_BP_LINE })).success).toBe(true);

      const startResponse = await startOrSkip(ctx, {
        scriptPath: binaryPath,
        dapLaunchArgs: { stopOnEntry: false, noDebug: true }
      }, 'noDebug');
      expect(startResponse.state).not.toBe('error');
      expect(String((startResponse as { warning?: string }).warning ?? '')).toMatch(/noDebug is true/);

      const stopped = await pollState('stopped', 20000);
      expect(stopped, 'program should run to completion').toBeDefined();
      expect(stopped!.exitCode).toBe(0);
    },
    120000
  );
});
