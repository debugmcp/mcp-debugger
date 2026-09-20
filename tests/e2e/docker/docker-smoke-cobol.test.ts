/**
 * Docker COBOL Smoke Tests (issue #759)
 *
 * The image installs gnucobol3 (Ubuntu 26.04 → GnuCOBOL 3.2) next to the
 * vendored linux-x64 CodeLLDB, so the adapter compiles examples/cobol/hello.cob
 * in-container and the COBOL DAP shim serves WORKING-STORAGE from the manifest.
 * This is the CI-gated COBOL lane (PR CI runs no host e2e).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { buildDockerImage, createDockerMcpClient, getDockerLogs } from './docker-test-utils.js';
import { parseSdkToolResult } from '../smoke-test-utils.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const SKIP_DOCKER = process.env.SKIP_DOCKER_TESTS === 'true';

// examples/cobol/hello.cob — ADD WS-SCALED TO WS-TOTAL (WS-TABLE/WS-TOTAL populated)
const BP_LINE = 46;
const PERFORM_INIT_LINE = 32;     // PERFORM 1000-INIT (first statement of 0000-MAIN)
const AFTER_INIT_LINE = 33;       // PERFORM 2000-COMPUTE — the statement after it
const STOP_RUN_LINE = 35;         // STOP RUN — the statement after PERFORM 3000-REPORT
const INIT_LOOP_BODY_LINE = 39;   // COMPUTE WS-AMOUNT(WS-IDX) = WS-IDX * 100, inside 1000-INIT's inline PERFORM
const REPORT_FIRST_LINE = 48;     // DISPLAY "COBOL_DEBUG_MARKER: total=" — first statement of 3000-REPORT

describe.skipIf(SKIP_DOCKER)('Docker: COBOL Debugging Smoke Tests', () => {
  let mcpClient: Client | null = null;
  let cleanup: (() => Promise<void>) | null = null;
  let sessionId: string | null = null;
  let containerName: string | null = null;
  let anyFailed = false;

  afterEach((ctx) => {
    if (ctx.task.result?.state === 'fail') {
      anyFailed = true;
    }
  });

  beforeAll(async () => {
    console.log('[Docker COBOL] Building Docker image...');
    await buildDockerImage({ imageName: 'mcp-debugger:test' });

    containerName = `mcp-debugger-cobol-test-${Date.now()}`;
    const result = await createDockerMcpClient({
      imageName: 'mcp-debugger:test',
      containerName,
      logLevel: 'debug'
    });
    mcpClient = result.client;
    cleanup = result.cleanup;
    console.log('[Docker COBOL] MCP client connected');
  }, 300000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try {
        await mcpClient.callTool({ name: 'close_debug_session', arguments: { sessionId } });
      } catch {
        // Session may already be closed
      }
    }
    if (cleanup) {
      await cleanup();
    }
    if (containerName && anyFailed) {
      console.log('[Docker COBOL] Container logs:');
      console.log(await getDockerLogs(containerName));
    }
    console.log('[Docker COBOL] Cleanup completed');
  });

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try {
        await mcpClient.callTool({ name: 'close_debug_session', arguments: { sessionId } });
      } catch {
        // Ignore cleanup errors
      }
      sessionId = null;
    }
  });

  it('advertises cobol with launch and attach available', async () => {
    const response = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_supported_languages', arguments: {} }));
    expect(response.installed).toContain('cobol');
    const cobol = (response.available as Array<{ language: string; installed: boolean; modes: { launch: { available: boolean }; attach: { available: boolean } } }>)
      .find(a => a.language === 'cobol');
    expect(cobol).toBeDefined();
    expect(cobol!.installed).toBe(true);
    expect(cobol!.modes.launch.available).toBe(true);
    expect(cobol!.modes.attach.available).toBe(true);
    console.log('[Docker COBOL] ✓ cobol advertised:', JSON.stringify(cobol!.modes));
  }, 60000);

  it('compiles hello.cob in-container and shows decoded WORKING-STORAGE at a breakpoint', async () => {
    // Relative path — the container roots it at /workspace (the examples mount)
    const scriptPath = 'cobol/hello.cob';

    sessionId = parseSdkToolResult(await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'cobol', name: 'docker-cobol-smoke' }
    })).sessionId as string;
    expect(sessionId).toBeDefined();

    expect(parseSdkToolResult(await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: scriptPath, line: BP_LINE }
    })).success).toBe(true);

    const startResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { forceRebuild: true }
      }
    }));
    console.log('[Docker COBOL] Start response:', JSON.stringify(startResponse).slice(0, 300));
    expect(startResponse.success).not.toBe(false);

    let paused = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      const sessions = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
      const session = ((sessions.sessions ?? []) as Array<{ id: string; state?: string }>).find(s => s.id === sessionId);
      if (session?.state === 'paused') {
        paused = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    expect(paused, 'session should pause at the breakpoint').toBe(true);

    const stackResponse = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_stack_trace', arguments: { sessionId } }));
    const frames = (stackResponse.stackFrames ?? []) as Array<{ name?: string; line?: number; file?: string }>;
    const cobolFrame = frames.find(f => (f.file ?? '').endsWith('hello.cob'));
    expect(cobolFrame, `expected a hello.cob frame in ${JSON.stringify(frames)}`).toBeDefined();
    expect(cobolFrame!.line).toBe(BP_LINE);
    expect(cobolFrame!.name).toContain('2000-COMPUTE');

    const localsResponse = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_local_variables', arguments: { sessionId } }));
    const locals = new Map(((localsResponse.variables ?? []) as Array<{ name: string; value: string }>).map(v => [v.name, v.value]));
    expect(locals.get('WS-SCALED')).toBe('-123.45');
    expect(locals.get('WS-PACKED')).toBe('-12345.67');
    expect(locals.get('WS-TOTAL')).toBe('1500.00');
    expect(locals.get('WS-BINARY')).toBe('-123456789');
    console.log('[Docker COBOL] ✓ WORKING-STORAGE decoded');

    const evalResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'evaluate_expression',
      arguments: { sessionId, expression: 'WS-ID OF WS-GROUP' }
    }));
    expect(String(evalResponse.result)).toBe('42');

    // One step_over = one COBOL statement, measured on Linux here: the shim's step loop
    // runs its engine round-trips over loopback sockets with Nagle off (review of #760).
    expect(parseSdkToolResult(await mcpClient!.callTool({ name: 'step_over', arguments: { sessionId } })).success).not.toBe(false);
    let stepped: number | undefined;
    for (let attempt = 0; attempt < 40 && stepped === undefined; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const sessions = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
      const session = ((sessions.sessions ?? []) as Array<{ id: string; state?: string }>).find(s => s.id === sessionId);
      if (session?.state !== 'paused') continue;
      const after = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_stack_trace', arguments: { sessionId } }));
      const frame = ((after.stackFrames ?? []) as Array<{ line?: number; file?: string }>).find(f => (f.file ?? '').endsWith('hello.cob'));
      stepped = frame?.line;
    }
    expect([BP_LINE + 1, BP_LINE + 2, 34]).toContain(stepped);
    console.log(`[Docker COBOL] ✓ step_over landed on hello.cob:${stepped}`);

    expect(parseSdkToolResult(await mcpClient!.callTool({ name: 'continue_execution', arguments: { sessionId } })).success).not.toBe(false);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const outputResult = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_output', arguments: { sessionId } }));
    const entries = (outputResult.entries ?? []) as Array<{ output: string }>;
    expect(entries.some(e => e.output.includes('COBOL_DEBUG_MARKER: total=+0001376.55')), 'DISPLAY output captured').toBe(true);

    expect(parseSdkToolResult(await mcpClient!.callTool({ name: 'close_debug_session', arguments: { sessionId } })).success).toBe(true);
    sessionId = null;
    console.log('[Docker COBOL] ✅ All checks passed');
  }, 240000);

  it('binds a breakpoint in a -m module once the CALL loads it: the module is named after its PROGRAM-ID (Linux resolves the file name case-sensitively)', async () => {
    const mainPath = 'cobol/dyn/main.cob';
    const modulePath = 'cobol/dyn/mod1.cob';
    const MOD_LINE = 8; // ADD 1 TO LK-VALUE

    sessionId = parseSdkToolResult(await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'cobol', name: 'docker-cobol-modules' }
    })).sessionId as string;
    expect(parseSdkToolResult(await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: modulePath, line: MOD_LINE }
    })).success).toBe(true);

    const startResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath: mainPath,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { modules: ['/workspace/cobol/dyn/mod1.cob'], forceRebuild: true }
      }
    }));
    expect(startResponse.success).not.toBe(false);

    let frame: { name?: string; line?: number; file?: string } | undefined;
    for (let attempt = 0; attempt < 40 && !frame; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const sessions = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
      const session = ((sessions.sessions ?? []) as Array<{ id: string; state?: string }>).find(s => s.id === sessionId);
      if (session?.state !== 'paused') continue;
      const stack = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_stack_trace', arguments: { sessionId } }));
      frame = ((stack.stackFrames ?? []) as Array<{ name?: string; line?: number; file?: string }>).find(f => (f.file ?? '').endsWith('mod1.cob'));
    }
    expect(frame, 'expected a stop inside mod1.cob').toBeDefined();
    expect(frame!.line).toBe(MOD_LINE);
    expect(frame!.name).toContain('MOD1');

    const listed = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_breakpoints', arguments: { sessionId } }));
    const modBp = ((listed.breakpoints ?? []) as Array<{ file?: string; line?: number; verified?: boolean }>).find(b => (b.file ?? '').endsWith('mod1.cob'));
    expect(modBp?.verified, JSON.stringify(listed)).toBe(true);

    const localsResponse = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_local_variables', arguments: { sessionId } }));
    const locals = new Map(((localsResponse.variables ?? []) as Array<{ name: string; value: string }>).map(v => [v.name, v.value]));
    expect(locals.get('LK-VALUE')).toBe('41');

    expect(parseSdkToolResult(await mcpClient!.callTool({ name: 'continue_execution', arguments: { sessionId } })).success).not.toBe(false);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const outputResult = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_output', arguments: { sessionId } }));
    const entries = (outputResult.entries ?? []) as Array<{ output: string }>;
    expect(entries.some(e => e.output.includes('COBOL_DEBUG_MARKER: value=+000000042')), 'MOD1 ran and returned').toBe(true);
    console.log('[Docker COBOL] ✓ module breakpoint bound on load, MOD1 resolved by PROGRAM-ID');
  }, 240000);

  it('M3: steps over a PERFORM to the next statement, hits a paragraph function breakpoint, logs a logpoint, and steps out to the statement after the PERFORM', async () => {
    const scriptPath = 'cobol/hello.cob';
    sessionId = parseSdkToolResult(await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'cobol', name: 'docker-cobol-perform' }
    })).sessionId as string;

    expect(parseSdkToolResult(await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: scriptPath, line: PERFORM_INIT_LINE }
    })).success).toBe(true);
    const fnBp = parseSdkToolResult(await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, function: '3000-REPORT' }
    }));
    expect(fnBp.success, JSON.stringify(fnBp)).toBe(true);
    const logpoint = parseSdkToolResult(await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: scriptPath, line: INIT_LOOP_BODY_LINE, logMessage: 'LP idx={WS-IDX} amount={WS-AMOUNT(1)}' }
    }));
    expect(logpoint.success, JSON.stringify(logpoint)).toBe(true);

    const startResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: { sessionId, scriptPath, dapLaunchArgs: { stopOnEntry: false } }
    }));
    expect(startResponse.success).not.toBe(false);

    /** The hello.cob frame once the session is paused on a line other than `notLine`. */
    const pausedFrame = async (notLine?: number): Promise<{ line?: number; name?: string } | undefined> => {
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 250));
        const sessions = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
        const session = ((sessions.sessions ?? []) as Array<{ id: string; state?: string }>).find(s => s.id === sessionId);
        if (session?.state !== 'paused') continue;
        const stack = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_stack_trace', arguments: { sessionId } }));
        const frame = ((stack.stackFrames ?? []) as Array<{ name?: string; line?: number; file?: string }>).find(f => (f.file ?? '').endsWith('hello.cob'));
        if (frame && frame.line !== notLine) return frame;
      }
      return undefined;
    };

    let frame = await pausedFrame();
    expect(frame?.line, JSON.stringify(frame)).toBe(PERFORM_INIT_LINE);

    // step_over runs 1000-INIT (its inline PERFORM logs five times) and stops on the next statement.
    expect(parseSdkToolResult(await mcpClient!.callTool({ name: 'step_over', arguments: { sessionId } })).success).not.toBe(false);
    frame = await pausedFrame(PERFORM_INIT_LINE);
    expect(frame?.line, JSON.stringify(frame)).toBe(AFTER_INIT_LINE);
    expect(frame?.name).toContain('0000-MAIN');
    const locals = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_local_variables', arguments: { sessionId } }));
    const ws = new Map(((locals.variables ?? []) as Array<{ name: string; value: string }>).map(v => [v.name, v.value]));
    expect(ws.get('WS-IDX')).toBe('6');
    console.log('[Docker COBOL] ✓ step_over ran the performed paragraph');

    // The paragraph function breakpoint is bound to 3000-REPORT's first statement and hit there.
    const listed = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_breakpoints', arguments: { sessionId } }));
    const fn = ((listed.functionBreakpoints ?? []) as Array<{ functionName?: string; verified?: boolean; boundLine?: number }>).find(b => b.functionName === '3000-REPORT');
    expect(fn?.verified, JSON.stringify(listed)).toBe(true);
    expect(fn?.boundLine).toBe(REPORT_FIRST_LINE);
    expect(parseSdkToolResult(await mcpClient!.callTool({ name: 'continue_execution', arguments: { sessionId } })).success).not.toBe(false);
    frame = await pausedFrame(AFTER_INIT_LINE);
    expect(frame?.line, JSON.stringify(frame)).toBe(REPORT_FIRST_LINE);
    expect(frame?.name).toContain('3000-REPORT');
    console.log('[Docker COBOL] ✓ paragraph function breakpoint hit');

    // step_out of the performed paragraph returns to the statement after PERFORM 3000-REPORT.
    expect(parseSdkToolResult(await mcpClient!.callTool({ name: 'step_out', arguments: { sessionId } })).success).not.toBe(false);
    frame = await pausedFrame(REPORT_FIRST_LINE);
    expect(frame?.line, JSON.stringify(frame)).toBe(STOP_RUN_LINE);
    console.log('[Docker COBOL] ✓ step_out returned to the performer');

    expect(parseSdkToolResult(await mcpClient!.callTool({ name: 'continue_execution', arguments: { sessionId } })).success).not.toBe(false);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const outputResult = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_output', arguments: { sessionId } }));
    const entries = (outputResult.entries ?? []) as Array<{ output: string }>;
    const text = entries.map(e => e.output).join('');
    expect(text, text.slice(0, 600)).toContain('LP idx=1 amount=0');
    expect(text).toContain('LP idx=5 amount=100');
    expect(text).toContain('COBOL_DEBUG_MARKER: total=+0001376.55');

    expect(parseSdkToolResult(await mcpClient!.callTool({ name: 'close_debug_session', arguments: { sessionId } })).success).toBe(true);
    sessionId = null;
    console.log('[Docker COBOL] ✅ M3 checks passed');
  }, 240000);

  it('runs a module-only build under cobcrun (runner) and stops in the program once the loader loads it', async () => {
    const mainPath = 'cobol/dyn/main.cob';
    const CALL_LINE = 10; // CALL WS-MOD-NAME USING WS-VALUE

    sessionId = parseSdkToolResult(await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'cobol', name: 'docker-cobol-cobcrun' }
    })).sessionId as string;
    expect(parseSdkToolResult(await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: mainPath, line: CALL_LINE }
    })).success).toBe(true);

    const startResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath: mainPath,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { runner: 'cobcrun', modules: ['/workspace/cobol/dyn/mod1.cob'] }
      }
    }));
    expect(startResponse.success).not.toBe(false);

    let frame: { name?: string; line?: number; file?: string } | undefined;
    for (let attempt = 0; attempt < 40 && !frame; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const sessions = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
      const session = ((sessions.sessions ?? []) as Array<{ id: string; state?: string }>).find(s => s.id === sessionId);
      if (session?.state !== 'paused') continue;
      const stack = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_stack_trace', arguments: { sessionId } }));
      frame = ((stack.stackFrames ?? []) as Array<{ name?: string; line?: number; file?: string }>).find(f => (f.file ?? '').endsWith('main.cob'));
    }
    expect(frame, 'expected a stop in main.cob under cobcrun').toBeDefined();
    expect(frame!.line).toBe(CALL_LINE);
    expect(frame!.name).toContain('DYNMAIN');

    const localsResponse = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_local_variables', arguments: { sessionId } }));
    const locals = new Map(((localsResponse.variables ?? []) as Array<{ name: string; value: string }>).map(v => [v.name, v.value]));
    expect(locals.get('WS-VALUE')).toBe('41');

    expect(parseSdkToolResult(await mcpClient!.callTool({ name: 'continue_execution', arguments: { sessionId } })).success).not.toBe(false);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const outputResult = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_output', arguments: { sessionId } }));
    const entries = (outputResult.entries ?? []) as Array<{ output: string }>;
    expect(entries.some(e => e.output.includes('COBOL_DEBUG_MARKER: value=+000000042')), 'DYNMAIN ran to completion under cobcrun').toBe(true);
    console.log('[Docker COBOL] ✓ cobcrun runner: program breakpoint bound on load, output captured');
  }, 240000);
});
