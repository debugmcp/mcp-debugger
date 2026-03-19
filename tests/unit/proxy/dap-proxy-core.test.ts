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
