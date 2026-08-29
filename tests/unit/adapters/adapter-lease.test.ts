/**
 * `AdapterLease` replaces the `let adapterOwnedByProxy = false` flag that used
 * to decide, from a single catch at the bottom of `startProxyManager`, whether
 * a failed launch still owed the registry an `adapter.dispose()`.
 *
 * What these tests protect is the *slot accounting*: the registry allows ten
 * concurrent adapters per language, so one un-disposed adapter per failed
 * launch turns the eleventh attempt into "Maximum adapter instances (10)
 * reached" instead of the real error. Each case is therefore stated as an
 * ownership question — who disposes, and how many times.
 */
import { describe, it, expect, vi } from 'vitest';
import { AdapterLease } from '../../../src/adapters/adapter-lease.js';
import type { ILogger, IProxyManagerFactory } from '../../../src/interfaces/external-dependencies.js';
import type { IProxyManager } from '../../../src/proxy/proxy-manager.js';
import type { AdapterConfig, IAdapterRegistry } from '@debugmcp/shared';
import { FakeDebugAdapter } from '../../test-utils/fakes/fake-debug-adapter.js';
import { MockProxyManager } from '../../test-utils/mocks/mock-proxy-manager.js';

const config: AdapterConfig = {
  sessionId: 'sess-1',
  executablePath: '',
  adapterHost: '127.0.0.1',
  adapterPort: 9000,
  logDir: '/tmp/logs/sess-1',
  scriptPath: 'script.py',
  launchConfig: {}
};

function createLogger() {
  return { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } satisfies ILogger;
}

function createRegistry(adapter: FakeDebugAdapter): Pick<IAdapterRegistry, 'create'> {
  return { create: vi.fn(async () => adapter) };
}

function createFactory(proxyManager: IProxyManager = new MockProxyManager()): IProxyManagerFactory {
  return { create: vi.fn(() => proxyManager) };
}

