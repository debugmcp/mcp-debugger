/**
 * Session manager for debug sessions, using a proxy-worker architecture.
 */
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger.js'; 
import { 
  Breakpoint, DebugSession, SessionState, Variable, StackFrame, DebugLanguage, DebugSessionInfo 
} from './models.js'; 
import { DebugResult } from '../debugger/provider.js'; 
import { DebugProtocol } from '@vscode/debugprotocol'; 
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { spawn as actualSpawn, ChildProcess } from 'child_process'; // Renamed spawn to actualSpawn
import net from 'net'; 
import { fileURLToPath } from 'url';
import { LoggerOptions } from '../utils/logger.js'; 
import { inspect } from 'util'; // Use ESM import for inspect

// Type for the spawn function
type SpawnFunctionType = typeof actualSpawn;

// Custom launch arguments interface extending DebugProtocol.LaunchRequestArguments
interface CustomLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  stopOnEntry?: boolean;
  justMyCode?: boolean;
  // Add other common custom arguments here if needed, e.g., console, cwd, env
}

type ProxyStatusMessage = 
  | { type: 'status'; sessionId: string; status: 'proxy_minimal_ran_ipc_test'; message?: string }
  | { type: 'status'; sessionId: string; status: 'dry_run_complete'; command: string; script: string; data?: unknown }
  | { type: 'status'; sessionId: string; status: 'adapter_configured_and_launched'; data?: unknown }
  | { type: 'status'; sessionId: string; status: 'adapter_exited' | 'dap_connection_closed' | 'terminated'; code?: number | null; signal?: NodeJS.Signals | null; data?: unknown };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProxyDapEventMessage = { type: 'dapEvent'; sessionId: string; event: string; body?: any; data?: unknown };

