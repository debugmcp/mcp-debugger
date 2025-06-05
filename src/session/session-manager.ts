/**
 * Session manager for debug sessions, using ProxyManager for process management.
 * 
 * This class manages the lifecycle of debug sessions and delegates all child process
 * and DAP communication to ProxyManager instances. Each session has its own ProxyManager
 * that handles the debug proxy process.
 */
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger.js'; 
import { 
  Breakpoint, SessionState, Variable, StackFrame, DebugLanguage, DebugSessionInfo 
} from './models.js'; 
import { DebugResult } from '../debugger/provider.js';
import { SessionStore, ManagedSession } from './session-store.js';
import { DebugProtocol } from '@vscode/debugprotocol'; 
import path from 'path';
import os from 'os';
import { spawn as actualSpawn } from 'child_process';
import { fileURLToPath } from 'url';
import { LoggerOptions } from '../utils/logger.js'; 
import { 
  IFileSystem, 
  INetworkManager, 
  ILogger,
  IProxyManagerFactory
} from '../interfaces/external-dependencies.js';
import { ISessionStoreFactory } from '../factories/session-store-factory.js';
import { IProxyManager, ProxyConfig } from '../proxy/proxy-manager.js';
import { IDebugTargetLauncher } from '../interfaces/process-interfaces.js';

// Type for the spawn function
type SpawnFunctionType = typeof actualSpawn;

// Custom launch arguments interface extending DebugProtocol.LaunchRequestArguments
interface CustomLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  stopOnEntry?: boolean;
  justMyCode?: boolean;
  // Add other common custom arguments here if needed, e.g., console, cwd, env
}

// ManagedSession is now imported from session-store.ts

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
}

/**
 * Configuration for SessionManager
 */
export interface SessionManagerConfig {
  logDirBase?: string;
  defaultDapLaunchArgs?: Partial<CustomLaunchRequestArguments>;
}

export class SessionManager {
  private sessionStore: SessionStore;
  private logDirBase: string;
  private logger: ILogger;
  private fileSystem: IFileSystem;
  private networkManager: INetworkManager;
  private proxyManagerFactory: IProxyManagerFactory;
  private sessionStoreFactory: ISessionStoreFactory;
  private debugTargetLauncher: IDebugTargetLauncher;

  private defaultDapLaunchArgs: Partial<CustomLaunchRequestArguments>;

  /**
   * Modern constructor with full dependency injection
   */
  constructor(
    config: SessionManagerConfig,
    dependencies: SessionManagerDependencies
  );
  
  /**
   * @deprecated Use constructor with SessionManagerConfig and SessionManagerDependencies instead
   * This constructor will be removed in the next major version
   */
  constructor(
    loggerOptions: LoggerOptions,
    logDirBase?: string,
    spawnFnOverride?: SpawnFunctionType
  );
  
