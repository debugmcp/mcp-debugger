/**
 * SessionStore - Pure data management for debug sessions
 * 
 * This class is extracted from SessionManager to handle all session
 * state management without external dependencies. This improves
 * testability and follows the Single Responsibility Principle.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  DebugLanguage,
  SessionState,
  SessionLifecycleState,
  ExecutionState,
  DebugSessionInfo,
  Breakpoint,
  FunctionBreakpoint,
  AdapterPolicy,
  getPolicyForLanguage,
  isSettledSessionState
} from '@debugmcp/shared';
import type { AttachLocality, ExceptionBreakMode, ProgramEndExplanation, SessionStopInfo } from '@debugmcp/shared';
import { SessionNotFoundError } from '../errors/debug-errors.js';
import type { NoUncaughtStop } from '../utils/error-messages.js';

/**
 * Parameters for creating a new debug session
 */
export interface CreateSessionParams {
  language: DebugLanguage;
  name?: string;
  executablePath?: string;  // Language-agnostic executable path
  /** The session that spawned this one (the session tree, issue #1081); child sessions only. */
  parentSessionId?: string;
  /**
   * The scope the session belongs to (issue #1025, step 2): the authenticated
   * principal that created it, or absent for the shared anonymous scope. A
   * child inherits its root's. Never projected into DebugSessionInfo.
   */
  ownerKey?: string;
}

import type { DebugProtocol } from '@vscode/debugprotocol';
import { IProxyManager } from '../proxy/proxy-manager.js';
import { OutputRingBuffer } from './output-buffer.js';
import { isDebuggerOff } from './debugger-off.js';
import type { PauseIntent } from './execution/pause-intent.js';
import type { ProxyFailureDiagnostics } from './launch/proxy-failure-diagnostics.js';
import { isSessionHidden } from './session-scope.js';

export interface ToolchainValidationState {
  compatible: boolean;
  toolchain: string;
  message?: string;
  suggestions?: string[];
  behavior?: string;
  binaryInfo?: Record<string, unknown>;
}

/** Terminal status reported by the proxy worker for the current launch. */
export interface ProxyExitState {
  code: number | null;
  signal?: string;
  expected?: boolean;
  /** The adapter's last stderr line, when the worker reported one with the exit (issue #897). */
  stderrLine?: string;
}

/**
 * The most recent real (non-dry-run) launch, captured as SessionManager
 * received it — scriptPath is the server-layer-resolved effective path, so a
 * replay needs no re-translation. breakOnExceptions is the RAW user value;
 * policy-default resolution re-runs identically on replay (issue #238).
 */
export interface LastLaunchSpec {
  scriptPath: string;
  scriptArgs?: string[];
  dapLaunchArgs?: Partial<DebugProtocol.LaunchRequestArguments> & Record<string, unknown>;
  adapterLaunchConfig?: Record<string, unknown>;
  breakOnExceptions?: ExceptionBreakMode;
  launchedAt: number;
}

/**
 * What the adapter's transform handed the engine for the current launch
 * (issue #950): the program it runs — for a compiled language the binary or
 * DLL, not the script the caller named — and the transformed config it came
 * from. See ManagedSession.transformedLaunch.
 */
export interface TransformedLaunch {
  program: string;
  launchConfig: Record<string, unknown>;
}

/**
 * Live DAP mirror endpoint hosted by the session's proxy worker (issue
 * #217). Valid only while that worker is running — projections must gate
 * on proxyManager.isRunning(). The token is the IDE-attach capability
 * (and, via evaluate, a debuggee-execution capability): never log it and
 * never project it into list_debug_sessions.
 */
export interface SessionExposure {
  host: string;
  port: number;
  token: string;
  exposedAt: number; // epoch ms
}

/**
 * Internal session representation with full details
 */
/**
 * Why a reported child was released to run undebugged instead of adopted
 * (issue #1137): child sessions are off (the cap is 0), the tree is at its
 * cap, the session's proxy cannot host child sessions, or the adoption failed.
 */
export type ChildReleaseCause = 'adoption-off' | 'cap' | 'unsupported' | 'adoption-failed';

