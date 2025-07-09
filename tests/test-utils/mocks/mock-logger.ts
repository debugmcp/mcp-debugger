/**
 * Mock logger utility for tests
 */
import { vi } from 'vitest';
import { ILogger } from '../../src/interfaces/external-dependencies.js';

/**
 * Creates a mock logger with all methods stubbed
 * @param logLevel Optional log level for the mock
 * @returns Mock logger instance
 */
export function createMockLogger(logLevel: string = 'debug'): ILogger {
  const logger: ILogger = {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  };

  // Add log level awareness if needed
  (logger as any).level = logLevel;

  return logger;
}

/**
 * Creates a spy logger that logs to console while recording calls
 * Useful for debugging tests
 * @returns Spy logger instance
 */
export function createSpyLogger(): ILogger {
  return {
    info: vi.fn((...args: any[]) => console.log('[INFO]', ...args)),
    error: vi.fn((...args: any[]) => console.error('[ERROR]', ...args)),
    debug: vi.fn((...args: any[]) => console.log('[DEBUG]', ...args)),
    warn: vi.fn((...args: any[]) => console.warn('[WARN]', ...args))
  };
}
