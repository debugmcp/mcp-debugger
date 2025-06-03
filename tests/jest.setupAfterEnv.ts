// @ts-nocheck
/**
 * Jest Setup File
 * 
 * This file is run before each test file and is used to:
 * - Configure global test settings
 * - Set up global mocks
 * - Initialize test environments
 */
import { jest, beforeAll, afterEach, afterAll } from '@jest/globals';
import { PortRange, portManager } from './utils/port-manager';

// Add type declarations for global test helpers
declare global {
  var __dirname: string;
  var testPortManager: typeof portManager;
}

// Make __dirname available in ESM context
globalThis.__dirname = import.meta.url
  ? new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)\//, '$1/')  // For Windows paths
  : process.cwd();

// For Windows, clean up the path format
if (process.platform === 'win32' && globalThis.__dirname) {
  globalThis.__dirname = globalThis.__dirname.replace(/\//g, '\\');
}

// Make port manager available globally
globalThis.testPortManager = portManager;

// Reset test states before each test file
beforeAll(() => {
  // Increase timeout for all tests
  jest.setTimeout(30000); 
  portManager.reset();
});

// Reset test states after each test
afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
});

// Clean up after all tests
afterAll(() => {
  portManager.reset();
});
