import { EventEmitter } from 'node:events';
import { SessionState } from '@debugmcp/shared';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { IProxyManager } from '../../../../src/proxy/proxy-manager.js';
import { PauseCoordinator } from '../../../../src/session/execution/pause-coordinator.js';
import type { ManagedSession } from '../../../../src/session/session-store.js';

function fixture(policy: { pauseWakeExpression?: string } = {}) {
  const proxy = new EventEmitter() as EventEmitter & {
    sendDapRequest: Mock<
      (
        command: string,
        args?: unknown,
        options?: { timeoutMs?: number }
      ) => Promise<Partial<DebugProtocol.Response>>
    >;
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
    logger,
    coordinator: new PauseCoordinator({ logger, selectPolicy: () => policy as never })
  };
}

const WAKE = 'WAKE()';
/** The commands the coordinator sent, in order. */
const commands = (proxy: { sendDapRequest: Mock }) => proxy.sendDapRequest.mock.calls.map((call) => call[0]);
const request = (session: ManagedSession, proxy: unknown, timeoutMs = 50) => ({
  session,
  proxyManager: proxy as IProxyManager,
  threadId: 1,
  timeoutMs,
  source: 'user' as const
});

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

  describe('a pause needs something to land on (issue #1146)', () => {
    it("evaluates the policy's wake expression before it arms and requests the pause", async () => {
      const { proxy, session, coordinator } = fixture({ pauseWakeExpression: WAKE });
      proxy.sendDapRequest.mockImplementation((command: string) => {
        if (command === 'evaluate') {
          // Nothing is armed while the debugger's own code runs in the target.
          expect(session.pauseIntent).toBeUndefined();
          return Promise.resolve({ success: true });
        }
        expect(session.pauseIntent).toMatchObject({ generation: 7, source: 'user' });
        proxy.emit('stopped', { reason: 'pause', threadId: 1 });
        return Promise.resolve({ success: true });
      });

      await expect(coordinator.requestPause(request(session, proxy))).resolves.toEqual({ status: 'observed' });

      expect(commands(proxy)).toEqual(['evaluate', 'pause']);
      const [, args, options] = proxy.sendDapRequest.mock.calls[0];
      expect(args).toEqual({ expression: WAKE, context: 'repl' });
      // Bounded: a target that cannot answer must not hold the pause back for 30 s.
      expect(options?.timeoutMs).toBeGreaterThan(0);
      expect(options?.timeoutMs).toBeLessThanOrEqual(2000);
    });

    it('evaluates nothing for a policy without a wake expression', async () => {
      const { proxy, session, coordinator } = fixture();
      proxy.sendDapRequest.mockImplementation(() => {
        proxy.emit('stopped', { reason: 'pause', threadId: 1 });
        return Promise.resolve({ success: true });
      });

      await coordinator.requestPause(request(session, proxy));

      expect(commands(proxy)).toEqual(['pause']);
    });

    it('evaluates nothing while a pause of this generation is still armed', async () => {
      // The wake is itself an evaluation: under an armed pause it is the very
      // thing the pause would fire inside.
      vi.useFakeTimers();
      const { proxy, session, coordinator } = fixture({ pauseWakeExpression: WAKE });
      proxy.sendDapRequest.mockResolvedValue({ success: true });
      const first = coordinator.requestPause(request(session, proxy, 25));
      await vi.advanceTimersByTimeAsync(25);
      await expect(first).resolves.toEqual({ status: 'pending' });
      expect(commands(proxy)).toEqual(['evaluate', 'pause']);

      const second = coordinator.requestPause(request(session, proxy, 25));
      await vi.advanceTimersByTimeAsync(25);
      await expect(second).resolves.toEqual({ status: 'pending' });

      expect(commands(proxy)).toEqual(['evaluate', 'pause', 'pause']);
    });

    it('evaluates again once the armed pause belongs to an earlier proxy generation', async () => {
      const { proxy, session, coordinator } = fixture({ pauseWakeExpression: WAKE });
      session.pauseIntent = { generation: 6, source: 'user', armedAt: 1 };
      proxy.sendDapRequest.mockImplementation((command: string) => {
        if (command === 'pause') proxy.emit('stopped', { reason: 'pause', threadId: 1 });
        return Promise.resolve({ success: true });
      });

      await coordinator.requestPause(request(session, proxy));

      expect(commands(proxy)).toEqual(['evaluate', 'pause']);
    });

    it('still requests the pause when the wake evaluation is refused or never answered', async () => {
      const { proxy, session, coordinator, logger } = fixture({ pauseWakeExpression: WAKE });
      proxy.sendDapRequest.mockImplementation((command: string) => {
        if (command === 'evaluate') return Promise.reject(new Error("Request 'evaluate' timed out after 1s"));
        proxy.emit('stopped', { reason: 'pause', threadId: 1 });
        return Promise.resolve({ success: true });
      });

      await expect(coordinator.requestPause(request(session, proxy))).resolves.toEqual({ status: 'observed' });

      expect(commands(proxy)).toEqual(['evaluate', 'pause']);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Request 'evaluate' timed out after 1s"));
    });

    it('answers with a stop that lands during the wake, and requests no pause', async () => {
      const { proxy, session, coordinator } = fixture({ pauseWakeExpression: WAKE });
      proxy.sendDapRequest.mockImplementation(() => {
        // A breakpoint hit while the wake was in flight: the core has paused the session.
        session.lastStop = { reason: 'breakpoint' } as ManagedSession['lastStop'];
        session.state = SessionState.PAUSED;
        proxy.emit('stopped', { reason: 'breakpoint', threadId: 1 });
        return Promise.resolve({ success: true });
      });

      await expect(coordinator.requestPause(request(session, proxy))).resolves.toEqual({ status: 'observed' });

      expect(commands(proxy)).toEqual(['evaluate']);
      expect(session.pauseIntent).toBeUndefined();
      expect(proxy.listenerCount('stopped')).toBe(0);
    });

    it('reports a session that ended during the wake, and requests no pause', async () => {
      const { proxy, session, coordinator } = fixture({ pauseWakeExpression: WAKE });
      proxy.sendDapRequest.mockImplementation(() => {
        proxy.emit('terminated');
        return Promise.resolve({ success: true });
      });

      await expect(coordinator.requestPause(request(session, proxy))).resolves.toMatchObject({
        status: 'rejected',
        ended: true
      });

      expect(commands(proxy)).toEqual(['evaluate']);
      expect(session.pauseIntent).toBeUndefined();
    });

    it.each([
      "Request 'pause' timed out after 30s",
      "Debug adapter did not respond to 'pause' request within 35s. This typically means the debug adapter has crashed or lost connection."
    ])('keeps the intent armed when the pause request got no answer: %s', async (message) => {
      // No answer is not a refusal: the request may still be queued in a
      // target that is busy in native code, and will arm when it returns.
      const { proxy, session, coordinator } = fixture();
      const error = new Error(message);
      proxy.sendDapRequest.mockRejectedValue(error);

      await expect(coordinator.requestPause(request(session, proxy))).resolves.toEqual({ status: 'rejected', error });

      expect(session.pauseIntent).toMatchObject({ generation: 7, source: 'user' });
    });
  });
});
