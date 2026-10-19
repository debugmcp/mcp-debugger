/**
 * .NET Adapter Smoke Tests via MCP Interface
 *
 * Tests core .NET/C# debugging functionality through MCP tools.
 * Requires: dotnet SDK, netcoredbg (set NETCOREDBG_PATH)
 *
 * Validates:
 * - Session creation for 'dotnet' language
 * - Breakpoint setting and verification
 * - Launch debugging of a .NET console app
 * - Stack trace inspection
 * - Variable inspection
 * - Step over
 * - Continue execution
 * - Clean session teardown
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { execSync } from 'child_process';
import { existsSync, statSync, utimesSync } from 'fs';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { skipIfSpawnBlocked } from '../test-utils/helpers/adapter-spawn.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

/**
 * Check if .NET SDK and netcoredbg are available
 */
function hasDotnetDebugSupport(): boolean {
  try {
    execSync('dotnet --version', { stdio: 'ignore', timeout: 5000 });
  } catch {
    return false;
  }

  // Check for netcoredbg via NETCOREDBG_PATH or in PATH
  if (process.env.NETCOREDBG_PATH && existsSync(process.env.NETCOREDBG_PATH)) {
    return true;
  }

  // Try to find netcoredbg in PATH
  try {
    execSync('netcoredbg --version', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const SKIP_DOTNET = !hasDotnetDebugSupport();

/**
 * Build the example .NET project if not already built
 */
function ensureDotnetBuild(): string {
  const projectDir = path.resolve(ROOT, 'examples', 'dotnet');

  // Find the built DLL (TFM may vary)
  const possibleTfms = ['net10.0', 'net9.0', 'net8.0', 'net7.0', 'net6.0'];
  for (const tfm of possibleTfms) {
    const dllPath = path.join(projectDir, 'bin', 'Debug', tfm, 'dotnet.dll');
    if (existsSync(dllPath)) return dllPath;
  }

  // Build it
  console.log('[.NET Smoke Test] Building example .NET project...');
  execSync('dotnet build -c Debug', { cwd: projectDir, stdio: 'inherit', timeout: 60000 });

  // Find the built DLL
  for (const tfm of possibleTfms) {
    const dllPath = path.join(projectDir, 'bin', 'Debug', tfm, 'dotnet.dll');
    if (existsSync(dllPath)) return dllPath;
  }

  throw new Error('Failed to find built dotnet.dll');
}

describe.skipIf(SKIP_DOTNET)('.NET Adapter Smoke Test', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    console.log('[.NET Smoke Test] Starting MCP server...');

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client({
      name: 'dotnet-smoke-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[.NET Smoke Test] MCP client connected');
  }, 30000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
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

    console.log('[.NET Smoke Test] Cleanup completed');
  });

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      } catch {
        // Session may already be closed
      }
      sessionId = null;
    }
  });

  it('should list dotnet as a supported language', async () => {
    const result = await mcpClient!.callTool({
      name: 'list_supported_languages',
      arguments: {}
    });

    const response = parseSdkToolResult(result);
    expect(response.success).toBe(true);
    expect(response.languages).toBeDefined();

    const languages = response.languages as any[];
    const dotnetLang = languages.find(l => l.id === 'dotnet');
    expect(dotnetLang).toBeDefined();
    console.log('[.NET Smoke Test] dotnet language is available');
  });

  it('warns on set_breakpoint once the launch has named the DLL, and notes on the launch answer, the stop and the stack, when dotnet.dll is older than Program.cs (issues #950, #951)', async (ctx) => {
    const dllPath = ensureDotnetBuild();
    const sourceFile = path.resolve(ROOT, 'examples', 'dotnet', 'Program.cs');
    const stamp = statSync(dllPath);
    // The DLL is aged an hour behind its source BEFORE netcoredbg loads it
    // (Windows refuses utimes on an open handle) and restored below.
    const past = new Date(statSync(sourceFile).mtimeMs - 3_600_000);
    utimesSync(dllPath, past, past);
    try {
      const createResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'dotnet', name: 'dotnet-950-stale-dll' }
      }));
      sessionId = createResponse.sessionId as string;

      // Before the launch nothing names the DLL: the echo stands alone.
      const before = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: sourceFile, line: 14 }
      }));
      expect(before.success).toBe(true);
      expect(String(before.warning ?? ''), JSON.stringify(before)).not.toMatch(/may be stale/);

      const startResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: { sessionId, scriptPath: dllPath, dapLaunchArgs: { stopOnEntry: false, justMyCode: true } }
      }));
      if (!startResponse.success) {
        skipIfSpawnBlocked(ctx, startResponse, '.NET');
        throw new Error(`start_debugging failed: ${JSON.stringify(startResponse, null, 2)}`);
      }

      // A fast program is paused at the breakpoint when the launch answers,
      // and that answer says where and carries the note (issue #951) — the
      // call a caller reads before any wait_for_stop. A machine slow enough to
      // outlast the hold answers pending instead; the wait then carries both.
      const launchStop = startResponse.state === 'paused'
        ? startResponse
        : parseSdkToolResult(await mcpClient!.callTool({
          name: 'wait_for_stop',
          arguments: { sessionId, timeout: 20000 }
        }));
      expect(launchStop.state, JSON.stringify(launchStop)).toBe('paused');
      expect((launchStop.location as { line?: number } | undefined)?.line, JSON.stringify(launchStop)).toBe(14);
      expect(String(launchStop.note ?? ''), JSON.stringify(launchStop)).toMatch(/may be stale/);
      expect(launchStop.note).toContain(dllPath);

      // The launch named the DLL: a breakpoint set now carries the warning, naming both files.
      const after = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: sourceFile, line: 15 }
      }));
      expect(after.success).toBe(true);
      expect(String(after.warning ?? ''), JSON.stringify(after)).toMatch(/may be stale/);
      expect(after.warning).toContain(dllPath);
      expect(after.warning).toContain(sourceFile);

      // And the stop at the breakpoint says so too.
      const stop = parseSdkToolResult(await mcpClient!.callTool({
        name: 'wait_for_stop',
        arguments: { sessionId, timeout: 20000 }
      }));
      expect(stop.state, JSON.stringify(stop)).toBe('paused');
      expect(String(stop.note ?? ''), JSON.stringify(stop)).toMatch(/may be stale/);

      // And get_stack_trace, the other carrier (issue #951).
      const stack = parseSdkToolResult(await mcpClient!.callTool({
        name: 'get_stack_trace',
        arguments: { sessionId }
      }));
      expect(String(stack.note ?? ''), JSON.stringify(stack)).toMatch(/may be stale/);
      expect(stack.note).toContain(dllPath);
    } finally {
      utimesSync(dllPath, stamp.atime, stamp.mtime);
    }
  }, 90000);

  it('should complete .NET debugging flow', async (ctx) => {
    const dllPath = ensureDotnetBuild();
    const sourceFile = path.resolve(ROOT, 'examples', 'dotnet', 'Program.cs');

    // 1. Create debug session
    console.log('[.NET Smoke Test] Creating debug session...');
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'dotnet',
        name: 'dotnet-smoke-test'
      }
    });

    const createResponse = parseSdkToolResult(createResult);
    expect(createResponse.sessionId).toBeDefined();
    sessionId = createResponse.sessionId as string;
    console.log(`[.NET Smoke Test] Session created: ${sessionId}`);

    // 2. Set breakpoint at line 14 (int x = 10;)
    console.log('[.NET Smoke Test] Setting breakpoint at line 14...');
    const bpResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId,
        file: sourceFile,
        line: 14
      }
    });

    const bpResponse = parseSdkToolResult(bpResult);
    console.log('[.NET Smoke Test] Breakpoint response:', bpResponse);
    expect(bpResponse.success).toBe(true);

    // 3. Start debugging
    console.log('[.NET Smoke Test] Starting debugging...');
    const startResult = await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath: dllPath,
        args: [],
        dapLaunchArgs: {
          stopOnEntry: false,
          justMyCode: true
        }
      }
    });

    const startResponse = parseSdkToolResult(startResult);
    if (!startResponse.success) {
      // Skip (don't hard-fail) if netcoredbg couldn't be spawned.
      skipIfSpawnBlocked(ctx, startResponse, '.NET');
    }
    expect(startResponse.state).toBeDefined();
    console.log('[.NET Smoke Test] Debug started, state:', startResponse.state);

    // Wait for breakpoint hit
    await new Promise(resolve => setTimeout(resolve, 8000));

    // 4. Get stack trace
    console.log('[.NET Smoke Test] Getting stack trace...');
    const stackResult = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId });

    if (stackResult.stackFrames) {
      const frames = stackResult.stackFrames as any[];
      console.log(`[.NET Smoke Test] Stack has ${frames.length} frames`);
      expect(frames.length).toBeGreaterThan(0);

      const topFrame = frames[0];
      if (topFrame) {
        console.log(`[.NET Smoke Test] Stopped at ${topFrame.source?.name}:${topFrame.line}`);
      }
    }

    // 5. Get variables
    if (stackResult.stackFrames && (stackResult.stackFrames as any[]).length > 0) {
      const frameId = (stackResult.stackFrames as any[])[0].id;

      console.log('[.NET Smoke Test] Getting scopes...');
      const scopesResult = await callToolSafely(mcpClient!, 'get_scopes', {
        sessionId,
        frameId
      });

      if (scopesResult.scopes && (scopesResult.scopes as any[]).length > 0) {
        const scopes = scopesResult.scopes as any[];
        console.log(`[.NET Smoke Test] Found ${scopes.length} scopes`);

        const localsScope = scopes.find((s: any) => s.name === 'Locals') || scopes[0];

        console.log('[.NET Smoke Test] Getting variables...');
        const varsResult = await callToolSafely(mcpClient!, 'get_variables', {
          sessionId,
          scope: localsScope.variablesReference
        });

        if (varsResult.variables) {
          const vars = varsResult.variables as any[];
          console.log(`[.NET Smoke Test] Found ${vars.length} variables`);
          const varNames = vars.map((v: any) => v.name);
          console.log('[.NET Smoke Test] Variable names:', varNames);

          // At line 14 (int x = 10;), x is not yet assigned so x=0
          const varX = vars.find(v => v.name === 'x');
          if (varX) {
            console.log(`[.NET Smoke Test] x = ${varX.value}`);
            expect(varX.value).toBe('0');
          }
        }
      }
    }

    // 6. Step over
    console.log('[.NET Smoke Test] Stepping over...');
    const stepResult = await callToolSafely(mcpClient!, 'step_over', { sessionId });
    console.log('[.NET Smoke Test] Step result:', stepResult);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // 7. Continue execution
    console.log('[.NET Smoke Test] Continuing execution...');
    const continueResult = await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    console.log('[.NET Smoke Test] Continue result:', continueResult);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // 8. Close session
    console.log('[.NET Smoke Test] Closing session...');
    const closeResult = await callToolSafely(mcpClient!, 'close_debug_session', { sessionId });
    expect(closeResult.success).toBe(true);
    sessionId = null;

    console.log('[.NET Smoke Test] All checks passed');
  }, 60000);

  it('labels a function-breakpoint stop "function breakpoint" (#302)', async (ctx) => {
    const dllPath = ensureDotnetBuild();

    const createResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'dotnet', name: 'dotnet-fnbp' }
    }));
    sessionId = createResponse.sessionId as string;

    const bpResponse = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId,
      function: 'Main'
    });
    expect(bpResponse.success).toBe(true);

    const startResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath: dllPath,
        args: [],
        dapLaunchArgs: { stopOnEntry: false, justMyCode: true }
      }
    }));
    if (!startResponse.success) {
      skipIfSpawnBlocked(ctx, startResponse, '.NET');
    }

    // netcoredbg omits hitBreakpointIds; the policy's count fallback labels
    // the fn-bp-only stop. Poll for the pause.
    const deadline = Date.now() + 30000;
    let snap: { state?: string; lastStop?: { reason?: string; rawReason?: string } } | undefined;
    while (Date.now() < deadline) {
      const res = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
      snap = ((res.sessions ?? []) as Array<{ id: string; state?: string; lastStop?: { reason?: string; rawReason?: string } }>)
        .find(s => s.id === sessionId);
      if (snap?.state === 'paused') break;
      await new Promise(r => setTimeout(r, 500));
    }
    expect(snap?.state, 'session should pause at the function breakpoint').toBe('paused');
    expect(snap!.lastStop?.reason).toBe('function breakpoint');
    expect(snap!.lastStop?.rawReason).toBe('breakpoint');

    const stackResult = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId });
    expect(stackResult.stopReason).toBe('function breakpoint');
    const top = (stackResult.stackFrames as Array<{ name?: string }> | undefined)?.[0];
    expect(top?.name).toContain('Main');

    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
  }, 90000);
});
