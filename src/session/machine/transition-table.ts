/**
 * The session's transition table, as data.
 *
 * A session's public state is written in one place, the gate
 * `SessionManagerCore._updateSessionState`, and every call to it names the
 * event that makes it and the site it is made from. This table says, for each
 * event, which phases it may move a session from and to. In this stage the
 * table only observes: `StateShadow` (shadow.ts) checks every gate call
 * against it, beside the gate, and records its verdict. The gate itself
 * writes exactly what it wrote before, in the same order. The page
 * docs/architecture/session-state-machine.md explains how it is read and how
 * to add a site, an event or a row.
 *
 * Phases are the public `SessionState` values one to one, except that
 * `READY` (in the enum, never written) reads as `starting`.
 *
 * Two marks name a later stage of this work (`Stage` below):
 * - `legacy`: a transition today's code makes, which that stage removes.
 *   Until then it is accepted and counted apart. A legacy row is kept only
 *   for a transition a site writes by its own condition from a phase it
 *   reaches in ordinary operation. A phase a site reaches only after another
 *   defect (a step failure that leaves the proxy's handlers attached, a
 *   request that outlives a relaunch) has no row: it is reported, not
 *   accepted.
 * - `future`: the shape that stage gives a transition no code makes today.
 *   A future row is data for that stage and is not in force: a write that
 *   only a future row lists is judged as having no row.
 *
 * A row with a `guard` goes to `to` when the guard holds and to `otherwise`
 * when it fails (no `otherwise`: the row does not apply then). Guards are
 * evaluated from facts taken at the write (see `GuardContext`); a guard whose
 * facts are missing is reported as not evaluated, never as met. Every `from`
 * list names only the phases a site can be in when it writes.
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
  'resume-unanswered',
  'resume-failed',
  'answer-failed',
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

/**
 * The later stages a `legacy` or `future` row names (tracked in #1362):
 * - `stop-record`: one record per stop, stamped with a sequence number where
 *   the worker receives it, which every answer reads;
 * - `hidden-stop`: a stop the core resumes unseen never enters `paused`;
 * - `endings`: every ending of a run is one record, with the evidence of all
 *   the terminal events that reach it;
 * - `admission`: which calls may run while another is in flight, and what a
 *   refused or unanswered request leaves behind.
 */
export type Stage = 'stop-record' | 'hidden-stop' | 'endings' | 'admission';

export const STAGES: readonly Stage[] = ['stop-record', 'hidden-stop', 'endings', 'admission'];

export type GuardName =
  | 'no-retained-child'
  | 'retained-child'
  | 'entry-stop-off-and-not-at-stop'
  | 'not-at-stop'
  | 'refused-before-resume'
  | 'no-continued-since'
  | 'newer-stop-shown'
  | 'shown-stop-kept'
  | 'clean-exit';

export interface TransitionRow {
  /** Stable name of the row, which verdicts and coverage refer to. */
  readonly id: string;
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
  /** The named stage's shape for a transition no code makes today; not in force. */
  readonly future?: Stage;
  readonly note?: string;
}

