/**
 * Real js-debug coverage for issues #1254, #1136, and #1277: a Node script that
 * exits non-zero carries `exitCode` and `outputTail` at the top level of
 * whichever answer reports its end — keeping the error message above CJS loader
 * frames, dropping inspector banners, and keeping stdout failure lines that
 * follow stderr warnings.
 */
import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '../../../fixtures/debug-scripts/js-nonzero-exit.js');
const CJS_CRASH_FIXTURE = path.resolve(here, '../../../fixtures/debug-scripts/js-cjs-throws.cjs');
const WARN_STDERR_FAIL_STDOUT_FIXTURE = path.resolve(here, '../../../fixtures/debug-scripts/js-warn-stderr-fail-stdout.cjs');
const EXIT_CODE_EXAMPLE = path.resolve(here, '../../../../examples/javascript/exit_code_test.js');

type EndAnswer = ToolAnswer & {
  pending?: boolean;
  exitCode?: number;
  outputTail?: string[];
  data?: {
    exitCode?: number;
    outputTail?: string[];
  };
};

describe('JavaScript non-zero exit carries outputTail (issues #1254, #1136, #1277) @requires-node', () => {
  let server: StdioClientHandle | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('reports exitCode 3 and both stderr lines in outputTail on start_debugging or wait_for_stop', async () => {
    server = await startStdioClient({ name: 'js-nonzero-exit-tail' });
    await server.createSession('javascript', 'js-nonzero-exit-tail');

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
    expect(ended.outputTail, JSON.stringify(ended)).toEqual([
      'runner error: no test files found',
      'exiting with code 3'
    ]);
    expect(ended.message, JSON.stringify(ended)).toContain('exited with code 3');
    expect(ended.message, JSON.stringify(ended)).toContain('get_output');
    expect(ended.message, JSON.stringify(ended)).not.toContain('runner error: no test files found');
    if (!started.pending) {
      expect(started.data?.exitCode).toBe(3);
      expect(started.data).not.toHaveProperty('outputTail');
    }
  }, 60_000);

  it('drops js-debug console and inspector stderr lines on a plain stdout non-zero exit (issue #1277)', async () => {
    server = await startStdioClient({ name: 'js-exit-code-7-tail' });
    await server.createSession('javascript', 'js-exit-code-7-tail');

    const started = await server.call<EndAnswer>('start_debugging', { scriptPath: EXIT_CODE_EXAMPLE });
    expect(started.success, JSON.stringify(started)).toBe(true);
    const ended = started.pending
      ? await server.call<EndAnswer>('wait_for_stop', { timeout: 20_000 })
      : started;

    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.exitCode, JSON.stringify(ended)).toBe(7);
    expect(ended.outputTail, JSON.stringify(ended)).toEqual(['exit_code_test: exiting with status 7']);
  }, 60_000);

  it('keeps Error: uncaught on purpose above Node CJS loader frames on a crash (issue #1277)', async () => {
    server = await startStdioClient({ name: 'js-cjs-crash-tail' });
    await server.createSession('javascript', 'js-cjs-crash-tail');

    const started = await server.call<EndAnswer>('start_debugging', {
      scriptPath: CJS_CRASH_FIXTURE,
      breakOnExceptions: 'none'
    });
    expect(started.success, JSON.stringify(started)).toBe(true);
    const ended = started.pending
      ? await server.call<EndAnswer>('wait_for_stop', { timeout: 20_000 })
      : started;

    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.exitCode, JSON.stringify(ended)).toBe(1);
    expect(ended.outputTail, JSON.stringify(ended)).toContain('Error: uncaught on purpose');
    expect(ended.outputTail?.some(line => /^\.\.\. \(\d+ lines omitted\)$/.test(line)), JSON.stringify(ended)).toBe(true);
    expect(ended.outputTail, JSON.stringify(ended)).not.toContain('Debugger attached.');
    expect(ended.outputTail, JSON.stringify(ended)).not.toContain('Waiting for the debugger to disconnect...');
    expect(ended.outputTail?.length).toBe(8);
  }, 60_000);

  it('keeps a stdout failure line that follows a stderr deprecation warning (issue #1277)', async () => {
    server = await startStdioClient({ name: 'js-warn-then-fail-tail' });
    await server.createSession('javascript', 'js-warn-then-fail-tail');

    const started = await server.call<EndAnswer>('start_debugging', {
      scriptPath: WARN_STDERR_FAIL_STDOUT_FIXTURE,
      breakOnExceptions: 'none'
    });
    expect(started.success, JSON.stringify(started)).toBe(true);
    const ended = started.pending
      ? await server.call<EndAnswer>('wait_for_stop', { timeout: 20_000 })
      : started;

    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.exitCode, JSON.stringify(ended)).toBe(1);
    // stdout and stderr are separate pipes read independently by js-debug, so cross-stream
    // arrival order is not guaranteed; assert presence across streams and order within stderr.
    const tail = ended.outputTail ?? [];
    expect(tail, JSON.stringify(ended)).toContain('FAIL suite/auth.spec.js: expected 200, got 401');
    const warnHeaderIdx = tail.findIndex(line => line.includes('DeprecationWarning: legacy config flag used'));
    const warnHintIdx = tail.findIndex(line => line.includes('--trace-deprecation'));
    expect(warnHeaderIdx, JSON.stringify(tail)).toBeGreaterThanOrEqual(0);
    expect(warnHintIdx, JSON.stringify(tail)).toBeGreaterThan(warnHeaderIdx);
  }, 60_000);
});
