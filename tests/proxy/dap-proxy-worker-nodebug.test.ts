/**
 * noDebug launch completion (issue #746).
 *
 * A launch that carries `noDebug: true` on an adapter whose policy pins
 * `honoursNoDebug` runs the program with the debugger off. Per DAP such an
 * adapter opens no configuration phase — debugpy and Delve send no
 * `initialized` event — so the worker must not wait for one, and an adapter
 * that opens one anyway but refuses the requests in it (CodeLLDB: "Not
 * supported in noDebug mode") must not take the session down. The
 * configuration phase itself still runs when the adapter opens it: the
 * adapter's own answers are the ground truth, and a stale pin self-corrects.
 */

import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DapProxyWorker } from '../../src/proxy/dap-proxy-worker.js';
import type {
  DapProxyDependencies,
  ILogger,
  ProxyInitPayload,
  StatusMessage,
  ErrorMessage
} from '../../src/proxy/dap-proxy-interfaces.js';
import { ProxyState } from '../../src/proxy/dap-proxy-interfaces.js';
import { GoAdapterPolicy, MockAdapterPolicy, PythonAdapterPolicy } from '@debugmcp/shared';
import type { AdapterPolicy } from '@debugmcp/shared';
import { createMockDapClient } from '../test-utils/mocks/dap-client.js';
import { createMockLogger } from '../test-utils/helpers/test-dependencies.js';
import { createMockMessageSender, createMockWorkerDependencies } from '../test-utils/mocks/dap-proxy-doubles.js';

// --- helpers ---------------------------------------------------------------

/** A python-shaped init payload; `launchConfig` is what the launch request carries. */
function payloadWith(launchConfig: Record<string, unknown> | undefined): ProxyInitPayload {
  return {
    cmd: 'init',
    sessionId: 'nodebug-session',
    executablePath: 'python',
    adapterHost: 'localhost',
    adapterPort: 5678,
    logDir: '/logs',
    scriptPath: '/path/to/script.py',
    scriptArgs: [],
    stopOnEntry: false,
    justMyCode: true,
    initialBreakpoints: [{ id: 'bp-1', file: '/path/to/script.py', line: 5 }],
    breakOnExceptions: 'uncaught',
    launchConfig
  };
}

