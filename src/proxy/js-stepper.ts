/**
 * The server's own JavaScript stepper (issue #1130).
 *
 * js-debug has a "smart stepper": while a step lands in code the session
 * skips (Node internals, node_modules, an unmapped helper of a source-mapped
 * file) it steps again by itself. It does so with `breakOnAsyncCall`, which
 * moves the step to a later task and loses it, and it takes one V8 step per
 * statement of the skipped code (131 for one `console.log`). Three issues
 * (#513, #678/#687, #1130) were that stepper deciding where a step ends.
 *
 * So js-debug's stepper is off for every session, and this one decides. It
 * sits on one js-debug target: that target's DAP connection, and the raw CDP
 * socket js-debug hands out with `requestCDPProxy`. One `stepIn`, `next` or
 * `stepOut` comes in, one `stopped` goes out.
 *
 *   One CDP command per engine step. `Debugger.stepInto` never carries
 *   `breakOnAsyncCall`.
 *
 *   The verdict on a landing is js-debug's own mark on frame 0
 *   (`stackTrace { levels: 1 }`: `presentationHint: "deemphasize"`), asked at
 *   once after the CDP `paused`. It is the session's one definition of
 *   skipped code: it follows `justMyCode`, a caller's `skipFiles` and source
 *   maps. js-debug's `stopped` for the pause is never waited for: it is sent
 *   a timer tick later, which costs 12 ms a landing on Windows.
 *
 *   STEPS V8 LOSES STAY LOST. V8 loses a step that leaves a function
 *   through a `return` that runs a `finally` first: a `return` inside
 *   try...finally, a `return` out of for...of, a function with a `using`
 *   declaration, every async generator (issue #1161; V8 issue 569814973).
 *   js-debug resuming its own module-entry pause while a step is in flight
 *   loses one too (issue #1162). The stepper does not rescue these: the
 *   step is V8's own, and the program runs on (or, for a `step_over` off the
 *   end of a `finally` block, V8 can stop in the next call of the same
 *   function). There is no rescue because a breakpoint hit in the caller
 *   cannot be told from a hit in a later call of the caller: CDP names no
 *   single activation.
 *
 *   Skipped code on top: `step_into` steps in again (that is how a call
 *   through Node's own code reaches a callback of the program's) until the
 *   walk has taken its limit of engine steps in skipped code, then steps
 *   out; `step_over` and `step_out` step out at once. The walk has no time
 *   bound: where a step lands is the program's to decide, never the clock's,
 *   so two runs of one program land a step in the same place on any host
 *   (an engine step costs about 2 ms on Windows and 44 ms on Linux, #1163).
 *   The stepper records the walk for the step's pending answer: a proxy
 *   event when it starts, and one when it is no longer known to be going (it
 *   reached its limit and steps out, or js-debug resumed a pause of its own
 *   during it). A pause in the program's code is the
 *   landing, on the line the step started from too: in the measured traces
 *   V8's step-out lands on the caller's next break position (11:17 after a
 *   call at 11:1), never back on the call it left, and a first step-in on a
 *   one-line for...of lands on the header's next position (9:17 to 9:12):
 *   where the program's code next runs. With nothing
 *   of the program below (no frame, no awaiter), the stack the step started
 *   on is gone: the program is resumed, and the only word of it is the
 *   proxy's own `proxyStepLeftStack` event, for the pending answer (stepping
 *   out of the bottom frame would land in the next task's internals instead).
 *
 *   A pause that is not the stepper's (another breakpoint, an exception) is
 *   js-debug's to decide. Resumed by js-debug, the chain waits on. Kept, the
 *   chain ends and that stop is forwarded as itself. js-debug says "kept"
 *   with a DAP `stopped`, and says "resumed" with the CDP `resumed` it
 *   forwards: two sockets, and the `stopped` for a later pause can overtake
 *   the `resumed` of this one (measured under Node 22 on Linux). So before a
 *   `stopped` is read as "kept", the CDP stream catches up: one request V8
 *   answers, on the socket the events travel on. A pause the caller
 *   asks for during a chain makes the next stop theirs, wherever it is: V8
 *   reports it as the step, so only the request tells them apart. (For the
 *   same reason a `debugger;` statement reached during a step is reported
 *   as the step's landing, as js-debug's own stepper reports it.)
 *
 *   js-debug's `stopped` and `continued` events are withheld by count: it
 *   sends one `stopped` per pause it keeps, out of order with the
 *   `continued` of the next resume. The last one is forwarded: as reason
 *   `step` on a landing (it arrives as `pause`, or `step`), unchanged on a
 *   real stop.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import { createLogger } from '../utils/logger.js';
import { ErrorMessages } from '../utils/error-messages.js';
import {
  PROXY_STEP_LEFT_STACK_EVENT,
  PROXY_STEP_WALK_ENDED_EVENT,
  PROXY_STEP_WALK_STARTED_EVENT
} from './dap-proxy-interfaces.js';

// redirectable: re-pointed into the per-session proxy log at worker init (#519)
const logger = createLogger('js-stepper', { redirectable: true });

/** The slice of the target's DAP connection the stepper needs. */
export interface StepperTarget {
  sendRequest<T = unknown>(command: string, args?: unknown, timeoutMs?: number): Promise<T>;
}

