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
import { startStdioClient, type StdioClientHandle } from '../../../test-utils/helpers/mcp-stdio-client.js';
import { findRubyExecutable, findRdbgExecutable } from '@debugmcp/adapter-ruby';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const fizzbuzz = path.join(root, 'examples/ruby/fizzbuzz.rb');

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
  let server: StdioClientHandle;
  let sessionId: string | undefined;

  const call = <T extends Result = Result>(name: string, args: Record<string, unknown> = {}): Promise<T> => server.call<T>(name, args);

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
    server = await startStdioClient({ name: 'ruby-stop-on-entry-integration', callTimeoutMs: 60_000 });
    sessionId = await server.createSession('ruby', 'stop-on-entry');
  });

  afterEach(async () => {
    sessionId = undefined;
    await server?.close();
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
