/**
 * Test utilities for Debug MCP Server tests
 */
import type { IFileSystem, ILogger } from '@debugmcp/shared';
import type { Stats } from 'fs';
import { vi } from 'vitest';

/**
 * Create a delay promise
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock logger for testing
 * @returns Mock logger with vitest mocks
 */
export function createMockLogger(): ILogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  };
}

/**
 * The one mock file system (issue #742): every `IFileSystem` member, with "everything
 * exists" defaults — `exists`/`pathExists`/`existsSync` answer `true`, `readFile`/`readTail`
 * resolve `''`, `readdir` resolves `[]`, `stat` resolves a file, everything else resolves
 * `undefined`. Override what a test asserts on:
 * `createMockFileSystem({ pathExists: vi.fn(async () => false) })`.
 *
 * Defaults are `vi.fn(impl)`, never `mockResolvedValue`: `tests/vitest.setup.ts` runs
 * `vi.resetAllMocks()` after every test, and `mockReset` restores the implementation a mock
 * was constructed with but wipes a `mockResolvedValue` — the rule the fake adapter pins too.
 *
 * `test-dependencies.ts` and `adapter-dependencies.ts` re-export this function, so the three
 * import paths are one double. This file is the home because it is a leaf (vitest and shared
 * types only): `test-dependencies.ts` imports the ProxyManager graph, which the adapter
 * package tests must not load. `createMockAdapterDependencies()` sets the three existence
 * probes to `false` explicitly — an un-stubbed adapter lookup must take its failure branch.
 */
export function createMockFileSystem(overrides: Partial<IFileSystem> = {}): IFileSystem {
  return {
    readFile: vi.fn(async () => ''),
    readTail: vi.fn(async () => ''),
    writeFile: vi.fn(async () => undefined),
    exists: vi.fn(async () => true),
    existsSync: vi.fn(() => true),
    mkdir: vi.fn(async () => undefined),
    readdir: vi.fn(async () => [] as string[]),
    stat: vi.fn(async () => ({ isDirectory: () => false, isFile: () => true }) as unknown as Stats),
    unlink: vi.fn(async () => undefined),
    rmdir: vi.fn(async () => undefined),
    ensureDir: vi.fn(async () => undefined),
    ensureDirSync: vi.fn(() => undefined),
    pathExists: vi.fn(async () => true),
    remove: vi.fn(async () => undefined),
    copy: vi.fn(async () => undefined),
    outputFile: vi.fn(async () => undefined),
    ...overrides
  };
}

/**
 * Poll a condition until it becomes truthy or a timeout elapses.
 *
 * Use this instead of a fixed `delay()`/`setTimeout` sleep that merely guesses
 * how long some asynchronous state takes to settle: `waitUntil` returns as soon
 * as `condition` holds (so the common case is faster) and fails fast with a
 * clear message if it never does (so a regression surfaces as a useful error
 * rather than a flaky downstream assertion).
 *
 * @param condition - Sync or async predicate; polling stops when it returns truthy.
 * @param options.timeout - Max time to wait in ms (default 5000).
 * @param options.interval - Gap between polls in ms (default 50).
 * @param options.message - Short description of what is awaited, used in the timeout error.
 * @returns Promise that resolves once the condition holds; rejects on timeout.
 */
export async function waitUntil(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50, message = 'condition' } = options;
  const start = Date.now();

  // Check immediately first, then poll until satisfied or timed out.
  for (;;) {
    if (await condition()) {
      return;
    }
    if (Date.now() - start >= timeout) {
      throw new Error(`Timeout after ${timeout}ms waiting for ${message}`);
    }
    await delay(interval);
  }
}

/**
 * Wait for an event to be emitted
 *
 * @param emitter - Event emitter to listen on
 * @param event - Event name to wait for
 * @param timeout - Timeout in milliseconds
 * @returns Promise that resolves with event arguments
 */
export function waitForEvent<T extends any[]>(
  emitter: { once: Function; removeListener?: Function },
  event: string,
  timeout = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (emitter.removeListener) {
        emitter.removeListener(event, handler);
      }
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    const handler = (...args: any[]) => {
      clearTimeout(timer);
      resolve(args as T);
    };

    emitter.once(event, handler);
  });
}
