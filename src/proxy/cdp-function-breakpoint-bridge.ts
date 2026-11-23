/**
 * JS function breakpoints delivered over js-debug's CDP proxy (issue #295).
 *
 * js-debug implements no DAP setFunctionBreakpoints (upstream out of scope,
 * vscode-js-debug#952), but its per-target child session exposes a raw-CDP
 * WebSocket via the custom requestCDPProxy request. This bridge owns the whole
 * feature on our side of that socket:
 *
 *   name --(side-effect-free evaluate)--> live Function objectId
 *        --(Debugger.setBreakpointOnFunctionCall)--> CDP breakpoint
 *   CDP Debugger.paused.hitBreakpoints  <-->  armed ids   (stop correlation)
 *   child DAP 'stopped'  --> rewritten to reason 'function breakpoint'
 *
 * Semantics are Chrome's debug(fn) plus a durability layer: the name is a
 * dotted runtime path bound to the value it resolves to now (NOT a source
 * symbol search); unresolved names stay pending and re-resolve at every pause.
 */
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { JS_LOGPOINT_BINDING, JS_LOGPOINT_CLEAR, JS_LOGPOINT_FLUSH, JS_LOGPOINT_UNBIND } from '@debugmcp/shared';
import { CdpCallTimeoutError, CdpProxyClient } from './cdp-proxy-client.js';
import { createLogger } from '../utils/logger.js';

// redirectable: re-pointed into the per-session proxy log at worker init (#519)
const logger = createLogger('cdp-fnbp-bridge', { redirectable: true });

/** Dotted runtime path: identifier(.identifier)*, $ and _ allowed. */
const NAME_RE = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;

/**
 * Adapter ids minted here start far above js-debug's own small monotonic
 * breakpoint ids: the SessionManager matches function breakpoints by
 * adapterId alone, so an overlap would let a function breakpoint steal a
 * line breakpoint's event.
 */
const ADAPTER_ID_BASE = 1_000_000;

/** The slice of MinimalDapClient the bridge needs from the child session. */
/**
 * The round trip `settle()` waits for. js-debug's CDP proxy answers the
 * methods of its own `JsDebug` domain itself and answers one it does not have
 * with an error at once; nothing is forwarded to the target.
 */
const CDP_BARRIER_METHOD = 'JsDebug.mcpDebuggerBarrier';

export interface ChildDapRequestor {
  sendRequest(command: string, args?: unknown, timeoutMs?: number): Promise<unknown>;
}

export interface CdpFunctionBreakpointBridgeOptions {
  clientFactory?: () => CdpProxyClient;
  stopEventHoldMs?: number;
}

/** A V8 source position: [[FunctionLocation]] of a function, or a frame's functionLocation. */
interface CdpLocation {
  scriptId: string;
  lineNumber: number;
  columnNumber: number;
}

interface FnBpEntry {
  name: string;
  condition?: string;
  key: string;
  adapterId: number;
  valid: boolean;
  cdpBreakpointId?: string;
  verified: boolean;
  message?: string;
  boundLine?: number;
  boundFile?: string;
  /** [[FunctionLocation]] of the armed function — identifies it by position, not name (issue #858) */
  boundLocation?: CdpLocation;
}

interface PauseRecord {
  hitBreakpoints: string[];
  topCallFrameId?: string;
  topScriptId?: string;
  /** '' for a module's top-level frame (CJS wrapper and ESM alike) */
  topFunctionName?: string;
  topFunctionLocation?: CdpLocation;
  /** consumed by a stop rewrite; resolution may still use the call frame */
  consumed: boolean;
}

function sameLocation(a: CdpLocation | undefined, b: CdpLocation | undefined): boolean {
  return a !== undefined && b !== undefined &&
    a.scriptId === b.scriptId && a.lineNumber === b.lineNumber && a.columnNumber === b.columnNumber;
}

/**
 * Why a js-debug "entry" stop can land inside a function (issue #858):
 * js-debug sets its stopOnEntry breakpoint at line 1 column 1 of the program
 * and V8 resolves that to the nearest breakable position in SOURCE order,
 * which for a file whose first declaration is a function is that function's
 * body — so the stop fires at its first call, after everything before it ran,
 * and again at every later call. Reported, not hidden: the top frame is the
 * only evidence the caller has.
 */
function lateEntryNote(functionName: string): string {
  return `entry stop landed inside ${functionName}() at its first call, not at the program's first statement — ` +
    'js-debug sets its entry breakpoint at line 1, column 1 and V8 resolves it to the first breakable position in ' +
    'source order, which is inside the first function declared above the first statement; the top-level code before ' +
    `that call has already run, and every later call of ${functionName}() stops as "entry" again. ` +
    'To stop at the first statement, move the first statement above the function declaration, or set a line ' +
    'breakpoint on it instead of stopOnEntry (vscode-js-debug#2430).';
}

interface CdpRemoteObject {
  type?: string;
  objectId?: string;
  value?: unknown;
}

interface CdpEvaluateResult {
  result?: CdpRemoteObject;
  exceptionDetails?: { text?: string };
}

