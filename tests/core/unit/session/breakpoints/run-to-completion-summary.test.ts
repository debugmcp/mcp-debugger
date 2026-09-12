/**
 * buildRunToCompletionSummary (issue #701): a launch that ended before any
 * user-visible stop must say the program exited, with what code, and which
 * breakpoints — verified ones included — it ran past.
 */
import { describe, it, expect } from 'vitest';
import { buildRunToCompletionSummary } from '../../../../../src/session/breakpoints/launch-warnings.js';
import type { ManagedSession } from '../../../../../src/session/session-store.js';

type BuilderSession = {
  breakpoints: Map<string, { file: string; line: number; verified: boolean; message?: string }>;
  exitCode?: number;
};

function build(session: BuilderSession, scriptPath = '/work/app.js') {
  return buildRunToCompletionSummary(
    session as unknown as Pick<ManagedSession, 'breakpoints' | 'exitCode'>,
    scriptPath
  );
}

describe('buildRunToCompletionSummary', () => {
  it('names the exit code and every breakpoint the program ran past, verified or not', () => {
    const summary = build({
      exitCode: 3,
      breakpoints: new Map([
        ['a', { file: '/work/src/app.ts', line: 91, verified: true }],
        ['b', { file: '/work/src/other.ts', line: 12, verified: false, message: 'Unbound breakpoint' }]
      ])
    });
    expect(summary.exitCode).toBe(3);
    expect(summary.unhitBreakpoints).toEqual([
      { file: '/work/src/app.ts', line: 91, verified: true },
      { file: '/work/src/other.ts', line: 12, verified: false }
    ]);
    expect(summary.message.startsWith('Debugging started for /work/app.js. Current state: stopped.')).toBe(true);
    expect(summary.message).toContain('ran to completion (exit code 3) without hitting any breakpoint.');
  });

  it('points at the entry stop only when a verified breakpoint went unhit', () => {
    const verified = build({
      breakpoints: new Map([['a', { file: '/work/src/app.ts', line: 91, verified: true }]])
    });
    expect(verified.message).toContain('A verified breakpoint was never hit.');
    expect(verified.message).toContain('dapLaunchArgs: { stopOnEntry: true }');

    const unbound = build({
      breakpoints: new Map([['a', { file: '/work/src/app.ts', line: 91, verified: false }]])
    });
    expect(unbound.message).not.toContain('stopOnEntry');
  });

  it('omits the exit code when the debuggee never reported one, and the breakpoint clause when there are none', () => {
    const summary = build({ breakpoints: new Map() });
    expect(summary.exitCode).toBeUndefined();
    expect('exitCode' in summary).toBe(false);
    expect(summary.unhitBreakpoints).toEqual([]);
    expect(summary.message).toBe('Debugging started for /work/app.js. Current state: stopped. The program ran to completion.');
  });

  it('treats exit code 0 as a reported code', () => {
    expect(build({ exitCode: 0, breakpoints: new Map() }).exitCode).toBe(0);
    expect(build({ exitCode: 0, breakpoints: new Map() }).message).toContain('(exit code 0)');
  });
});
