/**
 * The seam between `SessionManagerOperations` and the collaborators the debug
 * operations are split across.
 *
 * Every member is **late bound** over the facade: methods are arrows that call
 * `this.<method>(...)` when invoked, data members are getters that re-read the
 * facade field. That is deliberate and load-bearing, not a style choice — tests
 * reassign `selectPolicy` / `stopProxyPreservingSession` / `closeSession` on a
 * live SessionManager instance and write the tunables (`attachVerifyTimeoutMs`
 * and friends) as plain fields. A context built from bound references captured
 * at construction time would silently ignore all of it.
 *
 * The per-slice `Pick<>` aliases below are the actual constructor parameter
 * types: a collaborator declares the narrowest slice it uses, so what each one
 * touches is readable from its signature and widening it is a visible edit.
 */
import type {
  AdapterPolicy,
  DebugLanguage,
  IAdapterRegistry,
  IFileSystem,
  ILogger,
  SessionState,
  StackFrame
} from '@debugmcp/shared';
import type { ManagedSession } from './session-store.js';
import type { CustomLaunchRequestArguments } from './session-manager-core.js';
import type { IProxyManager } from '../proxy/proxy-manager.js';
import type { IProxyManagerFactory } from '../factories/proxy-manager-factory.js';
import type { ValidationResultCache } from '../utils/language-availability.js';

/**
 * The timing windows debug operations wait on. Held on the facade as protected
 * fields (tests shrink them by assignment), read through here so a collaborator
 * always sees the current value rather than a construction-time snapshot.
 */
export interface OperationsTunables {
  readonly attachVerifyTimeoutMs: number;
  readonly attachVerifyIntervalMs: number;
  readonly attachPauseStopTimeoutMs: number;
  readonly stepGraceMs: number;
  readonly pauseGraceMs: number;
}

/**
 * Everything the operation collaborators are allowed to reach for. Anything not
 * listed here stays private to the facade.
 */
export interface OperationsContext {
  readonly logger: ILogger;
  readonly fileSystem: IFileSystem;
  readonly adapterRegistry: IAdapterRegistry;
  readonly proxyManagerFactory: IProxyManagerFactory;
  readonly launchValidationCache: ValidationResultCache;
  readonly logDirBase: string;
  readonly defaultDapLaunchArgs: Partial<CustomLaunchRequestArguments>;
  readonly dryRunTimeoutMs: number;
  readonly tunables: OperationsTunables;

  /** `_getSessionById` — throws SessionNotFoundError for an unknown id. */
  getSession(sessionId: string): ManagedSession;
  /** `sessionStore.update` — patch stored session fields. */
  updateSession(sessionId: string, updates: Partial<ManagedSession>): void;
  /** `_updateSessionState` — legacy state plus the derived dual-state overlay. */
  updateState(session: ManagedSession, newState: SessionState): void;

  /**
   * The data layer's policy lookup: total, and overridable by tests.
   * NOT interchangeable with `selectStorePolicy`.
   */
  selectPolicy(language: string | DebugLanguage): AdapterPolicy;
  /**
   * The session store's policy lookup (`sessionStore.selectPolicy`). Both
   * lookups resolve through `getPolicyForLanguage`, which falls back to the
   * default policy rather than throwing — the distinction is the SEAM, not the
   * result: tests override `selectPolicy` on the facade instance and may hand
   * the store a double without `selectPolicy` at all, so every moved call keeps
   * the source it always had (the launch-time function-breakpoint warning reads
   * the store's, behind a try/catch).
   */
  selectStorePolicy(language: DebugLanguage): AdapterPolicy;

  findFreePort(): Promise<number>;
  setupProxyEventHandlers(
    session: ManagedSession,
    proxyManager: IProxyManager,
    effectiveLaunchArgs: Partial<CustomLaunchRequestArguments>
  ): void;
  cleanupProxyEventHandlers(session: ManagedSession, proxyManager: IProxyManager): void;
  stopProxyPreservingSession(session: ManagedSession): Promise<void>;
  closeSession(sessionId: string): Promise<boolean>;
  getStackTrace(
    sessionId: string,
    threadId?: number,
    includeInternals?: boolean
  ): Promise<StackFrame[]>;
  redactionEnabled(): boolean;
}

/**
 * The proxy launch: adapter creation, the configuration transform, executable
 * resolution and the ProxyManager start — launch and attach both go through it.
 */
export type ProxyLaunchContext = Pick<
  OperationsContext,
  | 'logger'
  | 'fileSystem'
  | 'adapterRegistry'
  | 'proxyManagerFactory'
  | 'logDirBase'
  | 'defaultDapLaunchArgs'
  | 'updateSession'
  | 'selectPolicy'
  | 'findFreePort'
  | 'setupProxyEventHandlers'
>;

/**
 * Launch-mode sessions: the toolchain gate, state and store updates, the
 * dry-run window, the proxy-failure record (hence the filesystem) and the
 * session-preserving teardown of a previous proxy.
 */
export type LaunchContext = Pick<
  OperationsContext,
  | 'logger'
  | 'fileSystem'
  | 'adapterRegistry'
  | 'launchValidationCache'
  | 'dryRunTimeoutMs'
  | 'getSession'
  | 'updateSession'
  | 'updateState'
  | 'selectPolicy'
  | 'stopProxyPreservingSession'
>;

/**
 * Attach-mode sessions: the attach gate (registry metadata), state and store
 * updates, the verification tunables, the proxy-failure record (hence the
 * filesystem), and both teardowns — session-preserving on failure, closeSession
 * on detach-with-terminate.
 */
export type AttachContext = Pick<
  OperationsContext,
  | 'logger'
  | 'fileSystem'
  | 'adapterRegistry'
  | 'getSession'
  | 'updateSession'
  | 'updateState'
  | 'selectPolicy'
  | 'stopProxyPreservingSession'
  | 'cleanupProxyEventHandlers'
  | 'closeSession'
  | 'tunables'
>;

/** Breakpoint tooling: the store, the wire, and both policy sources. */
export type BreakpointContext = Pick<
  OperationsContext,
  'logger' | 'getSession' | 'selectPolicy' | 'selectStorePolicy'
>;

/** Stepping / continue / pause / threads. */
export type ExecutionContext = Pick<
  OperationsContext,
  'logger' | 'getSession' | 'updateState' | 'getStackTrace' | 'tunables'
>;

/** Expression evaluation, including the redaction hook. */
export type EvaluateContext = Pick<
  OperationsContext,
  'logger' | 'getSession' | 'selectPolicy' | 'redactionEnabled'
>;

/**
 * JVM hot swap: a DAP round trip, anchor re-resolution (hence the filesystem)
 * and breakpoint re-planting.
 */
export type HotSwapContext = Pick<
  OperationsContext,
  'logger' | 'fileSystem' | 'getSession'
>;

/** The read-only DAP mirror endpoint, whose record lives on the session. */
export type MirrorContext = Pick<
  OperationsContext,
  'logger' | 'getSession' | 'updateSession'
>;