export interface ManagedSession extends DebugSessionInfo {
  executablePath?: string;  // Language-agnostic executable path
  /** The scope the session belongs to (issue #1025, step 2); see CreateSessionParams.ownerKey. */
  ownerKey?: string;
  proxyManager?: IProxyManager;
  // In-flight proxy teardown started by a terminal event handler (which
  // clears proxyManager before its fire-and-forget stop()); closeSession
  // awaits this so it cannot report success while the worker may still be
  // dying — or failing to die (issue #502).
  pendingProxyStop?: Promise<void>;
  // A root that ended while child sessions were live keeps its worker for
  // them (the session tree, issue #1081): the stop deferred here runs when
  // the last child ends or is closed, or on an explicit close of the root.
  deferredWorkerStop?: IProxyManager;
  // Worker OS pid retained across teardown so closeSession can verify the
  // worker actually died and log a leak otherwise (issue #502).
  lastProxyPid?: number;
  breakpoints: Map<string, Breakpoint>;
  // Function breakpoints (issue #271 phase 3): session-global, name-addressed,
  // synced via DAP setFunctionBreakpoints (replace-all per request).
  functionBreakpoints: Map<string, FunctionBreakpoint>;
  // New state model fields
  sessionLifecycle: SessionLifecycleState;
  executionState?: ExecutionState;
  logDir?: string;
  toolchainValidation?: ToolchainValidationState;
  /** Reset per launch; distinguishes a proxy crash from debuggee completion. */
  lastProxyExit?: ProxyExitState;
  /** Last proxy error-event message for the current launch. */
  lastProxyError?: string;
  /** Actionable pointers retained when the current launch's proxy fails. */
  failureDiagnostics?: ProxyFailureDiagnostics;
  // True once the first 'stopped' event after launch has been observed.
  // Used by the auto-continue trigger to identify the initial entry stop
  // even when the adapter reports a non-'entry' reason (e.g., js-debug
  // emits 'pause' from its post-attach forced pause).
  firstStopHandled?: boolean;
  /**
   * The last snapshot's rendered locals, for changedVariables diffs (issue
   * #983): a later stop in the same frame (frameKey = anchor name|file|
   * visible depth) reports only what changed. `stopRef` is the lastStop the
   * base was read at, compared by identity so the same stop answered twice
   * never diffs against itself. Cleared at the launch/attach boundaries;
   * survives ordinary resumes on purpose.
   */
  snapshotDiffBase?: {
    stopRef: SessionStopInfo;
    frameKey: string;
    rendered: Record<string, string>;
    /**
     * Whether `rendered` is every local the frame had: no variable omitted by
     * a cap, no scope left unread or failed to read (issue #1140). A name
     * missing from a cut list may only not have fitted, so only a complete
     * base can call a variable new.
     */
    complete: boolean;
  };
  // Monotonic identity for each proxy installed on this session. A late event
  // from an older worker cannot satisfy intent armed against a newer one.
  proxyGeneration?: number;
  // Pause request awaiting its stopped event, scoped to proxyGeneration.
  pauseIntent?: PauseIntent;
  // True for sessions established via attach_to_process. Attach targets may
  // run on a remote filesystem (container, pod, other machine), so host-side
  // file existence checks do not apply to their source paths.
  attachMode?: boolean;
  // Where that target lives (issue #903): 'pid' and 'loopback' are this host,
  // so the host file is the debuggee's own source and content addressing is
  // allowed (issue #899); cleared with attachMode by a launch.
  attachLocality?: AttachLocality;
  // Debuggee output captured from DAP 'output' events (issue #218).
  // Created fresh on each launch/attach; readable until the session is closed.
  outputBuffer?: OutputRingBuffer;
  // Policy-annotated adapter degradation notes (issue #441 — e.g. CodeLLDB
  // failing to load Rust formatters). Reset per launch, deduped; joined into
  // the start_debugging warning when they arrive before the launch resolves.
  adapterNotices?: string[];
  /** Transform diagnostics, retained even when preparation fails before a proxy exists (#709). */
  launchConfigNotices?: string[];
  // Live capabilities from the adapter's DAP initialize response (issue #243).
  // Reset on each launch; gates best-effort requests like exceptionInfo and
  // lets tooling validate static policy tables against the real adapter.
  adapterCapabilities?: DebugProtocol.Capabilities;
  /** The policy's live-update bookkeeping (issue #876), opaque to the core; reset per launch. */
  liveUpdateState?: unknown;
  /** The policy's reading of the program's end (issue #877), recorded at the end event; reset per launch. */
  programEndExplanation?: ProgramEndExplanation;
  /**
   * Children reported on this session's connection and released to run
   * undebugged during this run (the session tree, issue #1081): beyond the
   * cap, or an adoption that failed. A running total the answers carry as
   * `childrenReleased`; reset per launch.
   */
  releasedChildReports?: number;
  /**
   * Why those children were released, by cause, counted in the same call as
   * `releasedChildReports` (issue #1137): what lets an answer that carries
   * the number say what it means. Categories, never the release's free text
   * — an adoption failure's reason embeds an adapter error. Reset per launch.
   */
  releasedChildCauses?: Partial<Record<ChildReleaseCause, number>>;
  /** The per-tree cap in force when a child was released for reaching it; reset per launch. */
  releasedChildCap?: number;
  /**
   * How many times a descendant of this session stopped during this run (the
   * session tree, issue #1128): a stop the agent could see, on any child or
   * grandchild. Kept on every ancestor because a child's own record leaves
   * with its row at its close; it is what lets the end summary of a session
   * that never stopped itself say that its tree did. Reset per launch.
   */
  descendantStops?: number;
  // The breakOnExceptions mode actually in effect for the current launch or
  // attach — the user's value, or the policy's launch default when unset
  // (issue #244). Previously write-only pass-through; recorded for read-back.
  effectiveBreakOnExceptions?: ExceptionBreakMode;
  // The launcher's decision that the current launch runs with the debugger
  // off — noDebug on an adapter that honours it (issue #710). The raw
  // record: written per launch, reset per launch and attach, cleared by a
  // stop only a live debugger produces. Never read directly for a
  // caller-facing answer — isDebuggerOff/debuggerOffWhy (debugger-off.ts)
  // gate it on the launch being live, and DebugSessionInfo.debuggerDisabled
  // is its projection (issue #749).
  launchDebuggerOff?: boolean;
  // Caller-provided adapterConfig keys the adapter's attach transform did not
  // carry into the DAP attach request (issue #450). Recorded per attach by
  // ProxyLauncher.start; consumed by attachToProcess for the response warning.
  attachDroppedConfigKeys?: string[];
  // Caller-provided adapterConfig keys outside the adapter's declared
  // supportedAttachKeys that were still forwarded to the debug adapter
  // (issue #466). Same lifecycle as attachDroppedConfigKeys.
  attachForwardedUnknownConfigKeys?: string[];
  // The adapter's own attach-transform notes (Dart: the no-auth URI built
  // from host:port, a deviceId on a Dart runner; COBOL: build options given
  // without sources), drained from consumeLaunchConfigDiagnostics per
  // attempt (issue #908): reset when ProxyLauncher.start begins, set after
  // the transform (undefined when there are none), consumed by
  // attachToProcess for the response warning.
  attachTransformNotices?: string[];
  // The most recent real launch, replayed by restart_debugging (issue #238).
  lastLaunch?: LastLaunchSpec;
  // The current launch as the adapter's transform handed it to the engine
  // (issue #950). Written by ProxyLauncher.start after the transform, cleared
  // when a start begins and left clear by an attach; a dry run leaves it as it
  // was, so it always names the last real launch (issue #812). Read by the
  // stale-build check, which hands it to the policy so a source can be
  // compared with the artefact it binds through. Not part of lastLaunch,
  // which is the caller's replayable request.
  transformedLaunch?: TransformedLaunch;

