import { describe, it, expect, beforeEach } from 'vitest';
import { getDisabledLanguages, isLanguageDisabled } from '../../../src/utils/language-config.js';

const originalEnv = { ...process.env };

describe('language configuration helpers', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('parses disabled languages from environment variable', () => {
    process.env.DEBUG_MCP_DISABLE_LANGUAGES = 'python,  Rust , ,  mock';

    const disabled = getDisabledLanguages();

    expect(disabled).toEqual(new Set(['python', 'rust', 'mock']));
  });

  it('returns empty set when env variable missing', () => {
    delete process.env.DEBUG_MCP_DISABLE_LANGUAGES;
    expect(getDisabledLanguages()).toEqual(new Set());
  });

  it('detects disabled language with case insensitivity', () => {
    process.env.DEBUG_MCP_DISABLE_LANGUAGES = 'PYTHON,RUST';

    expect(isLanguageDisabled('python')).toBe(true);
    expect(isLanguageDisabled('Rust')).toBe(true);
    expect(isLanguageDisabled('mock')).toBe(false);
  });

  it('returns false for falsy language input', () => {
    process.env.DEBUG_MCP_DISABLE_LANGUAGES = 'python';
    expect(isLanguageDisabled('')).toBe(false);
    expect(isLanguageDisabled(null as unknown as string)).toBe(false);
  });
});
