/**
 * Core session management functionality including lifecycle, state management,
 * and event handling.
 */
import { EventEmitter } from 'events';
import {
  SessionState, SessionLifecycleState, DebugLanguage, DebugSessionInfo, mapLegacyState,
  isTerminalSessionState, AdapterPolicy, SessionOutputEntry, redactSecretsInString
} from '@debugmcp/shared';
import type { Breakpoint, FunctionBreakpoint, ProgramEndExplanation, SessionStopInfo, StackFrame } from '@debugmcp/shared';
import { USER_BREAK_REASONS } from '@debugmcp/shared';
import { stopProvesDebuggerOn } from './debugger-off.js';
import { isRedactionEnabled } from '../utils/redaction-mode.js';
import { isSnapshotEnabled } from '../utils/snapshot-mode.js';
import { getVariableAccessMode, type VariableAccessMode } from '../utils/variable-access.js';
import type { FrameSummary } from './inspection/frame-anchor-resolver.js';
import { ValidationResultCache } from '../utils/language-availability.js';
import { SessionStore, ManagedSession } from './session-store.js';
import type { UnhitBreakpointSummary } from './breakpoints/launch-warnings.js';
import type { ToolchainValidationState } from './session-store.js';
import { OutputRingBuffer } from './output-buffer.js';
import {
  beginProxyGeneration,
  clearPauseIntent,
  getCurrentPauseIntent
} from './execution/pause-intent.js';
import { DebugProtocol } from '@vscode/debugprotocol'; 
import path from 'path';
import os from 'os';
import { 
  IFileSystem, 
  INetworkManager, 
  ILogger,
  IEnvironment
} from '@debugmcp/shared';
import { ISessionStoreFactory } from '../factories/session-store-factory.js';
import { IProxyManager, type ChildReportedEvent } from '../proxy/proxy-manager.js';
import { isChildProxyView } from '../proxy/child-proxy-view.js';
import { maxChildSessions, MAX_CHILD_SESSIONS_ENV } from './child-session-cap.js';
import { IProxyManagerFactory } from '../factories/proxy-manager-factory.js';
import type { BreakpointSyncResult, FunctionBreakpointSyncResult } from '../proxy/dap-proxy-interfaces.js';
import { CHILD_RELEASE_COMMAND } from '../proxy/dap-proxy-interfaces.js';
import { consumeChildOrigin } from '../utils/child-origin-events.js';
import { isPidAlive } from '../utils/jvm-orphan-reaper.js';
import { IAdapterRegistry } from '@debugmcp/shared';
import {
  collectProxyFailureDiagnostics,
  logProxyFailure,
  type ProxyFailureDiagnostics,
  lastAdapterStderrLine,
  quotesAdapterStderrLine
} from './launch/proxy-failure-diagnostics.js';
import type { AnchorResolution } from './breakpoints/anchor-resolution.js';
import {
  applyBoundLocation,
  applyHitBreakpointIds,
  keepHitProven,
  mirrorsBreakpointsToChild,
  resetBinding,
  samePath,
  setAdapterMessage,
  setCuratedMessage,
  settleStoredMessage,
  stampRefusalMessage
} from './breakpoints/hit-verification.js';


// Custom launch arguments interface extending DebugProtocol.LaunchRequestArguments
export interface CustomLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  stopOnEntry?: boolean;
  justMyCode?: boolean;
}

/**
 * The `data` bag a debug operation returns alongside its state.
 *
 * A closed set of typed common fields rather than a discriminated union:
 * `startDebugging` alone returns three shapes (dry run, launch, toolchain
 * refusal) and `restartDebugging` spreads whatever the launch produced, so a
 * union would force narrowing at every server read for no gain. Keeping the
 * optional field set closed makes misspelled reads and writes fail typecheck.
 */
export interface DebugResultData extends ProxyFailureDiagnostics {
  /** Human-readable status for the tool result. */
  message?: string;
  /** Advisory notes joined by the operation (unbound breakpoints, dropped keys, ...). */
  warning?: string;
  /**
   * The debuggee is still running and the operation completes asynchronously.
   * Shared rather than step-specific: `pause` reports it too when its grace
   * window elapses before a `stopped` event arrives.
   */
  pending?: boolean;
  /** Dry-run response fields. */
  dryRun?: boolean;
  command?: string;
  script?: string;
  /** Launch result fields. */
  reason?: string;
  stopOnEntrySuccessful?: boolean;
  toolchainValidation?: ToolchainValidationState;
  /**
   * Run-to-completion fields (issue #701): set when the launch ended before
   * any user-visible stop. `exitCode` only when the debuggee reported one.
   */
  exitCode?: number;
  unhitBreakpoints?: UnhitBreakpointSummary[];
  /** Restart result fields. */
  breakpointsReapplied?: number;
  outputReset?: boolean;
  /** The restart went through the adapter's own restart request — same process, output buffer kept (issue #876). */
  hotRestart?: boolean;
  anchorResolution?: AnchorResolution;
  /**
   * Detach result field (issue #763): whether the paused target was resumed
   * ahead of the disconnect — `false` when the policy asked for it and the
   * continue was refused (`warning` then says so). Absent when the policy
   * asks for no resume or the target was not paused.
   */
  resumedBeforeDetach?: boolean;
}

/**
 * Where the debuggee is stopped, as a result payload reports it.
 *
 * Always derived from the top `StackFrame`, so it is defined as that frame's
 * location fields rather than restated: `column` is optional on `StackFrame`
 * too, so the wire shape is exactly what the five hand-copied literals this
 * replaces produced.
 */
export type StopLocation = Pick<StackFrame, 'file' | 'line' | 'column'>;

/**
 * What a location-bearing answer (pause, step, wait_for_stop, and a launch
 * that stopped) carries about where the stop landed, read through the frame-anchor resolver (issue
 * #904): the first visible frame when the stack could be read; the thread
 * the answer is anchored on, only when it is not the thread the stop was
 * reported on; and a note when there is something to say — a sibling
 * thread adopted, or no frame of the shown stack being program code.
 */
export type StopLandingFields = {
  location?: StopLocation;
  threadId?: number;
  note?: string;
};

/**
 * The exception half of a stop snapshot (issue #982): what the adapter
 * reported, secret-redacted — the stop event's description/text, topped up
 * with whatever exceptionInfo had merged by the time the answer was built
 * (never awaited). All fields optional: a CodeLLDB panic relabel reports
 * nothing, and then the whole object is omitted.
 */
export interface SnapshotException {
  type?: string;
  message?: string;
  /** exceptionInfo's description, only when it adds to `message`. */
  details?: string;
}

/**
 * The bounded state snapshot a PAUSED answer carries (issue #982), composed
 * from the landing read's own stack: top visible frames, flat redacted
 * top-frame locals under tight caps, and the exception when the stop is one.
 * Orientation, not navigation — get_local_variables / get_variables remain
 * the way to go deeper.
 */
export interface StopSnapshot {
  exception?: SnapshotException;
  frames: FrameSummary[];
  locals?: Record<string, string>;
  /**
   * In place of `locals` on a repeated stop in the same frame (issue #983):
   * only what changed since the last shown locals (new variables appear with
   * before "<undefined>"; one that left scope simply drops out). An empty
   * object means nothing visible changed — that is information.
   */
  changedVariables?: Record<string, { before: string; after: string }>;
  /** What was cut, pointing at get_local_variables for the full list. */
  truncation?: string;
  /** What expired or was withheld, and any locals anchor note. */
  note?: string;
}

/** The landing fields plus the snapshot: what every stop answer may carry. */
export type StopAnswerFields = StopLandingFields & { snapshot?: StopSnapshot };

/**
 * What a step operation returns: `message` is always set, plus where it
 * landed. `stopReason`/`rawStopReason` are present only when the stop that
 * ended the step was recorded and was not the step itself (issue #678) — a
 * breakpoint or exception that fired first, or a pause from elsewhere.
 */
export type StepResultData = DebugResultData & StopAnswerFields & {
  message: string;
  stopReason?: string;
  rawStopReason?: string;
};

/**
 * What a pause returns. `stopReason`/`rawStopReason` are present only when
 * this pause's own stop was recorded (never a stale earlier one), and
 * `location` only when the stack was readable by the time it settled.
 */
export type PauseResultData = DebugResultData & StopAnswerFields & {
  message: string;
  stopReason?: string;
  rawStopReason?: string;
};

/**
 * What wait_for_stop returns (issue #849): `message` always. For a paused
 * session, the stop record the session listing shows and — when the stack was
 * readable — where it is. A session that ended keeps `lastStop` only for a
 * stop that landed during the wait itself. The other two answers use
 * `DebugResultData`'s own fields: `exitCode` for a session that ended and
 * reported one, `pending` when the timeout passed first.
 */
/** How much of the output's tail a policy reads the program's end from (issue #877). */
const PROGRAM_END_OUTPUT_TAIL_CHARS = 8000;

/**
 * One descendant in a `children` answer (the session tree, issue #1081):
 * the row's id, the adapter's name for the process, its state, and the
 * session that spawned it — listed depth first in adoption order, the order
 * the tree-aware wait selects in.
 */
export interface ChildSessionSummary {
  sessionId: string;
  name: string;
  state: SessionState;
  parentSessionId: string;
}

/**
 * What an answer on a session with a tree carries
 * (docs/architecture/session-tree.md, "wait_for_stop is tree-aware").
 */
export interface TreeAnswerFields {
  /** Every descendant with its state; absent when the session has none. */
  children?: ChildSessionSummary[];
  /**
   * Reports released to run undebugged on this session's connection during
   * this run (beyond the cap, or an adoption that failed): a running total,
   * never consumed, so concurrent waiters read the same number.
   */
  childrenReleased?: number;
  /** Descendants this operation closed (a relaunch, a close) — when any. */
  childrenClosed?: number;
}

export type WaitForStopResultData = DebugResultData & StopAnswerFields & TreeAnswerFields & {
  /**
   * The session this answer is about (issue #1081): the one asked for, or the
   * descendant the tree-aware selection named — the id to inspect, step and
   * continue with.
   */
  sessionId: string;
  message: string;
  lastStop?: SessionStopInfo;
  /**
   * What the adapter read into the program's end (issue #877; e.g. the Dart policy's
   * `availableDevices`), for a session that ended — the same shape the session listing
   * carries. Nested so the tool handler can hoist its data beside the message without
   * knowing the keys; the note is already in `message`.
   */
  programEnd?: ProgramEndExplanation;
};

/**
 * What a launch (start_debugging, and restart_debugging, which replays one)
 * returns: the common fields — `reason`/`stopOnEntrySuccessful` for a stop,
 * the run-to-completion fields for a program that ended, `pending` for one
 * still running when the hold elapsed — plus, for a stop, where it landed
 * (issue #951): the same landing read a step, a pause or wait_for_stop makes,
 * so the answer names the frame the program is paused in and the handler can
 * read the line and the build behind it.
 */
export type LaunchResultData = DebugResultData & StopAnswerFields & TreeAnswerFields;

/**
 * What a detach returns on top of the common fields (the session tree, issue
 * #1081): the children a plain detach released to run undebugged, or a
 * terminating detach closed.
 */
export type DetachResultData = DebugResultData & Pick<TreeAnswerFields, 'childrenReleased' | 'childrenClosed'>;

/**
 * What a close did (the session tree, issue #1081): the rows it removed,
 * descendants first; how many of those were descendants; and, for a child,
 * whether its process was ended or released — for an attach root, that its
 * target and its descendants' were released to run on.
 */
export interface CloseSessionOutcome {
  closed: boolean;
  /** Every id removed, deepest first then the named session. */
  closedSessionIds: string[];
  /** Descendants closed with the named session, when any. */
  childrenClosed?: number;
  /** The named session is a child whose process this close ended (the policy's `closeChild: 'terminate'`). */
  processEnded?: true;
  /** The named session's target runs on: an attach root (its descendants' too), or a child under `closeChild: 'release'`. */
  released?: true;
}

