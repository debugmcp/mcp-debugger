/**
 * Vitest Setup File
 * 
 * This file is run before each test file and is used to:
 * - Configure global test settings
 * - Set up global mocks
 * - Initialize test environments
 */
import { vi, beforeAll, afterEach, afterAll } from 'vitest';
import { portManager } from './test-utils/helpers/port-manager.js';

// Ensure stdio mode is disabled in unit tests unless explicitly set
delete process.env.DEBUG_MCP_STDIO;

// Add type declarations for global test helpers
declare global {
  // eslint-disable-next-line no-var
  var __dirname: string;
  // eslint-disable-next-line no-var
  var testPortManager: typeof portManager;
}

// Make __dirname available in ESM context
(globalThis as any).__dirname = import.meta.url
  ? new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)\//, '$1/')  // For Windows paths
  : process.cwd();

// For Windows, clean up the path format
if (process.platform === 'win32' && (globalThis as any).__dirname) {
  (globalThis as any).__dirname = (globalThis as any).__dirname.replace(/\//g, '\\');
}

// Make port manager available globally
(globalThis as any).testPortManager = portManager;

// Reset test states before each test file
beforeAll(() => {
  // Timeout is set in vitest.config.ts
  portManager.reset();
});

// Reset test states after each test
afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

// Clean up after all tests
afterAll(async () => {
  portManager.reset();
  
  // Clean up the shared test server if it exists
  try {
    const { cleanupTestServer } = await import('./test-utils/helpers/session-helpers.js');
    await cleanupTestServer();
  } catch (error) {
    // Ignore import errors - not all tests use session helpers
    if (!String(error).includes('MODULE_NOT_FOUND') && !String(error).includes('Cannot resolve')) {
      console.warn('[Vitest Setup] Error during test server cleanup:', error);
    }
  }
});
