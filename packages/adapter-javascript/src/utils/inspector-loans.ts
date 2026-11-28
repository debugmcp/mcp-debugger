/**
 * The inspectors this server opened, and which of its sessions use them
 * (issue #1261).
 *
 * An attach borrows; a detach returns what was borrowed, whole. An attach by
 * processId makes Node open its inspector (`SIGUSR1`, `process._debugProcess`),
 * and Node never closes it by itself: it listens, unauthenticated, until
 * something inside the process ends it or the process exits, and while it
 * holds 9229 an attach by processId to any other Node process on the host is
 * refused. So the session that opened it closes it when it ends, and an
 * inspector that was already open (a target started with `--inspect`, or one
 * an earlier tool left open) is left exactly as it was.
 *
 * The rule, in two parts:
 *   1. One attach has one endpoint (a loopback host and port), fixed before it
 *      queues: the caller's port; else the port of an opening this server
 *      already holds for that PID (a lookup — nothing is signalled because of
 *      it); else Node's default, 127.0.0.1:9229.
 *   2. This server closes only an opening whose `/json/list` id it observed at
 *      that endpoint during that attach: closed before the signal, open after
 *      it. Everything else is reported and never closed — an inspector found
 *      open, one an attach by address reached, and whatever a signal may have
 *      opened somewhere the attach did not look (a target started with
 *      `--inspect-port` and attached without that port: #1310).
 *
 * Several sessions of this server can use one opening: a second attach by
 * processId finds it open, and an attach by port or by inspector URL can reach
 * it. Closing it drops every client, so it is closed by the last session of
 * this server to leave it. A client from outside this server (a browser's
 * DevTools, another debugger) cannot be seen, and is dropped by that close.
 *
 * One endpoint is one queue. Three kinds of turn hold it, one at a time: an
 * attach by processId (its activation and its registration of the opening or
 * of its share), an attach by address (its lookup and its share), and the last
 * holder's release with its close. So an attach cannot find the inspector open
 * and lose it to a close before it counts as a holder, nor find an opening
 * another attach's signal just made before that attach recorded it. Each turn
 * has a limit (below); a turn that reaches it gives the queue up with an
 * answer that says so, and what it was still doing changes nothing after that.
 *
 * An opening is told from a later one on the same port by its `/json/list`
 * id, which Node draws afresh each time the inspector opens: the close is sent
 * only to the opening this server made, and the expression it runs checks the
 * PID again, so a port that changed hands since is left alone.
 *
 * Everything outside the process is injectable, so the decisions are tested
 * without a target; the defaults are the real probe and the real CDP session.
 */
import { AdapterError, AdapterErrorCode, isLoopbackHost, type AttachLoan } from '@debugmcp/shared';
import {
  endInspectorSession,
  probeInspector,
  processExistsByPid,
  SignalledActivationError,
  type InspectorActivationResult,
  type InspectorEndResult,
  type InspectorProbe
} from './inspector-activation.js';

/**
 * How long the close's first probe may take: the `/json/list` read that finds
 * the opening to close (an absolute bound, like every probe here). A local
 * inspector answers it in about 1 ms; when it passes, the answer says the
 * port did not answer, and nothing is sent.
 */
export const INSPECTOR_DISCOVERY_MS = 1000;

/**
 * How long the close waits for the inspector to drop its connection after the
 * guarded `process._debugEnd()` is sent. Measured on Windows 11 with Node
 * 24.14.1, after js-debug's own disconnect: 1–3 ms in 9 detaches and closes
 * (a default pausing attach, a session paused at a breakpoint, two sessions
 * on one inspector), 2–10 ms in 5 cycles with no debugger attached before.
 * When it expires the answer says the close was not confirmed and why (a
 * target that another debugger holds paused, or one busy outside JavaScript,
 * does not run the expression); nothing is retried.
 */
export const INSPECTOR_END_ANSWER_MS = 2000;

