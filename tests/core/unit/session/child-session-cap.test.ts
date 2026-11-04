import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAX_CHILD_SESSIONS, MAX_CHILD_SESSIONS_ENV, maxChildSessions } from '../../../../src/session/child-session-cap.js';
import { createMockEnvironment } from './session-manager-test-utils.js';

describe('maxChildSessions', () => {
  it.each([undefined, '', '  ', '-1', '1.5', 'invalid', 'Infinity'])('uses the default for %s', (raw) => {
    const environment = createMockEnvironment();
    vi.mocked(environment.get).mockReturnValue(raw);
    expect(maxChildSessions(environment)).toBe(DEFAULT_MAX_CHILD_SESSIONS);
    expect(environment.get).toHaveBeenCalledWith(MAX_CHILD_SESSIONS_ENV);
  });

  it.each([{ raw: '0', expected: 0 }, { raw: '1', expected: 1 }, { raw: ' 64 ', expected: 64 }])('accepts the explicit cap $raw', ({ raw, expected }) => {
    const environment = createMockEnvironment();
    vi.mocked(environment.get).mockReturnValue(raw);
    expect(maxChildSessions(environment)).toBe(expected);
  });
});
