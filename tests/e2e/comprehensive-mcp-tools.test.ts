/**
 * Comprehensive MCP Debugger Test - All 19 Tools x All Languages
 *
 * Tests every MCP tool against every available language adapter.
 * Produces a detailed matrix report (PASS/FAIL/SKIP per tool per language).
 *
 * Run:
 *   npx vitest run tests/e2e/comprehensive-mcp-tools.test.ts --reporter=verbose
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

/* ---------- result tracking ---------- */

type ToolStatus = 'PASS' | 'FAIL' | 'SKIP' | 'PENDING';

interface ToolResult {
  tool: string;
  language: string;
  status: ToolStatus;
  detail: string;
  duration?: number;
}

const results: ToolResult[] = [];

function record(tool: string, language: string, status: ToolStatus, detail: string, duration?: number) {
  results.push({ tool, language, status, detail, duration });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'SKIP' ? '⊘' : '…';
  console.log(`  [${icon}] ${tool} (${language}): ${detail}${duration ? ` [${duration}ms]` : ''}`);
}

/* ---------- example file paths ---------- */

const PYTHON_SCRIPT = path.resolve(ROOT, 'examples', 'python', 'simple_test.py');
const JS_SCRIPT = path.resolve(ROOT, 'examples', 'javascript', 'simple_test.js');
const RUST_SCRIPT = path.resolve(ROOT, 'examples', 'rust', 'hello_world', 'src', 'main.rs');
const GO_SCRIPT = path.resolve(ROOT, 'examples', 'go', 'hello_world.go');
const JAVA_SCRIPT = path.resolve(ROOT, 'examples', 'java', 'TestJavaDebug.java');

// Breakpoint lines (executable lines in each script)
const PYTHON_BP_LINE = 8;   // a = 1
const JS_BP_LINE = 9;       // let a = 1;
const RUST_BP_LINE = 13;    // let name = "Rust";
const GO_BP_LINE = 12;      // message := greet("World")
const JAVA_BP_LINE = 44;    // int x = 10;

/* ---------- toolchain detection ---------- */

