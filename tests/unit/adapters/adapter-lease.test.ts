/**
 * `AdapterLease` replaces the `let adapterOwnedByProxy = false` flag that used
 * to decide, from a single catch at the bottom of the proxy launch, whether
 * a failed launch still owed the registry an `adapter.dispose()`.
 *
 * What these tests protect is the *slot accounting*: the registry allows ten
 * concurrent adapters per language, so one un-disposed adapter per failed
 * launch turns the eleventh attempt into "Maximum adapter instances (10)
 * reached" instead of the real error. Each case is therefore stated as an
 * ownership question — who disposes, and how many times.
 *
 * `release()` is the sole `finally` of `ProxyLauncher.start`, so a second theme
 * runs through the release cases: it must never throw. Anything escaping it
 * replaces the setup error the caller was about to report with a teardown one.
 */
import { describe, it, expect, vi } from 'vitest';
import { AdapterLease } from '../../../src/adapters/adapter-lease.js';
import { MockProxyManagerFactory } from '../../../src/factories/proxy-manager-factory.js';
import type { AdapterConfig, IAdapterRegistry, IDebugAdapter } from '@debugmcp/shared';
import { FakeDebugAdapter } from '../../test-utils/fakes/fake-debug-adapter.js';
import { MockProxyManager } from '../../test-utils/mocks/mock-proxy-manager.js';
import { createMockAdapterRegistry } from '../../test-utils/mocks/mock-adapter-registry.js';
import { createMockLogger } from '../../test-utils/helpers/test-dependencies.js';

const config: AdapterConfig = {
  sessionId: 'sess-1',
  executablePath: '',
  adapterHost: '127.0.0.1',
  adapterPort: 9000,
  logDir: '/tmp/logs/sess-1',
  scriptPath: 'script.py',
  launchConfig: {}
};

/** A registry that hands back exactly this adapter, whatever language is asked for. */
function registryFor(adapter: IDebugAdapter): IAdapterRegistry {
  return createMockAdapterRegistry({ createAdapter: async () => adapter });
}

/** A factory that hands back `proxyManager`, and records what it was given. */
function factoryFor(proxyManager = new MockProxyManager()): MockProxyManagerFactory {
  const factory = new MockProxyManagerFactory();
  factory.createFn = () => proxyManager;
  return factory;
}

async function leaseFor(adapter: IDebugAdapter, logger = createMockLogger()) {
  return AdapterLease.acquire(registryFor(adapter), 'python', config, logger);
}

