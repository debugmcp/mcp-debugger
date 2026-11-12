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
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';
import { ensurePythonOnPath } from './env-utils.js';

const here = path.dirname(fileURLToPath(import.meta.url));
/** Loops forever: the launch answers while it is still running. */
const PROGRAM = path.resolve(here, '../../../../examples/python/pause_test.py');

const WINDOW_MS = 800;
const SWEEP_MS = 100;

type IdleAwareAnswer = ToolAnswer & { closedBy?: string; pending?: boolean };

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
});
