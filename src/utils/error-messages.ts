/**
 * Centralized error messages for timeout-related errors in the debug server.
 * This ensures consistency between implementation and tests.
 */

export const ErrorMessages = {
  /**
   * Error message for DAP request timeouts
   * Occurs when: A Debug Adapter Protocol request doesn't receive a response within the timeout period
   * Used in: src/proxy/proxy-manager.ts
   * Default timeout: 35 seconds
   * @param command - The DAP command that timed out (e.g., 'stackTrace', 'variables')
   * @param timeout - The timeout duration in seconds
   */
  dapRequestTimeout: (command: string, timeout: number) =>
    `Debug adapter did not respond to '${command}' request within ${timeout}s. ` +
    `This typically means the debug adapter has crashed or lost connection. ` +
    `Try restarting your debug session. If the problem persists, check the debug adapter logs.`,

  /**
   * Hint appended to timeout failures on operations that accept a per-request
   * 'timeout' tool argument (evaluate_expression, redefine_classes)
   * Occurs when: A DAP request times out but the operation may simply need more time than the default allows
   * Used in: src/session/session-manager-operations.ts
   * Note: DAP has no cancel — the debuggee keeps executing the operation after the timeout fires
   */
  dapRequestTimeoutHint: () =>
    `If the operation is expected to take this long, retry with a larger 'timeout' (ms) argument. ` +
    `Note the operation may still be running in the debuggee.`,

  /**
   * Error message for proxy initialization timeouts
   * Occurs when: The debug proxy process fails to initialize within the timeout period
   * Used in: src/proxy/proxy-manager.ts
   * Default timeout: 30 seconds
   * @param timeout - The timeout duration in seconds
   */
  proxyInitTimeout: (timeout: number) =>
    `Debug proxy initialization did not complete within ${timeout}s. ` +
    `This may indicate that the debug adapter failed to start or is not properly configured. ` +
    `Check that the required debug adapter is installed and accessible.`,
  
  /**
   * Informational message for step operations still executing after the grace window
   * Occurs when: A step operation (stepOver, stepInto, stepOut) doesn't receive a 'stopped' event
   * within the grace window — usually because the step runs long-lived user code, which is not an error
   * Used in: src/session/session-manager-operations.ts
   * Default grace window: 5 seconds
   * @param graceSeconds - The grace window duration in seconds
   */
  stepStillRunning: (graceSeconds: number) =>
    `Step dispatched; the program is still executing after ${graceSeconds}s ` +
    `(e.g. stepping over a long-running call). The session remains 'running' and will ` +
    `become 'paused' when the step completes. Check the session state, or call ` +
    `pause_execution to interrupt.`,

  /**
   * Informational message for pause requests not yet honored within the grace window
   * Occurs when: A pause request is acknowledged but no 'stopped' event arrives within the grace
   * window — the target may be blocked in native code or a syscall, which is not an error
   * Used in: src/session/session-manager-operations.ts
   * Default grace window: 5 seconds
   * @param graceSeconds - The grace window duration in seconds
   */
  pausePending: (graceSeconds: number) =>
    `Pause requested; no 'stopped' event within ${graceSeconds}s ` +
    `(the program may be blocked in native code or a syscall). The session will report ` +
    `'paused' once the stop lands. Check the session state to confirm.`,


  /**
   * Error message for attach verification failures
   * Occurs when: After an attach handshake, the debugger does not report any
   * threads within the verification window — either the attach is dead
   * (issue #124) or the target is slow to become debuggable (issue #143)
   * Used in: src/session/session-manager-operations.ts
   * Default window: 5 seconds, overridable per call via 'verifyTimeout'
   * @param timeoutMs - The verification window in milliseconds
   * @param lastFailure - The last observed failure while polling 'threads'
   */
  attachVerifyFailed: (timeoutMs: number, lastFailure: string) =>
    `Attach did not become debuggable: no threads reported within ${timeoutMs}ms ` +
    `(last failure: ${lastFailure}). If the target is just slow to become debuggable ` +
    `(e.g. a busy or warming JVM), retry with a larger 'verifyTimeout' (ms) on attach_to_process.`,

  /**
   * Error message for adapter ready timeouts
   * Occurs when: Waiting for the debug adapter to be configured times out
   * Used in: src/session/session-manager.ts (logged as warning)
   * Default timeout: 30 seconds
   * @param timeout - The timeout duration in seconds
   */
  adapterReadyTimeout: (timeout: number) =>
    `Timed out waiting for debug adapter to be ready after ${timeout}s. ` +
    `The adapter may have failed to start properly. ` +
    `Check the debug logs for more details.`,
};
