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
 *   a `return` inside try...finally (issue #1161), and when js-debug resumes
 *   a pause of its own, a module-entry breakpoint, while the step is in
 *   flight (issue #1162). So a step never counts on V8 alone to come BACK to
 *   a frame. A net is a capped set of temporary CDP breakpoints on the break
 *   positions of a program frame the step returns to, kept with the stack
 *   depth of the activation it guards. Any position there is where V8's own
 *   step-out would stop, so a hit at that depth is a landing.
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
 *   steps out; `step_over` and `step_out` step out at once. With no program
 *   frame below, the stack the step started on is gone: the program is
 *   resumed and nothing is reported (stepping out of the bottom frame would
 *   land in the next task's internals instead).
 *
 *   A pause that is not the stepper's (another breakpoint, an exception, a
 *   `debugger;`) is js-debug's to decide. Resumed by js-debug, the chain
 *   waits on. Kept, the chain ends and that stop is forwarded as itself.
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
  /** Break positions in one net. A breakpoint in a big function is slow to set (1000 took 2.4 s). */
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
  netSize: 24,
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
  asyncStackTrace?: { callFrames?: CdpAsyncFrame[] };
}

interface Net {
  /** What it guards, for the log. */
  name: string;
  /** Function identity, or the async parent's position. */
  fn: string;
  /** The stack depth of the guarded activation; Infinity for an async parent, which resumes at any depth. */
  depth: number;
  ids: Set<string>;
}

type Inbox =
  | { type: 'paused'; pause: CdpPaused }
  | { type: 'resumed'; ours: boolean };

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
  /** A step-in spent its budget in skipped code and stepped out: the line called nothing of the program's. */
  steppedOutOfSkipped: boolean;
  /** Every command the chain may send is spent and skipped code is still on top. */
  capped: boolean;
  /** The stack holds no frame of the program below the skipped code on top (looked at once). */
  nothingBelow: boolean;
  startedAt: number;
}

