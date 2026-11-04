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
import { createMockDapClient } from '../test-utils/mocks/dap-client.js';
import { createMockLogger } from '../test-utils/helpers/test-dependencies.js';
import { createMockFileSystem, createMockProcessSpawner } from '../test-utils/mocks/dap-proxy-doubles.js';

type SentMessage = StatusMessage | DapResponseMessage | DapEventMessage | ErrorMessage;

const configuration = { type: 'python', name: 'Subprocess 4242', subProcessId: 4242, connect: { host: '127.0.0.1', port: 5678 } };
const report = { targetId: '4242', name: 'Subprocess 4242', configuration };
const startDebugging = { seq: 7, type: 'request' as const, command: 'startDebugging', arguments: { request: 'attach', configuration } };

describe('DapProxyWorker child sessions (issue #1081)', () => {
  let worker: DapProxyWorker;
  let mockLogger: ILogger;
  let rootClient: ReturnType<typeof createMockDapClient>;
  let childClient: ReturnType<typeof createMockDapClient>;
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

  async function connectUnder(policy: typeof PythonAdapterPolicy | typeof JsDebugAdapterPolicy): Promise<void> {
    (worker as any).logger = mockLogger;
    (worker as any).processManager = processStub;
    (worker as any).connectionManager = connectionStub;
    (worker as any).adapterPolicy = policy;
    (worker as any).adapterState = policy.createInitialState();
    (worker as any).currentInitPayload = payload;
    (worker as any).currentSessionId = payload.sessionId;
    (worker as any).state = ProxyState.INITIALIZING;
    await (worker as any).startAdapterAndConnect(payload);
  }

  const statuses = (status: string): StatusMessage[] =>
    send.mock.calls.map(([m]) => m).filter((m): m is StatusMessage => m.type === 'status' && m.status === status);

  beforeEach(() => {
    mockLogger = createMockLogger();
    rootClient = createMockDapClient();
    childClient = createMockDapClient();
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
          options?.traceLabel?.startsWith('child:') ? childClient : rootClient)
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
    expect(response).toMatchObject({ success: true, sessionId: 'py-root', body: { released: true } });
  });

  it('installs no child-report listener for a policy without the tree contract (js-debug stays as it was)', async () => {
    await connectUnder(JsDebugAdapterPolicy);

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
});
