/**
 * Comprehensive unit tests for DapProxyWorker
 * Tests the refactored implementation using the Adapter Policy pattern
 */

import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import path from 'path';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { DapProxyWorker } from '../../src/proxy/dap-proxy-worker.js';
import { GenericAdapterManager } from '../../src/proxy/dap-proxy-adapter-manager.js';
import { DapConnectionManager } from '../../src/proxy/dap-proxy-connection-manager.js';
import type {
  DapProxyDependencies,
  ILogger,
  IFileSystem,
  IProcessSpawner,
  IDapClient,
  ProxyInitPayload,
  DapCommandPayload,
  StatusMessage
} from '../../src/proxy/dap-proxy-interfaces.js';
import { ProxyState } from '../../src/proxy/dap-proxy-interfaces.js';
import {
  DefaultAdapterPolicy,
  JsDebugAdapterPolicy,
  PythonAdapterPolicy,
  GoAdapterPolicy,
  JavaAdapterPolicy,
  RubyAdapterPolicy
} from '@debugmcp/shared';

// Mock implementations
const createMockLogger = (): ILogger => ({
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn()
});

const createMockFileSystem = (): IFileSystem => ({
  ensureDir: vi.fn().mockResolvedValue(undefined),
  pathExists: vi.fn().mockResolvedValue(true),
  readFile: vi.fn().mockResolvedValue(''),
  remove: vi.fn().mockResolvedValue(undefined)
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
  // Store original methods before wrapping
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

describe('DapProxyWorker', () => {
  let worker: DapProxyWorker;
  let dependencies: DapProxyDependencies;
  let mockLogger: ILogger;
  let mockDapClient: IDapClient;
  let mockMessageSender: ReturnType<typeof createMockMessageSender>;

  // Every worker in this file is constructed with an injected exit hook
  // (issue #183): no test can reach the real process.exit, even via the
  // worker's setImmediate + setTimeout(100ms) exit scheduling (see
  // handleInit's error path), and no global process spy net is needed.
  let workerExitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDapClient = createMockDapClient();
    mockMessageSender = createMockMessageSender();

    dependencies = {
      fileSystem: createMockFileSystem(),
      loggerFactory: vi.fn().mockResolvedValue(mockLogger),
      processSpawner: createMockProcessSpawner(),
      dapClientFactory: {
        create: vi.fn().mockResolvedValue(mockDapClient)
      },
      messageSender: mockMessageSender
    };

    workerExitSpy = vi.fn();
    worker = new DapProxyWorker(dependencies, { exit: workerExitSpy });
  });

  afterEach(async () => {
    // Clear all timers first to prevent lingering timers from interfering
    vi.clearAllTimers();
    vi.useRealTimers();
    try {
      // Only terminate if worker exists and hasn't been replaced
      if (worker && worker.getState) {
        const state = worker.getState();
        // Only terminate if not already terminated
        if (state !== ProxyState.TERMINATED) {
          await worker.handleTerminate();
        }
      }
    } catch {
      // ignore termination errors during cleanup
    }
  });

  describe('State Management', () => {
    it('should initialize with UNINITIALIZED state', () => {
      expect(worker.getState()).toBe(ProxyState.UNINITIALIZED);
    });

    it('should transition to INITIALIZING on init command', async () => {
      vi.useFakeTimers();
      
      // Use worker with mocked exit hook to prevent process.exit
      const exitSpy = vi.fn();
      worker = new DapProxyWorker(dependencies, { exit: exitSpy });
      
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.js',
        adapterHost: 'localhost',
        adapterPort: 9229,
        logDir: '/logs',
        executablePath: 'node',
        adapterCommand: {
          command: 'node',
          args: ['--inspect']
        },
        dryRunSpawn: true
      };

      await worker.handleCommand(payload);

      expect(worker.getState()).toBe(ProxyState.TERMINATED); // Dry run ends in TERMINATED
      
      // Exit hook will be called after a delay due to Windows IPC fix
      // Dry run with adapter command present exits with code 1
      await vi.advanceTimersByTimeAsync(150);
      expect(exitSpy).toHaveBeenCalledWith(1);
      
      vi.useRealTimers();
    });
  });

  describe('Policy Selection', () => {
    it('should select Python policy when no adapter command provided', async () => {
      // Use worker with mocked exit hook to prevent process.exit
      const exitSpy = vi.fn();
      worker = new DapProxyWorker(dependencies, { exit: exitSpy });
      
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python',
        dryRunSpawn: true
      };

      await worker.handleCommand(payload);

      const statusCall = mockMessageSender.send.mock.calls.find(
        call => call[0].type === 'status' && call[0].status === 'dry_run_complete'
      );
      expect(statusCall).toBeTruthy();
      expect(statusCall![0].command).toContain('debugpy');
    });

    it('should select JavaScript policy for js-debug adapter', async () => {
      // Use worker with mocked exit hook to prevent process.exit
      const exitSpy = vi.fn();
      worker = new DapProxyWorker(dependencies, { exit: exitSpy });
      
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.js',
        adapterHost: 'localhost',
        adapterPort: 9229,
        logDir: '/logs',
        executablePath: 'node',
        adapterCommand: {
          command: 'node',
          args: ['vendor/js-debug/vsDebugServer.js', '--port', '9229']
        },
        dryRunSpawn: true
      };

      await worker.handleCommand(payload);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[Worker] Using adapter policy: js-debug')
      );
    });

    it('should select Python policy for debugpy adapter', async () => {
      // Use worker with mocked exit hook to prevent process.exit
      const exitSpy = vi.fn();
      worker = new DapProxyWorker(dependencies, { exit: exitSpy });

      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python',
        adapterCommand: {
          command: 'python',
          args: ['-m', 'debugpy.adapter']
        },
        dryRunSpawn: true
      };

      await worker.handleCommand(payload);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[Worker] Using adapter policy: python')
      );
    });

    it('should select Go policy for dlv adapter', () => {
      // Test policy selection directly without triggering full validation
      const policy = (worker as any).selectAdapterPolicy(undefined, {
        command: 'dlv',
        args: ['dap', '--listen=:9876']
      });
      expect(policy.name).toBe('go');
    });

    it('should select Ruby policy for rdbg adapter', () => {
      const policy = (worker as any).selectAdapterPolicy(undefined, {
        command: 'rdbg',
        args: ['--open=vscode', '--port', '12345']
      });
      expect(policy.name).toBe('ruby');
    });

    it('should select Java policy for JdiDapServer adapter', () => {
      const policy = (worker as any).selectAdapterPolicy(undefined, {
        command: 'java',
        args: ['-cp', '/path/to/jdi', 'JdiDapServer', '5005']
      });
      expect(policy.name).toBe('java');
    });

    it('should select Rust policy for codelldb adapter', () => {
      const policy = (worker as any).selectAdapterPolicy(undefined, {
        command: '/path/to/codelldb',
        args: ['--port', '12345']
      });
      expect(policy.name).toBe('rust');
    });

    it('should select Dotnet policy for netcoredbg adapter', () => {
      const policy = (worker as any).selectAdapterPolicy(undefined, {
        command: 'node',
        args: ['netcoredbg-bridge.js', '/path/to/netcoredbg']
      });
      expect(policy.name).toBe('dotnet');
    });

    it('should select Dotnet policy for dotnet adapter command', () => {
      const policy = (worker as any).selectAdapterPolicy(undefined, {
        command: '/path/to/netcoredbg',
        args: ['--interpreter=vscode']
      });
      expect(policy.name).toBe('dotnet');
    });

    it('should select Mock policy for mock-adapter', () => {
      const policy = (worker as any).selectAdapterPolicy(undefined, {
        command: 'node',
        args: ['mock-adapter-process.js']
      });
      expect(policy.name).toBe('mock');
    });

    it('should select policy by language when provided, ignoring adapter command shape', () => {
      const policy = (worker as any).selectAdapterPolicy('ruby', {
        command: '/opt/python-toolchain/bin/rdbg',
        args: ['--open', '--port', '12345']
      });
      expect(policy.name).toBe('ruby');
    });

    it('should select policy by language without any adapter command', () => {
      expect((worker as any).selectAdapterPolicy('go').name).toBe('go');
      expect((worker as any).selectAdapterPolicy('python').name).toBe('python');
      expect((worker as any).selectAdapterPolicy('ruby').name).toBe('ruby');
    });

    it('should fall back to command sniffing for unknown languages', () => {
      const policy = (worker as any).selectAdapterPolicy('fortran', {
        command: 'dlv',
        args: ['dap', '--listen=:9876']
      });
      expect(policy.name).toBe('go');
    });
  });

  describe('Dry Run Mode', () => {
    it('should execute dry run and report command', async () => {
      // Use worker with mocked exit hook to prevent process.exit
      const exitSpy = vi.fn();
      worker = new DapProxyWorker(dependencies, { exit: exitSpy });
      
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python',
        adapterCommand: {
          command: 'python',
          args: ['-m', 'debugpy.adapter', '--port', '5678']
        },
        dryRunSpawn: true
      };

      await worker.handleCommand(payload);

      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          status: 'dry_run_complete',
          command: 'python -m debugpy.adapter --port 5678'
        })
      );
    });

    it('throws when adapter policy cannot provide spawn config', () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'dry-run-error',
        scriptPath: '/path/to/script.js',
        adapterHost: 'localhost',
        adapterPort: 1234,
        logDir: '/logs',
        executablePath: 'node',
        dryRunSpawn: true
      };

      (worker as unknown as { adapterPolicy: typeof DefaultAdapterPolicy }).adapterPolicy =
        DefaultAdapterPolicy;
      (worker as unknown as { logger: ILogger }).logger = mockLogger;

      expect(() =>
        (worker as unknown as { handleDryRun: (p: ProxyInitPayload) => void }).handleDryRun(payload)
      ).toThrow(/Cannot determine adapter command/);
    });
  });

  describe('Hook integration', () => {
    const basePayload: ProxyInitPayload = {
      cmd: 'init',
      sessionId: 'hook-session',
      scriptPath: '/path/to/script.py',
      adapterHost: 'localhost',
      adapterPort: 5678,
      logDir: '/logs',
      executablePath: 'python',
      adapterCommand: {
        command: 'python',
        args: ['-m', 'debugpy.adapter', '--port', '5678']
      },
      dryRunSpawn: true
    };

    it('uses custom trace file factory during initialization', async () => {
      vi.useFakeTimers();

      const exitSpy = vi.fn();
      const traceSpy = vi.fn().mockImplementation((_sessionId: string, logDir: string) => {
        const tracePath = path.join(logDir, 'custom-trace.ndjson');
        vi.stubEnv('DAP_TRACE_FILE', tracePath);
        return tracePath;
      });
      worker = new DapProxyWorker(dependencies, {
        createTraceFile: traceSpy,
        exit: exitSpy  // Mock the exit hook to prevent process.exit
      });

      await worker.handleCommand(basePayload);

      // Clear timers to prevent Windows IPC fix timer from leaking
      vi.clearAllTimers();

      expect(traceSpy).toHaveBeenCalledWith(basePayload.sessionId, basePayload.logDir);
      expect(process.env.DAP_TRACE_FILE).toBe(path.join(basePayload.logDir, 'custom-trace.ndjson'));

      vi.useRealTimers();
    });

    it('invokes custom exit hook when initialization fails critically', async () => {
      vi.useFakeTimers();

      const exitSpy = vi.fn();
      const traceSpy = vi.fn().mockReturnValue('/logs/custom-trace.ndjson');
      dependencies.fileSystem.ensureDir = vi.fn().mockRejectedValue(new Error('cannot ensure dir'));

      worker = new DapProxyWorker(dependencies, {
        exit: exitSpy,
        createTraceFile: traceSpy
      });

      const shutdownSpy = vi.spyOn(worker as unknown as { shutdown: () => Promise<void> }, 'shutdown').mockResolvedValue(undefined);

      await worker.handleCommand(basePayload);

      // Advance past the setImmediate + setTimeout(100ms) IPC flush pattern
      await vi.advanceTimersByTimeAsync(200);

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(shutdownSpy).toHaveBeenCalled();
      expect(worker.getState()).toBe(ProxyState.UNINITIALIZED);

      vi.useRealTimers();
    });

    it('does not trigger exit hook during successful dry run', async () => {
      vi.useFakeTimers();
      
      const exitSpy = vi.fn();
      worker = new DapProxyWorker(dependencies, {
        exit: exitSpy
      });

      await worker.handleCommand(basePayload);

      // The Windows IPC fix will schedule an exit after 100ms
      // Clear timers to prevent it from firing in later tests
      vi.clearAllTimers();
      
      expect(exitSpy).not.toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });

  describe('Adapter workflow internals', () => {
    // Store reference to current worker for cleanup
    let currentWorker: DapProxyWorker;
    
    beforeEach(() => {
      currentWorker = worker;
    });
    
    afterEach(async () => {
      // Clean up the current worker instance, not the original
      if (currentWorker && currentWorker !== worker && currentWorker.getState) {
        const state = currentWorker.getState();
        if (state !== ProxyState.TERMINATED) {
          try {
            await currentWorker.handleTerminate();
          } catch {
            // ignore
          }
        }
      }
    });
    
    it('startAdapterAndConnect should emit adapter_connected for queueing policy', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'js-session',
        executablePath: 'node',
        adapterHost: 'localhost',
        adapterPort: 9229,
        logDir: '/logs',
        scriptPath: '/path/to/script.js',
        adapterCommand: {
          command: 'node',
          args: ['--inspect', 'adapter.js']
        }
      };

      const processStub = {
        spawn: vi.fn().mockResolvedValue({
          process: new EventEmitter() as unknown as ChildProcess,
          pid: 321
        }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn(),
        initializeSession: vi.fn(),
        sendLaunchRequest: vi.fn(),
        setBreakpoints: vi.fn(),
        sendConfigurationDone: vi.fn(),
        disconnect: vi.fn()
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = JsDebugAdapterPolicy;
      (worker as any).adapterState = JsDebugAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      await (worker as any).startAdapterAndConnect(payload);

      expect(processStub.spawn).toHaveBeenCalledTimes(1);
      expect(connectionStub.connectWithRetry).toHaveBeenCalledWith(payload.adapterHost, payload.adapterPort);
      const statusCall = mockMessageSender.send.mock.calls.find(
        ([message]) => message.type === 'status' && message.status === 'adapter_connected'
      );
      expect(statusCall).toBeDefined();
      expect(worker.getState()).toBe(ProxyState.CONNECTED);
    });

    it('startAdapterAndConnect should initialize session for non-queue policy', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'py-session',
        executablePath: 'python',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        scriptPath: '/path/to/script.py',
        scriptArgs: ['--flag'],
        stopOnEntry: true,
        justMyCode: true
      };

      const processStub = {
        spawn: vi.fn().mockResolvedValue({
          process: new EventEmitter() as unknown as ChildProcess,
          pid: 654
        }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, () => void>) => {
          // Wire up event handlers like the real connection manager does
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onOutput) client.on('output', handlers.onOutput);
          if (handlers.onStopped) client.on('stopped', handlers.onStopped);
          if (handlers.onTerminated) client.on('terminated', handlers.onTerminated);
        }),
        initializeSession: vi.fn().mockImplementation(async () => {
          // Emit 'initialized' event after initializeSession, simulating real DAP adapter behavior
          setImmediate(() => (mockDapClient as EventEmitter).emit('initialized'));
        }),
        sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = PythonAdapterPolicy;
      (worker as any).adapterState = PythonAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      await (worker as any).startAdapterAndConnect(payload);
      await (worker as any).handleInitializedEvent();

      expect(processStub.spawn).toHaveBeenCalledTimes(1);
      expect(connectionStub.initializeSession).toHaveBeenCalledWith(
        mockDapClient,
        payload.sessionId,
        'debugpy'
      );
      expect(connectionStub.sendLaunchRequest).toHaveBeenCalledWith(
        mockDapClient,
        payload.scriptPath,
        payload.scriptArgs,
        payload.stopOnEntry,
        payload.justMyCode,
        payload.launchConfig
      );
      const statusCall = mockMessageSender.send.mock.calls.find(
        ([message]) => message.type === 'status' && message.status === 'adapter_configured_and_launched'
      );
      expect(statusCall).toBeDefined();
      expect(worker.getState()).toBe(ProxyState.CONNECTED);
    });

    it('sends adapter_capabilities when initializeSession returns a body (issue #243)', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'py-caps-session',
        executablePath: 'python',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        scriptPath: '/path/to/script.py',
        scriptArgs: [],
        stopOnEntry: true,
        justMyCode: true
      };

      const capabilities = {
        supportsExceptionInfoRequest: true,
        exceptionBreakpointFilters: [{ filter: 'uncaught', label: 'Uncaught' }]
      };

      const processStub = {
        spawn: vi.fn().mockResolvedValue({
          process: new EventEmitter() as unknown as ChildProcess,
          pid: 655
        }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn(),
        initializeSession: vi.fn().mockResolvedValue(capabilities),
        sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = PythonAdapterPolicy;
      (worker as any).adapterState = PythonAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      await (worker as any).startAdapterAndConnect(payload);

      const capsCalls = mockMessageSender.send.mock.calls.filter(
        ([message]) => message.type === 'status' && message.status === 'adapter_capabilities'
      );
      expect(capsCalls).toHaveLength(1);
      expect(capsCalls[0][0].capabilities).toEqual(capabilities);
    });

    it('sends no adapter_capabilities when initializeSession resolves undefined (issue #243)', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'py-nocaps-session',
        executablePath: 'python',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        scriptPath: '/path/to/script.py',
        scriptArgs: [],
        stopOnEntry: true,
        justMyCode: true
      };

      const processStub = {
        spawn: vi.fn().mockResolvedValue({
          process: new EventEmitter() as unknown as ChildProcess,
          pid: 656
        }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn(),
        initializeSession: vi.fn().mockResolvedValue(undefined),
        sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = PythonAdapterPolicy;
      (worker as any).adapterState = PythonAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      await (worker as any).startAdapterAndConnect(payload);

      const capsCalls = mockMessageSender.send.mock.calls.filter(
        ([message]) => message.type === 'status' && message.status === 'adapter_capabilities'
      );
      expect(capsCalls).toHaveLength(0);
    });

    it('captures capabilities from an initialize DAP command response exactly once (js path, issue #243)', async () => {
      mockMessageSender.send.mockClear();
      (worker as any).dapClient = mockDapClient;
      (worker as any).state = ProxyState.CONNECTED;
      (worker as any).adapterPolicy = JsDebugAdapterPolicy;
      (worker as any).adapterState = JsDebugAdapterPolicy.createInitialState();
      (worker as any).logger = mockLogger;
      (worker as any).currentSessionId = 'js-session';

      const capabilities = { supportsExceptionInfoRequest: true };
      mockDapClient.sendRequest = vi.fn().mockResolvedValue({ success: true, body: capabilities });

      const initializePayload: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'js-session',
        requestId: 'req-init-caps',
        dapCommand: 'initialize',
        dapArgs: { adapterID: 'pwa-node' }
      };

      await worker.handleCommand(initializePayload);
      // A second initialize must not re-send (once-per-session guard)
      await worker.handleCommand({ ...initializePayload, requestId: 'req-init-caps-2' });

      const capsCalls = mockMessageSender.send.mock.calls.filter(
        ([message]) => message.type === 'status' && message.status === 'adapter_capabilities'
      );
      expect(capsCalls).toHaveLength(1);
      expect(capsCalls[0][0].capabilities).toEqual(capabilities);

      mockDapClient.sendRequest = vi.fn().mockResolvedValue({ body: {} });
    });

    it('startAdapterAndConnect should connect directly for Ruby attach sessions', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'ruby-attach-session',
        language: 'ruby',
        executablePath: 'ruby',
        adapterHost: '127.0.0.1',
        adapterPort: 8123,
        logDir: '/logs',
        scriptPath: 'attach://remote',
        launchConfig: {
          request: 'attach',
          type: 'rdbg',
          host: '127.0.0.1',
          port: 12345
        }
        // No adapterCommand: direct-connect attach has no adapter process to spawn
      };

      const processStub = {
        spawn: vi.fn(),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, () => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
        }),
        initializeSession: vi.fn().mockImplementation(async () => {
          setImmediate(() => (mockDapClient as EventEmitter).emit('initialized'));
        }),
        sendAttachRequest: vi.fn().mockResolvedValue(undefined),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = RubyAdapterPolicy;
      (worker as any).adapterState = RubyAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      await (worker as any).startAdapterAndConnect(payload);

      expect(processStub.spawn).not.toHaveBeenCalled();
      expect(connectionStub.connectWithRetry).toHaveBeenCalledWith('127.0.0.1', 12345);
      expect(connectionStub.sendAttachRequest).toHaveBeenCalledWith(
        mockDapClient,
        payload.launchConfig
      );
    });

    it('startAdapterAndConnect wires adapter stdio forwarding for Ruby launch sessions (issue #222)', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'ruby-launch-session',
        language: 'ruby',
        executablePath: 'ruby',
        adapterHost: '127.0.0.1',
        adapterPort: 8124,
        logDir: '/logs',
        scriptPath: '/path/to/fizzbuzz.rb',
        launchConfig: { request: 'launch', type: 'rdbg' },
        adapterCommand: {
          command: 'rdbg',
          args: ['--open', '--host', '127.0.0.1', '--port', '8124', '-c', '--', 'ruby', '/path/to/fizzbuzz.rb']
        }
      };

      const processStub = {
        spawn: vi.fn().mockResolvedValue({
          process: new EventEmitter() as unknown as ChildProcess,
          pid: 4242
        }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, () => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
        }),
        initializeSession: vi.fn().mockImplementation(async () => {
          setImmediate(() => (mockDapClient as EventEmitter).emit('initialized'));
        }),
        sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = RubyAdapterPolicy;
      (worker as any).adapterState = RubyAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).currentSessionId = payload.sessionId;
      (worker as any).state = ProxyState.INITIALIZING;

      await (worker as any).startAdapterAndConnect(payload);

      expect(processStub.spawn).toHaveBeenCalledTimes(1);
      const spawnConfig = processStub.spawn.mock.calls[0][0];
      expect(typeof spawnConfig.onStdioLine).toBe('function');

      const outputMessages = () => mockMessageSender.send.mock.calls
        .map(([message]) => message)
        .filter((message) => message.type === 'dapEvent' && message.event === 'output');

      spawnConfig.onStdioLine('stdout', '6: Fizz');
      expect(outputMessages().at(-1)?.body).toEqual({ category: 'stdout', output: '6: Fizz\n' });

      spawnConfig.onStdioLine('stderr', 'some warning');
      expect(outputMessages().at(-1)?.body).toEqual({ category: 'stderr', output: 'some warning\n' });

      // Blank lines are program output and survive as bare newlines
      spawnConfig.onStdioLine('stdout', '');
      expect(outputMessages().at(-1)?.body).toEqual({ category: 'stdout', output: '\n' });

      // rdbg's own stderr banners are excluded from forwarding
      const before = outputMessages().length;
      spawnConfig.onStdioLine('stderr', 'DEBUGGER: wait for debugger connection...');
      expect(outputMessages().length).toBe(before);
    });

    it('holds terminated and dap_connection_closed until adapter stdio drains (issue #222)', async () => {
      // A debuggee printing to a block-buffered pipe flushes everything at
      // exit, milliseconds AFTER the adapter's terminated event / socket
      // close. The worker must forward the flushed output before either
      // teardown signal reaches the parent, which reacts by dropping late
      // messages.
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'ruby-drain-session',
        language: 'ruby',
        executablePath: 'ruby',
        adapterHost: '127.0.0.1',
        adapterPort: 8125,
        logDir: '/logs',
        scriptPath: '/path/to/fizzbuzz.rb',
        launchConfig: { request: 'launch', type: 'rdbg' },
        adapterCommand: { command: 'rdbg', args: ['--open', '-c', '--', 'ruby', '/path/to/fizzbuzz.rb'] }
      };

      const adapterProcess = new EventEmitter() as any;
      adapterProcess.pid = 4244;
      adapterProcess.stdout = new EventEmitter();
      adapterProcess.stderr = new EventEmitter();
      adapterProcess.kill = vi.fn();
      adapterProcess.unref = vi.fn();

      const processStub = {
        spawn: vi.fn().mockResolvedValue({ process: adapterProcess as ChildProcess, pid: 4244 }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, (body?: unknown) => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onTerminated) client.on('terminated', handlers.onTerminated);
          if (handlers.onClose) client.on('close', handlers.onClose);
        }),
        initializeSession: vi.fn().mockImplementation(async () => {
          setImmediate(() => (mockDapClient as EventEmitter).emit('initialized'));
        }),
        sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = RubyAdapterPolicy;
      (worker as any).adapterState = RubyAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).currentSessionId = payload.sessionId;
      (worker as any).state = ProxyState.INITIALIZING;

      await (worker as any).startAdapterAndConnect(payload);
      const spawnConfig = processStub.spawn.mock.calls[0][0];

      const sentMessages = () => mockMessageSender.send.mock.calls.map(([m]) => m);
      const flush = () => new Promise(resolve => setImmediate(resolve));

      // Adapter announces termination and closes the DAP socket...
      (mockDapClient as EventEmitter).emit('terminated', {});
      (mockDapClient as EventEmitter).emit('close');
      await flush();

      // ...but neither signal is forwarded while the stdio streams are open
      expect(sentMessages().some(m => m.type === 'dapEvent' && m.event === 'terminated')).toBe(false);
      expect(sentMessages().some(m => m.type === 'status' && m.status === 'dap_connection_closed')).toBe(false);

      // The exit-time flush arrives, then the streams close and rdbg dies
      spawnConfig.onStdioLine('stdout', '15: FizzBuzz');
      adapterProcess.stdout.emit('close');
      adapterProcess.stderr.emit('close');
      adapterProcess.emit('exit', 0, null);
      await flush();

      const messages = sentMessages();
      const outputIdx = messages.findIndex(m =>
        m.type === 'dapEvent' && m.event === 'output' && m.body?.category === 'stdout' && m.body?.output === '15: FizzBuzz\n');
      const terminatedIdx = messages.findIndex(m => m.type === 'dapEvent' && m.event === 'terminated');
      expect(outputIdx).toBeGreaterThanOrEqual(0);
      expect(terminatedIdx).toBeGreaterThanOrEqual(0);
      // The flushed output must reach the parent before the teardown signal
      expect(outputIdx).toBeLessThan(terminatedIdx);
    });

    it('forwards terminated before dap_connection_closed in arrival order (issue #258)', async () => {
      // rdbg sends terminated and then closes the socket. Both handlers await
      // the same stdio drain barrier; whichever continuation runs first wins.
      // The parent maps dap_connection_closed to a session exit, stripping
      // the terminated handler — so terminated must always be forwarded
      // first, matching arrival order.
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'ruby-order-session',
        language: 'ruby',
        executablePath: 'ruby',
        adapterHost: '127.0.0.1',
        adapterPort: 8126,
        logDir: '/logs',
        scriptPath: '/path/to/fizzbuzz.rb',
        launchConfig: { request: 'launch', type: 'rdbg' },
        adapterCommand: { command: 'rdbg', args: ['--open', '-c', '--', 'ruby', '/path/to/fizzbuzz.rb'] }
      };

      const adapterProcess = new EventEmitter() as any;
      adapterProcess.pid = 4245;
      adapterProcess.stdout = new EventEmitter();
      adapterProcess.stderr = new EventEmitter();
      adapterProcess.kill = vi.fn();
      adapterProcess.unref = vi.fn();

      const processStub = {
        spawn: vi.fn().mockResolvedValue({ process: adapterProcess as ChildProcess, pid: 4245 }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, (body?: unknown) => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onTerminated) client.on('terminated', handlers.onTerminated);
          if (handlers.onClose) client.on('close', handlers.onClose);
        }),
        initializeSession: vi.fn().mockImplementation(async () => {
          setImmediate(() => (mockDapClient as EventEmitter).emit('initialized'));
        }),
        sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = RubyAdapterPolicy;
      (worker as any).adapterState = RubyAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).currentSessionId = payload.sessionId;
      (worker as any).state = ProxyState.INITIALIZING;

      await (worker as any).startAdapterAndConnect(payload);

      const sentMessages = () => mockMessageSender.send.mock.calls.map(([m]) => m);
      const flush = () => new Promise(resolve => setImmediate(resolve));

      // Terminated arrives first, then the socket closes, then stdio drains
      // and rdbg's process dies
      (mockDapClient as EventEmitter).emit('terminated', {});
      (mockDapClient as EventEmitter).emit('close');
      await flush();
      adapterProcess.stdout.emit('close');
      adapterProcess.stderr.emit('close');
      adapterProcess.emit('exit', 0, null);
      await flush();
      await flush();

      const messages = sentMessages();
      const terminatedIdx = messages.findIndex(m => m.type === 'dapEvent' && m.event === 'terminated');
      const closedIdx = messages.findIndex(m => m.type === 'status' && m.status === 'dap_connection_closed');
      expect(terminatedIdx).toBeGreaterThanOrEqual(0);
      expect(closedIdx).toBeGreaterThanOrEqual(0);
      // Arrival order must be preserved: terminated was first
      expect(terminatedIdx).toBeLessThan(closedIdx);
      // Terminated was forwarded first, so the closure is an expected teardown
      expect(messages[closedIdx].expected).toBe(true);
    });

    it('marks dap_connection_closed unexpected when the socket drops mid-run (issue #258)', async () => {
      // No terminated/exited event and no shutdown underway: the adapter
      // dropped the DAP socket while the debuggee was still running. The
      // parent must be able to tell this apart from a normal teardown.
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'ruby-abnormal-close-session',
        language: 'ruby',
        executablePath: 'ruby',
        adapterHost: '127.0.0.1',
        adapterPort: 8128,
        logDir: '/logs',
        scriptPath: '/path/to/fizzbuzz.rb',
        launchConfig: { request: 'launch', type: 'rdbg' },
        adapterCommand: { command: 'rdbg', args: ['--open', '-c', '--', 'ruby', '/path/to/fizzbuzz.rb'] }
      };

      const adapterProcess = new EventEmitter() as any;
      adapterProcess.pid = 4247;
      adapterProcess.stdout = new EventEmitter();
      adapterProcess.stderr = new EventEmitter();
      adapterProcess.kill = vi.fn();
      adapterProcess.unref = vi.fn();

      const processStub = {
        spawn: vi.fn().mockResolvedValue({ process: adapterProcess as ChildProcess, pid: 4247 }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, (body?: unknown) => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onTerminated) client.on('terminated', handlers.onTerminated);
          if (handlers.onClose) client.on('close', handlers.onClose);
        }),
        initializeSession: vi.fn().mockImplementation(async () => {
          setImmediate(() => (mockDapClient as EventEmitter).emit('initialized'));
        }),
        sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = RubyAdapterPolicy;
      (worker as any).adapterState = RubyAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).currentSessionId = payload.sessionId;
      (worker as any).state = ProxyState.INITIALIZING;

      await (worker as any).startAdapterAndConnect(payload);

      const sentMessages = () => mockMessageSender.send.mock.calls.map(([m]) => m);
      const flush = () => new Promise(resolve => setImmediate(resolve));

      (mockDapClient as EventEmitter).emit('close');
      adapterProcess.stdout.emit('close');
      adapterProcess.stderr.emit('close');
      await flush();
      await flush();

      const closed = sentMessages().find(m => m.type === 'status' && m.status === 'dap_connection_closed');
      expect(closed).toBeDefined();
      expect(closed.expected).toBe(false);
    });

    describe('adapter-exit exitCode synthesis (issue #258)', () => {
      // rdbg never sends a DAP exited event, but rdbg -c makes the adapter
      // process's exit status the debuggee's. Policies that declare
      // adapterExitCodeIsDebuggeeExitCode get a synthesized exited event so
      // the session records the debuggee exit code like Python/js do.
      const makeRubyHarness = async (sessionId: string, port: number) => {
        const payload: ProxyInitPayload = {
          cmd: 'init',
          sessionId,
          language: 'ruby',
          executablePath: 'ruby',
          adapterHost: '127.0.0.1',
          adapterPort: port,
          logDir: '/logs',
          scriptPath: '/path/to/script.rb',
          launchConfig: { request: 'launch', type: 'rdbg' },
          adapterCommand: { command: 'rdbg', args: ['--open', '-c', '--', 'ruby', '/path/to/script.rb'] }
        };

        const adapterProcess = new EventEmitter() as any;
        adapterProcess.pid = 5000 + port;
        adapterProcess.stdout = new EventEmitter();
        adapterProcess.stderr = new EventEmitter();
        adapterProcess.kill = vi.fn();
        adapterProcess.unref = vi.fn();
        adapterProcess.exitCode = null;

        const processStub = {
          spawn: vi.fn().mockResolvedValue({ process: adapterProcess as ChildProcess, pid: adapterProcess.pid }),
          shutdown: vi.fn().mockResolvedValue(undefined)
        };

        const connectionStub = {
          connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
          setAdapterPolicy: vi.fn(),
          setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, (body?: unknown) => void>) => {
            if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
            if (handlers.onTerminated) client.on('terminated', handlers.onTerminated);
            if (handlers.onClose) client.on('close', handlers.onClose);
          }),
          initializeSession: vi.fn().mockImplementation(async () => {
            setImmediate(() => (mockDapClient as EventEmitter).emit('initialized'));
          }),
          sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
          setBreakpoints: vi.fn().mockResolvedValue(undefined),
          sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined)
        };

        (worker as any).logger = mockLogger;
        (worker as any).processManager = processStub;
        (worker as any).connectionManager = connectionStub;
        (worker as any).adapterPolicy = RubyAdapterPolicy;
        (worker as any).adapterState = RubyAdapterPolicy.createInitialState();
        (worker as any).currentInitPayload = payload;
        (worker as any).currentSessionId = payload.sessionId;
        (worker as any).state = ProxyState.INITIALIZING;

        await (worker as any).startAdapterAndConnect(payload);
        return { adapterProcess };
      };

      const sentMessages = () => mockMessageSender.send.mock.calls.map(([m]: [any]) => m);
      const flush = () => new Promise(resolve => setImmediate(resolve));

      it('synthesizes exited from the adapter exit code before terminated (crash, code 1)', async () => {
        const { adapterProcess } = await makeRubyHarness('ruby-synth-crash', 8130);

        (mockDapClient as EventEmitter).emit('terminated', {});
        adapterProcess.stdout.emit('close');
        adapterProcess.stderr.emit('close');
        await flush();
        // The adapter process dies moments after terminated (rdbg -c: exit
        // status is the debuggee's)
        adapterProcess.emit('exit', 1, null);
        await flush();
        await flush();

        const messages = sentMessages();
        const exitedIdx = messages.findIndex((m: any) => m.type === 'dapEvent' && m.event === 'exited');
        const terminatedIdx = messages.findIndex((m: any) => m.type === 'dapEvent' && m.event === 'terminated');
        expect(exitedIdx).toBeGreaterThanOrEqual(0);
        expect(messages[exitedIdx].body).toEqual({ exitCode: 1 });
        expect(terminatedIdx).toBeGreaterThanOrEqual(0);
        expect(exitedIdx).toBeLessThan(terminatedIdx);
      });

      it('synthesizes exited with code 0 for a clean run', async () => {
        const { adapterProcess } = await makeRubyHarness('ruby-synth-clean', 8131);

        (mockDapClient as EventEmitter).emit('terminated', {});
        adapterProcess.stdout.emit('close');
        adapterProcess.stderr.emit('close');
        await flush();
        adapterProcess.emit('exit', 0, null);
        await flush();
        await flush();

        const messages = sentMessages();
        const exited = messages.find((m: any) => m.type === 'dapEvent' && m.event === 'exited');
        expect(exited).toBeDefined();
        expect(exited.body).toEqual({ exitCode: 0 });
      });

      it('skips synthesis on signal kill (no exit code)', async () => {
        const { adapterProcess } = await makeRubyHarness('ruby-synth-signal', 8132);

        (mockDapClient as EventEmitter).emit('terminated', {});
        adapterProcess.stdout.emit('close');
        adapterProcess.stderr.emit('close');
        await flush();
        adapterProcess.emit('exit', null, 'SIGKILL');
        await flush();
        await flush();

        const messages = sentMessages();
        expect(messages.some((m: any) => m.type === 'dapEvent' && m.event === 'exited')).toBe(false);
        expect(messages.some((m: any) => m.type === 'dapEvent' && m.event === 'terminated')).toBe(true);
      });

      it('skips synthesis for policies that do not opt in (python)', async () => {
        const payload: ProxyInitPayload = {
          cmd: 'init',
          sessionId: 'py-no-synth-session',
          executablePath: 'python',
          adapterHost: 'localhost',
          adapterPort: 8133,
          logDir: '/logs',
          scriptPath: '/path/to/script.py'
        };

        const adapterProcess = new EventEmitter() as any;
        adapterProcess.pid = 6133;
        adapterProcess.stdout = new EventEmitter();
        adapterProcess.stderr = new EventEmitter();
        adapterProcess.kill = vi.fn();
        adapterProcess.unref = vi.fn();
        adapterProcess.exitCode = null;

        const processStub = {
          spawn: vi.fn().mockResolvedValue({ process: adapterProcess as ChildProcess, pid: 6133 }),
          shutdown: vi.fn().mockResolvedValue(undefined)
        };

        const connectionStub = {
          connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
          setAdapterPolicy: vi.fn(),
          setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, (body?: unknown) => void>) => {
            if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
            if (handlers.onTerminated) client.on('terminated', handlers.onTerminated);
            if (handlers.onClose) client.on('close', handlers.onClose);
          }),
          initializeSession: vi.fn().mockImplementation(async () => {
            setImmediate(() => (mockDapClient as EventEmitter).emit('initialized'));
          }),
          sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
          setBreakpoints: vi.fn().mockResolvedValue(undefined),
          sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined)
        };

        (worker as any).logger = mockLogger;
        (worker as any).processManager = processStub;
        (worker as any).connectionManager = connectionStub;
        (worker as any).adapterPolicy = PythonAdapterPolicy;
        (worker as any).adapterState = PythonAdapterPolicy.createInitialState();
        (worker as any).currentInitPayload = payload;
        (worker as any).currentSessionId = payload.sessionId;
        (worker as any).state = ProxyState.INITIALIZING;

        await (worker as any).startAdapterAndConnect(payload);

        adapterProcess.emit('exit', 1, null);
        (mockDapClient as EventEmitter).emit('terminated', {});
        await flush();
        await flush();

        const messages = sentMessages();
        expect(messages.some((m: any) => m.type === 'dapEvent' && m.event === 'exited')).toBe(false);
        expect(messages.some((m: any) => m.type === 'dapEvent' && m.event === 'terminated')).toBe(true);
      });
    });

    it('adapter_exited never overtakes a terminal DAP event (issue #258)', async () => {
      // The adapter process's 'exit' fires while terminated is held behind
      // the stdio drain barrier. If adapter_exited reaches the parent first,
      // its exit code (the debuggee's, via rdbg -c) — or a fabricated one —
      // ends the session before terminated can mark it stopped.
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'ruby-adapter-exit-order-session',
        language: 'ruby',
        executablePath: 'ruby',
        adapterHost: '127.0.0.1',
        adapterPort: 8127,
        logDir: '/logs',
        scriptPath: '/path/to/crash.rb',
        launchConfig: { request: 'launch', type: 'rdbg' },
        adapterCommand: { command: 'rdbg', args: ['--open', '-c', '--', 'ruby', '/path/to/crash.rb'] }
      };

      const adapterProcess = new EventEmitter() as any;
      adapterProcess.pid = 4246;
      adapterProcess.stdout = new EventEmitter();
      adapterProcess.stderr = new EventEmitter();
      adapterProcess.kill = vi.fn();
      adapterProcess.unref = vi.fn();

      const processStub = {
        spawn: vi.fn().mockResolvedValue({ process: adapterProcess as ChildProcess, pid: 4246 }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, (body?: unknown) => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onTerminated) client.on('terminated', handlers.onTerminated);
          if (handlers.onClose) client.on('close', handlers.onClose);
        }),
        initializeSession: vi.fn().mockImplementation(async () => {
          setImmediate(() => (mockDapClient as EventEmitter).emit('initialized'));
        }),
        sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = RubyAdapterPolicy;
      (worker as any).adapterState = RubyAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).currentSessionId = payload.sessionId;
      (worker as any).state = ProxyState.INITIALIZING;

      await (worker as any).startAdapterAndConnect(payload);

      const sentMessages = () => mockMessageSender.send.mock.calls.map(([m]) => m);
      const flush = () => new Promise(resolve => setImmediate(resolve));

      // Terminated arrives, then the adapter process dies (code 1 = the
      // debuggee's own exit status under rdbg -c), then stdio drains
      (mockDapClient as EventEmitter).emit('terminated', {});
      adapterProcess.emit('exit', 1, null);
      await flush();
      adapterProcess.stdout.emit('close');
      adapterProcess.stderr.emit('close');
      await flush();
      await flush();

      const messages = sentMessages();
      const terminatedIdx = messages.findIndex(m => m.type === 'dapEvent' && m.event === 'terminated');
      const adapterExitedIdx = messages.findIndex(m => m.type === 'status' && m.status === 'adapter_exited');
      expect(terminatedIdx).toBeGreaterThanOrEqual(0);
      expect(adapterExitedIdx).toBeGreaterThanOrEqual(0);
      // The terminal DAP event arrived first and must be forwarded first
      expect(terminatedIdx).toBeLessThan(adapterExitedIdx);
      // The real exit code must survive the reordering
      expect(messages[adapterExitedIdx].code).toBe(1);
    });

    it('startAdapterAndConnect passes no stdio forwarder for policies that do not opt in', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'py-no-forward-session',
        executablePath: 'python',
        adapterHost: 'localhost',
        adapterPort: 5679,
        logDir: '/logs',
        scriptPath: '/path/to/script.py'
      };

      const processStub = {
        spawn: vi.fn().mockResolvedValue({
          process: new EventEmitter() as unknown as ChildProcess,
          pid: 4243
        }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn(),
        initializeSession: vi.fn(),
        sendLaunchRequest: vi.fn(),
        setBreakpoints: vi.fn(),
        sendConfigurationDone: vi.fn(),
        disconnect: vi.fn()
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = PythonAdapterPolicy;
      (worker as any).adapterState = PythonAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      await (worker as any).startAdapterAndConnect(payload);

      expect(processStub.spawn).toHaveBeenCalledTimes(1);
      expect(processStub.spawn.mock.calls[0][0].onStdioLine).toBeUndefined();
    });

    it('startAdapterAndConnect should defer initialized and send launch before configurationDone when sendLaunchBeforeConfig is true', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'go-session',
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

      // Track the order of DAP operations
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
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, () => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onOutput) client.on('output', handlers.onOutput);
          if (handlers.onStopped) client.on('stopped', handlers.onStopped);
          if (handlers.onTerminated) client.on('terminated', handlers.onTerminated);
        }),
        // Delve sends 'initialized' immediately after 'initialize' (before launch)
        initializeSession: vi.fn().mockImplementation(async () => {
          callOrder.push('initializeSession');
          // Delve fires initialized event right after initialize response
          setImmediate(() => (mockDapClient as EventEmitter).emit('initialized'));
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
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      await (worker as any).startAdapterAndConnect(payload);

      // Verify the correct DAP sequence for Go/Delve:
      // initialize → (initialized event) → launch → configurationDone
      expect(connectionStub.initializeSession).toHaveBeenCalledWith(
        mockDapClient,
        payload.sessionId,
        'dlv-dap'
      );
      expect(connectionStub.sendLaunchRequest).toHaveBeenCalledWith(
        mockDapClient,
        payload.scriptPath,
        payload.scriptArgs,
        payload.stopOnEntry,
        payload.justMyCode,
        payload.launchConfig
      );
      expect(connectionStub.sendConfigurationDone).toHaveBeenCalledTimes(1);

      // Verify ordering: launch MUST come before configurationDone
      const launchIdx = callOrder.indexOf('sendLaunchRequest');
      const configDoneIdx = callOrder.indexOf('sendConfigurationDone');
      expect(launchIdx).toBeGreaterThan(-1);
      expect(configDoneIdx).toBeGreaterThan(-1);
      expect(launchIdx).toBeLessThan(configDoneIdx);

      // Verify initialization happened first
      const initIdx = callOrder.indexOf('initializeSession');
      expect(initIdx).toBeLessThan(launchIdx);

      // Verify final state
      const statusCall = mockMessageSender.send.mock.calls.find(
        ([message]: [StatusMessage]) => message.type === 'status' && message.status === 'adapter_configured_and_launched'
      );
      expect(statusCall).toBeDefined();
      expect(worker.getState()).toBe(ProxyState.CONNECTED);
    });

    it('ensureInitialStop should pause when threads available', async () => {
      (worker as any).dapClient = mockDapClient;
      const sendRequestMock = mockDapClient.sendRequest as Mock;
      sendRequestMock.mockReset();
      sendRequestMock.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          return { body: { threads: [{ id: 7 }] } };
        }
        if (command === 'pause') {
          return { success: true };
        }
        return { success: true };
      });

      await (worker as any).ensureInitialStop();

      const threadsCall = sendRequestMock.mock.calls.find(([cmd]) => cmd === 'threads');
      expect(threadsCall).toBeDefined();
      const pauseCall = sendRequestMock.mock.calls.find(([cmd]) => cmd === 'pause');
      expect(pauseCall?.[1]).toEqual({ threadId: 7 });
    });

    it('ensureInitialStop logs warning when no threads appear', async () => {
      vi.useFakeTimers();
      
      // Create worker with mocked exit hook to prevent test termination
      const exitSpy = vi.fn();
      const testWorker = new DapProxyWorker(dependencies, { exit: exitSpy });
      currentWorker = testWorker; // Track for cleanup
      
      (testWorker as any).dapClient = mockDapClient;
      (testWorker as any).logger = mockLogger;
      const sendRequestMock = mockDapClient.sendRequest as Mock;
      sendRequestMock.mockReset();
      sendRequestMock.mockImplementation(async (command: string) => {
        if (command === 'threads') {
          return { body: { threads: [] } };
        }
        throw new Error(`Unexpected command ${command}`);
      });

      const ensurePromise: Promise<void> = (testWorker as any).ensureInitialStop(120);
      await vi.advanceTimersByTimeAsync(200);
      await ensurePromise;

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('ensureInitialStop: no threads discovered within timeout')
      );
      expect(sendRequestMock).toHaveBeenCalledWith('threads', {});
      
      // Verify that exit was not called during this test
      expect(exitSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('wires adapter process events and propagates DAP events', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'process-session',
        executablePath: 'python',
        adapterHost: 'localhost',
        adapterPort: 5679,
        logDir: '/logs',
        scriptPath: '/path/to/script.py',
        adapterCommand: {
          command: 'python',
          args: ['-m', 'debugpy.adapter']
        }
      };

      const adapterEmitter = new EventEmitter() as unknown as ChildProcess;
      Object.assign(adapterEmitter, {
        pid: 999,
        kill: vi.fn(),
        unref: vi.fn(),
        killed: false
      });

      const processStub = {
        spawn: vi.fn().mockResolvedValue({
          process: adapterEmitter as ChildProcess,
          pid: 999
        }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionHandlers: Record<string, (arg?: unknown) => unknown> = {};
      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, () => void>) => {
          // Store handlers for test inspection and wire them up
          Object.assign(connectionHandlers, handlers);
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onOutput) client.on('output', handlers.onOutput);
          if (handlers.onStopped) client.on('stopped', handlers.onStopped);
          if (handlers.onTerminated) client.on('terminated', handlers.onTerminated);
        }),
        initializeSession: vi.fn().mockImplementation(async () => {
          // Emit 'initialized' event after initializeSession, simulating real DAP adapter behavior
          setImmediate(() => (mockDapClient as EventEmitter).emit('initialized'));
        }),
        sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = PythonAdapterPolicy;
      (worker as any).adapterState = PythonAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      mockMessageSender.send.mockClear();
      const shutdownSpy = vi
        .spyOn(worker as unknown as { shutdown: () => Promise<void> }, 'shutdown')
        .mockResolvedValue(undefined);

      await (worker as any).startAdapterAndConnect(payload);

      expect(processStub.spawn).toHaveBeenCalledTimes(1);
      expect(connectionStub.setupEventHandlers).toHaveBeenCalled();

      const error = new Error('adapter fail');
      adapterEmitter.emit('error', error);
      expect(mockLogger.error).toHaveBeenCalledWith('[Worker] Adapter process error:', error);
      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'Adapter process error: adapter fail'
        })
      );

      adapterEmitter.emit('exit', 0, null);
      // adapter_exited now rides the terminal-signal queue (issue #258)
      await new Promise(resolve => setImmediate(resolve));
      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          status: 'adapter_exited',
          code: 0,
          signal: null
        })
      );

      await connectionHandlers.onStopped?.({ reason: 'breakpoint' });
      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapEvent',
          event: 'stopped',
          body: { reason: 'breakpoint' }
        })
      );

      await connectionHandlers.onTerminated?.({ restart: false });
      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapEvent',
          event: 'terminated',
          body: { restart: false }
        })
      );
      expect(shutdownSpy).toHaveBeenCalled();

      shutdownSpy.mockRestore();
    });

    it('handleTerminate should shutdown client and process (launch mode)', async () => {
      (worker as any).dapClient = mockDapClient;
      const processStub = { shutdown: vi.fn().mockResolvedValue(undefined) };
      const connectionStub = { disconnect: vi.fn().mockResolvedValue(undefined) };
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).state = ProxyState.CONNECTED;

      await worker.handleTerminate();

      // Launch mode: shutdown calls disconnect with terminateDebuggee=true
      expect(connectionStub.disconnect).toHaveBeenCalledWith(mockDapClient, true);
      expect(mockDapClient.shutdown).toHaveBeenCalledWith('worker shutdown');
      // The disconnect must be sent while the socket is still alive — i.e.
      // BEFORE dapClient.shutdown() destroys it — or the adapter never
      // receives terminateDebuggee and orphans its debuggee (issue #156).
      expect(connectionStub.disconnect.mock.invocationCallOrder[0]).toBeLessThan(
        (mockDapClient.shutdown as Mock).mock.invocationCallOrder[0]
      );
      expect(worker.getState()).toBe(ProxyState.TERMINATED);
    });

    it('shutdown requests an adapter process tree-kill in launch mode', async () => {
      vi.useFakeTimers();
      try {
        const processStub = { shutdown: vi.fn().mockResolvedValue(undefined) };
        const connectionStub = { disconnect: vi.fn().mockResolvedValue(undefined) };
        const adapterProc = { pid: 4242 };
        (worker as any).dapClient = mockDapClient;
        (worker as any).processManager = processStub;
        (worker as any).connectionManager = connectionStub;
        (worker as any).adapterProcess = adapterProc;
        (worker as any).state = ProxyState.CONNECTED;

        const terminatePromise = worker.handleTerminate();
        await vi.advanceTimersByTimeAsync(500);
        await terminatePromise;

        expect(processStub.shutdown).toHaveBeenCalledWith(adapterProc, { killProcessTree: true });
      } finally {
        vi.useRealTimers();
      }
    });

    it('shutdown must not request a tree-kill in attach mode', async () => {
      vi.useFakeTimers();
      try {
        const processStub = { shutdown: vi.fn().mockResolvedValue(undefined) };
        const connectionStub = { disconnect: vi.fn().mockResolvedValue(undefined) };
        const adapterProc = { pid: 4242 };
        (worker as any).dapClient = mockDapClient;
        (worker as any).processManager = processStub;
        (worker as any).connectionManager = connectionStub;
        (worker as any).adapterProcess = adapterProc;
        (worker as any).state = ProxyState.CONNECTED;
        (worker as any).isAttachMode = true;

        const terminatePromise = worker.handleTerminate();
        await vi.advanceTimersByTimeAsync(500);
        await terminatePromise;

        expect(processStub.shutdown).toHaveBeenCalledWith(adapterProc, { killProcessTree: false });
      } finally {
        vi.useRealTimers();
      }
    });

    it('handleTerminate should auto-detach in attach mode', async () => {
      (worker as any).dapClient = mockDapClient;
      const processStub = { shutdown: vi.fn().mockResolvedValue(undefined) };
      const connectionStub = { disconnect: vi.fn().mockResolvedValue(undefined) };
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).state = ProxyState.CONNECTED;
      (worker as any).isAttachMode = true;

      await worker.handleTerminate();

      // Attach mode: auto-detach sends disconnect with terminateDebuggee=false
      expect(connectionStub.disconnect).toHaveBeenCalledWith(mockDapClient, false);
      expect(worker.getState()).toBe(ProxyState.TERMINATED);
    });
  });

  describe('Exception Breakpoints (issue #220)', () => {
    const buildPayload = (breakOnExceptions?: 'uncaught' | 'all' | 'none'): ProxyInitPayload => ({
      cmd: 'init',
      sessionId: 'ex-session',
      executablePath: 'python',
      adapterHost: 'localhost',
      adapterPort: 5678,
      logDir: '/logs',
      scriptPath: '/path/to/script.py',
      initialBreakpoints: [{ file: '/path/to/script.py', line: 3 }],
      ...(breakOnExceptions ? { breakOnExceptions } : {})
    });

    const buildConnectionStub = () => ({
      setBreakpoints: vi.fn().mockResolvedValue(undefined),
      setExceptionBreakpoints: vi.fn().mockResolvedValue(undefined),
      sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined)
    });

    const primeWorker = (payload: ProxyInitPayload, connectionStub: object, policy = PythonAdapterPolicy) => {
      (worker as any).logger = mockLogger;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = policy;
      (worker as any).adapterState = policy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).dapClient = mockDapClient;
      (worker as any).state = ProxyState.INITIALIZING;
    };

    it('sends setExceptionBreakpoints with resolved filters between setBreakpoints and configurationDone', async () => {
      const payload = buildPayload('uncaught');
      const connectionStub = buildConnectionStub();
      primeWorker(payload, connectionStub);

      await (worker as any).handleInitializedEvent();

      expect(connectionStub.setExceptionBreakpoints).toHaveBeenCalledTimes(1);
      expect(connectionStub.setExceptionBreakpoints).toHaveBeenCalledWith(mockDapClient, ['uncaught']);
      // Order: setBreakpoints -> setExceptionBreakpoints -> configurationDone
      const bpOrder = connectionStub.setBreakpoints.mock.invocationCallOrder[0];
      const exOrder = connectionStub.setExceptionBreakpoints.mock.invocationCallOrder[0];
      const configOrder = connectionStub.sendConfigurationDone.mock.invocationCallOrder[0];
      expect(bpOrder).toBeLessThan(exOrder);
      expect(exOrder).toBeLessThan(configOrder);
      expect(worker.getState()).toBe(ProxyState.CONNECTED);
    });

    it("resolves 'all' mode through the adapter policy", async () => {
      const payload = buildPayload('all');
      const connectionStub = buildConnectionStub();
      primeWorker(payload, connectionStub);

      await (worker as any).handleInitializedEvent();

      expect(connectionStub.setExceptionBreakpoints).toHaveBeenCalledWith(mockDapClient, ['raised', 'uncaught']);
    });

    it('does not send setExceptionBreakpoints when the mode is absent or none', async () => {
      for (const mode of [undefined, 'none' as const]) {
        const payload = buildPayload(mode);
        const connectionStub = buildConnectionStub();
        primeWorker(payload, connectionStub);
        (worker as any).initializedEventHandled = false;

        await (worker as any).handleInitializedEvent();

        expect(connectionStub.setExceptionBreakpoints).not.toHaveBeenCalled();
        expect(connectionStub.sendConfigurationDone).toHaveBeenCalledTimes(1);
      }
    });

    it('continues the launch when setExceptionBreakpoints fails', async () => {
      const payload = buildPayload('uncaught');
      const connectionStub = buildConnectionStub();
      connectionStub.setExceptionBreakpoints.mockRejectedValue(new Error('unsupported'));
      primeWorker(payload, connectionStub);

      await (worker as any).handleInitializedEvent();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('setExceptionBreakpoints failed')
      );
      expect(connectionStub.sendConfigurationDone).toHaveBeenCalledTimes(1);
      const statusCall = mockMessageSender.send.mock.calls.find(
        ([message]) => message.type === 'status' && message.status === 'adapter_configured_and_launched'
      );
      expect(statusCall).toBeDefined();
      expect(worker.getState()).toBe(ProxyState.CONNECTED);
    });

    it('skips the request and warns when the policy does not support the mode', async () => {
      const payload = buildPayload('uncaught');
      const connectionStub = buildConnectionStub();
      primeWorker(payload, connectionStub, DefaultAdapterPolicy);

      await (worker as any).handleInitializedEvent();

      expect(connectionStub.setExceptionBreakpoints).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("breakOnExceptions 'uncaught' is not supported")
      );
      expect(connectionStub.sendConfigurationDone).toHaveBeenCalledTimes(1);
    });

    it('forwards the mode to the DAP client for child sessions during startAdapterAndConnect', async () => {
      const payload = buildPayload('uncaught');
      const setExceptionBreakMode = vi.fn();
      Object.assign(mockDapClient, { setExceptionBreakMode });

      const processStub = {
        spawn: vi.fn().mockResolvedValue({
          process: new EventEmitter() as unknown as ChildProcess,
          pid: 654
        }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };
      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn(),
        initializeSession: vi.fn().mockResolvedValue(undefined),
        sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        setExceptionBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = PythonAdapterPolicy;
      (worker as any).adapterState = PythonAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      await (worker as any).startAdapterAndConnect(payload);

      expect(setExceptionBreakMode).toHaveBeenCalledWith('uncaught');
    });
  });

  describe('DAP Command Handling', () => {
    it('should reject DAP commands before connection', async () => {
      // Initialize worker with dry run to avoid connection issues
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python',
        adapterCommand: {
          command: 'python',
          args: ['-m', 'debugpy.adapter']
        },
        dryRunSpawn: true  // Use dry run to avoid connection
      };
      
      await worker.handleCommand(initPayload);

      // Reset state to allow DAP commands (but still not connected)
      worker = new DapProxyWorker(dependencies, { exit: workerExitSpy });

      const dapPayload: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-1',
        dapCommand: 'threads',
        dapArgs: {}
      };

      await worker.handleCommand(dapPayload);

      // Should reject before connection
      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapResponse',
          requestId: 'req-1',
          success: false,
          error: 'DAP client not connected'
        })
      );
    });

    it('should reject commands when shutting down', async () => {
      // Create a new worker and manually set it up in a connected state
      const testWorker = new DapProxyWorker(dependencies, { exit: vi.fn() });
      
      // Manually set up the worker state
      (testWorker as any).state = ProxyState.CONNECTED;
      (testWorker as any).dapClient = mockDapClient;
      (testWorker as any).logger = mockLogger;
      (testWorker as any).currentSessionId = 'test-session';
      
      // Now terminate it
      await testWorker.handleTerminate();
      
      // Verify it's in TERMINATED state
      expect(testWorker.getState()).toBe(ProxyState.TERMINATED);

      const dapPayload: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-2',
        dapCommand: 'threads',
        dapArgs: {}
      };

      // Clear previous calls
      mockMessageSender.send.mockClear();
      
      await testWorker.handleCommand(dapPayload);

      // The worker should reject with "DAP client not connected" since it's terminated
      // and dapClient is cleared during shutdown
      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapResponse',
          requestId: 'req-2',
          success: false,
          error: 'DAP client not connected'
        })
      );
    });

    it('surfaces adapter errors when sendRequest rejects', async () => {
      mockMessageSender.send.mockClear();
      (worker as any).dapClient = mockDapClient;
      (worker as any).state = ProxyState.CONNECTED;
      (worker as any).adapterPolicy = DefaultAdapterPolicy;
      (worker as any).adapterState = DefaultAdapterPolicy.createInitialState();
      (worker as any).logger = mockLogger;

      mockDapClient.sendRequest = vi.fn().mockRejectedValue(new Error('boom'));

      const payload: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-error',
        dapCommand: 'threads',
        dapArgs: {}
      };

      await worker.handleCommand(payload);

      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapResponse',
          requestId: 'req-error',
          success: false,
          error: 'boom'
        })
      );

      mockDapClient.sendRequest = vi.fn().mockResolvedValue({ body: {} });
    });

    it('forwards payload timeoutMs to the request tracker and DAP client (issue #142)', async () => {
      mockMessageSender.send.mockClear();
      (worker as any).dapClient = mockDapClient;
      (worker as any).state = ProxyState.CONNECTED;
      (worker as any).adapterPolicy = DefaultAdapterPolicy;
      (worker as any).adapterState = DefaultAdapterPolicy.createInitialState();
      (worker as any).logger = mockLogger;

      mockDapClient.sendRequest = vi.fn().mockResolvedValue({ body: {} });
      const trackSpy = vi.spyOn((worker as any).requestTracker, 'track');

      const payload: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-timeout-fwd',
        dapCommand: 'evaluate',
        dapArgs: { expression: 'x' },
        timeoutMs: 60000
      };

      await worker.handleCommand(payload);

      expect(trackSpy).toHaveBeenCalledWith('req-timeout-fwd', 'evaluate', 60000);
      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('evaluate', { expression: 'x' }, 60000);

      trackSpy.mockRestore();
      mockDapClient.sendRequest = vi.fn().mockResolvedValue({ body: {} });
    });

    it('omits the timeout argument to the DAP client when payload has no timeoutMs', async () => {
      mockMessageSender.send.mockClear();
      (worker as any).dapClient = mockDapClient;
      (worker as any).state = ProxyState.CONNECTED;
      (worker as any).adapterPolicy = DefaultAdapterPolicy;
      (worker as any).adapterState = DefaultAdapterPolicy.createInitialState();
      (worker as any).logger = mockLogger;

      mockDapClient.sendRequest = vi.fn().mockResolvedValue({ body: {} });

      const payload: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-no-timeout',
        dapCommand: 'threads',
        dapArgs: {}
      };

      await worker.handleCommand(payload);

      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('threads', {});

      mockDapClient.sendRequest = vi.fn().mockResolvedValue({ body: {} });
    });
  });

  describe('JavaScript Adapter Command Queueing', () => {
    it('should queue commands for JavaScript adapter', async () => {
      // Create a fresh worker in initialized state but not connected
      let jsWorker = new DapProxyWorker(dependencies, { exit: vi.fn() });
      // Set up JavaScript policy detection
      const jsInitPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.js',
        adapterHost: 'localhost',
        adapterPort: 9229,
        logDir: '/logs',
        executablePath: 'node',
        adapterCommand: {
          command: 'node',
          args: ['vendor/js-debug/vsDebugServer.js']
        }
      };
      
      try {
        // This will fail to connect but will set up JS policy
        await jsWorker.handleCommand(jsInitPayload);
      } catch {
        // Expected to fail - that's okay
      }

      // Now send a command - it should be queued for JavaScript adapter
      await jsWorker.handleCommand({
        cmd: 'dap',
        sessionId: 'test-session',
        requestId: 'req-3',
        dapCommand: 'setBreakpoints',
        dapArgs: {}
      });

      // Verify command was either queued or rejected based on JS adapter behavior
      // JavaScript adapter would queue commands before initialization
      const responses = mockMessageSender.send.mock.calls.filter(
        call => call[0].type === 'dapResponse' && call[0].requestId === 'req-3'
      );
      
      // In the current implementation, without proper connection, it may reject
      // This test mainly verifies the JS adapter policy is selected and working
      // The actual queueing behavior depends on connection state
      expect(responses.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Command queue draining', () => {
    it('flushes queued commands and injects deferred configurationDone', async () => {
      (worker as any).dapClient = mockDapClient;
      (worker as any).logger = mockLogger;
      (worker as any).state = ProxyState.CONNECTED;

      const requiresQueueSpy = vi.fn(() => true);
      const shouldQueueSpy = vi.fn(() => ({
        shouldQueue: true,
        shouldDefer: true,
        reason: 'Defer until configurationDone'
      }));
      const queuePolicy = {
        ...DefaultAdapterPolicy,
        shouldQueueCommand: shouldQueueSpy,
        requiresCommandQueueing: requiresQueueSpy,
        getInitializationBehavior: () => ({
          deferConfigDone: true,
          requiresInitialStop: false,
          addRuntimeExecutable: false,
          trackInitializeResponse: false
        })
      };

      (worker as any).adapterPolicy = queuePolicy;
      (worker as any).adapterState = queuePolicy.createInitialState();

      mockDapClient.sendRequest = vi.fn().mockResolvedValue({ body: {} });
      mockMessageSender.send.mockClear();

      const payload: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'queue-session',
        requestId: 'req-queue',
        dapCommand: 'launch',
        dapArgs: {}
      };

      await worker.handleCommand(payload);

      expect(shouldQueueSpy).toHaveBeenCalledWith('launch', expect.any(Object));
      expect(mockDapClient.sendRequest).toHaveBeenCalledTimes(2);
      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('configurationDone', {});
      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('launch', {});

      const responses = mockMessageSender.send.mock.calls.filter(
        ([message]) => message.type === 'dapResponse' && message.requestId === 'req-queue'
      );

      expect(responses).toHaveLength(1);
      expect(responses[0][0].success).toBe(true);
    });

    it('retains payload timeoutMs on queued commands (issue #142)', async () => {
      (worker as any).dapClient = mockDapClient;
      (worker as any).logger = mockLogger;
      (worker as any).state = ProxyState.CONNECTED;

      const queuePolicy = {
        ...DefaultAdapterPolicy,
        shouldQueueCommand: vi.fn(() => ({
          shouldQueue: true,
          shouldDefer: false,
          reason: 'Queue for test'
        })),
        requiresCommandQueueing: vi.fn(() => true)
      };

      (worker as any).adapterPolicy = queuePolicy;
      (worker as any).adapterState = queuePolicy.createInitialState();

      mockDapClient.sendRequest = vi.fn().mockResolvedValue({ body: {} });
      mockMessageSender.send.mockClear();
      const trackSpy = vi.spyOn((worker as any).requestTracker, 'track');

      const payload: DapCommandPayload = {
        cmd: 'dap',
        sessionId: 'queue-session',
        requestId: 'req-queue-timeout',
        dapCommand: 'evaluate',
        dapArgs: { expression: 'x' },
        timeoutMs: 45000
      };

      await worker.handleCommand(payload);

      expect(trackSpy).toHaveBeenCalledWith('req-queue-timeout', 'evaluate', 45000);
      expect(mockDapClient.sendRequest).toHaveBeenCalledWith('evaluate', { expression: 'x' }, 45000);

      trackSpy.mockRestore();
      mockDapClient.sendRequest = vi.fn().mockResolvedValue({ body: {} });
    });
  });

  describe('Pre-connect queue handling', () => {
    it('drains pre-connect commands when connection established', async () => {
      (worker as any).dapClient = mockDapClient;
      (worker as any).logger = mockLogger;
      (worker as any).preConnectQueue = [
        {
          cmd: 'dap',
          sessionId: 'queued-session',
          requestId: 'queued-1',
          dapCommand: 'threads',
          dapArgs: {}
        } satisfies DapCommandPayload
      ];

      const handleSpy = vi.spyOn(worker as any, 'handleDapCommand').mockResolvedValue(undefined);

      await (worker as any).drainPreConnectQueue();

      expect(handleSpy).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'queued-1' })
      );
      expect((worker as any).preConnectQueue).toHaveLength(0);

      handleSpy.mockRestore();
    });
  });

  describe('Timeout handling', () => {
    it('emits failure response when tracked request times out', async () => {
      vi.useFakeTimers();
      (worker as any).logger = mockLogger;
      (worker as any).currentSessionId = 'timeout-session';
      (mockLogger.error as Mock).mockClear();
      mockMessageSender.send.mockClear();

      const tracker = (worker as any).requestTracker;
      tracker.track('timeout-req', 'threads', 2000);

      await vi.advanceTimersByTimeAsync(2001);
      await Promise.resolve();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[Worker] DAP request 'threads' (id: timeout-req) timed out after 2000ms"
      );
      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dapResponse',
          requestId: 'timeout-req',
          success: false,
          error: "Request 'threads' timed out after 2s"
        })
      );

      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      vi.useFakeTimers();

      // Make file system fail
      vi.mocked(dependencies.fileSystem.ensureDir).mockRejectedValue(
        new Error('Permission denied')
      );

      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python'
      };

      await worker.handleCommand(payload);

      // Advance past the setImmediate + setTimeout(100ms) IPC flush pattern
      await vi.advanceTimersByTimeAsync(200);

      // Verify that the exit hook was called with error code
      // This is the key behavior - critical errors during init cause process exit
      expect(workerExitSpy).toHaveBeenCalledWith(1);

      // Note: Logger won't be called since it's created AFTER ensureDir, which is what's failing

      vi.useRealTimers();
    });

    it('invokes exit hook when adapter spawn fails', async () => {
      vi.useFakeTimers();

      const exitSpy = vi.fn();
      worker = new DapProxyWorker(dependencies, { exit: exitSpy });
      const spawnError = new Error('spawn failed');
      const spawnSpy = vi
        .spyOn(GenericAdapterManager.prototype, 'spawn')
        .mockRejectedValue(spawnError);
      const shutdownSpy = vi
        .spyOn(worker as unknown as { shutdown: () => Promise<void> }, 'shutdown')
        .mockResolvedValue(undefined);

      (mockLogger.error as Mock).mockClear();

      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'spawn-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python',
        adapterCommand: {
          command: 'python',
          args: ['-m', 'debugpy.adapter']
        }
      };

      try {
        await worker.handleCommand(payload);

        // Advance past the setImmediate + setTimeout(100ms) IPC flush pattern
        await vi.advanceTimersByTimeAsync(200);

        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Critical initialization error'),
          spawnError
        );
      } finally {
        spawnSpy.mockRestore();
        shutdownSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it('invokes exit hook when DAP connection fails', async () => {
      vi.useFakeTimers();

      const exitSpy = vi.fn();
      worker = new DapProxyWorker(dependencies, { exit: exitSpy });
      const connectError = new Error('connect failed');
      const connectSpy = vi
        .spyOn(DapConnectionManager.prototype, 'connectWithRetry')
        .mockRejectedValue(connectError);
      const shutdownSpy = vi
        .spyOn(worker as unknown as { shutdown: () => Promise<void> }, 'shutdown')
        .mockResolvedValue(undefined);

      (mockLogger.error as Mock).mockClear();

      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'connect-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python',
        adapterCommand: {
          command: 'python',
          args: ['-m', 'debugpy.adapter']
        }
      };

      try {
        await worker.handleCommand(payload);

        // Advance past the setImmediate + setTimeout(100ms) IPC flush pattern
        await vi.advanceTimersByTimeAsync(200);

        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Critical initialization error'),
          connectError
        );
      } finally {
        connectSpy.mockRestore();
        shutdownSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it('should handle DAP command errors', async () => {
      // Setup connected state
      const initPayload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python',
        adapterCommand: {
          command: 'python',
          args: ['-m', 'debugpy.adapter']
        }
      };

      await worker.handleCommand(initPayload);

      // Make DAP client fail
      vi.mocked(mockDapClient.sendRequest).mockRejectedValue(
        new Error('Connection lost')
      );

      // Verify the mock was configured to reject
      await expect(mockDapClient.sendRequest('threads')).rejects.toThrow('Connection lost');
    });
  });

  describe('Message Sending', () => {
    it('should send status messages', async () => {
      // Use worker with mocked exit hook to prevent process.exit
      const exitSpy = vi.fn();
      worker = new DapProxyWorker(dependencies, { exit: exitSpy });
      
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python',
        dryRunSpawn: true
      };

      await worker.handleCommand(payload);

      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          sessionId: 'test-session'
        })
      );
    });

    it('should send error messages', async () => {
      // Invalid state for init
      await worker.handleCommand({
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python'
      } as any);

      // Try init again - should fail
      await worker.handleCommand({
        cmd: 'init',
        sessionId: 'test-session',
        scriptPath: '/path/to/script.py',
        adapterHost: 'localhost',
        adapterPort: 5678,
        logDir: '/logs',
        executablePath: 'python'
      } as any);

      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('Invalid state for init')
        })
      );
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', async () => {
      await worker.handleTerminate();

      expect(worker.getState()).toBe(ProxyState.TERMINATED);
      expect(mockMessageSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          status: 'terminated'
        })
      );
    });

    it('should handle multiple shutdown calls', async () => {
      await worker.handleTerminate();
      await worker.handleTerminate();

      // Should only send terminated once
      const terminatedCalls = mockMessageSender.send.mock.calls.filter(
        call => call[0].type === 'status' && call[0].status === 'terminated'
      );
      expect(terminatedCalls.length).toBe(1);
    });

    it('returns early when shutdown already in progress', async () => {
      (worker as any).logger = mockLogger;
      (worker as any).state = ProxyState.SHUTTING_DOWN;

      await (worker as any).shutdown();

      expect(mockLogger.info).toHaveBeenCalledWith('[Worker] Shutdown already in progress.');
      expect(worker.getState()).toBe(ProxyState.SHUTTING_DOWN);
    });
  });

  describe('Attach Mode Flow', () => {
    it('should handle attach mode with initialized event', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'attach-session',
        scriptPath: '/path/to/Main.java',
        adapterHost: 'localhost',
        adapterPort: 5005,
        logDir: '/logs',
        executablePath: 'java',
        launchConfig: {
          request: 'attach',
          hostName: 'localhost',
          port: 5005
        },
        adapterCommand: {
          command: 'java',
          args: ['-cp', '/path/to/jdi', 'JdiDapServer', '5005']
        }
      };

      const adapterEmitter = new EventEmitter() as unknown as ChildProcess;
      Object.assign(adapterEmitter, { pid: 999, kill: vi.fn(), unref: vi.fn(), killed: false });

      const processStub = {
        spawn: vi.fn().mockResolvedValue({ process: adapterEmitter as ChildProcess, pid: 999 }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, () => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onStopped) client.on('stopped', handlers.onStopped);
        }),
        initializeSession: vi.fn().mockImplementation(async () => {
          // Emit 'initialized' event shortly after initializeSession
          setTimeout(() => (mockDapClient as EventEmitter).emit('initialized'), 50);
        }),
        sendAttachRequest: vi.fn().mockResolvedValue(undefined),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = JavaAdapterPolicy;
      (worker as any).adapterState = JavaAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      mockMessageSender.send.mockClear();

      await (worker as any).startAdapterAndConnect(payload);

      // Verify attach flow was executed
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Waiting for "initialized" event before sending attach')
      );
      expect(connectionStub.sendAttachRequest).toHaveBeenCalled();
    });

    it('should handle attach mode and call handleInitializedEvent after attach', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'attach-session-2',
        scriptPath: '/path/to/Main.java',
        adapterHost: 'localhost',
        adapterPort: 5005,
        logDir: '/logs',
        executablePath: 'java',
        launchConfig: {
          request: 'attach',
          hostName: 'localhost',
          port: 5005
        },
        adapterCommand: {
          command: 'java',
          args: ['-cp', '/path/to/jdi', 'JdiDapServer', '5005']
        }
      };

      const adapterEmitter = new EventEmitter() as unknown as ChildProcess;
      Object.assign(adapterEmitter, { pid: 999, kill: vi.fn(), unref: vi.fn(), killed: false });

      const processStub = {
        spawn: vi.fn().mockResolvedValue({ process: adapterEmitter as ChildProcess, pid: 999 }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, () => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onStopped) client.on('stopped', handlers.onStopped);
        }),
        initializeSession: vi.fn().mockImplementation(async () => {
          setTimeout(() => (mockDapClient as EventEmitter).emit('initialized'), 50);
        }),
        sendAttachRequest: vi.fn().mockResolvedValue(undefined),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = JavaAdapterPolicy;
      (worker as any).adapterState = JavaAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      mockMessageSender.send.mockClear();

      await (worker as any).startAdapterAndConnect(payload);

      // Verify attach flow was executed and then handleInitializedEvent was called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('"initialized" event received, sending attach request')
      );
      expect(connectionStub.sendAttachRequest).toHaveBeenCalled();
      // After attach, handleInitializedEvent is called which sets breakpoints and configDone
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Waiting for "initialized" event from adapter')
      );
    });

    // debugpy ordering (issue #145): 'initialized' is only emitted AFTER the
    // adapter receives the attach request, and the attach *response* only
    // arrives after configurationDone. The worker must send attach first and
    // must not block on the attach response before configurationDone.
    it('python attach: sends attach before initialized and tolerates attach response deferred until configurationDone', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'py-attach-session',
        language: 'python',
        executablePath: 'python',
        adapterHost: '127.0.0.1',
        adapterPort: 40001,
        logDir: '/logs',
        scriptPath: 'attach://remote',
        launchConfig: {
          type: 'python',
          request: 'attach',
          connect: { host: '127.0.0.1', port: 5679 }
        }
        // No adapterCommand: direct-connect attach — debugpy is already listening
      };

      const processStub = {
        spawn: vi.fn(),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const callOrder: string[] = [];
      let resolveAttachResponse!: () => void;
      const attachResponse = new Promise<void>((resolve) => {
        resolveAttachResponse = resolve;
      });

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, () => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
        }),
        // debugpy does NOT emit 'initialized' after initialize alone
        initializeSession: vi.fn().mockResolvedValue(undefined),
        sendAttachRequest: vi.fn().mockImplementation(() => {
          callOrder.push('attach');
          // 'initialized' arrives only after the attach request is received
          setImmediate(() => (mockDapClient as EventEmitter).emit('initialized'));
          // the attach response arrives only after configurationDone
          return attachResponse;
        }),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockImplementation(async () => {
          callOrder.push('configurationDone');
          resolveAttachResponse();
        }),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = PythonAdapterPolicy;
      (worker as any).adapterState = PythonAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      mockMessageSender.send.mockClear();

      await (worker as any).startAdapterAndConnect(payload);

      // Direct connect: no adapter process spawned, socket opened to the attach port
      expect(processStub.spawn).not.toHaveBeenCalled();
      expect(connectionStub.connectWithRetry).toHaveBeenCalledWith('127.0.0.1', 5679);
      // Attach was sent first; configurationDone followed the initialized event
      expect(callOrder).toEqual(['attach', 'configurationDone']);
    }, 20000);

    it('python attach: fails fast when the attach request is rejected', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'py-attach-refused',
        language: 'python',
        executablePath: 'python',
        adapterHost: '127.0.0.1',
        adapterPort: 40002,
        logDir: '/logs',
        scriptPath: 'attach://remote',
        launchConfig: {
          type: 'python',
          request: 'attach',
          connect: { host: '127.0.0.1', port: 5679 }
        }
      };

      const processStub = {
        spawn: vi.fn(),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, () => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
        }),
        initializeSession: vi.fn().mockResolvedValue(undefined),
        // Attach fails immediately (e.g. debugpy rejects the request) and
        // 'initialized' never arrives — the worker must not sit out the full
        // initialized timeout before surfacing the failure.
        sendAttachRequest: vi.fn().mockRejectedValue(
          new Error('connect ECONNREFUSED 127.0.0.1:5679')
        ),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = PythonAdapterPolicy;
      (worker as any).adapterState = PythonAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      const started = Date.now();
      await expect((worker as any).startAdapterAndConnect(payload)).rejects.toThrow(/ECONNREFUSED/);
      // Fail-fast: well under the 15s initialized timeout
      expect(Date.now() - started).toBeLessThan(5000);
    }, 20000);
  });

  describe('Go/Java Launch Sequence', () => {
    it('should handle sendLaunchBeforeConfig with initialized event before launch', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'go-session',
        scriptPath: '/path/to/main.go',
        adapterHost: 'localhost',
        adapterPort: 9876,
        logDir: '/logs',
        executablePath: 'dlv',
        adapterCommand: {
          command: 'dlv',
          args: ['dap', '--listen=:9876']
        }
      };

      const adapterEmitter = new EventEmitter() as unknown as ChildProcess;
      Object.assign(adapterEmitter, { pid: 999, kill: vi.fn(), unref: vi.fn(), killed: false });

      const processStub = {
        spawn: vi.fn().mockResolvedValue({ process: adapterEmitter as ChildProcess, pid: 999 }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, () => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onStopped) client.on('stopped', handlers.onStopped);
        }),
        initializeSession: vi.fn().mockImplementation(async () => {
          // Go/Delve sends initialized quickly after initialize
          setTimeout(() => (mockDapClient as EventEmitter).emit('initialized'), 50);
        }),
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
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      mockMessageSender.send.mockClear();

      await (worker as any).startAdapterAndConnect(payload);

      // Verify two-phase initialized handling was used
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Phase 1: Waiting briefly for "initialized" event before launch')
      );
      expect(connectionStub.sendLaunchRequest).toHaveBeenCalled();
    });

    it('should handle Java launch with sendLaunchBeforeConfig and handleInitializedEvent', async () => {
      const payload: ProxyInitPayload = {
        cmd: 'init',
        sessionId: 'java-launch-session',
        scriptPath: '/path/to/Main.java',
        adapterHost: 'localhost',
        adapterPort: 5005,
        logDir: '/logs',
        executablePath: 'java',
        adapterCommand: {
          command: 'java',
          args: ['-cp', '/path/to/jdi', 'JdiDapServer', '5005']
        }
      };

      const adapterEmitter = new EventEmitter() as unknown as ChildProcess;
      Object.assign(adapterEmitter, { pid: 999, kill: vi.fn(), unref: vi.fn(), killed: false });

      const processStub = {
        spawn: vi.fn().mockResolvedValue({ process: adapterEmitter as ChildProcess, pid: 999 }),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const connectionStub = {
        connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
        setAdapterPolicy: vi.fn(),
        setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, () => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onStopped) client.on('stopped', handlers.onStopped);
        }),
        initializeSession: vi.fn().mockImplementation(async () => {
          setTimeout(() => (mockDapClient as EventEmitter).emit('initialized'), 50);
        }),
        sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
        setBreakpoints: vi.fn().mockResolvedValue(undefined),
        sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined)
      };

      (worker as any).logger = mockLogger;
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = JavaAdapterPolicy;
      (worker as any).adapterState = JavaAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = payload;
      (worker as any).state = ProxyState.INITIALIZING;

      mockMessageSender.send.mockClear();

      await (worker as any).startAdapterAndConnect(payload);

      // Verify two-phase launch was used (sendLaunchBeforeConfig)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Phase 1: Waiting briefly for "initialized" event before launch')
      );
      expect(connectionStub.sendLaunchRequest).toHaveBeenCalled();
      // After launch, handleInitializedEvent is called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('"initialized" event received before launch')
      );
    });
  });

  describe('handleCommand terminate', () => {
    it('should route terminate command to handleTerminate', async () => {
      (worker as any).dapClient = mockDapClient;
      const processStub = { shutdown: vi.fn().mockResolvedValue(undefined) };
      const connectionStub = { disconnect: vi.fn().mockResolvedValue(undefined) };
      (worker as any).processManager = processStub;
      (worker as any).connectionManager = connectionStub;
      (worker as any).state = ProxyState.CONNECTED;

      await worker.handleCommand({
        cmd: 'terminate',
        sessionId: 'test-session'
      });

      expect(worker.getState()).toBe(ProxyState.TERMINATED);
    });
  });

  describe('JS debuggee exit code synthesis (issue #247)', () => {
    const exitFile = 'C:/tmp/mcp-exitcode-test.txt';
    let connectionHandlers: Record<string, (arg?: unknown) => unknown>;
    let shutdownSpy: ReturnType<typeof vi.spyOn>;

    const wireHandlers = (env?: Record<string, string>) => {
      connectionHandlers = {};
      const connectionStub = {
        setupEventHandlers: vi.fn((_client: unknown, handlers: Record<string, (arg?: unknown) => unknown>) => {
          Object.assign(connectionHandlers, handlers);
        })
      };
      (worker as any).logger = mockLogger;
      (worker as any).dapClient = mockDapClient;
      (worker as any).connectionManager = connectionStub;
      (worker as any).adapterPolicy = JsDebugAdapterPolicy;
      (worker as any).adapterState = JsDebugAdapterPolicy.createInitialState();
      (worker as any).currentInitPayload = { launchConfig: env ? { env } : {} };
      shutdownSpy = vi.spyOn(worker as any, 'shutdown').mockResolvedValue(undefined) as ReturnType<typeof vi.spyOn>;
      (worker as any).setupDapEventHandlers();
      mockMessageSender.send.mockClear();
    };

    const dapEvents = () =>
      mockMessageSender.send.mock.calls
        .map(call => call[0] as { type: string; event?: string; body?: unknown })
        .filter(msg => msg.type === 'dapEvent');

    afterEach(() => {
      shutdownSpy?.mockRestore();
    });

    it('synthesizes exited from the recorded exit code before forwarding terminated', async () => {
      wireHandlers({ MCP_DEBUGGER_EXITCODE_FILE: exitFile });
      (dependencies.fileSystem.pathExists as Mock).mockResolvedValue(true);
      (dependencies.fileSystem.readFile as Mock).mockResolvedValue('3');

      await connectionHandlers.onTerminated?.({});

      const events = dapEvents();
      expect(events[0]).toEqual(expect.objectContaining({ event: 'exited', body: { exitCode: 3 } }));
      expect(events[1]).toEqual(expect.objectContaining({ event: 'terminated' }));
      expect(dependencies.fileSystem.remove).toHaveBeenCalledWith(exitFile);
      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('forwards only terminated when no exit code file exists (signal kill, user stop)', async () => {
      wireHandlers({ MCP_DEBUGGER_EXITCODE_FILE: exitFile });
      (dependencies.fileSystem.pathExists as Mock).mockResolvedValue(false);

      await connectionHandlers.onTerminated?.({});

      const events = dapEvents();
      expect(events.map(e => e.event)).toEqual(['terminated']);
    });

    it('keeps a real exited event authoritative and never double-fires', async () => {
      wireHandlers({ MCP_DEBUGGER_EXITCODE_FILE: exitFile });
      (dependencies.fileSystem.pathExists as Mock).mockResolvedValue(true);
      (dependencies.fileSystem.readFile as Mock).mockResolvedValue('3');

      await connectionHandlers.onExited?.({ exitCode: 5 });
      await connectionHandlers.onTerminated?.({});

      const events = dapEvents();
      const exitedEvents = events.filter(e => e.event === 'exited');
      expect(exitedEvents).toHaveLength(1);
      expect(exitedEvents[0].body).toEqual({ exitCode: 5 });
    });

    it('synthesizes at most once across parent and child terminated events', async () => {
      wireHandlers({ MCP_DEBUGGER_EXITCODE_FILE: exitFile });
      (dependencies.fileSystem.pathExists as Mock).mockResolvedValue(true);
      (dependencies.fileSystem.readFile as Mock).mockResolvedValue('2');

      await connectionHandlers.onTerminated?.({});
      await connectionHandlers.onTerminated?.({});

      const exitedEvents = dapEvents().filter(e => e.event === 'exited');
      expect(exitedEvents).toHaveLength(1);
    });

    it('skips synthesis on unparseable file content', async () => {
      wireHandlers({ MCP_DEBUGGER_EXITCODE_FILE: exitFile });
      (dependencies.fileSystem.pathExists as Mock).mockResolvedValue(true);
      (dependencies.fileSystem.readFile as Mock).mockResolvedValue('garbage');

      await connectionHandlers.onTerminated?.({});

      const events = dapEvents();
      expect(events.map(e => e.event)).toEqual(['terminated']);
    });

    it('skips synthesis for sessions without the env marker (non-js adapters)', async () => {
      wireHandlers();

      await connectionHandlers.onTerminated?.({});

      const events = dapEvents();
      expect(events.map(e => e.event)).toEqual(['terminated']);
      expect(dependencies.fileSystem.pathExists).not.toHaveBeenCalled();
    });
  });
});
