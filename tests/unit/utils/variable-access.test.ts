import { describe, it, expect } from 'vitest';
import {
  VARIABLE_ACCESS_ENV_KEY,
  DEFAULT_VARIABLE_ACCESS,
  getVariableAccessMode,
  requiresExplicitNames,
} from '../../../src/utils/variable-access.js';

function envWith(value: string | undefined) {
  return {
    get: (key: string) => (key === VARIABLE_ACCESS_ENV_KEY ? value : undefined),
  };
}

describe('variable access mode helpers', () => {
  it('defaults to open when the env variable is unset', () => {
    expect(getVariableAccessMode(envWith(undefined))).toBe('open');
    expect(DEFAULT_VARIABLE_ACCESS).toBe('open');
  });

  it('defaults to open for empty or whitespace-only values', () => {
    expect(getVariableAccessMode(envWith(''))).toBe('open');
    expect(getVariableAccessMode(envWith('   '))).toBe('open');
  });

  it('parses each valid mode, normalizing case and whitespace', () => {
    expect(getVariableAccessMode(envWith('open'))).toBe('open');
    expect(getVariableAccessMode(envWith('explicit'))).toBe('explicit');
    expect(getVariableAccessMode(envWith(' EXPLICIT '))).toBe('explicit');
  });

  it('falls back to open for invalid values', () => {
    expect(getVariableAccessMode(envWith('strict'))).toBe('open');
    expect(getVariableAccessMode(envWith('1'))).toBe('open');
    expect(getVariableAccessMode(envWith('true'))).toBe('open');
  });

  it('requires explicit names only in explicit mode', () => {
    expect(requiresExplicitNames('open')).toBe(false);
    expect(requiresExplicitNames('explicit')).toBe(true);
  });

  it('uses the documented env key', () => {
    expect(VARIABLE_ACCESS_ENV_KEY).toBe('DEBUG_MCP_VARIABLE_ACCESS');
  });
});
