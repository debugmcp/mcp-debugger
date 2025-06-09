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
   * Error message for proxy initialization timeouts
   * Occurs when: The debug proxy process fails to initialize within the timeout period
   * Used in: src/proxy/proxy-manager.ts
   * Default timeout: 30 seconds
   * @param timeout - The timeout duration in seconds
   */
  proxyInitTimeout: (timeout: number) =>
    `Debug proxy initialization did not complete within ${timeout}s. ` +
    `This may indicate that debugpy failed to start or is not installed. ` +
    `Check that Python and debugpy are properly installed and accessible.`,
  
  /**
   * Error message for step operation timeouts
   * Occurs when: A step operation (stepOver, stepInto, stepOut) doesn't receive a 'stopped' event within the timeout
   * Used in: src/session/session-manager.ts
   * Default timeout: 5 seconds
   * @param timeout - The timeout duration in seconds
   */
  stepTimeout: (timeout: number) =>
    `Step operation did not complete within ${timeout}s. ` +
    `The debug adapter may have crashed or the program may be stuck. ` +
    `Try restarting your debug session.`,
  
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
