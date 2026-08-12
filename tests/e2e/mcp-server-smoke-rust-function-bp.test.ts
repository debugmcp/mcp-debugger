/**
 * Rust function-breakpoint smoke test (issues #302/#303).
 *
 * CodeLLDB reports function-breakpoint hits as plain reason 'breakpoint';
 * RustAdapterPolicy relabels a hit attributable to function breakpoints to
 * 'function breakpoint' (issue #302). The adapter-assigned ids reach the
 * store via the worker's pre-launch sync results, so even a stop that fires
 * immediately at launch (a breakpoint on main) is labeled.
 *
 * Requires: rust toolchain (@requires-rust); skipped when absent.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { prepareRustExample } from './rust-example-utils.js';
import { skipIfSpawnBlocked } from '../test-utils/helpers/adapter-spawn.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

function hasRustToolchain(): boolean {
  try {
    execSync('rustc --version', { stdio: 'ignore' });
    return true;
  } catch {
    console.log('[rust-function-bp] Skipping — Rust toolchain not installed');
    return false;
  }
}

const SKIP_RUST = !hasRustToolchain();

describe.skipIf(SKIP_RUST)('Rust function breakpoints (CodeLLDB) @requires-rust', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: { ...process.env, NODE_ENV: 'test' }
    });
    mcpClient = new Client({ name: 'rust-fnbp-smoke', version: '1.0.0' }, { capabilities: {} });
    await mcpClient.connect(transport);
  }, 30000);

  afterAll(async () => {
    if (mcpClient) await mcpClient.close();
    if (transport) await transport.close();
  });

  afterEach(async () => {
    if (sessionId && mcpClient) {
      await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      sessionId = null;
    }
  });

  async function getSessionSnapshot(sid: string): Promise<{ state?: string; lastStop?: { reason?: string; rawReason?: string } } | undefined> {
    const res = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
    const sessions = (res.sessions ?? []) as Array<{ id: string; state?: string; lastStop?: { reason?: string; rawReason?: string } }>;
    return sessions.find(s => s.id === sid);
  }

  async function pollUntil<T>(fn: () => Promise<T | undefined>, timeoutMs: number): Promise<T | undefined> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = await fn();
      if (value !== undefined) return value;
      if (Date.now() > deadline) return undefined;
      await new Promise(r => setTimeout(r, 250));
    }
  }

  it('stops at a crate-qualified function breakpoint with reason "function breakpoint" (#302)', async (ctx) => {
    const { binaryPath } = await prepareRustExample('hello_world');

    const createRes = parseSdkToolResult(await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'rust', name: 'rust-fnbp' }
    }));
    sessionId = createRes.sessionId as string;

    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId,
      function: 'hello_world::main'
    });
    expect(bpRes.success).toBe(true);

    const startRes = parseSdkToolResult(await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath: binaryPath,
        dapLaunchArgs: { stopOnEntry: false },
        adapterLaunchConfig: { sourceLanguages: ['rust'] }
      }
    }));
    skipIfSpawnBlocked(ctx, startRes, 'Rust');
    expect(startRes.success).toBe(true);

    // The breakpoint on main fires immediately at launch — the labeling must
    // survive that race (pre-launch sync results carry the adapter ids).
    const paused = await pollUntil(async () => {
      const snap = await getSessionSnapshot(sessionId!);
      return snap?.state === 'paused' ? snap : undefined;
    }, 30000);
    expect(paused, 'session should pause at the function breakpoint').toBeDefined();
    expect(paused!.lastStop?.reason).toBe('function breakpoint');
    expect(paused!.lastStop?.rawReason).toBe('breakpoint');

    const stack = parseSdkToolResult(await mcpClient!.callTool({
      name: 'get_stack_trace',
      arguments: { sessionId }
    }));
    expect(stack.stopReason).toBe('function breakpoint');
    const top = (stack.stackFrames as Array<{ name: string; file?: string }>)[0];
    expect(top.name).toContain('main');
    expect(top.file?.replace(/\\/g, '/')).toContain('hello_world/src/main.rs');

    // The bound location is source-mapped and reported.
    const listRes = await callToolSafely(mcpClient!, 'list_breakpoints', { sessionId });
    const fnBp = ((listRes as { functionBreakpoints?: Array<{ verified?: boolean; boundFile?: string; adapterId?: number }> }).functionBreakpoints ?? [])[0];
    expect(fnBp?.verified).toBe(true);
    expect(fnBp?.adapterId).toBeDefined();

    const contRes = await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    expect(contRes.success).toBe(true);
    const stopped = await pollUntil(async () => {
      const snap = await getSessionSnapshot(sessionId!);
      return snap?.state === 'stopped' ? snap : undefined;
    }, 20000);
    expect(stopped, 'program should run to completion after continue').toBeDefined();
  }, 120000);
}, 180000);
