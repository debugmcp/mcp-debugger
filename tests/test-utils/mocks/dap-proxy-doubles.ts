/**
 * The proxy-worker's own dependency doubles, shared by the proxy-worker and
 * go-initialized-fallback tests (they used to carry byte-identical private
 * copies). Typed against the worker-local contracts in
 * `src/proxy/dap-proxy-interfaces.ts`.
 *
 * `IFileSystem` is the one that matters: the worker's is a four-member slice
 * of `@debugmcp/shared`'s sixteen, and a double typed to the wide interface
 * would hide a member the worker starts calling (say, a new `stat`). There is
 * no logger double here on purpose — the worker-local `ILogger`
 * (`...args: unknown[]`) is the WIDER signature, so shared's
 * `createMockLogger()` in `tests/test-utils/helpers/test-dependencies.ts`
 * is assignable to it and the tests take that one. The `IDapClient` double
 * lives next door in `dap-client.ts`.
 */
import { vi } from 'vitest';
import type { IFileSystem, IProcessSpawner } from '../../../src/proxy/dap-proxy-interfaces.js';

export const createMockFileSystem = (): IFileSystem => ({
  ensureDir: vi.fn().mockResolvedValue(undefined),
  pathExists: vi.fn().mockResolvedValue(true),
  readFile: vi.fn().mockResolvedValue(''),
  remove: vi.fn().mockResolvedValue(undefined)
});

export const createMockProcessSpawner = (): IProcessSpawner => ({
  spawn: vi.fn().mockReturnValue({
    pid: 12345,
    on: vi.fn(),
    kill: vi.fn(),
    unref: vi.fn(),
    killed: false
  })
});
