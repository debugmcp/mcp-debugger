/**
 * The idle policy against a real server and a real debugpy launch (issue
 * #1127). Every other idle-policy test drives the session manager over stubs,
 * and that is how this bug got through: a tool call counted as activity only
 * at the moment it was dispatched, so a `start_debugging` that outlasted the
 * window had its session closed underneath it and answered "Proxy exited
 * during initialization".
 *
 * The window here is 800 ms with a 100 ms sweep. It is shorter than any
 * launch of a program that keeps running — the launch alone holds 1 s for a
 * first stop — so without the fix the sweep always lands inside the call; and
 * it is wide enough for the gap between `create_debug_session` and
 * `start_debugging` on a loaded runner (a start that finds the session
 * already expired, because that gap alone outran the window, says so at once
 * and is tried again).
 */
import { afterEach, describe, expect, it } from 'vitest';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';
import { ensurePythonOnPath } from './env-utils.js';

const here = path.dirname(fileURLToPath(import.meta.url));
/** Loops forever: the launch answers while it is still running. */
const PROGRAM = path.resolve(here, '../../../../examples/python/pause_test.py');

const WINDOW_MS = 800;
const SWEEP_MS = 100;

type IdleAwareAnswer = ToolAnswer & { closedBy?: string; pending?: boolean; sessionId?: string };
interface ListedSession { id: string; name: string; state: string; idleMs?: number; expiresInMs?: number }

/** A TCP listener that accepts every connection and never says a word: an attach to it stays in flight. */
async function silentListener(): Promise<{ port: number; hangUp: () => Promise<void> }> {
  const sockets = new Set<net.Socket>();
  const listener = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => undefined);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
  return {
    port: (listener.address() as net.AddressInfo).port,
    hangUp: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => listener.close(() => resolve()));
    }
  };
}

/** The PATH a Windows runner needs to find a Python with debugpy; nothing else of the runner's environment. */
function pythonPath(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  ensurePythonOnPath(env);
  return Object.fromEntries(Object.entries(env).filter(([key]) => key.toUpperCase() === 'PATH'));
}

describe('The idle policy against a real launch (issue #1127) @requires-python', () => {
  let server: StdioClientHandle | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('does not close a session underneath its own start_debugging, and closes it once it is left alone', async () => {
    server = await startStdioClient({
      name: 'idle-policy-in-flight',
      env: {
        ...pythonPath(),
        MCP_DEBUG_SESSION_IDLE_MS: String(WINDOW_MS),
        MCP_DEBUG_SESSION_IDLE_SWEEP_MS: String(SWEEP_MS)
      }
    });

    let launch: IdleAwareAnswer | undefined;
    for (let attempt = 1; attempt <= 2 && !launch; attempt++) {
      await server.createSession('python', `idle-in-flight-${attempt}`);
      const answer = await server.call<IdleAwareAnswer>('start_debugging', { scriptPath: PROGRAM });
      if (answer.closedBy === 'idle-policy') {
        // The gap between the two calls alone outran the window: nothing was launched.
        server.sessionId = undefined;
        continue;
      }
      launch = answer;
    }

    // The launch ran longer than the window and was not closed underneath itself.
    expect(launch, 'both attempts expired between create_debug_session and start_debugging').toBeDefined();
    expect(launch, JSON.stringify(launch)).toMatchObject({ success: true, state: 'running' });

    // Left alone past the window, the policy closes it — and the clock ran from
    // the launch's answer, so this is the policy at work, not the bug.
    await new Promise((resolve) => setTimeout(resolve, WINDOW_MS + SWEEP_MS + 1500));
    const afterwards = await server.call<IdleAwareAnswer>('get_output', {});
    server.sessionId = undefined;

    expect(afterwards, JSON.stringify(afterwards)).toMatchObject({ success: false, closedBy: 'idle-policy' });
    expect(afterwards.error).toContain('Its program was ended.');
  }, 60_000);

  /**
   * The same bug on the path that names no session: create_debug_session with
   * an attach target attaches inside the call, so the dispatch has no
   * sessionId to hold. Against a target that accepts and says nothing, the
   * attach outlasts any window; the policy used to close the new session
   * under it ("Created session but attach failed: … Proxy exited during
   * initialization").
   */
  it('does not close the session create_debug_session made while its inline attach is still running', async () => {
    server = await startStdioClient({
      name: 'idle-policy-create-attach',
      callTimeoutMs: 90_000,
      env: {
        ...pythonPath(),
        MCP_DEBUG_SESSION_IDLE_MS: String(WINDOW_MS),
        MCP_DEBUG_SESSION_IDLE_SWEEP_MS: String(SWEEP_MS)
      }
    });
    const target = await silentListener();
    let hungUp = false;
    try {
      const creating = server.call<IdleAwareAnswer>('create_debug_session', {
        language: 'python',
        name: 'idle-create-attach',
        host: '127.0.0.1',
        port: target.port
      });
      // Awaited below; a failed assertion in between must not leave it unhandled.
      creating.catch(() => undefined);
      // Three windows later the attach is still in flight …
      await new Promise((resolve) => setTimeout(resolve, WINDOW_MS * 3));
      const listed = await server.call<ToolAnswer & { sessions: ListedSession[] }>('list_debug_sessions', {});
      const row = listed.sessions.find((session) => session.name === 'idle-create-attach');

      // … and the session it is attaching is still there, not counted as idle.
      expect(row, JSON.stringify(listed)).toBeDefined();
      expect(row).toMatchObject({ idleMs: 0, expiresInMs: WINDOW_MS });

      // The target hangs up; the attach fails for the adapter's own reason, not the policy's.
      await target.hangUp();
      hungUp = true;
      const created = await creating;
      expect(JSON.stringify(created)).not.toContain('idle-policy');
      expect(created.sessionId).toBe(row!.id);
    } finally {
      if (!hungUp) await target.hangUp();
    }
  }, 120_000);
});
