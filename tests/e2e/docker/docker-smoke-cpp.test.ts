/**
 * Docker C/C++ Smoke Tests (issue #328)
 *
 * The image vendors linux-x64 CodeLLDB (shared via codelldb-common +
 * CODELLDB_PATH) and ships g++, so both the source-file auto-compile launch
 * path and prebuilt-ELF debugging work inside the container.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { buildDockerImage, createDockerMcpClient, getDockerLogs } from './docker-test-utils.js';
import { parseSdkToolResult } from '../smoke-test-utils.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const SKIP_DOCKER = process.env.SKIP_DOCKER_TESTS === 'true';

// examples/cpp/hello_world.cpp — int answer = compute_answer(count, 4);
const BP_LINE = 17;

describe.skipIf(SKIP_DOCKER)('Docker: C/C++ Debugging Smoke Tests', () => {
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
    console.log('[Docker CPP] Building Docker image...');
    await buildDockerImage({ imageName: 'mcp-debugger:test' });

    containerName = `mcp-debugger-cpp-test-${Date.now()}`;
    const result = await createDockerMcpClient({
      imageName: 'mcp-debugger:test',
      containerName,
      logLevel: 'debug'
    });
    mcpClient = result.client;
    cleanup = result.cleanup;
    console.log('[Docker CPP] MCP client connected');
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
      console.log('[Docker CPP] Container logs:');
      console.log(await getDockerLogs(containerName));
    }
    console.log('[Docker CPP] Cleanup completed');
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

  it('advertises cpp with launch and attach available', async () => {
    const result = await mcpClient!.callTool({
      name: 'list_supported_languages',
      arguments: {}
    });
    const response = parseSdkToolResult(result);

    expect(response.installed).toContain('cpp');

    const cpp = (response.available as any[]).find(a => a.language === 'cpp');
    expect(cpp).toBeDefined();
    expect(cpp.installed).toBe(true);
    expect(cpp.modes.launch.available).toBe(true);
    expect(cpp.modes.attach.available).toBe(true);
    console.log('[Docker CPP] ✓ cpp advertised:', JSON.stringify(cpp.modes));
  }, 60000);

  it('compiles a source file in-container and completes a breakpoint cycle', async () => {
    // Relative path — the container roots it at /workspace (the examples mount)
    const scriptPath = 'cpp/hello_world.cpp';

    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'cpp', name: 'docker-cpp-smoke' }
    });
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    expect(sessionId).toBeDefined();
    console.log('[Docker CPP] ✓ Session created');

    const bpResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: scriptPath, line: BP_LINE }
    });
    expect(parseSdkToolResult(bpResult).success).toBe(true);
    console.log('[Docker CPP] ✓ Breakpoint set');

    // forceRebuild guards against stale artifacts left in .debug-mcp/ by host runs
    const startResult = await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { forceRebuild: true }
      }
    });
    const startResponse = parseSdkToolResult(startResult);
    console.log('[Docker CPP] Start response:', JSON.stringify(startResponse).slice(0, 300));
    expect(startResponse.success).not.toBe(false);

    // Wait for the breakpoint pause
    let paused = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const sessions = parseSdkToolResult(await mcpClient!.callTool({
        name: 'list_debug_sessions',
        arguments: {}
      }));
      const session = ((sessions.sessions ?? []) as Array<{ id: string; state?: string }>)
        .find(s => s.id === sessionId);
      if (session?.state === 'paused') {
        paused = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    expect(paused, 'session should pause at the breakpoint').toBe(true);
    console.log('[Docker CPP] ✓ Paused at breakpoint');

    const stackResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'get_stack_trace',
      arguments: { sessionId }
    }));
    const frames = (stackResponse.stackFrames ?? []) as Array<{ name?: string; line?: number }>;
    expect(frames.length).toBeGreaterThan(0);
    const mainFrame = frames.find(f => (f.name ?? '').toLowerCase().includes('main'));
    expect(mainFrame).toBeDefined();
    expect(mainFrame!.line).toBe(BP_LINE);
    console.log('[Docker CPP] ✓ Stack trace shows main at the breakpoint line');

    const localsResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'get_local_variables',
      arguments: { sessionId }
    }));
    const locals = (localsResponse.variables ?? []) as Array<{ name: string; value: string }>;
    const count = locals.find(v => v.name === 'count');
    expect(count).toBeDefined();
    expect(count!.value).toContain('10');
    console.log('[Docker CPP] ✓ Locals inspected (count=10)');

    const continueResult = await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    });
    expect(parseSdkToolResult(continueResult).success).not.toBe(false);
    console.log('[Docker CPP] ✓ Continued to completion');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const closeResult = await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    expect(parseSdkToolResult(closeResult).success).toBe(true);
    sessionId = null;
    console.log('[Docker CPP] ✅ All checks passed');
  }, 180000);
});
