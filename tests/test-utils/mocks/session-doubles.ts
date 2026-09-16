/**
 * The session-layer doubles shared by the SessionManagerOperations suites
 * (attach-modes, launch-gate, operations-coverage), which used to carry
 * byte-identical copies of the store slice, the proxy-manager key list and
 * the store literal.
 *
 * Both doubles are deliberately partial. `PartialSessionStore` names the six
 * `SessionStore` members those suites drive; `ProxyManagerMockKeys` names the
 * `IProxyManager` members the launch/attach paths reach. Each file widens its
 * double behind ONE sanctioned cast at the factory boundary
 * (`as unknown as SessionStore` / `as unknown as IProxyManager`), so the
 * partiality is visible where the real type is demanded and nowhere else.
 */
import { vi, type Mock } from 'vitest';
import type { SessionState } from '@debugmcp/shared';
import type { IProxyManager } from '../../../src/proxy/proxy-manager.js';
import type { ManagedSession, SessionStore } from '../../../src/session/session-store.js';

/** The store members the operations suites drive. The rest of SessionStore is never reached. */
export type PartialSessionStore = Pick<
  SessionStore,
  'get' | 'getOrThrow' | 'update' | 'updateState' | 'remove' | 'getAll'
>;

/** `PartialSessionStore` with every member as the `vi.fn` it is, typed to the real signature. */
export type PartialSessionStoreMock = { [K in keyof PartialSessionStore]: Mock<PartialSessionStore[K]> };

/**
 * A store double wrapped around one `ManagedSession`: `get`/`getOrThrow`
 * answer it, `updateState` writes `session.state` (so a test can assert on
 * the session object it holds), `remove` reports true, `getAll` lists it.
 * Captured by reference — mutate the session, not the binding.
 */
export function createPartialSessionStore(session: ManagedSession): PartialSessionStoreMock {
  return {
    get: vi.fn<PartialSessionStore['get']>().mockReturnValue(session),
    getOrThrow: vi.fn<PartialSessionStore['getOrThrow']>().mockReturnValue(session),
    update: vi.fn<PartialSessionStore['update']>(),
    updateState: vi.fn<PartialSessionStore['updateState']>().mockImplementation(
      (_sessionId: string, newState: SessionState) => {
        session.state = newState;
      }
    ),
    remove: vi.fn<PartialSessionStore['remove']>().mockReturnValue(true),
    getAll: vi.fn<PartialSessionStore['getAll']>().mockReturnValue([session])
  };
}

/** The proxy-manager members the launch and attach paths reach. */
export type ProxyManagerMockKeys =
  | 'isRunning'
  | 'getCurrentThreadId'
  | 'sendDapRequest'
  | 'stop'
  | 'once'
  | 'off'
  | 'removeListener'
  | 'on'
  | 'start';

/** Just the stubs: for a suite that never installs the double on a `ManagedSession`. */
export type ProxyManagerMocks = { [K in ProxyManagerMockKeys]: Mock };

/**
 * The stubs AND the `IProxyManager` (EventEmitter) surface: for a suite that
 * installs the double on `ManagedSession.proxyManager`, where it has to *be*
 * an `IProxyManager` at the type level while every stub stays reachable as a `Mock`.
 */
export type ProxyManagerDouble = IProxyManager & ProxyManagerMocks;
