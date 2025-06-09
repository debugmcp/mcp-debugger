/**
 * Unit tests for Logger
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLogger, LoggerOptions } from '../../../src/utils/logger.js';
import winston from 'winston';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Mock modules
vi.mock('winston', () => {
  const createLoggerSpy = vi.fn();
  const formatCombineSpy = vi.fn();
  const formatTimestampSpy = vi.fn();
  const formatPrintfSpy = vi.fn();
  const formatColorizeSpy = vi.fn();
  const formatJsonSpy = vi.fn();
  const transportsConsoleSpy = vi.fn();
  const transportsFileSpy = vi.fn();

  const winstonFormatMock = {
    combine: formatCombineSpy,
    timestamp: formatTimestampSpy,
    printf: formatPrintfSpy,
    colorize: formatColorizeSpy,
    json: formatJsonSpy,
  };

  const winstonTransportsMock = {
    Console: transportsConsoleSpy,
    File: transportsFileSpy,
  };

  return {
    // Default export for `import winston from 'winston'`
    default: {
      createLogger: createLoggerSpy,
      format: winstonFormatMock,
      transports: winstonTransportsMock,
    },
    // Named exports for `import { createLogger } from 'winston'` (ensures same spies)
    createLogger: createLoggerSpy,
    format: winstonFormatMock,
    transports: winstonTransportsMock,
  };
});

vi.mock('fs');
vi.mock('url', () => ({
  fileURLToPath: vi.fn()
}));

describe('Logger', () => {
  let mockWinstonLogger: any;
  let mockConsoleTransport: any;
  let mockFileTransport: any;
  let mockFs: any;

  beforeEach(() => {
    // Create mock winston logger
    mockWinstonLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      close: vi.fn(),
      on: vi.fn() // Add mock for 'on' method
    };

    // Create mock transports
    mockConsoleTransport = { name: 'console' };
    mockFileTransport = { name: 'file' };

    // Setup winston mocks
    vi.mocked(winston.createLogger).mockReturnValue(mockWinstonLogger);
    vi.mocked(winston.transports.Console).mockReturnValue(mockConsoleTransport);
    vi.mocked(winston.transports.File).mockReturnValue(mockFileTransport);
    vi.mocked(winston.format.combine).mockReturnValue({ transform: vi.fn() } as any);
    vi.mocked(winston.format.timestamp).mockReturnValue({ transform: vi.fn() } as any);
    vi.mocked(winston.format.printf).mockReturnValue({ transform: vi.fn() } as any);
    vi.mocked(winston.format.colorize).mockReturnValue({ 
      transform: vi.fn(),
      createColorize: vi.fn(),
      addColors: vi.fn(),
      colorize: vi.fn()
    } as any);
    vi.mocked(winston.format.json).mockReturnValue({ transform: vi.fn() } as any);

    // Setup fs mocks
    mockFs = fs as any;
    vi.mocked(mockFs.existsSync).mockReturnValue(true);
    vi.mocked(mockFs.mkdirSync).mockReturnValue(undefined);

    // Setup url mock
    vi.mocked(fileURLToPath).mockReturnValue('/fake/path/to/logger.js');

    // Reset NODE_ENV
    delete process.env.NODE_ENV;

    vi.clearAllMocks(); // This will clear all spies including those from the mock factory

    // Re-setup default behaviors for spies using the imported 'winston'
    // which should now point to the mocked module.
    vi.mocked(winston.createLogger).mockReturnValue(mockWinstonLogger);
    vi.mocked(winston.transports.Console).mockReturnValue(mockConsoleTransport);
    vi.mocked(winston.transports.File).mockReturnValue(mockFileTransport);
    vi.mocked(winston.format.combine).mockReturnValue({ transform: vi.fn() } as any);
    vi.mocked(winston.format.timestamp).mockReturnValue({ transform: vi.fn() } as any);
    vi.mocked(winston.format.printf).mockReturnValue({ transform: vi.fn() } as any);
    vi.mocked(winston.format.colorize).mockReturnValue({ 
      transform: vi.fn(),
      createColorize: vi.fn(),
      addColors: vi.fn(),
      colorize: vi.fn()
    } as any);
    vi.mocked(winston.format.json).mockReturnValue({ transform: vi.fn() } as any);
  });

  describe('createLogger', () => {
    it('should create logger with default options', () => {
      const logger = createLogger('test-module');

      expect(winston.createLogger).toHaveBeenCalledWith({
        level: 'info',
        transports: [mockConsoleTransport, mockFileTransport],
        defaultMeta: { namespace: 'test-module' },
        exitOnError: false
      });

      // Should create default log file
      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: expect.stringMatching(/[/\\]logs[/\\]debug-mcp-server\.log$/),
        format: expect.anything()
      });
    });

    it('should use info level even in test environment', () => {
      process.env.NODE_ENV = 'test';
      
      const logger = createLogger('test-module');

      // FIXED: Logger no longer changes behavior based on test environment
      // This test was updated to reflect the removal of the test environment anti-pattern
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info' // Now always defaults to 'info' regardless of environment
        })
      );
    });

    it('should create logger with custom log level', () => {
      const logger = createLogger('test-module', { level: 'debug' });

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug'
        })
      );
    });

    it('should create logger with custom file path', () => {
      const logger = createLogger('test-module', { file: '/custom/path/app.log' });

      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: '/custom/path/app.log',
        format: expect.anything()
      });
    });

    it('should ensure log directory exists', () => {
      mockFs.existsSync.mockReturnValue(false);

      createLogger('test-module', { file: '/logs/custom.log' });

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        '/logs',
        { recursive: true }
      );
    });

    it('should handle directory creation errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      createLogger('test-module', { file: '/restricted/app.log' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Logger Init Error]'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should override test environment level when explicitly set', () => {
      process.env.NODE_ENV = 'test';
      
      const logger = createLogger('test-module', { level: 'debug' });

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug'
        })
      );
    });
  });

  describe('Console transport configuration', () => {
    it('should configure console transport with correct format', () => {
      createLogger('test-module');

      expect(winston.transports.Console).toHaveBeenCalledWith({
        format: expect.anything()
      });

      expect(winston.format.colorize).toHaveBeenCalled();
      expect(winston.format.timestamp).toHaveBeenCalled();
      expect(winston.format.printf).toHaveBeenCalled();
    });

    it('should configure printf format for console', () => {
      createLogger('test-module');

      // Get the printf function from the first call (console transport)
      const printfCalls = vi.mocked(winston.format.printf).mock.calls;
      const consolePrintfFn = printfCalls[0][0] as (info: any) => string;

      // Test the printf function
      const result = consolePrintfFn({
        timestamp: '2024-01-01 12:00:00',
        level: 'info',
        message: 'Test message',
        extra: 'data',
        count: 42
      });

      expect(result).toContain('2024-01-01 12:00:00');
      expect(result).toContain('[info]');
      expect(result).toContain('[test-module]');
      expect(result).toContain('Test message');
      expect(result).toContain('"extra": "data"');
      expect(result).toContain('"count": 42');
    });

    it('should handle console format without extra data', () => {
      createLogger('test-module');

      const printfFn = vi.mocked(winston.format.printf).mock.calls[0][0] as (info: any) => string;
      
      const result = printfFn({
        timestamp: '2024-01-01 12:00:00',
        level: 'error',
        message: 'Error occurred'
      });

      expect(result).toBe('2024-01-01 12:00:00 [error] [test-module]: Error occurred ');
    });
  });

  describe('File transport configuration', () => {
    it('should configure file transport with JSON format', () => {
      createLogger('test-module', { file: '/logs/app.log' });

      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: '/logs/app.log',
        format: expect.anything()
      });

      // File transport should use timestamp and json format
      expect(winston.format.json).toHaveBeenCalled();
    });

    it('should use default log file path when not specified', () => {
      createLogger('test-module');

      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: expect.stringMatching(/logs[/\\]debug-mcp-server\.log$/),
        format: expect.anything()
      });
    });
  });

  describe('Logger instance usage', () => {
    it('should return winston logger instance', () => {
      const logger = createLogger('test-module');

      expect(logger).toBe(mockWinstonLogger);
    });

    it('should be able to log messages', () => {
      const logger = createLogger('test-module');

      logger.info('Info message');
      logger.error('Error message');
      logger.warn('Warning message');
      logger.debug('Debug message');

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('Info message');
      expect(mockWinstonLogger.error).toHaveBeenCalledWith('Error message');
      expect(mockWinstonLogger.warn).toHaveBeenCalledWith('Warning message');
      expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Debug message');
    });
  });

  describe('Path resolution', () => {
    it('should resolve paths correctly', () => {
      vi.mocked(fileURLToPath).mockReturnValue('/project/src/utils/logger.js');
      
      createLogger('test-module');

      // Should resolve to project root logs directory
      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: expect.stringMatching(/[/\\]project[/\\]logs[/\\]debug-mcp-server\.log$/),
        format: expect.anything()
      });
    });
  });
});