type ProxyDapResponseMessage = { 
  type: 'dapResponse'; 
  sessionId: string; 
  requestId: string; 
  success: boolean; 
  response?: DebugProtocol.Response; 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any; 
  error?: string;
  data?: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProxyErrorMessage = { type: 'error'; sessionId: string; message: string; data?: any };

type ProxyMessage = ProxyStatusMessage | ProxyDapEventMessage | ProxyDapResponseMessage | ProxyErrorMessage;

interface ActiveDebugRun { 
  proxyWorker: ChildProcess;
  adapterPort: number; 
  pendingDapRequests: Map<string, { resolve: (response: DebugProtocol.Response) => void, reject: (error: Error) => void, dapCommand: string }>;
  currentThreadId?: number | null;
  debugStartedPromise: Promise<void>; 
  resolveDebugStarted: () => void;
  rejectDebugStarted: (reason?: unknown) => void; 
  dryRunSuccessfullyCompleted?: boolean;
  isDryRun: boolean;
  adapterConfiguredAndLaunched: boolean; 
  stepCompletionNotifier?: { resolve: () => void; reject: (error: Error) => void; threadId: number };
  effectiveLaunchArgs: Partial<CustomLaunchRequestArguments>; // Use CustomLaunchRequestArguments
}

interface ManagedSession extends DebugSession { 
  pythonPath?: string; 
  currentRun: ActiveDebugRun | null; 
}

export class SessionManager {
  private sessions: Map<string, ManagedSession> = new Map();
  private logDirBase: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private logger: any; 
  private spawnFn: SpawnFunctionType; // Added spawnFn property

  private defaultDapLaunchArgs: Partial<CustomLaunchRequestArguments> = { // Use CustomLaunchRequestArguments
    stopOnEntry: true,
    justMyCode: true,
  };

  constructor(loggerOptions: LoggerOptions = {}, logDirBase?: string, spawnFnOverride?: SpawnFunctionType) {
    this.logger = createLogger('debug-mcp:session-manager', loggerOptions);
    this.logDirBase = logDirBase || path.join(os.tmpdir(), 'debug-mcp-server', 'sessions');
    this.spawnFn = spawnFnOverride || actualSpawn; // Initialize spawnFn
    fs.ensureDirSync(this.logDirBase);
    this.logger.info(`[SessionManager] Initialized. Session logs will be stored in: ${this.logDirBase}`);
  }

  async createSession(params: { language: DebugLanguage; name?: string; pythonPath?: string; }): Promise<DebugSessionInfo> {
    const { language, name, pythonPath: explicitPythonPath } = params;
    const sessionId = uuidv4();
    const sessionName = name || `session-${sessionId.substring(0, 8)}`;
    
    if (language !== DebugLanguage.PYTHON) { 
        throw new Error(`Language '${language}' is not supported. Only '${DebugLanguage.PYTHON}' is currently implemented.`);
    }
    
    const session: ManagedSession = {
      id: sessionId, name: sessionName, language: language, 
      state: SessionState.CREATED, 
      createdAt: new Date(), updatedAt: new Date(), 
      breakpoints: new Map<string, Breakpoint>(), 
      pythonPath: explicitPythonPath || process.env.PYTHON_PATH || 'python',
      currentRun: null, 
    };
    this.sessions.set(sessionId, session);
    this.logger.info(`[SessionManager] Created new session: ${sessionName} (ID: ${sessionId}), state: ${session.state}`);
    return { id: sessionId, name: sessionName, language: session.language, state: session.state, createdAt: session.createdAt, updatedAt: session.updatedAt };
  }

  private async setupNewRun(
    session: ManagedSession, 
    scriptPath: string, 
    scriptArgs?: string[], 
    dapLaunchArgs?: Partial<CustomLaunchRequestArguments>, 
    dryRunSpawn?: boolean
  ): Promise<ActiveDebugRun> {
    const sessionId = session.id;

    const sessionLogDir = path.join(this.logDirBase, sessionId, `run-${Date.now()}`);
    this.logger.info(`[SessionManager] Attempting to ensure session log directory exists: ${sessionLogDir}`);
    try {
      await fs.ensureDir(sessionLogDir);
      this.logger.info(`[SessionManager] Successfully ensured session log directory: ${sessionLogDir}`);
      const dirExists = await fs.pathExists(sessionLogDir);
      this.logger.info(`[SessionManager] Verification check - pathExists(${sessionLogDir}): ${dirExists}`);
      if (!dirExists) {
        const criticalErrorMsg = `[SessionManager CRITICAL] fs.ensureDir for ${sessionLogDir} seemed to succeed, but fs.pathExists returned false. Log directory is not available.`;
        this.logger.error(criticalErrorMsg);
        throw new Error(criticalErrorMsg);
      }
    } catch (err: unknown) { 
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[SessionManager CRITICAL] Failed to ensure session log directory ${sessionLogDir}:`, err);
      throw new Error(`Failed to create session log directory: ${message}`);
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.logger.info(`[SessionManager setupNewRun] __filename: ${__filename}, __dirname: ${__dirname}`);
    
    // Simplified path logic for proxy bootstrap script, more robust for tests
    let proxyWorkerPath = path.resolve(__dirname, '../proxy/proxy-bootstrap.js'); // Prefer .js for src/dev
    this.logger.info(`[SessionManager setupNewRun] Initial proxyWorkerPath attempt: ${proxyWorkerPath}`);

    if (!await fs.pathExists(proxyWorkerPath)) {
      this.logger.info(`[SessionManager setupNewRun] First pathExists failed for ${proxyWorkerPath}. Trying .cjs fallback.`);
      // Fallback to .cjs if .js is not found (e.g. when running from dist)
      proxyWorkerPath = path.resolve(__dirname, '../proxy/proxy-bootstrap.cjs');
      this.logger.info(`[SessionManager setupNewRun] Fallback proxyWorkerPath attempt: ${proxyWorkerPath}`);
      if (!await fs.pathExists(proxyWorkerPath)) {
        this.logger.error(`[SessionManager] Bootstrap worker script not found. Tried:`);
        this.logger.error(`  - ${path.resolve(__dirname, '../proxy/proxy-bootstrap.js')}`);
        this.logger.error(`  - ${path.resolve(__dirname, '../proxy/proxy-bootstrap.cjs')}`);
        this.logger.error(`[SessionManager] Current __dirname for SessionManager: ${__dirname}`);
        throw new Error(`Bootstrap worker script not found. Ensure src/proxy/proxy-bootstrap.js or dist/proxy/proxy-bootstrap.cjs exists.`);
      }
    }
    this.logger.info(`[SessionManager] Using proxy bootstrap worker at: ${proxyWorkerPath}`);

    const adapterPort = await this.findFreePort();
    const stdioConfig: Array<'pipe' | 'ipc'> = [ 'pipe', 'pipe', 'pipe', 'ipc' ]; 
    const diagnosticFlags = ['--trace-uncaught', '--trace-exit'];
    const spawnArgs = [...diagnosticFlags, proxyWorkerPath];
    
    const projectRootForEnv = path.resolve(fileURLToPath(import.meta.url), '../../../');
    const modifiedEnv = { ...process.env, MCP_SERVER_CWD: projectRootForEnv };
    const spawnOptions = { stdio: stdioConfig, cwd: process.cwd(), env: modifiedEnv, detached: false };

    this.logger.info(`[SessionManager PRE-SPAWN] About to spawn proxy for session ${sessionId}. Path: ${proxyWorkerPath}, Args: ${spawnArgs.join(' ')}`);
    let proxyWorker: ChildProcess;
    try {
      proxyWorker = this.spawnFn(process.execPath, spawnArgs, spawnOptions); // Use this.spawnFn
    } catch (spawnError) {
      this.logger.error(`[SessionManager SPAWN_FN_ERROR] this.spawnFn threw an error directly for session ${sessionId}:`, spawnError);
      throw spawnError; // Re-throw the original error to be caught by startDebugging
    }

    if (!proxyWorker || typeof proxyWorker.pid === 'undefined') {
      this.logger.error(`[SessionManager CRITICAL_SPAWN_INVALID_RETURN] this.spawnFn returned invalid object or PID is undefined for session ${sessionId}.`);
      // This case handles if spawnFn returns null/undefined or a malformed object without throwing.
      throw new Error('Proxy worker process object is invalid or PID is missing after spawn.');
    }
    this.logger.info(`[SessionManager POST-SPAWN] Proxy worker object created for session ${sessionId}. PID: ${proxyWorker.pid}.`);
    
    let resolveDebugStartedFn: () => void = () => {};
    let rejectDebugStartedFn: (reason?: unknown) => void = () => {};
    const debugStartedPromise = new Promise<void>((resolve, reject) => {
        resolveDebugStartedFn = resolve;
        rejectDebugStartedFn = reject;
    });

    const effectiveLaunchArgs = {
      ...this.defaultDapLaunchArgs,
      ...(dapLaunchArgs || {}),
    };

    const activeRun: ActiveDebugRun = {
      proxyWorker, adapterPort,
      pendingDapRequests: new Map(),
      debugStartedPromise, 
      resolveDebugStarted: resolveDebugStartedFn,
      rejectDebugStarted: rejectDebugStartedFn,
      isDryRun: dryRunSpawn === true,
      adapterConfiguredAndLaunched: false,
      effectiveLaunchArgs 
    };
    session.currentRun = activeRun; 

    this.setupRunListeners(session, activeRun);

    const projectRoot = path.resolve(fileURLToPath(import.meta.url), '../../../'); 
    this.logger.info(`[SessionManager] Project root determined as: ${projectRoot}`);

    const initialBreakpoints = Array.from(session.breakpoints.values()).map(bp => {
        const absoluteBpPath = path.isAbsolute(bp.file) ? bp.file : path.resolve(projectRoot, bp.file);
        this.logger.info(`[SessionManager] Resolving initial breakpoint path "${bp.file}" to "${absoluteBpPath}"`);
        return {
            file: absoluteBpPath, 
            line: bp.line, 
            condition: bp.condition
        };
    });
    
    const absoluteScriptPath = path.resolve(projectRoot, scriptPath);
    this.logger.info(`[SessionManager] Resolved scriptPath "${scriptPath}" to absolute: ${absoluteScriptPath}`);

    let resolvedPythonPath: string;
    const pythonPathFromSession = session.pythonPath!;
    if (path.isAbsolute(pythonPathFromSession)) {
      resolvedPythonPath = pythonPathFromSession;
    } else if (['python', 'python3', 'py'].includes(pythonPathFromSession.toLowerCase())) {
      resolvedPythonPath = pythonPathFromSession; 
    } else {
      resolvedPythonPath = path.resolve(projectRoot, pythonPathFromSession);
    }
    this.logger.info(`[SessionManager] Resolved pythonPath "${pythonPathFromSession}" to: ${resolvedPythonPath}`);

    this.sendToProxy(activeRun, {
      cmd: 'init', sessionId, 
      pythonPath: resolvedPythonPath, 
      adapterHost: '127.0.0.1', adapterPort, 
      logDir: sessionLogDir, 
      scriptPath: absoluteScriptPath, 
      scriptArgs, 
      stopOnEntry: activeRun.effectiveLaunchArgs.stopOnEntry, 
      justMyCode: activeRun.effectiveLaunchArgs.justMyCode,  
      initialBreakpoints,
      dryRunSpawn: dryRunSpawn === true 
    });
    return activeRun;
  }
  
  private setupRunListeners(session: ManagedSession, run: ActiveDebugRun): void {
    const { proxyWorker } = run; 
    const sessionId = session.id; 
    
    if (!proxyWorker) return;

    const handleProxyMessage = (rawMessage: unknown) => { 
      this.logger.debug(`[Proxy Message for Session ${sessionId}] Received raw:`, rawMessage);
      
      if (typeof rawMessage !== 'object' || rawMessage === null) {
        this.logger.warn(`[Proxy Message] Received non-object message for session ${sessionId}:`, rawMessage);
        return;
      }
      const message = rawMessage as ProxyMessage; 

      if (!message.sessionId || !message.type) {
        this.logger.warn(`[Proxy Message] Received malformed message (missing sessionId or type) for session ${sessionId}:`, message);
        return;
      }

      if (message.sessionId !== sessionId) { 
          this.logger.warn(`[Proxy Message] Mismatched sessionId. Expected ${sessionId}, got ${message.sessionId}. Ignoring.`);
          return;
      }

      if (message.type === 'dapResponse') {
        const promiseCallbacks = run.pendingDapRequests.get(message.requestId);
        if (promiseCallbacks) {
          this.logger.info(`[SM dapResponse ${sessionId}] Received DAP response for command: ${promiseCallbacks.dapCommand}, requestId: ${message.requestId}, success: ${message.success}, error: ${message.error || 'null'}`);
          if (message.success) promiseCallbacks.resolve(message.response || message.body);
          else promiseCallbacks.reject(new Error(message.error || `DAP request '${promiseCallbacks.dapCommand}' failed in proxy`));
          run.pendingDapRequests.delete(message.requestId);
        } else {
          this.logger.warn(`[SM dapResponse ${sessionId}] Received DAP response for unknown requestId: ${message.requestId}`);
        }
      } 
      else if (message.type === 'status' && message.status === 'proxy_minimal_ran_ipc_test') {
        this.logger.info(`[SessionManager IPC TEST] Received proxy_minimal_ran_ipc_test from proxy for session ${sessionId}: ${message.message || ''}`);
        this.logger.warn(`[SessionManager IPC TEST] Received proxy_minimal_ran_ipc_test. This is for a specific IPC test, not normal operation.`);
        proxyWorker.kill(); 
      } else if (message.type === 'status' && message.status === 'dry_run_complete') { 
        this.logger.info(`[SessionManager] Proxy confirmed dry_run_complete for session ${sessionId}. Command: ${message.command}, Script: ${message.script}`);
        run.dryRunSuccessfullyCompleted = true;
        run.resolveDebugStarted(); 
      } else if (message.type === 'status' && message.status === 'adapter_configured_and_launched') {
        this.logger.info(`[SessionManager] Proxy confirmed adapter configured and launched for session ${sessionId}.`);
        run.adapterConfiguredAndLaunched = true;
        if (run.isDryRun) {
            this.logger.error(`[SessionManager] Received 'adapter_configured_and_launched' during a dry run for session ${sessionId}. This indicates a proxy logic error.`);
            run.rejectDebugStarted(new Error("Proxy error: adapter launched during dry run."));
        }
        // If stopOnEntry is false, the adapter is configured and the script is running.
        // The debugStartedPromise should resolve here to indicate successful launch.
        // The session state should be RUNNING.
        if (!run.effectiveLaunchArgs.stopOnEntry) {
            this.logger.info(`[SessionManager] stopOnEntry is false for session ${sessionId}. Script is now running. Resolving debugStartedPromise.`);
            this._updateSessionState(session, SessionState.RUNNING); 
            run.resolveDebugStarted();
        }
      } else if (message.type === 'dapEvent') {
        this.logger.info(`[SM dapEvent ${sessionId}] Received DAP event: ${message.event}, body:`, message.body || {});
        if (message.event === 'stopped') {
          const stoppedReason = message.body?.reason;
          const stoppedThreadId = message.body?.threadId;
          
          run.currentThreadId = stoppedThreadId || run.currentThreadId; 
          if (!run.currentThreadId) {
            this.logger.warn(`[SM dapEvent ${sessionId}] 'stopped' event for session ${sessionId} did not provide a threadId.`);
          } else {
            this.logger.info(`[SM dapEvent ${sessionId}] 'stopped' event updated currentThreadId to: ${run.currentThreadId}`);
          }

          // If stopOnEntry was false and this is an 'entry' stop, auto-continue.
          if (!run.effectiveLaunchArgs.stopOnEntry && stoppedReason === 'entry') {
              this.logger.info(`[SM dapEvent ${sessionId}] stopOnEntry is false but received 'stopped (entry)'. Auto-continuing.`);
              this.continue(sessionId).catch(err => {
                  this.logger.error(`[SM dapEvent ${sessionId}] Error auto-continuing after 'stopped (entry)' with stopOnEntry=false:`, err);
              });
              // State remains RUNNING (or becomes RUNNING due to continue), do not set to PAUSED here.
              // debugStartedPromise was already resolved on 'adapter_configured_and_launched'.
          } else {
              // This is a "real" stop (breakpoint, step, exception, etc.), or stopOnEntry was true.
              this._updateSessionState(session, SessionState.PAUSED);

              if (run.stepCompletionNotifier && run.stepCompletionNotifier.threadId === stoppedThreadId) {
                  this.logger.info(`[SM dapEvent ${sessionId}] 'stopped' event matches pending step for thread ${stoppedThreadId}. Resolving stepCompletionNotifier.`);
                  run.stepCompletionNotifier.resolve();
              }
              
              // If adapter was configured, not a step, and debugStartedPromise is still pending (e.g. stopOnEntry was true)
              if (run.adapterConfiguredAndLaunched && !run.stepCompletionNotifier) { 
                  const promiseState = inspect(run.debugStartedPromise).includes('pending'); 
                  if (promiseState) { // Only resolve if still pending (i.e. stopOnEntry was true)
                       this.logger.info(`[SM dapEvent ${sessionId}] 'stopped' event (reason: ${stoppedReason}). Resolving debugStartedPromise.`);
                       run.resolveDebugStarted();
                  }
              }
          }
        } else if (message.event === 'continued') {
          this._updateSessionState(session, SessionState.RUNNING);
        } else if (message.event === 'terminated' || message.event === 'exited') {
          this._updateSessionState(session, SessionState.STOPPED);
          run.proxyWorker?.kill(); 
          session.currentRun = null; 
        }
      } else if (message.type === 'status' && (message.status === 'adapter_exited' || message.status === 'dap_connection_closed' || message.status === 'terminated')) {
        this.logger.info(`[Proxy Status for Session ${sessionId}] Proxy reported: ${message.status}`);
        run.rejectDebugStarted(new Error(`Proxy reported ${message.status} during startup.`));
        this._updateSessionState(session, SessionState.STOPPED); 
        session.currentRun = null;
      } else if (message.type === 'error') {
        this.logger.error(`[Proxy Error for Session ${sessionId}] ${message.message}`);
        run.rejectDebugStarted(new Error(`Proxy error: ${message.message}`));
        this._updateSessionState(session, SessionState.ERROR);
        session.currentRun = null;
      }
    };
    
    proxyWorker.on('message', (message: any) => {
      this.logger.info(`[Proxy ${sessionId}: IPC] ${typeof message === 'string' ? message : JSON.stringify(message)}`);
      handleProxyMessage(message); 
    });

    proxyWorker.stderr?.on('data', (data: Buffer | string) => {
      this.logger.error(`[Proxy ${sessionId}: STDERR] ${data.toString().trim()}`);
    });

    proxyWorker.on('exit', async (code: number | null, signal: NodeJS.Signals | null) => {
      this.logger.info(`[Proxy ${sessionId}: EXIT] DAP Proxy worker exited. Code: ${code}, Signal: ${signal}`);
      
      if (run.isDryRun) {
        await new Promise(resolve => setTimeout(resolve, 150)); 
        if (!run.dryRunSuccessfullyCompleted) {
          this.logger.warn(`[Proxy ${sessionId}: EXIT] Dry run exit, but 'dry_run_complete' was not confirmed.`);
          try {
            run.rejectDebugStarted(new Error(`Proxy worker exited during dry run before 'dry_run_complete' confirmation was processed. Code: ${code}, Signal: ${signal}`));
          } catch { /* Promise already settled */ }
          if (session.state !== SessionState.STOPPED && session.state !== SessionState.ERROR) {
            this._updateSessionState(session, SessionState.ERROR);
          }
        } else {
          this.logger.info(`[Proxy ${sessionId}: EXIT] Dry run completed successfully, proxy exited as expected.`);
        }
      } else {
        try {
          run.rejectDebugStarted(new Error(`Proxy worker exited unexpectedly (not a dry run). Code: ${code}, Signal: ${signal}`));
        } catch { 
          this.logger.debug(`[Proxy ${sessionId}: EXIT] debugStartedPromise already settled, but non-dry-run proxy exited. Code: ${code}, Signal: ${signal}`);
        }
        if (session.state !== SessionState.STOPPED && session.state !== SessionState.ERROR) {
          this._updateSessionState(session, SessionState.ERROR);
        }
      }

      run.pendingDapRequests.forEach(p => p.reject(new Error('Proxy worker exited.')));
      run.pendingDapRequests.clear();
      if (session.currentRun === run) session.currentRun = null;
    });

    proxyWorker.on('error', (err: Error) => {
        this.logger.error(`[Proxy ${sessionId}: ERROR_EVENT] DAP Proxy worker emitted error:`, err);
        run.rejectDebugStarted(err);
        this._updateSessionState(session, SessionState.ERROR);
        run.pendingDapRequests.forEach(p => p.reject(err));
        run.pendingDapRequests.clear();
        if (session.currentRun === run) session.currentRun = null;
    });
  }
  
  private sendToProxy(run: ActiveDebugRun, command: object): void { 
    if (!run.proxyWorker || run.proxyWorker.killed) {
      this.logger.error(`[SEND_TO_PROXY_FAIL] Proxy worker for run is not available for session.`); 
      throw new Error('Proxy worker not available for current run');
    }
    const messageStr = JSON.stringify(command);
    this.logger.debug(`[SEND_TO_PROXY] Sending command:`, command);
    run.proxyWorker.send(messageStr);
  }

  private async sendRequestToProxy<T extends DebugProtocol.Response>(sessionId: string, run: ActiveDebugRun, dapCommand: string, dapArgs?: any): Promise<T> {
    const requestId = uuidv4();
    const commandToSend = { cmd: 'dap', sessionId, requestId, dapCommand, dapArgs }; 
    this.logger.info(`[SM sendRequestToProxy ${sessionId}] Sending DAP command: ${dapCommand}, requestId: ${requestId}, args:`, dapArgs || {});
    return new Promise<T>((resolve, reject) => {
      run.pendingDapRequests.set(requestId, { resolve: resolve as (value: DebugProtocol.Response) => void, reject, dapCommand });
      try {
        this.sendToProxy(run, commandToSend);
      } catch (error: unknown) { 
        run.pendingDapRequests.delete(requestId);
        reject(error); 
      }
       setTimeout(() => {
        if (run.pendingDapRequests.has(requestId)) {
          run.pendingDapRequests.delete(requestId);
          reject(new Error(`Timeout waiting for proxy response to ${dapCommand} (reqId: ${requestId}) for session ${sessionId}`));
        }
      }, 35000); 
    });
  }
  
  private async findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object' && 'port' in address) {
          const port = address.port;
          server.close(() => resolve(port));
        } else {
          server.close(() => reject(new Error('Failed to get port from server address')));
        }
      });
    });
  }

  private _getSessionById(sessionId: string): ManagedSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Managed session not found: ${sessionId}`);
    return session;
  }

  private _updateSessionState(session: ManagedSession, newState: SessionState): void {
    if (session.state === newState) return;
    this.logger.info(`[SM _updateSessionState ${session.id}] State change: ${session.state} -> ${newState}`);
    session.state = newState;
    session.updatedAt = new Date(); 
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

    if (session.currentRun) {
      this.logger.warn(`[SessionManager] Session ${sessionId} already has an active run. Terminating before starting new.`);
      await this.closeSession(sessionId); 
    }
    
    this._updateSessionState(session, SessionState.INITIALIZING); 
    try {
      const activeRun = await this.setupNewRun(session, scriptPath, scriptArgs, dapLaunchArgs, dryRunSpawn);
      this.logger.info(`[SessionManager] Waiting for debug process to be fully started or dry run completed for session ${sessionId}...`);
      
      await activeRun.debugStartedPromise; 
      
      if (activeRun.dryRunSuccessfullyCompleted) { 
        this.logger.info(`[SessionManager] Dry run completed for session ${sessionId}. Proxy should have logged command.`);
        this._updateSessionState(session, SessionState.STOPPED); 
        session.currentRun = null; 
        return { success: true, state: session.state, data: { dryRun: true, message: "Dry run spawn command logged by proxy." } };
      }
      
      this.logger.info(`[SessionManager] Debugging fully started for session ${sessionId}. State: ${session.state}, ThreadID: ${activeRun.currentThreadId}`);
      if (session.state !== SessionState.PAUSED && session.state !== SessionState.RUNNING) {
          if (!activeRun.effectiveLaunchArgs.stopOnEntry && session.state === SessionState.STOPPED) {
            this.logger.warn(`[SessionManager] Debug session ${sessionId} started with stopOnEntry=false and is already STOPPED. Script may have finished before breakpoint.`);
          } else {
            this.logger.error(`[SessionManager] Inconsistency after debugStartedPromise: Session ${sessionId} not PAUSED or RUNNING. State: ${session.state}`);
            throw new Error(`Debug session did not reach PAUSED or RUNNING state after start. Current state: ${session.state}`);
          }
      }
      if (activeRun.effectiveLaunchArgs.stopOnEntry && (session.state !== SessionState.PAUSED || !activeRun.currentThreadId)) {
        this.logger.error(`[SessionManager] Inconsistency after stopOnEntry: Session ${sessionId} not PAUSED or no threadId. State: ${session.state}, ThreadId: ${activeRun.currentThreadId}`);
        throw new Error("Debug session did not pause correctly with a thread ID after stopOnEntry.");
      }

      return { 
        success: true, 
        state: session.state, 
        data: { 
          message: `Debugging started for ${scriptPath}. Current state: ${session.state}`,
          reason: session.state === SessionState.PAUSED ? (activeRun.effectiveLaunchArgs.stopOnEntry ? 'entry' : 'breakpoint') : undefined,
          stopOnEntrySuccessful: activeRun.effectiveLaunchArgs.stopOnEntry && session.state === SessionState.PAUSED,
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack available';
      
      this.logger.error(`[SessionManager] Error during startDebugging for session ${sessionId}: ${errorMessage}. Stack: ${errorStack}`);
      
      this._updateSessionState(session, SessionState.ERROR);
      if (session.currentRun?.proxyWorker && !session.currentRun.proxyWorker.killed) {
        session.currentRun.proxyWorker.kill();
      }
      session.currentRun = null;
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

    if (session.currentRun && (session.state === SessionState.RUNNING || session.state === SessionState.PAUSED)) {
      const isAdapterReady = await session.currentRun.debugStartedPromise.then(() => true).catch(() => false);
      if (isAdapterReady) { 
          try {
              this.logger.info(`[SessionManager] Active run for session ${sessionId}, sending breakpoint ${bpId} to proxy.`);
              const response = await this.sendRequestToProxy<DebugProtocol.SetBreakpointsResponse>(sessionId, session.currentRun, 'setBreakpoints', { 
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
              this.logger.error(`[SessionManager] Error sending setBreakpoint to proxy for session ${sessionId} (active run):`, error);
          }
      } else {
          this.logger.info(`[SessionManager] Adapter not yet fully configured and launched for session ${sessionId}. Breakpoint ${bpId} remains queued.`);
      }
    }
    return newBreakpoint;
  }

  async stepOver(sessionId: string): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);
    this.logger.info(`[SM stepOver ${sessionId}] Entered. Current state: ${session.state}, ThreadID: ${session.currentRun?.currentThreadId}`);
    if (!session.currentRun) return { success: false, error: 'No active debug run', state: session.state };
    if (session.state !== SessionState.PAUSED) {
      this.logger.warn(`[SM stepOver ${sessionId}] Not paused. State: ${session.state}`);
      return { success: false, error: 'Not paused', state: session.state };
    }
    if (!session.currentRun.currentThreadId) {
      this.logger.warn(`[SM stepOver ${sessionId}] No current thread ID.`);
      return { success: false, error: 'No current thread ID', state: session.state };
    }
    
    
    this.logger.info(`[SM stepOver ${sessionId}] Sending DAP 'next' for threadId ${session.currentRun.currentThreadId}. Will await 'stopped' event.`);
    
    const run = session.currentRun; 
    const threadIdToStep = run.currentThreadId!;

    const stepPromise = new Promise<void>((resolve, reject) => {
      run.stepCompletionNotifier = { resolve, reject, threadId: threadIdToStep };
    });

    this.sendRequestToProxy(sessionId, run, 'next', { threadId: threadIdToStep })
      .then(dapResponse => {
        this.logger.info(`[SM stepOver ${sessionId}] DAP 'next' request acknowledged by adapter. Response:`, dapResponse);
      })
      .catch(error => {
        this.logger.error(`[SM stepOver ${sessionId}] DAP 'next' request failed directly:`, error);
        if (run.stepCompletionNotifier?.threadId === threadIdToStep) { 
          run.stepCompletionNotifier.reject(error);
        }
      });
    
    this._updateSessionState(session, SessionState.RUNNING); 
    
    try {
      await stepPromise; 
      this.logger.info(`[SM stepOver ${sessionId}] Step promise resolved. Current state: ${session.state}`);

      try {
        this.logger.info(`[SM stepOver ${sessionId}] Performing dummy evaluate to attempt state refresh.`);
        if (run.currentThreadId) {
          await this.sendRequestToProxy<DebugProtocol.EvaluateResponse>(sessionId, run, 'evaluate', {
            expression: "1", 
            frameId: run.currentThreadId,
            context: "repl"
          });
          this.logger.info(`[SM stepOver ${sessionId}] Dummy evaluate completed.`);
        } else {
          this.logger.warn(`[SM stepOver ${sessionId}] No currentThreadId for dummy evaluate after step.`);
        }
      } catch (evalError) {
        this.logger.warn(`[SM stepOver ${sessionId}] Dummy evaluate after step failed (non-critical):`, evalError);
      }

      if (session.state !== SessionState.PAUSED) {
        this.logger.warn(`[SM stepOver ${sessionId}] Step promise resolved, but session not PAUSED. State: ${session.state}. This is unexpected.`);
      }
      return { success: true, state: session.state, data: { message: "Step over completed." } };

    } catch (error) { 
      this.logger.error(`[SM stepOver ${sessionId}] Error during step completion waiting (stepPromise rejected):`, error);
      if (String(session.state) === SessionState.RUNNING) { 
        this._updateSessionState(session, SessionState.ERROR);
      }
      return { success: false, error: (error as Error).message, state: session.state };
    } finally {
      if (run.stepCompletionNotifier?.threadId === threadIdToStep) {
        run.stepCompletionNotifier = undefined;
      }
    }
  }

  async stepInto(sessionId: string): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);
    this.logger.info(`[SM stepInto ${sessionId}] Entered. Current state: ${session.state}, ThreadID: ${session.currentRun?.currentThreadId}`);
    if (!session.currentRun) return { success: false, error: 'No active debug run', state: session.state };
    if (session.state !== SessionState.PAUSED) return { success: false, error: 'Not paused', state: session.state };
    if (!session.currentRun.currentThreadId) return { success: false, error: 'No current thread ID', state: session.state };

    const run = session.currentRun;
    const threadIdToStep = run.currentThreadId!;
    const stepPromise = new Promise<void>((resolve, reject) => {
      run.stepCompletionNotifier = { resolve, reject, threadId: threadIdToStep };
    });

    this.logger.info(`[SM stepInto ${sessionId}] Sending DAP 'stepIn' for threadId ${threadIdToStep}. Will await 'stopped' event.`);
    this.sendRequestToProxy(sessionId, run, 'stepIn', { threadId: threadIdToStep })
      .then(dapResponse => { this.logger.info(`[SM stepInto ${sessionId}] DAP 'stepIn' request acknowledged. Response:`, dapResponse); })
      .catch(error => { 
        this.logger.error(`[SM stepInto ${sessionId}] DAP 'stepIn' request failed:`, error);
        if (run.stepCompletionNotifier?.threadId === threadIdToStep) run.stepCompletionNotifier.reject(error);
      });
    this._updateSessionState(session, SessionState.RUNNING);

    try {
      await stepPromise; 
      this.logger.info(`[SM stepInto ${sessionId}] Step promise resolved. Current state: ${session.state}`);

      try {
        this.logger.info(`[SM stepInto ${sessionId}] Performing dummy evaluate to attempt state refresh.`);
        if (run.currentThreadId) {
          await this.sendRequestToProxy<DebugProtocol.EvaluateResponse>(sessionId, run, 'evaluate', {
            expression: "1",
            frameId: run.currentThreadId,
            context: "repl"
          });
          this.logger.info(`[SM stepInto ${sessionId}] Dummy evaluate completed.`);
        } else {
          this.logger.warn(`[SM stepInto ${sessionId}] No currentThreadId for dummy evaluate after step.`);
        }
      } catch (evalError) {
        this.logger.warn(`[SM stepInto ${sessionId}] Dummy evaluate after step failed (non-critical):`, evalError);
      }
      
      if (session.state !== SessionState.PAUSED) {
        this.logger.warn(`[SM stepInto ${sessionId}] Step promise resolved, but session not PAUSED. State: ${session.state}. This is unexpected.`);
      }
      return { success: true, state: session.state, data: { message: "Step into completed." } };

    } catch (error) { 
      this.logger.error(`[SM stepInto ${sessionId}] Error during step completion waiting (stepPromise rejected):`, error);
      if (String(session.state) === SessionState.RUNNING) { 
        this._updateSessionState(session, SessionState.ERROR);
      }
      return { success: false, error: (error as Error).message, state: session.state };
    } finally {
      if (run.stepCompletionNotifier?.threadId === threadIdToStep) run.stepCompletionNotifier = undefined;
    }
  }

  async stepOut(sessionId: string): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);
    this.logger.info(`[SM stepOut ${sessionId}] Entered. Current state: ${session.state}, ThreadID: ${session.currentRun?.currentThreadId}`);
    if (!session.currentRun) return { success: false, error: 'No active debug run', state: session.state };
    if (session.state !== SessionState.PAUSED) return { success: false, error: 'Not paused', state: session.state };
    if (!session.currentRun.currentThreadId) return { success: false, error: 'No current thread ID', state: session.state };

    const run = session.currentRun;
    const threadIdToStep = run.currentThreadId!;
    const stepPromise = new Promise<void>((resolve, reject) => {
      run.stepCompletionNotifier = { resolve, reject, threadId: threadIdToStep };
    });

    this.logger.info(`[SM stepOut ${sessionId}] Sending DAP 'stepOut' for threadId ${threadIdToStep}. Will await 'stopped' event.`);
    this.sendRequestToProxy(sessionId, run, 'stepOut', { threadId: threadIdToStep })
      .then(dapResponse => { this.logger.info(`[SM stepOut ${sessionId}] DAP 'stepOut' request acknowledged. Response:`, dapResponse); })
      .catch(error => {
        this.logger.error(`[SM stepOut ${sessionId}] DAP 'stepOut' request failed:`, error);
        if (run.stepCompletionNotifier?.threadId === threadIdToStep) run.stepCompletionNotifier.reject(error);
      });
    this._updateSessionState(session, SessionState.RUNNING);

    try {
      await stepPromise; 
      this.logger.info(`[SM stepOut ${sessionId}] Step promise resolved. Current state: ${session.state}`);

      try {
        this.logger.info(`[SM stepOut ${sessionId}] Performing dummy evaluate to attempt state refresh.`);
        if (run.currentThreadId) {
          await this.sendRequestToProxy<DebugProtocol.EvaluateResponse>(sessionId, run, 'evaluate', {
            expression: "1",
            frameId: run.currentThreadId,
            context: "repl"
          });
          this.logger.info(`[SM stepOut ${sessionId}] Dummy evaluate completed.`);
        } else {
          this.logger.warn(`[SM stepOut ${sessionId}] No currentThreadId for dummy evaluate after step.`);
        }
      } catch (evalError) {
        this.logger.warn(`[SM stepOut ${sessionId}] Dummy evaluate after step failed (non-critical):`, evalError);
      }

      if (session.state !== SessionState.PAUSED) {
        this.logger.warn(`[SM stepOut ${sessionId}] Step promise resolved, but session not PAUSED. State: ${session.state}. This is unexpected.`);
      }
      return { success: true, state: session.state, data: { message: "Step out completed." } };

    } catch (error) { 
      this.logger.error(`[SM stepOut ${sessionId}] Error during step completion waiting (stepPromise rejected):`, error);
      if (String(session.state) === SessionState.RUNNING) { 
        this._updateSessionState(session, SessionState.ERROR);
      }
      return { success: false, error: (error as Error).message, state: session.state };
    } finally {
      if (run.stepCompletionNotifier?.threadId === threadIdToStep) run.stepCompletionNotifier = undefined;
    }
  }

  async continue(sessionId: string): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);
    this.logger.info(`[SessionManager continue] Called for session ${sessionId}. Current state: ${session.state}, currentRun: ${!!session.currentRun}, currentThreadId: ${session.currentRun?.currentThreadId}`);
    if (!session.currentRun) {
      this.logger.warn(`[SessionManager continue] No active debug run for session ${sessionId}.`);
      return { success: false, error: 'No active debug run', state: session.state };
    }
    if (session.state !== SessionState.PAUSED) {
      this.logger.warn(`[SessionManager continue] Session ${sessionId} not paused. State: ${session.state}.`);
      return { success: false, error: 'Not paused', state: session.state };
    }
    if (!session.currentRun.currentThreadId) {
      this.logger.warn(`[SessionManager continue] No current thread ID for session ${sessionId}.`);
      return { success: false, error: 'No current thread ID', state: session.state };
    }
    try {
      this.logger.info(`[SessionManager continue] Sending DAP 'continue' for session ${sessionId}, threadId ${session.currentRun.currentThreadId}.`);
      await this.sendRequestToProxy(sessionId, session.currentRun, 'continue', { threadId: session.currentRun.currentThreadId });
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
    if (!session.currentRun) { 
      this.logger.warn(`[SM getVariables ${sessionId}] No active run.`); 
      return []; 
    }
    if (session.state !== SessionState.PAUSED) { 
      this.logger.warn(`[SM getVariables ${sessionId}] Session not paused. State: ${session.state}.`); 
      return []; 
    }
    
    this.logger.info(`[SM getVariables ${sessionId}] Sending DAP 'variables' for variablesReference ${variablesReference}.`);
    const response = await this.sendRequestToProxy<DebugProtocol.VariablesResponse>(sessionId, session.currentRun, 'variables', { variablesReference });
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
  }

  async getStackTrace(sessionId: string, threadId?: number): Promise<StackFrame[]> {
    const session = this._getSessionById(sessionId);
    this.logger.info(`[SM getStackTrace ${sessionId}] Entered. Requested threadId: ${threadId}, Current state: ${session.state}, Actual currentThreadId: ${session.currentRun?.currentThreadId}`);
    if (!session.currentRun) { this.logger.warn(`[SM getStackTrace ${sessionId}] No active run.`); return []; }
    if (session.state !== SessionState.PAUSED) { this.logger.warn(`[SM getStackTrace ${sessionId}] Session not paused. State: ${session.state}.`); return []; }
    
    const currentThreadForRequest = threadId || session.currentRun.currentThreadId;
    if (!currentThreadForRequest) { this.logger.warn(`[SM getStackTrace ${sessionId}] No effective thread ID to use.`); return []; }

    this.logger.info(`[SM getStackTrace ${sessionId}] Sending DAP 'stackTrace' for threadId ${currentThreadForRequest}.`);
    const response = await this.sendRequestToProxy<DebugProtocol.StackTraceResponse>(sessionId, session.currentRun, 'stackTrace', { threadId: currentThreadForRequest });
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
  }

  async getScopes(sessionId: string, frameId: number): Promise<DebugProtocol.Scope[]> {
    const session = this._getSessionById(sessionId);
    this.logger.info(`[SM getScopes ${sessionId}] Entered. frameId: ${frameId}, Current state: ${session.state}`);
    if (!session.currentRun) { this.logger.warn(`[SM getScopes ${sessionId}] No active run.`); return []; }
    if (session.state !== SessionState.PAUSED) { this.logger.warn(`[SM getScopes ${sessionId}] Session not paused. State: ${session.state}.`); return []; }
    
    this.logger.info(`[SM getScopes ${sessionId}] Sending DAP 'scopes' for frameId ${frameId}.`);
    const response = await this.sendRequestToProxy<DebugProtocol.ScopesResponse>(sessionId, session.currentRun, 'scopes', { frameId });
    this.logger.info(`[SM getScopes ${sessionId}] DAP 'scopes' response received. Body:`, response?.body);
    
    if (response && response.body && response.body.scopes) {
      this.logger.info(`[SM getScopes ${sessionId}] Parsed scopes:`, response.body.scopes.map(s => ({name: s.name, ref: s.variablesReference, expensive: s.expensive })));
      return response.body.scopes;
    }
    this.logger.warn(`[GetScopes] No scopes in response body for session ${sessionId}, frameId ${frameId}. Response:`, response);
    return [];
  }
  
  public getSession(sessionId: string): ManagedSession | undefined { return this.sessions.get(sessionId); }
  public getAllSessions(): DebugSessionInfo[] { 
    return Array.from(this.sessions.values()).map(s => ({
        id: s.id, name: s.name, language: s.language, 
        state: s.state, createdAt: s.createdAt, updatedAt: s.updatedAt
    }));
  }
  
  async closeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId); 
    if (!session) {
      this.logger.warn(`[SESSION_CLOSE_FAIL] Session not found: ${sessionId}`);
      return false;
    }
    this.logger.info(`Closing debug session: ${sessionId}. Current run: ${session.currentRun ? 'active' : 'none'}`);
    if (session.currentRun && session.currentRun.proxyWorker) {
      try {
        this.sendToProxy(session.currentRun, { cmd: 'terminate' });
      } catch (error: unknown) { 
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[SessionManager] Error sending terminate command to proxy for session ${sessionId}:`, message);
      }
      await new Promise<void>(resolve => {
        const timeoutId = setTimeout(() => {
            this.logger.warn(`[CLOSE_SESSION_PROXY_TIMEOUT] Timeout for proxy of session ${sessionId}. Killing.`);
            session.currentRun?.proxyWorker?.kill('SIGKILL');
            resolve();
        }, 5000);
        if(session.currentRun && session.currentRun.proxyWorker) { 
            session.currentRun.proxyWorker.on('exit', () => { clearTimeout(timeoutId); resolve(); });
        } else { 
            clearTimeout(timeoutId); 
            resolve();
        }
      });
      session.currentRun = null;
    }
    this._updateSessionState(session, SessionState.STOPPED);
    this.logger.info(`Session ${sessionId} marked as STOPPED.`);
    return true;
  }

  async closeAllSessions(): Promise<void> {
    this.logger.info(`Closing all debug sessions (${this.sessions.size} active)`);
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.closeSession(sessionId);
    }
    this.logger.info('All debug sessions closed');
  }
}