/**
 * What a successful attach returns on top of the common fields: the same
 * landing an ordinary stop answer carries (issue #982 gave attach parity —
 * location/threadId/note/snapshot; before that only the `note` survived,
 * issue #900).
 */
export type AttachResultData = DebugResultData & StopAnswerFields;

export interface DebugResult<TData extends DebugResultData = DebugResultData> {
  success: boolean;
  state: SessionState;
  error?: string;
  data?: TData;
  canContinue?: boolean;
  // Machine-readable error identity for tests and callers (avoid string assertions)
  errorType?: string; // e.g., 'PythonNotFoundError'
  errorCode?: number; // e.g., -32602 (MCP InvalidParams)
}

/**
 * Complete dependencies for SessionManager
 */
export interface SessionManagerDependencies {
  fileSystem: IFileSystem;
  networkManager: INetworkManager;
  logger: ILogger;
  proxyManagerFactory: IProxyManagerFactory;
  sessionStoreFactory: ISessionStoreFactory;
  environment: IEnvironment;
  adapterRegistry: IAdapterRegistry;
}

/**
 * Configuration for SessionManager
 */
export interface SessionManagerConfig {
  logDirBase?: string;
  defaultDapLaunchArgs?: Partial<CustomLaunchRequestArguments>;
}

/**
 * Core session management functionality.
 *
 * Emits:
 * - 'output-captured' (sessionId: string, entry: SessionOutputEntry) — a debuggee
 *   output event was appended to the session's output buffer (issue #218).
 */
export abstract class SessionManagerCore extends EventEmitter {
  protected sessionStore: SessionStore;
  protected logDirBase: string;
  protected logger: ILogger;
  protected fileSystem: IFileSystem;
  protected networkManager: INetworkManager;
  protected environment: IEnvironment;
  protected proxyManagerFactory: IProxyManagerFactory;
  protected sessionStoreFactory: ISessionStoreFactory;
  public adapterRegistry: IAdapterRegistry;

  protected defaultDapLaunchArgs: Partial<CustomLaunchRequestArguments>;

  // WeakMap to store event handlers for cleanup
  protected sessionEventHandlers = new WeakMap<ManagedSession, Map<string, (...args: unknown[]) => void>>();

  /**
   * Who wants to know when a session's state changes (issue #849): told after
   * every `_updateSessionState` transition and when the session is removed.
   * A plain per-session registry rather than an EventEmitter channel, so any
   * number of concurrent waits stays clear of the emitter's listener ceiling.
   */
  private readonly sessionStateListeners = new Map<string, Set<() => void>>();

  /**
   * Who wants to know when a session's subtree changes (the session tree,
   * issue #1081): told after every transition of the session or any
   * descendant — a child's first transition is its adoption — and after any
   * of them is removed. The tree-aware wait_for_stop subscribes here.
   */
  private readonly subtreeListeners = new Map<string, Set<() => void>>();

  /** Do not admit new descendants while an explicit close or relaunch tears down a subtree. */
  private readonly closingSubtrees = new Map<string, number>();

  /**
   * TTL cache for launch-gate toolchain probes (issue #360) — shares the
   * semantics of the list_supported_languages cache so repeated
   * start_debugging calls don't re-probe toolchains.
   */
  protected launchValidationCache = new ValidationResultCache();

  /**
   * Constructor with full dependency injection
   */
  constructor(
    config: SessionManagerConfig,
    dependencies: SessionManagerDependencies
  ) {
    super();
    this.logger = dependencies.logger;
    this.fileSystem = dependencies.fileSystem;
    this.networkManager = dependencies.networkManager;
    this.environment = dependencies.environment;
    this.proxyManagerFactory = dependencies.proxyManagerFactory;
    this.sessionStoreFactory = dependencies.sessionStoreFactory;
    this.adapterRegistry = dependencies.adapterRegistry;
    
    this.sessionStore = this.sessionStoreFactory.create();
    this.logDirBase = config.logDirBase || path.join(os.tmpdir(), 'debug-mcp-server', 'sessions');
    this.defaultDapLaunchArgs = config.defaultDapLaunchArgs || {
      stopOnEntry: false,
      justMyCode: true
    };

    this.fileSystem.ensureDirSync(this.logDirBase);
    this.logger.info(`[SessionManager] Initialized. Session logs will be stored in: ${this.logDirBase}`);
  }

  /**
   * Secret redaction of tool-facing values (issue #237): on unless the
   * environment opts out via DEBUG_MCP_NO_REDACT. Read per call — cheap, and
   * keeps construction order irrelevant.
   */
  protected redactionEnabled(): boolean {
    return isRedactionEnabled(this.environment);
  }

  /** Stop-snapshot switch (issue #982): on unless DEBUG_MCP_NO_SNAPSHOT opts out. */
  protected snapshotEnabled(): boolean {
    return isSnapshotEnabled(this.environment);
  }

  /**
   * Least-privilege variable access mode (issue #237). The snapshot reads it
   * so auto-locals never bypass what the inspection tools enforce.
   */
  protected variableAccessMode(): VariableAccessMode {
    return getVariableAccessMode(this.environment);
  }

  /**
   * The write-time redaction every buffer entry gets (issue #237): the text
   * to store and whether anything was masked, so the entry can be flagged.
   */
  private redactForBuffer(text: string): { text: string; redacted: boolean } {
    if (!this.redactionEnabled()) {
      return { text, redacted: false };
    }
    const result = redactSecretsInString(text);
    return result.redacted ? { text: result.value, redacted: true } : { text, redacted: false };
  }

  async createSession(params: { language: DebugLanguage; name?: string; executablePath?: string; }): Promise<DebugSessionInfo> {
    const createParams = {
      language: params.language,
      name: params.name,
      executablePath: params.executablePath
    };
    const sessionInfo = this.sessionStore.createSession(createParams);
    this.logger.info(`[SessionManager] Created new session: ${sessionInfo.name} (ID: ${sessionInfo.id}), state: ${sessionInfo.state}`);
    return sessionInfo;
  }

  protected async findFreePort(): Promise<number> {
    return this.networkManager.findFreePort();
  }

  protected _getSessionById(sessionId: string): ManagedSession {
    return this.sessionStore.getOrThrow(sessionId);
  }

  protected _updateSessionState(session: ManagedSession, newState: SessionState): void {
    if (newState === SessionState.PAUSED && !session.lastStop) {
      throw new Error(
        `Invariant violation: session ${session.id} cannot enter PAUSED without lastStop`
      );
    }
    if (session.state === newState) return;
    this.logger.info(`[SM _updateSessionState ${session.id}] State change: ${session.state} -> ${newState}`);
    
    // Update legacy state
    this.sessionStore.updateState(session.id, newState);
    
    // Update new state model based on legacy state
    const { lifecycle, execution } = mapLegacyState(newState);
    this.sessionStore.update(session.id, {
      sessionLifecycle: lifecycle,
      executionState: execution
    });
    this.notifySessionStateListeners(session.id);
    this.notifySubtreeListeners(session);
  }

  /**
   * Subscribe to a session's subtree (issue #1081): the session's own
   * transitions and removal, and those of every descendant, present or
   * adopted later. Returns the unsubscribe.
   */
  protected onSubtreeStateChange(sessionId: string, listener: () => void): () => void {
    let listeners = this.subtreeListeners.get(sessionId);
    if (!listeners) {
      listeners = new Set();
      this.subtreeListeners.set(sessionId, listeners);
    }
    listeners.add(listener);
    return () => {
      const current = this.subtreeListeners.get(sessionId);
      if (current?.delete(listener) && current.size === 0) {
        this.subtreeListeners.delete(sessionId);
      }
    };
  }

