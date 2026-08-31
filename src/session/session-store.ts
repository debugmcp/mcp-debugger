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
  getPolicyForLanguage
} from '@debugmcp/shared';
import type { ExceptionBreakMode } from '@debugmcp/shared';
import { SessionNotFoundError } from '../errors/debug-errors.js';

/**
 * Parameters for creating a new debug session
 */
export interface CreateSessionParams {
  language: DebugLanguage;
  name?: string;
  executablePath?: string;  // Language-agnostic executable path
}

import type { DebugProtocol } from '@vscode/debugprotocol';
import { IProxyManager } from '../proxy/proxy-manager.js';
import { OutputRingBuffer } from './output-buffer.js';

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
export interface ManagedSession extends DebugSessionInfo {
  executablePath?: string;  // Language-agnostic executable path
  proxyManager?: IProxyManager;
  // In-flight proxy teardown started by a terminal event handler (which
  // clears proxyManager before its fire-and-forget stop()); closeSession
  // awaits this so it cannot report success while the worker may still be
  // dying — or failing to die (issue #502).
  pendingProxyStop?: Promise<void>;
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
  // True once the first 'stopped' event after launch has been observed.
  // Used by the auto-continue trigger to identify the initial entry stop
  // even when the adapter reports a non-'entry' reason (e.g., js-debug
  // emits 'pause' from its post-attach forced pause).
  firstStopHandled?: boolean;
  // True while a user-initiated DAP pause request is awaiting its stopped
  // event. Read by policy stop-reason normalization (adapters like CodeLLDB
  // report pauses with a misleading raw reason); cleared on every stop.
  pausePending?: boolean;
  // True for sessions established via attach_to_process. Attach targets may
  // run on a remote filesystem (container, pod, other machine), so host-side
  // file existence checks do not apply to their source paths.
  attachMode?: boolean;
  // Debuggee output captured from DAP 'output' events (issue #218).
  // Created fresh on each launch/attach; readable until the session is closed.
  outputBuffer?: OutputRingBuffer;
  // Policy-annotated adapter degradation notes (issue #441 — e.g. CodeLLDB
  // failing to load Rust formatters). Reset per launch, deduped; joined into
  // the start_debugging warning when they arrive before the launch resolves.
  adapterNotices?: string[];
  // Live capabilities from the adapter's DAP initialize response (issue #243).
  // Reset on each launch; gates best-effort requests like exceptionInfo and
  // lets tooling validate static policy tables against the real adapter.
  adapterCapabilities?: DebugProtocol.Capabilities;
  // The breakOnExceptions mode actually in effect for the current launch or
  // attach — the user's value, or the policy's launch default when unset
  // (issue #244). Previously write-only pass-through; recorded for read-back.
  effectiveBreakOnExceptions?: ExceptionBreakMode;
  // Caller-provided adapterConfig keys the adapter's attach transform did not
  // carry into the DAP attach request (issue #450). Recorded per attach by
  // ProxyLauncher.start; consumed by attachToProcess for the response warning.
  attachDroppedConfigKeys?: string[];
  // Caller-provided adapterConfig keys outside the adapter's declared
  // supportedAttachKeys that were still forwarded to the debug adapter
  // (issue #466). Same lifecycle as attachDroppedConfigKeys.
  attachForwardedUnknownConfigKeys?: string[];
  // The most recent real launch, replayed by restart_debugging (issue #238).
  lastLaunch?: LastLaunchSpec;
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
    const { language, name, executablePath } = params;
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
    };
    
    this.sessions.set(sessionId, session);
    
    return { 
      id: sessionId, 
      name: sessionName, 
      language: session.language, 
      state: session.state, 
      createdAt: session.createdAt, 
      updatedAt: session.updatedAt 
    };
  }

  /**
   * Retrieves a session by ID
   */
  get(sessionId: string): ManagedSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Retrieves a session by ID, throwing if not found
   */
  getOrThrow(sessionId: string): ManagedSession {
    const session = this.sessions.get(sessionId);
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
      lastStop: s.lastStop,
      exitCode: s.exitCode,
      // Mirror endpoint without the token (issue #217); the isRunning gate
      // keeps the projection honest on teardown paths that skip cleanup.
      ...(s.exposure && s.proxyManager?.isRunning()
        ? { exposure: { host: s.exposure.host, port: s.exposure.port } }
        : {})
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
    return this.sessions.has(sessionId);
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
