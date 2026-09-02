/**
 * The reason a failed DAP response gives (issue #663): `message` when the
 * adapter set it, else the formatted `body.error`, else the generic fallback.
 */
import { describe, expect, it } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import {
  DEFAULT_DAP_FAILURE_MESSAGE,
  dapResponseErrorMessage,
  dapResponseErrorText,
  formatDapMessage
} from '../../../src/proxy/dap-response-error.js';

function failed(extra: Partial<DebugProtocol.Response>): DebugProtocol.Response {
  return { seq: 1, type: 'response', request_seq: 1, command: 'evaluate', success: false, ...extra };
}

describe('dapResponseErrorMessage', () => {
  it('prefers the raw message when the adapter set one', () => {
    const response = failed({ message: 'short form', body: { error: { id: 1, format: 'long form' } } });
    expect(dapResponseErrorMessage(response)).toBe('short form');
  });

  it('falls back to body.error.format (js-debug ProtocolError shape)', () => {
    const response = failed({ body: { error: { id: 2013, format: 'Uncaught ReferenceError: x is not defined' } } });
    expect(dapResponseErrorMessage(response)).toBe('Uncaught ReferenceError: x is not defined');
  });

  it('uses the generic fallback when neither text is present', () => {
    expect(dapResponseErrorMessage(failed({}))).toBe(DEFAULT_DAP_FAILURE_MESSAGE);
    expect(dapResponseErrorMessage(failed({ message: '' }))).toBe(DEFAULT_DAP_FAILURE_MESSAGE);
    expect(dapResponseErrorMessage(failed({ body: { error: { id: 1, format: '' } } }))).toBe(DEFAULT_DAP_FAILURE_MESSAGE);
    expect(dapResponseErrorMessage(failed({ body: { error: 'not a Message' } }))).toBe(DEFAULT_DAP_FAILURE_MESSAGE);
    expect(dapResponseErrorText(failed({ body: {} }))).toBeUndefined();
  });
});

describe('formatDapMessage', () => {
  it('substitutes {name} placeholders from variables and leaves unknown ones alone', () => {
    expect(formatDapMessage({ id: 1, format: 'Cannot set {name}: {reason} {unknown}', variables: { name: 'x', reason: 'read-only' } }))
      .toBe('Cannot set x: read-only {unknown}');
    expect(formatDapMessage({ id: 1, format: 'plain {text}' })).toBe('plain {text}');
  });
});
