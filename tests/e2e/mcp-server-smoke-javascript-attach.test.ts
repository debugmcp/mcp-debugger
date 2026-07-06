/**
 * JavaScript Attach-Mode Smoke Tests via MCP Interface (issue #124)
 *
 * Test 1 — invariant: attach_to_process must not lie. Attach to a real
 * `node --inspect=<port>` process and require that EITHER attach reports
 * success AND the session is actually debuggable (non-empty threads, real
 * stack frames) OR attach reports a truthful failure. What must never happen
 * is the original issue #124 behavior: success + "paused" while the js-debug
 * child session never connected to the inspector and every downstream tool
 * answered empty-but-successful results.
 *
 * Test 2 — acceptance: full working attach cycle. Attach, set a breakpoint,
 * continue to hit it, evaluate an expression at the stop, then
 * detach_from_process must leave the target alive and running.
 *
 * Test 3 — stopOnEntry:false: attaching must NOT pause the target (the
 * js-debug child adoption path must not force an entry stop), and detach
 * must leave it alive.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
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
const TARGET_SCRIPT = path.resolve(ROOT, 'examples', 'javascript', 'attach_target.js');
const BREAKPOINT_LINE = 11; // `counter += 1;` inside tick()

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

interface Target {
  proc: ChildProcess;
  port: number;
  stdout: () => string;
}

/** Spawn the tick target with an open inspector port and wait until it listens. */
async function spawnTarget(): Promise<Target> {
  const port = await getFreePort();
  const proc = spawn(
    process.execPath,
    [`--inspect=127.0.0.1:${port}`, TARGET_SCRIPT],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let stdout = '';
  proc.stdout!.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('node --inspect did not start listening within 30s')),
      30000
    );
    let stderr = '';
    proc.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.includes('Debugger listening on')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`target exited prematurely (code ${code}): ${stderr}`));
    });
  });

  return { proc, port, stdout: () => stdout };
}