/** The slice of the CDP proxy client the stepper needs. */
export interface StepperCdp {
  send<T = unknown>(method: string, params?: object, timeoutMs?: number): Promise<T>;
  isConnected(): boolean;
  on(event: 'cdp-event', listener: (method: string, params: unknown) => void): unknown;
  off(event: 'cdp-event', listener: (method: string, params: unknown) => void): unknown;
}

export interface JsStepperTunables {
  /**
   * Engine steps a step-in may take in skipped code before it steps out: the
   * walk's only bound. A walk that outlasts the step's grace window (about
   * 5 s; measured, a step_into on `require('node:fs')`, whose walk takes
   * all 512 engine steps: about 1 s on Windows, about 25 s on Linux)
   * answers `pending`, and lands later in the same place.
   */
  walkBudgetSteps: number;
  /** CDP step commands in one chain, all told: a backstop above the walk's bound. */
  commandCap: number;
  /** How long a finished chain waits for js-debug's `stopped` events before it reports without them. */
  settleCeilingMs: number;
  /** How long `stackTrace` may answer "not paused" for a pause js-debug keeps. */
  verdictCeilingMs: number;
}

export const DEFAULT_JS_STEPPER_TUNABLES: JsStepperTunables = {
  walkBudgetSteps: 512,
  commandCap: 2048,
  settleCeilingMs: 2000,
  verdictCeilingMs: 2000
};

