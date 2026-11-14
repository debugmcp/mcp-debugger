/**
 * Issue #1151: a debug session owns a program it launched and borrows one it
 * attached to. Ending a session ends what it owns, in every adapter, so a
 * plain `detach_from_process` on a launched session has nothing true to
 * answer: it used to say "Detached from process (process still running)" and
 * the process was gone. It is refused by name, before anything is touched.
 *
 * Real js-debug and a real program, so CI runs it: the refusal is keyed on
 * what the launch recorded, and only a real launch records it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../test-utils/helpers/mcp-stdio-client.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const program = path.join(root, 'examples/javascript/idle_server_attach_target.js');

interface Row { id: string; state: string }

let server: StdioClientHandle;
const call = <T extends ToolAnswer = ToolAnswer>(name: string, args: Record<string, unknown> = {}): Promise<T> => server.call<T>(name, args);
const stateOf = async (sessionId: string): Promise<string | undefined> =>
  (await call<ToolAnswer & { sessions: Row[] }>('list_debug_sessions')).sessions.find((row) => row.id === sessionId)?.state;

beforeEach(async () => {
  server = await startStdioClient({ name: 'detach-owned-program', callTimeoutMs: 60_000 });
});

afterEach(async () => {
  await server?.close();
}, 30_000);

describe('detach_from_process on a session that launched its program (issue #1151)', () => {
  it('is refused by name with the session left as it was, and a terminating detach still ends the program', async () => {
    const sessionId = await server.createSession('javascript', 'detach-owned-program');
    const started = await call('start_debugging', { scriptPath: program });
    expect(started.success, JSON.stringify(started)).toBe(true);
    expect(started.state, JSON.stringify(started)).toBe('running');

    const refused = await call('detach_from_process');
    expect(refused.success, JSON.stringify(refused)).toBe(false);
    expect(refused.state, JSON.stringify(refused)).toBe('running');
    expect(String(refused.message), JSON.stringify(refused)).toMatch(/launched by this session/);
    expect(String(refused.message)).toMatch(/close_debug_session/);
    expect(String(refused.message)).toMatch(/terminateProcess: true/);
    expect(String(refused.message)).toMatch(/attach_to_process/);
    // Nothing was touched: the program is still under the debugger.
    expect(await stateOf(sessionId)).toBe('running');
    const paused = await call('pause_execution');
    expect(paused.success, JSON.stringify(paused)).toBe(true);

    const ended = await call('detach_from_process', { terminateProcess: true });
    expect(ended.success, JSON.stringify(ended)).toBe(true);
    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
  }, 120_000);
});
