/**
 * Docker C/C++ Attach-by-PID Smoke Test (issues #328/#332)
 *
 * Validates the ephemeral-sidecar mechanism without Kubernetes: a long-running
 * native process inside the container is attached by PID with container
 * CodeLLDB. The container runs with --cap-add=SYS_PTRACE — same-user ptrace of
 * a non-descendant process is otherwise blocked wherever the host kernel sets
 * kernel.yama.ptrace_scope >= 1 (k8s debug profiles grant the equivalent).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { buildDockerImage, createDockerMcpClient, getDockerLogs } from './docker-test-utils.js';
import { parseSdkToolResult } from '../smoke-test-utils.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const execAsync = promisify(exec);

const SKIP_DOCKER = process.env.SKIP_DOCKER_TESTS === 'true';

// Compiled inside the container image fs (not a volume mount) so it executes
// regardless of the host's mount semantics; /app/logs is chmod 777.
const TARGET_BINARY = '/app/logs/pause_test';

describe.skipIf(SKIP_DOCKER)('Docker: C/C++ attach-by-PID', () => {
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
    console.log('[Docker CPP Attach] Building Docker image...');
    await buildDockerImage({ imageName: 'mcp-debugger:test' });

    containerName = `mcp-debugger-cpp-attach-${Date.now()}`;
    const result = await createDockerMcpClient({
      imageName: 'mcp-debugger:test',
      containerName,
      logLevel: 'debug',
      extraRunArgs: ['--cap-add=SYS_PTRACE']
    });
    mcpClient = result.client;
    cleanup = result.cleanup;
    console.log('[Docker CPP Attach] MCP client connected');
  }, 300000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try {
        await mcpClient.callTool({ name: 'close_debug_session', arguments: { sessionId } });
      } catch {
        // Session may already be closed
      }
    }
    if (containerName) {
      try {
        await execAsync(`docker exec ${containerName} pkill -f ${TARGET_BINARY}`);
      } catch {
        // Target may not be running
      }
    }
    if (cleanup) {
      await cleanup();
    }
    if (containerName && anyFailed) {
      console.log('[Docker CPP Attach] Container logs:');
      console.log(await getDockerLogs(containerName));
    }
    console.log('[Docker CPP Attach] Cleanup completed');
  });

  it('attaches to a running native process by PID inside the container', async () => {
    // Step 1: Compile the loop fixture inside the container with in-image g++
    console.log('[Docker CPP Attach] Compiling pause_test in-container...');
    await execAsync(
      `docker exec ${containerName} g++ -gdwarf-4 -O0 -o ${TARGET_BINARY} /workspace/cpp/pause_test.cpp`,
      { maxBuffer: 16 * 1024 * 1024 }
    );

    // Step 2: Start it detached and discover its in-container PID
    await execAsync(`docker exec -d ${containerName} ${TARGET_BINARY}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const { stdout: pidOut } = await execAsync(
      `docker exec ${containerName} pgrep -f ${TARGET_BINARY}`
    );
    const pid = parseInt(pidOut.trim().split(/\s+/)[0], 10);
    expect(Number.isFinite(pid)).toBe(true);
    console.log(`[Docker CPP Attach] Target running with PID ${pid}`);

    // Step 3: Create cpp session and attach by PID
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'cpp', name: 'docker-cpp-attach' }
    });
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    expect(sessionId).toBeDefined();

    const attachResult = await mcpClient!.callTool({
      name: 'attach_to_process',
      arguments: { sessionId, processId: pid, stopOnEntry: true }
    });
    const attachResponse = parseSdkToolResult(attachResult);
    console.log('[Docker CPP Attach] Attach response:', JSON.stringify(attachResponse).slice(0, 300));
    expect(attachResponse.success).not.toBe(false);
    console.log('[Docker CPP Attach] ✓ Attached by PID');

    // Step 4: stopOnEntry should hold the target paused; inspect it
    let paused = false;
    for (let attempt = 0; attempt < 20; attempt++) {
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
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    expect(paused, 'attached session should be paused (stopOnEntry)').toBe(true);

    const threadsResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'list_threads',
      arguments: { sessionId }
    }));
    expect(((threadsResponse.threads ?? []) as unknown[]).length).toBeGreaterThan(0);

    const stackResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'get_stack_trace',
      arguments: { sessionId }
    }));
    expect(((stackResponse.stackFrames ?? []) as unknown[]).length).toBeGreaterThan(0);
    console.log('[Docker CPP Attach] ✓ Threads and stack inspected while paused');

    // Step 5: Resume, then close the session
    const continueResult = await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    });
    expect(parseSdkToolResult(continueResult).success).not.toBe(false);

    const closeResult = await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    expect(parseSdkToolResult(closeResult).success).toBe(true);
    sessionId = null;
    console.log('[Docker CPP Attach] ✅ All checks passed');
  }, 180000);
});