const PENDING_NO_TARGET = 'Function breakpoint pending (no debug target yet)';
const PENDING_NO_PROXY = 'CDP proxy unavailable — function breakpoints cannot bind in this session';

function entryKey(name: string, condition?: string): string {
  return `${name}\0${condition ?? ''}`;
}

function isSideEffectVeto(evaluation: CdpEvaluateResult): boolean {
  if (!evaluation.exceptionDetails) {
    return false;
  }
  const text = `${evaluation.exceptionDetails.text ?? ''} ${
    (evaluation.exceptionDetails as { exception?: { description?: string } }).exception?.description ?? ''
  }`;
  return /side.?effect/i.test(text);
}

function fileUrlToPath(url: string): string {
  if (url.startsWith('file://')) {
    try {
      return fileURLToPath(url);
    } catch {
      return url;
    }
  }
  return url;
}

/**
 * Cap for the scriptId → url map (issue #405): long-lived JS debuggees with
 * dynamic module churn (dev servers, jest watch) parse scripts indefinitely.
 * FIFO eviction — a stale entry only costs a fallback url lookup later.
 */
export const MAX_SCRIPT_URLS = 10_000;

export class CdpFunctionBreakpointBridge extends EventEmitter {
  private readonly clientFactory: () => CdpProxyClient;
  private readonly stopEventHoldMs: number;

  private desired: FnBpEntry[] = [];
  private client: CdpProxyClient | null = null;
  private clientListeners: Array<() => void> = [];
  private attachFailed = false;
  private nextAdapterId = ADAPTER_ID_BASE;
  private nextObjectGroupId = 0;
  private pauseRecord: PauseRecord | null = null;
  private readonly scriptUrls = new Map<string, string>();
  private pauseWaiters: Array<(record: PauseRecord) => void> = [];
  private resolveChain: Promise<void> = Promise.resolve();
  private attachInFlight: Promise<void> | null = null;
  private bindingInstalled = false;
  /** Counts detach() calls: an attach that finds it changed was abandoned and keeps no socket. */
  private detachCount = 0;
  /** Why this target's logpoint channel is down, while it is. */
  private undeliveredBecause: string | null = null;
  /** The owner has sent this target a logpoint (`noteLogpoints`). */
  private logpointsSent = false;
  /** The session was told once that this target's logpoints are not delivered. */
  private undeliveredTold = false;

  constructor(options?: CdpFunctionBreakpointBridgeOptions) {
    super();
    this.clientFactory = options?.clientFactory ?? ((): CdpProxyClient => new CdpProxyClient());
    this.stopEventHoldMs = options?.stopEventHoldMs ?? 300;
  }

  /**
   * Replace-all sync (DAP setFunctionBreakpoints semantics). Surviving
   * (name, condition) keys keep their armed CDP breakpoint but every entry
   * gets a fresh adapterId this generation, mirroring the Java bridge.
   * Safe before any child exists: entries queue as pending.
   */
  async sync(bps: DebugProtocol.FunctionBreakpoint[]): Promise<{ breakpoints: DebugProtocol.Breakpoint[] }> {
    logger.info(`[CdpFnBpBridge] sync: [${bps.map((b) => b.name).join(', ')}] (connected=${this.client?.isConnected() === true}, nextAdapterId=${this.nextAdapterId})`);
    const previousByKey = new Map(this.desired.map((e) => [e.key, e]));

    const next: FnBpEntry[] = bps.map((bp) => {
      const valid = NAME_RE.test(bp.name);
      const entry: FnBpEntry = {
        name: bp.name,
        condition: bp.condition,
        key: entryKey(bp.name, bp.condition),
        adapterId: this.nextAdapterId++,
        valid,
        verified: false,
        message: valid
          ? (this.attachFailed ? PENDING_NO_PROXY : PENDING_NO_TARGET)
          : `invalid function name '${bp.name}' (expected an identifier or dotted path like MyClass.prototype.handle)`
      };
      const previous = previousByKey.get(entry.key);
      if (valid && previous?.cdpBreakpointId) {
        entry.cdpBreakpointId = previous.cdpBreakpointId;
        entry.verified = previous.verified;
        entry.message = previous.message;
        entry.boundLine = previous.boundLine;
        entry.boundFile = previous.boundFile;
        previousByKey.delete(entry.key);
      }
      return entry;
    });

    // Remove CDP breakpoints whose key is gone (or whose key was claimed by
    // at most one survivor — duplicates each armed separately).
    const survivingKeys = new Set(next.filter((e) => e.cdpBreakpointId).map((e) => e.key));
    for (const old of this.desired) {
      if (old.cdpBreakpointId && (!survivingKeys.has(old.key) || previousByKey.has(old.key))) {
        await this.removeCdpBreakpoint(old.cdpBreakpointId);
      }
    }

    this.desired = next;

    if (this.client?.isConnected()) {
      await this.kickResolution(false);
    }

    return { breakpoints: this.desired.map((e) => this.toDapBreakpoint(e)) };
  }