export const TRANSITIONS: readonly TransitionRow[] = [
  { id: 'start', event: 'start', kind: 'request', from: ['created'], to: 'starting', note: 'a new run' },
  { id: 'start-again', event: 'start', kind: 'request', from: ['ended', 'failed'], to: 'starting', guard: 'no-retained-child', note: 'a new run; a run with children is replaced first' },
  { id: 'replace-live', event: 'replace', kind: 'request', from: LIVE, to: 'ended', note: 'the old run ends before the new one starts; today no state is written for it' },
  { id: 'replace-ended', event: 'replace', kind: 'request', from: ['ended', 'failed'], to: 'same', guard: 'retained-child', note: 'the old run already ended; its retained children are closed' },
  { id: 'start-refused', event: 'start-refused', kind: 'request', from: ['starting'], to: 'created', note: 'an incompatible toolchain: back to created, also on a replacement attempt' },
  { id: 'start-failed', event: 'start-failed', kind: 'observation', from: LIVE, to: 'failed', note: 'a launch or attach failing, also after it projected running' },
  { id: 'start-failed-again', event: 'start-failed', kind: 'observation', from: ['failed'], to: 'same', note: 'a launch or attach fails after the session already failed: its catch writes ERROR over ERROR' },
  { id: 'start-failed-ended', event: 'start-failed', kind: 'observation', from: ['ended'], to: 'failed', legacy: 'endings', note: 'the launch catch rewrites an ending the program reached during the launch' },
  { id: 'adapter-configured', event: 'adapter-configured', kind: 'observation', from: ['starting'], to: 'running', guard: 'entry-stop-off-and-not-at-stop', note: 'the site writes nothing when stopOnEntry is set or the session is paused' },
  { id: 'adapter-configured-running', event: 'adapter-configured', kind: 'observation', from: ['running'], to: 'same' },
  { id: 'attach-verified', event: 'attach-verified', kind: 'request', from: ['starting', 'running'], to: 'running', guard: 'not-at-stop', note: 'the site writes nothing when the session is paused at a stop' },
  { id: 'stop-shown', event: 'stop-shown', kind: 'observation', from: LIVE, to: 'paused', note: 'from paused, a new stop supersedes the shown one' },
  { id: 'stop-hidden', event: 'stop-hidden', kind: 'observation', from: ['starting', 'running'], to: 'paused', legacy: 'hidden-stop', note: 'the transient pause of a stop the core resumes unseen' },
  { id: 'stop-hidden-unseen', event: 'stop-hidden', kind: 'observation', from: ['starting', 'running'], to: 'same', future: 'hidden-stop', note: 'a hidden stop leaves the phase alone' },
  { id: 'stop-hidden-paused', event: 'stop-hidden', kind: 'observation', from: ['paused'], to: 'same', guard: 'shown-stop-kept', future: 'hidden-stop', note: 'a hidden stop never replaces the shown stop' },
  { id: 'resume-unseen', event: 'resume-unseen', kind: 'request', from: ['paused'], to: 'running', legacy: 'hidden-stop', note: 'the resume out of the transient pause' },
  { id: 'resume-unseen-same', event: 'resume-unseen', kind: 'request', from: ['starting', 'running'], to: 'same', future: 'hidden-stop', note: 'the resume of a hidden stop leaves the phase alone' },
  { id: 'resume-unseen-failed', event: 'resume-unseen-failed', kind: 'observation', from: ['running'], to: 'paused', note: 'the hidden stop becomes the stop the session is at' },
  { id: 'resume-unseen-failed-paused', event: 'resume-unseen-failed', kind: 'observation', from: ['paused'], to: 'same', guard: 'newer-stop-shown', note: 'a newer stop was shown while the resume was pending; it is kept' },
  { id: 'resume', event: 'resume', kind: 'request', from: ['paused'], to: 'running', note: 'step, continue' },
  { id: 'hot-restart', event: 'hot-restart', kind: 'request', from: ['paused', 'running'], to: 'running', note: 'the same run goes on' },
  { id: 'resume-refused', event: 'resume-refused', kind: 'observation', from: ['running'], to: 'paused', guard: 'refused-before-resume', note: 'the adapter refused before the program resumed, at the stop the request started from' },
  { id: 'resume-refused-paused', event: 'resume-refused', kind: 'observation', from: ['paused'], to: 'same', guard: 'newer-stop-shown', note: 'a newer stop was shown while the request was pending; it is kept' },
  { id: 'resume-unanswered', event: 'resume-unanswered', kind: 'observation', from: ['running'], to: 'paused', guard: 'no-continued-since', legacy: 'admission', note: 'the request got no answer (a timeout, a cancellation): the rollback to paused is a guess' },
  { id: 'resume-unanswered-paused', event: 'resume-unanswered', kind: 'observation', from: ['paused'], to: 'same', guard: 'newer-stop-shown', note: 'a newer stop was shown while the request was pending; it is kept' },
  { id: 'resume-failed', event: 'resume-failed', kind: 'observation', from: ['running'], to: 'failed' },
  { id: 'continued', event: 'continued', kind: 'observation', from: ['starting', 'running'], to: 'running' },
  { id: 'continued-stale', event: 'continued', kind: 'observation', from: ['paused'], to: 'same', note: 'stale: recorded, no change' },
  { id: 'terminated', event: 'terminated', kind: 'observation', from: LIVE, to: 'ended' },
  { id: 'exited', event: 'exited', kind: 'observation', from: LIVE, to: 'ended' },
  { id: 'worker-exit', event: 'worker-exit', kind: 'observation', from: LIVE, to: 'ended', guard: 'clean-exit', otherwise: 'failed' },
  { id: 'error', event: 'error', kind: 'observation', from: LIVE, to: 'failed' },
  { id: 'terminated-evidence', event: 'terminated', kind: 'observation', from: ['ended', 'failed'], to: 'same', future: 'endings', note: 'evidence for the one ending' },
  { id: 'exited-evidence', event: 'exited', kind: 'observation', from: ['ended', 'failed'], to: 'same', future: 'endings', note: 'evidence for the one ending' },
  { id: 'worker-exit-evidence', event: 'worker-exit', kind: 'observation', from: ['ended', 'failed'], to: 'same', future: 'endings', note: 'evidence for the one ending' },
  { id: 'error-evidence', event: 'error', kind: 'observation', from: ['ended', 'failed'], to: 'same', future: 'endings', note: 'evidence for the one ending' },
  { id: 'adopt', event: 'adopt', kind: 'request', from: ['created'], to: 'running', note: 'a child session' },
  { id: 'release', event: 'release', kind: 'request', from: ['running', 'paused'], to: 'ended', note: 'a plain detach, or the detach cascade; the row is kept' },
  { id: 'release-ended', event: 'release', kind: 'request', from: ['ended'], to: 'same', note: 'the adapter answered the release with terminated, which ended the session first' },
  { id: 'close', event: 'close', kind: 'request', from: ['created', ...LIVE, 'ended'], to: 'ended', note: 'then removed' },
  { id: 'close-failed', event: 'close', kind: 'request', from: ['failed'], to: 'ended', legacy: 'endings', note: 'the close writes stopped over a failure before removing the row' },
  { id: 'close-failed-kept', event: 'close', kind: 'request', from: ['failed'], to: 'same', future: 'endings', note: 'a failure stays a failure until the row is removed' },
  { id: 'stale', event: 'stale', kind: 'observation', from: PHASES, to: 'same', future: 'stop-record', note: 'an older run, a closed connection or an older sequence number: kept, reported' }
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
  /** The resume request's token, for a refusal or a request with no answer. */
  readonly since?: ResumeToken | undefined;
  /** The worker's exit, for the four-way rule. */
  readonly exit?: { readonly code: number | null; readonly signal?: string; readonly expected?: boolean };
}

