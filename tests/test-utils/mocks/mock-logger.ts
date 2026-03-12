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
