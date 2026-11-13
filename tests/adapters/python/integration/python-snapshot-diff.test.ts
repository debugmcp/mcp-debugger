/**
 * The stop snapshot's diff against a real debugpy (issue #1140): a variable
 * that comes into scope is reported as new, with no invented "before".
 *
 * Before the fix a step past `b = 2` answered
 * `"b": { "before": "<undefined>", "after": "2" }` — a string that reads as a
 * value, in JavaScript's vocabulary, for a Python local that simply did not
 * exist yet.
 */
import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';
import { ensurePythonOnPath } from './env-utils.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROGRAM = path.resolve(here, '../../../../examples/python/simple_test.py');
/** `b = 2` — `a` exists, `b` does not yet. */
const LINE_BEFORE_B = 9;

interface ChangedVariable { before?: string; after?: string; new?: true; gone?: true }
type StopAnswer = ToolAnswer & {
  location?: { file: string; line: number };
  snapshot?: { locals?: Record<string, string>; changedVariables?: Record<string, ChangedVariable> };
};

/** The PATH a Windows runner needs to find a Python with debugpy; nothing else of the runner's environment. */
function pythonPath(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  ensurePythonOnPath(env);
  return Object.fromEntries(Object.entries(env).filter(([key]) => key.toUpperCase() === 'PATH'));
}

describe('The snapshot diff against a real debugpy (issue #1140) @requires-python', () => {
  let server: StdioClientHandle | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('reports a variable that came into scope as new, then a changed value as a change', async () => {
    server = await startStdioClient({ name: 'snapshot-diff-py', env: pythonPath() });
    await server.createSession('python', 'snapshot-diff-py');
    await server.call('set_breakpoint', { file: PROGRAM, line: LINE_BEFORE_B });
    let launch = await server.call<StopAnswer>('start_debugging', { scriptPath: PROGRAM });
    expect(launch.success, JSON.stringify(launch)).toBe(true);
    // The launch answers paused when the breakpoint is reached within its
    // hold (issue #823); a slower start answers pending, and wait_for_stop
    // lands the same stop with the same first snapshot.
    if (launch.state !== 'paused') {
      launch = await server.call<StopAnswer>('wait_for_stop', { timeout: 15000 });
    }
    expect(launch, JSON.stringify(launch)).toMatchObject({ success: true, state: 'paused' });
    expect(launch.snapshot?.locals, JSON.stringify(launch)).toEqual({ a: '1' });

    // b = 2
    const declared = await server.call<StopAnswer>('step_over', {});
    expect(declared.snapshot?.changedVariables, JSON.stringify(declared)).toEqual({ b: { after: '2', new: true } });

    // print(...) — nothing the frame can see changes.
    const printed = await server.call<StopAnswer>('step_over', {});
    expect(printed.snapshot?.changedVariables, JSON.stringify(printed)).toEqual({});

    // a, b = b, a
    const swapped = await server.call<StopAnswer>('step_over', {});
    expect(swapped.snapshot?.changedVariables, JSON.stringify(swapped)).toEqual({
      a: { before: '1', after: '2' },
      b: { before: '2', after: '1' }
    });
  }, 90_000);
});
