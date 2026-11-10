import { describe, expect, it } from 'vitest';
import {
  buildBackendEnvironment,
  resolveBackendPort,
  resolveBackendTransport,
  updateBackendEnvOverrides,
  withBackendDefaults,
} from '../../../tools/dev-proxy/backend-env.mjs';

describe('dev-proxy backend port (issue #689)', () => {
  it('defaults to 3001 when DEV_PROXY_PORT is unset or empty, and accepts an integer in 1-65535', () => {
    expect(resolveBackendPort(undefined)).toBe(3001);
    expect(resolveBackendPort('')).toBe(3001);
    expect(resolveBackendPort('3005')).toBe(3005);
    expect(resolveBackendPort('65535')).toBe(65535);
  });

  it.each(['abc', '3001x', '-5', '0', '70000', '1.5', ' 3001'])(
    "refuses '%s' by name instead of dialing a truncated or NaN port",
    (raw) => {
      expect(() => resolveBackendPort(raw)).toThrow(/DEV_PROXY_PORT/);
      expect(() => resolveBackendPort(raw)).toThrow(raw);
    }
  );
});

describe('dev-proxy backend transport (issue #1078)', () => {
  it('defaults to http when DEV_PROXY_BACKEND_TRANSPORT is unset or empty, and accepts http or stdio', () => {
    expect(resolveBackendTransport(undefined)).toBe('http');
    expect(resolveBackendTransport('')).toBe('http');
    expect(resolveBackendTransport('http')).toBe('http');
    expect(resolveBackendTransport('stdio')).toBe('stdio');
  });

  it.each(['sse', 'HTTP', 'websocket', ' http'])(
    "refuses '%s' by name instead of silently picking a transport",
    (raw) => {
      expect(() => resolveBackendTransport(raw)).toThrow(/DEV_PROXY_BACKEND_TRANSPORT/);
      expect(() => resolveBackendTransport(raw)).toThrow(raw);
    }
  );
});

describe('dev-proxy backend environment overrides', () => {
  it.each([null, [], 'wrong', { FLAG: 1 }])('rejects an invalid env map: %j', (env) => {
    expect(() => updateBackendEnvOverrides({}, { env })).toThrow('env must be an object whose values are strings');
  });

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

describe('dev-proxy backend defaults (issue #1025, step 2)', () => {
  // One client, and the proxy's own lifetime is the backend's: the per-debug-session
  // idle policy (30 min on http) would close a developer's paused session under them.
  it('turns the backend idle policy off unless the environment already says otherwise', () => {
    expect(withBackendDefaults({ PATH: '/bin' })).toEqual({ MCP_DEBUG_SESSION_IDLE_MS: '0', PATH: '/bin' });
    expect(withBackendDefaults({ MCP_DEBUG_SESSION_IDLE_MS: '60000' })).toEqual({ MCP_DEBUG_SESSION_IDLE_MS: '60000' });
    // An explicitly empty value is the user's too: the server treats it as unset, not ours to rewrite.
    expect(withBackendDefaults({ MCP_DEBUG_SESSION_IDLE_MS: '' })).toEqual({ MCP_DEBUG_SESSION_IDLE_MS: '' });
  });

  it('lets a tool-call override win over the default', () => {
    const env = buildBackendEnvironment(withBackendDefaults({}), { MCP_DEBUG_SESSION_IDLE_MS: '5000' });
    expect(env.MCP_DEBUG_SESSION_IDLE_MS).toBe('5000');
  });
});
