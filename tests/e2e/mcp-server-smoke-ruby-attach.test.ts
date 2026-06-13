/**
 * Ruby Attach-Mode Smoke Tests via MCP Interface
 *
 * Tests Ruby attach debugging via the direct-connect path: spawn a script
 * under `rdbg --open --port <p>` (suspended at load, waiting for a client),
 * then use attach_to_process to connect.
 *
 * Hard assertions (every step must succeed when Ruby is installed):
 * - Attach succeeds and reports paused state (rdbg suspends at load)
 * - Breakpoint inside the loop binds and fires after continue
 * - Local variables (counter, message) are readable at the breakpoint
 * - Expression evaluation works in the attach session
 * - Detach without terminate leaves the target process alive
 *
 * Skips gracefully when Ruby/rdbg is not installed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import {
  findRubyExecutable,
  findRdbgExecutable,
  buildRdbgInvocation
} from '@debugmcp/adapter-ruby';

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

async function waitForPausedState(
  client: Client,
  sessionId: string,
  maxAttempts = 20,
  intervalMs = 500
): Promise<{ stackFrames?: Array<{ file?: string; name?: string; line?: number }> } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await callToolSafely(client, 'get_stack_trace', { sessionId });
    if (result.stackFrames && (result.stackFrames as unknown[]).length > 0) {
      return result as { stackFrames: Array<{ file?: string; name?: string; line?: number }> };
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

describe('MCP Server Ruby Attach-Mode Smoke Test @requires-ruby', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;
  let rdbgProcess: ChildProcess | null = null;
  let rubyAvailable = false;

  beforeAll(async () => {
    try {
      await findRubyExecutable();
      await findRdbgExecutable();
      rubyAvailable = true;
    } catch {
      console.log('[Ruby Attach Test] Ruby/rdbg not available; tests will skip');
      return;
    }

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client({
      name: 'ruby-attach-smoke-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[Ruby Attach Test] MCP client connected');
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

    if (rdbgProcess && !rdbgProcess.killed) {
      rdbgProcess.kill('SIGKILL');
    }

    console.log('[Ruby Attach Test] Cleanup completed');
  });

  it('should attach, hit a breakpoint, inspect, and detach leaving the target running', async () => {
    if (!rubyAvailable) {
      return;
    }

    const rubyPath = await findRubyExecutable();
    const rdbgPath = await findRdbgExecutable();
    const targetScript = path.resolve(ROOT, 'examples', 'ruby', 'long_running.rb');
    const port = await getFreePort();

    // 1. Start the target under rdbg, listening and suspended at load
    const invocation = buildRdbgInvocation(
      rdbgPath,
      ['--open', '--host', '127.0.0.1', '--port', String(port), targetScript],
      rubyPath
    );
    console.log(`[Ruby Attach Test] Spawning: ${invocation.command} ${invocation.args.join(' ')}`);
    rdbgProcess = spawn(invocation.command, invocation.args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Wait for rdbg to announce it is listening
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('rdbg did not start listening within 30s')),
        30000
      );
      let stderr = '';
      rdbgProcess!.stderr!.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
        if (stderr.includes('wait for debugger connection')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      rdbgProcess!.on('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`rdbg exited prematurely (code ${code}): ${stderr}`));
      });
    });

    // 2. Create session and attach
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'ruby', name: 'ruby-attach-test' }
    });
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    expect(sessionId).toBeTruthy();

    const attachResult = await mcpClient!.callTool({
      name: 'attach_to_process',
      arguments: { sessionId, host: '127.0.0.1', port }
    });
    const attachResponse = parseSdkToolResult(attachResult);
    expect(attachResponse.success).toBe(true);
    expect(attachResponse.state).toBe('paused');

    // 3. Breakpoint inside the loop, then release the load suspension
    const bpResult = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId,
      file: targetScript,
      line: 12 // puts "#{message} #{counter} ..."
    });
    expect(bpResult.success).toBe(true);

    const contResult = await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    expect(contResult.success).toBe(true);

    // 4. Wait for the breakpoint to fire and inspect locals
    const stack = await waitForPausedState(mcpClient!, sessionId);
    expect(stack).not.toBeNull();
    expect(stack!.stackFrames![0].line).toBe(12);

    const varsResult = await callToolSafely(mcpClient!, 'get_local_variables', { sessionId });
    const variables = varsResult.variables as Array<{ name: string; value: string }>;
    const counter = variables.find(v => v.name === 'counter');
    const message = variables.find(v => v.name === 'message');
    expect(Number(counter?.value)).toBeGreaterThanOrEqual(1);
    expect(message?.value).toContain('tick');

    // 5. Evaluate in the attach session (repl context)
    const evalResult = await callToolSafely(mcpClient!, 'evaluate_expression', {
      sessionId,
      expression: 'counter * 2'
    });
    expect(evalResult.success).toBe(true);

    // 6. Detach without terminating; the target must stay alive
    const detachResult = await callToolSafely(mcpClient!, 'detach_from_process', {
      sessionId,
      terminateProcess: false
    });
    expect(detachResult.success).toBe(true);

    await new Promise(r => setTimeout(r, 1000));
    expect(rdbgProcess!.exitCode).toBeNull();
  }, 120000);
});