/**
 * Everything a guard can be evaluated from, taken at the write: before the
 * gate's own listeners run, so a listener that changes the session cannot
 * change the verdict on the write that told it. A missing fact leaves its
 * guard unevaluated.
 */
export interface GuardContext extends GuardFacts {
  /** The session's descendants (live or retained rows). */
  readonly descendants?: number;
  /** The stop the session records (`lastStop`). */
  readonly stop?: StopIdentity;
  /** Whether the session is at that stop: paused, with a stop recorded. */
  readonly atStop?: boolean;
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
  'entry-stop-off-and-not-at-stop': (c) =>
    (c.stopOnEntry === undefined || c.atStop === undefined ? undefined : !c.stopOnEntry && !c.atStop),
  'not-at-stop': (c) => (c.atStop === undefined ? undefined : !c.atStop),
  // Refused before the program resumed (no `continued` since the request),
  // in the same run, and still at the stop the request started from.
  'refused-before-resume': (c) => {
    if (!c.since || c.continuedNow === undefined || c.runNow === undefined) return undefined;
    return c.since.runId === c.runNow &&
      c.continuedNow === c.since.continued &&
      c.since.fromStop !== undefined &&
      c.stop === c.since.fromStop;
  },
  // No `continued` since the request, in the same run: the program may not have resumed.
  'no-continued-since': (c) => {
    if (!c.since || c.continuedNow === undefined || c.runNow === undefined) return undefined;
    return c.since.runId === c.runNow && c.continuedNow === c.since.continued;
  },
  // The session is at a stop it showed after the request started, not at the
  // one the request started from (a hidden stop does not count).
  'newer-stop-shown': (c) => {
    if (!c.since || c.runNow === undefined) return undefined;
    return c.since.runId === c.runNow &&
      c.lastShownStop !== undefined &&
      c.stop === c.lastShownStop &&
      c.lastShownStop !== c.since.fromStop;
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

/** Rows in force now: every row but the `future` ones. */
export const IN_FORCE: readonly TransitionRow[] = TRANSITIONS.filter((row) => row.future === undefined);

/** The rows in force for an event from a phase, in table order. */
export function rowsFor(from: Phase, event: SessionEvent): TransitionRow[] {
  return IN_FORCE.filter((row) => row.event === event && row.from.includes(from));
}

/**
 * Does the table list `from --event--> actual`? Pure; never throws. Only rows
 * in force are read: a transition only a `future` row lists has no row.
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
 * there (a note): the first row in force that applies. Its verdict is the
 * row's, by the same rules as `evaluateTransition`.
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
 * legal for the wrong reason. Where a site can make more than one event, it
 * chooses from what it knows at the write:
 * - a continue is the caller's (`resume`) or the core's own resume of a stop
 *   no caller was shown (`resume-unseen`);
 * - a continue or a hot restart that fails was refused by the adapter
 *   (`resume-refused`, the adapter answered with a failure) or got no answer
 *   (`resume-unanswered`: a timeout, a cancellation at shutdown); the core's
 *   own resume failing either way is `resume-unseen-failed`;
 * - a step call that throws before its step has landed is `resume-failed`,
 *   and one that throws after (reading the answer) is `answer-failed`, which
 *   has no row.
 *
 * `worker-exit` is a name of the channel, not of the process: the proxy
 * reports a worker's exit, a closed adapter connection and the synthetic
 * exit `ProxyManager.stop()` fans out to child views the same way, and the
 * sites cannot tell them apart until the endings stage records each as its
 * own observation.
 *
 * Sites marked (note) make no gate call: today's code writes nothing there,
 * or (the refused step with no stop recorded) assigns the state directly.
 */
export const EVENT_OF_SITE = {
  // attach-controller.ts
  'attach.replace': ['replace'], // (note) after the previous proxy's teardown
  'attach': ['start'],
  'attach.verified': ['attach-verified'],
  'attach.failed': ['start-failed'],
  'detach': ['release'],
  // execution-controller.ts
  'step.failed': ['resume-failed', 'answer-failed'],
  'executeStep.sent': ['resume'],
  'executeStep.refused': ['resume-refused'],
  'executeStep.refused-unrecorded': ['resume-refused'], // (note) the direct assignment
  'executeStep.failed': ['resume-failed'],
  'continue.sent': ['resume', 'resume-unseen'],
  'continue.rejected': ['resume-refused', 'resume-unanswered', 'resume-unseen-failed'],
  // debug-launcher.ts
  'launch.replace': ['replace'], // (note) after the previous proxy's teardown
  'launch': ['start'],
  'launch.refused': ['start-refused'],
  'launch.failed': ['start-failed'],
  'hotRestart.sent': ['hot-restart'], // a note from running
  'hotRestart.rejected': ['resume-refused', 'resume-unanswered'],
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
  'handleExit.ended': ['worker-exit'] // (note) after the ending: evidence the endings stage collects
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
