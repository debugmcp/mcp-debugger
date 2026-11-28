/**
 * The shadow check of the session transition table (transition-table.ts).
 *
 * The gate `SessionManagerCore._updateSessionState` calls `begin` just before
 * it writes, which takes the facts the table's guards read, and `check` after
 * it has done all of its own work, with the state it found, the state it wrote
 * and the site's `StateWrite`. Facts are taken at the write because the gate's
 * own state listeners run inside it and may change the session; the verdict
 * is about the write, not about what a listener did next. Where today's code
 * writes no state but the table has a row (a hot restart from a running
 * program, a `continued` that arrives while paused, a run being replaced, the
 * worker's exit after the ending, and the one direct assignment in the
 * execution controller), the site calls `note`. The shadow records a verdict
 * for each and refuses nothing: it never throws outside strict mode, and it
 * never changes what the gate does or the order in which it does it.
 *
 * Modes, from `MCP_STATE_SHADOW` (read on every call):
 * - `record` (the default): verdicts are counted; each mismatch is one `warn`
 *   line and is kept in a bounded ring.
 * - `strict` (the unit test project): as `record`, and a `no-row` verdict or
 *   a lifecycle write that disagrees with the state also throws. When the
 *   test harness (tests/vitest.setup.ts) has registered itself in the
 *   process, the failure is also queued for it, before anything else is
 *   done with it, and the harness fails the test even when the code under
 *   test swallowed the throw. Nothing else ever throws: the other verdicts
 *   describe today's behaviour.
 * - `off`: nothing is checked.
 *
 * Strict mode is per process. The queue lives in the process that made the
 * write, and only a harness in that process drains it: a child process (a
 * server a test spawns, a nested test runner) that swallows a strict throw
 * is not seen by its parent's harness. Outside a harness nothing is queued.
 *
 * `MCP_STATE_SHADOW_LOG=<directory>` also writes the verdicts out: one
 * ndjson line per verdict to `state-shadow-<pid>.ndjson` in a process with no
 * harness (a server), and one count file per test file under the harness.
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
  /** The id of the table row the verdict rests on, when one does. */
  readonly row?: string;
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
  /** Writes begun on this session; the newest whose bookkeeping was applied; the newest stop-shown applied. */
  seq: number;
  applied: number;
  shownSeq: number;
}

/**
 * The facts of one write, taken by `begin` before the gate writes and runs its
 * listeners. A write a listener makes inside it is a newer write: its
 * bookkeeping is kept when the outer write is judged.
 */
export interface WriteBoundary {
  readonly seq: number;
  readonly stop: StopIdentity | undefined;
  readonly atStop: boolean;
  readonly lastShownStop: StopIdentity | undefined;
  readonly continued: number;
  readonly runId: number;
  readonly machine: Phase | undefined;
  readonly descendants: number | undefined;
}

/** What a replacement's guard needs, taken before the teardown closes the children. */
export interface ReplacementFacts {
  readonly descendants: number;
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
  /** Row ids matched, for row coverage. */
  rows: Map<string, number>;
  /** Strict failures no test has claimed yet; the harness fails the test that left any. */
  pending: ShadowRecord[];
  /** Set by the test harness, which drains `pending` and writes the counts itself (per test file). */
  harness?: boolean;
}

const REGISTRY_KEY = Symbol.for('mcp-debugger.state-shadow');

function registry(): ShadowRegistry {
  const holder = globalThis as unknown as Record<symbol, Partial<ShadowRegistry> | undefined>;
  const existing = (holder[REGISTRY_KEY] ??= {});
  existing.counts ??= new Map();
  existing.rows ??= new Map();
  existing.pending ??= [];
  return existing as ShadowRegistry;
}

/** The process-wide counts, keyed `outcome|site|event|from|actual`. */
export function shadowCounts(): ReadonlyMap<string, number> {
  return registry().counts;
}

