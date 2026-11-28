/**
 * The session's transition table, as data.
 *
 * A session's public state is written in one place, the gate
 * `SessionManagerCore._updateSessionState`, and every call to it names the
 * event that makes it and the site it is made from. This table says, for each
 * event, which phases it may move a session from and to. In this stage the
 * table only observes: `StateShadow` (shadow.ts) checks every gate call
 * against it, beside the gate, and records its verdict. The gate itself
 * writes exactly what it wrote before, in the same order.
 *
 * Phases are the public `SessionState` values one to one, except that
 * `READY` (in the enum, never written) reads as `starting`.
 *
 * A row marked `legacy` describes what today's code does and a later stage
 * removes; until then it is accepted and counted apart. A legacy row is kept
 * only for a transition a site writes by its own condition from a phase it
 * reaches in ordinary operation. A phase a site reaches only after another
 * defect (a step failure that leaves the proxy's handlers attached, a request
 * that outlives a relaunch) has no row: it is reported, not accepted. A row with a `guard`
 * goes to `to` when the guard holds and to `otherwise` when it fails (no
 * `otherwise`: the row does not apply then). Guards are evaluated from the
 * facts the shadow is given (see `GuardContext`); a guard whose facts are
 * missing is reported as not evaluated, never as met.
 */
import { SessionState } from '@debugmcp/shared';

export type Phase = 'created' | 'starting' | 'running' | 'paused' | 'ended' | 'failed';

export const PHASES: readonly Phase[] = ['created', 'starting', 'running', 'paused', 'ended', 'failed'];

const LIVE: readonly Phase[] = ['starting', 'running', 'paused'];

/** Public state to phase. READY is never written and reads as starting. */
export const PHASE_OF_STATE: Readonly<Record<SessionState, Phase>> = {
  [SessionState.CREATED]: 'created',
  [SessionState.INITIALIZING]: 'starting',
  [SessionState.READY]: 'starting',
  [SessionState.RUNNING]: 'running',
  [SessionState.PAUSED]: 'paused',
  [SessionState.STOPPED]: 'ended',
  [SessionState.ERROR]: 'failed'
};

/** The phase of a public state, or undefined for a value outside the enum. */
export function phaseOf(state: SessionState | string | undefined): Phase | undefined {
  return state === undefined ? undefined : (PHASE_OF_STATE as Record<string, Phase | undefined>)[state];
}

export const SESSION_EVENTS = [
  'start',
  'replace',
  'start-refused',
  'start-failed',
  'adapter-configured',
  'attach-verified',
  'stop-shown',
  'stop-hidden',
  'resume-unseen',
  'resume-unseen-failed',
  'resume',
  'hot-restart',
  'resume-refused',
  'resume-failed',
  'continued',
  'terminated',
  'exited',
  'worker-exit',
  'error',
  'adopt',
  'release',
  'close',
  'stale'
] as const;

export type SessionEvent = (typeof SESSION_EVENTS)[number];

/** The later stages a legacy row waits for. */
export type Stage = 'hidden-stop' | 'S2a' | 'S3';

export type GuardName =
  | 'no-retained-child'
  | 'retained-child'
  | 'entry-stop-off-and-no-stop'
  | 'no-stop-recorded'
  | 'refused-before-resume'
  | 'newer-stop-shown'
  | 'shown-stop-kept'
  | 'clean-exit';

export interface TransitionRow {
  readonly event: SessionEvent;
  /**
   * A request's transition decides whether its command goes out (once rows
   * are enforced); an observation is never refused, only recorded.
   */
  readonly kind: 'request' | 'observation';
  readonly from: readonly Phase[];
  /** The destination: a phase, or `same`. With a guard, where it goes when the guard holds. */
  readonly to: Phase | 'same';
  readonly guard?: GuardName;
  /** With a guard: where it goes when the guard fails. Absent: the row does not apply then. */
  readonly otherwise?: Phase | 'same';
  /** Today's behaviour, kept until the named stage removes it. */
  readonly legacy?: Stage;
  readonly note?: string;
}

