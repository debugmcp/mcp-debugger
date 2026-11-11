import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { EventEmitter } from 'events';
import { handleStdioCommand } from '../../../src/cli/stdio-command.js';
import type { ServerFactoryOptions } from '../../../src/cli/stdio-command.js';
import { FakeCurrentProcess } from '../../test-utils/mocks/fake-current-process.js';
import type { Logger as WinstonLoggerType } from 'winston';
import { DebugMcpServer } from '../../../src/server.js';
import type { createProtocolServer } from '../../../src/server/protocol-facade.js';

vi.mock('../../../src/server.js');

describe('STDIO Command Handler', () => {
  let mockLogger: WinstonLoggerType;
  let mockServerFactory: Mock<(options: ServerFactoryOptions) => DebugMcpServer>;
  let mockExitProcess: Mock<(code: number) => void>;
  let mockServer: DebugMcpServer;
  let mockFacade: { connect: Mock<() => Promise<void>> };
  let mockProtocolServerFactory: Mock<typeof createProtocolServer>;
  let fakeProc: FakeCurrentProcess;

  function makeFakeStdin() {
    const stdin = new EventEmitter() as unknown as NodeJS.ReadStream & {
      resume: Mock<() => void>;
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

    // The core (issue #1025, step 2): it owns no SDK Server; the command
    // builds a protocol facade over it and connects THAT to the transport.
    mockServer = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined)
    } as any;
    mockFacade = { connect: vi.fn().mockResolvedValue(undefined) };
    mockProtocolServerFactory = vi.fn(() => mockFacade as any);

    // Create mock server factory
    mockServerFactory = vi.fn(() => mockServer);

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
      protocolServerFactory: mockProtocolServerFactory,
      exitProcess: mockExitProcess,
      stdin: makeFakeStdin(),
      proc: fakeProc
    });

    // Verify log level was set
    expect(mockLogger.level).toBe('debug');

    // Verify info log was called
    expect(mockLogger.info).toHaveBeenCalledWith('Starting Debug MCP Server in stdio mode');

    // Verify server factory was called with correct options. No transport
    // chooses an idle window: the policy is the operator's variable alone
    // (issue #1025, step 2).
    expect(mockServerFactory).toHaveBeenCalledWith({
      logLevel: 'debug',
      logFile: '/tmp/test.log'
    });

    // Verify server start was called
    expect(mockServer.start).toHaveBeenCalled();

    // The transport is connected to a legacy-era protocol facade over the core,
    // never to the core itself (issue #1025, step 2)
    expect(mockProtocolServerFactory).toHaveBeenCalledWith(mockServer, { era: 'legacy', deliver: 'instance' });
    expect(mockFacade.connect).toHaveBeenCalledTimes(1);

    // Verify success log
    expect(mockLogger.info).toHaveBeenCalledWith('Server started successfully in stdio mode');

    // Verify process did not exit
    expect(mockExitProcess).not.toHaveBeenCalled();
  });

  it('should register SIGTERM/SIGINT/exit listeners on the injected process handle', async () => {
    await handleStdioCommand({}, {
      logger: mockLogger,
      serverFactory: mockServerFactory,
      protocolServerFactory: mockProtocolServerFactory,
      exitProcess: mockExitProcess,
      stdin: makeFakeStdin(),
      proc: fakeProc
    });

    expect(fakeProc.listenerCount('SIGTERM')).toBe(1);
    expect(fakeProc.listenerCount('SIGINT')).toBe(1);
    expect(fakeProc.listenerCount('exit')).toBe(1);

    // SIGINT exits 0 through the injected exitProcess (after awaiting server stop)
    fakeProc.emit('SIGINT');
    await vi.waitFor(() => expect(mockExitProcess).toHaveBeenCalledWith(0));

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
      protocolServerFactory: mockProtocolServerFactory,
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
      protocolServerFactory: mockProtocolServerFactory,
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
      protocolServerFactory: mockProtocolServerFactory,
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
      protocolServerFactory: mockProtocolServerFactory,
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
      protocolServerFactory: mockProtocolServerFactory,
        exitProcess: mockExitProcess,
        stdin,
        proc: fakeProc
      });

      expect(stdin.resume).toHaveBeenCalled();
      expect(mockExitProcess).not.toHaveBeenCalled();

      stdin.emit('end');

      await vi.waitFor(() => expect(mockExitProcess).toHaveBeenCalledWith(0));
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('MCP client disconnected')
      );
    });

    // c251b3ff's case: `docker run` WITHOUT -i, where stdin is already closed
    // before any client speaks. This must keep working exactly as before --
    // it is the regression guard on the #633 fix below.
    it('keeps running on stdin end in container mode when no client ever spoke', async () => {
      fakeProc.env.MCP_CONTAINER = 'true';
      const stdin = makeFakeStdin();

      await handleStdioCommand({}, {
        logger: mockLogger,
        serverFactory: mockServerFactory,
      protocolServerFactory: mockProtocolServerFactory,
        exitProcess: mockExitProcess,
        stdin,
        proc: fakeProc
      });

      stdin.emit('end');

      expect(mockExitProcess).not.toHaveBeenCalled();
      expect(mockServer.stop).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('detached container, staying alive')
      );
    });
  });

  describe('container stdio orphans (issue #633)', () => {
    async function startInContainerMode() {
      fakeProc.env.MCP_CONTAINER = 'true';
      const stdin = makeFakeStdin();
      await handleStdioCommand({}, {
        logger: mockLogger,
        serverFactory: mockServerFactory,
      protocolServerFactory: mockProtocolServerFactory,
        exitProcess: mockExitProcess,
        stdin,
        proc: fakeProc
      });
      return stdin;
    }

    // The leak: `docker run -i` + a client that spoke and then went away. The
    // container must exit, or `--rm` never fires and every session leaks one.
    it('exits when stdin ends in container mode after a client has spoken', async () => {
      const stdin = await startInContainerMode();

      stdin.emit('data', Buffer.from('{"jsonrpc":"2.0","method":"initialize","id":1}'));
      stdin.emit('end');

      await vi.waitFor(() => expect(mockExitProcess).toHaveBeenCalledWith(0));
      expect(mockServer.stop).toHaveBeenCalled();
    });

    it('exits on stdin close after a client has spoken, not just on end', async () => {
      const stdin = await startInContainerMode();

      stdin.emit('data', Buffer.from('{}'));
      stdin.emit('close');

      await vi.waitFor(() => expect(mockExitProcess).toHaveBeenCalledWith(0));
    });

    it('exits on a broken stdin pipe after a client has spoken', async () => {
      const stdin = await startInContainerMode();

      stdin.emit('data', Buffer.from('{}'));
      stdin.emit('error', new Error('EPIPE'));

      await vi.waitFor(() => expect(mockExitProcess).toHaveBeenCalledWith(0));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('EPIPE'));
    });

    // end and close normally both fire; teardown must not run twice.
    it('shuts down once when end and close both fire', async () => {
      const stdin = await startInContainerMode();

      stdin.emit('data', Buffer.from('{}'));
      stdin.emit('end');
      stdin.emit('close');

      await vi.waitFor(() => expect(mockExitProcess).toHaveBeenCalledWith(0));
      expect(mockServer.stop).toHaveBeenCalledTimes(1);
    });

    it('still exits in host mode on stdin close, with no traffic needed', async () => {
      const stdin = makeFakeStdin();
      await handleStdioCommand({}, {
        logger: mockLogger,
        serverFactory: mockServerFactory,
      protocolServerFactory: mockProtocolServerFactory,
        exitProcess: mockExitProcess,
        stdin,
        proc: fakeProc
      });

      stdin.emit('close');

      await vi.waitFor(() => expect(mockExitProcess).toHaveBeenCalledWith(0));
    });
  });

  describe('server teardown on exit paths (issue #337)', () => {
    // Every exit path must run DebugMcpServer.stop() → closeAllSessions()
    // before exiting — otherwise the proxy chains (and lldb-server's ptrace
    // claim on an attach target) outlive the server.
    async function startWithStdin() {
      const stdin = makeFakeStdin();
      await handleStdioCommand({}, {
        logger: mockLogger,
        serverFactory: mockServerFactory,
      protocolServerFactory: mockProtocolServerFactory,
        exitProcess: mockExitProcess,
        stdin,
        proc: fakeProc
      });
      return stdin;
    }

    it('stops the debug server before exiting when stdin ends', async () => {
      const stdin = await startWithStdin();

      stdin.emit('end');

      await vi.waitFor(() => expect(mockExitProcess).toHaveBeenCalledWith(0));
      expect(mockServer.stop).toHaveBeenCalled();
      expect(vi.mocked(mockServer.stop).mock.invocationCallOrder[0])
        .toBeLessThan(mockExitProcess.mock.invocationCallOrder[0]);
    });

    it('stops the debug server before exiting on SIGTERM', async () => {
      await startWithStdin();

      fakeProc.emit('SIGTERM');

      await vi.waitFor(() => expect(mockExitProcess).toHaveBeenCalledWith(0));
      expect(mockServer.stop).toHaveBeenCalled();
    });

    it('exits after the guard delay when stop hangs', async () => {
      mockServer.stop = vi.fn().mockReturnValue(new Promise(() => {}));
      const stdin = await startWithStdin();
      vi.useFakeTimers();
      try {
        stdin.emit('end');
        expect(mockExitProcess).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(5000);

        expect(mockExitProcess).toHaveBeenCalledWith(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('still exits when stop rejects', async () => {
      mockServer.stop = vi.fn().mockRejectedValue(new Error('stop failed'));
      const stdin = await startWithStdin();

      stdin.emit('end');

      await vi.waitFor(() => expect(mockExitProcess).toHaveBeenCalledWith(0));
    });

    it('runs the teardown only once when several exit triggers fire', async () => {
      const stdin = await startWithStdin();

      stdin.emit('end');
      fakeProc.emit('SIGTERM');
      fakeProc.emit('SIGINT');

      await vi.waitFor(() => expect(mockExitProcess).toHaveBeenCalled());
      expect(mockServer.stop).toHaveBeenCalledTimes(1);
      expect(mockExitProcess).toHaveBeenCalledTimes(1);
    });
  });
});
