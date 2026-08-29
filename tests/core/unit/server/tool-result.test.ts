/**
 * The session-error catch helpers, one case per dialect row of the site table.
 *
 * The point of these tests is that the three dialects are NOT interchangeable:
 * ProxyNotRunningError converts under 'typed' but under neither string sniff,
 * a bare 'not found' converts only under the loose sniff, and each row keeps
 * its own fallback.
 */
import { describe, it, expect } from 'vitest';
import { McpError, ErrorCode as McpErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  failureResult,
  isSessionStateError,
  isTypedSessionError,
  jsonResult,
  prettyJsonResult,
  rethrowAsMcpError,
  sessionErrorResultOrThrow,
  sessionErrorToResult,
  type ToolResult
} from '../../../../src/server/tool-result.js';
import {
  SessionNotFoundError,
  SessionTerminatedError,
  ProxyNotRunningError
} from '../../../../src/errors/debug-errors.js';

function payload(result: ToolResult): Record<string, unknown> {
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

describe('tool-result envelopes', () => {
  it('jsonResult wraps a payload as one text content entry', () => {
    expect(jsonResult({ a: 1 })).toEqual({ content: [{ type: 'text', text: '{"a":1}' }] });
  });

  it('prettyJsonResult indents with two spaces', () => {
    expect(prettyJsonResult({ a: 1 }).content[0].text).toBe('{\n  "a": 1\n}');
  });

  it('failureResult puts extra fields AFTER success and error', () => {
    const result = failureResult('boom', { state: 'stopped' });
    expect(Object.keys(payload(result))).toEqual(['success', 'error', 'state']);
  });
});

describe('sniff: typed', () => {
  it('recognizes the three typed session errors', () => {
    expect(isTypedSessionError(new SessionTerminatedError('s1'))).toBe(true);
    expect(isTypedSessionError(new SessionNotFoundError('s1'))).toBe(true);
    expect(isTypedSessionError(new ProxyNotRunningError('s1', 'pause'))).toBe(true);
  });

  it('converts ProxyNotRunningError, whose message matches no string sniff', () => {
    const error = new ProxyNotRunningError('s1', 'pause');
    // McpError prefixes its own message with the JSON-RPC code; the payload
    // carries that verbatim, exactly as it always has.
    expect(payload(sessionErrorToResult(error, 'typed')!)).toEqual({
      success: false,
      error: error.message
    });
    expect(error.message).toContain('Cannot pause: no active proxy for session s1');
  });

  it('converts SessionTerminatedError and SessionNotFoundError under typed', () => {
    for (const error of [new SessionTerminatedError('s1'), new SessionNotFoundError('s1')]) {
      expect(payload(sessionErrorToResult(error, 'typed')!)).toEqual({
        success: false,
        error: error.message
      });
      expect(payload(sessionErrorResultOrThrow(error, 'typed'))).toEqual({
        success: false,
        error: error.message
      });
    }
  });
  it('does NOT convert a look-alike McpError that is not one of the typed classes', () => {
    const error = new McpError(McpErrorCode.InvalidRequest, 'Session is terminated: s1');
    expect(isTypedSessionError(error)).toBe(false);
    expect(sessionErrorToResult(error, 'typed')).toBeUndefined();
  });

  it('does not convert a plain Error', () => {
    expect(sessionErrorToResult(new Error('unexpected'), 'typed')).toBeUndefined();
  });
});

describe('sniff: session-state', () => {
  const cases: Array<[string, boolean]> = [
    ['Session is terminated: s1', true],
    ['Session closed', true],
    ['Session not found: s1', true],
    ['Breakpoint not found', false],   // "not found" without "Session"
    ['Session is not paused', false]   // "not paused" is the loose dialect only
  ];

  it.each(cases)('%s -> converts: %s', (message, converts) => {
    const error = new McpError(McpErrorCode.InvalidRequest, message);
    expect(isSessionStateError(error, 'session-state')).toBe(converts);
    expect(sessionErrorToResult(error, 'session-state') !== undefined).toBe(converts);
  });

  it('does NOT convert ProxyNotRunningError even though it is an McpError', () => {
    const error = new ProxyNotRunningError('s1', 'get stack trace');
    expect(isSessionStateError(error, 'session-state')).toBe(false);
    expect(sessionErrorToResult(error, 'session-state')).toBeUndefined();
  });

  it('carries the launch/attach extra after success and error', () => {
    const error = new McpError(McpErrorCode.InvalidRequest, 'Session is terminated: s1');
    const result = sessionErrorToResult(error, 'session-state', { state: 'stopped' })!;
    expect(Object.keys(payload(result))).toEqual(['success', 'error', 'state']);
    expect(payload(result).state).toBe('stopped');
  });
});

describe('sniff: session-state-or-not-paused', () => {
  const cases: Array<[string, boolean]> = [
    ['Session is terminated: s1', true],
    ['Session closed', true],
    ['Breakpoint not found', true],    // bare "not found" counts here
    ['Session is not paused', true],
    ['Expression too long (max 10KB)', false]
  ];

  it.each(cases)('%s -> converts: %s', (message, converts) => {
    const error = new McpError(McpErrorCode.InvalidRequest, message);
    expect(isSessionStateError(error, 'session-state-or-not-paused')).toBe(converts);
  });

  it('does NOT convert ProxyNotRunningError', () => {
    const error = new ProxyNotRunningError('s1', 'evaluate expression');
    expect(isSessionStateError(error, 'session-state-or-not-paused')).toBe(false);
  });

  it('carries the get_local_variables explanatory message after the error', () => {
    const error = new McpError(McpErrorCode.InvalidRequest, 'Session is terminated: s1');
    const result = sessionErrorToResult(error, 'session-state-or-not-paused', {
      message: 'The program has terminated, so no frames or variables exist. Use restart_debugging to run it again.'
    })!;
    expect(Object.keys(payload(result))).toEqual(['success', 'error', 'message']);
  });
});

describe('sessionErrorResultOrThrow', () => {
  it('returns the failure result when the dialect recognizes the error', () => {
    const error = new McpError(McpErrorCode.InvalidRequest, 'Session is terminated: s1');
    expect(payload(sessionErrorResultOrThrow(error, 'session-state')).success).toBe(false);
  });

  it('re-throws the original error untouched otherwise', () => {
    const error = new McpError(McpErrorCode.InvalidParams, 'Breakpoint file not found');
    expect(() => sessionErrorResultOrThrow(error, 'session-state')).toThrow(error);
  });
});

describe('rethrowAsMcpError', () => {
  it('passes an McpError through unchanged', () => {
    const error = new McpError(McpErrorCode.InvalidParams, 'bad params');
    expect(() => rethrowAsMcpError(error, 'Failed to pause execution')).toThrow(error);
  });

  it('wraps a plain Error as InternalError with the prefix', () => {
    let thrown: unknown;
    try {
      rethrowAsMcpError(new Error('unexpected'), 'Failed to list threads');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(McpError);
    expect((thrown as McpError).code).toBe(McpErrorCode.InternalError);
    expect((thrown as McpError).message).toContain('Failed to list threads: unexpected');
  });

  it('stringifies a non-Error throw instead of reporting undefined', () => {
    let thrown: unknown;
    try {
      rethrowAsMcpError('boom', 'Failed to expose session');
    } catch (error) {
      thrown = error;
    }
    expect((thrown as McpError).message).toContain('Failed to expose session: boom');
    expect((thrown as McpError).message).not.toContain('undefined');
  });
});
