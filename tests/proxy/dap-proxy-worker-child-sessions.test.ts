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
import { CHILD_RELEASE_COMMAND, ProxyState } from '../../src/proxy/dap-proxy-interfaces.js';
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
  let send: Mock<(message: SentMessage) => void>;
  let connectionStub: {
    connectWithRetry: Mock;
    setAdapterPolicy: Mock;
    setupEventHandlers: Mock;
    initializeSession: Mock;
    sendLaunchRequest: Mock;
    sendAttachRequest: Mock;
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
    (worker as any).processManager = {
      spawn: vi.fn().mockResolvedValue({ process: new EventEmitter() as unknown as ChildProcess, pid: 321 }),
      shutdown: vi.fn().mockResolvedValue(undefined)
    };
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
    send = vi.fn<(message: SentMessage) => void>();
    connectionStub = {
      connectWithRetry: vi.fn().mockResolvedValue(rootClient),
      setAdapterPolicy: vi.fn(),
      setupEventHandlers: vi.fn(),
      initializeSession: vi.fn(),
      sendLaunchRequest: vi.fn(),
      sendAttachRequest: vi.fn(),
      setBreakpoints: vi.fn(),
      sendConfigurationDone: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined)
    };
    const dependencies: DapProxyDependencies = {
      fileSystem: createMockFileSystem(),
      loggerFactory: vi.fn().mockResolvedValue(mockLogger),
      processSpawner: createMockProcessSpawner(),
      dapClientFactory: { create: vi.fn().mockReturnValue(rootClient) },
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
