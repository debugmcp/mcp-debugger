/**
 * The stop snapshot's diff against a real js-debug (issue #1140): a variable
 * that leaves scope is reported as gone, and no entry ever carries an
 * invented value.
 *
 * The fixture's loop body has a block-scoped `doubled`; stepping from inside
 * the block to the statement after the loop takes it (and the loop's `i`)
 * out of the frame's locals while the function, and so the diff's frame
 * identity, stays the same. How many steps V8 takes through a `for` header
 * is its own business, so the suite steps until it is past the loop and
 * reads every diff on the way.
 */
import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '../../../fixtures/debug-scripts/js-block-scope.js');
/** `total += doubled;` — inside the loop's block. */
const LINE_IN_BLOCK = 10;
/** `const done = total > 0;` — the first statement after the loop. */
const LINE_AFTER_LOOP = 12;

interface ChangedVariable { before?: string; after?: string; new?: true; gone?: true }
type StopAnswer = ToolAnswer & {
  location?: { file: string; line: number };
  snapshot?: { locals?: Record<string, string>; changedVariables?: Record<string, ChangedVariable> };
};

describe('The snapshot diff against a real js-debug (issue #1140) @requires-node', () => {
  let server: StdioClientHandle | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('reports a block variable as gone once the block is left, and never invents a value', async () => {
    server = await startStdioClient({ name: 'snapshot-diff-js' });
    await server.createSession('javascript', 'snapshot-diff-js');
    await server.call('set_breakpoint', { file: FIXTURE, line: LINE_IN_BLOCK });
    let launch = await server.call<StopAnswer>('start_debugging', { scriptPath: FIXTURE });
    expect(launch.success, JSON.stringify(launch)).toBe(true);
    // The launch answers paused when the breakpoint is reached within its
    // hold (issue #823); a slower start answers pending, and wait_for_stop
    // lands the same stop with the same first snapshot.
    if (launch.state !== 'paused') {
      launch = await server.call<StopAnswer>('wait_for_stop', { timeout: 15000 });
    }
    expect(launch, JSON.stringify(launch)).toMatchObject({ success: true, state: 'paused' });
    // The first stop shows the frame's locals in full: the block's and the function's.
    expect(launch.snapshot?.locals, JSON.stringify(launch)).toMatchObject({ doubled: '2', i: '0', total: '0' });

    const diffs: Array<Record<string, ChangedVariable>> = [];
    let line = launch.location?.line;
    for (let steps = 0; steps < 8 && line !== LINE_AFTER_LOOP; steps++) {
      const step = await server.call<StopAnswer>('step_over', {});
      expect(step, JSON.stringify(step)).toMatchObject({ success: true, state: 'paused' });
      line = step.location?.line;
      // Same function, same depth: every one of these stops answers a diff.
      expect(step.snapshot?.changedVariables, JSON.stringify(step)).toBeDefined();
      diffs.push(step.snapshot!.changedVariables!);
    }
    const seen = JSON.stringify(diffs);
    expect(line, `never reached the statement after the loop: ${seen}`).toBe(LINE_AFTER_LOOP);

    // The block's variable left scope on the way, with the value it last had.
    const left = diffs.find((diff) => diff.doubled?.gone === true);
    expect(left?.doubled, seen).toEqual({ before: '2', gone: true });
    // The loop counter went too, by the time the loop was over.
    expect(diffs.some((diff) => diff.i?.gone === true), seen).toBe(true);
    // The function's own variable is never reported gone.
    expect(diffs.some((diff) => diff.total?.gone === true), seen).toBe(false);

    // The shape, on every entry of every diff: a side that does not exist is
    // absent, a flag says why, and no placeholder stands in for a value.
    for (const diff of diffs) {
      for (const [name, entry] of Object.entries(diff)) {
        const where = `${name} in ${seen}`;
        if (entry.new) expect(entry, where).toEqual({ after: entry.after, new: true });
        if (entry.gone) expect(entry, where).toEqual({ before: entry.before, gone: true });
        expect(entry.before, where).not.toBe('<undefined>');
        expect(typeof (entry.after ?? entry.before), where).toBe('string');
      }
    }
  }, 90_000);
});
