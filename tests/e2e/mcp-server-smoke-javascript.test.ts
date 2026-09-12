/**
 * Simplified JavaScript Smoke Tests
 * 
 * High-level tests that verify core debugging functionality without
 * coupling to implementation details. These tests should survive refactoring
 * as long as the debugging behavior remains correct.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import * as fs from 'fs';
import * as os from 'os';
import ts from 'typescript';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('JavaScript Debugging - Simple Smoke Tests', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    console.log('[JS Simple Smoke] Starting MCP server...');
    
    const cliEntry = path.join(ROOT, 'packages', 'mcp-debugger', 'dist', 'cli.mjs');
    if (!existsSync(cliEntry)) {
      throw new Error(
        `mcp-debugger CLI bundle missing at ${cliEntry}. Run "pnpm --filter @debugmcp/mcp-debugger build" before executing this test.`
      );
    }

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [cliEntry, 'stdio', '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client({
      name: 'js-simple-smoke-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[JS Simple Smoke] MCP client connected');
  }, 30000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try {
        await mcpClient.callTool({
          name: 'close_debug_session',
          arguments: { sessionId }
        });
      } catch {
        // Session may already be closed
      }
    }

    if (mcpClient) {
      await mcpClient.close();
    }
    if (transport) {
      await transport.close();
    }

    console.log('[JS Simple Smoke] Cleanup completed');
  });

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try {
        await mcpClient.callTool({
          name: 'close_debug_session',
          arguments: { sessionId }
        });
      } catch {
        // Ignore cleanup errors
      }
      sessionId = null;
    }
  });

  const JS_SCRIPT_PATH = path.join(ROOT, 'examples', 'javascript', 'simple_test.js');

  it('should complete full JavaScript debugging cycle', async () => {
    const scriptPath = JS_SCRIPT_PATH;
    // Step 1: Create session - just verify we get a session ID
    console.log('[JS Simple Smoke] Creating session...');
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'javascript',
        name: 'js-simple-smoke'
      }
    });
    
    const createResponse = parseSdkToolResult(createResult);
    expect(createResponse.sessionId).toBeDefined();
    expect(typeof createResponse.sessionId).toBe('string');
    sessionId = createResponse.sessionId as string;
    console.log('[JS Simple Smoke] ✓ Session created');

    // Step 2: Set breakpoint - just verify it was accepted
    console.log('[JS Simple Smoke] Setting breakpoint...');
    const bpResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId,
        file: scriptPath,
        line: 14
      }
    });
    
    const bpResponse = parseSdkToolResult(bpResult);
    expect(bpResponse.success).toBe(true);
    console.log('[JS Simple Smoke] ✓ Breakpoint set');

    // Step 3: Start debugging - verify we get a state back
    console.log('[JS Simple Smoke] Starting debugging...');
    const startResult = await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath,
        args: [],
        dapLaunchArgs: {
          stopOnEntry: false,
          justMyCode: true
        }
      }
    });
    
    const startResponse = parseSdkToolResult(startResult);
    expect(startResponse.state).toBeDefined();
    // Should be paused at breakpoint
    expect(startResponse.state).toContain('paused');
    console.log('[JS Simple Smoke] ✓ Paused at breakpoint');

    // Wait briefly for session to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // A breakpoint the debuggee is paused on must never be reported unbound
    // (issue #673): a stop naming its id is proof it bound, whatever js-debug
    // said about it before.
    const listResult = await mcpClient!.callTool({
      name: 'list_breakpoints',
      arguments: { sessionId }
    });
    const listResponse = parseSdkToolResult(listResult);
    const listed = (listResponse.breakpoints as Array<{ verified: boolean; message?: string }>) ?? [];
    expect(listed.length).toBe(1);
    expect(listed[0].verified, JSON.stringify(listed[0])).toBe(true);
    expect(listed[0].message).toBeUndefined();
    console.log('[JS Simple Smoke] ✓ Hit breakpoint reported verified');

    // Step 4: Get stack - verify we can retrieve it
    console.log('[JS Simple Smoke] Getting stack trace...');
    const stackResult = await mcpClient!.callTool({
      name: 'get_stack_trace',
      arguments: {
        sessionId,
        includeInternals: false
      }
    });
    
    const stackResponse = parseSdkToolResult(stackResult);
    expect(stackResponse.stackFrames).toBeDefined();
    expect(Array.isArray(stackResponse.stackFrames)).toBe(true);
    expect((stackResponse.stackFrames as any[]).length).toBeGreaterThan(0);
    console.log('[JS Simple Smoke] ✓ Stack trace retrieved');

    // Step 5: Get variables - verify we can access them
    console.log('[JS Simple Smoke] Getting local variables...');
    const varsResult = await mcpClient!.callTool({
      name: 'get_local_variables',
      arguments: {
        sessionId,
        includeSpecial: false
      }
    });
    
    const varsResponse = parseSdkToolResult(varsResult);
    expect(varsResponse.variables).toBeDefined();
    expect(Array.isArray(varsResponse.variables)).toBe(true);
    // Variables array might be empty at this line, but the mechanism works
    console.log('[JS Simple Smoke] ✓ Variables accessible');

    // Step 6: Step over - verify we can control execution
    console.log('[JS Simple Smoke] Stepping over...');
    const stepResult = await mcpClient!.callTool({
      name: 'step_over',
      arguments: { sessionId }
    });

    const stepResponse = parseSdkToolResult(stepResult);
    expect(stepResponse.success).toBe(true);
    console.log('[JS Simple Smoke] ✓ Step executed');

    // Verify location and context are provided
    if (stepResponse.location) {
      console.log('[JS Simple Smoke] Step result includes location:', stepResponse.location);
      expect(stepResponse.location).toHaveProperty('file');
      expect(stepResponse.location).toHaveProperty('line');
      expect(typeof (stepResponse.location as any).line).toBe('number');
    }

    if (stepResponse.context) {
      console.log('[JS Simple Smoke] Step result includes context');
      expect(stepResponse.context).toHaveProperty('lineContent');
      expect(stepResponse.context).toHaveProperty('surrounding');
      expect(Array.isArray((stepResponse.context as any).surrounding)).toBe(true);
    }

    // Wait for step to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 7: Evaluate expression - verify we can execute code
    console.log('[JS Simple Smoke] Evaluating expression...');
    const evalResult = await mcpClient!.callTool({
      name: 'evaluate_expression',
      arguments: {
        sessionId,
        expression: '1 + 2'
      }
    });
    
    const evalResponse = parseSdkToolResult(evalResult);
    expect(evalResponse.result).toBeDefined();
    // Result should be "3" in some form
    const resultStr = String(evalResponse.result);
    expect(resultStr).toMatch(/3/);
    console.log('[JS Simple Smoke] ✓ Expression evaluated');

    // Step 8: Continue execution
    console.log('[JS Simple Smoke] Continuing execution...');
    const continueResult = await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    });
    
    const continueResponse = parseSdkToolResult(continueResult);
    expect(continueResponse.success).toBe(true);
    console.log('[JS Simple Smoke] ✓ Execution continued');

    // Wait for script to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 9: Close session
    console.log('[JS Simple Smoke] Closing session...');
    const closeResult = await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    
    const closeResponse = parseSdkToolResult(closeResult);
    expect(closeResponse.success).toBe(true);
    sessionId = null;
    console.log('[JS Simple Smoke] ✓ Session closed');

    console.log('[JS Simple Smoke] ✅ All checks passed');
  }, 60000);

  it('reports a dependency breakpoint verified once it is hit, even when js-debug never confirms it (issue #673)', async () => {
    // A breakpoint inside express, addressed through the top-level
    // node_modules/express path (pnpm makes it a symlink to the real
    // package). js-debug binds it and it fires, but it sends no
    // `breakpoint` event for such a location; the stop that names its id
    // is the only proof it bound.
    const fixture = path.join(ROOT, 'examples', 'javascript', 'express_selfcall.js');
    const expressApplication = path.join(ROOT, 'node_modules', 'express', 'lib', 'application.js');

    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'javascript', name: 'js-dependency-breakpoint' }
    });
    sessionId = parseSdkToolResult(createResult).sessionId as string;

    const bpResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: expressApplication, statement: 'this.router.handle(req, res, done);' }
    });
    const bpResponse = parseSdkToolResult(bpResult);
    expect(bpResponse.success, JSON.stringify(bpResponse)).toBe(true);

    const startResult = await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: { sessionId, scriptPath: fixture, args: [], dapLaunchArgs: { stopOnEntry: false, justMyCode: true } }
    });
    const startResponse = parseSdkToolResult(startResult);
    expect(startResponse.success, JSON.stringify(startResponse)).toBe(true);

    // The self-request runs on the next event-loop turns; wait for the stop.
    const deadline = Date.now() + 20000;
    let paused = startResponse.state === 'paused';
    while (!paused && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const listed = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
      const mine = ((listed.sessions as Array<{ id: string; state: string }>) ?? []).find(s => s.id === sessionId);
      paused = mine?.state === 'paused';
    }
    expect(paused, 'the express breakpoint must fire on the self-request').toBe(true);

    const stack = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_stack_trace', arguments: { sessionId } }));
    expect(stack.stopReason).toBe('breakpoint');

    const listResponse = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_breakpoints', arguments: { sessionId } }));
    const listed = (listResponse.breakpoints as Array<{ verified: boolean; message?: string; adapterId?: number }>) ?? [];
    expect(listed.length).toBe(1);
    expect(listed[0].verified, JSON.stringify(listed[0])).toBe(true);
    expect(listed[0].message).toBeUndefined();
    expect(typeof listed[0].adapterId).toBe('number');

    await mcpClient!.callTool({ name: 'continue_execution', arguments: { sessionId } });
    console.log('[JS Simple Smoke] ✓ Dependency breakpoint reported verified after its hit');
  }, 60000);

  /**
   * How the idle express fixture is launched: `justMyCode` is spread into
   * dapLaunchArgs only when given, so `{}` replays the unset default the
   * README's default row describes (issue #687) at the MCP surface — the
   * server merges `defaultDapLaunchArgs` underneath, so below that boundary it
   * is the `justMyCode: true` launch; `adapterLaunchConfig` reaches the launch
   * transform's overrides (e.g. `{ smartStep: false }`).
   */
  interface IdleExpressLaunch {
    justMyCode?: boolean;
    adapterLaunchConfig?: Record<string, unknown>;
  }

  /** A session name that encodes the whole launch variant, for leaked-session dumps. */
  function describeLaunch(launch: IdleExpressLaunch): string {
    const extras = Object.entries(launch.adapterLaunchConfig ?? {}).map(([key, value]) => `${key}=${String(value)}`);
    return [`justMyCode=${launch.justMyCode ?? 'unset'}`, ...extras].join('-');
  }

  /**
   * Launch the idle express fixture — with a breakpoint inside express unless
   * told otherwise — and return the port it listens on.
   */
  async function launchIdleExpress(launch: IdleExpressLaunch = {}, options: { breakpoint: boolean } = { breakpoint: true }): Promise<number> {
    const fixture = path.join(ROOT, 'examples', 'javascript', 'express_idle_server.js');
    const expressApplication = path.join(ROOT, 'node_modules', 'express', 'lib', 'application.js');

    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'javascript', name: `js-dependency-${describeLaunch(launch)}` }
    });
    sessionId = parseSdkToolResult(createResult).sessionId as string;

    if (options.breakpoint) {
      const bpResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: expressApplication, statement: 'this.router.handle(req, res, done);' }
      }));
      expect(bpResponse.success, JSON.stringify(bpResponse)).toBe(true);
    }

    const startResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath: fixture,
        args: [],
        dapLaunchArgs: { stopOnEntry: false, ...(launch.justMyCode !== undefined ? { justMyCode: launch.justMyCode } : {}) },
        ...(launch.adapterLaunchConfig ? { adapterLaunchConfig: launch.adapterLaunchConfig } : {})
      }
    }));
    expect(startResponse.success, JSON.stringify(startResponse)).toBe(true);

    // The fixture prints its port once it listens.
    let port: number | undefined;
    const listenDeadline = Date.now() + 20000;
    while (port === undefined && Date.now() < listenDeadline) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const output = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_output', arguments: { sessionId } }));
      const entries = (output.entries as Array<{ output: string }>) ?? [];
      const match = entries.map(e => /listening (\d+)/.exec(e.output)).find(Boolean);
      if (match) port = Number(match[1]);
    }
    expect(port, 'the fixture must report its port').toBeDefined();
    return port!;
  }

  /**
   * Launch with the express breakpoint, send one request from here, and return
   * once the session is paused on it.
   */
  async function pauseInsideExpress(launch: IdleExpressLaunch = {}): Promise<void> {
    const port = await launchIdleExpress(launch);

    // One request, left pending: it parks on the express breakpoint.
    const http = await import('node:http');
    const request = http.get(`http://127.0.0.1:${port}/ping`, res => res.resume());
    request.on('error', () => { /* the session teardown ends the request */ });

    const deadline = Date.now() + 20000;
    let paused = false;
    while (!paused && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const listed = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
      const mine = ((listed.sessions as Array<{ id: string; state: string }>) ?? []).find(s => s.id === sessionId);
      paused = mine?.state === 'paused';
    }
    expect(paused, 'the express breakpoint must fire on the request').toBe(true);
  }

  it.each([
    ['justMyCode: true', { justMyCode: true } as IdleExpressLaunch],
    ['the unset default (issue #687)', {} as IdleExpressLaunch]
  ])('explains a step lost to a skipped dependency frame on the launch with %s (issue #678)', async (label, launch) => {
    await pauseInsideExpress(launch);

    const step = parseSdkToolResult(await mcpClient!.callTool({ name: 'step_over', arguments: { sessionId } }));
    expect(step.success, JSON.stringify(step)).toBe(true);
    // js-debug steps out of the blackboxed frame and the request completes
    // without ever reaching unskipped code: the step is lost, and the
    // response says why and what to do about it.
    expect(step.pending, JSON.stringify(step)).toBe(true);
    expect(step.message).toMatch(/skipped frame/);
    expect(step.message).toMatch(/justMyCode: false/);
    console.log(`[JS Simple Smoke] ✓ Lost dependency step explained (${label})`);
  }, 60000);

  it('lands a step issued inside a dependency when justMyCode is false (issue #678)', async () => {
    await pauseInsideExpress({ justMyCode: false });

    const step = parseSdkToolResult(await mcpClient!.callTool({ name: 'step_over', arguments: { sessionId } }));
    expect(step.success, JSON.stringify(step)).toBe(true);
    expect(step.pending, JSON.stringify(step)).toBeUndefined();
    expect(step.stopReason, JSON.stringify(step)).toBeUndefined();
    const location = step.location as { file: string; line: number } | undefined;
    expect(location?.file, JSON.stringify(step)).toMatch(/[\\/]express[\\/]lib[\\/]application\.js$/);
    console.log('[JS Simple Smoke] ✓ Dependency step landed with justMyCode: false');
  }, 60000);

  it('lands pause_execution on an idle launched server when justMyCode is false (issue #678)', async () => {
    // Node internals stay skipped on every launch, so with js-debug's
    // smart-stepper on, a pause that lands in them is stepped out of forever
    // (the #513 mechanism). justMyCode: false turns the stepper off too.
    const port = await launchIdleExpress({ justMyCode: false }, { breakpoint: false });

    // Nothing runs on a truly idle server, so the pause is pending until the
    // next JavaScript executes; a request supplies that, and the stepper being
    // off is what lets the resulting stop land instead of being stepped past.
    const pause = parseSdkToolResult(await mcpClient!.callTool({ name: 'pause_execution', arguments: { sessionId } }));
    expect(pause.success, JSON.stringify(pause)).toBe(true);
    const http = await import('node:http');
    const request = http.get(`http://127.0.0.1:${port}/ping`, res => res.resume());
    request.on('error', () => { /* the session teardown ends the request */ });
    let paused = pause.state === 'paused';
    const deadline = Date.now() + 15000;
    while (!paused && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const listed = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
      const mine = ((listed.sessions as Array<{ id: string; state: string }>) ?? []).find(s => s.id === sessionId);
      paused = mine?.state === 'paused';
    }
    expect(paused, JSON.stringify(pause)).toBe(true);
    console.log('[JS Simple Smoke] ✓ Pause landed on an idle launched server with justMyCode: false');
  }, 60000);

  // Issue #687 measured the launch default and kept it; the next tests pin
  // both sides of that decision on the same fixture.

  it('lands a step issued inside a dependency with the smart-stepper off on the default skip list (issue #687)', async () => {
    // What a launch default of smartStep: false would do (the attach default
    // since #513): the step lands, in the next frame V8 does not skip — an
    // internals frame on a request path — and the stack response marks it.
    await pauseInsideExpress({ adapterLaunchConfig: { smartStep: false } });

    const step = parseSdkToolResult(await mcpClient!.callTool({ name: 'step_over', arguments: { sessionId } }));
    expect(step.success, JSON.stringify(step)).toBe(true);
    expect(step.pending, JSON.stringify(step)).toBeUndefined();
    const location = step.location as { file: string; line: number } | undefined;
    expect(location?.file, JSON.stringify(step)).toMatch(/<node_internals>/);

    // Frame 0 is the internals frame the program stopped in — kept as the
    // anchor whether or not an async ancestor survives the display filter.
    const stack = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_stack_trace', arguments: { sessionId } }));
    const frames = stack.stackFrames as Array<{ file: string }>;
    expect(frames[0]?.file, JSON.stringify(stack)).toMatch(/<node_internals>/);
    const locals = parseSdkToolResult(await mcpClient!.callTool({ name: 'get_local_variables', arguments: { sessionId } }));
    expect(locals.success, JSON.stringify(locals)).toBe(true);
    console.log('[JS Simple Smoke] ✓ Dependency step landed in an internals frame with the stepper off');
  }, 60000);

  // The load-bearing #687 observation: from a dependency frame, step_into
  // reaches the user handler in one press with the stepper on (the default)
  // and stops in Node internals with it off — js-debug 1.112's blackbox
  // patterns cover node:internal/* but not top-level builtins such as node:url.
  it.each([
    ['on (the default)', {} as IdleExpressLaunch, /[\\/]express_idle_server\.js$/],
    ['off', { adapterLaunchConfig: { smartStep: false } } as IdleExpressLaunch, /<node_internals>/]
  ])('step_into from a dependency frame with the smart-stepper %s (issue #687)', async (label, launch, expected) => {
    await pauseInsideExpress(launch);

    const step = parseSdkToolResult(await mcpClient!.callTool({ name: 'step_into', arguments: { sessionId } }));
    expect(step.success, JSON.stringify(step)).toBe(true);
    expect(step.pending, JSON.stringify(step)).toBeUndefined();
    const location = step.location as { file: string; line: number } | undefined;
    expect(location?.file, JSON.stringify(step)).toMatch(expected);
    console.log(`[JS Simple Smoke] ✓ step_into from a dependency frame, stepper ${label}: ${location?.file}`);
  }, 60000);

  it('should handle multiple breakpoints', async () => {
    const scriptPath = JS_SCRIPT_PATH;
    
    // Create session
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'javascript',
        name: 'js-multi-bp'
      }
    });
    
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    
    // Set multiple breakpoints
    const bp1 = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: scriptPath, line: 11 }
    });
    
    const bp2 = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: scriptPath, line: 14 }
    });
    
    // Both should succeed
    expect(parseSdkToolResult(bp1).success).toBe(true);
    expect(parseSdkToolResult(bp2).success).toBe(true);
    
    console.log('[JS Simple Smoke] ✓ Multiple breakpoints set');
    
    // Cleanup
    await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    sessionId = null;
  });

  it('should retrieve source context', async () => {
    const scriptPath = JS_SCRIPT_PATH;
    
    // Create session
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'javascript',
        name: 'js-source'
      }
    });
    
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    
    // Get source context
    const sourceResult = await mcpClient!.callTool({
      name: 'get_source_context',
      arguments: {
        sessionId,
        file: scriptPath,
        line: 14,
        linesContext: 3
      }
    });
    
    const sourceResponse = parseSdkToolResult(sourceResult);
    // Just verify we got some source information back - tool succeeded
    expect(sourceResponse.success).toBe(true);
    // Verify we got some source content (don't care about exact format)
    expect(
      sourceResponse.lineContent || 
      sourceResponse.source || 
      sourceResponse.context
    ).toBeDefined();
    
    console.log('[JS Simple Smoke] ✓ Source context retrieved');
    
    // Cleanup
    await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    sessionId = null;
  });
});

