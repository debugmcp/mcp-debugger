/**
 * Core session management functionality including lifecycle, state management,
 * and event handling.
 */
import { 
  SessionState, SessionLifecycleState, DebugLanguage, DebugSessionInfo, mapLegacyState
} from '@debugmcp/shared';
import { SessionStore, ManagedSession } from './session-store.js';
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
import { IDebugTargetLauncher } from '@debugmcp/shared';
import { IAdapterRegistry } from '@debugmcp/shared';

// Custom launch arguments interface extending DebugProtocol.LaunchRequestArguments
export interface CustomLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  stopOnEntry?: boolean;
  justMyCode?: boolean;
}

// Define DebugResult interface (previously imported from provider.js)
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
  debugTargetLauncher: IDebugTargetLauncher;
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
 * Core session management functionality
 */
export abstract class SessionManagerCore {
  protected sessionStore: SessionStore;
  protected logDirBase: string;
  protected logger: ILogger;
  protected fileSystem: IFileSystem;
  protected networkManager: INetworkManager;
  protected environment: IEnvironment;
  protected proxyManagerFactory: IProxyManagerFactory;
  protected sessionStoreFactory: ISessionStoreFactory;
  protected debugTargetLauncher: IDebugTargetLauncher;
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
    this.logger = dependencies.logger;
    this.fileSystem = dependencies.fileSystem;
    this.networkManager = dependencies.networkManager;
    this.environment = dependencies.environment;
    this.proxyManagerFactory = dependencies.proxyManagerFactory;
    this.sessionStoreFactory = dependencies.sessionStoreFactory;
    this.debugTargetLauncher = dependencies.debugTargetLauncher;
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

    // Named function for stopped event
    const handleStopped = (threadId: number, reason: string) => {
      this.logger.debug(`[SessionManager] 'stopped' event handler called for session ${sessionId}`);
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
      
      // Handle auto-continue for stopOnEntry=false
      if (!effectiveLaunchArgs.stopOnEntry && reason === 'entry') {
        this.logger.info(`[ProxyManager ${sessionId}] Auto-continuing (stopOnEntry=false)`);
        // Import the continue method from operations when needed
        this.handleAutoContinue().catch(err => {
          this.logger.error(`[ProxyManager ${sessionId}] Error auto-continuing:`, err);
        });
      } else {
        this._updateSessionState(session, SessionState.PAUSED);
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

    // Named function for terminated event
    const handleTerminated = () => {
      this.logger.debug(`[SessionManager] 'terminated' event handler called for session ${sessionId}`);
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
    };
    proxyManager.on('terminated', handleTerminated);
    handlers.set('terminated', handleTerminated);

    // Named function for exited event
    const handleExited = () => {
      this.logger.debug(`[SessionManager] 'exited' event handler called for session ${sessionId}`);
      this.logger.info(`[ProxyManager ${sessionId}] Exited event`);
      this._updateSessionState(session, SessionState.STOPPED);
      session.proxyManager = undefined;
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
      session.proxyManager = undefined;
    };
    proxyManager.on('error', handleError);
    handlers.set('error', handleError);

    // Named function for exit event
    const handleExit = (code: number | null, signal?: string) => {
      this.logger.debug(`[SessionManager] 'exit' event handler called for session ${sessionId}`);
      this.logger.info(`[ProxyManager ${sessionId}] Exit: code=${code}, signal=${signal}`);
      if (session.state !== SessionState.STOPPED && session.state !== SessionState.ERROR) {
        this._updateSessionState(session, SessionState.ERROR);
      }
      
      // Clean up listeners since proxy is gone
      this.cleanupProxyEventHandlers(session, proxyManager);
      session.proxyManager = undefined;
    };
    proxyManager.on('exit', handleExit);
    handlers.set('exit', handleExit);

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
  protected abstract handleAutoContinue(): Promise<void>;
}
