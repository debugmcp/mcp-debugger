import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';

const consoleTransportSpy = vi.fn(function (this: Record<string, unknown>, options: unknown) {
  this.type = 'console';
  this.options = options;
});
const fileTransportSpy = vi.fn(function (this: Record<string, unknown>, options: unknown) {
  this.type = 'file';
  this.options = options;
});
const createLoggerSpy = vi.fn(() => ({
  on: vi.fn(),
  warn: vi.fn()
}));

vi.mock('winston', () => ({
  createLogger: (...args: unknown[]) => createLoggerSpy(...args),
  transports: {
    Console: function Console(this: Record<string, unknown>, options: unknown) {
      consoleTransportSpy.call(this, options);
    },
    File: function File(this: Record<string, unknown>, options: unknown) {
      fileTransportSpy.call(this, options);
    }
  },
  format: {
    combine: (...args: unknown[]) => ({ type: 'combine', args }),
    colorize: vi.fn(),
    timestamp: vi.fn(),
    printf: vi.fn((formatter: (info: unknown) => string) => formatter),
    json: vi.fn()
  }
}));

const { createLogger, getLogger } = await import('../../../src/utils/logger.js');

const originalEnv = { ...process.env };
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('logger utility', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    consoleTransportSpy.mockClear();
    fileTransportSpy.mockClear();
    createLoggerSpy.mockClear().mockReturnValue({ on: vi.fn(), warn: vi.fn() });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('adds console and file transports by default', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});

    createLogger('debug-mcp:test', { level: 'debug' });

    expect(consoleTransportSpy).toHaveBeenCalledTimes(1);
    expect(fileTransportSpy).toHaveBeenCalledTimes(1);

    const loggerConfig = createLoggerSpy.mock.calls[0][0] as { transports: unknown[] };
    expect(loggerConfig.transports.map((entry) => (entry as { type: string }).type)).toEqual(
      expect.arrayContaining(['console', 'file'])
    );

    expect(existsSpy).toHaveBeenCalled();
    expect(mkdirSpy).not.toHaveBeenCalled();
  });

  it('logs into container path when running in MCP container', () => {
    process.env.MCP_CONTAINER = 'true';
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});

    createLogger('debug-mcp:test');

    expect(fileTransportSpy).toHaveBeenCalled();
    const fileCall = fileTransportSpy.mock.calls[0][0] as { filename: string };
    expect(fileCall.filename).toBe('/app/logs/debug-mcp-server.log');
    expect(existsSpy).toHaveBeenCalledWith('/app/logs');
  });

  it('reports directory creation failures when console output is enabled', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw new Error('permission denied');
    });
    createLogger('debug-mcp:test');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to ensure log directory'),
      expect.any(Error)
    );
    expect(existsSpy).toHaveBeenCalled();
  });

  it('suppresses console errors when console output is silenced', () => {
    process.env.CONSOLE_OUTPUT_SILENCED = '1';
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw new Error('permission denied');
    });
    createLogger('debug-mcp:test');

    expect(consoleTransportSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(existsSpy).toHaveBeenCalled();
  });

  it('provides fallback logger when getLogger is invoked before initialization', () => {
    const fallbackWarn = vi.fn();
    createLoggerSpy.mockReturnValue({ on: vi.fn(), warn: fallbackWarn });

    const logger = getLogger();

    const callArgs = createLoggerSpy.mock.calls[0][0] as {
      level: string;
      defaultMeta: { namespace: string };
    };
    expect(callArgs.level).toBe('info');
    expect(callArgs.defaultMeta.namespace).toBe('debug-mcp:default-fallback');
    expect(fallbackWarn).toHaveBeenCalledWith(
      '[Logger] getLogger() called before root logger was initialized. Using fallback logger.'
    );
    expect(logger).toBeTruthy();
  });
  it('logs transport errors when console output enabled', () => {
    createLogger('debug-mcp:test');

    const loggerInstance = createLoggerSpy.mock.results[0].value as { on: ReturnType<typeof vi.fn> };
    const errorHandler = loggerInstance.on.mock.calls.find(([event]) => event === 'error')?.[1] as
      | ((err: Error) => void)
      | undefined;

    expect(errorHandler).toBeTypeOf('function');

    const transportError = new Error('transport failed');
    errorHandler?.(transportError);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Winston Logger Internal Error] Failed to write to a transport:',
      transportError
    );
  });

  it('suppresses transport error logging when console output is silenced', () => {
    process.env.CONSOLE_OUTPUT_SILENCED = '1';

    createLogger('debug-mcp:test');

    const loggerInstance = createLoggerSpy.mock.results[0].value as { on: ReturnType<typeof vi.fn> };
    const errorHandler = loggerInstance.on.mock.calls.find(([event]) => event === 'error')?.[1] as
      | ((err: Error) => void)
      | undefined;

    consoleErrorSpy.mockClear();
    errorHandler?.(new Error('transport failed'));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    delete process.env.CONSOLE_OUTPUT_SILENCED;
  });
});