/**
 * Module-load breakpoints in source-mapped TypeScript (issue #699).
 *
 * A breakpoint on a `.ts` line that runs while its module loads used to be
 * verified by js-debug only after the line had executed, so a
 * `stopOnEntry: false` launch ran to completion without stopping. The launch
 * now hands js-debug a workspace root, which is what lets its breakpoint
 * predictor pre-bind the mapped location before the program starts.
 *
 * Both module flavours are transpiled here from the checked-in
 * `typescript_test.ts` rather than launching the committed `.js` beside it:
 * that output is a build artefact with no drift check, and the line number
 * below is only meaningful against a map produced from the same source.
 * CommonJS is the shape that raced — the instrumentation pause js-debug can
 * otherwise fall back on never fires for a CommonJS entry module under Node
 * 24 — and ES2015 is deliberate: `await` downlevels to `__awaiter`/`yield`,
 * the harsher mapping. The ES-module variant guards the shape that already
 * worked. Each temp dir carries its own package.json so the root's
 * `"type": "module"` cannot leak in.
 */
describe('JavaScript Debugging - module-load breakpoints in source-mapped TypeScript (issue #699)', () => {
  const FIXTURE_TS = path.join(ROOT, 'examples', 'javascript', 'typescript_test.ts');
  /** `const person1 = await fetchData(1);` inside main(), which is called at module load. */
  const MODULE_LOAD_LINE = 91;
  const KINDS = ['commonjs', 'esm'] as const;
  type Kind = typeof KINDS[number];

  const dirs = new Map<Kind, string>();
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  function transpile(kind: Kind): string {
    // realpathSync.native resolves Windows 8.3 short names in os.tmpdir(), so
    // the path js-debug echoes back can be matched by suffix.
    const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), `mcp-js-699-${kind}-`)));
    const source = fs.readFileSync(FIXTURE_TS, 'utf8');
    const compilerOptions: ts.CompilerOptions = kind === 'commonjs'
      ? { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2015, sourceMap: true }
      : { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, sourceMap: true };
    const out = ts.transpileModule(source, { fileName: 'typescript_test.ts', compilerOptions });
    if (!out.sourceMapText) {
      throw new Error(`transpileModule produced no source map for the ${kind} variant`);
    }
    fs.writeFileSync(path.join(dir, 'typescript_test.ts'), source);
    fs.writeFileSync(path.join(dir, 'typescript_test.js'), out.outputText);
    fs.writeFileSync(path.join(dir, 'typescript_test.js.map'), out.sourceMapText);
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: kind === 'esm' ? 'module' : 'commonjs' }));
    return dir;
  }

  beforeAll(async () => {
    for (const kind of KINDS) {
      dirs.set(kind, transpile(kind));
    }

    const cliEntry = path.join(ROOT, 'packages', 'mcp-debugger', 'dist', 'cli.mjs');
    if (!existsSync(cliEntry)) {
      throw new Error(`mcp-debugger CLI bundle missing at ${cliEntry}. Run "pnpm --filter @debugmcp/mcp-debugger build" first.`);
    }
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [cliEntry, 'stdio', '--log-level', 'info'],
      env: { ...process.env, NODE_ENV: 'test' }
    });
    mcpClient = new Client({ name: 'js-699-smoke-client', version: '1.0.0' }, { capabilities: {} });
    await mcpClient.connect(transport);
  }, 30000);

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

  afterAll(async () => {
    if (mcpClient) {
      await mcpClient.close();
    }
    if (transport) {
      await transport.close();
    }
    for (const dir of dirs.values()) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  for (const kind of KINDS) {
    it(`${kind}: a breakpoint on a line that runs at module load fires on a stopOnEntry:false launch`, async () => {
      const dir = dirs.get(kind)!;
      const tsFile = path.join(dir, 'typescript_test.ts');
      const jsFile = path.join(dir, 'typescript_test.js');

      const created = parseSdkToolResult(await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'javascript', name: `js-699-${kind}` }
      }));
      expect(created.sessionId).toBeDefined();
      sessionId = created.sessionId as string;

      const bp = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: tsFile, line: MODULE_LOAD_LINE }
      }));
      expect(bp.success, JSON.stringify(bp)).toBe(true);

      const start = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: jsFile,
          args: [],
          dapLaunchArgs: { stopOnEntry: false, justMyCode: true }
        }
      }));
      expect(start.state, JSON.stringify(start)).toBe('paused');
      expect((start.data as { reason?: string } | undefined)?.reason, JSON.stringify(start)).toBe('breakpoint');

      const stack = parseSdkToolResult(await mcpClient!.callTool({
        name: 'get_stack_trace',
        arguments: { sessionId }
      }));
      expect(stack.stopReason).toBe('breakpoint');
      const frames = (stack.stackFrames as Array<{ file?: string; line?: number }>) ?? [];
      // js-debug echoes a lower-case drive letter on Windows: match by suffix only
      expect(frames[0]?.file ?? '', JSON.stringify(frames[0])).toMatch(/typescript_test.ts$/i);
      expect(frames[0]?.line).toBe(MODULE_LOAD_LINE);

      const listed = parseSdkToolResult(await mcpClient!.callTool({
        name: 'list_breakpoints',
        arguments: { sessionId }
      }));
      const [record] = (listed.breakpoints as Array<{ verified: boolean; message?: string }>) ?? [];
      expect(record?.verified, JSON.stringify(record)).toBe(true);

      await mcpClient!.callTool({ name: 'continue_execution', arguments: { sessionId } });
    }, 60000);
  }
});