/**
 * How long the close then waits for the port to refuse a connection: an
 * absolute deadline, each probe cut to what is left of it, polling every
 * 20 ms. Measured with the same runs: refused 0–1 ms after the inspector
 * dropped the connection. When it expires the answer says the port still
 * answered, and the inspector may still be listening.
 */
export const INSPECTOR_PORT_REFUSAL_MS = 1000;
const PORT_REFUSAL_POLL_MS = 20;
/** No single probe of that poll takes more than this, nor more than what is left of the window. */
const PORT_REFUSAL_PROBE_MS = 250;

/**
 * The limits of the three kinds of turn on an endpoint's queue, and so the
 * worst case an attach waiting for that endpoint can see: the sum of the
 * limits of the turns queued ahead of it.
 *
 * - An attach by processId: its activation, 7.5 s at most on Linux and
 *   Windows and 13.5 s on macOS by its own bounds (`activateInspector`), then
 *   a registration that does not wait. Limit 15 s.
 * - An attach by address: one probe, 1 s. Limit 2 s.
 * - A release with its close: the discovery probe, the wait for the drop and
 *   the wait for the refusal, 1 + 2 + 1 = 4 s (measured: 3–15 ms in 46
 *   closes on Windows). Limit 5 s. That is also what a give-back adds to a
 *   detach or a close, at most.
 *
 * A turn that reaches its limit gives the queue up: the attach fails, saying
 * its activation did not finish (it may have signalled the target), and is not
 * counted as a holder; an attach by address shares nothing; a close is not
 * confirmed, and sends nothing it had not sent yet. Measured, an activation
 * that finds or opens the inspector takes 12–28 ms after its signal.
 */
export const ENDPOINT_TURN_LIMITS_MS = { activation: 15_000, lookup: 2_000, close: 5_000 } as const;
export type EndpointTurnLimits = { activation: number; lookup: number; close: number };

/** The answer field every JavaScript attach, detach and close reports the inspector under. */
export const INSPECTOR_LOAN_FIELD = 'inspector';

export interface InspectorLoanDependencies {
  listTargets: (host: string, port: number, timeoutMs?: number) => Promise<InspectorProbe>;
  endSession: (webSocketDebuggerUrl: string, pid: number, timeoutMs: number) => Promise<InspectorEndResult>;
  processExists: (pid: number) => boolean;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  /** The queue's turn limits (tests shorten them). */
  turnLimits: EndpointTurnLimits;
}

/** One opening of an inspector that this server made, and the loans that use it. */
interface OpenedInspector {
  readonly key: string;
  readonly host: string;
  readonly port: number;
  readonly pid: number;
  readonly targetId: string | undefined;
  readonly holders: Set<InspectorLoan>;
}

/**
 * - `opened`: this attach's signal opened the inspector, at its endpoint.
 * - `joined`: an attach by processId found open an inspector this server had
 *   opened for an earlier attach, or an attach by port or URL reached one.
 * - `found`: an attach by processId found it open, and this server had not
 *   opened it.
 * - `addressed`: an attach by port or URL reached an inspector this server
 *   did not open. Nothing about it was observed beyond what the attach saw.
 * - `unresolved`: an attach by processId that failed after it had signalled
 *   the target, or whose activation did not finish: something may be open,
 *   and nothing identifies it. A report only; it closes nothing.
 */
type LoanKind = 'opened' | 'joined' | 'found' | 'addressed' | 'unresolved';

const keyOf = (host: string, port: number): string => `${host}:${port}`;

export class InspectorLoan implements AttachLoan {
  readonly field = INSPECTOR_LOAN_FIELD;
  /** The session holding the loan, named in the answers of the others that share its inspector. */
  holder: string | undefined;
  private returned: Promise<string> | undefined;

  constructor(
    private readonly loans: InspectorLoans,
    readonly kind: LoanKind,
    readonly where: string,
    readonly opening?: OpenedInspector,
    /** For `unresolved`: what is said at the give-back, which does nothing else. */
    readonly report?: string
  ) {}

