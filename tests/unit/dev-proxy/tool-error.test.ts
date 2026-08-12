/**
 * Unit tests for the dev-proxy tool-error classification helpers (issue #304).
 *
 * The helpers live in tools/dev-proxy/tool-error.mjs (separate from
 * dev-proxy.mjs, which runs main() at module top level and therefore cannot
 * be imported safely).
 *
 * The contract under test: the "backend may be down" hint may only accompany
 * genuine transport/connection failures. A well-formed JSON-RPC error from a
 * running backend (e.g. -32602 InvalidParams for a bad breakpoint) proves the
 * backend is alive — hinting a restart there sends agents on a false detour
 * that, in parallel runs, can destroy every other agent's sessions.
 */
import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain-JS module without type declarations
import { isBackendUnavailableError, dedupeMcpErrorPrefix, assertBackendAvailable } from '../../../tools/dev-proxy/tool-error.mjs';

describe('dev-proxy isBackendUnavailableError', () => {
  it.each(['stopped', 'starting', 'restarting'])(
    'returns true whenever the backend state is %s, regardless of error shape',
    (state) => {
      expect(isBackendUnavailableError(new Error('anything'), state)).toBe(true);
      expect(isBackendUnavailableError({ code: -32602 }, state)).toBe(true);
    }
  );

  it('returns true for a direct syscall code under running state', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3001'), {
      code: 'ECONNREFUSED',
    });
    expect(isBackendUnavailableError(err, 'running')).toBe(true);
  });

  it('walks the cause chain for undici fetch failures', () => {
    // undici wraps connection failures: TypeError('fetch failed') with the
    // syscall error on .cause — the common down-backend shape in http mode.
    const err = new TypeError('fetch failed');
    (err as Error & { cause?: unknown }).cause = Object.assign(
      new Error('connect ECONNRESET'),
      { code: 'ECONNRESET' }
    );
    expect(isBackendUnavailableError(err, 'running')).toBe(true);
  });

  it('walks nested causes more than one level down', () => {
    const inner = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
    const mid = Object.assign(new Error('request failed'), { cause: inner });
    const outer = Object.assign(new TypeError('fetch failed'), { cause: mid });
    expect(isBackendUnavailableError(outer, 'running')).toBe(true);
  });

  it.each([-32000, -32001])(
    'returns true for SDK transport error code %d (ConnectionClosed / RequestTimeout)',
    (code) => {
      expect(isBackendUnavailableError({ code, message: 'x' }, 'running')).toBe(true);
    }
  );

  it.each([-32602, -32603, -32601, -32700])(
    'returns false for JSON-RPC application error code %d from a running backend',
    (code) => {
      expect(isBackendUnavailableError({ code, message: 'MCP error' }, 'running')).toBe(false);
    }
  );

  it('returns false for a codeless error under running state', () => {
    expect(isBackendUnavailableError(new Error('something odd'), 'running')).toBe(false);
  });

  it('tolerates null/undefined errors', () => {
    expect(isBackendUnavailableError(null, 'running')).toBe(false);
    expect(isBackendUnavailableError(undefined, 'running')).toBe(false);
    expect(isBackendUnavailableError(null, 'stopped')).toBe(true);
  });
});

describe('dev-proxy dedupeMcpErrorPrefix', () => {
  it('collapses a doubled prefix to one', () => {
    expect(dedupeMcpErrorPrefix('MCP error -32602: MCP error -32602: Breakpoint not set')).toBe(
      'MCP error -32602: Breakpoint not set'
    );
  });

  it('collapses a tripled prefix (nested proxies) to one', () => {
    expect(
      dedupeMcpErrorPrefix('MCP error -32603: MCP error -32603: MCP error -32603: boom')
    ).toBe('MCP error -32603: boom');
  });

  it('leaves a single prefix unchanged', () => {
    expect(dedupeMcpErrorPrefix('MCP error -32602: Breakpoint not set')).toBe(
      'MCP error -32602: Breakpoint not set'
    );
  });

  it('leaves an unprefixed message unchanged', () => {
    expect(dedupeMcpErrorPrefix('Backend is stopped — cannot call tool')).toBe(
      'Backend is stopped — cannot call tool'
    );
  });

  it('does not merge differing codes (not a duplicate)', () => {
    expect(dedupeMcpErrorPrefix('MCP error -32602: MCP error -32603: mixed')).toBe(
      'MCP error -32602: MCP error -32603: mixed'
    );
  });

  it('passes non-string input through', () => {
    expect(dedupeMcpErrorPrefix(undefined)).toBeUndefined();
    expect(dedupeMcpErrorPrefix(42)).toBe(42);
  });
});

describe('dev-proxy assertBackendAvailable', () => {
  it('throws a clean state-naming error when the backend is not running', () => {
    expect(() => assertBackendAvailable({ state: 'stopped', mcpClient: null })).toThrow(
      /Backend is stopped/
    );
  });

  it('throws when the client is null even if state claims running (race)', () => {
    expect(() => assertBackendAvailable({ state: 'running', mcpClient: null })).toThrow(
      /Backend is running/
    );
  });

  it('passes for a running backend with a client', () => {
    expect(() => assertBackendAvailable({ state: 'running', mcpClient: {} })).not.toThrow();
  });
});
