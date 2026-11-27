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
 * Several sessions of this server can use one inspector: a second attach by
 * processId finds the first one's inspector open, and an attach by port or by
 * inspector URL can reach it too. Closing it drops every client, so it is
 * closed by the last session of this server to leave an inspector this server
 * opened. A client from outside this server (a browser's DevTools, another
 * debugger) cannot be seen, and is dropped by that close.
 *
 * One endpoint (a loopback host and port) is one queue: an attach's activation
 * and its registration of the opening (or its share of one), and a last
 * holder's release with its close, run one at a time per endpoint. An attach
 * cannot find an inspector open and then have it closed under it before it
 * counts as a holder, nor find one another attach's signal just opened before
 * that attach has recorded it as this server's.
 *
 * An opening of the inspector is told from a later one on the same port by its
 * `/json/list` id, which Node draws afresh each time the inspector opens: the
 * close is sent only to the opening this server made, and the expression it
 * runs checks the PID again, so a port that changed hands since is left alone.
 *
 * Everything outside the process is injectable, so the decisions are tested
 * without a target; the defaults are the real probe and the real CDP session.
 */
import { isLoopbackHost, type AttachLoan } from '@debugmcp/shared';
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
 * inspector answers it in about 1 ms; when it passes, the answer says
 * something other than an inspector answered, and nothing is sent.
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
 * absolute deadline, each probe capped to what is left of it, polling every
 * 20 ms. Measured with the same runs: refused 0–1 ms after the inspector
 * dropped the connection. When it expires the answer says the port still
 * answered, and the inspector may still be listening.
 */
export const INSPECTOR_PORT_REFUSAL_MS = 1000;
const PORT_REFUSAL_POLL_MS = 20;
/** No single probe of that poll takes more than this, nor more than what is left of the window. */
const PORT_REFUSAL_PROBE_MS = 250;

/**
 * The longest one close can take: the discovery probe, the wait for the drop
 * and the wait for the refusal, each an absolute bound — 4 s. That is what a
 * give-back can add to a detach or close (measured: 3–15 ms in 46 closes). A
 * failed attach that signalled looks at up to two ports, so up to 4 s each.
 *
 * A give-back can also wait behind an attach by processId to the same
 * endpoint that is in flight, which is what keeps that attach from losing its
 * inspector. That activation is bounded by its own timeouts, computed from
 * them: the first probe (1 s) and the ownership read (1.5 s); on macOS two
 * `ps` reads (3 s each); on Windows, when it looks elsewhere, a `netstat` read
 * (3 s) before the signal and up to two after it, each with a probe and an
 * ownership read; then the 5 s deadline, which its last probe and ownership
 * read can overrun by 2.6 s. About 10 s on Linux, 16 s on macOS and 24 s on
 * Windows at the very worst; measured, the inspector opens 12–28 ms after the
 * signal, and is found on another port about 0.3 s after it.
 */
export const INSPECTOR_CLOSE_WORST_CASE_MS = INSPECTOR_DISCOVERY_MS + INSPECTOR_END_ANSWER_MS + INSPECTOR_PORT_REFUSAL_MS;

/** The answer field every JavaScript attach, detach and close reports the inspector under. */
export const INSPECTOR_LOAN_FIELD = 'inspector';

