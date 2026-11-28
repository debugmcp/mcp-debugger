/**
 * ProxyManager.sendDapRequest under a Deadline.
 *
 * Two boundaries: at the deadline nothing new is sent; a request already
 * sent keeps its pending entry until the deadline plus PARENT_GRACE_MS, so
 * the worker's own answer, its timeout diagnostics included, can still win;
 * at that backstop the entry is removed and a later answer is dropped. A
 * cancellation from outside removes the entry at once. The two waits a
 * request can make before its pending entry exists (a child view's wait for
 * its adoption, the root's launch barrier) are bounded by the same deadline.
 * A request without a deadline is bounded exactly as before.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  deadline,
  DeadlineExpired,
  DebugLanguage,
  PARENT_GRACE_MS,
  type AdapterLaunchBarrier,
  type IFileSystem,
  type ILogger,
  type IProxyProcess,
  type IProxyProcessLauncher
} from '@debugmcp/shared';
import { ProxyManager } from '../../../src/proxy/proxy-manager.js';
import { CHILD_ADOPT_COMMAND } from '../../../src/proxy/dap-proxy-interfaces.js';
import type { ProxyConfig } from '../../../src/proxy/proxy-config.js';

class FakeProxyProcess extends EventEmitter implements IProxyProcess {
  sessionId = 'root';
  pid = 4242;
  killed = false;
  exitCode: number | null = null;
  signalCode: string | null = null;
  stdin: NodeJS.WritableStream | null = null;
  stdout: NodeJS.ReadableStream | null = null;
  stderr: NodeJS.ReadableStream | null = new EventEmitter() as unknown as NodeJS.ReadableStream;
  send = vi.fn().mockReturnValue(true);
  sendCommand = vi.fn();
  kill = vi.fn().mockReturnValue(true);
  waitForInitialization = vi.fn().mockResolvedValue(undefined);
}

interface DapCommand { cmd: string; sessionId: string; requestId: string; dapCommand: string; timeoutMs?: number }

const config: ProxyConfig = {
  sessionId: 'root',
  language: DebugLanguage.PYTHON,
  executablePath: 'python',
  adapterHost: '127.0.0.1',
  adapterPort: 5678,
  logDir: './.tmp/logs',
  scriptPath: './tests/fixtures/parent.py'
};

const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown): void => { unhandled.push(reason); };

describe('ProxyManager.sendDapRequest under a deadline', () => {
  let fakeProcess: FakeProxyProcess;
  let root: ProxyManager;
  let logger: ILogger;

  const sentDap = (): DapCommand[] =>
    fakeProcess.sendCommand.mock.calls.map(([cmd]) => cmd as DapCommand).filter((cmd) => cmd.cmd === 'dap');
  const pending = (): number => (root as unknown as { pendingDapRequests: Map<string, unknown> }).pendingDapRequests.size;
  const mirrored = (): number =>
    ((root as unknown as { dapState: { pendingRequests: Map<string, unknown> } | null }).dapState?.pendingRequests.size) ?? 0;

  function answer(cmd: DapCommand, opts: { success?: boolean; message?: string; body?: unknown; sessionId?: string } = {}): void {
    const success = opts.success ?? true;
    fakeProcess.emit('message', {
      type: 'dapResponse',
      sessionId: opts.sessionId ?? cmd.sessionId,
      requestId: cmd.requestId,
      success,
      body: opts.body ?? {},
      // A worker timeout travels as `error` with no DAP response (handleRequestTimeout).
      ...(success
        ? { response: { type: 'response', seq: 1, request_seq: 1, success, command: cmd.dapCommand, body: opts.body ?? {} } }
        : { error: opts.message })
    });
  }

  function watch<T>(promise: Promise<T>): { state: 'pending' | 'resolved' | 'rejected'; value?: T; error?: Error; at?: number } {
    const started = Date.now();
    const outcome: { state: 'pending' | 'resolved' | 'rejected'; value?: T; error?: Error; at?: number } = { state: 'pending' };
    promise.then(
      (value) => { outcome.state = 'resolved'; outcome.value = value; outcome.at = Date.now() - started; },
      (error: Error) => { outcome.state = 'rejected'; outcome.error = error; outcome.at = Date.now() - started; }
    );
    return outcome;
  }

  beforeEach(async () => {
    unhandled.length = 0;
    process.on('unhandledRejection', onUnhandled);
    fakeProcess = new FakeProxyProcess();
    fakeProcess.sendCommand.mockImplementation((cmd: { cmd: string; sessionId: string }) => {
      if (cmd.cmd === 'init') {
        process.nextTick(() => {
          fakeProcess.emit('message', { type: 'status', status: 'init_received', sessionId: cmd.sessionId });
          setImmediate(() => {
            fakeProcess.emit('message', { type: 'status', status: 'adapter_connected', sessionId: cmd.sessionId });
          });
        });
      }
    });
    const launcher: IProxyProcessLauncher = {
      launchProxy: vi.fn().mockImplementation(() => {
        setImmediate(() => fakeProcess.emit('spawn'));
        return fakeProcess;
      })
    };
    const fileSystem = { pathExists: vi.fn().mockResolvedValue(true) } as unknown as IFileSystem;
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as ILogger;
    root = new ProxyManager(null, launcher, fileSystem, logger);
    await root.start(config);
    (root as unknown as { isInitialized: boolean }).isInitialized = true;
    fakeProcess.sendCommand.mockClear();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    fakeProcess.removeAllListeners();
    root.removeAllListeners();
    await new Promise((resolve) => setImmediate(resolve));
    process.off('unhandledRejection', onUnhandled);
    expect(unhandled).toEqual([]);
  });

  it('gives the worker the time that remains, or the caller\'s timeout when that is less', async () => {
    const d = deadline(1000);
    await vi.advanceTimersByTimeAsync(400);
    void root.sendDapRequest('threads', {}, { deadline: d }).catch(() => {});
    void root.sendDapRequest('stackTrace', { threadId: 1 }, { deadline: d, timeoutMs: 100 }).catch(() => {});
    void root.sendDapRequest('scopes', { frameId: 1 }, { deadline: d, timeoutMs: 5000 }).catch(() => {});

    expect(sentDap().map((cmd) => [cmd.dapCommand, cmd.timeoutMs])).toEqual([
      ['threads', 600],
      ['stackTrace', 100],
      ['scopes', 600]
    ]);
    d.dispose();
    await vi.advanceTimersByTimeAsync(0);
  });

  it('sends nothing once the deadline has passed', async () => {
    const d = deadline(100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(root.sendDapRequest('threads', {}, { deadline: d })).rejects.toBeInstanceOf(DeadlineExpired);
    expect(sentDap()).toHaveLength(0);
    expect(pending()).toBe(0);
  });

  it('an answer at budget + 100 ms wins', async () => {
    const d = deadline(1000);
    const r = watch(root.sendDapRequest('threads', {}, { deadline: d }));
    await vi.advanceTimersByTimeAsync(1100);
    expect(r.state).toBe('pending');
    expect(pending()).toBe(1);
    answer(sentDap()[0], { body: { threads: [{ id: 1, name: 'main' }] } });
    await vi.advanceTimersByTimeAsync(0);
    expect(r.state).toBe('resolved');
    expect(pending()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('the worker\'s own timeout answer inside the grace wins, so its diagnostics reach the caller', async () => {
    const d = deadline(1000);
    const r = watch(root.sendDapRequest('stackTrace', { threadId: 1 }, { deadline: d }));
    await vi.advanceTimersByTimeAsync(1010);
    answer(sentDap()[0], { success: false, message: "Request 'stackTrace' timed out after 1000ms" });
    await vi.advanceTimersByTimeAsync(0);
    expect(r.state).toBe('rejected');
    expect(r.error!.message).toBe("Request 'stackTrace' timed out after 1000ms");
  });

  it('no answer through budget + 250 ms: the bound\'s failure, no entry, no timer, and the late answer dropped', async () => {
    const d = deadline(1000);
    const r = watch(root.sendDapRequest('stackTrace', { threadId: 1 }, { deadline: d }));
    expect(mirrored()).toBe(1);

    await vi.advanceTimersByTimeAsync(1000 + PARENT_GRACE_MS - 1);
    expect(r.state).toBe('pending');
    expect(pending()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(r).toMatchObject({ state: 'rejected', at: 1000 + PARENT_GRACE_MS });
    expect(r.error!.message).toMatch(/^Debug adapter did not respond to 'stackTrace' request within 1000 ms \(the deadline it was sent under, and a 250 ms grace after it\)/);
    expect(r.error!.cause).toBeInstanceOf(DeadlineExpired);
    expect(pending()).toBe(0);
    expect(mirrored()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    // The worker answers at last: dropped, quietly.
    answer(sentDap()[0], { body: { stackFrames: [] } });
    await vi.advanceTimersByTimeAsync(0);
    expect(r.state).toBe('rejected');
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Received response for unknown/cancelled request'));
  });

  it('an outside abort during the grace removes the entry at once', async () => {
    const outside = new AbortController();
    const d = deadline(1000, { parent: outside.signal });
    const r = watch(root.sendDapRequest('threads', {}, { deadline: d }));
    await vi.advanceTimersByTimeAsync(1050);
    expect(pending()).toBe(1);
    outside.abort();
    expect(pending()).toBe(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(r).toMatchObject({ state: 'rejected', at: 1050 });
    expect((r.error as DeadlineExpired).why).toBe('cancelled');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a parent deadline disposed before the deadline removes a child\'s entry at once', async () => {
    const parent = deadline(5000);
    const r = watch(root.sendDapRequest('threads', {}, { deadline: parent.child(1000) }));
    await vi.advanceTimersByTimeAsync(300);
    parent.dispose();
    expect(pending()).toBe(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(r).toMatchObject({ state: 'rejected', at: 300 });
    expect((r.error as DeadlineExpired).why).toBe('cancelled');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('expiry while the request is wrapped in race: the race answers at the deadline, the entry keeps its grace', async () => {
    const d = deadline(1000);
    const request = root.sendDapRequest('threads', {}, { deadline: d });
    const raced = watch(d.race(request));
    const direct = watch(request);

    await vi.advanceTimersByTimeAsync(1000);
    expect(raced).toMatchObject({ state: 'rejected', at: 1000 });
    expect(pending()).toBe(1);
    await vi.advanceTimersByTimeAsync(PARENT_GRACE_MS);
    expect(direct.state).toBe('rejected');
    expect(pending()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('expiry while the request is wrapped in race, then dispose: the entry goes at the dispose', async () => {
    const d = deadline(1000);
    const request = root.sendDapRequest('threads', {}, { deadline: d });
    const raced = watch(d.race(request));
    request.catch(() => {});
    await vi.advanceTimersByTimeAsync(1000);
    expect(raced.state).toBe('rejected');
    d.dispose();
    expect(pending()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a stalled launch barrier is bounded too: abandoned at the backstop and disposed', async () => {
    let settle!: (error: Error) => void;
    const barrier: AdapterLaunchBarrier = {
      awaitResponse: false,
      onRequestSent: vi.fn(),
      onProxyStatus: vi.fn(),
      onDapEvent: vi.fn(),
      onProxyExit: vi.fn(),
      // Never ready on its own; its dispose settles it, as the contract requires.
      waitUntilReady: () => new Promise<void>((_resolve, reject) => { settle = reject; }),
      dispose: vi.fn(() => settle?.(new Error('barrier disposed')))
    };
    const createLaunchBarrier = vi.fn(() => barrier);
    (root as unknown as { adapter: unknown }).adapter = { createLaunchBarrier };

    const d = deadline(1000);
    const r = watch(root.sendDapRequest('launch', {}, { deadline: d }));
    expect(sentDap().map((cmd) => [cmd.dapCommand, cmd.timeoutMs])).toEqual([['launch', 1000]]);

    await vi.advanceTimersByTimeAsync(1000 + PARENT_GRACE_MS);
    expect(r).toMatchObject({ state: 'rejected', at: 1000 + PARENT_GRACE_MS });
    expect(r.error!.message).toMatch(/did not respond to 'launch' request within 1000 ms/);
    expect(barrier.dispose).toHaveBeenCalled();
    expect((root as unknown as { activeLaunchBarrier: unknown }).activeLaunchBarrier).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    // Once the deadline has passed, the launch is not sent, and no barrier is made for it.
    createLaunchBarrier.mockClear();
    fakeProcess.sendCommand.mockClear();
    await expect(root.sendDapRequest('launch', {}, { deadline: d })).rejects.toBeInstanceOf(DeadlineExpired);
    expect(createLaunchBarrier).not.toHaveBeenCalled();
    expect(sentDap()).toHaveLength(0);
  });

  it('a child\'s wait for its adoption ends at the deadline, and the adoption\'s late completion does not send the command', async () => {
    const view = root.createChildView!('c1');
    const adopting = view.adopt({ reportId: 'report-1', breakpoints: [] });
    const adoptCommand = sentDap().find((cmd) => cmd.dapCommand === CHILD_ADOPT_COMMAND)!;
    expect(adoptCommand).toBeDefined();

    const d = deadline(1000);
    const r = watch(view.sendDapRequest('stackTrace', { threadId: 1 }, { deadline: d }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(r).toMatchObject({ state: 'rejected', at: 1000 });
    expect((r.error as DeadlineExpired).why).toBe('budget');
    expect(vi.getTimerCount()).toBe(1); // the adoption's own (no-deadline) backstop, nothing of the deadline's

    // The adoption answers late; the stackTrace it was holding is not sent.
    answer(adoptCommand, { sessionId: 'c1', body: { sessionId: 'c1' } });
    await adopting;
    await vi.advanceTimersByTimeAsync(0);
    expect(sentDap().filter((cmd) => cmd.dapCommand === 'stackTrace')).toHaveLength(0);
  });

  it('an adopted child\'s request carries the deadline to the worker and keeps its grace', async () => {
    const view = root.createChildView!('c2');
    const adopting = view.adopt({ reportId: 'report-2', breakpoints: [] });
    answer(sentDap().find((cmd) => cmd.dapCommand === CHILD_ADOPT_COMMAND)!, { sessionId: 'c2', body: { sessionId: 'c2' } });
    await adopting;
    fakeProcess.sendCommand.mockClear();

    const d = deadline(1000);
    await vi.advanceTimersByTimeAsync(200);
    const r = watch(view.sendDapRequest('stackTrace', { threadId: 1 }, { deadline: d }));
    expect(sentDap().map((cmd) => [cmd.sessionId, cmd.dapCommand, cmd.timeoutMs])).toEqual([['c2', 'stackTrace', 800]]);
    await vi.advanceTimersByTimeAsync(800 + PARENT_GRACE_MS);
    expect(r).toMatchObject({ state: 'rejected', at: 800 + PARENT_GRACE_MS });
    expect(pending()).toBe(0);
  });

  it('without a deadline a request is bounded as before: its timeout and the parent margin', async () => {
    const r = watch(root.sendDapRequest('threads', {}, { timeoutMs: 1000 }));
    expect(sentDap()[0].timeoutMs).toBe(1000);
    await vi.advanceTimersByTimeAsync(5999);
    expect(r.state).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(r).toMatchObject({ state: 'rejected', at: 6000 });
    expect(r.error!.message).toMatch(/^Debug adapter did not respond to 'threads' request within 6s\./);
    expect(pending()).toBe(0);

    const plain = watch(root.sendDapRequest('threads', {}));
    expect(sentDap()[1]).not.toHaveProperty('timeoutMs');
    await vi.advanceTimersByTimeAsync(35_000);
    expect(plain).toMatchObject({ state: 'rejected', at: 35_000 });
  });
});
