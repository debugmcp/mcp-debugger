import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupErrorHandlers } from '../../../src/cli/error-handlers.js';
import type { Logger as WinstonLoggerType } from 'winston';

describe('Error Handlers', () => {
  let mockLogger: WinstonLoggerType;
  let mockExitProcess: ReturnType<typeof vi.fn>;
  let originalProcessOn: typeof process.on;
  let processListeners: Map<string, Function[]>;

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

    // Store original process.on
    originalProcessOn = process.on;
    processListeners = new Map();

    // Mock process.on to capture listeners
    process.on = vi.fn((event: string, listener: Function) => {
      if (!processListeners.has(event)) {
        processListeners.set(event, []);
      }
      processListeners.get(event)!.push(listener);
      return process;
    }) as any;
  });

  afterEach(() => {
    // Restore original process.on
    process.on = originalProcessOn;
    processListeners.clear();
  });

  it('should set up uncaughtException handler', () => {
    setupErrorHandlers({ logger: mockLogger, exitProcess: mockExitProcess });

    expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
  });

  it('should set up unhandledRejection handler', () => {
    setupErrorHandlers({ logger: mockLogger, exitProcess: mockExitProcess });

    expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
  });

  it('should handle uncaughtException by logging and exiting', () => {
    setupErrorHandlers({ logger: mockLogger, exitProcess: mockExitProcess });

    const error = new Error('Test error');
    error.stack = 'Test stack trace';
    const origin = 'uncaughtException';

    // Get the uncaughtException handler
    const uncaughtExceptionHandler = processListeners.get('uncaughtException')![0] as (err: Error, origin: string) => void;
    
    // Trigger the handler
    uncaughtExceptionHandler(error, origin);

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

  it('should handle unhandledRejection by logging and exiting', async () => {
    setupErrorHandlers({ logger: mockLogger, exitProcess: mockExitProcess });

    const reason = 'Test rejection reason';
    const promise = Promise.reject(reason);
    
    // Catch the rejection to prevent unhandled rejection warning
    promise.catch(() => {});

    // Get the unhandledRejection handler
    const unhandledRejectionHandler = processListeners.get('unhandledRejection')![0] as (reason: any, promise: Promise<unknown>) => void;
    
    // Trigger the handler
    unhandledRejectionHandler(reason, promise);

    // Verify logger was called
    expect(mockLogger.error).toHaveBeenCalledWith('[Server UNHANDLED_REJECTION] Reason:', { reason });
    expect(mockLogger.error).toHaveBeenCalledWith('[Server UNHANDLED_REJECTION] Promise:', { promise });

    // Verify process exit was called with code 1
    expect(mockExitProcess).toHaveBeenCalledWith(1);
  });

  it('should use process.exit by default if exitProcess is not provided', () => {
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    setupErrorHandlers({ logger: mockLogger });

    const error = new Error('Test error');
    const origin = 'uncaughtException';

    // Get the uncaughtException handler
    const uncaughtExceptionHandler = processListeners.get('uncaughtException')![0] as (err: Error, origin: string) => void;
    
    // Trigger the handler
    uncaughtExceptionHandler(error, origin);

    // Verify process.exit was called
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });
});
