/**
 * Reaching the operations facade's protected collaborators from a test.
 *
 * `SessionManagerOperations` holds its slices (`execution`, `launcher`,
 * `proxyLauncher`, ...) as protected fields, so a test that drives one — or
 * spies on it — needs a cast. This is that cast, in one place: two suites had
 * grown byte-identical copies of it, and the copies had already started to
 * disagree about which collaborators they named.
 */
import type { SessionManagerOperations } from '../../../src/session/session-manager-operations.js';
import type { ExecutionController } from '../../../src/session/execution/execution-controller.js';
import type { DebugLauncher } from '../../../src/session/launch/debug-launcher.js';
import type { ProxyLaunchRequest } from '../../../src/session/launch/proxy-launcher.js';
import type { ManagedSession } from '../../../src/session/session-store.js';
import type { LanguageSpecificLaunchConfig } from '@debugmcp/shared';

/**
 * The launch request as these tests build it. Every field is production's
 * except `dapLaunchArgs`, which takes the attach shape (`request`, `host`,
 * `port`, `__attachMode`) and the adapter extras that production passes
 * through an `as Partial<CustomLaunchRequestArguments>` cast of its own.
 * Anything renamed in `ProxyLaunchRequest` still fails the call sites here.
 */
export type ProxyLaunchRequestView = Omit<ProxyLaunchRequest, 'dapLaunchArgs'> & {
  dapLaunchArgs?: Record<string, unknown>;
};

/**
 * `ProxyLauncher.start` as these tests drive it. One further loosening: spies
 * resolve `undefined` for a launch config nothing downstream reads, which the
 * real `Promise<LanguageSpecificLaunchConfig>` return type would reject.
 */
export interface ProxyLauncherView {
  start(
    session: ManagedSession,
    request: ProxyLaunchRequestView
  ): Promise<LanguageSpecificLaunchConfig | void>;
}

/** The collaborators tests reach into. Add to this rather than re-casting. */
export interface OperationsInternals {
  execution: ExecutionController;
  launcher: DebugLauncher;
  proxyLauncher: ProxyLauncherView;
}

/** The protected collaborators of an operations facade, for a test to drive. */
export function internals(ops: SessionManagerOperations): OperationsInternals {
  return ops as unknown as OperationsInternals;
}
