/**
 * Ruby run-to-completion terminal state (issue #258)
 *
 * A Ruby launch session whose script runs to completion — cleanly or via an
 * unhandled raise — must end in session state 'stopped' with the debuggee's
 * exit code recorded, never 'error'. Before the fix, rdbg closing the DAP
 * socket at debuggee exit raced the terminated event, and the proxy's
 * codeless dap_connection_closed status was mapped to a fabricated exit
 * code 1 → session state 'error' (even for a clean run).
 *
 * Skips gracefully when Ruby/rdbg is not installed, matching
 * mcp-server-smoke-ruby.test.ts.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { findRubyExecutable, findRdbgExecutable } from '@debugmcp/adapter-ruby';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const CLEAN_SCRIPT = path.resolve(ROOT, 'tests', 'fixtures', 'debug-scripts', 'ruby-clean-exit.rb');
const RAISE_SCRIPT = path.resolve(ROOT, 'tests', 'fixtures', 'debug-scripts', 'ruby-raise-unhandled.rb');

interface SessionSnapshot {
  id: string;
  state?: string;
  exitCode?: number;
}

async function rubyToolchainAvailable(): Promise<boolean> {
  try {
    await findRubyExecutable();
    await findRdbgExecutable();
    return true;
  } catch {
    return false;
  }
}

async function getSessionSnapshot(client: Client, sessionId: string): Promise<SessionSnapshot | undefined> {
  const res = parseSdkToolResult(await client.callTool({ name: 'list_debug_sessions', arguments: {} }));
  const sessions = (res.sessions ?? []) as SessionSnapshot[];
  return sessions.find(s => s.id === sessionId);
}

async function pollUntil<T>(
  fn: () => Promise<T | undefined>,
  timeoutMs: number,
  intervalMs = 250
): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value !== undefined) return value;
    if (Date.now() > deadline) return undefined;
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

describe('Ruby run-to-completion terminal state (issue #258) @requires-ruby', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: { ...process.env, NODE_ENV: 'test' }
    });
    mcpClient = new Client(
      { name: 'ruby-run-to-completion-e2e', version: '1.0.0' },
      { capabilities: {} }
    );
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

  async function runToCompletion(scriptPath: string, name: string): Promise<SessionSnapshot> {
    const createRes = parseSdkToolResult(await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'ruby', name }
    }));
    expect(createRes.sessionId).toBeDefined();
    sessionId = createRes.sessionId as string;

    // No breakpoints, default stopOnEntry (false): the entry pause is
    // auto-continued and the script runs straight to completion
    const startRes = parseSdkToolResult(await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: { sessionId, scriptPath }
    })) as { state?: string };
    expect(startRes.state).not.toBe('error');

    // Wait for a terminal state; 'error' is terminal too, so a regression
    // fails fast instead of timing out
    const terminal = await pollUntil(async () => {
      const snap = await getSessionSnapshot(mcpClient!, sessionId!);
      return snap && (snap.state === 'stopped' || snap.state === 'error') ? snap : undefined;
    }, 30000);

    expect(terminal).toBeDefined();
    return terminal!;
  }

  it('clean script ends stopped with exitCode 0, not error', async () => {
    if (!(await rubyToolchainAvailable())) {
      console.log('[Ruby #258 e2e] Ruby/rdbg not available, skipping');
      return;
    }

    const terminal = await runToCompletion(CLEAN_SCRIPT, 'ruby-258-clean');

    expect(terminal.state).toBe('stopped');
    expect(terminal.exitCode).toBe(0);
  }, 60000);

  it('unhandled raise ends stopped with non-zero exitCode, not error', async () => {
    if (!(await rubyToolchainAvailable())) {
      console.log('[Ruby #258 e2e] Ruby/rdbg not available, skipping');
      return;
    }

    const terminal = await runToCompletion(RAISE_SCRIPT, 'ruby-258-raise');

    expect(terminal.state).toBe('stopped');
    expect(terminal.exitCode).toBe(1);
  }, 60000);
});
