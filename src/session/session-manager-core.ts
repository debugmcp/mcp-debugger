/**
 * Core session management functionality including lifecycle, state management,
 * and event handling.
 */
import { EventEmitter } from 'events';
import {
  SessionState, SessionLifecycleState, DebugLanguage, DebugSessionInfo, mapLegacyState,
  AdapterPolicy, SessionOutputEntry
} from '@debugmcp/shared';
import { SessionStore, ManagedSession } from './session-store.js';
import { OutputRingBuffer } from './output-buffer.js';
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
import { IProxyManager } from '../proxy/proxy-manager.js';
import { IProxyManagerFactory } from '../factories/proxy-manager-factory.js';
import { IAdapterRegistry } from '@debugmcp/shared';

// Custom launch arguments interface extending DebugProtocol.LaunchRequestArguments
export interface CustomLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  stopOnEntry?: boolean;
  justMyCode?: boolean;
}

export interface DebugResult {
  success: boolean;
  state: SessionState;
  error?: string;
  data?: unknown;
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
  dryRunTimeoutMs?: number;
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
  protected dryRunTimeoutMs: number;
  
  // WeakMap to store event handlers for cleanup
  protected sessionEventHandlers = new WeakMap<ManagedSession, Map<string, (...args: unknown[]) => void>>();

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
    this.dryRunTimeoutMs = config.dryRunTimeoutMs || 10000;
    
    this.fileSystem.ensureDirSync(this.logDirBase);
    this.logger.info(`[SessionManager] Initialized. Session logs will be stored in: ${this.logDirBase}`);
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
    const session = this.sessionStore.get(sessionId); 
    if (!session) {
      this.logger.warn(`[SESSION_CLOSE_FAIL] Session not found: ${sessionId}`);
      return false;
    }
    this.logger.info(`Closing debug session: ${sessionId}. Active proxy: ${session.proxyManager ? 'yes' : 'no'}`);
    
