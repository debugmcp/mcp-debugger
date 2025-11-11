import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ProxyManager } from '../../../src/proxy/proxy-manager.js';
import { createInitialState } from '../../../src/dap-core/index.js';
import * as dapCore from '../../../src/dap-core/index.js';
import {
  DebugLanguage,
  type IDebugAdapter,
  type IFileSystem,
  type ILogger,
  type IProxyProcess,
  type IProxyProcessLauncher,
  type AdapterLaunchBarrier
} from '@debugmcp/shared';

class StubProxyProcess extends EventEmitter implements IProxyProcess {
  pid = 9999;
  stdin: NodeJS.WritableStream | null = null;
  stdout: NodeJS.ReadableStream | null = null;
  stderr: NodeJS.ReadableStream | null = new EventEmitter() as unknown as NodeJS.ReadableStream;
  killed = false;
  exitCode: number | null = null;
  signalCode: string | null = null;
  sessionId = 'session-1';

  send = vi.fn().mockReturnValue(true);
  sendCommand = vi.fn();
  kill = vi.fn().mockReturnValue(true);
  waitForInitialization = vi.fn().mockResolvedValue(undefined);
}

describe('ProxyManager branch coverage scenarios', () => {
  let logger: ILogger;
  let fileSystem: IFileSystem;
  let launcher: IProxyProcessLauncher;
  let manager: ProxyManager;
  let proxyProcess: StubProxyProcess;

  beforeEach(() => {
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };
    fileSystem = {
      pathExists: vi.fn().mockResolvedValue(true)
    } as unknown as IFileSystem;
    launcher = {
      launchProxy: vi.fn()
    } as unknown as IProxyProcessLauncher;

    manager = new ProxyManager(null, launcher, fileSystem, logger);
    proxyProcess = new StubProxyProcess();

    (manager as unknown as { sessionId: string | null }).sessionId = 'session-1';
    (manager as unknown as { proxyProcess: IProxyProcess | null }).proxyProcess = proxyProcess;
    (manager as unknown as { isInitialized: boolean }).isInitialized = true;
    (manager as unknown as { dapState: ReturnType<typeof createInitialState> | null }).dapState =
      createInitialState('session-1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes killProcess commands emitted by the functional core', () => {
    vi.spyOn(dapCore, 'handleProxyMessage').mockReturnValue({
      newState: (manager as unknown as { dapState: ReturnType<typeof createInitialState> }).dapState,
      commands: [{ type: 'killProcess' }]
    });

    (manager as unknown as { handleProxyMessage: (msg: unknown) => void }).handleProxyMessage({
      type: 'status',
      sessionId: 'session-1',
      status: 'init_received'
    });

    expect(proxyProcess.kill).toHaveBeenCalledTimes(1);
  });

  it('routes sendToProxy commands back through sendCommand', () => {
    const sendCommandSpy = vi.spyOn(manager as unknown as { sendCommand: (cmd: object) => void }, 'sendCommand');
    vi.spyOn(dapCore, 'handleProxyMessage').mockReturnValue({
      newState: (manager as unknown as { dapState: ReturnType<typeof createInitialState> }).dapState,
      commands: [{ type: 'sendToProxy', command: { cmd: 'ping' } }]
    });

    (manager as unknown as { handleProxyMessage: (msg: unknown) => void }).handleProxyMessage({
      type: 'status',
      sessionId: 'session-1',
      status: 'init_received'
    });

    expect(sendCommandSpy).toHaveBeenCalledWith({ cmd: 'ping' });
  });

  it('logs an error when DAP state is missing while processing messages', () => {
    (manager as unknown as { dapState: ReturnType<typeof createInitialState> | null }).dapState = null;

    (manager as unknown as { handleProxyMessage: (msg: unknown) => void }).handleProxyMessage({
      type: 'status',
      sessionId: 'session-1',
      status: 'init_received'
    });

    expect(logger.error).toHaveBeenCalledWith('[ProxyManager] DAP state not initialized');
  });

  it('handles proxy_minimal_ran_ipc_test status by terminating the proxy process', () => {
    (manager as unknown as { handleStatusMessage: (msg: unknown) => void }).handleStatusMessage({
      type: 'status',
      sessionId: 'session-1',
      status: 'proxy_minimal_ran_ipc_test'
    });

    expect(proxyProcess.kill).toHaveBeenCalled();
  });

  it('marks initialized when receiving adapter_connected status', () => {
    (manager as unknown as { isInitialized: boolean }).isInitialized = false;
    const listener = vi.fn();
    manager.on('initialized', listener);

    (manager as unknown as { handleStatusMessage: (msg: unknown) => void }).handleStatusMessage({
      type: 'status',
      sessionId: 'session-1',
      status: 'adapter_connected'
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect((manager as unknown as { isInitialized: boolean }).isInitialized).toBe(true);
  });

  it('does not override dry-run snapshot when status omits data', () => {
    (manager as unknown as { dryRunCommandSnapshot?: string | undefined }).dryRunCommandSnapshot = 'keep-command';
    (manager as unknown as { dryRunScriptPath?: string | undefined }).dryRunScriptPath = 'keep-script';

    (manager as unknown as { handleStatusMessage: (msg: unknown) => void }).handleStatusMessage({
      type: 'status',
      sessionId: 'session-1',
      status: 'dry_run_complete',
      command: '   ',
      script: ''
    });

    expect((manager as unknown as { dryRunCommandSnapshot?: string }).dryRunCommandSnapshot).toBe('keep-command');
    expect((manager as unknown as { dryRunScriptPath?: string }).dryRunScriptPath).toBe('keep-script');
  });

  it('handles stopped events without thread information gracefully', () => {
    let emittedThread: number | undefined;
    let emittedReason: string | undefined;
    manager.on('stopped', (threadId, reason) => {
      emittedThread = threadId;
      emittedReason = reason;
    });

    (manager as unknown as { handleDapEvent: (msg: unknown) => void }).handleDapEvent({
      type: 'dapEvent',
      sessionId: 'session-1',
      event: 'stopped',
      body: {}
    });

    expect(emittedThread).toBeUndefined();
    expect(emittedReason).toBe('unknown');
    expect((manager as unknown as { currentThreadId: number | null }).currentThreadId).toBeNull();
  });

  it('captures thread id from stopped events and forwards reason', () => {
    const barrier: AdapterLaunchBarrier = {
      awaitResponse: true,
      onRequestSent: vi.fn(),
      onProxyStatus: vi.fn(),
      onDapEvent: vi.fn(),
      onProxyExit: vi.fn(),
      waitUntilReady: vi.fn(),
      dispose: vi.fn()
    };
    (manager as unknown as { activeLaunchBarrier: AdapterLaunchBarrier | null }).activeLaunchBarrier = barrier;

    let emittedThread: number | undefined;
    let emittedReason: string | undefined;
    manager.on('stopped', (threadId, reason) => {
      emittedThread = threadId;
      emittedReason = reason;
    });

    (manager as unknown as { handleDapEvent: (msg: unknown) => void }).handleDapEvent({
      type: 'dapEvent',
      sessionId: 'session-1',
      event: 'stopped',
      body: { threadId: 42, reason: 'breakpoint' }
    });

    expect(barrier.onDapEvent).toHaveBeenCalledWith('stopped', { threadId: 42, reason: 'breakpoint' });
    expect(emittedThread).toBe(42);
    expect(emittedReason).toBe('breakpoint');
    expect((manager as unknown as { currentThreadId: number | null }).currentThreadId).toBe(42);
  });

  it('emits continued and default dap events', () => {
    const continuedListener = vi.fn();
    const defaultListener = vi.fn();
    manager.on('continued', continuedListener);
    manager.on('dap-event', defaultListener);

    (manager as unknown as { handleDapEvent: (msg: unknown) => void }).handleDapEvent({
      type: 'dapEvent',
      sessionId: 'session-1',
      event: 'continued'
    });

    (manager as unknown as { handleDapEvent: (msg: unknown) => void }).handleDapEvent({
      type: 'dapEvent',
      sessionId: 'session-1',
      event: 'output',
      body: { category: 'console', output: 'log' }
    });

    expect(continuedListener).toHaveBeenCalledTimes(1);
    expect(defaultListener).toHaveBeenCalledWith('output', { category: 'console', output: 'log' });
  });

  it('resolves await-response launch barriers once dap response arrives', async () => {
    const barrier: AdapterLaunchBarrier = {
      awaitResponse: true,
      onRequestSent: vi.fn(),
      onProxyStatus: vi.fn(),
      onDapEvent: vi.fn(),
      onProxyExit: vi.fn(),
      waitUntilReady: vi.fn(),
      dispose: vi.fn()
    };
    const adapter: IDebugAdapter = {
      language: DebugLanguage.JAVASCRIPT,
      validateEnvironment: vi.fn(),
      resolveExecutablePath: vi.fn(),
      createLaunchBarrier: vi.fn().mockReturnValue(barrier)
    } as unknown as IDebugAdapter;

    manager = new ProxyManager(adapter, launcher, fileSystem, logger);
    proxyProcess = new StubProxyProcess();
    (manager as unknown as { sessionId: string | null }).sessionId = 'session-1';
    (manager as unknown as { proxyProcess: IProxyProcess | null }).proxyProcess = proxyProcess;
    (manager as unknown as { isInitialized: boolean }).isInitialized = true;
    (manager as unknown as { dapState: ReturnType<typeof createInitialState> | null }).dapState =
      createInitialState('session-1');

    let capturedRequestId: string | undefined;
    proxyProcess.sendCommand.mockImplementation((payload: { requestId: string }) => {
      capturedRequestId = payload.requestId;
    });

    const responsePromise = manager.sendDapRequest('initialize');
    expect(capturedRequestId).toBeDefined();
    expect(barrier.onRequestSent).toHaveBeenCalledWith(capturedRequestId);

    (manager as unknown as { handleProxyMessage: (msg: unknown) => void }).handleProxyMessage({
      type: 'dapResponse',
      sessionId: 'session-1',
      requestId: capturedRequestId!,
      success: true,
      response: {
        type: 'response',
        seq: 1,
        request_seq: 1,
        command: 'initialize',
        success: true
      }
    });

    const response = await responsePromise;
    expect(response.command).toBe('initialize');
    expect(barrier.dispose).toHaveBeenCalled();
    expect((manager as unknown as { activeLaunchBarrier: AdapterLaunchBarrier | null }).activeLaunchBarrier).toBeNull();
    expect(barrier.waitUntilReady).not.toHaveBeenCalled();
  });

  it('disposes await-response barrier when sendCommand throws', async () => {
    const barrier: AdapterLaunchBarrier = {
      awaitResponse: true,
      onRequestSent: vi.fn(),
      onProxyStatus: vi.fn(),
      onDapEvent: vi.fn(),
      onProxyExit: vi.fn(),
      waitUntilReady: vi.fn(),
      dispose: vi.fn()
    };
    const adapter: IDebugAdapter = {
      language: DebugLanguage.JAVASCRIPT,
      validateEnvironment: vi.fn(),
      resolveExecutablePath: vi.fn(),
      createLaunchBarrier: vi.fn().mockReturnValue(barrier)
    } as unknown as IDebugAdapter;

    manager = new ProxyManager(adapter, launcher, fileSystem, logger);
    proxyProcess = new StubProxyProcess();
    (manager as unknown as { sessionId: string | null }).sessionId = 'session-err';
    (manager as unknown as { proxyProcess: IProxyProcess | null }).proxyProcess = proxyProcess;
    (manager as unknown as { isInitialized: boolean }).isInitialized = true;
    (manager as unknown as { dapState: ReturnType<typeof createInitialState> | null }).dapState =
      createInitialState('session-err');

    proxyProcess.sendCommand.mockImplementation(() => {
      throw new Error('transport failure');
    });

    await expect(manager.sendDapRequest('launch')).rejects.toThrow('transport failure');
    expect(barrier.dispose).toHaveBeenCalled();
    expect((manager as unknown as { activeLaunchBarrier: AdapterLaunchBarrier | null }).activeLaunchBarrier).toBeNull();
  });

  it('clearActiveLaunchBarrier exits early for mismatched barrier references', () => {
    const activeBarrier: AdapterLaunchBarrier = {
      awaitResponse: true,
      onRequestSent: vi.fn(),
      onProxyStatus: vi.fn(),
      onDapEvent: vi.fn(),
      onProxyExit: vi.fn(),
      waitUntilReady: vi.fn(),
      dispose: vi.fn()
    };
    const differentBarrier: AdapterLaunchBarrier = {
      awaitResponse: true,
      onRequestSent: vi.fn(),
      onProxyStatus: vi.fn(),
      onDapEvent: vi.fn(),
      onProxyExit: vi.fn(),
      waitUntilReady: vi.fn(),
      dispose: vi.fn()
    };
    (manager as unknown as { activeLaunchBarrier: AdapterLaunchBarrier | null }).activeLaunchBarrier = activeBarrier;
    (manager as unknown as { activeLaunchBarrierRequestId: string | null }).activeLaunchBarrierRequestId = 'req-1';

    (manager as unknown as { clearActiveLaunchBarrier: (barrier?: AdapterLaunchBarrier | null) => void }).clearActiveLaunchBarrier(
      differentBarrier
    );

    expect(activeBarrier.dispose).not.toHaveBeenCalled();
    expect((manager as unknown as { activeLaunchBarrier: AdapterLaunchBarrier | null }).activeLaunchBarrier).toBe(
      activeBarrier
    );
  });

  it('clearActiveLaunchBarrier swallows disposal errors and logs a warning', () => {
    const faultyBarrier: AdapterLaunchBarrier = {
      awaitResponse: true,
      onRequestSent: vi.fn(),
      onProxyStatus: vi.fn(),
      onDapEvent: vi.fn(),
      onProxyExit: vi.fn(),
      waitUntilReady: vi.fn(),
      dispose: vi.fn().mockImplementation(() => {
        throw new Error('dispose failure');
      })
    };
    (manager as unknown as { activeLaunchBarrier: AdapterLaunchBarrier | null }).activeLaunchBarrier = faultyBarrier;
    (manager as unknown as { activeLaunchBarrierRequestId: string | null }).activeLaunchBarrierRequestId = 'req-2';

    (manager as unknown as { clearActiveLaunchBarrier: (barrier?: AdapterLaunchBarrier | null) => void }).clearActiveLaunchBarrier();

    expect(logger.warn).toHaveBeenCalledWith('[ProxyManager] Error disposing adapter launch barrier', expect.any(Error));
    expect((manager as unknown as { activeLaunchBarrier: AdapterLaunchBarrier | null }).activeLaunchBarrier).toBeNull();
  });
});
