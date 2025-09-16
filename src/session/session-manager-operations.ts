/**
 * Debug operations for session management including starting, stepping,
 * continuing, and breakpoint management.
 */
import { v4 as uuidv4 } from 'uuid';
import { Breakpoint, SessionState, SessionLifecycleState } from '@debugmcp/shared';
import { ManagedSession } from './session-store.js';
import { DebugProtocol } from '@vscode/debugprotocol'; 
import path from 'path';
import { fileURLToPath } from 'url';
import { ProxyConfig } from '../proxy/proxy-config.js';
import { ErrorMessages } from '../utils/error-messages.js';
import { findPythonExecutable } from '../utils/python-utils.js';
import { SessionManagerData } from './session-manager-data.js';
import { CustomLaunchRequestArguments, DebugResult } from './session-manager-core.js';
import { AdapterConfig } from '@debugmcp/shared';
import { translatePathForContainer, isContainerMode } from '../utils/container-path-utils.js';

/**
 * Result type for evaluate expression operations
 */
export interface EvaluateResult {
  success: boolean;
  result?: string;
  type?: string;
  variablesReference?: number;
  namedVariables?: number;
  indexedVariables?: number;
  presentationHint?: DebugProtocol.VariablePresentationHint;
  error?: string;
}

/**
 * Debug operations functionality for session management
 */
export class SessionManagerOperations extends SessionManagerData {
  protected async startProxyManager(
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
    const projectRoot = path.resolve(fileURLToPath(import.meta.url), '../../../'); // Path to the MCP debugger server's root
    
    const initialBreakpoints = Array.from(session.breakpoints.values()).map(bp => {
        // Breakpoint file path has been validated by server.ts before reaching here
        return {
            file: bp.file, // Use the validated path
            line: bp.line, 
            condition: bp.condition
        };
    });
    
    // scriptPath has been validated by server.ts before reaching here
    const translatedScriptPath = translatePathForContainer(scriptPath, this.environment);
    if (isContainerMode(this.environment) && translatedScriptPath !== scriptPath) {
      this.logger.info(`[SessionManager] Container mode: translated path from '${scriptPath}' to '${translatedScriptPath}'`);
    }

    // Resolve executable path based on language
    let resolvedExecutablePath: string;
    
    if (session.language === 'python') {
      // Python-specific path resolution
      const executablePathFromSession = session.executablePath!;
      
      if (path.isAbsolute(executablePathFromSession)) {
        // Absolute path provided - use as-is
        resolvedExecutablePath = executablePathFromSession;
      } else if (['python', 'python3', 'py'].includes(executablePathFromSession.toLowerCase())) {
        // Common Python commands - use auto-detection without preferredPath
        try {
          resolvedExecutablePath = await findPythonExecutable(undefined, this.logger);
          this.logger.info(`[SessionManager] Auto-detected Python executable: ${resolvedExecutablePath}`);
        } catch (error) {
          this.logger.error(`[SessionManager] Failed to find Python executable:`, error);
          throw error;
        }
      } else {
        // Relative path - resolve from project root (MCP server's root)
        resolvedExecutablePath = path.resolve(projectRoot, executablePathFromSession);
      }
      
      this.logger.info(`[SessionManager] Using Python path: ${resolvedExecutablePath}`);
    } else {
      // For non-Python languages (like mock), use a generic executable path
      resolvedExecutablePath = session.executablePath || process.execPath; // Use node as fallback for mock
      this.logger.info(`[SessionManager] Using ${session.language} executable: ${resolvedExecutablePath}`);
    }

    // Merge launch args
    const effectiveLaunchArgs = {
      ...this.defaultDapLaunchArgs,
      ...(dapLaunchArgs || {}),
    };

    // Create the adapter for this language
    const adapterConfig: AdapterConfig = {
      sessionId,
      executablePath: resolvedExecutablePath,
      adapterHost: '127.0.0.1',
      adapterPort,
      logDir: sessionLogDir,
      scriptPath: translatedScriptPath,
      scriptArgs,
      launchConfig: effectiveLaunchArgs
    };
    
    const adapter = await this.adapterRegistry.create(session.language, adapterConfig);
    
    // Build adapter command using the adapter
    const adapterCommand = adapter.buildAdapterCommand(adapterConfig);

    // Create ProxyConfig
    const proxyConfig: ProxyConfig = {
      sessionId,
      language: session.language,  // Add language from session
      executablePath: resolvedExecutablePath,
      adapterHost: '127.0.0.1',
      adapterPort,
      logDir: sessionLogDir,
      scriptPath: translatedScriptPath, // Use the already translated script path
      scriptArgs,
      stopOnEntry: effectiveLaunchArgs.stopOnEntry,
      justMyCode: effectiveLaunchArgs.justMyCode,
      initialBreakpoints,
      dryRunSpawn: dryRunSpawn === true,
      adapterCommand // Pass the adapter command
    };

    // Create and start ProxyManager with the adapter
    const proxyManager = this.proxyManagerFactory.create(adapter);
    session.proxyManager = proxyManager;

    // Set up event handlers
    this.setupProxyEventHandlers(session, proxyManager, effectiveLaunchArgs);

    // Start the proxy
    await proxyManager.start(proxyConfig);
  }

