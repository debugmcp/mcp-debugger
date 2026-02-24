/**
 * Regression tests for Go/Delve two-phase initialized event handling.
 *
 * Exercises the `sendLaunchBeforeConfig` code path in DapProxyWorker to
 * verify that the proxy can recover when the 'initialized' event arrives
 * after 'launch' instead of before it.
 */

import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DapProxyWorker } from '../../src/proxy/dap-proxy-worker.js';
import type {
  DapProxyDependencies,
  ILogger,
  IFileSystem,
  IProcessSpawner,
  IDapClient,
  ProxyInitPayload
} from '../../src/proxy/dap-proxy-interfaces.js';
import { ProxyState } from '../../src/proxy/dap-proxy-interfaces.js';
import { GoAdapterPolicy } from '@debugmcp/shared';

// --- helpers ---------------------------------------------------------------

const createMockLogger = (): ILogger => ({
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn()
});

const createMockFileSystem = (): IFileSystem => ({
  ensureDir: vi.fn().mockResolvedValue(undefined),
  pathExists: vi.fn().mockResolvedValue(true)
});

const createMockProcessSpawner = (): IProcessSpawner => ({
  spawn: vi.fn().mockReturnValue({
    pid: 12345,
    on: vi.fn(),
    kill: vi.fn(),
    unref: vi.fn(),
    killed: false
  })
});

const createMockDapClient = (): IDapClient & EventEmitter => {
  const emitter = new EventEmitter();
  const originalOn = emitter.on.bind(emitter);
  const originalOff = emitter.off.bind(emitter);
  const originalOnce = emitter.once.bind(emitter);
  const originalRemoveAllListeners = emitter.removeAllListeners.bind(emitter);

  return Object.assign(emitter, {
    sendRequest: vi.fn().mockResolvedValue({ body: {} }),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      originalOn(event, handler);
      return emitter;
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      originalOff(event, handler);
      return emitter;
    }),
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      originalOnce(event, handler);
      return emitter;
    }),
    removeAllListeners: vi.fn((event?: string) => {
      originalRemoveAllListeners(event);
      return emitter;
    }),
    shutdown: vi.fn()
  }) as IDapClient & EventEmitter;
};

const createMockMessageSender = () => ({
  send: vi.fn()
});

const GO_PAYLOAD: ProxyInitPayload = {
  cmd: 'init',
  sessionId: 'go-fallback-session',
  executablePath: 'dlv',
  adapterHost: 'localhost',
  adapterPort: 12345,
  logDir: '/logs',
  scriptPath: '/path/to/main.go',
  scriptArgs: [],
  stopOnEntry: false,
  justMyCode: false,
  adapterCommand: {
    command: 'dlv',
    args: ['dap', '--listen', 'localhost:12345']
  }
};

// --- tests -----------------------------------------------------------------

