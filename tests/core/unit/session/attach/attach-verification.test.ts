/**
 * verifyAttachThreads: the poll that makes "attached" mean "debuggable".
 * The window is the caller's (`verifyTimeout`): the call answers by its end
 * whatever the worker does (issue #1213).
 */
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { verifyAttachThreads } from '../../../../../src/session/attach/attach-verification.js';

type Probe = (timeoutMs: number) => Promise<DebugProtocol.ThreadsResponse | undefined>;

function fakeProxy(probe: Probe) {
  const proxy = new EventEmitter() as EventEmitter & {
    sendDapRequest: ReturnType<typeof vi.fn>;
    getAdapterStderrTail: () => string | undefined;
  };
  proxy.sendDapRequest = vi.fn((_command: string, _args: unknown, options: { timeoutMs: number }) => probe(options.timeoutMs));
  proxy.getAdapterStderrTail = () => undefined;
  return proxy;
}

const ctx = { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } } as never;
const threads = (list: DebugProtocol.Thread[]): DebugProtocol.ThreadsResponse =>
  ({ seq: 0, type: 'response', request_seq: 1, command: 'threads', success: true, body: { threads: list } });

describe('verifyAttachThreads', () => {
  it('answers with the threads the debugger reports, and bounds the request by the window', async () => {
    const proxy = fakeProxy(async () => threads([{ id: 1, name: 'main' }]));

    const result = await verifyAttachThreads(ctx, { proxyManager: proxy as never, verifyTimeoutMs: 400, pollIntervalMs: 20 });

    expect(result).toEqual({ ok: true, threads: [{ id: 1, name: 'main' }] });
    const bound = proxy.sendDapRequest.mock.calls[0][2].timeoutMs as number;
    expect(bound).toBeGreaterThan(0);
    expect(bound).toBeLessThanOrEqual(400);
  });

  it("leaves no timer behind when the debugger answers: the window's own timer is cleared", async () => {
    vi.useFakeTimers();
    try {
      const proxy = fakeProxy(async () => threads([{ id: 1, name: 'main' }]));
      const result = await verifyAttachThreads(ctx, { proxyManager: proxy as never, verifyTimeoutMs: 20000, pollIntervalMs: 250 });
      expect(result.ok).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('polls again while the debugger reports no thread yet', async () => {
    let calls = 0;
    const proxy = fakeProxy(async () => (++calls < 3 ? threads([]) : threads([{ id: 7, name: 'worker' }])));

    const result = await verifyAttachThreads(ctx, { proxyManager: proxy as never, verifyTimeoutMs: 1000, pollIntervalMs: 10 });

    expect(result).toEqual({ ok: true, threads: [{ id: 7, name: 'worker' }] });
    expect(calls).toBe(3);
  });

  it("returns by the window's end when nothing answers the request at all (issue #1213)", async () => {
    // A worker that is itself stopped answers nothing; the parent's backstop
    // rejects a margin after the request's own bound, naming a longer time
    // than the window the caller asked for.
    const backstop = vi.fn();
    const proxy = fakeProxy(
      (timeoutMs) =>
        new Promise((_, reject) => {
          setTimeout(() => {
            backstop();
            reject(new Error("Debug adapter did not respond to 'threads' request within 25s."));
          }, timeoutMs + 1500);
        })
    );
    const started = Date.now();

    const result = await verifyAttachThreads(ctx, { proxyManager: proxy as never, verifyTimeoutMs: 150, pollIntervalMs: 20 });

    const took = Date.now() - started;
    expect(result.ok).toBe(false);
    // The window, plus the grace for a worker's own answer; not the backstop's margin.
    expect(took).toBeLessThan(150 + 250 + 400);
    expect(backstop).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, proxyGone: false });
    expect((result as { lastFailure: string }).lastFailure).toBe("the debug adapter did not answer 'threads' before the window closed");
    // One request: the window closed while it was out.
    expect(proxy.sendDapRequest).toHaveBeenCalledTimes(1);
  });

  it("still quotes the worker's own timeout, which arrives a little after the request's bound", async () => {
    const proxy = fakeProxy(
      (timeoutMs) =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Request 'threads' timed out after ${timeoutMs}ms`)), timeoutMs + 30);
        })
    );

    const result = await verifyAttachThreads(ctx, { proxyManager: proxy as never, verifyTimeoutMs: 120, pollIntervalMs: 20 });

    expect(result.ok).toBe(false);
    expect((result as { lastFailure: string }).lastFailure).toMatch(/^Request 'threads' timed out after \d+ms$/);
  });

  it('a late rejection of the abandoned request is nobody\'s error', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const proxy = fakeProxy(
        (timeoutMs) =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('backstop')), timeoutMs + 320);
          })
      );
      await verifyAttachThreads(ctx, { proxyManager: proxy as never, verifyTimeoutMs: 40, pollIntervalMs: 10 });
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('reports the adapter going away as that, failing fast instead of waiting out the window', async () => {
    const proxy = fakeProxy(() => new Promise(() => undefined));
    setTimeout(() => proxy.emit('exit', 1, undefined, false), 20);
    const started = Date.now();

    const result = await verifyAttachThreads(ctx, { proxyManager: proxy as never, verifyTimeoutMs: 5000, pollIntervalMs: 10 });

    expect(Date.now() - started).toBeLessThan(500);
    expect(result).toMatchObject({ ok: false, proxyGone: true, lastFailure: 'it exited (code=1)' });
  });

  it('wakes a poll-interval sleep immediately when the proxy errors mid-poll, leaving no timer behind', async () => {
    vi.useFakeTimers();
    try {
      const proxy = fakeProxy(async () => threads([]));
      const pending = verifyAttachThreads(ctx, { proxyManager: proxy as never, verifyTimeoutMs: 20000, pollIntervalMs: 5000 });
      await vi.advanceTimersByTimeAsync(10);
      proxy.emit('error', new Error('ptrace EPERM'));

      const result = await pending;
      expect(result).toEqual({ ok: false, proxyGone: true, lastFailure: 'ptrace EPERM' });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