  describe(): string {
    const others = this.opening ? this.loans.othersHolding(this) : [];
    switch (this.kind) {
      case 'found':
        return `already open on ${this.where} before this attach; left open when this session ends`;
      case 'addressed':
        return `not opened by this server (this attach named its address); left as it was when this session ends`;
      case 'unresolved':
        return this.report ?? `not confirmed closed: nothing identifies what this attach may have opened`;
      case 'opened':
      case 'joined':
        if (others.length > 0) {
          return `opened by this server on ${this.where}, and also used by ${others.join(', ')}; ` +
            `closed when the last of these sessions detaches or closes`;
        }
        return this.kind === 'opened'
          ? `opened by this attach on ${this.where}; closed when this session detaches or closes`
          : `opened by this server on ${this.where} for an earlier attach; closed when this session detaches or closes`;
    }
  }

  giveBack(): Promise<string> {
    this.returned ??= this.loans.giveBack(this).catch((err: unknown) =>
      `not confirmed closed: ${err instanceof Error ? err.message : String(err)}; ${this.where} may still be listening`
    );
    return this.returned;
  }
}

/** What an attach by processId came to: the activation, the loan it holds, or the error with what it still holds. */
export interface ProcessIdAttachOutcome {
  activated?: InspectorActivationResult;
  loan?: InspectorLoan;
  error?: unknown;
}

export class InspectorLoans {
  private readonly deps: InspectorLoanDependencies;
  private readonly opened = new Map<string, OpenedInspector>();
  /** Per endpoint, the tail of its queue. */
  private readonly queues = new Map<string, Promise<void>>();

  constructor(deps: Partial<InspectorLoanDependencies> = {}) {
    this.deps = {
      listTargets: deps.listTargets ?? ((host, port, timeoutMs) => probeInspector(host, port, timeoutMs)),
      endSession: deps.endSession ?? endInspectorSession,
      processExists: deps.processExists ?? processExistsByPid,
      sleep: deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
      now: deps.now ?? Date.now,
      turnLimits: deps.turnLimits ?? ENDPOINT_TURN_LIMITS_MS
    };
  }