  /**
   * The exception arming of the last launch or attach (`recordExceptionArming`):
   * the DAP exception-filter ids it armed (issue #985), the ones beyond the
   * mode's table — a pytest module launch adds `userUnhandled` to the
   * `uncaught` default; those stop on an exception the program survives, so
   * the launch counts as armed (`describeLaunchArming`) — and why no uncaught
   * exception will stop the program when none will (issue #1032). Reset per
   * launch attempt.
   */
  launchExceptionFilters?: {
    readonly ids: readonly string[];
    readonly beyondMode: readonly string[];
    readonly noUncaughtStop: NoUncaughtStop | undefined;
  };
  // Live DAP mirror endpoint, when exposed via expose_session (issue #217).
  exposure?: SessionExposure;
}

/**
 * SessionStore manages the lifecycle and state of debug sessions
 * without any external dependencies, making it highly testable.
 */
export class SessionStore {
  private sessions: Map<string, ManagedSession> = new Map();

  /**
   * Selects the appropriate adapter policy based on language
   */
  public selectPolicy(language: DebugLanguage): AdapterPolicy {
    return getPolicyForLanguage(language);
  }

  /**
   * Creates a new debug session
   */
  createSession(params: CreateSessionParams): DebugSessionInfo {
    const { language, name, executablePath, parentSessionId, ownerKey } = params;
    const sessionId = uuidv4();
    const sessionName = name || `session-${sessionId.substring(0, 8)}`;
    
    // Validate language
    if (!Object.values(DebugLanguage).includes(language)) {
      throw new Error(`Language '${language}' is not supported.`);
    }
    
    // Use policy to resolve executable path
    const policy = this.selectPolicy(language);
    const effectiveExecutablePath = policy.resolveExecutablePath(executablePath);
    
    const session: ManagedSession = {
      id: sessionId, 
      name: sessionName, 
      language: language, 
      state: SessionState.CREATED, 
      createdAt: new Date(), 
      updatedAt: new Date(), 
      breakpoints: new Map<string, Breakpoint>(),
      functionBreakpoints: new Map<string, FunctionBreakpoint>(),
      executablePath: effectiveExecutablePath,
      proxyManager: undefined,
      // Initialize new state model
      sessionLifecycle: SessionLifecycleState.CREATED,
      executionState: undefined,
      ...(parentSessionId ? { parentSessionId } : {}),
      ...(ownerKey !== undefined ? { ownerKey } : {}),
    };

    this.sessions.set(sessionId, session);

    return {
      id: sessionId,
      name: sessionName,
      language: session.language,
      state: session.state,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      ...(parentSessionId ? { parentSessionId } : {}),
    };
  }