describe('Go initialized event fallback', () => {
  let worker: DapProxyWorker;
  let mockLogger: ILogger;
  let mockDapClient: IDapClient & EventEmitter;
  let mockMessageSender: ReturnType<typeof createMockMessageSender>;
  let dependencies: DapProxyDependencies;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDapClient = createMockDapClient();
    mockMessageSender = createMockMessageSender();

    dependencies = {
      fileSystem: createMockFileSystem(),
      loggerFactory: vi.fn().mockResolvedValue(mockLogger),
      processSpawner: createMockProcessSpawner(),
      dapClientFactory: { create: vi.fn().mockResolvedValue(mockDapClient) },
      messageSender: mockMessageSender
    };

    worker = new DapProxyWorker(dependencies, { exit: vi.fn() });
  });

  afterEach(async () => {
    vi.clearAllTimers();
    vi.useRealTimers();
    try {
      if (worker.getState() !== ProxyState.TERMINATED) {
        await worker.handleTerminate();
      }
    } catch {
      // ignore cleanup errors
    }
  });

  /**
   * Simulate Phase 2 fallback: Delve sends 'initialized' only AFTER
   * receiving the 'launch' request.
   */
  it('should fall back to launch-first when initialized event arrives after launch', async () => {
    const callOrder: string[] = [];

    const processStub = {
      spawn: vi.fn().mockResolvedValue({
        process: new EventEmitter() as unknown as ChildProcess,
        pid: 789
      }),
      shutdown: vi.fn().mockResolvedValue(undefined)
    };

    const connectionStub = {
      connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
      setAdapterPolicy: vi.fn(),
      setupEventHandlers: vi.fn(
        (client: EventEmitter, handlers: Record<string, (...args: unknown[]) => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onOutput) client.on('output', handlers.onOutput);
          if (handlers.onStopped) client.on('stopped', handlers.onStopped);
          if (handlers.onTerminated) client.on('terminated', handlers.onTerminated);
        }
      ),
      // Delve does NOT send 'initialized' after 'initialize' in this scenario
      initializeSession: vi.fn().mockImplementation(async () => {
        callOrder.push('initializeSession');
        // No initialized event here — simulating the timing bug
      }),
      // Delve sends 'initialized' only after receiving 'launch'
      sendLaunchRequest: vi.fn().mockImplementation(async () => {
        callOrder.push('sendLaunchRequest');
        // Fire initialized AFTER launch is received (Phase 2 path)
        setImmediate(() => mockDapClient.emit('initialized'));
      }),
      setBreakpoints: vi.fn().mockImplementation(async () => {
        callOrder.push('setBreakpoints');
      }),
      sendConfigurationDone: vi.fn().mockImplementation(async () => {
        callOrder.push('sendConfigurationDone');
      }),
      disconnect: vi.fn().mockResolvedValue(undefined)
    };

    // Wire up internal state
    (worker as any).logger = mockLogger;
    (worker as any).processManager = processStub;
    (worker as any).connectionManager = connectionStub;
    (worker as any).adapterPolicy = GoAdapterPolicy;
    (worker as any).adapterState = GoAdapterPolicy.createInitialState();
    (worker as any).currentInitPayload = GO_PAYLOAD;
    (worker as any).state = ProxyState.INITIALIZING;

    await (worker as any).startAdapterAndConnect(GO_PAYLOAD);

    // Verify the fallback log messages appeared
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not received within 2s')
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Phase 2: Waiting for "initialized" event after launch')
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('fallback succeeded')
    );

    // Verify correct DAP sequence
    expect(connectionStub.initializeSession).toHaveBeenCalled();
    expect(connectionStub.sendLaunchRequest).toHaveBeenCalled();
    expect(connectionStub.sendConfigurationDone).toHaveBeenCalledTimes(1);

    // Ordering: initialize → launch → configurationDone
    const initIdx = callOrder.indexOf('initializeSession');
    const launchIdx = callOrder.indexOf('sendLaunchRequest');
    const configDoneIdx = callOrder.indexOf('sendConfigurationDone');
    expect(initIdx).toBeLessThan(launchIdx);
    expect(launchIdx).toBeLessThan(configDoneIdx);

    // Final state should be CONNECTED
    const statusCall = mockMessageSender.send.mock.calls.find(
      ([msg]: [{ type: string; status: string }]) =>
        msg.type === 'status' && msg.status === 'adapter_configured_and_launched'
    );
    expect(statusCall).toBeDefined();
    expect(worker.getState()).toBe(ProxyState.CONNECTED);
  });

  /**
   * Phase 1 happy path: Delve sends 'initialized' immediately after
   * 'initialize' (same TCP frame / setImmediate).
   */
  it('should work normally when initialized event arrives before launch', async () => {
    const callOrder: string[] = [];

    const processStub = {
      spawn: vi.fn().mockResolvedValue({
        process: new EventEmitter() as unknown as ChildProcess,
        pid: 790
      }),
      shutdown: vi.fn().mockResolvedValue(undefined)
    };

    const connectionStub = {
      connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
      setAdapterPolicy: vi.fn(),
      setupEventHandlers: vi.fn(
        (client: EventEmitter, handlers: Record<string, (...args: unknown[]) => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onOutput) client.on('output', handlers.onOutput);
          if (handlers.onStopped) client.on('stopped', handlers.onStopped);
          if (handlers.onTerminated) client.on('terminated', handlers.onTerminated);
        }
      ),
      // Delve fires 'initialized' right after 'initialize' response
      initializeSession: vi.fn().mockImplementation(async () => {
        callOrder.push('initializeSession');
        setImmediate(() => mockDapClient.emit('initialized'));
      }),
      sendLaunchRequest: vi.fn().mockImplementation(async () => {
        callOrder.push('sendLaunchRequest');
      }),
      setBreakpoints: vi.fn().mockImplementation(async () => {
        callOrder.push('setBreakpoints');
      }),
      sendConfigurationDone: vi.fn().mockImplementation(async () => {
        callOrder.push('sendConfigurationDone');
      }),
      disconnect: vi.fn().mockResolvedValue(undefined)
    };

    (worker as any).logger = mockLogger;
    (worker as any).processManager = processStub;
    (worker as any).connectionManager = connectionStub;
    (worker as any).adapterPolicy = GoAdapterPolicy;
    (worker as any).adapterState = GoAdapterPolicy.createInitialState();
    (worker as any).currentInitPayload = GO_PAYLOAD;
    (worker as any).state = ProxyState.INITIALIZING;

    await (worker as any).startAdapterAndConnect(GO_PAYLOAD);

    // Phase 1 succeeded — no fallback warning
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('"initialized" event received before launch')
    );
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('not received within 2s')
    );

    // Verify ordering: initialize → launch → configurationDone
    const initIdx = callOrder.indexOf('initializeSession');
    const launchIdx = callOrder.indexOf('sendLaunchRequest');
    const configDoneIdx = callOrder.indexOf('sendConfigurationDone');
    expect(initIdx).toBeLessThan(launchIdx);
    expect(launchIdx).toBeLessThan(configDoneIdx);

    expect(worker.getState()).toBe(ProxyState.CONNECTED);
  });

  /**
   * Verify that the 10-second Phase 2 timeout produces a clear error
   * when the adapter never sends 'initialized' at all.
   */
  it('should timeout with clear error when initialized event never arrives', async () => {
    vi.useFakeTimers();

    const processStub = {
      spawn: vi.fn().mockResolvedValue({
        process: new EventEmitter() as unknown as ChildProcess,
        pid: 791
      }),
      shutdown: vi.fn().mockResolvedValue(undefined)
    };

    const connectionStub = {
      connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
      setAdapterPolicy: vi.fn(),
      setupEventHandlers: vi.fn(
        (client: EventEmitter, handlers: Record<string, (...args: unknown[]) => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
        }
      ),
      // Never sends initialized
      initializeSession: vi.fn().mockResolvedValue(undefined),
      // Never sends initialized either
      sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
      setBreakpoints: vi.fn().mockResolvedValue(undefined),
      sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined)
    };

    (worker as any).logger = mockLogger;
    (worker as any).processManager = processStub;
    (worker as any).connectionManager = connectionStub;
    (worker as any).adapterPolicy = GoAdapterPolicy;
    (worker as any).adapterState = GoAdapterPolicy.createInitialState();
    (worker as any).currentInitPayload = GO_PAYLOAD;
    (worker as any).state = ProxyState.INITIALIZING;

    // Start the connection — it will wait for initialized
    const connectPromise = (worker as any).startAdapterAndConnect(GO_PAYLOAD);

    // Advance past Phase 1 (2s) and Phase 2 (10s)
    await vi.advanceTimersByTimeAsync(13000);

    await expect(connectPromise).rejects.toThrow(
      /Timeout waiting for initialized event \(after launch fallback\)/
    );

    vi.useRealTimers();
  });

  /**
   * Timing-sensitive regression test: ensures the Phase 1 timeout is 2s, not 5s.
   *
   * If someone reverts the Phase 1 timeout back to 5s, the initialized event
   * at 3s would be caught by Phase 1 (happy path) and the fallback warning
   * would NOT appear — failing this test.
   */
  it('should enter Phase 2 when initialized arrives at 3s (catches revert to 5s timeout)', async () => {
    vi.useFakeTimers();

    const processStub = {
      spawn: vi.fn().mockResolvedValue({
        process: new EventEmitter() as unknown as ChildProcess,
        pid: 792
      }),
      shutdown: vi.fn().mockResolvedValue(undefined)
    };

    const connectionStub = {
      connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
      setAdapterPolicy: vi.fn(),
      setupEventHandlers: vi.fn(
        (client: EventEmitter, handlers: Record<string, (...args: unknown[]) => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onOutput) client.on('output', handlers.onOutput);
          if (handlers.onStopped) client.on('stopped', handlers.onStopped);
          if (handlers.onTerminated) client.on('terminated', handlers.onTerminated);
        }
      ),
      // No initialized event from initializeSession
      initializeSession: vi.fn().mockResolvedValue(undefined),
      // No initialized event from sendLaunchRequest either —
      // we fire it manually at the 3s mark below
      sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
      setBreakpoints: vi.fn().mockResolvedValue(undefined),
      sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined)
    };

    (worker as any).logger = mockLogger;
    (worker as any).processManager = processStub;
    (worker as any).connectionManager = connectionStub;
    (worker as any).adapterPolicy = GoAdapterPolicy;
    (worker as any).adapterState = GoAdapterPolicy.createInitialState();
    (worker as any).currentInitPayload = GO_PAYLOAD;
    (worker as any).state = ProxyState.INITIALIZING;

    const connectPromise = (worker as any).startAdapterAndConnect(GO_PAYLOAD);

    // Advance past Phase 1 (2s) — triggers fallback to Phase 2
    await vi.advanceTimersByTimeAsync(2100);

    // Simulate Delve sending initialized at ~3s (between 2s and 5s)
    mockDapClient.emit('initialized');
    await vi.advanceTimersByTimeAsync(100);

    await connectPromise;

    // KEY: Phase 2 fallback warning MUST appear (proves Phase 1 timeout is 2s, not 5s)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not received within 2s')
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('fallback succeeded')
    );
    expect(worker.getState()).toBe(ProxyState.CONNECTED);

    vi.useRealTimers();
  });
});
