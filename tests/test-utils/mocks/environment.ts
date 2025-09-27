import { vi } from 'vitest';

export interface EnvironmentMock {
  get: (key: string) => string | undefined;
  getEnv: () => Record<string, string>;
  isWindows: () => boolean;
}

/**
 * Reusable Environment mock compatible with src/utils/container-path-utils.ts
 * - get(key): required (used for 'MCP_CONTAINER')
 * - getEnv(): returns an object of env vars (empty by default)
 * - isWindows(): platform check
 *
 * Defaults:
 * - get('MCP_CONTAINER') => 'false' (host mode by default in tests)
 * - get(other) => process.env[other]
 */
export function createEnvironmentMock(overrides?: Partial<EnvironmentMock>): EnvironmentMock {
  const mock: EnvironmentMock = {
    get: vi.fn((key: string) => (key === 'MCP_CONTAINER' ? 'false' : process.env[key])),
    getEnv: vi.fn(() => ({})),
    isWindows: vi.fn(() => process.platform === 'win32'),
  };
  return { ...mock, ...(overrides || {}) };
}
