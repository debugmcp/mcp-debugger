/**
 * The server's own JavaScript stepper, through a real server, the real
 * js-debug and a real Node (issues #1130, #1161).
 *
 * js-debug's smart stepper is off for every session; the server decides
 * where a step ends. What that has to hold, as measured:
 *
 *   - a step_into on a line that calls only Node's own code lands on the
 *     next line, at once. js-debug's stepper lost that step on the first
 *     console.log of a process (the session ended), and took about 6 s on a
 *     Linux host for a later one;
 *   - a call through Node's code into a callback of the program's is
 *     followed; a call that only starts a later task is not;
 *   - a step that leaves a function through `return` inside try...finally
 *     lands in the caller. V8 loses that step (12.4 to 14.6, a bare CDP
 *     client), sync and async; the stepper catches the return with temporary
 *     breakpoints on the frame the step returns to;
 *   - a breakpoint reached during a step stops as itself;
 *   - a step off the last line of a callback Node called has no frame of the
 *     program to return to: the program is resumed, not walked through the
 *     internals of later tasks;
 *   - `justMyCode: false` keeps plain steps: the session chose to see
 *     everything.
 */
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';
import { ErrorMessages } from '../../../../src/utils/error-messages.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '../../../fixtures/javascript/step-skipped-code/steps.cjs');
const LINES = fs.readFileSync(FIXTURE, 'utf8').split('\n');

/** The 1-based line that carries `// MARK: <marker>`. */
function lineOf(marker: string): number {
  const index = LINES.findIndex((line) => line.includes(`// MARK: ${marker}`));
  if (index === -1) {
    throw new Error(`no line marked "${marker}" in the fixture`);
  }
  return index + 1;
}

type StopAnswer = ToolAnswer & {
  pending?: boolean;
  stopReason?: string;
  location?: { file: string; line: number };
};

/** A step that answered inside the grace window is not pending; this bound says it was prompt. */
const PROMPT_MS = 4000;

