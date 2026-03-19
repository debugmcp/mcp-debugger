/**
 * Test setup for ProxyManager tests
 * Handles expected unhandled rejections from timeout tests
 */

let unhandledRejectionHandler: ((reason: any, promise: Promise<any>) => void) | null = null;
let originalListeners: Function[] = [];

/**
 * Setup handler for expected unhandled rejections in timeout tests
 */
export function setupTimeoutTestHandler() {
  // Capture ALL existing listeners before removing them
  originalListeners = process.rawListeners('unhandledRejection') as Function[];

  unhandledRejectionHandler = (reason: any, promise: Promise<any>) => {
    // Check if this is an expected timeout rejection from our tests
    const message = reason?.message || '';
    const isExpectedTimeout =
      message.includes('Proxy initialization timeout') ||
      message.includes('Timeout waiting for DAP response');

    if (!isExpectedTimeout) {
      // If it's not an expected timeout, re-throw or log
      console.error('Unexpected unhandled rejection:', reason);
      // Delegate to original listeners
      for (const listener of originalListeners) {
        listener(reason, promise);
      }
    }
    // Otherwise, silently ignore as it's expected in our timeout tests
  };

  // Remove existing handlers and add ours
  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', unhandledRejectionHandler);
}

/**
 * Cleanup handler after tests
 */
export function cleanupTimeoutTestHandler() {
  if (unhandledRejectionHandler) {
    process.removeListener('unhandledRejection', unhandledRejectionHandler);
    unhandledRejectionHandler = null;
  }

  // Restore ALL original listeners
  process.removeAllListeners('unhandledRejection');
  for (const listener of originalListeners) {
    process.on('unhandledRejection', listener as any);
  }
  originalListeners = [];
}
