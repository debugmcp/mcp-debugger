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
  cobolModuleSources,
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
const HELLO_AFTER_INIT_LINE = 33;   // PERFORM 2000-COMPUTE — the statement after PERFORM 1000-INIT
const HELLO_PERFORM_REPORT_LINE = 34; // PERFORM 3000-REPORT
const HELLO_STOP_RUN_LINE = 35;     // STOP RUN — the statement after PERFORM 3000-REPORT
const REPORT_FIRST_LINE = 48;       // DISPLAY "COBOL_DEBUG_MARKER: total=" — first statement of 3000-REPORT
// examples/cobol/perform.cob — the PERFORM shapes of the #764 review
const PF_IF_PERFORM_LINE = 21;      // PERFORM 1000-YES (inside the IF's true branch)
const PF_AFTER_IF_LINE = 25;        // DISPLAY "after-if count=" — what runs after the IF
const PF_TIMES_LINE = 26;           // PERFORM 2000-BUMP 3 TIMES
const PF_AFTER_TIMES_LINE = 27;     // DISPLAY "after-times times="
const PF_OUTER_LINE = 28;           // PERFORM 3000-OUTER (nested)
const PF_AFTER_OUTER_LINE = 29;     // DISPLAY "after-outer nested="
const PF_UNTIL_LINE = 30;           // PERFORM 5000-UNTIL UNTIL WS-UNTIL > 2 (cobc 3.2 puts the test on this line)
const PF_AFTER_UNTIL_LINE = 31;     // DISPLAY "after-until until="
const PF_VARY_LINE = 32;            // PERFORM 6000-VARY VARYING … (out-of-line)
const PF_AFTER_VARY_LINE = 33;      // DISPLAY "after-vary vary="
const PF_MARKER_LINE = 35;          // DISPLAY "COBOL_DEBUG_MARKER: last=" — after PERFORM 4000-TAIL
const PF_BUMP_BODY_LINE = 42;       // ADD 1 TO WS-TIMES (2000-BUMP's only statement, performed 3 TIMES)
const PF_INNER_BODY_LINE = 47;      // ADD 10 TO WS-NESTED (3100-INNER, performed as 3000-OUTER's last statement)
const PF_TAIL_PERFORM_LINE = 50;    // PERFORM 4100-TAIL-END — the last statement of the performed 4000-TAIL
const PF_VARY_BODY_LINE = 56;       // ADD 1 TO WS-VARY (6000-VARY's only statement, performed VARYING)
const CALL_LINE = 13;            // CALL "CALLSUB" USING WS-ARG-REC in calls/main.cob
const SUB_PARAGRAPH_LINE = 14;   // 0000-SUB-MAIN. — the paragraph header carries two #line blocks
const SUB_FIRST_STATEMENT = 15;  // ADD LK-A TO LK-B GIVING LS-WORK
const COPYBOOK_MOVE_LINE = 10;   // MOVE "Y" TO WS-DONE, right before COPY "stmts.cpy"
const COPYBOOK_AFTER_LINE = 12;  // DISPLAY "COBOL_DEBUG_MARKER: price=" — first line after the copied statements
const SHAPES_FREE_LINE = 107;    // FREE WS-BASED — every item of shapes.cob has been set
const DYN_CALL_LINE = 10;        // CALL WS-MOD-NAME USING WS-VALUE in dyn/main.cob (loads MOD1)
const DYN_MOD_LINE = 8;          // ADD 1 TO LK-VALUE in dyn/mod1.cob

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

  it.for([
    { name: 'direct next', operation: 'step_over', body: ['perform p-one', 'display "unreached"', 'stop run.', 'p-one.', 'add 1 to ws-count', 'go to escaped.', 'escaped.', 'add 100 to ws-count', 'stop run.'], start: 'perform p-one', destination: 'add 100 to ws-count', count: '1' },
    { name: 'direct out', operation: 'step_out', body: ['perform p-one', 'display "unreached"', 'stop run.', 'p-one.', 'add 1 to ws-count', 'go to escaped.', 'escaped.', 'add 100 to ws-count', 'stop run.'], start: 'add 1 to ws-count', destination: 'add 100 to ws-count', count: '1' },
    { name: 'computed THRU', operation: 'step_over', body: ['perform p-one thru p-two', 'display "unreached"', 'stop run.', 'p-one.', 'add 1 to ws-count', 'go to p-two escaped depending on ws-choice.', 'p-two.', 'add 10 to ws-count.', 'escaped.', 'add 100 to ws-count', 'stop run.'], start: 'perform p-one thru p-two', destination: 'add 100 to ws-count', count: '1' },
    { name: 'nested normal return', operation: 'step_over', body: ['perform p-outer', 'display "returned"', 'stop run.', 'p-outer.', 'add 1 to ws-count', 'perform p-inner thru p-tail.', 'p-inner.', 'go to p-tail.', 'p-tail.', 'add 10 to ws-count.'], start: 'perform p-outer', destination: 'display "returned"', count: '11' },
    { name: 'nested escape with repeated COPY', operation: 'step_over', body: ['perform p-outer', 'display "unreached"', 'stop run.', 'p-outer.', 'copy "bump.cpy".', 'perform p-inner.', 'p-inner.', 'copy "bump.cpy".', 'go to escaped.', 'escaped.', 'copy "bump.cpy".', 'stop run.'], start: 'perform p-outer', destination: 'copy', count: '2' }
  ])('PERFORM escape semantics: $name', { timeout: 120000 }, async (scenario, ctx) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'cobol-goto-'));
    const source = path.join(dir, 'gotoflow.cob');
    const copy = path.join(dir, 'bump.cpy');
    const lines = ['identification division.', 'program-id. gotoflow.', 'data division.', 'working-storage section.', '01 ws-count pic 9(4) comp value 0.', '01 ws-choice pic 9 value 2.', 'procedure division.', 'main-entry.', ...scenario.body];
    writeFileSync(source, lines.join('\n'));
    writeFileSync(copy, 'add 1 to ws-count\n');
    try {
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-goto' })).sessionId as string;
      expect((await call('set_breakpoint', { file: source, line: lines.indexOf(scenario.start) + 1 })).success).toBe(true);
      await startOrSkip(ctx, { scriptPath: source, dapLaunchArgs: { stopOnEntry: false }, adapterLaunchConfig: { format: 'free', copybookDirs: [dir] } }, 'goto');
      expect(await pollState('paused', 30000)).toBeDefined();
      expect((await call('remove_breakpoint', { file: source, line: lines.indexOf(scenario.start) + 1 })).success).toBe(true);
      expect((await call(scenario.operation, {})).success).toBe(true);
      const paused = await pollState('paused', 30000);
      expect(paused?.lastStop?.reason).toBe('step');
      const top = (await fetchStackTrace())[0];
      const destinationFile = scenario.destination === 'copy' ? copy : source;
      expect(top.file?.replace(/\\/g, '/')).toBe(destinationFile.replace(/\\/g, '/'));
      expect(top.line).toBe(scenario.destination === 'copy' ? 1 : lines.indexOf(scenario.destination) + 1);
      expect(String((await call('evaluate_expression', { expression: 'ws-count' })).result)).toBe(scenario.count);
      if (!scenario.name.includes('normal')) expect(paused?.lastStop?.description).toContain('GO TO left');
    } finally {
      if (sessionId) { await callToolSafely(mcpClient!, 'close_debug_session', { sessionId }); sessionId = null; }
      rmSync(dir, { recursive: true, force: true });
    }
  });

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
      // A space in the directory name: the path travels quoted on an LLDB command line.
      const dir = mkdtempSync(path.join(os.tmpdir(), 'cobol sysin '));
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
    'step_into at a CALL enters the callee, and a step from its paragraph header reaches the next statement',
    async (ctx) => {
      const mainSource = cobolSourcePath('calls');
      const [subSource] = cobolExtraSources('calls');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-stepin' })).sessionId as string;
      expect((await call('set_breakpoint', { file: mainSource, line: CALL_LINE })).success).toBe(true);

      await startOrSkip(ctx, {
        scriptPath: mainSource,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { sources: [subSource] }
      }, 'stepin');
      expect(await reachCobolLine(CALL_LINE, 'main.cob')).toBe(true);

      // step_into: the shim keeps stepping in until a callee statement (review of #760).
      expect((await call('step_into', {})).success).toBe(true);
      expect(await pollState('paused', 15000)).toBeDefined();
      const entered = (await fetchStackTrace()).find(isCobolFrame)!;
      expect(entered.file?.toLowerCase().endsWith('sub.cob'), `expected sub.cob, got ${entered.file}:${entered.line}`).toBe(true);
      expect([SUB_PARAGRAPH_LINE, SUB_FIRST_STATEMENT]).toContain(entered.line);

      // From the paragraph header (Entry block, then Paragraph block on the same line) one
      // step_over must reach the first statement, not "complete" on the header again.
      if (entered.line === SUB_PARAGRAPH_LINE) {
        expect((await call('step_over', {})).success).toBe(true);
        expect(await pollState('paused', 15000)).toBeDefined();
        expect((await fetchStackTrace()).find(isCobolFrame)!.line).toBe(SUB_FIRST_STATEMENT);
      }
      expect((await call('step_over', {})).success).toBe(true);
      expect(await pollState('paused', 15000)).toBeDefined();
      expect((await fetchStackTrace()).find(isCobolFrame)!.line).toBe(SUB_BP_LINE);

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect((await pollState('stopped', 20000))?.exitCode).toBe(0);
    },
    120000
  );

  it(
    'steps through statements a copybook supplies inside a paragraph',
    async (ctx) => {
      const sourcePath = cobolSourcePath('copybook');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-copystmts' })).sessionId as string;
      expect((await call('set_breakpoint', { file: sourcePath, line: COPYBOOK_MOVE_LINE })).success).toBe(true);

      await startOrSkip(ctx, {
        scriptPath: sourcePath,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { copybookDirs: [cobolCopybookDir('copybook')] }
      }, 'copystmts');
      expect(await reachCobolLine(COPYBOOK_MOVE_LINE, 'main.cob')).toBe(true);

      const landings: string[] = [];
      for (let i = 0; i < 3; i++) {
        expect((await call('step_over', {})).success).toBe(true);
        expect(await pollState('paused', 15000)).toBeDefined();
        const top = (await fetchStackTrace()).find(isCobolFrame)!;
        landings.push(`${path.basename(top.file ?? '').toLowerCase()}:${top.line}`);
      }
      expect(landings).toEqual(['stmts.cpy:1', 'stmts.cpy:2', `main.cob:${COPYBOOK_AFTER_LINE}`]);

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect((await pollState('stopped', 20000))?.exitCode).toBe(0);
    },
    120000
  );

  it(
    'decodes INDEXED BY tables, LOCAL-STORAGE subordinates, EXTERNAL/BASED items and an ODO table under -std=ibm',
    async (ctx) => {
      const sourcePath = path.join(COBOL_EXAMPLES_DIR, 'shapes.cob');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-shapes' })).sessionId as string;
      expect((await call('set_breakpoint', { file: sourcePath, line: SHAPES_FREE_LINE })).success).toBe(true);

      await startOrSkip(ctx, {
        scriptPath: sourcePath,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { dialect: 'ibm' }
      }, 'shapes');
      expect(await reachCobolLine(SHAPES_FREE_LINE, 'shapes.cob')).toBe(true);

      const evaluate = async (expression: string): Promise<string> => String((await call('evaluate_expression', { expression })).result);
      expect(await evaluate('WS-AMOUNT(2)')).toBe('1234');           // table under its 01, not under WS-IX
      expect(await evaluate('WS-CODE(2)')).toBe('"AB"');
      expect(await evaluate('WS-COL(2)')).toBe('"XY"');              // odoslide `(cob_uli_t)(2)` element size
      expect(await evaluate('LS-G2')).toBe('"CD"');                  // LOCAL-STORAGE subordinate, layout-derived address
      expect(await evaluate('LS-TBL(2)')).toBe('"QQQ"');
      expect(await evaluate('WS-EXT')).toBe('"external! "');         // EXTERNAL via COB_SET_DATA
      expect(await evaluate('WS-BASED')).toBe('"BSED"');             // BASED via COB_SET_DATA
      expect(await evaluate('WS-LINE(499)')).toBe('"L499"');
      expect(await evaluate('WS-A-VERY-LONG-DATA-NAME-OF-THIRTY-FIVE')).toBe('"ABC"');

      const locals = await localsByName();
      expect(locals.get('WS-IX')).toBeDefined();
      expect(locals.get('WS-EDITED')?.type).toContain('ZZ,ZZ9.99');
      // A 500-element table comes back whole from the shim; the server's cap trims it with a notice.
      const big = await children(locals.get('WS-BIG')!.variablesReference!);
      const lines = await call('get_variables', { scope: big.get('WS-LINE')!.variablesReference });
      expect((lines.variables as unknown[]).length).toBe(300);
      expect(JSON.stringify(lines)).toMatch(/truncat/i);

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect((await pollState('stopped', 20000))?.exitCode).toBe(0);
    },
    120000
  );

  it(
    'binds a breakpoint in a not-yet-loaded -m module once the CALL loads it (module named after its PROGRAM-ID)',
    async (ctx) => {
      const mainSource = cobolSourcePath('dyn');
      const [modSource] = cobolModuleSources('dyn');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-modules' })).sessionId as string;
      expect((await call('set_breakpoint', { file: modSource, line: DYN_MOD_LINE })).success).toBe(true);
      expect((await call('set_breakpoint', { file: mainSource, line: DYN_CALL_LINE })).success).toBe(true);

      await startOrSkip(ctx, {
        scriptPath: mainSource,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { modules: [modSource], forceRebuild: true }
      }, 'modules');
      expect(await reachCobolLine(DYN_CALL_LINE, 'main.cob')).toBe(true);

      // Before the CALL the module is not loaded: its breakpoint is the pending one (R13).
      const pending = (await call('list_breakpoints', {})).breakpoints as Array<{ file?: string; line?: number; verified?: boolean }>;
      const isModBp = (b: { file?: string; line?: number }) => (b.file ?? '').toLowerCase().endsWith('mod1.cob') && b.line === DYN_MOD_LINE;
      expect(pending.find(isModBp)?.verified, JSON.stringify(pending)).toBe(false);

      // The CALL loads MOD1.dll/.so (named after the PROGRAM-ID, which is what libcob looks
      // for), CodeLLDB re-verifies the breakpoint on load, and it hits inside MOD1.
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect(await reachCobolLine(DYN_MOD_LINE, 'mod1.cob')).toBe(true);
      const bound = (await call('list_breakpoints', {})).breakpoints as Array<{ file?: string; line?: number; verified?: boolean }>;
      expect(bound.find(isModBp)?.verified, JSON.stringify(bound)).toBe(true);

      const top = (await fetchStackTrace()).find(isCobolFrame)!;
      expect(top.name).toContain('MOD1');
      expect((await localsByName()).get('LK-VALUE')?.value).toBe('41');
      expect((await call('step_over', {})).success).toBe(true);
      expect(await pollState('paused', 15000)).toBeDefined();
      expect((await localsByName()).get('LK-VALUE')?.value).toBe('42');

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect((await pollState('stopped', 20000))?.exitCode).toBe(0);
      expect(JSON.stringify(await call('get_output', {}))).toContain('value=+000000042');
    },
    120000
  );

  it(
    'runs a module-only build under cobcrun (runner) and binds the program breakpoints as the loader loads the modules',
    async (ctx) => {
      const mainSource = cobolSourcePath('dyn');
      const [modSource] = cobolModuleSources('dyn');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-cobcrun' })).sessionId as string;
      expect((await call('set_breakpoint', { file: mainSource, line: DYN_CALL_LINE })).success).toBe(true);
      expect((await call('set_breakpoint', { file: modSource, line: DYN_MOD_LINE })).success).toBe(true);

      await startOrSkip(ctx, {
        scriptPath: mainSource,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { runner: 'cobcrun', modules: [modSource] }
      }, 'cobcrun');

      // The debuggee is cobcrun; DYNMAIN.dll/.so is loaded by it, and the breakpoint set
      // before launch binds on that load.
      expect(await reachCobolLine(DYN_CALL_LINE, 'main.cob')).toBe(true);
      const listed = (await call('list_breakpoints', {})).breakpoints as Array<{ file?: string; line?: number; verified?: boolean }>;
      expect(listed.find(b => (b.file ?? '').toLowerCase().endsWith('main.cob'))?.verified, JSON.stringify(listed)).toBe(true);
      const top = (await fetchStackTrace()).find(isCobolFrame)!;
      expect(top.name).toContain('DYNMAIN');
      expect((await localsByName()).get('WS-VALUE')?.value).toBe('41');

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect(await reachCobolLine(DYN_MOD_LINE, 'mod1.cob')).toBe(true);
      expect((await localsByName()).get('LK-VALUE')?.value).toBe('41');

      // step_out of the module returns to the caller; step_out of the entry program under
      // cobcrun runs the job to completion — the loader has no frame to stop in (measured).
      expect((await call('step_out', {})).success).toBe(true);
      expect(await pollState('paused', 15000)).toBeDefined();
      const back = (await fetchStackTrace()).find(isCobolFrame)!;
      expect(path.basename(back.file ?? '').toLowerCase()).toBe('main.cob');
      expect([DYN_CALL_LINE, DYN_CALL_LINE + 1]).toContain(back.line);
      expect((await call('step_out', {})).success).toBe(true);
      expect((await pollState('stopped', 20000))?.exitCode).toBe(0);
      expect(JSON.stringify(await call('get_output', {}))).toContain('value=+000000042');
    },
    120000
  );

  it(
    'runs a program with statically linked sources under cobcrun as one combined module and stops in the CALLed program',
    async (ctx) => {
      // `cobc -m -o X a.cob b.cob` is refused by cobc; several sources build one module
      // with `-b` named after the main program, and cobcrun runs it by that PROGRAM-ID.
      const mainSource = cobolSourcePath('calls');
      const [subSource] = cobolExtraSources('calls');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-cobcrun-sources' })).sessionId as string;
      expect((await call('set_breakpoint', { file: subSource, line: SUB_BP_LINE })).success).toBe(true);

      await startOrSkip(ctx, {
        scriptPath: mainSource,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { runner: 'cobcrun', sources: [subSource] }
      }, 'cobcrun-sources');
      expect(await reachCobolLine(SUB_BP_LINE, 'sub.cob')).toBe(true);

      const frames = await fetchStackTrace();
      expect(frames[0].name).toContain('CALLSUB');
      expect(frames.some(f => (f.name ?? '').includes('CALLMAIN')), 'caller frame should be visible').toBe(true);

      const locals = await localsByName();
      expect(locals.get('LS-WORK')?.value).toBe('1234');
      const rec = await children(locals.get('LK-ARG-REC')!.variablesReference!);
      expect(rec.get('LK-A')?.value).toBe('1000');
      expect(rec.get('LK-NAME')?.value).toBe('"CALLER    "');

      expect((await call('step_out', {})).success).toBe(true);
      expect(await pollState('paused', 15000)).toBeDefined();
      const afterOut = (await fetchStackTrace()).find(isCobolFrame)!;
      expect(afterOut.file?.toLowerCase().endsWith('main.cob'), `expected main.cob, got ${afterOut.file}:${afterOut.line}`).toBe(true);

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect((await pollState('stopped', 20000))?.exitCode).toBe(0);
    },
    120000
  );

  it(
    'steps over a PERFORM to the next statement, binds a paragraph function breakpoint, and steps out of a performed paragraph to the statement after its PERFORM',
    async (ctx) => {
      const source = cobolSourcePath('hello');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-perform' })).sessionId as string;
      expect((await call('set_breakpoint', { file: source, line: HELLO_BP_LINE })).success).toBe(true);
      const fnBp = await call('set_breakpoint', { function: '3000-REPORT' });
      expect(fnBp.success, JSON.stringify(fnBp)).toBe(true);

      await startOrSkip(ctx, { scriptPath: source, dapLaunchArgs: { stopOnEntry: false } }, 'perform');
      expect(await reachCobolLine(HELLO_BP_LINE, 'hello.cob')).toBe(true);

      // step_over at `PERFORM 1000-INIT` lands on the next statement of 0000-MAIN, the
      // paragraph having run (WS-IDX left at 6 by its PERFORM VARYING) — not on its first line.
      expect((await call('step_over', {})).success).toBe(true);
      expect(await pollState('paused', 15000)).toBeDefined();
      let top = (await fetchStackTrace()).find(isCobolFrame)!;
      expect(`${path.basename(top.file ?? '').toLowerCase()}:${top.line}`).toBe(`hello.cob:${HELLO_AFTER_INIT_LINE}`);
      expect(top.name).toBe('HELLO: 0000-MAIN');
      expect((await localsByName()).get('WS-IDX')?.value).toBe('6');

      // The paragraph function breakpoint bound to 3000-REPORT's first statement, and is hit there.
      const listed = (await call('list_breakpoints', {})).functionBreakpoints as Array<{ functionName?: string; verified?: boolean; boundLine?: number; line?: number; message?: string }>;
      const fn = listed.find(b => b.functionName === '3000-REPORT');
      expect(fn?.verified, JSON.stringify(listed)).toBe(true);
      expect(fn?.boundLine ?? fn?.line, JSON.stringify(fn)).toBe(REPORT_FIRST_LINE);
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect(await reachCobolLine(REPORT_FIRST_LINE, 'hello.cob')).toBe(true);
      const inReport = await fetchStackTrace();
      top = inReport.find(isCobolFrame)!;
      expect(top.name).toBe('HELLO: 3000-REPORT');
      // The PERFORM stack is in the stack trace: the performing paragraph at its PERFORM statement.
      const performFrame = inReport.find(f => (f.name ?? '').includes('(PERFORM 3000-REPORT)'));
      expect(performFrame, JSON.stringify(inReport.map(f => `${f.name}@${f.line}`))).toBeDefined();
      expect(performFrame!.name).toBe('HELLO: 0000-MAIN (PERFORM 3000-REPORT)');
      expect(performFrame!.line).toBe(HELLO_PERFORM_REPORT_LINE);

      // step_out of the performed paragraph returns to the statement after `PERFORM 3000-REPORT`.
      expect((await call('step_out', {})).success).toBe(true);
      expect(await pollState('paused', 15000)).toBeDefined();
      top = (await fetchStackTrace()).find(isCobolFrame)!;
      expect(`${path.basename(top.file ?? '').toLowerCase()}:${top.line}`).toBe(`hello.cob:${HELLO_STOP_RUN_LINE}`);
      expect(top.name).toBe('HELLO: 0000-MAIN');

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect((await pollState('stopped', 20000))?.exitCode).toBe(0);
      expect(JSON.stringify(await call('get_output', {}))).toContain('COBOL_DEBUG_MARKER: total=');
    },
    120000
  );

  it(
    'steps the PERFORM shapes the way the program runs: an IF branch, TIMES, nested, UNTIL, VARYING, and a PERFORM that ends a performed paragraph',
    async (ctx) => {
      const source = cobolSourcePath('perform');
      sessionId = (await call('create_debug_session', { language: 'cobol', name: 'cobol-smoke-perform-shapes' })).sessionId as string;
      for (const line of [PF_IF_PERFORM_LINE, PF_BUMP_BODY_LINE, PF_INNER_BODY_LINE, PF_VARY_BODY_LINE, PF_TAIL_PERFORM_LINE]) {
        expect((await call('set_breakpoint', { file: source, line })).success).toBe(true);
      }
      await startOrSkip(ctx, { scriptPath: source, dapLaunchArgs: { stopOnEntry: false } }, 'perform-shapes');

      const landing = async (): Promise<{ line?: number; name?: string; description?: string }> => {
        expect(await pollState('paused', 20000)).toBeDefined();
        const top = (await fetchStackTrace()).find(isCobolFrame)!;
        return { line: top.line, name: top.name };
      };
      const stepOverTo = async (expected: number, what: string): Promise<void> => {
        expect((await call('step_over', {})).success).toBe(true);
        const at = await landing();
        expect(at.line, `${what}: landed on ${at.name}@${at.line}`).toBe(expected);
      };

      // 1. A PERFORM inside the IF's true branch: step_over lands on what runs next (the
      //    DISPLAY after END-IF), not on the ELSE branch's PERFORM that source order lists next.
      expect(await reachCobolLine(PF_IF_PERFORM_LINE, 'perform.cob')).toBe(true);
      await stepOverTo(PF_AFTER_IF_LINE, 'PERFORM in an IF branch');
      expect((await localsByName()).get('WS-COUNT')?.value).toBe('1');

      // 2. PERFORM … 3 TIMES from the statement before it: step to it, then over it — one stop, all iterations run.
      await stepOverTo(PF_TIMES_LINE, 'DISPLAY to the TIMES PERFORM');
      // (the breakpoint inside 2000-BUMP is hit on the first iteration: a user breakpoint wins over the step)
      expect((await call('step_over', {})).success).toBe(true);
      let at = await landing();
      expect(at.line, `breakpoint inside the performed paragraph: ${at.name}@${at.line}`).toBe(PF_BUMP_BODY_LINE);
      // 3. step_out from the paragraph performed 3 TIMES (first iteration, breakpoint removed): every
      //    remaining iteration runs and the step lands on the statement after the PERFORM.
      expect((await call('remove_breakpoint', { file: source, line: PF_BUMP_BODY_LINE })).success).toBe(true);
      expect((await call('step_out', {})).success).toBe(true);
      at = await landing();
      expect(at.line, `step_out of a TIMES-performed paragraph: ${at.name}@${at.line}`).toBe(PF_AFTER_TIMES_LINE);
      expect((await localsByName()).get('WS-TIMES')?.value).toBe('3');

      // 4. A nested PERFORM: step_over runs both levels.
      await stepOverTo(PF_OUTER_LINE, 'DISPLAY to the nested PERFORM');
      // (the breakpoint inside 3100-INNER is hit first)
      expect((await call('step_over', {})).success).toBe(true);
      at = await landing();
      expect(at.line).toBe(PF_INNER_BODY_LINE);
      // 5. step_out from the inner paragraph, which is the outer paragraph's last statement:
      //    the walk after the return leaves the outer paragraph too and lands at depth 0.
      expect((await call('step_out', {})).success).toBe(true);
      at = await landing();
      expect(at.line, `step_out through two levels: ${at.name}@${at.line}`).toBe(PF_AFTER_OUTER_LINE);
      expect((await localsByName()).get('WS-NESTED')?.value).toBe('11');

      // 6. PERFORM … UNTIL: one step_over runs every iteration (on cobc 3.2 the loop test is
      //    attributed to the PERFORM's own line — the step must not end there).
      await stepOverTo(PF_UNTIL_LINE, 'DISPLAY to the UNTIL PERFORM');
      await stepOverTo(PF_AFTER_UNTIL_LINE, 'PERFORM … UNTIL');
      expect((await localsByName()).get('WS-UNTIL')?.value).toBe('3');

      // 7. An out-of-line PERFORM … VARYING: the breakpoint inside is hit on the first
      //    iteration; step_out then runs the remaining iterations to the statement after it.
      await stepOverTo(PF_VARY_LINE, 'DISPLAY to the VARYING PERFORM');
      expect((await call('step_over', {})).success).toBe(true);
      at = await landing();
      expect(at.line, `breakpoint inside the VARYING-performed paragraph: ${at.name}@${at.line}`).toBe(PF_VARY_BODY_LINE);
      expect((await call('remove_breakpoint', { file: source, line: PF_VARY_BODY_LINE })).success).toBe(true);
      expect((await call('step_out', {})).success).toBe(true);
      at = await landing();
      expect(at.line, `step_out of a VARYING-performed paragraph: ${at.name}@${at.line}`).toBe(PF_AFTER_VARY_LINE);
      expect((await localsByName()).get('WS-VARY')?.value).toBe('3');

      // 8. A PERFORM that is the last statement of a performed paragraph: step_over runs it and,
      //    the paragraph being finished, lands on the performer's next statement.
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect(await reachCobolLine(PF_TAIL_PERFORM_LINE, 'perform.cob')).toBe(true);
      await stepOverTo(PF_MARKER_LINE, 'PERFORM as the last statement of a performed paragraph');
      expect((await localsByName()).get('WS-LAST')?.value).toBe('11');

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect((await pollState('stopped', 20000))?.exitCode).toBe(0);
      expect(JSON.stringify(await call('get_output', {}))).toContain('COBOL_DEBUG_MARKER: last=');
    },
    180000
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
