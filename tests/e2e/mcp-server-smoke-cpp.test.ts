/**
 * C/C++ Adapter Smoke Test via MCP Interface (issue #325)
 *
 * Mirrors the Rust smoke suite (same CodeLLDB engine) plus the cpp-specific
 * source-file auto-compile launch path. Self-skips without a compiler
 * (@requires-cpp) and on environments that block spawning CodeLLDB.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, rmSync } from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { skipIfSpawnBlocked } from '../test-utils/helpers/adapter-spawn.js';
import { prepareCppExample, hasCppToolchain } from './cpp-example-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const SKIP_CPP = !hasCppToolchain();

// Line numbers in examples/cpp/hello_world.cpp
const BP_LINE = 17;      // int answer = compute_answer(count, 4); — after locals are assigned

describe.skipIf(SKIP_CPP)('MCP Server C/C++ Debugging Smoke Test @requires-cpp', () => {
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
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client(
      { name: 'cpp-smoke-test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await mcpClient.connect(transport);
    console.log('[C/C++ Smoke Test] MCP client connected');
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

  async function fetchStackTrace(): Promise<{
    success?: boolean;
    stackFrames?: Array<{ file?: string; name?: string; line?: number }>;
  }> {
    const stackRaw = await mcpClient!.callTool({
      name: 'get_stack_trace',
      arguments: { sessionId, includeInternals: false }
    });
    return parseSdkToolResult(stackRaw) as {
      success?: boolean;
      stackFrames?: Array<{ file?: string; name?: string; line?: number }>;
    };
  }

  const isUserFrame = (frame: { file?: string }) => {
    if (typeof frame.file !== 'string') return false;
    return frame.file.replace(/\\/g, '/').includes('/examples/cpp/');
  };

  async function getSession(): Promise<{ state?: string; exitCode?: number } | undefined> {
    const res = parseSdkToolResult(await mcpClient!.callTool({
      name: 'list_debug_sessions',
      arguments: {}
    }));
    const sessions = (res.sessions ?? []) as Array<{ id: string; state?: string; exitCode?: number }>;
    return sessions.find(s => s.id === sessionId);
  }

  async function pollStopped(timeoutMs: number): Promise<{ state?: string; exitCode?: number } | undefined> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const snap = await getSession();
      if (snap?.state === 'stopped') return snap;
      await wait(300);
    }
    return undefined;
  }

  /** Drive the session from a possible launch-time system stop to the user frame at `line`. */
  async function reachUserFrame(line: number): Promise<boolean> {
    await wait(500);
    let stackResponse = await fetchStackTrace();
    for (let attempt = 0; attempt < 10; attempt++) {
      const frame = stackResponse.stackFrames?.find(isUserFrame);
      if (frame && frame.line === line) {
        return true;
      }
      const snap = await getSession();
      if (snap?.state === 'paused') {
        await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      }
      await wait(400);
      stackResponse = await fetchStackTrace();
    }
    return stackResponse.stackFrames?.some(f => isUserFrame(f) && f.line === line) ?? false;
  }

  it(
    'starts C++ debug session end-to-end without proxy exit',
    async (ctx) => {
      const { sourcePath, binaryPath } = prepareCppExample('hello_world');
      expect(existsSync(sourcePath)).toBe(true);
      expect(existsSync(binaryPath)).toBe(true);

      const createResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'cpp', name: 'cpp-smoke-test' }
      }));
      expect(createResponse.success).toBe(true);
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;

      const breakpointResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: sourcePath, line: BP_LINE }
      }));
      expect(breakpointResponse.success).toBe(true);

      const startResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: binaryPath,
          args: [],
          dapLaunchArgs: { stopOnEntry: true }
        }
      }));
      const message = String(startResponse.message ?? startResponse.error ?? '');
      if (!startResponse.success) {
        // CodeLLDB missing / not executable / blocked by Windows Smart App
        // Control: skip with a clear reason rather than an opaque failure.
        skipIfSpawnBlocked(ctx, startResponse, 'C/C++');
        throw new Error(`start_debugging failed: ${JSON.stringify(startResponse, null, 2)}`);
      }
      expect(['paused', 'running']).toContain(startResponse.state);
      expect(message.toLowerCase()).not.toContain('proxy exited');

      expect(await reachUserFrame(BP_LINE), 'session should pause at the breakpoint line').toBe(true);

      const stackResponse = await fetchStackTrace();
      const activeFrame = stackResponse.stackFrames!.find(isUserFrame)!;
      expect(activeFrame.name?.toLowerCase()).toContain('main');
      expect(activeFrame.line).toBe(BP_LINE);

      const localsResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      })) as { success?: boolean; variables?: Array<{ name: string; value: string }> };

      expect(localsResponse.success).toBe(true);
      const localsByName = new Map(
        (localsResponse.variables ?? []).map(variable => [variable.name, variable.value])
      );
      expect(localsByName.get('count')).toBe('10');
      const greeting = localsByName.get('greeting');
      expect(greeting).toBeDefined();
      expect(greeting).toContain('Hello from C++');

      // Step over the compute_answer call, then verify the result landed.
      const stepResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'step_over',
        arguments: { sessionId }
      }));
      expect(stepResponse.success).toBe(true);
      await wait(300);

      const evalResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'evaluate_expression',
        arguments: { sessionId, expression: 'answer' }
      })) as { success?: boolean; result?: string };
      expect(evalResponse.success).toBe(true);
      expect(String(evalResponse.result)).toContain('42');

      // Run to completion, then the output markers must be retrievable
      // (issue #223 tier: POSIX via CodeLLDB DAP output events, Windows via
      // the proxy's adapter-stdio forwarding).
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      const stopped = await pollStopped(20000);
      expect(stopped, 'program should run to completion after continue').toBeDefined();
      expect(stopped!.exitCode).toBe(0);

      const outputResult = await callToolSafely(mcpClient!, 'get_output', { sessionId });
      expect(outputResult.success).toBe(true);
      const outputEntries = (outputResult.entries ?? []) as Array<{ category: string; output: string }>;
      const markerEntry = outputEntries.find(e => e.output.includes('CPP_DEBUG_MARKER'));
      expect(markerEntry, 'stdout marker should be captured').toBeDefined();
      expect(markerEntry!.output).toContain('answer=42');
    },
    90000
  );

  it(
    'auto-compiles a lone source file and stops at a breakpoint',
    async (ctx) => {
      const { sourcePath } = prepareCppExample('hello_world');

      // Force the adapter's own compile path: clear its .debug-mcp output dir
      const adapterBuildDir = path.join(path.dirname(sourcePath), '.debug-mcp');
      rmSync(adapterBuildDir, { recursive: true, force: true });

      const createResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'cpp', name: 'cpp-source-launch-test' }
      }));
      expect(createResponse.success).toBe(true);
      sessionId = createResponse.sessionId as string;

      const breakpointResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: sourcePath, line: BP_LINE }
      }));
      expect(breakpointResponse.success).toBe(true);

      // scriptPath is the SOURCE file — the adapter compiles it on launch
      const startResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: sourcePath,
          dapLaunchArgs: { stopOnEntry: false }
        }
      }));
      if (!startResponse.success) {
        skipIfSpawnBlocked(ctx, startResponse, 'C/C++');
        throw new Error(`source-file start_debugging failed: ${JSON.stringify(startResponse, null, 2)}`);
      }

      expect(await reachUserFrame(BP_LINE), 'session should pause at the breakpoint in the compiled source').toBe(true);

      // The adapter must have produced its own .debug-mcp binary
      expect(existsSync(adapterBuildDir), 'adapter should compile into .debug-mcp/').toBe(true);

      const localsResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      })) as { success?: boolean; variables?: Array<{ name: string; value: string }> };
      expect(localsResponse.success).toBe(true);
      const names = (localsResponse.variables ?? []).map(v => v.name);
      expect(names).toContain('count');

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      const stopped = await pollStopped(20000);
      expect(stopped).toBeDefined();
      expect(stopped!.exitCode).toBe(0);
    },
    90000
  );

  it(
    'sets a function breakpoint on compute_answer and pauses inside it',
    async (ctx) => {
      const { binaryPath } = prepareCppExample('hello_world');

      const createResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'cpp', name: 'cpp-function-bp-test' }
      }));
      expect(createResponse.success).toBe(true);
      sessionId = createResponse.sessionId as string;

      const fbResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, function: 'compute_answer' }
      }));
      expect(fbResponse.success).toBe(true);

      const startResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: binaryPath,
          dapLaunchArgs: { stopOnEntry: false }
        }
      }));
      if (!startResponse.success) {
        skipIfSpawnBlocked(ctx, startResponse, 'C/C++');
        throw new Error(`function-bp start_debugging failed: ${JSON.stringify(startResponse, null, 2)}`);
      }

      // Drive past any launch-time stop until we land inside compute_answer
      let inFunction = false;
      for (let attempt = 0; attempt < 10 && !inFunction; attempt++) {
        await wait(400);
        const snap = await getSession();
        if (snap?.state === 'stopped') break;
        if (snap?.state !== 'paused') continue;
        const stack = await fetchStackTrace();
        const top = stack.stackFrames?.[0];
        if (top?.name?.includes('compute_answer')) {
          inFunction = true;
          break;
        }
        await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      }
      expect(inFunction, 'session should pause inside compute_answer').toBe(true);

      const localsResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      })) as { success?: boolean; variables?: Array<{ name: string; value: string }> };
      expect(localsResponse.success).toBe(true);
      const localsByName = new Map(
        (localsResponse.variables ?? []).map(variable => [variable.name, variable.value])
      );
      expect(localsByName.get('base')).toBe('10');
      expect(localsByName.get('factor')).toBe('4');

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      const stopped = await pollStopped(20000);
      expect(stopped).toBeDefined();
      expect(stopped!.exitCode).toBe(0);
    },
    90000
  );
});
