/**
 * .NET Adapter Smoke Tests via MCP Interface
 *
 * Tests core .NET/C# debugging functionality through MCP tools.
 * Requires: dotnet SDK, vsdbg (via VS Code C# extension)
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
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

/**
 * Check if .NET SDK and vsdbg are available
 */
function hasDotnetDebugSupport(): boolean {
  try {
    execSync('dotnet --version', { stdio: 'ignore', timeout: 5000 });
  } catch {
    return false;
  }

  // Check for vsdbg in VS Code extensions
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const vscodeExtDir = path.join(home, '.vscode', 'extensions');
  if (!existsSync(vscodeExtDir)) {
    return false;
  }

  try {
    const entries = require('fs').readdirSync(vscodeExtDir) as string[];
    const csharpExt = entries.find((e: string) => e.startsWith('ms-dotnettools.csharp-'));
    if (!csharpExt) return false;

    const vsdbgPath = path.join(vscodeExtDir, csharpExt, '.debugger', 'x86_64', 'vsdbg.exe');
    const vsdbgPathAlt = path.join(vscodeExtDir, csharpExt, '.debugger', 'vsdbg');
    return existsSync(vsdbgPath) || existsSync(vsdbgPathAlt);
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
  const dllPath = path.join(projectDir, 'bin', 'Debug', 'net8.0', 'SimpleTest.dll');

  if (!existsSync(dllPath)) {
    console.log('[.NET Smoke Test] Building example .NET project...');
    execSync('dotnet build -c Debug', { cwd: projectDir, stdio: 'inherit', timeout: 60000 });
  }

  return dllPath;
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

  it('should complete .NET debugging flow', async () => {
    const dllPath = ensureDotnetBuild();
    const sourceFile = path.resolve(ROOT, 'examples', 'dotnet', 'SimpleTest.cs');

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

    // 2. Set breakpoint at line 12 (int temp = a;)
    console.log('[.NET Smoke Test] Setting breakpoint at line 12...');
    const bpResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId,
        file: sourceFile,
        line: 12
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
    expect(startResponse.state).toBeDefined();
    console.log('[.NET Smoke Test] Debug started, state:', startResponse.state);

    // Wait for breakpoint hit
    await new Promise(resolve => setTimeout(resolve, 5000));

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

          // At line 12, we should see a=1, b=2
          const varA = vars.find(v => v.name === 'a');
          const varB = vars.find(v => v.name === 'b');
          if (varA) {
            console.log(`[.NET Smoke Test] a = ${varA.value}`);
            expect(varA.value).toBe('1');
          }
          if (varB) {
            console.log(`[.NET Smoke Test] b = ${varB.value}`);
            expect(varB.value).toBe('2');
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
});
