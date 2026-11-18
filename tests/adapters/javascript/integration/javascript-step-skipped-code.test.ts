/**
 * The server's own JavaScript stepper, through a real server, the real
 * js-debug and a real Node (issues #1130, #1161).
 *
 * js-debug's smart stepper is off for every session; the server decides
 * where a step ends. What that has to hold, as measured:
 *
 *   - a step_into on a line that calls only Node's own code lands on the
 *     next line. Where it lands is the program's to decide, not the host's:
 *     the walk is bounded by engine steps only, so where an engine step is
 *     slow (about 44 ms on Linux, issue #1163) the step first answers
 *     `pending`, saying it is walking through skipped code, and lands in the
 *     same place; these tests accept either and assert the line strictly.
 *     js-debug's stepper lost that step on the first console.log of a
 *     process (the session ended), and took about 6 s on a Linux host for a
 *     later one;
 *   - a call through Node's code into a callback of the program's is
 *     followed (an on() or once() listener); a call that only starts a later
 *     task is not;
 *   - a pause in the program's code is the landing, on the line the step
 *     started from too: a one-line loop stops at its header's next position;
 *   - in a bundle, js-debug's verdict is asked at each landing: a stop in a
 *     bundled dependency does not make the program's lines of the same
 *     script count as skipped;
 *   - a step that leaves a function through `return` inside try...finally
 *     is the engine's own. V8 loses it (issues #1161, #1174; Node 22, 24
 *     and 26), sync and async, and the server does not rescue it. Those
 *     tests accept both a runtime that loses the step and one that lands it
 *     in the caller, and fail on a stop anywhere else (another call of the
 *     same function). Every one of them is lost on main too (measured: 3 of
 *     3 runs each); every step main lands is asserted strictly;
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
  snapshot?: { frames?: Array<{ name: string; line: number }> };
  /** wait_for_stop's record of the stop. */
  lastStop?: { reason?: string };
};

/**
 * Inside the 5 s window after which a step answers `pending` (the step
 * grace window), with room for the answer's own stack reads: a step that
 * answers under this bound landed by itself.
 */
const PROMPT_MS = 4500;

/**
 * The sentence a step_into carries when its walk through skipped code took
 * all of its 512 engine steps and it stepped out. The walk's only bound:
 * where it lands does not depend on what an engine step costs on the host.
 */
function expectWalkEnded(message: string | undefined): void {
  expect(message).toBe(`Stepped into. ${ErrorMessages.stepIntoReachedNoProgramCode(512)}`);
}

/**
 * The sentence a pending step_into carries while the stepper is walking it
 * through skipped code (round 3, decision 2).
 */
const WALKING = /The stepper's last record of this step is that it is walking through skipped code/;

/**
 * How long a step whose walk outlasted the grace window may take to land:
 * 512 engine steps at about 44 ms each on Linux (issue #1163) is about 23 s,
 * and the step-outs after it more. A harness bound, not the step's.
 */
const WALK_WAIT_MS = 90000;

/**
 * A step V8 loses (issues #1161, #1174) is the engine's own, and the server
 * does not rescue it. On a runtime that loses it the step does not land: the
 * program runs on (`pending: true`, state `running`) or ends. On one that
 * does not, it lands in the caller. Either passes; a stop anywhere else
 * fails, another call of the function left included. Every caller these
 * tests name runs once, so a line of it identifies the call.
 */
function expectInCallerOrLost(answer: StopAnswer & { ms: number }, file: RegExp, callerLines: number[], options: { walked?: boolean } = {}): void {
  expect(answer.success, JSON.stringify(answer)).toBe(true);
  if (answer.state !== 'paused') {
    // Lost: the program ran on, or ended.
    return;
  }
  expect(answer.pending, JSON.stringify(answer)).toBeUndefined();
  expect(answer.stopReason, JSON.stringify(answer)).toBeUndefined();
  expect(answer.location?.file ?? '', JSON.stringify(answer)).toMatch(file);
  expect(callerLines, JSON.stringify(answer)).toContain(answer.location?.line);
  if (answer.lastStop) {
    // Read by wait_for_stop after a pending answer: the stop is the step's.
    expect(answer.lastStop.reason, JSON.stringify(answer)).toBe('step');
  }
  // A step that walked through skipped code takes as long as its engine
  // steps take on the host: only a step that did not walk is held to the window.
  if (!options.walked) {
    expect(answer.ms, `took ${answer.ms} ms: ${JSON.stringify(answer)}`).toBeLessThan(PROMPT_MS);
  }
}

