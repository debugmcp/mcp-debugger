import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

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

type LoggerModule = typeof import('../../../src/utils/logger.js');

let loggerModule: LoggerModule;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('logger utility', () => {
  beforeEach(async () => {
    consoleTransportSpy.mockClear();
    fileTransportSpy.mockClear();
    createLoggerSpy.mockClear().mockReturnValue({ on: vi.fn(), warn: vi.fn() });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // The logger module keeps per-process state (file transport cache,
    // stale-log cleanup latch, default logger). Re-import fresh per test.
    vi.resetModules();
    loggerModule = await import('../../../src/utils/logger.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  /** Stub the fs calls createLogger makes so no real disk IO happens. */
  function stubFs({ dirExists = true }: { dirExists?: boolean } = {}) {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(dirExists);
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([]);
    return { existsSpy, mkdirSpy, readdirSpy };
  }

  it('adds console and file transports by default', () => {
    const { existsSpy, mkdirSpy } = stubFs();

    loggerModule.createLogger('debug-mcp:test', { level: 'debug' });

    expect(consoleTransportSpy).toHaveBeenCalledTimes(1);
    expect(fileTransportSpy).toHaveBeenCalledTimes(1);

    const loggerConfig = createLoggerSpy.mock.calls[0][0] as { transports: unknown[] };
    expect(loggerConfig.transports.map((entry) => (entry as { type: string }).type)).toEqual(
      expect.arrayContaining(['console', 'file'])
    );

    expect(existsSpy).toHaveBeenCalled();
    expect(mkdirSpy).not.toHaveBeenCalled();
  });

  it('uses a per-process default log file name on the host', () => {
    stubFs();

    loggerModule.createLogger('debug-mcp:test');

    const fileCall = fileTransportSpy.mock.calls[0][0] as { filename: string };
    expect(path.basename(fileCall.filename)).toBe(`debug-mcp-server-${process.pid}.log`);
  });

  it('honors an explicitly provided log file path verbatim', () => {
    stubFs();
    const explicit = path.join(os.tmpdir(), 'my-custom', 'server.log');

    loggerModule.createLogger('debug-mcp:test', { file: explicit });

    const fileCall = fileTransportSpy.mock.calls[0][0] as { filename: string };
    expect(fileCall.filename).toBe(explicit);
  });

  it('reuses one file transport per path across loggers in the same process', () => {
    stubFs();

    loggerModule.createLogger('debug-mcp:cli');
    loggerModule.createLogger('debug-mcp');

    // Same default path: the File transport must only be constructed once and
    // shared, so a single byte-counter/file-handle exists per process (#121).
    expect(fileTransportSpy).toHaveBeenCalledTimes(1);
    const firstConfig = createLoggerSpy.mock.calls[0][0] as { transports: unknown[] };
    const secondConfig = createLoggerSpy.mock.calls[1][0] as { transports: unknown[] };
    const firstFile = firstConfig.transports.find((t) => (t as { type: string }).type === 'file');
    const secondFile = secondConfig.transports.find((t) => (t as { type: string }).type === 'file');
    expect(firstFile).toBeDefined();
    expect(firstFile).toBe(secondFile);
  });

  it('creates distinct file transports for distinct explicit paths', () => {
    stubFs();

    loggerModule.createLogger('a', { file: path.join(os.tmpdir(), 'a.log') });
    loggerModule.createLogger('b', { file: path.join(os.tmpdir(), 'b.log') });

    expect(fileTransportSpy).toHaveBeenCalledTimes(2);
  });

  it('runs stale-log cleanup only once per process and only for the default host path', () => {
    const { readdirSpy } = stubFs();

    loggerModule.createLogger('explicit', { file: path.join(os.tmpdir(), 'x.log') });
    expect(readdirSpy).not.toHaveBeenCalled();

    loggerModule.createLogger('debug-mcp:test');
    loggerModule.createLogger('debug-mcp:test2');
    expect(readdirSpy).toHaveBeenCalledTimes(1);
  });

  it('logs into container path when running in MCP container', () => {
    vi.stubEnv('MCP_CONTAINER', 'true');
    const { existsSpy, readdirSpy } = stubFs();

    loggerModule.createLogger('debug-mcp:test');

    expect(fileTransportSpy).toHaveBeenCalled();
    const fileCall = fileTransportSpy.mock.calls[0][0] as { filename: string };
    expect(fileCall.filename).toBe('/app/logs/debug-mcp-server.log');
    expect(existsSpy).toHaveBeenCalledWith('/app/logs');
    // Container mode keeps the fixed single-process filename; no pid-file cleanup.
    expect(readdirSpy).not.toHaveBeenCalled();
  });

  it('reports directory creation failures when console output is enabled', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw new Error('permission denied');
    });
    vi.spyOn(fs, 'readdirSync').mockReturnValue([]);
    loggerModule.createLogger('debug-mcp:test');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to ensure log directory'),
      expect.any(Error)
    );
    expect(existsSpy).toHaveBeenCalled();
  });

  it('suppresses console errors when console output is silenced', () => {
    vi.stubEnv('CONSOLE_OUTPUT_SILENCED', '1');
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw new Error('permission denied');
    });
    vi.spyOn(fs, 'readdirSync').mockReturnValue([]);
    loggerModule.createLogger('debug-mcp:test');

    expect(consoleTransportSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(existsSpy).toHaveBeenCalled();
  });

  it('provides fallback logger when getLogger is invoked before initialization', () => {
    stubFs();
    const fallbackWarn = vi.fn();
    createLoggerSpy.mockReturnValue({ on: vi.fn(), warn: fallbackWarn });

    const logger = loggerModule.getLogger();

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
    stubFs();
    loggerModule.createLogger('debug-mcp:test');

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
    vi.stubEnv('CONSOLE_OUTPUT_SILENCED', '1');
    stubFs();

    loggerModule.createLogger('debug-mcp:test');

    const loggerInstance = createLoggerSpy.mock.results[0].value as { on: ReturnType<typeof vi.fn> };
    const errorHandler = loggerInstance.on.mock.calls.find(([event]) => event === 'error')?.[1] as
      | ((err: Error) => void)
      | undefined;

    consoleErrorSpy.mockClear();
    errorHandler?.(new Error('transport failed'));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

describe('cleanupStaleLogFiles', () => {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    loggerModule = await import('../../../src/utils/logger.js');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-log-cleanup-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeAgedFile(name: string, ageMs: number): string {
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, 'log data');
    const past = new Date(Date.now() - ageMs);
    fs.utimesSync(filePath, past, past);
    return filePath;
  }

  /** Injected signal fn that throws an ErrnoException with the given code (issue #183). */
  function throwingSignal(errorCode: string): () => never {
    return () => {
      const err = new Error(errorCode) as NodeJS.ErrnoException;
      err.code = errorCode;
      throw err;
    };
  }

  it('deletes old per-pid log files of dead processes', () => {
    const stale = makeAgedFile('debug-mcp-server-424242.log', WEEK_MS + 1000);

    loggerModule.cleanupStaleLogFiles(tmpDir, { signal: throwingSignal('ESRCH') });

    expect(fs.existsSync(stale)).toBe(false);
  });

  it('never deletes the current process own log file, even when artificially aged', () => {
    const own = makeAgedFile(`debug-mcp-server-${process.pid}.log`, WEEK_MS * 10);

    loggerModule.cleanupStaleLogFiles(tmpDir);

    expect(fs.existsSync(own)).toBe(true);
  });

  it('skips files whose pid is alive but not ours (EPERM from the signal)', () => {
    const kept = makeAgedFile('debug-mcp-server-424242.log', WEEK_MS + 1000);

    loggerModule.cleanupStaleLogFiles(tmpDir, { signal: throwingSignal('EPERM') });

    expect(fs.existsSync(kept)).toBe(true);
  });

  it('skips files whose pid is alive (signalling 0 succeeds)', () => {
    const kept = makeAgedFile('debug-mcp-server-424242.log', WEEK_MS + 1000);

    loggerModule.cleanupStaleLogFiles(tmpDir, { signal: () => {} });

    expect(fs.existsSync(kept)).toBe(true);
  });

  it('keeps recent per-pid files of dead processes', () => {
    const fresh = makeAgedFile('debug-mcp-server-424242.log', 60_000);

    loggerModule.cleanupStaleLogFiles(tmpDir, { signal: throwingSignal('ESRCH') });

    expect(fs.existsSync(fresh)).toBe(true);
  });

  it('never touches non-pid log files, however old', () => {
    const legacy = makeAgedFile('debug-mcp-server.log', WEEK_MS * 10);
    const proxy = makeAgedFile('proxy-session-abc.log', WEEK_MS * 10);
    const other = makeAgedFile('something-else.txt', WEEK_MS * 10);

    loggerModule.cleanupStaleLogFiles(tmpDir, { signal: throwingSignal('ESRCH') });

    expect(fs.existsSync(legacy)).toBe(true);
    expect(fs.existsSync(proxy)).toBe(true);
    expect(fs.existsSync(other)).toBe(true);
  });

  it('supports overriding retention age', () => {
    const stale = makeAgedFile('debug-mcp-server-424242.log', 5_000);

    loggerModule.cleanupStaleLogFiles(tmpDir, { maxAgeMs: 1_000, signal: throwingSignal('ESRCH') });

    expect(fs.existsSync(stale)).toBe(false);
  });

  it('ignores unreadable directories', () => {
    expect(() =>
      loggerModule.cleanupStaleLogFiles(path.join(tmpDir, 'does-not-exist'))
    ).not.toThrow();
  });
});
