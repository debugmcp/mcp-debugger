/**
 * The one way to dispose an adapter you are done with.
 *
 * Two call sites own an adapter's registry slot and have to give it back:
 * `AdapterLease.release()` (the setup window) and `ProxyManager.cleanup()`
 * (after the transfer). Both ran their own dispose-with-warn block, and the
 * two blocks disagreed in the way that matters: the lease awaited inside a
 * `try`, while `ProxyManager` fire-and-forgot with `dispose().catch(...)` — a
 * `dispose()` that throws *synchronously* produces no promise, so that
 * `.catch` never runs and the throw escaped into `cleanup()` mid-teardown.
 *
 * Awaiting inside the guard covers both failure modes with one warn shape.
 * Neither site has anywhere to report a failure to give a slot back — the
 * lease is a `finally` guarding the error the caller is about to report, and
 * cleanup runs on the exit path — so this is deliberately total: a rejection,
 * a synchronous throw, an adapter that turns out not to have `dispose` at all,
 * and a logger that throws while reporting one of those all end here.
 *
 * `context` is the per-site prefix, and it carries the whole difference
 * between the two messages, which are pinned by their respective tests.
 */
import type { IDebugAdapter, ILogger } from '@debugmcp/shared';
import { getErrorMessage } from '../errors/debug-errors.js';

export type AdapterDisposalReporter = (error: unknown) => void;

/**
 * Dispose an adapter and report either a synchronous throw or an asynchronous
 * rejection without ever allowing disposal or reporting to escape.
 */
export async function disposeAdapterSafely(
  adapter: IDebugAdapter,
  reporter: AdapterDisposalReporter
): Promise<void> {
  try {
    await adapter.dispose();
  } catch (disposeError: unknown) {
    try {
      reporter(disposeError);
    } catch {
      // Disposal is a terminal cleanup path; a broken reporter cannot revive it.
    }
  }
}

/**
 * Dispose `adapter`, reporting any failure as `"<context>: <message>"` and
 * never throwing.
 *
 * The duck-typed `typeof adapter.dispose === 'function'` guard both sites used
 * to carry is gone: `IDebugAdapter.dispose()` is required, and the guard only
 * ever protected hand-rolled test doubles that omitted it. A double that still
 * does is now reported as a failed disposal rather than silently skipped,
 * which is the honest answer — the registry slot was not returned.
 */
export async function disposeAdapterQuietly(
  adapter: IDebugAdapter,
  logger: ILogger,
  context: string
): Promise<void> {
  await disposeAdapterSafely(adapter, (disposeError) => {
      logger.warn(`${context}: ${getErrorMessage(disposeError)}`);
  });
}
