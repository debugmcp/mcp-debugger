/**
 * The session transition table as data (src/session/machine/transition-table.ts):
 * every row in force, every (phase, event) pair that has no row in force, the
 * future rows (not in force), every guard both ways and unevaluated, and the
 * verdict rules.
 */
import { describe, it, expect } from 'vitest';
import { SessionState } from '@debugmcp/shared';
import {
  EVENT_OF_SITE,
  GUARDS,
  IN_FORCE,
  PHASES,
  PHASE_OF_STATE,
  SESSION_EVENTS,
  STAGES,
  TRANSITIONS,
  evaluateTransition,
  evaluateVirtual,
  rowsFor,
  siteNames,
  type GuardContext,
  type GuardFacts,
  type GuardName,
  type Phase,
  type SessionEvent,
  type StateWrite,
  type TransitionRow
} from '../../../../src/session/machine/transition-table.js';
import { StateShadow } from '../../../../src/session/machine/shadow.js';

const STOP_A = { reason: 'breakpoint' };
const STOP_B = { reason: 'exception' };
const TOKEN_A = { runId: 1, continued: 3, fromStop: STOP_A };

/** A context in which each guard holds, and one in which it fails. */
const GUARD_CONTEXTS: Record<GuardName, { holds: GuardContext; fails: GuardContext }> = {
  'no-retained-child': { holds: { descendants: 0 }, fails: { descendants: 2 } },
  'retained-child': { holds: { descendants: 1 }, fails: { descendants: 0 } },
  'entry-stop-off': { holds: { stopOnEntry: false }, fails: { stopOnEntry: true } },
  'refused-before-resume': {
    holds: { stop: STOP_A, runNow: 1, continuedNow: 3, since: TOKEN_A },
    fails: { stop: STOP_A, runNow: 1, continuedNow: 4, since: TOKEN_A }
  },
  'no-continued-since': {
    holds: { runNow: 1, continuedNow: 3, since: TOKEN_A },
    fails: { runNow: 1, continuedNow: 4, since: TOKEN_A }
  },
  'newer-stop-shown': {
    holds: { stop: STOP_B, lastShownStop: STOP_B, runNow: 1, since: TOKEN_A },
    fails: { stop: STOP_A, lastShownStop: STOP_A, runNow: 1, since: TOKEN_A }
  },
  'shown-stop-kept': { holds: { stop: STOP_A, lastShownStop: STOP_A }, fails: { stop: STOP_B, lastShownStop: STOP_A } },
  'clean-exit': { holds: { exit: { code: 0, expected: false } }, fails: { exit: { code: 1, expected: false } } }
};

/** The facts a guard reads; with them removed it cannot be evaluated. */
const MISSING_FACTS: Record<GuardName, GuardContext> = {
  'no-retained-child': {},
  'retained-child': {},
  'entry-stop-off': {},
  'refused-before-resume': { stop: STOP_A, runNow: 1, continuedNow: 0 },
  'no-continued-since': { runNow: 1, continuedNow: 0 },
  'newer-stop-shown': { stop: STOP_B, lastShownStop: STOP_B, runNow: 1 },
  'shown-stop-kept': { stop: STOP_A },
  'clean-exit': {}
};

