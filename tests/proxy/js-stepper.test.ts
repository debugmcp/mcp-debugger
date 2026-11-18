/**
 * The proxy's own JavaScript stepper (issue #1130), against a scripted V8
 * and a scripted js-debug.
 *
 * The engine below plays what was measured through the real pair (the spike
 * notes of the issue): every step command is answered, then `Debugger.resumed`
 * and the next scripted `Debugger.paused` arrive; js-debug marks frame 0 of a
 * `stackTrace` answer `deemphasize` for skipped code; and for every pause it
 * keeps it sends one DAP `stopped` (reason `pause` for a step it did not
 * request, `breakpoint` for a breakpoint hit) a moment later, and one
 * `continued` per resume.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { JsStepper, DEFAULT_JS_STEPPER_TUNABLES, type JsStepperTunables } from '../../src/proxy/js-stepper.js';
import { PROXY_STEP_LEFT_STACK_EVENT } from '../../src/proxy/dap-proxy-interfaces.js';
import { ErrorMessages } from '../../src/utils/error-messages.js';

interface Frame {
  fn: string;
  script?: string;
  /** 0-based line of the frame's position. */
  line: number;
  col?: number;
  /** js-debug marks it skipped code. */
  skipped?: boolean;
  /** The mark's wording, js-debug's `source.origin`: "Skipped by skipFiles" (the default) or "Skipped by smartStep". */
  origin?: string;
  /**
   * The source js-debug names for the frame. By default: `<node_internals>/…`
   * for a `node:` script (with a sourceReference, as js-debug answers for
   * Node's own modules), `/app/<script>.js` for any other.
   */
  path?: string;
}

interface ScriptedPause {
  frames: Frame[];
  reason?: string;
  /** Breakpoint ids V8 reports: js-debug's own, the stepper sets none. */
  hits?: string[];
  /** js-debug resumes this pause itself (a module-entry breakpoint): no `stopped`, then a `resumed`. */
  resumedByJsDebug?: boolean;
  /** What js-debug reports this pause as. */
  dapReason?: string;
  /**
   * The first frame of the async stack, and what V8 calls the link: `await`
   * (the default: the function on top returns to it), `Promise.then`,
   * `Timeout` (it only scheduled the code on top).
   */
  asyncParent?: {
    fn: string; script?: string; line: number; col?: number; skipped?: boolean; description?: string;
    /** `await` links with no frames before the one that has the awaiter (V8 lists them for later awaits). */
    emptyLinks?: number;
  };
}

/** The 0-based line a function starts on: a hundred lines of its own per function name. */
const FN_LINES: Record<string, number> = {};
function fnLineOf(frame: Frame): number {
  FN_LINES[frame.fn] ??= 1000 + Object.keys(FN_LINES).length * 100;
  return FN_LINES[frame.fn];
}

/** A scripted V8 behind a CDP socket, and the js-debug that watches it. */
class Engine extends EventEmitter {
  calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  /** What the next resuming command leads to: a pause, or nothing (the program runs). */
  script: Array<ScriptedPause | 'runs'> = [];
  connected = true;
  current: ScriptedPause | null = null;
  /** DAP events js-debug sent, in order: the test feeds them to the stepper. */
  onDap: (event: DebugProtocol.Event) => void = () => undefined;
  stackTraceFailures = 0;
  stackTraceCalls: number[] = [];
  /** A CDP method that fails the next time it is sent. */
  failOnce: string | null = null;

  isConnected(): boolean {
    return this.connected;
  }

  async send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    this.calls.push({ method, params });
    if (this.failOnce === method) {
      this.failOnce = null;
      throw new Error(`${method}: refused`);
    }
    switch (method) {
      case 'Debugger.stepInto':
      case 'Debugger.stepOver':
      case 'Debugger.stepOut':
      case 'Debugger.resume':
        if (!this.current) throw new Error(`${method}: Can only perform operation while paused.`);
        this.current = null;
        setImmediate(() => this.advance(true));
        return {} as T;
      default:
        return {} as T;
    }
  }

  /** V8 pauses here now (the stop a step starts from). */
  pauseAt(pause: ScriptedPause): void {
    this.current = pause;
    this.emit('cdp-event', 'Debugger.paused', this.toCdp(pause));
  }

  /** The running program pauses here by itself (a breakpoint, a pause request, a late landing), js-debug's report included. */
  arrive(pause: ScriptedPause): void {
    this.script.unshift(pause);
    this.advance(false);
  }

  private advance(resumedFirst: boolean): void {
    if (resumedFirst) {
      this.emit('cdp-event', 'Debugger.resumed', {});
      this.onDap({ seq: 0, type: 'event', event: 'continued', body: { threadId: 1, allThreadsContinued: false } });
    }
    const next = this.script.shift();
    if (!next || next === 'runs') {
      return;
    }
    this.current = next;
    this.emit('cdp-event', 'Debugger.paused', this.toCdp(next));
    if (next.resumedByJsDebug) {
      // js-debug's own resume: the step in flight is gone with the pause.
      setImmediate(() => {
        this.current = null;
        this.advance(true);
      });
      return;
    }
    // js-debug reports a kept pause a timer tick later.
    setTimeout(() => {
      const hits = this.hitsOf(next);
      const reason = next.dapReason ?? (hits.length > 0 ? 'breakpoint' : 'pause');
      this.onDap({
        seq: 0,
        type: 'event',
        event: 'stopped',
        body: {
          reason,
          description: reason === 'pause' ? 'Paused on debugger statement' : 'Paused on breakpoint',
          threadId: 1,
          allThreadsStopped: false,
          ...(reason === 'breakpoint' ? { hitBreakpointIds: [] } : {})
        }
      });
    }, 3);
  }

  private hitsOf(pause: ScriptedPause): string[] {
    return pause.hits ?? [];
  }

  private toCdp(pause: ScriptedPause): Record<string, unknown> {
    const hits = this.hitsOf(pause);
    return {
      reason: pause.reason ?? (hits.length > 0 ? 'other' : 'step'),
      hitBreakpoints: hits,
      callFrames: pause.frames.map((f) => ({
        functionName: f.fn,
        functionLocation: { scriptId: f.script ?? 'app', lineNumber: fnLineOf(f), columnNumber: 0 },
        location: { scriptId: f.script ?? 'app', lineNumber: f.line, columnNumber: f.col ?? 0 }
      })),
      ...(pause.asyncParent ? { asyncStackTrace: this.asyncTrace(pause.asyncParent) } : {})
    };
  }

  private asyncTrace(parent: NonNullable<ScriptedPause['asyncParent']>): Record<string, unknown> {
    let trace: Record<string, unknown> = {
      description: parent.description ?? 'await',
      callFrames: [{ functionName: parent.fn, scriptId: parent.script ?? 'app', lineNumber: parent.line, columnNumber: parent.col ?? 0 }]
    };
    for (let i = 0; i < (parent.emptyLinks ?? 0); i++) {
      trace = { description: 'await', callFrames: [], parent: trace };
    }
    return trace;
  }

  /** js-debug's `stackTrace` answer for the pause V8 is in. */
  stackTrace(levels: number): DebugProtocol.StackTraceResponse {
    this.stackTraceCalls.push(levels);
    if (this.stackTraceFailures > 0) {
      this.stackTraceFailures--;
      throw new Error('Thread is not paused');
    }
    const pause = this.current;
    if (!pause) {
      throw new Error('Thread is not paused');
    }
    // js-debug's answer, in the shape its log shows: Node's own module as
    // `<node_internals>/internal/console/constructor` with a sourceReference
    // and `origin: "Skipped by skipFiles"`, a file on disk by its path.
    const mark = (f: { fn: string; line: number; skipped?: boolean; origin?: string; script?: string; path?: string }, id: number): DebugProtocol.StackFrame => {
      const script = f.script ?? 'app';
      const internal = script.startsWith('node:');
      return {
        id,
        name: f.fn,
        line: f.line + 1,
        column: 1,
        source: {
          path: f.path ?? (internal ? `<node_internals>/${script.slice('node:'.length)}` : `/app/${script}.js`),
          ...(internal ? { sourceReference: 1000 + id } : {}),
          ...(f.skipped ? { origin: f.origin ?? 'Skipped by skipFiles' } : {})
        },
        presentationHint: (f.skipped ? 'deemphasize' : 'normal') as DebugProtocol.StackFrame['presentationHint']
      };
    };
    const frames = pause.frames.map(mark);
    if (pause.asyncParent) {
      for (let i = 0; i < (pause.asyncParent.emptyLinks ?? 0); i++) {
        frames.push({ id: 890 + i, name: 'await', line: 0, column: 0, presentationHint: 'label' });
      }
      frames.push({ id: 900, name: pause.asyncParent.description ?? 'await', line: 0, column: 0, presentationHint: 'label' });
      frames.push(mark(pause.asyncParent, 901));
    }
    return { body: { stackFrames: frames.slice(0, levels) } } as DebugProtocol.StackTraceResponse;
  }
}