export const TRANSITIONS: readonly TransitionRow[] = [
  { event: 'start', kind: 'request', from: ['created'], to: 'starting', note: 'a new run' },
  { event: 'start', kind: 'request', from: ['ended', 'failed'], to: 'starting', guard: 'no-retained-child', note: 'a new run; a run with children is replaced first' },
  { event: 'replace', kind: 'request', from: LIVE, to: 'ended', note: 'the old run ends before the new one starts; today no state is written for it' },
  { event: 'replace', kind: 'request', from: ['ended', 'failed'], to: 'same', guard: 'retained-child', note: 'the old run already ended; its retained children are closed' },
  { event: 'start-refused', kind: 'request', from: ['starting'], to: 'created', note: 'an incompatible toolchain: back to created, also on a replacement attempt' },
  { event: 'start-failed', kind: 'observation', from: LIVE, to: 'failed', note: 'a launch or attach failing, also after it projected running' },
  { event: 'start-failed', kind: 'observation', from: ['failed'], to: 'same', note: 'a launch or attach fails after the session already failed: its catch writes ERROR over ERROR' },
  { event: 'start-failed', kind: 'observation', from: ['ended'], to: 'failed', legacy: 'S3', note: 'the launch catch rewrites an ending the program reached during the launch' },
  { event: 'adapter-configured', kind: 'observation', from: ['starting'], to: 'running', guard: 'entry-stop-off-and-no-stop', otherwise: 'same' },
  { event: 'adapter-configured', kind: 'observation', from: ['running', 'paused'], to: 'same' },
  { event: 'attach-verified', kind: 'request', from: ['starting', 'running'], to: 'running', guard: 'no-stop-recorded', otherwise: 'same' },
  { event: 'stop-shown', kind: 'observation', from: LIVE, to: 'paused', note: 'from paused, a new stop supersedes the shown one' },
  { event: 'stop-hidden', kind: 'observation', from: ['starting', 'running'], to: 'paused', legacy: 'hidden-stop', note: 'the transient pause of a stop the core resumes unseen' },
  { event: 'stop-hidden', kind: 'observation', from: ['starting', 'running'], to: 'same' },
  { event: 'stop-hidden', kind: 'observation', from: ['paused'], to: 'same', guard: 'shown-stop-kept', note: 'it never replaces the shown stop' },
  { event: 'stop-hidden', kind: 'observation', from: ['paused'], to: 'same', legacy: 'hidden-stop', note: 'the hidden stop is written over the shown stop\'s record' },
  { event: 'resume-unseen', kind: 'request', from: ['paused'], to: 'running', legacy: 'hidden-stop', note: 'the resume out of the transient pause' },
  { event: 'resume-unseen', kind: 'request', from: ['starting', 'running'], to: 'same' },
  { event: 'resume-unseen-failed', kind: 'observation', from: ['starting', 'running'], to: 'paused', note: 'the hidden stop becomes the stop the session is at' },
  { event: 'resume-unseen-failed', kind: 'observation', from: ['paused'], to: 'same', note: 'a newer stop arrived while the resume was pending; it is kept' },
  { event: 'resume', kind: 'request', from: ['paused'], to: 'running', note: 'step, continue' },
  { event: 'hot-restart', kind: 'request', from: ['paused', 'running'], to: 'running', note: 'the same run goes on' },
  { event: 'resume-refused', kind: 'observation', from: ['running'], to: 'paused', guard: 'refused-before-resume', note: 'refused before the program resumed, at the stop the request started from' },
  { event: 'resume-refused', kind: 'observation', from: ['paused'], to: 'same', guard: 'newer-stop-shown', note: 'a newer stop arrived while the request was pending; it is kept' },
  { event: 'resume-failed', kind: 'observation', from: ['running'], to: 'failed' },
  { event: 'resume-failed', kind: 'observation', from: ['paused'], to: 'failed', legacy: 'S2a', note: 'a step call that threw with the session paused (a repeat before its request, or a read after its landing) fails the session' },
  { event: 'continued', kind: 'observation', from: ['starting', 'running'], to: 'running' },
  { event: 'continued', kind: 'observation', from: ['paused'], to: 'same', note: 'stale: recorded, no change' },
  { event: 'terminated', kind: 'observation', from: LIVE, to: 'ended' },
  { event: 'exited', kind: 'observation', from: LIVE, to: 'ended' },
  { event: 'worker-exit', kind: 'observation', from: LIVE, to: 'ended', guard: 'clean-exit', otherwise: 'failed' },
  { event: 'error', kind: 'observation', from: LIVE, to: 'failed' },
  { event: 'terminated', kind: 'observation', from: ['ended', 'failed'], to: 'same', note: 'evidence for the one ending' },
  { event: 'exited', kind: 'observation', from: ['ended', 'failed'], to: 'same', note: 'evidence for the one ending' },
  { event: 'worker-exit', kind: 'observation', from: ['ended', 'failed'], to: 'same', note: 'evidence for the one ending' },
  { event: 'error', kind: 'observation', from: ['ended', 'failed'], to: 'same', note: 'evidence for the one ending' },
  { event: 'adopt', kind: 'request', from: ['created'], to: 'running', note: 'a child session' },
  { event: 'release', kind: 'request', from: LIVE, to: 'ended', note: 'the detach cascade; the row is kept' },
  { event: 'release', kind: 'request', from: ['ended'], to: 'same', note: 'the adapter answered the release with terminated, which ended the session first' },
  { event: 'close', kind: 'request', from: ['created', ...LIVE, 'ended'], to: 'ended', note: 'then removed' },
  { event: 'close', kind: 'request', from: ['failed'], to: 'ended', legacy: 'S3', note: 'the close writes stopped over a failure before removing the row' },
  { event: 'close', kind: 'request', from: ['failed'], to: 'same' },
  { event: 'stale', kind: 'observation', from: PHASES, to: 'same', note: 'an older run, a closed connection or an older sequence number: kept, reported' }
];