export interface InspectorLoanDependencies {
  listTargets: (host: string, port: number, timeoutMs?: number) => Promise<InspectorProbe>;
  endSession: (webSocketDebuggerUrl: string, pid: number, timeoutMs: number) => Promise<InspectorEndResult>;
  processExists: (pid: number) => boolean;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
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

/** An attach that signalled the target and then failed: where an inspector the signal opened could be. */
interface SignalledTarget {
  readonly pid: number;
  readonly host: string;
  /** Ports that were not listening before the signal. */
  readonly ports: readonly number[];
}

/**
 * - `opened`: this attach's signal opened the inspector.
 * - `joined`: an attach by processId found open an inspector this server had
 *   opened for an earlier attach, or an attach by port or URL reached one.
 * - `found`: an attach by processId found it open, and this server had not
 *   opened it.
 * - `addressed`: an attach by port or URL reached an inspector this server
 *   did not open. Nothing about it was observed beyond what the attach saw.
 * - `signalled`: an attach by processId signalled the target and then failed
 *   before it found the inspector: one may be open, and is looked for at the
 *   give-back where it could be.
 */
type LoanKind = 'opened' | 'joined' | 'found' | 'addressed' | 'signalled';

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
    readonly signalled?: SignalledTarget
  ) {}

  describe(): string {
    const others = this.opening ? this.loans.othersHolding(this) : [];
    switch (this.kind) {
      case 'found':
        return `already open on ${this.where} before this attach; left open when this session ends`;
      case 'addressed':
        return `not opened by this server (this attach named its address); left as it was when this session ends`;
      case 'signalled':
        return `this attach signalled PID ${this.signalled?.pid} to open it and did not find it on ${this.where}; ` +
          `looked for again, and closed if found, when this session ends`;
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
  /** Attaches by processId in flight that may find their inspector on a port nothing named. */
  private readonly searching = new Set<Promise<ProcessIdAttachOutcome>>();

  constructor(deps: Partial<InspectorLoanDependencies> = {}) {
    this.deps = {
      listTargets: deps.listTargets ?? ((host, port, timeoutMs) => probeInspector(host, port, timeoutMs)),
      endSession: deps.endSession ?? endInspectorSession,
      processExists: deps.processExists ?? processExistsByPid,
      sleep: deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
      now: deps.now ?? Date.now
    };
  }

  /**
   * Run `task` alone on the endpoint `key`: after every task queued on it
   * before, and before every task queued after. Nothing here queues on an
   * endpoint while it holds the same one.
   */
  private async exclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((resolve) => { release = resolve; });
    const tail = previous.then(() => mine);
    this.queues.set(key, tail);
    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.queues.get(key) === tail) {
        this.queues.delete(key);
      }
    }
  }

  /** Resolves once everything queued on `host:port` so far has run: an attach, a release, a close. */
  settled(host: string, port: number): Promise<void> {
    return this.exclusive(keyOf(host, port), async () => undefined);
  }

  /**
   * An attach by processId, its activation and what it holds afterwards in
   * one turn of the endpoint's queue: a release cannot close the inspector
   * between the activation finding it and this attach counting as a holder,
   * and an attach that finds an inspector another attach's signal just opened
   * finds it recorded. An activation that fails after signalling still holds a
   * loan: the signal may have opened an inspector, and the give-back looks
   * for it.
   */
  async attachByProcessId(
    pid: number,
    endpoint: { host: string; port: number },
    activate: () => Promise<InspectorActivationResult>,
    options: { mayOpenElsewhere?: boolean } = {}
  ): Promise<ProcessIdAttachOutcome> {
    const turn = this.attachInTurn(pid, endpoint, activate);
    if (options.mayOpenElsewhere) {
      // It may record an opening on a port nothing named (see forAddress).
      this.searching.add(turn);
      void turn.then(() => this.searching.delete(turn), () => this.searching.delete(turn));
    }
    return turn;
  }

  private attachInTurn(
    pid: number,
    endpoint: { host: string; port: number },
    activate: () => Promise<InspectorActivationResult>
  ): Promise<ProcessIdAttachOutcome> {
    return this.exclusive(keyOf(endpoint.host, endpoint.port), async () => {
      let activated: InspectorActivationResult;
      try {
        activated = await activate();
      } catch (error) {
        if (error instanceof SignalledActivationError) {
          const signalled = { pid: error.pid, host: error.host, ports: error.ports };
          return { error, loan: new InspectorLoan(this, 'signalled', keyOf(endpoint.host, endpoint.port), undefined, signalled) };
        }
        return { error };
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
    });
  }

  /**
   * The port of an inspector this server opened in `pid` and still holds
   * (issue #1261): where a second attach by processId to that process looks
   * first, when nothing else names the port (the first found it on a port of
   * its own). Undefined when it holds none.
   */
  portOpenedFor(pid: number, host = '127.0.0.1'): number | undefined {
    for (const opening of this.opened.values()) {
      if (opening.pid === pid && opening.host === host) {
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
    // An attach by processId that was told no port may find its inspector on
    // a port nothing named, and record it under that port while it holds only
    // its own endpoint's queue. Until it has, this address may be that port:
    // wait for it, so its record is there to share. (It never waits on this.)
    await Promise.allSettled([...this.searching]);
    return this.exclusive(where, async () => {
      const known = this.opened.get(where);
      if (!known || known.targetId === undefined) {
        return new InspectorLoan(this, 'addressed', where);
      }
      let reached = targetId;
      if (reached === undefined) {
        const probe = await this.deps.listTargets(host, port, INSPECTOR_DISCOVERY_MS);
        reached = probe.status === 'inspector' && probe.targets.some((t) => t.id === known.targetId) ? known.targetId : undefined;
      }
      return reached === known.targetId ? this.hold(known, 'joined') : new InspectorLoan(this, 'addressed', where);
    });
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
    if (loan.signalled) {
      return this.lookForSignalled(loan.signalled);
    }
    const opening = loan.opening;
    if (!opening) {
      return loan.kind === 'found'
        ? `left open: it was already open on ${loan.where} before this attach`
        : `left as it was: this server did not open it (this attach named its address, ${loan.where})`;
    }
    return this.exclusive(opening.key, async () => {
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
      return this.close(opening);
    });
  }

  /** Close one opening, and say what was observed. Only "closed" once the port refuses. */
  private async close(opening: OpenedInspector): Promise<string> {
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
    const ended = await this.deps.endSession(target.webSocketDebuggerUrl, pid, INSPECTOR_END_ANSWER_MS);
    return this.afterEnd(ended, pid, host, port, {
      closed: `closed: ${where} no longer accepts connections, and PID ${pid} runs on; an attach by processId opens it again`,
      stoppedMeanwhile: `closed: ${where} stopped listening while this session ended (not closed by this server); PID ${pid} runs on`
    });
  }

  /**
   * What an end request came to, as the port and the process then show it:
   * `closed` only once the port refuses a connection after the drop.
   */
  private async afterEnd(
    ended: InspectorEndResult,
    pid: number,
    host: string,
    port: number,
    texts: { closed: string; stoppedMeanwhile: string }
  ): Promise<string> {
    const where = keyOf(host, port);
    const gone = `gone: PID ${pid} is no longer running, and its inspector went with it`;
    const notConfirmed = (why: string): string => `not confirmed closed: ${why}; ${where} may still be listening`;
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
          ? texts.stoppedMeanwhile
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
    return texts.closed;
  }

  /**
   * The give-back of an attach that signalled and then failed: an inspector of
   * PID's on one of the ports, none of which was listening before the signal,
   * is the one the signal opened, and is closed. Each port in its endpoint's
   * queue; one another session of this server holds is not looked at.
   */
  private async lookForSignalled(signalled: SignalledTarget): Promise<string> {
    const { pid, host, ports } = signalled;
    if (!this.deps.processExists(pid)) {
      return `gone: PID ${pid} is no longer running, and any inspector the signal opened went with it`;
    }
    for (const port of ports) {
      const key = keyOf(host, port);
      const outcome = await this.exclusive(key, async () => {
        if (this.opened.has(key)) return undefined;
        const probe = await this.deps.listTargets(host, port, INSPECTOR_DISCOVERY_MS);
        if (probe.status !== 'inspector') return undefined;
        for (const target of probe.targets) {
          if (typeof target.webSocketDebuggerUrl !== 'string' || target.webSocketDebuggerUrl.length === 0) continue;
          const ended = await this.deps.endSession(target.webSocketDebuggerUrl, pid, INSPECTOR_END_ANSWER_MS);
          if (ended.status === 'other-pid') continue;
          return this.afterEnd(ended, pid, host, port, {
            closed: `closed: the signal this attach sent had opened PID ${pid}'s inspector on ${key}; ` +
              `it no longer accepts connections, and PID ${pid} runs on`,
            stoppedMeanwhile: `closed: the inspector the signal opened on ${key} stopped listening while this session ended ` +
              `(not closed by this server); PID ${pid} runs on`
          });
        }
        return undefined;
      });
      if (outcome !== undefined) return outcome;
    }
    return `not confirmed closed: this attach signalled PID ${pid} to open its inspector, and none of PID ${pid}'s was found on ` +
      `${ports.map((port) => keyOf(host, port)).join(' or ')}; one may be open on a port this server could not identify ` +
      `(a target started with --inspect-port=<n> opens it there) — restart the target to close it`;
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
