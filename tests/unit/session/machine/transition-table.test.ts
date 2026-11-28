/**
 * The session transition table as data (src/session/machine/transition-table.ts):
 * every row, every (phase, event) pair that has no row, every guard both ways
 * and unevaluated, and the verdict rules.
 */
import { describe, it, expect } from 'vitest';
import { SessionState } from '@debugmcp/shared';
import {
  EVENT_OF_SITE,
  GUARDS,
  PHASES,
  PHASE_OF_STATE,
  SESSION_EVENTS,
  TRANSITIONS,
  evaluateTransition,
  evaluateVirtual,
  rowsFor,
  siteNames,
  type GuardContext,
  type GuardName,
  type Phase,
  type SessionEvent,
  type TransitionRow
} from '../../../../src/session/machine/transition-table.js';

const STOP_A = { reason: 'breakpoint' };
const STOP_B = { reason: 'exception' };

/** A context in which each guard holds, and one in which it fails. */
const GUARD_CONTEXTS: Record<GuardName, { holds: GuardContext; fails: GuardContext }> = {
  'no-retained-child': { holds: { descendants: 0 }, fails: { descendants: 2 } },
  'retained-child': { holds: { descendants: 1 }, fails: { descendants: 0 } },
  'entry-stop-off-and-no-stop': { holds: { stopOnEntry: false }, fails: { stopOnEntry: true } },
  'no-stop-recorded': { holds: {}, fails: { stop: STOP_A } },
  'refused-before-resume': {
    holds: { stop: STOP_A, runNow: 1, continuedNow: 3, since: { runId: 1, continued: 3, fromStop: STOP_A } },
    fails: { stop: STOP_A, runNow: 1, continuedNow: 4, since: { runId: 1, continued: 3, fromStop: STOP_A } }
  },
  'newer-stop-shown': {
    holds: { stop: STOP_B, runNow: 1, since: { runId: 1, continued: 0, fromStop: STOP_A } },
    fails: { stop: STOP_A, runNow: 1, since: { runId: 1, continued: 0, fromStop: STOP_A } }
  },
  'shown-stop-kept': { holds: { stop: STOP_A, lastShownStop: STOP_A }, fails: { stop: STOP_B, lastShownStop: STOP_A } },
  'clean-exit': { holds: { exit: { code: 0, expected: false } }, fails: { exit: { code: 1, expected: false } } }
};

/** The facts a guard reads; with them removed it cannot be evaluated. */
const MISSING_FACTS: Record<GuardName, GuardContext | undefined> = {
  'no-retained-child': {},
  'retained-child': {},
  'entry-stop-off-and-no-stop': {},
  // reads only the session's own stop, which is always known
  'no-stop-recorded': undefined,
  'refused-before-resume': { stop: STOP_A, runNow: 1, continuedNow: 0 },
  'newer-stop-shown': { stop: STOP_B, runNow: 1 },
  'shown-stop-kept': { stop: STOP_A },
  'clean-exit': {}
};

/** Every (event, phase) pair the table has no row for. A change to the table's coverage shows here. */
const HOLES: Partial<Record<SessionEvent, Phase[]>> = {
  'start': ['starting', 'running', 'paused'],
  'replace': ['created'],
  'start-refused': ['created', 'running', 'paused', 'ended', 'failed'],
  'start-failed': ['created'],
  'adapter-configured': ['created', 'ended', 'failed'],
  'attach-verified': ['created', 'paused', 'ended', 'failed'],
  'stop-shown': ['created', 'ended', 'failed'],
  'stop-hidden': ['created', 'ended', 'failed'],
  'resume-unseen': ['created', 'ended', 'failed'],
  'resume-unseen-failed': ['created', 'ended', 'failed'],
  'resume': ['created', 'starting', 'running', 'ended', 'failed'],
  'hot-restart': ['created', 'starting', 'ended', 'failed'],
  'resume-refused': ['created', 'starting', 'ended', 'failed'],
  'resume-failed': ['created', 'starting', 'ended', 'failed'],
  'continued': ['created', 'ended', 'failed'],
  'terminated': ['created'],
  'exited': ['created'],
  'worker-exit': ['created'],
  'error': ['created'],
  'adopt': ['starting', 'running', 'paused', 'ended', 'failed'],
  'release': ['created', 'failed']
};