/** Every (event, phase) pair no row in force covers. A change to the table's coverage shows here. */
const HOLES: Partial<Record<SessionEvent, Phase[]>> = {
  'start': ['starting', 'running', 'paused'],
  'replace': ['created'],
  'start-refused': ['created', 'running', 'paused', 'ended', 'failed'],
  'start-failed': ['created'],
  'adapter-configured': ['created', 'paused', 'ended', 'failed'],
  'attach-verified': ['created', 'paused', 'ended', 'failed'],
  'stop-shown': ['created', 'ended', 'failed'],
  'stop-hidden': ['created', 'paused', 'ended', 'failed'],
  'resume-unseen': ['created', 'starting', 'running', 'ended', 'failed'],
  'resume-unseen-failed': ['created', 'starting', 'ended', 'failed'],
  'resume': ['created', 'starting', 'running', 'ended', 'failed'],
  'hot-restart': ['created', 'starting', 'ended', 'failed'],
  'resume-refused': ['created', 'starting', 'ended', 'failed'],
  'resume-unanswered': ['created', 'starting', 'ended', 'failed'],
  'resume-failed': ['created', 'starting', 'paused', 'ended', 'failed'],
  'answer-failed': ['created', 'starting', 'running', 'paused', 'ended', 'failed'],
  'continued': ['created', 'ended', 'failed'],
  'terminated': ['created', 'ended', 'failed'],
  'exited': ['created', 'ended', 'failed'],
  'worker-exit': ['created', 'ended', 'failed'],
  'error': ['created', 'ended', 'failed'],
  'adopt': ['starting', 'running', 'paused', 'ended', 'failed'],
  'release': ['created', 'starting', 'failed'],
  'stale': ['created', 'starting', 'running', 'paused', 'ended', 'failed']
};

/** The rows that are data for a later stage, and that stage. */
const FUTURE: Record<string, string> = {
  'stop-hidden-unseen': 'hidden-stop',
  'stop-hidden-paused': 'hidden-stop',
  'resume-unseen-same': 'hidden-stop',
  'terminated-evidence': 'endings',
  'exited-evidence': 'endings',
  'worker-exit-evidence': 'endings',
  'error-evidence': 'endings',
  'close-failed-kept': 'endings',
  'stale': 'stop-record'
};

/** The rows kept for today's behaviour, and the stage that removes each. */
const LEGACY: Record<string, string> = {
  'start-failed-ended': 'endings',
  'stop-hidden': 'hidden-stop',
  'resume-unseen': 'hidden-stop',
  'resume-unanswered': 'admission',
  'close-failed': 'endings'
};

const resolve = (to: Phase | 'same', from: Phase): Phase => (to === 'same' ? from : to);

/** Does another row in force, with no guard, list from --event--> to? */
function listedByUnguardedRow(from: Phase, event: SessionEvent, to: Phase, except: TransitionRow, legacy: boolean): boolean {
  return rowsFor(from, event).some((row) => row !== except && !row.guard && Boolean(row.legacy) === legacy && resolve(row.to, from) === to);
}

