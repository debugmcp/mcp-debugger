import { describe, it, expect } from 'vitest';
import { ErrorMessages } from '../../../src/utils/error-messages.js';
import { getErrorMessage } from '../../../src/errors/debug-errors.js';

describe('ErrorMessages', () => {
  it('builds dap request timeout message with command and timeout', () => {
    const message = ErrorMessages.dapRequestTimeout('stackTrace', 10);
    expect(message).toContain('stackTrace');
    expect(message).toContain('10s');
  });

  it('builds proxy initialization timeout message', () => {
    const message = ErrorMessages.proxyInitTimeout(30);
    expect(message).toContain('30s');
    expect(message).toMatch(/debug proxy/i);
  });

  it('builds step timeout message', () => {
    const message = ErrorMessages.stepTimeout(5);
    expect(message).toContain('5s');
    expect(message).toContain('Step operation');
  });

  it('builds adapter ready timeout message', () => {
    const message = ErrorMessages.adapterReadyTimeout(15);
    expect(message).toContain('15s');
    expect(message).toContain('debug adapter');
  });
});

describe('getErrorMessage', () => {
  it('extracts message from different error inputs', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('fail')).toBe('fail');
    expect(getErrorMessage({ message: 'object' })).toBe('[object Object]');
    expect(getErrorMessage(42)).toBe('42');
  });
});
