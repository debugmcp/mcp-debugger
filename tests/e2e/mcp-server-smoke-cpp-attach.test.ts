/**
 * C/C++ attach-by-PID smoke test (issue #325)
 *
 * Launches the pause_test binary directly, attaches by PID via CodeLLDB,
 * inspects threads/stack, detaches (target must survive), then kills it.
 * Self-skips without a compiler; on Linux, also self-skips when
 * kernel.yama.ptrace_scope blocks attaching to non-child processes... except
 * the debuggee IS spawned by this process's test runner, so ptrace_scope=1
 * (children allowed) still works — only scope>=2 blocks it.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { spawn, type ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { skipIfSpawnBlocked } from '../test-utils/helpers/adapter-spawn.js';
import { prepareCppExample, hasCppToolchain } from './cpp-example-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const SKIP_CPP = !hasCppToolchain();

describe.skipIf(SKIP_CPP)('MCP Server C/C++ Attach Smoke Test @requires-cpp', () => {
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
      { name: 'cpp-attach-test-client', version: '1.0.0' },
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

  it(
    'attaches to a running pause_test by PID, inspects, detaches leaving it alive',
    async (ctx) => {
      const { binaryPath } = prepareCppExample('pause_test');
      expect(existsSync(binaryPath)).toBe(true);

      debuggee = spawn(binaryPath, [], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });
      const pid = debuggee.pid;
      expect(pid).toBeDefined();

      // Give the loop a moment to start
      await wait(700);
      expect(debuggee.exitCode).toBeNull();

      const createResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'cpp', name: 'cpp-attach-test' }
      }));
      expect(createResponse.success).toBe(true);
      sessionId = createResponse.sessionId as string;

      const attachResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'attach_to_process',
        arguments: {
          sessionId,
          processId: pid,
          stopOnEntry: true,
          // Exercises the #336 adapterConfig passthrough end-to-end: program
          // is CodeLLDB's explicit-binary hint for symbol resolution (harmless
          // here, load-bearing when /proc/<pid>/maps paths are not openable).
          adapterConfig: { program: binaryPath }
        }
      }));
      if (!attachResponse.success) {
        // Environmental: CodeLLDB spawn blocked, or ptrace restrictions
        skipIfSpawnBlocked(ctx, attachResponse, 'C/C++');
        const message = String(attachResponse.message ?? attachResponse.error ?? '').toLowerCase();
        if (message.includes('ptrace') || message.includes('operation not permitted')) {
          ctx.skip();
        }
        throw new Error(`attach_to_process failed: ${JSON.stringify(attachResponse, null, 2)}`);
      }

      // Wait for the paused state (stopOnEntry holds the target after attach)
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
        await wait(400);
      }
      expect(paused, 'attached session should be paused (stopOnEntry)').toBe(true);

      const threadsResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'list_threads',
        arguments: { sessionId }
      })) as { success?: boolean; threads?: Array<{ id: number; name?: string }> };
      expect(threadsResponse.success).toBe(true);
      expect((threadsResponse.threads ?? []).length).toBeGreaterThan(0);

      const stackResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'get_stack_trace',
        arguments: { sessionId }
      })) as { success?: boolean; stackFrames?: Array<{ name?: string }> };
      expect(stackResponse.success).toBe(true);
      expect((stackResponse.stackFrames ?? []).length).toBeGreaterThan(0);

      const detachResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'detach_from_process',
        arguments: { sessionId }
      }));
      expect(detachResponse.success).toBe(true);
      sessionId = null;

      // The target must survive the detach
      await wait(700);
      expect(debuggee.exitCode).toBeNull();

      debuggee.kill('SIGKILL');
    },
    90000
  );
});
