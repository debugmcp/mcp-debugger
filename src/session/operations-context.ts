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
import type { StackTraceResult } from './inspection/frame-anchor-resolver.js';
import type { LocalVariablesResult } from './session-manager-data.js';
import type { CustomLaunchRequestArguments } from './session-manager-core.js';
import type { VariableAccessMode } from '../utils/variable-access.js';
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
  readonly launchReadyCeilingMs: number;
  readonly launchHoldMs: number;
  readonly waitForStopDefaultMs: number;
  /**
   * Bound on the stop snapshot's locals read (issue #982) — a window on the
   * answer, not a deadline on the debuggee: on expiry the answer ships
   * without `locals` and the snapshot note says what expired.
   */
  readonly snapshotLocalsTimeoutMs: number;
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
  readonly tunables: OperationsTunables;

  /** `_getSessionById` — throws SessionNotFoundError for an unknown id. */
  getSession(sessionId: string): ManagedSession;
  /** `sessionStore.update` — patch stored session fields. */
  updateSession(sessionId: string, updates: Partial<ManagedSession>): void;
  /** `_updateSessionState` — legacy state plus the derived dual-state overlay. */
  updateState(session: ManagedSession, newState: SessionState): void;
  /**
   * Be told whenever the session's state changes — every `_updateSessionState`
   * transition, and the session's removal. The listener gets no arguments and
   * runs inside the transition: read the state when the call stack has unwound
   * (see `waitForSessionState`), not from within it. Returns the unsubscribe.
   */
  onStateChange(sessionId: string, listener: () => void): () => void;

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
  /**
   * The inverse of `setupProxyEventHandlers`. Detach removes the listeners
   * before it stops the worker — closeSession's ordering — so the proxy's own
   * exit cannot be read by the session's handlers as the debuggee finishing
   * (issue #711).
   */
  cleanupProxyEventHandlers(session: ManagedSession, proxyManager: IProxyManager): void;
  stopProxyPreservingSession(session: ManagedSession): Promise<void>;
  closeSession(sessionId: string): Promise<boolean>;
  getStackTrace(
    sessionId: string,
    threadId?: number,
    includeInternals?: boolean
  ): Promise<StackFrame[]>;
  /** The data layer's `getStackTraceDetailed`: frames plus the filtering metadata. */
  getStackTraceDetailed(
    sessionId: string,
    threadId?: number,
    includeInternals?: boolean,
    opts?: { ensureStackReady?: boolean }
  ): Promise<StackTraceResult>;
  /**
   * The locals pipeline behind an already-resolved stack (issue #982): the
   * stop snapshot reads locals from the landing's own resolver result.
   */
  extractLocalsFromResolved(
    sessionId: string,
    stackResult: StackTraceResult,
    opts?: { includeSpecial?: boolean; names?: string[]; maxFrames?: number }
  ): Promise<LocalVariablesResult>;
  redactionEnabled(): boolean;
  /** Stop-snapshot switch (issue #982): DEBUG_MCP_NO_SNAPSHOT opts out. */
  snapshotEnabled(): boolean;
  /** Least-privilege mode (issue #237): 'explicit' withholds snapshot locals. */
  variableAccessMode(): VariableAccessMode;
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
  | 'redactionEnabled'
>;

/**
 * Launch-mode sessions: the toolchain gate, state and store updates (and the
 * state subscription the readiness waits read), the proxy-failure record
 * (hence the filesystem), the session-preserving teardown of a previous
 * proxy, and the detailed stack behind the landing a launch that stopped
 * reports (issue #951). A dry run (issue #812) reads only the gate and the
 * policy: it is answered from the launch preparation and changes nothing.
 */
export type LaunchContext = Pick<
  OperationsContext,
  | 'logger'
  | 'fileSystem'
  | 'adapterRegistry'
  | 'launchValidationCache'
  | 'tunables'
  | 'getSession'
  | 'updateSession'
  | 'updateState'
  | 'onStateChange'
  | 'selectPolicy'
  | 'getStackTraceDetailed'
  | 'stopProxyPreservingSession'
  | 'extractLocalsFromResolved'
  | 'redactionEnabled'
  | 'snapshotEnabled'
  | 'variableAccessMode'
>;

/**
 * Attach-mode sessions: the attach gate (registry metadata), state and store
 * updates, the verification tunables, the proxy-failure record (hence the
 * filesystem), and all three teardowns — session-preserving on failure,
 * closeSession on detach-with-terminate, and listener cleanup before the
 * worker stop on a plain detach.
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
  | 'getStackTraceDetailed'
  | 'stopProxyPreservingSession'
  | 'cleanupProxyEventHandlers'
  | 'closeSession'
  | 'tunables'
  | 'extractLocalsFromResolved'
  | 'redactionEnabled'
  | 'snapshotEnabled'
  | 'variableAccessMode'
>;

/** Breakpoint tooling: the store, the wire, and both policy sources. */
export type BreakpointContext = Pick<
  OperationsContext,
  'logger' | 'getSession' | 'selectPolicy' | 'selectStorePolicy'
>;

/**
 * Stepping / continue / pause / threads / waiting for a stop. The policy and
 * the detailed stack serve the pending-stop explanation (issue #678): the raw
 * origin frame of a step, and the adapter's account of why it may never land.
 * The state subscription serves wait_for_stop (issue #849).
 */
export type ExecutionContext = Pick<
  OperationsContext,
  | 'logger'
  | 'getSession'
  | 'updateState'
  | 'onStateChange'
  | 'getStackTraceDetailed'
  | 'selectPolicy'
  | 'tunables'
  | 'defaultDapLaunchArgs'
  | 'extractLocalsFromResolved'
  | 'redactionEnabled'
  | 'snapshotEnabled'
  | 'variableAccessMode'
>;

/** Expression evaluation, including the redaction hook. */
export type EvaluateContext = Pick<
  OperationsContext,
  'logger' | 'getSession' | 'selectPolicy' | 'redactionEnabled'
>;

/** The read-only DAP mirror endpoint, whose record lives on the session. */
export type MirrorContext = Pick<
  OperationsContext,
  'logger' | 'getSession' | 'updateSession'
>;