type Verdict =
  | { kind: 'wait' }
  | { kind: 'command'; command: string }
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
  /** Whether the stepper sent a resuming command since the last pause: tells its resumes from js-debug's. */
  private sentSincePause = false;
  private chain: Chain | null = null;
  private nets: Net[] = [];
  /** `stopped` events of a finished chain still on their way; dropped when they arrive, until the deadline. */
  private owed = 0;
  private owedUntil = 0;
  /** Scripts js-debug marked "Skipped by skipFiles": a script-level verdict, not asked again. */
  private readonly skippedScripts = new Set<string>();
  private readonly finallyByFunction = new Map<string, boolean>();
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
      steppedOutOfSkipped: false,
      capped: false,
      nothingBelow: false,
      startedAt: Date.now()
    };
    this.chain = chain;
    this.owed = 0;

    try {
      // A net before the first command only where V8 can lose the step by
      // LEAVING the origin frame (issue #1161): a step-out always, a step-over
      // or step-in when the function's text has `finally`. Not when it returns
      // to itself: that net would sit in the frame being stepped in.
      if (kind === 'out' || await this.hasFinally(top)) {
        await this.armReturnTarget(origin, kind === 'out' ? null : chain.originFn);
      }
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
        if (Date.now() <= this.owedUntil) {
          this.owed--;
          return true;
        }
        this.owed = 0;
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
      this.sentSincePause = false;
      const chain = this.chain;
      if (chain) {
        chain.inbox.push({ type: 'paused', pause });
        chain.wake?.();
      }
    } else if (method === 'Debugger.resumed') {
      const ours = this.sentSincePause;
      this.current = null;
      const chain = this.chain;
      if (chain) {
        chain.inbox.push({ type: 'resumed', ours });
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
          await this.sendStep(chain, verdict.command);
          continue;
        }
        await this.finish(chain, verdict.kind, verdict.kind === 'landing' ? verdict.by : undefined);
        return;
      }
    } catch (err) {
      logger.warn(`[JsStepper] chain failed: ${errorText(err)}`);
      await this.finish(chain, 'error');
    }
  }

  private async sendStep(chain: Chain, command: string): Promise<void> {
    const cdp = this.cdp;
    if (!cdp) {
      throw new Error('the CDP connection closed');
    }
    chain.commands.push(command);
    this.sentSincePause = true;
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
    const ours = !foreignHit && (STEP_REASONS.has(pause.reason) || (pause.reason === 'other' && hitNets.length > 0));

    if (!ours) {
      // Another breakpoint, an exception, a `debugger;`: js-debug decides.
      const decision = await this.jsDebugDecides(chain);
      if (decision === 'resumed') {
        return { kind: 'wait' };
      }
      if (decision === 'cancelled') {
        return { kind: 'wait' };
      }
      chain.kept++;
      return { kind: 'real-stop' };
    }
    chain.kept++;

    const top = pause.callFrames[0];
    const depth = pause.callFrames.length;
    const skipped = await this.isSkipped(chain, pause);

    if (skipped) {
      // Before anything else, a net on the program frame this code returns to.
      let guarded = this.nets.some((net) => net.depth < depth || net.depth === Infinity);
      if (!guarded && !chain.nothingBelow) {
        guarded = await this.armReturnTarget(pause, null);
        // Nothing of the program can come to be below without the chain
        // landing in it first: one look per chain.
        chain.nothingBelow = !guarded;
      }
      // A step-in walks on while it has budget, with or without anything
      // below: a step issued inside a dependency reaches the program's
      // handler by calls, not returns (issue #687).
      if (chain.kind === 'in' && !chain.unwinding && chain.spent < this.tunables.budget) {
        chain.spent++;
        return { kind: 'command', command: CDP_COMMAND.in };
      }
      // It has to step out now. With nothing of the program below, the stack
      // the step started on is gone.
      if (!guarded) {
        return { kind: 'left-stack' };
      }
      if (chain.kind === 'in') {
        chain.steppedOutOfSkipped = true;
      }
      return { kind: 'command', command: CDP_COMMAND.out };
    }

    // Program code on top.
    if (chain.unwinding) {
      return depth > chain.originDepth
        ? { kind: 'command', command: CDP_COMMAND.out }
        : { kind: 'landing', by: 'V8 step-outs after a net was dropped (recursion)' };
    }
    const backOnOriginStatement = depth === chain.originDepth && fnKey(top) === chain.originFn && top.location.lineNumber === chain.originLine;
    if (hits.length === 0) {
      // V8's step landed. A step-in that is back on the line it left steps in
      // again: that enters the line's next call, or moves on.
      if (chain.kind === 'in' && backOnOriginStatement && chain.reissues < this.tunables.reissueCap) {
        chain.reissues++;
        return { kind: 'command', command: CDP_COMMAND.in };
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
        return { kind: 'command', command: CDP_COMMAND.out };
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
      return { kind: 'command', command: CDP_COMMAND.out };
    }
    // Control is back in a frame a net guards: where V8's own step-out would stop.
    if (chain.kind === 'in' && backOnOriginStatement && chain.reissues < this.tunables.reissueCap) {
      chain.reissues++;
      return { kind: 'command', command: CDP_COMMAND.in };
    }
    return { kind: 'landing', by: pause.reason === 'ambiguous' ? 'net, with a V8 step in flight' : 'net, V8 had lost the step' };
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
        chain.inbox.shift();
        if (!next.ours) {
          return 'resumed';
        }
        continue;
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
    const deadline = Date.now() + this.tunables.verdictCeilingMs;
    for (;;) {
      let failure: string;
      try {
        const answer = await this.target.sendRequest<DebugProtocol.StackTraceResponse>(
          'stackTrace',
          { threadId: chain.threadId ?? 0, startFrame: 0, levels: 1 },
          5000
        );
        const frame = answer?.body?.stackFrames?.[0];
        if (answer?.success !== false && frame) {
          const skipped = markOf(frame) === 'deemphasize';
          if (skipped && /skipFiles/i.test(frame.source?.origin ?? '')) {
            this.skippedScripts.add(scriptId);
          }
          return skipped;
        }
        failure = answer?.message ?? 'no frame';
      } catch (err) {
        failure = errorText(err);
      }
      // js-debug answers "not paused" until it has taken the pause in.
      if (chain.cancelled || Date.now() >= deadline) {
        logger.warn(`[JsStepper] no verdict for a landing (${failure}); treating it as program code`);
        return false;
      }
      await this.sleep(1);
    }
  }

  private async finish(chain: Chain, ender: 'landing' | 'real-stop' | 'left-stack' | 'cancelled' | 'error', by?: string): Promise<void> {
    await this.disarmAll();
    if (ender === 'left-stack') {
      // Nothing of the program is below: resume, and report nothing.
      try {
        chain.commands.push('Debugger.resume');
        this.sentSincePause = true;
        await this.cdp?.send('Debugger.resume', {});
      } catch (err) {
        logger.warn(`[JsStepper] resume after leaving the stack failed: ${errorText(err)}`);
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
          ...(chain.capped
            ? { text: ErrorMessages.stepStillInSkippedCode(chain.commands.length) }
            : chain.steppedOutOfSkipped ? { text: ErrorMessages.stepIntoFoundOnlySkippedCode() } : {})
        }
      });
    } else if (ender === 'real-stop' && chain.lastStopped) {
      this.deliver(chain.lastStopped);
    }
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
    let all = frame.functionLocation ? await this.possible(frame.functionLocation) : [];
    // Top-level code whose first token is a function declaration: the function
    // at that position is the nested one. Ask from the frame's own line.
    const spans = all.length > 0 && sameOrAfter(here, all[0]) && sameOrAfter(all[all.length - 1], here);
    if (!spans) {
      all = await this.possible({ scriptId: here.scriptId, lineNumber: here.lineNumber, columnNumber: 0 });
    }
    return all;
  }

  /** At most `netSize` positions, from the frame's own position on. */
  private window(all: CdpBreakLocation[], here: CdpLocation): CdpBreakLocation[] {
    const size = this.tunables.netSize;
    if (all.length <= size) {
      return all;
    }
    const at = all.findIndex((location) => sameOrAfter(location, here));
    const from = at === -1 ? 0 : at;
    const part = all.slice(from, from + size);
    return part.length === size ? part : [...part, ...all.slice(0, size - part.length)];
  }

  private async arm(all: CdpBreakLocation[], here: CdpLocation, net: Omit<Net, 'ids'>): Promise<boolean> {
    if (this.nets.some((existing) => existing.fn === net.fn && existing.depth === net.depth)) {
      return true;
    }
    const cdp = this.cdp;
    if (!cdp) {
      return false;
    }
    const answers = await Promise.all(
      this.window(all, here).map((location) =>
        cdp
          .send<{ breakpointId?: string }>('Debugger.setBreakpoint', {
            location: { scriptId: location.scriptId, lineNumber: location.lineNumber, columnNumber: location.columnNumber ?? 0 }
          })
          .catch(() => undefined)
      )
    );
    const ids = new Set(answers.map((answer) => answer?.breakpointId).filter((id): id is string => typeof id === 'string'));
    if (ids.size === 0) {
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

  /** Whether the function's text has `finally`: the one shape V8 loses a leaving step on (issue #1161). */
  private async hasFinally(frame: CdpCallFrame): Promise<boolean> {
    const key = fnKey(frame);
    const known = this.finallyByFunction.get(key);
    if (known !== undefined) {
      return known;
    }
    let found = false;
    try {
      const scriptId = frame.location.scriptId;
      let lines = this.sources.get(scriptId);
      if (!lines) {
        const answer = await this.cdp?.send<{ scriptSource?: string }>('Debugger.getScriptSource', { scriptId });
        lines = (answer?.scriptSource ?? '').split('\n');
        this.sources.set(scriptId, lines);
      }
      const all = await this.locationsOf(frame);
      if (all.length > 0) {
        const from = Math.min(frame.functionLocation?.lineNumber ?? all[0].lineNumber, all[0].lineNumber);
        found = /\bfinally\b/.test(lines.slice(from, all[all.length - 1].lineNumber + 1).join('\n'));
      }
    } catch (err) {
      logger.warn(`[JsStepper] could not read the function's text: ${errorText(err)}`);
    }
    this.finallyByFunction.set(key, found);
    return found;
  }

  /**
   * Arm a net on what the top frame of `pause` returns to: the nearest
   * program frame below, by js-debug's marks, or the async parent when the
   * stack has none. False when nothing of the program is below.
   */
  private async armReturnTarget(pause: CdpPaused, notFn: string | null): Promise<boolean> {
    const frames = pause.callFrames;
    let marks: DebugProtocol.StackFrame[] = [];
    try {
      const answer = await this.target.sendRequest<DebugProtocol.StackTraceResponse>(
        'stackTrace',
        { threadId: this.chain?.threadId ?? 0, startFrame: 0, levels: 80 },
        5000
      );
      marks = answer?.body?.stackFrames ?? [];
    } catch (err) {
      logger.warn(`[JsStepper] could not read the stack's marks: ${errorText(err)}`);
      return false;
    }
    // js-debug lists the sync frames, then a label frame per async segment.
    const firstLabel = marks.findIndex((frame) => markOf(frame) === 'label');
    const sync = firstLabel === -1 ? marks : marks.slice(0, firstLabel);
    for (let i = 1; i < Math.min(sync.length, frames.length); i++) {
      if (markOf(sync[i]) === 'deemphasize') {
        continue;
      }
      if (notFn && fnKey(frames[i]) === notFn) {
        // It returns to itself (recursion): a net would sit in the frame being stepped in.
        return true;
      }
      return this.arm(await this.locationsOf(frames[i]), frames[i].location, {
        name: frames[i].functionName || '(anonymous)',
        fn: fnKey(frames[i]),
        depth: frames.length - i
      });
    }
    // No program frame below on this stack: an async function the event loop
    // resumed returns to its awaiter, which is not on the stack.
    const parent = pause.asyncStackTrace?.callFrames?.[0];
    const firstAsync = firstLabel === -1 ? undefined : marks[firstLabel + 1];
    if (parent && firstAsync && markOf(firstAsync) !== 'deemphasize' && markOf(firstAsync) !== 'label') {
      const start: CdpLocation = { scriptId: parent.scriptId, lineNumber: parent.lineNumber, columnNumber: parent.columnNumber };
      const all = await this.possible(start);
      if (all.length > 0) {
        return this.arm(all, start, {
          name: `${parent.functionName || '(anonymous)'} (async parent)`,
          fn: `async:${parent.scriptId}:${parent.lineNumber}:${parent.columnNumber}`,
          depth: Infinity
        });
      }
    }
    return false;
  }
}
