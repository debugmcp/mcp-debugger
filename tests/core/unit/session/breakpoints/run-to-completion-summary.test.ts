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
  adapterCapabilities?: { supportsLogPoints?: boolean };
};

function build(session: BuilderSession) {
  return buildRunToCompletionSummary(
    session as unknown as Pick<ManagedSession, 'breakpoints' | 'functionBreakpoints' | 'exitCode' | 'lastStop' | 'adapterCapabilities'>
  );
}

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
});
