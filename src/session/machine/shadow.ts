/**
 * The shadow check of the session transition table (transition-table.ts).
 *
 * The gate `SessionManagerCore._updateSessionState` calls `check` after it has
 * done all of its own work, with the state it found, the state it wrote and
 * the site's `StateWrite`. Where today's code writes no state but the table
 * has a row (a hot restart from a running program, a `continued` that arrives
 * while paused, a run being replaced, the worker's exit after the ending, and
 * the one direct assignment in the execution controller), the site calls
 * `note`. The shadow records a verdict for each and refuses nothing: it never
 * throws outside strict mode, and it never changes what the gate does or the
 * order in which it does it.
 *
 * Modes, from `MCP_STATE_SHADOW` (read on every call):
 * - `record` (the default): verdicts are counted; each mismatch is one `warn`
 *   line and is kept in a bounded ring.
 * - `strict` (the unit test project): as `record`, and a `no-row` verdict or
 *   a lifecycle write that disagrees with the state also throws, and is
 *   queued for the test harness, which fails the test even when the throw was
 *   swallowed by the code under test. Nothing else ever throws: the other
 *   verdicts describe today's behaviour.
 * - `off`: nothing is checked.
 *
 * `MCP_STATE_SHADOW_LOG=<directory>` also writes the verdicts out: one
 * ndjson line per verdict to `state-shadow-<pid>.ndjson` in a server process,
 * and one count file per test file under the test harness (tests/vitest.setup.ts).
 */
import { appendFileSync, mkdirSync } from 'fs';
import path from 'path';
import { SessionLifecycleState, SessionState, mapLegacyState } from '@debugmcp/shared';
import type { ILogger } from '@debugmcp/shared';
import {
  evaluateTransition,
  evaluateVirtual,
  isTestSetupWrite,
  phaseOf,
  siteNames,
  type GateSite,
  type GuardContext,
  type GuardName,
  type Phase,
  type ResumeToken,
  type StateWrite,
  type StopIdentity,
  type TableVerdict,
  type TestSetupWrite,
  type Verdict
} from './transition-table.js';

export const STATE_SHADOW_ENV = 'MCP_STATE_SHADOW';
export const STATE_SHADOW_LOG_ENV = 'MCP_STATE_SHADOW_LOG';

export type ShadowMode = 'off' | 'record' | 'strict';

/** The mode in force now: `strict`, `off`, or `record` for anything else. */
export function shadowMode(): ShadowMode {
  const value = process.env[STATE_SHADOW_ENV];
  return value === 'strict' || value === 'off' ? value : 'record';
}

export type ShadowOutcome =
  | Verdict
  | 'test-setup'
  | 'lifecycle-agrees'
  | 'lifecycle-disagrees'
  | 'internal-error';

/** Outcomes that are one warn line and a ring entry. */
const MISMATCHES: ReadonlySet<ShadowOutcome> = new Set<ShadowOutcome>([
  'guard-not-met',
  'unevaluated',
  'no-row',
  'lifecycle-disagrees',
  'internal-error'
]);

/** Outcomes strict mode throws on. */
const STRICT_FAILURES: ReadonlySet<ShadowOutcome> = new Set<ShadowOutcome>(['no-row', 'lifecycle-disagrees']);

export interface ShadowRecord {
  readonly outcome: ShadowOutcome;
  readonly sessionId: string;
  readonly runId: number;
  /** The phase the table judged from: the public state's, or the machine's after a noted replacement. */
  readonly from?: Phase;
  /** The public state's phase, when it differs from `from`. */
  readonly publicFrom?: Phase;
  readonly event: string;
  /** The phase written (for a note that writes nothing: the public phase, unchanged). */
  readonly actual?: Phase;
  /** For a note: where the table takes the session. */
  readonly to?: Phase;
  readonly site: string;
  /** Set on records of a note rather than a gate call. */
  readonly note?: true;
  readonly guard?: GuardName;
  readonly why?: string;
}

/** The fields of a session the shadow reads. A ManagedSession is one. */
export interface ShadowSession {
  readonly id: string;
  readonly state: SessionState;
  readonly lastStop?: StopIdentity;
  readonly parentSessionId?: string;
}

