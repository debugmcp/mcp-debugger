/**
 * buildRunToCompletionSummary (issue #701): a launch that ended STOPPED must
 * say how the program ended, with what code, and which breakpoints it ran
 * past — unless a stop was recorded before the exit, in which case the
 * breakpoints were not all missed and the stop is named instead.
 */
import { describe, it, expect } from 'vitest';
import { buildRunToCompletionSummary } from '../../../../../src/session/breakpoints/launch-warnings.js';
import type { ManagedSession } from '../../../../../src/session/session-store.js';

type LineBp = { file: string; line: number; requestedLine?: number; verified: boolean; message?: string; logMessage?: string };
type FnBp = { functionName: string; verified: boolean };
type BuilderSession = {
  breakpoints: Map<string, LineBp>;
  functionBreakpoints?: Map<string, FnBp>;
  exitCode?: number;
  lastStop?: { reason: string };
  descendantStops?: number;
  adapterCapabilities?: { supportsLogPoints?: boolean };
  programEndExplanation?: { note?: string; data?: Record<string, unknown> };
};

function build(session: BuilderSession) {
  return buildRunToCompletionSummary(
    session as unknown as Pick<ManagedSession, 'breakpoints' | 'functionBreakpoints' | 'exitCode' | 'lastStop' | 'descendantStops' | 'adapterCapabilities' | 'programEndExplanation'>
  );
}

// Issue #1128: the summary was read off the root alone. A child session's
// stops are recorded on the child, and its breakpoints are copies — so a
// root whose child stopped on child.py:12 twice ended with "without hitting
// any breakpoint. Verified but never hit: child.py:12". The rule a single
// session already has (a stop recorded in the run withholds the list) now
// covers the session's tree.
describe('buildRunToCompletionSummary for a session whose child sessions stopped (issue #1128)', () => {
  const childBreakpoint = (): Map<string, LineBp> =>
    new Map([['a', { file: '/work/tree/child.py', line: 12, verified: true }]]);

  it('does not say the program hit nothing, and lists no breakpoint as unhit', () => {
    const result = build({ exitCode: 0, breakpoints: childBreakpoint(), descendantStops: 2 });

    expect(result.summary).toBe('The program ran to completion (exit code 0). Its child sessions stopped 2 times during this run.');
    expect(result.data).toEqual({ exitCode: 0 });
  });

  it('counts one stop as one', () => {
    expect(build({ exitCode: 0, breakpoints: childBreakpoint(), descendantStops: 1 }).summary)
      .toBe('The program ran to completion (exit code 0). Its child sessions stopped 1 time during this run.');
  });

  it('covers a breakpoint the root never bound as well: it is not reported as never bound and never hit', () => {
    const result = build({
      exitCode: 0,
      breakpoints: new Map([['a', { file: '/work/tree/child.js', line: 14, verified: false, message: 'Unbound breakpoint' }]]),
      descendantStops: 2
    });

    expect(result.summary).not.toContain('without hitting any breakpoint');
    expect(result.data).not.toHaveProperty('unhitBreakpoints');
  });

  it("keeps the session's own unreported stop first: that is the more specific fact", () => {
    const result = build({ exitCode: 0, breakpoints: childBreakpoint(), lastStop: { reason: 'breakpoint' }, descendantStops: 2 });

    expect(result.summary).toBe('The program ran to completion (exit code 0) after a stop the launch could not report (last stop: breakpoint).');
  });

  it('a tree that never stopped is summarized as before', () => {
    expect(build({ exitCode: 0, breakpoints: childBreakpoint() }).summary)
      .toBe('The program ran to completion (exit code 0) without hitting any breakpoint. Verified but never hit: child.py:12.');
  });

  it("still joins the adapter's reading of the end", () => {
    const result = build({
      exitCode: 0,
      breakpoints: childBreakpoint(),
      descendantStops: 1,
      programEndExplanation: { note: 'The device went away.' }
    });

    expect(result.summary).toBe(
      'The program ran to completion (exit code 0). Its child sessions stopped 1 time during this run. The device went away.'
    );
  });
});

