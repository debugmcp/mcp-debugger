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
 * Anchored on `@debugmcp/shared` rather than `src/interfaces/external-dependencies.ts`.
 * Those two declare `IFileSystem`/`ILogger`/`IEnvironment` separately and identically today,
 * so either would compile — but adapters take the *shared* contract, so that is the one a
 * double for an adapter should be held to.
 */
import { vi } from 'vitest';
import type {
  AdapterDependencies,
  IEnvironment,
  IFileSystem,
  ILogger,
  INetworkManager
} from '@debugmcp/shared';

/** Every `IFileSystem` member as a bare spy. Pass `overrides` for the ones a test asserts on. */
export function createMockFileSystem(overrides: Partial<IFileSystem> = {}): IFileSystem {
  return {
    readFile: vi.fn(),
    readTail: vi.fn(),
    writeFile: vi.fn(),
    exists: vi.fn(),
    existsSync: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    rmdir: vi.fn(),
    ensureDir: vi.fn(),
    ensureDirSync: vi.fn(),
    pathExists: vi.fn(),
    remove: vi.fn(),
    copy: vi.fn(),
    outputFile: vi.fn(),
    ...overrides
  };
}

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
 */
export function createMockAdapterDependencies(
  overrides: Partial<AdapterDependencies> = {}
): AdapterDependencies {
  return {
    fileSystem: createMockFileSystem(),
    logger: createMockLogger(),
    environment: createMockEnvironment(),
    ...overrides
  };
}