  /** Tell the subtree listeners of a session and of each of its ancestors. */
  private notifySubtreeListeners(session: ManagedSession): void {
    const seen = new Set<string>();
    let current: ManagedSession | undefined = session;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      const listeners = this.subtreeListeners.get(current.id);
      if (listeners) {
        for (const listener of [...listeners]) {
          try {
            listener();
          } catch (error) {
            this.logger.warn(
              `[SessionManager] Subtree listener threw for session ${current.id}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }
      current = current.parentSessionId ? this.sessionStore.get(current.parentSessionId) : undefined;
    }
  }

  /**
   * Subscribe to one session's state changes; returns the unsubscribe. The
   * listener runs inside the transition, so it must not read the state as
   * final there: an auto-continued entry stop enters PAUSED and leaves it
   * again before the `stopped` handler returns. `waitForSessionState` is the
   * reader built for that.
   */
  protected onSessionStateChange(sessionId: string, listener: () => void): () => void {
    let listeners = this.sessionStateListeners.get(sessionId);
    if (!listeners) {
      listeners = new Set();
      this.sessionStateListeners.set(sessionId, listeners);
    }
    listeners.add(listener);
    return () => {
      const current = this.sessionStateListeners.get(sessionId);
      if (current?.delete(listener) && current.size === 0) {
        this.sessionStateListeners.delete(sessionId);
      }
    };
  }

  private notifySessionStateListeners(sessionId: string): void {
    const listeners = this.sessionStateListeners.get(sessionId);
    if (!listeners) {
      return;
    }
    // A copy: a listener may unsubscribe while it is being told.
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // A listener must never be able to break a state transition.
        this.logger.warn(
          `[SessionManager] Session state listener threw for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Get the adapter policy for a session's language.
   */
  public getSessionPolicy(sessionId: string): AdapterPolicy {
    const session = this.sessionStore.getOrThrow(sessionId);
    return this.sessionStore.selectPolicy(session.language);
  }

  public getSession(sessionId: string): ManagedSession | undefined {
    return this.sessionStore.get(sessionId);
  }
  
  public getAllSessions(): DebugSessionInfo[] { 
    return this.sessionStore.getAll();
  }
  
  async closeSession(sessionId: string): Promise<boolean> {
    return (await this.closeSessionReporting(sessionId)).closed;
  }

  /**
   * Close a session and its subtree, and say what the close did (issue
   * #1081): the descendants it took with it, deepest first; for a child,
   * whether its process was ended (the policy's `closeChild` pin: debugpy
   * terminates it) or released; for an attach root, that every descendant was
   * detached with its target kept running, as the root's own target is.
   */
  async closeSessionReporting(sessionId: string, options: { terminateDebuggee?: boolean } = {}): Promise<CloseSessionOutcome> {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      this.logger.warn(`[SESSION_CLOSE_FAIL] Session not found: ${sessionId}`);
      return { closed: false, closedSessionIds: [] };
    }
    // An attach root's close preserves its external targets, descendants
    // included: their connections are closed without ending them.
    const releaseDescendants = !options.terminateDebuggee && !session.parentSessionId && session.attachMode === true;
    // Closing a retained row after its connection ended cannot terminate
    // its process. In particular, released children keep running after a
    // plain detach, even if their rows are explicitly closed later.
    const childEnd = session.parentSessionId && session.proxyManager ? this.childCloseSemantics(session) : undefined;
    const alreadyReleased = session.parentSessionId && session.programEndExplanation?.data?.released === true;
    const closedSessionIds: string[] = [];
    const finishClose = this.beginSubtreeClose(sessionId);
    try {
      for (const descendant of this.descendantsDeepestFirst(sessionId)) {
        // A child whose adapter can only release it (js-debug, issue #1082)
        // is closed with its target kept, whatever the cascade.
        const releaseChild = releaseDescendants || (descendant.proxyManager !== undefined && this.childCloseSemantics(descendant) === 'release');
        if (await this.closeSingleSession(descendant.id, { releaseChild })) {
          closedSessionIds.push(descendant.id);
        }
      }
      const childrenClosed = closedSessionIds.length;
      // An explicit terminating detach ends every child before the root's
      // disconnect can tear down their shared adapter/worker connection.
      if (options.terminateDebuggee && session.proxyManager) {
        try {
          await session.proxyManager.sendDapRequest('disconnect', { terminateDebuggee: true });
        } catch (disconnectError) {
          this.logger.warn('[SessionManager] Terminating disconnect failed, closing the session anyway:', disconnectError);
        }
      }
      const closed = await this.closeSingleSession(sessionId, { releaseChild: childEnd === 'release' });
      if (closed) {
        closedSessionIds.push(sessionId);
      }
      return {
        closed,
        closedSessionIds,
        ...(childrenClosed > 0 ? { childrenClosed } : {}),
        ...(closed && childEnd === 'terminate' ? { processEnded: true as const } : {}),
        ...(closed && (childEnd === 'release' || releaseDescendants || alreadyReleased) ? { released: true as const } : {})
      };
    } finally {
      finishClose();
    }
  }

  /**
   * The detach cascade (issue #1081): release every descendant of an attach
   * root, deepest first, ahead of the root's own detach — each child's
   * connection is closed with `terminateDebuggee: false`, so the process
   * runs on undebugged, and its row stays, `stopped`, with a program end
   * that says it was released. Returns how many were released.
   */
  protected async releaseDescendants(session: ManagedSession): Promise<number> {
    let released = 0;
    for (const descendant of this.descendantsDeepestFirst(session.id)) {
      if (isTerminalSessionState(descendant.state) && !descendant.proxyManager) {
        continue;
      }
      clearPauseIntent(descendant);
      const proxy = descendant.proxyManager;
      if (proxy) {
        try {
          this.cleanupProxyEventHandlers(descendant, proxy);
        } catch (cleanupError) {
          this.logger.error(`[SessionManager] Error during listener cleanup for session ${descendant.id}:`, cleanupError);
        }
        try {
          await (isChildProxyView(proxy) ? proxy.stop({ terminateDebuggee: false }) : proxy.stop());
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`[SessionManager] Releasing child session ${descendant.id} failed (best effort): ${message}`);
        } finally {
          descendant.proxyManager = undefined;
        }
      }
      descendant.programEndExplanation = {
        note: 'Released: detached with its parent; the process runs on undebugged.',
        data: { released: true }
      };
      this._updateSessionState(descendant, SessionState.STOPPED);
      this.sessionStore.update(descendant.id, { sessionLifecycle: SessionLifecycleState.TERMINATED });
      released += 1;
    }
    return released;
  }

  /** What closing a child does to its process: the adapter's measured semantics, pinned on the policy. */
  private childCloseSemantics(session: ManagedSession): 'terminate' | 'release' {
    try {
      return this.sessionStore.selectPolicy(session.language).childAdoption?.closeChild ?? 'terminate';
    } catch {
      return 'terminate';
    }
  }

  /**
   * Where a child session's output is read (issue #1082): the id of its
   * tree's root when the adapter delivers the whole tree's output on the
   * launch session's connection and none on the child's (js-debug, the
   * policy's `childOutput: 'launch-session'` pin); undefined when the
   * session's own buffer is the place to read (a root, a debugpy child,
   * or a child under an attach root, whose console output is per-target).
   */
  public outputOnFor(sessionId: string): string | undefined {
    const session = this.sessionStore.get(sessionId);
    if (!session?.parentSessionId) {
      return undefined;
    }
    try {
      if (this.sessionStore.selectPolicy(session.language).childAdoption?.childOutput !== 'launch-session') {
        return undefined;
      }
    } catch {
      return undefined;
    }
    const root = this.rootOf(session);
    // A launch owns the stdout/stderr pipes; an attach does not. js-debug's
    // default console capture on attach emits on each target's connection,
    // so pointing at the root would hide the child's actual output.
    return root.id === session.id || root.attachMode ? undefined : root.id;
  }

  /**
   * Close one session: its own proxy (a root's worker, a child's connection
   * — ended, or released to run on when `releaseChild` is set), its row, its
   * waiters.
   */
  protected async closeSingleSession(sessionId: string, options: { releaseChild?: boolean } = {}): Promise<boolean> {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      this.logger.warn(`[SESSION_CLOSE_FAIL] Session not found: ${sessionId}`);
      return false;
    }
    this.logger.info(`Closing debug session: ${sessionId}. Active proxy: ${session.proxyManager ? 'yes' : 'no'}`);
    clearPauseIntent(session);
    
    if (session.proxyManager) {
      session.lastProxyPid = session.proxyManager.getProxyPid?.() ?? session.lastProxyPid;
      // Always cleanup listeners first
      try {
        this.cleanupProxyEventHandlers(session, session.proxyManager);
      } catch (cleanupError) {
        this.logger.error(`[SessionManager] Critical error during listener cleanup for session ${sessionId}:`, cleanupError);
        // Continue with session closure despite cleanup errors
      }

      // Then stop the proxy
      try {
        const proxy = session.proxyManager;
        await (options.releaseChild && isChildProxyView(proxy) ? proxy.stop({ terminateDebuggee: false }) : proxy.stop());
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[SessionManager] Error stopping proxy for session ${sessionId}:`, message);
      } finally {
        session.proxyManager = undefined;
      }
    }

    // A root that ended while its children lived kept its worker for them
    // (issue #1081): an explicit close of the root stops it now.
    if (session.deferredWorkerStop) {
      const deferred = session.deferredWorkerStop;
      session.deferredWorkerStop = undefined;
      try {
        await deferred.stop();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[SessionManager] Error stopping the deferred worker of session ${sessionId}:`, message);
      }
    }

    // A terminal event handler may have cleared proxyManager and left its
    // stop() in flight; await it so close cannot outrun the teardown and
    // report success while the worker is still dying (issue #502).
    if (session.pendingProxyStop) {
      await session.pendingProxyStop;
      session.pendingProxyStop = undefined;
    }

    this._updateSessionState(session, SessionState.STOPPED);

    // Also update session lifecycle to TERMINATED
    this.sessionStore.update(sessionId, {
      sessionLifecycle: SessionLifecycleState.TERMINATED
    });

    this.logger.info(`Session ${sessionId} marked as STOPPED/TERMINATED.`);
    this.sessionStore.remove(sessionId);
    this.emit('session-removed', sessionId);
    // Anything still waiting on this session learns it is gone (issue #849),
    // and a wait on an ancestor's tree sees one descendant fewer (issue #1081).
    this.notifySessionStateListeners(sessionId);
    this.sessionStateListeners.delete(sessionId);
    this.notifySubtreeListeners(session);
    this.subtreeListeners.delete(sessionId);
    if (session.parentSessionId) {
      // A child's view reports the shared worker's pid, which legitimately
      // lives on (issue #1081); the leak probe is the root's. Its end may
      // settle the root's deferred reap, though.
      this.reapDeferredWorkerIfIdle(session);
    } else {
      this.verifyProxyReaped(sessionId, session.lastProxyPid);
    }
    return true;
  }

  /**
   * Post-close verification (issue #502): a short while after a session is
   * closed, confirm its proxy worker OS process is actually gone and log an
   * error naming the pid if not. The historical leak was invisible — every
   * layer had dropped its handle — so a recurrence must at least log itself.
   * The timer is unref'd and best-effort; overridable seam for tests.
   */
  protected pidLivenessCheck: (pid: number) => boolean = isPidAlive;

  private verifyProxyReaped(sessionId: string, pid: number | undefined): void {
    if (!pid) {
      return;
    }
    const timer = setTimeout(() => {
      try {
        if (this.pidLivenessCheck(pid)) {
          this.logger.error(
            `[SessionManager] Proxy worker pid=${pid} for session ${sessionId} is still alive after session close — leaked worker (issue #502)`
          );
        }
      } catch {
        // Liveness probe is diagnostics only; never let it throw.
      }
    }, 1500);
    timer.unref?.();
  }

  /**
   * Tear down the session's proxy (listeners, worker process, adapter slot)
   * while PRESERVING the session record — breakpoints, output buffer, launch
   * spec and lifecycle state survive for a relaunch. Contrast closeSession,
   * which removes the session from the store entirely. stop() runs cleanup()
   * even without a live proxy process, so the adapter registry slot is
   * always released (issue #238).
   */
  protected async stopProxyPreservingSession(session: ManagedSession): Promise<number> {
    const finishClose = this.beginSubtreeClose(session.id);
    try {
      return await this.stopProxyAndDescendants(session);
    } finally {
      finishClose();
    }
  }

  /** Returns how many descendants it closed (the relaunch answer's `childrenClosed`). */
  private async stopProxyAndDescendants(session: ManagedSession): Promise<number> {
    clearPauseIntent(session);
    // Children belong to a run (issue #1081): a relaunch, or the teardown of
    // a launch that failed, closes the previous run's children first.
    let childrenClosed = 0;
    for (const descendant of this.descendantsDeepestFirst(session.id)) {
      if (await this.closeSingleSession(descendant.id)) {
        childrenClosed += 1;
      }
    }
    const proxyManager = session.proxyManager;
    if (proxyManager) {
      session.lastProxyPid = proxyManager.getProxyPid?.() ?? session.lastProxyPid;
      try {
        this.cleanupProxyEventHandlers(session, proxyManager);
      } catch (cleanupError) {
        this.logger.error(
          `[SessionManager] Error during listener cleanup for session ${session.id}:`,
          cleanupError
        );
      }
      try {
        await proxyManager.stop();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[SessionManager] Error stopping proxy for session ${session.id}:`, message);
      } finally {
        session.proxyManager = undefined;
        // The mirror listener lived in the stopped worker (issue #217).
        session.exposure = undefined;
      }
    }
    // Await a teardown started by a terminal event handler (issue #502) so a
    // relaunch cannot race the previous worker's exit.
    if (session.pendingProxyStop) {
      await session.pendingProxyStop;
      session.pendingProxyStop = undefined;
    }
    return childrenClosed;
  }

  async closeAllSessions(): Promise<void> {
    this.logger.info(`Closing all debug sessions (${this.sessionStore.size()} active)`);
    const sessions = this.sessionStore.getAllManaged();
    for (const session of sessions) {
      // A root's cascade may have removed its children already (issue #1081).
      if (!this.sessionStore.get(session.id)) {
        continue;
      }
      await this.closeSession(session.id);
    }
    this.logger.info('All debug sessions closed');
  }

  // ----- the session tree (issue #1081) -----

  /** The launch or attach root of a session's tree. */
  protected rootOf(session: ManagedSession): ManagedSession {
    let current = session;
    const seen = new Set<string>([current.id]);
    while (current.parentSessionId) {
      const parent = this.sessionStore.get(current.parentSessionId);
      if (!parent || seen.has(parent.id)) {
        break;
      }
      seen.add(parent.id);
      current = parent;
    }
    return current;
  }

  /** Block new adoptions until this teardown and any overlapping teardown finish. */
  protected beginSubtreeClose(sessionId: string): () => void {
    this.closingSubtrees.set(sessionId, (this.closingSubtrees.get(sessionId) ?? 0) + 1);
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      const remaining = (this.closingSubtrees.get(sessionId) ?? 1) - 1;
      if (remaining > 0) {
        this.closingSubtrees.set(sessionId, remaining);
      } else {
        this.closingSubtrees.delete(sessionId);
      }
    };
  }

  private isSubtreeClosing(session: ManagedSession): boolean {
    let current: ManagedSession | undefined = session;
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      if (this.closingSubtrees.has(current.id)) return true;
      seen.add(current.id);
      current = current.parentSessionId ? this.sessionStore.get(current.parentSessionId) : undefined;
    }
    return false;
  }

  /** A session's direct children, in adoption (store insertion) order. */
  protected childrenOf(sessionId: string): ManagedSession[] {
    // Defensive: test doubles of the store may be partial.
    const all = typeof this.sessionStore.getAllManaged === 'function' ? this.sessionStore.getAllManaged() : [];
    return all.filter((s) => s.parentSessionId === sessionId);
  }

  /**
   * Every descendant of a session, depth first in adoption order (pre-order: a
   * child, its own descendants, then the next child) — the order the
   * tree-aware wait selects in and the `children` answers list in.
   */
  protected descendantsDepthFirst(sessionId: string): ManagedSession[] {
    const result: ManagedSession[] = [];
    for (const child of this.childrenOf(sessionId)) {
      result.push(child);
      result.push(...this.descendantsDepthFirst(child.id));
    }
    return result;
  }

  /** Every descendant of a session, deepest first (post-order), adoption order within a level. */
  protected descendantsDeepestFirst(sessionId: string): ManagedSession[] {
    const result: ManagedSession[] = [];
    for (const child of this.childrenOf(sessionId)) {
      result.push(...this.descendantsDeepestFirst(child.id));
      result.push(child);
    }
    return result;
  }

  /**
   * The reap a terminal handler asks for (issues #122, #502), scoped to the
   * session tree (issue #1081): a child's proxy view stops only its own
   * connection; a root that ended while child sessions are live keeps its
   * worker for them and the stop is deferred until the last child ends or
   * is closed. A child that ends also settles its root's deferred reap.
   */
  private stopOrDeferWorker(session: ManagedSession, proxyManager: IProxyManager, after: string): void {
    if (!session.parentSessionId) {
      const liveChildren = this.descendantsDeepestFirst(session.id).filter((s) => !isTerminalSessionState(s.state));
      if (liveChildren.length > 0) {
        this.logger.info(
          `[SessionManager] Session ${session.id} ended after '${after}' with ${liveChildren.length} live child session(s); its worker is reaped when the last ends`
        );
        session.deferredWorkerStop = proxyManager;
        return;
      }
    }
    session.pendingProxyStop = proxyManager.stop().catch((err) => {
      this.logger.warn(
        `[SessionManager] Error stopping proxy after '${after}' for session ${session.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    });
    if (session.parentSessionId) {
      this.reapDeferredWorkerIfIdle(session);
    }
  }

  /** Run a root's deferred worker stop once none of its descendants is live. */
  protected reapDeferredWorkerIfIdle(session: ManagedSession): void {
    const root = this.rootOf(session);
    const deferred = root.deferredWorkerStop;
    if (!deferred) {
      return;
    }
    if (this.descendantsDeepestFirst(root.id).some((s) => !isTerminalSessionState(s.state))) {
      return;
    }
    root.deferredWorkerStop = undefined;
    this.logger.info(`[SessionManager] Last child session of ${root.id} ended; reaping its worker`);
    root.pendingProxyStop = deferred.stop().catch((err) => {
      this.logger.warn(
        `[SessionManager] Error stopping the deferred worker of session ${root.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    });
  }

  /** How many of a tree's children are still live: the cap counts the whole tree. */
  private liveDescendantCount(rootId: string): number {
    return this.descendantsDeepestFirst(rootId).filter((s) => !isTerminalSessionState(s.state)).length;
  }

  /**
   * A child the worker reported on `parent`'s connection. Under the per-tree
   * cap it becomes a session of its own: the parent's language and
   * breakpoints, a proxy view over the same worker, wired like a root. The
   * child is `running` from the moment the adoption is sent — its first stop
   * can land before the adoption's answer and must not be clobbered. Beyond
   * the cap, or when the adoption fails, the child is released to run
   * undebugged and no row remains.
   */
  protected async adoptReportedChild(
    parent: ManagedSession,
    parentProxy: IProxyManager,
    reported: ChildReportedEvent
  ): Promise<void> {
    const release = (reason: string, options: { counted: boolean } = { counted: true }): void => {
      if (options.counted) {
        // The run's count of children that run undebugged (issue #1081): the
        // parent's next answers carry it as `childrenReleased`.
        parent.releasedChildReports = (parent.releasedChildReports ?? 0) + 1;
      }
      parentProxy
        .sendDapRequest(CHILD_RELEASE_COMMAND, { reportId: reported.reportId, reason }, { timeoutMs: 5000 })
        .catch((err) => {
          this.logger.warn(
            `[SessionManager] Releasing reported child ${reported.name} of session ${parent.id} failed: ${err instanceof Error ? err.message : String(err)}`
          );
        });
    };

    if (this.sessionStore.get(parent.id) !== parent || parent.proxyManager !== parentProxy || this.isSubtreeClosing(parent)) {
      release('the parent session is closing or its connection has ended', { counted: false });
      return;
    }

    const cap = maxChildSessions(this.environment);
    const root = this.rootOf(parent);
    const live = this.liveDescendantCount(root.id);
    if (live >= cap) {
      const reason = cap === 0
        ? `child-session adoption is off (${MAX_CHILD_SESSIONS_ENV}=0)`
        : `the tree of session ${root.id} is at its child-session cap (${cap})`;
      this.logger.info(`[SessionManager] Releasing reported child ${reported.name} of session ${parent.id}: ${reason}`);
      release(reason);
      return;
    }
    if (!parentProxy.createChildView) {
      release('this session cannot host child sessions');
      return;
    }

    let child: ManagedSession | undefined;
    try {
      const info = this.sessionStore.createSession({
        language: parent.language,
        name: reported.name,
        executablePath: parent.executablePath,
        parentSessionId: parent.id
      });
      child = this.sessionStore.getOrThrow(info.id);
      child.logDir = parent.logDir;
      child.effectiveBreakOnExceptions = parent.effectiveBreakOnExceptions;
      child.launchExceptionFilters = parent.launchExceptionFilters;
      // The parent's current breakpoint set, re-sent to the child before it
      // runs (the hold before configurationDone is where they bind); from then
      // on each session's set is its own.
      for (const bp of parent.breakpoints.values()) {
        const copy = { ...bp };
        resetBinding(copy);
        child.breakpoints.set(copy.id, copy);
      }
      for (const bp of parent.functionBreakpoints?.values() ?? []) {
        const copy = { ...bp };
        resetBinding(copy);
        child.functionBreakpoints.set(copy.id, copy);
      }

      const view = parentProxy.createChildView(child.id);
      child.proxyManager = view;
      this.setupProxyEventHandlers(child, view, { stopOnEntry: false });
      this._updateSessionState(child, SessionState.RUNNING);
      this.logger.info(
        `[SessionManager] Adopting child ${reported.name} (${reported.targetId}) of session ${parent.id} as session ${child.id}`
      );

      await view.adopt(
        {
          reportId: reported.reportId,
          breakpoints: Array.from(child.breakpoints.values()).map((bp) => ({
            id: bp.id,
            file: bp.file,
            line: bp.line,
            condition: bp.condition,
            logMessage: bp.logMessage,
            suspendPolicy: bp.suspendPolicy
          })),
          functionBreakpoints: Array.from(child.functionBreakpoints.values()).map((bp) => ({
            name: bp.functionName,
            condition: bp.condition
          }))
        },
        { timeoutMs: 30000 }
      );
      if (this.sessionStore.get(child.id) !== child) return;
      this.logger.info(`[SessionManager] Child session ${child.id} adopted (parent ${parent.id})`);
      this.emit('child-session-adopted', child.id, parent.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[SessionManager] Adopting child ${reported.name} of session ${parent.id} failed: ${message}`
      );
      release(`adoption failed: ${message}`, { counted: !this.isSubtreeClosing(parent) });
      if (child && this.sessionStore.get(child.id) === child && !this.isSubtreeClosing(child)) {
        // Use the normal subtree teardown: a grandchild may already have
        // been reported, and removing the last child must reap a root whose
        // worker stop was deferred while this adoption was pending.
        await this.closeSession(child.id);
      }
    }
  }

  /**
   * Persist the public failure pointers synchronously, then write the bounded
   * structured log record in the background. EventEmitter does not await
   * listeners, so the session projection must be complete before the handler
   * returns. A generation guard prevents a slow log read from reviving an old
   * launch's diagnostics after restart_debugging installs a new proxy.
   */
  private recordProxyFailure(session: ManagedSession, error: unknown): void {
    const generation = session.proxyGeneration;
    session.failureDiagnostics = collectProxyFailureDiagnostics(session, error);

    void logProxyFailure(
      { logger: this.logger, fileSystem: this.fileSystem },
      session,
      error,
      'proxyExit'
    ).then((diagnostics) => {
      if (session.proxyGeneration === generation && session.state === SessionState.ERROR) {
        session.failureDiagnostics = diagnostics;
      }
    }).catch((diagnosticsError: unknown) => {
      // logProxyFailure is total by contract; retain the synchronously
      // collected pointers even if a future implementation regresses that.
      this.logger.warn(
        `[SessionManager] Failed to finish proxy-exit diagnostics for session ${session.id}: ${diagnosticsError instanceof Error ? diagnosticsError.message : String(diagnosticsError)}`
      );
    });
  }

  protected setupProxyEventHandlers(
    session: ManagedSession,
    proxyManager: IProxyManager,
    effectiveLaunchArgs: Partial<CustomLaunchRequestArguments>
  ): void {
    const sessionId = session.id;
    beginProxyGeneration(session);
    const handlers = new Map<string, (...args: any[]) => void>(); // eslint-disable-line @typescript-eslint/no-explicit-any -- Event handlers require flexible argument signatures to support various event types

    // Reset first-stop tracking for this launch — a session may be re-launched.
    session.firstStopHandled = false;
    session.lastStop = undefined;
    // A new run's first stop shows full locals, never a diff against the old
    // run (issue #983). The transient entry-stop erase below is NOT a launch
    // boundary: the cache deliberately survives ordinary resumes.
    session.snapshotDiffBase = undefined;
    session.exitCode = undefined;
    session.adapterCapabilities = undefined;
    session.liveUpdateState = undefined;
    session.programEndExplanation = undefined;
    session.releasedChildReports = undefined;
    session.failureDiagnostics = undefined;
    // Adapter degradation notes are per-launch (issue #441).
    session.adapterNotices = [];
    // Mandatory (issue #217): the relaunch's new proxyManager reports
    // isRunning()=true, which would resurrect a stale mirror record.
    session.exposure = undefined;
    // Each launch/attach starts with a fresh output buffer (issue #218).
    // Closure-captured (issue #358): this launch's handlers write to THIS
    // buffer instance, so an in-flight event from a previous run (still in a
    // microtask/IPC queue when restart_debugging swapped buffers) can never
    // land in the new launch's buffer and take an early seq.
    const outputBuffer = session.outputBuffer = new OutputRingBuffer();
    // One note once: on the session for the launch-result warning, and as an
    // attributed entry in this launch's buffer (issues #441, #746).
    const recordAdapterNotice = (rawNote: string): void => {
      // A worker-forwarded note carries the adapter's own words, which may
      // echo launch arguments: the same write-time redaction as every other
      // buffer entry (issue #237).
      const { text: note, redacted } = this.redactForBuffer(rawNote);
      if (session.adapterNotices?.includes(note)) {
        return;
      }
      (session.adapterNotices ??= []).push(note);
      const noteEntry = outputBuffer.push(
        'console',
        `[mcp-debugger] Warning: ${note}\n`,
        undefined,
        redacted ? { redacted: true } : undefined
      );
      if (noteEntry) {
        this.emit('output-captured', sessionId, noteEntry);
      }
    };
    // A new adapter instance has verified nothing yet: clear per-launch
    // breakpoint state so a relaunch reports honest verification (#238).
    for (const bp of session.breakpoints.values()) {
      resetBinding(bp);
    }
    for (const bp of session.functionBreakpoints?.values() ?? []) {
      resetBinding(bp);
    }

    // Adapters whose first stopped event after launch may not carry
    // reason='entry' opt into a relaxed first-stop auto-continue rule:
    // js-debug reports a stopOnEntry:true entry stop as 'pause' or
    // 'breakpoint', and a launch with function breakpoints armed (issue
    // #295) forces that entry stop even when the caller asked for
    // stopOnEntry:false. Identified by the policy flag
    // `pauseAfterChildAttach`, which today is true only for js-debug. Other
    // adapters keep the strict reason==='entry' check, and a stop that
    // answers the user's own pause_execution is exempt everywhere (see
    // answersUserPause below).
    let firstStopMayBeNonEntry = false;
    try {
      const policy = this.sessionStore.selectPolicy(session.language);
      firstStopMayBeNonEntry =
        policy.getDapClientBehavior?.().pauseAfterChildAttach === true;
    } catch (err) {
      this.logger.debug(`[SessionManager ${sessionId}] Could not determine adapter policy for first-stop heuristic: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Named function for stopped event
    const handleStopped = (threadId: number | undefined, rawReason: string, body?: DebugProtocol.StoppedEvent['body']) => {
      // A stop that names breakpoint ids proves those breakpoints are bound,
      // whatever the adapter reported (or never reported) about them (issue
      // #673: js-debug launch verifies a source-mapped request under its
      // generated path and sends no event at all for a node_modules one).
      // Applied first so the id sets below see the freshest truth.
      if (Array.isArray(body?.hitBreakpointIds) && body.hitBreakpointIds.length > 0) {
        for (const hit of applyHitBreakpointIds(session, body.hitBreakpointIds)) {
          this.logger.info('debug:breakpoint', {
            event: 'verified',
            via: 'hit',
            sessionId,
            sessionName: session.name,
            breakpointId: hit.breakpoint.id,
            adapterId: hit.adapterId,
            ...(hit.kind === 'line'
              ? { file: (hit.breakpoint as Breakpoint).file, line: (hit.breakpoint as Breakpoint).line }
              : { functionName: (hit.breakpoint as FunctionBreakpoint).functionName }),
            verified: true,
            timestamp: Date.now(),
          });
        }
      }
      // Give the adapter policy a chance to normalize misleading raw reasons
      // (e.g. CodeLLDB reports a SIGSTOP-delivered pause as 'exception')
      // before the reason drives auto-continue, lastStop, and exceptionInfo.
      let reason = rawReason;
      let pauseIntent: ReturnType<typeof getCurrentPauseIntent>;
      // Mode facts, shared by the stop-reason normalization below and the
      // auto-continue decision after it. Attach sessions have no launch entry
      // stop to skip: any stop observed after attach is either the deliberate
      // post-attach pause issued by attachToProcess (pauseAfterAttach policies)
      // or a real debug event, and auto-continuing those resumed the target
      // right after we paused it (issue #124), so auto-continue is launch-only.
      const isFirstStop = !session.firstStopHandled;
      const launchArgsRecord = effectiveLaunchArgs as Record<string, unknown>;
      const isAttachSession =
        launchArgsRecord.request === 'attach' ||
        launchArgsRecord.__attachMode === true;
      // Whether the session asked for an initial stop. The two modes default
      // differently: a launch stops on entry only when asked (`=== true`), an
      // attach stops unless told not to (`!== false`) — the reading the attach
      // controller and the adapters (CodeLLDB's `stopOnEntry ?? true`) apply.
      // A default attach reaches here as `stopOnEntry: undefined`: the launch
      // default (false) is spread first and the caller's undefined key over it
      // (issue #817).
      const stopOnEntry = isAttachSession
        ? effectiveLaunchArgs.stopOnEntry !== false
        : effectiveLaunchArgs.stopOnEntry === true;
      try {
        const policy = this.sessionStore.selectPolicy(session.language);
        // Collect the adapter-assigned ids of all user breakpoints so the
        // policy can distinguish internal adapter breakpoints (e.g.
        // CodeLLDB's rust_panic filter, issue #260) from user ones, and
        // label function-breakpoint hits (issue #302). Each kind's set is
        // only usable when its bookkeeping is complete — a breakpoint with
        // an unknown id makes the disjointness inference unsafe.
        const lineIds = new Set<number>();
        let lineComplete = true;
        for (const bp of session.breakpoints.values()) {
          if (typeof bp.adapterId === 'number') {
            lineIds.add(bp.adapterId);
          } else {
            lineComplete = false;
            break;
          }
        }
        const fnIds = new Set<number>();
        let fnComplete = true;
        for (const bp of session.functionBreakpoints.values()) {
          if (typeof bp.adapterId === 'number') {
            fnIds.add(bp.adapterId);
          } else {
            fnComplete = false;
            break;
          }
        }
        const userBreakpointIds: ReadonlySet<number> | undefined =
          lineComplete && fnComplete ? new Set([...lineIds, ...fnIds]) : undefined;
        pauseIntent = getCurrentPauseIntent(session);
        // Mode facts for policies whose adapter reports a launch's entry stop
        // under a generic reason (rdbg's `pause`, issue #798) or an attach's
        // own initial stop as an exception (CodeLLDB's Windows break-in, issue
        // #817): a launch or an attach, the first stop or a later one, and
        // whether the session asked for an initial stop at all.
        const normalized = policy.normalizeStopReason?.(rawReason, body, {
          pausePending: pauseIntent !== undefined,
          ...(pauseIntent ? { pauseSource: pauseIntent.source } : {}),
          sessionMode: isAttachSession ? 'attach' : 'launch',
          firstStop: isFirstStop,
          stopOnEntry,
          userBreakpointIds,
          functionBreakpointIds: fnComplete ? fnIds : undefined,
          lineBreakpointCount: session.breakpoints.size,
          functionBreakpointCount: session.functionBreakpoints.size
        });
        if (normalized && normalized !== rawReason) {
          this.logger.info(
            `[SessionManager ${sessionId}] Stop reason normalized: '${rawReason}' -> '${normalized}'`
          );
          reason = normalized;
        }
      } catch (err) {
        this.logger.debug(
          `[SessionManager ${sessionId}] Stop-reason normalization failed; keeping raw reason '${rawReason}': ${err instanceof Error ? err.message : String(err)}`
        );
      }
      clearPauseIntent(session);
      this.logger.debug(`[SessionManager] handleStopped: session=${sessionId} currentState=${session.state} reason=${reason} threadId=${threadId}`);
      this.logger.info(`[ProxyManager ${sessionId}] Stopped event: thread=${threadId}, reason=${reason}`);

      // Log debug state change with structured logging
      // Note: We don't have location info at this point, but that could be added later if needed
      this.logger.info('debug:state', {
        event: 'paused',
        sessionId: sessionId,
        sessionName: session.name,
        reason: reason,
        threadId: threadId,
        timestamp: Date.now()
      });

      // Reasons that always reflect explicit user-visible debug events.
      // Even on the very first stop, these must NOT be auto-continued —
      // the user set the breakpoint or hit the exception deliberately.
      const userBreakReasons = USER_BREAK_REASONS;
      // Attach sessions have no launch entry stop to skip: any stop observed
      // after attach is either the deliberate post-attach pause issued by
      // attachToProcess (pauseAfterAttach policies) or a real debug event.
      // Auto-continuing those resumed the target right after we paused it
      // (issue #124), so auto-continue is launch-only.
      // A stop that answers a pause the user asked for is never the launch's
      // entry stop, whatever its reason or position (issue #704): with no
      // forced entry pause on a stopOnEntry:false js launch, the user's own
      // pause_execution can be the first stop, and the relaxed rule below
      // would resume it within a millisecond.
      const answersUserPause = pauseIntent?.source === 'user';
      const shouldAutoContinue =
        !isAttachSession &&
        !stopOnEntry &&
        !answersUserPause &&
        (reason === 'entry' ||
          (firstStopMayBeNonEntry && isFirstStop && !userBreakReasons.has(reason)));

      // Handle auto-continue for stopOnEntry=false
      if (shouldAutoContinue) {
        this.logger.info(`[ProxyManager ${sessionId}] Auto-continuing (stopOnEntry=false) [reason=${reason}, firstStop=${isFirstStop}]`);
        // continue() requires PAUSED. Record the transient stop first so the
        // state invariant remains true even while auto-continue is in flight.
        const autoContinuedStop = {
          reason,
          ...(reason !== rawReason ? { rawReason } : {}),
          threadId,
          timestamp: Date.now(),
          ...(body?.description ? { description: body.description } : {}),
          ...(body?.text ? { text: body.text } : {})
        };
        session.lastStop = autoContinuedStop;
        this._updateSessionState(session, SessionState.PAUSED);
        // Erase the transient stop however the continue settles. The identity
        // check is what keeps it safe: a newer user-visible stop that raced
        // the continue replaced the record and must survive, and a continue
        // that failed with the session still PAUSED is genuinely at this stop.
        // Terminal states count as "no longer at it" alongside RUNNING: the
        // debuggee's 'terminated' can beat the continue (resolving it late, or
        // rejecting it outright), and skipping the erase then listed a
        // finished program as stopped with an 'entry' stop (issue #720).
        const clearTransientEntryStop = () => {
          const movedOn =
            session.state === SessionState.RUNNING || isTerminalSessionState(session.state);
          if (movedOn && session.lastStop === autoContinuedStop) {
            session.lastStop = undefined;
          }
        };
        this.handleAutoContinue(sessionId)
          .then(clearTransientEntryStop)
          .catch(err => {
            clearTransientEntryStop();
            this.logger.error(`[ProxyManager ${sessionId}] Error auto-continuing:`, err);
          });
      } else {
        // An adapter may decorate the exception name it reports — pydevd's
        // "AssertionError       (note: full exception trace is shown but
        // execution is paused at: <fn>)" at a user-unhandled stop (issue
        // #985) — in the stopped event's text and in exceptionInfo's
        // exceptionId / typeName alike. The policy says what the class is,
        // and the record is normalized here, at the write, so every reader
        // (wait_for_stop, list_debug_sessions, get_stack_trace, the snapshot)
        // names the exception the same way (issue #1047). Nothing the adapter
        // said is lost: the note's content, which frame is paused, is the
        // answer's location. Exception stops only; a policy that has no hook,
        // or a language with no policy, keeps the adapter's words.
        let normalizeExceptionTypeName: ((name: string) => string) | undefined;
        if (reason === 'exception') {
          try {
            const policy = this.sessionStore.selectPolicy(session.language);
            normalizeExceptionTypeName = policy.normalizeExceptionTypeName?.bind(policy);
          } catch {
            // no policy for this language: keep the adapter's words
          }
        }
        const exceptionName = (value: string): string =>
          normalizeExceptionTypeName ? normalizeExceptionTypeName(value) : value;

        // Record why we stopped so it stays queryable after the fact
        // (list_debug_sessions / get_stack_trace, issue #214). Auto-continued
        // entry stops are deliberately not recorded — the user never saw them.
        // description/text carry e.g. the exception class/message (issue #220).
        session.lastStop = {
          reason,
          ...(reason !== rawReason ? { rawReason } : {}),
          threadId,
          timestamp: Date.now(),
          ...(body?.description ? { description: exceptionName(body.description) } : {}),
          ...(body?.text ? { text: exceptionName(body.text) } : {})
        };
        this._updateSessionState(session, SessionState.PAUSED);

        // Best-effort exceptionInfo enrichment (issue #243): fire-and-forget
        // after the synchronous PAUSED transition (step/continue barriers rely
        // on it). Gated on the live adapter capability; failures are swallowed
        // — the .catch also absorbs the rejection when the proxy exits with
        // the request in flight. Also gated on the ADAPTER's raw reason being
        // 'exception': for a policy-normalized stop (e.g. a Rust panic
        // delivered as CodeLLDB's internal breakpoint, issue #260) the
        // adapter would answer about the breakpoint, not the panic —
        // confirmed live: {exceptionId: 'Breakpoint', description:
        // 'breakpoint 1.1'} — which is misleading, not enriching.
        if (
          reason === 'exception' &&
          rawReason === 'exception' &&
          typeof threadId === 'number' &&
          session.adapterCapabilities?.supportsExceptionInfoRequest
        ) {
          const stopRef = session.lastStop;
          proxyManager
            .sendDapRequest<DebugProtocol.ExceptionInfoResponse>(
              'exceptionInfo',
              { threadId },
              { timeoutMs: 3000 }
            )
            .then((resp) => {
              const info = resp?.body;
              // Stale-guard: only merge while this stop is still current.
              if (!info || session.lastStop !== stopRef || session.state !== SessionState.PAUSED) {
                return;
              }
              const details = info.details;
              // The same lens as the stop record above (issue #1047): the
              // type-name fields lose the adapter's decoration; message,
              // description and stackTrace are kept as reported.
              stopRef.exceptionInfo = {
                exceptionId: exceptionName(info.exceptionId),
                breakMode: info.breakMode,
                ...(info.description ? { description: info.description } : {}),
                ...(details
                  ? {
                      details: {
                        ...(details.message ? { message: details.message } : {}),
                        ...(details.typeName ? { typeName: exceptionName(details.typeName) } : {}),
                        ...(details.fullTypeName ? { fullTypeName: exceptionName(details.fullTypeName) } : {}),
                        ...(details.stackTrace ? { stackTrace: details.stackTrace } : {})
                      }
                    }
                  : {})
              };
              this.logger.debug(
                `[SessionManager ${sessionId}] exceptionInfo enrichment merged (exceptionId=${info.exceptionId})`
              );
            })
            .catch((err) => {
              this.logger.debug(
                `[SessionManager ${sessionId}] Best-effort exceptionInfo failed: ${err instanceof Error ? err.message : String(err)}`
              );
            });
        }
      }

      session.firstStopHandled = true;
      // A stop only a live debugger produces is stronger evidence than the
      // policy's noDebug pin: this adapter build debugs after all, so the
      // later surfaces must stop explaining themselves in debugger-off
      // terms (issue #749). Judged on what the adapter itself reported, not
      // the policy's relabel: js-debug lands a pause, a step and a
      // `debugger;` statement (relabelled 'breakpoint') under noDebug with
      // its breakpoints still off.
      if (stopProvesDebuggerOn(reason, rawReason, body)) {
        session.launchDebuggerOff = undefined;
      }
    };
    proxyManager.on('stopped', handleStopped);
    handlers.set('stopped', handleStopped);

    // Named function for continued event
    const handleContinued = () => {
      this.logger.debug(`[SessionManager] 'continued' event handler called for session ${sessionId}`);
      this.logger.info(`[ProxyManager ${sessionId}] Continued event`);
      
      // Log debug state change with structured logging
      this.logger.info('debug:state', {
        event: 'running',
        sessionId: sessionId,
        sessionName: session.name,
        timestamp: Date.now()
      });

      // Guard against stale continued events arriving after a breakpoint stop.
      // If the session is already paused, keep it paused so inspections still work.
      if (session.state === SessionState.PAUSED) {
        this.logger.debug(
          `[SessionManager] Ignoring continued event for session ${sessionId} because state is already PAUSED`
        );
        return;
      }

      this._updateSessionState(session, SessionState.RUNNING);
    };
    proxyManager.on('continued', handleContinued);
    handlers.set('continued', handleContinued);

    // Deferred breakpoint verification/relocation pushed by the adapter after
    // the setBreakpoints response (e.g. debugpy verifying once the module
    // loads). Match by adapter-assigned id first; fall back to (file, line)
    // via samePath, which tolerates the case and separator differences
    // between Windows-style paths (#236, #673).
    const handleBreakpoint = (body: DebugProtocol.BreakpointEvent['body']) => {
      // Strip the child-origin marker before anything else so it never leaks
      // past this handler (issues #500/#495).
      const fromChild = consumeChildOrigin(body);
      const eventBp = body?.breakpoint;
      if (!eventBp) {
        return;
      }
      const mirrorsToChild = mirrorsBreakpointsToChild(() => this.sessionStore.selectPolicy(session.language));
      // Function breakpoints (issue #271 phase 3) match by adapterId ONLY —
      // DAP breakpoint events carry no function name, and letting them join
      // the (file,line) fallback below would let a function breakpoint bound
      // at some location steal a line breakpoint's event (or vice versa).
      if (typeof eventBp.id === 'number' && session.functionBreakpoints) {
        const fnTarget = Array.from(session.functionBreakpoints.values())
          .find(bp => bp.adapterId === eventBp.id);
        if (fnTarget) {
          // The same rules as the line branch below (issue #754): a stop that
          // proved the record bound outranks an unbound event (#673),
          // provenance is stamped, an unverified record claims no binding
          // location, and the adapter's words displace a stamped refusal.
          if (keepHitProven(fnTarget, eventBp)) {
            this.logger.debug(
              `[SessionManager ${sessionId}] Keeping hit-proven function breakpoint '${fnTarget.functionName}' verified despite an unverified event (id=${eventBp.id})`
            );
            return;
          }
          fnTarget.verified = eventBp.verified;
          fnTarget.verifiedBy = fnTarget.verified ? 'adapter' : undefined;
          if (fnTarget.verified) {
            if (typeof eventBp.line === 'number') {
              fnTarget.boundLine = eventBp.line;
            }
            if (eventBp.source?.path) {
              fnTarget.boundFile = eventBp.source.path;
            }
          } else {
            fnTarget.boundFile = undefined;
            fnTarget.boundLine = undefined;
          }
          setAdapterMessage(fnTarget, eventBp.message, fnTarget.verified);
          this.logger.info('debug:breakpoint', {
            event: 'changed',
            sessionId,
            sessionName: session.name,
            breakpointId: fnTarget.id,
            functionName: fnTarget.functionName,
            line: fnTarget.boundLine,
            verified: fnTarget.verified,
            timestamp: Date.now(),
          });
          return;
        }
      }

      const all = Array.from(session.breakpoints.values());
      let target = typeof eventBp.id === 'number'
        ? all.find(bp => bp.adapterId === eventBp.id)
        : undefined;
      const matchedByAdapterId = target !== undefined;
      if (!target && eventBp.source?.path !== undefined && typeof eventBp.line === 'number') {
        const eventPath = eventBp.source.path;
        const atLocation = all.filter(bp => samePath(bp.file, eventPath) && bp.line === eventBp.line);
        // Twins at one location (a plain and a conditional breakpoint): a
        // child-origin stub carrying an id claims the first twin that has no
        // id yet, so the replay's stubs map positionally instead of all
        // landing on the first record (issue #673).
        target =
          (fromChild && typeof eventBp.id === 'number'
            ? atLocation.find(bp => bp.adapterId === undefined)
            : undefined) ?? atLocation[0];
      }
      if (!target) {
        const stored = all
          .map(bp => `${bp.file}:${bp.line}(adapterId=${bp.adapterId ?? 'none'})`)
          .join(', ');
        this.logger.debug(
          `[SessionManager ${sessionId}] Breakpoint event matched no stored breakpoint (event: id=${eventBp.id}, verified=${eventBp.verified}, ${eventBp.source?.path}:${eventBp.line}, message=${eventBp.message ?? 'none'}); stored: [${stored}]`
        );
        return;
      }
      // Child-mirroring adapters (js-debug): the parent session emits its own
      // breakpoint events with pessimistic verified:false and parent-space ids
      // that share the child's integer id space (issue #495) — so a parent
      // stub can even match a stored child id. A non-child downgrade of a
      // verified record is the parent contradicting the authoritative child;
      // ignore it whether it matched by id or by (file,line). Child-origin
      // downgrades (real unbinding) still apply.
      if (mirrorsToChild && !fromChild && matchedByAdapterId) {
        // A parent-space id never addresses a record: the ids stored here
        // are the child's, and the two spaces collide (issue #495).
        this.logger.debug(
          `[SessionManager ${sessionId}] Ignoring parent breakpoint event that matched ${target.file}:${target.line} only by a colliding id`
        );
        return;
      }
      if (mirrorsToChild && !fromChild && target.verified === true && eventBp.verified === false) {
        this.logger.debug(
          `[SessionManager ${sessionId}] Ignoring non-authoritative breakpoint downgrade for ${target.file}:${target.line}`
        );
        return;
      }
      if (keepHitProven(target, eventBp, { acceptId: !mirrorsToChild || fromChild })) {
        // A stop already proved this breakpoint bound (issue #673). js-debug
        // answers "unbound" on every replace-all for a location it cannot
        // map to a source; the CDP breakpoint underneath keeps firing. The
        // id was kept current (when it is the child's) and nothing else.
        this.logger.debug(
          `[SessionManager ${sessionId}] Keeping hit-proven breakpoint ${target.file}:${target.line} verified despite an unverified echo (id=${eventBp.id})`
        );
        return;
      }
      target.verified = eventBp.verified;
      target.verifiedBy = target.verified ? 'adapter' : undefined;
      // Where it bound: the request stays the request; a different file is
      // reported as boundFile/boundLine, a same-file move lands in `line`.
      applyBoundLocation(target, eventBp.source?.path, eventBp.line);
      if (!target.verified) {
        target.boundFile = undefined;
        target.boundLine = undefined;
      }
      // A provisional "unbound" note or a stamped refusal must not survive
      // verification, and a leaked l10n key must not reach the user (issues
      // #471, #754). When the event carries no message, settle the stored
      // one: js-debug's bind event omits `message`, so a note stamped earlier
      // would otherwise outlive the verification it contradicts.
      setAdapterMessage(target, eventBp.message, target.verified);
      // The id: any non-mirroring adapter's, or the child's — provisional or
      // not. js-debug keeps an entry's id across re-sends, and the #495
      // hazard was the PARENT's colliding id space, which the child-origin
      // marker excludes above. Stamping it from the child's first stub is
      // what lets a later verification under a generated path, or a stop
      // that names the id, reach this record (issue #673).
      if (typeof eventBp.id === 'number' && (!mirrorsToChild || fromChild)) {
        target.adapterId = eventBp.id;
      }
      this.logger.info('debug:breakpoint', {
        event: 'changed',
        sessionId,
        sessionName: session.name,
        breakpointId: target.id,
        file: target.file,
        line: target.line,
        ...(target.boundFile !== undefined ? { boundFile: target.boundFile, boundLine: target.boundLine } : {}),
        verified: target.verified,
        timestamp: Date.now(),
      });
    };
    proxyManager.on('breakpoint', handleBreakpoint);
    handlers.set('breakpoint', handleBreakpoint);

    // Named function for terminated event
    const handleTerminated = () => {
      clearPauseIntent(session);
      this.logger.debug(`[SessionManager] handleTerminated: session=${sessionId} currentState=${session.state}`);
      this.logger.info(`[ProxyManager ${sessionId}] Terminated event`);

      // Log debug state change with structured logging
      this.logger.info('debug:state', {
        event: 'stopped',
        sessionId: sessionId,
        sessionName: session.name,
        timestamp: Date.now()
      });

      this.noteUnboundFunctionBreakpoints(session, outputBuffer);
      this.recordProgramEndExplanation(session, outputBuffer);
      this._updateSessionState(session, SessionState.STOPPED);

      // Clean up listeners since proxy is gone
      this.cleanupProxyEventHandlers(session, proxyManager);
      session.lastProxyPid = proxyManager.getProxyPid?.() ?? session.lastProxyPid;
      session.proxyManager = undefined;

      // Reap the proxy process instead of just dropping the reference. The
      // worker normally self-exits after 'terminated', but if its shutdown
      // stalls (e.g. a hung adapter process) nothing else reaps it — on
      // Windows especially, orphans accumulate (issue #122). stop() is
      // idempotent against an already-exiting worker and force-kills after 5s.
      // The promise is retained so closeSession can await it (issue #502).
      this.stopOrDeferWorker(session, proxyManager, 'terminated');
    };
    proxyManager.on('terminated', handleTerminated);
    handlers.set('terminated', handleTerminated);

    // Named function for exited event
    const handleExited = (exitCode?: number) => {
      clearPauseIntent(session);
      this.logger.debug(`[SessionManager] handleExited: session=${sessionId} currentState=${session.state} exitCode=${exitCode}`);
      this.logger.info(`[ProxyManager ${sessionId}] Exited event (exitCode=${exitCode})`);
      // Record the debuggee exit code so a crash (non-zero) is
      // distinguishable from a clean exit after the fact (issue #220)
      if (typeof exitCode === 'number') {
        session.exitCode = exitCode;
      }
      this.noteUnboundFunctionBreakpoints(session, outputBuffer);
      this.recordProgramEndExplanation(session, outputBuffer);
      this._updateSessionState(session, SessionState.STOPPED);

      // Clean up listeners since proxy is gone
      this.cleanupProxyEventHandlers(session, proxyManager);
      session.lastProxyPid = proxyManager.getProxyPid?.() ?? session.lastProxyPid;
      session.proxyManager = undefined;

      // Reap the proxy process (see handleTerminated for rationale, issue
      // #122); promise retained for closeSession (issue #502).
      this.stopOrDeferWorker(session, proxyManager, 'exited');
    };
    proxyManager.on('exited', handleExited);
    handlers.set('exited', handleExited);

    // Named function for adapter configured event
    const handleAdapterConfigured = () => {
      this.logger.debug(`[SessionManager] 'adapter-configured' event handler called for session ${sessionId}`);
      this.logger.info(`[ProxyManager ${sessionId}] Adapter configured`);
      // Readiness is not a resume signal. Some adapters (notably rdbg) emit a
      // real stopped event synchronously with configurationDone, before this
      // status. Preserve that observed pause; only project RUNNING when no
      // stop has already established the stronger state.
      if (!effectiveLaunchArgs.stopOnEntry && session.state !== SessionState.PAUSED) {
        this._updateSessionState(session, SessionState.RUNNING);
      }
    };
    proxyManager.on('adapter-configured', handleAdapterConfigured);
    handlers.set('adapter-configured', handleAdapterConfigured);

    // Named function for adapter capabilities (issue #243): store the live
    // initialize response body and warn when the static policy exception
    // filter table drifted from what the adapter actually advertises.
    const handleAdapterCapabilities = (capabilities: DebugProtocol.Capabilities) => {
      session.adapterCapabilities = capabilities;
      this.logger.debug(
        `[SessionManager ${sessionId}] Adapter capabilities captured (supportsExceptionInfoRequest=${capabilities.supportsExceptionInfoRequest === true})`
      );
      try {
        const table = this.sessionStore
          .selectPolicy(session.language)
          .getInitializationBehavior?.().exceptionFilters;
        // Empty per-mode arrays mean "mode unsupported", not drift — the
        // union naturally drops them (e.g. Ruby's uncaught: []).
        const declared = [...new Set([...(table?.uncaught ?? []), ...(table?.all ?? [])])];
        if (declared.length > 0) {
          const advertisedFilters = capabilities.exceptionBreakpointFilters;
          if (!advertisedFilters || advertisedFilters.length === 0) {
            this.logger.warn(
              `[SessionManager ${sessionId}] Adapter advertises no exceptionBreakpointFilters, but the '${session.language}' policy declares [${declared.join(', ')}]`
            );
          } else {
            const advertised = new Set(advertisedFilters.map((f) => f.filter));
            const missing = declared.filter((id) => !advertised.has(id));
            if (missing.length > 0) {
              this.logger.warn(
                `[SessionManager ${sessionId}] Exception filter drift: '${session.language}' policy declares [${missing.join(', ')}] not advertised by the adapter (advertised: [${[...advertised].join(', ')}])`
              );
            }
          }
        }
      } catch (err) {
        this.logger.debug(
          `[SessionManager ${sessionId}] Exception filter drift check skipped: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      // Logpoint drift check (issue #235): a logpoint was accepted pre-launch
      // (policy support true or unknown), but the live adapter does not
      // advertise supportsLogPoints — it will likely pause instead of log.
      if (capabilities.supportsLogPoints !== true) {
        for (const bp of session.breakpoints.values()) {
          if (bp.logMessage !== undefined) {
            this.logger.warn(
              `[SessionManager ${sessionId}] Logpoint at ${bp.file}:${bp.line} but the adapter does not advertise supportsLogPoints — it may pause instead of logging`
            );
            setCuratedMessage(bp, 'Adapter does not advertise logpoint support — this may pause instead of logging');
          }
        }
      }

      // Function-breakpoint drift check (issue #271 phase 3): accepted
      // pre-launch on unknown policy support, but the live adapter does not
      // advertise supportsFunctionBreakpoints — it will never bind. Skipped
      // for CDP-delivered function breakpoints (issue #295): js-debug's live
      // capabilities honestly say false, but our proxy bridge binds them out
      // of band, so the adapter bit carries no signal here.
      const fnBpViaCdp = (() => {
        try {
          return this.sessionStore.selectPolicy(session.language).functionBreakpointsVia === 'cdp';
        } catch {
          return false;
        }
      })();
      if (!fnBpViaCdp && capabilities.supportsFunctionBreakpoints !== true && session.functionBreakpoints) {
        for (const bp of session.functionBreakpoints.values()) {
          this.logger.warn(
            `[SessionManager ${sessionId}] Function breakpoint on ${bp.functionName} but the adapter does not advertise supportsFunctionBreakpoints — it will not bind`
          );
          setCuratedMessage(bp, 'Adapter does not advertise function-breakpoint support — this breakpoint will not bind');
        }
      }
    };
    proxyManager.on('adapter-capabilities', handleAdapterCapabilities);
    handlers.set('adapter-capabilities', handleAdapterCapabilities);

    // The custom events the policy's live update asked the worker for (issue #876): folded
    // into the session's opaque per-policy state, which `hot_reload` reads.
    const handleDapEvent = (event: string, body: unknown) => {
      let live;
      try {
        live = this.sessionStore.selectPolicy(session.language).liveUpdate;
      } catch {
        return;
      }
      if (!live?.onEvent || !live.events?.includes(event)) {
        return;
      }
      session.liveUpdateState = live.onEvent(session.liveUpdateState, event, body);
      this.logger.debug(`[SessionManager ${sessionId}] live-update event ${event} recorded`);
    };
    proxyManager.on('dap-event', handleDapEvent);
    handlers.set('dap-event', handleDapEvent);

    // Pre-launch function-breakpoint sync results from the worker (issue
    // #302): stamp the adapter-assigned ids into the store immediately so a
    // stop that hits a function breakpoint right at launch (e.g. a
    // breakpoint on main) can be labeled — the post-launch re-sync loses
    // that race. Match by name (payload order mirrors the launch snapshot,
    // but the map may have changed mid-launch); consume each store entry at
    // most once so duplicate names update distinct entries.
    const handleFunctionBreakpointsSynced = (results: FunctionBreakpointSyncResult[]) => {
      const consumed = new Set<string>();
      for (const result of results) {
        const target = Array.from(session.functionBreakpoints.values()).find(
          (bp) => bp.functionName === result.name && !consumed.has(bp.id)
        );
        if (!target) {
          continue;
        }
        consumed.add(target.id);
        // The same rules as every other writer (issue #754): a stop that
        // already proved the record bound outranks an unbound echo (#673),
        // provenance is stamped, an unverified record claims no binding
        // location, and the adapter's own words survive into the store — a
        // refused pre-launch set is echoed with its refusal (#750) — while a
        // verifying echo without words drops a stamped refusal.
        if (keepHitProven(target, { verified: result.verified, id: result.id })) {
          continue;
        }
        target.verified = result.verified;
        target.verifiedBy = target.verified ? 'adapter' : undefined;
        if (typeof result.id === 'number') {
          target.adapterId = result.id;
        }
        if (target.verified) {
          if (typeof result.line === 'number') {
            target.boundLine = result.line;
          }
          if (result.source) {
            target.boundFile = result.source;
          }
        } else {
          target.boundFile = undefined;
          target.boundLine = undefined;
        }
        if (result.refused === true && result.message !== undefined) {
          // The worker echoes a refused pre-launch set with the adapter's
          // refusal (#750): a note about the request, marked as such (#754).
          stampRefusalMessage(target, result.message);
        } else {
          setAdapterMessage(target, result.message, target.verified);
        }
      }
    };
    proxyManager.on('function-breakpoints-synced', handleFunctionBreakpointsSynced);
    handlers.set('function-breakpoints-synced', handleFunctionBreakpointsSynced);

    // Pre-launch line-breakpoint sync results from the worker (issue #439):
    // stamp verified/adapterId into the store immediately. For a launch that
    // never pauses (a logpoint-only short program), the session is already
    // STOPPED when the post-launch re-sync gate runs, so this status is the
    // only path that ever stamps these breakpoints. Matched by the echoed
    // store id — exact, immune to the worker's path canonicalization.
    const handleBreakpointsSynced = (results: BreakpointSyncResult[]) => {
      // js-debug's worker path never emits this status (queueing policies
      // skip handleInitializedEvent), but guard anyway: parent responses
      // are non-authoritative for mirroring policies — never downgrade
      // child-verified state or clobber child-space adapter ids.
      const mirrorsToChild = mirrorsBreakpointsToChild(() => this.sessionStore.selectPolicy(session.language));
      for (const result of results) {
        if (typeof result.id !== 'string') {
          continue; // legacy payload without an echo key
        }
        const target = session.breakpoints.get(result.id);
        if (!target) {
          continue; // removed mid-launch
        }
        if (mirrorsToChild) {
          target.verified = target.verified || result.verified;
          settleStoredMessage(target);
          continue;
        }
        target.verified = result.verified;
        target.verifiedBy = target.verified ? 'adapter' : undefined;
        if (typeof result.adapterId === 'number') {
          target.adapterId = result.adapterId;
        }
        if (typeof result.boundLine === 'number') {
          target.line = result.boundLine;
        }
        if (!target.verified) {
          target.boundFile = undefined;
          target.boundLine = undefined;
        }
        // The adapter's words when present; otherwise settle the stored note
        // — a clean sync must not wipe the capability-drift warning
        // handleAdapterCapabilities may have set, while a provisional
        // "unbound" note or a stamped refusal cannot outlive the
        // verification that contradicts it (issues #471, #754).
        if (result.refused === true && result.message !== undefined) {
          // The worker echoes a refused pre-launch set with the adapter's
          // refusal (#750): a note about the request, marked as such (#754).
          stampRefusalMessage(target, result.message);
        } else {
          setAdapterMessage(target, result.message, target.verified);
        }
        this.logger.info('debug:breakpoint', {
          event: 'verified',
          sessionId,
          sessionName: session.name,
          breakpointId: target.id,
          file: target.file,
          line: target.line,
          verified: target.verified,
          timestamp: Date.now(),
        });
      }
    };
    proxyManager.on('breakpoints-synced', handleBreakpointsSynced);
    handlers.set('breakpoints-synced', handleBreakpointsSynced);

    // Named function for error event
    const handleError = (error: Error) => {
      clearPauseIntent(session);
      this.logger.debug(`[SessionManager] 'error' event handler called for session ${sessionId}`);
      this.logger.error(`[ProxyManager ${sessionId}] Error:`, error);
      // The worker's error report is synchronous and outruns the terminal
      // status behind it, and the launcher prefers lastProxyError: quote the
      // adapter's last word here too, unless the report already does (issue
      // #897). "DAP client error: read ECONNRESET" says nothing on its own.
      const stderrLine = lastAdapterStderrLine(proxyManager.getAdapterStderrTail?.());
      session.lastProxyError = stderrLine && !quotesAdapterStderrLine(error.message, stderrLine)
        ? `${error.message}; adapter stderr: "${stderrLine}"`
        : error.message;
      this._updateSessionState(session, SessionState.ERROR);
      this.recordProxyFailure(session, error);

      // Clean up listeners since proxy is in error state
      this.cleanupProxyEventHandlers(session, proxyManager);
      session.lastProxyPid = proxyManager.getProxyPid?.() ?? session.lastProxyPid;
      session.proxyManager = undefined;

      // Reap the proxy process (see handleTerminated for rationale, issue
      // #122); promise retained for closeSession (issue #502).
      this.stopOrDeferWorker(session, proxyManager, 'error');
    };
    proxyManager.on('error', handleError);
    handlers.set('error', handleError);

    // Named function for exit event
    const handleExit = (code: number | null, signal?: string, expected?: boolean) => {
      clearPauseIntent(session);
      this.logger.debug(`[SessionManager] handleExit: session=${sessionId} currentState=${session.state} code=${code} signal=${signal} expected=${expected}`);
      this.logger.info(`[ProxyManager ${sessionId}] Exit: code=${code}, signal=${signal}, expected=${expected}`);
      // The adapter's own last word, when the worker sent one (issue #897).
      const stderrLine = lastAdapterStderrLine(proxyManager.getAdapterStderrTail?.());
      session.lastProxyExit = { code, signal, expected, ...(stderrLine ? { stderrLine } : {}) };
      const stateBeforeExit = session.state;
      if (!isTerminalSessionState(session.state)) {
        if (expected === true) {
          // Orderly debuggee termination (issue #258): the worker saw a
          // terminated/exited DAP event or was already shutting down. A
          // non-zero code here is the debuggee's own exit status (rdbg -c
          // propagates it) — a normal debugging outcome, not an error.
          if (typeof code === 'number' && session.exitCode === undefined) {
            session.exitCode = code;
          }
          this._updateSessionState(session, SessionState.STOPPED);
        } else if (expected === false) {
          // The adapter died or dropped the socket with no preceding
          // terminal DAP event. Only a clean code 0 counts as normal.
          this._updateSessionState(
            session,
            code === 0 ? SessionState.STOPPED : SessionState.ERROR
          );
        } else {
          // Legacy path (real proxy-process exit): clean exit is code 0 or
          // null with no signal; anything else is an infrastructure error.
          if (code === 0 || (code === null && !signal)) {
            this._updateSessionState(session, SessionState.STOPPED);
          } else {
            this._updateSessionState(session, SessionState.ERROR);
          }
        }
      }

      if (stateBeforeExit !== SessionState.ERROR && session.state === SessionState.ERROR) {
        const exitDescription = `code=${code ?? 'null'}${signal ? `, signal=${signal}` : ''}`;
        const exitError = Object.assign(
          new Error(
            `Debug proxy exited unexpectedly (${exitDescription})${stderrLine ? `; adapter stderr: "${stderrLine}"` : ''}`
          ),
          { code, signal, expected }
        );
        this.recordProxyFailure(session, exitError);
      }

      // Clean up listeners since proxy is gone
      this.cleanupProxyEventHandlers(session, proxyManager);
      session.lastProxyPid = proxyManager.getProxyPid?.() ?? session.lastProxyPid;
      session.proxyManager = undefined;

      // A defined 'expected' marks the status-driven emission (the worker
      // REPORTED termination over IPC — the OS process may still be alive,
      // e.g. stranded mid-shutdown). Reap it like the other terminal
      // handlers; stop() is idempotent and cheap once the worker is truly
      // gone. The undefined case is the real child-process exit, where the
      // process is already dead and handleProxyExit cleaned up (issue #502).
      if (expected !== undefined) {
        this.stopOrDeferWorker(session, proxyManager, 'exit');
      }
    };
    proxyManager.on('exit', handleExit);
    handlers.set('exit', handleExit);

    // Named function for debuggee output events (issue #218). Captures every
    // DAP 'output' event into the session's ring buffer so output stays
    // queryable (get_output tool / output resource) while running and after
    // the program exits, until the session is closed.
    const handleOutput = (body: DebugProtocol.OutputEvent['body'] | undefined) => {
      if (!body || typeof body.output !== 'string' || body.output.length === 0) {
        return;
      }
      // DAP: category defaults to 'console' when omitted. 'telemetry' is
      // adapter-internal noise (js-debug emits it constantly) — never debuggee
      // output, so it is dropped at write time.
      const category = body.category ?? 'console';
      if (category === 'telemetry') {
        return;
      }
      // Policy hooks below consult the language policy; a lookup failure
      // must never cost the user real output.
      let policy: AdapterPolicy | undefined;
      try {
        policy = this.sessionStore.selectPolicy(session.language);
      } catch {
        policy = undefined;
      }
      // Policy-declared adapter noise (issue #361 — e.g. LLDB DWARF-parser
      // spew): dropped from the buffer but kept in debug logs.
      try {
        if (policy?.shouldSuppressOutputEvent?.(category, body.output)) {
          this.logger.debug(
            `[SessionManager] Suppressed adapter-noise output event for session ${sessionId} (${category}): ${body.output.slice(0, 200)}`
          );
          return;
        }
      } catch {
        // keep the output
      }
      // Redact-at-write (issue #237): one hook covers both buffer readers —
      // the get_output tool and the debug:// output resource. The original
      // text is deliberately not retained.
      const { text, redacted } = this.redactForBuffer(body.output);
      // Push to the closure-captured buffer, NOT session.outputBuffer — see
      // the buffer construction above (issue #358).
      const entry: SessionOutputEntry | undefined = outputBuffer.push(
        category,
        text,
        undefined,
        redacted ? { redacted: true } : undefined
      );
      if (entry) {
        this.emit('output-captured', sessionId, entry);
      }
      // Policy-annotated degradation (issue #441 — e.g. CodeLLDB failing to
      // load Rust formatters): keep the raw line, then follow it with an
      // attributed explanation and record it for the launch-result warning.
      try {
        const note = policy?.annotateOutputEvent?.(category, body.output);
        if (note) {
          recordAdapterNotice(note);
        }
      } catch {
        // annotation must never break output capture
      }
    };
    proxyManager.on('output', handleOutput);
    handlers.set('output', handleOutput);

    // An adapter answer the worker forwards on its own (issue #746 — a
    // configuration request refused under an honoured noDebug): recorded
    // exactly like a policy annotation, and contained like one — a
    // subscriber throwing on the entry must not escape into the IPC
    // listener that dispatched the status.
    const handleAdapterNotice = (note: string) => {
      try {
        recordAdapterNotice(note);
      } catch (err) {
        this.logger.warn(
          `[SessionManager ${sessionId}] Recording an adapter notice failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    };
    proxyManager.on('adapter-notice', handleAdapterNotice);
    handlers.set('adapter-notice', handleAdapterNotice);

    // The session tree (issue #1081): a child the debuggee started, reported
    // on this session's connection, becomes a session of its own.
    const handleChildReported = (reported: ChildReportedEvent) => {
      void this.adoptReportedChild(session, proxyManager, reported);
    };
    proxyManager.on('child-reported', handleChildReported);
    handlers.set('child-reported', handleChildReported);

    // Preparation precedes this generation's reset. Seed its notices only
    // after the notice array and output buffer have been initialized, using
    // the same containment for subscribers that throw as worker notices.
    for (const note of session.launchConfigNotices ?? []) handleAdapterNotice(note);

    // Store handlers in WeakMap
    this.sessionEventHandlers.set(session, handlers);
    this.logger.debug(`[SessionManager] Attached ${handlers.size} event handlers for session ${sessionId}`);
  }

  /**
   * Terminal-time note for function breakpoints that never bound (issue
   * #308): stamp bp.message (only when empty — an adapter message wins) and
   * append one warning entry to the session output buffer, so both
   * list_breakpoints and get_output explain the silent no-stop after the
   * program has exited. Idempotent via the empty-message check — the
   * terminated and exited handlers can both fire. Applies to bind-late
   * adapters too: never-bound at exit is a real signal even where
   * unverified-at-launch is by design.
   */
  /**
   * The policy's reading of the program's end (issue #877), recorded once at the end event for
   * every answer that reports it: the launch that ended within its hold, wait_for_stop, the
   * session listing. Best effort: a policy that throws adds nothing.
   */
  private recordProgramEndExplanation(session: ManagedSession, outputBuffer: OutputRingBuffer): void {
    try {
      const explain = this.sessionStore.selectPolicy(session.language).explainProgramEnd;
      if (!explain) {
        return;
      }
      const explanation = explain({ outputTail: outputBuffer.renderTail(PROGRAM_END_OUTPUT_TAIL_CHARS), exitCode: session.exitCode });
      if (explanation && (explanation.note !== undefined || explanation.data !== undefined)) {
        session.programEndExplanation = explanation;
      }
    } catch (error) {
      this.logger.debug(`[SessionManager ${session.id}] program-end explanation skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  protected noteUnboundFunctionBreakpoints(session: ManagedSession, outputBuffer?: OutputRingBuffer): void {
    const neverBound: string[] = [];
    for (const bp of session.functionBreakpoints?.values() ?? []) {
      if (bp.verified || bp.message) {
        continue;
      }
      let hint: string | undefined;
      try {
        hint = this.sessionStore.selectPolicy(session.language).functionBreakpointNameHint?.(bp.functionName);
      } catch {
        hint = undefined;
      }
      setCuratedMessage(bp, `Never bound during this run — the debugger never resolved '${bp.functionName}', so the program never stopped there. Check the symbol name${hint ? ` (${hint})` : ''}`);
      neverBound.push(bp.functionName);
    }
    if (neverBound.length > 0) {
      const names = neverBound.map((n) => `'${n}'`).join(', ');
      // Write to the launch's own buffer when provided (issue #358) — a
      // restart may already have installed a fresh session.outputBuffer.
      const entry = (outputBuffer ?? session.outputBuffer)?.push(
        'console',
        `[mcp-debugger] Warning: function breakpoint(s) never bound during this run: ${names}. The program never stopped there — check the symbol name(s).\n`
      );
      if (entry) {
        this.emit('output-captured', session.id, entry);
      }
    }
  }

  protected cleanupProxyEventHandlers(session: ManagedSession, proxyManager: IProxyManager): void {
    clearPauseIntent(session);
    // Safety check to prevent double cleanup
    if (!this.sessionEventHandlers.has(session)) {
      this.logger.debug(`[SessionManager] Cleanup already performed for session ${session.id}`);
      return;
    }

    const handlers = this.sessionEventHandlers.get(session);
    if (!handlers) {
      this.logger.debug(`[SessionManager] No handlers found for session ${session.id}`);
      return;
    }
    
    let removedCount = 0;
    let failedCount = 0;
    
    handlers.forEach((handler, eventName) => {
      try {
        this.logger.debug(`[SessionManager] Removing ${eventName} listener for session ${session.id}`);
        proxyManager.removeListener(eventName, handler);
        removedCount++;
      } catch (error) {
        this.logger.error(`[SessionManager] Failed to remove ${eventName} listener for session ${session.id}:`, error);
        failedCount++;
        // Continue cleanup despite errors
      }
    });
    
    this.logger.info(`[SessionManager] Cleanup complete for session ${session.id}: ${removedCount} removed, ${failedCount} failed`);
    this.sessionEventHandlers.delete(session);
  }

  /**
   * @internal - This is for testing only, do not use in production
   */
  public _testOnly_cleanupProxyEventHandlers(session: ManagedSession, proxyManager: IProxyManager): void {
    return this.cleanupProxyEventHandlers(session, proxyManager);
  }

  /**
   * Handle auto-continue when stopOnEntry is false.
   * Must be overridden in subclasses that have access to the continue method.
   */
  protected abstract handleAutoContinue(sessionId: string): Promise<void>;
}