  // Implementation that handles both signatures
  constructor(
    configOrLoggerOptions: SessionManagerConfig | LoggerOptions = {},
    dependenciesOrLogDirBase?: SessionManagerDependencies | string,
    spawnFnOverride?: SpawnFunctionType
  ) {
    // Check if using new API
    if (dependenciesOrLogDirBase && typeof dependenciesOrLogDirBase === 'object' && 'fileSystem' in dependenciesOrLogDirBase) {
      // New API
      const config = configOrLoggerOptions as SessionManagerConfig;
      const dependencies = dependenciesOrLogDirBase as SessionManagerDependencies;
      
      this.logger = dependencies.logger;
      this.fileSystem = dependencies.fileSystem;
      this.networkManager = dependencies.networkManager;
      this.proxyManagerFactory = dependencies.proxyManagerFactory;
      this.sessionStoreFactory = dependencies.sessionStoreFactory;
      this.debugTargetLauncher = dependencies.debugTargetLauncher;
      
      this.sessionStore = this.sessionStoreFactory.create();
      this.logDirBase = config.logDirBase || path.join(os.tmpdir(), 'debug-mcp-server', 'sessions');
      this.defaultDapLaunchArgs = config.defaultDapLaunchArgs || {
        stopOnEntry: true,
        justMyCode: true
      };
    } else {
      // Old API - deprecated
      const loggerOptions = configOrLoggerOptions as LoggerOptions;
      const logDirBase = dependenciesOrLogDirBase as string | undefined;
      
      // Create dependencies inline (temporary backward compatibility)
      this.logger = createLogger('debug-mcp:session-manager', loggerOptions);
      
      // Lazy load implementation classes only when using deprecated constructor
      const { FileSystemImpl, ProcessManagerImpl, NetworkManagerImpl } = require('../implementations/index.js');
      const { ProcessLauncherImpl, ProxyProcessLauncherImpl, DebugTargetLauncherImpl } = require('../implementations/index.js');
      const { ProxyManager } = require('../proxy/proxy-manager.js');
      const { SessionStoreFactory } = require('../factories/session-store-factory.js');
      const { ProxyManagerFactory } = require('../factories/proxy-manager-factory.js');
      
      this.fileSystem = new FileSystemImpl();
      const processManager = new ProcessManagerImpl();
      this.networkManager = new NetworkManagerImpl();
      
      const processLauncher = new ProcessLauncherImpl(processManager);
      const proxyProcessLauncher = new ProxyProcessLauncherImpl(processLauncher);
      this.debugTargetLauncher = new DebugTargetLauncherImpl(processLauncher, this.networkManager);
      
      this.proxyManagerFactory = new ProxyManagerFactory(
        proxyProcessLauncher,
        this.fileSystem,
        this.logger
      );
      
      this.sessionStoreFactory = new SessionStoreFactory();
      this.sessionStore = this.sessionStoreFactory.create();
      
      this.logDirBase = logDirBase || path.join(os.tmpdir(), 'debug-mcp-server', 'sessions');
      this.defaultDapLaunchArgs = {
        stopOnEntry: true,
        justMyCode: true
      };
    }
    
    this.fileSystem.ensureDirSync(this.logDirBase);
    this.logger.info(`[SessionManager] Initialized. Session logs will be stored in: ${this.logDirBase}`);
  }

  async createSession(params: { language: DebugLanguage; name?: string; pythonPath?: string; }): Promise<DebugSessionInfo> {
    const sessionInfo = this.sessionStore.createSession(params);
    this.logger.info(`[SessionManager] Created new session: ${sessionInfo.name} (ID: ${sessionInfo.id}), state: ${sessionInfo.state}`);
    return sessionInfo;
  }

