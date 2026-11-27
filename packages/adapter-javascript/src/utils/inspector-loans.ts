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
  type InspectorEndResult,
  type InspectorProbe
} from './inspector-activation.js';

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
 * How long the close then waits for the port to refuse a connection, polling
 * every 20 ms. Measured with the same runs: refused 0–1 ms after the inspector
 * dropped the connection. When it expires the answer says the port still
 * answered, and the inspector may still be listening.
 */
export const INSPECTOR_PORT_REFUSAL_MS = 1000;
const PORT_REFUSAL_POLL_MS = 20;
/** Each probe of that poll gives up sooner than the probe's own 1 s default, so the window holds. */
const PORT_REFUSAL_PROBE_MS = 250;

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

/**
 * - `opened`: this attach's signal opened the inspector.
 * - `joined`: an attach by processId found open an inspector this server had
 *   opened for an earlier attach, or an attach by port or URL reached one.
 * - `found`: an attach by processId found it open, and this server had not
 *   opened it.
 * - `addressed`: an attach by port or URL reached an inspector this server
 *   did not open. Nothing about it was observed beyond what the attach saw.
 */
type LoanKind = 'opened' | 'joined' | 'found' | 'addressed';

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
    readonly opening?: OpenedInspector
  ) {}

  describe(): string {
    const others = this.opening ? this.loans.othersHolding(this) : [];
    switch (this.kind) {
      case 'found':
        return `already open on ${this.where} before this attach; left open when this session ends`;
      case 'addressed':
        return `not opened by this server (this attach named its address); left as it was when this session ends`;
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

export class InspectorLoans {
  private readonly deps: InspectorLoanDependencies;
  private readonly opened = new Map<string, OpenedInspector>();
  private readonly closing = new Map<string, Promise<string>>();

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
   * Wait for a close of the inspector on `host:port` that this server has in
   * flight, so an attach does not reach an inspector while it is being closed.
   * Bounded by the close's own two windows.
   */
  async settled(host: string, port: number): Promise<void> {
    await this.closing.get(keyOf(host, port));
  }

  /** The loan of an attach by processId, from what the activation saw. */
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
   * this server will touch.
   */
  async forAddress(address: { host?: string; port?: number; websocketAddress?: string }): Promise<InspectorLoan> {
    const target = parseAddress(address);
    if (!target) {
      return new InspectorLoan(this, 'addressed', describeAddress(address));
    }
    const { host, port, targetId } = target;
    const where = keyOf(host, port);
    await this.settled(host, port);
    const known = this.opened.get(where);
    if (!known) {
      return new InspectorLoan(this, 'addressed', where);
    }
    let reached = targetId;
    if (reached === undefined) {
      const probe = await this.deps.listTargets(host, port);
      reached = probe.status === 'inspector' && probe.targets.some((t) => t.id === known.targetId) ? known.targetId : undefined;
    }
    // Still the live record after the probe: its last holder may have left
    // meanwhile, and a share of an opening being closed would be no share.
    // Its close then finishes before the attach goes on.
    if (this.opened.get(where) !== known) {
      await this.settled(host, port);
      return new InspectorLoan(this, 'addressed', where);
    }
    return reached !== undefined && reached === known.targetId
      ? this.hold(known, 'joined')
      : new InspectorLoan(this, 'addressed', where);
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
    const opening = loan.opening;
    if (!opening) {
      return loan.kind === 'found'
        ? `left open: it was already open on ${loan.where} before this attach`
        : `left as it was: this server did not open it (this attach named its address, ${loan.where})`;
    }
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
    const closing = this.close(opening);
    this.closing.set(opening.key, closing);
    try {
      return await closing;
    } finally {
      if (this.closing.get(opening.key) === closing) {
        this.closing.delete(opening.key);
      }
    }
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
    const probe = await this.deps.listTargets(host, port);
    if (probe.status === 'closed') {
      return this.deps.processExists(pid)
        ? `closed: ${where} had already stopped listening when this session ended (not closed by this server); PID ${pid} runs on`
        : gone;
    }
    if (probe.status === 'other') {
      return `not closed: ${where} answers as something other than a Node inspector (${probe.detail}), so nothing was sent to it`;
    }
    const target = probe.targets.find((t) => targetId !== undefined && t.id === targetId);
    if (!target || typeof target.webSocketDebuggerUrl !== 'string') {
      return `left open: the inspector on ${where} is no longer the one this server opened (it was closed and opened again since)`;
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
        // Nothing was sent. Gone since the probe above, or never reachable.
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

  /** Poll until the port refuses a connection; false when the window passes first. */
  private async untilRefused(host: string, port: number): Promise<boolean> {
    const deadline = this.deps.now() + INSPECTOR_PORT_REFUSAL_MS;
    for (;;) {
      if ((await this.deps.listTargets(host, port, PORT_REFUSAL_PROBE_MS)).status === 'closed') {
        return true;
      }
      if (this.deps.now() >= deadline) {
        return false;
      }
      await this.deps.sleep(PORT_REFUSAL_POLL_MS);
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
