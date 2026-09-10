/**
 * Mock logger utility for tests
 */
import { vi } from 'vitest';
import type { Logger as WinstonLogger } from 'winston';
import type { ILogger } from '../../../src/interfaces/external-dependencies.js';

/**
 * Creates a mock logger with all methods stubbed.
 *
 * Typed as both `ILogger` and winston's `Logger` because the CLI dependency
 * bags callers pass it into declare the winston type; the four spied methods
 * plus `level` are the only members anything exercises.
 *
 * @param logLevel Optional log level for the mock
 * @returns Mock logger instance
 */
export function createMockLogger(logLevel: string = 'debug'): ILogger & WinstonLogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    level: logLevel
  } as unknown as ILogger & WinstonLogger;
}