/**
 * The stop identities the shadow compares, by reference. Opaque on purpose:
 * only identity is ever read.
 */
export type StopIdentity = object;

/** What a resume request started from, taken just before its command goes out. */
export interface ResumeToken {
  readonly runId: number;
  /** How many `continued` events the session had been seen to receive. */
  readonly continued: number;
  /** The stop the session was at. */
  readonly fromStop: StopIdentity | undefined;
}

/** What a site knows that a guard needs. */
export interface GuardFacts {
  /** `stopOnEntry` as the site reads it. */
  readonly stopOnEntry?: boolean;
  /** The resume request's token, for a refusal. */
  readonly since?: ResumeToken;
  /** The worker's exit, for the four-way rule. */
  readonly exit?: { readonly code: number | null; readonly signal?: string; readonly expected?: boolean };
}

/** Everything a guard can be evaluated from. A missing fact leaves its guard unevaluated. */
export interface GuardContext extends GuardFacts {
  /** The session's descendants (live or retained rows). */
  readonly descendants?: number;
  /** The stop the session records now. */
  readonly stop?: StopIdentity;
  /** The stop the session last showed in this run; undefined when none was seen. */
  readonly lastShownStop?: StopIdentity;
  readonly runNow?: number;
  /** How many `continued` events the session has been seen to receive. */
  readonly continuedNow?: number;
}

/** True or false when the facts decide it; undefined when they are missing. */
export const GUARDS: Readonly<Record<GuardName, (context: GuardContext) => boolean | undefined>> = {
  'no-retained-child': (c) => (c.descendants === undefined ? undefined : c.descendants === 0),
  'retained-child': (c) => (c.descendants === undefined ? undefined : c.descendants > 0),
  'entry-stop-off-and-no-stop': (c) => (c.stopOnEntry === undefined ? undefined : !c.stopOnEntry && c.stop === undefined),
  'no-stop-recorded': (c) => c.stop === undefined,
  // Refused before the program resumed (no `continued` since the request),
  // in the same run, and still at the stop the request started from.
  'refused-before-resume': (c) => {
    if (!c.since || c.continuedNow === undefined || c.runNow === undefined) return undefined;
    return c.since.runId === c.runNow &&
      c.continuedNow === c.since.continued &&
      c.since.fromStop !== undefined &&
      c.stop === c.since.fromStop;
  },
  // The session is at a stop newer than the one the request started from.
  'newer-stop-shown': (c) => {
    if (!c.since || c.runNow === undefined) return undefined;
    return c.since.runId === c.runNow && c.stop !== undefined && c.stop !== c.since.fromStop;
  },
  'shown-stop-kept': (c) => (c.lastShownStop === undefined ? undefined : c.stop === c.lastShownStop),
  // The four-way rule of the worker's exit: an expected exit ends the
  // session; an unexpected one ends it only with code 0; a real process exit
  // ends it with code 0, or null and no signal; anything else is a failure.
  'clean-exit': (c) => {
    if (!c.exit) return undefined;
    const { code, signal, expected } = c.exit;
    if (expected === true) return true;
    if (expected === false) return code === 0;
    return code === 0 || (code === null && !signal);
  }
};