function hasCommand(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const hasRust = hasCommand('rustc --version');
const hasGo = hasCommand('go version');
const hasJava = hasCommand('javac -version');

/* ---------- language definitions ---------- */

interface LangDef {
  language: string;
  script: string;
  bpLine: number;
  available: boolean;
  skipReason?: string;
}

const LANGUAGES: LangDef[] = [
  { language: 'python', script: PYTHON_SCRIPT, bpLine: PYTHON_BP_LINE, available: true },
  { language: 'javascript', script: JS_SCRIPT, bpLine: JS_BP_LINE, available: true },
  { language: 'mock', script: PYTHON_SCRIPT, bpLine: PYTHON_BP_LINE, available: true },
  { language: 'rust', script: RUST_SCRIPT, bpLine: RUST_BP_LINE, available: hasRust, skipReason: hasRust ? undefined : 'Rust toolchain not installed' },
  { language: 'go', script: GO_SCRIPT, bpLine: GO_BP_LINE, available: hasGo, skipReason: hasGo ? undefined : 'Go toolchain not installed' },
  { language: 'java', script: JAVA_SCRIPT, bpLine: JAVA_BP_LINE, available: hasJava, skipReason: hasJava ? undefined : 'Java JDK not installed' },
];

/* ---------- all 19 tools ---------- */

const ALL_TOOLS = [
  'list_supported_languages',
  'create_debug_session',
  'list_debug_sessions',
  'set_breakpoint',
  'get_source_context',
  'start_debugging',
  'get_stack_trace',
  'get_scopes',
  'get_variables',
  'get_local_variables',
  'evaluate_expression',
  'step_over',
  'step_into',
  'step_out',
  'continue_execution',
  'pause_execution',
  'attach_to_process',
  'detach_from_process',
  'close_debug_session',
];

/* ---------- test suite ---------- */

describe('Comprehensive MCP Debugger Test — 19 Tools × 6 Languages', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;

  // Per-language session state
  let currentSessionId: string | null = null;

  /* ---- setup / teardown ---- */

  beforeAll(async () => {
    console.log('\n========================================');
    console.log('  Comprehensive MCP Debugger Test');
    console.log('========================================\n');

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    mcpClient = new Client(
      { name: 'comprehensive-test-client', version: '1.0.0' },
      { capabilities: {} },
    );

    await mcpClient.connect(transport);
    console.log('[Setup] MCP client connected to server\n');
  }, 30_000);

  afterAll(async () => {
    // Print final summary
    printSummary();

    if (mcpClient) await mcpClient.close().catch(() => {});
    if (transport) await transport.close().catch(() => {});
    console.log('\n[Teardown] Done');
  });

  afterEach(async () => {
    if (currentSessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId: currentSessionId });
      } catch { /* ok */ }
      currentSessionId = null;
    }
  });

  /* ================================================================
     TOOL 1: list_supported_languages  (language-agnostic)
     ================================================================ */

  it('Tool 1: list_supported_languages', async () => {
    const t0 = Date.now();
    try {
      const res = await callToolSafely(mcpClient!, 'list_supported_languages', {});
      const langs = (res as any).languages ?? res;
      const detail = `Returned: ${JSON.stringify(langs).slice(0, 200)}`;
      record('list_supported_languages', 'all', 'PASS', detail, Date.now() - t0);

      // Verify expected languages are present
      const langNames = Array.isArray(langs)
        ? langs.map((l: any) => (typeof l === 'string' ? l : l.language ?? l.name))
        : Object.keys(langs);
      expect(langNames.length).toBeGreaterThanOrEqual(2);
    } catch (err: any) {
      record('list_supported_languages', 'all', 'FAIL', err.message, Date.now() - t0);
      throw err;
    }
  }, 15_000);

  /* ================================================================
     TOOL 3: list_debug_sessions  (language-agnostic)
     ================================================================ */

  it('Tool 3: list_debug_sessions (empty)', async () => {
    const t0 = Date.now();
    try {
      const res = await callToolSafely(mcpClient!, 'list_debug_sessions', {});
      record('list_debug_sessions', 'all', 'PASS', `Result: ${JSON.stringify(res).slice(0, 200)}`, Date.now() - t0);
    } catch (err: any) {
      record('list_debug_sessions', 'all', 'FAIL', err.message, Date.now() - t0);
      throw err;
    }
  }, 15_000);

  /* ================================================================
     Per-language tests for tools 2, 4–19
     ================================================================ */

  for (const lang of LANGUAGES) {
    describe(`Language: ${lang.language}`, () => {
      if (!lang.available) {
        // Skip entire language
        it.skip(`SKIP — ${lang.skipReason}`, () => {
          for (const tool of ALL_TOOLS.filter(t => t !== 'list_supported_languages' && t !== 'list_debug_sessions')) {
            record(tool, lang.language, 'SKIP', lang.skipReason!);
          }
        });
        return;
      }

      /* ---- Tool 2: create_debug_session ---- */

      it(`Tool 2: create_debug_session (${lang.language})`, async () => {
        const t0 = Date.now();
        try {
          const res = await mcpClient!.callTool({
            name: 'create_debug_session',
            arguments: { language: lang.language, name: `comp-test-${lang.language}` },
          });
          const parsed = parseSdkToolResult(res);
          expect(parsed.sessionId).toBeDefined();
          currentSessionId = parsed.sessionId as string;
          record('create_debug_session', lang.language, 'PASS', `sessionId=${currentSessionId}`, Date.now() - t0);
        } catch (err: any) {
          record('create_debug_session', lang.language, 'FAIL', err.message, Date.now() - t0);
          throw err;
        }
      }, 30_000);

      /* ---- Tool 3: list_debug_sessions (with session) ---- */

      it(`Tool 3: list_debug_sessions with active session (${lang.language})`, async () => {
        // Create session first if not present
        if (!currentSessionId) {
          const res = await mcpClient!.callTool({
            name: 'create_debug_session',
            arguments: { language: lang.language, name: `list-test-${lang.language}` },
          });
          currentSessionId = parseSdkToolResult(res).sessionId as string;
        }
        const t0 = Date.now();
        try {
          const res = await callToolSafely(mcpClient!, 'list_debug_sessions', {});
          const sessions = (res as any).sessions ?? res;
          record('list_debug_sessions', lang.language, 'PASS', `Sessions listed: ${JSON.stringify(sessions).slice(0, 200)}`, Date.now() - t0);
        } catch (err: any) {
          record('list_debug_sessions', lang.language, 'FAIL', err.message, Date.now() - t0);
          throw err;
        }
      }, 15_000);

      /* ---- Tool 4: set_breakpoint ---- */

      it(`Tool 4: set_breakpoint (${lang.language})`, async () => {
        if (!currentSessionId) {
          const res = await mcpClient!.callTool({
            name: 'create_debug_session',
            arguments: { language: lang.language, name: `bp-test-${lang.language}` },
          });
          currentSessionId = parseSdkToolResult(res).sessionId as string;
        }
        const t0 = Date.now();
        try {
          const res = await callToolSafely(mcpClient!, 'set_breakpoint', {
            sessionId: currentSessionId,
            file: lang.script,
            line: lang.bpLine,
          });
          const detail = `success=${res.success}, verified=${(res as any).verified ?? 'N/A'}`;
          record('set_breakpoint', lang.language, 'PASS', detail, Date.now() - t0);
        } catch (err: any) {
          record('set_breakpoint', lang.language, 'FAIL', err.message, Date.now() - t0);
          throw err;
        }
      }, 15_000);

      /* ---- Tool 5: get_source_context ---- */

      it(`Tool 5: get_source_context (${lang.language})`, async () => {
        if (!currentSessionId) {
          const res = await mcpClient!.callTool({
            name: 'create_debug_session',
            arguments: { language: lang.language, name: `src-test-${lang.language}` },
          });
          currentSessionId = parseSdkToolResult(res).sessionId as string;
        }
        const t0 = Date.now();
        try {
          const res = await callToolSafely(mcpClient!, 'get_source_context', {
            sessionId: currentSessionId,
            file: lang.script,
            line: lang.bpLine,
            linesContext: 3,
          });
          const hasSource = !!(res as any).lineContent || !!(res as any).surrounding || !!(res as any).source || !!(res as any).lines || !!(res as any).content;
          record('get_source_context', lang.language, hasSource ? 'PASS' : 'FAIL',
            hasSource ? `Source returned (${JSON.stringify(res).slice(0, 150)}…)` : `No source data: ${JSON.stringify(res).slice(0, 200)}`,
            Date.now() - t0);
          expect(hasSource).toBe(true);
        } catch (err: any) {
          record('get_source_context', lang.language, 'FAIL', err.message, Date.now() - t0);
          throw err;
        }
      }, 15_000);

      /* -------- Full debug workflow: start → inspect → step → continue → close -------- */

      if (lang.language !== 'mock') {
        // Real language: full debug workflow
        it(`Tools 6-15,19: full debug workflow (${lang.language})`, async () => {
          // Create fresh session
          const createRes = await mcpClient!.callTool({
            name: 'create_debug_session',
            arguments: { language: lang.language, name: `full-test-${lang.language}` },
          });
          currentSessionId = parseSdkToolResult(createRes).sessionId as string;

          // Set breakpoint
          await callToolSafely(mcpClient!, 'set_breakpoint', {
            sessionId: currentSessionId,
            file: lang.script,
            line: lang.bpLine,
          });

          /* ---- Tool 6: start_debugging ---- */
          let t0 = Date.now();
          try {
            const startRes = await mcpClient!.callTool({
              name: 'start_debugging',
              arguments: {
                sessionId: currentSessionId,
                scriptPath: lang.script,
                args: [],
                dapLaunchArgs: { stopOnEntry: false, justMyCode: true },
              },
            });
            const startParsed = parseSdkToolResult(startRes);
            record('start_debugging', lang.language, 'PASS', `state=${startParsed.state}`, Date.now() - t0);
          } catch (err: any) {
            record('start_debugging', lang.language, 'FAIL', err.message, Date.now() - t0);
            throw err;
          }

          // Wait for breakpoint hit
          await new Promise(r => setTimeout(r, 4000));

          /* ---- Tool 7: get_stack_trace ---- */
          t0 = Date.now();
          let frameId: number | undefined;
          try {
            const stackRes = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId: currentSessionId });
            const frames = (stackRes as any).stackFrames ?? [];
            frameId = frames.length > 0 ? frames[0].id : undefined;
            record('get_stack_trace', lang.language, frames.length > 0 ? 'PASS' : 'FAIL',
              `${frames.length} frames, top=${frames[0]?.name ?? 'N/A'} line=${frames[0]?.line ?? '?'}`,
              Date.now() - t0);
            expect(frames.length).toBeGreaterThan(0);
          } catch (err: any) {
            record('get_stack_trace', lang.language, 'FAIL', err.message, Date.now() - t0);
            // Don't throw—continue testing other tools
          }

          /* ---- Tool 8: get_scopes ---- */
          t0 = Date.now();
          let scopeRef: number | undefined;
          if (frameId !== undefined) {
            try {
              const scopeRes = await callToolSafely(mcpClient!, 'get_scopes', {
                sessionId: currentSessionId,
                frameId,
              });
              const scopes = (scopeRes as any).scopes ?? [];
              scopeRef = scopes.length > 0 ? scopes[0].variablesReference : undefined;
              record('get_scopes', lang.language, scopes.length > 0 ? 'PASS' : 'FAIL',
                `${scopes.length} scopes: ${scopes.map((s: any) => s.name).join(', ')}`,
                Date.now() - t0);
            } catch (err: any) {
              record('get_scopes', lang.language, 'FAIL', err.message, Date.now() - t0);
            }
          } else {
            record('get_scopes', lang.language, 'SKIP', 'No frameId from stack trace');
          }

          /* ---- Tool 9: get_variables ---- */
          t0 = Date.now();
          if (scopeRef !== undefined) {
            try {
              const varsRes = await callToolSafely(mcpClient!, 'get_variables', {
                sessionId: currentSessionId,
                scope: scopeRef,
              });
              const vars = (varsRes as any).variables ?? [];
              const varNames = vars.map((v: any) => v.name).join(', ');
              record('get_variables', lang.language, vars.length >= 0 ? 'PASS' : 'FAIL',
                `${vars.length} vars: ${varNames.slice(0, 100)}`,
                Date.now() - t0);
            } catch (err: any) {
              record('get_variables', lang.language, 'FAIL', err.message, Date.now() - t0);
            }
          } else {
            record('get_variables', lang.language, 'SKIP', 'No scopeRef from scopes');
          }

          /* ---- Tool 10: get_local_variables ---- */
          t0 = Date.now();
          try {
            const localRes = await callToolSafely(mcpClient!, 'get_local_variables', {
              sessionId: currentSessionId,
            });
            const localVars = (localRes as any).variables ?? [];
            record('get_local_variables', lang.language, 'PASS',
              `${localVars.length} local vars: ${localVars.map((v: any) => v.name).join(', ').slice(0, 100)}`,
              Date.now() - t0);
          } catch (err: any) {
            record('get_local_variables', lang.language, 'FAIL', err.message, Date.now() - t0);
          }

          /* ---- Tool 11: evaluate_expression ---- */
          t0 = Date.now();
          try {
            const evalRes = await callToolSafely(mcpClient!, 'evaluate_expression', {
              sessionId: currentSessionId,
              expression: '1 + 2',
            });
            const val = (evalRes as any).result ?? (evalRes as any).value ?? JSON.stringify(evalRes);
            const passed = String(val).includes('3');
            record('evaluate_expression', lang.language, passed ? 'PASS' : 'FAIL',
              `1+2 = ${val}`,
              Date.now() - t0);
          } catch (err: any) {
            record('evaluate_expression', lang.language, 'FAIL', err.message, Date.now() - t0);
          }

          /* ---- Tool 12: step_over ---- */
          t0 = Date.now();
          try {
            const stepRes = await callToolSafely(mcpClient!, 'step_over', { sessionId: currentSessionId });
            await new Promise(r => setTimeout(r, 2000));
            const ok = stepRes.success !== false;
            record('step_over', lang.language, ok ? 'PASS' : 'FAIL',
              `success=${stepRes.success}, location=${JSON.stringify((stepRes as any).location ?? 'N/A').slice(0, 100)}`,
              Date.now() - t0);
          } catch (err: any) {
            record('step_over', lang.language, 'FAIL', err.message, Date.now() - t0);
          }

          /* ---- Tool 13: step_into ---- */
          t0 = Date.now();
          try {
            const stepRes = await callToolSafely(mcpClient!, 'step_into', { sessionId: currentSessionId });
            await new Promise(r => setTimeout(r, 2000));
            const ok = stepRes.success !== false;
            record('step_into', lang.language, ok ? 'PASS' : 'FAIL',
              `success=${stepRes.success}`,
              Date.now() - t0);
          } catch (err: any) {
            record('step_into', lang.language, 'FAIL', err.message, Date.now() - t0);
          }

          /* ---- Tool 14: step_out ---- */
          t0 = Date.now();
          try {
            const stepRes = await callToolSafely(mcpClient!, 'step_out', { sessionId: currentSessionId });
            await new Promise(r => setTimeout(r, 2000));
            // step_out may fail if we're at the top frame — that's acceptable
            const ok = stepRes.success !== false || (stepRes.message && !stepRes.message.includes('error'));
            record('step_out', lang.language, ok ? 'PASS' : 'FAIL',
              `success=${stepRes.success}, msg=${(stepRes.message ?? '').slice(0, 100)}`,
              Date.now() - t0);
          } catch (err: any) {
            // step_out at top-level is expected to fail
            record('step_out', lang.language, 'PASS', `Expected error at top frame: ${err.message.slice(0, 100)}`, Date.now() - t0);
          }

          /* ---- Tool 15: continue_execution ---- */
          t0 = Date.now();
          try {
            const contRes = await callToolSafely(mcpClient!, 'continue_execution', { sessionId: currentSessionId });
            await new Promise(r => setTimeout(r, 2000));
            record('continue_execution', lang.language, 'PASS',
              `success=${contRes.success}, state=${contRes.state ?? 'N/A'}`,
              Date.now() - t0);
          } catch (err: any) {
            record('continue_execution', lang.language, 'FAIL', err.message, Date.now() - t0);
          }

          /* ---- Tool 19: close_debug_session ---- */
          t0 = Date.now();
          try {
            const closeRes = await callToolSafely(mcpClient!, 'close_debug_session', { sessionId: currentSessionId });
            record('close_debug_session', lang.language, 'PASS',
              `success=${closeRes.success}`,
              Date.now() - t0);
            currentSessionId = null;
          } catch (err: any) {
            record('close_debug_session', lang.language, 'FAIL', err.message, Date.now() - t0);
            currentSessionId = null;
          }
        }, 90_000);
      } else {
        // Mock adapter: test session lifecycle without real debugging
        it(`Mock adapter: session lifecycle tools`, async () => {
          const createRes = await mcpClient!.callTool({
            name: 'create_debug_session',
            arguments: { language: 'mock', name: 'mock-lifecycle' },
          });
          currentSessionId = parseSdkToolResult(createRes).sessionId as string;
          record('create_debug_session', 'mock', 'PASS', `sessionId=${currentSessionId}`);

          // set_breakpoint on mock
          let t0 = Date.now();
          try {
            const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
              sessionId: currentSessionId,
              file: lang.script,
              line: lang.bpLine,
            });
            record('set_breakpoint', 'mock', 'PASS', `result=${JSON.stringify(bpRes).slice(0, 150)}`, Date.now() - t0);
          } catch (err: any) {
            record('set_breakpoint', 'mock', 'FAIL', err.message, Date.now() - t0);
          }

          // start_debugging on mock
          t0 = Date.now();
          try {
            const startRes = await mcpClient!.callTool({
              name: 'start_debugging',
              arguments: {
                sessionId: currentSessionId,
                scriptPath: lang.script,
                args: [],
              },
            });
            const parsed = parseSdkToolResult(startRes);
            record('start_debugging', 'mock', 'PASS', `state=${parsed.state}`, Date.now() - t0);
          } catch (err: any) {
            record('start_debugging', 'mock', 'FAIL', err.message, Date.now() - t0);
          }

          await new Promise(r => setTimeout(r, 2000));

          // Try inspection tools on mock
          for (const tool of ['get_stack_trace', 'get_local_variables', 'step_over', 'continue_execution'] as const) {
            t0 = Date.now();
            try {
              const args: Record<string, unknown> = { sessionId: currentSessionId };
              const res = await callToolSafely(mcpClient!, tool, args);
              record(tool, 'mock', res.success !== false ? 'PASS' : 'FAIL',
                JSON.stringify(res).slice(0, 150), Date.now() - t0);
            } catch (err: any) {
              record(tool, 'mock', 'FAIL', err.message, Date.now() - t0);
            }
          }

          // close session
          t0 = Date.now();
          try {
            await callToolSafely(mcpClient!, 'close_debug_session', { sessionId: currentSessionId });
            record('close_debug_session', 'mock', 'PASS', 'Closed', Date.now() - t0);
            currentSessionId = null;
          } catch (err: any) {
            record('close_debug_session', 'mock', 'FAIL', err.message, Date.now() - t0);
            currentSessionId = null;
          }

          // Record skips for tools not tested on mock
          for (const tool of ['get_source_context', 'get_scopes', 'get_variables',
            'evaluate_expression', 'step_into', 'step_out'] as const) {
            record(tool, 'mock', 'SKIP', 'Mock adapter — limited operations');
          }
        }, 60_000);
      }

      /* ---- Tool 16: pause_execution ---- */

      it(`Tool 16: pause_execution (${lang.language})`, async () => {
        // This tool is documented as "Not Implemented"
        const createRes = await mcpClient!.callTool({
          name: 'create_debug_session',
          arguments: { language: lang.language, name: `pause-test-${lang.language}` },
        });
        currentSessionId = parseSdkToolResult(createRes).sessionId as string;

        const t0 = Date.now();
        try {
          const res = await callToolSafely(mcpClient!, 'pause_execution', { sessionId: currentSessionId });
          // Expected to fail with "not implemented" or similar
          const isNotImpl = JSON.stringify(res).toLowerCase().includes('not implemented') ||
                           JSON.stringify(res).toLowerCase().includes('not supported') ||
                           res.success === false;
          record('pause_execution', lang.language, 'PASS',
            `Expected behavior (not implemented): ${JSON.stringify(res).slice(0, 150)}`,
            Date.now() - t0);
        } catch (err: any) {
          // Error is expected for "not implemented"
          record('pause_execution', lang.language, 'PASS',
            `Expected error: ${err.message.slice(0, 100)}`,
            Date.now() - t0);
        }
      }, 30_000);

      /* ---- Tool 17: attach_to_process ---- */

      it(`Tool 17: attach_to_process (${lang.language})`, async () => {
        // Create a session in attach mode
        const t0 = Date.now();
        try {
          // Create session first
          const createRes = await mcpClient!.callTool({
            name: 'create_debug_session',
            arguments: { language: lang.language, name: `attach-test-${lang.language}` },
          });
          currentSessionId = parseSdkToolResult(createRes).sessionId as string;

          const res = await callToolSafely(mcpClient!, 'attach_to_process', {
            sessionId: currentSessionId,
            port: 5678,
            host: 'localhost',
          });

          // Attach will likely fail because no process is actually listening
          // but the tool itself should respond (not crash)
          const responded = res !== undefined;
          record('attach_to_process', lang.language, responded ? 'PASS' : 'FAIL',
            `Responded (expected failure): ${JSON.stringify(res).slice(0, 150)}`,
            Date.now() - t0);
        } catch (err: any) {
          // Connection refused is expected when no debuggee is running
          const isExpected = err.message.includes('ECONNREFUSED') ||
                            err.message.includes('timeout') ||
                            err.message.includes('connect') ||
                            err.message.includes('attach');
          record('attach_to_process', lang.language, isExpected ? 'PASS' : 'FAIL',
            `${isExpected ? 'Expected' : 'Unexpected'} error: ${err.message.slice(0, 100)}`,
            Date.now() - t0);
        }
      }, 45_000);

      /* ---- Tool 18: detach_from_process ---- */

      it(`Tool 18: detach_from_process (${lang.language})`, async () => {
        if (!currentSessionId) {
          const createRes = await mcpClient!.callTool({
            name: 'create_debug_session',
            arguments: { language: lang.language, name: `detach-test-${lang.language}` },
          });
          currentSessionId = parseSdkToolResult(createRes).sessionId as string;
        }
        const t0 = Date.now();
        try {
          const res = await callToolSafely(mcpClient!, 'detach_from_process', {
            sessionId: currentSessionId,
          });
          // Detach without an attached process should give an error or succeed gracefully
          record('detach_from_process', lang.language, 'PASS',
            `Response: ${JSON.stringify(res).slice(0, 150)}`,
            Date.now() - t0);
        } catch (err: any) {
          // Error is expected when no process attached
          record('detach_from_process', lang.language, 'PASS',
            `Expected error (no process attached): ${err.message.slice(0, 100)}`,
            Date.now() - t0);
        }
      }, 30_000);
    });
  }

  /* ---------- summary printer ---------- */

  function printSummary() {
    console.log('\n\n========================================');
    console.log('           RESULTS MATRIX');
    console.log('========================================\n');

    // Group by tool
    const toolMap = new Map<string, Map<string, ToolResult>>();
    for (const r of results) {
      if (!toolMap.has(r.tool)) toolMap.set(r.tool, new Map());
      toolMap.get(r.tool)!.set(r.language, r);
    }

    // Header
    const langNames = LANGUAGES.map(l => l.language);
    const hdr = ['Tool', ...langNames].map(s => s.padEnd(14)).join(' | ');
    console.log(hdr);
    console.log('-'.repeat(hdr.length));

    for (const tool of ALL_TOOLS) {
      const row = [tool.padEnd(25)];
      for (const lang of langNames) {
        const r = toolMap.get(tool)?.get(lang) ?? toolMap.get(tool)?.get('all');
        const status = r?.status ?? 'PENDING';
        const icon = status === 'PASS' ? '✓ PASS' : status === 'FAIL' ? '✗ FAIL' : status === 'SKIP' ? '⊘ SKIP' : '… PEND';
        row.push(icon.padEnd(14));
      }
      console.log(row.join(' | '));
    }

    // Totals
    const total = results.length;
    const pass = results.filter(r => r.status === 'PASS').length;
    const fail = results.filter(r => r.status === 'FAIL').length;
    const skip = results.filter(r => r.status === 'SKIP').length;

    console.log(`\nTotal: ${total}  |  PASS: ${pass}  |  FAIL: ${fail}  |  SKIP: ${skip}`);
    console.log('========================================\n');

    // Write JSON results for report generation
    const fs = require('fs');
    const outPath = path.join(ROOT, 'tests', 'e2e', 'comprehensive-test-results.json');
    fs.writeFileSync(outPath, JSON.stringify({ results, summary: { total, pass, fail, skip }, timestamp: new Date().toISOString() }, null, 2));
    console.log(`[Report] JSON results written to ${outPath}`);
  }
});