describe('AdapterLease', () => {
  describe('acquire', () => {
    it('creates the adapter through the registry and starts out holding it', async () => {
      const adapter = new FakeDebugAdapter();
      const registry = createRegistry(adapter);

      const lease = await AdapterLease.acquire(registry, 'python', config, createLogger());

      expect(registry.create).toHaveBeenCalledWith('python', config);
      expect(lease.adapter).toBe(adapter);
      expect(lease.isHeld).toBe(true);
      expect(lease.getState()).toBe('held');
    });

    it('propagates a registry failure without producing a lease', async () => {
      const registry: Pick<IAdapterRegistry, 'create'> = {
        create: vi.fn(async () => {
          throw new Error('Maximum adapter instances (10) reached for language: cpp');
        })
      };

      await expect(AdapterLease.acquire(registry, 'cpp', config, createLogger())).rejects.toThrow(
        'Maximum adapter instances (10) reached'
      );
    });
  });

  describe('release', () => {
    it('disposes the adapter exactly once and drops the lease', async () => {
      const adapter = new FakeDebugAdapter();
      const lease = await AdapterLease.acquire(createRegistry(adapter), 'python', config, createLogger());

      await lease.release();

      expect(adapter.dispose).toHaveBeenCalledTimes(1);
      expect(lease.isHeld).toBe(false);
    });

    it('is idempotent, so a redundant release cannot double-dispose', async () => {
      const adapter = new FakeDebugAdapter();
      const lease = await AdapterLease.acquire(createRegistry(adapter), 'python', config, createLogger());

      await lease.release();
      await lease.release();

      expect(adapter.dispose).toHaveBeenCalledTimes(1);
    });

    it('swallows a dispose failure with a warning, leaving the setup error to surface', async () => {
      const adapter = new FakeDebugAdapter({
        dispose: async () => {
          throw new Error('handle already closed');
        }
      });
      const logger = createLogger();
      const lease = await AdapterLease.acquire(createRegistry(adapter), 'python', config, logger);

      await expect(lease.release()).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        '[SessionManager] Failed to dispose adapter after launch setup error for session sess-1: handle already closed'
      );
    });

    it('swallows a dispose that throws synchronously, which a bare .catch() would miss', async () => {
      const adapter = new FakeDebugAdapter();
      // The interface declares `dispose(): Promise<void>`, so violating it takes
      // a cast — and that violation IS the case under test: a synchronous throw
      // means no promise ever exists, so `dispose().catch(...)` never runs, and
      // from the caller's `finally` the throw would replace the setup error that
      // sent us there.
      adapter.dispose = vi.fn(() => {
        throw new Error('adapter handle was already torn down');
      }) as unknown as FakeDebugAdapter['dispose'];
      const logger = createLogger();
      const lease = await AdapterLease.acquire(createRegistry(adapter), 'python', config, logger);

      await expect(lease.release()).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        '[SessionManager] Failed to dispose adapter after launch setup error for session sess-1: adapter handle was already torn down'
      );
    });

    it('tolerates a partial adapter double that defines no dispose', async () => {
      const adapter = new FakeDebugAdapter();
      // The production guard is duck-typed because partial doubles (and any
      // adapter predating the member) reach it; model exactly that shape.
      delete (adapter as Partial<FakeDebugAdapter>).dispose;
      const lease = await AdapterLease.acquire(createRegistry(adapter), 'python', config, createLogger());

      await expect(lease.release()).resolves.toBeUndefined();
      expect(lease.isHeld).toBe(false);
    });
  });

  describe('transferTo', () => {
    it('hands the adapter to the proxy manager and stops owning it', async () => {
      const adapter = new FakeDebugAdapter();
      const proxyManager = new MockProxyManager();
      const factory = createFactory(proxyManager);
      const lease = await AdapterLease.acquire(createRegistry(adapter), 'python', config, createLogger());

      expect(lease.transferTo(factory)).toBe(proxyManager);

      expect(factory.create).toHaveBeenCalledWith(adapter);
      expect(lease.isHeld).toBe(false);
    });

    it('makes the trailing release a no-op, so the running proxy keeps its adapter', async () => {
      const adapter = new FakeDebugAdapter();
      const lease = await AdapterLease.acquire(createRegistry(adapter), 'python', config, createLogger());

      lease.transferTo(createFactory());
      await lease.release();

      expect(adapter.dispose).not.toHaveBeenCalled();
    });

    it('refuses a second transfer rather than handing one adapter to two owners', async () => {
      const adapter = new FakeDebugAdapter();
      const lease = await AdapterLease.acquire(createRegistry(adapter), 'python', config, createLogger());

      lease.transferTo(createFactory());

      expect(() => lease.transferTo(createFactory())).toThrow(
        'Adapter lease for session sess-1 was already transferred'
      );
      expect(lease.getState()).toBe('transferred');
    });

    it('refuses a transfer after release, and says so — the adapter is disposed, not in use', async () => {
      const adapter = new FakeDebugAdapter();
      const lease = await AdapterLease.acquire(createRegistry(adapter), 'python', config, createLogger());

      await lease.release();

      // The two refusals must read differently: "transferred" sends you looking
      // for a live adapter inside a running proxy, "released" tells you it is
      // already disposed.
      expect(() => lease.transferTo(createFactory())).toThrow(
        'Adapter lease for session sess-1 was already released'
      );
      expect(lease.getState()).toBe('released');
    });

    it('keeps the lease held when the factory throws, so the finally still disposes', async () => {
      const adapter = new FakeDebugAdapter();
      const factory: IProxyManagerFactory = {
        create: vi.fn(() => {
          throw new Error('Port allocation failed');
        })
      };
      const lease = await AdapterLease.acquire(createRegistry(adapter), 'python', config, createLogger());

      expect(() => lease.transferTo(factory)).toThrow('Port allocation failed');
      expect(lease.isHeld).toBe(true);

      await lease.release();
      expect(adapter.dispose).toHaveBeenCalledTimes(1);
    });
  });
});
