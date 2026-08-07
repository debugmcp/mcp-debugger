import { describe, it, expect } from 'vitest';
import {
  BP_ADDRESSING_ENV_KEY,
  DEFAULT_BP_ADDRESSING,
  getBpAddressingMode,
  supportsExpectedContent,
  supportsStatementAnchors,
  supportsLoudSnapping,
} from '../../../src/utils/bp-addressing.js';

function envWith(value: string | undefined) {
  return {
    get: (key: string) => (key === BP_ADDRESSING_ENV_KEY ? value : undefined),
  };
}

describe('breakpoint addressing mode helpers', () => {
  it('defaults to content when the env variable is unset', () => {
    expect(getBpAddressingMode(envWith(undefined))).toBe('content');
    expect(DEFAULT_BP_ADDRESSING).toBe('content');
  });

  it('defaults to content for empty or whitespace-only values', () => {
    expect(getBpAddressingMode(envWith(''))).toBe('content');
    expect(getBpAddressingMode(envWith('   '))).toBe('content');
  });

  it('parses each valid mode', () => {
    expect(getBpAddressingMode(envWith('line'))).toBe('line');
    expect(getBpAddressingMode(envWith('assert'))).toBe('assert');
    expect(getBpAddressingMode(envWith('content'))).toBe('content');
  });

  it('normalizes case and surrounding whitespace', () => {
    expect(getBpAddressingMode(envWith(' LINE '))).toBe('line');
    expect(getBpAddressingMode(envWith('Assert'))).toBe('assert');
  });

  it('falls back to content for invalid values', () => {
    expect(getBpAddressingMode(envWith('full'))).toBe('content');
    expect(getBpAddressingMode(envWith('1'))).toBe('content');
    expect(getBpAddressingMode(envWith('statement'))).toBe('content');
  });

  it('gates expectedContent to assert and content modes', () => {
    expect(supportsExpectedContent('line')).toBe(false);
    expect(supportsExpectedContent('assert')).toBe(true);
    expect(supportsExpectedContent('content')).toBe(true);
  });

  it('gates statement anchors to content mode only', () => {
    expect(supportsStatementAnchors('line')).toBe(false);
    expect(supportsStatementAnchors('assert')).toBe(false);
    expect(supportsStatementAnchors('content')).toBe(true);
  });

  it('gates loud snapping to assert and content modes', () => {
    expect(supportsLoudSnapping('line')).toBe(false);
    expect(supportsLoudSnapping('assert')).toBe(true);
    expect(supportsLoudSnapping('content')).toBe(true);
  });
});
