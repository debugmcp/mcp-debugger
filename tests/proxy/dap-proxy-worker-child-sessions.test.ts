/**
 * DapProxyWorker and the session tree (issue #1081): a child the adapter
 * reports on any connection is held and announced to the parent process, the
 * parent's answers ride the `dap` envelope as pseudo-commands, and nothing of
 * this is installed for a policy without the tree contract.
 */
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { DapProxyWorker } from '../../src/proxy/dap-proxy-worker.js';
import { DapResponseError } from '../../src/proxy/dap-response-error.js';
import type {
  DapProxyDependencies,
  ILogger,
  ProxyInitPayload,
  StatusMessage,
  DapResponseMessage,
  DapEventMessage,
  ErrorMessage
} from '../../src/proxy/dap-proxy-interfaces.js';
import { CHILD_ADOPT_COMMAND, CHILD_CLOSE_COMMAND, CHILD_RELEASE_COMMAND, ProxyState } from '../../src/proxy/dap-proxy-interfaces.js';
import { JsDebugAdapterPolicy, PythonAdapterPolicy } from '@debugmcp/shared';
import { ErrorMessages } from '../../src/utils/error-messages.js';
import { createMockDapClient } from '../test-utils/mocks/dap-client.js';
import { createMockLogger } from '../test-utils/helpers/test-dependencies.js';
import { createMockFileSystem, createMockProcessSpawner } from '../test-utils/mocks/dap-proxy-doubles.js';

type SentMessage = StatusMessage | DapResponseMessage | DapEventMessage | ErrorMessage;

/** A policy that reports no children (the ten adapters without the tree contract), with debugpy's spawn configuration. */
const noContractPolicy = { ...PythonAdapterPolicy, childAdoption: undefined } as unknown as typeof PythonAdapterPolicy;

const configuration = { type: 'python', name: 'Subprocess 4242', subProcessId: 4242, connect: { host: '127.0.0.1', port: 5678 } };
const report = { targetId: '4242', name: 'Subprocess 4242', configuration };
const startDebugging = { seq: 7, type: 'request' as const, command: 'startDebugging', arguments: { request: 'attach', configuration } };