/** What the shadow keeps per session, apart from the session's own fields. */
interface SessionShadowState {
  /** Runs are counted on a tree's root, at each `start`; a child reads its root's. */
  runId: number;
  /** `continued` events the session was seen to receive. */
  continued: number;
  /** A phase the public state did not follow (a noted replacement); cleared by the next gate write. */
  machine?: Phase;
  /** The stop the session last showed in this run. */
  lastShownStop?: StopIdentity;
  /** The state the gate last wrote, for the lifecycle assertion. */
  lastWritten?: SessionState;
}

/** Thrown in strict mode on `no-row` or a lifecycle write that disagrees with the state. */
export class StateShadowError extends Error {
  constructor(readonly record: ShadowRecord) {
    super(`[state-shadow] ${describe(record)}`);
    this.name = 'StateShadowError';
  }
}

/** Process-wide counters and strict failures, shared with the test harness through globalThis. */
interface ShadowRegistry {
  counts: Map<string, number>;
  /** Strict failures no test has claimed yet; the harness fails the test that left any. */
  pending: ShadowRecord[];
  /** Set by the test harness, which writes the counts itself (per test file). */
  harness?: boolean;
}

const REGISTRY_KEY = Symbol.for('mcp-debugger.state-shadow');

function registry(): ShadowRegistry {
  const holder = globalThis as unknown as Record<symbol, Partial<ShadowRegistry> | undefined>;
  const existing = (holder[REGISTRY_KEY] ??= {});
  existing.counts ??= new Map();
  existing.pending ??= [];
  return existing as ShadowRegistry;
}

/** The process-wide counts, keyed `outcome|site|event|from|actual`. */
export function shadowCounts(): ReadonlyMap<string, number> {
  return registry().counts;
}

/** Drain the strict failures queued so far (a test that provokes one on purpose claims it). */
export function takeStrictFailures(): ShadowRecord[] {
  return registry().pending.splice(0);
}

function describe(record: ShadowRecord): string {
  const from = record.publicFrom !== undefined ? `${record.from} (public ${record.publicFrom})` : record.from;
  const to = record.note ? `${record.to ?? '?'} (note; public stays ${record.actual})` : record.actual;
  return `${record.outcome}: session ${record.sessionId} run ${record.runId} ${from} --${record.event}--> ${to} at ${record.site}` +
    (record.why ? `: ${record.why}` : '');
}

/** The narrow view the operation collaborators get (OperationsContext.stateShadow). */
export interface StateShadowPort {
  /** Where today's code writes no state but the table has a row; `direct` when it assigned the state itself. */
  note(session: ShadowSession, write: StateWrite, direct?: { from: SessionState }): void;
  /** Before a launch or attach tears the previous run down: a replacement when a live run or a child exists. */
  noteReplacement(session: ShadowSession, site: Extract<GateSite, 'launch.replace' | 'attach.replace'>): void;
  /** Taken just before a resume request goes out, handed to its refusal. */
  token(session: ShadowSession): ResumeToken | undefined;
  /** After a write of the derived lifecycle field: does it say what the state implies? */
  lifecycle(session: ShadowSession, written: SessionLifecycleState, site: string): void;
}

export interface StateShadowOptions {
  /** Late bound: the core assigns its logger after its fields. */
  logger: () => ILogger | undefined;
  /** The root of a session's tree, whose run a child shares. */
  rootOf?: (session: ShadowSession) => ShadowSession;
  /** How many descendants (live or retained rows) a session has. */
  descendantsOf?: (session: ShadowSession) => number;
  /** How many mismatches the ring keeps (default 64). */
  ringSize?: number;
}

const LIVE: ReadonlySet<Phase | undefined> = new Set<Phase | undefined>(['starting', 'running', 'paused']);

export class StateShadow implements StateShadowPort {
  private readonly perSession = new WeakMap<ShadowSession, SessionShadowState>();
  private readonly ring: ShadowRecord[] = [];
  private readonly ringSize: number;
  private readonly outcomeCounts = new Map<ShadowOutcome, number>();
  private readonly keyCounts = new Map<string, number>();

