/**
 * The proxy's own JavaScript stepper (issue #1130), against a scripted V8
 * and a scripted js-debug.
 *
 * The engine below plays what was measured through the real pair (the spike
 * notes of the issue): every step command is answered, then `Debugger.resumed`
 * and the next scripted `Debugger.paused` arrive; js-debug marks frame 0 of a
 * `stackTrace` answer `deemphasize` for skipped code; and for every pause it
 * keeps it sends one DAP `stopped` (reason `pause` for a step it did not
 * request, `breakpoint` for a breakpoint it does not know) a moment later,
 * and one `continued` per resume.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { JsStepper } from '../../src/proxy/js-stepper.js';
import { ErrorMessages } from '../../src/utils/error-messages.js';

interface Frame {
  fn: string;
  script?: string;
  /** 0-based line of the frame's position. */
  line: number;
  col?: number;
  /** 0-based line the function starts on; defaults to a line per function name. */
  fnLine?: number;
  /** js-debug marks it skipped code. */
  skipped?: boolean;
  /** The mark's wording; "Skipped by skipFiles" is a script-level verdict. */
  origin?: string;
}

interface ScriptedPause {
  frames: Frame[];
  reason?: string;
  /** Breakpoint ids V8 reports; a function picks from the nets armed at that moment. */
  hits?: string[] | ((armed: ArmedBreakpoint[]) => string[]);
  /** js-debug resumes this pause itself (a module-entry breakpoint): no `stopped`, then a `resumed`. */
  resumedByJsDebug?: boolean;
  /** What js-debug reports this pause as. */
  dapReason?: string;
  asyncParent?: { fn: string; script?: string; line: number; col?: number; skipped?: boolean };
}

interface ArmedBreakpoint {
  id: string;
  scriptId: string;
  lineNumber: number;
  columnNumber: number;
}

const FN_LINES: Record<string, number> = {};
function fnLineOf(frame: Frame): number {
  if (frame.fnLine !== undefined) return frame.fnLine;
  FN_LINES[frame.fn] ??= 1000 + Object.keys(FN_LINES).length * 100;
  return FN_LINES[frame.fn];
}

/** A scripted V8 behind a CDP socket, and the js-debug that watches it. */
class Engine extends EventEmitter {
  calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  /** What the next resuming command leads to: a pause, or nothing (the program runs). */
  script: Array<ScriptedPause | 'runs'> = [];
  armed: ArmedBreakpoint[] = [];
  removed: string[] = [];
  /** Break positions per function, keyed `script:fnLine`; default: ten lines from the function's start. */
  positions = new Map<string, Array<{ lineNumber: number; columnNumber?: number; type?: string }>>();
  sources = new Map<string, string>();
  connected = true;
  current: ScriptedPause | null = null;
  /** DAP events js-debug sent, in order: the test feeds them to the stepper. */
  onDap: (event: DebugProtocol.Event) => void = () => undefined;
  stackTraceFailures = 0;
  stackTraceCalls: number[] = [];
  private nextId = 0;

  isConnected(): boolean {
    return this.connected;
  }