describe('The server\'s JavaScript stepper against a real js-debug (issues #1130, #1161) @requires-node', () => {
  let server: StdioClientHandle | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  async function pausedAt(
    marker: string,
    launchArgs?: Record<string, unknown>,
    extraBreakpoints: string[] = [],
    programArgs?: string[]
  ): Promise<StopAnswer> {
    server = await startStdioClient({ name: 'js-stepper' });
    await server.createSession('javascript', 'js-stepper');
    for (const at of [marker, ...extraBreakpoints]) {
      const set = await server.call('set_breakpoint', { file: FIXTURE, line: lineOf(at) });
      expect(set.success, JSON.stringify(set)).toBe(true);
    }
    let stop = await server.call<StopAnswer>('start_debugging', {
      scriptPath: FIXTURE,
      ...(programArgs ? { args: programArgs } : {}),
      ...(launchArgs ? { dapLaunchArgs: launchArgs } : {})
    });
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

  function expectLanding(answer: StopAnswer & { ms: number }, marker: string, options: { walked?: boolean } = {}): void {
    expect(answer, JSON.stringify(answer)).toMatchObject({ success: true, state: 'paused' });
    expect(answer.pending, JSON.stringify(answer)).toBeUndefined();
    expect(answer.stopReason, JSON.stringify(answer)).toBeUndefined();
    expect(answer.location?.file ?? '', JSON.stringify(answer)).toMatch(/steps\.cjs$/);
    expect(answer.location?.line, JSON.stringify(answer)).toBe(lineOf(marker));
    if (answer.lastStop) {
      // Read by wait_for_stop after a pending answer: the stop is the step's.
      expect(answer.lastStop.reason, JSON.stringify(answer)).toBe('step');
    }
    // A step that walked through skipped code takes as long as its engine
    // steps take on the host: only a step that did not walk is held to the window.
    if (!options.walked) {
      expect(answer.ms, `took ${answer.ms} ms: ${JSON.stringify(answer)}`).toBeLessThan(PROMPT_MS);
    }
  }

  /**
   * A step whose walk through skipped code can outlast the grace window on a
   * slow inspector link (round 3, decision 6): it answers where it landed at
   * once, or `pending` with the stepper's walking sentence, and then
   * wait_for_stop answers where it landed. The landing is what is returned
   * (`first` keeps the first answer); the caller asserts its line strictly
   * either way.
   */
  async function walkingStep(
    tool: 'step_into' | 'step_over' | 'step_out',
    options: { walkingWhenPending?: boolean } = {}
  ): Promise<StopAnswer & { ms: number; first: StopAnswer }> {
    const started = Date.now();
    const first = await server!.call<StopAnswer>(tool, {});
    if (!first.pending) {
      return { ...first, ms: Date.now() - started, first };
    }
    if (options.walkingWhenPending !== false) {
      expect(first.message ?? '', JSON.stringify(first)).toMatch(WALKING);
      // Issue #1130's complaint: the pending answer blamed "a long-running
      // call" and promised a pause. A step recorded as walking does neither.
      expect(first.message ?? '', JSON.stringify(first)).toMatch(/^Step dispatched; it has not landed after 5s\./);
      expect(first.message ?? '', JSON.stringify(first)).not.toMatch(/long-running call|will become 'paused'/);
    }
    const landed = await server!.call<StopAnswer>('wait_for_stop', { timeout: WALK_WAIT_MS });
    return { ...landed, ms: Date.now() - started, first };
  }

  /** Removes the breakpoint on a marked line, so a later call through that line does not stop on it. */
  async function removeBreakpointAt(marker: string): Promise<void> {
    const removed = await server!.call('remove_breakpoint', { file: FIXTURE, line: lineOf(marker) });
    expect(removed.success, JSON.stringify(removed)).toBe(true);
  }

  describe('step_into (issue #1130)', () => {
    it('lands on the next line when the walk into the call stays in Node\'s own code: the first console.log of the process', async () => {
      await pausedAt('the first console.log');
      const answer = await walkingStep('step_into');
      // js-debug's own stepper lost this step: "Step completed as session exited."
      expectLanding(answer, 'after the first console.log', { walked: true });
      // Measured through the server on Windows: 391 engine steps, back out by
      // step-ins (a plain landing) in about 1 s. At about 44 ms an engine step
      // (Linux) the same walk outlasts the grace window: the first answer is
      // pending and says the step is walking, and it lands on the same line.
      if (!answer.first.pending && answer.message !== 'Stepped into') {
        expectWalkEnded(answer.message);
      }
    }, 150000);

    it('lands on the next line of a later console.log: issue #1130\'s own case', async () => {
      await pausedAt('a later console.log');
      const answer = await walkingStep('step_into');
      expectLanding(answer, 'after a later console.log', { walked: true });
      // 130 engine steps through the server on Windows, walked back out by
      // step-ins (a plain landing); pending first, then the same landing, where
      // an engine step costs about 44 ms.
      if (!answer.first.pending && answer.message !== 'Stepped into') {
        expectWalkEnded(answer.message);
      }
    }, 150000);

    it('stays in the first iteration of a one-line loop: the header\'s next position on the same line is the landing', async () => {
      await pausedAt('a one-line loop');
      const answer = await step('step_into');
      expectLanding(answer, 'a one-line loop');
      expect(answer.message).toBe('Stepped into');
      // The loop variable is not bound yet, or holds the first item.
      const item = await server!.call<ToolAnswer & { result?: string }>('evaluate_expression', {
        expression: "(() => { try { return String(item); } catch (e) { return 'TDZ'; } })()"
      });
      expect(['\'TDZ\'', 'TDZ', '\'1\'', '1'], JSON.stringify(item)).toContain(item.result);
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

    it('follows a call through Node\'s once-wrapper into the program\'s listener: a walk longer than 24 engine steps', async () => {
      await pausedAt('emits to a once listener');
      const answer = await step('step_into');
      expectLanding(answer, 'in the once listener');
      expect(answer.message).toBe('Stepped into');
    }, 60000);

    it('enters the program\'s listener however long Node\'s code before it runs: a walk is counted in engine steps, never the clock (review 8, C1)', async () => {
      await pausedAt('emits after a slow listener', undefined, [], ['slow-listener']);
      const answer = await walkingStep('step_into');
      expectLanding(answer, 'in the listener after a slow one', { walked: true });
      // The listener before it blocked for 3.5 s: a clock bound of the walk
      // (3 s, before round 3) gave up there and landed on the next line.
      expect(answer.ms, JSON.stringify(answer)).toBeGreaterThanOrEqual(3000);
    }, 150000);

    it('does not follow a call into a later task: the next line, not the timer\'s callback', async () => {
      await pausedAt('starts a later task');
      // The walk through Node's timer code outlasts the grace window where an
      // engine step costs about 44 ms (measured on a Linux host): pending
      // first, then the same landing.
      expectLanding(await walkingStep('step_into'), 'after setTimeout', { walked: true });
    }, 150000);

    it('lands on the next line of a require of a module not yet loaded, or V8 loses the step (the loader returns through try...finally, issue #1161)', async () => {
      await pausedAt('first load of a module');
      // The loader is a long walk through Node's code: on a slow inspector
      // link the first answer is pending, and what follows is judged the same
      // way. A pending answer need not say the step is walking: js-debug's
      // own module-entry pause withdraws that record (the step may be lost
      // with it, issue #1162), and a walk at its limit is stepping out.
      const answer = await walkingStep('step_into', { walkingWhenPending: false });
      expectInCallerOrLost(answer, /steps\.cjs$/, [lineOf('after the require')], { walked: true });
    }, 150000);
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

  describe('a step that leaves a function through return inside try...finally (issues #1161, #1174)', () => {
    // withFinally is called twice: from syncPart, where these tests pause,
    // and later from main. Its caller here is syncPart, which runs once.
    const CALLER = (): number[] => [lineOf('calls withFinally'), lineOf('after withFinally')];

    it('step_out lands in the caller, or V8 loses it: never in another call', async () => {
      await pausedAt('return inside try-finally');
      // So main's later call of withFinally does not stop on it.
      await removeBreakpointAt('return inside try-finally');
      // The call's own line too: V8's step-out can stop there once more.
      expectInCallerOrLost(await step('step_out'), /steps\.cjs$/, CALLER());
    }, 60000);

    it('step_over reaches the finally block; the step off it is V8\'s: the caller, lost, or the known stop in the next call of the function (#1161)', async () => {
      await pausedAt('return inside try-finally');
      await removeBreakpointAt('return inside try-finally');
      expectLanding(await step('step_over'), 'the finally block');
      // The step that leaves the function is V8's own, and the server does not
      // rescue it. A runtime with V8's fix lands it in the caller; one that
      // loses it runs on. Today's V8 does a third thing, the known defect that
      // docs/javascript/README.md states ("can instead stop in the next call
      // of the same function"): it stops on the first statement of main's
      // later call of withFinally and reports that as the step. This test
      // names that stop, the frame under it included, so any other stop fails.
      const answer = await step('step_over');
      const inTheNextCall = answer.state === 'paused' && answer.location?.line === lineOf('return inside try-finally');
      if (inTheNextCall) {
        expect(answer.stopReason, JSON.stringify(answer)).toBeUndefined();
        expect(answer.snapshot?.frames?.[1]?.line, JSON.stringify(answer)).toBe(lineOf('calls withFinally from an async function'));
        return;
      }
      expectInCallerOrLost(answer, /steps\.cjs$/, CALLER());
    }, 60000);

    it('step_out into an async caller lands in that caller, or V8 loses it (#1174)', async () => {
      await pausedAt('return inside try-finally', undefined, ['calls withFinally from an async function']);
      // The first stop is the call from the plain caller: run to the second.
      let stop = await server!.call<StopAnswer>('continue_execution', {});
      stop = await server!.call<StopAnswer>('wait_for_stop', { timeout: 20000 });
      expect(stop.location?.line, JSON.stringify(stop)).toBe(lineOf('calls withFinally from an async function'));
      stop = await server!.call<StopAnswer>('step_into', {});
      expect(stop.location?.line, JSON.stringify(stop)).toBe(lineOf('return inside try-finally'));
      // main runs once; withFinally is not called again after this.
      expectInCallerOrLost(await step('step_out'), /steps\.cjs$/, [
        lineOf('calls withFinally from an async function'),
        lineOf('after withFinally from an async function')
      ]);
    }, 60000);

    it('step_out of an async function with that shape lands in the function that awaits it, or V8 loses it (#1174)', async () => {
      await pausedAt('async return inside try-finally');
      // A runtime with V8's fix (#1173) lands it; the docs then need updating.
      expectInCallerOrLost(await step('step_out'), /steps\.cjs$/, [lineOf('awaits workWithFinally'), lineOf('after the await')]);
    }, 60000);
  });

  describe('a bundle: one script, a dependency\'s lines and the program\'s (C1)', () => {
    const BUNDLE = path.resolve(here, '../../../fixtures/javascript/step-skipped-code/bundle');
    const SCRIPT = path.join(BUNDLE, 'out', 'bundle.js');
    const APP = path.join(BUNDLE, 'src', 'app.js');
    const LIB = path.join(BUNDLE, 'node_modules', 'blib', 'index.js');
    /** The 1-based line of `file` that carries `// <marker>`. */
    const markerLine = (file: string, marker: string): number => {
      const index = fs.readFileSync(file, 'utf8').split('\n').findIndex((line) => new RegExp(`// ${marker}(?![A-Z-])`).test(line));
      if (index === -1) {
        throw new Error(`no line marked "${marker}" in ${file}`);
      }
      return index + 1;
    };

    function expectInApp(answer: StopAnswer & { ms: number }, marker: string): void {
      expect(answer, JSON.stringify(answer)).toMatchObject({ success: true, state: 'paused' });
      expect(answer.pending, JSON.stringify(answer)).toBeUndefined();
      expect(answer.stopReason, JSON.stringify(answer)).toBeUndefined();
      expect(answer.location?.file ?? '', JSON.stringify(answer)).toMatch(/app\.js$/);
      expect(answer.location?.line, JSON.stringify(answer)).toBe(markerLine(APP, marker));
      expect(answer.ms, `took ${answer.ms} ms: ${JSON.stringify(answer)}`).toBeLessThan(PROMPT_MS);
    }

    it('steps on through the program\'s lines after a stop inside the bundled dependency', async () => {
      server = await startStdioClient({ name: 'js-stepper-bundle' });
      await server.createSession('javascript', 'js-stepper-bundle');
      const set = await server.call('set_breakpoint', { file: LIB, line: markerLine(LIB, 'BLIB-WORK') });
      expect(set.success, JSON.stringify(set)).toBe(true);
      let stop = await server.call<StopAnswer>('start_debugging', { scriptPath: SCRIPT });
      if (stop.state !== 'paused') {
        stop = await server.call<StopAnswer>('wait_for_stop', { timeout: 20000 });
      }
      expect(stop, JSON.stringify(stop)).toMatchObject({ success: true, state: 'paused' });
      expect(stop.location?.file ?? '', JSON.stringify(stop)).toMatch(/blib[\\/]index\.js$/);
      // The dependency's code is skipped: step_over comes back to the caller's next line.
      expectInApp(await step('step_over'), 'B-AFTER-LIBWORK');
      // The program's lines of the same script are program code to the steps after it.
      expectInApp(await step('step_over'), 'B-CALLS-MINE');
      expectInApp(await step('step_into'), 'B-IN-MINE');
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
      // Three calls of handler are in flight, handler(1)'s continuation
      // queued first: V8's own step finds handler(2), the one that awaited.
      const id = await server!.call<ToolAnswer & { result?: string }>('evaluate_expression', { expression: 'id' });
      expect(id.result, JSON.stringify(id)).toBe('2');
      expect(answer.message).toBe('Stepped out');
    }, 60000);

    it('step_over on an await lands on the next line of the same function, though the function has a finally clause', async () => {
      await asyncPausedAt('an await before the try');
      // None of these steps leaves the function without crossing an await first: V8 does not lose them.
      expectAsyncLanding(await step('step_over'), 'an await inside the try');
      expectAsyncLanding(await step('step_over'), 'the return inside the try');
      expectAsyncLanding(await step('step_over'), 'the finally block of an async function');
      // Off the finally block of an async function V8 loses the step, and the
      // server does not rescue it (#1174). closing is called once, from main.
      expectInCallerOrLost(await step('step_over'), /async-steps\.cjs$/, [at('awaits closing'), at('after closing')]);
    }, 60000);

    it('step_over on a statement that awaits on a later line stays in the function: its caller runs on, and is not where the step stops', async () => {
      await asyncPausedAt('a statement that awaits on later lines');
      // The function has a finally clause above, and the paused line itself
      // awaits nothing: the step crosses the await on the next line and stays
      // in the function while its caller runs on.
      const answer = await step('step_over');
      expectAsyncLanding(answer, 'the second await of the statement');
      expect(answer.message).toBe('Stepped over');
    }, 60000);

    it('step_out of an async function still in its first run lands in the call that awaits it, with other calls in flight', async () => {
      await asyncPausedAt('in early, before its first await', { condition: 'id === 2' });
      const answer = await step('step_out');
      expectAsyncLanding(answer, 'the continuation of relay');
      // Three calls of relay are in flight: the id says the step landed in
      // relay(2), the one that awaited this early.
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
      // Node's own code is program code to this step: V8's step-out lands
      // in the timer code it returns to.
      expect(answer, JSON.stringify(answer)).toMatchObject({ success: true, state: 'paused' });
      expect(answer.location?.file ?? '', JSON.stringify(answer)).toMatch(/timers/);
    }, 60000);
  });
});
