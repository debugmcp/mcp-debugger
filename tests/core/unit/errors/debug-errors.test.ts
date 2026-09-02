/**
 * The typed error hierarchy keeps two views of one message (issue #647):
 * `.message` carries the SDK's `MCP error <code>: ` prefix for the JSON-RPC
 * path, `.detail` is the plain text tool result envelopes report.
 */
import { describe, it, expect } from 'vitest';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
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
  UnsupportedLanguageError
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

  it.each(cases)('$name keeps the prefixed .message and the plain .detail', ({ error, code, detail, data }) => {
    expect(error).toBeInstanceOf(McpError);
    expect(error).toBeInstanceOf(DebugError);
    expect(error.code).toBe(code);
    expect(error.message).toBe(`MCP error ${code}: ${detail}`);
    expect(error.detail).toBe(detail);
    expect(error.detail).not.toContain('MCP error');
    expect(error.data).toEqual(data);
  });

  it.each(cases)('getErrorMessage($name) reports the detail', ({ error, detail }) => {
    expect(getErrorMessage(error)).toBe(detail);
  });

  it('getErrorMessage still passes plain errors and non-errors through', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage(new McpError(McpErrorCode.InternalError, 'raw'))).toBe('MCP error -32603: raw');
    expect(getErrorMessage('text')).toBe('text');
  });
});
