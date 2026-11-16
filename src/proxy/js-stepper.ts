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
 *   NETS. V8 loses a step in two measured ways: when a frame is left through
 *   a `return` that runs a `finally` first, within the run the step began in
 *   (issue #1161: the replayed Return bytecode has no source position, so it
 *   is not a break location, and V8's step-out floods return locations only;
 *   a `return` out of for...of and a `using` declaration close the same
 *   way), and when js-debug resumes a pause of its own, a module-entry
 *   breakpoint, while the step is in flight (issue #1162). A net is a capped
 *   set of temporary CDP breakpoints on the break positions of the frame a
 *   step returns to, kept with the stack depth of the activation it guards.
 *   Any position there is where V8's own step-out would stop, so a hit at
 *   that depth is a landing.
 *
 *   A NET IS SET ONLY WHERE A HIT PROVES THE STEP CAME BACK. Five versions
 *   of the rule that decided where read the program's source to tell a
 *   function that returns from one that suspends at an `await` or `yield`,
 *   and each was fooled by some way of writing JavaScript. V8 knows, and
 *   says so on every frame of a pause: `canBeRestarted` is false for an
 *   async function, a generator and module code that may await, and for
 *   every frame below one (measured on Node 22, 24 and 26 over every
 *   function form). So, in one place, before every command that can leave
 *   the frame on top (`guard`):
 *
 *     (a) The frame guarded, the nearest frame of the program below, can be
 *         restarted. Then it and every frame above it are plain functions:
 *         each comes down only by returning, so control back in the guarded
 *         frame means the step came back, and the guarded frame stays on the
 *         stack until it reaches a net position. A frame that cannot be
 *         restarted is not netted: a step that leaves through an async
 *         function or a generator, or returns to one, is V8's own, and what
 *         V8 loses there stays lost (issue #1174). To spare breakpoints, a
 *         function being left whose text names nothing that closes through
 *         a finally (`finally`, `for...of`, `using`) is not netted either;
 *         that test only ever errs toward netting.
 *
 *     (b) The net covers every break position of the frame it guards, or
 *         there is none: a hit is then the first position control reaches
 *         in that activation. A function with more than `netSize` positions,
 *         or whose positions cannot all be found, is not netted, and when
 *         V8 refuses one of them none is kept. A rescue lands at the
 *         caller's next break location after the call; V8's own step-out,
 *         when it does not lose the step, can stop once more on the call's
 *         own line.
 *
 *   Nothing is ever guarded that is not on the stack (no net on an awaiting
 *   function), and nothing is decided on a pause's reason, which does not
 *   say whether V8 had lost the step.
 *
 *   A net is a safeguard, never a condition: when one cannot be set the step
 *   goes on with V8 alone.
 *
 *   No net is put on the frame being stepped IN. V8 says `ambiguous` for any
 *   breakpoint hit while a step is in flight, and it exposes no statement
 *   boundaries, so a hit on a later position of the same statement (the
 *   second argument of a multi-line call) cannot be told from the next
 *   statement. In-frame stepping stays V8's own. That is why a plain
 *   `step_over` across issue #1162's module load is not recovered here.
 *
 *   Skipped code on top: `step_into` repeats up to a budget (that is how a
 *   call through Node's own code reaches a callback of the program's), then
 *   steps out; `step_over` and `step_out` step out at once. With nothing of
 *   the program below (no frame, no awaiter), the stack the step started on
 *   is gone: the program is resumed and nothing is reported (stepping out
 *   of the bottom frame would land in the next task's internals instead).
 *
 *   A pause that is not the stepper's (another breakpoint, an exception) is
 *   js-debug's to decide. Resumed by js-debug, the chain waits on. Kept, the
 *   chain ends and that stop is forwarded as itself. A pause the caller
 *   asks for during a chain makes the next stop theirs, wherever it is: V8
 *   reports it as the step, so only the request tells them apart. (For the
 *   same reason a `debugger;` statement reached during a step is reported
 *   as the step's landing, as js-debug's own stepper reports it.)
 *
 *   js-debug's `stopped` and `continued` events are withheld by count: it
 *   sends one `stopped` per pause it keeps, out of order with the
 *   `continued` of the next resume. The last one is forwarded: as reason
 *   `step` on a landing (it arrives as `pause` or `breakpoint`), unchanged on
 *   a real stop.
 *
 *   Every ender removes every net.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import { createLogger } from '../utils/logger.js';
import { ErrorMessages } from '../utils/error-messages.js';

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
  /** Repeats of a step-in while the landing is skipped code, before stepping out. */
  budget: number;
  /** CDP step commands in one chain, all told. */
  commandCap: number;
  /**
   * The most break positions a net may have. A net covers every position of
   * the function it guards, or the function is not netted: a net on part of
   * it can miss the position control comes back to (a loop's back edge, the
   * code after a long else) and fire later, in another iteration or another
   * call. A breakpoint is slow to set in a big function (1000 took 2.4 s).
   */
  netSize: number;
  /** Re-issued commands on a net position that is not a landing (recursion; the origin statement). */
  reissueCap: number;
  /** How long a finished chain waits for js-debug's `stopped` events before it reports without them. */
  settleCeilingMs: number;
  /** How long `stackTrace` may answer "not paused" for a pause js-debug keeps. */
  verdictCeilingMs: number;
}

export const DEFAULT_JS_STEPPER_TUNABLES: JsStepperTunables = {
  budget: 24,
  commandCap: 128,
  netSize: 100,
  reissueCap: 24,
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

export type StepKind = 'in' | 'over' | 'out';

const STEP_OF_COMMAND: Record<string, StepKind> = { stepIn: 'in', next: 'over', stepOut: 'out' };
const CDP_COMMAND: Record<StepKind, string> = { in: 'Debugger.stepInto', over: 'Debugger.stepOver', out: 'Debugger.stepOut' };

/** Requests that resume or end the target: a chain still waiting on a net must give it up first. */
const CHAIN_ENDING_REQUESTS = new Set(['continue', 'disconnect', 'terminate', 'restart', 'goto', 'reverseContinue', 'restartFrame']);

/** What ends a chain as a real stop when the pause carries no breakpoint of ours. */
const STEP_REASONS = new Set(['step', 'ambiguous']);

interface CdpLocation {
  scriptId: string;
  lineNumber: number;
  columnNumber?: number;
}

interface CdpBreakLocation extends CdpLocation {
  type?: string;
}

interface CdpCallFrame {
  functionName?: string;
  functionLocation?: CdpLocation;
  location: CdpLocation;
  /**
   * V8's word on restarting the frame: false for an async function, a
   * generator, module code that may await, and every frame below one.
   */
  canBeRestarted?: boolean;
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

interface Net {
  /** What it guards, for the log. */
  name: string;
  /** Function identity, or the async parent's position. */
  fn: string;
  /** The stack depth of the guarded activation. */
  depth: number;
  ids: Set<string>;
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

/** What closes through a finally, written or implied: the exits V8 loses a step on (issue #1161). */
const CLOSES_THROUGH_FINALLY = /\b(finally|using|of)\b/;

interface Chain {
  kind: StepKind;
  threadId: number | undefined;
  originDepth: number;
  originLine: number;
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
  spent: number;
  reissues: number;
  /** A net fired in recursion and was dropped: V8's own step-outs finish, to the origin depth. */
  unwinding: boolean;
  /** Step-ins a step-in had sent when it gave up on the skipped code and stepped out; 0 if it never did. */
  walkedBeforeSteppingOut: number;
  /** Every command the chain may send is spent and skipped code is still on top. */
  capped: boolean;
  /** A step-in's walk found nothing of the program below the skipped code: not looked at again while it walks. */
  walkHasNothingBelow: boolean;
  /** The caller asked for a pause during the chain: the next stop is theirs. */
  pauseRequested: boolean;
  /** That pause was taken on no breakpoint of js-debug's: it is reported as the pause it is. */
  pauseTaken: boolean;
  /** Whether any pause the chain kept was a net's: what a late report of it looks like. */
  netHits: boolean;
  startedAt: number;
}

type Verdict =
  | { kind: 'wait' }
  /** `skipped`: the frame the command steps from is skipped code. */
  | { kind: 'command'; command: string; skipped: boolean }
  | { kind: 'landing'; by: string }
  | { kind: 'real-stop' }
  | { kind: 'left-stack' };

function fnKey(frame: CdpCallFrame): string {
  const l = frame.functionLocation ?? frame.location;
  return `${l.scriptId}:${l.lineNumber}:${l.columnNumber ?? 0}`;
}

function sameOrAfter(a: CdpLocation, b: CdpLocation): boolean {
  return a.lineNumber > b.lineNumber || (a.lineNumber === b.lineNumber && (a.columnNumber ?? 0) >= (b.columnNumber ?? 0));
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
  private nets: Net[] = [];
  /** `stopped` events of a finished chain still on their way; dropped when they arrive, until the deadline. */
  private owed = 0;
  private owedUntil = 0;
  /** Whether an owed report can be a net's (`breakpoint`, naming none of js-debug's). */
  private owedNetHit = false;
  /** Scripts js-debug marked "Skipped by skipFiles": a script-level verdict, not asked again. */
  private readonly skippedScripts = new Set<string>();
  /** Whether a function's text names a construct that closes through a finally. */
  private readonly closing = new Map<string, boolean>();
  /** What each pause's top frame returns to: asked of js-debug once per pause. */
  private readonly targets = new WeakMap<CdpPaused, ReturnTarget>();
  private readonly sources = new Map<string, string[]>();

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

  /** The socket is gone (the target ended): nothing can be removed any more. */
  detachCdp(): void {
    this.cdp?.off('cdp-event', this.onCdpEvent);
    this.cdp = null;
    this.current = null;
    this.nets = [];
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
      originLine: top.location.lineNumber,
      originFn: fnKey(top),
      inbox: [],
      wake: null,
      cancelled: null,
      kept: 0,
      stoppedSeen: 0,
      lastStopped: null,
      commands: [],
      spent: 0,
      reissues: 0,
      unwinding: false,
      walkedBeforeSteppingOut: 0,
      capped: false,
      walkHasNothingBelow: false,
      pauseRequested: false,
      pauseTaken: false,
      netHits: false,
      startedAt: Date.now()
    };
    this.chain = chain;
    this.owed = 0;

    try {
      // The one rule, before the first command as before every other.
      await this.guard(chain, origin, await this.isSkipped(chain, origin));
      await this.sendStep(chain, CDP_COMMAND[kind]);
    } catch (err) {
      await this.disarmAll();
      this.chain = null;
      throw err;
    }
    void this.run(chain);
    return { type: 'response', seq: 0, request_seq: -1, command, success: true, body: {} } as DebugProtocol.Response;
  }

  /**
   * A request for the target that is not a step. One that resumes or ends
   * the target ends a chain still waiting on a net, and removes the net first.
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
      if (chain) {
        chain.stoppedSeen++;
        chain.lastStopped = event;
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
    // One `continued` per resume: a chain's are its own business. The caller
    // was told the program resumed when the step was answered.
    return event.event === 'continued' && chain !== null;
  }

  /** For the log and the tests. */
  describe(): { enabled: boolean; chain: boolean; nets: number; owed: number; paused: boolean } {
    return { enabled: this.enabled, chain: this.chain !== null, nets: this.nets.length, owed: this.owed, paused: this.current !== null };
  }

  // ----- CDP events -----

  private handleCdpEvent(method: string, params: unknown): void {
    if (method === 'Debugger.paused') {
      const pause = params as CdpPaused;
      this.current = pause;
      const chain = this.chain;
      if (chain) {
        chain.inbox.push({ type: 'paused', pause });
        chain.wake?.();
      }
    } else if (method === 'Debugger.resumed') {
      this.current = null;
      const chain = this.chain;
      if (chain) {
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
          await this.guard(chain, pause, verdict.skipped);
          if (chain.cancelled) {
            await this.finish(chain, 'cancelled');
            return;
          }
          if (chain.pauseRequested) {
            chain.pauseTaken = true;
            await this.finish(chain, 'real-stop');
            return;
          }
          await this.sendStep(chain, verdict.command);
          continue;
        }
        if (verdict.kind === 'left-stack' && chain.pauseRequested && !chain.cancelled) {
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

  private netOf(id: string): Net | undefined {
    return this.nets.find((net) => net.ids.has(id));
  }

  private async judge(chain: Chain, pause: CdpPaused): Promise<Verdict> {
    const hits = pause.hitBreakpoints ?? [];
    const hitNets = [...new Set(hits.map((id) => this.netOf(id)).filter((net): net is Net => net !== undefined))];
    const foreignHit = hits.some((id) => !this.netOf(id));
    const ours = !chain.pauseRequested && !foreignHit &&
      (STEP_REASONS.has(pause.reason) || (pause.reason === 'other' && hitNets.length > 0));

    if (!ours) {
      // Another breakpoint, an exception, a pause the caller asked for:
      // js-debug decides. Resumed by js-debug, or the chain given up, the run
      // loop goes back to waiting.
      if ((await this.jsDebugDecides(chain)) !== 'kept') {
        return { kind: 'wait' };
      }
      chain.kept++;
      chain.pauseTaken = chain.pauseRequested && !foreignHit;
      return { kind: 'real-stop' };
    }
    chain.kept++;
    if (hitNets.length > 0) {
      chain.netHits = true;
    }

    const top = pause.callFrames[0];
    const depth = pause.callFrames.length;
    const skipped = await this.isSkipped(chain, pause);
    if (chain.cancelled) {
      // Given up while js-debug was being asked: nothing more is armed or sent.
      return { kind: 'wait' };
    }

    if (skipped) {
      // A step-in walks on while it has budget, with or without anything
      // below: a step issued inside a dependency reaches the program's
      // handler by calls, not returns (issue #687).
      if (chain.kind === 'in' && chain.spent < this.tunables.budget) {
        chain.spent++;
        return { kind: 'command', command: CDP_COMMAND.in, skipped: true };
      }
      // It has to step out now. With nothing of the program below (no frame,
      // no awaiter), the stack the step started on is gone.
      if (!this.guardedBelow(depth) && (await this.returnTarget(chain, pause)).kind === 'nothing') {
        return { kind: 'left-stack' };
      }
      if (chain.kind === 'in' && chain.walkedBeforeSteppingOut === 0) {
        chain.walkedBeforeSteppingOut = chain.commands.filter((sent) => sent === CDP_COMMAND.in).length;
      }
      return { kind: 'command', command: CDP_COMMAND.out, skipped: true };
    }

    // Program code on top.
    if (chain.unwinding) {
      return depth > chain.originDepth
        ? { kind: 'command', command: CDP_COMMAND.out, skipped: false }
        : { kind: 'landing', by: 'V8 step-outs after a net was dropped (recursion)' };
    }
    const backOnOriginStatement = depth === chain.originDepth && fnKey(top) === chain.originFn && top.location.lineNumber === chain.originLine;
    if (hits.length === 0) {
      // V8's step landed. A step-in that is back on the line it left steps in
      // again: that enters the line's next call, or moves on.
      if (chain.kind === 'in' && backOnOriginStatement && chain.reissues < this.tunables.reissueCap) {
        chain.reissues++;
        return { kind: 'command', command: CDP_COMMAND.in, skipped: false };
      }
      return { kind: 'landing', by: 'V8 step' };
    }
    if (chain.kind === 'in' && depth > chain.originDepth) {
      return { kind: 'landing', by: 'net, in a deeper frame of the program' };
    }
    const guarding = hitNets.filter((net) => depth <= net.depth);
    if (guarding.length === 0) {
      if (chain.kind === 'out' && depth >= chain.originDepth && chain.reissues < this.tunables.reissueCap) {
        // The frame being left is the same function as its caller (recursion)
        // and is still running: step out again.
        chain.reissues++;
        return { kind: 'command', command: CDP_COMMAND.out, skipped: false };
      }
      // The net fired in a deeper activation than the one it guards. Drop it;
      // V8's own step-outs from here, until the depth is the origin's.
      for (const net of hitNets) {
        await this.disarm(net);
      }
      chain.unwinding = true;
      if (depth <= chain.originDepth) {
        return { kind: 'landing', by: 'net dropped (recursion)' };
      }
      return { kind: 'command', command: CDP_COMMAND.out, skipped: false };
    }
    // Control is back in a frame a net guards: where V8's own step-out would stop.
    if (chain.kind === 'in' && backOnOriginStatement && chain.reissues < this.tunables.reissueCap) {
      chain.reissues++;
      return { kind: 'command', command: CDP_COMMAND.in, skipped: false };
    }
    // The pause's reason does not say whether V8 had lost the step: it is logged, and nothing is decided on it.
    return { kind: 'landing', by: `net (${pause.reason})` };
  }

  /**
   * A pause that is not the stepper's: either js-debug resumes it itself (a
   * `resumed` the stepper did not send), or it keeps it and sends one more
   * `stopped` than the chain's kept pauses account for.
   */
  private async jsDebugDecides(chain: Chain): Promise<'kept' | 'resumed' | 'cancelled'> {
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
        return 'kept';
      }
      await this.waitForInbox(chain);
    }
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
    if (skipped && /skipFiles/i.test(marks[0].source?.origin ?? '')) {
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
    await this.disarmAll();
    if (ender === 'left-stack') {
      // Nothing of the program is below: resume, and report nothing.
      try {
        chain.commands.push('Debugger.resume');
        await this.cdp?.send('Debugger.resume', {});
      } catch (err) {
        logger.warn(`[JsStepper] resume after leaving the stack failed: ${errorText(err)}`);
        if (this.current !== null) {
          // V8 is still paused: the caller hears of the stop it can see.
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
      this.owedNetHit = chain.netHits;
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
      // The pause the caller asked for. js-debug may call it a breakpoint
      // that names none (it was taken on a net's position), or may not have
      // reported it yet: it leaves as the pause it is.
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
    if (chain.walkedBeforeSteppingOut > 0 && backInOriginFrame) {
      return { text: ErrorMessages.stepIntoReachedNoProgramCode(chain.walkedBeforeSteppingOut) };
    }
    return {};
  }

  /**
   * Whether a `stopped` that arrives after a chain ended can be the late
   * report of one of that chain's own pauses: js-debug reports a step it did
   * not request as `pause` (or `step`), and a net's position as a
   * `breakpoint` that names none of its own. Anything else is somebody
   * else's stop and goes on.
   */
  private looksOwed(event: DebugProtocol.Event): boolean {
    const body = (event.body ?? {}) as { reason?: string; hitBreakpointIds?: number[] };
    if (body.reason === 'pause' || body.reason === 'step') {
      return true;
    }
    return this.owedNetHit && body.reason === 'breakpoint' && (body.hitBreakpointIds ?? []).length === 0;
  }

  private async abandonChain(why: string): Promise<void> {
    const chain = this.chain;
    if (!chain) {
      return;
    }
    chain.cancelled = why;
    chain.wake?.();
    // The run loop ends the chain; the nets must be gone before the caller goes on.
    await this.disarmAll();
    if (this.chain === chain) {
      this.chain = null;
    }
  }

  // ----- nets -----

  private async possible(start: CdpLocation): Promise<CdpBreakLocation[]> {
    const answer = await this.cdp?.send<{ locations?: CdpBreakLocation[] }>('Debugger.getPossibleBreakpoints', {
      start: { scriptId: start.scriptId, lineNumber: start.lineNumber, columnNumber: start.columnNumber ?? 0 },
      restrictToFunction: true
    });
    return answer?.locations ?? [];
  }

  /** The break positions of the frame's function. */
  private async locationsOf(frame: CdpCallFrame): Promise<CdpBreakLocation[]> {
    const here = frame.location;
    let start = frame.functionLocation;
    // Top-level code whose first token is a function declaration: V8 answers
    // the nested function's positions for the script's own position. The
    // script's code goes on after that function, so ask again from just after
    // its last position, until the answer holds the frame's position. Every
    // position of the frame's function, or none: a part of it is not a net.
    for (let tries = 0; start && tries < 16; tries++) {
      const all = await this.possible(start);
      if (all.length === 0) {
        return [];
      }
      if (sameOrAfter(here, all[0]) && sameOrAfter(all[all.length - 1], here)) {
        return all;
      }
      const last = all[all.length - 1];
      if (!sameOrAfter(here, last)) {
        return [];
      }
      start = { scriptId: last.scriptId, lineNumber: last.lineNumber, columnNumber: (last.columnNumber ?? 0) + 1 };
    }
    return [];
  }

  /** A net on every one of `all`, the break positions of the function it guards. */
  private async arm(all: CdpBreakLocation[], net: Omit<Net, 'ids'>): Promise<boolean> {
    if (this.nets.some((existing) => existing.fn === net.fn && existing.depth === net.depth)) {
      return true;
    }
    const cdp = this.cdp;
    if (!cdp) {
      return false;
    }
    const answers = await Promise.all(
      all.map((location) =>
        cdp
          .send<{ breakpointId?: string }>('Debugger.setBreakpoint', {
            location: { scriptId: location.scriptId, lineNumber: location.lineNumber, columnNumber: location.columnNumber ?? 0 }
          })
          .catch(() => undefined)
      )
    );
    const ids = new Set(answers.map((answer) => answer?.breakpointId).filter((id): id is string => typeof id === 'string'));
    if (ids.size < all.length) {
      // A net with a hole is no net: remove what was set.
      await Promise.all([...ids].map((breakpointId) => cdp.send('Debugger.removeBreakpoint', { breakpointId }).catch(() => undefined)));
      return false;
    }
    this.nets.push({ ...net, ids });
    return true;
  }

  private async disarm(net: Net): Promise<void> {
    this.nets = this.nets.filter((other) => other !== net);
    const cdp = this.cdp;
    if (!cdp) {
      return;
    }
    await Promise.all([...net.ids].map((breakpointId) => cdp.send('Debugger.removeBreakpoint', { breakpointId }).catch(() => undefined)));
  }

  private async disarmAll(): Promise<void> {
    for (const net of [...this.nets]) {
      await this.disarm(net);
    }
  }

  private async linesOf(scriptId: string): Promise<string[]> {
    let lines = this.sources.get(scriptId);
    if (!lines) {
      const answer = await this.cdp?.send<{ scriptSource?: string }>('Debugger.getScriptSource', { scriptId });
      // V8 ends a line at CR LF, LF, CR, U+2028 and U+2029.
      lines = (answer?.scriptSource ?? '').split(/\r\n|[\n\r\u2028\u2029]/);
      this.sources.set(scriptId, lines);
    }
    return lines;
  }

  /**
   * Whether the function's text names a construct that closes through a
   * finally, the only exits V8 loses a step on: `finally`, `for...of`,
   * `using`. Only spares breakpoints where they cannot matter: a word in a
   * comment nets a function that did not need it, and a text that cannot be
   * read (V8 refuses the positions of Node's own start-up scripts) is netted.
   */
  private async namesAFinally(frame: CdpCallFrame): Promise<boolean> {
    const key = fnKey(frame);
    const known = this.closing.get(key);
    if (known !== undefined) {
      return known;
    }
    let names = true;
    try {
      const all = await this.locationsOf(frame);
      if (all.length > 0) {
        const lines = await this.linesOf(frame.location.scriptId);
        const from = Math.min(frame.functionLocation?.lineNumber ?? all[0].lineNumber, all[0].lineNumber);
        names = lines.slice(from, all[all.length - 1].lineNumber + 1).some((line) => CLOSES_THROUGH_FINALLY.test(line));
      }
    } catch {
      // Not readable: net it.
    }
    this.closing.set(key, names);
    return names;
  }

  /** Whether a net guards something below a pause of this depth. */
  private guardedBelow(depth: number): boolean {
    return this.nets.some((net) => net.depth < depth);
  }

  /**
   * THE RULE (see the head of this file), applied before every command that
   * can leave the frame on top of `pause`: a net on the frame it returns to,
   * only where a hit there proves the step came back. Never throws: a net is
   * a safeguard, and without one V8's own step goes on alone.
   */
  private async guard(chain: Chain, pause: CdpPaused, skipped: boolean): Promise<void> {
    try {
      const frames = pause.callFrames;
      const top = frames[0];
      if (chain.unwinding || this.guardedBelow(frames.length) || (skipped && chain.walkHasNothingBelow)) {
        // Unwinding: a net fired in a deeper call and was dropped; V8's own
        // step-outs finish the step.
        return;
      }
      // Only where the text of the function being left names something V8 can
      // lose the step on: this spares breakpoints, and errs toward netting.
      if (!(await this.namesAFinally(top))) {
        return;
      }
      const target = await this.returnTarget(chain, pause);
      if (target.kind !== 'frame') {
        if (target.kind === 'nothing' && skipped && chain.kind === 'in') {
          // Nothing of the program comes to be below without the walk landing in it first.
          chain.walkHasNothingBelow = true;
        }
        return;
      }
      const frame = frames[target.index];
      if (chain.kind !== 'out' && fnKey(frame) === fnKey(top)) {
        // It returns to itself (recursion): a net would sit in the frame being stepped in.
        return;
      }
      // (a) V8's own word: the guarded frame and every frame above it are
      // plain functions, which come down only by returning.
      if (frame.canBeRestarted !== true) {
        return;
      }
      // (b) Every position of it, or none.
      const all = await this.locationsOf(frame);
      if (all.length === 0 || all.length > this.tunables.netSize) {
        return;
      }
      await this.arm(all, {
        name: frame.functionName || '(anonymous)',
        fn: fnKey(frame),
        depth: frames.length - target.index
      });
    } catch (err) {
      logger.warn(`[JsStepper] no net for this step, V8's own step goes on alone: ${errorText(err)}`);
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
   * code on top) and js-debug marks it program code. An awaiter is never
   * netted; it only says the stack is not gone, and V8's own step leads to it.
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
