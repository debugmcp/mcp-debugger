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

  describe('operationInFlight (issue #711)', () => {
    it('names the operation in flight and the refused tool, and says to wait', () => {
      const message = ErrorMessages.operationInFlight('launch', 'attach_to_process');
      expect(message).toContain('A launch is already in progress');
      expect(message).toContain('start_debugging has not returned yet');
      expect(message).toContain('wait for it to complete before calling attach_to_process');
    });

    it('does not tell restart_debugging to wait out an attach — it is never available for one', () => {
      // Waiting cannot help: restart_debugging replays a launch configuration
      // and an attach session has none, so the answer is terminal, not transient.
      const message = ErrorMessages.operationInFlight('attach', 'restart_debugging');
      expect(message).toContain('An attach is already in progress');
      expect(message).toContain('never available for an attach session');
      expect(message).toContain('Detach and re-attach instead');
      expect(message).not.toContain('wait for it to complete');
    });

    it('still tells start_debugging to wait out an attach', () => {
      const message = ErrorMessages.operationInFlight('attach', 'start_debugging');
      expect(message).toContain('wait for it to complete before calling start_debugging');
      expect(message).not.toContain('never available');
    });

    it('describes a detach in flight', () => {
      const message = ErrorMessages.operationInFlight('detach', 'start_debugging');
      expect(message).toContain('A detach is already in progress');
      expect(message).toContain('detach_from_process has not returned yet');
    });
  });

  it('builds adapter ready timeout message', () => {
    const message = ErrorMessages.adapterReadyTimeout(15);
    expect(message).toContain('15s');
    expect(message).toContain('debug adapter');
  });

  // Every "pending" answer says two things a caller needs: the thing it asked
  // for is still in effect, and wait_for_stop is how to wait for it (issue #849).
  describe('pending answers point at wait_for_stop (issue #849)', () => {
    it('a step that has not landed is still in effect', () => {
      const message = ErrorMessages.stepStillRunning(5);
      expect(message).toContain('after 5s');
      expect(message).toMatch(/step is still in effect/);
      expect(message).toContain('wait_for_stop');
      expect(message).toContain('pause_execution');
      expect(message).not.toMatch(/Check the session state/);
    });

    it('a pause that has not landed is still in effect', () => {
      const message = ErrorMessages.pausePending(5);
      expect(message).toContain('within 5s');
      expect(message).toMatch(/pause is still in effect/);
      expect(message).toMatch(/will report 'paused' once the stop lands/);
      expect(message).toContain('wait_for_stop');
      expect(message).not.toMatch(/Check the session state/);
    });

    it('a pause with the debugger off promises no stop, and still names the tool', () => {
      const message = ErrorMessages.pausePendingDebuggerOff(5, 'Policy hint.');
      expect(message).toContain(ErrorMessages.debuggerOffForLaunch);
      expect(message).toContain('wait_for_stop');
      expect(message).toContain('Policy hint.');
      expect(message).not.toMatch(/will report 'paused' once the stop lands/);
    });

    it('a post-attach pause that has not landed names the tool', () => {
      expect(ErrorMessages.attachPausePending).toMatch(/^post-attach pause pending/);
      expect(ErrorMessages.attachPausePending).toContain('wait_for_stop');
      expect(ErrorMessages.attachPausePending).toContain('stopOnEntry: false');
    });

    it('a launch still running with something armed says it stays armed', () => {
      const message = ErrorMessages.launchStillRunning(30, '2 breakpoint(s)');
      expect(message).toMatch(/still running after 30s without reaching 2 breakpoint\(s\)/);
      expect(message).toMatch(/Nothing was cancelled/);
      expect(message).toMatch(/stays? armed/);
      expect(message).toContain('wait_for_stop');
      expect(message).not.toMatch(/check list_debug_sessions/);
    });

    it('a launch still running with nothing armed says what can still end the wait', () => {
      const message = ErrorMessages.launchStillRunning(5, undefined);
      expect(message).toMatch(/still running after 5s/);
      expect(message).toMatch(/nothing is armed to stop it/);
      expect(message).toContain('wait_for_stop');
      expect(message).toContain('get_output');
    });

    it('wait_for_stop itself says nothing was cancelled, and names what is still armed', () => {
      const message = ErrorMessages.waitForStopPending(30, 'running', { armedSummary: '2 breakpoint(s)' });
      expect(message).toMatch(/still running after 30s without reaching 2 breakpoint\(s\)/);
      expect(message).toMatch(/Nothing was cancelled/);
      expect(message).toMatch(/stays? armed/);
      expect(message).toContain('wait_for_stop');
    });

    it('wait_for_stop with nothing armed promises no pause: it says what can still end the wait', () => {
      const message = ErrorMessages.waitForStopPending(30, 'running');
      expect(message).toMatch(/still running after 30s/);
      expect(message).toMatch(/no breakpoint or caught-exception filter is armed/);
      expect(message).not.toMatch(/stays? armed/);
      expect(message).not.toMatch(/becomes 'paused' when/);
      expect(message).toMatch(/uncaught exception/);
      expect(message).toMatch(/exit/);
      expect(message).toContain('wait_for_stop');
    });

    it('wait_for_stop with the debugger off waits for the exit and promises no stop', () => {
      const message = ErrorMessages.waitForStopPending(30, 'running', { debuggerOffWhy: ErrorMessages.debuggerOffForLaunch });
      expect(message).toContain(ErrorMessages.debuggerOffForLaunch);
      expect(message).not.toMatch(/stay armed/);
      expect(message).toMatch(/wait for it to end/);
    });

    it('wait_for_stop on a launch that has not completed says so', () => {
      const message = ErrorMessages.waitForStopPending(2, 'initializing');
      expect(message).toMatch(/still starting after 2s/);
      expect(message).not.toMatch(/stay armed/);
    });
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
