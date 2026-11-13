/**
 * A stop where no frame is program code, read through every inspection tool
 * of a real server and a real js-debug (issues #1135, #1141).
 *
 * `examples/javascript/pause_test.js` is a bare `setInterval`: between ticks
 * the only JavaScript that runs is Node's own timer loop, so a pause lands on
 * `process.processTimers` — one runtime frame, no program frame. That is the
 * stop the 2026-11-11 sweep reported: get_stack_trace said `noProgramFrame`,
 * get_local_variables answered the timer loop's `now` as a plain local, and
 * get_stack_trace told a caller who had passed includeInternals: true to pass
 * it.
 *
 * Where a pause lands is the runtime's call, so the suite states the rule
 * rather than the landing: the three tools agree on whether the stack has a
 * program frame, and when it has none each says so. The landing itself is
 * asserted too, loudly, because a suite that only ever took the other branch
 * would test nothing.
 */
import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const examples = path.resolve(here, '../../../../examples/javascript');
/** A bare setInterval: it never ends and runs no program code between ticks. */
const IDLE_PROGRAM = path.join(examples, 'pause_test.js');
/** Runs to completion in a few milliseconds. */
const SHORT_PROGRAM = path.join(examples, 'simple_test.js');

interface Frame { name: string; file: string; line: number }
type StackAnswer = ToolAnswer & { stackFrames: Frame[]; count: number; includeInternals: boolean; noProgramFrame?: boolean; note?: string };
type LocalsAnswer = ToolAnswer & { variables: Array<{ name: string; value: string }>; count: number; frame?: Frame; noProgramFrame?: boolean; note?: string };
type EvaluateAnswer = ToolAnswer & { result?: string; frame?: Frame; noProgramFrame?: boolean; anchorNote?: string };
type StopAnswer = ToolAnswer & { pending?: boolean; note?: string; location?: { file: string; line: number } };

describe('Inspection on a stop with no program frame (issues #1135, #1141) @requires-node', () => {
  let server: StdioClientHandle | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('get_stack_trace, get_local_variables and evaluate_expression agree that the frame is not program code', async () => {
    server = await startStdioClient({ name: 'no-program-frame' });
    await server.createSession('javascript', 'no-program-frame');
    const launch = await server.call<StopAnswer>('start_debugging', { scriptPath: IDLE_PROGRAM });
    expect(launch, JSON.stringify(launch)).toMatchObject({ success: true, state: 'running' });

    let pause = await server.call<StopAnswer>('pause_execution', {});
    if (pause.pending) {
      // The pause is in force; the next timer tick lands it.
      pause = await server.call<StopAnswer>('wait_for_stop', { timeout: 20_000 });
    }
    expect(pause, JSON.stringify(pause)).toMatchObject({ success: true, state: 'paused' });

    const stack = await server.call<StackAnswer>('get_stack_trace', { includeInternals: true });
    const locals = await server.call<LocalsAnswer>('get_local_variables', {});
    const evaluated = await server.call<EvaluateAnswer>('evaluate_expression', { expression: '1 + 1' });
    const context = JSON.stringify({ stack, locals, evaluated });

    // The rule, wherever the pause landed: one verdict, on all three.
    expect(locals.noProgramFrame === true, context).toBe(stack.noProgramFrame === true);
    expect(evaluated.noProgramFrame === true, context).toBe(stack.noProgramFrame === true);

    // The landing this fixture exists for. If a Node release ever lands the
    // pause in the callback instead, this fails by name and the fixture needs
    // another idle program — the assertions below must not go quietly unused.
    expect(stack.noProgramFrame, `the pause on a bare setInterval landed in program code: ${context}`).toBe(true);

    // get_stack_trace was asked for every frame and shows every frame: it
    // never tells the caller to ask for them (issue #1141).
    expect(stack.includeInternals).toBe(true);
    expect(stack.note, context).toContain('No program frame is active');
    expect(stack.note, context).not.toContain('includeInternals');

    // get_local_variables keeps what the adapter reported and says whose it
    // is (issue #1135).
    expect(locals.note, context).toContain('No program frame is active');
    if (locals.count > 0) {
      expect(locals.note, context).toContain(`The variables shown belong to '${locals.frame?.name}', not to your program.`);
    }
    // With one frame in all, there is no fuller stack to point at; with more,
    // the pointer is there.
    if (stack.count === 1) {
      expect(locals.note, context).not.toContain('includeInternals');
    } else {
      expect(locals.note, context).toContain('get_stack_trace with includeInternals: true lists the frames.');
    }

    // evaluate_expression without a frameId ran in that frame, and says so.
    expect(evaluated, context).toMatchObject({ success: true, result: '2' });
    expect(evaluated.anchorNote, context).toContain('No program frame is active');
    expect(evaluated.anchorNote, context).toContain('The expression was evaluated in that frame.');

    // An explicit frameId is the caller's choice: nothing is added.
    const explicit = await server.call<EvaluateAnswer>('evaluate_expression', {
      expression: '1 + 1',
      frameId: (stack.stackFrames[0] as Frame & { id: number }).id
    });
    expect(explicit, JSON.stringify(explicit)).toMatchObject({ success: true, result: '2' });
    expect(explicit).not.toHaveProperty('noProgramFrame');
    expect(explicit).not.toHaveProperty('anchorNote');
  }, 90_000);

  it('explains an ended session from every inspection tool, with the error text unchanged', async () => {
    server = await startStdioClient({ name: 'ended-session' });
    const sessionId = await server.createSession('javascript', 'ended-session');
    await server.call('start_debugging', { scriptPath: SHORT_PROGRAM });
    const ended = await server.call<ToolAnswer>('wait_for_stop', { timeout: 30_000 });
    expect(ended, JSON.stringify(ended)).toMatchObject({ success: true, state: 'stopped' });

    const sentence = 'The program has terminated, so no frames or variables exist. Use restart_debugging to run it again.';
    const calls: Array<[string, Record<string, unknown>]> = [
      ['get_stack_trace', {}],
      ['get_local_variables', {}],
      ['get_scopes', { frameId: 1 }],
      ['get_variables', { scope: 1 }],
      ['evaluate_expression', { expression: '1 + 1' }]
    ];
    for (const [tool, args] of calls) {
      const answer = await server.call<ToolAnswer>(tool, args);
      expect(answer, `${tool}: ${JSON.stringify(answer)}`).toMatchObject({
        success: false,
        error: `Session is terminated: ${sessionId}`,
        message: sentence
      });
    }
  }, 90_000);
});
