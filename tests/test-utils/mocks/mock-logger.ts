/**
 * Mock logger utility for tests
 */
import { vi } from 'vitest';
import type { ILogger } from '../../../src/interfaces/external-dependencies.js';

/**
 * Creates a mock logger with all methods stubbed.
 *
 * Returns exactly what it is: `ILogger` plus the `level` field. It is deliberately NOT
 * typed as winston's `Logger` -- that would assert ~30 members this object does not have,
 * and the lie would travel to every caller. The CLI dependency bags that want the winston
 * type cast at their own call site instead, so the mismatch stays visible where someone
 * can act on it (`src/cli/http-command.ts` reaches for `logger.transports` and `logger.add`
 * one function away from what those tests exercise).
 *
 * @param logLevel Optional log level for the mock
 * @returns Mock logger instance
 */
export function createMockLogger(logLevel: string = 'debug'): ILogger & { level: string } {
  return {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    level: logLevel
  };
}
