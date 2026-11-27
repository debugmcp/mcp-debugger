/**
 * Real debugpy coverage for issues #1254 and #1136: a Python program that
 * writes to stderr and ends with a non-zero exit code carries `exitCode` and
 * `outputTail` at the top level of whichever answer reports its end —
 * `start_debugging` when the run finishes inside the launch hold, or the
 * `wait_for_stop` after a `pending: true` launch answer.
 */
import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';
import { ensurePythonOnPath } from './env-utils.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '../../../fixtures/debug-scripts/python-nonzero-exit.py');
const CRASH_FIXTURE = path.resolve(here, '../../../fixtures/debug-scripts/python-throws-uncaught.py');

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

type EndAnswer = ToolAnswer & {
  pending?: boolean;
  exitCode?: number;
  outputTail?: string[];
  data?: {
    exitCode?: number;
    outputTail?: string[];
  };
};

describe.skipIf(!hasDebugpy())('Python non-zero exit carries outputTail (issues #1254, #1136) @requires-python', () => {
  let server: StdioClientHandle | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('reports exitCode 3 and both stderr lines in outputTail on start_debugging or wait_for_stop', async () => {
    const env: Record<string, string> = {};
    ensurePythonOnPath(env);
    server = await startStdioClient({ name: 'python-nonzero-exit-tail', env });
    await server.createSession('python', 'python-nonzero-exit-tail');

    const started = await server.call<EndAnswer>('start_debugging', { scriptPath: FIXTURE });
    expect(started.success, JSON.stringify(started)).toBe(true);

    let ended: EndAnswer;
    if (started.pending) {
      expect(started.state, JSON.stringify(started)).toBe('running');
      ended = await server.call<EndAnswer>('wait_for_stop', { timeout: 20_000 });
      expect(ended.success, JSON.stringify(ended)).toBe(true);
    } else {
      ended = started;
    }

    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.exitCode, JSON.stringify(ended)).toBe(3);
    expect(ended.outputTail, JSON.stringify(ended)).toEqual(
      expect.arrayContaining([
        'runner error: no test files found',
        'exiting with code 3'
      ])
    );
    expect(ended.message, JSON.stringify(ended)).toContain('exited with code 3');
    expect(ended.message, JSON.stringify(ended)).toContain('get_output');
    expect(ended.message, JSON.stringify(ended)).not.toContain('runner error: no test files found');
    if (!started.pending) {
      expect(started.data?.exitCode).toBe(3);
      expect(started.data).not.toHaveProperty('outputTail');
    }
  }, 60_000);

  it('keeps RuntimeError: uncaught on purpose at the end of a long debugpy traceback (issue #1277)', async () => {
    const env: Record<string, string> = {};
    ensurePythonOnPath(env);
    server = await startStdioClient({ name: 'python-crash-tail', env });
    await server.createSession('python', 'python-crash-tail');

    const started = await server.call<EndAnswer>('start_debugging', {
      scriptPath: CRASH_FIXTURE,
      breakOnExceptions: 'none'
    });
    expect(started.success, JSON.stringify(started)).toBe(true);
    const ended = started.pending
      ? await server.call<EndAnswer>('wait_for_stop', { timeout: 20_000 })
      : started;

    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.exitCode, JSON.stringify(ended)).toBe(1);
    expect(ended.outputTail?.[0], JSON.stringify(ended)).toBe('Traceback (most recent call last):');
    expect(ended.outputTail, JSON.stringify(ended)).toContain('...');
    expect(ended.outputTail?.at(-1), JSON.stringify(ended)).toBe('RuntimeError: uncaught on purpose');
    expect(ended.outputTail?.length).toBe(8);
  }, 60_000);
});