const resolve = (to: Phase | 'same', from: Phase): Phase => (to === 'same' ? from : to);

/** Does a current (not legacy) row with no guard list from --event--> to? */
function listedByCurrentRow(from: Phase, event: SessionEvent, to: Phase, except: TransitionRow): boolean {
  return rowsFor(from, event).some((row) => row !== except && !row.legacy && !row.guard && resolve(row.to, from) === to);
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

  it('names only known events and phases, and every legacy row a stage', () => {
    for (const row of TRANSITIONS) {
      expect(SESSION_EVENTS).toContain(row.event);
      for (const from of row.from) expect(PHASES).toContain(from);
      if (row.to !== 'same') expect(PHASES).toContain(row.to);
      if (row.otherwise !== undefined) {
        expect(row.guard, `${row.event}: an otherwise needs a guard`).toBeDefined();
      }
      if (row.guard) expect(Object.keys(GUARDS)).toContain(row.guard);
      if (row.legacy) expect(['hidden-stop', 'S2a', 'S3']).toContain(row.legacy);
    }
  });

  describe('every row', () => {
    for (const row of TRANSITIONS) {
      for (const from of row.from) {
        const label = `${row.event} from ${from} -> ${row.to}${row.guard ? ` [${row.guard}]` : ''}${row.legacy ? ` (legacy ${row.legacy})` : ''}`;
        it(label, () => {
          const to = resolve(row.to, from);
          const context = row.guard ? GUARD_CONTEXTS[row.guard].holds : {};
          const verdict = evaluateTransition(from, row.event, to, context);
          // A legacy row's transition can also be a current row's (the hidden stop
          // over a shown stop), which then wins.
          const expected = row.legacy && !listedByCurrentRow(from, row.event, to, row) ? 'legacy' : 'legal';
          expect(verdict.verdict).toBe(expected);

          if (row.guard) {
            const fails = GUARD_CONTEXTS[row.guard].fails;
            if (row.otherwise !== undefined) {
              const otherwise = resolve(row.otherwise, from);
              expect(evaluateTransition(from, row.event, otherwise, fails).verdict).toBe(row.legacy ? 'legacy' : 'legal');
              if (otherwise !== to) {
                // The guard failed and the code went where it holds.
                expect(evaluateTransition(from, row.event, to, fails).verdict).toBe('guard-not-met');
              }
            } else if (!listedByCurrentRow(from, row.event, to, row) && !rowsFor(from, row.event).some((r) => r !== row && r.legacy && resolve(r.to, from) === to)) {
              expect(evaluateTransition(from, row.event, to, fails).verdict).toBe('guard-not-met');
            }
            const missing = MISSING_FACTS[row.guard];
            if (missing !== undefined && !rowsFor(from, row.event).some((r) => r !== row && !r.guard && resolve(r.to, from) === to)) {
              expect(evaluateTransition(from, row.event, to, missing).verdict).toBe('unevaluated');
            }
          }
        });
      }
    }
  });

  describe('every (phase, event) pair with no row', () => {
    const covered = new Set(TRANSITIONS.flatMap((row) => row.from.map((from) => `${row.event}:${from}`)));

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

  describe('the cases the design runs and its review named', () => {
    it('a resume refused while a newer stop arrived keeps the session paused at it (the missing same-state row)', () => {
      const context = { stop: STOP_B, runNow: 1, since: { runId: 1, continued: 0, fromStop: STOP_A } };
      expect(evaluateTransition('paused', 'resume-refused', 'paused', context).verdict).toBe('legal');
      expect(evaluateTransition('paused', 'resume-unseen-failed', 'paused').verdict).toBe('legal');
    });

    it('a resume refused after the engine reported continued is guard-not-met (R1r)', () => {
      const context = { stop: STOP_A, runNow: 1, continuedNow: 1, since: { runId: 1, continued: 0, fromStop: STOP_A } };
      const verdict = evaluateTransition('running', 'resume-refused', 'paused', context);
      expect(verdict.verdict).toBe('guard-not-met');
      expect(verdict.why).toContain("guard 'refused-before-resume' not met");
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

    it('an ended session going back to running has no row, whatever the event', () => {
      for (const event of ['continued', 'resume', 'adapter-configured', 'stop-shown', 'attach-verified'] as const) {
        expect(evaluateTransition('ended', event, 'running').verdict).toBe('no-row');
      }
      for (const event of ['terminated', 'exited', 'worker-exit', 'error', 'close'] as const) {
        expect(evaluateTransition('ended', event, 'running').verdict).toBe('no-row');
      }
    });

    it('terminal evidence keeps the phase: from failed a terminated that writes ended has no row', () => {
      expect(evaluateTransition('failed', 'terminated', 'failed').verdict).toBe('legal');
      const verdict = evaluateTransition('failed', 'terminated', 'ended');
      expect(verdict.verdict).toBe('no-row');
      expect(verdict.why).toBe('terminated from failed goes to ended; the rows allow failed');
    });

    it('the close that rewrites a failure as ended is legacy until S3', () => {
      const verdict = evaluateTransition('failed', 'close', 'ended');
      expect(verdict.verdict).toBe('legacy');
      expect(verdict.row?.legacy).toBe('S3');
      expect(evaluateTransition('failed', 'close', 'failed').verdict).toBe('legal');
    });

    it('the transient pause and the resume out of it are legacy until the hidden-stop change', () => {
      expect(evaluateTransition('running', 'stop-hidden', 'paused').verdict).toBe('legacy');
      expect(evaluateTransition('starting', 'stop-hidden', 'paused').verdict).toBe('legacy');
      expect(evaluateTransition('paused', 'resume-unseen', 'running').verdict).toBe('legacy');
      expect(evaluateTransition('running', 'resume-unseen', 'running').verdict).toBe('legal');
      // over a shown stop: legal only if the shown stop is kept, which today's code never does
      expect(evaluateTransition('paused', 'stop-hidden', 'paused', { stop: STOP_B, lastShownStop: STOP_A }).verdict).toBe('legacy');
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

    it('adapter-configured goes to running only with stopOnEntry off and no stop recorded', () => {
      expect(evaluateTransition('starting', 'adapter-configured', 'running', { stopOnEntry: false }).verdict).toBe('legal');
      expect(evaluateTransition('starting', 'adapter-configured', 'running', { stopOnEntry: false, stop: STOP_A }).verdict).toBe('guard-not-met');
      expect(evaluateTransition('starting', 'adapter-configured', 'starting', { stopOnEntry: true }).verdict).toBe('legal');
      expect(evaluateTransition('starting', 'adapter-configured', 'running').verdict).toBe('unevaluated');
      expect(evaluateTransition('paused', 'adapter-configured', 'paused').verdict).toBe('legal');
    });
  });

  describe('virtual transitions (notes)', () => {
    it('take the row where it goes', () => {
      expect(evaluateVirtual('running', 'hot-restart')).toMatchObject({ verdict: 'legal', to: 'running' });
      expect(evaluateVirtual('paused', 'continued')).toMatchObject({ verdict: 'legal', to: 'paused' });
      expect(evaluateVirtual('failed', 'worker-exit')).toMatchObject({ verdict: 'legal', to: 'failed' });
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
      // `stale` is the next stage's: no code names it yet.
      expect(SESSION_EVENTS.filter((event) => !named.has(event))).toEqual(['stale']);
    });

    it('refuse an event their site does not name', () => {
      expect(siteNames('executeStep.sent', 'resume')).toBe(true);
      expect(siteNames('executeStep.sent', 'resume-refused')).toBe(false);
      expect(siteNames('no-such-site', 'resume')).toBe(false);
    });
  });
});