describe('The server\'s JavaScript stepper against a real js-debug (issues #1130, #1161) @requires-node', () => {
  let server: StdioClientHandle | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  async function pausedAt(marker: string, launchArgs?: Record<string, unknown>, extraBreakpoints: string[] = []): Promise<StopAnswer> {
    server = await startStdioClient({ name: 'js-stepper' });
    await server.createSession('javascript', 'js-stepper');
    for (const at of [marker, ...extraBreakpoints]) {
      const set = await server.call('set_breakpoint', { file: FIXTURE, line: lineOf(at) });
      expect(set.success, JSON.stringify(set)).toBe(true);
    }
    let stop = await server.call<StopAnswer>('start_debugging', { scriptPath: FIXTURE, ...(launchArgs ? { dapLaunchArgs: launchArgs } : {}) });
    expect(stop.success, JSON.stringify(stop)).toBe(true);
    if (stop.state !== 'paused') {
      stop = await server.call<StopAnswer>('wait_for_stop', { timeout: 20000 });
    }
    expect(stop, JSON.stringify(stop)).toMatchObject({ success: true, state: 'paused' });
    expect(stop.location?.line, JSON.stringify(stop)).toBe(lineOf(marker));
    return stop;
  }

  async function step(tool: 'step_into' | 'step_over' | 'step_out'): Promise<StopAnswer & { ms: number }> {
    const started = Date.now();
    const answer = await server!.call<StopAnswer>(tool, {});
    return { ...answer, ms: Date.now() - started };
  }

  function expectLanding(answer: StopAnswer & { ms: number }, marker: string): void {
    expect(answer, JSON.stringify(answer)).toMatchObject({ success: true, state: 'paused' });
    expect(answer.pending, JSON.stringify(answer)).toBeUndefined();
    expect(answer.stopReason, JSON.stringify(answer)).toBeUndefined();
    expect(answer.location?.file ?? '', JSON.stringify(answer)).toMatch(/steps\.cjs$/);
    expect(answer.location?.line, JSON.stringify(answer)).toBe(lineOf(marker));
    expect(answer.ms, `took ${answer.ms} ms: ${JSON.stringify(answer)}`).toBeLessThan(PROMPT_MS);
  }

  describe('step_into (issue #1130)', () => {
    it('lands on the next line when the walk into the call stays in Node\'s own code, and says how far it went: the first console.log of the process', async () => {
      await pausedAt('the first console.log');
      const answer = await step('step_into');
      // js-debug's own stepper lost this step: "Step completed as session exited."
      expectLanding(answer, 'after the first console.log');
      // The first command and the whole budget, 25 step-ins, before it stepped out.
      expect(answer.message).toBe(`Stepped into. ${ErrorMessages.stepIntoReachedNoProgramCode(25)}`);
    }, 60000);

    it('enters a function of the program that a builtin calls', async () => {
      await pausedAt('a builtin calls the program');
      const answer = await step('step_into');
      expectLanding(answer, 'in the mapper');
      expect(answer.message).toBe('Stepped into');
    }, 60000);

    it('follows a call through Node\'s own code into the program\'s listener', async () => {
      await pausedAt('Node code calls the program');
      const answer = await step('step_into');
      expectLanding(answer, 'in the listener');
      expect(answer.message).toBe('Stepped into');
    }, 60000);

    it('does not follow a call into a later task: the next line, not the timer\'s callback', async () => {
      await pausedAt('starts a later task');
      expectLanding(await step('step_into'), 'after setTimeout');
    }, 60000);

    it('lands on the next line of a require of a module not yet loaded (the loader returns through try...finally, issue #1161)', async () => {
      await pausedAt('first load of a module');
      const answer = await step('step_into');
      expectLanding(answer, 'after the require');
    }, 60000);
  });

  describe('step_out and step_over', () => {
    it('step_out of a callback Node called lands back in the program, past Node\'s frames', async () => {
      await pausedAt('in the listener');
      expectLanding(await step('step_out'), 'after emit');
    }, 60000);

    it('a breakpoint reached during a step_over stops as itself', async () => {
      await pausedAt('calls a function with a breakpoint', undefined, ['a breakpoint in a callee']);
      const answer = await step('step_over');
      expect(answer, JSON.stringify(answer)).toMatchObject({ success: true, state: 'paused', stopReason: 'breakpoint' });
      expect(answer.location?.line, JSON.stringify(answer)).toBe(lineOf('a breakpoint in a callee'));
      expect(answer.message).toMatch(/stopped on 'breakpoint' rather than on the step itself/);
    }, 60000);

    it('a step off the last line of a callback Node called resumes the program: the next breakpoint is what stops', async () => {
      await pausedAt('last line of a callback Node called', undefined, ['a later task']);
      // V8 stops once more in the callback, on its closing brace.
      const brace = await step('step_over');
      expect(brace, JSON.stringify(brace)).toMatchObject({ success: true, state: 'paused' });
      expect(brace.location?.line, JSON.stringify(brace)).toBe(lineOf('last line of a callback Node called') + 1);
      const answer = await step('step_over');
      // Nothing of the program is below the timer's callback: the stack the
      // step started on is gone. The stepper resumes instead of stepping out
      // of the bottom frame, which would walk the internals of later tasks.
      expect(answer, JSON.stringify(answer)).toMatchObject({ success: true, state: 'paused', stopReason: 'breakpoint' });
      expect(answer.location?.line, JSON.stringify(answer)).toBe(lineOf('a later task'));
      expect(answer.ms, JSON.stringify(answer)).toBeLessThan(PROMPT_MS);
    }, 60000);
  });

  describe('a step that leaves a function through return inside try...finally (issue #1161)', () => {
    it('step_out lands in the caller', async () => {
      await pausedAt('return inside try-finally');
      // V8 never pauses for this step-out: "Step completed as session exited."
      expectLanding(await step('step_out'), 'after withFinally');
    }, 60000);

    it('step_over reaches the finally block, then the caller', async () => {
      await pausedAt('return inside try-finally');
      expectLanding(await step('step_over'), 'the finally block');
      // The step that leaves the function is the one V8 loses.
      expectLanding(await step('step_over'), 'after withFinally');
    }, 60000);

    it('step_out of an async function with that shape is the engine\'s own, and the engine loses it (#1174)', async () => {
      await pausedAt('async return inside try-finally');
      // A temporary breakpoint below a function that can suspend cannot tell
      // it returning from it pausing at an await: the server sets none, and
      // the step is lost as it was before the server had a stepper. If this
      // starts landing, V8 has fixed it (#1173): update the docs.
      const answer = await step('step_out');
      expect(answer, JSON.stringify(answer)).toMatchObject({ success: true });
      expect(answer.state, JSON.stringify(answer)).not.toBe('paused');
    }, 60000);
  });

  describe('a session that chose plain steps', () => {
    it('justMyCode: false lands in Node\'s own code, where V8 lands', async () => {
      await pausedAt('the first console.log', { justMyCode: false });
      const answer = await step('step_into');
      expect(answer, JSON.stringify(answer)).toMatchObject({ success: true, state: 'paused' });
      expect(answer.location?.file ?? '', JSON.stringify(answer)).toMatch(/node_internals|^node:/);
      expect(answer.message).toBe('Stepped into');
    }, 60000);
  });

  describe('async functions, callbacks the program only scheduled, and a caller\'s own skip list', () => {
    const ASYNC_FIXTURE = path.resolve(here, '../../../fixtures/javascript/step-skipped-code/async-steps.cjs');
    const ASYNC_LINES = fs.readFileSync(ASYNC_FIXTURE, 'utf8').split('\n');
    const at = (marker: string): number => {
      const index = ASYNC_LINES.findIndex((line) => line.includes(`// MARK: ${marker}`));
      if (index === -1) {
        throw new Error(`no line marked "${marker}" in the async fixture`);
      }
      return index + 1;
    };

    async function asyncPausedAt(marker: string, options: { condition?: string; launchArgs?: Record<string, unknown> } = {}): Promise<void> {
      server = await startStdioClient({ name: 'js-stepper-async' });
      await server.createSession('javascript', 'js-stepper-async');
      const set = await server.call('set_breakpoint', {
        file: ASYNC_FIXTURE,
        line: at(marker),
        ...(options.condition ? { condition: options.condition } : {})
      });
      expect(set.success, JSON.stringify(set)).toBe(true);
      let stop = await server.call<StopAnswer>('start_debugging', {
        scriptPath: ASYNC_FIXTURE,
        ...(options.launchArgs ? { dapLaunchArgs: options.launchArgs } : {})
      });
      expect(stop.success, JSON.stringify(stop)).toBe(true);
      if (stop.state !== 'paused') {
        stop = await server.call<StopAnswer>('wait_for_stop', { timeout: 20000 });
      }
      expect(stop, JSON.stringify(stop)).toMatchObject({ success: true, state: 'paused' });
      expect(stop.location?.line, JSON.stringify(stop)).toBe(at(marker));
    }

    function expectAsyncLanding(answer: StopAnswer & { ms: number }, marker: string): void {
      expect(answer, JSON.stringify(answer)).toMatchObject({ success: true, state: 'paused' });
      expect(answer.pending, JSON.stringify(answer)).toBeUndefined();
      expect(answer.location?.file ?? '', JSON.stringify(answer)).toMatch(/async-steps\.cjs$/);
      expect(answer.location?.line, JSON.stringify(answer)).toBe(at(marker));
      expect(answer.ms, `took ${answer.ms} ms: ${JSON.stringify(answer)}`).toBeLessThan(PROMPT_MS);
    }

    it('step_out of an async function lands in the call that awaited it, with other calls of the same function in flight', async () => {
      await asyncPausedAt('in inner, after the gate', { condition: 'id === 2' });
      const answer = await step('step_out');
      expectAsyncLanding(answer, 'the continuation of handler');
      // A temporary breakpoint on `handler` stopped in handler(1), whose
      // continuation was queued first. V8's own step finds handler(2).
      const id = await server!.call<ToolAnswer & { result?: string }>('evaluate_expression', { expression: 'id' });
      expect(id.result, JSON.stringify(id)).toBe('2');
      expect(answer.message).toBe('Stepped out');
    }, 60000);

    it('step_over on an await lands on the next line of the same function, though the function has a finally clause', async () => {
      await asyncPausedAt('an await before the try');
      // With a temporary breakpoint on the caller, the step stopped there the
      // moment this function suspended.
      expectAsyncLanding(await step('step_over'), 'an await inside the try');
      expectAsyncLanding(await step('step_over'), 'the return inside the try');
      expectAsyncLanding(await step('step_over'), 'the finally block of an async function');
      // Off the finally block of an async function V8 loses the step, and the
      // server does not rescue it (#1174): the program runs on to its end.
      const out = await step('step_over');
      expect(out, JSON.stringify(out)).toMatchObject({ success: true });
      expect(out.state, JSON.stringify(out)).not.toBe('paused');
    }, 60000);

    it('step_over on a statement that awaits on a later line stays in the function: its caller runs on, and is not where the step stops', async () => {
      await asyncPausedAt('a statement that awaits on later lines');
      // The function has a finally clause above, and the paused line itself
      // awaits nothing. A temporary breakpoint on the caller stopped the step
      // at the caller's next statement, the moment this function suspended.
      const answer = await step('step_over');
      expectAsyncLanding(answer, 'the second await of the statement');
      expect(answer.message).toBe('Stepped over');
    }, 60000);

    it('step_out of an async function still in its first run lands in the call that awaits it, with other calls in flight', async () => {
      await asyncPausedAt('in early, before its first await', { condition: 'id === 2' });
      const answer = await step('step_out');
      expectAsyncLanding(answer, 'the continuation of relay');
      // A temporary breakpoint on `relay`, kept by depth, stopped in relay(3)
      // as it was entered: relay(2) had left the stack at its own await.
      const id = await server!.call<ToolAnswer & { result?: string }>('evaluate_expression', { expression: 'id' });
      expect(id.result, JSON.stringify(id)).toBe('2');
      expect(answer.message).toBe('Stepped out');
    }, 60000);

    it('step_out of a .then callback resumes the program: what registered the callback is not what it returns to', async () => {
      await asyncPausedAt('in a then callback');
      const answer = await step('step_out');
      // Nothing of the program is on the stack and nothing awaits the
      // callback: the program runs to its end, 150 ms later.
      expect(answer, JSON.stringify(answer)).toMatchObject({ success: true });
      expect(answer.state, JSON.stringify(answer)).not.toBe('paused');
    }, 60000);

    it('steps with V8 alone where Node\'s own code is program code: a skip list without <node_internals>', async () => {
      await asyncPausedAt('in a timer callback', { launchArgs: { skipFiles: ['**/node_modules/**'] } });
      const answer = await step('step_out');
      // V8 gives no break positions for Node's own scripts, so there is no
      // temporary breakpoint to set on the timer code this returns to. The
      // step used to fail for it, and leave the session in `error`.
      expect(answer, JSON.stringify(answer)).toMatchObject({ success: true, state: 'paused' });
      expect(answer.location?.file ?? '', JSON.stringify(answer)).toMatch(/timers/);
    }, 60000);
  });
});