export type Verdict = 'legal' | 'legacy' | 'guard-not-met' | 'unevaluated' | 'no-row';

export interface TableVerdict {
  readonly verdict: Verdict;
  /** The row the verdict rests on, when one does. */
  readonly row?: TransitionRow;
  /** The destination the table gives (`same` resolved); for a virtual transition, where it goes. */
  readonly to?: Phase;
  readonly why?: string;
}

const resolve = (to: Phase | 'same', from: Phase): Phase => (to === 'same' ? from : to);

/** The rows for an event from a phase, in table order. */
export function rowsFor(from: Phase, event: SessionEvent): TransitionRow[] {
  return TRANSITIONS.filter((row) => row.event === event && row.from.includes(from));
}

/**
 * Does the table list `from --event--> actual`? Pure; never throws.
 *
 * - `legal`: a current row lists it, its guard (if any) held.
 * - `legacy`: only a legacy row lists it.
 * - `unevaluated`: a guarded row would list it, but the guard's facts are missing.
 * - `guard-not-met`: a guarded row lists it only when its guard is the other
 *   way: the code made the transition the guard forbids, or skipped the one
 *   it requires.
 * - `no-row`: nothing lists it (no row for the event from that phase, or the
 *   rows there go elsewhere).
 */
export function evaluateTransition(from: Phase, event: SessionEvent, actual: Phase, context: GuardContext = {}): TableVerdict {
  const candidates = rowsFor(from, event);
  if (candidates.length === 0) {
    return { verdict: 'no-row', why: `no row for ${event} from ${from}` };
  }
  let legacy: TransitionRow | undefined;
  let unevaluated: TransitionRow | undefined;
  let guardFailed: { row: TransitionRow; why: string } | undefined;
  const allowed = new Set<Phase>();
  for (const row of candidates) {
    const to = resolve(row.to, from);
    const otherwise = row.otherwise === undefined ? undefined : resolve(row.otherwise, from);
    allowed.add(to);
    if (otherwise !== undefined) allowed.add(otherwise);
    if (row.guard === undefined) {
      if (to === actual) {
        if (!row.legacy) return { verdict: 'legal', row, to };
        legacy ??= row;
      }
      continue;
    }
    const held = GUARDS[row.guard](context);
    if (held === undefined) {
      if (to === actual || otherwise === actual) unevaluated ??= row;
      continue;
    }
    const goes = held ? to : otherwise;
    if (goes === actual) {
      if (!row.legacy) return { verdict: 'legal', row, to: goes };
      legacy ??= row;
    } else if (to === actual || otherwise === actual) {
      guardFailed ??= {
        row,
        why: held
          ? `guard '${row.guard}' held, so ${event} from ${from} goes to ${goes ?? 'nowhere'}; the code wrote ${actual}`
          : `guard '${row.guard}' not met: ${event} from ${from} to ${actual} needs it`
      };
    }
  }
  if (legacy) return { verdict: 'legacy', row: legacy, to: actual, why: `legacy until ${legacy.legacy}` };
  if (unevaluated) {
    return { verdict: 'unevaluated', row: unevaluated, to: actual, why: `guard '${unevaluated.guard}' could not be evaluated: its facts are missing` };
  }
  if (guardFailed) return { verdict: 'guard-not-met', row: guardFailed.row, why: guardFailed.why };
  return { verdict: 'no-row', why: `${event} from ${from} goes to ${actual}; the rows allow ${[...allowed].join(' or ')}` };
}

/**
 * Where the table takes `from` on `event` when today's code writes nothing
 * there (a note): the first row that applies. Its verdict is the row's, by
 * the same rules as `evaluateTransition`.
 */
export function evaluateVirtual(from: Phase, event: SessionEvent, context: GuardContext = {}): TableVerdict {
  const candidates = rowsFor(from, event);
  if (candidates.length === 0) {
    return { verdict: 'no-row', why: `no row for ${event} from ${from}` };
  }
  let legacy: TableVerdict | undefined;
  let unevaluated: TableVerdict | undefined;
  let guardFailed: TableVerdict | undefined;
  for (const row of candidates) {
    const to = resolve(row.to, from);
    const otherwise = row.otherwise === undefined ? undefined : resolve(row.otherwise, from);
    const held = row.guard === undefined ? true : GUARDS[row.guard](context);
    if (held === undefined) {
      unevaluated ??= { verdict: 'unevaluated', row, why: `guard '${row.guard}' could not be evaluated: its facts are missing` };
      continue;
    }
    const goes = held ? to : otherwise;
    if (goes === undefined) {
      guardFailed ??= { verdict: 'guard-not-met', row, why: `guard '${row.guard}' not met: ${event} from ${from} has no row then` };
      continue;
    }
    if (!row.legacy) return { verdict: 'legal', row, to: goes };
    legacy ??= { verdict: 'legacy', row, to: goes, why: `legacy until ${row.legacy}` };
  }
  return legacy ?? unevaluated ?? guardFailed ?? { verdict: 'no-row', why: `no row for ${event} from ${from}` };
}