  /**
   * The table checks and the lifecycle mapping. Fields, so that a test can
   * replace them to prove that a shadow which throws changes nothing.
   */
  protected evaluate: (from: Phase, event: Parameters<typeof evaluateTransition>[1], actual: Phase, context: GuardContext) => TableVerdict =
    evaluateTransition;
  protected evaluateNote: (from: Phase, event: Parameters<typeof evaluateVirtual>[1], context: GuardContext) => TableVerdict =
    evaluateVirtual;
  protected impliedLifecycle: (state: SessionState) => SessionLifecycleState = (state) => mapLegacyState(state).lifecycle;

  constructor(private readonly options: StateShadowOptions) {
    this.ringSize = options.ringSize ?? 64;
  }

  /**
   * One gate call, after the gate did its work: `from` is the state it found,
   * `actual` the state it wrote (the same on a same-state call).
   */
  check(session: ShadowSession, from: SessionState, actual: SessionState, write: StateWrite | TestSetupWrite | undefined): void {
    const mode = shadowMode();
    if (mode === 'off') return;
    let record: ShadowRecord;
    try {
      record = this.judgeWrite(session, from, actual, write);
    } catch (error) {
      this.internalError(session, write, error, mode);
      return;
    }
    this.emit(record, mode);
  }

  note(session: ShadowSession, write: StateWrite, direct?: { from: SessionState }): void {
    const mode = shadowMode();
    if (mode === 'off') return;
    let record: ShadowRecord;
    try {
      record = direct
        ? this.judgeWrite(session, direct.from, session.state, write, true)
        : this.judgeNote(session, write);
    } catch (error) {
      this.internalError(session, write, error, mode);
      return;
    }
    this.emit(record, mode);
  }

  noteReplacement(session: ShadowSession, site: Extract<GateSite, 'launch.replace' | 'attach.replace'>): void {
    if (shadowMode() === 'off') return;
    let replaces: boolean;
    try {
      replaces = LIVE.has(phaseOf(session.state)) || (this.options.descendantsOf?.(session) ?? 0) > 0;
    } catch (error) {
      this.internalError(session, { site, event: 'replace' }, error, shadowMode());
      return;
    }
    // A session with no live run and no child replaces nothing: its start
    // begins from the phase it is in.
    if (replaces) {
      this.note(session, { site, event: 'replace' });
    }
  }

  token(session: ShadowSession): ResumeToken | undefined {
    try {
      return { runId: this.runIdOf(session), continued: this.stateOf(session).continued, fromStop: session.lastStop };
    } catch {
      return undefined;
    }
  }

  lifecycle(session: ShadowSession, written: SessionLifecycleState, site: string): void {
    const mode = shadowMode();
    if (mode === 'off') return;
    let record: ShadowRecord;
    try {
      const state = this.stateOf(session);
      const basis = state.lastWritten ?? session.state;
      const implied = this.impliedLifecycle(basis);
      record = {
        outcome: written === implied ? 'lifecycle-agrees' : 'lifecycle-disagrees',
        sessionId: session.id,
        runId: this.runIdOf(session),
        event: 'lifecycle',
        actual: phaseOf(basis),
        site,
        ...(written === implied ? {} : { why: `wrote lifecycle ${written}; state ${basis} implies ${implied}` })
      };
    } catch (error) {
      this.internalError(session, { site, event: 'lifecycle' }, error, mode);
      return;
    }
    this.emit(record, mode);
  }

  /** Counts per outcome, for a test. */
  counts(): Readonly<Partial<Record<ShadowOutcome, number>>> {
    return Object.fromEntries(this.outcomeCounts);
  }

  /** Counts keyed `outcome|site|event|from|actual`, for a test. */
  countsByKey(): ReadonlyMap<string, number> {
    return this.keyCounts;
  }

  /** The mismatches kept, oldest first (bounded). */
  mismatches(): readonly ShadowRecord[] {
    return [...this.ring];
  }

  /** The run a session's verdicts are recorded under (its root's). */
  runOf(session: ShadowSession): number {
    return this.runIdOf(session);
  }

  // ----- judging -----