  async send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    this.calls.push({ method, params });
    switch (method) {
      case 'Debugger.stepInto':
      case 'Debugger.stepOver':
      case 'Debugger.stepOut':
      case 'Debugger.resume':
        if (!this.current) throw new Error(`${method}: Can only perform operation while paused.`);
        this.current = null;
        setImmediate(() => this.advance(true));
        return {} as T;
      case 'Debugger.getPossibleBreakpoints': {
        const start = params.start as { scriptId: string; lineNumber: number; columnNumber: number };
        const own = [...this.positions.entries()].find(([key]) => key === `${start.scriptId}:${start.lineNumber}`)?.[1];
        const list = own ?? Array.from({ length: 10 }, (_, i) => ({ lineNumber: start.lineNumber + i }));
        return { locations: list.map((l) => ({ scriptId: start.scriptId, columnNumber: 0, ...l })) } as T;
      }
      case 'Debugger.setBreakpoint': {
        const location = params.location as { scriptId: string; lineNumber: number; columnNumber: number };
        const id = `net:${++this.nextId}`;
        this.armed.push({ id, ...location });
        return { breakpointId: id } as T;
      }
      case 'Debugger.removeBreakpoint':
        this.removed.push(params.breakpointId as string);
        this.armed = this.armed.filter((bp) => bp.id !== params.breakpointId);
        return {} as T;
      case 'Debugger.getScriptSource':
        return { scriptSource: this.sources.get(params.scriptId as string) ?? '' } as T;
      default:
        return {} as T;
    }
  }

  /** V8 pauses here now (the stop a step starts from). */
  pauseAt(pause: ScriptedPause): void {
    this.current = pause;
    this.emit('cdp-event', 'Debugger.paused', this.toCdp(pause));
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
    return typeof pause.hits === 'function' ? pause.hits(this.armed) : pause.hits ?? [];
  }

  private toCdp(pause: ScriptedPause): Record<string, unknown> {
    const hits = this.hitsOf(pause);
    // Fix the picked ids, so js-debug's later report sees the same pause.
    pause.hits = hits;
    return {
      reason: pause.reason ?? (hits.length > 0 ? 'other' : 'step'),
      hitBreakpoints: hits,
      callFrames: pause.frames.map((f) => ({
        functionName: f.fn,
        functionLocation: { scriptId: f.script ?? 'app', lineNumber: fnLineOf(f), columnNumber: 0 },
        location: { scriptId: f.script ?? 'app', lineNumber: f.line, columnNumber: f.col ?? 0 }
      })),
      ...(pause.asyncParent
        ? {
            asyncStackTrace: {
              callFrames: [{
                functionName: pause.asyncParent.fn,
                scriptId: pause.asyncParent.script ?? 'app',
                lineNumber: pause.asyncParent.line,
                columnNumber: pause.asyncParent.col ?? 0
              }]
            }
          }
        : {})
    };
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
    const mark = (f: { fn: string; line: number; skipped?: boolean; origin?: string; script?: string }, id: number): DebugProtocol.StackFrame => ({
      id,
      name: f.fn,
      line: f.line + 1,
      column: 1,
      source: { path: `/app/${f.script ?? 'app'}.js`, ...(f.skipped ? { origin: f.origin ?? 'Skipped by skipFiles' } : {}) },
      presentationHint: (f.skipped ? 'deemphasize' : 'normal') as DebugProtocol.StackFrame['presentationHint']
    });
    const frames = pause.frames.map(mark);
    if (pause.asyncParent) {
      frames.push({ id: 900, name: 'await', line: 0, column: 0, presentationHint: 'label' });
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
  let targetRequests: Array<{ command: string; args: unknown }>;

  const commands = (): string[] => engine.calls.map((c) => c.method).filter((m) => /step|resume/.test(m));
  const setBreakpoints = (): number => engine.calls.filter((c) => c.method === 'Debugger.setBreakpoint').length;
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
    targetRequests = [];
    stepper = new JsStepper({
      target: {
        sendRequest: async (command: string, args?: unknown) => {
          targetRequests.push({ command, args });
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
      expect(setBreakpoints()).toBe(0);
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
    it('steps in again until the program\'s code is on top, under a net on the frame it returns to', async () => {
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
      // The net went up at the first skipped landing, on main's positions, and is gone.
      expect(setBreakpoints()).toBeGreaterThan(0);
      expect(engine.armed).toEqual([]);
      expect(stepper.describe().nets).toBe(0);
      // Three kept pauses, three stopped events from js-debug, one reported.
      expect(seen.filter((e) => e.event === 'stopped')).toEqual(Array(3).fill({ event: 'stopped', withheld: true }));
      expect(delivered).toHaveLength(1);
    });

    it('asks js-debug about a script once: "Skipped by skipFiles" is a verdict on the script', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(node('a', 1), app('main', 10)) },
        { frames: frames(node('a', 2), app('main', 10)) },
        { frames: frames(node('a', 3), app('main', 10)) },
        { frames: frames(app('main', 11)) }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      // One levels-1 question for the node script, one for the landing; the
      // levels-80 one is the net's look at the whole stack.
      expect(engine.stackTraceCalls.filter((levels) => levels === 1)).toHaveLength(2);
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
      expect(engine.stackTraceCalls.filter((levels) => levels === 1)).toHaveLength(3);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });

    it('steps out once the budget is spent, lands by the net when V8 loses the step-out, and says the line called only skipped code', async () => {
      stepper = new JsStepper({
        target: { sendRequest: async (_c: string, args?: unknown) => engine.stackTrace((args as { levels: number }).levels) as never },
        deliver: (event) => delivered.push(event),
        tunables: { budget: 2, settleCeilingMs: 150, verdictCeilingMs: 150 }
      });
      stepper.attachCdp(engine);
      stepper.setEnabled(true);
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(node('require', 1), app('main', 10)) },
        { frames: frames(node('require', 2), app('main', 10)) },
        { frames: frames(node('require', 3), app('main', 10)) },
        // The step-out is lost (the frame returns through try...finally, issue
        // #1161): no step landing. The net on main catches the return instead.
        { frames: frames(app('main', 11)), reason: 'other', hits: (armed) => [armed[0].id] }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();

      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step', description: 'Paused' });
      // js-debug reported the net hit as a breakpoint with no ids: not what leaves.
      expect(stopped().hitBreakpointIds).toBeUndefined();
      expect(stopped().text).toBe(ErrorMessages.stepIntoFoundOnlySkippedCode());
      expect(engine.armed).toEqual([]);
    });

    it('steps in again when it comes back to the line it left, at the same depth', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(node('first', 1), app('main', 10)) },
        // Back on line 10 (the line's second call is next), then into it.
        { frames: frames(app('main', 10, { col: 14 })) },
        { frames: frames(app('second', 60), app('main', 10, { col: 14 })) }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto', 'Debugger.stepInto']);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });

    it('stops where it is, and says so, when every command it may send is spent in skipped code', async () => {
      stepper = new JsStepper({
        target: { sendRequest: async (_c: string, args?: unknown) => engine.stackTrace((args as { levels: number }).levels) as never },
        deliver: (event) => delivered.push(event),
        tunables: { budget: 1, commandCap: 3, settleCeilingMs: 150, verdictCeilingMs: 150 }
      });
      stepper.attachCdp(engine);
      stepper.setEnabled(true);
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = Array.from({ length: 6 }, (_, i) => ({ frames: frames(node('deep', i), node('deeper', 1), app('main', 10)) }));
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      expect(commands()).toHaveLength(3);
      expect(stopped()).toMatchObject({ reason: 'step', text: ErrorMessages.stepStillInSkippedCode(3) });
      expect(engine.armed).toEqual([]);
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
      // Nothing to guard: no frame of the program was below. One look at the stack, not one per landing.
      expect(setBreakpoints()).toBe(0);
      expect(engine.stackTraceCalls.filter((levels) => levels > 1)).toHaveLength(1);
    });

    it('step_into resumes the program only once its budget is spent', async () => {
      stepper = new JsStepper({
        target: { sendRequest: async (_c: string, args?: unknown) => engine.stackTrace((args as { levels: number }).levels) as never },
        deliver: (event) => delivered.push(event),
        tunables: { budget: 2, settleCeilingMs: 150, verdictCeilingMs: 150 }
      });
      stepper.attachCdp(engine);
      stepper.setEnabled(true);
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
      expect(delivered).toEqual([]);
    });

    it('step_over resumes at once: it would have to step out, and there is nowhere of the program\'s to step out to', async () => {
      engine.pauseAt({ frames: frames(express(177), node('emit', 7)) });
      engine.script = [{ frames: frames(node('emit', 8)) }, 'runs'];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOver', 'Debugger.resume']);
      expect(delivered).toEqual([]);
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
      expect(delivered).toEqual([]);
      expect(engine.armed).toEqual([]);
      expect(stepper.describe()).toMatchObject({ chain: false, nets: 0 });
    });
  });

  describe('nets: a step never counts on V8 alone to come back to a frame (issue #1161)', () => {
    it('step_out arms the frame it returns to before the first command, and lands by the net when V8 never pauses', async () => {
      engine.pauseAt({ frames: frames(app('withFinally', 5), app('caller', 14)) });
      // V8's step-out is lost; the next thing V8 says is the net's breakpoint.
      engine.script = [{ frames: frames(app('caller', 15)), reason: 'other', hits: (armed) => [armed[1].id] }];
      await stepper.request('stepOut', { threadId: 1 });
      await settled();

      const firstStep = engine.calls.findIndex((c) => c.method === 'Debugger.stepOut');
      const firstNet = engine.calls.findIndex((c) => c.method === 'Debugger.setBreakpoint');
      expect(firstNet).toBeGreaterThanOrEqual(0);
      expect(firstNet).toBeLessThan(firstStep);
      // The net is on the caller's function, from its own position on.
      const netCalls = engine.calls.filter((c) => c.method === 'Debugger.setBreakpoint');
      expect(new Set(netCalls.map((c) => (c.params.location as { scriptId: string }).scriptId))).toEqual(new Set(['app']));
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(engine.armed).toEqual([]);
      expect(engine.removed).toHaveLength(netCalls.length);
    });

    it('a step over arms nothing in a function with no `finally`, and the frame it returns to in one that has it', async () => {
      engine.sources.set('app', Array.from({ length: 2000 }, () => 'x();').join('\n'));
      engine.pauseAt({ frames: frames(app('plain', 5), app('caller', 14)) });
      engine.script = [{ frames: frames(app('plain', 6), app('caller', 14)) }];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(setBreakpoints()).toBe(0);

      delivered.length = 0;
      const source = Array.from({ length: 2000 }, () => 'x();');
      source[fnLineOf(app('guarded', 0)) + 2] = 'try { return x(); } finally { done(); }';
      engine.sources.set('lib', source.join('\n'));
      engine.pauseAt({ frames: frames(app('guarded', fnLineOf(app('guarded', 0)) + 2, { script: 'lib' }), app('caller', 14)) });
      engine.script = [{ frames: frames(app('caller', 15)), reason: 'other', hits: (armed) => [armed[1].id] }];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(setBreakpoints()).toBeGreaterThan(0);
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(engine.armed).toEqual([]);
    });

    it('puts no net on the frame being stepped in: a function with `finally` that returns to itself', async () => {
      const source = Array.from({ length: 2000 }, () => 'x();');
      const start = fnLineOf(app('down', 0));
      source[start + 2] = 'try { return down(n - 1); } finally { done(); }';
      engine.sources.set('app', source.join('\n'));
      engine.pauseAt({ frames: frames(app('down', start + 2), app('down', start + 2), app('main', 10)) });
      engine.script = [{ frames: frames(app('down', start + 3), app('down', start + 2), app('main', 10)) }];
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(setBreakpoints()).toBe(0);
      expect(stopped()).toMatchObject({ reason: 'step' });
    });

    it('a net hit deeper than the frame it guards is not a landing: a step-out of a recursive function steps out again', async () => {
      const start = fnLineOf(app('down', 0));
      engine.pauseAt({ frames: frames(app('down', start + 3), app('down', start + 5), app('main', 10)) });
      engine.script = [
        // The frame being left runs on to its own finally block: a net position, one frame too deep.
        { frames: frames(app('down', start + 7), app('down', start + 5), app('main', 10)), reason: 'ambiguous', hits: (armed) => [armed[0].id] },
        { frames: frames(app('down', start + 7), app('main', 10)), reason: 'other', hits: (armed) => [armed[0].id] }
      ];
      await stepper.request('stepOut', { threadId: 1 });
      await settled();
      expect(commands()).toEqual(['Debugger.stepOut', 'Debugger.stepOut']);
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(engine.armed).toEqual([]);
    });

    it('an async function with no program frame below returns to its awaiter: the net goes on the async parent, at any depth', async () => {
      engine.pauseAt({
        frames: frames(app('work', 9), node('processTicksAndRejections', 70)),
        asyncParent: { fn: 'main', line: 16, col: 12 }
      });
      engine.script = [{ frames: frames(app('main', 17)), reason: 'other', hits: (armed) => [armed[0].id] }];
      await stepper.request('stepOut', { threadId: 1 });
      await settled();
      // Asked from the awaiter's own position, since its frame is not on the stack.
      const asked = engine.calls.find((c) => c.method === 'Debugger.getPossibleBreakpoints');
      expect(asked?.params.start).toEqual({ scriptId: 'app', lineNumber: 16, columnNumber: 12 });
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(engine.armed).toEqual([]);
    });

    it('caps a net, and takes it from the frame\'s own position on', async () => {
      const start = fnLineOf(app('big', 0));
      engine.positions.set(`app:${start}`, Array.from({ length: 300 }, (_, i) => ({ lineNumber: start + i })));
      engine.pauseAt({ frames: frames(app('leaf', 5), app('big', start + 200)) });
      engine.script = [{ frames: frames(app('big', start + 201)) }];
      await stepper.request('stepOut', { threadId: 1 });
      await settled();
      const lines = engine.calls
        .filter((c) => c.method === 'Debugger.setBreakpoint')
        .map((c) => (c.params.location as { lineNumber: number }).lineNumber);
      expect(lines).toHaveLength(24);
      expect(Math.min(...lines)).toBe(start + 200);
      expect(Math.max(...lines)).toBe(start + 223);
    });

    it('asks from the frame\'s own line when the function position answers for a nested function', async () => {
      // Top-level code that starts with a function declaration: V8 answers
      // the nested function's positions for the module's own position.
      const moduleStart = fnLineOf(app('(module)', 0));
      engine.positions.set(`app:${moduleStart}`, [{ lineNumber: moduleStart + 1 }, { lineNumber: moduleStart + 2 }]);
      engine.positions.set('app:900', [{ lineNumber: 900 }, { lineNumber: 901 }, { lineNumber: 902 }]);
      engine.pauseAt({ frames: frames(app('callee', 5), app('(module)', 900, { fnLine: moduleStart })) });
      engine.script = [{ frames: frames(app('(module)', 901, { fnLine: moduleStart })) }];
      await stepper.request('stepOut', { threadId: 1 });
      await settled();
      const lines = engine.calls
        .filter((c) => c.method === 'Debugger.setBreakpoint')
        .map((c) => (c.params.location as { lineNumber: number }).lineNumber);
      expect(lines).toEqual([900, 901, 902]);
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

    it('removes its nets before a real stop is forwarded', async () => {
      engine.pauseAt({ frames: frames(app('leaf', 5), app('caller', 14)) });
      engine.script = [{ frames: frames(app('other', 80), app('leaf', 5), app('caller', 14)), reason: 'exception', dapReason: 'exception' }];
      let armedAtDelivery = -1;
      stepper = new JsStepper({
        target: { sendRequest: async (_c: string, args?: unknown) => engine.stackTrace((args as { levels: number }).levels) as never },
        deliver: (event) => {
          armedAtDelivery = engine.armed.length;
          delivered.push(event);
        },
        tunables: { settleCeilingMs: 150, verdictCeilingMs: 150 }
      });
      stepper.attachCdp(engine);
      stepper.setEnabled(true);
      engine.pauseAt({ frames: frames(app('leaf', 5), app('caller', 14)) });
      await stepper.request('stepOut', { threadId: 1 });
      await settled();
      expect(stopped()).toMatchObject({ reason: 'exception' });
      expect(armedAtDelivery).toBe(0);
    });

    it('waits on when js-debug resumes it by itself, and lands by the net (issue #1162, in a step-in walk)', async () => {
      engine.pauseAt({ frames: frames(app('main', 10)) });
      engine.script = [
        { frames: frames(node('require', 1), app('main', 10)) },
        // js-debug's module-entry breakpoint: paused and resumed by js-debug. V8 dropped the step.
        { frames: frames(app('mod', 0, { script: 'mod' }), node('require', 2), app('main', 10)), reason: 'ambiguous', hits: ['js-debug:entry'], resumedByJsDebug: true },
        { frames: frames(app('main', 11)), reason: 'other', hits: (armed) => [armed[0].id] }
      ];
      await stepper.request('stepIn', { threadId: 1 });
      await settled();
      // Nothing was sent after js-debug's resume: the net was already there.
      expect(commands()).toEqual(['Debugger.stepInto', 'Debugger.stepInto']);
      expect(stopped()).toMatchObject({ reason: 'step' });
      // Two kept pauses, two stopped events withheld; the resumed one had none.
      expect(seen.filter((e) => e.event === 'stopped')).toHaveLength(2);
      expect(engine.armed).toEqual([]);
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
      engine.stackTraceFailures = 2;
      await stepper.request('next', { threadId: 1 });
      await settled();
      expect(engine.stackTraceCalls).toEqual([1, 1, 1]);
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
    async function stepOutAndRun(): Promise<void> {
      engine.pauseAt({ frames: frames(app('work', 9), app('main', 14)) });
      engine.script = ['runs'];
      await stepper.request('stepOut', { threadId: 1 });
      await tick(10);
      // The program is running toward the net; the chain waits.
      expect(stepper.describe()).toMatchObject({ chain: true });
      expect(engine.armed.length).toBeGreaterThan(0);
    }

    it('a continue request: the net is removed before the request goes on', async () => {
      await stepOutAndRun();
      await stepper.beforeRequest('continue');
      expect(engine.armed).toEqual([]);
      expect(stepper.describe()).toMatchObject({ chain: false, nets: 0 });
      expect(delivered).toEqual([]);
    });

    it('a request that neither resumes nor ends the target leaves it alone', async () => {
      await stepOutAndRun();
      await stepper.beforeRequest('stackTrace');
      await stepper.beforeRequest('pause');
      expect(stepper.describe()).toMatchObject({ chain: true });
      expect(engine.armed.length).toBeGreaterThan(0);
    });

    it('the CDP socket closing: nothing can be removed, and nothing throws', async () => {
      await stepOutAndRun();
      stepper.detachCdp();
      await tick(10);
      expect(stepper.describe()).toMatchObject({ chain: false, nets: 0, paused: false });
      expect(stepper.handles('next')).toBe(false);
    });

    it('a later landing of that step is still reported: stepping over an await that takes a while', async () => {
      await stepOutAndRun();
      // The awaited work is done: V8 reaches the net.
      engine.script = [];
      const pause: ScriptedPause = { frames: frames(app('main', 15)), reason: 'other', hits: [engine.armed[0].id] };
      engine.current = pause;
      engine.emit('cdp-event', 'Debugger.paused', {
        reason: 'other',
        hitBreakpoints: pause.hits,
        callFrames: [{ functionName: 'main', functionLocation: { scriptId: 'app', lineNumber: fnLineOf(app('main', 0)), columnNumber: 0 }, location: { scriptId: 'app', lineNumber: 15, columnNumber: 0 } }]
      });
      seen.push({ event: 'stopped', withheld: stepper.withholds({ seq: 0, type: 'event', event: 'stopped', body: { reason: 'breakpoint', threadId: 1, hitBreakpointIds: [] } }) });
      await settled();
      expect(stopped()).toMatchObject({ reason: 'step' });
      expect(engine.armed).toEqual([]);
    });
  });

  it('refuses a step it cannot start, and leaves no net behind', async () => {
    engine.pauseAt({ frames: frames(app('leaf', 5), app('caller', 14)) });
    engine.current = null; // V8 resumed behind the stepper's back
    await expect(stepper.request('stepOut', { threadId: 1 })).rejects.toThrow(/while paused/);
    expect(engine.armed).toEqual([]);
    expect(stepper.describe()).toMatchObject({ chain: false, nets: 0 });
  });
});
