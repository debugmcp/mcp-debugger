/**
 * describeLaunchArming (issue #815): what a launch has armed that could stop
 * it — the pausing line breakpoints, the function breakpoints, an entry
 * stop, a caught-exception filter — which words the "still running" answer
 * of a launch or a wait_for_stop (issues #823, #826).
 */
import { describe, it, expect } from 'vitest';
import type { Breakpoint, FunctionBreakpoint } from '@debugmcp/shared';
import { describeLaunchArming, type ArmingSession } from '../../../../../src/session/launch/launch-arming.js';

function session(overrides: Partial<ArmingSession> = {}): ArmingSession {
  return {
    breakpoints: new Map<string, Breakpoint>(),
    functionBreakpoints: new Map<string, FunctionBreakpoint>(),
    adapterCapabilities: undefined,
    effectiveBreakOnExceptions: undefined,
    ...overrides
  };
}

const lineBp = (id: string, logMessage?: string): Breakpoint => ({
  id, file: '/proj/app.py', line: 10, verified: false, ...(logMessage !== undefined ? { logMessage } : {})
});
const fnBp = (id: string): FunctionBreakpoint => ({ id, functionName: `handler_${id}`, verified: false });

describe('describeLaunchArming', () => {
  it('is unarmed for a bare launch: no breakpoints, no entry stop, no caught-exception filter', () => {
    const arming = describeLaunchArming(session(), undefined);
    expect(arming.armed).toBe(false);
    expect(arming.summary).toBe('');
  });

  it("does not count the 'uncaught' default as armed — a crash is not a stop that comes soon", () => {
    expect(describeLaunchArming(session({ effectiveBreakOnExceptions: 'uncaught' }), false).armed).toBe(false);
    expect(describeLaunchArming(session({ effectiveBreakOnExceptions: 'none' }), false).armed).toBe(false);
  });

  it("counts breakOnExceptions 'all' as armed", () => {
    const arming = describeLaunchArming(session({ effectiveBreakOnExceptions: 'all' }), false);
    expect(arming.armed).toBe(true);
    expect(arming.summary).toMatch(/breakOnExceptions: 'all'/);
  });

  it('counts a requested entry stop as armed', () => {
    const arming = describeLaunchArming(session(), true);
    expect(arming.armed).toBe(true);
    expect(arming.summary).toBe('an entry stop');
  });

  it('counts line and function breakpoints, and words them like the launch warnings do', () => {
    const s = session();
    s.breakpoints.set('a', lineBp('a'));
    s.breakpoints.set('b', lineBp('b'));
    s.functionBreakpoints.set('f', fnBp('f'));
    const arming = describeLaunchArming(s, false);
    expect(arming.armed).toBe(true);
    expect(arming.lineBreakpoints).toBe(2);
    expect(arming.functionBreakpoints).toBe(1);
    expect(arming.summary).toBe('2 breakpoint(s) and 1 function breakpoint(s)');
  });

  it('leaves logpoints out when the adapter runs them on, and counts them as pausing breakpoints when it does not', () => {
    const s = session({ adapterCapabilities: { supportsLogPoints: true } });
    s.breakpoints.set('lp', lineBp('lp', 'x={x}'));
    expect(describeLaunchArming(s, false).armed).toBe(false);

    // No capability advertised: the logpoint was downgraded to a pausing
    // breakpoint (issue #469), so it can stop the program.
    const downgraded = session({ adapterCapabilities: { supportsLogPoints: false } });
    downgraded.breakpoints.set('lp', lineBp('lp', 'x={x}'));
    const arming = describeLaunchArming(downgraded, false);
    expect(arming.armed).toBe(true);
    expect(arming.logpointsThatPause).toBe(1);
    expect(arming.summary).toMatch(/1 logpoint\(s\) downgraded to pausing breakpoint\(s\)/);

    // Capabilities not captured yet (no handshake): assume the logpoint pauses.
    const unknown = session({ adapterCapabilities: undefined });
    unknown.breakpoints.set('lp', lineBp('lp', 'x={x}'));
    expect(describeLaunchArming(unknown, false).armed).toBe(true);
  });

  it('names logpoints the adapter runs on as logging without stopping, apart from the armed summary (issue #865)', () => {
    const s = session({ adapterCapabilities: { supportsLogPoints: true } });
    s.breakpoints.set('lp1', lineBp('lp1', 'x={x}'));
    s.breakpoints.set('lp2', lineBp('lp2', 'y={y}'));
    const arming = describeLaunchArming(s, false);

    // They do not stop the program: not armed, not in the armed summary...
    expect(arming.armed).toBe(false);
    expect(arming.summary).toBe('');
    // ...but counted and worded, so the answer can say what IS set.
    expect(arming.logpoints).toBe(2);
    expect(arming.loggingSummary).toBe('2 logpoint(s) that log without stopping');

    // Alongside a pausing breakpoint, both summaries stand.
    s.breakpoints.set('bp', lineBp('bp'));
    const both = describeLaunchArming(s, false);
    expect(both.armed).toBe(true);
    expect(both.summary).toBe('1 breakpoint(s)');
    expect(both.loggingSummary).toBe('2 logpoint(s) that log without stopping');

    // Nothing to say when there are none.
    expect(describeLaunchArming(session(), false).logpoints).toBe(0);
    expect(describeLaunchArming(session(), false).loggingSummary).toBeUndefined();
    // A downgraded logpoint is a pausing breakpoint, not a logging one.
    const downgraded = session({ adapterCapabilities: { supportsLogPoints: false } });
    downgraded.breakpoints.set('lp', lineBp('lp', 'x={x}'));
    expect(describeLaunchArming(downgraded, false).logpoints).toBe(0);
    expect(describeLaunchArming(downgraded, false).loggingSummary).toBeUndefined();
  });

  it('lists every armed clause in one summary', () => {
    const s = session({ effectiveBreakOnExceptions: 'all' });
    s.breakpoints.set('a', lineBp('a'));
    s.functionBreakpoints.set('f', fnBp('f'));
    expect(describeLaunchArming(s, true).summary).toBe(
      "1 breakpoint(s), 1 function breakpoint(s), an entry stop and breakOnExceptions: 'all'"
    );
  });
});