describe('MCP Server JavaScript Attach-Mode Smoke Tests', () => {
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

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      } catch {
        // Session may already be closed
      }
      sessionId = null;
    }
    if (targetProcess && !targetProcess.killed) {
      targetProcess.kill('SIGKILL');
    }
    targetProcess = null;
  });

  afterAll(async () => {
    if (mcpClient) {
      await mcpClient.close();
    }
    if (transport) {
      await transport.close();
    }
    console.log('[JS Attach Test] Cleanup completed');
  });

  async function createSessionAndAttach(
    port: number,
    extraAttachArgs: Record<string, unknown> = {}
  ) {
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'javascript', name: 'js-attach-test' }
    });
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    expect(sessionId).toBeTruthy();

    const attachResult = await mcpClient!.callTool({
      name: 'attach_to_process',
      arguments: { sessionId, host: '127.0.0.1', port, ...extraAttachArgs }
    });
    return parseSdkToolResult(attachResult);
  }

  it('attach_to_process must either really attach (threads + frames) or fail loudly', async () => {
    const target = await spawnTarget();
    targetProcess = target.proc;

    const attachResponse = await createSessionAndAttach(target.port);
    console.log('[JS Attach Test] attach_to_process response:', JSON.stringify(attachResponse));

    if (attachResponse.success === true) {
      // Branch (a): attach claims success — hold it to that claim.
      const threadsResult = await callToolSafely(mcpClient!, 'list_threads', { sessionId: sessionId! });
      const threads = (threadsResult.threads as Array<{ id: number; name: string }> | undefined) ?? [];
      expect(
        threads.length,
        `attach_to_process reported success + state "${attachResponse.state}" but list_threads ` +
        `returned no threads (${JSON.stringify(threadsResult)}) — the attach is lying about being ` +
        `debuggable; the js-debug child session likely never connected to the inspector (issue #124)`
      ).toBeGreaterThan(0);

      const stackResult = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId: sessionId! });
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
      // Branch (b): a truthful failure must carry a real error.
      const errorText = String(attachResponse.message ?? attachResponse.error ?? '');
      expect(
        errorText.length,
        `attach_to_process failed without an actionable error message: ${JSON.stringify(attachResponse)}`
      ).toBeGreaterThan(0);
      console.log(`[JS Attach Test] Attach failed truthfully: ${errorText}`);
    }

    // In both branches, the attach attempt must not have harmed the target.
    await new Promise(r => setTimeout(r, 500));
    expect(
      targetProcess!.exitCode,
      'the attach attempt must leave the target process running'
    ).toBeNull();
  }, 120000);

  it('should attach, hit a breakpoint, evaluate, and detach leaving the target running', async () => {
    const target = await spawnTarget();
    targetProcess = target.proc;

    // 1. Attach (default stopOnEntry: the target is paused once attached)
    const attachResponse = await createSessionAndAttach(target.port);
    expect(attachResponse.success, `attach failed: ${JSON.stringify(attachResponse)}`).toBe(true);
    expect(attachResponse.state).toBe('paused');

    // 2. Breakpoint inside the tick loop
    const bpResult = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId: sessionId!,
      file: TARGET_SCRIPT,
      line: BREAKPOINT_LINE
    });
    expect(bpResult.success, `set_breakpoint failed: ${JSON.stringify(bpResult)}`).toBe(true);

    // 3. Continue and wait for the breakpoint to fire (tick runs every 100ms)
    const contResult = await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sessionId! });
    expect(contResult.success, `continue_execution failed: ${JSON.stringify(contResult)}`).toBe(true);

    let hit: { line?: number } | null = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const stack = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId: sessionId! });
      const frames = (stack.stackFrames as Array<{ file?: string; line?: number }> | undefined) ?? [];
      if (stack.success && frames.length > 0 && frames[0].line === BREAKPOINT_LINE) {
        hit = frames[0];
        break;
      }
    }
    expect(hit, 'breakpoint at tick() was not hit within 10s of continue').not.toBeNull();

    // 4. Evaluate at the stop — counter is live program state
    const evalResult = await callToolSafely(mcpClient!, 'evaluate_expression', {
      sessionId: sessionId!,
      expression: 'counter'
    });
    expect(evalResult.success, `evaluate_expression failed: ${JSON.stringify(evalResult)}`).toBe(true);
    expect(Number(evalResult.result)).toBeGreaterThanOrEqual(1);

    // 5. Detach without terminating; the target must stay alive and resume
    const outputBeforeDetach = target.stdout().length;
    const detachResult = await callToolSafely(mcpClient!, 'detach_from_process', {
      sessionId: sessionId!,
      terminateProcess: false
    });
    expect(detachResult.success, `detach_from_process failed: ${JSON.stringify(detachResult)}`).toBe(true);

    await new Promise(r => setTimeout(r, 2500));
    expect(targetProcess!.exitCode, 'detach must leave the target process alive').toBeNull();
    expect(
      target.stdout().length,
      'the target must resume ticking after detach (it was left paused or was killed)'
    ).toBeGreaterThan(outputBeforeDetach);
  }, 120000);

  it('should not pause the target when attaching with stopOnEntry:false', async () => {
    const target = await spawnTarget();
    targetProcess = target.proc;

    const attachResponse = await createSessionAndAttach(target.port, { stopOnEntry: false });
    expect(attachResponse.success, `attach failed: ${JSON.stringify(attachResponse)}`).toBe(true);
    expect(attachResponse.state).toBe('running');

    // Give child adoption time to settle, then verify the target kept running:
    // the tick loop prints every ~1s, so new output must appear.
    const outputAfterAttach = target.stdout().length;
    await new Promise(r => setTimeout(r, 3000));
    expect(
      target.stdout().length,
      'attach with stopOnEntry:false must not pause the target (issue #124: the js-debug ' +
      'child adoption path must not force an entry stop)'
    ).toBeGreaterThan(outputAfterAttach);

    const detachResult = await callToolSafely(mcpClient!, 'detach_from_process', {
      sessionId: sessionId!,
      terminateProcess: false
    });
    expect(detachResult.success, `detach_from_process failed: ${JSON.stringify(detachResult)}`).toBe(true);

    await new Promise(r => setTimeout(r, 500));
    expect(targetProcess!.exitCode, 'detach must leave the target process alive').toBeNull();
  }, 120000);
});