export interface JsStepperOptions {
  target: StepperTarget;
  /** Hands an event to whoever forwards this target's events. */
  deliver: (event: DebugProtocol.Event) => void;
  tunables?: Partial<JsStepperTunables>;
  /** Test seam. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * The CDP request that makes the stream catch up: answered by V8 itself
 * (js-debug's proxy passes it on), with no effect on the program. Measured
 * answered under Node 22.23.2 and 24.14.1.
 */
const CATCH_UP_METHOD = 'Runtime.getIsolateId';

export type StepKind = 'in' | 'over' | 'out';

const STEP_OF_COMMAND: Record<string, StepKind> = { stepIn: 'in', next: 'over', stepOut: 'out' };
const CDP_COMMAND: Record<StepKind, string> = { in: 'Debugger.stepInto', over: 'Debugger.stepOver', out: 'Debugger.stepOut' };

/** Requests that resume or end the target: a chain still in flight must give it up first. */
const CHAIN_ENDING_REQUESTS = new Set(['continue', 'disconnect', 'terminate', 'restart', 'goto', 'reverseContinue', 'restartFrame']);

/** The reasons of a pause that is the step's own, when it hits no breakpoint; any other reason is a real stop. */
const STEP_REASONS = new Set(['step', 'ambiguous']);

interface CdpLocation {
  scriptId: string;
  lineNumber: number;
  columnNumber?: number;
}

interface CdpCallFrame {
  functionName?: string;
  functionLocation?: CdpLocation;
  location: CdpLocation;
}

interface CdpAsyncFrame {
  functionName?: string;
  scriptId: string;
  lineNumber: number;
  columnNumber: number;
}

interface CdpPaused {
  callFrames: CdpCallFrame[];
  reason: string;
  hitBreakpoints?: string[];
  asyncStackTrace?: CdpAsyncTrace;
}

/** One link of V8's async stack. `description` names it: `await`, `Promise.then`, `Timeout`, ... */
interface CdpAsyncTrace {
  description?: string;
  callFrames?: CdpAsyncFrame[];
  parent?: CdpAsyncTrace;
}

type Inbox =
  | { type: 'paused'; pause: CdpPaused }
  | { type: 'resumed' };

/** What the code on top of a pause returns to. */
type ReturnTarget =
  /** A frame of the program on the stack, at this index. */
  | { kind: 'frame'; index: number }
  /** The function of the program awaiting it, which is not on the stack. */
  | { kind: 'awaiter'; parent: CdpAsyncFrame }
  /** Nothing of the program's. */
  | { kind: 'nothing' }
  /** js-debug did not say, or the stack is deeper than was asked about. */
  | { kind: 'unknown' };

/** How many frames of a stack js-debug is asked to mark, at most. */
const MAX_MARKED_FRAMES = 200;

/** How far past the sync frames js-debug is asked: the labels of the async segments and the awaiter's frame. */
const ASYNC_MARKS = 12;

interface Chain {
  kind: StepKind;
  threadId: number | undefined;
  originDepth: number;
  originFn: string;
  inbox: Inbox[];
  wake: (() => void) | null;
  cancelled: string | null;
  /** Pauses js-debug keeps, each of which it reports with one `stopped`. */
  kept: number;
  /** `stopped` events of this chain seen so far. */
  stoppedSeen: number;
  lastStopped: DebugProtocol.Event | null;
  commands: string[];
  /** Step-ins sent from a landing in skipped code: the walk's engine steps. */
  spent: number;
  /** The walk took all of its engine steps and the step-in stepped out. */
  walkEnded: boolean;
  /** The last walk record sent says the walk is going (and nothing since says it may not be). */
  walkRecorded: boolean;
  /** Every command the chain may send is spent and skipped code is still on top. */
  capped: boolean;
  /** The caller asked for a pause during the chain: the next stop is theirs. */
  pauseRequested: boolean;
  /** That pause was taken on no breakpoint of js-debug's: it is reported as the pause it is. */
  pauseTaken: boolean;
  /**
   * The chain ended by resuming the program (the stack it started on is
   * gone) and the resume is out: a `stopped` beyond the chain's kept pauses
   * is the program's next stop, never the chain's.
   */
  leaving: boolean;
  /**
   * Those next stops, and any `continued` after the first of them (never the
   * chain's own: its resume's `continued` comes before the program's next
   * pause), held in order until the chain's own record is out, then
   * delivered as they are. Dropped if the chain is given up meanwhile: the
   * request that gave it up is the caller's, and V8 has moved on (review 10).
   */
  afterLeaving: DebugProtocol.Event[];
  startedAt: number;
}

/** A record of the walk to send just before the command a verdict leads to. */
type WalkRecord = { record: 'started' } | { record: 'ended'; why: 'limit' };

type Verdict =
  | { kind: 'wait' }
  | ({ kind: 'command'; command: string } & ({ record?: undefined } | WalkRecord))
  | { kind: 'landing'; by: string }
  | { kind: 'real-stop' }
  | { kind: 'left-stack' };

function fnKey(frame: CdpCallFrame): string {
  const l = frame.functionLocation ?? frame.location;
  return `${l.scriptId}:${l.lineNumber}:${l.columnNumber ?? 0}`;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** A pause as V8 reported it, for the debug log: its reason, the breakpoints it hit, its top frame. */
function describePause(pause: CdpPaused): string {
  const top = pause.callFrames[0];
  const where = top ? `${top.functionName || '(anonymous)'} ${top.location.scriptId}:${top.location.lineNumber}:${top.location.columnNumber ?? 0}` : 'no frame';
  return `reason=${pause.reason} hitBreakpoints=${JSON.stringify(pause.hitBreakpoints ?? [])} top=${where} depth=${pause.callFrames.length}`;
}

/**
 * js-debug's mark on a frame. `deemphasize` is its own value for a frame of
 * skipped code (skipFiles, or an unmapped position of a source-mapped file);
 * the DAP type does not list it.
 */
function markOf(frame: DebugProtocol.StackFrame): string | undefined {
  return frame.presentationHint as string | undefined;
}

export class JsStepper {
  private readonly target: StepperTarget;
  private readonly deliver: (event: DebugProtocol.Event) => void;
  private readonly tunables: JsStepperTunables;
  private readonly sleep: (ms: number) => Promise<void>;

  private cdp: StepperCdp | null = null;
  private readonly onCdpEvent = (method: string, params: unknown): void => this.handleCdpEvent(method, params);

  /** Whether this session steps through skipped code (the effective `smartStep`). */
  private enabled = false;
  /** The pause V8 is in now, as CDP reported it; null while running. */
  private current: CdpPaused | null = null;
  private chain: Chain | null = null;
  /** `stopped` events of a finished chain still on their way; dropped when they arrive, until the deadline. */
  private owed = 0;
  private owedUntil = 0;
  /**
   * Scripts of Node's own that js-debug marked "Skipped by skipFiles", not
   * asked about again. js-debug decides per original source; a Node module
   * is one script and one source (`<node_internals>/...`), so its verdict
   * holds at every position. A bundle or a node_modules file is not
   * remembered: some of its lines can be the program's.
   */
  private readonly skippedScripts = new Set<string>();
  /** What each pause's top frame returns to: asked of js-debug once per pause. */
  private readonly targets = new WeakMap<CdpPaused, ReturnTarget>();

  constructor(options: JsStepperOptions) {
    this.target = options.target;
    this.deliver = options.deliver;
    this.tunables = { ...DEFAULT_JS_STEPPER_TUNABLES, ...(options.tunables ?? {}) };
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /** The session's choice: step through skipped code (on), or land where V8 lands (off). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** The session's choice as it stands: a forked child's stepper takes it over. */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Listen on the target's CDP socket. Safe before it is connected. */
  attachCdp(cdp: StepperCdp): void {
    this.detachCdp();
    this.cdp = cdp;
    cdp.on('cdp-event', this.onCdpEvent);
  }

  /** The socket is gone (the target ended): a chain in flight is given up. */
  detachCdp(): void {
    this.cdp?.off('cdp-event', this.onCdpEvent);
    this.cdp = null;
    this.current = null;
    this.owed = 0;
    const chain = this.chain;
    if (chain) {
      chain.cancelled = 'the CDP connection closed';
      chain.wake?.();
    }
  }

  /** Whether this request is one the stepper serves now. */
  handles(command: string, args?: unknown): boolean {
    if (!this.enabled || !(command in STEP_OF_COMMAND)) {
      return false;
    }
    // A step into a named target is js-debug's own feature.
    if (command === 'stepIn' && (args as { targetId?: number } | undefined)?.targetId !== undefined) {
      return false;
    }
    return this.cdp?.isConnected() === true && this.current !== null && this.current.callFrames.length > 0;
  }

  /**
   * Serve one step. Resolves when V8 has taken the first command; the one
   * `stopped` of the chain is delivered later.
   */
  async request(command: string, args?: unknown): Promise<DebugProtocol.Response> {
    const kind = STEP_OF_COMMAND[command];
    const origin = this.current;
    if (!kind || !origin || !this.cdp) {
      throw new Error(`The JavaScript stepper cannot serve '${command}' now`);
    }
    await this.abandonChain('another step was requested');

    const top = origin.callFrames[0];
    const chain: Chain = {
      kind,
      threadId: (args as { threadId?: number } | undefined)?.threadId,
      originDepth: origin.callFrames.length,
      originFn: fnKey(top),
      inbox: [],
      wake: null,
      cancelled: null,
      kept: 0,
      stoppedSeen: 0,
      lastStopped: null,
      commands: [],
      spent: 0,
      walkEnded: false,
      walkRecorded: false,
      capped: false,
      pauseRequested: false,
      pauseTaken: false,
      leaving: false,
      afterLeaving: [],
      startedAt: Date.now()
    };
    this.chain = chain;
    this.owed = 0;

    try {
      // js-debug's mark on the frame the step starts from: a module of Node's
      // own it skips is then not asked about again at a landing.
      await this.isSkipped(chain, origin);
      await this.sendStep(chain, CDP_COMMAND[kind]);
    } catch (err) {
      this.chain = null;
      throw err;
    }
    void this.run(chain);
    return { type: 'response', seq: 0, request_seq: -1, command, success: true, body: {} } as DebugProtocol.Response;
  }

  /**
   * A request for the target that is not a step. One that resumes or ends
   * the target ends a chain still in flight first.
   */
  async beforeRequest(command: string): Promise<void> {
    if (CHAIN_ENDING_REQUESTS.has(command)) {
      await this.abandonChain(`a '${command}' request`);
    } else if (command === 'pause' && this.chain) {
      // An explicit pause wins over a step in flight: wherever V8 stops next
      // is the caller's pause, in skipped code too. V8 reports a pause taken
      // while a step is in flight as the step, so only this tells them apart.
      this.chain.pauseRequested = true;
    }
  }

  /**
   * Every event of the target passes here first. True means the stepper
   * keeps it: the caller must not forward it.
   */
  withholds(event: DebugProtocol.Event): boolean {
    const chain = this.chain;
    if (event.event === 'stopped') {
      if (chain?.leaving && chain.stoppedSeen >= chain.kept) {
        // js-debug reports pauses in order, so once every kept pause of the
        // chain is reported, a `stopped` after its resume is the program's
        // next stop (a breakpoint the resumed program reached while V8's
        // answer to the resume was still on its way: review 9, M1). It goes
        // out as itself, after the chain's record that it resumed.
        logger.debug(`[JsStepper] DAP stopped after the step resumed the program (reason=${(event.body as { reason?: string } | undefined)?.reason}): held until the step's record is out`);
        chain.afterLeaving.push(event);
        return true;
      }
      if (chain) {
        chain.stoppedSeen++;
        chain.lastStopped = event;
        const body = (event.body ?? {}) as { reason?: string; description?: string };
        logger.debug(
          `[JsStepper] DAP stopped during a step ${chain.kind} (reason=${body.reason}, description=${body.description}): ` +
          `${chain.stoppedSeen} seen, ${chain.kept} pauses kept`
        );
        chain.wake?.();
        return true;
      }
      if (this.owed > 0) {
        if (Date.now() > this.owedUntil) {
          this.owed = 0;
        } else if (this.looksOwed(event)) {
          // A late report of one of the finished step's own pauses.
          this.owed--;
          return true;
        }
      }
      return false;
    }
    if (event.event === 'continued' && chain?.leaving && chain.afterLeaving.length > 0) {
      // A resume of a stop held above, not the chain's: it goes out after that stop.
      chain.afterLeaving.push(event);
      return true;
    }
    // One `continued` per resume: a chain's are its own business. The caller
    // was told the program resumed when the step was answered.
    return event.event === 'continued' && chain !== null;
  }

  /** For the log and the tests. */
  describe(): { enabled: boolean; chain: boolean; owed: number; paused: boolean } {
    return { enabled: this.enabled, chain: this.chain !== null, owed: this.owed, paused: this.current !== null };
  }

  // ----- CDP events -----

  private handleCdpEvent(method: string, params: unknown): void {
    if (method === 'Debugger.paused') {
      const pause = params as CdpPaused;
      this.current = pause;
      const chain = this.chain;
      if (chain) {
        logger.debug(`[JsStepper] CDP Debugger.paused during a step ${chain.kind}: ${describePause(pause)}`);
        chain.inbox.push({ type: 'paused', pause });
        chain.wake?.();
      }
    } else if (method === 'Debugger.resumed') {
      this.current = null;
      const chain = this.chain;
      if (chain) {
        logger.debug(`[JsStepper] CDP Debugger.resumed during a step ${chain.kind}`);
        chain.inbox.push({ type: 'resumed' });
        chain.wake?.();
      }
    }
  }

  // ----- the chain -----

  private async run(chain: Chain): Promise<void> {
    try {
      for (;;) {
        const pause = await this.nextPause(chain);
        if (!pause) {
          await this.finish(chain, 'cancelled');
          return;
        }
        const verdict = await this.judge(chain, pause);
        if (verdict.kind === 'wait') {
          continue;
        }
        if (verdict.kind === 'command') {
          if (chain.commands.length >= this.tunables.commandCap) {
            // Still in skipped code after every command the chain may send:
            // stop here and say so rather than run on.
            chain.capped = true;
            await this.finish(chain, 'landing', 'the command cap, still in skipped code');
            return;
          }
          if (chain.cancelled) {
            // Given up while the landing was being judged: nothing more is sent.
            await this.finish(chain, 'cancelled');
            return;
          }
          if (chain.pauseRequested) {
            // The caller asked for a pause while this landing was being
            // judged: V8 is paused, and this stop is theirs.
            chain.pauseTaken = true;
            await this.finish(chain, 'real-stop');
            return;
          }
          if (verdict.record === 'started') {
            this.recordWalkStarted(chain);
          } else if (verdict.record === 'ended') {
            this.recordWalkEnded(chain, verdict.why);
          }
          await this.sendStep(chain, verdict.command);
          continue;
        }
        if (verdict.kind === 'left-stack' && chain.cancelled) {
          // Given up while what the stack returns to was being asked: the
          // request that gave it up is the caller's, and the chain neither
          // resumes the program nor records anything (review 8).
          await this.finish(chain, 'cancelled');
          return;
        }
        if (verdict.kind === 'left-stack' && chain.pauseRequested) {
          // The stack is gone, but the caller asked for a pause while that
          // was being found out: V8 is paused, and the stop is theirs.
          chain.pauseTaken = true;
          await this.finish(chain, 'real-stop');
          return;
        }
        await this.finish(chain, verdict.kind, verdict.kind === 'landing' ? verdict.by : undefined);
        return;
      }
    } catch (err) {
      logger.warn(`[JsStepper] chain failed: ${errorText(err)}`);
      // If V8 is paused, the caller must hear of the stop it can see: where
      // the step is now, as the step it is.
      const paused = this.current !== null && !chain.cancelled;
      await this.finish(chain, paused ? 'landing' : 'error', paused ? 'where it was when the chain failed' : undefined).catch(
        (failure) => logger.warn(`[JsStepper] could not end a failed chain: ${errorText(failure)}`)
      );
    }
  }

  private async sendStep(chain: Chain, command: string): Promise<void> {
    const cdp = this.cdp;
    if (!cdp) {
      throw new Error('the CDP connection closed');
    }
    chain.commands.push(command);
    await cdp.send(command, command === CDP_COMMAND.in ? { breakOnAsyncCall: false } : {});
  }

  private waitForInbox(chain: Chain): Promise<void> {
    return new Promise<void>((resolve) => {
      chain.wake = () => {
        chain.wake = null;
        resolve();
      };
    });
  }

  /** The next CDP pause of the chain, or null when the chain was given up. */
  private async nextPause(chain: Chain): Promise<CdpPaused | null> {
    for (;;) {
      if (chain.cancelled) {
        return null;
      }
      const next = chain.inbox.shift();
      if (next?.type === 'paused') {
        return next.pause;
      }
      if (!next) {
        await this.waitForInbox(chain);
      }
    }
  }

  private async judge(chain: Chain, pause: CdpPaused): Promise<Verdict> {
    // Every breakpoint V8 reports is js-debug's: the stepper sets none.
    const foreignHit = (pause.hitBreakpoints ?? []).length > 0;
    const ours = !chain.pauseRequested && !foreignHit && STEP_REASONS.has(pause.reason);

    if (!ours) {
      // Another breakpoint, an exception, a pause the caller asked for:
      // js-debug decides. Resumed by js-debug, or the chain given up, the run
      // loop goes back to waiting.
      const decided = await this.jsDebugDecides(chain);
      logger.debug(`[JsStepper] a pause not the step's own (${describePause(pause)}): ${decided}`);
      if (decided === 'resumed' && chain.walkRecorded) {
        // js-debug resumed a pause of its own during the walk: whether V8
        // still carries the step is not known (issue #1162 is one it lost),
        // so the record of a walk in progress is withdrawn. A landing of the
        // step's own in skipped code later records it again.
        this.recordWalkEnded(chain, 'resumed');
      }
      if (decided !== 'kept') {
        return { kind: 'wait' };
      }
      chain.kept++;
      chain.pauseTaken = chain.pauseRequested && !foreignHit;
      return { kind: 'real-stop' };
    }
    chain.kept++;

    const skipped = await this.isSkipped(chain, pause);
    if (chain.cancelled) {
      // Given up while js-debug was being asked: nothing more is sent.
      return { kind: 'wait' };
    }

    if (skipped) {
      // A step-in walks on until it has taken its limit of engine steps in
      // skipped code, with or without anything below: a step issued inside a
      // dependency reaches the program's handler by calls, not returns (issue
      // #687). Steps only, never time: how long the skipped code runs, or
      // what an engine step costs over the inspector link, does not move
      // where the step lands. A walk that outlasts the step's grace window
      // answers `pending` and says it is walking (the record).
      let endingWalk = false;
      if (chain.kind === 'in' && !chain.walkEnded) {
        if (chain.spent < this.tunables.walkBudgetSteps) {
          chain.spent++;
          return chain.walkRecorded
            ? { kind: 'command', command: CDP_COMMAND.in }
            : { kind: 'command', command: CDP_COMMAND.in, record: 'started' };
        }
        chain.walkEnded = true;
        endingWalk = true;
      }
      // It has to step out now. With nothing of the program below (no frame,
      // no awaiter), the stack the step started on is gone.
      if ((await this.returnTarget(chain, pause)).kind === 'nothing') {
        return { kind: 'left-stack' };
      }
      return endingWalk && chain.walkRecorded
        ? { kind: 'command', command: CDP_COMMAND.out, record: 'ended', why: 'limit' }
        : { kind: 'command', command: CDP_COMMAND.out };
    }

    // Program code on top: V8's step landed. On the line the step started
    // from too: a new position there (after a step-out, the caller's next
    // break position on the line; in a one-line loop, the header's next
    // position, as the traces show), where the program's code next runs.
    return { kind: 'landing', by: 'V8 step' };
  }

  /**
   * A pause that is not the stepper's: either js-debug resumes it itself (a
   * `resumed` the stepper did not send), or it keeps it and sends one more
   * `stopped` than the chain's kept pauses account for. The `stopped` comes
   * on js-debug's DAP connection and the `resumed` on the CDP socket, and a
   * `stopped` for a LATER pause can arrive before the CDP `resumed` of this
   * one (measured under Node 22 on Linux: two pauses js-debug takes and
   * resumes itself, then the step's landing, whose `stopped` overtook both
   * CDP events). So a `stopped` is read as "kept" only after the CDP stream
   * has caught up with it: see `catchUp`.
   */
  private async jsDebugDecides(chain: Chain): Promise<'kept' | 'resumed' | 'cancelled'> {
    /** The `stopped` count the CDP stream last caught up with. */
    let caughtUpWith = -1;
    for (;;) {
      if (chain.cancelled) {
        return 'cancelled';
      }
      const next = chain.inbox[0];
      if (next?.type === 'resumed') {
        // The stepper has sent nothing since this pause: js-debug resumed it.
        chain.inbox.shift();
        return 'resumed';
      }
      if (next?.type === 'paused') {
        // A newer pause already: the one being judged was resumed.
        return 'resumed';
      }
      if (chain.stoppedSeen > chain.kept) {
        if (caughtUpWith === chain.stoppedSeen) {
          // The stream has caught up and says nothing newer: js-debug kept it.
          return 'kept';
        }
        caughtUpWith = chain.stoppedSeen;
        await this.catchUp(chain);
        continue;
      }
      await this.waitForInbox(chain);
    }
  }

  /**
   * Make the CDP stream catch up with js-debug's DAP events: one request V8
   * answers, sent over js-debug's CDP proxy, the socket the forwarded events
   * travel on. That socket is ordered, so every CDP event js-debug forwarded
   * before the answer is in the inbox when the answer comes. A failure costs
   * only the catch-up: the inbox is read as it stands.
   */
  private async catchUp(chain: Chain): Promise<void> {
    const before = this.describeInbox(chain);
    const started = Date.now();
    let answer: string;
    try {
      const cdp = this.cdp;
      if (!cdp) {
        throw new Error('the CDP connection closed');
      }
      const result = await cdp.send<{ id?: string }>(CATCH_UP_METHOD, {});
      answer = `isolate ${result?.id ?? '?'}`;
    } catch (err) {
      answer = `failed: ${errorText(err)}`;
      logger.warn(`[JsStepper] the CDP stream could not catch up (${errorText(err)}); the inbox is read as it stands`);
    }
    logger.debug(
      `[JsStepper] CDP stream catch-up (${CATCH_UP_METHOD}, ${answer}) in ${Date.now() - started} ms for ` +
      `${chain.stoppedSeen} stopped seen, ${chain.kept} pauses kept: inbox before [${before}], after [${this.describeInbox(chain)}]`
    );
  }

  /** The chain's unread CDP events, for the log. */
  private describeInbox(chain: Chain): string {
    return chain.inbox.map((item) => (item.type === 'paused' ? `paused(${item.pause.reason})` : 'resumed')).join(', ');
  }

  /** The walk is going: the parent process's pending answer may say so (round 3, decision 2). */
  private recordWalkStarted(chain: Chain): void {
    chain.walkRecorded = true;
    this.deliver({
      seq: 0,
      type: 'event',
      event: PROXY_STEP_WALK_STARTED_EVENT,
      body: { threadId: chain.threadId ?? 0, stepLimit: this.tunables.walkBudgetSteps }
    });
  }

  /** The walk is no longer known to be going: the record of it is withdrawn. */
  private recordWalkEnded(chain: Chain, why: 'limit' | 'resumed' | 'failed'): void {
    chain.walkRecorded = false;
    this.deliver({ seq: 0, type: 'event', event: PROXY_STEP_WALK_ENDED_EVENT, body: { threadId: chain.threadId ?? 0, why } });
  }

  /** js-debug's mark on frame 0 of the current pause. */
  private async isSkipped(chain: Chain, pause: CdpPaused): Promise<boolean> {
    const scriptId = pause.callFrames[0].location.scriptId;
    const plainLanding = pause.reason === 'step' && (pause.hitBreakpoints ?? []).length === 0;
    if (plainLanding && this.skippedScripts.has(scriptId)) {
      return true;
    }
    const marks = await this.marks(chain, 1);
    if (typeof marks === 'string') {
      logger.warn(`[JsStepper] no verdict for a landing (${marks}); treating it as program code`);
      return false;
    }
    const skipped = markOf(marks[0]) === 'deemphasize';
    // Remembered only for a module of Node's own, by js-debug's own name for
    // its source: one script, one source, no source map (C1).
    if (skipped && /skipFiles/i.test(marks[0].source?.origin ?? '') && (marks[0].source?.path ?? '').startsWith('<node_internals>')) {
      this.skippedScripts.add(scriptId);
    }
    return skipped;
  }

  /**
   * js-debug's frames for the pause V8 is in, with its marks; or, as a
   * string, why there are none. js-debug answers "not paused" until it has
   * taken the pause in, so the question is asked again until the ceiling.
   */
  private async marks(chain: Chain, levels: number): Promise<DebugProtocol.StackFrame[] | string> {
    const deadline = Date.now() + this.tunables.verdictCeilingMs;
    for (;;) {
      let failure: string;
      try {
        const answer = await this.target.sendRequest<DebugProtocol.StackTraceResponse>(
          'stackTrace',
          { threadId: chain.threadId ?? 0, startFrame: 0, levels },
          5000
        );
        const frames = answer?.body?.stackFrames;
        if (answer?.success !== false && frames && frames.length > 0) {
          return frames;
        }
        failure = answer?.message ?? 'no frame';
      } catch (err) {
        failure = errorText(err);
      }
      if (chain.cancelled || Date.now() >= deadline) {
        return failure;
      }
      await this.sleep(1);
    }
  }

  private async finish(chain: Chain, ended: 'landing' | 'real-stop' | 'left-stack' | 'cancelled' | 'error', why?: string): Promise<void> {
    let ender = ended;
    let by = why;
    // Where the step is, for what its answer may say about it.
    const landed = this.current;
    const backInOriginFrame = landed !== null && landed.callFrames.length === chain.originDepth &&
      fnKey(landed.callFrames[0]) === chain.originFn;
    if (ender === 'left-stack') {
      // Nothing of the program is below: resume, and report nothing. From
      // here on, what the resumed program stops at is not the chain's.
      chain.leaving = true;
      try {
        chain.commands.push('Debugger.resume');
        await this.cdp?.send('Debugger.resume', {});
      } catch (err) {
        logger.warn(`[JsStepper] resume after leaving the stack failed: ${errorText(err)}`);
        if (this.current !== null && this.current === landed) {
          // V8 is still paused where the chain left it: the caller hears of
          // the stop it can see. (Paused anywhere else, V8 took the resume
          // and the answer was lost: the stop it is in now is the program's
          // next, held above or still to come, review 10.)
          ender = 'landing';
          by = 'where it was: V8 refused the resume';
        }
      }
    }
    const reports = ender === 'landing' || ender === 'real-stop';
    if (reports) {
      // One `stopped` per kept pause; the last is this chain's.
      const deadline = Date.now() + this.tunables.settleCeilingMs;
      while (chain.stoppedSeen < chain.kept && !chain.cancelled && Date.now() < deadline) {
        await Promise.race([this.waitForInbox(chain), this.sleep(5)]);
      }
    }
    if (this.chain === chain) {
      this.chain = null;
    }
    const missing = Math.max(0, chain.kept - chain.stoppedSeen);
    if (missing > 0) {
      this.owed = missing;
      this.owedUntil = Date.now() + this.tunables.settleCeilingMs;
    }
    if (ender === 'left-stack' && !chain.cancelled) {
      // The program runs on and the step will not land: no stop to report.
      // The record goes to the parent process, whose pending answer may then
      // say the step left its frame (I3). A chain given up while its resume
      // was being answered records nothing: the request that gave it up is
      // the caller's (as in review 8's case, before the resume).
      this.deliver({ seq: 0, type: 'event', event: PROXY_STEP_LEFT_STACK_EVENT, body: { threadId: chain.threadId ?? 0 } });
    } else if (ender === 'error' && chain.walkRecorded) {
      // The chain failed with V8 running: nothing walks any more.
      this.recordWalkEnded(chain, 'failed');
    }
    const count = (name: string): number => chain.commands.filter((c) => c === name).length;
    logger.info(
      `[JsStepper] step ${chain.kind} ended: ${ender}${by ? ` (${by})` : ''}${chain.cancelled ? ` [${chain.cancelled}]` : ''}; ` +
      `${count(CDP_COMMAND.in)} in, ${count(CDP_COMMAND.over)} over, ${count(CDP_COMMAND.out)} out; ` +
      `${chain.kept} pauses kept, ${chain.stoppedSeen} stopped seen; ${Date.now() - chain.startedAt} ms`
    );
    if (ender === 'landing') {
      const body = { ...((chain.lastStopped?.body ?? {}) as Record<string, unknown>) };
      delete body.hitBreakpointIds;
      delete body.text;
      this.deliver({
        seq: 0,
        type: 'event',
        event: 'stopped',
        body: {
          allThreadsStopped: false,
          ...body,
          threadId: (body.threadId as number | undefined) ?? chain.threadId ?? 0,
          reason: 'step',
          description: 'Paused',
          ...this.landingNote(chain, backInOriginFrame)
        }
      });
    } else if (ender === 'real-stop' && chain.pauseTaken) {
      // The pause the caller asked for. js-debug may report it under another
      // reason, or may not have reported it yet: it leaves as the pause it is.
      const body = { ...((chain.lastStopped?.body ?? {}) as Record<string, unknown>) };
      delete body.hitBreakpointIds;
      delete body.text;
      this.deliver({
        seq: 0,
        type: 'event',
        event: 'stopped',
        body: {
          allThreadsStopped: false,
          ...body,
          threadId: (body.threadId as number | undefined) ?? chain.threadId ?? 0,
          reason: 'pause',
          description: 'Paused'
        }
      });
    } else if (ender === 'real-stop' && chain.lastStopped) {
      this.deliver(chain.lastStopped);
    }
    // The program's own next stops, reached after the chain's resume: never
    // lost, and after the chain's record; stale, and dropped, once the chain
    // was given up (a continue or a new step has moved V8 on).
    const after = chain.afterLeaving.splice(0);
    if (chain.cancelled) {
      if (after.length > 0) {
        logger.debug(`[JsStepper] ${after.length} event(s) after the step's resume dropped: the step was given up (${chain.cancelled})`);
      }
    } else {
      for (const next of after) {
        this.deliver(next);
      }
    }
  }

  /**
   * What a landing says beyond where it is. Only what is known: the sentence
   * on a step-in that reached nothing of the program's is for one that came
   * back to the frame it left, not one that went on into program code.
   */
  private landingNote(chain: Chain, backInOriginFrame: boolean): { text?: string } {
    if (chain.capped) {
      return { text: ErrorMessages.stepStillInSkippedCode(chain.commands.length) };
    }
    if (chain.walkEnded && backInOriginFrame) {
      return { text: ErrorMessages.stepIntoReachedNoProgramCode(this.tunables.walkBudgetSteps) };
    }
    return {};
  }

  /**
   * Whether a `stopped` that arrives after a chain ended can be the late
   * report of one of that chain's own pauses: js-debug reports a step it did
   * not request as `pause` (or `step`). Anything else is somebody else's
   * stop and goes on.
   */
  private looksOwed(event: DebugProtocol.Event): boolean {
    const body = (event.body ?? {}) as { reason?: string };
    return body.reason === 'pause' || body.reason === 'step';
  }

  private async abandonChain(why: string): Promise<void> {
    const chain = this.chain;
    if (!chain) {
      return;
    }
    chain.cancelled = why;
    chain.wake?.();
    // The run loop ends the chain; the caller goes on without waiting for it.
    if (this.chain === chain) {
      this.chain = null;
    }
  }

  /** What the top frame of `pause` returns to; js-debug is asked once per pause. Never throws. */
  private async returnTarget(chain: Chain, pause: CdpPaused): Promise<ReturnTarget> {
    const known = this.targets.get(pause);
    if (known) {
      return known;
    }
    let target: ReturnTarget = { kind: 'unknown' };
    try {
      target = await this.findReturnTarget(chain, pause);
    } catch (err) {
      logger.warn(`[JsStepper] could not tell what the stack returns to: ${errorText(err)}`);
    }
    this.targets.set(pause, target);
    return target;
  }

  /**
   * The nearest frame of the program below the top one, by js-debug's marks.
   * With none on the stack, the function awaiting an async one the event
   * loop resumed: the first frame of V8's async stack, when every link down
   * to it is an `await` (a `Promise.then` or timer link only scheduled the
   * code on top) and js-debug marks it program code. An awaiter only says
   * the stack is not gone; V8's own step leads to it.
   */
  private async findReturnTarget(chain: Chain, pause: CdpPaused): Promise<ReturnTarget> {
    const frames = pause.callFrames;
    const asked = Math.min(frames.length + ASYNC_MARKS, MAX_MARKED_FRAMES);
    const marks = await this.marks(chain, asked);
    if (typeof marks === 'string') {
      logger.warn(`[JsStepper] could not read the stack's marks (${marks})`);
      return { kind: 'unknown' };
    }
    // js-debug lists the sync frames, then a label frame per async segment and that segment's frames.
    const firstLabel = marks.findIndex((frame) => markOf(frame) === 'label');
    const sync = firstLabel === -1 ? marks : marks.slice(0, firstLabel);
    for (let i = 1; i < Math.min(sync.length, frames.length); i++) {
      if (markOf(sync[i]) !== 'deemphasize') {
        return { kind: 'frame', index: i };
      }
    }
    if (firstLabel === -1) {
      // No async part was listed: the stack ends here, unless it is deeper than was asked about.
      return marks.length >= asked ? { kind: 'unknown' } : { kind: 'nothing' };
    }
    let link = pause.asyncStackTrace;
    while (link && link.description === 'await' && !link.callFrames?.length) {
      link = link.parent;
    }
    const parent = link?.description === 'await' ? link.callFrames?.[0] : undefined;
    if (!parent) {
      return { kind: 'nothing' };
    }
    const awaiter = marks.slice(firstLabel).find((frame) => markOf(frame) !== 'label');
    if (!awaiter) {
      return { kind: 'unknown' };
    }
    return markOf(awaiter) === 'deemphasize' ? { kind: 'nothing' } : { kind: 'awaiter', parent };
  }
}
