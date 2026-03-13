/**
 * Test utilities for Debug MCP Server tests
 */
import { IFileSystem, ILogger } from '../../../src/interfaces/external-dependencies.js';
import { vi } from 'vitest';

/**
 * Create a delay promise
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock logger for testing
 * @returns Mock logger with vitest mocks
 */
export function createMockLogger(): ILogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  };
}

/**
 * Create a mock file system for testing
 * @returns Mock file system with vitest mocks
 */
export function createMockFileSystem(): IFileSystem {
  return {
    pathExists: vi.fn().mockResolvedValue(true),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    copy: vi.fn().mockResolvedValue(undefined),
    outputFile: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ isDirectory: () => false, isFile: () => true }),
    unlink: vi.fn().mockResolvedValue(undefined),
    rmdir: vi.fn().mockResolvedValue(undefined),
    ensureDirSync: vi.fn(),
    createWriteStream: vi.fn(),
    createReadStream: vi.fn()
  } as any;
}

/**
 * Wait for an event to be emitted
 *
 * @param emitter - Event emitter to listen on
 * @param event - Event name to wait for
 * @param timeout - Timeout in milliseconds
 * @returns Promise that resolves with event arguments
 */
export function waitForEvent<T extends any[]>(
  emitter: { once: Function; removeListener?: Function },
  event: string,
  timeout = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (emitter.removeListener) {
        emitter.removeListener(event, handler);
      }
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    const handler = (...args: any[]) => {
      clearTimeout(timer);
      resolve(args as T);
    };

    emitter.once(event, handler);
  });
}
