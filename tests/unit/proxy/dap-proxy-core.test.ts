/**
 * Unit tests for dap-proxy-core.ts — ProxyRunner, detectExecutionMode, shouldAutoExecute
 *
 * All tests drive ProxyRunner through an injected FakeCurrentProcess (issue
 * #183): no test in this file touches the global process object, so nothing
 * can leak listeners into the vitest fork worker (issue #159).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProxyRunner, detectExecutionMode, shouldAutoExecute } from '../../../src/proxy/dap-proxy-core.js';
import { ProxyState } from '../../../src/proxy/dap-proxy-interfaces.js';
import type { DapProxyDependencies, ILogger } from '../../../src/proxy/dap-proxy-interfaces.js';
import { FakeCurrentProcess } from '../../test-utils/mocks/fake-current-process.js';

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
  let fakeProc: FakeCurrentProcess;

  beforeEach(() => {
    deps = createMockDependencies();
    logger = createMockLogger();
    // No IPC channel so we don't accidentally set up IPC (or its heartbeat)
    fakeProc = new FakeCurrentProcess().disableIPC();
  });

  afterEach(async () => {
    if (runner) {
      await runner.stop();
    }
  });

  it('constructs without errors', () => {
    runner = new ProxyRunner(deps, logger, { proc: fakeProc });
    expect(runner).toBeDefined();
  });

  it('getWorkerState() returns UNINITIALIZED initially', () => {
    runner = new ProxyRunner(deps, logger, { proc: fakeProc });
    expect(runner.getWorkerState()).toBe(ProxyState.UNINITIALIZED);
  });

  it('getWorker() returns a DapProxyWorker instance', () => {
    runner = new ProxyRunner(deps, logger, { proc: fakeProc });
    const worker = runner.getWorker();
    expect(worker).toBeDefined();
    expect(typeof worker.handleCommand).toBe('function');
  });

  it('start() sets up communication and logs ready message', async () => {
    runner = new ProxyRunner(deps, logger, {
      useIPC: false,
      useStdin: false,
      proc: fakeProc
    });
    await runner.start();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Ready to receive commands')
    );
  });

  it('start() throws if called twice', async () => {
    runner = new ProxyRunner(deps, logger, { useIPC: false, useStdin: false, proc: fakeProc });
    await runner.start();
    await expect(runner.start()).rejects.toThrow('already running');
  });

  it('stop() is idempotent when not running', async () => {
    runner = new ProxyRunner(deps, logger, { proc: fakeProc });
    // Should not throw
    await runner.stop();
  });

  it('stop() cleans up after start()', async () => {
    runner = new ProxyRunner(deps, logger, { useIPC: false, useStdin: false, proc: fakeProc });
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
      onMessage,
      proc: fakeProc
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
  it('detects IPC when proc.send is a function', () => {
    const mode = detectExecutionMode({ send: () => true, env: {}, argv: ['node', '/x.js'] });
    expect(mode.hasIPC).toBe(true);
  });

  it('detects no IPC when proc.send is undefined', () => {
    const mode = detectExecutionMode({ env: {}, argv: ['node', '/x.js'] });
    expect(mode.hasIPC).toBe(false);
  });

  it('detects worker env when DAP_PROXY_WORKER=true', () => {
    const mode = detectExecutionMode({ env: { DAP_PROXY_WORKER: 'true' }, argv: ['node', '/x.js'] });
    expect(mode.isWorkerEnv).toBe(true);
  });

  it('detects non-worker env when DAP_PROXY_WORKER is unset', () => {
    const mode = detectExecutionMode({ env: {}, argv: ['node', '/x.js'] });
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
  let fakeProc: FakeCurrentProcess;

  beforeEach(() => {
    deps = createMockDependencies();
    logger = createMockLogger();
    fakeProc = new FakeCurrentProcess(); // IPC enabled, connected
  });

  afterEach(async () => {
    if (runner) {
      await runner.stop();
    }
  });

  it('sets up IPC when proc.send is available', async () => {
    runner = new ProxyRunner(deps, logger, { useIPC: true, proc: fakeProc });
    await runner.start();

    expect(fakeProc.listenerCount('message')).toBe(1);
    expect(fakeProc.listenerCount('disconnect')).toBe(1);
    expect(fakeProc.listenerCount('error')).toBe(1);
  });

  it('IPC message handler processes string messages', async () => {
    const onMessage = vi.fn().mockResolvedValue(undefined);

    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage, proc: fakeProc });
    await runner.start();

    const ipcHandler = fakeProc.lastListener('message');

    await ipcHandler('{"cmd":"init","sessionId":"test-1"}');
    expect(onMessage).toHaveBeenCalledWith('{"cmd":"init","sessionId":"test-1"}');
  });

  it('IPC message handler stringifies object messages', async () => {
    const onMessage = vi.fn().mockResolvedValue(undefined);

    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage, proc: fakeProc });
    await runner.start();

    const ipcHandler = fakeProc.lastListener('message');

    await ipcHandler({ cmd: 'init', sessionId: 'test-2' });
    expect(onMessage).toHaveBeenCalledWith(JSON.stringify({ cmd: 'init', sessionId: 'test-2' }));
  });

  it('never logs adapter env values from IPC messages (issue #146)', async () => {
    const onMessage = vi.fn().mockResolvedValue(undefined);

    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage, proc: fakeProc });
    await runner.start();

    const ipcHandler = fakeProc.lastListener('message');

    await ipcHandler({
      cmd: 'init',
      sessionId: 'env-leak',
      adapterCommand: {
        command: 'python',
        args: ['-m', 'debugpy.adapter'],
        env: { GITHUB_PAT: 'github_pat_SENTINEL', HOME: '/home/user-sentinel' }
      }
    });

    const allLogged = JSON.stringify([
      (logger.debug as any).mock.calls,
      (logger.info as any).mock.calls,
      (logger.warn as any).mock.calls,
      (logger.error as any).mock.calls
    ]);
    expect(allLogged).not.toContain('github_pat_SENTINEL');
    expect(allLogged).not.toContain('/home/user-sentinel');
  });

  it('never logs launchConfig env values from IPC messages (issue #146 family)', async () => {
    const onMessage = vi.fn().mockResolvedValue(undefined);

    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage, proc: fakeProc });
    await runner.start();

    const ipcHandler = fakeProc.lastListener('message');

    await ipcHandler({
      cmd: 'init',
      sessionId: 'launch-env-leak',
      launchConfig: {
        type: 'pwa-node',
        env: { GITHUB_PAT: 'github_pat_LAUNCH_SENTINEL', HOME: '/home/launch-sentinel' }
      }
    });

    const allLogged = JSON.stringify([
      (logger.debug as any).mock.calls,
      (logger.info as any).mock.calls,
      (logger.warn as any).mock.calls,
      (logger.error as any).mock.calls
    ]);
    expect(allLogged).not.toContain('github_pat_LAUNCH_SENTINEL');
    expect(allLogged).not.toContain('/home/launch-sentinel');
  });

  it('never logs adapter env values when message processing fails (issue #146)', async () => {
    const onMessage = vi.fn().mockRejectedValue(new Error('processing failed'));

    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage, proc: fakeProc });
    await runner.start();

    const ipcHandler = fakeProc.lastListener('message');

    await ipcHandler({
      cmd: 'init',
      sessionId: 'env-leak-error',
      adapterCommand: {
        command: 'python',
        args: ['-m', 'debugpy.adapter'],
        env: { GITHUB_PAT: 'github_pat_SENTINEL', HOME: '/home/user-sentinel' }
      }
    });

    const allLogged = JSON.stringify([
      (logger.debug as any).mock.calls,
      (logger.info as any).mock.calls,
      (logger.warn as any).mock.calls,
      (logger.error as any).mock.calls
    ]);
    expect(allLogged).not.toContain('github_pat_SENTINEL');
    expect(allLogged).not.toContain('/home/user-sentinel');
  });

  it('IPC message handler warns on unexpected message type', async () => {
    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage: vi.fn(), proc: fakeProc });
    await runner.start();

    const ipcHandler = fakeProc.lastListener('message');

    await ipcHandler(12345);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('unexpected type'),
      'number',
      12345
    );
  });

  it('IPC message handler sends heartbeat acknowledgement', async () => {
    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage: vi.fn().mockResolvedValue(undefined), proc: fakeProc });
    await runner.start();

    // Reset send to count only message-triggered heartbeats
    fakeProc.send!.mockClear();

    const ipcHandler = fakeProc.lastListener('message');

    await ipcHandler('{"cmd":"ping"}');
    expect(fakeProc.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ipc-heartbeat' })
    );
  });

  it('disconnect handler triggers worker shutdown and process exit', async () => {
    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage: vi.fn(), proc: fakeProc });
    await runner.start();

    fakeProc.emit('disconnect');
    // Allow .finally() microtask to run
    await new Promise(r => setTimeout(r, 10));

    expect(fakeProc.exit).toHaveBeenCalledWith(0);
  });

  it('error handler logs IPC channel error', async () => {
    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage: vi.fn(), proc: fakeProc });
    await runner.start();

    fakeProc.emit('error', new Error('IPC broken'));
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
  let fakeProc: FakeCurrentProcess;

  beforeEach(() => {
    deps = createMockDependencies();
    logger = createMockLogger();
    fakeProc = new FakeCurrentProcess().disableIPC();
  });

  afterEach(async () => {
    if (runner) {
      await runner.stop();
    }
  });

  it('sets up stdin/readline when IPC is not available', async () => {
    runner = new ProxyRunner(deps, logger, { useStdin: true, proc: fakeProc });
    await runner.start();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('stdin/readline')
    );
  });

  it('shuts down and exits when stdin closes while running', async () => {
    runner = new ProxyRunner(deps, logger, { useStdin: true, onMessage: vi.fn(), proc: fakeProc });
    await runner.start();
    const shutdownSpy = vi.spyOn(runner.getWorker(), 'shutdown');

    // Simulate parent death: stdin EOF closes the readline interface
    fakeProc.stdin.end();
    // Allow the async stop() chain and .finally() to run
    await new Promise(r => setTimeout(r, 10));

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('stdin closed')
    );
    expect(shutdownSpy).toHaveBeenCalled();
    expect(fakeProc.exit).toHaveBeenCalledWith(0);
  });

  it('stop() closing the stdin interface does not exit the process', async () => {
    runner = new ProxyRunner(deps, logger, { useStdin: true, onMessage: vi.fn(), proc: fakeProc });
    await runner.start();
    await runner.stop();

    // Allow any readline 'close' handler triggered by stop() to run
    await new Promise(r => setTimeout(r, 10));

    expect(fakeProc.exit).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('stdin closed')
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
  let fakeProc: FakeCurrentProcess;

  beforeEach(() => {
    vi.useFakeTimers();
    deps = createMockDependencies();
    logger = createMockLogger();
    fakeProc = new FakeCurrentProcess();
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (runner) {
      await runner.stop();
    }
  });

  it('sends heartbeat tick every 5 seconds when IPC is available', async () => {
    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage: vi.fn(), proc: fakeProc });
    await runner.start();
    fakeProc.send!.mockClear();

    vi.advanceTimersByTime(5000);
    expect(fakeProc.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ipc-heartbeat-tick', counter: 1 })
    );

    fakeProc.send!.mockClear();
    vi.advanceTimersByTime(5000);
    expect(fakeProc.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ipc-heartbeat-tick', counter: 2 })
    );
  });

  it('shuts down and exits(1) when heartbeat tick send fails', async () => {
    fakeProc.failSendWith(new Error('ERR_IPC_CHANNEL_CLOSED: Channel closed'));

    runner = new ProxyRunner(deps, logger, { useIPC: true, onMessage: vi.fn(), proc: fakeProc });
    await runner.start();
    const shutdownSpy = vi.spyOn(runner.getWorker(), 'shutdown');

    // First tick throws -> runner must warn, shut down, and exit(1)
    await vi.advanceTimersByTimeAsync(5000);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('parent unreachable'),
      expect.any(Error)
    );
    expect(shutdownSpy).toHaveBeenCalled();
    expect(fakeProc.exit).toHaveBeenCalledWith(1);

    // stop() cleared the interval (and init timeout): no further exits
    fakeProc.exit.mockClear();
    await vi.advanceTimersByTimeAsync(15000);
    expect(fakeProc.exit).not.toHaveBeenCalled();
  });

  it('init timeout fires after 10 seconds', async () => {
    fakeProc.disableIPC();

    runner = new ProxyRunner(deps, logger, { useIPC: false, useStdin: false, proc: fakeProc });
    await runner.start();

    vi.advanceTimersByTime(10000);
    expect(fakeProc.exit).toHaveBeenCalledWith(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No initialization received')
    );
  });

  it('init timeout does not fire before 10 seconds', async () => {
    fakeProc.disableIPC();

    runner = new ProxyRunner(deps, logger, { useIPC: false, useStdin: false, proc: fakeProc });
    await runner.start();

    vi.advanceTimersByTime(9999);
    expect(fakeProc.exit).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  ProxyRunner - Global error handlers                                */