  /**
   * Run one turn alone on the endpoint `key`: after every turn queued on it
   * before, and before every turn queued after. The turn gives the queue up
   * when it settles, or when it reaches `limitMs`: then `overdue()` is its
   * answer, and `task` is told (`expired()`) so that it changes nothing more.
   * Nothing here queues on an endpoint while it holds the same one.
   */
  private async exclusive<T>(
    key: string,
    limitMs: number,
    task: (expired: () => boolean) => Promise<T>,
    overdue: () => T
  ): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((resolve) => { release = resolve; });
    const tail = previous.then(() => mine);
    this.queues.set(key, tail);
    await previous;
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<T>((resolve) => {
      timer = setTimeout(() => {
        expired = true;
        resolve(overdue());
      }, limitMs);
      // The limit is a bound on this turn, not a reason to keep the server alive.
      timer.unref?.();
    });
    try {
      return await Promise.race([task(() => expired), limit]);
    } finally {
      clearTimeout(timer);
      release();
      if (this.queues.get(key) === tail) {
        this.queues.delete(key);
      }
    }
  }

  /** Resolves once everything queued on `host:port` so far has run: an attach, a release, a close. */
  settled(host: string, port: number): Promise<void> {
    return this.exclusive(keyOf(host, port), this.deps.turnLimits.lookup, async () => undefined, () => undefined);
  }

  /**
   * An attach by processId: its activation and what it holds afterwards, in
   * one turn of its endpoint's queue. A failure after the signal holds an
   * `unresolved` loan: a report that something may be open, and no close.
   */
  async attachByProcessId(
    pid: number,
    endpoint: { host: string; port: number },
    activate: () => Promise<InspectorActivationResult>
  ): Promise<ProcessIdAttachOutcome> {
    const key = keyOf(endpoint.host, endpoint.port);
    const limitMs = this.deps.turnLimits.activation;
    return this.exclusive<ProcessIdAttachOutcome>(key, limitMs, async (expired) => {
      let activated: InspectorActivationResult;
      try {
        activated = await activate();
      } catch (error) {
        if (error instanceof SignalledActivationError) {
          const where = keyOf(error.host, error.port);
          return {
            error,
            loan: new InspectorLoan(this, 'unresolved', where, undefined,
              `not confirmed closed: this attach signalled PID ${error.pid} to open its inspector, and none of PID ${error.pid}'s appeared on ${where}; ` +
                `one may now be open on another port, and this server closed nothing, because it could not identify one — restarting the target closes it`)
          };
        }
        return { error };
      }
      if (expired()) {
        // The turn gave the queue up already; what this activation found is not recorded.
        return { error: undefined };
      }
      return {
        activated,
        loan: this.forActivation({
          pid,
          host: activated.host,
          port: activated.port,
          alreadyActive: activated.alreadyActive,
          targetId: activated.targetId
        })
      };
    }, () => ({
      error: new AdapterError(
        `JavaScript attach: the activation of PID ${pid}'s inspector on ${key} did not finish within ${limitMs} ms; ` +
          `it may have signalled the target, and this server closed nothing`,
        AdapterErrorCode.ENVIRONMENT_INVALID
      ),
      loan: new InspectorLoan(this, 'unresolved', key, undefined,
        `not confirmed closed: the activation on ${key} did not finish within ${limitMs} ms and may have signalled PID ${pid}; ` +
          `this server closed nothing, because it could not identify an inspector — restarting the target closes one it opened`)
    }));
  }

  /**
   * The port of an opening this server holds for `pid` (issue #1261): where a
   * second attach by processId with no port of its own looks, chosen before
   * it queues. A lookup: it opens nothing, and the attach it serves does not
   * signal. Undefined when this server holds none. Every opening is on
   * 127.0.0.1: the activation answers that host for every loopback spelling.
   */
  portOpenedFor(pid: number): number | undefined {
    for (const opening of this.opened.values()) {
      if (opening.pid === pid) {
        return opening.port;
      }
    }
    return undefined;
  }

  /**
   * The loan of an attach by processId, from what the activation saw. Called
   * inside the endpoint's queue (`attachByProcessId`); on its own only by tests.
   */
  forActivation(activation: { pid: number; host: string; port: number; alreadyActive: boolean; targetId?: string }): InspectorLoan {
    const { pid, host, port, alreadyActive, targetId } = activation;
    const key = keyOf(host, port);
    const where = key;
    const known = this.opened.get(key);
    // The same opening this server already holds: two attaches by processId,
    // one after the other or racing (both signalled; one signal opened it).
    if (known && targetId !== undefined && known.targetId === targetId && known.pid === pid) {
      return this.hold(known, alreadyActive ? 'joined' : 'opened');
    }
    if (alreadyActive) {
      return new InspectorLoan(this, 'found', where);
    }
    // A new opening. A record of an earlier one on this port is stale: its
    // holders keep their own record, and their close finds the id changed.
    const opening: OpenedInspector = { key, host, port, pid, targetId, holders: new Set() };
    this.opened.set(key, opening);
    return this.hold(opening, 'opened');
  }

  /**
   * The loan of an attach by port or by inspector URL: a share of an inspector
   * this server opened when that is what the address reaches, else nothing
   * this server will touch. In the endpoint's queue, like an attach by
   * processId.
   */
  async forAddress(address: { host?: string; port?: number; websocketAddress?: string }): Promise<InspectorLoan> {
    const target = parseAddress(address);
    if (!target) {
      return new InspectorLoan(this, 'addressed', describeAddress(address));
    }
    const { host, port, targetId } = target;
    const where = keyOf(host, port);
    const addressed = (): InspectorLoan => new InspectorLoan(this, 'addressed', where);
    return this.exclusive(where, this.deps.turnLimits.lookup, async (expired) => {
      const known = this.opened.get(where);
      if (!known || known.targetId === undefined) {
        return addressed();
      }
      let reached = targetId;
      if (reached === undefined) {
        const probe = await this.deps.listTargets(host, port, INSPECTOR_DISCOVERY_MS);
        reached = probe.status === 'inspector' && probe.targets.some((t) => t.id === known.targetId) ? known.targetId : undefined;
      }
      return reached === known.targetId && !expired() ? this.hold(known, 'joined') : addressed();
    }, addressed);
  }

  /** The other sessions holding the opening `loan` uses, as the answers name them. */
  othersHolding(loan: InspectorLoan): string[] {
    if (!loan.opening) return [];
    return [...loan.opening.holders]
      .filter((other) => other !== loan)
      .map((other) => (other.holder ? `session ${other.holder}` : 'an attach still in progress'));
  }

  /** Give a loan back: called once per loan, through `InspectorLoan.giveBack`. */
  async giveBack(loan: InspectorLoan): Promise<string> {
    if (loan.kind === 'unresolved') {
      return loan.describe();
    }
    const opening = loan.opening;
    if (!opening) {
      return loan.kind === 'found'
        ? `left open: it was already open on ${loan.where} before this attach`
        : `left as it was: this server did not open it (this attach named its address, ${loan.where})`;
    }
    const limitMs = this.deps.turnLimits.close;
    return this.exclusive(opening.key, limitMs, async (expired) => {
      const others = this.othersHolding(loan);
      opening.holders.delete(loan);
      if (others.length > 0) {
        // What is known of the others is that they hold it and have not ended:
        // not that their connection to it is still up.
        return `left open: ${others.join(', ')} ${others.length === 1 ? 'uses it too and has' : 'use it too and have'} ` +
          `not detached or closed yet; the last session of this server using it closes it`;
      }
      if (this.opened.get(opening.key) === opening) {
        this.opened.delete(opening.key);
      }
      return this.close(opening, expired);
    }, () => `not confirmed closed: the close did not finish within ${limitMs} ms; ${opening.key} may still be listening`);
  }

  /** Close one opening, and say what was observed. Only "closed" once the port refuses. */
  private async close(opening: OpenedInspector, expired: () => boolean): Promise<string> {
    const { host, port, pid, targetId } = opening;
    const where = keyOf(host, port);
    const gone = `gone: PID ${pid} is no longer running, and its inspector went with it`;
    const notConfirmed = (why: string): string => `not confirmed closed: ${why}; ${where} may still be listening`;
    if (!this.deps.processExists(pid)) {
      return gone;
    }
    if (targetId === undefined) {
      return notConfirmed('this server did not learn which opening of the inspector it made (the target list gave no id), so nothing was sent');
    }
    const probe = await this.deps.listTargets(host, port, INSPECTOR_DISCOVERY_MS);
    if (probe.status === 'closed') {
      return this.deps.processExists(pid)
        ? `closed: ${where} had already stopped listening when this session ended (not closed by this server); PID ${pid} runs on`
        : gone;
    }
    if (probe.status === 'no-answer') {
      return notConfirmed(`${where} did not answer within ${probe.timeoutMs} ms, so nothing was sent`);
    }
    if (probe.status === 'other') {
      return `not closed: ${where} answers as something other than a Node inspector (${probe.detail}), so nothing was sent to it`;
    }
    const target = probe.targets.find((t) => t.id === targetId);
    if (!target) {
      const ids = probe.targets.map((t) => t.id).filter((id): id is string => typeof id === 'string');
      return `left open: the inspector on ${where} is not the opening this server made ` +
        `(its target list ${ids.length > 0 ? `has id ${ids.join(', ')}` : 'has no target id'}, not ${targetId})`;
    }
    if (typeof target.webSocketDebuggerUrl !== 'string' || target.webSocketDebuggerUrl.length === 0) {
      return notConfirmed('the target list names this opening but gives no WebSocket address for it, so nothing was sent');
    }
    if (expired()) {
      return notConfirmed('the close ran out of time before it was sent, so nothing was sent');
    }
    const ended = await this.deps.endSession(target.webSocketDebuggerUrl, pid, INSPECTOR_END_ANSWER_MS);
    switch (ended.status) {
      case 'other-pid':
        return `left open: the inspector on ${where} answers for PID ${ended.pid}, not PID ${pid}`;
      case 'failed':
        return notConfirmed(`process._debugEnd() failed in PID ${pid}: ${ended.detail}`);
      case 'timeout':
        return notConfirmed(
          `the inspector did not end within ${INSPECTOR_END_ANSWER_MS} ms (PID ${pid} may be held paused by another debugger, or busy outside JavaScript)`
        );
      case 'unreachable': {
        // Nothing was sent. Gone since the probe before it, or never reachable.
        const again = await this.deps.listTargets(host, port, PORT_REFUSAL_PROBE_MS);
        if (!this.deps.processExists(pid)) return gone;
        return again.status === 'closed'
          ? `closed: ${where} stopped listening while this session ended (not closed by this server); PID ${pid} runs on`
          : notConfirmed(`could not reach the inspector to close it (${ended.detail})`);
      }
      case 'dropped':
        break;
    }
    const refused = await this.untilRefused(host, port);
    if (!this.deps.processExists(pid)) {
      return gone;
    }
    if (!refused) {
      return notConfirmed(`${where} still answered ${INSPECTOR_PORT_REFUSAL_MS} ms after the inspector dropped the connection`);
    }
    return `closed: ${where} no longer accepts connections, and PID ${pid} runs on; an attach by processId opens it again`;
  }

  /** Poll until the port refuses a connection; false when the absolute window passes first. */
  private async untilRefused(host: string, port: number): Promise<boolean> {
    const deadline = this.deps.now() + INSPECTOR_PORT_REFUSAL_MS;
    for (;;) {
      const left = deadline - this.deps.now();
      if (left <= 0) {
        return false;
      }
      if ((await this.deps.listTargets(host, port, Math.min(PORT_REFUSAL_PROBE_MS, left))).status === 'closed') {
        return true;
      }
      const after = deadline - this.deps.now();
      if (after <= 0) {
        return false;
      }
      await this.deps.sleep(Math.min(PORT_REFUSAL_POLL_MS, after));
    }
  }

  private hold(opening: OpenedInspector, kind: 'opened' | 'joined'): InspectorLoan {
    const loan = new InspectorLoan(this, kind, opening.key, opening);
    opening.holders.add(loan);
    return loan;
  }
}

