import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupErrorHandlers } from '../../../src/cli/error-handlers.js';
import { FakeCurrentProcess } from '../../test-utils/mocks/fake-current-process.js';
import type { Logger as WinstonLoggerType } from 'winston';

describe('Error Handlers', () => {
  let mockLogger: WinstonLoggerType;
  let mockExitProcess: ReturnType<typeof vi.fn>;
  let fakeProc: FakeCurrentProcess;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      level: 'info'
    } as any;

    // Create mock exit function
    mockExitProcess = vi.fn();

    // Handlers attach to the fake's emitter, never the real process (issue #183)
    fakeProc = new FakeCurrentProcess();
  });

  it('should set up uncaughtException handler', () => {
    setupErrorHandlers({ logger: mockLogger, exitProcess: mockExitProcess, proc: fakeProc });

    expect(fakeProc.listenerCount('uncaughtException')).toBe(1);
  });

  it('should set up unhandledRejection handler', () => {
    setupErrorHandlers({ logger: mockLogger, exitProcess: mockExitProcess, proc: fakeProc });

    expect(fakeProc.listenerCount('unhandledRejection')).toBe(1);
  });

  it('should handle uncaughtException by logging and exiting', () => {
    setupErrorHandlers({ logger: mockLogger, exitProcess: mockExitProcess, proc: fakeProc });

    const error = new Error('Test error');
    error.stack = 'Test stack trace';

    fakeProc.emit('uncaughtException', error, 'uncaughtException');

    // Verify logger was called with correct params
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[Server UNCAUGHT_EXCEPTION] Origin: uncaughtException',
      {
        errorName: 'Error',
        errorMessage: 'Test error',
        errorStack: 'Test stack trace'
      }
    );

    // Verify process exit was called with code 1
    expect(mockExitProcess).toHaveBeenCalledWith(1);
  });

  it('should handle unhandledRejection by logging without exiting', async () => {
    setupErrorHandlers({ logger: mockLogger, exitProcess: mockExitProcess, proc: fakeProc });

    const reason = 'Test rejection reason';
    const promise = Promise.reject(reason);

    // Catch the rejection to prevent unhandled rejection warning
    promise.catch(() => {});

    fakeProc.emit('unhandledRejection', reason, promise);

    // Verify logger was called
    expect(mockLogger.error).toHaveBeenCalledWith('[Server UNHANDLED_REJECTION] Reason:', { reason });
    expect(mockLogger.error).toHaveBeenCalledWith('[Server UNHANDLED_REJECTION] Promise:', { promise });

    // Verify process exit was NOT called - stray rejections should not kill a long-running server
    expect(mockExitProcess).not.toHaveBeenCalled();
  });

  it('should fall back to proc.exit if exitProcess is not provided', () => {
    setupErrorHandlers({ logger: mockLogger, proc: fakeProc });

    fakeProc.emit('uncaughtException', new Error('Test error'), 'uncaughtException');

    // Verify the injected process handle's exit was called
    expect(fakeProc.exit).toHaveBeenCalledWith(1);
  });
});
