import { describe, it, expect } from 'vitest';
import { DapResponseError, dapResponseErrorMessage } from '../../../src/proxy/dap-response-error.js';

/**
 * A DAP error response is the adapter's own answer, distinct from a
 * transport failure, a timeout or a shutdown (issue #746): the worker's
 * noDebug tolerance keys on the type.
 */
describe('DapResponseError', () => {
  it('carries the response and reads as the same message the plain rejection used to', () => {
    const response = { seq: 7, type: 'response' as const, request_seq: 3, success: false, command: 'setBreakpoints', message: 'Not supported in noDebug mode.' };

    const err = new DapResponseError(response);

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DapResponseError');
    expect(err.message).toBe(dapResponseErrorMessage(response));
    expect(err.response).toBe(response);
    expect(err.command).toBe('setBreakpoints');
  });
});
