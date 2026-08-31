import { EventEmitter } from 'node:events';
import { SessionState } from '@debugmcp/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IProxyManager } from '../../../../src/proxy/proxy-manager.js';
import { PauseCoordinator } from '../../../../src/session/execution/pause-coordinator.js';
import type { ManagedSession } from '../../../../src/session/session-store.js';

function fixture() {
  const proxy = new EventEmitter() as EventEmitter & {
    sendDapRequest: ReturnType<typeof vi.fn>;
  };
  proxy.sendDapRequest = vi.fn();
  const session = {
    id: 'session-1',
    state: SessionState.RUNNING,
    proxyGeneration: 7
  } as ManagedSession;
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
  return {
    proxy,
    session,
    coordinator: new PauseCoordinator({ logger })
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('PauseCoordinator', () => {
  it('arms intent and listeners before dispatch and observes a synchronous stop', async () => {
    const { proxy, session, coordinator } = fixture();
    proxy.sendDapRequest.mockImplementation(() => {
      expect(session.pauseIntent).toMatchObject({ generation: 7, source: 'user' });
      expect(proxy.listenerCount('stopped')).toBe(1);
      proxy.emit('stopped', { reason: 'pause', threadId: 1 });
      return Promise.resolve({ success: true });
    });

    await expect(coordinator.requestPause({
      session,
      proxyManager: proxy as unknown as IProxyManager,
      threadId: 1,
      timeoutMs: 50,
      source: 'user'
    })).resolves.toEqual({ status: 'observed' });
    expect(session.pauseIntent).toBeUndefined();
    expect(proxy.listenerCount('stopped')).toBe(0);
  });

  it('keeps current-generation intent armed when an accepted pause is pending', async () => {
    vi.useFakeTimers();
    const { proxy, session, coordinator } = fixture();
    proxy.sendDapRequest.mockResolvedValue({ success: true });

    const result = coordinator.requestPause({
      session,
      proxyManager: proxy as unknown as IProxyManager,
      threadId: 4,
      timeoutMs: 25,
      source: 'attach'
    });
    await vi.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toEqual({ status: 'pending' });
    expect(session.pauseIntent).toMatchObject({ generation: 7, source: 'attach' });
    expect(proxy.listenerCount('stopped')).toBe(0);
  });

  it('clears intent and returns a rejected outcome when dispatch fails', async () => {
    const { proxy, session, coordinator } = fixture();
    const error = new Error('pause rejected');
    proxy.sendDapRequest.mockRejectedValue(error);

    await expect(coordinator.requestPause({
      session,
      proxyManager: proxy as unknown as IProxyManager,
      threadId: 2,
      timeoutMs: 50,
      source: 'user'
    })).resolves.toEqual({ status: 'rejected', error });
    expect(session.pauseIntent).toBeUndefined();
  });
});