describe('DapProxyWorker child sessions (issue #1081)', () => {
  let worker: DapProxyWorker;
  let mockLogger: ILogger;
  let rootClient: ReturnType<typeof createMockDapClient>;
  let childClient: ReturnType<typeof createMockDapClient>;
  let releaseClient: ReturnType<typeof createMockDapClient>;
  let processStub: { spawn: Mock; shutdown: Mock };
  let resolveAttach: () => void;
  let send: Mock<(message: SentMessage) => void>;
  let connectionStub: {
    connectWithRetry: Mock;
    setAdapterPolicy: Mock;
    setupEventHandlers: Mock;
    initializeSession: Mock;
    sendLaunchRequest: Mock;
    sendAttachRequest: Mock;
    setExceptionBreakpoints: Mock;
    setBreakpoints: Mock;
    sendConfigurationDone: Mock;
    disconnect: Mock;
  };

  const payload: ProxyInitPayload = {
    cmd: 'init',
    sessionId: 'py-root',
    executablePath: 'python',
    adapterHost: '127.0.0.1',
    adapterPort: 5678,
    logDir: '/logs',
    scriptPath: '/work/parent.py',
    adapterCommand: { command: 'python', args: ['-m', 'debugpy.adapter'] }
  };

  async function connectUnder(
    policy: typeof PythonAdapterPolicy | typeof JsDebugAdapterPolicy,
    init: ProxyInitPayload = payload
  ): Promise<void> {
    (worker as any).logger = mockLogger;
    (worker as any).processManager = processStub;
    (worker as any).connectionManager = connectionStub;
    (worker as any).adapterPolicy = policy;
    (worker as any).adapterState = policy.createInitialState();
    (worker as any).currentInitPayload = init;
    (worker as any).currentSessionId = init.sessionId;
    (worker as any).state = ProxyState.INITIALIZING;
    await (worker as any).startAdapterAndConnect(init);
  }

  const statuses = (status: string): StatusMessage[] =>
    send.mock.calls.map(([m]) => m).filter((m): m is StatusMessage => m.type === 'status' && m.status === status);

  beforeEach(() => {
    mockLogger = createMockLogger();
    rootClient = createMockDapClient();
    childClient = createMockDapClient();
    releaseClient = createMockDapClient();
    processStub = {
      spawn: vi.fn().mockResolvedValue({ process: new EventEmitter() as unknown as ChildProcess, pid: 321 }),
      shutdown: vi.fn().mockResolvedValue(undefined)
    };
    send = vi.fn<(message: SentMessage) => void>();
    connectionStub = {
      connectWithRetry: vi.fn().mockResolvedValue(rootClient),
      setAdapterPolicy: vi.fn(),
      setupEventHandlers: vi.fn(),
      initializeSession: vi.fn().mockResolvedValue({ supportsConfigurationDoneRequest: true }),
      sendLaunchRequest: vi.fn(),
      // debugpy answers a child attach only after configurationDone.
      sendAttachRequest: vi.fn(() => new Promise<void>((resolve) => { resolveAttach = resolve; })),
      setExceptionBreakpoints: vi.fn().mockResolvedValue({ body: {} }),
      setBreakpoints: vi.fn().mockResolvedValue({ body: { breakpoints: [{ verified: true, id: 3, line: 12 }] } }),
      sendConfigurationDone: vi.fn(async () => { resolveAttach?.(); }),
      disconnect: vi.fn().mockResolvedValue(undefined)
    };
    const dependencies: DapProxyDependencies = {
      fileSystem: createMockFileSystem(),
      loggerFactory: vi.fn().mockResolvedValue(mockLogger),
      processSpawner: createMockProcessSpawner(),
      dapClientFactory: {
        create: vi.fn((_host: string, _port: number, _policy?: unknown, options?: { traceLabel?: string }) =>
          options?.traceLabel?.startsWith('release:') ? releaseClient : options?.traceLabel?.startsWith('child:') ? childClient : rootClient)
      },
      messageSender: { send }
    };
    worker = new DapProxyWorker(dependencies, { exit: vi.fn() });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('announces a child reported on the root connection, stamped with the root session', async () => {
    await connectUnder(PythonAdapterPolicy);

    rootClient.emit('child-report', { request: startDebugging, report });

    const reported = statuses('child_reported');
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({ sessionId: 'py-root', targetId: '4242', name: 'Subprocess 4242', configuration });
    expect(typeof reported[0].reportId).toBe('string');
    expect(rootClient.respondToReverseRequest).not.toHaveBeenCalled();
  });

  it('childRelease answers the held request success:false and the command success:true', async () => {
    await connectUnder(PythonAdapterPolicy);
    rootClient.emit('child-report', { request: startDebugging, report });
    const reportId = statuses('child_reported')[0].reportId as string;

    await worker.handleCommand({
      cmd: 'dap',
      sessionId: 'py-root',
      requestId: 'r1',
      dapCommand: CHILD_RELEASE_COMMAND,
      dapArgs: { reportId, reason: 'over the child cap' }
    });

    expect(rootClient.respondToReverseRequest).toHaveBeenCalledWith(
      expect.objectContaining({ seq: 7, command: 'startDebugging' }),
      {},
      false,
      'over the child cap'
    );
    const response = send.mock.calls.map(([m]) => m).find((m): m is DapResponseMessage => m.type === 'dapResponse' && m.requestId === 'r1');
    expect(response).toMatchObject({ success: true, sessionId: 'py-root', body: { held: true, released: true } });
  });

  it('childRelease returns the confirmation outcome body for unconfirmed and close-cancelled releases (I4, issue #1221)', async () => {
    await connectUnder(PythonAdapterPolicy);

    // 1. Socket write returns false -> held: true, released: false
    rootClient.respondToReverseRequest.mockReturnValueOnce(false);
    rootClient.emit('child-report', { request: startDebugging, report });
    const unconfirmedId = statuses('child_reported')[0].reportId as string;
    await worker.handleCommand({
      cmd: 'dap',
      sessionId: 'py-root',
      requestId: 'r-unconfirmed',
      dapCommand: CHILD_RELEASE_COMMAND,
      dapArgs: { reportId: unconfirmedId, reason: 'over the child cap' }
    });
    expect(responseTo('r-unconfirmed')).toMatchObject({
      success: true,
      sessionId: 'py-root',
      body: { held: true, released: false }
    });

    // 2. Adoption cancelled by childClose -> held: false, released: false, closed: true
    rootClient.respondToReverseRequest.mockReturnValue(true);
    childClient.connect.mockImplementationOnce(() => new Promise<void>(() => {}));
    rootClient.emit('child-report', { request: startDebugging, report });
    const closedId = statuses('child_reported')[1].reportId as string;
    const adopting = worker.handleCommand({
      cmd: 'dap',
      sessionId: 'child-cancelled',
      requestId: 'adopt-cancelled',
      dapCommand: CHILD_ADOPT_COMMAND,
      dapArgs: { reportId: closedId }
    });
    await new Promise((resolve) => setImmediate(resolve));
    await worker.handleCommand({
      cmd: 'dap',
      sessionId: 'child-cancelled',
      requestId: 'close-cancelled',
      dapCommand: CHILD_CLOSE_COMMAND,
      dapArgs: { terminateDebuggee: true }
    });
    await adopting;
    await worker.handleCommand({
      cmd: 'dap',
      sessionId: 'py-root',
      requestId: 'r-closed',
      dapCommand: CHILD_RELEASE_COMMAND,
      dapArgs: { reportId: closedId, reason: 'adoption failed' }
    });
    expect(responseTo('r-closed')).toMatchObject({
      success: true,
      sessionId: 'py-root',
      body: { held: false, released: false, closed: true }
    });
  });

  it('holds the reports of a js-debug root too: every target after the program is a child of the tree (issue #1082)', async () => {
    await connectUnder(JsDebugAdapterPolicy);

    const listened = rootClient.on.mock.calls.map(([event]) => event);
    expect(listened).toContain('child-report');

    const forkRequest = { seq: 9, type: 'request' as const, command: 'startDebugging', arguments: { request: 'launch', configuration: { type: 'pwa-node', name: 'child.js [7]', __pendingTargetId: 'fork-1' } } };
    const forkReport = { targetId: 'fork-1', name: 'child.js [7]', configuration: forkRequest.arguments.configuration };
    rootClient.emit('child-report', { request: forkRequest, report: forkReport });

    const reported = statuses('child_reported');
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({ sessionId: 'py-root', targetId: 'fork-1', name: 'child.js [7]' });
    // js-debug's report is answered the moment it is held: the answer decides nothing.
    expect(rootClient.respondToReverseRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 9 }), {}, true, undefined);
  });

  it('installs no child-report listener for a policy without the tree contract', async () => {
    await connectUnder(noContractPolicy);

    const listened = rootClient.on.mock.calls.map(([event]) => event);
    expect(listened).not.toContain('child-report');
  });

  /** Report a child on the root and adopt it as `child-1` through the envelope. */
  async function adoptChild(): Promise<void> {
    rootClient.emit('child-report', { request: startDebugging, report });
    const reportId = statuses('child_reported')[0].reportId as string;
    const adopting = worker.handleCommand({
      cmd: 'dap',
      sessionId: 'child-1',
      requestId: 'adopt-1',
      dapCommand: CHILD_ADOPT_COMMAND,
      dapArgs: { reportId, breakpoints: [{ file: '/w/child.py', line: 12 }] }
    });
    await new Promise((resolve) => setImmediate(resolve));
    childClient.emit('initialized');
    await adopting;
  }

  const responseTo = (requestId: string): DapResponseMessage | undefined =>
    send.mock.calls.map(([m]) => m).find((m): m is DapResponseMessage => m.type === 'dapResponse' && m.requestId === requestId);

  it('childAdopt opens the child connection, runs the handshake and answers on the child envelope', async () => {
    await connectUnder(PythonAdapterPolicy);

    await adoptChild();

    // The child's initialize names the adapter the way the root's does: by the policy's DAP type.
    expect(connectionStub.initializeSession).toHaveBeenCalledWith(childClient, 'child-1', 'debugpy');
    expect(connectionStub.sendAttachRequest).toHaveBeenCalledWith(childClient, expect.objectContaining({ subProcessId: 4242, redirectOutput: true }));
    expect(connectionStub.setBreakpoints).toHaveBeenCalledWith(childClient, expect.stringMatching(/child\.py$/), [{ file: '/w/child.py', line: 12 }], PythonAdapterPolicy);
    expect(rootClient.respondToReverseRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 7 }), {}, true, undefined);
    expect(responseTo('adopt-1')).toMatchObject({ success: true, sessionId: 'child-1', body: { sessionId: 'child-1', capabilities: { supportsConfigurationDoneRequest: true } } });
    expect(statuses('breakpoints_synced').map((m) => m.sessionId)).toEqual(['child-1']);
  });

  it('routes a command on the child envelope to the child connection and stamps its answer with the child', async () => {
    await connectUnder(PythonAdapterPolicy);
    await adoptChild();
    childClient.sendRequest.mockResolvedValueOnce({ type: 'response', success: true, command: 'threads', body: { threads: [{ id: 1, name: 'MainThread' }] } });

    await worker.handleCommand({ cmd: 'dap', sessionId: 'child-1', requestId: 'threads-1', dapCommand: 'threads', dapArgs: {} });

    expect(childClient.sendRequest).toHaveBeenCalledWith('threads', {}, undefined);
    expect(rootClient.sendRequest).not.toHaveBeenCalledWith('threads', expect.anything(), expect.anything());
    expect(responseTo('threads-1')).toMatchObject({ success: true, sessionId: 'child-1', body: { threads: [{ id: 1, name: 'MainThread' }] } });

    // The root keeps its own stamp afterwards.
    (worker as any).sendDapEvent('output', { category: 'stdout', output: 'parent line\n' });
    const events = send.mock.calls.map(([m]) => m).filter((m): m is DapEventMessage => m.type === 'dapEvent' && m.event === 'output');
    expect(events.at(-1)).toMatchObject({ sessionId: 'py-root' });
  });

  it('a root event emitted while a childAdopt is still pending is stamped with the root', async () => {
    await connectUnder(PythonAdapterPolicy);
    rootClient.emit('child-report', { request: startDebugging, report });
    const reportId = statuses('child_reported')[0].reportId as string;
    const adopting = worker.handleCommand({ cmd: 'dap', sessionId: 'child-1', requestId: 'adopt-2', dapCommand: CHILD_ADOPT_COMMAND, dapArgs: { reportId } });
    await new Promise((resolve) => setImmediate(resolve));

    (worker as any).sendDapEvent('output', { category: 'stdout', output: 'still the parent\n' });

    const events = send.mock.calls.map(([m]) => m).filter((m): m is DapEventMessage => m.type === 'dapEvent' && m.event === 'output');
    expect(events.at(-1)).toMatchObject({ sessionId: 'py-root' });
    childClient.emit('initialized');
    await adopting;
  });

  it('childClose disconnects the child with terminateDebuggee and answers on the child envelope', async () => {
    await connectUnder(PythonAdapterPolicy);
    await adoptChild();

    await worker.handleCommand({ cmd: 'dap', sessionId: 'child-1', requestId: 'close-1', dapCommand: CHILD_CLOSE_COMMAND, dapArgs: { terminateDebuggee: true } });

    expect(connectionStub.disconnect).toHaveBeenCalledWith(childClient, true);
    expect(childClient.shutdown).toHaveBeenCalled();
    expect(responseTo('close-1')).toMatchObject({ success: true, sessionId: 'child-1', body: { closed: true } });
    expect(connectionStub.disconnect).not.toHaveBeenCalledWith(rootClient, expect.anything());
  });

  it('the root ending with a live child defers the worker shutdown until the last child ends', async () => {
    await connectUnder(PythonAdapterPolicy);
    (worker as any).state = ProxyState.CONNECTED;
    const handlers = connectionStub.setupEventHandlers.mock.calls[0][1] as { onTerminated: (body: unknown) => void };
    await adoptChild();

    handlers.onTerminated({});
    await new Promise((resolve) => setImmediate(resolve));

    expect((worker as any).state).toBe(ProxyState.CONNECTED);
    expect(processStub.shutdown).not.toHaveBeenCalled();

    await worker.handleCommand({ cmd: 'dap', sessionId: 'child-1', requestId: 'close-2', dapCommand: CHILD_CLOSE_COMMAND, dapArgs: { terminateDebuggee: true } });
    await vi.waitFor(() => expect((worker as any).state).toBe(ProxyState.TERMINATED), { timeout: 3000 });
    expect(processStub.shutdown).toHaveBeenCalled();
  }, 10000);

  it('terminate closes the child connections after the root disconnect and before the adapter is killed', async () => {
    await connectUnder(PythonAdapterPolicy);
    (worker as any).state = ProxyState.CONNECTED;
    await adoptChild();

    await worker.handleTerminate();

    const rootDisconnectAt = connectionStub.disconnect.mock.invocationCallOrder[0];
    const childDisconnectAt = connectionStub.disconnect.mock.invocationCallOrder[1];
    const adapterKillAt = processStub.shutdown.mock.invocationCallOrder[0];
    expect(connectionStub.disconnect.mock.calls[0][0]).toBe(rootClient);
    expect(connectionStub.disconnect.mock.calls[1]).toEqual([childClient, false]);
    expect(rootDisconnectAt).toBeLessThan(childDisconnectAt);
    expect(childDisconnectAt).toBeLessThan(adapterKillAt);
  }, 10000);

  it('terminate releases a held report before the root connection is dropped', async () => {
    await connectUnder(PythonAdapterPolicy);
    rootClient.emit('child-report', { request: startDebugging, report });
    (worker as any).state = ProxyState.CONNECTED;

    await worker.handleTerminate();

    expect(rootClient.respondToReverseRequest).toHaveBeenCalledWith(
      expect.objectContaining({ seq: 7 }),
      {},
      false,
      expect.stringContaining('shutdown')
    );
    const releasedAt = rootClient.respondToReverseRequest.mock.invocationCallOrder[0];
    const disconnectedAt = connectionStub.disconnect.mock.invocationCallOrder[0];
    expect(releasedAt).toBeLessThan(disconnectedAt);
  });

  it.each(['shutdown', 'attach close', 'explicit detach'] as const)('%s waits for a js-debug child release before disconnecting the root', async (mode) => {
    await connectUnder(JsDebugAdapterPolicy);
    (worker as any).state = ProxyState.CONNECTED;
    (worker as any).isAttachMode = mode !== 'shutdown';
    let connect!: () => void;
    releaseClient.connect.mockImplementationOnce(() => new Promise<void>((resolve) => { connect = resolve; }));
    releaseClient.sendRequest.mockImplementation(async (command: string) => {
      if (command === 'attach') {
        setImmediate(() => releaseClient.emit('event', { event: 'thread', body: { reason: 'started', threadId: 1 } }));
      }
      return { body: {} };
    });
    const configuration = { type: 'pwa-node', name: 'child.js', __pendingTargetId: 'fork-1' };
    rootClient.emit('child-report', {
      request: { seq: 9, type: 'request', command: 'startDebugging', arguments: { request: 'launch', configuration } },
      report: { targetId: 'fork-1', name: 'child.js', configuration }
    });
    const closing = mode === 'explicit detach'
      ? worker.handleCommand({ cmd: 'dap', sessionId: 'py-root', requestId: 'detach', dapCommand: 'disconnect', dapArgs: { terminateDebuggee: false } })
      : worker.handleTerminate();
    await new Promise((resolve) => setImmediate(resolve));
    expect(releaseClient.connect).toHaveBeenCalled();
    expect(connectionStub.disconnect).not.toHaveBeenCalled();
    expect(rootClient.sendRequest).not.toHaveBeenCalledWith('disconnect', expect.anything());
    expect(processStub.shutdown).not.toHaveBeenCalled();

    connect();
    await closing;
    const releasedAt = releaseClient.shutdown.mock.invocationCallOrder[0];
    const disconnectedAt = mode === 'explicit detach'
      ? rootClient.sendRequest.mock.invocationCallOrder[rootClient.sendRequest.mock.calls.findIndex(([command]) => command === 'disconnect')]
      : connectionStub.disconnect.mock.invocationCallOrder[0];
    expect(releasedAt).toBeLessThan(disconnectedAt);
  });

  it('rejects a request for a child whose connection has ended without sending it to the root', async () => {
    await connectUnder(PythonAdapterPolicy);
    await adoptChild();
    childClient.emit('close');
    rootClient.sendRequest.mockClear();
    childClient.sendRequest.mockClear();

    await worker.handleCommand({ cmd: 'dap', sessionId: 'child-1', requestId: 'stale-continue', dapCommand: 'continue', dapArgs: { threadId: 1 } });

    expect(rootClient.sendRequest).not.toHaveBeenCalled();
    expect(childClient.sendRequest).not.toHaveBeenCalled();
    expect(responseTo('stale-continue')).toMatchObject({ success: false, sessionId: 'child-1', error: expect.stringContaining('No child connection') });
  });

  it('returns child adapter refusals with their structured response on the child envelope', async () => {
    await connectUnder(PythonAdapterPolicy);
    await adoptChild();
    const refusal = {
      type: 'response' as const, seq: 9, request_seq: 4, success: false, command: 'evaluate',
      body: { error: { id: 1, format: 'unknown name' } }
    };
    childClient.sendRequest.mockRejectedValueOnce(new DapResponseError(refusal));

    await worker.handleCommand({ cmd: 'dap', sessionId: 'child-1', requestId: 'eval-1', dapCommand: 'evaluate', dapArgs: { expression: 'missing' }, timeoutMs: 1234 });

    expect(childClient.sendRequest).toHaveBeenCalledWith('evaluate', { expression: 'missing' }, 1234);
    expect(responseTo('eval-1')).toMatchObject({ success: false, sessionId: 'child-1', error: 'unknown name', body: refusal.body });
  });

  it('returns a child transport failure without inventing an adapter response', async () => {
    await connectUnder(PythonAdapterPolicy);
    await adoptChild();
    childClient.sendRequest.mockRejectedValueOnce('socket unavailable');
    await worker.handleCommand({ cmd: 'dap', sessionId: 'child-1', requestId: 'threads-failed', dapCommand: 'threads' });
    expect(responseTo('threads-failed')).toMatchObject({ success: false, sessionId: 'child-1', error: 'socket unavailable' });
    expect(responseTo('threads-failed')?.body).toBeUndefined();
  });

  it('answers adoption failures on the requested child envelope', async () => {
    await connectUnder(PythonAdapterPolicy);
    await worker.handleCommand({ cmd: 'dap', sessionId: 'child-1', requestId: 'missing-adopt', dapCommand: CHILD_ADOPT_COMMAND, dapArgs: { reportId: 'unknown' } });
    expect(responseTo('missing-adopt')).toMatchObject({ success: false, sessionId: 'child-1', error: expect.stringContaining('unknown or already answered') });
  });

  it('refuses child commands when this adapter has no adoption contract', async () => {
    await connectUnder(noContractPolicy);
    await worker.handleCommand({ cmd: 'dap', sessionId: 'child-1', requestId: 'unsupported-adopt', dapCommand: CHILD_ADOPT_COMMAND });
    expect(responseTo('unsupported-adopt')).toMatchObject({ success: false, sessionId: 'child-1', error: expect.stringContaining('reports no child processes') });
  });

  it('completes deferred root shutdown if the final child fails to attach', async () => {
    await connectUnder(PythonAdapterPolicy);
    (worker as any).state = ProxyState.CONNECTED;
    let failAttach!: (error: Error) => void;
    connectionStub.sendAttachRequest.mockImplementationOnce(() => new Promise<void>((_, reject) => { failAttach = reject; }));
    rootClient.emit('child-report', { request: startDebugging, report });
    const reportId = statuses('child_reported')[0].reportId as string;
    const adopting = worker.handleCommand({ cmd: 'dap', sessionId: 'child-1', requestId: 'failed-adopt', dapCommand: CHILD_ADOPT_COMMAND, dapArgs: { reportId } });
    await new Promise((resolve) => setImmediate(resolve));
    const handlers = connectionStub.setupEventHandlers.mock.calls[0][1] as { onTerminated: (body: unknown) => void };
    handlers.onTerminated({});
    expect(processStub.shutdown).not.toHaveBeenCalled();
    failAttach(new Error('child exited during attach'));
    await adopting;
    await vi.waitFor(() => expect(worker.getState()).toBe(ProxyState.TERMINATED), { timeout: 3000 });
    expect(processStub.shutdown).toHaveBeenCalledTimes(1);
    expect(responseTo('failed-adopt')).toMatchObject({ success: false, sessionId: 'child-1', error: 'child exited during attach' });
  });

  /**
   * The proxy's own stepper for a js-debug child (issue #1130), through the
   * worker's real ChildConnections and the real stepper. The worker has no
   * seam for the child's CDP socket (ChildConnections opens a CdpProxyClient,
   * which opens the Node global WebSocket), so the global is the fake here:
   * it answers every command, and the test sends V8's events.
   */
  describe("a js-debug child's steps and its proxy stepper (issue #1130)", () => {
    class FakeCdpSocket {
      static opened: FakeCdpSocket[] = [];
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: unknown }) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: ((event: { message?: string }) => void) | null = null;
      readonly sent: string[] = [];

      constructor(readonly url: string) {
        FakeCdpSocket.opened.push(this);
        queueMicrotask(() => this.onopen?.());
      }

      send(data: string): void {
        const { id, method } = JSON.parse(data) as { id: number; method: string };
        this.sent.push(method);
        queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ id, result: {} }) }));
      }

      close(): void {
        this.onclose?.();
      }

      /** V8 pauses in `f`, as CDP reports it. */
      paused(): void {
        this.onmessage?.({
          data: JSON.stringify({
            method: 'Debugger.paused',
            params: { reason: 'other', callFrames: [{ functionName: 'f', location: { scriptId: '1', lineNumber: 1, columnNumber: 0 } }] }
          })
        });
      }
    }

    const forkConfiguration = { type: 'pwa-node', name: 'child.js [7]', __pendingTargetId: 'fork-1' };

    /** The child's `stopped` events the parent process was sent. */
    const childStops = (): unknown[] =>
      send.mock.calls
        .map(([m]) => m)
        .filter((m): m is DapEventMessage => m.type === 'dapEvent' && m.sessionId === 'child-1' && m.event === 'stopped')
        .map((m) => m.body);

    beforeEach(() => {
      FakeCdpSocket.opened = [];
      vi.stubGlobal('WebSocket', FakeCdpSocket);
      childClient.sendRequest.mockImplementation(async (command: string) =>
        command === 'requestCDPProxy'
          ? { body: { host: '127.0.0.1', port: 9333, path: '/cdp-of-the-fork' } }
          : { type: 'response', success: true, command, body: {} });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    /**
     * A js-debug root, a fork adopted as `child-1`, its stepper on the fork's
     * CDP socket, and V8 paused in the fork's program code.
     */
    async function pausedFork(start: { rootSteps?: boolean; smartStep?: boolean }): Promise<FakeCdpSocket> {
      if (start.rootSteps !== undefined) {
        // What MinimalDapClient answers from the root's own start request.
        rootClient.stepsThroughSkippedCode = () => start.rootSteps;
      }
      await connectUnder(
        JsDebugAdapterPolicy,
        start.smartStep === undefined ? payload : { ...payload, launchConfig: { smartStep: start.smartStep } }
      );
      rootClient.emit('child-report', {
        request: { seq: 9, type: 'request', command: 'startDebugging', arguments: { request: 'launch', configuration: forkConfiguration } },
        report: { targetId: 'fork-1', name: 'child.js [7]', configuration: forkConfiguration }
      });
      const reportId = statuses('child_reported')[0].reportId as string;
      const adopting = worker.handleCommand({ cmd: 'dap', sessionId: 'child-1', requestId: 'adopt-fork', dapCommand: CHILD_ADOPT_COMMAND, dapArgs: { reportId } });
      await new Promise((resolve) => setImmediate(resolve));
      childClient.emit('initialized');
      await adopting;
      // The stepper is opened after the adoption answers.
      await vi.waitFor(() => expect(FakeCdpSocket.opened[0]?.sent).toContain('Debugger.enable'));
      const socket = FakeCdpSocket.opened[0];
      socket.paused();
      return socket;
    }

    const stepTheFork = (requestId: string): Promise<void> =>
      worker.handleCommand({ cmd: 'dap', sessionId: 'child-1', requestId, dapCommand: 'next', dapArgs: { threadId: 1 } });

    it("answers a fork's setFunctionBreakpoints itself: js-debug has no such request and would leave it unanswered (issue #1219)", async () => {
      await pausedFork({ rootSteps: true });

      await worker.handleCommand({
        cmd: 'dap', sessionId: 'child-1', requestId: 'fn-1',
        dapCommand: 'setFunctionBreakpoints', dapArgs: { breakpoints: [{ name: 'handle' }] }
      });

      expect(childClient.sendRequest.mock.calls.map(([command]) => command)).not.toContain('setFunctionBreakpoints');
      expect(rootClient.sendRequest.mock.calls.map(([command]) => command)).not.toContain('setFunctionBreakpoints');
      expect(responseTo('fn-1')).toMatchObject({
        success: true,
        sessionId: 'child-1',
        response: {
          command: 'setFunctionBreakpoints',
          success: true,
          body: { breakpoints: [{ verified: false, message: ErrorMessages.functionBreakpointsNotArmedInChildSession() }] }
        }
      });
    });

    // The child's stepper takes over the choice of the root's own start
    // request, which the root's client answers; the init payload's launch
    // configuration only when that client cannot say.
    it.each<[string, { rootSteps?: boolean; smartStep?: boolean }]>([
      ['the root steps through skipped code (an attach root: no smartStep in the payload)', { rootSteps: true }],
      ["the root's client cannot say and the payload's launch configuration asked for smartStep", { smartStep: true }]
    ])("the child's stepper serves its step over the child's CDP socket when %s", async (_case, start) => {
      const socket = await pausedFork(start);
      expect(socket.url).toBe('ws://127.0.0.1:9333/cdp-of-the-fork');

      await stepTheFork('step-1');

      // One engine step over CDP, answered on the child's envelope; js-debug is never sent the `next`.
      expect(socket.sent).toContain('Debugger.stepOver');
      expect(childClient.sendRequest).not.toHaveBeenCalledWith('next', expect.anything(), expect.anything());
      expect(responseTo('step-1')).toMatchObject({ success: true, sessionId: 'child-1', response: { command: 'next', success: true } });
    });

    it("the child's step is js-debug's own when the root does not step through skipped code, whatever the payload asked", async () => {
      const socket = await pausedFork({ rootSteps: false, smartStep: true });

      await stepTheFork('step-2');

      expect(childClient.sendRequest).toHaveBeenCalledWith('next', { threadId: 1 }, undefined);
      expect(socket.sent).not.toContain('Debugger.stepOver');
      expect(responseTo('step-2')).toMatchObject({ success: true, sessionId: 'child-1' });
    });

    it("any other request for the child passes its stepper first: a continue ends a step in flight, an evaluate does not", async () => {
      await pausedFork({ rootSteps: true });
      await stepTheFork('step-3');

      await worker.handleCommand({ cmd: 'dap', sessionId: 'child-1', requestId: 'eval-3', dapCommand: 'evaluate', dapArgs: { expression: 'x' } });
      childClient.emit('stopped', { reason: 'pause', threadId: 1 });
      // Still the step's own pause: withheld.
      expect(childClient.sendRequest).toHaveBeenCalledWith('evaluate', { expression: 'x' }, undefined);
      expect(childStops()).toEqual([]);

      await worker.handleCommand({ cmd: 'dap', sessionId: 'child-1', requestId: 'continue-3', dapCommand: 'continue', dapArgs: { threadId: 1 } });
      childClient.emit('stopped', { reason: 'breakpoint', threadId: 1, hitBreakpointIds: [4] });
      // The step was given up before the continue went out: this stop is the program's own.
      expect(childClient.sendRequest).toHaveBeenCalledWith('continue', { threadId: 1 }, undefined);
      expect(childStops()).toEqual([{ reason: 'breakpoint', threadId: 1, hitBreakpointIds: [4] }]);
      expect(responseTo('continue-3')).toMatchObject({ success: true, sessionId: 'child-1' });
    });
  });
});