/** The process-wide count of matches of each table row, by row id. */
export function shadowRowHits(): ReadonlyMap<string, number> {
  return registry().rows;
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
  /** Before a launch or attach tears the previous run down: what the replacement's guard needs. */
  replacementFacts(session: ShadowSession): ReplacementFacts | undefined;
  /**
   * After the teardown, which detached the previous run's listeners: a
   * replacement when a live run or a child existed.
   */
  noteReplacement(
    session: ShadowSession,
    site: Extract<GateSite, 'launch.replace' | 'attach.replace'>,
    before: ReplacementFacts | undefined
  ): void;
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
  private readonly rowCounts = new Map<string, number>();

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
   * Just before the gate writes: the facts its guards read. A `start` begins
   * its run here, so a write its listeners make belongs to the new run.
   * Never throws; undefined when off or when the facts cannot be read.
   */
  begin(session: ShadowSession, write: StateWrite | TestSetupWrite | undefined): WriteBoundary | undefined {
    if (shadowMode() === 'off') return undefined;
    try {
      const state = this.stateOf(session);
      const event = (write as { event?: unknown } | undefined)?.event;
      if (event === 'start' && !isTestSetupWrite(write)) {
        this.beginRun(session, state);
      }
      return this.boundaryOf(session, state, session.state, event === 'start' || event === 'replace');
    } catch {
      return undefined;
    }
  }

  /**
   * One gate call, after the gate did its work: `from` is the state it found,
   * `actual` the state it wrote (the same on a same-state call), `boundary`
   * what `begin` took.
   */
  check(
    session: ShadowSession,
    from: SessionState,
    actual: SessionState,
    write: StateWrite | TestSetupWrite | undefined,
    boundary?: WriteBoundary
  ): void {
    const mode = shadowMode();
    if (mode === 'off') return;
    let record: ShadowRecord;
    try {
      record = this.judgeWrite(session, from, actual, write, boundary);
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
        ? this.judgeWrite(session, direct.from, session.state, write, undefined, true)
        : this.judgeNote(session, write);
    } catch (error) {
      this.internalError(session, write, error, mode);
      return;
    }
    this.emit(record, mode);
  }

  replacementFacts(session: ShadowSession): ReplacementFacts | undefined {
    if (shadowMode() === 'off') return undefined;
    try {
      return { descendants: this.options.descendantsOf?.(session) ?? 0 };
    } catch {
      return undefined;
    }
  }

  noteReplacement(
    session: ShadowSession,
    site: Extract<GateSite, 'launch.replace' | 'attach.replace'>,
    before: ReplacementFacts | undefined
  ): void {
    const mode = shadowMode();
    if (mode === 'off') return;
    let record: ShadowRecord | undefined;
    try {
      // A session with no live run and no child replaces nothing: its start
      // begins from the phase it is in. The children were counted before the
      // teardown closed them.
      const descendants = before?.descendants ?? this.options.descendantsOf?.(session) ?? 0;
      if (LIVE.has(phaseOf(session.state)) || descendants > 0) {
        record = this.judgeNote(session, { site, event: 'replace' }, { descendants });
      }
    } catch (error) {
      this.internalError(session, { site, event: 'replace' }, error, mode);
      return;
    }
    if (record) this.emit(record, mode);
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

  /** Matches of each table row, by row id, for a test. */
  rowHits(): ReadonlyMap<string, number> {
    return this.rowCounts;
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

  private boundaryOf(session: ShadowSession, state: SessionShadowState, from: SessionState, needsTree: boolean): WriteBoundary {
    state.seq += 1;
    return {
      seq: state.seq,
      stop: session.lastStop,
      atStop: from === SessionState.PAUSED && session.lastStop !== undefined,
      lastShownStop: state.lastShownStop,
      continued: state.continued,
      runId: this.runIdOf(session),
      machine: state.machine,
      descendants: needsTree ? this.options.descendantsOf?.(session) : undefined
    };
  }

  private judgeWrite(
    session: ShadowSession,
    from: SessionState,
    actual: SessionState,
    write: StateWrite | TestSetupWrite | undefined,
    taken: WriteBoundary | undefined,
    direct = false
  ): ShadowRecord {
    const state = this.stateOf(session);
    const actualPhase = phaseOf(actual);
    const publicFrom = phaseOf(from);
    const event = (write as { event?: unknown } | undefined)?.event;
    // A write the gate made without `begin` (a direct assignment, or a
    // caller of `check` alone): its facts are the ones there now.
    if (!taken && event === 'start' && !isTestSetupWrite(write)) {
      this.beginRun(session, state);
    }
    const boundary = taken ?? this.boundaryOf(session, state, from, event === 'start' || event === 'replace');
    if (isTestSetupWrite(write)) {
      this.advance(state, boundary, 'test-setup', actual);
      return { outcome: 'test-setup', sessionId: session.id, runId: boundary.runId, from: publicFrom, event: write.event, actual: actualPhase, site: write.site };
    }
    const invalid = this.invalidWrite(session, write, boundary.runId);
    if (invalid) {
      this.advance(state, boundary, 'invalid', actual);
      return { ...invalid, from: publicFrom, actual: actualPhase };
    }
    const named = write as StateWrite;
    const judgedFrom = boundary.machine ?? publicFrom;
    let verdict: TableVerdict;
    if (judgedFrom === undefined || actualPhase === undefined) {
      verdict = { verdict: 'no-row', why: `a state outside the enum (${String(from)} -> ${String(actual)})` };
    } else {
      verdict = this.evaluate(judgedFrom, named.event, actualPhase, this.contextFor(named, boundary));
    }
    this.advance(state, boundary, named.event, actual);
    return {
      outcome: verdict.verdict,
      sessionId: session.id,
      runId: boundary.runId,
      from: judgedFrom,
      ...(judgedFrom !== publicFrom ? { publicFrom } : {}),
      event: named.event,
      actual: actualPhase,
      site: named.site,
      ...(verdict.row ? { row: verdict.row.id } : {}),
      ...(direct ? { note: true as const, to: actualPhase } : {}),
      ...(verdict.row?.guard ? { guard: verdict.row.guard } : {}),
      ...(verdict.why ? { why: verdict.why } : {})
    };
  }

  private judgeNote(session: ShadowSession, write: StateWrite, override?: { descendants: number }): ShadowRecord {
    const state = this.stateOf(session);
    const publicFrom = phaseOf(session.state);
    const boundary = this.boundaryOf(session, state, session.state, false);
    const invalid = this.invalidWrite(session, write, boundary.runId);
    if (invalid) {
      return { ...invalid, from: publicFrom, actual: publicFrom, note: true };
    }
    const judgedFrom = boundary.machine ?? publicFrom;
    const context = { ...this.contextFor(write, boundary), ...(override ?? {}) };
    const verdict: TableVerdict = judgedFrom === undefined
      ? { verdict: 'no-row', why: `a state outside the enum (${String(session.state)})` }
      : this.evaluateNote(judgedFrom, write.event, context);
    if (write.event === 'continued') {
      state.continued += 1;
    }
    // A transition the public state does not follow: the next gate call is
    // judged from where the table took the session.
    if (verdict.to !== undefined && verdict.to !== publicFrom && (verdict.verdict === 'legal' || verdict.verdict === 'legacy')) {
      state.machine = verdict.to;
      state.applied = boundary.seq;
    }
    return {
      outcome: verdict.verdict,
      sessionId: session.id,
      runId: boundary.runId,
      from: judgedFrom,
      ...(judgedFrom !== publicFrom ? { publicFrom } : {}),
      event: write.event,
      actual: publicFrom,
      ...(verdict.to !== undefined ? { to: verdict.to } : {}),
      site: write.site,
      ...(verdict.row ? { row: verdict.row.id } : {}),
      note: true,
      ...(verdict.row?.guard ? { guard: verdict.row.guard } : {}),
      ...(verdict.why ? { why: verdict.why } : {})
    };
  }

  /** A call that names no event, or an event its site does not name: no-row, never skipped. */
  private invalidWrite(session: ShadowSession, write: unknown, runId: number): Omit<ShadowRecord, 'from' | 'actual'> | undefined {
    const site = (write as { site?: unknown } | undefined)?.site;
    const event = (write as { event?: unknown } | undefined)?.event;
    if (typeof site !== 'string' || typeof event !== 'string') {
      return {
        outcome: 'no-row',
        sessionId: session.id,
        runId,
        event: typeof event === 'string' ? event : 'unknown',
        site: typeof site === 'string' ? site : 'unknown',
        why: 'a state write that names no site or event'
      };
    }
    if (!siteNames(site, event)) {
      return {
        outcome: 'no-row',
        sessionId: session.id,
        runId,
        event,
        site,
        why: `site '${site}' does not name event '${event}'`
      };
    }
    return undefined;
  }

  private contextFor(write: StateWrite, boundary: WriteBoundary): GuardContext {
    return {
      ...(write.facts ?? {}),
      stop: boundary.stop,
      atStop: boundary.atStop,
      lastShownStop: boundary.lastShownStop,
      runNow: boundary.runId,
      continuedNow: boundary.continued,
      ...(boundary.descendants !== undefined ? { descendants: boundary.descendants } : {})
    };
  }

  /**
   * The bookkeeping a gate write leaves behind. Counted events always count;
   * a shown stop is kept unless a newer one was; the rest ("what the session
   * is now") only when no newer write, made by a listener inside this one,
   * has applied its own.
   */
  private advance(state: SessionShadowState, boundary: WriteBoundary, event: string, actual: SessionState): void {
    if (event === 'continued') {
      state.continued += 1;
    }
    if (event === 'stop-shown' && boundary.seq > state.shownSeq) {
      state.shownSeq = boundary.seq;
      state.lastShownStop = boundary.stop;
    }
    if (state.applied > boundary.seq) {
      return;
    }
    state.applied = boundary.seq;
    state.machine = undefined;
    state.lastWritten = actual;
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
      state = { runId: 0, continued: 0, seq: 0, applied: 0, shownSeq: 0 };
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

  /**
   * Record a verdict. A strict failure is queued for the harness first, so
   * that nothing after it (a logger that throws, a file that cannot be
   * written) can lose it; counting, logging and the file sink are each best
   * effort after that. In strict mode a `no-row` or a lifecycle disagreement
   * then throws.
   */
  private emit(record: ShadowRecord, mode: ShadowMode, mayThrow = true): void {
    if (mode === 'strict' && (STRICT_FAILURES.has(record.outcome) || record.outcome === 'internal-error')) {
      try {
        const shared = registry();
        if (shared.harness === true) {
          shared.pending.push(record);
        }
      } catch {
        // nothing more can be done for it here
      }
    }
    try {
      this.outcomeCounts.set(record.outcome, (this.outcomeCounts.get(record.outcome) ?? 0) + 1);
      const key = `${record.outcome}|${record.site}|${record.event}|${record.from ?? '-'}|${record.note ? `${record.to ?? '-'}(note)` : record.actual ?? '-'}`;
      this.keyCounts.set(key, (this.keyCounts.get(key) ?? 0) + 1);
      const shared = registry();
      shared.counts.set(key, (shared.counts.get(key) ?? 0) + 1);
      // A row is matched when it vouched for the write: not when its guard
      // failed or could not be evaluated.
      if (record.row !== undefined && (record.outcome === 'legal' || record.outcome === 'legacy')) {
        this.rowCounts.set(record.row, (this.rowCounts.get(record.row) ?? 0) + 1);
        shared.rows.set(record.row, (shared.rows.get(record.row) ?? 0) + 1);
      }
      if (MISMATCHES.has(record.outcome)) {
        this.ring.push(record);
        if (this.ring.length > this.ringSize) this.ring.shift();
      }
    } catch {
      // counting is best effort
    }
    try {
      if (MISMATCHES.has(record.outcome)) {
        this.options.logger()?.warn(`[state-shadow] ${describe(record)}`);
      } else if (record.outcome === 'legacy') {
        this.options.logger()?.debug?.(`[state-shadow] ${describe(record)}`);
      }
    } catch {
      // logging is best effort
    }
    try {
      const dir = process.env[STATE_SHADOW_LOG_ENV];
      if (dir && registry().harness !== true) {
        writeLine(dir, record);
      }
    } catch {
      // the file sink is best effort
    }
    if (mayThrow && mode === 'strict' && STRICT_FAILURES.has(record.outcome)) {
      throw new StateShadowError(record);
    }
  }
}

let logDirReady: string | undefined;

function writeLine(dir: string, record: ShadowRecord): void {
  if (logDirReady !== dir) {
    mkdirSync(dir, { recursive: true });
    logDirReady = dir;
  }
  appendFileSync(path.join(dir, `state-shadow-${process.pid}.ndjson`), JSON.stringify(record) + '\n');
}
