/**
 * The frame-anchor resolver's wait for a ready stack keeps its stated bound
 * (the session layer's first loop on the shared Deadline).
 *
 * The resolver is driven over the real ProxyManager and a fake worker on a
 * fake clock, so a stalled dependency is stalled the way it is in
 * production: the worker never answers, and the only things that can end
 * the wait are the parent's own timers. Each case states the window it
 * waits in (3,000 ms, polled every 250 ms) and the grace a request already
 * sent may take to answer (250 ms), and checks three things: the answer
 * comes within the window plus the grace, the sentence that names a bound
 * names the window, and nothing (no timer, no pending request) is left
 * when it returns.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { DebugProtocol } from '@vscode/debugprotocol';
import {
  DebugLanguage,
  SessionState,
  type AdapterPolicy,
  type IFileSystem,
  type ILogger,
  type IProxyProcess,
  type IProxyProcessLauncher
} from '@debugmcp/shared';
import { ProxyManager, type IProxyManager } from '../../../../../src/proxy/proxy-manager.js';
import type { ProxyConfig } from '../../../../../src/proxy/proxy-config.js';
import {
  FrameAnchorResolver,
  type FrameAnchorContext,
  type StackTraceResult
} from '../../../../../src/session/inspection/frame-anchor-resolver.js';
import type { ManagedSession } from '../../../../../src/session/session-store.js';

const WINDOW_MS = 3000;
const INTERVAL_MS = 250;
const GRACE_MS = 250;

const FRAME: DebugProtocol.StackFrame = { id: 7, name: 'Program.Main', source: { path: '/work/Program.cs' }, line: 12, column: 1 };
const SIBLING_FRAME: DebugProtocol.StackFrame = { id: 9, name: 'Worker.Run', source: { path: '/work/Worker.cs' }, line: 40, column: 1 };

class FakeProxyProcess extends EventEmitter implements IProxyProcess {
  sessionId = 's1';
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

interface DapCommand {
  cmd: string;
  sessionId: string;
  requestId: string;
  dapCommand: string;
  dapArgs?: { threadId?: number };
  timeoutMs?: number;
}

/** What the fake worker does with one request: answer now, answer after a delay, or never. */
type WorkerAnswer = { body: unknown } | { body: unknown; afterMs: number } | 'never';

const config: ProxyConfig = {
  sessionId: 's1',
  language: DebugLanguage.PYTHON,
  executablePath: 'python',
  adapterHost: '127.0.0.1',
  adapterPort: 5678,
  logDir: './.tmp/logs',
  scriptPath: './tests/fixtures/parent.py'
};

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as ILogger;
/** A policy with no opinions: frames are program frames when they name a source. */
const policy = {} as AdapterPolicy;