describe('the transition table', () => {
  it('reads every public state as a phase, READY as starting', () => {
    for (const state of Object.values(SessionState)) {
      expect(PHASES).toContain(PHASE_OF_STATE[state]);
    }
    expect(PHASE_OF_STATE[SessionState.READY]).toBe('starting');
    expect(PHASE_OF_STATE[SessionState.STOPPED]).toBe('ended');
    expect(PHASE_OF_STATE[SessionState.ERROR]).toBe('failed');
  });

  it('names only known events, phases, guards and stages; every row has a unique id', () => {
    const ids = new Set<string>();
    for (const row of TRANSITIONS) {
      expect(ids.has(row.id), `duplicate id ${row.id}`).toBe(false);
      ids.add(row.id);
      expect(SESSION_EVENTS).toContain(row.event);
      for (const from of row.from) expect(PHASES).toContain(from);
      if (row.to !== 'same') expect(PHASES).toContain(row.to);
      if (row.otherwise !== undefined) {
        expect(row.guard, `${row.id}: an otherwise needs a guard`).toBeDefined();
      }
      if (row.guard) expect(Object.keys(GUARDS)).toContain(row.guard);
      if (row.legacy) expect(STAGES).toContain(row.legacy);
      if (row.future) expect(STAGES).toContain(row.future);
      expect(row.legacy !== undefined && row.future !== undefined, `${row.id}: legacy and future`).toBe(false);
    }
  });

  it('marks exactly these rows legacy and future', () => {
    expect(Object.fromEntries(TRANSITIONS.filter((r) => r.legacy).map((r) => [r.id, r.legacy]))).toEqual(LEGACY);
    expect(Object.fromEntries(TRANSITIONS.filter((r) => r.future).map((r) => [r.id, r.future]))).toEqual(FUTURE);
    expect(IN_FORCE).toEqual(TRANSITIONS.filter((r) => r.future === undefined));
  });

  it('never pairs a guarded row with an unguarded legacy row to the same target from the same phase', () => {
    // Such a legacy row would win over the guard, so the transition the guard
    // exists to report would be counted as legacy instead.
    const clashes: string[] = [];
    for (const guarded of IN_FORCE.filter((r) => r.guard)) {
      for (const from of guarded.from) {
        const targets = [guarded.to, guarded.otherwise].filter((t): t is Phase | 'same' => t !== undefined).map((t) => resolve(t, from));
        for (const legacy of IN_FORCE.filter((r) => r.legacy && !r.guard && r.event === guarded.event && r.from.includes(from))) {
          if (targets.includes(resolve(legacy.to, from))) clashes.push(`${guarded.id} / ${legacy.id} from ${from}`);
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  describe('every row in force', () => {
    for (const row of IN_FORCE) {
      for (const from of row.from) {
        const label = `${row.id}: ${row.event} from ${from} -> ${row.to}${row.guard ? ` [${row.guard}]` : ''}${row.legacy ? ` (legacy until ${row.legacy})` : ''}`;
        it(label, () => {
          const to = resolve(row.to, from);
          const context = row.guard ? GUARD_CONTEXTS[row.guard].holds : {};
          const verdict = evaluateTransition(from, row.event, to, context);
          const expected = row.legacy && !listedByUnguardedRow(from, row.event, to, row, false) ? 'legacy' : 'legal';
          expect(verdict.verdict).toBe(expected);
          if (expected === (row.legacy ? 'legacy' : 'legal')) expect(verdict.row?.id).toBe(row.id);

          if (row.guard) {
            const fails = GUARD_CONTEXTS[row.guard].fails;
            if (row.otherwise !== undefined) {
              const otherwise = resolve(row.otherwise, from);
              expect(evaluateTransition(from, row.event, otherwise, fails).verdict).toBe(row.legacy ? 'legacy' : 'legal');
              if (otherwise !== to) {
                expect(evaluateTransition(from, row.event, to, fails).verdict).toBe('guard-not-met');
              }
            } else if (!listedByUnguardedRow(from, row.event, to, row, false) && !listedByUnguardedRow(from, row.event, to, row, true)) {
              expect(evaluateTransition(from, row.event, to, fails).verdict).toBe('guard-not-met');
            }
            if (!listedByUnguardedRow(from, row.event, to, row, false) && !listedByUnguardedRow(from, row.event, to, row, true)) {
              expect(evaluateTransition(from, row.event, to, MISSING_FACTS[row.guard]).verdict).toBe('unevaluated');
            }
          }
        });
      }
    }
  });

  describe('every guard on a row in force can fail from each of the row\'s phases', () => {
    // The facts come from the shadow itself (`begin` and the context it builds),
    // so a fact that follows from the phase is computed, not supplied by the
    // test: a guard that reads only such facts cannot fail, and is noise.
    const STATE_OF: Record<Phase, SessionState> = {
      created: SessionState.CREATED,
      starting: SessionState.INITIALIZING,
      running: SessionState.RUNNING,
      paused: SessionState.PAUSED,
      ended: SessionState.STOPPED,
      failed: SessionState.ERROR
    };
    for (const row of IN_FORCE.filter((r) => r.guard)) {
      for (const from of row.from) {
        it(`${row.id} [${row.guard}] from ${from}`, () => {
          const site = Object.entries(EVENT_OF_SITE).find(([, events]) => (events as readonly string[]).includes(row.event))![0];
          let canFail = false;
          for (const lastStop of [undefined, STOP_A]) {
            for (const descendants of [0, 2]) {
              const shadow = new StateShadow({ logger: () => undefined, descendantsOf: () => descendants });
              const session = { id: `probe-${row.id}`, state: STATE_OF[from], lastStop };
              const write = { site, event: row.event } as StateWrite;
              const boundary = shadow.begin(session, write)!;
              const facts: GuardFacts[] = [
                {},
                { stopOnEntry: true },
                { stopOnEntry: false },
                { since: { runId: boundary.runId, continued: boundary.continued, fromStop: lastStop } },
                { since: { runId: boundary.runId, continued: boundary.continued + 1, fromStop: lastStop } },
                { since: { runId: boundary.runId, continued: boundary.continued, fromStop: STOP_B } },
                { exit: { code: 0, expected: true } },
                { exit: { code: 1, expected: false } }
              ];
              for (const fact of facts) {
                const context = (shadow as unknown as { contextFor: (w: StateWrite, b: unknown) => GuardContext })
                  .contextFor({ ...write, facts: fact } as StateWrite, boundary);
                if (GUARDS[row.guard!](context) === false) canFail = true;
              }
            }
          }
          expect(canFail, `guard '${row.guard}' on ${row.id} cannot fail from ${from}`).toBe(true);
        });
      }
    }
  });

  describe('the future rows', () => {
    for (const row of TRANSITIONS.filter((r) => r.future)) {
      it(`${row.id} (${row.future}) is not in force`, () => {
        for (const from of row.from) {
          const to = resolve(row.to, from);
          const context = row.guard ? GUARD_CONTEXTS[row.guard].holds : {};
          const verdict = evaluateTransition(from, row.event, to, context);
          // Only a row in force can vouch for it; this one never does.
          expect(verdict.row?.id).not.toBe(row.id);
          if (rowsFor(from, row.event).every((r) => resolve(r.to, from) !== to && (r.otherwise === undefined || resolve(r.otherwise, from) !== to))) {
            expect(verdict.verdict).toBe('no-row');
          }
        }
      });
    }
  });

  describe('every (phase, event) pair with no row in force', () => {
    const covered = new Set(IN_FORCE.flatMap((row) => row.from.map((from) => `${row.event}:${from}`)));

    it('is exactly the list of holes', () => {
      const holes: Partial<Record<SessionEvent, Phase[]>> = {};
      for (const event of SESSION_EVENTS) {
        const missing = PHASES.filter((phase) => !covered.has(`${event}:${phase}`));
        if (missing.length > 0) holes[event] = missing;
      }
      expect(holes).toEqual(HOLES);
    });

    for (const [event, phases] of Object.entries(HOLES) as Array<[SessionEvent, Phase[]]>) {
      for (const from of phases) {
        it(`${event} from ${from}`, () => {
          for (const actual of PHASES) {
            const verdict = evaluateTransition(from, event, actual, GUARD_CONTEXTS['refused-before-resume'].holds);
            expect(verdict.verdict).toBe('no-row');
            expect(verdict.why).toBe(`no row for ${event} from ${from}`);
          }
          expect(evaluateVirtual(from, event).verdict).toBe('no-row');
        });
      }
    }
  });

  describe('cases worth naming', () => {
    it('a resume refused while a newer stop was shown keeps the session paused at it (the same-state row)', () => {
      const context = { stop: STOP_B, lastShownStop: STOP_B, runNow: 1, since: { runId: 1, continued: 0, fromStop: STOP_A } };
      expect(evaluateTransition('paused', 'resume-refused', 'paused', context).verdict).toBe('legal');
      expect(evaluateTransition('paused', 'resume-unanswered', 'paused', context).verdict).toBe('legal');
      expect(evaluateTransition('paused', 'resume-unseen-failed', 'paused', context).verdict).toBe('legal');
    });

    it('a newer stop that was not shown (a hidden one) does not count as newer', () => {
      const hidden = { reason: 'entry' };
      const context = { stop: hidden, lastShownStop: STOP_A, runNow: 1, since: { runId: 1, continued: 0, fromStop: STOP_A } };
      expect(evaluateTransition('paused', 'resume-refused', 'paused', context).verdict).toBe('guard-not-met');
      expect(evaluateTransition('paused', 'resume-unseen-failed', 'paused', context).verdict).toBe('guard-not-met');
    });

    it('a resume refused after the engine reported continued is guard-not-met', () => {
      const context = { stop: STOP_A, runNow: 1, continuedNow: 1, since: { runId: 1, continued: 0, fromStop: STOP_A } };
      const verdict = evaluateTransition('running', 'resume-refused', 'paused', context);
      expect(verdict.verdict).toBe('guard-not-met');
      expect(verdict.why).toContain("guard 'refused-before-resume' not met");
    });

    it('a request with no answer rolls back as legacy, and is guard-not-met once continued was seen', () => {
      const before = { runNow: 1, continuedNow: 0, since: { runId: 1, continued: 0, fromStop: STOP_A } };
      expect(evaluateTransition('running', 'resume-unanswered', 'paused', before)).toMatchObject({ verdict: 'legacy', row: { id: 'resume-unanswered' } });
      expect(evaluateTransition('running', 'resume-unanswered', 'paused', { ...before, continuedNow: 1 }).verdict).toBe('guard-not-met');
    });

    it('a refusal with no stop to return to is guard-not-met (the direct write)', () => {
      const context = { runNow: 1, continuedNow: 0, since: { runId: 1, continued: 0, fromStop: undefined } };
      expect(evaluateTransition('running', 'resume-refused', 'paused', context).verdict).toBe('guard-not-met');
    });

    it('a refusal from another run is guard-not-met', () => {
      const context = { stop: STOP_A, runNow: 2, continuedNow: 0, since: { runId: 1, continued: 0, fromStop: STOP_A } };
      expect(evaluateTransition('running', 'resume-refused', 'paused', context).verdict).toBe('guard-not-met');
    });

    it('a refusal judged without its token is unevaluated, never legal', () => {
      expect(evaluateTransition('running', 'resume-refused', 'paused', { stop: STOP_A, runNow: 1, continuedNow: 0 }).verdict)
        .toBe('unevaluated');
    });

    it('a step that fails while paused, or after it landed, has no row', () => {
      expect(evaluateTransition('paused', 'resume-failed', 'failed').verdict).toBe('no-row');
      for (const from of PHASES) expect(evaluateTransition(from, 'answer-failed', 'failed').verdict).toBe('no-row');
    });

    it('an ended session going back to running has no row, whatever the event', () => {
      for (const event of ['continued', 'resume', 'adapter-configured', 'stop-shown', 'attach-verified'] as const) {
        expect(evaluateTransition('ended', event, 'running').verdict).toBe('no-row');
      }
      for (const event of ['terminated', 'exited', 'worker-exit', 'error', 'close'] as const) {
        expect(evaluateTransition('ended', event, 'running').verdict).toBe('no-row');
      }
    });

    it('terminal evidence is the endings stage\'s: no terminal event after the ending is in force today', () => {
      for (const event of ['terminated', 'exited', 'worker-exit', 'error'] as const) {
        expect(evaluateTransition('ended', event, 'ended').verdict).toBe('no-row');
        expect(evaluateTransition('failed', event, 'failed').verdict).toBe('no-row');
      }
      expect(evaluateTransition('failed', 'terminated', 'ended').why).toBe('no row for terminated from failed');
    });

    it('the close that rewrites a failure as ended is legacy until the endings stage', () => {
      const verdict = evaluateTransition('failed', 'close', 'ended');
      expect(verdict.verdict).toBe('legacy');
      expect(verdict.row?.legacy).toBe('endings');
      expect(evaluateTransition('failed', 'close', 'failed').verdict).toBe('no-row');
    });

    it('the transient pause and the resume out of it are legacy until the hidden-stop stage', () => {
      expect(evaluateTransition('running', 'stop-hidden', 'paused').verdict).toBe('legacy');
      expect(evaluateTransition('starting', 'stop-hidden', 'paused').verdict).toBe('legacy');
      expect(evaluateTransition('paused', 'resume-unseen', 'running').verdict).toBe('legacy');
      // a hidden stop over a shown stop has no row in force: it is the defect its future guard reports
      expect(evaluateTransition('paused', 'stop-hidden', 'paused', { stop: STOP_B, lastShownStop: STOP_A }).verdict).toBe('no-row');
    });

    it('the worker exit follows the four-way rule', () => {
      const cases: Array<[{ code: number | null; signal?: string; expected?: boolean }, Phase]> = [
        [{ code: 3, expected: true }, 'ended'],
        [{ code: 0, expected: false }, 'ended'],
        [{ code: 1, expected: false }, 'failed'],
        [{ code: 0 }, 'ended'],
        [{ code: null }, 'ended'],
        [{ code: null, signal: 'SIGKILL' }, 'failed'],
        [{ code: 2 }, 'failed']
      ];
      for (const [exit, to] of cases) {
        expect(evaluateTransition('running', 'worker-exit', to, { exit }).verdict).toBe('legal');
        expect(evaluateTransition('running', 'worker-exit', to === 'ended' ? 'failed' : 'ended', { exit }).verdict).toBe('guard-not-met');
      }
      expect(evaluateTransition('running', 'worker-exit', 'ended').verdict).toBe('unevaluated');
    });

    it('a start from an ended run with retained children needs the replacement first', () => {
      expect(evaluateTransition('ended', 'start', 'starting', { descendants: 1 }).verdict).toBe('guard-not-met');
      expect(evaluateTransition('ended', 'start', 'starting', { descendants: 0 }).verdict).toBe('legal');
      expect(evaluateVirtual('ended', 'replace', { descendants: 1 })).toMatchObject({ verdict: 'legal', to: 'ended' });
      expect(evaluateVirtual('ended', 'replace', { descendants: 0 }).verdict).toBe('guard-not-met');
      expect(evaluateVirtual('running', 'replace')).toMatchObject({ verdict: 'legal', to: 'ended' });
    });

    it('adapter-configured goes to running only with stopOnEntry off; attach-verified has no guard', () => {
      expect(evaluateTransition('starting', 'adapter-configured', 'running', { stopOnEntry: false }).verdict).toBe('legal');
      expect(evaluateTransition('starting', 'adapter-configured', 'running', { stopOnEntry: true }).verdict).toBe('guard-not-met');
      expect(evaluateTransition('starting', 'adapter-configured', 'running').verdict).toBe('unevaluated');
      expect(evaluateTransition('starting', 'attach-verified', 'running').verdict).toBe('legal');
      expect(evaluateTransition('running', 'attach-verified', 'running').verdict).toBe('legal');
      expect(evaluateTransition('running', 'adapter-configured', 'running').verdict).toBe('legal');
      expect(evaluateTransition('paused', 'adapter-configured', 'paused').verdict).toBe('no-row');
    });
  });

  describe('virtual transitions (notes)', () => {
    it('take the row in force where it goes', () => {
      expect(evaluateVirtual('running', 'hot-restart')).toMatchObject({ verdict: 'legal', to: 'running' });
      expect(evaluateVirtual('paused', 'continued')).toMatchObject({ verdict: 'legal', to: 'paused' });
      expect(evaluateVirtual('failed', 'worker-exit').verdict).toBe('no-row');
      expect(evaluateVirtual('starting', 'hot-restart').verdict).toBe('no-row');
    });
  });

  describe('the sites', () => {
    it('name only events of the table, and each event a site can name', () => {
      const named = new Set<string>();
      for (const [site, events] of Object.entries(EVENT_OF_SITE)) {
        expect(events.length, site).toBeGreaterThan(0);
        for (const event of events) {
          expect(SESSION_EVENTS).toContain(event);
          expect(siteNames(site, event)).toBe(true);
          named.add(event);
        }
      }
      // `stale` is the stop-record stage's: no code names it yet.
      expect(SESSION_EVENTS.filter((event) => !named.has(event))).toEqual(['stale']);
    });

    it('refuse an event their site does not name', () => {
      expect(siteNames('executeStep.sent', 'resume')).toBe(true);
      expect(siteNames('executeStep.sent', 'resume-refused')).toBe(false);
      expect(siteNames('no-such-site', 'resume')).toBe(false);
    });
  });
});
