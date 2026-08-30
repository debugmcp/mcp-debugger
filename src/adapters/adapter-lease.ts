/**
 * Explicit ownership of one adapter instance for the duration of a launch or
 * attach setup.
 *
 * The registry caps concurrent adapters per language (`maxInstancesPerLanguage`,
 * `adapter-registry.ts`) and releases a slot only when the adapter emits
 * 'disposed'. Ownership was a *time window* inside `ProxyLauncher.start` guarded
 * by a `let adapterOwnedByProxy = false` flag: every `throw` between
 * `registry.create()` and `session.proxyManager = …` had to be caught by one
 * catch that consulted the flag. That flag closed a real leak (#557, from the
 * #552 review) — a rejected transform used to strand the slot, and ten stranded
 * slots turned every later launch of that language into "Maximum adapter
 * instances (10) reached", a message that says nothing about the error that
 * actually caused it.
 *
 * The lease is *behaviour-equivalent to that flag on every path*. What it
 * changes is that correctness stops being a discipline: the flag has to be
 * assigned at exactly one point and consulted from exactly one catch, so the
 * next `throw` site added outside that window silently reopens the leak.
 * Acquire the lease, do the setup inside `try`, hand ownership to the
 * ProxyManager with `transferTo`, and `release()` in `finally`. Release after a
 * transfer is a no-op, so the one `finally` covers every path: a throw anywhere
 * in the body disposes, a successful transfer does not, and neither depends on
 * remembering to set anything. (`await using` would express this directly, but
 * the project's `lib` has no `ESNext.Disposable`.)
 *
 * The lease covers only the setup window. After a transfer the ProxyManager is
 * the owner, and disposal happens through its teardown — `ProxyManager.cleanup()`
 * calls `adapter.dispose()`, which the callers' catches reach by stopping
 * `session.proxyManager` — exactly as before.
 */
import type { AdapterConfig, IAdapterRegistry, IDebugAdapter } from '@debugmcp/shared';
import type { ILogger, IProxyManagerFactory } from '../interfaces/external-dependencies.js';
import { getErrorMessage } from '../errors/debug-errors.js';
import type { IProxyManager } from '../proxy/proxy-manager.js';

/**
 * Where the adapter's ownership currently sits. Three states, not a boolean:
 * 'transferred' and 'released' are both "not ours any more", but confusing them
 * is how a caller ends up looking for a disposed adapter inside a running proxy,
 * so the error a misuse raises names which one actually happened.
 */
export type AdapterLeaseState = 'held' | 'transferred' | 'released';

export class AdapterLease {
  private state: AdapterLeaseState = 'held';

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

  /** Which of the three ownership states this lease is in. */
  getState(): AdapterLeaseState {
    return this.state;
  }

  /**
   * Hand the adapter to a ProxyManager, which becomes its owner and disposer.
   *
   * Ownership moves only after `factory.create` returns: a throwing factory
   * leaves the lease held, so the caller's `finally` still disposes.
   */
  transferTo(factory: IProxyManagerFactory): IProxyManager {
    if (this.state !== 'held') {
      throw new Error(
        `Adapter lease for session ${this.sessionId} was already ${this.state}`
      );
    }
    const proxyManager = factory.create(this.adapter);
    this.state = 'transferred';
    return proxyManager;
  }

  /**
   * Dispose the adapter if this lease still owns it. Idempotent, and a no-op
   * after a transfer, so it is safe as the sole `finally` of a setup block.
   *
   * **Never throws, and that is load-bearing**: this is the `finally` of
   * `ProxyLauncher.start`, so anything escaping here replaces the setup error
   * that sent us there with a teardown error — hiding the cause the caller was
   * about to report. So every step is inside the guard, not just the call:
   * a missing or nullish adapter (a partial registry double), a `dispose()`
   * that throws *synchronously* (no promise ever exists, so `.catch()` on the
   * result would never run), a rejected `dispose()`, and a logger that throws
   * while reporting one of those.
   */
  async release(): Promise<void> {
    if (this.state !== 'held') {
      return;
    }
    this.state = 'released';

    try {
      // Duck-typed for parity with ProxyManager.cleanup(), whose adapter handle
      // is likewise optional-shaped — and read inside the guard, because the
      // property access itself throws if the adapter is nullish.
      const disposable = this.adapter as { dispose?: () => Promise<void> } | undefined;
      if (typeof disposable?.dispose !== 'function') {
        return;
      }
      await disposable.dispose();
    } catch (disposeError: unknown) {
      this.warnDisposeFailed(disposeError);
    }
  }

  /**
   * Report a failed disposal. Guarded in turn: a logger that throws must not
   * become the failure `release()` promises never to raise, and there is
   * nowhere left to report it.
   */
  private warnDisposeFailed(disposeError: unknown): void {
    try {
      this.logger.warn(
        `[SessionManager] Failed to dispose adapter after launch setup error for session ${
          this.sessionId
        }: ${getErrorMessage(disposeError)}`
      );
    } catch {
      // Deliberately empty — see above.
    }
  }
}