describe('FrameAnchorResolver waitForReadyStack keeps its window', () => {
  let fakeProcess: FakeProxyProcess;
  let root: ProxyManager;
  let answer: (command: DapCommand, now: number) => WorkerAnswer;
  let session: ManagedSession;
  let started: number;

  const sent = (): DapCommand[] =>
    fakeProcess.sendCommand.mock.calls.map(([cmd]) => cmd as DapCommand).filter((cmd) => cmd.cmd === 'dap');

  function respond(command: DapCommand, body: unknown): void {
    fakeProcess.emit('message', {
      type: 'dapResponse',
      sessionId: command.sessionId,
      requestId: command.requestId,
      success: true,
      body,
      response: { type: 'response', seq: 1, request_seq: 1, success: true, command: command.dapCommand, body }
    });
  }

  beforeEach(async () => {
    fakeProcess = new FakeProxyProcess();
    answer = () => 'never';
    intervalMs = INTERVAL_MS;
    fakeProcess.sendCommand.mockImplementation((cmd: DapCommand) => {
      if (cmd.cmd === 'init') {
        process.nextTick(() => {
          fakeProcess.emit('message', { type: 'status', status: 'init_received', sessionId: cmd.sessionId });
          setImmediate(() => {
            fakeProcess.emit('message', { type: 'status', status: 'adapter_connected', sessionId: cmd.sessionId });
          });
        });
        return;
      }
      if (cmd.cmd !== 'dap') return;
      const what = answer(cmd, Date.now() - started);
      if (what === 'never') return;
      if ('afterMs' in what) {
        setTimeout(() => respond(cmd, what.body), what.afterMs);
      } else {
        queueMicrotask(() => respond(cmd, what.body));
      }
    });
    const launcher: IProxyProcessLauncher = {
      launchProxy: vi.fn().mockImplementation(() => {
        setImmediate(() => fakeProcess.emit('spawn'));
        return fakeProcess;
      })
    };
    const fileSystem = { pathExists: vi.fn().mockResolvedValue(true) } as unknown as IFileSystem;
    root = new ProxyManager(null, launcher, fileSystem, logger);
    await root.start(config);
    (root as unknown as { isInitialized: boolean }).isInitialized = true;
    root.setCurrentThreadId(1);
    fakeProcess.sendCommand.mockClear();
    session = {
      id: 's1',
      language: DebugLanguage.PYTHON,
      state: SessionState.PAUSED,
      lastStop: { reason: 'breakpoint', threadId: 1, timestamp: 1 },
      proxyManager: root
    } as unknown as ManagedSession;
    // Faked from here: every timer the wait, the deadline and the manager arm.
    vi.useFakeTimers();
    started = Date.now();
  });

  afterEach(() => {
    vi.useRealTimers();
    fakeProcess.removeAllListeners();
    root.removeAllListeners();
  });

  let intervalMs = INTERVAL_MS;

  function resolver(proxyManager: IProxyManager = root): FrameAnchorResolver {
    session.proxyManager = proxyManager;
    const ctx: FrameAnchorContext = {
      logger,
      tunables: { pausedStackReadyTimeoutMs: WINDOW_MS, pausedStackReadyIntervalMs: intervalMs },
      getSession: () => session,
      selectPolicy: () => policy
    };
    return new FrameAnchorResolver(ctx);
  }

  /**
   * Run one implicit read to its answer on the fake clock and say when it
   * came (in virtual ms) and what it was. `limitMs` is how far the clock is
   * run before giving up: well past the bound, so a wait that does not keep
   * it shows by how much.
   */
  async function read(limitMs = 40_000, proxyManager: IProxyManager = root): Promise<{
    at: number | undefined;
    result?: StackTraceResult;
    error?: Error;
  }> {
    const outcome: { at?: number; result?: StackTraceResult; error?: Error } = {};
    void resolver(proxyManager).resolve('s1', undefined, false, { ensureStackReady: true }).then(
      (result) => { outcome.at = Date.now() - started; outcome.result = result; },
      (error: Error) => { outcome.at = Date.now() - started; outcome.error = error; }
    );
    for (let elapsed = 0; elapsed < limitMs && outcome.at === undefined; elapsed += 10) {
      await vi.advanceTimersByTimeAsync(10);
    }
    return { at: outcome.at, result: outcome.result, error: outcome.error };
  }

  const pending = (): number => (root as unknown as { pendingDapRequests: Map<string, unknown> }).pendingDapRequests.size;

  const boundNote = new RegExp(`^The stopped thread reported no stack frames within ${WINDOW_MS}ms`);

  it('answers within the window plus the grace when the stopped thread\'s stackTrace stalls in the wait', async () => {
    let first = true;
    answer = (cmd) => {
      if (cmd.dapCommand === 'threads') return { body: { threads: [{ id: 1, name: 'main' }] } };
      if (cmd.dapCommand === 'stackTrace' && first) {
        first = false;
        return { body: { stackFrames: [] } };
      }
      return 'never';
    };

    const { at, result, error } = await read();

    expect(at).toBeDefined();
    expect(at!).toBeLessThanOrEqual(WINDOW_MS + GRACE_MS);
    expect(error).toBeUndefined();
    expect(result!.note).toMatch(boundNote);
    expect(vi.getTimerCount()).toBe(0);
    expect(pending()).toBe(0);
  });

  it('gives the stopped thread\'s stackTrace in the wait the time that remains, never more', async () => {
    let calls = 0;
    answer = (cmd) => {
      if (cmd.dapCommand === 'threads') return { body: { threads: [{ id: 1, name: 'main' }] } };
      calls++;
      return { body: { stackFrames: [] } };
    };

    const { at } = await read();

    expect(at!).toBeLessThanOrEqual(WINDOW_MS + GRACE_MS);
    const inWait = sent().filter((cmd) => cmd.dapCommand === 'stackTrace').slice(1);
    expect(calls).toBeGreaterThan(2);
    for (const cmd of inWait) {
      expect(cmd.timeoutMs).toBeDefined();
      expect(cmd.timeoutMs!).toBeLessThanOrEqual(WINDOW_MS);
    }
    const threads = sent().filter((cmd) => cmd.dapCommand === 'threads');
    expect(threads.length).toBeGreaterThan(0);
    for (const cmd of threads) {
      expect(cmd.timeoutMs).toBeDefined();
      expect(cmd.timeoutMs!).toBeLessThanOrEqual(WINDOW_MS);
    }
  });

  it('answers within the window plus the grace when the sibling scan\'s threads request stalls', async () => {
    answer = (cmd) => (cmd.dapCommand === 'stackTrace' ? { body: { stackFrames: [] } } : 'never');

    const { at, result, error } = await read();

    expect(error).toBeUndefined();
    expect(at!).toBeLessThanOrEqual(WINDOW_MS + GRACE_MS);
    expect(result!.note).toMatch(boundNote);
    expect(vi.getTimerCount()).toBe(0);
    expect(pending()).toBe(0);
  });

  it('answers within the window plus the grace when a sibling\'s unwind stalls', async () => {
    answer = (cmd) => {
      if (cmd.dapCommand === 'threads') return { body: { threads: [{ id: 1, name: 'main' }, { id: 2, name: 'worker' }] } };
      if (cmd.dapCommand === 'stackTrace' && cmd.dapArgs?.threadId === 1) return { body: { stackFrames: [] } };
      return 'never';
    };

    const { at, result, error } = await read();

    expect(error).toBeUndefined();
    expect(at!).toBeLessThanOrEqual(WINDOW_MS + GRACE_MS);
    expect(result!.note).toMatch(boundNote);
    expect(vi.getTimerCount()).toBe(0);
    expect(pending()).toBe(0);
  });

  it('answers within the window plus the grace when the proxy ignores the deadline and never answers', async () => {
    // An IProxyManager that drops its options: the bound must not depend on
    // the callee honouring it.
    let first = true;
    const deaf: IProxyManager = Object.assign(new EventEmitter(), {
      isRunning: () => true,
      getCurrentThreadId: () => 1,
      setCurrentThreadId: vi.fn(),
      sendDapRequest: vi.fn((command: string) => {
        if (command === 'stackTrace' && first) {
          first = false;
          return Promise.resolve({ success: true, body: { stackFrames: [] } });
        }
        return new Promise(() => {});
      })
    }) as unknown as IProxyManager;

    const { at, result, error } = await read(40_000, deaf);

    expect(error).toBeUndefined();
    expect(at).toBeDefined();
    expect(at!).toBeLessThanOrEqual(WINDOW_MS + GRACE_MS);
    expect(result!.note).toMatch(boundNote);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ends its last poll interval at the window when the interval does not divide it', async () => {
    // Every read answers at once with nothing: the answer is due at the
    // window itself. With 400 ms between polls the last interval, begun at
    // 2,800 ms, would run to 3,200 ms if it were not cut at the window.
    intervalMs = 400;
    answer = (cmd) => (cmd.dapCommand === 'threads'
      ? { body: { threads: [{ id: 1, name: 'main' }] } }
      : { body: { stackFrames: [] } });

    const { at, result } = await read();

    expect(at).toBe(WINDOW_MS);
    expect(result!.note).toMatch(boundNote);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no timer when the stack appears early', async () => {
    answer = (cmd, now) => {
      if (cmd.dapCommand === 'threads') return { body: { threads: [{ id: 1, name: 'main' }] } };
      return { body: { stackFrames: now >= 500 ? [FRAME] : [] } };
    };

    const { at, result } = await read();

    expect(at!).toBeLessThan(1000);
    expect(result!.frames.map((frame) => frame.name)).toEqual(['Program.Main']);
    expect(vi.getTimerCount()).toBe(0);
    expect(pending()).toBe(0);
  });

  it('a stack for the stopped thread that answers inside the grace wins', async () => {
    // The read sent last before the window closes answers 100 ms after it.
    answer = (cmd, now) => {
      if (cmd.dapCommand === 'threads') return { body: { threads: [{ id: 1, name: 'main' }] } };
      if (now < WINDOW_MS - INTERVAL_MS - 10) return { body: { stackFrames: [] } };
      return { body: { stackFrames: [FRAME] }, afterMs: WINDOW_MS + 100 - now };
    };

    const { at, result } = await read();

    expect(at!).toBeGreaterThanOrEqual(WINDOW_MS);
    expect(at!).toBeLessThanOrEqual(WINDOW_MS + GRACE_MS);
    expect(result!.frames.map((frame) => frame.name)).toEqual(['Program.Main']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts no sibling scan once the window has closed, so it logs no false "could not list threads"', async () => {
    // The stopped thread's last read answers, empty, inside the grace.
    vi.mocked(logger.warn).mockClear();
    answer = (cmd, now) => {
      if (cmd.dapCommand === 'threads') return { body: { threads: [{ id: 1, name: 'main' }, { id: 2, name: 'worker' }] } };
      if (cmd.dapArgs?.threadId === 1 && now >= WINDOW_MS - INTERVAL_MS - 10) {
        return { body: { stackFrames: [] }, afterMs: WINDOW_MS + 100 - now };
      }
      return { body: { stackFrames: [] } };
    };

    const { at, result } = await read();

    expect(at!).toBeLessThanOrEqual(WINDOW_MS + GRACE_MS);
    expect(result!.note).toMatch(boundNote);
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringMatching(/Could not list threads/));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not move the inspection anchor to a sibling whose stack arrives after the window closed', async () => {
    // The sibling's last unwind is sent inside the window and answers inside
    // the grace, with frames: the answer may arrive, but the session's anchor
    // is not moved after the window the answer states.
    answer = (cmd, now) => {
      if (cmd.dapCommand === 'threads') return { body: { threads: [{ id: 1, name: 'main' }, { id: 2, name: 'worker' }] } };
      if (cmd.dapArgs?.threadId === 1) return { body: { stackFrames: [] } };
      if (now < WINDOW_MS - INTERVAL_MS - 10) return { body: { stackFrames: [] } };
      return { body: { stackFrames: [SIBLING_FRAME] }, afterMs: WINDOW_MS + 100 - now };
    };

    const { at, result } = await read();

    expect(at!).toBeLessThanOrEqual(WINDOW_MS + GRACE_MS);
    expect(root.getCurrentThreadId()).toBe(1);
    expect(result!.frames).toEqual([]);
    expect(result!.note).toMatch(boundNote);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not move the inspection anchor to a sibling whose stack arrives after the grace', async () => {
    answer = (cmd, now) => {
      if (cmd.dapCommand === 'threads') return { body: { threads: [{ id: 1, name: 'main' }, { id: 2, name: 'worker' }] } };
      if (cmd.dapArgs?.threadId === 1) return { body: { stackFrames: [] } };
      if (now < WINDOW_MS - INTERVAL_MS - 10) return { body: { stackFrames: [] } };
      return { body: { stackFrames: [SIBLING_FRAME] }, afterMs: WINDOW_MS + GRACE_MS + 500 - now };
    };

    const { at, result } = await read();

    expect(at!).toBeLessThanOrEqual(WINDOW_MS + GRACE_MS);
    expect(result!.note).toMatch(boundNote);
    // The late answer reaches the manager after the call answered; it is dropped.
    await vi.advanceTimersByTimeAsync(1000);
    expect(root.getCurrentThreadId()).toBe(1);
    expect(pending()).toBe(0);
  });

  it('still adopts a sibling that has frames inside the window', async () => {
    answer = (cmd, now) => {
      if (cmd.dapCommand === 'threads') return { body: { threads: [{ id: 1, name: 'main' }, { id: 2, name: 'worker' }] } };
      if (cmd.dapArgs?.threadId === 1) return { body: { stackFrames: [] } };
      return { body: { stackFrames: now >= 700 ? [SIBLING_FRAME] : [] } };
    };

    const { at, result } = await read();

    expect(at!).toBeLessThan(WINDOW_MS);
    expect(result!.threadId).toBe(2);
    expect(root.getCurrentThreadId()).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
