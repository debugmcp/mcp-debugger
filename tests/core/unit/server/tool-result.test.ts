/** The session-error catch helpers classify only typed lifecycle failures. */
import { describe, it, expect } from 'vitest';
import { McpError, ErrorCode as McpErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  failureResult,
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

describe('typed session errors', () => {
  it('recognizes the three typed session errors', () => {
    expect(isTypedSessionError(new SessionTerminatedError('s1'))).toBe(true);
    expect(isTypedSessionError(new SessionNotFoundError('s1'))).toBe(true);
    expect(isTypedSessionError(new ProxyNotRunningError('s1', 'pause'))).toBe(true);
  });

  it('converts ProxyNotRunningError to its plain detail, without the McpError prefix (#647)', () => {
    const error = new ProxyNotRunningError('s1', 'pause');
    // McpError prefixes its own .message with the JSON-RPC code; that prefix is
    // for the protocol path and must not reach the envelope.
    expect(error.message).toBe('MCP error -32600: Cannot pause: no active proxy for session s1');
    expect(payload(sessionErrorToResult(error)!)).toEqual({
      success: false,
      error: 'Cannot pause: no active proxy for session s1'
    });
  });

  it('converts all typed lifecycle errors to their detail', () => {
    for (const error of [new SessionTerminatedError('s1'), new SessionNotFoundError('s1')]) {
      expect(error.message).toMatch(/^MCP error -\d+: /);
      expect(payload(sessionErrorToResult(error)!)).toEqual({
        success: false,
        error: error.detail
      });
      expect(payload(sessionErrorResultOrThrow(error))).toEqual({
        success: false,
        error: error.detail
      });
      expect(error.detail).not.toContain('MCP error');
    }
    expect(new SessionTerminatedError('s1').detail).toBe('Session is terminated: s1');
    expect(new SessionNotFoundError('s1').detail).toBe('Session not found: s1');
  });
  it('does NOT convert a look-alike McpError that is not one of the typed classes', () => {
    const error = new McpError(McpErrorCode.InvalidRequest, 'Session is terminated: s1');
    expect(isTypedSessionError(error)).toBe(false);
    expect(sessionErrorToResult(error)).toBeUndefined();
  });

  it('does not convert a plain Error', () => {
    expect(sessionErrorToResult(new Error('unexpected'))).toBeUndefined();
  });

  it('carries tool-specific fields after the typed error', () => {
    const error = new SessionTerminatedError('s1');
    const result = sessionErrorToResult(error, {
      message: 'The program has terminated, so no frames or variables exist. Use restart_debugging to run it again.'
    })!;
    expect(Object.keys(payload(result))).toEqual(['success', 'error', 'message']);
  });

  it.each([
    'Session is terminated: s1',
    'Session closed',
    'Session not found: s1',
    'Breakpoint not found',
    'Session is not paused',
    'user expression: conn.closed'
  ])('does not classify user-controlled look-alike text: %s', (message) => {
    const error = new McpError(McpErrorCode.InvalidParams, message);
    expect(sessionErrorToResult(error)).toBeUndefined();
  });
});

describe('sessionErrorResultOrThrow', () => {
  it('returns the failure result for a typed session error', () => {
    const error = new SessionTerminatedError('s1');
    expect(payload(sessionErrorResultOrThrow(error)).success).toBe(false);
  });

  it('re-throws the original error untouched otherwise', () => {
    const error = new McpError(McpErrorCode.InvalidParams, 'Breakpoint file not found');
    expect(() => sessionErrorResultOrThrow(error)).toThrow(error);
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
