import { describe, it, expect, vi } from 'vitest';
import { getDisabledLanguages, isLanguageDisabled } from '../../../src/utils/language-config.js';

describe('language configuration helpers', () => {
  it('parses disabled languages from environment variable', () => {
    vi.stubEnv('DEBUG_MCP_DISABLE_LANGUAGES', 'python,  Rust , ,  mock');

    const disabled = getDisabledLanguages();

    expect(disabled).toEqual(new Set(['python', 'rust', 'mock']));
  });

  it('returns empty set when env variable missing', () => {
    vi.stubEnv('DEBUG_MCP_DISABLE_LANGUAGES', undefined);
    expect(getDisabledLanguages()).toEqual(new Set());
  });

  it('detects disabled language with case insensitivity', () => {
    vi.stubEnv('DEBUG_MCP_DISABLE_LANGUAGES', 'PYTHON,RUST');

    expect(isLanguageDisabled('python')).toBe(true);
    expect(isLanguageDisabled('Rust')).toBe(true);
    expect(isLanguageDisabled('mock')).toBe(false);
  });

  it('returns false for falsy language input', () => {
    vi.stubEnv('DEBUG_MCP_DISABLE_LANGUAGES', 'python');
    expect(isLanguageDisabled('')).toBe(false);
    expect(isLanguageDisabled(null as unknown as string)).toBe(false);
  });
});
