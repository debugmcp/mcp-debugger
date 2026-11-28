/**
 * Real debugpy coverage for issue #1334: setting a Python logpoint whose brace
 * group uses an f-string conversion (`{x!r}`) or format spec (`{total:.2f}`)
 * is refused up front on a launched session with the expression form that
 * works, and setting that replacement logs the evaluated value.
 */
import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  startStdioClient,
  type StdioClientHandle,
  type ToolAnswer
} from '../../../test-utils/helpers/mcp-stdio-client.js';
import { ensurePythonOnPath } from './env-utils.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '../../../fixtures/python/logpoint_values.py');

function hasDebugpy(): boolean {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  ensurePythonOnPath(env);
  for (const python of [process.env.PYTHON_PATH, 'python', 'python3'].filter((p): p is string => Boolean(p))) {
    try {
      const probe = spawnSync(python, ['-c', 'import debugpy'], {
        env,
        timeout: 15_000,
        windowsHide: true,
        stdio: 'ignore'
      });
      if (probe.status === 0) return true;
    } catch {
      // try next candidate
    }
  }
  return false;
}

type BreakpointAnswer = ToolAnswer & {
  breakpointId?: string;
  verified?: boolean;
  logMessage?: string;
};

type EndAnswer = ToolAnswer & {
  pending?: boolean;
  exitCode?: number;
};

type OutputAnswer = ToolAnswer & {
  entries?: Array<{ seq: number; category: string; output: string }>;
};

describe.skipIf(!hasDebugpy())('Python logpoint validation against real debugpy (issue #1334) @requires-python', () => {
  let server: StdioClientHandle | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('refuses {x!r} and {total:.2f} on a launched Python session with their replacements, then logs the values when the replacements are set', async () => {
    const env: Record<string, string> = {};
    ensurePythonOnPath(env);
    server = await startStdioClient({ name: 'python-logpoint-validation', env });
    const sessionId = await server.createSession('python', 'python-logpoint-validation');

    const started = await server.call('start_debugging', {
      scriptPath: FIXTURE,
      dapLaunchArgs: { stopOnEntry: true }
    });
    expect(started.success, JSON.stringify(started)).toBe(true);
    expect(started.state, JSON.stringify(started)).toBe('paused');

    await expect(
      server.client.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: FIXTURE,
          line: 11,
          logMessage: '{x!r}'
        }
      })
    ).rejects.toThrow(
      'Invalid logpoint: {x!r}: debugpy evaluates the text between braces as a Python expression, and !r is f-string syntax, not an expression; use {repr(x)} instead.'
    );

    await expect(
      server.client.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: FIXTURE,
          line: 15,
          logMessage: '{total:.2f}'
        }
      })
    ).rejects.toThrow(
      "Invalid logpoint: {total:.2f}: debugpy evaluates the text between braces as a Python expression, and :.2f is f-string syntax, not an expression; use {format(total, '.2f')} instead."
    );

    // No refused logpoint was stored on the session.
    const emptyList = await server.call<ToolAnswer & { count: number }>('list_breakpoints');
    expect(emptyList.count).toBe(0);

    // Set the replacements named in the refusals, plus valid colon-bearing expressions.
    const reprBp = await server.call<BreakpointAnswer>('set_breakpoint', {
      file: FIXTURE,
      line: 11,
      logMessage: '{repr(x)}'
    });
    expect(reprBp.success, JSON.stringify(reprBp)).toBe(true);
    expect(reprBp.verified, JSON.stringify(reprBp)).toBe(true);

    const formatBp = await server.call<BreakpointAnswer>('set_breakpoint', {
      file: FIXTURE,
      line: 15,
      logMessage: "{format(total, '.2f')}"
    });
    expect(formatBp.success, JSON.stringify(formatBp)).toBe(true);
    expect(formatBp.verified, JSON.stringify(formatBp)).toBe(true);

    const sliceBp = await server.call<BreakpointAnswer>('set_breakpoint', {
      file: FIXTURE,
      line: 16,
      logMessage: '{items[1:3]}'
    });
    expect(sliceBp.success, JSON.stringify(sliceBp)).toBe(true);

    const resumed = await server.call('continue_execution');
    expect(resumed.success, JSON.stringify(resumed)).toBe(true);

    const ended = await server.call<EndAnswer>('wait_for_stop', { timeout: 20_000 });
    expect(ended.success, JSON.stringify(ended)).toBe(true);
    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.exitCode, JSON.stringify(ended)).toBe(0);

    const output = await server.call<OutputAnswer>('get_output', { since: 0 });
    const lines = (output.entries ?? []).map((entry) => entry.output.trim());
    expect(lines, JSON.stringify(output)).toEqual(["'café'", '3.50', '[20, 30]']);
  }, 60_000);
});
