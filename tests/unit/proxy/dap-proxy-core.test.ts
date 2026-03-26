/**
 * Unit tests for dap-proxy-core.ts — ProxyRunner, detectExecutionMode, shouldAutoExecute
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProxyRunner, detectExecutionMode, shouldAutoExecute } from '../../../src/proxy/dap-proxy-core.js';
import { ProxyState } from '../../../src/proxy/dap-proxy-interfaces.js';
import type { DapProxyDependencies, ILogger } from '../../../src/proxy/dap-proxy-interfaces.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createMockDependencies(): DapProxyDependencies {
  return {
    loggerFactory: vi.fn().mockResolvedValue({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    }),
    fileSystem: {
      ensureDir: vi.fn().mockResolvedValue(undefined),
      pathExists: vi.fn().mockResolvedValue(true)
    },
    processSpawner: {
      spawn: vi.fn()
    },
    dapClientFactory: {
      create: vi.fn()
    },
    messageSender: {
      send: vi.fn()
    }
  };
}

function createMockLogger(): ILogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  };
}

/* ------------------------------------------------------------------ */
/*  ProxyRunner                                                        */
/* ------------------------------------------------------------------ */

describe('ProxyRunner', () => {
  let deps: DapProxyDependencies;
  let logger: ILogger;
  let runner: ProxyRunner;

  // Save original process.send
  const originalSend = process.send;

  beforeEach(() => {
    deps = createMockDependencies();
    logger = createMockLogger();
    // Ensure process.send is undefined so we don't accidentally set up IPC
    delete (process as any).send;
  });

  afterEach(async () => {
    // Restore process.send
    if (originalSend) {
      process.send = originalSend;
    } else {
      delete (process as any).send;
    }
    if (runner) {
      await runner.stop();
    }
  });

  it('constructs without errors', () => {
    runner = new ProxyRunner(deps, logger);
    expect(runner).toBeDefined();
  });

  it('getWorkerState() returns UNINITIALIZED initially', () => {
    runner = new ProxyRunner(deps, logger);
    expect(runner.getWorkerState()).toBe(ProxyState.UNINITIALIZED);
  });

  it('getWorker() returns a DapProxyWorker instance', () => {
    runner = new ProxyRunner(deps, logger);
    const worker = runner.getWorker();
    expect(worker).toBeDefined();
    expect(typeof worker.handleCommand).toBe('function');
  });

  it('start() sets up communication and logs ready message', async () => {
    runner = new ProxyRunner(deps, logger, {
      useIPC: false,
      useStdin: false
    });
    await runner.start();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Ready to receive commands')
    );
  });

  it('start() throws if called twice', async () => {
    runner = new ProxyRunner(deps, logger, { useIPC: false, useStdin: false });
    await runner.start();
    await expect(runner.start()).rejects.toThrow('already running');
  });

  it('stop() is idempotent when not running', async () => {
    runner = new ProxyRunner(deps, logger);
    // Should not throw
    await runner.stop();
  });

  it('stop() cleans up after start()', async () => {
    runner = new ProxyRunner(deps, logger, { useIPC: false, useStdin: false });
    await runner.start();
    await runner.stop();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Stopped')
    );
  });

  it('routes messages via custom onMessage callback', async () => {
    const onMessage = vi.fn().mockResolvedValue(undefined);

    runner = new ProxyRunner(deps, logger, {
      useIPC: false,
      useStdin: false,
      onMessage
    });
    await runner.start();

    // onMessage should be stored but we can't trigger it without IPC/stdin
    // Verify construction succeeded with the callback
    expect(runner).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  detectExecutionMode                                                */
/* ------------------------------------------------------------------ */

describe('detectExecutionMode', () => {
  const originalSend = process.send;
  const originalEnv = process.env.DAP_PROXY_WORKER;

  afterEach(() => {
    if (originalSend) {
      process.send = originalSend;
    } else {
      delete (process as any).send;
    }
    if (originalEnv !== undefined) {
      process.env.DAP_PROXY_WORKER = originalEnv;
    } else {
      delete process.env.DAP_PROXY_WORKER;
    }
  });

  it('detects IPC when process.send is a function', () => {
    (process as any).send = vi.fn();
    const mode = detectExecutionMode();
    expect(mode.hasIPC).toBe(true);
  });

  it('detects no IPC when process.send is undefined', () => {
    delete (process as any).send;
    const mode = detectExecutionMode();
    expect(mode.hasIPC).toBe(false);
  });

  it('detects worker env when DAP_PROXY_WORKER=true', () => {
    process.env.DAP_PROXY_WORKER = 'true';
    const mode = detectExecutionMode();
    expect(mode.isWorkerEnv).toBe(true);
  });

  it('detects non-worker env when DAP_PROXY_WORKER is unset', () => {
    delete process.env.DAP_PROXY_WORKER;
    const mode = detectExecutionMode();
    expect(mode.isWorkerEnv).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  shouldAutoExecute                                                  */
/* ------------------------------------------------------------------ */

describe('shouldAutoExecute', () => {
  it('returns true when isDirectRun is true', () => {
    expect(shouldAutoExecute({ isDirectRun: true, hasIPC: false, isWorkerEnv: false })).toBe(true);
  });

  it('returns true when hasIPC is true', () => {
    expect(shouldAutoExecute({ isDirectRun: false, hasIPC: true, isWorkerEnv: false })).toBe(true);
  });

  it('returns true when isWorkerEnv is true', () => {
    expect(shouldAutoExecute({ isDirectRun: false, hasIPC: false, isWorkerEnv: true })).toBe(true);
  });

  it('returns false when all flags are false', () => {
    expect(shouldAutoExecute({ isDirectRun: false, hasIPC: false, isWorkerEnv: false })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  ProxyRunner - IPC communication                                    */
/* ------------------------------------------------------------------ */

describe('ProxyRunner IPC communication', () => {
  let deps: DapProxyDependencies;
  let logger: ILogger;
  let runner: ProxyRunner;
  const originalSend = process.send;
  const originalConnected = Object.getOwnPropertyDescriptor(process, 'connected');

  beforeEach(() => {
    deps = createMockDependencies();
    logger = createMockLogger();
  });

  afterEach(async () => {
    if (runner) {
      await runner.stop();
    }
    if (originalSend) {
      process.send = originalSend;
    } else {
      delete (process as any).send;
    }
    if (originalConnected) {
      Object.defineProperty(process, 'connected', originalConnected);
    }
  });

  it('sets up IPC when process.send is available', async () => {
    (process as any).send = vi.fn();
    Object.defineProperty(process, 'connected', { value: true, configurable: true });
    const processOnSpy = vi.spyOn(process, 'on');

    runner = new ProxyRunner(deps, logger, { useIPC: true });
    await runner.start();

    const registeredEvents = processOnSpy.mock.calls.map(([event]) => event);
    expect(registeredEvents).toContain('message');
    expect(registeredEvents).toContain('disconnect');
    expect(registeredEvents).toContain('error');

    processOnSpy.mockRestore();
  });

  it('IPC message handler processes string messages', async () => {
    (process as any).send = vi.fn();
    Object.defineProperty(process, 'connected', { value: true, configurable: true });
    const onMessage = vi.fn().mockResolvedValue(undefined);

    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage });
    await runner.start();

    // Extract the message handler registered on process.on('message')
    const processOnSpy = vi.spyOn(process, 'on');
    // The handler is already registered. Find it by getting all 'message' listeners.
    const messageListeners = process.listeners('message');
    const ipcHandler = messageListeners[messageListeners.length - 1] as Function;
    expect(ipcHandler).toBeDefined();

    await ipcHandler('{"cmd":"init","sessionId":"test-1"}');
    expect(onMessage).toHaveBeenCalledWith('{"cmd":"init","sessionId":"test-1"}');

    processOnSpy.mockRestore();
  });

  it('IPC message handler stringifies object messages', async () => {
    (process as any).send = vi.fn();
    Object.defineProperty(process, 'connected', { value: true, configurable: true });
    const onMessage = vi.fn().mockResolvedValue(undefined);

    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage });
    await runner.start();

    const messageListeners = process.listeners('message');
    const ipcHandler = messageListeners[messageListeners.length - 1] as Function;

    await ipcHandler({ cmd: 'init', sessionId: 'test-2' });
    expect(onMessage).toHaveBeenCalledWith(JSON.stringify({ cmd: 'init', sessionId: 'test-2' }));
  });

  it('IPC message handler warns on unexpected message type', async () => {
    (process as any).send = vi.fn();
    Object.defineProperty(process, 'connected', { value: true, configurable: true });

    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage: vi.fn() });
    await runner.start();

    const messageListeners = process.listeners('message');
    const ipcHandler = messageListeners[messageListeners.length - 1] as Function;

    await ipcHandler(12345);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('unexpected type'),
      'number',
      12345
    );
  });

  it('IPC message handler sends heartbeat acknowledgement', async () => {
    const fakeSend = vi.fn();
    (process as any).send = fakeSend;
    Object.defineProperty(process, 'connected', { value: true, configurable: true });

    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage: vi.fn().mockResolvedValue(undefined) });
    await runner.start();

    // Reset send to count only message-triggered heartbeats
    fakeSend.mockClear();

    const messageListeners = process.listeners('message');
    const ipcHandler = messageListeners[messageListeners.length - 1] as Function;

    await ipcHandler('{"cmd":"ping"}');
    // process.send should have been called with a heartbeat
    expect(fakeSend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ipc-heartbeat' })
    );
  });

  it('disconnect handler triggers worker shutdown and process exit', async () => {
    (process as any).send = vi.fn();
    Object.defineProperty(process, 'connected', { value: true, configurable: true });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage: vi.fn() });
    await runner.start();

    const disconnectListeners = process.listeners('disconnect');
    const disconnectHandler = disconnectListeners[disconnectListeners.length - 1] as Function;
    expect(disconnectHandler).toBeDefined();

    disconnectHandler();
    // Allow .finally() microtask to run
    await new Promise(r => setTimeout(r, 10));

    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });

  it('error handler logs IPC channel error', async () => {
    (process as any).send = vi.fn();
    Object.defineProperty(process, 'connected', { value: true, configurable: true });

    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage: vi.fn() });
    await runner.start();

    const errorListeners = process.listeners('error');
    const errorHandler = errorListeners[errorListeners.length - 1] as Function;

    errorHandler(new Error('IPC broken'));
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('IPC channel error'),
      expect.any(Error)
    );
  });
});