    if (session.proxyManager) {
      // Always cleanup listeners first
      try {
        this.cleanupProxyEventHandlers(session, session.proxyManager);
      } catch (cleanupError) {
        this.logger.error(`[SessionManager] Critical error during listener cleanup for session ${sessionId}:`, cleanupError);
        // Continue with session closure despite cleanup errors
      }
      
      // Then stop the proxy
      try {
        await session.proxyManager.stop();
      } catch (error: unknown) { 
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[SessionManager] Error stopping proxy for session ${sessionId}:`, message);
      } finally {
        session.proxyManager = undefined;
      }
    }
    
    this._updateSessionState(session, SessionState.STOPPED);
    
    // Also update session lifecycle to TERMINATED
    this.sessionStore.update(sessionId, {
      sessionLifecycle: SessionLifecycleState.TERMINATED
    });
    
    this.logger.info(`Session ${sessionId} marked as STOPPED/TERMINATED.`);
    this.sessionStore.remove(sessionId);
    return true;
  }

  async closeAllSessions(): Promise<void> {
    this.logger.info(`Closing all debug sessions (${this.sessionStore.size()} active)`);
    const sessions = this.sessionStore.getAllManaged();
    for (const session of sessions) {
      await this.closeSession(session.id);
    }
    this.logger.info('All debug sessions closed');
  }

  protected setupProxyEventHandlers(
    session: ManagedSession,
    proxyManager: IProxyManager,
    effectiveLaunchArgs: Partial<CustomLaunchRequestArguments>
  ): void {
    const sessionId = session.id;
    const handlers = new Map<string, (...args: any[]) => void>(); // eslint-disable-line @typescript-eslint/no-explicit-any -- Event handlers require flexible argument signatures to support various event types

    // Reset first-stop tracking for this launch — a session may be re-launched.
    session.firstStopHandled = false;
    session.lastStop = undefined;
    session.exitCode = undefined;
    session.adapterCapabilities = undefined;
    // Each launch/attach starts with a fresh output buffer (issue #218).
    session.outputBuffer = new OutputRingBuffer();

    // Adapters whose first stopped event after launch may not carry
    // reason='entry' (e.g., js-debug emits 'pause'/'breakpoint' from
    // pauseForSourceMap or post-attach forced pauses) opt into a relaxed
    // first-stop auto-continue rule. Identified by the policy flag
    // `pauseAfterChildAttach`, which today is true only for js-debug.
    // Other adapters keep the strict reason==='entry' check so a real
    // user-initiated pause_execution lands paused, not auto-continued.
    let firstStopMayBeNonEntry = false;
    try {
      const policy = this.sessionStore.selectPolicy(session.language);
      firstStopMayBeNonEntry =
        policy.getDapClientBehavior?.().pauseAfterChildAttach === true;
    } catch (err) {
      this.logger.debug(`[SessionManager ${sessionId}] Could not determine adapter policy for first-stop heuristic: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Named function for stopped event
    const handleStopped = (threadId: number | undefined, reason: string, body?: DebugProtocol.StoppedEvent['body']) => {
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
      const userBreakReasons = new Set([
        'breakpoint',
        'function breakpoint',
        'data breakpoint',
        'instruction breakpoint',
        'exception'
      ]);
      const isFirstStop = !session.firstStopHandled;
      // Attach sessions have no launch entry stop to skip: any stop observed
      // after attach is either the deliberate post-attach pause issued by
      // attachToProcess (pauseAfterAttach policies) or a real debug event.
      // Auto-continuing those resumed the target right after we paused it
      // (issue #124), so auto-continue is launch-only.
      const launchArgsRecord = effectiveLaunchArgs as Record<string, unknown>;
      const isAttachSession =
        launchArgsRecord.request === 'attach' ||
        launchArgsRecord.__attachMode === true;
      const shouldAutoContinue =
        !isAttachSession &&
        !effectiveLaunchArgs.stopOnEntry &&
        (reason === 'entry' ||
          (firstStopMayBeNonEntry && isFirstStop && !userBreakReasons.has(reason)));

      // Handle auto-continue for stopOnEntry=false
      if (shouldAutoContinue) {
        this.logger.info(`[ProxyManager ${sessionId}] Auto-continuing (stopOnEntry=false) [reason=${reason}, firstStop=${isFirstStop}]`);
        // Must set PAUSED synchronously before handleAutoContinue, because
        // continue() requires session.state === SessionState.PAUSED.
        this._updateSessionState(session, SessionState.PAUSED);
        this.handleAutoContinue(sessionId).catch(err => {
          this.logger.error(`[ProxyManager ${sessionId}] Error auto-continuing:`, err);
        });
      } else {
        // Record why we stopped so it stays queryable after the fact
        // (list_debug_sessions / get_stack_trace, issue #214). Auto-continued
        // entry stops are deliberately not recorded — the user never saw them.
        // description/text carry e.g. the exception class/message (issue #220).
        session.lastStop = {
          reason,
          threadId,
          timestamp: Date.now(),
          ...(body?.description ? { description: body.description } : {}),
          ...(body?.text ? { text: body.text } : {})
        };
        this._updateSessionState(session, SessionState.PAUSED);

        // Best-effort exceptionInfo enrichment (issue #243): fire-and-forget
        // after the synchronous PAUSED transition (step/continue barriers rely
        // on it). Gated on the live adapter capability; failures are swallowed
        // — the .catch also absorbs the rejection when the proxy exits with
        // the request in flight.
        if (
          reason === 'exception' &&
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
              stopRef.exceptionInfo = {
                exceptionId: info.exceptionId,
                breakMode: info.breakMode,
                ...(info.description ? { description: info.description } : {}),
                ...(details
                  ? {
                      details: {
                        ...(details.message ? { message: details.message } : {}),
                        ...(details.typeName ? { typeName: details.typeName } : {}),
                        ...(details.fullTypeName ? { fullTypeName: details.fullTypeName } : {}),
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
    // loads). Match by adapter-assigned id first; fall back to (file, line).
    // The path fallback tolerates case differences between Windows-style
    // paths: adapters canonicalize differently (js-debug lowercases the
    // drive letter) and Windows paths are case-insensitive anyway (#236).
    const windowsPathish = /^[a-z]:[\\/]/i;
    const samePath = (a: string, b: string): boolean =>
      a === b ||
      (windowsPathish.test(a) && windowsPathish.test(b) && a.toLowerCase() === b.toLowerCase());
    const handleBreakpoint = (body: DebugProtocol.BreakpointEvent['body']) => {
      const eventBp = body?.breakpoint;
      if (!eventBp) {
        return;
      }
      const all = Array.from(session.breakpoints.values());
      let target = typeof eventBp.id === 'number'
        ? all.find(bp => bp.adapterId === eventBp.id)
        : undefined;
      if (!target && eventBp.source?.path !== undefined && typeof eventBp.line === 'number') {
        const eventPath = eventBp.source.path;
        target = all.find(bp => samePath(bp.file, eventPath) && bp.line === eventBp.line);
      }
      if (!target) {
        this.logger.debug(
          `[SessionManager ${sessionId}] Breakpoint event matched no stored breakpoint (id=${eventBp.id}, ${eventBp.source?.path}:${eventBp.line})`
        );
        return;
      }
      target.verified = eventBp.verified;
      if (typeof eventBp.line === 'number') {
        target.line = eventBp.line;
      }
      if (eventBp.message !== undefined) {
        target.message = eventBp.message;
      }
      if (typeof eventBp.id === 'number') {
        target.adapterId = eventBp.id;
      }
      this.logger.info('debug:breakpoint', {
        event: 'changed',
        sessionId,
        sessionName: session.name,
        breakpointId: target.id,
        file: target.file,
        line: target.line,
        verified: target.verified,
        timestamp: Date.now(),
      });
    };
    proxyManager.on('breakpoint', handleBreakpoint);
    handlers.set('breakpoint', handleBreakpoint);

    // Named function for terminated event
    const handleTerminated = () => {
      this.logger.debug(`[SessionManager] handleTerminated: session=${sessionId} currentState=${session.state}`);
      this.logger.info(`[ProxyManager ${sessionId}] Terminated event`);
      
      // Log debug state change with structured logging
      this.logger.info('debug:state', {
        event: 'stopped',
        sessionId: sessionId,
        sessionName: session.name,
        timestamp: Date.now()
      });
      
      this._updateSessionState(session, SessionState.STOPPED);

      // Clean up listeners since proxy is gone
      this.cleanupProxyEventHandlers(session, proxyManager);
      session.proxyManager = undefined;

      // Reap the proxy process instead of just dropping the reference. The
      // worker normally self-exits after 'terminated', but if its shutdown
      // stalls (e.g. a hung adapter process) nothing else reaps it — on
      // Windows especially, orphans accumulate (issue #122). stop() is
      // idempotent against an already-exiting worker and force-kills after 5s.
      proxyManager.stop().catch((err) => {
        this.logger.warn(
          `[SessionManager] Error stopping proxy after 'terminated' for session ${sessionId}: ${err instanceof Error ? err.message : String(err)}`
        );
      });
    };
    proxyManager.on('terminated', handleTerminated);
    handlers.set('terminated', handleTerminated);

    // Named function for exited event
    const handleExited = (exitCode?: number) => {
      this.logger.debug(`[SessionManager] handleExited: session=${sessionId} currentState=${session.state} exitCode=${exitCode}`);
      this.logger.info(`[ProxyManager ${sessionId}] Exited event (exitCode=${exitCode})`);
      // Record the debuggee exit code so a crash (non-zero) is
      // distinguishable from a clean exit after the fact (issue #220)
      if (typeof exitCode === 'number') {
        session.exitCode = exitCode;
      }
      this._updateSessionState(session, SessionState.STOPPED);

      // Clean up listeners since proxy is gone
      this.cleanupProxyEventHandlers(session, proxyManager);
      session.proxyManager = undefined;

      // Reap the proxy process (see handleTerminated for rationale, issue #122)
      proxyManager.stop().catch((err) => {
        this.logger.warn(
          `[SessionManager] Error stopping proxy after 'exited' for session ${sessionId}: ${err instanceof Error ? err.message : String(err)}`
        );
      });
    };
    proxyManager.on('exited', handleExited);
    handlers.set('exited', handleExited);

    // Named function for adapter configured event
    const handleAdapterConfigured = () => {
      this.logger.debug(`[SessionManager] 'adapter-configured' event handler called for session ${sessionId}`);
      this.logger.info(`[ProxyManager ${sessionId}] Adapter configured`);
      if (!effectiveLaunchArgs.stopOnEntry) {
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
            bp.message = 'Adapter does not advertise logpoint support — this may pause instead of logging';
          }
        }
      }
    };
    proxyManager.on('adapter-capabilities', handleAdapterCapabilities);
    handlers.set('adapter-capabilities', handleAdapterCapabilities);

    // Named function for dry run complete event
    const handleDryRunComplete = (command: string, script: string) => {
      this.logger.debug(`[SessionManager] 'dry-run-complete' event handler called for session ${sessionId}`);
      this.logger.info(`[ProxyManager ${sessionId}] Dry run complete: ${command} ${script}`);
      this._updateSessionState(session, SessionState.STOPPED);
      // Don't clear proxyManager yet if we have a dry run handler waiting
      const sessionWithSetup = session as ManagedSession & { _dryRunHandlerSetup?: boolean };
      if (!sessionWithSetup._dryRunHandlerSetup) {
        session.proxyManager = undefined;
      }
    };
    proxyManager.on('dry-run-complete', handleDryRunComplete);
    handlers.set('dry-run-complete', handleDryRunComplete);

    // Named function for error event
    const handleError = (error: Error) => {
      this.logger.debug(`[SessionManager] 'error' event handler called for session ${sessionId}`);
      this.logger.error(`[ProxyManager ${sessionId}] Error:`, error);
      this._updateSessionState(session, SessionState.ERROR);

      // Clean up listeners since proxy is in error state
      this.cleanupProxyEventHandlers(session, proxyManager);
      session.proxyManager = undefined;

      // Reap the proxy process (see handleTerminated for rationale, issue #122)
      proxyManager.stop().catch((err) => {
        this.logger.warn(
          `[SessionManager] Error stopping proxy after 'error' for session ${sessionId}: ${err instanceof Error ? err.message : String(err)}`
        );
      });
    };
    proxyManager.on('error', handleError);
    handlers.set('error', handleError);

    // Named function for exit event
    const handleExit = (code: number | null, signal?: string, expected?: boolean) => {
      this.logger.debug(`[SessionManager] handleExit: session=${sessionId} currentState=${session.state} code=${code} signal=${signal} expected=${expected}`);
      this.logger.info(`[ProxyManager ${sessionId}] Exit: code=${code}, signal=${signal}, expected=${expected}`);
      if (session.state !== SessionState.STOPPED && session.state !== SessionState.ERROR) {
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

      // Clean up listeners since proxy is gone
      this.cleanupProxyEventHandlers(session, proxyManager);
      session.proxyManager = undefined;
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
      const entry: SessionOutputEntry | undefined = session.outputBuffer?.push(category, body.output);
      if (entry) {
        this.emit('output-captured', sessionId, entry);
      }
    };
    proxyManager.on('output', handleOutput);
    handlers.set('output', handleOutput);

    // Store handlers in WeakMap
    this.sessionEventHandlers.set(session, handlers);
    this.logger.debug(`[SessionManager] Attached ${handlers.size} event handlers for session ${sessionId}`);
  }

  protected cleanupProxyEventHandlers(session: ManagedSession, proxyManager: IProxyManager): void {
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