const tick = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function frames(...list: Frame[]): Frame[] {
  return list;
}

/** A program frame, and a frame of Node's own code. */
const app = (fn: string, line: number, extra: Partial<Frame> = {}): Frame => ({ fn, line, ...extra });
const node = (fn: string, line: number, extra: Partial<Frame> = {}): Frame => ({ fn, line, script: 'node:internal', skipped: true, ...extra });

describe('JsStepper (issue #1130)', () => {
  let engine: Engine;
  let stepper: JsStepper;
  let delivered: DebugProtocol.Event[];
  /** Every DAP event of the target, with whether the stepper kept it. */
  let seen: Array<{ event: string; withheld: boolean }>;

  const commands = (): string[] => engine.calls.map((c) => c.method).filter((m) => /step|resume/.test(m));
  /** The record a step that ended by leaving the stack delivers instead of a stop (I3). */
  const LEFT_STACK = expect.objectContaining({ type: 'event', event: PROXY_STEP_LEFT_STACK_EVENT });
  const stopped = (): DebugProtocol.StoppedEvent['body'] => delivered[0].body as DebugProtocol.StoppedEvent['body'];

  /** Wait until the chain is over and every event js-debug owes has arrived. */
  async function settled(): Promise<void> {
    await vi.waitFor(() => {
      expect(stepper.describe().chain).toBe(false);
    }, { timeout: 2000, interval: 2 });
    await tick(12);
  }

  beforeEach(() => {
    engine = new Engine();
    delivered = [];
    seen = [];
    stepper = new JsStepper({
      target: {
        sendRequest: async (command: string, args?: unknown) => {
          if (command !== 'stackTrace') throw new Error(`unexpected ${command}`);
          return engine.stackTrace((args as { levels: number }).levels) as never;
        }
      },
      deliver: (event) => delivered.push(event),
      tunables: { settleCeilingMs: 150, verdictCeilingMs: 150 }
    });
    engine.onDap = (event) => {
      seen.push({ event: event.event, withheld: stepper.withholds(event) });
    };
    stepper.attachCdp(engine);
    stepper.setEnabled(true);
  });

  describe('which requests it serves', () => {
    it('serves the three steps of a session that steps through skipped code, while V8 is paused', () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      expect(stepper.handles('stepIn')).toBe(true);
      expect(stepper.handles('next')).toBe(true);
      expect(stepper.handles('stepOut')).toBe(true);
      expect(stepper.handles('continue')).toBe(false);
    });

    it('leaves the steps to the adapter when the session chose plain steps', () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      stepper.setEnabled(false);
      expect(stepper.handles('stepIn')).toBe(false);
    });

    it('leaves a step into a named target to the adapter', () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      expect(stepper.handles('stepIn', { threadId: 1, targetId: 3 })).toBe(false);
    });

    it('serves nothing without a CDP socket, or before it has seen a pause', () => {
      expect(stepper.handles('next')).toBe(false);
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.connected = false;
      expect(stepper.handles('next')).toBe(false);
    });
  });

  describe('a step that V8 lands in program code', () => {
    it('sends one CDP command and reports one stopped, as a step', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(app('main', 11)) }];

      const response = await stepper.request('next', { threadId: 1 });
      expect(response).toMatchObject({ success: true, command: 'next' });
      await settled();

      expect(commands()).toEqual(['Debugger.stepOver']);
      expect(delivered).toHaveLength(1);
      // js-debug called it a pause on a debugger statement, which the core
      // would read as a breakpoint or an entry stop: it leaves as a step.
      expect(stopped()).toMatchObject({ reason: 'step', description: 'Paused', threadId: 1 });
      expect(stopped().text).toBeUndefined();
      // js-debug's own stopped and continued for the step were kept back.
      expect(seen).toEqual([{ event: 'continued', withheld: true }, { event: 'stopped', withheld: true }]);
    });

    it('never asks V8 to follow a call into a later task', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(app('callee', 30), app('main', 10)) }];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(engine.calls.find((c) => c.method === 'Debugger.stepInto')?.params).toEqual({ breakOnAsyncCall: false });
    });
  });

  describe('a step into skipped code', () => {
    it('steps in again until the program\'s code is on top', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(node('emit', 5), app('main', 10)) },
        { frames: frames(node('emit', 6), app('main', 10)) },
        { frames: frames(app('listener', 40), node('emit', 7), app('main', 10)) }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();

      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto']);
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(stopped().text).toBeUndefined();
      // Three kept pauses, three stopped events from js-debug, one reported.
      expect(seen.filter((e) => e.event === 'stopped')).toEqual(Array(3).fill({ event: 'stopped', withheld: true }));
      expect(delivered).toHaveLength(1);
    });

    it('asks js-debug once about a script of Node\'s own: one source at every position, which it names <node_internals>', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(node('a', 1), app('main', 10)) },
        { frames: frames(node('a', 2), app('main', 10)) },
        { frames: frames(node('a', 3), app('main', 10)) },
        { frames: frames(app('main', 11)) }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      // One levels-1 question for the frame the step starts from, one for
      // the node script, one for the landing.
      expect(engine.stackTraceCalls.filter((levels) => levels === 1)).toHaveLength(3);
    });

    it('asks js-debug at every landing in a skipped node_modules file: its verdict is on a source, not on a script (C1)', async () => {
      const dep = (line: number): Frame => ({ fn: 'mix', line, script: 'blib', path: '/app/node_modules/blib/index.js', skipped: true });
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(dep(1), app('main', 10)) },
        { frames: frames(dep(2), app('main', 10)) },
        { frames: frames(dep(3), app('main', 10)) },
        { frames: frames(app('handler', 40), dep(4), app('main', 10)) }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      // The frame the step starts from, and each of the four landings.
      expect(engine.stackTraceCalls.filter((levels) => levels === 1)).toHaveLength(5);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });

    it('lands in the program\'s code of a bundle after a landing in a dependency of the same script: js-debug is asked again (C1)', async () => {
      // An esbuild bundle: one script, many sources. js-debug skips the
      // dependency's lines (a node_modules source) and not the program's.
      const lib = (line: number): Frame => ({ fn: 'mix', line, script: 'bundle', path: '/app/node_modules/blib/index.js', skipped: true });
      const own = (fn: string, line: number): Frame => ({ fn, line, script: 'bundle', path: '/app/app.js' });
      engine.pauseAt({ frames: frames(own('main', 10)) });
      engine.script = [
        { frames: frames(lib(3), own('main', 10)) },
        { frames: frames(own('mine', 4), lib(3), own('main', 10)) },
        'runs'
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto']);
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(engine.stackTraceCalls.filter((levels) => levels === 1)).toHaveLength(3);
    });

    it('lands in the program\'s code of a bundle after a step that started in a dependency of the same script (review C1, s12)', async () => {
      const lib = (line: number): Frame => ({ fn: 'mix', line, script: 'bundle', path: '/app/node_modules/blib/index.js', skipped: true });
      const own = (fn: string, line: number): Frame => ({ fn, line, script: 'bundle', path: '/app/app.js' });
      // A breakpoint inside the bundled dependency; step_over returns to the program's caller, same script.
      engine.pauseAt({ frames: frames(lib(3), own('main', 8)) });
      engine.script = [{ frames: frames(own('main', 9)) }, 'runs'];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOver']);
      expect(delivered).toHaveLength(1);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });

    it('asks again each time for a frame skipped for its position, not its script', async () => {
      const helper = (line: number): Frame => ({ fn: '__awaiter', line, script: 'app', skipped: true, origin: 'Skipped by smartStep' });
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(helper(1), app('main', 10)) },
        { frames: frames(helper(2), app('main', 10)) },
        { frames: frames(app('callee', 50), helper(3), app('main', 10)) }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(engine.stackTraceCalls.filter((levels) => levels === 1)).toHaveLength(4);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });

    it('steps out once it has taken its engine steps in skipped code, and says how many it took, counting only those', async () => {
      withTunables({ walkBudgetSteps: 2 });
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(node('require', 1), app('main', 10)) },
        { frames: frames(node('require', 2), app('main', 10)) },
        { frames: frames(node('require', 3), app('main', 10)) },
        // V8's step-out lands in main.
        { frames: frames(app('main', 11)) }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();

      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step', description: 'Paused' });
      // The first step-in went from the program's own line; the two after it
      // were taken in skipped code, and only those are the walk.
      expect(stopped().text).toBe(ErrorMessages.stepIntoReachedNoProgramCode(2, 'steps', 2));
    });

    it('lands back on the line it left after stepping out: a pause in the program\'s code is a new position, never stepped from again', async () => {
      // `console.log(a); console.log(b); const c = 1;` V8's step-out lands on
      // the line's next statement (11:17 in the trace): that is the landing.
      withTunables({ walkBudgetSteps: 2 });
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(node('log', 1), app('main', 10)) },
        { frames: frames(node('log', 2), app('main', 10)) },
        { frames: frames(node('log', 3), app('main', 10)) },
        { frames: frames(app('main', 10, { col: 16 })) },
        'runs'
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step', text: ErrorMessages.stepIntoReachedNoProgramCode(2, 'steps', 2) });
    });

    it('lands at once on the next position of the line it left: the first step into a one-line for...of header', async () => {
      // `for (const y of big) console.log('y', y);` from 9:17, V8's first
      // step-in lands on the header's binding, 9:12 (the trace's pause 1).
      engine.pauseAt({ frames: frames(app('main', 8, { col: 16 })) });
      engine.script = [{ frames: frames(app('main', 8, { col: 11 })) }, 'runs'];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto']);
      expect(delivered).toHaveLength(1);
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(stopped().text).toBeUndefined();
    });

    it('stops where it is, and says so, when every command it may send is spent in skipped code', async () => {
      withTunables({ walkBudgetSteps: 1, commandCap: 3 });
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = Array.from({ length: 6 }, (_, i) => ({ frames: frames(node('deep', i), node('deeper', 1), app('main', 10)) }));
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toHaveLength(3);
      expect(stopped()).toMatchObject({ reason: 'step', text: ErrorMessages.stepStillInSkippedCode(3) });
    });
  });

  describe('how far a step-in walks through skipped code: two bounds, whichever comes first (I1)', () => {
    /** A clock the test moves: each pause V8 reports costs `msPerPause`. */
    function withClock(tunables: Partial<JsStepperTunables>, msPerPause: number): void {
      let clock = 0;
      withTunables(tunables, undefined, () => clock);
      engine.on('cdp-event', (method: string) => {
        if (method === 'Debugger.paused') {
          clock += msPerPause;
        }
      });
    }

    const walk = (n: number): ScriptedPause[] => Array.from({ length: n }, (_, i) => ({ frames: frames(node('log', i + 1), app('main', 10)) }));

    it('walks 512 engine steps or 3 s by default, under a backstop above both', () => {
      expect(DEFAULT_JS_STEPPER_TUNABLES).toMatchObject({ walkBudgetSteps: 512, walkBudgetMs: 3000, commandCap: 2048 });
      expect(DEFAULT_JS_STEPPER_TUNABLES.commandCap).toBeGreaterThan(DEFAULT_JS_STEPPER_TUNABLES.walkBudgetSteps);
    });

    it('walks while under the time bound, counted from the first landing in skipped code, then steps out, however few steps it took', async () => {
      withClock({ walkBudgetMs: 3000, walkBudgetSteps: 512 }, 1000);
      engine.pauseAt({ frames: frames(app('main', 10)) });
      // The walk's clock starts at the first landing (t=2000): it walks at
      // 2000, 3000 and 4000, and is out of time at 5000.
      engine.script = [...walk(4), { frames: frames(app('main', 11)) }];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step', text: ErrorMessages.stepIntoReachedNoProgramCode(3, 'time', 3000) });
    });

    it('walks while under the step bound, however little time passed, then steps out', async () => {
      withClock({ walkBudgetMs: 3000, walkBudgetSteps: 3 }, 0);
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [...walk(4), { frames: frames(app('main', 11)) }];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step', text: ErrorMessages.stepIntoReachedNoProgramCode(3, 'steps', 3) });
    });

    it('reaches the program\'s code after a walk longer than the old 24 steps, inside both bounds (once + emit: 35)', async () => {
      withClock({}, 1);
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [...walk(35), { frames: frames(app('fn', 3), node('once', 9), node('emit', 7), app('main', 10)) }];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(Array(36).fill('Debugger.stepInto'));
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(stopped().text).toBeUndefined();
    });
  });

  describe('a step issued inside skipped code, with nothing of the program below (issue #687)', () => {
    const express = (line: number): Frame => ({ fn: 'handle', line, script: 'express', skipped: true });

    it('step_into walks on into the program\'s handler: a request path enters it by calls, not returns', async () => {
      engine.pauseAt({ frames: frames(express(177), node('emit', 7), node('parserOnIncoming', 3)) });
      engine.script = [
        { frames: frames(node('Url', 77), express(177), node('emit', 7)) },
        { frames: frames(node('Url', 78), express(177), node('emit', 7)) },
        { frames: frames(app('handler', 16), express(250), node('emit', 7)) }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto']);
      expect(stopped()).toMatchObject({ reason: 'step' });
      // A walk asks js-debug about the stack below only when it has to step out.
      expect(engine.stackTraceCalls.filter((levels) => levels > 1)).toHaveLength(0);
    });

    it('step_into resumes the program only once its walk is over, and says it left the stack', async () => {
      withTunables({ walkBudgetSteps: 2 });
      engine.pauseAt({ frames: frames(express(177), node('emit', 7)) });
      engine.script = [
        { frames: frames(node('Url', 77), express(177), node('emit', 7)) },
        { frames: frames(node('Url', 78), express(177), node('emit', 7)) },
        { frames: frames(node('Url', 79), express(177), node('emit', 7)) },
        'runs'
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto', 'Debugger.resume']);
      expect(delivered).toEqual([LEFT_STACK]);
    });

    it('step_over resumes at once: it would have to step out, and there is nowhere of the program\'s to step out to', async () => {
      engine.pauseAt({ frames: frames(express(177), node('emit', 7)) });
      engine.script = [{ frames: frames(node('emit', 8)) }, 'runs'];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOver', 'Debugger.resume']);
      expect(delivered).toEqual([LEFT_STACK]);
    });
  });

  describe('a step over or out that returns into skipped code', () => {
    it('steps out toward the nearest program frame below, at once', async () => {
      engine.pauseAt({ frames: frames(app('listener', 40), node('emit', 7), app('main', 10)) });
      engine.script = [
        { frames: frames(node('emit', 8), app('main', 10)) },
        { frames: frames(app('main', 11)) }
      ];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOver', 'Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(stopped().text).toBeUndefined();
    });

    it('resumes and reports nothing when no frame of the program is below: the stack the step started on is gone', async () => {
      engine.pauseAt({ frames: frames(app('handler', 20), node('emit', 7), node('parserOnIncoming', 3)) });
      engine.script = [{ frames: frames(node('emit', 8), node('parserOnIncoming', 3)) }, 'runs'];
      await stepper.request('stepOut', { threadId: 1 });
      await settled();
      // No step-out from the bottom frames: that lands in the next task's internals.
      expect(commands()).toEqual(['Debugger.stepOut', 'Debugger.resume']);
      // No stop: only the record that the step ended by leaving the stack, for the pending answer (I3).
      expect(delivered).toEqual([LEFT_STACK]);
      expect(delivered[0].body).toEqual({ threadId: 1 });
      expect(stepper.describe()).toMatchObject({ chain: false });
    });
  });

  describe('a pause that is not the stepper\'s', () => {
    it('ends the chain as itself when js-debug keeps it: a breakpoint in a callee', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(app('callee', 30), app('main', 10)), reason: 'ambiguous', hits: ['js-debug:7'], dapReason: 'breakpoint' }];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(delivered).toHaveLength(1);
      // js-debug's own stopped, untouched.
      expect(stopped()).toMatchObject({ reason: 'breakpoint', description: 'Paused on breakpoint' });
      expect(commands()).toEqual(['Debugger.stepOver']);
    });

    it('forwards an exception reached during a step as itself', async () => {
      engine.pauseAt({ frames: frames(app('leaf', 5), app('caller', 14)) });
      engine.script = [{ frames: frames(app('other', 80), app('leaf', 5), app('caller', 14)), reason: 'exception', dapReason: 'exception' }];
      await stepper.request('stepOut', { threadId: 1 });
      await settled();
      expect(delivered).toHaveLength(1);
      expect(stopped()).toMatchObject({ reason: 'exception' });
      expect(commands()).toEqual(['Debugger.stepOut']);
    });

    it('waits on when js-debug resumes a pause of its own: the step is lost with it (issue #1162), and the next stop goes out as itself', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(node('require', 1), app('main', 10)) },
        // js-debug's module-entry breakpoint: paused and resumed by js-debug. V8 dropped the step.
        { frames: frames(app('mod', 0, { script: 'mod' }), node('require', 2), app('main', 10)), reason: 'ambiguous', hits: ['js-debug:entry'], resumedByJsDebug: true },
        // The program runs on to a breakpoint of the caller's.
        { frames: frames(app('later', 30), app('main', 20)), reason: 'other', hits: ['js-debug:7'], dapReason: 'breakpoint' }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      // Nothing was sent after js-debug's resume.
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto']);
      expect(delivered).toHaveLength(1);
      expect(stopped()).toMatchObject({ reason: 'breakpoint', description: 'Paused on breakpoint' });
      // Two kept pauses, two stopped events withheld; the resumed one had none.
      expect(seen.filter((e) => e.event === 'stopped')).toEqual(Array(2).fill({ event: 'stopped', withheld: true }));
    });
  });

  describe('what it reports, and when', () => {
    it('reports once, however js-debug orders its stopped and continued events', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(node('a', 1), app('main', 10)) },
        { frames: frames(node('a', 2), app('main', 10)) },
        { frames: frames(app('main', 11)) }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      // Each stopped arrives a timer tick after its pause: after the continued of the next resume.
      expect(seen.map((e) => e.event).join(' ')).toMatch(/continued continued/);
      expect(seen.every((e) => e.withheld)).toBe(true);
      expect(delivered).toHaveLength(1);
    });

    it('asks again while js-debug says it is not paused yet', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(app('main', 11)) }];
      await stepper.request('next', { threadId: 1 });
      engine.stackTraceFailures = 2;
      await settled();
      // One for the frame the step started from, three for the landing.
      expect(engine.stackTraceCalls).toEqual([1, 1, 1, 1]);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });

    it('reports the landing even when js-debug\'s stopped never comes, and drops the late one', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(app('main', 11)) }];
      const late: DebugProtocol.Event[] = [];
      engine.onDap = (event) => {
        if (event.event === 'stopped') late.push(event);
        else stepper.withholds(event);
      };
      await stepper.request('next', { threadId: 4 });
      await settled();
      expect(stopped()).toMatchObject({ reason: 'step', threadId: 4, allThreadsStopped: false });
      // The owed event arrives after the chain is over: still the step's own.
      expect(stepper.withholds(late[0])).toBe(true);
      // Anything after it is somebody else's stop.
      expect(stepper.withholds({ seq: 0, type: 'event', event: 'stopped', body: { reason: 'breakpoint', threadId: 4 } })).toBe(false);
    });

    it('lets every event through when no step is in flight', () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      expect(stepper.withholds({ seq: 0, type: 'event', event: 'stopped', body: { reason: 'breakpoint', threadId: 1 } })).toBe(false);
      expect(stepper.withholds({ seq: 0, type: 'event', event: 'continued', body: { threadId: 1 } })).toBe(false);
      expect(stepper.withholds({ seq: 0, type: 'event', event: 'output', body: { output: 'x' } })).toBe(false);
    });
  });

  describe('what ends a step still in flight', () => {
    /** A step out with no landing yet: the program runs, and the chain waits for V8's next pause. */
    async function stepOutAndRun(): Promise<void> {
      engine.pauseAt({ frames: frames(app('work', 9), app('main', 14)) });
      engine.script = ['runs'];
      await stepper.request('stepOut', { threadId: 1 });
      await tick(10);
      expect(stepper.describe()).toMatchObject({ chain: true });
      // The step is V8's own: the command went out and nothing else, no
      // temporary breakpoint (a step V8 loses stays lost, issue #1161).
      expect(engine.calls.map((c) => c.method)).toEqual(['Debugger.stepOut']);
    }

    it('a continue request ends it', async () => {
      await stepOutAndRun();
      await stepper.beforeRequest('continue');
      expect(stepper.describe()).toMatchObject({ chain: false });
      expect(delivered).toEqual([]);
    });

    it.each(['disconnect', 'terminate', 'restart', 'goto', 'restartFrame'])('a %s request ends it too', async (command) => {
      await stepOutAndRun();
      await stepper.beforeRequest(command);
      expect(stepper.describe()).toMatchObject({ chain: false });
    });

    it('a request that neither resumes nor ends the target leaves it alone', async () => {
      await stepOutAndRun();
      await stepper.beforeRequest('stackTrace');
      await stepper.beforeRequest('pause');
      expect(stepper.describe()).toMatchObject({ chain: true });
    });

    it('the CDP socket closing ends it, and nothing throws', async () => {
      await stepOutAndRun();
      stepper.detachCdp();
      await tick(10);
      expect(stepper.describe()).toMatchObject({ chain: false, paused: false });
      expect(stepper.handles('next')).toBe(false);
    });

    it('a later landing of that step is still reported: the call it steps out of took a while', async () => {
      await stepOutAndRun();
      // The call returns at last: V8's step lands.
      engine.arrive({ frames: frames(app('main', 15)) });
      await settled();
      expect(delivered).toHaveLength(1);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });
  });

  // ----- what the review of the branch found (cases written red first) -----

  /** A stepper with its own tunables, on the same engine. */
  function withTunables(tunables: Partial<JsStepperTunables>, onDeliver?: (event: DebugProtocol.Event) => void, now?: () => number): void {
    stepper = new JsStepper({
      target: { sendRequest: async (_c: string, args?: unknown) => engine.stackTrace((args as { levels: number }).levels) as never },
      deliver: (event) => {
        onDeliver?.(event);
        delivered.push(event);
      },
      tunables: { settleCeilingMs: 150, verdictCeilingMs: 150, ...tunables },
      ...(now ? { now } : {})
    });
    engine.onDap = (event) => {
      seen.push({ event: event.event, withheld: stepper.withholds(event) });
    };
    stepper.attachCdp(engine);
    stepper.setEnabled(true);
  }

  describe('when V8 or js-debug does not answer as asked', () => {
    it('reports a stop when the chain fails while V8 is paused: the caller is never left without one', async () => {
      engine.pauseAt({ frames: frames(app('listener', 40), node('emit', 7), app('main', 10)) });
      engine.script = [{ frames: frames(node('emit', 8), app('main', 10)) }];
      // The step-out the chain sends from Node's code is refused: V8 stays paused there.
      engine.failOnce = 'Debugger.stepOut';
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(delivered).toHaveLength(1);
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(stepper.describe()).toMatchObject({ chain: false });
    });

    it('asks again for the stack while js-debug says it is not paused yet, rather than taking it for an empty one', async () => {
      // A first step teaches the stepper that Node's script is skipped: it is not asked about again.
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(node('log', 1), app('main', 10)) }, { frames: frames(app('main', 11)) }];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      delivered.length = 0;
      engine.calls.length = 0;

      // So the first thing js-debug is asked about the next landing is the whole stack, and it is not ready.
      engine.pauseAt({ frames: frames(app('listener', 40), node('emit', 7), app('main', 10)) });
      engine.script = [{ frames: frames(node('emit', 8), app('main', 10)) }, { frames: frames(app('main', 11)) }];
      engine.stackTraceFailures = 1;
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOver', 'Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });

    it('does not take a stack deeper than it asked about for an empty one', async () => {
      const deep = Array.from({ length: 230 }, (_, i) => node(`f${i % 5}`, i));
      engine.pauseAt({ frames: frames(app('listener', 40), ...deep, app('main', 10)) });
      engine.script = [{ frames: frames(...deep, app('main', 10)) }, { frames: frames(app('main', 11)) }];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOver', 'Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });

    it('steps out with V8 alone, and does not resume, when js-debug never says what is below', async () => {
      // A first step teaches the stepper that Node's script is skipped.
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(node('log', 1), app('main', 10)) }, { frames: frames(app('main', 11)) }];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      delivered.length = 0;
      engine.calls.length = 0;

      engine.pauseAt({ frames: frames(app('listener', 40), node('emit', 7), app('main', 10)) });
      engine.script = [{ frames: frames(node('emit', 8), app('main', 10)) }, { frames: frames(app('main', 11)) }];
      await stepper.request('next', { threadId: 1 });
      engine.stackTraceFailures = 1e6;
      await settled();
      expect(commands()).toEqual(['Debugger.stepOver', 'Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });
  });

  describe('an async function the event loop resumed', () => {
    it('steps out by V8 alone: its own async step finds the one awaiting call', async () => {
      engine.pauseAt({ frames: frames(app('inner', 5)), asyncParent: { fn: 'handler', line: 9, col: 14 } });
      engine.script = [{ frames: frames(app('handler', 10)), asyncParent: { fn: 'main', line: 14 } }];
      await stepper.request('stepOut', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(stopped().text).toBeUndefined();
    });

    it('does not take what only scheduled the code for what it returns to: a step out of a `.then` callback resumes', async () => {
      engine.pauseAt({ frames: frames(app('onDone', 3)), asyncParent: { fn: 'work', line: 7, description: 'Promise.then' } });
      // The landing in skipped code is where the rule reads the async stack:
      // its first link is the `.then` that scheduled the callback, a program
      // frame js-debug marks normal, and it is not an awaiter.
      engine.script = [
        { frames: frames(node('runMicrotasks', 12)), asyncParent: { fn: 'work', line: 7, description: 'Promise.then' } },
        'runs'
      ];
      await stepper.request('stepOut', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOut', 'Debugger.resume']);
      expect(delivered).toEqual([LEFT_STACK]);
    });

    it('follows V8 through a skipped awaiter to the program\'s, looking again at each landing', async () => {
      engine.pauseAt({ frames: frames(app('handler', 20)), asyncParent: { fn: 'libRun', line: 5, script: 'lib', skipped: true } });
      engine.script = [
        { frames: frames({ fn: 'libRun', line: 6, script: 'lib', skipped: true }), asyncParent: { fn: 'main', line: 30 } },
        { frames: frames(app('main', 31)) }
      ];
      await stepper.request('stepOut', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOut', 'Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });

    it('resumes once the awaiting chain ends in skipped code: no walk through the next tasks', async () => {
      engine.pauseAt({ frames: frames(app('handler', 20)), asyncParent: { fn: 'libRun', line: 5, script: 'lib', skipped: true } });
      engine.script = [
        { frames: frames({ fn: 'libRun', line: 6, script: 'lib', skipped: true }), asyncParent: { fn: 'main', line: 30 } },
        // Nothing awaited it after all: the next task's internals.
        { frames: frames(node('processTicksAndRejections', 70)) },
        'runs'
      ];
      await stepper.request('stepOut', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOut', 'Debugger.stepOut', 'Debugger.resume']);
      expect(delivered).toEqual([LEFT_STACK]);
    });
  });

  describe('the sentence on a step-in that reached nothing of the program', () => {
    it('says nothing when the walk reached the program\'s code: no step-out, no sentence', async () => {
      withTunables({ walkBudgetSteps: 2 });
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(node('log', 1), app('main', 10)) },
        { frames: frames(app('helper', 60), node('log', 2), app('main', 10)) }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto']);
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(stopped().text).toBeUndefined();
    });

    it('says nothing when the step-out lands in a frame below the one it left: the walk was not into a call of that line', async () => {
      // From the listener's last line, V8's step-in lands in emit, below it.
      withTunables({ walkBudgetSteps: 1 });
      engine.pauseAt({ frames: frames(app('listener', 40), node('emit', 7), app('main', 10)) });
      engine.script = [
        { frames: frames(node('emit', 8), app('main', 10)) },
        { frames: frames(node('emit', 9), app('main', 10)) },
        { frames: frames(app('main', 11)) }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(stopped().text).toBeUndefined();
    });
  });

  describe('a pause the caller asks for during a step', () => {
    async function stepOverAndRun(): Promise<void> {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = ['runs'];
      await stepper.request('next', { threadId: 1 });
      await tick(10);
      await stepper.beforeRequest('pause');
    }

    it('is theirs wherever V8 stops, even in skipped code: the chain does not step away from it', async () => {
      await stepOverAndRun();
      // V8 reports a pause taken while a step is in flight as the step.
      engine.arrive({ frames: frames(node('formatValue', 300), app('main', 10)), reason: 'ambiguous', dapReason: 'pause' });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOver']);
      expect(delivered).toHaveLength(1);
      expect(stopped()).toMatchObject({ reason: 'pause' });
    });

    it('is reported as a pause in program code too, not as the step', async () => {
      await stepOverAndRun();
      engine.arrive({ frames: frames(app('main', 12)), reason: 'ambiguous', dapReason: 'pause' });
      await settled();
      expect(stopped()).toMatchObject({ reason: 'pause' });
    });

    it('gives way to a breakpoint that fires first: that stop goes out as itself', async () => {
      await stepOverAndRun();
      engine.arrive({ frames: frames(app('callee', 30), app('main', 10)), reason: 'other', hits: ['js-debug:7'], dapReason: 'breakpoint' });
      await settled();
      expect(stopped()).toMatchObject({ reason: 'breakpoint', description: 'Paused on breakpoint' });
    });
  });

  describe('edges the mutation pass found unpinned', () => {
    it('a new step gives up the one in flight', async () => {
      engine.pauseAt({ frames: frames(app('work', 9), app('main', 14)) });
      engine.script = ['runs'];
      await stepper.request('stepOut', { threadId: 1 });
      await tick(10);
      expect(stepper.describe()).toMatchObject({ chain: true });

      // V8 is paused again by something else, and the caller steps from there.
      engine.pauseAt({ frames: frames(app('other', 50), app('main', 14)), reason: 'other' });
      engine.script = [{ frames: frames(app('other', 51), app('main', 14)) }];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOut', 'Debugger.stepOver']);
      expect(delivered).toHaveLength(1);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });

    it('a new step owes nothing of the last one', async () => {
      // js-debug's stopped for the first step never comes.
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(app('main', 11)) }];
      engine.onDap = (event) => {
        if (event.event !== 'stopped') stepper.withholds(event);
      };
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(stepper.describe().owed).toBe(1);

      // The next step is complete: nothing is owed after it.
      engine.onDap = (event) => {
        seen.push({ event: event.event, withheld: stepper.withholds(event) });
      };
      engine.script = [{ frames: frames(app('main', 12)) }];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(stepper.describe().owed).toBe(0);
      expect(stepper.withholds({ seq: 0, type: 'event', event: 'stopped', body: { reason: 'pause', threadId: 1 } })).toBe(false);
    });

    it('drops only what can be the step\'s own late report: an exception stop right after is forwarded', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(app('main', 11)) }];
      const late: DebugProtocol.Event[] = [];
      engine.onDap = (event) => {
        if (event.event === 'stopped') late.push(event);
        else stepper.withholds(event);
      };
      await stepper.request('next', { threadId: 4 });
      await settled();
      expect(stepper.withholds({ seq: 0, type: 'event', event: 'stopped', body: { reason: 'exception', threadId: 4 } })).toBe(false);
      expect(stepper.withholds({ seq: 0, type: 'event', event: 'stopped', body: { reason: 'breakpoint', threadId: 4, hitBreakpointIds: [7] } })).toBe(false);
      // The step's own, late: still dropped.
      expect(stepper.withholds(late[0])).toBe(true);
    });

    it('sends nothing more once the step is given up while a landing is being judged', async () => {
      let gated = false;
      let release: () => void = () => undefined;
      stepper = new JsStepper({
        target: {
          sendRequest: async (_c: string, args?: unknown) => {
            if (gated) {
              await new Promise<void>((resolve) => {
                release = resolve;
              });
            }
            return engine.stackTrace((args as { levels: number }).levels) as never;
          }
        },
        deliver: (event) => delivered.push(event),
        tunables: { settleCeilingMs: 150, verdictCeilingMs: 150 }
      });
      stepper.attachCdp(engine);
      stepper.setEnabled(true);
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(node('log', 1), app('main', 10)) }];
      await stepper.request('stepIn', { threadId: 1 });
      gated = true;
      await tick(10);
      // js-debug has not answered about the landing yet, and the caller continues.
      await stepper.beforeRequest('continue');
      gated = false;
      release();
      await tick(20);
      expect(commands()).toEqual(['Debugger.stepInto']);
      expect(stepper.describe()).toMatchObject({ chain: false });
      expect(delivered).toEqual([]);
    });

    it('sends no step-out once the step is given up while js-debug is asked what the stack returns to', async () => {
      let gated = false;
      let asked = false;
      let release: () => void = () => undefined;
      stepper = new JsStepper({
        target: {
          sendRequest: async (_c: string, args?: unknown) => {
            const levels = (args as { levels: number }).levels;
            if (gated && levels > 1) {
              asked = true;
              await new Promise<void>((resolve) => {
                release = resolve;
              });
            }
            return engine.stackTrace(levels) as never;
          }
        },
        deliver: (event) => delivered.push(event),
        tunables: { settleCeilingMs: 150, verdictCeilingMs: 150 }
      });
      stepper.attachCdp(engine);
      stepper.setEnabled(true);
      engine.pauseAt({ frames: frames(app('listener', 40), node('emit', 7), app('main', 10)) });
      engine.script = [{ frames: frames(node('emit', 8), app('main', 10)) }, { frames: frames(app('main', 11)) }];
      gated = true;
      await stepper.request('next', { threadId: 1 });
      await vi.waitFor(() => expect(asked).toBe(true), { timeout: 1000, interval: 2 });
      // js-debug has not said what is below the landing yet, and the caller continues.
      await stepper.beforeRequest('continue');
      release();
      await tick(20);
      expect(commands()).toEqual(['Debugger.stepOver']);
      expect(stepper.describe()).toMatchObject({ chain: false });
      expect(delivered).toEqual([]);
    });

    it('serves no step while the program runs', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = ['runs'];
      await stepper.request('next', { threadId: 1 });
      await tick(5);
      expect(stepper.handles('next')).toBe(false);
      await stepper.beforeRequest('continue');
    });

    it('a step-out that comes back in another task, with nothing of the program below, resumes the program', async () => {
      engine.pauseAt({ frames: frames(app('work', 9), app('main', 14)) });
      // V8's step-out comes back in the next task: Node's own code, nothing of the program under it.
      engine.script = [{ frames: frames(node('processTicksAndRejections', 70)) }, 'runs'];
      await stepper.request('stepOut', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOut', 'Debugger.resume']);
      expect(delivered).toEqual([LEFT_STACK]);
    });

    it('a step-in that lands on its own line in a deeper call of the same function has landed', async () => {
      const start = fnLineOf(app('walk', 0));
      engine.pauseAt({ frames: frames(app('walk', start + 1), app('main', 10)) });
      engine.script = [{ frames: frames(app('walk', start + 1), app('walk', start + 1), app('main', 10)) }, 'runs'];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto']);
    });

    it('a step over that stops on its own line has landed', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(app('main', 10, { col: 14 })) }, 'runs'];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOver']);
    });

    it('takes a landing js-debug never answers for as program code, once the ceiling is passed', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(app('main', 11)) }, 'runs'];
      engine.stackTraceFailures = 1e6;
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOver']);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });

    it('reports only after js-debug has reported the pause itself', async () => {
      let reportsSeenAtDelivery = -1;
      withTunables({}, () => {
        reportsSeenAtDelivery = seen.filter((e) => e.event === 'stopped').length;
      });
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(app('main', 11)) }];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(reportsSeenAtDelivery).toBe(1);
    });
  });

  describe('more edges the second mutation pass found unpinned', () => {
    it('sends nothing more when the pause is asked for while a landing is being judged, and reports that landing as the pause', async () => {
      let gated = false;
      let release: () => void = () => undefined;
      stepper = new JsStepper({
        target: {
          sendRequest: async (_c: string, args?: unknown) => {
            if (gated) {
              await new Promise<void>((resolve) => {
                release = resolve;
              });
            }
            return engine.stackTrace((args as { levels: number }).levels) as never;
          }
        },
        deliver: (event) => delivered.push(event),
        tunables: { settleCeilingMs: 150, verdictCeilingMs: 150 }
      });
      engine.onDap = (event) => {
        seen.push({ event: event.event, withheld: stepper.withholds(event) });
      };
      stepper.attachCdp(engine);
      stepper.setEnabled(true);
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(node('log', 1), app('main', 10)) }];
      await stepper.request('stepIn', { threadId: 1 });
      gated = true;
      await tick(10);
      await stepper.beforeRequest('pause');
      gated = false;
      release();
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto']);
      expect(delivered).toHaveLength(1);
      expect(stopped()).toMatchObject({ reason: 'pause' });
    });

    it('reports where it is when V8 refuses the resume of a stack that is gone', async () => {
      engine.pauseAt({ frames: frames(app('handler', 20), node('emit', 7), node('parserOnIncoming', 3)) });
      engine.script = [{ frames: frames(node('emit', 8), node('parserOnIncoming', 3)) }];
      engine.failOnce = 'Debugger.resume';
      await stepper.request('stepOut', { threadId: 1 });
      await settled();
      expect(delivered).toHaveLength(1);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });

    it('owes a late report only as a pause or a step, and only for a while', async () => {
      // js-debug's stopped for the step never comes in time.
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(app('main', 11)) }];
      engine.onDap = (event) => {
        if (event.event !== 'stopped') stepper.withholds(event);
      };
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(stepper.describe().owed).toBe(1);
      // A `breakpoint` naming none right after it is somebody else's stop, and leaves the count alone.
      expect(stepper.withholds({ seq: 0, type: 'event', event: 'stopped', body: { reason: 'breakpoint', threadId: 1, hitBreakpointIds: [] } })).toBe(false);
      expect(stepper.describe().owed).toBe(1);

      // And not for ever: past the ceiling nothing is owed.
      await tick(200);
      expect(stepper.withholds({ seq: 0, type: 'event', event: 'stopped', body: { reason: 'pause', threadId: 1 } })).toBe(false);
      expect(stepper.describe().owed).toBe(0);
    });

    it('says how far the walk went only for a step back in the very frame it left: not a deeper call of the same function', async () => {
      withTunables({ walkBudgetSteps: 1 });
      const start = fnLineOf(app('recur', 0));
      engine.pauseAt({ frames: frames(app('recur', start + 1), app('main', 10)) });
      engine.script = [
        { frames: frames(node('log', 1), app('recur', start + 1), app('main', 10)) },
        { frames: frames(node('log', 2), app('recur', start + 1), app('main', 10)) },
        // The step-out stops in recur one frame deeper (the skipped code called it again).
        { frames: frames(app('recur', start + 1, { col: 14 }), app('recur', start + 1), app('main', 10)) }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(stopped().text).toBeUndefined();
    });
  });

  describe('a pause asked for while the stack turns out to be gone', () => {
    it('does not resume the program: V8 is paused, and that stop is the caller\'s', async () => {
      let gated = false;
      let release: () => void = () => undefined;
      stepper = new JsStepper({
        target: {
          sendRequest: async (_c: string, args?: unknown) => {
            if (gated) {
              await new Promise<void>((resolve) => {
                release = resolve;
              });
            }
            return engine.stackTrace((args as { levels: number }).levels) as never;
          }
        },
        deliver: (event) => delivered.push(event),
        tunables: { settleCeilingMs: 150, verdictCeilingMs: 150 }
      });
      engine.onDap = (event) => {
        seen.push({ event: event.event, withheld: stepper.withholds(event) });
      };
      stepper.attachCdp(engine);
      stepper.setEnabled(true);
      // A handler Node called: stepping out of it leaves nothing of the program on the stack.
      engine.pauseAt({ frames: frames(app('handler', 20), node('emit', 7), node('parserOnIncoming', 3)) });
      engine.script = [{ frames: frames(node('emit', 8), node('parserOnIncoming', 3)) }];
      await stepper.request('stepOut', { threadId: 1 });
      gated = true;
      await tick(10);
      await stepper.beforeRequest('pause');
      gated = false;
      release();
      await settled();
      expect(commands()).toEqual(['Debugger.stepOut']);
      expect(delivered).toHaveLength(1);
      expect(stopped()).toMatchObject({ reason: 'pause' });
    });
  });

  it('refuses a step it cannot start, and leaves no chain behind', async () => {
    engine.pauseAt({ frames: frames(app('leaf', 5), app('caller', 14)) });
    engine.current = null; // V8 resumed behind the stepper's back
    await expect(stepper.request('stepOut', { threadId: 1 })).rejects.toThrow(/while paused/);
    expect(stepper.describe()).toMatchObject({ chain: false });
  });
});
