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
import {
  PROXY_STEP_LEFT_STACK_EVENT,
  PROXY_STEP_WALK_ENDED_EVENT,
  PROXY_STEP_WALK_STARTED_EVENT
} from '../../src/proxy/dap-proxy-interfaces.js';
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
  /** How long the program runs before this pause (the skipped code's own run time): the test's clock moves by it. */
  takesMs?: number;
  /**
   * From this pause on, the CDP socket lags behind js-debug's DAP events: CDP
   * events are held, in order, until the next CDP request, whose answer comes
   * after them (one ordered socket). Measured under Node 22 on Linux: js-debug's
   * `stopped` for a later pause arrived before the CDP `resumed` of this one.
   */
  lagCdpFromHere?: boolean;
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
  /** The test's clock: moved by each pause's `takesMs`. */
  onRun: (ms: number) => void = () => undefined;
  /** CDP events held while the socket lags (null: it does not). */
  private lagged: Array<[string, unknown]> | null = null;

  isConnected(): boolean {
    return this.connected;
  }

  /** A CDP event, now, or after the lagging socket's earlier events. */
  private cdpEvent(method: string, params: unknown): void {
    if (this.lagged) {
      this.lagged.push([method, params]);
      return;
    }
    this.emit('cdp-event', method, params);
  }

  async send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    this.calls.push({ method, params });
    // One ordered socket: every event sent before the answer arrives before it,
    // and both arrive after the request went out: a caller that does not wait
    // for the answer reads none of them (review 9, S02).
    const held = this.lagged?.splice(0) ?? [];
    if (held.length > 0) {
      await tick(1);
      for (const [name, body] of held) {
        this.emit('cdp-event', name, body);
      }
    }
    if (this.failOnce === method) {
      this.failOnce = null;
      throw new Error(`${method}: refused`);
    }
    switch (method) {
      case 'Runtime.getIsolateId':
        return { id: 'isolate-1' } as T;
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

  /** js-debug resumes the pause V8 is in by itself, now, after it reported it. */
  resumeByJsDebug(): void {
    this.current = null;
    this.advance(true);
  }

  /** The running program pauses here by itself (a breakpoint, a pause request, a late landing), js-debug's report included. */
  arrive(pause: ScriptedPause): void {
    this.script.unshift(pause);
    this.advance(false);
  }

  private advance(resumedFirst: boolean): void {
    if (resumedFirst) {
      this.cdpEvent('Debugger.resumed', {});
      this.onDap({ seq: 0, type: 'event', event: 'continued', body: { threadId: 1, allThreadsContinued: false } });
    }
    const next = this.script.shift();
    if (!next || next === 'runs') {
      return;
    }
    this.onRun(next.takesMs ?? 0);
    this.current = next;
    this.cdpEvent('Debugger.paused', this.toCdp(next));
    if (next.lagCdpFromHere) {
      this.lagged ??= [];
    }
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
  /** The records of a step_into's walk through skipped code (decision 2 of round 3). */
  const WALK_STARTED = expect.objectContaining({ type: 'event', event: PROXY_STEP_WALK_STARTED_EVENT });
  const WALK_ENDED = expect.objectContaining({ type: 'event', event: PROXY_STEP_WALK_ENDED_EVENT });
  /** The stops delivered, without the stepper's own records. */
  const stops = (): DebugProtocol.Event[] => delivered.filter((e) => e.event === 'stopped');
  /** The stepper's own records, in order. */
  const records = (): string[] => delivered.filter((e) => e.event !== 'stopped').map((e) => e.event);
  const stopped = (): DebugProtocol.StoppedEvent['body'] => stops()[0].body as DebugProtocol.StoppedEvent['body'];

  type CdpSend = (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  /** Puts `wrap` in front of the engine's CDP `send` for one test. */
  function wrapSend(wrap: (method: string, params: Record<string, unknown> | undefined, send: CdpSend) => Promise<unknown>): void {
    const send = engine.send.bind(engine) as CdpSend;
    (engine as unknown as { send: CdpSend }).send = (method, params) => wrap(method, params, send);
  }

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
      expect(stops()).toHaveLength(1);
      // The walk was recorded when it started, and the landing ended it: no other record.
      expect(records()).toEqual([PROXY_STEP_WALK_STARTED_EVENT]);
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
      // were taken in skipped code, and only those are the walk: its limit.
      expect(stopped().text).toBe(ErrorMessages.stepIntoReachedNoProgramCode(2));
    });

    it('records the walk as it starts and as it ends at its limit, each just before the command it leads to', async () => {
      const commandsAtRecord: Array<[string, number]> = [];
      withTunables({ walkBudgetSteps: 2 }, (event) => {
        if (event.event !== 'stopped') commandsAtRecord.push([event.event, commands().length]);
      });
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(node('require', 1), app('main', 10)) },
        { frames: frames(node('require', 2), app('main', 10)) },
        { frames: frames(node('require', 3), app('main', 10)) },
        { frames: frames(app('main', 11)) }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepOut']);
      // Started before the walk's first step-in (the second command); ended before the step-out (the fourth).
      expect(commandsAtRecord).toEqual([[PROXY_STEP_WALK_STARTED_EVENT, 1], [PROXY_STEP_WALK_ENDED_EVENT, 3]]);
      expect(delivered.slice(0, 2)).toEqual([WALK_STARTED, WALK_ENDED]);
      expect(delivered[0].body).toEqual({ threadId: 1, stepLimit: 2 });
      expect(delivered[1].body).toMatchObject({ threadId: 1 });
      expect(stops()).toHaveLength(1);
    });

    it('records no walk for a step_into that lands at once, nor for a step_over or step_out that steps out of skipped code', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [{ frames: frames(app('callee', 30), app('main', 10)) }];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(records()).toEqual([]);

      delivered.length = 0;
      engine.pauseAt({ frames: frames(app('listener', 40), node('emit', 7), app('main', 10)) });
      engine.script = [{ frames: frames(node('emit', 8), app('main', 10)) }, { frames: frames(app('main', 11)) }];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(commands().slice(-2)).toEqual(['Debugger.stepOver', 'Debugger.stepOut']);
      expect(records()).toEqual([]);
    });

    it('withdraws the walk\'s record when js-debug resumes a pause of its own during the walk, and records it again when the walk goes on', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(node('require', 1), app('main', 10)) },
        // js-debug's own pause, resumed by js-debug: whether V8 still carries the step is not known.
        { frames: frames(app('(anonymous)', 0, { script: 'wasm' })), reason: 'other', resumedByJsDebug: true },
        // V8 did: the step lands in skipped code again, and the walk goes on.
        { frames: frames(node('require', 2), app('main', 10)) },
        { frames: frames(app('mod', 3, { script: 'mod' }), node('require', 3), app('main', 10)) }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto']);
      expect(records()).toEqual([PROXY_STEP_WALK_STARTED_EVENT, PROXY_STEP_WALK_ENDED_EVENT, PROXY_STEP_WALK_STARTED_EVENT]);
      expect(stopped()).toMatchObject({ reason: 'step' });
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
      expect(stopped()).toMatchObject({ reason: 'step', text: ErrorMessages.stepIntoReachedNoProgramCode(2) });
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

  describe('how far a step-in walks through skipped code: engine steps only, never the clock (round 3, decision 1)', () => {
    const walk = (n: number): ScriptedPause[] => Array.from({ length: n }, (_, i) => ({ frames: frames(node('log', i + 1), app('main', 10)) }));

    it('walks 512 engine steps by default, under a backstop above them, and has no time bound', () => {
      expect(DEFAULT_JS_STEPPER_TUNABLES).toEqual({ walkBudgetSteps: 512, commandCap: 2048, settleCeilingMs: 2000, verdictCeilingMs: 2000 });
      expect(DEFAULT_JS_STEPPER_TUNABLES.commandCap).toBeGreaterThan(DEFAULT_JS_STEPPER_TUNABLES.walkBudgetSteps);
    });

    it('walks on however long the skipped code runs between its engine steps: the program decides where it lands (review 8, C1)', async () => {
      // emit's first listener (a dependency's) blocks for 3.5 s before the
      // program's own listener runs: few engine steps, a long time.
      const realNow = Date.now.bind(Date);
      let ran = 0;
      const clock = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + ran);
      try {
        withTunables({});
        engine.onRun = (ms) => {
          ran += ms;
        };
        engine.pauseAt({ frames: frames(app('main', 10)) });
        engine.script = [
          { frames: frames(node('emit', 5), app('main', 10)) },
          { frames: frames({ fn: 'block', line: 3, script: 'r8lib', path: '/app/node_modules/r8lib/index.js', skipped: true }, node('emit', 6), app('main', 10)) },
          { frames: frames(node('emit', 7), app('main', 10)), takesMs: 3500 },
          { frames: frames(app('handler', 40), node('emit', 8), app('main', 10)) },
          'runs'
        ];
        await stepper.request('stepIn', { threadId: 1 });
        await settled();
      } finally {
        clock.mockRestore();
      }
      expect(commands()).toEqual(Array(4).fill('Debugger.stepInto'));
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(stopped().text).toBeUndefined();
    });

    it('walks while under the step bound, then steps out and says it reached its limit', async () => {
      withTunables({ walkBudgetSteps: 3 });
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [...walk(4), { frames: frames(app('main', 11)) }];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step', text: ErrorMessages.stepIntoReachedNoProgramCode(3) });
    });

    it('reaches the program\'s code after a walk longer than the old 24 steps (once + emit: 35)', async () => {
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
      // The walk's start, then the left stack: the walk ended in a resume, not a step-out, so no walk-ended record.
      expect(delivered).toEqual([WALK_STARTED, LEFT_STACK]);
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

    it('delivers, as itself and after the step\'s record, a breakpoint the resumed program reaches while V8 is still answering that resume (review 9, M1)', async () => {
      // The resume's answer lags behind what the program does next (on Linux
      // an answer can wait about 40 ms on the inspector socket, issue #1163).
      wrapSend(async (method, params, send) => {
        const answer = await send(method, params);
        if (method === 'Debugger.resume') await tick(20);
        return answer;
      });
      // Two timers due together: the step leaves the end of a() with nothing
      // of the program below; b(), the next timer's callback, has a breakpoint.
      engine.pauseAt({ frames: frames(app('a', 7), node('listOnTimeout', 7)) });
      engine.script = [
        { frames: frames(node('listOnTimeout', 8)) },
        { frames: frames(app('b', 11), node('listOnTimeout', 9)), reason: 'other', hits: ['js-debug:b'], dapReason: 'breakpoint' },
        'runs'
      ];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOver', 'Debugger.resume']);
      expect(delivered).toEqual([
        LEFT_STACK,
        expect.objectContaining({ event: 'stopped', body: expect.objectContaining({ reason: 'breakpoint', description: 'Paused on breakpoint' }) })
      ]);
      // js-debug's continued events for the step's own commands stay the step's.
      expect(seen.filter((e) => e.event === 'continued')).toEqual(Array(2).fill({ event: 'continued', withheld: true }));
    });

    describe('what happens around that resume (review 10)', () => {
      /** The step leaves the end of a() with nothing of the program below; the next timer's b() is what comes next. */
      function leaveThen(next: ScriptedPause[], tail: Array<ScriptedPause | 'runs'> = ['runs']): void {
        engine.pauseAt({ frames: frames(app('a', 7), node('listOnTimeout', 7)) });
        engine.script = [{ frames: frames(node('listOnTimeout', 8)) }, ...next, ...tail];
      }
      const atBreakpointInB = (): ScriptedPause => ({
        frames: frames(app('b', 11), node('listOnTimeout', 9)), reason: 'other', hits: ['js-debug:b'], dapReason: 'breakpoint'
      });
      /** What the parent process sees: what the stepper delivers and every event it lets through, in order. */
      const kinds = (): string[] => delivered.map((e) => (e.event === 'stopped' ? `stopped:${(e.body as { reason?: string }).reason}` : e.event));
      beforeEach(() => {
        engine.onDap = (event) => {
          const withheld = stepper.withholds(event);
          seen.push({ event: event.event, withheld });
          if (!withheld) delivered.push(event);
        };
      });

      it('takes a resume whose answer was lost, with V8 paused somewhere else, for the resume it was: one stop, the program\'s', async () => {
        wrapSend(async (method, params, send) => {
          const answer = await send(method, params);
          if (method === 'Debugger.resume') {
            await tick(20);
            throw new Error('Debugger.resume: timed out');
          }
          return answer;
        });
        leaveThen([atBreakpointInB()]);
        await stepper.request('next', { threadId: 1 });
        await settled();
        expect(kinds()).toEqual([PROXY_STEP_LEFT_STACK_EVENT, 'stopped:breakpoint']);
      });

      it('lets a resume of a stop it holds out after that stop: the parent ends knowing the program runs', async () => {
        wrapSend(async (method, params, send) => {
          const answer = await send(method, params);
          if (method === 'Debugger.resume') {
            await tick(10);
            engine.resumeByJsDebug();
            await tick(10);
          }
          return answer;
        });
        leaveThen([atBreakpointInB()]);
        await stepper.request('next', { threadId: 1 });
        await settled();
        expect(stepper.describe().paused).toBe(false);
        expect(kinds()).toEqual([PROXY_STEP_LEFT_STACK_EVENT, 'stopped:breakpoint', 'continued']);
      });

      it('drops what it holds, and records nothing, once the step is given up while the resume is answered', async () => {
        let deliveredAtGiveUp = -1;
        wrapSend(async (method, params, send) => {
          const answer = await send(method, params);
          if (method === 'Debugger.resume') {
            await tick(10);
            deliveredAtGiveUp = delivered.length;
            await stepper.beforeRequest('disconnect');
            await tick(10);
          }
          return answer;
        });
        leaveThen([atBreakpointInB()]);
        await stepper.request('next', { threadId: 1 });
        await settled();
        expect(deliveredAtGiveUp).toBe(0);
        expect(kinds()).toEqual([]);
      });

      it('drops a held stop that a continue moved V8 on from: the parent ends knowing the program runs', async () => {
        wrapSend(async (method, params, send) => {
          const answer = await send(method, params);
          if (method === 'Debugger.resume') {
            await tick(10);
            await stepper.beforeRequest('continue');
            engine.resumeByJsDebug();
            await tick(10);
          }
          return answer;
        });
        leaveThen([atBreakpointInB()]);
        await stepper.request('next', { threadId: 1 });
        await settled();
        expect(stepper.describe().paused).toBe(false);
        expect(kinds()).toEqual(['continued']);
      });

      it('drops a held stop that a new step moved V8 on from: the new step\'s landing is the last stop', async () => {
        let resumes = 0;
        let second: Promise<unknown> | null = null;
        wrapSend(async (method, params, send) => {
          const answer = await send(method, params);
          if (method === 'Debugger.resume' && ++resumes === 1) {
            await tick(10);
            second = stepper.request('next', { threadId: 1 });
            await tick(10);
          }
          return answer;
        });
        leaveThen([atBreakpointInB()], [{ frames: frames(app('b', 12), node('listOnTimeout', 9)) }, 'runs']);
        await stepper.request('next', { threadId: 1 });
        await vi.waitFor(() => expect(second).not.toBeNull());
        await second;
        await settled();
        await tick(20);
        expect(kinds().filter((k) => k.startsWith('stopped'))).toEqual(['stopped:step']);
      });
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
      expect(stops()).toHaveLength(1);
      expect(stopped()).toMatchObject({ reason: 'breakpoint', description: 'Paused on breakpoint' });
      // Two kept pauses, two stopped events withheld; the resumed one had none.
      expect(seen.filter((e) => e.event === 'stopped')).toEqual(Array(2).fill({ event: 'stopped', withheld: true }));
      // The walk had started; js-debug's resume left it unknown whether V8 still carried the step, so the
      // record of a walk in progress was withdrawn: a pending answer must not say the step is walking.
      expect(records()).toEqual([PROXY_STEP_WALK_STARTED_EVENT, PROXY_STEP_WALK_ENDED_EVENT]);
    });

    it('reads a stopped that overtook the CDP events as the later pause\'s: the CDP stream catches up first (Node 22 on Linux)', async () => {
      // Measured on the box: during a step_over, V8 pauses twice with reason
      // `other` (no breakpoint) and js-debug resumes both; the third pause is
      // the step's landing. js-debug's `stopped` for it reached the stepper
      // before the CDP `resumed` of the second and the CDP `paused` of the third.
      engine.pauseAt({ frames: frames(app('load', 48)) });
      engine.script = [
        { frames: frames(app('(anonymous)', 0, { script: 's158' })), reason: 'other', resumedByJsDebug: true },
        { frames: frames(app('(anonymous)', 0, { script: 's161' })), reason: 'other', resumedByJsDebug: true, lagCdpFromHere: true },
        { frames: frames(app('load', 50)) },
        'runs'
      ];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(stops()).toHaveLength(1);
      // The step's own landing, reported as the step it is.
      expect(stopped()).toMatchObject({ reason: 'step', description: 'Paused' });
      expect(commands()).toEqual(['Debugger.stepOver']);
      // One request V8 answers, on the socket the events travel on.
      expect(engine.calls.filter((c) => c.method === 'Runtime.getIsolateId')).toHaveLength(1);
    });

    it('still forwards a breakpoint js-debug keeps as itself after the CDP stream caught up: nothing newer was there', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(app('callee', 30), app('main', 10)), reason: 'other', hits: ['js-debug:7'], dapReason: 'breakpoint', lagCdpFromHere: true },
        'runs'
      ];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(stops()).toHaveLength(1);
      expect(stopped()).toMatchObject({ reason: 'breakpoint', description: 'Paused on breakpoint' });
      expect(engine.calls.filter((c) => c.method === 'Runtime.getIsolateId')).toHaveLength(1);
    });

    it('reads the inbox as it stands when the catch-up request fails: a breakpoint js-debug keeps still goes out as itself (review 9, S01)', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(app('callee', 30), app('main', 10)), reason: 'other', hits: ['js-debug:7'], dapReason: 'breakpoint', lagCdpFromHere: true },
        'runs'
      ];
      engine.failOnce = 'Runtime.getIsolateId';
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(engine.calls.filter((c) => c.method === 'Runtime.getIsolateId')).toHaveLength(1);
      expect(stops()).toHaveLength(1);
      expect(stopped()).toMatchObject({ reason: 'breakpoint', description: 'Paused on breakpoint' });
    });

    it('catches up again for a stopped that came while it was catching up: that answer does not cover it (review 9, S04/S05)', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        // A pause js-debug reports, then resumes by itself; the CDP socket lags from here.
        { frames: frames(app('callee', 30), app('main', 10)), reason: 'other', hits: ['js-debug:7'], dapReason: 'breakpoint', lagCdpFromHere: true },
        // The step's own landing.
        { frames: frames(app('main', 11)) },
        'runs'
      ];
      let catchUps = 0;
      wrapSend(async (method, params, send) => {
        if (method === 'Runtime.getIsolateId' && ++catchUps === 1) {
          engine.calls.push({ method, params: params ?? {} });
          // While this request is out, js-debug resumes the pause it reported
          // and V8 lands the step: their CDP events come after this answer,
          // js-debug's stopped for the landing before it.
          engine.resumeByJsDebug();
          await tick(10);
          return { id: 'isolate-1' };
        }
        return send(method, params);
      });
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(engine.calls.filter((c) => c.method === 'Runtime.getIsolateId')).toHaveLength(2);
      expect(stops()).toHaveLength(1);
      // The step's landing, not the breakpoint js-debug resumed.
      expect(stopped()).toMatchObject({ reason: 'step', description: 'Paused' });
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
      expect(stops()).toHaveLength(1);
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
  function withTunables(tunables: Partial<JsStepperTunables>, onDeliver?: (event: DebugProtocol.Event) => void): void {
    stepper = new JsStepper({
      target: { sendRequest: async (_c: string, args?: unknown) => engine.stackTrace((args as { levels: number }).levels) as never },
      deliver: (event) => {
        onDeliver?.(event);
        delivered.push(event);
      },
      tunables: { settleCeilingMs: 150, verdictCeilingMs: 150, ...tunables }
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

    it('withdraws the walk\'s record when the chain fails with V8 running: nothing walks any more (review 9, S12)', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(node('require', 1), app('main', 10)) },
        { frames: frames(node('require', 2), app('main', 10)) },
        'runs'
      ];
      let stepIns = 0;
      wrapSend(async (method, params, send) => {
        if (method === 'Debugger.stepInto' && ++stepIns === 3) {
          // V8 runs (js-debug resumed it behind the stepper): the step command is refused.
          engine.emit('cdp-event', 'Debugger.resumed', {});
          engine.current = null;
          throw new Error('Debugger.stepInto: Can only perform operation while paused.');
        }
        return send(method, params);
      });
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(stops()).toEqual([]);
      expect(records()).toEqual([PROXY_STEP_WALK_STARTED_EVENT, PROXY_STEP_WALK_ENDED_EVENT]);
      expect(delivered[1].body).toEqual({ threadId: 1, why: 'failed' });
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

    it('neither resumes nor records a left stack once the step is given up while js-debug is asked what the stack returns to (review 8)', async () => {
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
      // A timer callback: stepping off it leaves nothing of the program on the stack.
      engine.pauseAt({ frames: frames(app('onTimer', 40), node('listOnTimeout', 7)) });
      engine.script = [{ frames: frames(node('listOnTimeout', 8)) }, 'runs'];
      gated = true;
      await stepper.request('next', { threadId: 1 });
      await vi.waitFor(() => expect(asked).toBe(true), { timeout: 1000, interval: 2 });
      // js-debug has not said what is below the landing yet, and the caller continues.
      await stepper.beforeRequest('continue');
      release();
      await tick(20);
      // The continue is the caller's to send: the given-up chain sends nothing, and reports nothing.
      expect(commands()).toEqual(['Debugger.stepOver']);
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
