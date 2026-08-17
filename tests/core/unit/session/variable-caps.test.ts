/**
 * Size guards for variable-inspection responses (issues #356/#359).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  applyVariableCaps,
  mergeTruncationSummaries,
  buildTruncationNotice,
  maxVariableValueChars,
  maxVariablesPerCall,
  maxVariablesTotalChars
} from '../../../../src/session/variable-caps.js';
import type { Variable } from '@debugmcp/shared';

function makeVar(name: string, value: string): Variable {
  return { name, value, type: 'str', expandable: false };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('applyVariableCaps', () => {
  it('returns small lists untouched with no truncation summary', () => {
    const vars = [makeVar('a', '1'), makeVar('b', 'two')];
    const result = applyVariableCaps(vars);
    expect(result.variables).toEqual(vars);
    expect(result.truncation).toBeUndefined();
  });

  it('cuts oversized values at the cap and flags them truncated', () => {
    const big = 'x'.repeat(maxVariableValueChars() + 500);
    const result = applyVariableCaps([makeVar('big', big), makeVar('small', 'ok')]);
    expect(result.variables[0].value.length).toBe(maxVariableValueChars());
    expect(result.variables[0].truncated).toBe(true);
    expect(result.variables[1].truncated).toBeUndefined();
    expect(result.truncation).toEqual({ omittedCount: 0, valueTruncatedCount: 1 });
  });

  it('drops variables beyond the count cap and reports them omitted', () => {
    const vars = Array.from({ length: maxVariablesPerCall() + 25 }, (_, i) => makeVar(`v${i}`, 'x'));
    const result = applyVariableCaps(vars);
    expect(result.variables.length).toBe(maxVariablesPerCall());
    expect(result.truncation).toEqual({ omittedCount: 25, valueTruncatedCount: 0 });
  });

  it('stops appending once the total-size budget is exhausted (issue #356 shape)', () => {
    vi.stubEnv('DEBUG_MCP_MAX_VARIABLES_TOTAL_CHARS', '2000');
    const vars = Array.from({ length: 10 }, (_, i) => makeVar(`v${i}`, 'y'.repeat(600)));
    const result = applyVariableCaps(vars);
    // 600-char values: 4 fit before the running total passes 2000
    expect(result.variables.length).toBeLessThan(10);
    expect(result.truncation!.omittedCount).toBe(10 - result.variables.length);
  });

  it('honors env overrides for the per-value and per-call caps', () => {
    vi.stubEnv('DEBUG_MCP_MAX_VARIABLE_VALUE_CHARS', '10');
    vi.stubEnv('DEBUG_MCP_MAX_VARIABLES', '2');
    const result = applyVariableCaps([
      makeVar('a', '0123456789ABCDEF'),
      makeVar('b', 'short'),
      makeVar('c', 'dropped')
    ]);
    expect(result.variables.length).toBe(2);
    expect(result.variables[0].value).toBe('0123456789');
    expect(result.variables[0].truncated).toBe(true);
    expect(result.truncation).toEqual({ omittedCount: 1, valueTruncatedCount: 1 });
  });

  it('ignores invalid env overrides and keeps the defaults', () => {
    vi.stubEnv('DEBUG_MCP_MAX_VARIABLES', 'banana');
    vi.stubEnv('DEBUG_MCP_MAX_VARIABLE_VALUE_CHARS', '-5');
    expect(maxVariablesPerCall()).toBe(300);
    expect(maxVariableValueChars()).toBe(1024);
    expect(maxVariablesTotalChars()).toBe(256 * 1024);
  });
});

describe('mergeTruncationSummaries', () => {
  it('returns undefined when nothing was truncated', () => {
    expect(mergeTruncationSummaries([undefined, undefined])).toBeUndefined();
    expect(mergeTruncationSummaries([{ omittedCount: 0, valueTruncatedCount: 0 }])).toBeUndefined();
  });

  it('sums counts across summaries including scopesSkipped', () => {
    expect(mergeTruncationSummaries([
      { omittedCount: 2, valueTruncatedCount: 1 },
      undefined,
      { omittedCount: 3, valueTruncatedCount: 0, scopesSkipped: 4 }
    ])).toEqual({ omittedCount: 5, valueTruncatedCount: 1, scopesSkipped: 4 });
  });
});

describe('buildTruncationNotice', () => {
  it('names each kind of cut and points at the names escape hatch', () => {
    const notice = buildTruncationNotice({ omittedCount: 7, valueTruncatedCount: 2, scopesSkipped: 1 });
    expect(notice).toContain('7 variable(s) omitted');
    expect(notice).toContain('2 value(s) cut');
    expect(notice).toContain('1 scope(s) not fetched');
    expect(notice).toContain('names: ["a","b"]');
    expect(notice).toContain('DEBUG_MCP_MAX_VARIABLES');
  });
});