  private judgeWrite(
    session: ShadowSession,
    from: SessionState,
    actual: SessionState,
    write: StateWrite | TestSetupWrite | undefined,
    direct = false
  ): ShadowRecord {
    const state = this.stateOf(session);
    const actualPhase = phaseOf(actual);
    const publicFrom = phaseOf(from);
    if (isTestSetupWrite(write)) {
      state.lastWritten = actual;
      state.machine = undefined;
      return { outcome: 'test-setup', sessionId: session.id, runId: this.runIdOf(session), from: publicFrom, event: write.event, actual: actualPhase, site: write.site };
    }
    const invalid = this.invalidWrite(session, write);
    if (invalid) {
      state.lastWritten = actual;
      return { ...invalid, from: publicFrom, actual: actualPhase };
    }
    const named = write as StateWrite;
    if (named.event === 'start') {
      this.beginRun(session, state);
    }
    const runId = this.runIdOf(session);
    const judgedFrom = state.machine ?? publicFrom;
    let verdict: TableVerdict;
    if (judgedFrom === undefined || actualPhase === undefined) {
      verdict = { verdict: 'no-row', why: `a state outside the enum (${String(from)} -> ${String(actual)})` };
    } else {
      verdict = this.evaluate(judgedFrom, named.event, actualPhase, this.contextFor(session, state, named, runId));
    }
    this.advance(session, state, named.event, actual);
    return {
      outcome: verdict.verdict,
      sessionId: session.id,
      runId,
      from: judgedFrom,
      ...(judgedFrom !== publicFrom ? { publicFrom } : {}),
      event: named.event,
      actual: actualPhase,
      site: named.site,
      ...(direct ? { note: true as const, to: actualPhase } : {}),
      ...(verdict.row?.guard ? { guard: verdict.row.guard } : {}),
      ...(verdict.why ? { why: verdict.why } : {})
    };
  }

  private judgeNote(session: ShadowSession, write: StateWrite): ShadowRecord {
    const state = this.stateOf(session);
    const publicFrom = phaseOf(session.state);
    const invalid = this.invalidWrite(session, write);
    if (invalid) {
      return { ...invalid, from: publicFrom, actual: publicFrom, note: true };
    }
    const runId = this.runIdOf(session);
    const judgedFrom = state.machine ?? publicFrom;
    const verdict: TableVerdict = judgedFrom === undefined
      ? { verdict: 'no-row', why: `a state outside the enum (${String(session.state)})` }
      : this.evaluateNote(judgedFrom, write.event, this.contextFor(session, state, write, runId));
    if (write.event === 'continued') {
      state.continued += 1;
    }
    // A transition the public state does not follow: the next gate call is
    // judged from where the table took the session.
    if (verdict.to !== undefined && verdict.to !== publicFrom && (verdict.verdict === 'legal' || verdict.verdict === 'legacy')) {
      state.machine = verdict.to;
    }
    return {
      outcome: verdict.verdict,
      sessionId: session.id,
      runId,
      from: judgedFrom,
      ...(judgedFrom !== publicFrom ? { publicFrom } : {}),
      event: write.event,
      actual: publicFrom,
      ...(verdict.to !== undefined ? { to: verdict.to } : {}),
      site: write.site,
      note: true,
      ...(verdict.row?.guard ? { guard: verdict.row.guard } : {}),
      ...(verdict.why ? { why: verdict.why } : {})
    };
  }

  /** A call that names no event, or an event its site does not name: no-row, never skipped. */
  private invalidWrite(session: ShadowSession, write: unknown): Omit<ShadowRecord, 'from' | 'actual'> | undefined {
    const site = (write as { site?: unknown } | undefined)?.site;
    const event = (write as { event?: unknown } | undefined)?.event;
    if (typeof site !== 'string' || typeof event !== 'string') {
      return {
        outcome: 'no-row',
        sessionId: session.id,
        runId: this.runIdOf(session),
        event: typeof event === 'string' ? event : 'unknown',
        site: typeof site === 'string' ? site : 'unknown',
        why: 'a state write that names no site or event'
      };
    }
    if (!siteNames(site, event)) {
      return {
        outcome: 'no-row',
        sessionId: session.id,
        runId: this.runIdOf(session),
        event,
        site,
        why: `site '${site}' does not name event '${event}'`
      };
    }
    return undefined;
  }

