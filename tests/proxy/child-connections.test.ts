/**
 * ChildConnections (the session tree, issue #1081): the worker-side holder of
 * the children an adapter reports. A report is held unanswered while the parent
 * process decides; releasing answers it `success: false` (debugpy then unblocks
 * the child itself); a report nobody answers is released by a safety timer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { ChildConnections } from '../../src/proxy/child-connections.js';
import type { StatusMessage } from '../../src/proxy/dap-proxy-interfaces.js';
import { createMockDapClient } from '../test-utils/mocks/dap-client.js';

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
