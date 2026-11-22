/**
 * The id lookups of the breakpoint store (issue #1220): an adapter id names a
 * record only while exactly one record holds it.
 */
import { describe, it, expect } from 'vitest';
import type { Breakpoint, FunctionBreakpoint } from '@debugmcp/shared';
import { applyHitBreakpointIds, soleHolderOf } from '../../../../../src/session/breakpoints/hit-verification.js';

const line = (id: string, lineNumber: number, adapterId: number | undefined, verified: boolean): Breakpoint =>
  ({ id, file: '/w/app.js', line: lineNumber, verified, ...(adapterId !== undefined ? { adapterId } : {}) }) as Breakpoint;

const sessionOf = (lines: Breakpoint[], functions: FunctionBreakpoint[] = []) => ({
  breakpoints: new Map(lines.map((bp) => [bp.id, bp])),
  functionBreakpoints: new Map(functions.map((bp) => [bp.id, bp]))
});

describe('soleHolderOf', () => {
  it('answers the one record that holds the id, and nothing when none or several do', () => {
    const a = line('a', 5, 1, true);
    const b = line('b', 8, 2, true);
    const c = line('c', 9, 2, true);
    expect(soleHolderOf([a, b, c], 1)).toBe(a);
    expect(soleHolderOf([a, b, c], 2)).toBeUndefined();
    expect(soleHolderOf([a, b, c], 7)).toBeUndefined();
  });
});

describe('applyHitBreakpointIds', () => {
  it('upgrades the unverified record a hit names', () => {
    const a = line('a', 5, 1, false);
    const upgraded = applyHitBreakpointIds(sessionOf([a, line('b', 8, 2, false)]), [1]);
    expect(a).toMatchObject({ verified: true, verifiedBy: 'hit' });
    expect(upgraded.map((hit) => hit.breakpoint)).toEqual([a]);
  });

  it('credits no record for an id two of them share: the stop says which id, not which of the two (#1220)', () => {
    // Measured with js-debug on a fork connection: a breakpoint added after
    // the attach got the id an earlier, still unbound one held, and the stop
    // on the newer one named that id.
    const earlier = line('a', 5, 1, false);
    const later = line('b', 8, 1, true);
    const upgraded = applyHitBreakpointIds(sessionOf([earlier, later]), [1]);
    expect(upgraded).toEqual([]);
    expect(earlier.verified).toBe(false);
  });

  it('does not fall through to a function breakpoint when the id is shared among line breakpoints', () => {
    const fn = { id: 'f', functionName: 'handle', verified: false, adapterId: 1 } as FunctionBreakpoint;
    const upgraded = applyHitBreakpointIds(sessionOf([line('a', 5, 1, true), line('b', 8, 1, true)], [fn]), [1]);
    expect(upgraded).toEqual([]);
    expect(fn.verified).toBe(false);
  });
});
