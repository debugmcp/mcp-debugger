/**
 * toSourceBreakpoint — the single mapper from stored Breakpoint fields to a
 * DAP SourceBreakpoint (issue #235). Every construction site (live re-send,
 * worker initial breakpoints, connection-manager helper, js-debug handshake)
 * must use it so no optional field is silently dropped on any path.
 */
import { describe, it, expect } from 'vitest';
import { toSourceBreakpoint } from '../../src/index.js';

describe('toSourceBreakpoint', () => {
  it('maps a plain line-only breakpoint', () => {
    expect(toSourceBreakpoint({ line: 10 })).toEqual({ line: 10 });
  });

  it('includes condition when set', () => {
    expect(toSourceBreakpoint({ line: 5, condition: 'x > 1' }))
      .toEqual({ line: 5, condition: 'x > 1' });
  });

  it('includes logMessage when set (logpoint)', () => {
    expect(toSourceBreakpoint({ line: 7, logMessage: 'x={x}' }))
      .toEqual({ line: 7, logMessage: 'x={x}' });
  });

  it('allows condition and logMessage together (DAP-defined combination)', () => {
    expect(toSourceBreakpoint({ line: 7, condition: 'x > 1', logMessage: 'x={x}' }))
      .toEqual({ line: 7, condition: 'x > 1', logMessage: 'x={x}' });
  });

  it('passes suspendPolicy through as a non-standard field', () => {
    expect(toSourceBreakpoint({ line: 3, suspendPolicy: 'thread' }))
      .toEqual({ line: 3, suspendPolicy: 'thread' });
  });

  it('omits keys for absent optional fields entirely', () => {
    const result = toSourceBreakpoint({ line: 10 });
    expect(Object.keys(result)).toEqual(['line']);
  });
});
