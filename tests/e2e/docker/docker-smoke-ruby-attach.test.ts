/**
 * Docker Ruby Attach-Only Smoke Tests (issue #331)
 *
 * The container image ships @debugmcp/adapter-ruby without a Ruby runtime:
 * launch must report unavailable, while attach (a direct TCP connection to a
 * remote rdbg DAP socket) must work. The rdbg target runs in a sibling
 * container on a shared docker network, mirroring the remote-attach docs flow.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildDockerImage, createDockerMcpClient, getDockerLogs } from './docker-test-utils.js';
import { parseSdkToolResult } from '../smoke-test-utils.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');

const SKIP_DOCKER = process.env.SKIP_DOCKER_TESTS === 'true';

// Same image the remote-attach example pins; debug gem (rdbg) is bundled with Ruby >= 3.1
const RUBY_IMAGE = 'ruby:4.0-slim';
const RDBG_PORT = 12345;

describe.skipIf(SKIP_DOCKER)('Docker: Ruby attach-only debugging', () => {
  const stamp = Date.now();
  const networkName = `mcp-ruby-attach-net-${stamp}`;
  const targetName = `rdbg-target-${stamp}`;
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
    console.log('[Docker Ruby Attach] Building Docker image...');
    await buildDockerImage({ imageName: 'mcp-debugger:test' });

    console.log(`[Docker Ruby Attach] Creating network ${networkName}...`);
    await execAsync(`docker network create ${networkName}`);

    console.log('[Docker Ruby Attach] Starting rdbg target container...');
    const fixtureDir = path.resolve(ROOT, 'examples', 'ruby', 'remote-attach');
    await execAsync(
      `docker run -d --rm --network ${networkName} --name ${targetName} ` +
      `-v "${fixtureDir}:/workspace/ruby/remote-attach:ro" ` +
      `-w /workspace/ruby/remote-attach ${RUBY_IMAGE} ` +
      `rdbg --open --host 0.0.0.0 --port ${RDBG_PORT} --nonstop app.rb`,
      { maxBuffer: 16 * 1024 * 1024 }
    );

    // Wait until rdbg is listening (it logs the DEBUGGER banner on startup)
    const deadline = Date.now() + 60_000;
    let ready = false;
    while (Date.now() < deadline) {
      const logs = await getDockerLogs(targetName);
      if (/DEBUGGER/i.test(logs) || /processed order/.test(logs)) {
        ready = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) {
      throw new Error('rdbg target container did not become ready within 60s');
    }
    console.log('[Docker Ruby Attach] rdbg target is listening');

    containerName = `mcp-debugger-ruby-attach-${stamp}`;
    const result = await createDockerMcpClient({
      imageName: 'mcp-debugger:test',
      containerName,
      logLevel: 'debug',
      // createDockerMcpClient already mounts examples/ at /workspace; the
      // target uses the matching /workspace/ruby/remote-attach path above.
      extraRunArgs: ['--network', networkName]
    });
    mcpClient = result.client;
    cleanup = result.cleanup;
    console.log('[Docker Ruby Attach] MCP client connected');
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
      console.log('[Docker Ruby Attach] Container logs:');
      console.log(await getDockerLogs(containerName));
    }

    try {
      await execAsync(`docker rm -f ${targetName}`);
    } catch {
      // Already gone (--rm)
    }
    try {
      await execAsync(`docker network rm ${networkName}`);
    } catch {
      // Network may already be removed
    }
    console.log('[Docker Ruby Attach] Cleanup completed');
  }, 120000);

  it('reports ruby as attach-only in list_supported_languages', async () => {
    const result = await mcpClient!.callTool({
      name: 'list_supported_languages',
      arguments: {}
    });
    const response = parseSdkToolResult(result);

    expect(response.installed).toContain('ruby');

    const ruby = (response.available as any[]).find(a => a.language === 'ruby');
    expect(ruby).toBeDefined();
    expect(ruby.installed).toBe(true);
    expect(ruby.modes.attach).toEqual({ supported: true, available: true });
    expect(ruby.modes.launch.supported).toBe(true);
    expect(ruby.modes.launch.available).toBe(false);
    expect(String(ruby.modes.launch.reason)).toMatch(/ruby/i);

    console.log('[Docker Ruby Attach] ✓ per-mode availability reported:', JSON.stringify(ruby.modes));
  }, 60000);

  it('binds a target-side breakpoint, inspects locals, and detaches', async () => {
    // Step 1: Create ruby session (must succeed despite no local Ruby)
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'ruby', name: 'docker-ruby-attach' }
    });
    const createResponse = parseSdkToolResult(createResult);
    expect(createResponse.sessionId).toBeDefined();
    sessionId = createResponse.sessionId as string;
    console.log('[Docker Ruby Attach] ✓ Session created');

    // Step 2: Queue a breakpoint using the path shared by the MCP client and
    // target containers. It is synchronized during the attach handshake.
    const targetSourcePath = '/workspace/ruby/remote-attach/app.rb';
    const breakpointLine = 18;
    const breakpointResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: targetSourcePath, line: breakpointLine }
    });
    expect(parseSdkToolResult(breakpointResult).success).toBe(true);

    // Step 3: Attach across the docker network by container DNS name. The
    // explicit override is the regression: before #499 it was silently
    // replaced with false because the host is not loopback.
    const attachResult = await mcpClient!.callTool({
      name: 'attach_to_process',
      arguments: {
        sessionId,
        host: targetName,
        port: RDBG_PORT,
        adapterConfig: { localfs: true }
      }
    });
    const attachResponse = parseSdkToolResult(attachResult);
    console.log('[Docker Ruby Attach] Attach response:', JSON.stringify(attachResponse));
    expect(attachResponse.success).not.toBe(false);
    console.log('[Docker Ruby Attach] ✓ Attached');

    // Step 4: Release rdbg's attach stop and wait for the mapped breakpoint.
    const continueResult = await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    });
    expect(parseSdkToolResult(continueResult).success).not.toBe(false);

    let breakpointFrame: { file?: string; line?: number } | undefined;
    for (let attempt = 0; attempt < 40; attempt++) {
      const stackResult = await mcpClient!.callTool({
        name: 'get_stack_trace',
        arguments: { sessionId }
      });
      const stackResponse = parseSdkToolResult(stackResult);
      const frames = Array.isArray(stackResponse.stackFrames)
        ? stackResponse.stackFrames as Array<{ file?: string; line?: number }>
        : [];
      breakpointFrame = frames.find(frame => frame.line === breakpointLine);
      if (breakpointFrame) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    expect(breakpointFrame).toMatchObject({ file: targetSourcePath, line: breakpointLine });

    const localsResult = await mcpClient!.callTool({
      name: 'get_local_variables',
      arguments: { sessionId }
    });
    const localsResponse = parseSdkToolResult(localsResult) as {
      variables?: Array<{ name: string; value: string }>;
    };
    expect(localsResponse.success).not.toBe(false);
    expect(localsResponse.variables?.find(variable => variable.name === 'tick')).toBeDefined();
    expect(localsResponse.variables?.find(variable => variable.name === 'revenue')).toBeDefined();
    console.log('[Docker Ruby Attach] ✓ Target-side breakpoint hit and locals retrieved');

    // Step 5: Detach without terminating the target

    const detachResult = await mcpClient!.callTool({
      name: 'detach_from_process',
      arguments: { sessionId, terminateProcess: false }
    });
    const detachResponse = parseSdkToolResult(detachResult);
    console.log('[Docker Ruby Attach] Detach response:', JSON.stringify(detachResponse));
    expect(detachResponse.success).not.toBe(false);
    console.log('[Docker Ruby Attach] ✓ Detached');

    // Step 6: The target must still be alive after detach
    await new Promise(resolve => setTimeout(resolve, 2000));
    const { stdout } = await execAsync(
      `docker ps --filter name=${targetName} --format "{{.Names}}"`
    );
    expect(stdout).toContain(targetName);
    console.log('[Docker Ruby Attach] ✓ Target still running after detach');

    // Step 7: Close the session
    const closeResult = await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    expect(parseSdkToolResult(closeResult).success).toBe(true);
    sessionId = null;
    console.log('[Docker Ruby Attach] ✅ All checks passed');
  }, 120000);
});
