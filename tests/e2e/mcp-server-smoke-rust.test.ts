/**
 * Rust Adapter Smoke Test via MCP Interface
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { skipIfSpawnBlocked } from '../test-utils/helpers/adapter-spawn.js';
import { prepareRustExample } from './rust-example-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
describe('MCP Server Rust Debugging Smoke Test', () => {
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
      { name: 'rust-smoke-test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await mcpClient.connect(transport);
    console.log('[Rust Smoke Test] MCP client connected');
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

  it(
    'starts Rust debug session end-to-end without proxy exit',
    async (ctx) => {
      const { sourcePath: helloSourcePath, binaryPath: helloBinaryPath } =
        await prepareRustExample('hello_world');
      expect(existsSync(helloSourcePath)).toBe(true);
      expect(existsSync(helloBinaryPath)).toBe(true);

      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'rust', name: 'rust-smoke-test' }
      });
      const createResponse = parseSdkToolResult(createResult);
      expect(createResponse.success).toBe(true);
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;

      const breakpointResult = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: helloSourcePath,
          line: 26
        }
      });
      const breakpointResponse = parseSdkToolResult(breakpointResult);
      expect(breakpointResponse.success).toBe(true);

      const startResult = await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: helloBinaryPath,
          args: [],
          dapLaunchArgs: {
            stopOnEntry: true
          },
          adapterLaunchConfig: {
            sourceLanguages: ['rust']
          }
        }
      });
      const startResponse = parseSdkToolResult(startResult);
      const message = String(startResponse.message ?? startResponse.error ?? '');
      if (!startResponse.success) {
        // If the CodeLLDB binary couldn't be spawned (missing / not executable /
        // blocked by Windows Smart App Control), skip with a clear reason rather
        // than hard-fail with the opaque "spawn UNKNOWN".
        skipIfSpawnBlocked(ctx, startResponse, 'Rust');
        throw new Error(`start_debugging failed: ${JSON.stringify(startResponse, null, 2)}`);
      }
      expect(['paused', 'running']).toContain(startResponse.state);
      expect(message.toLowerCase()).not.toContain('proxy exited');

      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const fetchStackTrace = async () => {
        const stackRaw = await mcpClient!.callTool({
          name: 'get_stack_trace',
          arguments: {
            sessionId,
            includeInternals: false
          }
        });
        return parseSdkToolResult(stackRaw) as {
          success?: boolean;
          stackFrames?: Array<{ file?: string; name?: string; line?: number }>;
        };
      };

      const isUserFrame = (frame: { file?: string }) => {
        if (typeof frame.file !== 'string') return false;
        const normalized = frame.file.replace(/\\/g, '/');
        return normalized.includes('/examples/rust/hello_world/src/');
      };

      await wait(500);
      let stackResponse = await fetchStackTrace();

      if (!stackResponse.stackFrames?.some(isUserFrame)) {
        const continueResult = parseSdkToolResult(
          await mcpClient!.callTool({
            name: 'continue_execution',
            arguments: { sessionId }
          })
        );
        expect(continueResult.success).toBe(true);

        for (let attempt = 0; attempt < 10; attempt++) {
          await wait(300);
          stackResponse = await fetchStackTrace();
          if (stackResponse.stackFrames?.some(isUserFrame)) {
            break;
          }
        }
      }

      if (!stackResponse.stackFrames?.some(isUserFrame)) {
        throw new Error(`Failed to reach user frame. Stack: ${JSON.stringify(stackResponse, null, 2)}`);
      }

      const activeFrame = stackResponse.stackFrames.find(isUserFrame)!;
      expect(activeFrame.file?.replace(/\\/g, '/')).toContain('/examples/rust/hello_world/src/');
      expect(activeFrame.name?.toLowerCase()).toContain('main');
      if (typeof activeFrame.line === 'number') {
        expect(activeFrame.line).toBe(26);
      }

      const localsRaw = await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      });
      const localsResponse = parseSdkToolResult(localsRaw) as {
        success?: boolean;
        variables?: Array<{ name: string; value: string }>;
        count?: number;
      };

      expect(localsResponse.success).toBe(true);
      expect(Array.isArray(localsResponse.variables)).toBe(true);
      const localsByName = new Map(
        (localsResponse.variables ?? []).map(variable => [variable.name, variable.value])
      );
      const nameValue = localsByName.get('name');
      expect(nameValue).toBeDefined();
      const firstQuotedValue = nameValue?.match(/"([^"]*)"/)?.[1];
      expect(firstQuotedValue).toBe('Rust');
      const versionValue = localsByName.get('version');
      if (versionValue) {
        expect(versionValue).toContain('1.75');
      }

      // Debuggee output must be retrievable (issue #223): POSIX gets it via
      // CodeLLDB's own DAP output events, Windows via the proxy's adapter-stdio
      // forwarding. Both markers print before the line-26 breakpoint, so no
      // continue is needed (Windows re-hits the breakpoint on continue).
      const outputResult = await callToolSafely(mcpClient!, 'get_output', { sessionId });
      expect(outputResult.success).toBe(true);
      const outputEntries = outputResult.entries as Array<{ category: string; output: string }>;
      const helloEntry = outputEntries.find(e => e.output.includes('Hello, MCP Debugger!'));
      expect(helloEntry).toBeDefined();
      expect(helloEntry!.category).toBe('stdout');
      expect(outputEntries.some(e => e.output.includes('Sum of 5 and 10 is: 15'))).toBe(true);
    },
    60000
  );

  it(
    'steps through async await and inspects locals',
    async (ctx) => {
      const { sourcePath: asyncSourcePath, binaryPath: asyncBinaryPath } =
        await prepareRustExample('async_example');
      expect(existsSync(asyncSourcePath)).toBe(true);
      expect(existsSync(asyncBinaryPath)).toBe(true);

      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'rust', name: 'rust-async-smoke-test' }
      });
      const createResponse = parseSdkToolResult(createResult);
      expect(createResponse.success).toBe(true);
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;

      const breakpointResult = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: asyncSourcePath,
          line: 46
        }
      });
      const breakpointResponse = parseSdkToolResult(breakpointResult);
      expect(breakpointResponse.success).toBe(true);

      const startResult = await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: asyncBinaryPath,
          args: [],
          dapLaunchArgs: {
            stopOnEntry: true
          },
          adapterLaunchConfig: {
            sourceLanguages: ['rust']
          }
        }
      });
      const startResponse = parseSdkToolResult(startResult);
      if (!startResponse.success) {
        // Same environmental skip as the first test (e.g. SAC-blocked CodeLLDB).
        skipIfSpawnBlocked(ctx, startResponse, 'Rust');
      }
      expect(startResponse.success).toBe(true);

      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const fetchStackTrace = async () => {
        const stackRaw = await mcpClient!.callTool({
          name: 'get_stack_trace',
          arguments: {
            sessionId,
            includeInternals: false
          }
        });
        return parseSdkToolResult(stackRaw) as {
          success?: boolean;
          stackFrames?: Array<{ file?: string; name?: string; line?: number }>;
        };
      };

      const isAsyncUserFrame = (frame: { file?: string }) => {
        if (typeof frame.file !== 'string') return false;
        const normalized = frame.file.replace(/\\/g, '/');
        return normalized.includes('/examples/rust/async_example/src/');
      };

      await wait(500);
      let stackResponse = await fetchStackTrace();

      if (!stackResponse.stackFrames?.some(isAsyncUserFrame)) {
        const continueResult = parseSdkToolResult(
          await mcpClient!.callTool({
            name: 'continue_execution',
            arguments: { sessionId }
          })
        );
        expect(continueResult.success).toBe(true);

        for (let attempt = 0; attempt < 10; attempt++) {
          await wait(300);
          stackResponse = await fetchStackTrace();
          if (stackResponse.stackFrames?.some(isAsyncUserFrame)) {
            break;
          }
        }
      }

      if (!stackResponse.stackFrames?.some(isAsyncUserFrame)) {
        throw new Error(`Failed to reach async user frame. Stack: ${JSON.stringify(stackResponse, null, 2)}`);
      }

      const asyncFrame = stackResponse.stackFrames.find(isAsyncUserFrame)!;
      expect(asyncFrame.file?.replace(/\\/g, '/')).toContain('/examples/rust/async_example/src/');
      expect(asyncFrame.line).toBe(46);

      const localsRaw = await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      });
      const localsResponse = parseSdkToolResult(localsRaw) as {
        success?: boolean;
        variables?: Array<{ name: string; value: string }>;
        count?: number;
      };
      expect(localsResponse.success).toBe(true);
      const localsByName = new Map(
        (localsResponse.variables ?? []).map(variable => [variable.name, variable.value])
      );
      expect(localsByName.get('id')).toBe('1');
      const resultVariable = localsByName.get('result');
      if (resultVariable) {
        expect(resultVariable).toContain('Data_1');
      }

      const finalContinue = parseSdkToolResult(
        await mcpClient!.callTool({
          name: 'continue_execution',
          arguments: { sessionId }
        })
      );
      expect(finalContinue.success).toBe(true);
    },
    60000
  );

  // Issue #255 reproducer: on non-Windows a single continue from a breakpoint
  // must run the program to completion. On Windows CodeLLDB has been observed
  // re-stopping at the just-hit breakpoint on continue (MSVC/PDB confirmed;
  // GNU/DWARF repro status unknown), so the Windows leg probes: it accepts
  // either outcome, leaves a loud breadcrumb, and drives to completion with
  // the documented step_over workaround when the re-stop occurs. No product
  // workaround exists by design — a same-line re-stop inside a loop is
  // indistinguishable from a legitimate re-hit.
  it(
    'continues from a breakpoint to completion (issue #255 reproducer)',
    async (ctx) => {
      const { sourcePath, binaryPath } = await prepareRustExample('hello_world');

      const createResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'rust', name: 'rust-continue-reproducer' }
      }));
      expect(createResponse.success).toBe(true);
      sessionId = createResponse.sessionId as string;

      const breakpointResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: sourcePath, line: 26 }
      }));
      expect(breakpointResponse.success).toBe(true);

      const startResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: binaryPath,
          dapLaunchArgs: { stopOnEntry: false },
          adapterLaunchConfig: { sourceLanguages: ['rust'] }
        }
      }));
      skipIfSpawnBlocked(ctx, startResponse, 'Rust');
      expect(startResponse.success).toBe(true);

      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      async function getSession(): Promise<{ state?: string; exitCode?: number; lastStop?: { reason?: string } } | undefined> {
        const res = parseSdkToolResult(await mcpClient!.callTool({
          name: 'list_debug_sessions',
          arguments: {}
        }));
        const sessions = (res.sessions ?? []) as Array<{ id: string; state?: string; exitCode?: number; lastStop?: { reason?: string } }>;
        return sessions.find(s => s.id === sessionId);
      }

      async function topUserFrameLine(): Promise<number | undefined> {
        const stack = parseSdkToolResult(await mcpClient!.callTool({
          name: 'get_stack_trace',
          arguments: { sessionId }
        })) as { stackFrames?: Array<{ file?: string; line?: number }> };
        const frame = stack.stackFrames?.find(
          f => f.file?.replace(/\\/g, '/').includes('/examples/rust/hello_world/src/')
        );
        return frame?.line;
      }

      // Reach the breakpoint. The first stop may be a launch-time system stop
      // (platform-dependent); issue bounded continues until the user frame at
      // line 26 is live.
      let atBreakpoint = false;
      for (let attempt = 0; attempt < 10 && !atBreakpoint; attempt++) {
        const snap = await getSession();
        if (snap?.state === 'paused') {
          if ((await topUserFrameLine()) === 26) {
            atBreakpoint = true;
            break;
          }
          await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
        }
        await wait(500);
      }
      expect(atBreakpoint, 'session should pause at the line-26 breakpoint').toBe(true);

      if (process.platform !== 'win32') {
        // Strict reproducer: exactly one continue must reach completion.
        await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
        const stopped = await pollStopped(getSession, wait, 20000);
        expect(stopped, 'a single continue from the breakpoint should run to completion').toBeDefined();
        expect(stopped!.exitCode).toBe(0);
        return;
      }

      // Windows probe: one plain continue, then observe.
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      await wait(1500);
      let snap = await getSession();
      if (snap?.state !== 'paused') {
        const stopped = await pollStopped(getSession, wait, 20000);
        expect(stopped, 'continue should terminate when it does not re-stop').toBeDefined();
        expect(stopped!.exitCode).toBe(0);
        console.warn(
          '[issue #255] Plain continue advanced to completion on win32 — either upstream fixed the ' +
          're-stop or this build (GNU/DWARF) does not reproduce it. Consider tightening this test ' +
          'and removing the step_over workarounds.'
        );
        return;
      }

      const lineAfterContinue = await topUserFrameLine();
      console.warn(
        `[issue #255] Reproduced on win32: continue re-stopped at line ${lineAfterContinue} ` +
        '(breakpoint line 26). Driving to completion with the step_over workaround.'
      );
      // Documented workaround: step_over once, then continue (bounded).
      let completed = false;
      for (let i = 0; i < 10 && !completed; i++) {
        await callToolSafely(mcpClient!, 'step_over', { sessionId });
        await wait(500);
        await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
        const stopped = await pollStopped(getSession, wait, 5000);
        if (stopped) {
          expect(stopped.exitCode).toBe(0);
          completed = true;
        }
      }
      expect(completed, 'step_over + continue workaround should reach completion').toBe(true);
    },
    90000
  );
});

async function pollStopped(
  getSession: () => Promise<{ state?: string; exitCode?: number } | undefined>,
  wait: (ms: number) => Promise<unknown>,
  timeoutMs: number
): Promise<{ state?: string; exitCode?: number } | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snap = await getSession();
    if (snap?.state === 'stopped') return snap;
    await wait(300);
  }
  return undefined;
}