  private contextFor(session: ShadowSession, state: SessionShadowState, write: StateWrite, runId: number): GuardContext {
    const needsTree = write.event === 'start' || write.event === 'replace';
    return {
      ...(write.facts ?? {}),
      stop: session.lastStop,
      lastShownStop: state.lastShownStop,
      runNow: runId,
      continuedNow: state.continued,
      ...(needsTree ? { descendants: this.options.descendantsOf?.(session) } : {})
    };
  }

  /** The bookkeeping a gate write leaves behind. */
  private advance(session: ShadowSession, state: SessionShadowState, event: string, actual: SessionState): void {
    state.machine = undefined;
    state.lastWritten = actual;
    if (event === 'stop-shown') {
      state.lastShownStop = session.lastStop;
    } else if (event === 'continued') {
      state.continued += 1;
    }
  }

  private beginRun(session: ShadowSession, state: SessionShadowState): void {
    const root = this.rootOf(session);
    const rootState = root === session ? state : this.stateOf(root);
    rootState.runId += 1;
    state.lastShownStop = undefined;
  }

  private stateOf(session: ShadowSession): SessionShadowState {
    let state = this.perSession.get(session);
    if (!state) {
      state = { runId: 0, continued: 0 };
      this.perSession.set(session, state);
    }
    return state;
  }

  private rootOf(session: ShadowSession): ShadowSession {
    return session.parentSessionId && this.options.rootOf ? this.options.rootOf(session) : session;
  }

  private runIdOf(session: ShadowSession): number {
    return this.stateOf(this.rootOf(session)).runId;
  }

  // ----- recording -----

  private internalError(session: ShadowSession, write: unknown, error: unknown, mode: ShadowMode): void {
    let record: ShadowRecord;
    try {
      record = {
        outcome: 'internal-error',
        sessionId: session?.id ?? 'unknown',
        runId: -1,
        event: String((write as { event?: unknown } | undefined)?.event ?? 'unknown'),
        site: String((write as { site?: unknown } | undefined)?.site ?? 'unknown'),
        why: error instanceof Error ? error.message : String(error)
      };
    } catch {
      return;
    }
    // Never thrown: a fault in the shadow is the shadow's. Strict mode
    // queues it so the harness still fails the test.
    this.emit(record, mode, false);
  }

  private emit(record: ShadowRecord, mode: ShadowMode, mayThrow = true): void {
    try {
      this.outcomeCounts.set(record.outcome, (this.outcomeCounts.get(record.outcome) ?? 0) + 1);
      const key = `${record.outcome}|${record.site}|${record.event}|${record.from ?? '-'}|${record.note ? `${record.to ?? '-'}(note)` : record.actual ?? '-'}`;
      this.keyCounts.set(key, (this.keyCounts.get(key) ?? 0) + 1);
      const shared = registry();
      shared.counts.set(key, (shared.counts.get(key) ?? 0) + 1);
      if (MISMATCHES.has(record.outcome)) {
        this.ring.push(record);
        if (this.ring.length > this.ringSize) this.ring.shift();
        this.options.logger()?.warn(`[state-shadow] ${describe(record)}`);
      } else if (record.outcome === 'legacy') {
        this.options.logger()?.debug?.(`[state-shadow] ${describe(record)}`);
      }
      const dir = process.env[STATE_SHADOW_LOG_ENV];
      if (dir && !shared.harness) {
        writeLine(dir, record);
      }
      if (mode === 'strict' && (STRICT_FAILURES.has(record.outcome) || record.outcome === 'internal-error')) {
        shared.pending.push(record);
      }
    } catch {
      // Recording is best effort; it must never reach the gate's caller.
    }
    if (mayThrow && mode === 'strict' && STRICT_FAILURES.has(record.outcome)) {
      throw new StateShadowError(record);
    }
  }
}

let logDirReady: string | undefined;

function writeLine(dir: string, record: ShadowRecord): void {
  try {
    if (logDirReady !== dir) {
      mkdirSync(dir, { recursive: true });
      logDirReady = dir;
    }
    appendFileSync(path.join(dir, `state-shadow-${process.pid}.ndjson`), JSON.stringify(record) + '\n');
  } catch {
    // diagnostics only
  }
}