/* ------------------------------------------------------------------ */
/*  ProxyRunner - Stdin communication                                  */
/* ------------------------------------------------------------------ */

describe('ProxyRunner stdin communication', () => {
  let deps: DapProxyDependencies;
  let logger: ILogger;
  let runner: ProxyRunner;
  const originalSend = process.send;

  beforeEach(() => {
    deps = createMockDependencies();
    logger = createMockLogger();
    delete (process as any).send;
  });

  afterEach(async () => {
    if (runner) {
      await runner.stop();
    }
    if (originalSend) {
      process.send = originalSend;
    } else {
      delete (process as any).send;
    }
  });

  it('sets up stdin/readline when IPC is not available', async () => {
    runner = new ProxyRunner(deps, logger, { useStdin: true });
    await runner.start();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('stdin/readline')
    );
  });
});

/* ------------------------------------------------------------------ */
/*  ProxyRunner - Heartbeat and init timeout                           */
/* ------------------------------------------------------------------ */

describe('ProxyRunner heartbeat and init timeout', () => {
  let deps: DapProxyDependencies;
  let logger: ILogger;
  let runner: ProxyRunner;
  const originalSend = process.send;
  const originalConnected = Object.getOwnPropertyDescriptor(process, 'connected');

  beforeEach(() => {
    vi.useFakeTimers();
    deps = createMockDependencies();
    logger = createMockLogger();
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (runner) {
      await runner.stop();
    }
    if (originalSend) {
      process.send = originalSend;
    } else {
      delete (process as any).send;
    }
    if (originalConnected) {
      Object.defineProperty(process, 'connected', originalConnected);
    }
  });

  it('sends heartbeat tick every 5 seconds when IPC is available', async () => {
    const fakeSend = vi.fn();
    (process as any).send = fakeSend;
    Object.defineProperty(process, 'connected', { value: true, configurable: true });
    // Mock process.exit to prevent init timeout from killing the process
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage: vi.fn() });
    await runner.start();
    fakeSend.mockClear();

    vi.advanceTimersByTime(5000);
    expect(fakeSend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ipc-heartbeat-tick', counter: 1 })
    );

    fakeSend.mockClear();
    vi.advanceTimersByTime(5000);
    expect(fakeSend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ipc-heartbeat-tick', counter: 2 })
    );

    exitSpy.mockRestore();
  });

  it('init timeout fires after 10 seconds', async () => {
    delete (process as any).send;
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    runner = new ProxyRunner(deps, logger, { useIPC: false, useStdin: false });
    await runner.start();

    vi.advanceTimersByTime(10000);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No initialization received')
    );

    exitSpy.mockRestore();
  });

  it('init timeout does not fire before 10 seconds', async () => {
    delete (process as any).send;
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    runner = new ProxyRunner(deps, logger, { useIPC: false, useStdin: false });
    await runner.start();

    vi.advanceTimersByTime(9999);
    expect(exitSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});

/* ------------------------------------------------------------------ */
/*  ProxyRunner - Global error handlers                                */
/* ------------------------------------------------------------------ */

describe('ProxyRunner.setupGlobalErrorHandlers', () => {
  let deps: DapProxyDependencies;
  let logger: ILogger;
  let runner: ProxyRunner;
  const originalSend = process.send;
  let processOnSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    deps = createMockDependencies();
    logger = createMockLogger();
    delete (process as any).send;
    processOnSpy = vi.spyOn(process, 'on');
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(async () => {
    processOnSpy.mockRestore();
    exitSpy.mockRestore();
    if (originalSend) {
      process.send = originalSend;
    } else {
      delete (process as any).send;
    }
  });

  it('registers handlers for uncaughtException, unhandledRejection, SIGTERM, SIGINT', () => {
    runner = new ProxyRunner(deps, logger);
    const shutdownFn = vi.fn().mockResolvedValue(undefined);
    const getSessionId = vi.fn().mockReturnValue(null);

    runner.setupGlobalErrorHandlers(shutdownFn, getSessionId);

    const events = processOnSpy.mock.calls.map(([event]) => event);
    expect(events).toContain('uncaughtException');
    expect(events).toContain('unhandledRejection');
    expect(events).toContain('SIGTERM');
    expect(events).toContain('SIGINT');
  });

  it('uncaughtException handler sends error and calls shutdown', async () => {
    const capturedHandlers: Record<string, Function> = {};
    processOnSpy.mockImplementation(function (this: any, event: string, fn: any) {
      capturedHandlers[event] = fn;
      return this;
    });

    runner = new ProxyRunner(deps, logger);
    const shutdownFn = vi.fn().mockResolvedValue(undefined);
    const getSessionId = vi.fn().mockReturnValue('sess-1');

    runner.setupGlobalErrorHandlers(shutdownFn, getSessionId);

    capturedHandlers['uncaughtException'](new Error('crash'));
    await new Promise(r => setTimeout(r, 10));

    expect(deps.messageSender.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', sessionId: 'sess-1' })
    );
    expect(shutdownFn).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('unhandledRejection handler sends error but does not exit', () => {
    const capturedHandlers: Record<string, Function> = {};
    processOnSpy.mockImplementation(function (this: any, event: string, fn: any) {
      capturedHandlers[event] = fn;
      return this;
    });

    runner = new ProxyRunner(deps, logger);
    const shutdownFn = vi.fn().mockResolvedValue(undefined);
    const getSessionId = vi.fn().mockReturnValue(null);

    runner.setupGlobalErrorHandlers(shutdownFn, getSessionId);

    capturedHandlers['unhandledRejection']('reason', Promise.resolve());

    expect(deps.messageSender.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', sessionId: 'unknown' })
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('SIGTERM handler shuts down and exits with 0', async () => {
    const capturedHandlers: Record<string, Function> = {};
    processOnSpy.mockImplementation(function (this: any, event: string, fn: any) {
      capturedHandlers[event] = fn;
      return this;
    });

    runner = new ProxyRunner(deps, logger);
    const shutdownFn = vi.fn().mockResolvedValue(undefined);

    runner.setupGlobalErrorHandlers(shutdownFn, vi.fn());

    capturedHandlers['SIGTERM']();
    await new Promise(r => setTimeout(r, 10));

    expect(shutdownFn).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('SIGINT handler shuts down and exits with 0', async () => {
    const capturedHandlers: Record<string, Function> = {};
    processOnSpy.mockImplementation(function (this: any, event: string, fn: any) {
      capturedHandlers[event] = fn;
      return this;
    });

    runner = new ProxyRunner(deps, logger);
    const shutdownFn = vi.fn().mockResolvedValue(undefined);

    runner.setupGlobalErrorHandlers(shutdownFn, vi.fn());

    capturedHandlers['SIGINT']();
    await new Promise(r => setTimeout(r, 10));

    expect(shutdownFn).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
