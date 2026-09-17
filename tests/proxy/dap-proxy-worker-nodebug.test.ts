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
import { DapResponseError } from '../../src/proxy/dap-response-error.js';

// --- helpers ---------------------------------------------------------------

/** The adapter's answer to a request it declines: a DAP error response, as MinimalDapClient rejects it. */
function refusal(command: string, message = 'Internal debugger error: Not supported in noDebug mode.'): DapResponseError {
  return new DapResponseError({ seq: 0, type: 'response', request_seq: 0, success: false, command, message });
}

/**
 * A python-shaped init payload; `launchConfig` is what the launch request
 * carries, `debuggerOff` the launcher's decision stamped on the payload
 * (the worker reads the stamp, never the config).
 */
function payloadWith(launchConfig: Record<string, unknown> | undefined, debuggerOff?: boolean): ProxyInitPayload {
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
    launchConfig,
    ...(debuggerOff !== undefined ? { debuggerOff } : {})
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
      const payload = payloadWith({ noDebug: true }, true);
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
      const payload = payloadWith({ noDebug: true }, true);
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
      const payload = payloadWith({ noDebug: true }, true);
      wire(PythonAdapterPolicy, payload);
      connectionStub.setBreakpoints.mockRejectedValue(refusal('setBreakpoints'));

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
      const payload = payloadWith({ noDebug: true }, true);
      wire(PythonAdapterPolicy, payload);
      connectionStub.setBreakpoints.mockRejectedValue(refusal('setBreakpoints'));

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
      const payload = payloadWith({ noDebug: true }, true);
      wire(PythonAdapterPolicy, payload);
      // A shutdown began while the refusal was in flight: the tolerant catch
      // must neither resurrect the session, nor send configurationDone to a
      // client on its way out, nor forward a notice.
      connectionStub.setBreakpoints.mockImplementation(async () => {
        (worker as any).state = ProxyState.SHUTTING_DOWN;
        throw refusal('setBreakpoints');
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
      expect(connectionStub.sendConfigurationDone).not.toHaveBeenCalled();
      expect(mockMessageSender.send.mock.calls.filter(([m]) => m.type === 'status' && m.status === 'adapter_notice')).toHaveLength(0);
      resolveLaunch();
      await connect;
      expect(configuredStatuses()).toHaveLength(0);
    });

    it('treats a transport failure in the phase as the broken session it is, flag or no flag', async () => {
      const payload = payloadWith({ noDebug: true }, true);
      wire(PythonAdapterPolicy, payload);
      // Not an adapter answer: the socket dropped mid-phase.
      connectionStub.setBreakpoints.mockRejectedValue(new Error('DAP client disconnected'));

      await (worker as any).startAdapterAndConnect(payload);
      mockDapClient.emit('initialized');
      await settle();
      await settle();

      expect(errorMessages()).toHaveLength(1);
      expect((errorMessages()[0][0] as ErrorMessage).message).toMatch(/Error in DAP sequence: DAP client disconnected/);
      expect(mockMessageSender.send.mock.calls.filter(([m]) => m.type === 'status' && m.status === 'adapter_notice')).toHaveLength(0);
      // The session went down, as it would in debug mode.
      expect([ProxyState.SHUTTING_DOWN, ProxyState.TERMINATED]).toContain(worker.getState());
    });

    it('forwards a refused exception filter or function breakpoint as a notice too — the phase goes on', async () => {
      const payload = payloadWith({ noDebug: true }, true);
      wire(PythonAdapterPolicy, payload);
      (worker as any).currentInitPayload = { ...payload, initialFunctionBreakpoints: [{ name: 'main' }] };
      connectionStub.setExceptionBreakpoints.mockRejectedValue(refusal('setExceptionBreakpoints'));
      mockDapClient.sendRequest.mockImplementation(async (command: string) => {
        if (command === 'setFunctionBreakpoints') {
          throw refusal('setFunctionBreakpoints');
        }
        return { body: {} };
      });

      await (worker as any).startAdapterAndConnect(payload);
      mockDapClient.emit('initialized');
      await settle();
      await settle();

      const notes = mockMessageSender.send.mock.calls
        .filter(([m]) => m.type === 'status' && m.status === 'adapter_notice')
        .map(([m]) => (m as StatusMessage & { note?: string }).note);
      expect(notes).toEqual([
        'setFunctionBreakpoints refused under noDebug: Internal debugger error: Not supported in noDebug mode.',
        'setExceptionBreakpoints refused under noDebug: Internal debugger error: Not supported in noDebug mode.'
      ]);
      expect(connectionStub.sendConfigurationDone).toHaveBeenCalledTimes(1);
      expect(errorMessages()).toHaveLength(0);
    });

    it('reports configured only after a phase that is still in flight when the launch response lands', async () => {
      const payload = payloadWith({ noDebug: true }, true);
      wire(PythonAdapterPolicy, payload);
      const order: string[] = [];
      // CodeLLDB: `initialized` during the launch request; the launch
      // response arrives before the configurationDone response does.
      let finishConfigurationDone!: () => void;
      connectionStub.sendConfigurationDone.mockImplementation(
        () => new Promise<void>((resolve) => { finishConfigurationDone = () => { order.push('configurationDone'); resolve(); }; })
      );
      connectionStub.sendLaunchRequest.mockImplementation(async () => {
        mockDapClient.emit('initialized');
        await settle();
        await settle();
        order.push('launch-response');
      });
      const origSend = mockMessageSender.send.getMockImplementation();
      mockMessageSender.send.mockImplementation((m) => {
        if (m.type === 'status' && m.status === 'adapter_configured_and_launched') order.push('configured');
        origSend?.(m);
      });

      const connect = (worker as any).startAdapterAndConnect(payload);
      await settle();
      await settle();
      await settle();
      expect(order).toEqual(['launch-response']);
      finishConfigurationDone();
      await connect;
      await settle();

      expect(order).toEqual(['launch-response', 'configurationDone', 'configured']);
    });

    it('reports configured before a terminated event that arrived in the same read as the launch response', async () => {
      const payload = payloadWith({ noDebug: true }, true);
      wire(PythonAdapterPolicy, payload);
      const order: string[] = [];
      // debugpy, short program: the launch response and `terminated` are
      // dispatched from one socket read. Modelled adversarially: the
      // terminal path starts first and the response continuation takes a
      // few extra ticks — the terminal path must still not win.
      connectionStub.sendLaunchRequest.mockImplementation(async () => {
        mockDapClient.emit('terminated', {});
        for (let i = 0; i < 8; i++) {
          await Promise.resolve();
        }
      });
      const origSend = mockMessageSender.send.getMockImplementation();
      mockMessageSender.send.mockImplementation((m) => {
        if (m.type === 'status' && m.status === 'adapter_configured_and_launched') order.push('configured');
        if (m.type === 'dapEvent' && m.event === 'terminated') order.push('terminated');
        origSend?.(m);
      });

      await (worker as any).startAdapterAndConnect(payload);
      for (let i = 0; i < 6; i++) {
        await settle();
      }

      expect(order).toEqual(['configured', 'terminated']);
    });

    it('echoes the refusal onto every pre-launch breakpoint, so the store and list_breakpoints carry the adapter\'s answer', async () => {
      const payload = payloadWith({ noDebug: true }, true);
      wire(PythonAdapterPolicy, { ...payload, initialBreakpoints: [
        { id: 'bp-1', file: '/path/to/script.py', line: 5 },
        { id: 'bp-2', file: '/path/to/other.py', line: 9 }
      ] });
      connectionStub.setBreakpoints.mockRejectedValue(refusal('setBreakpoints'));

      await (worker as any).startAdapterAndConnect(payload);
      mockDapClient.emit('initialized');
      await settle();
      await settle();

      const synced = mockMessageSender.send.mock.calls.find(
        ([m]) => m.type === 'status' && m.status === 'breakpoints_synced'
      )?.[0] as (StatusMessage & { breakpoints?: Array<{ id?: string; verified: boolean; message?: string }> }) | undefined;
      expect(synced?.breakpoints).toEqual([
        { id: 'bp-1', file: '/path/to/script.py', line: 5, verified: false, message: 'Internal debugger error: Not supported in noDebug mode.' },
        { id: 'bp-2', file: '/path/to/other.py', line: 9, verified: false, message: 'Internal debugger error: Not supported in noDebug mode.' }
      ]);
    });

    it("keeps the groups the adapter accepted and stamps the refusal only on the ones it did not answer", async () => {
      const payload = payloadWith({ noDebug: true }, true);
      wire(PythonAdapterPolicy, { ...payload, initialBreakpoints: [
        { id: 'bp-a', file: '/path/to/a.py', line: 5 },
        { id: 'bp-b', file: '/path/to/b.py', line: 9 }
      ] });
      connectionStub.setBreakpoints.mockImplementation(async (_client: unknown, file: string) => {
        if (file.endsWith('a.py')) {
          return { body: { breakpoints: [{ verified: true, id: 11, line: 5 }] } };
        }
        throw refusal('setBreakpoints');
      });

      await (worker as any).startAdapterAndConnect(payload);
      mockDapClient.emit('initialized');
      await settle();
      await settle();

      const synced = mockMessageSender.send.mock.calls.find(
        ([m]) => m.type === 'status' && m.status === 'breakpoints_synced'
      )?.[0] as (StatusMessage & { breakpoints?: Array<Record<string, unknown>> }) | undefined;
      expect(synced?.breakpoints).toEqual([
        { id: 'bp-a', file: '/path/to/a.py', line: 5, verified: true, adapterId: 11, boundLine: 5 },
        { id: 'bp-b', file: '/path/to/b.py', line: 9, verified: false, message: 'Internal debugger error: Not supported in noDebug mode.' }
      ]);
    });

    it('echoes a refused setFunctionBreakpoints onto the function breakpoints too', async () => {
      const payload = payloadWith({ noDebug: true }, true);
      wire(PythonAdapterPolicy, { ...payload, initialBreakpoints: [], initialFunctionBreakpoints: [{ name: 'main' }, { name: 'helper' }] });
      mockDapClient.sendRequest.mockImplementation(async (command: string) => {
        if (command === 'setFunctionBreakpoints') {
          throw refusal('setFunctionBreakpoints');
        }
        return { body: {} };
      });

      await (worker as any).startAdapterAndConnect(payload);
      mockDapClient.emit('initialized');
      await settle();
      await settle();

      const synced = mockMessageSender.send.mock.calls.find(
        ([m]) => m.type === 'status' && m.status === 'function_breakpoints_synced'
      )?.[0] as (StatusMessage & { functionBreakpoints?: Array<Record<string, unknown>> }) | undefined;
      expect(synced?.functionBreakpoints).toEqual([
        { name: 'main', verified: false, message: 'Internal debugger error: Not supported in noDebug mode.' },
        { name: 'helper', verified: false, message: 'Internal debugger error: Not supported in noDebug mode.' }
      ]);
    });

    it('is not fooled by a transport failure on the configurationDone it sends after a refusal', async () => {
      const payload = payloadWith({ noDebug: true }, true);
      wire(PythonAdapterPolicy, payload);
      connectionStub.setBreakpoints.mockRejectedValue(refusal('setBreakpoints'));
      // The socket dropped between the refusal and the close of the phase.
      connectionStub.sendConfigurationDone.mockRejectedValue(new Error('DAP client disconnected'));

      let resolveLaunch!: () => void;
      connectionStub.sendLaunchRequest.mockImplementation(
        () => new Promise<void>((resolve) => { resolveLaunch = resolve; })
      );
      const connect = (worker as any).startAdapterAndConnect(payload);
      await settle();
      mockDapClient.emit('initialized');
      await settle();
      await settle();

      expect(errorMessages()).toHaveLength(1);
      expect((errorMessages()[0][0] as ErrorMessage).message).toMatch(/Error in DAP sequence: DAP client disconnected/);
      expect(configuredStatuses()).toHaveLength(0);
      resolveLaunch();
      await connect.catch(() => undefined);
    });

    it('survives a refused configurationDone as well', async () => {
      const payload = payloadWith({ noDebug: true }, true);
      wire(PythonAdapterPolicy, payload);
      connectionStub.setBreakpoints.mockRejectedValue(refusal('setBreakpoints'));
      connectionStub.sendConfigurationDone.mockRejectedValue(refusal('configurationDone'));

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

    it("reads the launcher's stamped decision, not the launch config — one decision, decided once", async () => {
      // The stamp without the key: the launcher resolved a form (adapterLaunchConfig,
      // a string) the worker is not asked to re-derive.
      const stamped = payloadWith({}, true);
      wire(PythonAdapterPolicy, stamped);
      await (worker as any).startAdapterAndConnect(stamped);
      await settle();
      expect(configuredStatuses()).toHaveLength(1);

      // The key without the stamp: an honouring policy, but the launcher did
      // not decide debugger-off (or a transform put the key there itself).
      mockMessageSender.send.mockClear();
      (worker as any).state = ProxyState.INITIALIZING;
      const unstamped = payloadWith({ noDebug: true });
      wire(PythonAdapterPolicy, unstamped);
      await (worker as any).startAdapterAndConnect(unstamped);
      await settle();
      expect(configuredStatuses()).toHaveLength(0);
    });

    it('leaves an attach-shaped config alone — noDebug is a launch-request property', async () => {
      const payload = payloadWith({ request: 'attach', noDebug: true, connect: { host: 'localhost', port: 5678 } }, false);
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

    it('forwards terminated within the drain backstop when the launch request never answers', async () => {
      vi.useFakeTimers();
      const payload = payloadWith({ noDebug: true }, true);
      wire(PythonAdapterPolicy, payload);
      // The adapter says terminated but never answers the launch request.
      connectionStub.sendLaunchRequest.mockImplementation(
        () => new Promise<void>(() => { mockDapClient.emit('terminated', {}); })
      );
      const forwarded = () => mockMessageSender.send.mock.calls.filter(([m]) => m.type === 'dapEvent' && m.event === 'terminated');

      void (worker as any).startAdapterAndConnect(payload);
      await vi.advanceTimersByTimeAsync(100);
      expect(forwarded()).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(2500);

      expect(forwarded()).toHaveLength(1);
      expect(configuredStatuses()).toHaveLength(0);
      vi.useRealTimers();
    });

    it('still forwards terminated when the readiness status itself throws inside the terminal slot', async () => {
      const payload = payloadWith({ noDebug: true }, true);
      wire(PythonAdapterPolicy, payload);
      connectionStub.sendLaunchRequest.mockImplementation(async () => {
        mockDapClient.emit('terminated', {});
        for (let i = 0; i < 8; i++) {
          await Promise.resolve();
        }
      });
      const origSend = mockMessageSender.send.getMockImplementation();
      mockMessageSender.send.mockImplementation((m) => {
        if (m.type === 'status' && m.status === 'adapter_configured_and_launched') {
          throw new Error('IPC channel closed');
        }
        origSend?.(m);
      });

      await (worker as any).startAdapterAndConnect(payload).catch(() => undefined);
      for (let i = 0; i < 8; i++) {
        await settle();
      }

      const forwarded = mockMessageSender.send.mock.calls.filter(([m]) => m.type === 'dapEvent' && m.event === 'terminated');
      expect(forwarded).toHaveLength(1);
    });
  });

  describe('where the adapter ignores the flag (no honoursNoDebug pin)', () => {
    // Python-shaped so the spawn/launch path is the plain launch mode above,
    // with the pin removed: the flag is forwarded, the adapter debugs anyway.
    const ignoringPolicy = { ...PythonAdapterPolicy, honoursNoDebug: undefined } as AdapterPolicy;

    it('keeps the ordinary launch: configured only once the configuration phase closes', async () => {
      const payload = payloadWith({ noDebug: true }, false);
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
      const payload = payloadWith({ noDebug: true }, false);
      wire(ignoringPolicy, payload);
      connectionStub.setBreakpoints.mockRejectedValue(refusal('setBreakpoints', 'boom'));

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
      debuggerOff: true,
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

    it('opens no configuration phase from the terminal slot when a phase is pending and the program has ended', async () => {
      wire(GoAdapterPolicy, GO_PAYLOAD);
      const order: string[] = [];
      connectionStub.setBreakpoints.mockImplementation(async () => {
        order.push('setBreakpoints');
        return { body: { breakpoints: [{ verified: true }] } };
      });
      connectionStub.sendConfigurationDone.mockImplementation(async () => { order.push('configurationDone'); });
      connectionStub.sendLaunchRequest.mockImplementation(async () => {
        // A stale-pin Delve: `initialized` during the launch request (deferred),
        // then terminated arriving with the launch response — the program is
        // over; a phase against it is pointless and could hang the exit.
        mockDapClient.emit('initialized');
        await settle();
        mockDapClient.emit('terminated', {});
        order.push('launch-response');
      });
      const origSend = mockMessageSender.send.getMockImplementation();
      mockMessageSender.send.mockImplementation((m) => {
        if (m.type === 'status' && m.status === 'adapter_configured_and_launched') order.push('configured');
        if (m.type === 'dapEvent' && m.event === 'terminated') order.push('terminated');
        origSend?.(m);
      });

      await (worker as any).startAdapterAndConnect(GO_PAYLOAD);
      for (let i = 0; i < 8; i++) {
        await settle();
      }

      expect(order).toEqual(['launch-response', 'configured', 'terminated']);
      expect(configuredStatuses()).toHaveLength(1);
    });

    it('reports configured before a dap_connection_closed that follows the launch response', async () => {
      wire(GoAdapterPolicy, GO_PAYLOAD);
      const order: string[] = [];
      let onClose: (() => void) | undefined;
      connectionStub.setupEventHandlers.mockImplementation(
        (client: EventEmitter, handlers: Record<string, (...args: unknown[]) => void>) => {
          if (handlers.onInitialized) client.on('initialized', handlers.onInitialized);
          if (handlers.onTerminated) client.on('terminated', handlers.onTerminated);
          onClose = handlers.onClose as (() => void) | undefined;
        }
      );
      connectionStub.sendLaunchRequest.mockImplementation(async () => {
        // The adapter answers launch and drops the socket in the same read.
        onClose?.();
        for (let i = 0; i < 8; i++) {
          await Promise.resolve();
        }
        order.push('launch-response');
      });
      const origSend = mockMessageSender.send.getMockImplementation();
      mockMessageSender.send.mockImplementation((m) => {
        if (m.type === 'status' && m.status === 'adapter_configured_and_launched') order.push('configured');
        if (m.type === 'status' && m.status === 'dap_connection_closed') order.push('closed');
        origSend?.(m);
      });

      await (worker as any).startAdapterAndConnect(GO_PAYLOAD).catch(() => undefined);
      for (let i = 0; i < 10; i++) {
        await settle();
      }

      expect(order.indexOf('configured')).toBeGreaterThanOrEqual(0);
      expect(order.indexOf('configured')).toBeLessThan(order.indexOf('closed'));
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

  describe("the #295 stopOnEntry force reads the launcher's stamped decision", () => {
    it('does not force stopOnEntry for pending CDP function breakpoints when the launch runs with the debugger off', async () => {
      const cdpPolicy = {
        ...MockAdapterPolicy,
        name: 'cdp-test',
        functionBreakpointsVia: 'cdp',
        honoursNoDebug: true
      } as unknown as AdapterPolicy;
      wire(cdpPolicy, { ...payloadWith(undefined, true), initialFunctionBreakpoints: [{ name: 'main' }] });
      (worker as any).state = ProxyState.CONNECTED;
      (worker as any).dapClient = mockDapClient;
      (worker as any).debuggerOff = true;

      // The launch command's own args say nothing about noDebug: the stamp
      // is the decision, not a second reading of the args.
      await (worker as any).handleDapCommand({
        cmd: 'dap',
        sessionId: 'nodebug-session',
        requestId: 'r1',
        dapCommand: 'launch',
        dapArgs: { program: '/x.js' }
      });

      const launchArgs = mockDapClient.sendRequest.mock.calls.find(([cmd]) => cmd === 'launch')?.[1] as
        | Record<string, unknown>
        | undefined;
      expect(launchArgs).toBeDefined();
      expect(launchArgs?.stopOnEntry).not.toBe(true);
    });
  });
});
