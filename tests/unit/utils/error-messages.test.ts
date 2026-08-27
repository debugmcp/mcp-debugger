import { describe, it, expect } from 'vitest';
import { ErrorMessages } from '../../../src/utils/error-messages.js';
import { getErrorMessage } from '../../../src/errors/debug-errors.js';

describe('ErrorMessages', () => {
  it('builds dap request timeout message with command and timeout', () => {
    const message = ErrorMessages.dapRequestTimeout('stackTrace', 10);
    expect(message).toContain('stackTrace');
    expect(message).toContain('10s');
  });

  it('builds dap request timeout hint naming the timeout tool arg', () => {
    const message = ErrorMessages.dapRequestTimeoutHint();
    expect(message).toContain("'timeout'");
    expect(message).toContain('ms');
  });

  it('builds proxy initialization timeout message', () => {
    const message = ErrorMessages.proxyInitTimeout(30);
    expect(message).toContain('30s');
    expect(message).toMatch(/debug proxy/i);
  });

  describe('stage-aware proxy initialization timeout (issue #493)', () => {
    const invariantPrefix = 'Debug proxy initialization did not complete within 30s.';

    it('keeps the install hint only for the no-progress case', () => {
      const message = ErrorMessages.proxyInitTimeout(30, { transportConnected: false });
      expect(message).toContain(invariantPrefix);
      expect(message).toContain('installed and accessible');
    });

    it('names the outstanding request and adapter PID after a connected handshake stalls', () => {
      const message = ErrorMessages.proxyInitTimeout(30, {
        transportConnected: true,
        pendingCommand: 'initialize',
        adapterPid: 52875
      });
      expect(message).toContain(invariantPrefix);
      expect(message).toContain('"initialize" request never received a response');
      expect(message).toContain('PID 52875');
      expect(message).toContain('not a missing install');
      expect(message).not.toContain('installed and accessible');
    });

    it('omits the PID note in connect mode (no adapter process)', () => {
      const message = ErrorMessages.proxyInitTimeout(30, {
        transportConnected: true,
        pendingCommand: 'attach'
      });
      expect(message).toContain('"attach" request never received a response');
      expect(message).not.toContain('PID');
    });

    it('reports a connected handshake with no outstanding request as a stall, not a bad install', () => {
      const message = ErrorMessages.proxyInitTimeout(30, {
        transportConnected: true,
        adapterPid: 4242
      });
      expect(message).toContain(invariantPrefix);
      expect(message).toContain('stalled before completing');
      expect(message).toContain('PID 4242');
      expect(message).not.toContain('installed and accessible');
    });

    it('reports spawned-but-never-connected distinctly', () => {
      const message = ErrorMessages.proxyInitTimeout(30, {
        transportConnected: false,
        adapterPid: 999
      });
      expect(message).toContain('spawned (PID 999)');
      expect(message).toContain('never established');
      expect(message).not.toContain('installed and accessible');
    });
  });

  it('builds step still-running message', () => {
    const message = ErrorMessages.stepStillRunning(5);
    expect(message).toContain('5s');
    expect(message).toContain('still executing');
  });

  it('builds pause pending message', () => {
    const message = ErrorMessages.pausePending(5);
    expect(message).toContain('5s');
    expect(message).toContain("no 'stopped' event");
  });

  it('builds attach verify failed message naming the verifyTimeout knob', () => {
    const message = ErrorMessages.attachVerifyFailed(5000, 'debugger reported zero threads');
    expect(message).toContain('no threads reported');
    expect(message).toContain('5000ms');
    expect(message).toContain('debugger reported zero threads');
    expect(message).toContain('verifyTimeout');
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