  /**
   * Obtain the CDP proxy from the freshly adopted child session and wire up.
   * Failures are non-fatal by design: the session still debugs normally and
   * function breakpoints stay pending with an explanatory message.
   */
  async attachToChild(child: ChildDapRequestor): Promise<void> {
    const attach = this.doAttachToChild(child);
    // Held stopped events await this so an entry stop arriving mid-attach
    // still gets the sticky Debugger.paused replay and binding (issue #295);
    // doAttachToChild never rejects, so no pre-catch is needed.
    this.attachInFlight = attach;
    try {
      await attach;
    } finally {
      this.attachInFlight = null;
    }
  }

  private async doAttachToChild(child: ChildDapRequestor): Promise<void> {
    let client: CdpProxyClient | null = null;
    let boundInThisAttach = false;
    const detachCount = this.detachCount;
    const abandoned = (): boolean => detachCount !== this.detachCount;
    try {
      const response = (await child.sendRequest('requestCDPProxy', {}, 5000)) as {
        body?: { host: string; port: number; path: string };
      };
      const info = response?.body ?? (response as unknown as { host: string; port: number; path: string });
      if (!info?.host || !info?.port || !info?.path) {
        throw new Error(`requestCDPProxy returned no address: ${JSON.stringify(info)}`);
      }

      if (abandoned()) {
        return;
      }
      client = this.clientFactory();
      this.wireClient(client);
      await client.connect(info.host, info.port, info.path);
      if (abandoned()) {
        // detach() ran while the socket was opening (a forked process that
        // ended at once, issue #1212): it found no client to close.
        throw new Error('detached while attaching');
      }
      // Assign BEFORE subscribe/enable: the proxy replays its sticky latest
      // Debugger.paused while processing the enable request itself, and the
      // resolution kick from that replay needs a usable client.
      this.client = client;
      // The binding goes out with the subscription, before either is
      // answered (issue #1212): the adapter lets a forked process run about
      // 20 ms after its configurationDone, and a binding that is on the wire
      // before that covers the process's first statement.
      const subscribed = client.send('JsDebug.subscribe', {
        events: ['Debugger.paused', 'Debugger.resumed', 'Debugger.scriptParsed', 'Runtime.bindingCalled']
      });
      const bound = client.send('Runtime.addBinding', { name: JS_LOGPOINT_BINDING }).then(
        () => null,
        (err: unknown) => (err instanceof Error ? err.message : String(err))
      );
      await subscribed;
      // Logpoint delivery (issue #850): the compiled logpoint condition the
      // JS policy sends calls this global with the rendered message, so the
      // message reaches us over CDP whatever the program did to console.
      // Without an executionContextId the binding covers every context of
      // the target, those created later included. A failure is not fatal
      // to the attach; the logpoints of this target are then not delivered
      // (they are kept in the process, never printed; issue #1212) and the
      // session is told so.
      const bindingRefused = await bound;
      if (bindingRefused === null) {
        boundInThisAttach = true;
        this.bindingInstalled = true;
        this.undeliveredBecause = null;
        this.undeliveredTold = false;
        await this.flushHeldLogpoints(client);
      } else {
        logger.warn(`[CdpFnBpBridge] Runtime.addBinding(${JS_LOGPOINT_BINDING}) failed; logpoints of this target are not delivered: ${bindingRefused}`);
        this.logpointChannelDown(bindingRefused);
      }
      // Re-enabling the (already enabled) Debugger domain makes the proxy
      // replay its sticky latest Debugger.paused — covers the entry pause
      // that predates this connection.
      await client.send('Debugger.enable', {});

      this.attachFailed = false;
      logger.info(`[CdpFnBpBridge] attached to CDP proxy at ${info.host}:${info.port}`);

      // Entries synced before this attach completed have had no chance to
      // resolve — and an attach-mode target that never pauses would leave
      // them pending forever. Kick the global path now; module-scoped names
      // simply stay pending until a pause as documented.
      if (this.desired.some((e) => e.valid && !e.cdpBreakpointId)) {
        await this.kickResolution(true);
      }
    } catch (err) {
      this.attachFailed = true;
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[CdpFnBpBridge] CDP proxy unavailable, function breakpoints stay pending: ${message}`);
      if (abandoned()) {
        // detach() already cleared the state; only this attach's own socket is left.
        client?.dispose();
        return;
      }
      // A binding that went in before the failure stays in the process
      // when this socket closes: its function is a property of the
      // process's global object, and every later hit would call it, keep
      // nothing, and reach nobody. So the function is taken out again,
      // bounded, before the socket goes (`Runtime.removeBinding` alone
      // leaves it in: see JS_LOGPOINT_UNBIND): hits are then kept in the
      // process as they are for any target without a channel, and the
      // session is told.
      //
      // One case says nothing: the process has ended. Its end is what
      // failed the attach (measured: a fork that logs twice and exits at
      // once fails `Debugger.enable` with "Connection is closed" after
      // both lines were delivered), nothing more will hit there, and a
      // warning would be about lines that arrived. The adapter answers a
      // command for such a target with an error at once, or the socket
      // is closed. Every other outcome is a process that is still there,
      // whose logpoints are not delivered from now on, and it is told:
      // an answer, whatever it says (a global that cannot be changed
      // keeps the function), and no answer in time (a main thread
      // blocked in a native call: the evaluation runs when it returns).
      // `boundInThisAttach`, not `this.bindingInstalled`: when the socket
      // itself closed, `onClosed` already ran `clearClientState()` and reset
      // `this.bindingInstalled` before this `catch` resumed.
      if (!boundInThisAttach) {
        this.logpointChannelDown(message);
      } else if (client?.isConnected()) {
        const ended = await client
          .send('Runtime.evaluate', { expression: JS_LOGPOINT_UNBIND, returnByValue: true }, 1000)
          .then(() => false, (failure: unknown) => !(failure instanceof CdpCallTimeoutError));
        if (abandoned()) {
          client.dispose();
          return;
        }
        void client.send('Runtime.removeBinding', { name: JS_LOGPOINT_BINDING }, 1000).catch(() => undefined);
        if (!ended) {
          this.logpointChannelDown(message);
        }
      }
      // Roll back any partial connection
      if (this.client === client || this.client === null) {
        this.clearClientState();
      }
      client?.dispose();
      for (const entry of this.desired) {
        if (entry.valid && !entry.cdpBreakpointId) {
          entry.message = PENDING_NO_PROXY;
        }
      }
    }
  }

  /**
   * The owner sent this target a logpoint (issue #1212). The bridge does
   * not see breakpoints, and a target without a logpoint has nothing to be
   * told about its channel: a fork that ends before its socket is open is
   * the common case of a channel that never came up. Once said, it stays
   * said: the bridge is not told when the last logpoint is removed, and a
   * warning too many is the cheaper error.
   */
  noteLogpoints(): void {
    this.logpointsSent = true;
    this.tellIfLogpointsUndelivered();
  }

  private logpointChannelDown(reason: string): void {
    this.undeliveredBecause = reason;
    this.tellIfLogpointsUndelivered();
  }

  /**
   * One line on the session, once: the logpoints of this target are not
   * delivered (issue #1212). They used to fall back to the program's own
   * `console.log`; they are now kept out of the program's output, so the
   * session has to be told where they went. Said when both are true, in
   * whichever order they become so: the channel is down, and the target
   * was sent a logpoint. Worded and shaped like every other notice in a
   * session's output.
   */
  private tellIfLogpointsUndelivered(): void {
    const reason = this.undeliveredBecause;
    if (reason === null || !this.logpointsSent || this.undeliveredTold) {
      return;
    }
    this.undeliveredTold = true;
    this.emit('outputEvent', {
      seq: 0,
      type: 'event',
      event: 'output',
      body: {
        category: 'console',
        output: `[mcp-debugger] Warning: logpoints that hit in this process are not delivered: the debugger's channel into it is not available (${reason}). Their messages are kept out of the program's own output.\n`
      }
    } as DebugProtocol.OutputEvent);
  }

  /**
   * Take out of a process that will live on what the proxy put into it: the
   * binding's function and anything its logpoints kept (issue #1212). Awaited
   * by whoever is about to send the adapter the `disconnect` that releases
   * the target, because that disconnect takes this socket with it: measured,
   * a `detach()` that runs afterwards finds it closed and the function stays
   * in the process. One bounded round trip; never rejects. The bound is
   * short on purpose: the caller's disconnect has a deadline of its own,
   * and a process that answers at all answers in milliseconds.
   *
   * Not airtight: the logpoints are the adapter's breakpoints, and they stay
   * set until the adapter has detached. One that hits in the milliseconds
   * between this and that finds no function, is kept (within the queue's
   * bounds), and nobody reads it.
   */
  async release(timeoutMs = 250): Promise<void> {
    const client = this.client;
    if (!client?.isConnected()) {
      return;
    }
    await client
      .send('Runtime.evaluate', { expression: JS_LOGPOINT_CLEAR, returnByValue: true }, timeoutMs)
      .catch(() => undefined);
  }

  /** The CDP socket is open: what rides on it is live. */
  isAttached(): boolean {
    return this.client?.isConnected() === true;
  }

  /**
   * Resolves once everything the target sent on the CDP socket before this
   * call has been handled (issue #1212). A process's last logpoint messages
   * and the adapter's `terminated` for it travel on two sockets, and the
   * `terminated` was measured to arrive about 1 ms first: whoever forwards
   * the end of a target waits for this, or the last lines arrive at a
   * session that has already ended.
   *
   * The barrier is one round trip on the CDP socket, answered by the
   * adapter's proxy itself (an unknown method of its own domain: the target
   * is not asked anything). Messages on one socket keep their order, so its
   * answer, an error included, follows every event the proxy had relayed
   * when it took the request. That the proxy has relayed all of a target's
   * events by the time the adapter reports the target's end is not
   * something its protocol promises: it is what was measured (through the
   * server, a process that hits two logpoints and exits at once delivered
   * both in 12 of 12 runs behind this barrier, and in 0 of 12 without).
   *
   * Bounded by one deadline, `timeoutMs` from the call: an attach still in
   * flight and the round trip share it. Never rejects.
   */
  async settle(timeoutMs = 500): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const attaching = this.attachInFlight;
    if (attaching) {
      let timer: NodeJS.Timeout | undefined;
      await Promise.race([
        attaching.catch(() => undefined),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, timeoutMs);
        })
      ]);
      clearTimeout(timer);
    }
    const client = this.client;
    const left = deadline - Date.now();
    if (!client?.isConnected() || left <= 0) {
      return;
    }
    try {
      await client.send(CDP_BARRIER_METHOD, {}, left);
    } catch {
      // An error is the expected answer, and a closed socket has nothing more to deliver.
    }
  }

  /**
   * Deliver the logpoint messages the target kept while it had no binding
   * (issue #1212): a forked process can hit a logpoint in the milliseconds
   * before this socket is up. The compiled logpoint queues them in the
   * process; this drains the queue through the binding, in order. Best
   * effort: a later hit drains it too, and a target that cannot evaluate
   * right now loses nothing by it.
   */
  private async flushHeldLogpoints(client: CdpProxyClient): Promise<void> {
    try {
      const answer = (await client.send('Runtime.evaluate', { expression: JS_LOGPOINT_FLUSH, returnByValue: true }, 2000)) as
        | { result?: { value?: unknown } }
        | undefined;
      const dropped = answer?.result?.value;
      if (typeof dropped === 'number' && dropped > 0) {
        this.emit('outputEvent', {
          seq: 0,
          type: 'event',
          event: 'output',
          body: {
            category: 'console',
            output: `[mcp-debugger] ${dropped} logpoint message(s) of this process were not kept: it hit more logpoints than fit before the debugger's channel was up.\n`
          }
        } as DebugProtocol.OutputEvent);
      }
    } catch (err) {
      logger.debug(`[CdpFnBpBridge] flushing held logpoint messages failed (a later hit delivers them): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Drop the CDP connection but keep the desired set (re-attach re-arms). */
  detach(): void {
    this.detachCount++;
    const client = this.client;
    if (client?.isConnected()) {
      // Best effort: a target that outlives the session (attach) should not
      // keep a dangling global, nor what its logpoints kept while the
      // binding was absent (issue #1212). The evaluation is what removes
      // the binding's function; `Runtime.removeBinding` only ends the
      // notifications (measured, see JS_LOGPOINT_UNBIND). The sends are
      // not awaited, and the socket closes right after: a command sent
      // before a close was measured to land.
      void client.send('Runtime.evaluate', { expression: JS_LOGPOINT_CLEAR, returnByValue: true }).catch(() => undefined);
      if (this.bindingInstalled) {
        void client.send('Runtime.removeBinding', { name: JS_LOGPOINT_BINDING }).catch(() => undefined);
      }
    }
    this.clearClientState();
    client?.dispose();
  }

  hasArmedOrPending(): boolean {
    return this.desired.some((e) => e.valid);
  }

  /** Await any in-flight resolution batch (also used by tests). */
  waitForResolution(): Promise<void> {
    return this.resolveChain;
  }

  /**
   * Transform a child 'stopped' event: when the current CDP pause hit one of
   * our breakpoints, relabel the stop as a function breakpoint and surface our
   * adapter ids. js-debug reports these stops as plain 'breakpoint' (or even
   * 'entry' when its stopOnEntry breakpoint shares the function's location)
   * with empty hitBreakpointIds, which the SessionManager could otherwise
   * auto-continue.
   */
  async processStoppedEvent(evt: DebugProtocol.Event): Promise<DebugProtocol.Event> {
    if (evt.event !== 'stopped') {
      return evt;
    }
    // An entry stop can arrive while attachToChild is still connecting the
    // proxy; wait for it so the sticky Debugger.paused replay can deliver the
    // record below. Then let any binding batch finish before the
    // SessionManager can see the stop (and potentially auto-continue past it).
    if (this.attachInFlight) {
      await this.attachInFlight.catch(() => undefined);
    }
    await this.waitForResolution().catch(() => undefined);

    const body = (evt.body ?? {}) as DebugProtocol.StoppedEvent['body'];
    const anyArmed = this.desired.some((e) => e.valid);
    // An entry stop is read even with nothing armed: its top frame tells
    // whether js-debug's entry breakpoint landed inside a function (#858).
    if (!anyArmed && body.reason !== 'entry') {
      return evt;
    }

    let record = this.pauseRecord && !this.pauseRecord.consumed ? this.pauseRecord : null;
    if (!record && ['breakpoint', 'pause', 'entry'].includes(body.reason)) {
      logger.info(`[CdpFnBpBridge] holding '${body.reason}' stop up to ${this.stopEventHoldMs}ms for its CDP pause record`);
      record = await this.waitForPauseRecord(this.stopEventHoldMs);
      if (record) {
        // The pause we just received kicked a resolution batch for pending
        // entries; finish binding at this stop before forwarding it.
        await this.waitForResolution().catch(() => undefined);
      }
    }
    if (!record) {
      logger.info(`[CdpFnBpBridge] no CDP pause record for '${body.reason}' stop — forwarding unchanged`);
      return evt;
    }

    const matched = this.desired.filter(
      (e) => e.cdpBreakpointId && record.hitBreakpoints.includes(e.cdpBreakpointId)
    );
    if (matched.length === 0 && body.reason === 'entry') {
      // js-debug's entry breakpoint resolved into the body of the function
      // we just armed: this stop IS that function's first call, which
      // Debugger.setBreakpointOnFunctionCall missed only because it was armed
      // from inside it. Matched by [[FunctionLocation]], never by name.
      const entered = this.desired.find(
        (e) => e.valid && e.cdpBreakpointId && sameLocation(e.boundLocation, record.topFunctionLocation)
      );
      if (entered) {
        logger.info(`[CdpFnBpBridge] entry stop is the first call of '${entered.name}' (armed at this stop); reporting it as the function breakpoint (issue #858)`);
        matched.push(entered);
      }
    }
    if (matched.length === 0) {
      if (body.reason === 'entry' && record.topFunctionName) {
        logger.info(`[CdpFnBpBridge] entry stop landed inside '${record.topFunctionName}' (issue #858)`);
        return { ...evt, body: { ...body, text: lateEntryNote(record.topFunctionName) } };
      }
      return evt;
    }

    record.consumed = true;
    return {
      ...evt,
      body: {
        ...body,
        reason: 'function breakpoint',
        // Merge, never replace: a line breakpoint on the function's first
        // statement co-fires in the same V8 pause, and its id may be the only
        // proof that breakpoint bound (issue #673). The id spaces are
        // disjoint by construction (ADAPTER_ID_BASE).
        hitBreakpointIds: [
          ...((body.hitBreakpointIds ?? []) as number[]),
          ...matched.map((e) => e.adapterId)
        ]
      }
    };
  }

  // ----- internals -----

  private wireClient(client: CdpProxyClient): void {
    const onEvent = (method: string, params: unknown): void => this.onCdpEvent(method, params as Record<string, unknown>);
    const onClosed = (): void => {
      logger.warn('[CdpFnBpBridge] CDP proxy connection closed; function breakpoints disarmed until re-attach');
      if (this.client === client) {
        this.clearClientState();
      }
    };
    client.on('cdp-event', onEvent);
    client.on('closed', onClosed);
    this.clientListeners = [
      () => client.off('cdp-event', onEvent),
      () => client.off('closed', onClosed)
    ];
  }

  private clearClientState(): void {
    for (const unlisten of this.clientListeners) {
      unlisten();
    }
    this.clientListeners = [];
    this.client = null;
    this.bindingInstalled = false;
    this.pauseRecord = null;
    this.scriptUrls.clear();
    for (const entry of this.desired) {
      if (entry.valid) {
        entry.cdpBreakpointId = undefined;
        entry.verified = false;
        entry.message = PENDING_NO_TARGET;
      }
    }
  }

  private onCdpEvent(method: string, params: Record<string, unknown>): void {
    if (method === 'Debugger.paused') {
      const callFrames = (params.callFrames as Array<{
        callFrameId?: string;
        url?: string;
        functionName?: string;
        functionLocation?: Partial<CdpLocation>;
        location?: { scriptId?: string };
      }> | undefined) ?? [];
      for (const frame of callFrames) {
        if (frame.url && frame.location?.scriptId) {
          this.rememberScriptUrl(frame.location.scriptId, frame.url);
        }
      }
      const topLocation = callFrames[0]?.functionLocation;
      const record: PauseRecord = {
        hitBreakpoints: (params.hitBreakpoints as string[] | undefined) ?? [],
        topCallFrameId: callFrames[0]?.callFrameId,
        topScriptId: callFrames[0]?.location?.scriptId,
        topFunctionName: callFrames[0]?.functionName,
        ...(topLocation && typeof topLocation.scriptId === 'string' && typeof topLocation.lineNumber === 'number'
          ? { topFunctionLocation: { scriptId: topLocation.scriptId, lineNumber: topLocation.lineNumber, columnNumber: topLocation.columnNumber ?? 0 } }
          : {}),
        consumed: false
      };
      this.pauseRecord = record;
      logger.info(`[CdpFnBpBridge] Debugger.paused recorded (hits=${record.hitBreakpoints.length}, frame=${record.topCallFrameId ?? 'none'})`);
      const waiters = this.pauseWaiters;
      this.pauseWaiters = [];
      for (const waiter of waiters) {
        waiter(record);
      }
      if (this.desired.some((e) => e.valid && !e.cdpBreakpointId)) {
        void this.kickResolution(true);
      }
    } else if (method === 'Debugger.resumed') {
      this.pauseRecord = null;
    } else if (method === 'Runtime.bindingCalled') {
      if (params.name === JS_LOGPOINT_BINDING) {
        // One rendered logpoint message; the session's output buffer and
        // the output resource receive it like any adapter output event.
        this.emit('outputEvent', {
          seq: 0,
          type: 'event',
          event: 'output',
          body: { category: 'console', output: `${String(params.payload ?? '')}\n` }
        } as DebugProtocol.OutputEvent);
      }
    } else if (method === 'Debugger.scriptParsed') {
      const scriptId = params.scriptId as string | undefined;
      const url = params.url as string | undefined;
      if (scriptId && url) {
        this.rememberScriptUrl(scriptId, url);
      }
    }
  }

  /** FIFO-capped insert into the scriptId → url map (issue #405). */
  private rememberScriptUrl(scriptId: string, url: string): void {
    if (!this.scriptUrls.has(scriptId) && this.scriptUrls.size >= MAX_SCRIPT_URLS) {
      const oldest = this.scriptUrls.keys().next().value;
      if (oldest !== undefined) {
        this.scriptUrls.delete(oldest);
      }
    }
    this.scriptUrls.set(scriptId, url);
  }

  private waitForPauseRecord(timeoutMs: number): Promise<PauseRecord | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pauseWaiters = this.pauseWaiters.filter((w) => w !== waiter);
        resolve(null);
      }, timeoutMs);
      const waiter = (record: PauseRecord): void => {
        clearTimeout(timer);
        resolve(record);
      };
      this.pauseWaiters.push(waiter);
    });
  }

  /** Serialized resolution batches; emitEvents only for pause-triggered ones. */
  private kickResolution(emitEvents: boolean): Promise<void> {
    const run = this.resolveChain.then(() => this.resolvePendingEntries(emitEvents));
    this.resolveChain = run.catch(() => undefined);
    return run;
  }

  private async resolvePendingEntries(emitEvents: boolean): Promise<void> {
    const client = this.client;
    if (!client?.isConnected()) {
      return;
    }
    for (const entry of this.desired) {
      if (!entry.valid || entry.cdpBreakpointId) {
        continue;
      }
      try {
        const bound = await this.resolveAndArm(client, entry);
        if (bound && emitEvents) {
          this.emitBreakpointChanged(entry);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        entry.message = `Function breakpoint '${entry.name}' not bound: ${message}`;
        logger.warn(`[CdpFnBpBridge] resolve failed for '${entry.name}': ${message}`);
      }
    }
  }

  private async resolveAndArm(client: CdpProxyClient, entry: FnBpEntry): Promise<boolean> {
    const objectGroup = `mcp-fnbp-${++this.nextObjectGroupId}`;
    const evaluation = await this.evaluateName(client, entry.name, objectGroup);
    const result = evaluation.result;

    if (evaluation.exceptionDetails || !result || result.type === 'undefined') {
      entry.message = `Function '${entry.name}' not found in the current scope — will retry at the next pause`;
      await this.releaseObjectGroup(client, objectGroup);
      return false;
    }
    if (result.type !== 'function' || !result.objectId) {
      entry.message = `'${entry.name}' is not a function (type: ${result.type ?? 'unknown'})`;
      await this.releaseObjectGroup(client, objectGroup);
      return false;
    }

    const armed = await client.send<{ breakpointId: string }>('Debugger.setBreakpointOnFunctionCall', {
      objectId: result.objectId,
      ...(entry.condition !== undefined ? { condition: entry.condition } : {})
    });
    entry.cdpBreakpointId = armed.breakpointId;
    entry.verified = true;
    entry.message = undefined;

    try {
      await this.enrichLocation(client, entry, result.objectId);
    } catch (err) {
      logger.warn(`[CdpFnBpBridge] location enrichment failed for '${entry.name}': ${String(err)}`);
    }
    logger.info(
      `[CdpFnBpBridge] armed '${entry.name}' as ${armed.breakpointId} (adapterId ${entry.adapterId}, bound ${entry.boundFile ?? '?'}:${entry.boundLine ?? '?'})`
    );
    await this.releaseObjectGroup(client, objectGroup);
    return true;
  }

  private async evaluateName(client: CdpProxyClient, name: string, objectGroup: string): Promise<CdpEvaluateResult> {
    try {
      return await this.evaluateNameWithVetoRetry(client, name, objectGroup);
    } catch (err) {
      // Stale pause record: the target resumed while (or just before) the
      // frame evaluation was in flight — the Debugger.resumed event may even
      // have cleared the record already, so the error alone is the trigger.
      // Drop any record and retry on the global path.
      if (err instanceof Error && /only perform operation while paused/i.test(err.message)) {
        this.pauseRecord = null;
        return this.evaluateNameWithVetoRetry(client, name, objectGroup);
      }
      throw err;
    }
  }

  private async evaluateNameWithVetoRetry(client: CdpProxyClient, name: string, objectGroup: string): Promise<CdpEvaluateResult> {
    const strict = await this.evaluateNameOnce(client, name, objectGroup, true);
    // V8's side-effect-free whitelist vetoes some innocent reads — notably
    // property access on ESM namespace objects. The path already passed the
    // bridge's grammar (no calls, no indexing), so retry permissively when
    // the only failure was the veto itself.
    if (isSideEffectVeto(strict)) {
      return this.evaluateNameOnce(client, name, objectGroup, false);
    }
    return strict;
  }

  private evaluateNameOnce(
    client: CdpProxyClient,
    name: string,
    objectGroup: string,
    throwOnSideEffect: boolean
  ): Promise<CdpEvaluateResult> {
    const frameId = this.pauseRecord?.topCallFrameId;
    if (frameId) {
      // A paused frame sees module scope AND globals through its scope chain.
      return client.send<CdpEvaluateResult>('Debugger.evaluateOnCallFrame', {
        callFrameId: frameId,
        expression: name,
        objectGroup,
        silent: true,
        ...(throwOnSideEffect ? { throwOnSideEffect: true } : {})
      });
    }
    return client.send<CdpEvaluateResult>('Runtime.evaluate', {
      expression: name,
      objectGroup,
      silent: true,
      ...(throwOnSideEffect ? { throwOnSideEffect: true } : {})
    });
  }

  /**
   * Best-effort boundLine/boundFile from [[FunctionLocation]]. The main
   * module's script has an empty url under js-debug's launch path, so when the
   * function lives in the same script as the paused frame we fall back to
   * evaluating __filename in that frame's module scope.
   */
  private async enrichLocation(client: CdpProxyClient, entry: FnBpEntry, objectId: string): Promise<void> {
    const props = await client.send<{
      internalProperties?: Array<{
        name: string;
        value?: { objectId?: string; value?: { scriptId?: string; lineNumber?: number } };
      }>;
    }>('Runtime.getProperties', { objectId, ownProperties: true });
    const locValue = props.internalProperties?.find((p) => p.name === '[[FunctionLocation]]')?.value;

    // V8 reports the internal#location either inline (value.value carries the
    // fields) or as a remote object needing a second getProperties.
    let scriptId: string | undefined;
    let lineNumber: number | undefined;
    let columnNumber: number | undefined;
    if (locValue?.value && typeof locValue.value === 'object') {
      scriptId = locValue.value.scriptId;
      lineNumber = locValue.value.lineNumber;
      columnNumber = (locValue.value as { columnNumber?: number }).columnNumber;
    } else if (locValue?.objectId) {
      const locationProps = await client.send<{
        result?: Array<{ name: string; value?: { value?: unknown } }>;
      }>('Runtime.getProperties', { objectId: locValue.objectId, ownProperties: true });
      const locationFields = new Map((locationProps.result ?? []).map((p) => [p.name, p.value?.value]));
      scriptId = locationFields.get('scriptId') as string | undefined;
      lineNumber = locationFields.get('lineNumber') as number | undefined;
      columnNumber = locationFields.get('columnNumber') as number | undefined;
    } else {
      return;
    }

    if (typeof lineNumber === 'number') {
      entry.boundLine = lineNumber + 1; // CDP lines are 0-based
    }
    if (scriptId && typeof lineNumber === 'number') {
      entry.boundLocation = { scriptId, lineNumber, columnNumber: columnNumber ?? 0 };
    }
    if (!scriptId) {
      return;
    }

    let url = this.scriptUrls.get(scriptId);
    if (!url && this.pauseRecord?.topCallFrameId && this.pauseRecord.topScriptId === scriptId) {
      // The main module's script has an EMPTY url under js-debug's launch
      // path and its scriptParsed predates our subscription. When the
      // function lives in the same script as the paused frame, ask the frame:
      // __filename covers CJS; process.argv[1] covers the ESM main module
      // (import.meta cannot be evaluated in a frame context). The expression
      // is bridge-authored — reads only — so throwOnSideEffect is not needed
      // (it would veto the process.argv getter).
      const fileResult = await client.send<CdpEvaluateResult>('Debugger.evaluateOnCallFrame', {
        callFrameId: this.pauseRecord.topCallFrameId,
        expression:
          'typeof __filename === "string" ? __filename : ' +
          '(typeof process === "object" && process && process.argv && typeof process.argv[1] === "string" ? process.argv[1] : "")',
        silent: true,
        returnByValue: true
      });
      if (typeof fileResult.result?.value === 'string' && fileResult.result.value !== '' && !fileResult.exceptionDetails) {
        url = fileResult.result.value;
      }
    }
    if (url) {
      entry.boundFile = fileUrlToPath(url);
    }
  }

  private async removeCdpBreakpoint(breakpointId: string): Promise<void> {
    if (!this.client?.isConnected()) {
      return;
    }
    try {
      await this.client.send('Debugger.removeBreakpoint', { breakpointId });
    } catch (err) {
      logger.warn(`[CdpFnBpBridge] removeBreakpoint ${breakpointId} failed: ${String(err)}`);
    }
  }

  private async releaseObjectGroup(client: CdpProxyClient, objectGroup: string): Promise<void> {
    try {
      await client.send('Runtime.releaseObjectGroup', { objectGroup });
    } catch {
      // handle cleanup is best-effort
    }
  }

  private toDapBreakpoint(entry: FnBpEntry): DebugProtocol.Breakpoint {
    return {
      id: entry.adapterId,
      verified: entry.verified,
      ...(entry.message !== undefined ? { message: entry.message } : {}),
      ...(entry.boundLine !== undefined ? { line: entry.boundLine } : {}),
      ...(entry.boundFile !== undefined ? { source: { path: entry.boundFile } } : {})
    };
  }

  private emitBreakpointChanged(entry: FnBpEntry): void {
    const event: DebugProtocol.BreakpointEvent = {
      seq: 0,
      type: 'event',
      event: 'breakpoint',
      body: {
        reason: 'changed',
        breakpoint: this.toDapBreakpoint(entry)
      }
    };
    this.emit('breakpointEvent', event);
  }
}