  /**
   * Helper method to wait for dry run completion with timeout
   */
  private async waitForDryRunCompletion(
    session: ManagedSession, 
    timeoutMs: number
  ): Promise<boolean> {
    let handler: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      return await Promise.race([
        new Promise<boolean>((resolve) => {
          handler = () => {
            this.logger.info(`[SessionManager] Dry run completion event received for session ${session.id}`);
            resolve(true);
          };
          this.logger.info(`[SessionManager] Setting up dry-run-complete listener for session ${session.id}`);
          session.proxyManager?.once('dry-run-complete', handler);
        }),
        new Promise<boolean>((resolve) => {
          timeoutId = setTimeout(() => {
            this.logger.warn(`[SessionManager] Dry run timeout after ${timeoutMs}ms for session ${session.id}`);
            resolve(false);
          }, timeoutMs);
        })
      ]);
    } finally {
      // Clean up immediately
      if (handler && session.proxyManager) {
        this.logger.info(`[SessionManager] Removing dry-run-complete listener for session ${session.id}`);
        session.proxyManager.removeListener('dry-run-complete', handler);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
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
    
    // Update to INITIALIZING state and set lifecycle to ACTIVE
    this._updateSessionState(session, SessionState.INITIALIZING);
    
    // Explicitly set lifecycle state to ACTIVE when starting debugging
    this.sessionStore.update(sessionId, {
      sessionLifecycle: SessionLifecycleState.ACTIVE
    });
    this.logger.info(`[SessionManager] Session ${sessionId} lifecycle state set to ACTIVE`);
    
    try {
      // For dry run, start the proxy and wait for completion
      if (dryRunSpawn) {
        // Mark that we're setting up a dry run handler
        const sessionWithSetup = session as ManagedSession & { _dryRunHandlerSetup?: boolean };
        sessionWithSetup._dryRunHandlerSetup = true;
        
        // Start the proxy manager
        await this.startProxyManager(session, scriptPath, scriptArgs, dapLaunchArgs, dryRunSpawn);
        this.logger.info(`[SessionManager] ProxyManager started for session ${sessionId}`);
        
        // Check if already completed before waiting
        const refreshedSession = this._getSessionById(sessionId);
        this.logger.info(`[SessionManager] Checking state after start: ${refreshedSession.state}`);
        if (refreshedSession.state === SessionState.STOPPED) {
          this.logger.info(`[SessionManager] Dry run already completed for session ${sessionId}`);
          delete sessionWithSetup._dryRunHandlerSetup;
          return { 
            success: true, 
            state: SessionState.STOPPED,
            data: { dryRun: true, message: "Dry run spawn command logged by proxy." } 
          };
        }
        
        // Wait for completion with timeout
        this.logger.info(`[SessionManager] Waiting for dry run completion with timeout ${this.dryRunTimeoutMs}ms`);
        const dryRunCompleted = await this.waitForDryRunCompletion(refreshedSession, this.dryRunTimeoutMs);
        delete sessionWithSetup._dryRunHandlerSetup;
        
        if (dryRunCompleted) {
          this.logger.info(`[SessionManager] Dry run completed for session ${sessionId}, final state: ${refreshedSession.state}`);
          return { 
            success: true, 
            state: SessionState.STOPPED,
            data: { dryRun: true, message: "Dry run spawn command logged by proxy." } 
          };
        } else {
          // Timeout occurred
          const finalSession = this._getSessionById(sessionId);
          this.logger.error(
            `[SessionManager] Dry run timeout for session ${sessionId}. ` +
            `State: ${finalSession.state}, ProxyManager active: ${!!finalSession.proxyManager}`
          );
          return { 
            success: false, 
            error: `Dry run timed out after ${this.dryRunTimeoutMs}ms. Current state: ${finalSession.state}`, 
            state: finalSession.state 
          };
        }
      }
      
      // Normal (non-dry-run) flow
      // Start the proxy manager
      await this.startProxyManager(session, scriptPath, scriptArgs, dapLaunchArgs, dryRunSpawn);
      this.logger.info(`[SessionManager] ProxyManager started for session ${sessionId}`);
      
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
            this.logger.warn(ErrorMessages.adapterReadyTimeout(30));
            resolve();
          }
        }, 30000);
      });
      
      await waitForReady;
      
      // Re-fetch session to get the most up-to-date state
      const finalSession = this._getSessionById(sessionId);
      const finalState = finalSession.state;
      
      this.logger.info(`[SessionManager] Debugging started for session ${sessionId}. State: ${finalState}`);
      
      return { 
        success: true, 
        state: finalState, 
        data: { 
          message: `Debugging started for ${scriptPath}. Current state: ${finalState}`,
          reason: finalState === SessionState.PAUSED ? (dapLaunchArgs?.stopOnEntry ? 'entry' : 'breakpoint') : undefined,
          stopOnEntrySuccessful: dapLaunchArgs?.stopOnEntry && finalState === SessionState.PAUSED,
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

    // The file path has been validated and translated by server.ts before reaching here
    this.logger.info(`[SessionManager setBreakpoint] Using validated file path "${file}" for session ${sessionId}`);

    const newBreakpoint: Breakpoint = { id: bpId, file, line, condition, verified: false };

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
              newBreakpoint.message = bpInfo.message; // Capture validation message
              this.logger.info(`[SessionManager] Breakpoint ${bpId} sent and response received. Verified: ${newBreakpoint.verified}${bpInfo.message ? `, Message: ${bpInfo.message}` : ''}`);
              
              // Log breakpoint verification with structured logging
              if (newBreakpoint.verified) {
                this.logger.info('debug:breakpoint', {
                  event: 'verified',
                  sessionId: sessionId,
                  sessionName: session.name,
                  breakpointId: bpId,
                  file: newBreakpoint.file,
                  line: newBreakpoint.line,
                  verified: true,
                  timestamp: Date.now()
                });
              }
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
          resolve({ 
            success: false, 
            error: ErrorMessages.stepTimeout(5), 
            state: session.state 
          });
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
          resolve({ 
            success: false, 
            error: ErrorMessages.stepTimeout(5), 
            state: session.state 
          });
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
          resolve({ 
            success: false, 
            error: ErrorMessages.stepTimeout(5), 
            state: session.state 
          });
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

  /**
   * Helper method to truncate long strings for logging
   */
  private truncateForLog(value: string, maxLength: number = 1000): string {
    if (!value) return '';
    return value.length > maxLength 
      ? value.substring(0, maxLength) + '... (truncated)'
      : value;
  }

  /**
   * Evaluate an expression in the context of the current debug session.
   * The debugger must be paused for evaluation to work.
   * Expressions CAN and SHOULD be able to modify program state (this is a feature).
   * 
   * @param sessionId - The session ID
   * @param expression - The expression to evaluate
   * @param frameId - Optional stack frame ID for context (defaults to current frame)
   * @param context - The context in which to evaluate ('repl' is default for maximum flexibility)
   * @returns Evaluation result with value, type, and optional variable reference
   */
  async evaluateExpression(
    sessionId: string,
    expression: string,
    frameId?: number,
    context: 'watch' | 'repl' | 'hover' | 'clipboard' | 'variables' = 'repl'
  ): Promise<EvaluateResult> {
    const session = this._getSessionById(sessionId);
    this.logger.info(`[SM evaluateExpression ${sessionId}] Entered. Expression: "${this.truncateForLog(expression, 100)}", frameId: ${frameId}, context: ${context}, state: ${session.state}`);

    // Basic sanity checks
    if (!expression || expression.trim().length === 0) {
      this.logger.warn(`[SM evaluateExpression ${sessionId}] Empty expression provided`);
      return { success: false, error: 'Expression cannot be empty' };
    }

    // Validate session state
    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      this.logger.warn(`[SM evaluateExpression ${sessionId}] No active proxy or proxy not running`);
      return { success: false, error: 'No active debug session' };
    }

    if (session.state !== SessionState.PAUSED) {
      this.logger.warn(`[SM evaluateExpression ${sessionId}] Cannot evaluate: session not paused. State: ${session.state}`);
      return { success: false, error: 'Cannot evaluate: debugger not paused. Ensure the debugger is stopped at a breakpoint.' };
    }

    // Handle frameId - get current frame from stack trace if not provided
    if (frameId === undefined) {
      try {
        const threadId = session.proxyManager.getCurrentThreadId();
        if (!threadId) {
          this.logger.warn(`[SM evaluateExpression ${sessionId}] No current thread ID to get stack trace`);
          return { success: false, error: 'Unable to find thread for evaluation. Ensure the debugger is paused at a breakpoint.' };
        }

        this.logger.info(`[SM evaluateExpression ${sessionId}] No frameId provided, getting current frame from stack trace`);
        const stackResponse = await session.proxyManager.sendDapRequest<DebugProtocol.StackTraceResponse>('stackTrace', {
          threadId,
          startFrame: 0,
          levels: 1  // We only need the first frame
        });

        if (stackResponse?.body?.stackFrames && stackResponse.body.stackFrames.length > 0) {
          frameId = stackResponse.body.stackFrames[0].id;
          this.logger.info(`[SM evaluateExpression ${sessionId}] Using current frame ID: ${frameId} from stack trace`);
        } else {
          this.logger.warn(`[SM evaluateExpression ${sessionId}] No stack frames available`);
          return { success: false, error: 'No active stack frame. Ensure the debugger is paused at a breakpoint.' };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`[SM evaluateExpression ${sessionId}] Error getting stack trace for default frame:`, error);
        return { success: false, error: `Unable to determine current frame: ${errorMessage}` };
      }
    }

    try {
      // Send DAP evaluate request
      this.logger.info(`[SM evaluateExpression ${sessionId}] Sending DAP 'evaluate' request. Expression: "${this.truncateForLog(expression, 100)}", frameId: ${frameId}, context: ${context}`);
      
      const response = await session.proxyManager.sendDapRequest<DebugProtocol.EvaluateResponse>('evaluate', {
        expression,
        frameId,
        context
      });

      // Log raw response in debug mode
      this.logger.debug(`[SM evaluateExpression ${sessionId}] DAP evaluate raw response:`, response);

      // Process response
      if (response && response.body) {
        const body = response.body;
        
        // Note: debugpy automatically truncates collections at 300 items for performance
        const result: EvaluateResult = {
          success: true,
          result: body.result || '',  // Default to empty string if no result
          type: body.type,  // Optional, can be undefined
          variablesReference: body.variablesReference || 0,  // Default to 0 (no children)
          namedVariables: body.namedVariables,
          indexedVariables: body.indexedVariables,
          presentationHint: body.presentationHint
        };

        // Log the evaluation result with structured logging
        this.logger.info('debug:evaluate', {
          event: 'expression',
          sessionId,
          sessionName: session.name,
          expression: this.truncateForLog(expression, 100),
          frameId,
          context,
          result: this.truncateForLog(result.result || '', 1000),
          type: result.type,
          variablesReference: result.variablesReference,
          namedVariables: result.namedVariables,
          indexedVariables: result.indexedVariables,
          timestamp: Date.now()
        });

        this.logger.info(`[SM evaluateExpression ${sessionId}] Evaluation successful. Result: "${this.truncateForLog(result.result || '', 200)}", Type: ${result.type}, VarRef: ${result.variablesReference}`);
        
        return result;
      } else {
        this.logger.warn(`[SM evaluateExpression ${sessionId}] No body in evaluate response`);
        return { success: false, error: 'No response body from debug adapter' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log the error
      this.logger.error('debug:evaluate', {
        event: 'error',
        sessionId,
        sessionName: session.name,
        expression: this.truncateForLog(expression, 100),
        frameId,
        context,
        error: errorMessage,
        timestamp: Date.now()
      });

      this.logger.error(`[SM evaluateExpression ${sessionId}] Error evaluating expression:`, error);
      
      // Determine error type for better user feedback
      let userError = errorMessage;
      if (errorMessage.includes('SyntaxError')) {
        userError = `Syntax error in expression: ${errorMessage}`;
      } else if (errorMessage.includes('NameError')) {
        userError = `Name not found: ${errorMessage}`;
      } else if (errorMessage.includes('TypeError')) {
        userError = `Type error: ${errorMessage}`;
      } else if (errorMessage.includes('frame')) {
        userError = `Invalid frame context: ${errorMessage}`;
      }
      
      return { success: false, error: userError };
    }
  }
}
