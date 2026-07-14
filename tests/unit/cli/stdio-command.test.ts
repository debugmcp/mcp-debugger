import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { handleStdioCommand } from '../../../src/cli/stdio-command.js';
import { FakeCurrentProcess } from '../../test-utils/mocks/fake-current-process.js';
import type { Logger as WinstonLoggerType } from 'winston';
import { DebugMcpServer } from '../../../src/server.js';

vi.mock('../../../src/server.js');

describe('STDIO Command Handler', () => {
  let mockLogger: WinstonLoggerType;
  let mockServerFactory: ReturnType<typeof vi.fn>;
  let mockExitProcess: ReturnType<typeof vi.fn>;
  let mockServer: DebugMcpServer;
  let fakeProc: FakeCurrentProcess;

  function makeFakeStdin() {
    const stdin = new EventEmitter() as unknown as NodeJS.ReadStream & {
      resume: ReturnType<typeof vi.fn>;
      emit: (event: string, ...args: unknown[]) => boolean;
    };
    (stdin as unknown as { resume: unknown }).resume = vi.fn();
    return stdin;
  }

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      level: 'info'
    } as any;

    // Create mock server with proper structure
    mockServer = {
      server: {
        connect: vi.fn().mockResolvedValue(undefined)
      },
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined)
    } as any;

    // Create mock server factory
    mockServerFactory = vi.fn().mockReturnValue(mockServer);

    // Create mock exit function
    mockExitProcess = vi.fn();

    // Signal/exit listeners attach to the fake's emitter, never the real
    // process (issues #159/#183).
    fakeProc = new FakeCurrentProcess();
  });

  afterEach(() => {
    // Fire the SIGTERM handlers once: each closes over the 60s keepAlive
    // interval and clears it; the exit goes to the mocked exitProcess.
    fakeProc.emit('SIGTERM');
  });

  it('should start server successfully in stdio mode', async () => {
    const options = {
      logLevel: 'debug',
      logFile: '/tmp/test.log'
    };

    await handleStdioCommand(options, {
      logger: mockLogger,
      serverFactory: mockServerFactory,
      exitProcess: mockExitProcess,
      stdin: makeFakeStdin(),
      proc: fakeProc
    });

    // Verify log level was set
    expect(mockLogger.level).toBe('debug');

    // Verify info log was called
    expect(mockLogger.info).toHaveBeenCalledWith('Starting Debug MCP Server in stdio mode');

    // Verify server factory was called with correct options
    expect(mockServerFactory).toHaveBeenCalledWith({
      logLevel: 'debug',
      logFile: '/tmp/test.log'
    });

    // Verify server start was called
    expect(mockServer.start).toHaveBeenCalled();

    // Verify success log
    expect(mockLogger.info).toHaveBeenCalledWith('Server started successfully in stdio mode');

    // Verify process did not exit
    expect(mockExitProcess).not.toHaveBeenCalled();
  });

  it('should register SIGTERM/SIGINT/exit listeners on the injected process handle', async () => {
    await handleStdioCommand({}, {
      logger: mockLogger,
      serverFactory: mockServerFactory,
      exitProcess: mockExitProcess,
      stdin: makeFakeStdin(),
      proc: fakeProc
    });

    expect(fakeProc.listenerCount('SIGTERM')).toBe(1);
    expect(fakeProc.listenerCount('SIGINT')).toBe(1);
    expect(fakeProc.listenerCount('exit')).toBe(1);

    // SIGINT exits 0 through the injected exitProcess
    fakeProc.emit('SIGINT');
    expect(mockExitProcess).toHaveBeenCalledWith(0);

    // 'exit' diagnostics read argv/env/uptime from the handle
    fakeProc.emit('exit', 0);
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[MCP] Process exiting',
      expect.objectContaining({ code: 0, argv: fakeProc.argv, uptime: 0 })
    );
  });

  it('should not change log level if not provided in options', async () => {
    const options = {};
    mockLogger.level = 'warn';

    await handleStdioCommand(options, {
      logger: mockLogger,
      serverFactory: mockServerFactory,
      exitProcess: mockExitProcess,
      stdin: makeFakeStdin(),
      proc: fakeProc
    });

    // Verify log level was not changed
    expect(mockLogger.level).toBe('warn');

    // Verify server factory was called with correct options
    expect(mockServerFactory).toHaveBeenCalledWith({
      logLevel: undefined,
      logFile: undefined
    });
  });

  it('should handle server start failure', async () => {
    const options = {};
    const error = new Error('Server start failed');

    // Make server.start reject
    mockServer.start = vi.fn().mockRejectedValue(error);

    await handleStdioCommand(options, {
      logger: mockLogger,
      serverFactory: mockServerFactory,
      exitProcess: mockExitProcess,
      proc: fakeProc
    });

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to start server in stdio mode', { error });

    // Verify process exited with code 1
    expect(mockExitProcess).toHaveBeenCalledWith(1);
  });

  it('should fall back to proc.exit if exitProcess is not provided', async () => {
    const error = new Error('Server start failed');

    // Make server.start reject
    mockServer.start = vi.fn().mockRejectedValue(error);

    await handleStdioCommand({}, {
      logger: mockLogger,
      serverFactory: mockServerFactory,
      proc: fakeProc
    });

    // Verify the injected process handle's exit was called
    expect(fakeProc.exit).toHaveBeenCalledWith(1);
  });

  it('should handle server factory throwing an error', async () => {
    const error = new Error('Factory error');
    mockServerFactory.mockImplementation(() => {
      throw error;
    });

    await handleStdioCommand({}, {
      logger: mockLogger,
      serverFactory: mockServerFactory,
      exitProcess: mockExitProcess,
      proc: fakeProc
    });

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to start server in stdio mode', { error });

    // Verify process exited with code 1
    expect(mockExitProcess).toHaveBeenCalledWith(1);
  });

  describe('stdin EOF handling (issue #122)', () => {
    it('exits 0 when stdin ends in host mode (MCP client disconnected)', async () => {
      const stdin = makeFakeStdin();

      await handleStdioCommand({}, {
        logger: mockLogger,
        serverFactory: mockServerFactory,
        exitProcess: mockExitProcess,
        stdin,
        proc: fakeProc
      });

      expect(stdin.resume).toHaveBeenCalled();
      expect(mockExitProcess).not.toHaveBeenCalled();

      stdin.emit('end');

      expect(mockExitProcess).toHaveBeenCalledWith(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('MCP client disconnected')
      );
    });

    it('keeps running on stdin end in container mode (MCP_CONTAINER=true)', async () => {
      fakeProc.env.MCP_CONTAINER = 'true';
      const stdin = makeFakeStdin();

      await handleStdioCommand({}, {
        logger: mockLogger,
        serverFactory: mockServerFactory,
        exitProcess: mockExitProcess,
        stdin,
        proc: fakeProc
      });

      stdin.emit('end');

      expect(mockExitProcess).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('ignoring in container mode')
      );
    });
  });
});