describe('buildRunToCompletionSummary', () => {
  it('names a non-zero exit as an exit, a zero as a completed run, and a missing code as unreported', () => {
    const none = new Map<string, LineBp>();
    expect(build({ exitCode: 3, breakpoints: none }).summary).toBe('The program exited with code 3.');
    expect(build({ exitCode: 0, breakpoints: none }).summary).toBe('The program ran to completion (exit code 0).');
    expect(build({ breakpoints: none }).summary).toBe('The program ended without reporting an exit code.');
    expect(build({ exitCode: 0, breakpoints: none }).data).toEqual({ exitCode: 0, unhitBreakpoints: [] });
    expect('exitCode' in build({ breakpoints: none }).data).toBe(false);
  });

  it('lists every breakpoint the program ran past and names the verified ones, line and function alike', () => {
    const result = build({
      exitCode: 0,
      breakpoints: new Map([
        ['a', { file: '/work/src/app.ts', line: 93, requestedLine: 91, verified: true }],
        ['b', { file: '/work/src/other.ts', line: 12, verified: false, message: 'Unbound breakpoint' }]
      ]),
      functionBreakpoints: new Map([
        ['f', { functionName: 'helper', verified: true }],
        ['g', { functionName: 'missing', verified: false }]
      ])
    });
    expect(result.data.unhitBreakpoints).toEqual([
      { file: '/work/src/app.ts', line: 93, requestedLine: 91, verified: true },
      { file: '/work/src/other.ts', line: 12, verified: false }
    ]);
    expect(result.summary).toBe(
      "The program ran to completion (exit code 0) without hitting any breakpoint. Verified but never hit: app.ts:93, function 'helper'."
    );
  });

  it('keeps the breakpoint clause without the verified sentence when nothing was verified', () => {
    const result = build({
      exitCode: 0,
      breakpoints: new Map([['b', { file: '/work/src/other.ts', line: 12, verified: false }]])
    });
    expect(result.summary).toBe('The program ran to completion (exit code 0) without hitting any breakpoint.');
  });

  it('leaves out logpoints the adapter supports, and keeps a downgraded one', () => {
    const logpoint = { file: '/work/src/app.ts', line: 5, verified: true, logMessage: 'x={x}' };
    const supported = build({
      exitCode: 0,
      breakpoints: new Map([['l', logpoint]]),
      adapterCapabilities: { supportsLogPoints: true }
    });
    expect(supported.data.unhitBreakpoints).toEqual([]);
    expect(supported.summary).toBe('The program ran to completion (exit code 0).');

    const downgraded = build({
      exitCode: 0,
      breakpoints: new Map([['l', logpoint]]),
      adapterCapabilities: { supportsLogPoints: false }
    });
    expect(downgraded.data.unhitBreakpoints).toHaveLength(1);
    expect(downgraded.summary).toContain('Verified but never hit: app.ts:5.');
  });

  it('withholds the list and names the stop when one was recorded before the exit', () => {
    const result = build({
      exitCode: 0,
      lastStop: { reason: 'breakpoint' },
      breakpoints: new Map([['a', { file: '/work/src/app.ts', line: 91, verified: true }]])
    });
    expect(result.summary).toBe(
      'The program ran to completion (exit code 0) after a stop the launch could not report (last stop: breakpoint).'
    );
    expect(result.data).toEqual({ exitCode: 0 });
  });

  it("joins the adapter's reading of the end to the sentence and the data, its own fields winning (issue #877)", () => {
    const { summary, data } = build({
      breakpoints: new Map(),
      exitCode: 1,
      programEndExplanation: { note: 'the device list.', data: { exitCode: 99, availableDevices: [{ id: 'windows' }] } },
    });

    expect(summary).toMatch(/exited with code 1/);
    expect(summary.endsWith(' the device list.')).toBe(true);
    expect(data.exitCode).toBe(1);
    expect((data as Record<string, unknown>).availableDevices).toEqual([{ id: 'windows' }]);
  });
});
