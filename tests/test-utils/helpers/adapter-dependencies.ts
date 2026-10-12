/**
 * Typed `AdapterDependencies` doubles for adapter unit tests.
 *
 * Test-only — DO NOT import from production code, this pulls in Vitest.
 *
 * Seven test files each grew their own inline copy of this object, and they drifted: some
 * declared `fileSystem: {} as unknown` (assignable to nothing, which is where 38 of the
 * ratchet's errors came from), others filled in whichever three methods that file happened
 * to call. One factory, anchored to the interface, keeps them honest.
 *
 * Anchored on `@debugmcp/shared`: adapters take the shared contract, so that is the one a
 * double for an adapter should be held to.
 */
import { vi } from 'vitest';
import type {
  AdapterDependencies,
  IEnvironment,
  ILogger,
  INetworkManager
} from '@debugmcp/shared';
import { createMockFileSystem } from './test-utils.js';

// The one mock file system lives in test-utils.ts (issue #742) — a leaf module, so pulling it
// in here does not load the ProxyManager graph into the adapter package tests.
export { createMockFileSystem };

export function createMockLogger(overrides: Partial<ILogger> = {}): ILogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), ...overrides };
}

/** Reads through to the real environment, which is what adapter discovery code expects. */
export function createMockEnvironment(overrides: Partial<IEnvironment> = {}): IEnvironment {
  return {
    get: vi.fn((key: string) => process.env[key]),
    getAll: vi.fn(() => ({ ...process.env })),
    getCurrentWorkingDirectory: vi.fn(() => process.cwd()),
    ...overrides
  };
}

export function createMockNetworkManager(
  overrides: Partial<INetworkManager> = {}
): INetworkManager {
  return { createServer: vi.fn(), findFreePort: vi.fn(), ...overrides };
}

/**
 * `networkManager` is optional on the interface and most adapters never touch it, so it is
 * left off unless a caller asks for one.
 *
 * The three existence predicates answer `false` here, against the shared double's
 * "everything exists" default: an un-stubbed probe must report "not found", so an adapter
 * code path that resolves a file takes its failure branch quietly instead of claiming every
 * executable exists — and the Dart tests' explicit `existsSync` overrides keep meaning
 * something. Stub the predicate in any test that reaches one.
 */
export function createMockAdapterDependencies(
  overrides: Partial<AdapterDependencies> = {}
): AdapterDependencies {
  return {
    fileSystem: createMockFileSystem({
      exists: vi.fn(async () => false),
      existsSync: vi.fn(() => false),
      pathExists: vi.fn(async () => false)
    }),
    logger: createMockLogger(),
    environment: createMockEnvironment(),
    ...overrides
  };
}