  /**
   * Retrieves a session by ID
   */
  get(sessionId: string): ManagedSession | undefined {
    // A session outside the calling tool call's owner scope is absent (issue #1025).
    return isSessionHidden(sessionId) ? undefined : this.sessions.get(sessionId);
  }

  /**
   * Retrieves a session by ID, throwing if not found
   */
  getOrThrow(sessionId: string): ManagedSession {
    const session = this.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    return session;
  }

  /**
   * Sets a session directly (for testing purposes)
   */
  set(sessionId: string, session: ManagedSession): void {
    this.sessions.set(sessionId, session);
  }

  /**
   * Updates session fields
   */
  update(sessionId: string, updates: Partial<ManagedSession>): void {
    const session = this.getOrThrow(sessionId);
    Object.assign(session, updates);
    session.updatedAt = new Date();
  }

  /**
   * Updates only the session state
   */
  updateState(sessionId: string, newState: SessionState): void {
    const session = this.getOrThrow(sessionId);
    if (session.state !== newState) {
      session.state = newState;
      session.updatedAt = new Date();
    }
  }

  /**
   * Removes a session
   */
  remove(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Gets all sessions as DebugSessionInfo (public interface)
   */
  getAll(): DebugSessionInfo[] {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      name: s.name,
      language: s.language,
      state: s.state,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      // The session model keeps lastStop across continue/step (the
      // run-to-completion summary and the PAUSED invariant depend on it), so
      // a running session still holds the stop it already left. Only the stop
      // a session is AT (paused) or its last stop before it ended (terminal)
      // belongs in the public projection (issue #720). Gated here rather than
      // in one handler: this is the single DebugSessionInfo list source, so
      // every consumer of it inherits the gate.
      ...(s.lastStop && isSettledSessionState(s.state)
        ? { lastStop: s.lastStop }
        : {}),
      exitCode: s.exitCode,
      // What the adapter read into the program's end (issue #877), once it has ended.
      ...(s.programEndExplanation && s.state === SessionState.STOPPED ? { programEnd: s.programEndExplanation } : {}),
      ...(s.state === SessionState.ERROR && s.failureDiagnostics
        ? { diagnostics: s.failureDiagnostics }
        : {}),
      // The current launch runs with the debugger off (issue #749) — while
      // it runs; a stopped or errored session describes nothing running.
      ...(isDebuggerOff(s) ? { debuggerDisabled: true } : {}),
      // Mirror endpoint without the token (issue #217); the isRunning gate
      // keeps the projection honest on teardown paths that skip cleanup.
      ...(s.exposure && s.proxyManager?.isRunning()
        ? { exposure: { host: s.exposure.host, port: s.exposure.port } }
        : {}),
      // The session tree (issue #1081): child rows name the session that spawned them.
      ...(s.parentSessionId ? { parentSessionId: s.parentSessionId } : {})
    }));
  }

  /**
   * Gets all sessions with full internal data
   */
  getAllManaged(): ManagedSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Checks if a session exists
   */
  has(sessionId: string): boolean {
    return !isSessionHidden(sessionId) && this.sessions.has(sessionId);
  }

  /**
   * Gets the number of sessions
   */
  size(): number {
    return this.sessions.size;
  }

  /**
   * Clears all sessions
   */
  clear(): void {
    this.sessions.clear();
  }
}
