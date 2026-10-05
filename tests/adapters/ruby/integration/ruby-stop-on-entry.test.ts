/**
 * Real MCP -> rdbg coverage for issue #798. Runs in CI (the integration
 * project; the CI job installs Ruby with the bundled debug gem).
 *
 * rdbg's DAP `launch` handler goes nonstop unconditionally and only `attach`
 * reads `nonstop`, so before the fix a Ruby launch with `stopOnEntry: true`
 * ran to completion (`stopOnEntrySuccessful: false`, no `stopped` event).
 * Skips when Ruby or rdbg is not installed.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { findRubyExecutable, findRdbgExecutable } from '@debugmcp/adapter-ruby';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const fizzbuzz = path.join(root, 'examples/ruby/fizzbuzz.rb');
const scrubbed = new Set(['NODE_OPTIONS', 'DEBUG_MCP_SKIP_AUTO_START', 'MCP_DEBUGGER_EXITCODE_FILE',
  'MCP_DEBUGGER_EXITCODE_CLAIMED', 'DEBUG', 'DAP_TRACE_FILE']);

interface Result {
  success: boolean; state?: string; message?: string; error?: string;
  data?: { reason?: string; stopOnEntrySuccessful?: boolean; exitCode?: number };
}
interface Listed { id: string; state: string; lastStop?: { reason?: string } }

const hasRuby = await (async () => {
  try {
    await findRubyExecutable();
    await findRdbgExecutable();
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasRuby)('Ruby launch entry stop (issue #798)', () => {
  let client: Client;
  let sessionId: string | undefined;

  async function call<T extends Result = Result>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const raw = await client.callTool(
      { name, arguments: { ...(sessionId ? { sessionId } : {}), ...args } },
      undefined,
      { timeout: 60_000 }
    );
    expect(raw.isError, JSON.stringify(raw)).not.toBe(true);
    const content = raw.content as Array<{ type: string; text?: string }>;
    return JSON.parse(content.find(item => item.type === 'text')!.text!) as T;
  }

  async function listedSession(): Promise<Listed | undefined> {
    const listed = await call<Result & { sessions: Listed[] }>('list_debug_sessions');
    return listed.sessions.find(session => session.id === sessionId);
  }

  async function waitForState(state: string, timeoutMs: number): Promise<Listed | undefined> {
    const deadline = Date.now() + timeoutMs;
    let last: Listed | undefined;
    while (Date.now() < deadline) {
      last = await listedSession();
      if (last?.state === state) return last;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return last;
  }

  beforeEach(async () => {
    client = new Client({ name: 'ruby-stop-on-entry-integration', version: '1' });
    const env = Object.fromEntries(Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined && !scrubbed.has(entry[0].toUpperCase())
    ));
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(root, 'dist/index.js'), 'stdio'],
      cwd: root,
      env: { ...env, MCP_SKIP_ORPHAN_REAPERS: '1', MCP_EXIT_ON_STDIN_CLOSE: '1' },
      stderr: 'pipe'
    });
    transport.stderr?.on('data', () => {});
    await client.connect(transport);
    const created = await call<Result & { sessionId: string }>('create_debug_session', { language: 'ruby', name: 'stop-on-entry' });
    expect(created.success).toBe(true);
    sessionId = created.sessionId;
  });

  afterEach(async () => {
    try {
      if (sessionId) {
        await client.callTool({ name: 'close_debug_session', arguments: { sessionId } }, undefined, { timeout: 10_000 }).catch(() => {});
      }
    } finally {
      sessionId = undefined;
      await client?.close();
    }
  }, 20_000);

  it('pauses at the first line with stopOnEntry: true, then runs to completion on continue', async () => {
    const result = await call('start_debugging', { scriptPath: fizzbuzz, dapLaunchArgs: { stopOnEntry: true } });
    expect(result.success, JSON.stringify(result)).toBe(true);
    expect(result.state).toBe('paused');
    expect(result.data?.stopOnEntrySuccessful).toBe(true);
    expect(result.data?.reason).toBe('entry');

    const stack = await call<Result & { stackFrames: Array<{ file?: string; line?: number }> }>('get_stack_trace');
    expect(stack.success).toBe(true);
    expect(stack.stackFrames.length).toBeGreaterThan(0);
    expect(path.basename(stack.stackFrames[0].file ?? '')).toBe('fizzbuzz.rb');

    const resumed = await call('continue_execution');
    expect(resumed.success).toBe(true);
    const finished = await waitForState('stopped', 20_000);
    expect(finished?.state).toBe('stopped');

    const output = await call<Result & { entries: Array<{ output: string }> }>('get_output', { limit: 1000 });
    expect(output.entries.some(entry => entry.output.includes('15: FizzBuzz'))).toBe(true);
  }, 60_000);

  // A launch with nothing armed to stop it used to wait out a full 30 s and
  // then answer `running` with no word about the wait (issue #815). Every
  // launch now holds only briefly for its first stop, whatever is armed
  // (issue #823), and the answer says the program is running and how to wait.
  it('answers a launch with nothing armed as running and pending after the short hold (issues #815, #823)', async () => {
    const longRunning = path.join(root, 'examples/ruby/long_running.rb');
    const before = Date.now();
    const result = await call<Result & { pending?: boolean }>('start_debugging', { scriptPath: longRunning });
    const elapsedMs = Date.now() - before;
    expect(result.success, JSON.stringify(result)).toBe(true);
    expect(result.state).toBe('running');
    expect(result.pending).toBe(true);
    expect(result.message).toMatch(/nothing is armed to stop it/);
    expect(result.message).toContain('wait_for_stop');
    // The hold is a tunable, not part of the contract: the answer names no duration.
    expect(result.message).not.toMatch(/after \d+(\.\d+)?s/);
    expect(elapsedMs, `start_debugging took ${elapsedMs}ms`).toBeLessThan(20_000);
    expect((await listedSession())?.state).toBe('running');
  }, 60_000);

  it('runs a launch without stopOnEntry to its first breakpoint, as before', async () => {
    // The default path is unchanged in substance: the launch request goes
    // out as a plain `launch`, rdbg continues by itself on configurationDone,
    // and the launch pauses at the first breakpoint.
    const bp = await call('set_breakpoint', { file: fizzbuzz, line: 15 });
    expect(bp.success, JSON.stringify(bp)).toBe(true);
    const result = await call<Result & { pending?: boolean }>('start_debugging', { scriptPath: fizzbuzz });
    expect(result.success, JSON.stringify(result)).toBe(true);
    expect(result.data?.stopOnEntrySuccessful).toBe(false);
    // rdbg reaches line 15 within milliseconds, so the launch normally answers
    // with the stop itself. The contract allows either: a launch that has not
    // stopped when its short hold elapses answers pending, and wait_for_stop
    // collects the stop (issue #823) — which is what a loaded machine would do.
    if (result.pending) {
      const waited = await call<Result & { lastStop?: { reason?: string } }>('wait_for_stop', { timeout: 20_000 });
      expect(waited.state, JSON.stringify(waited)).toBe('paused');
      expect(waited.lastStop?.reason).toBe('breakpoint');
    } else {
      expect(result.state).toBe('paused');
      expect(result.data?.reason).toBe('breakpoint');
    }

    const stack = await call<Result & { stackFrames: Array<{ file?: string; line?: number }> }>('get_stack_trace');
    expect(stack.stackFrames[0]?.line).toBe(15);
  }, 60_000);
});
