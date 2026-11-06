/**
 * ChildConnections (the session tree, issue #1081): the worker-side holder of
 * the children an adapter reports. A report is held unanswered while the parent
 * process decides; releasing answers it `success: false` (debugpy then unblocks
 * the child itself); a report nobody answers is released by a safety timer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { ChildConnections, type ChildAdoptionDeps } from '../../src/proxy/child-connections.js';
import type { IDapClientFactory, StatusMessage } from '../../src/proxy/dap-proxy-interfaces.js';
import { createMockDapClient } from '../test-utils/mocks/dap-client.js';
import { JsDebugAdapterPolicy, PythonAdapterPolicy, type AdapterPolicy } from '@debugmcp/shared';

const configuration = { type: 'python', name: 'Subprocess 37012', subProcessId: 37012, connect: { host: '127.0.0.1', port: 5678 } };
const report = { targetId: '37012', name: 'Subprocess 37012', configuration };

function startDebugging(seq: number): DebugProtocol.Request {
  return { seq, type: 'request', command: 'startDebugging', arguments: { request: 'attach', configuration } };
}

describe('ChildConnections: holding and releasing a reported child', () => {
  const sent: StatusMessage[] = [];
  const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() };
  let connections: ChildConnections;
  let root: ReturnType<typeof createMockDapClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    sent.length = 0;
    root = createMockDapClient();
    connections = new ChildConnections({
      messageSender: { send: (message: unknown) => { sent.push(message as StatusMessage); } },
      logger
    });
    connections.attach(root, 'py-root');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports a held child to the parent process, stamped with the reporting connection', () => {
    root.emit('child-report', { request: startDebugging(7), report });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: 'status',
      status: 'child_reported',
      sessionId: 'py-root',
      targetId: '37012',
      name: 'Subprocess 37012',
      configuration
    });
    expect(typeof sent[0].reportId).toBe('string');
    expect(root.respondToReverseRequest).not.toHaveBeenCalled();
  });

  it('release answers the held request success:false once', () => {
    root.emit('child-report', { request: startDebugging(7), report });
    const reportId = sent[0].reportId as string;

    expect(connections.release(reportId, 'over the child cap')).toBe(true);
    expect(connections.release(reportId, 'again')).toBe(false);

    expect(root.respondToReverseRequest).toHaveBeenCalledTimes(1);
    expect(root.respondToReverseRequest).toHaveBeenCalledWith(
      expect.objectContaining({ seq: 7, command: 'startDebugging' }),
      {},
      false,
      'over the child cap'
    );
  });

  it('releases a report nobody answered when the safety timer fires', () => {
    root.emit('child-report', { request: startDebugging(7), report });

    vi.advanceTimersByTime(29_999);
    expect(root.respondToReverseRequest).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(root.respondToReverseRequest).toHaveBeenCalledWith(
      expect.objectContaining({ seq: 7 }),
      {},
      false,
      expect.stringContaining('no answer')
    );
  });

  it('releaseAllHeld releases every held report', () => {
    root.emit('child-report', { request: startDebugging(7), report });
    root.emit('child-report', { request: startDebugging(8), report: { ...report, targetId: '37013', name: 'Subprocess 37013' } });

    connections.releaseAllHeld('worker shutdown');

    expect(root.respondToReverseRequest).toHaveBeenCalledTimes(2);
    expect(root.respondToReverseRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({ seq: 7 }), {}, false, 'worker shutdown');
    expect(root.respondToReverseRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({ seq: 8 }), {}, false, 'worker shutdown');
    expect(connections.release(sent[0].reportId as string, 'again')).toBe(false);
  });

  it('knows no child connection before any adoption', () => {
    expect(connections.has('py-root')).toBe(false);
    expect(connections.has('child-1')).toBe(false);
    expect(connections.liveCount()).toBe(0);
  });
});

describe('ChildConnections: adopting a reported child', () => {
  const sent: Array<Record<string, unknown>> = [];
  const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() };
  let root: ReturnType<typeof createMockDapClient>;
  let childClient: ReturnType<typeof createMockDapClient>;
  let calls: string[];
  let resolveAttach: () => void;
  let rejectAttach: (error: Error) => void;
  let connectionManager: {
    initializeSession: ReturnType<typeof vi.fn>;
    sendAttachRequest: ReturnType<typeof vi.fn>;
    setExceptionBreakpoints: ReturnType<typeof vi.fn>;
    setBreakpoints: ReturnType<typeof vi.fn>;
    sendConfigurationDone: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  let dapClientFactory: { create: ReturnType<typeof vi.fn> };
  let connections: ChildConnections;
  let adoptionDeps: ChildAdoptionDeps;

  const sentOf = (type: string, extra: (m: Record<string, unknown>) => boolean = () => true) =>
    sent.filter((m) => m.type === type && extra(m));

  beforeEach(() => {
    sent.length = 0;
    calls = [];
    root = createMockDapClient();
    childClient = createMockDapClient();
    dapClientFactory = { create: vi.fn().mockReturnValue(childClient) };
    connectionManager = {
      initializeSession: vi.fn(async () => {
        calls.push('initialize');
        return { supportsConfigurationDoneRequest: true };
      }),
      sendAttachRequest: vi.fn(() => {
        calls.push('attach');
        return new Promise<void>((resolve, reject) => {
          resolveAttach = resolve;
          rejectAttach = reject;
        });
      }),
      setExceptionBreakpoints: vi.fn(async () => {
        calls.push('setExceptionBreakpoints');
        return { body: {} };
      }),
      setBreakpoints: vi.fn(async (_client: unknown, file: string) => {
        calls.push(`setBreakpoints:${file.split(/[\\/]/).pop()}`);
        return { body: { breakpoints: [{ verified: true, id: 3, line: 7 }] } };
      }),
      sendConfigurationDone: vi.fn(async () => {
        calls.push('configurationDone');
        // debugpy answers the attach only after configurationDone.
        resolveAttach();
      }),
      disconnect: vi.fn(async () => {
        calls.push('disconnect');
      })
    };
    adoptionDeps = {
        dapClientFactory: dapClientFactory as unknown as IDapClientFactory,
        connectionManager: connectionManager as unknown as ChildAdoptionDeps['connectionManager'],
        policy: PythonAdapterPolicy,
        host: '127.0.0.1',
        port: 5678,
        adapterId: 'python',
        breakOnExceptions: 'uncaught'
      };
    connections = new ChildConnections({
      messageSender: { send: (message: unknown) => { sent.push(message as Record<string, unknown>); } },
      logger,
      adoption: adoptionDeps
    });
    connections.attach(root, 'py-root');
  });

  function reportAChild(seq = 7): string {
    root.emit('child-report', { request: startDebugging(seq), report });
    const status = sentOf('status', (m) => m.status === 'child_reported').at(-1)!;
    return status.reportId as string;
  }

  /** Start an adoption and let its initialize and attach go out. */
  async function startAdoption(childId = 'child-1') {
    const reportId = reportAChild();
    const adopting = connections.adopt(childId, { reportId, breakpoints: [{ file: '/w/child.py', line: 7 }] });
    await new Promise((resolve) => setImmediate(resolve));
    return { reportId, adopting };
  }

  async function adopted(childId = 'child-1') {
    const started = await startAdoption(childId);
    childClient.emit('initialized');
    const result = await started.adopting;
    return { ...started, result };
  }

  it("opens a labelled connection and runs debugpy's order: initialize, attach, initialized, breakpoints, configurationDone", async () => {
    const { adopting } = await startAdoption();

    expect(dapClientFactory.create).toHaveBeenCalledWith('127.0.0.1', 5678, PythonAdapterPolicy, { traceLabel: 'child:child-1' });
    expect(childClient.connect).toHaveBeenCalledTimes(1);
    expect(connectionManager.initializeSession).toHaveBeenCalledWith(childClient, 'child-1', 'python');
    expect(connectionManager.sendAttachRequest).toHaveBeenCalledWith(childClient, { ...configuration, redirectOutput: true });
    // The attach is out and the handshake waits for initialized: nothing else yet.
    expect(calls).toEqual(['initialize', 'attach']);

    childClient.emit('initialized');
    const result = await adopting;

    expect(calls).toEqual(['initialize', 'attach', 'setExceptionBreakpoints', 'setBreakpoints:child.py', 'configurationDone']);
    expect(connectionManager.setExceptionBreakpoints).toHaveBeenCalledWith(childClient, ['uncaught']);
    expect(result).toEqual({ sessionId: 'child-1', capabilities: { supportsConfigurationDoneRequest: true } });
    expect(root.respondToReverseRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 7 }), {}, true, undefined);
    expect(connections.has('child-1')).toBe(true);
    expect(connections.liveCount()).toBe(1);
  });

  it("echoes the child's breakpoint answers as breakpoints_synced on the child's session", async () => {
    await adopted();

    const synced = sentOf('status', (m) => m.status === 'breakpoints_synced');
    expect(synced).toHaveLength(1);
    expect(synced[0]).toMatchObject({
      sessionId: 'child-1',
      breakpoints: [{ file: '/w/child.py', line: 7, verified: true, adapterId: 3, boundLine: 7 }]
    });
  });

  it("forwards the child connection's events tagged with the child's session", async () => {
    await adopted();

    childClient.emit('stopped', { threadId: 1, reason: 'breakpoint' });
    childClient.emit('output', { category: 'stdout', output: 'child start\n' });

    expect(sentOf('dapEvent')).toEqual([
      expect.objectContaining({ sessionId: 'child-1', event: 'stopped', body: { threadId: 1, reason: 'breakpoint' } }),
      expect.objectContaining({ sessionId: 'child-1', event: 'output', body: { category: 'stdout', output: 'child start\n' } })
    ]);
  });

  it('a child connection that closes after terminated reports an expected close and leaves the map', async () => {
    const onEmpty = vi.fn();
    connections.on('empty', onEmpty);
    await adopted();

    childClient.emit('terminated', {});
    childClient.emit('close');

    expect(sentOf('dapEvent', (m) => m.event === 'terminated')).toHaveLength(1);
    expect(sentOf('status', (m) => m.status === 'dap_connection_closed')).toEqual([
      expect.objectContaining({ sessionId: 'child-1', expected: true })
    ]);
    expect(connections.has('child-1')).toBe(false);
    expect(connections.liveCount()).toBe(0);
    expect(onEmpty).toHaveBeenCalledTimes(1);
  });

  it('a child connection that drops before terminated reports an unexpected close', async () => {
    await adopted();

    childClient.emit('close');

    expect(sentOf('status', (m) => m.status === 'dap_connection_closed')).toEqual([
      expect.objectContaining({ sessionId: 'child-1', expected: false })
    ]);
  });

  it('a refused attach releases the held request, shuts the connection and rejects the adoption', async () => {
    const { adopting } = await startAdoption();

    rejectAttach(new Error('attach refused'));
    await expect(adopting).rejects.toThrow('attach refused');

    expect(root.respondToReverseRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 7 }), {}, false, expect.stringContaining('attach refused'));
    expect(childClient.shutdown).toHaveBeenCalled();
    expect(connections.has('child-1')).toBe(false);
  });

  it('close disconnects the child with the requested terminateDebuggee and forgets it', async () => {
    const onEmpty = vi.fn();
    connections.on('empty', onEmpty);
    await adopted();

    await expect(connections.close('child-1', { terminateDebuggee: true })).resolves.toBe(true);

    expect(connectionManager.disconnect).toHaveBeenCalledWith(childClient, true);
    expect(childClient.shutdown).toHaveBeenCalled();
    expect(connections.has('child-1')).toBe(false);
    expect(onEmpty).toHaveBeenCalledTimes(1);
    await expect(connections.close('child-1', { terminateDebuggee: true })).resolves.toBe(false);
  });

  it('closeAll disconnects every child connection without terminating them', async () => {
    await adopted('child-1');
    const second = createMockDapClient();
    dapClientFactory.create.mockReturnValueOnce(second);
    const reportId = reportAChild(8);
    const adopting = connections.adopt('child-2', { reportId, breakpoints: [] });
    await new Promise((resolve) => setImmediate(resolve));
    second.emit('initialized');
    await adopting;
    expect(connections.liveCount()).toBe(2);

    await connections.closeAll('worker shutdown');

    expect(connectionManager.disconnect).toHaveBeenCalledTimes(2);
    expect(connectionManager.disconnect).toHaveBeenCalledWith(childClient, false);
    expect(connectionManager.disconnect).toHaveBeenCalledWith(second, false);
    expect(connections.liveCount()).toBe(0);
  });

  it("a grandchild reported on the child's connection is stamped with the child's session", async () => {
    await adopted();

    childClient.emit('child-report', { request: startDebugging(9), report: { ...report, targetId: '37013', name: 'Subprocess 37013' } });

    expect(sentOf('status', (m) => m.status === 'child_reported').at(-1)).toMatchObject({
      sessionId: 'child-1',
      targetId: '37013',
      name: 'Subprocess 37013'
    });
  });

  it('reserves a connecting child and cancels it when close races with connect', async () => {
    let connected!: () => void;
    childClient.connect.mockImplementation(() => new Promise<void>((resolve) => { connected = resolve; }));
    const adopting = connections.adopt('child-1', { reportId: reportAChild() });
    const rejected = expect(adopting).rejects.toThrow('closed during adoption');
    expect(connections.liveCount()).toBe(1);
    expect(connections.clientOf('child-1')).toBe(childClient);

    await connections.close('child-1', { terminateDebuggee: true });
    await rejected;
    connected();
    await new Promise((resolve) => setImmediate(resolve));

    expect(connectionManager.initializeSession).not.toHaveBeenCalled();
    expect(connections.liveCount()).toBe(0);
    expect(root.respondToReverseRequest).toHaveBeenCalledTimes(1);
    expect(root.respondToReverseRequest).toHaveBeenCalledWith(startDebugging(7), {}, false, expect.any(String));
  });

  it('cancels a handshake waiting for initialized without waiting for its timeout', async () => {
    const { adopting } = await startAdoption();
    const rejected = expect(adopting).rejects.toThrow('closed during adoption');
    await connections.closeAll('shutdown');
    await rejected;
    childClient.emit('initialized');
    expect(connectionManager.sendConfigurationDone).not.toHaveBeenCalled();
    expect(childClient.listenerCount('initialized')).toBe(0);
    expect(connections.liveCount()).toBe(0);
  });

  it('rejects a duplicate session while its first connection is still opening', async () => {
    childClient.connect.mockImplementation(() => new Promise<void>(() => {}));
    const adopting = connections.adopt('child-1', { reportId: reportAChild() });
    const rejected = expect(adopting).rejects.toThrow('closed during adoption');
    const secondReport = reportAChild(8);
    await expect(connections.adopt('child-1', { reportId: secondReport })).rejects.toThrow('already has a connection');
    expect(connections.release(secondReport, 'duplicate')).toBe(true);
    await connections.closeAll('shutdown');
    await rejected;
  });

  it('releases the report if the client factory throws', async () => {
    dapClientFactory.create.mockImplementation(() => { throw new Error('factory failed'); });
    await expect(connections.adopt('child-1', { reportId: reportAChild() })).rejects.toThrow('factory failed');
    expect(root.respondToReverseRequest).toHaveBeenCalledWith(startDebugging(7), {}, false, expect.stringContaining('factory failed'));
    expect(connections.liveCount()).toBe(0);
  });

  it('signals empty after the last pending adoption fails, allowing deferred worker shutdown', async () => {
    const empty = vi.fn();
    connections.on('empty', empty);
    const { adopting } = await startAdoption();
    rejectAttach(new Error('attach failed'));
    await expect(adopting).rejects.toThrow('attach failed');
    expect(empty).toHaveBeenCalledTimes(1);
    expect(connections.liveCount()).toBe(0);
  });

  it('cancels adoption when its socket closes and reports an unexpected close', async () => {
    const { adopting } = await startAdoption();
    const rejected = expect(adopting).rejects.toThrow('connection closed during adoption');
    childClient.emit('close');
    await rejected;
    expect(sentOf('status', (m) => m.status === 'dap_connection_closed')).toEqual([
      expect.objectContaining({ sessionId: 'child-1', expected: false })
    ]);
    expect(connections.liveCount()).toBe(0);
  });

  it('releases a timed-out handshake and removes its initialized listener', async () => {
    adoptionDeps.initializedTimeoutMs = 1;
    await expect(connections.adopt('child-1', { reportId: reportAChild() })).rejects.toThrow('Timeout waiting for initialized');
    expect(childClient.listenerCount('initialized')).toBe(0);
    expect(childClient.shutdown).toHaveBeenCalled();
    expect(root.respondToReverseRequest).toHaveBeenCalledWith(startDebugging(7), {}, false, expect.stringContaining('Timeout'));
  });

  it('rejects unknown reports and adapters without an adoption contract', async () => {
    await expect(connections.adopt('child-1', { reportId: 'missing' })).rejects.toThrow('unknown or already answered');
    const unsupported = new ChildConnections({ messageSender: { send: vi.fn() }, logger });
    await expect(unsupported.adopt('child-1', { reportId: 'missing' })).rejects.toThrow('reports no child processes');
  });

  it('rejects new reports and adoptions after shutdown and releases held reports', async () => {
    reportAChild();
    await connections.closeAll('shutdown');
    root.emit('child-report', { request: startDebugging(8), report });
    await expect(connections.adopt('child-1', { reportId: 'missing' })).rejects.toThrow('shutting down');
    expect(root.respondToReverseRequest).toHaveBeenCalledTimes(2);
    expect(sentOf('status', (m) => m.status === 'child_reported')).toHaveLength(1);
  });

  it('forwards errors as child errors, preserving both Error and non-Error messages', async () => {
    await adopted();
    childClient.emit('error', new Error('socket failed'));
    childClient.emit('error', 'adapter failed');
    expect(sentOf('error')).toEqual([
      { type: 'error', sessionId: 'child-1', message: 'socket failed' },
      { type: 'error', sessionId: 'child-1', message: 'adapter failed' }
    ]);
  });

  it.each(['none', undefined] as const)('does not install exception filters when mode is %s', async (mode) => {
    adoptionDeps.breakOnExceptions = mode;
    await adopted();
    expect(connectionManager.setExceptionBreakpoints).not.toHaveBeenCalled();
  });

  it('continues the handshake when exception breakpoint installation fails', async () => {
    connectionManager.setExceptionBreakpoints.mockRejectedValueOnce('unsupported filters');
    await adopted();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('unsupported filters'));
    expect(connectionManager.sendConfigurationDone).toHaveBeenCalled();
  });

  it('echoes function breakpoint answers and incomplete line breakpoint answers', async () => {
    const functionBreakpoints = [{ name: 'worker', condition: 'x > 0' }, { name: 'missing' }];
    childClient.sendRequest.mockResolvedValueOnce({ body: { breakpoints: [
      { verified: true, id: 12, line: 9, source: { path: '/w/child.py' }, message: 'bound' }
    ] } });
    connectionManager.setBreakpoints.mockResolvedValueOnce({ body: { breakpoints: [{ verified: false, message: 'not executable' }] } });
    const adopting = connections.adopt('child-1', {
      reportId: reportAChild(),
      breakpoints: [{ id: 'bp-1', file: '/w/child.py', line: 7 }, { file: '/w/child.py', line: 8 }],
      functionBreakpoints
    });
    await new Promise((resolve) => setImmediate(resolve));
    childClient.emit('initialized');
    await adopting;
    expect(childClient.sendRequest).toHaveBeenCalledWith('setFunctionBreakpoints', { breakpoints: functionBreakpoints });
    expect(sentOf('status', (m) => m.status === 'function_breakpoints_synced')).toEqual([
      expect.objectContaining({ sessionId: 'child-1', functionBreakpoints: [
        { name: 'worker', verified: true, id: 12, line: 9, source: '/w/child.py', message: 'bound' },
        { name: 'missing', verified: false }
      ] })
    ]);
    expect(sentOf('status', (m) => m.status === 'breakpoints_synced')).toEqual([
      expect.objectContaining({ breakpoints: [
        { id: 'bp-1', file: '/w/child.py', line: 7, verified: false, message: 'not executable' },
        { file: '/w/child.py', line: 8, verified: false }
      ] })
    ]);
  });

  it('continues adoption if function breakpoints are unsupported', async () => {
    childClient.sendRequest.mockRejectedValueOnce(new Error('unsupported functions'));
    const adopting = connections.adopt('child-1', { reportId: reportAChild(), functionBreakpoints: [{ name: 'worker' }] });
    await new Promise((resolve) => setImmediate(resolve));
    childClient.emit('initialized');
    await adopting;
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('unsupported functions'));
    expect(connectionManager.sendConfigurationDone).toHaveBeenCalled();
  });

  it('forgets a closed child even when disconnect and shutdown throw', async () => {
    await adopted();
    connectionManager.disconnect.mockRejectedValueOnce('disconnect failed');
    childClient.shutdown.mockImplementation(() => { throw new Error('shutdown failed'); });
    await expect(connections.close('child-1', { terminateDebuggee: false })).resolves.toBe(true);
    childClient.emit('close');
    expect(sentOf('status', (m) => m.status === 'dap_connection_closed')).toHaveLength(0);
    expect(connections.liveCount()).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('disconnect failed'));
  });

  it('skips exception filters when the policy has none for this launch', async () => {
    adoptionDeps.policy = { ...PythonAdapterPolicy, exceptionFiltersForLaunch: () => [] };
    await adopted();
    expect(connectionManager.setExceptionBreakpoints).not.toHaveBeenCalled();
  });

  it('marks every requested breakpoint unverified when the adapter omits breakpoint answers', async () => {
    connectionManager.setBreakpoints.mockResolvedValueOnce({});
    childClient.sendRequest.mockResolvedValueOnce({});
    const adopting = connections.adopt('child-1', {
      reportId: reportAChild(), breakpoints: [{ file: '/w/child.py', line: 7 }], functionBreakpoints: [{ name: 'worker' }]
    });
    await new Promise((resolve) => setImmediate(resolve));
    childClient.emit('initialized');
    await adopting;
    expect(sentOf('status', (m) => m.status === 'breakpoints_synced')).toEqual([
      expect.objectContaining({ breakpoints: [{ file: '/w/child.py', line: 7, verified: false }] })
    ]);
    expect(sentOf('status', (m) => m.status === 'function_breakpoints_synced')).toEqual([
      expect.objectContaining({ functionBreakpoints: [{ name: 'worker', verified: false }] })
    ]);
  });

  it('releases the report after a non-Error connection failure even if shutdown throws', async () => {
    childClient.connect.mockRejectedValueOnce('connection refused');
    childClient.shutdown.mockImplementationOnce(() => { throw new Error('cleanup failed'); });
    await expect(connections.adopt('child-1', { reportId: reportAChild() })).rejects.toBe('connection refused');
    expect(root.respondToReverseRequest).toHaveBeenCalledWith(startDebugging(7), {}, false, 'adoption failed: connection refused');
    expect(connections.liveCount()).toBe(0);
  });

  it('preserves Error messages when exception setup and disconnect fail', async () => {
    connectionManager.setExceptionBreakpoints.mockRejectedValueOnce(new Error('exception setup failed'));
    await adopted();
    connectionManager.disconnect.mockRejectedValueOnce(new Error('disconnect unavailable'));
    await connections.close('child-1', { terminateDebuggee: false });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('exception setup failed'));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('disconnect unavailable'));
  });

  it('releases held grandchildren before closing their reporting socket, leaving other reports held', async () => {
    await adopted();
    childClient.emit('child-report', { request: startDebugging(9), report: { ...report, targetId: '37013' } });
    const grandchildReportId = sentOf('status', (m) => m.status === 'child_reported').at(-1)!.reportId as string;
    const siblingReportId = reportAChild(10);
    root.respondToReverseRequest.mockClear();

    await connections.close('child-1', { terminateDebuggee: true });

    expect(childClient.respondToReverseRequest).toHaveBeenCalledWith(startDebugging(9), {}, false, 'reporting child session closed');
    expect(childClient.respondToReverseRequest.mock.invocationCallOrder[0]).toBeLessThan(connectionManager.disconnect.mock.invocationCallOrder[0]);
    expect(root.respondToReverseRequest).not.toHaveBeenCalled();
    expect(connections.release(grandchildReportId, 'already released')).toBe(false);
    expect(connections.release(siblingReportId, 'sibling remains available')).toBe(true);
  });
});

