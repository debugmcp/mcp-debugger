/**
 * .NET attach-by-PID smoke test (issue #353)
 *
 * Regression coverage for the attach sequencing bug: netcoredbg does not
 * suspend the target on attach, so without the policy's post-attach pause the
 * session reported PAUSED while the debuggee kept running — get_stack_trace
 * failed with 0x80131302 (process not synchronized), and pause_execution
 * short-circuited with "Already paused".
 *
 * Launches the pause_test loop with `dotnet`, attaches by PID, requires an
 * immediately-working stack trace, then binds a breakpoint, continues into
 * it, and evaluates a local. Self-skips without dotnet SDK + netcoredbg.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { execSync, spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

function hasDotnetDebugSupport(): boolean {
  try {
    execSync('dotnet --version', { stdio: 'ignore', timeout: 5000 });
  } catch {
    return false;
  }
  if (process.env.NETCOREDBG_PATH && existsSync(process.env.NETCOREDBG_PATH)) {
    return true;
  }
  try {
    execSync('netcoredbg --version', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const SKIP_DOTNET = !hasDotnetDebugSupport();

/** Build examples/dotnet/pause_test if needed; returns the DLL path. */
function ensurePauseTestBuild(): string {
  const projectDir = path.resolve(ROOT, 'examples', 'dotnet', 'pause_test');
  const possibleTfms = ['net10.0', 'net9.0', 'net8.0', 'net7.0', 'net6.0'];

  const findDll = (): string | null => {
    for (const tfm of possibleTfms) {
      const dllPath = path.join(projectDir, 'bin', 'Debug', tfm, 'pause_test.dll');
      if (existsSync(dllPath)) return dllPath;
    }
    return null;
  };

  let dll = findDll();
  if (!dll) {
    console.log('[.NET Attach Smoke Test] Building pause_test project...');
    execSync('dotnet build -c Debug', { cwd: projectDir, stdio: 'inherit', timeout: 120000 });
    dll = findDll();
  }
  if (!dll) {
    throw new Error(`pause_test.dll not found under ${projectDir}/bin/Debug after build`);
  }
  return dll;
}

describe.skipIf(SKIP_DOTNET)('MCP Server .NET Attach Smoke Test @requires-dotnet', () => {
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

    mcpClient = new Client(
      { name: 'dotnet-attach-test-client', version: '1.0.0' },
      { capabilities: {} }
    );

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

  async function waitForPaused(): Promise<boolean> {
    for (let attempt = 0; attempt < 25; attempt++) {
      const sessions = parseSdkToolResult(await mcpClient!.callTool({
        name: 'list_debug_sessions',
        arguments: {}
      }));
      const session = ((sessions.sessions ?? []) as Array<{ id: string; state?: string }>)
        .find(s => s.id === sessionId);
      if (session?.state === 'paused') return true;
      await wait(400);
    }
    return false;
  }

  it(
    'attaches to a running pause_test by PID with an immediately usable stack (issue #353)',
    async () => {
      const dllPath = ensurePauseTestBuild();
      const sourcePath = path.resolve(ROOT, 'examples', 'dotnet', 'pause_test', 'PauseTest.cs');

      debuggee = spawn('dotnet', [dllPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });
      const pid = debuggee.pid;
      expect(pid).toBeDefined();

      // Give the runtime a moment to start the loop
      await wait(1500);
      expect(debuggee.exitCode).toBeNull();

      const createResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'dotnet', name: 'dotnet-attach-test' }
      }));
      expect(createResponse.success).toBe(true);
      sessionId = createResponse.sessionId as string;

      const attachResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'attach_to_process',
        arguments: { sessionId, processId: pid }
      }));
      if (!attachResponse.success) {
        throw new Error(`attach_to_process failed: ${JSON.stringify(attachResponse, null, 2)}`);
      }

      expect(await waitForPaused(), 'attached session should be paused').toBe(true);

      // The #353 regression: stackTrace must work immediately after attach.
      // Before the fix netcoredbg was still running and answered with
      // "Failed command 'stackTrace' : 0x80131302".
      const stackResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'get_stack_trace',
        arguments: { sessionId }
      })) as { success?: boolean; stackFrames?: Array<{ name?: string; file?: string }> };
      expect(stackResponse.success).toBe(true);
      expect((stackResponse.stackFrames ?? []).length).toBeGreaterThan(0);

      // Breakpoints must bind against the attached process ("No symbols have
      // been loaded" was the second #353 symptom).
      const bpResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: sourcePath, line: 10 }
      })) as { success?: boolean; verified?: boolean };
      expect(bpResponse.success).toBe(true);
      expect(bpResponse.verified).toBe(true);

      // Continue into the breakpoint and inspect a local.
      const continueResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      }));
      expect(continueResponse.success).toBe(true);

      expect(await waitForPaused(), 'should stop at the breakpoint after continue').toBe(true);

      const evalResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'evaluate_expression',
        arguments: { sessionId, expression: 'counter' }
      })) as { success?: boolean; result?: string };
      expect(evalResponse.success).toBe(true);
      expect(Number(evalResponse.result)).toBeGreaterThan(0);

      const closeResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'close_debug_session',
        arguments: { sessionId }
      }));
      expect(closeResponse.success).toBe(true);
      sessionId = null;

      debuggee.kill('SIGKILL');
    },
    120000
  );
});