describe('noDebug launch completion (issue #746)', () => {
  let worker: DapProxyWorker;
  let mockLogger: ILogger;
  let mockDapClient: ReturnType<typeof createMockDapClient>;
  let mockMessageSender: ReturnType<typeof createMockMessageSender>;
  let dependencies: DapProxyDependencies;
  let processStub: { spawn: ReturnType<typeof vi.fn>; shutdown: ReturnType<typeof vi.fn> };
  let connectionStub: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDapClient = createMockDapClient();
    mockMessageSender = createMockMessageSender();
    dependencies = createMockWorkerDependencies(mockLogger, mockDapClient, mockMessageSender);

    worker = new DapProxyWorker(dependencies, { exit: vi.fn() });

    processStub = {
      spawn: vi.fn().mockResolvedValue({
        process: new EventEmitter() as unknown as ChildProcess,
        pid: 4242
      }),
      shutdown: vi.fn().mockResolvedValue(undefined)
    };

    connectionStub = {
      connectWithRetry: vi.fn().mockResolvedValue(mockDapClient),
      setAdapterPolicy: vi.fn(),
      setupEventHandlers: vi.fn(
        (client: EventEmitter, handlers: Record<string, (...args: unknown[]) => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onTerminated) client.on('terminated', handlers.onTerminated);
        }
      ),
      // An adapter that is not debugging never opens a configuration phase:
      // neither the initialize response nor the launch response is followed
      // by `initialized` (debugpy, Delve).
      initializeSession: vi.fn().mockResolvedValue({ supportsConfigurationDoneRequest: true }),
      sendLaunchRequest: vi.fn().mockResolvedValue(undefined),
      setBreakpoints: vi.fn().mockResolvedValue({ body: { breakpoints: [{ verified: false }] } }),
      setExceptionBreakpoints: vi.fn().mockResolvedValue(undefined),
      sendConfigurationDone: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined)
    };
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

  function wire(policy: AdapterPolicy, payload: ProxyInitPayload): void {
    (worker as any).logger = mockLogger;
    (worker as any).processManager = processStub;
    (worker as any).connectionManager = connectionStub;
    (worker as any).adapterPolicy = policy;
    (worker as any).adapterState = policy.createInitialState();
    (worker as any).currentInitPayload = payload;
    (worker as any).state = ProxyState.INITIALIZING;
  }

  const configuredStatuses = () =>
    mockMessageSender.send.mock.calls.filter(
      ([m]) => m.type === 'status' && m.status === 'adapter_configured_and_launched'
    );
  const errorMessages = () =>
    mockMessageSender.send.mock.calls.filter(([m]) => m.type === 'error');

  const settle = () => new Promise((resolve) => setImmediate(resolve));

  describe('where the adapter honours the flag (python: plain launch mode)', () => {
    it('reports configured on the launch response without waiting for an initialized event', async () => {
      const payload = payloadWith({ noDebug: true });
      wire(PythonAdapterPolicy, payload);

      await (worker as any).startAdapterAndConnect(payload);
      await settle();

      expect(connectionStub.sendLaunchRequest).toHaveBeenCalledTimes(1);
      expect(configuredStatuses()).toHaveLength(1);
      expect(worker.getState()).toBe(ProxyState.CONNECTED);
      // No configuration phase was opened, so none was run.
      expect(connectionStub.setBreakpoints).not.toHaveBeenCalled();
      expect(connectionStub.sendConfigurationDone).not.toHaveBeenCalled();
      expect(errorMessages()).toHaveLength(0);
    });

    it('still runs the configuration phase when the adapter opens one, reporting configured once', async () => {
      const payload = payloadWith({ noDebug: true });
      wire(PythonAdapterPolicy, payload);

      await (worker as any).startAdapterAndConnect(payload);
      await settle();
      expect(configuredStatuses()).toHaveLength(1);

      // A late initialized (an adapter build that debugs after all): the
      // adapter's own answers land where they always do.
      mockDapClient.emit('initialized');
      await settle();

      expect(connectionStub.setBreakpoints).toHaveBeenCalledTimes(1);
      expect(connectionStub.sendConfigurationDone).toHaveBeenCalledTimes(1);
      const synced = mockMessageSender.send.mock.calls.find(
        ([m]) => m.type === 'status' && m.status === 'breakpoints_synced'
      );
      expect(synced).toBeDefined();
      expect(configuredStatuses()).toHaveLength(1);
      expect(errorMessages()).toHaveLength(0);
      expect(worker.getState()).toBe(ProxyState.CONNECTED);
    });

    it('survives a refused setBreakpoints, still closes the phase with configurationDone (CodeLLDB)', async () => {
      const payload = payloadWith({ noDebug: true });
      wire(PythonAdapterPolicy, payload);
      connectionStub.setBreakpoints.mockRejectedValue(new Error('Internal debugger error: Not supported in noDebug mode.'));

      // CodeLLDB withholds the launch response until configurationDone, so
      // the phase runs while the launch request is still in flight.
      let resolveLaunch!: () => void;
      connectionStub.sendLaunchRequest.mockImplementation(
        () => new Promise<void>((resolve) => { resolveLaunch = resolve; })
      );
      connectionStub.sendConfigurationDone.mockImplementation(async () => {
        resolveLaunch();
      });

      const connect = (worker as any).startAdapterAndConnect(payload);
      await settle();
      mockDapClient.emit('initialized');
      await settle();
      await connect;
      await settle();

      expect(connectionStub.setBreakpoints).toHaveBeenCalledTimes(1);
      expect(connectionStub.sendConfigurationDone).toHaveBeenCalledTimes(1);
      expect(errorMessages()).toHaveLength(0);
      expect(processStub.shutdown).not.toHaveBeenCalled();
      expect(configuredStatuses()).toHaveLength(1);
      expect(worker.getState()).toBe(ProxyState.CONNECTED);
    });

    it("forwards the adapter's refusal to the parent as an adapter notice, naming the request", async () => {
      const payload = payloadWith({ noDebug: true });
      wire(PythonAdapterPolicy, payload);
      connectionStub.setBreakpoints.mockRejectedValue(new Error('Internal debugger error: Not supported in noDebug mode.'));

      await (worker as any).startAdapterAndConnect(payload);
      mockDapClient.emit('initialized');
      await settle();
      await settle();

      const notices = mockMessageSender.send.mock.calls.filter(
        ([m]) => m.type === 'status' && m.status === 'adapter_notice'
      );
      expect(notices).toHaveLength(1);
      expect((notices[0][0] as StatusMessage & { note?: string }).note).toBe(
        'setBreakpoints refused under noDebug: Internal debugger error: Not supported in noDebug mode.'
      );
    });

    it('does not flip a session that is already shutting down back to CONNECTED', async () => {
      const payload = payloadWith({ noDebug: true });
      wire(PythonAdapterPolicy, payload);
      // The adapter went away while setBreakpoints was pending: shutdown
      // rejects the request, and the catch must not resurrect the session.
      connectionStub.setBreakpoints.mockImplementation(async () => {
        (worker as any).state = ProxyState.SHUTTING_DOWN;
        throw new Error('worker shutdown');
      });

      // The phase runs before the launch response here, so the early report
      // has not happened yet when the refusal lands.
      let resolveLaunch!: () => void;
      connectionStub.sendLaunchRequest.mockImplementation(
        () => new Promise<void>((resolve) => { resolveLaunch = resolve; })
      );
      const connect = (worker as any).startAdapterAndConnect(payload);
      await settle();
      mockDapClient.emit('initialized');
      await settle();
      await settle();

      expect(configuredStatuses()).toHaveLength(0);
      expect(worker.getState()).toBe(ProxyState.SHUTTING_DOWN);
      resolveLaunch();
      await connect;
      expect(configuredStatuses()).toHaveLength(0);
    });

    it('survives a refused configurationDone as well', async () => {
      const payload = payloadWith({ noDebug: true });
      wire(PythonAdapterPolicy, payload);
      connectionStub.setBreakpoints.mockRejectedValue(new Error('Not supported in noDebug mode.'));
      connectionStub.sendConfigurationDone.mockRejectedValue(new Error('Not supported in noDebug mode.'));

      await (worker as any).startAdapterAndConnect(payload);
      mockDapClient.emit('initialized');
      await settle();
      await settle();

      expect(connectionStub.sendConfigurationDone).toHaveBeenCalledTimes(1);
      expect(errorMessages()).toHaveLength(0);
      expect(processStub.shutdown).not.toHaveBeenCalled();
      expect(configuredStatuses()).toHaveLength(1);
      expect(worker.getState()).toBe(ProxyState.CONNECTED);
    });

    it("reads the string form 'true' the way the adapter will", async () => {
      const payload = payloadWith({ noDebug: 'true' });
      wire(PythonAdapterPolicy, payload);

      await (worker as any).startAdapterAndConnect(payload);
      await settle();

      expect(configuredStatuses()).toHaveLength(1);
      expect(worker.getState()).toBe(ProxyState.CONNECTED);
    });

    it('reads every other form exactly as the launcher does — the two decisions must agree', async () => {
      // The launcher (resolveLaunchFlag) coerces 'true'/'false' and takes
      // anything else by truthiness, which is also how debugpy reads it.
      for (const form of ['True', 1, 'yes']) {
        mockMessageSender.send.mockClear();
        (worker as any).state = ProxyState.INITIALIZING;
        const payload = payloadWith({ noDebug: form });
        wire(PythonAdapterPolicy, payload);

        await (worker as any).startAdapterAndConnect(payload);
        await settle();

        expect(configuredStatuses(), `noDebug: ${JSON.stringify(form)}`).toHaveLength(1);
      }
      mockMessageSender.send.mockClear();
      (worker as any).state = ProxyState.INITIALIZING;
      const off = payloadWith({ noDebug: 'false' });
      wire(PythonAdapterPolicy, off);
      await (worker as any).startAdapterAndConnect(off);
      await settle();
      expect(configuredStatuses()).toHaveLength(0);
    });

    it('leaves an attach-shaped config alone — noDebug is a launch-request property', async () => {
      const payload = payloadWith({ request: 'attach', noDebug: true, connect: { host: 'localhost', port: 5678 } });
      wire(PythonAdapterPolicy, payload);
      connectionStub.sendAttachRequest = vi.fn().mockImplementation(async () => {
        setImmediate(() => mockDapClient.emit('initialized'));
      });

      await (worker as any).startAdapterAndConnect(payload);
      await settle();

      // The ordinary attach path: configured only after the phase closed.
      expect(connectionStub.sendAttachRequest).toHaveBeenCalledTimes(1);
      expect(connectionStub.sendConfigurationDone).toHaveBeenCalledTimes(1);
      expect(configuredStatuses()).toHaveLength(1);
    });
  });

  describe('where the adapter ignores the flag (no honoursNoDebug pin)', () => {
    // Python-shaped so the spawn/launch path is the plain launch mode above,
    // with the pin removed: the flag is forwarded, the adapter debugs anyway.
    const ignoringPolicy = { ...PythonAdapterPolicy, honoursNoDebug: undefined } as AdapterPolicy;

    it('keeps the ordinary launch: configured only once the configuration phase closes', async () => {
      const payload = payloadWith({ noDebug: true });
      wire(ignoringPolicy, payload);

      await (worker as any).startAdapterAndConnect(payload);
      await settle();
      expect(configuredStatuses()).toHaveLength(0);
      expect(worker.getState()).toBe(ProxyState.INITIALIZING);

      mockDapClient.emit('initialized');
      await settle();
      expect(connectionStub.sendConfigurationDone).toHaveBeenCalledTimes(1);
      expect(configuredStatuses()).toHaveLength(1);
      expect(worker.getState()).toBe(ProxyState.CONNECTED);
    });

    it('still treats a refused setBreakpoints as fatal — the debugger is on and the phase failed', async () => {
      const payload = payloadWith({ noDebug: true });
      wire(ignoringPolicy, payload);
      connectionStub.setBreakpoints.mockRejectedValue(new Error('boom'));

      await (worker as any).startAdapterAndConnect(payload);
      mockDapClient.emit('initialized');
      await settle();
      await settle();

      expect(errorMessages()).toHaveLength(1);
      expect((errorMessages()[0][0] as ErrorMessage).message).toMatch(/Error in DAP sequence: boom/);
      expect(configuredStatuses()).toHaveLength(0);
    });
  });

  describe('two-phase launch (go: sendLaunchBeforeConfig)', () => {
    const GO_PAYLOAD: ProxyInitPayload = {
      cmd: 'init',
      sessionId: 'go-nodebug-session',
      executablePath: 'dlv',
      adapterHost: 'localhost',
      adapterPort: 12345,
      logDir: '/logs',
      scriptPath: '/path/to/main.go',
      scriptArgs: [],
      stopOnEntry: false,
      justMyCode: false,
      initialBreakpoints: [{ id: 'bp-1', file: '/path/to/main.go', line: 8 }],
      launchConfig: { noDebug: true },
      adapterCommand: { command: 'dlv', args: ['dap', '--listen', 'localhost:12345'] }
    };

    it('neither waits out Phase 1 nor Phase 2 when no initialized event is coming', async () => {
      vi.useFakeTimers();
      wire(GoAdapterPolicy, GO_PAYLOAD);

      const connect = (worker as any).startAdapterAndConnect(GO_PAYLOAD);
      // Enough real ticks for the awaits between spawn, connect, initialize
      // and launch — but no timer advance: the 2 s / 10 s waits never run.
      for (let i = 0; i < 20; i++) {
        await Promise.resolve();
      }
      await vi.advanceTimersByTimeAsync(0);
      await connect;

      expect(connectionStub.sendLaunchRequest).toHaveBeenCalledTimes(1);
      expect(configuredStatuses()).toHaveLength(1);
      expect(worker.getState()).toBe(ProxyState.CONNECTED);
      expect(vi.getTimerCount()).toBe(0);
      expect(errorMessages()).toHaveLength(0);
    });

    it('runs a phase that arrived during the launch request before reporting configured (stale pin)', async () => {
      wire(GoAdapterPolicy, GO_PAYLOAD);
      const order: string[] = [];
      connectionStub.sendLaunchRequest.mockImplementation(async () => {
        // A Delve build that debugs under the flag after all: `initialized`
        // lands while the launch request is in flight and is deferred.
        mockDapClient.emit('initialized');
        await settle();
        order.push('launch-response');
      });
      connectionStub.setBreakpoints.mockImplementation(async () => {
        order.push('setBreakpoints');
        return { body: { breakpoints: [{ verified: true }] } };
      });
      connectionStub.sendConfigurationDone.mockImplementation(async () => { order.push('configurationDone'); });
      const origSend = mockMessageSender.send.getMockImplementation();
      mockMessageSender.send.mockImplementation((m) => {
        if (m.type === 'status' && m.status === 'adapter_configured_and_launched') order.push('configured');
        origSend?.(m);
      });

      await (worker as any).startAdapterAndConnect(GO_PAYLOAD);
      await settle();

      // Debug-mode order: the phase closes, then the parent hears configured.
      expect(order).toEqual(['launch-response', 'setBreakpoints', 'configurationDone', 'configured']);
      expect(configuredStatuses()).toHaveLength(1);
    });

    it('runs the phase once when initialized arrives late after all', async () => {
      wire(GoAdapterPolicy, GO_PAYLOAD);

      await (worker as any).startAdapterAndConnect(GO_PAYLOAD);
      await settle();
      expect(configuredStatuses()).toHaveLength(1);

      mockDapClient.emit('initialized');
      await settle();
      await settle();

      expect(connectionStub.sendConfigurationDone).toHaveBeenCalledTimes(1);
      expect(configuredStatuses()).toHaveLength(1);
      expect(errorMessages()).toHaveLength(0);
    });
  });

  describe('the #295 stopOnEntry force reads the flag through the same helper', () => {
    it('does not force stopOnEntry for pending CDP function breakpoints under an honoured noDebug', async () => {
      const cdpPolicy = {
        ...MockAdapterPolicy,
        name: 'cdp-test',
        functionBreakpointsVia: 'cdp',
        honoursNoDebug: true
      } as unknown as AdapterPolicy;
      wire(cdpPolicy, { ...payloadWith(undefined), initialFunctionBreakpoints: [{ name: 'main' }] });
      (worker as any).state = ProxyState.CONNECTED;
      (worker as any).dapClient = mockDapClient;

      await (worker as any).handleDapCommand({
        cmd: 'dap',
        sessionId: 'nodebug-session',
        requestId: 'r1',
        dapCommand: 'launch',
        dapArgs: { program: '/x.js', noDebug: 'true' }
      });

      const launchArgs = mockDapClient.sendRequest.mock.calls.find(([cmd]) => cmd === 'launch')?.[1] as
        | Record<string, unknown>
        | undefined;
      expect(launchArgs).toBeDefined();
      expect(launchArgs?.stopOnEntry).not.toBe(true);
    });
  });
});