/**
 * js-debug's shapes (issue #1082): the report is acked the moment it is held
 * (its answer decides nothing), release is a throwaway attach-then-detach
 * on a fresh connection, and every connection opened here runs the
 * child-safe policy.
 */
describe('ChildConnections under the throwaway-attach lever (js-debug, issue #1082)', () => {
  const sent: Array<Record<string, unknown>> = [];
  const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() };
  const jsConfiguration = { type: 'pwa-node', name: 'child.js [4242]', __pendingTargetId: 'a1b2c3d4e5f60718293a4b5c' };
  const jsReport = { targetId: 'a1b2c3d4e5f60718293a4b5c', name: 'child.js [4242]', configuration: jsConfiguration };
  const jsStartDebugging = (seq: number): DebugProtocol.Request =>
    ({ seq, type: 'request', command: 'startDebugging', arguments: { request: 'launch', configuration: jsConfiguration } });
  let root: ReturnType<typeof createMockDapClient>;
  let childClient: ReturnType<typeof createMockDapClient>;
  let releaseClient: ReturnType<typeof createMockDapClient>;
  let resolveAttach: () => void;
  let rejectAttach: (error: Error) => void;
  let dapClientFactory: { create: ReturnType<typeof vi.fn> };
  let connections: ChildConnections;

  const sentOf = (type: string, extra: (m: Record<string, unknown>) => boolean = () => true) =>
    sent.filter((m) => m.type === type && extra(m));
  const reported = () => sentOf('status', (m) => m.status === 'child_reported');

  function build(options: { releaseTimeoutMs?: number; launchConfig?: Record<string, unknown> } = {}): void {
    sent.length = 0;
    vi.clearAllMocks();
    root = createMockDapClient();
    childClient = createMockDapClient();
    releaseClient = createMockDapClient();
    dapClientFactory = {
      create: vi.fn((_host: string, _port: number, _policy: unknown, opts?: { traceLabel?: string }) =>
        opts?.traceLabel?.startsWith('release:') ? releaseClient : childClient)
    };
    const connectionManager = {
      initializeSession: vi.fn(async () => ({ supportsConfigurationDoneRequest: true })),
      sendAttachRequest: vi.fn(() => new Promise<void>((resolve, reject) => { resolveAttach = resolve; rejectAttach = reject; })),
      setExceptionBreakpoints: vi.fn(async () => ({ body: {} })),
      setBreakpoints: vi.fn(async () => ({ body: { breakpoints: [{ verified: false }] } })),
      sendConfigurationDone: vi.fn(async () => { resolveAttach(); }),
      disconnect: vi.fn(async () => {})
    };
    connections = new ChildConnections({
      messageSender: { send: (message: unknown) => { sent.push(message as Record<string, unknown>); } },
      logger,
      ...(options.releaseTimeoutMs !== undefined ? { releaseTimeoutMs: options.releaseTimeoutMs } : {}),
      adoption: {
        dapClientFactory: dapClientFactory as unknown as IDapClientFactory,
        connectionManager: connectionManager as unknown as ChildAdoptionDeps['connectionManager'],
        policy: JsDebugAdapterPolicy,
        host: '127.0.0.1',
        port: 9229,
        adapterId: 'pwa-node',
        breakOnExceptions: 'none',
        ...(options.launchConfig ? { launchConfig: options.launchConfig as never } : {})
      }
    });
    connections.attach(root, 'js-root');
  }

  beforeEach(() => build());

  /** The release client's sequence, driven to its end (the ready signal posted after the attach). */
  async function throwawayRan(client: ReturnType<typeof createMockDapClient>): Promise<void> {
    await vi.waitFor(() => expect(client.sendRequest).toHaveBeenCalledWith('attach', expect.anything(), expect.anything()));
    client.emit('event', { event: 'thread', body: { reason: 'started', threadId: 1 } });
    await vi.waitFor(() => expect(client.shutdown).toHaveBeenCalledWith('release complete'));
  }

  it('answers the report success once when it is held, and the adoption never answers it again', async () => {
    root.emit('child-report', { request: jsStartDebugging(7), report: jsReport });
    expect(reported()).toHaveLength(1);
    expect(root.respondToReverseRequest).toHaveBeenCalledTimes(1);
    expect(root.respondToReverseRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 7 }), {}, true, undefined);

    const adopting = connections.adopt('child-1', { reportId: reported()[0].reportId as string, breakpoints: [{ file: '/w/child.js', line: 14 }] });
    await new Promise((resolve) => setImmediate(resolve));
    childClient.emit('initialized');
    await adopting;

    expect(root.respondToReverseRequest).toHaveBeenCalledTimes(1);
    expect(connections.has('child-1')).toBe(true);
  });

  it('opens the child connection with the child-safe policy and the measured attach body', async () => {
    root.emit('child-report', { request: jsStartDebugging(7), report: jsReport });
    const adopting = connections.adopt('child-1', { reportId: reported()[0].reportId as string, breakpoints: [] });
    await new Promise((resolve) => setImmediate(resolve));
    childClient.emit('initialized');
    await adopting;

    const [, , policy, options] = dapClientFactory.create.mock.calls[0];
    expect(options).toEqual({ traceLabel: 'child:child-1' });
    expect(policy).not.toBe(JsDebugAdapterPolicy);
    expect((policy as AdapterPolicy).supportsReverseStartDebugging).toBe(false);
    expect((policy as AdapterPolicy).childAdoption).toBe(JsDebugAdapterPolicy.childAdoption);
    const deps = (connections as unknown as { options: { adoption: ChildAdoptionDeps } }).options.adoption;
    expect(deps.connectionManager.sendAttachRequest).toHaveBeenCalledWith(childClient, {
      type: 'pwa-node',
      request: 'attach',
      __pendingTargetId: 'a1b2c3d4e5f60718293a4b5c',
      continueOnAttach: true
    });
  });

  it("forwards an attach root's extras into the child attach (issue #466)", async () => {
    build({ launchConfig: { request: 'attach', port: 9229, localRoot: '/l', remoteRoot: '/r' } });
    root.emit('child-report', { request: jsStartDebugging(7), report: jsReport });
    const adopting = connections.adopt('child-1', { reportId: reported()[0].reportId as string, breakpoints: [] });
    await new Promise((resolve) => setImmediate(resolve));
    childClient.emit('initialized');
    await adopting;

    const deps = (connections as unknown as { options: { adoption: ChildAdoptionDeps } }).options.adoption;
    expect(deps.connectionManager.sendAttachRequest).toHaveBeenCalledWith(childClient, expect.objectContaining({ localRoot: '/l', remoteRoot: '/r', __pendingTargetId: 'a1b2c3d4e5f60718293a4b5c' }));
    expect(deps.connectionManager.sendAttachRequest).toHaveBeenCalledWith(childClient, expect.not.objectContaining({ port: 9229 }));
  });

  it('release runs the throwaway attach on a fresh child-safe connection and never refuses the request', async () => {
    root.emit('child-report', { request: jsStartDebugging(7), report: jsReport });
    const reportId = reported()[0].reportId as string;

    expect(connections.release(reportId, 'over the child cap')).toBe(true);
    expect(connections.release(reportId, 'again')).toBe(false);
    await throwawayRan(releaseClient);

    expect(dapClientFactory.create).toHaveBeenCalledWith('127.0.0.1', 9229, expect.objectContaining({ supportsReverseStartDebugging: false }), { traceLabel: 'release:a1b2c3d4' });
    expect(releaseClient.sendRequest.mock.calls.map(([command]) => command)).toEqual(['initialize', 'configurationDone', 'attach', 'disconnect']);
    expect(releaseClient.sendRequest).toHaveBeenCalledWith('attach', expect.objectContaining({ __pendingTargetId: 'a1b2c3d4e5f60718293a4b5c', continueOnAttach: true }), 15000);
    expect(releaseClient.sendRequest).toHaveBeenCalledWith('disconnect', { terminateDebuggee: false }, 3000);
    expect(root.respondToReverseRequest).toHaveBeenCalledTimes(1);
    expect(root.respondToReverseRequest).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), false, expect.anything());
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('released to run UNDEBUGGED'));
    expect(connections.liveCount()).toBe(0);
  });

  it('the safety timer releases by throwaway too', async () => {
    build({ releaseTimeoutMs: 20 });
    root.emit('child-report', { request: jsStartDebugging(7), report: jsReport });

    await throwawayRan(releaseClient);

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('no answer from the server within 20 ms'));
    expect(root.respondToReverseRequest).toHaveBeenCalledTimes(1);
  });

  it('a process reported on the throwaway connection in the release window is held on the session the released child was reported on', async () => {
    root.emit('child-report', { request: jsStartDebugging(7), report: jsReport });
    connections.release(reported()[0].reportId as string, 'over the child cap');
    await vi.waitFor(() => expect(releaseClient.sendRequest).toHaveBeenCalledWith('attach', expect.anything(), expect.anything()));

    const grandchild = { targetId: 'ffff0000', name: 'grandchild.js [9]', configuration: { type: 'pwa-node', name: 'grandchild.js [9]', __pendingTargetId: 'ffff0000' } };
    releaseClient.emit('child-report', { request: jsStartDebugging(9), report: grandchild });

    expect(reported().at(-1)).toMatchObject({ sessionId: 'js-root', targetId: 'ffff0000', name: 'grandchild.js [9]' });
    expect(releaseClient.respondToReverseRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 9 }), {}, true, undefined);
    releaseClient.emit('event', { event: 'thread', body: {} });
    await vi.waitFor(() => expect(releaseClient.shutdown).toHaveBeenCalled());
  });

  it("a report relayed from the program target's connection is answered on that connection", () => {
    const programTarget = createMockDapClient();
    root.emit('child-report', { request: jsStartDebugging(7), report: jsReport, client: programTarget });

    expect(reported()[0]).toMatchObject({ sessionId: 'js-root', targetId: 'a1b2c3d4e5f60718293a4b5c' });
    expect(programTarget.respondToReverseRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 7 }), {}, true, undefined);
    expect(root.respondToReverseRequest).not.toHaveBeenCalled();
  });

  it('an adoption that fails does not refuse the request either, and tears its connection down', async () => {
    root.emit('child-report', { request: jsStartDebugging(7), report: jsReport });
    const adopting = connections.adopt('child-1', { reportId: reported()[0].reportId as string, breakpoints: [] });
    await new Promise((resolve) => setImmediate(resolve));
    rejectAttach(new Error('attach refused'));
    await expect(adopting).rejects.toThrow('attach refused');

    expect(root.respondToReverseRequest).toHaveBeenCalledTimes(1);
    expect(root.respondToReverseRequest).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), false, expect.anything());
    expect(childClient.shutdown).toHaveBeenCalled();
    expect(connections.has('child-1')).toBe(false);
  });

  it('a report during worker shutdown is acked and left parked, with a warning', async () => {
    await connections.closeAll('worker shutdown');
    root.emit('child-report', { request: jsStartDebugging(7), report: jsReport });

    expect(reported()).toHaveLength(0);
    expect(root.respondToReverseRequest).toHaveBeenCalledWith(expect.objectContaining({ seq: 7 }), {}, true, undefined);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('stays parked'));
    expect(dapClientFactory.create).not.toHaveBeenCalled();
  });
});