/** A loopback host and port, and the target id an inspector URL names; undefined for anything else. */
function parseAddress(address: { host?: string; port?: number; websocketAddress?: string }):
  { host: string; port: number; targetId?: string } | undefined {
  if (typeof address.websocketAddress === 'string' && address.websocketAddress.length > 0) {
    let url: URL;
    try {
      url = new URL(address.websocketAddress);
    } catch {
      return undefined;
    }
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const port = Number(url.port);
    const targetId = url.pathname.split('/').filter(Boolean).pop();
    if (!isLoopbackHost(host) || !Number.isInteger(port) || port <= 0) return undefined;
    return { host: '127.0.0.1', port, ...(targetId ? { targetId } : {}) };
  }
  const host = address.host ?? '127.0.0.1';
  if (!isLoopbackHost(host) || typeof address.port !== 'number' || !Number.isInteger(address.port) || address.port <= 0) {
    return undefined;
  }
  // A signal-opened inspector binds 127.0.0.1 only: every loopback spelling reaches that one.
  return { host: '127.0.0.1', port: address.port };
}

function describeAddress(address: { host?: string; port?: number; websocketAddress?: string }): string {
  if (typeof address.websocketAddress === 'string' && address.websocketAddress.length > 0) {
    try {
      const url = new URL(address.websocketAddress);
      return url.port ? `${url.hostname}:${url.port}` : url.host;
    } catch {
      return 'the inspector URL it was given';
    }
  }
  return address.port !== undefined ? `${address.host ?? '127.0.0.1'}:${address.port}` : 'the address it was given';
}

/** The one record per server process: every session's attach reads and writes it. */
export const inspectorLoans = new InspectorLoans();