describe('AdapterLease', () => {
  describe('acquire', () => {
    it('creates the adapter through the registry and starts out holding it', async () => {
      const adapter = new FakeDebugAdapter();
      const registry = registryFor(adapter);

      const lease = await AdapterLease.acquire(registry, 'python', config, createMockLogger());

      expect(registry.create).toHaveBeenCalledWith('python', config);
      expect(lease.adapter).toBe(adapter);
      expect(lease.getState()).toBe('held');
    });

    it('propagates a registry failure without producing a lease', async () => {
      const registry = createMockAdapterRegistry({
        createAdapter: async () => {
          throw new Error('Maximum adapter instances (10) reached for language: cpp');
        }
      });

      await expect(
        AdapterLease.acquire(registry, 'cpp', config, createMockLogger())
      ).rejects.toThrow('Maximum adapter instances (10) reached');
    });
  });

  describe('release', () => {
    it('disposes the adapter exactly once and drops the lease', async () => {
      const adapter = new FakeDebugAdapter();
      const lease = await leaseFor(adapter);

      await lease.release();

      expect(adapter.dispose).toHaveBeenCalledTimes(1);
      expect(lease.getState()).toBe('released');
    });

    it('is idempotent, so a redundant release cannot double-dispose', async () => {
      const adapter = new FakeDebugAdapter();
      const lease = await leaseFor(adapter);

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
      const logger = createMockLogger();
      const lease = await leaseFor(adapter, logger);

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
      const logger = createMockLogger();
      const lease = await leaseFor(adapter, logger);

      await expect(lease.release()).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        '[SessionManager] Failed to dispose adapter after launch setup error for session sess-1: adapter handle was already torn down'
      );
    });

    it('swallows a logger that throws while reporting a failed dispose', async () => {
      const adapter = new FakeDebugAdapter({
        dispose: async () => {
          throw new Error('handle already closed');
        }
      });
      const logger = createMockLogger();
      vi.mocked(logger.warn).mockImplementation(() => {
        throw new Error('log transport closed');
      });
      const lease = await leaseFor(adapter, logger);

      await expect(lease.release()).resolves.toBeUndefined();
    });

    it('tolerates a partial adapter double that defines no dispose', async () => {
      const adapter = new FakeDebugAdapter();
      // `dispose()` is required by IDebugAdapter, so this shape is a violation
      // — and since #573 dropped the duck-typed guard, calling it raises a
      // TypeError. That is reported as a failed disposal (the slot really was
      // not returned) and must still not escape the caller's `finally`.
      delete (adapter as Partial<FakeDebugAdapter>).dispose;
      const logger = createMockLogger();
      const lease = await leaseFor(adapter, logger);

      await expect(lease.release()).resolves.toBeUndefined();
      expect(lease.getState()).toBe('released');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          '[SessionManager] Failed to dispose adapter after launch setup error for session sess-1'
        )
      );
    });

    it('tolerates a registry double that resolves no adapter at all', async () => {
      // Deliberately a raw double rather than createMockAdapterRegistry: that
      // helper now rejects a nullish adapter by design, and the property read
      // on a nullish `adapter` is precisely what must not escape `release()`.
      const registry: Pick<IAdapterRegistry, 'create'> = {
        create: vi.fn(async () => undefined as unknown as IDebugAdapter)
      };
      const lease = await AdapterLease.acquire(registry, 'python', config, createMockLogger());

      await expect(lease.release()).resolves.toBeUndefined();
      expect(lease.getState()).toBe('released');
    });
  });

  describe('transferTo', () => {
    it('hands the adapter to the proxy manager and stops owning it', async () => {
      const adapter = new FakeDebugAdapter();
      const proxyManager = new MockProxyManager();
      const factory = factoryFor(proxyManager);
      const lease = await leaseFor(adapter);

      expect(lease.transferTo(factory)).toBe(proxyManager);

      expect(factory.lastAdapter).toBe(adapter);
      expect(factory.createdManagers).toEqual([proxyManager]);
      expect(lease.getState()).toBe('transferred');
    });

    it('makes the trailing release a no-op, so the running proxy keeps its adapter', async () => {
      const adapter = new FakeDebugAdapter();
      const lease = await leaseFor(adapter);

      lease.transferTo(factoryFor());
      await lease.release();

      expect(adapter.dispose).not.toHaveBeenCalled();
    });

    it('refuses a second transfer rather than handing one adapter to two owners', async () => {
      const adapter = new FakeDebugAdapter();
      const lease = await leaseFor(adapter);

      lease.transferTo(factoryFor());

      expect(() => lease.transferTo(factoryFor())).toThrow(
        'Adapter lease for session sess-1 was already transferred'
      );
      expect(lease.getState()).toBe('transferred');
    });

    it('refuses a transfer after release, and says so — the adapter is disposed, not in use', async () => {
      const adapter = new FakeDebugAdapter();
      const lease = await leaseFor(adapter);

      await lease.release();

      // The two refusals must read differently: "transferred" sends you looking
      // for a live adapter inside a running proxy, "released" tells you it is
      // already disposed.
      expect(() => lease.transferTo(factoryFor())).toThrow(
        'Adapter lease for session sess-1 was already released'
      );
      expect(lease.getState()).toBe('released');
    });

    it('keeps the lease held when the factory throws, so the finally still disposes', async () => {
      const adapter = new FakeDebugAdapter();
      const factory = new MockProxyManagerFactory();
      factory.createFn = () => {
        throw new Error('Port allocation failed');
      };
      const lease = await leaseFor(adapter);

      expect(() => lease.transferTo(factory)).toThrow('Port allocation failed');
      expect(lease.getState()).toBe('held');

      await lease.release();
      expect(adapter.dispose).toHaveBeenCalledTimes(1);
    });
  });
});