/* ------------------------------------------------------------------ */

describe('ProxyRunner.setupGlobalErrorHandlers', () => {
  let deps: DapProxyDependencies;
  let logger: ILogger;
  let runner: ProxyRunner;
  let fakeProc: FakeCurrentProcess;

  beforeEach(() => {
    deps = createMockDependencies();
    logger = createMockLogger();
    // Handlers attach to the fake's emitter — nothing can reach the real
    // process, so no capture/baseline apparatus is needed (issues #159/#183).
    fakeProc = new FakeCurrentProcess().disableIPC();
  });

  it('registers handlers for uncaughtException, unhandledRejection, SIGTERM, SIGINT', () => {
    runner = new ProxyRunner(deps, logger, { proc: fakeProc });
    const shutdownFn = vi.fn().mockResolvedValue(undefined);
    const getSessionId = vi.fn().mockReturnValue(null);

    runner.setupGlobalErrorHandlers(shutdownFn, getSessionId);

    expect(fakeProc.listenerCount('uncaughtException')).toBe(1);
    expect(fakeProc.listenerCount('unhandledRejection')).toBe(1);
    expect(fakeProc.listenerCount('SIGTERM')).toBe(1);
    expect(fakeProc.listenerCount('SIGINT')).toBe(1);
  });

  it('uncaughtException handler sends error and calls shutdown', async () => {
    runner = new ProxyRunner(deps, logger, { proc: fakeProc });
    const shutdownFn = vi.fn().mockResolvedValue(undefined);
    const getSessionId = vi.fn().mockReturnValue('sess-1');

    runner.setupGlobalErrorHandlers(shutdownFn, getSessionId);

    fakeProc.emit('uncaughtException', new Error('crash'));
    await new Promise(r => setTimeout(r, 10));

    expect(deps.messageSender.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', sessionId: 'sess-1' })
    );
    expect(shutdownFn).toHaveBeenCalled();
    expect(fakeProc.exit).toHaveBeenCalledWith(1);
  });

  it('unhandledRejection handler sends error but does not exit', () => {
    runner = new ProxyRunner(deps, logger, { proc: fakeProc });
    const shutdownFn = vi.fn().mockResolvedValue(undefined);
    const getSessionId = vi.fn().mockReturnValue(null);

    runner.setupGlobalErrorHandlers(shutdownFn, getSessionId);

    fakeProc.emit('unhandledRejection', 'reason', Promise.resolve());

    expect(deps.messageSender.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', sessionId: 'unknown' })
    );
    expect(fakeProc.exit).not.toHaveBeenCalled();
  });

  it('SIGTERM handler shuts down and exits with 0', async () => {
    runner = new ProxyRunner(deps, logger, { proc: fakeProc });
    const shutdownFn = vi.fn().mockResolvedValue(undefined);

    runner.setupGlobalErrorHandlers(shutdownFn, vi.fn());

    fakeProc.emit('SIGTERM');
    await new Promise(r => setTimeout(r, 10));

    expect(shutdownFn).toHaveBeenCalled();
    expect(fakeProc.exit).toHaveBeenCalledWith(0);
  });

  it('SIGINT handler shuts down and exits with 0', async () => {
    runner = new ProxyRunner(deps, logger, { proc: fakeProc });
    const shutdownFn = vi.fn().mockResolvedValue(undefined);

    runner.setupGlobalErrorHandlers(shutdownFn, vi.fn());

    fakeProc.emit('SIGINT');
    await new Promise(r => setTimeout(r, 10));

    expect(shutdownFn).toHaveBeenCalled();
    expect(fakeProc.exit).toHaveBeenCalledWith(0);
  });
});
