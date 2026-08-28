import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain-JS module without type declarations
import {
  buildBackendEnvironment,
  updateBackendEnvOverrides,
} from '../../../tools/dev-proxy/backend-env.mjs';

describe('dev-proxy backend environment overrides', () => {
  it('preserves overrides when env is omitted', () => {
    const current = { DAP_TRACE: '1' };
    expect(updateBackendEnvOverrides(current, {})).toBe(current);
    expect(updateBackendEnvOverrides(current, undefined)).toBe(current);
  });

  it('replaces overrides when env is supplied and clears them with an empty map', () => {
    const current = { DAP_TRACE: '1', OLD: 'value' };
    expect(updateBackendEnvOverrides(current, { env: { DEBUG_MCP_LOG_LEVEL: 'debug' } })).toEqual({
      DEBUG_MCP_LOG_LEVEL: 'debug',
    });
    expect(updateBackendEnvOverrides(current, { env: {} })).toEqual({});
  });

  it('merges overrides without mutating inherited or stored values', () => {
    const inherited = { PATH: '/usr/bin', DAP_TRACE: '0' };
    const overrides = { DAP_TRACE: '1', CUSTOM: 'yes' };

    const result = buildBackendEnvironment(inherited, overrides);

    expect(result).toEqual({ PATH: '/usr/bin', DAP_TRACE: '1', CUSTOM: 'yes' });
    expect(inherited.DAP_TRACE).toBe('0');
    expect(overrides.DAP_TRACE).toBe('1');
  });

  it('applies proxy-controlled variables after user overrides', () => {
    const result = buildBackendEnvironment(
      { PATH: '/usr/bin' },
      { MCP_EXIT_ON_STDIN_CLOSE: '0' },
      { MCP_EXIT_ON_STDIN_CLOSE: '1' }
    );

    expect(result.MCP_EXIT_ON_STDIN_CLOSE).toBe('1');
  });
});
