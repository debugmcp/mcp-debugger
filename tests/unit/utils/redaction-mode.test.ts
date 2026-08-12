import { describe, it, expect } from 'vitest';
import {
  REDACTION_ENV_KEY,
  isRedactionEnabled,
} from '../../../src/utils/redaction-mode.js';

function envWith(value: string | undefined) {
  return {
    get: (key: string) => (key === REDACTION_ENV_KEY ? value : undefined),
  };
}

describe('redaction mode helper', () => {
  it('is enabled by default when the env variable is unset', () => {
    expect(isRedactionEnabled(envWith(undefined))).toBe(true);
  });

  it('stays enabled for empty or whitespace-only values', () => {
    expect(isRedactionEnabled(envWith(''))).toBe(true);
    expect(isRedactionEnabled(envWith('   '))).toBe(true);
  });

  it('is disabled by DEBUG_MCP_NO_REDACT=1 or true (any case, padded)', () => {
    expect(isRedactionEnabled(envWith('1'))).toBe(false);
    expect(isRedactionEnabled(envWith('true'))).toBe(false);
    expect(isRedactionEnabled(envWith(' TRUE '))).toBe(false);
    expect(isRedactionEnabled(envWith('True'))).toBe(false);
  });

  it('stays enabled for other values (0, false, random text)', () => {
    expect(isRedactionEnabled(envWith('0'))).toBe(true);
    expect(isRedactionEnabled(envWith('false'))).toBe(true);
    expect(isRedactionEnabled(envWith('yes please'))).toBe(true);
  });

  it('uses the documented env key', () => {
    expect(REDACTION_ENV_KEY).toBe('DEBUG_MCP_NO_REDACT');
  });
});
