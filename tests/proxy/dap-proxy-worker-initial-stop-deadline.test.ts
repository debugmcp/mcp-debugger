/**
 * The proxy worker's wait for the initial stop keeps its stated bound
 * (the worker process's first loop on the shared Deadline).
 *
 * `ensureInitialStop` polls `threads` until one is reported, then pauses
 * it, all within one budget. On a fake clock, each case stalls one of the
 * two requests the way a wedged adapter does (it never answers, whatever
 * timeout it is given) and checks that the wait answers within its budget
 * plus the grace a request already sent may take, that the warning names
 * the budget, and that no timer is left when it returns, early or late.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DapProxyWorker } from '../../src/proxy/dap-proxy-worker.js';
import type { DapProxyDependencies } from '../../src/proxy/dap-proxy-interfaces.js';
import { createMockDapClient } from '../test-utils/mocks/dap-client.js';
import { createMockLogger } from '../test-utils/helpers/test-dependencies.js';
import { createMockFileSystem, createMockProcessSpawner } from '../test-utils/mocks/dap-proxy-doubles.js';

const BUDGET_MS = 1000;
const GRACE_MS = 250;

describe('DapProxyWorker ensureInitialStop keeps its budget', () => {
  let worker: DapProxyWorker;
  let mockDapClient: ReturnType<typeof createMockDapClient>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockDapClient = createMockDapClient();
    logger = createMockLogger();
    const dependencies = {
      fileSystem: createMockFileSystem(),
      loggerFactory: vi.fn().mockResolvedValue(logger),
      processSpawner: createMockProcessSpawner(),
      dapClientFactory: { create: vi.fn().mockResolvedValue(mockDapClient) },
      messageSender: { send: vi.fn() }
    } as unknown as DapProxyDependencies;
    worker = new DapProxyWorker(dependencies, { exit: vi.fn() });
    const w = worker as unknown as Record<string, unknown>;
    w.logger = logger;
    w.dapClient = mockDapClient;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Run the wait to its end on the fake clock; when it ended, in virtual ms (undefined if it had not by `limitMs`). */
  async function run(limitMs = 60_000): Promise<number | undefined> {
    const started = Date.now();
    let at: number | undefined;
    void (worker as unknown as { ensureInitialStop(timeoutMs?: number): Promise<void> })
      .ensureInitialStop(BUDGET_MS)
      .then(() => { at = Date.now() - started; }, () => { at = Date.now() - started; });
    for (let elapsed = 0; elapsed < limitMs && at === undefined; elapsed += 5) {
      await vi.advanceTimersByTimeAsync(5);
    }
    return at;
  }

  it('answers within its budget plus the grace when threads never answers', async () => {
    mockDapClient.sendRequest.mockImplementation(() => new Promise(() => {}));

    const at = await run();

    expect(at).toBeDefined();
    expect(at!).toBeLessThanOrEqual(BUDGET_MS + GRACE_MS);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`no threads discovered within timeout (${BUDGET_MS} ms)`));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('answers within its budget plus the grace when the pause never answers', async () => {
    mockDapClient.sendRequest.mockImplementation(async (command: string) => {
      if (command === 'threads') return { body: { threads: [{ id: 7 }] } };
      return new Promise(() => {});
    });

    const at = await run();

    expect(at).toBeDefined();
    expect(at!).toBeLessThanOrEqual(BUDGET_MS + GRACE_MS);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('gives every request the time that remains', async () => {
    const timeouts: Array<{ command: string; timeoutMs: unknown; at: number }> = [];
    const started = Date.now();
    let calls = 0;
    mockDapClient.sendRequest.mockImplementation(async (command: string, _args: unknown, timeoutMs?: number) => {
      timeouts.push({ command, timeoutMs, at: Date.now() - started });
      calls++;
      if (command === 'threads' && calls < 4) return { body: { threads: [] } };
      if (command === 'threads') return { body: { threads: [{ id: 3 }] } };
      return { success: true };
    });

    const at = await run();

    expect(at!).toBeLessThan(BUDGET_MS);
    expect(timeouts.map((t) => t.command)).toEqual(['threads', 'threads', 'threads', 'threads', 'pause']);
    for (const t of timeouts) {
      expect(typeof t.timeoutMs).toBe('number');
      expect(t.timeoutMs as number).toBeGreaterThan(0);
      expect(t.timeoutMs as number).toBeLessThanOrEqual(BUDGET_MS - t.at);
    }
  });

  it('cuts its last poll interval at the budget instead of sleeping past it', async () => {
    // Every poll answers at once and finds nothing: with 100 ms between
    // polls, the old loop's last sleep began at 900 ms and ended at 1000;
    // a budget that is not a multiple of the interval shows whether the
    // sleep is capped by what remains.
    mockDapClient.sendRequest.mockImplementation(async () => ({ body: { threads: [] } }));
    const started = Date.now();
    let at: number | undefined;
    void (worker as unknown as { ensureInitialStop(timeoutMs?: number): Promise<void> })
      .ensureInitialStop(950)
      .then(() => { at = Date.now() - started; });
    for (let elapsed = 0; elapsed < 5000 && at === undefined; elapsed += 5) {
      await vi.advanceTimersByTimeAsync(5);
    }

    expect(at).toBeDefined();
    expect(at!).toBeLessThanOrEqual(950);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no timer when the pause goes out early', async () => {
    mockDapClient.sendRequest.mockImplementation(async (command: string) => (
      command === 'threads' ? { body: { threads: [{ id: 7 }] } } : { success: true }
    ));

    const at = await run();

    expect(at!).toBeLessThan(50);
    expect(mockDapClient.sendRequest).toHaveBeenCalledWith('pause', { threadId: 7 }, expect.any(Number));
    expect(vi.getTimerCount()).toBe(0);
  });
});
