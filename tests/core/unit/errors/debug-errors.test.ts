/**
 * The typed error hierarchy keeps two views of one message (issue #647):
 * `.message` is whatever the SDK's constructor makes of it (the v1 SDK
 * prefixed `MCP error <code>: `, the v2 SDK adds nothing), `.detail` is the
 * plain text tool result envelopes report and the JSON-RPC boundary sends on
 * the wire (issue #659).
 */
import { describe, it, expect } from 'vitest';
import { ProtocolError } from '@modelcontextprotocol/server';
import {
  DebugError,
  DebugSessionCreationError,
  getErrorMessage,
  LanguageRuntimeNotFoundError,
  McpErrorCode,
  ProxyNotRunningError,
  PythonNotFoundError,
  SessionNotFoundError,
  SessionTerminatedError,
  UnsupportedFeatureError,
  UnsupportedLanguageError,
  WireMcpError,
  mcpErrorDetail,
  toWireError
} from '../../../../src/errors/debug-errors.js';

describe('DebugError hierarchy', () => {
  const cases: Array<{ name: string; error: DebugError; code: number; detail: string; data: Record<string, unknown> }> = [
    {
      name: 'SessionNotFoundError',
      error: new SessionNotFoundError('s1'),
      code: McpErrorCode.InvalidParams,
      detail: 'Session not found: s1',
      data: { sessionId: 's1' }
    },
    {
      name: 'SessionTerminatedError',
      error: new SessionTerminatedError('s1', 'STOPPED'),
      code: McpErrorCode.InvalidRequest,
      detail: 'Session is terminated: s1',
      data: { sessionId: 's1', state: 'STOPPED' }
    },
    {
      name: 'ProxyNotRunningError',
      error: new ProxyNotRunningError('s1', 'step over'),
      code: McpErrorCode.InvalidRequest,
      detail: 'Cannot step over: no active proxy for session s1',
      data: { sessionId: 's1', operation: 'step over' }
    },
    {
      name: 'LanguageRuntimeNotFoundError',
      error: new LanguageRuntimeNotFoundError('Ruby', '/usr/bin/ruby'),
      code: McpErrorCode.InvalidParams,
      detail: 'Ruby runtime not found at: /usr/bin/ruby',
      data: { language: 'Ruby', executablePath: '/usr/bin/ruby' }
    },
    {
      name: 'PythonNotFoundError',
      error: new PythonNotFoundError('/usr/bin/python3'),
      code: McpErrorCode.InvalidParams,
      detail: 'Python runtime not found at: /usr/bin/python3',
      data: { language: 'Python', executablePath: '/usr/bin/python3' }
    },
    {
      name: 'UnsupportedLanguageError',
      error: new UnsupportedLanguageError('cobol', ['python', 'mock']),
      code: McpErrorCode.InvalidParams,
      detail: "Language 'cobol' is not supported. Available languages: python, mock",
      data: { language: 'cobol', availableLanguages: ['python', 'mock'] }
    },
    {
      name: 'UnsupportedFeatureError',
      error: new UnsupportedFeatureError('Logpoints', 'ruby', 'rdbg ignores logMessage'),
      code: McpErrorCode.InvalidParams,
      detail: 'Logpoints not supported by the ruby adapter: rdbg ignores logMessage',
      data: { feature: 'Logpoints', language: 'ruby' }
    },
    {
      name: 'DebugSessionCreationError',
      error: new DebugSessionCreationError('adapter exploded'),
      code: McpErrorCode.InternalError,
      detail: 'Failed to create debug session: adapter exploded',
      data: { reason: 'adapter exploded', originalMessage: undefined, originalStack: undefined }
    }
  ];

  it.each(cases)('$name keeps .message and the plain .detail', ({ error, code, detail, data }) => {
    expect(error).toBeInstanceOf(ProtocolError);
    expect(error).toBeInstanceOf(DebugError);
    expect(error.code).toBe(code);
    expect(error.message).toBe(detail);
    expect(error.detail).toBe(detail);
    expect(error.detail).not.toContain('MCP error');
    expect(error.data).toEqual(data);
  });

  it.each(cases)('getErrorMessage($name) reports the detail', ({ error, detail }) => {
    expect(getErrorMessage(error)).toBe(detail);
  });

  it('getErrorMessage still passes plain errors and non-errors through', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage(new ProtocolError(McpErrorCode.InternalError, 'raw'))).toBe('raw');
    expect(getErrorMessage('text')).toBe('text');
  });
});

describe('the JSON-RPC boundary shape (issue #659)', () => {
  it('mcpErrorDetail reports the plain text', () => {
    expect(mcpErrorDetail(new ProtocolError(McpErrorCode.InvalidParams, 'bad arg'))).toBe('bad arg');
    expect(mcpErrorDetail(new SessionNotFoundError('s1'))).toBe('Session not found: s1');
    // The v2 SDK adds no prefix of its own, so a message that carries one (a
    // client re-wrapping a wire message) carries it on purpose and keeps it.
    expect(mcpErrorDetail(new ProtocolError(McpErrorCode.InvalidParams, 'MCP error -32602: nested')))
      .toBe('MCP error -32602: nested');
  });

  it('WireMcpError is an McpError whose .message is the bare detail', () => {
    const error = new WireMcpError(McpErrorCode.InvalidParams, 'bad arg', { k: 1 });
    expect(error).toBeInstanceOf(ProtocolError);
    expect(error.code).toBe(McpErrorCode.InvalidParams);
    expect(error.message).toBe('bad arg');
    expect(error.data).toEqual({ k: 1 });
  });

  it('toWireError keeps code, data and stack and is idempotent', () => {
    const source = new ProxyNotRunningError('s1', 'pause');
    const wire = toWireError(source);
    expect(wire).toBeInstanceOf(WireMcpError);
    expect(wire.code).toBe(source.code);
    expect(wire.data).toEqual(source.data);
    expect(wire.stack).toBe(source.stack);
    expect(wire.message).toBe('Cannot pause: no active proxy for session s1');
    expect(toWireError(wire)).toBe(wire);
  });
});
