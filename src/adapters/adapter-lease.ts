/**
 * Explicit ownership of one adapter instance for the duration of a launch or
 * attach setup.
 *
 * The registry caps concurrent adapters per language (`maxInstancesPerLanguage`,
 * `adapter-registry.ts`) and releases a slot only when the adapter emits
 * 'disposed'. Ownership used to be a *time window* inside `startProxyManager`
 * guarded by a `let adapterOwnedByProxy = false` flag: every `throw` between
 * `registry.create()` and `session.proxyManager = …` had to be caught by one
 * catch that consulted the flag. A new early-return or a new throw site added
 * outside that window leaked a registry slot, and ten leaks turned every
 * subsequent launch of that language into "Maximum adapter instances (10)
 * reached" — a failure whose message says nothing about the real error that
 * caused it (issue #552 review, issue #561).
 *
 * A lease makes the window an object instead of a flag. Acquire it, do the
 * setup inside `try`, hand ownership to the ProxyManager with `transferTo`,
 * and `release()` in `finally`. Release after a transfer is a no-op, so the
 * one `finally` covers every path: a throw anywhere in the body disposes, a
 * successful transfer does not, and neither depends on remembering to set a
 * flag. (`await using` would express this directly, but the project's `lib`
 * has no `ESNext.Disposable`.)
 *
 * After a transfer, `ProxyManager.cleanup()` is the disposer, exactly as before.
 */
import type { AdapterConfig, IAdapterRegistry, IDebugAdapter } from '@debugmcp/shared';
import type { ILogger } from '../interfaces/external-dependencies.js';
import type { IProxyManagerFactory } from '../factories/proxy-manager-factory.js';
import type { IProxyManager } from '../proxy/proxy-manager.js';

export class AdapterLease {
  private held = true;

  private constructor(
    /** The leased adapter. Valid whether or not the lease is still held. */
    readonly adapter: IDebugAdapter,
    private readonly logger: ILogger,
    private readonly sessionId: string
  ) {}

  /**
   * Create an adapter through the registry and take ownership of it.
   *
   * The instance limit and the 'disposed' bookkeeping stay in the registry;
   * this only wraps the result in an owner that knows how to give it back.
   * A rejection from `create` yields no lease — nothing was allocated.
   */
  static async acquire(
    registry: Pick<IAdapterRegistry, 'create'>,
    language: string,
    config: AdapterConfig,
    logger: ILogger
  ): Promise<AdapterLease> {
    const adapter = await registry.create(language, config);
    return new AdapterLease(adapter, logger, config.sessionId);
  }

  /** True while this lease is still responsible for disposing the adapter. */
  get isHeld(): boolean {
    return this.held;
  }

  /**
   * Hand the adapter to a ProxyManager, which becomes its owner and disposer.
   *
   * Ownership moves only after `factory.create` returns: a throwing factory
   * leaves the lease held, so the caller's `finally` still disposes.
   */
  transferTo(factory: IProxyManagerFactory): IProxyManager {
    if (!this.held) {
      throw new Error(
        `Adapter lease for session ${this.sessionId} was already transferred or released`
      );
    }
    const proxyManager = factory.create(this.adapter);
    this.held = false;
    return proxyManager;
  }

  /**
   * Dispose the adapter if this lease still owns it. Idempotent, and a no-op
   * after a transfer, so it is safe as the sole `finally` of a setup block.
   *
   * A failing `dispose()` is swallowed with a warning: the setup error that
   * sent us here is the one worth reporting, and masking it with a teardown
   * failure would hide the actual cause.
   */
  async release(): Promise<void> {
    if (!this.held) {
      return;
    }
    this.held = false;

    // Duck-typed for parity with ProxyManager.cleanup(), whose adapter handle
    // is likewise optional-shaped.
    const disposable = this.adapter as { dispose?: () => Promise<void> };
    if (typeof disposable.dispose === 'function') {
      await disposable.dispose().catch((disposeError: unknown) => {
        this.logger.warn(
          `[SessionManager] Failed to dispose adapter after launch setup error for session ${this.sessionId}: ${
            disposeError instanceof Error ? disposeError.message : String(disposeError)
          }`
        );
      });
    }
  }
}
