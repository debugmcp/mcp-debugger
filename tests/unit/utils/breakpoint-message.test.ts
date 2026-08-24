import { describe, it, expect } from 'vitest';
import { normalizeBreakpointMessage } from '../../../src/utils/breakpoint-message.js';

describe('normalizeBreakpointMessage', () => {
  it('clears the provisional message once the breakpoint is verified', () => {
    expect(normalizeBreakpointMessage('breakpoint.provisionalBreakpoint', true)).toBeUndefined();
  });

  it('resolves the provisional key to its English fallback while still unverified', () => {
    expect(normalizeBreakpointMessage('breakpoint.provisionalBreakpoint', false)).toBe(
      'Unbound breakpoint'
    );
  });

  it('clears the translated provisional text once verified', () => {
    // The provisional note is often stamped while still unverified (stored in
    // translated form) and the later bind event carries no message — the
    // stored text is re-normalized, so the translated form must clear too.
    expect(normalizeBreakpointMessage('Unbound breakpoint', true)).toBeUndefined();
  });

  it('keeps the translated provisional text while still unverified', () => {
    expect(normalizeBreakpointMessage('Unbound breakpoint', false)).toBe('Unbound breakpoint');
  });

  it('never surfaces a raw l10n key', () => {
    for (const verified of [true, false]) {
      const out = normalizeBreakpointMessage('breakpoint.provisionalBreakpoint', verified);
      expect(out ?? '').not.toMatch(/^breakpoint\./);
    }
  });

  it('passes through a real adapter message unchanged', () => {
    const msg = 'Could not resolve source map for this file';
    expect(normalizeBreakpointMessage(msg, true)).toBe(msg);
    expect(normalizeBreakpointMessage(msg, false)).toBe(msg);
  });

  it('leaves an absent message absent', () => {
    expect(normalizeBreakpointMessage(undefined, true)).toBeUndefined();
    expect(normalizeBreakpointMessage(undefined, false)).toBeUndefined();
  });
});
