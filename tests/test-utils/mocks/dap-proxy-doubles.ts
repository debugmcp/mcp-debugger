/**
 * The proxy-worker's own dependency doubles, shared by the proxy-worker and
 * go-initialized-fallback tests (they used to carry byte-identical private
 * copies). Typed against the worker-local contracts in
 * `src/proxy/dap-proxy-interfaces.ts` — deliberately NOT `@debugmcp/shared`'s
 * `ILogger`/`IFileSystem`, which are wider: the worker declares the narrower
 * slice it actually uses, and a double typed to the wide interface would hide
 * a member the worker starts calling. The `IDapClient` double lives next door
 * in `dap-client.ts`.
 */
import { vi } from 'vitest';
import type { ILogger, IFileSystem, IProcessSpawner } from '../../../src/proxy/dap-proxy-interfaces.js';

export const createMockLogger = (): ILogger => ({
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn()
});

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
