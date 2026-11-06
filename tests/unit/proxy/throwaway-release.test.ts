/**
 * The throwaway release (issues #501, #1082): the sequence that lets a
 * js-debug pending target run undebugged — attach with its id, let the
 * resume land, detach with the target kept — on a client it always shuts
 * down, never throwing.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { JsDebugAdapterPolicy } from '@debugmcp/shared';
import { releaseByThrowawayAttach } from '../../../src/proxy/throwaway-release.js';
import { createMockDapClient } from '../../test-utils/mocks/dap-client.js';

const logger = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() };
const attachArguments = { type: 'pwa-node', request: 'attach', __pendingTargetId: 'fork-1', continueOnAttach: true };

describe('releaseByThrowawayAttach', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('connects, initializes, configures, attaches, waits for the ready signal, detaches with the target kept, and shuts down', async () => {
    const client = createMockDapClient();
    client.sendRequest.mockImplementation(async (command: string) => {
      if (command === 'attach') {
        // js-debug posts `thread` once the target runs: the ready signal.
        setImmediate(() => client.emit('event', { event: 'thread', body: { reason: 'started', threadId: 1 } }));
      }
      return { body: {} };
    });

    const released = await releaseByThrowawayAttach({ client, policy: JsDebugAdapterPolicy, attachArguments, label: 'fork-1', logger });

    expect(released).toBe(true);
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.sendRequest.mock.calls.map(([command]) => command)).toEqual(['initialize', 'configurationDone', 'attach', 'disconnect']);
    expect(client.sendRequest).toHaveBeenCalledWith('initialize', expect.objectContaining({ adapterID: 'pwa-node', clientID: 'mcp-release-fork-1' }), 5000);
    expect(client.sendRequest).toHaveBeenCalledWith('attach', attachArguments, 15000);
    expect(client.sendRequest).toHaveBeenCalledWith('disconnect', { terminateDebuggee: false }, 3000);
    expect(client.shutdown).toHaveBeenCalledWith('release complete');
  });

  it('detaches after the ready-signal window when the adapter posts nothing, and tolerates a refused configurationDone', async () => {
    vi.useFakeTimers();
    const client = createMockDapClient();
    client.sendRequest.mockImplementation(async (command: string) => {
      if (command === 'configurationDone') {
        throw new Error('not required');
      }
      return { body: {} };
    });

    const releasing = releaseByThrowawayAttach({ client, policy: JsDebugAdapterPolicy, attachArguments, label: 'fork-1', logger });
    await vi.advanceTimersByTimeAsync(1_600);
    const released = await releasing;

    expect(released).toBe(true);
    expect(client.sendRequest).toHaveBeenCalledWith('disconnect', { terminateDebuggee: false }, 3000);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('configurationDone failed'));
  });

  it('reports failure without throwing when the attach is refused, and still shuts the client down', async () => {
    const client = createMockDapClient();
    client.sendRequest.mockImplementation(async (command: string) => {
      if (command === 'attach') {
        throw new Error('no such pending target');
      }
      return { body: {} };
    });

    const released = await releaseByThrowawayAttach({ client, policy: JsDebugAdapterPolicy, attachArguments, label: 'fork-1', logger });

    expect(released).toBe(false);
    expect(client.sendRequest).not.toHaveBeenCalledWith('disconnect', expect.anything(), expect.anything());
    expect(client.shutdown).toHaveBeenCalledWith('release complete');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('no such pending target'));
  });

  it('gives up on the whole sequence after its deadline', async () => {
    vi.useFakeTimers();
    const client = createMockDapClient();
    client.sendRequest.mockImplementation((command: string) =>
      command === 'attach' ? new Promise(() => {}) : Promise.resolve({ body: {} })
    );

    const releasing = releaseByThrowawayAttach({ client, policy: JsDebugAdapterPolicy, attachArguments, label: 'fork-1', logger, timeoutMs: 2_000 });
    await vi.advanceTimersByTimeAsync(2_100);
    const released = await releasing;

    expect(released).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('timed out'));
    expect(client.shutdown).toHaveBeenCalledWith('release complete');
  });
});
