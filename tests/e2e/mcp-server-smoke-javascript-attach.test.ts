/**
 * JavaScript Attach-Mode Smoke Test via MCP Interface (issue #124)
 *
 * Invariant under test: attach_to_process must not lie.
 *
 * Attach to a real `node --inspect=<port>` process and require that EITHER:
 *   (a) attach reports success AND the session is actually debuggable
 *       (list_threads returns at least one thread, get_stack_trace returns
 *       at least one frame), OR
 *   (b) attach reports a truthful failure (success:false with a real error).
 *
 * What must never happen is the behavior from issue #124: attach returns
 * success + "paused" while the js-debug child session never connected to the
 * inspector port, list_threads answers an empty-but-successful list and
 * get_stack_trace answers an empty-but-successful stack.
 *
 * In both branches the target process must survive the attach attempt.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        srv.close(() => reject(new Error('Could not determine port')));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

describe('MCP Server JavaScript Attach-Mode Smoke Test', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;
  let targetProcess: ChildProcess | null = null;

  beforeAll(async () => {
    const serverEntry = path.join(ROOT, 'dist', 'index.js');
    if (!existsSync(serverEntry)) {
      throw new Error(
        `Server entry missing at ${serverEntry}. Run "npm run build" before executing this test.`
      );
    }

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverEntry, '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client({
      name: 'js-attach-smoke-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[JS Attach Test] MCP client connected');
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

    if (targetProcess && !targetProcess.killed) {
      targetProcess.kill('SIGKILL');
    }

    console.log('[JS Attach Test] Cleanup completed');
  });

  it('attach_to_process must either really attach (threads + frames) or fail loudly', async () => {
    const targetScript = path.resolve(ROOT, 'examples', 'javascript', 'attach_target.js');
    const inspectPort = await getFreePort();

    // 1. Start a long-running Node target with an open inspector port
    targetProcess = spawn(
      process.execPath,
      [`--inspect=127.0.0.1:${inspectPort}`, targetScript],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    // Wait for the inspector to announce it is listening
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('node --inspect did not start listening within 30s')),
        30000
      );
      let stderr = '';
      targetProcess!.stderr!.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
        if (stderr.includes('Debugger listening on')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      targetProcess!.on('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`target exited prematurely (code ${code}): ${stderr}`));
      });
    });
    console.log(`[JS Attach Test] Target listening on inspector port ${inspectPort}`);

    // 2. Create session and attach
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'javascript', name: 'js-attach-test' }
    });
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    expect(sessionId).toBeTruthy();

    const attachResult = await mcpClient!.callTool({
      name: 'attach_to_process',
      arguments: { sessionId, host: '127.0.0.1', port: inspectPort }
    });
    const attachResponse = parseSdkToolResult(attachResult);
    console.log('[JS Attach Test] attach_to_process response:', JSON.stringify(attachResponse));

    if (attachResponse.success === true) {
      // Branch (a): attach claims success — hold it to that claim.
      const threadsResult = await callToolSafely(mcpClient!, 'list_threads', { sessionId });
      const threads = (threadsResult.threads as Array<{ id: number; name: string }> | undefined) ?? [];
      expect(
        threads.length,
        `attach_to_process reported success + state "${attachResponse.state}" but list_threads ` +
        `returned no threads (${JSON.stringify(threadsResult)}) — the attach is lying about being ` +
        `debuggable; the js-debug child session likely never connected to the inspector (issue #124)`
      ).toBeGreaterThan(0);

      const stackResult = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId });
      expect(
        stackResult.success,
        `attach_to_process reported success but get_stack_trace failed: ` +
        `${JSON.stringify(stackResult)} (issue #124)`
      ).toBe(true);
      const frames = (stackResult.stackFrames as unknown[] | undefined) ?? [];
      expect(
        frames.length,
        `attach_to_process reported success + state "${attachResponse.state}" but get_stack_trace ` +
        `returned an empty-but-successful stack (${JSON.stringify(stackResult)}) — the attach is ` +
        `lying about being debuggable (issue #124)`
      ).toBeGreaterThan(0);
    } else {
      // Branch (b): a truthful failure is acceptable until JS attach is
      // implemented (issue #124 PR-b), but it must carry a real error.
      const errorText = String(attachResponse.message ?? attachResponse.error ?? '');
      expect(
        errorText.length,
        `attach_to_process failed without an actionable error message: ${JSON.stringify(attachResponse)}`
      ).toBeGreaterThan(0);
      console.log(`[JS Attach Test] Attach failed truthfully: ${errorText}`);
    }

    // 3. In both branches, the attach attempt must not have harmed the target.
    await new Promise(r => setTimeout(r, 500));
    expect(
      targetProcess!.exitCode,
      'the attach attempt must leave the target process running'
    ).toBeNull();
  }, 120000);
});