  private async startProxyManager(
    session: ManagedSession, 
    scriptPath: string, 
    scriptArgs?: string[], 
    dapLaunchArgs?: Partial<CustomLaunchRequestArguments>, 
    dryRunSpawn?: boolean
  ): Promise<void> {
    const sessionId = session.id;

    // Create session log directory
    const sessionLogDir = path.join(this.logDirBase, sessionId, `run-${Date.now()}`);
    this.logger.info(`[SessionManager] Ensuring session log directory: ${sessionLogDir}`);
    try {
      await this.fileSystem.ensureDir(sessionLogDir);
      const dirExists = await this.fileSystem.pathExists(sessionLogDir);
      if (!dirExists) {
        throw new Error(`Log directory ${sessionLogDir} could not be created`);
      }
    } catch (err: unknown) { 
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[SessionManager] Failed to create log directory:`, err);
      throw new Error(`Failed to create session log directory: ${message}`);
    }

    // Get free port for adapter
    const adapterPort = await this.findFreePort();

    // Resolve paths
    const projectRoot = path.resolve(fileURLToPath(import.meta.url), '../../../');
    
    const initialBreakpoints = Array.from(session.breakpoints.values()).map(bp => {
        const absoluteBpPath = path.isAbsolute(bp.file) ? bp.file : path.resolve(projectRoot, bp.file);
        return {
            file: absoluteBpPath, 
            line: bp.line, 
            condition: bp.condition
        };
    });
    
    const absoluteScriptPath = path.resolve(projectRoot, scriptPath);
    this.logger.info(`[SessionManager] Resolved script path: ${absoluteScriptPath}`);

    let resolvedPythonPath: string;
    const pythonPathFromSession = session.pythonPath!;
    if (path.isAbsolute(pythonPathFromSession)) {
      resolvedPythonPath = pythonPathFromSession;
    } else if (['python', 'python3', 'py'].includes(pythonPathFromSession.toLowerCase())) {
      resolvedPythonPath = pythonPathFromSession; 
    } else {
      resolvedPythonPath = path.resolve(projectRoot, pythonPathFromSession);
    }
    this.logger.info(`[SessionManager] Resolved python path: ${resolvedPythonPath}`);

    // Merge launch args
    const effectiveLaunchArgs = {
      ...this.defaultDapLaunchArgs,
      ...(dapLaunchArgs || {}),
    };

    // Create ProxyConfig
    const proxyConfig: ProxyConfig = {
      sessionId,
      pythonPath: resolvedPythonPath,
      adapterHost: '127.0.0.1',
      adapterPort,
      logDir: sessionLogDir,
      scriptPath: absoluteScriptPath,
      scriptArgs,
      stopOnEntry: effectiveLaunchArgs.stopOnEntry,
      justMyCode: effectiveLaunchArgs.justMyCode,
      initialBreakpoints,
      dryRunSpawn: dryRunSpawn === true
    };

    // Create and start ProxyManager
    const proxyManager = this.proxyManagerFactory.create();
    session.proxyManager = proxyManager;

    // Set up event handlers
    this.setupProxyEventHandlers(session, proxyManager, effectiveLaunchArgs);

    // Start the proxy
    await proxyManager.start(proxyConfig);
  }
  
  private setupProxyEventHandlers(
    session: ManagedSession, 
    proxyManager: IProxyManager,
    effectiveLaunchArgs: Partial<CustomLaunchRequestArguments>
  ): void {
    const sessionId = session.id;

    // Handle stopped events
    proxyManager.on('stopped', (threadId: number, reason: string) => {
      this.logger.info(`[ProxyManager ${sessionId}] Stopped event: thread=${threadId}, reason=${reason}`);
      
      // Handle auto-continue for stopOnEntry=false
      if (!effectiveLaunchArgs.stopOnEntry && reason === 'entry') {
        this.logger.info(`[ProxyManager ${sessionId}] Auto-continuing (stopOnEntry=false)`);
        this.continue(sessionId).catch(err => {
          this.logger.error(`[ProxyManager ${sessionId}] Error auto-continuing:`, err);
        });
      } else {
        this._updateSessionState(session, SessionState.PAUSED);
      }
    });

    // Handle continued events
    proxyManager.on('continued', () => {
      this.logger.info(`[ProxyManager ${sessionId}] Continued event`);
      this._updateSessionState(session, SessionState.RUNNING);
    });

    // Handle terminated/exited events
    proxyManager.on('terminated', () => {
      this.logger.info(`[ProxyManager ${sessionId}] Terminated event`);
      this._updateSessionState(session, SessionState.STOPPED);
      session.proxyManager = undefined;
    });

    proxyManager.on('exited', () => {
      this.logger.info(`[ProxyManager ${sessionId}] Exited event`);
      this._updateSessionState(session, SessionState.STOPPED);
      session.proxyManager = undefined;
    });

    // Handle adapter configured
    proxyManager.on('adapter-configured', () => {
      this.logger.info(`[ProxyManager ${sessionId}] Adapter configured`);
      if (!effectiveLaunchArgs.stopOnEntry) {
        this._updateSessionState(session, SessionState.RUNNING);
      }
    });

    // Handle dry run complete
    proxyManager.on('dry-run-complete', (command: string, script: string) => {
      this.logger.info(`[ProxyManager ${sessionId}] Dry run complete: ${command} ${script}`);
      this._updateSessionState(session, SessionState.STOPPED);
      session.proxyManager = undefined;
    });

    // Handle errors
    proxyManager.on('error', (error: Error) => {
      this.logger.error(`[ProxyManager ${sessionId}] Error:`, error);
      this._updateSessionState(session, SessionState.ERROR);
      session.proxyManager = undefined;
    });

    // Handle exit
    proxyManager.on('exit', (code: number | null, signal?: string) => {
      this.logger.info(`[ProxyManager ${sessionId}] Exit: code=${code}, signal=${signal}`);
      if (session.state !== SessionState.STOPPED && session.state !== SessionState.ERROR) {
        this._updateSessionState(session, SessionState.ERROR);
      }
      session.proxyManager = undefined;
    });
  }

  
  private async findFreePort(): Promise<number> {
    return this.networkManager.findFreePort();
  }

  private _getSessionById(sessionId: string): ManagedSession {
    return this.sessionStore.getOrThrow(sessionId);
  }

  private _updateSessionState(session: ManagedSession, newState: SessionState): void {
    if (session.state === newState) return;
    this.logger.info(`[SM _updateSessionState ${session.id}] State change: ${session.state} -> ${newState}`);
    this.sessionStore.updateState(session.id, newState);
  }


  async startDebugging(
    sessionId: string, 
    scriptPath: string, 
    scriptArgs?: string[], 
    dapLaunchArgs?: Partial<CustomLaunchRequestArguments>, 
    dryRunSpawn?: boolean
  ): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);
    this.logger.info(`Attempting to start debugging for session ${sessionId}, script: ${scriptPath}, dryRunSpawn: ${dryRunSpawn}, dapLaunchArgs:`, dapLaunchArgs);

    if (session.proxyManager) {
      this.logger.warn(`[SessionManager] Session ${sessionId} already has an active proxy. Terminating before starting new.`);
      await this.closeSession(sessionId); 
    }
    
    this._updateSessionState(session, SessionState.INITIALIZING); 
    try {
      // Start the proxy manager
      await this.startProxyManager(session, scriptPath, scriptArgs, dapLaunchArgs, dryRunSpawn);
      
      this.logger.info(`[SessionManager] ProxyManager started for session ${sessionId}`);
      
      // For dry run, wait for it to complete
      if (dryRunSpawn) {
        return new Promise((resolve) => {
          const handler = () => {
            this.logger.info(`[SessionManager] Dry run completed for session ${sessionId}`);
            resolve({ 
              success: true, 
              state: session.state, 
              data: { dryRun: true, message: "Dry run spawn command logged by proxy." } 
            });
          };
          session.proxyManager?.once('dry-run-complete', handler);
          
          // Timeout after 10 seconds
          setTimeout(() => {
            session.proxyManager?.removeListener('dry-run-complete', handler);
            resolve({ 
              success: false, 
              error: 'Dry run timeout', 
              state: session.state 
            });
          }, 10000);
        });
      }
      
      // Wait for adapter to be configured or first stop event
      const waitForReady = new Promise<void>((resolve) => {
        let resolved = false;
        
        const handleStopped = () => {
          if (!resolved) {
            resolved = true;
            this.logger.info(`[SessionManager] Session ${sessionId} stopped on entry`);
            resolve();
          }
        };
        
        const handleConfigured = () => {
          if (!resolved && !dapLaunchArgs?.stopOnEntry) {
            resolved = true;
            this.logger.info(`[SessionManager] Session ${sessionId} running (stopOnEntry=false)`);
            resolve();
          }
        };
        
        session.proxyManager?.once('stopped', handleStopped);
        session.proxyManager?.once('adapter-configured', handleConfigured);
        
        // Timeout after 30 seconds
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            session.proxyManager?.removeListener('stopped', handleStopped);
            session.proxyManager?.removeListener('adapter-configured', handleConfigured);
            resolve();
          }
        }, 30000);
      });
      
      await waitForReady;
      
      this.logger.info(`[SessionManager] Debugging started for session ${sessionId}. State: ${session.state}`);
      
      return { 
        success: true, 
        state: session.state, 
        data: { 
          message: `Debugging started for ${scriptPath}. Current state: ${session.state}`,
          reason: session.state === SessionState.PAUSED ? (dapLaunchArgs?.stopOnEntry ? 'entry' : 'breakpoint') : undefined,
          stopOnEntrySuccessful: dapLaunchArgs?.stopOnEntry && session.state === SessionState.PAUSED,
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack available';
      
      this.logger.error(`[SessionManager] Error during startDebugging for session ${sessionId}: ${errorMessage}. Stack: ${errorStack}`);
      
      this._updateSessionState(session, SessionState.ERROR);
      
      if (session.proxyManager) {
        await session.proxyManager.stop();
        session.proxyManager = undefined;
      }
      
      return { success: false, error: errorMessage, state: session.state };
    }
  }
  
  async setBreakpoint(sessionId: string, file: string, line: number, condition?: string): Promise<Breakpoint> {
    const session = this._getSessionById(sessionId);
    const bpId = uuidv4();

    // Resolve breakpoint file path to absolute
    const projectRoot = path.resolve(fileURLToPath(import.meta.url), '../../../'); 
    const absoluteFilePath = path.isAbsolute(file) ? path.normalize(file) : path.resolve(projectRoot, file);
    this.logger.info(`[SessionManager setBreakpoint] Resolved file path "${file}" to "${absoluteFilePath}" for session ${sessionId}`);

    const newBreakpoint: Breakpoint = { id: bpId, file: absoluteFilePath, line, condition, verified: false };

    if (!session.breakpoints) session.breakpoints = new Map();
    session.breakpoints.set(bpId, newBreakpoint);
    this.logger.info(`[SessionManager] Breakpoint ${bpId} queued for ${file}:${line} in session ${sessionId}.`);

    if (session.proxyManager && session.proxyManager.isRunning() && (session.state === SessionState.RUNNING || session.state === SessionState.PAUSED)) {
      try {
          this.logger.info(`[SessionManager] Active proxy for session ${sessionId}, sending breakpoint ${bpId}.`);
          const response = await session.proxyManager.sendDapRequest<DebugProtocol.SetBreakpointsResponse>('setBreakpoints', { 
              source: { path: newBreakpoint.file }, 
              breakpoints: [{ line: newBreakpoint.line, condition: newBreakpoint.condition }]
          });
          if (response && response.body && response.body.breakpoints && response.body.breakpoints.length > 0) {
              const bpInfo = response.body.breakpoints[0]; 
              newBreakpoint.verified = bpInfo.verified;
              newBreakpoint.line = bpInfo.line || newBreakpoint.line; 
              this.logger.info(`[SessionManager] Breakpoint ${bpId} sent and response received. Verified: ${newBreakpoint.verified}`);
          }
      } catch (error) {
          this.logger.error(`[SessionManager] Error sending setBreakpoint to proxy for session ${sessionId}:`, error);
      }
    }
    return newBreakpoint;
  }

  async stepOver(sessionId: string): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);
    const threadId = session.proxyManager?.getCurrentThreadId();
    this.logger.info(`[SM stepOver ${sessionId}] Entered. Current state: ${session.state}, ThreadID: ${threadId}`);
    
    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      return { success: false, error: 'No active debug run', state: session.state };
    }
    if (session.state !== SessionState.PAUSED) {
      this.logger.warn(`[SM stepOver ${sessionId}] Not paused. State: ${session.state}`);
      return { success: false, error: 'Not paused', state: session.state };
    }
    if (!threadId) {
      this.logger.warn(`[SM stepOver ${sessionId}] No current thread ID.`);
      return { success: false, error: 'No current thread ID', state: session.state };
    }
    
    this.logger.info(`[SM stepOver ${sessionId}] Sending DAP 'next' for threadId ${threadId}`);
    
    try {
      // Send step request
      await session.proxyManager.sendDapRequest('next', { threadId });
      
      // Update state to running
      this._updateSessionState(session, SessionState.RUNNING);
      
      // Wait for stopped event
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.logger.warn(`[SM stepOver ${sessionId}] Timeout waiting for stopped event`);
          resolve({ success: false, error: 'Step timeout', state: session.state });
        }, 5000);
        
        session.proxyManager?.once('stopped', () => {
          clearTimeout(timeout);
          this.logger.info(`[SM stepOver ${sessionId}] Step completed. Current state: ${session.state}`);
          resolve({ success: true, state: session.state, data: { message: "Step over completed." } });
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[SM stepOver ${sessionId}] Error during step:`, error);
      this._updateSessionState(session, SessionState.ERROR);
      return { success: false, error: errorMessage, state: session.state };
    }
  }

  async stepInto(sessionId: string): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);
    const threadId = session.proxyManager?.getCurrentThreadId();
    this.logger.info(`[SM stepInto ${sessionId}] Entered. Current state: ${session.state}, ThreadID: ${threadId}`);
    
    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      return { success: false, error: 'No active debug run', state: session.state };
    }
    if (session.state !== SessionState.PAUSED) {
      this.logger.warn(`[SM stepInto ${sessionId}] Not paused. State: ${session.state}`);
      return { success: false, error: 'Not paused', state: session.state };
    }
    if (!threadId) {
      this.logger.warn(`[SM stepInto ${sessionId}] No current thread ID.`);
      return { success: false, error: 'No current thread ID', state: session.state };
    }
    
    this.logger.info(`[SM stepInto ${sessionId}] Sending DAP 'stepIn' for threadId ${threadId}`);
    
    try {
      // Send step request
      await session.proxyManager.sendDapRequest('stepIn', { threadId });
      
      // Update state to running
      this._updateSessionState(session, SessionState.RUNNING);
      
      // Wait for stopped event
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.logger.warn(`[SM stepInto ${sessionId}] Timeout waiting for stopped event`);
          resolve({ success: false, error: 'Step timeout', state: session.state });
        }, 5000);
        
        session.proxyManager?.once('stopped', () => {
          clearTimeout(timeout);
          this.logger.info(`[SM stepInto ${sessionId}] Step completed. Current state: ${session.state}`);
          resolve({ success: true, state: session.state, data: { message: "Step into completed." } });
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[SM stepInto ${sessionId}] Error during step:`, error);
      this._updateSessionState(session, SessionState.ERROR);
      return { success: false, error: errorMessage, state: session.state };
    }
  }

  async stepOut(sessionId: string): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);
    const threadId = session.proxyManager?.getCurrentThreadId();
    this.logger.info(`[SM stepOut ${sessionId}] Entered. Current state: ${session.state}, ThreadID: ${threadId}`);
    
    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      return { success: false, error: 'No active debug run', state: session.state };
    }
    if (session.state !== SessionState.PAUSED) {
      this.logger.warn(`[SM stepOut ${sessionId}] Not paused. State: ${session.state}`);
      return { success: false, error: 'Not paused', state: session.state };
    }
    if (!threadId) {
      this.logger.warn(`[SM stepOut ${sessionId}] No current thread ID.`);
      return { success: false, error: 'No current thread ID', state: session.state };
    }
    
    this.logger.info(`[SM stepOut ${sessionId}] Sending DAP 'stepOut' for threadId ${threadId}`);
    
    try {
      // Send step request
      await session.proxyManager.sendDapRequest('stepOut', { threadId });
      
      // Update state to running
      this._updateSessionState(session, SessionState.RUNNING);
      
      // Wait for stopped event
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.logger.warn(`[SM stepOut ${sessionId}] Timeout waiting for stopped event`);
          resolve({ success: false, error: 'Step timeout', state: session.state });
        }, 5000);
        
        session.proxyManager?.once('stopped', () => {
          clearTimeout(timeout);
          this.logger.info(`[SM stepOut ${sessionId}] Step completed. Current state: ${session.state}`);
          resolve({ success: true, state: session.state, data: { message: "Step out completed." } });
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[SM stepOut ${sessionId}] Error during step:`, error);
      this._updateSessionState(session, SessionState.ERROR);
      return { success: false, error: errorMessage, state: session.state };
    }
  }

  async continue(sessionId: string): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);
    const threadId = session.proxyManager?.getCurrentThreadId();
    this.logger.info(`[SessionManager continue] Called for session ${sessionId}. Current state: ${session.state}, ThreadID: ${threadId}`);
    
    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      this.logger.warn(`[SessionManager continue] No active debug run for session ${sessionId}.`);
      return { success: false, error: 'No active debug run', state: session.state };
    }
    if (session.state !== SessionState.PAUSED) {
      this.logger.warn(`[SessionManager continue] Session ${sessionId} not paused. State: ${session.state}.`);
      return { success: false, error: 'Not paused', state: session.state };
    }
    if (!threadId) {
      this.logger.warn(`[SessionManager continue] No current thread ID for session ${sessionId}.`);
      return { success: false, error: 'No current thread ID', state: session.state };
    }
    
    try {
      this.logger.info(`[SessionManager continue] Sending DAP 'continue' for session ${sessionId}, threadId ${threadId}.`);
      await session.proxyManager.sendDapRequest('continue', { threadId });
      this._updateSessionState(session, SessionState.RUNNING);
      this.logger.info(`[SessionManager continue] DAP 'continue' sent, session ${sessionId} state updated to RUNNING.`);
      return { success: true, state: session.state };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[SessionManager continue] Error sending 'continue' to proxy for session ${sessionId}: ${errorMessage}`);
      throw error; 
    }
  }
  
  async getVariables(sessionId: string, variablesReference: number): Promise<Variable[]> {
    const session = this._getSessionById(sessionId);
    this.logger.info(`[SM getVariables ${sessionId}] Entered. variablesReference: ${variablesReference}, Current state: ${session.state}`);
    
    if (!session.proxyManager || !session.proxyManager.isRunning()) { 
      this.logger.warn(`[SM getVariables ${sessionId}] No active proxy.`); 
      return []; 
    }
    if (session.state !== SessionState.PAUSED) { 
      this.logger.warn(`[SM getVariables ${sessionId}] Session not paused. State: ${session.state}.`); 
      return []; 
    }
    
    try {
      this.logger.info(`[SM getVariables ${sessionId}] Sending DAP 'variables' for variablesReference ${variablesReference}.`);
      const response = await session.proxyManager.sendDapRequest<DebugProtocol.VariablesResponse>('variables', { variablesReference });
      this.logger.info(`[SM getVariables ${sessionId}] DAP 'variables' response received. Body:`, response?.body);

      if (response && response.body && response.body.variables) {
        const vars = response.body.variables.map((v: DebugProtocol.Variable) => ({ 
            name: v.name, value: v.value, type: v.type || "<unknown_type>", 
            variablesReference: v.variablesReference,
            expandable: v.variablesReference > 0 
        }));
        this.logger.info(`[SM getVariables ${sessionId}] Parsed variables:`, vars.map(v => ({name: v.name, value: v.value, type: v.type}))); 
        return vars;
      }
      this.logger.warn(`[SM getVariables ${sessionId}] No variables in response body for reference ${variablesReference}. Response:`, response);
      return [];
    } catch (error) {
      this.logger.error(`[SM getVariables ${sessionId}] Error getting variables:`, error);
      return [];
    }
  }

  async getStackTrace(sessionId: string, threadId?: number): Promise<StackFrame[]> {
    const session = this._getSessionById(sessionId);
    const currentThreadId = session.proxyManager?.getCurrentThreadId();
    this.logger.info(`[SM getStackTrace ${sessionId}] Entered. Requested threadId: ${threadId}, Current state: ${session.state}, Actual currentThreadId: ${currentThreadId}`);
    
    if (!session.proxyManager || !session.proxyManager.isRunning()) { 
      this.logger.warn(`[SM getStackTrace ${sessionId}] No active proxy.`); 
      return []; 
    }
    if (session.state !== SessionState.PAUSED) { 
      this.logger.warn(`[SM getStackTrace ${sessionId}] Session not paused. State: ${session.state}.`); 
      return []; 
    }
    
    const currentThreadForRequest = threadId || currentThreadId;
    if (!currentThreadForRequest) { 
      this.logger.warn(`[SM getStackTrace ${sessionId}] No effective thread ID to use.`); 
      return []; 
    }

    try {
      this.logger.info(`[SM getStackTrace ${sessionId}] Sending DAP 'stackTrace' for threadId ${currentThreadForRequest}.`);
      const response = await session.proxyManager.sendDapRequest<DebugProtocol.StackTraceResponse>('stackTrace', { threadId: currentThreadForRequest });
      this.logger.info(`[SM getStackTrace ${sessionId}] DAP 'stackTrace' response received. Body:`, response?.body);
      
      if (response && response.body && response.body.stackFrames) {
        const frames = response.body.stackFrames.map((sf: DebugProtocol.StackFrame) => ({ 
            id: sf.id, name: sf.name, 
            file: sf.source?.path || sf.source?.name || "<unknown_source>", 
            line: sf.line, column: sf.column
        }));
        this.logger.info(`[SM getStackTrace ${sessionId}] Parsed stack frames (top 3):`, frames.slice(0,3).map(f => ({name:f.name, file:f.file, line:f.line})));
        return frames;
      }
      this.logger.warn(`[SM getStackTrace ${sessionId}] No stackFrames in response body. Response:`, response);
      return [];
    } catch (error) {
      this.logger.error(`[SM getStackTrace ${sessionId}] Error getting stack trace:`, error);
      return [];
    }
  }

  async getScopes(sessionId: string, frameId: number): Promise<DebugProtocol.Scope[]> {
    const session = this._getSessionById(sessionId);
    this.logger.info(`[SM getScopes ${sessionId}] Entered. frameId: ${frameId}, Current state: ${session.state}`);
    
    if (!session.proxyManager || !session.proxyManager.isRunning()) { 
      this.logger.warn(`[SM getScopes ${sessionId}] No active proxy.`); 
      return []; 
    }
    if (session.state !== SessionState.PAUSED) { 
      this.logger.warn(`[SM getScopes ${sessionId}] Session not paused. State: ${session.state}.`); 
      return []; 
    }
    
    try {
      this.logger.info(`[SM getScopes ${sessionId}] Sending DAP 'scopes' for frameId ${frameId}.`);
      const response = await session.proxyManager.sendDapRequest<DebugProtocol.ScopesResponse>('scopes', { frameId });
      this.logger.info(`[SM getScopes ${sessionId}] DAP 'scopes' response received. Body:`, response?.body);
      
      if (response && response.body && response.body.scopes) {
        this.logger.info(`[SM getScopes ${sessionId}] Parsed scopes:`, response.body.scopes.map(s => ({name: s.name, ref: s.variablesReference, expensive: s.expensive })));
        return response.body.scopes;
      }
      this.logger.warn(`[GetScopes] No scopes in response body for session ${sessionId}, frameId ${frameId}. Response:`, response);
      return [];
    } catch (error) {
      this.logger.error(`[SM getScopes ${sessionId}] Error getting scopes:`, error);
      return [];
    }
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
      try {
        await session.proxyManager.stop();
        session.proxyManager = undefined;
      } catch (error: unknown) { 
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[SessionManager] Error stopping proxy for session ${sessionId}:`, message);
      }
    }
    
    this._updateSessionState(session, SessionState.STOPPED);
    this.logger.info(`Session ${sessionId} marked as STOPPED.`);
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
}
