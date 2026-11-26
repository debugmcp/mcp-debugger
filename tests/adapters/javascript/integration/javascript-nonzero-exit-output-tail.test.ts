/**
 * Real js-debug coverage for issues #1254 and #1136: a Node script that writes
 * to stderr and calls `process.exit(3)` carries `exitCode: 3` and `outputTail`
 * at the top level of whichever answer reports its end — `start_debugging`
 * when the run finishes inside the launch hold, or the `wait_for_stop` after a
 * `pending: true` launch answer.
 */
import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '../../../fixtures/debug-scripts/js-nonzero-exit.js');

type EndAnswer = ToolAnswer & {
  pending?: boolean;
  exitCode?: number;
  outputTail?: string[];
  data?: {
    exitCode?: number;
    outputTail?: string[];
  };
};

describe('JavaScript non-zero exit carries outputTail (issues #1254, #1136) @requires-node', () => {
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
});