/**
 * Every place that writes a session's state, by site, with the events each
 * may name. A gate call or a note naming an event its site does not list is
 * reported as `no-row`: a site named with the wrong event would otherwise be
 * legal for the wrong reason. Two sites take two events: a continue is the
 * caller's (`resume`) or the core's own resume of a stop no caller was shown
 * (`resume-unseen`), and so is its refusal.
 *
 * Sites marked (note) make no gate call: today's code writes nothing there,
 * or (the refused step with no stop recorded) assigns the state directly.
 */
export const EVENT_OF_SITE = {
  // attach-controller.ts
  'attach.replace': ['replace'], // (note) before the previous proxy's teardown
  'attach': ['start'],
  'attach.verified': ['attach-verified'],
  'attach.failed': ['start-failed'],
  'detach': ['release'],
  // execution-controller.ts
  'step.failed': ['resume-failed'],
  'executeStep.sent': ['resume'],
  'executeStep.refused': ['resume-refused'],
  'executeStep.refused-unrecorded': ['resume-refused'], // (note) the direct assignment
  'executeStep.failed': ['resume-failed'],
  'continue.sent': ['resume', 'resume-unseen'],
  'continue.refused': ['resume-refused', 'resume-unseen-failed'],
  // debug-launcher.ts
  'launch.replace': ['replace'], // (note) before the previous proxy's teardown
  'launch': ['start'],
  'launch.refused': ['start-refused'],
  'launch.failed': ['start-failed'],
  'hotRestart.sent': ['hot-restart'], // a note from running
  'hotRestart.refused': ['resume-refused'],
  // session-manager-core.ts
  'releaseDescendants': ['release'],
  'closeSingleSession': ['close'],
  'adoptReportedChild': ['adopt'],
  'settleStop.hidden': ['stop-hidden'],
  'settleStop.shown': ['stop-shown'],
  'handleContinued': ['continued'], // a note while paused
  'handleTerminated': ['terminated'],
  'handleExited': ['exited'],
  'handleAdapterConfigured': ['adapter-configured'],
  'handleError': ['error'],
  'handleExit.expected': ['worker-exit'],
  'handleExit.unexpected': ['worker-exit'],
  'handleExit.clean': ['worker-exit'],
  'handleExit.crashed': ['worker-exit'],
  'handleExit.ended': ['worker-exit'] // (note) evidence after the ending
} as const satisfies Record<string, readonly SessionEvent[]>;

export type GateSite = keyof typeof EVENT_OF_SITE;

/**
 * What a gate call or a note names: its site, an event that site may name,
 * and the facts its guards need. The pairing is checked by the compiler.
 */
export type StateWrite = {
  [S in GateSite]: { readonly site: S; readonly event: (typeof EVENT_OF_SITE)[S][number]; readonly facts?: GuardFacts };
}[GateSite];

/**
 * The one mark a test may pass when it calls the gate itself to set up a
 * state: recorded as `test-setup`, never checked against the table. Every
 * file that uses it is listed in tests/unit/session/machine/shadow-sites.test.ts,
 * which also fails if any file under src/ uses it.
 */
export const TEST_SETUP_WRITE = { site: 'test-setup', event: 'test-setup' } as const;

export type TestSetupWrite = typeof TEST_SETUP_WRITE;

export function isTestSetupWrite(write: unknown): write is TestSetupWrite {
  return typeof write === 'object' && write !== null &&
    (write as { site?: unknown }).site === TEST_SETUP_WRITE.site &&
    (write as { event?: unknown }).event === TEST_SETUP_WRITE.event;
}

/** Whether `site` may name `event`. */
export function siteNames(site: string, event: string): boolean {
  const events = (EVENT_OF_SITE as Record<string, readonly string[] | undefined>)[site];
  return events !== undefined && events.includes(event);
}
