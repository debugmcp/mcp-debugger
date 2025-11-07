/**
 * Debug operations for session management including starting, stepping,
 * continuing, and breakpoint management.
 */
import { v4 as uuidv4 } from 'uuid';
import { 
  Breakpoint, 
  SessionState, 
  SessionLifecycleState
} from '@debugmcp/shared';
import { ManagedSession } from './session-store.js';
import { DebugProtocol } from '@vscode/debugprotocol';
import path from 'path';
import { ProxyConfig } from '../proxy/proxy-config.js';
import { ErrorMessages } from '../utils/error-messages.js';
import { SessionManagerData } from './session-manager-data.js';
import { CustomLaunchRequestArguments, DebugResult } from './session-manager-core.js';
import { AdapterConfig } from '@debugmcp/shared';
import {
  SessionTerminatedError,
  ProxyNotRunningError,
  DebugSessionCreationError,
  PythonNotFoundError
} from '../errors/debug-errors.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';

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
    
    // Log entrance for Windows CI debugging
    this.logger.info(
      `[SessionManager] Entering startProxyManager for session ${sessionId}, dryRunSpawn: ${dryRunSpawn}, scriptPath: ${scriptPath}`
    );
    if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
      console.error(`[SessionManager] Windows CI Debug - startProxyManager entrance:`, {
        sessionId,
        dryRunSpawn,
        scriptPath,
        language: session.language,
        hasBreakpoints: session.breakpoints?.size > 0,
        platform: process.platform,
        cwd: process.cwd()
      });
    }

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

    const initialBreakpoints = Array.from(session.breakpoints.values()).map((bp) => {
      // Breakpoint file path has been validated by server.ts before reaching here
      return {
        file: bp.file, // Use the validated path
        line: bp.line,
        condition: bp.condition,
      };
    });

    // Merge launch args
    const effectiveLaunchArgs = {
      ...this.defaultDapLaunchArgs,
      ...(dapLaunchArgs || {}),
    };

    // Create the adapter for this language first
    const adapterConfig: AdapterConfig = {
      sessionId,
      executablePath: '', // Will be resolved by adapter
      adapterHost: '127.0.0.1',
      adapterPort,
      logDir: sessionLogDir,
      scriptPath,
      scriptArgs,
      launchConfig: effectiveLaunchArgs,
    };

    const adapter = await this.adapterRegistry.create(session.language, adapterConfig);

    // Use the adapter to resolve the executable path
    let resolvedExecutablePath: string;
    try {
      resolvedExecutablePath = await adapter.resolveExecutablePath(session.executablePath);
      this.logger.info(`[SessionManager] Adapter resolved executable path: ${resolvedExecutablePath}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[SessionManager] Failed to resolve executable for ${session.language}:`,
        msg
      );

      // Convert to appropriate error type based on language
      if (session.language === 'python' && msg.includes('not found')) {
        throw new PythonNotFoundError(session.executablePath || 'python');
      }

      throw new DebugSessionCreationError(
        `Failed to resolve ${session.language} executable: ${msg}`,
        error instanceof Error ? error : undefined
      );
    }

    // Update adapter config with resolved executable path
    adapterConfig.executablePath = resolvedExecutablePath;

    // Build adapter command using the adapter
    const adapterCommand = adapter.buildAdapterCommand(adapterConfig);

    // Create ProxyConfig
    const proxyConfig: ProxyConfig = {
      sessionId,
      language: session.language, // Add language from session
      executablePath: resolvedExecutablePath,
      adapterHost: '127.0.0.1',
      adapterPort,
      logDir: sessionLogDir,
      scriptPath, // Path already resolved by server
      scriptArgs,
      stopOnEntry: effectiveLaunchArgs.stopOnEntry,
      justMyCode: effectiveLaunchArgs.justMyCode,
      initialBreakpoints,
      dryRunSpawn: dryRunSpawn === true,
      adapterCommand, // Pass the adapter command
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
            this.logger.info(
              `[SessionManager] Dry run completion event received for session ${session.id}`
            );
            resolve(true);
          };
          this.logger.info(
            `[SessionManager] Setting up dry-run-complete listener for session ${session.id}`
          );
          session.proxyManager?.once('dry-run-complete', handler);
        }),
        new Promise<boolean>((resolve) => {
          timeoutId = setTimeout(() => {
            this.logger.warn(
              `[SessionManager] Dry run timeout after ${timeoutMs}ms for session ${session.id}`
            );
            resolve(false);
          }, timeoutMs);
        }),
      ]);
    } finally {
      // Clean up immediately
      if (handler && session.proxyManager) {
        this.logger.info(
          `[SessionManager] Removing dry-run-complete listener for session ${session.id}`
        );
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
    this.logger.info(
      `Attempting to start debugging for session ${sessionId}, script: ${scriptPath}, dryRunSpawn: ${dryRunSpawn}, dapLaunchArgs:`,
      dapLaunchArgs
    );
    
    // CI Debug: Entry point
    if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
      console.error(`[CI Debug] startDebugging entry - sessionId: ${sessionId}, dryRunSpawn: ${dryRunSpawn}, scriptPath: ${scriptPath}`);
    }

    if (session.proxyManager) {
      this.logger.warn(
        `[SessionManager] Session ${sessionId} already has an active proxy. Terminating before starting new.`
      );
      await this.closeSession(sessionId);
    }

    // Update to INITIALIZING state and set lifecycle to ACTIVE
    this._updateSessionState(session, SessionState.INITIALIZING);

    // Explicitly set lifecycle state to ACTIVE when starting debugging
    this.sessionStore.update(sessionId, {
      sessionLifecycle: SessionLifecycleState.ACTIVE,
    });
    this.logger.info(`[SessionManager] Session ${sessionId} lifecycle state set to ACTIVE`);

    try {
      // For dry run, start the proxy and wait for completion
      if (dryRunSpawn) {
        // CI Debug: Entering dry run branch
        if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
          console.error(`[CI Debug] Entering dry run branch for session ${sessionId}`);
        }
        
        // Mark that we're setting up a dry run handler
        const sessionWithSetup = session as ManagedSession & { _dryRunHandlerSetup?: boolean };
        sessionWithSetup._dryRunHandlerSetup = true;

        // CI Debug: Before startProxyManager
        if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
          console.error(`[CI Debug] About to call startProxyManager for dry run`);
        }
        
        // Start the proxy manager
        await this.startProxyManager(session, scriptPath, scriptArgs, dapLaunchArgs, dryRunSpawn);
        this.logger.info(`[SessionManager] ProxyManager started for session ${sessionId}`);
        
        // CI Debug: After startProxyManager
        if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
          console.error(`[CI Debug] startProxyManager completed, checking state`);
        }

        // Check if already completed before waiting
        const refreshedSession = this._getSessionById(sessionId);
        this.logger.info(`[SessionManager] Checking state after start: ${refreshedSession.state}`);
        
        // CI Debug: State check
        if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
          console.error(`[CI Debug] Session state after proxy start: ${refreshedSession.state}`);
        }
        
        if (refreshedSession.state === SessionState.STOPPED) {
          this.logger.info(
            `[SessionManager] Dry run already completed for session ${sessionId}`
          );
          delete sessionWithSetup._dryRunHandlerSetup;
          
          // CI Debug: Early completion
          if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
            console.error(`[CI Debug] Dry run completed immediately (state=STOPPED)`);
          }
          
          return {
            success: true,
            state: SessionState.STOPPED,
            data: { dryRun: true, message: 'Dry run spawn command logged by proxy.' },
          };
        }

        // Wait for completion with timeout
        this.logger.info(
          `[SessionManager] Waiting for dry run completion with timeout ${this.dryRunTimeoutMs}ms`
        );
        
        // CI Debug: Before wait
        if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
          console.error(`[CI Debug] Waiting for dry run completion, timeout: ${this.dryRunTimeoutMs}ms`);
        }
        
        const dryRunCompleted = await this.waitForDryRunCompletion(
          refreshedSession,
          this.dryRunTimeoutMs
        );
        delete sessionWithSetup._dryRunHandlerSetup;
        
        // CI Debug: After wait
        if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
          console.error(`[CI Debug] waitForDryRunCompletion returned: ${dryRunCompleted}`);
        }

        if (dryRunCompleted) {
          this.logger.info(
            `[SessionManager] Dry run completed for session ${sessionId}, final state: ${refreshedSession.state}`
          );
          
          // CI Debug: Success path
          if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
            console.error(`[CI Debug] Dry run success path - returning success`);
          }
          
          return {
            success: true,
            state: SessionState.STOPPED,
            data: { dryRun: true, message: 'Dry run spawn command logged by proxy.' },
          };
        } else {
          // Timeout occurred
          const finalSession = this._getSessionById(sessionId);
          this.logger.error(
            `[SessionManager] Dry run timeout for session ${sessionId}. ` +
              `State: ${finalSession.state}, ProxyManager active: ${!!finalSession.proxyManager}`
          );
          
          // CI Debug: Timeout path
          if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
            console.error(`[CI Debug] Dry run timeout! State: ${finalSession.state}, ProxyManager: ${!!finalSession.proxyManager}`);
          }
          
          return {
            success: false,
            error: `Dry run timed out after ${this.dryRunTimeoutMs}ms. Current state: ${finalSession.state}`,
            state: finalSession.state,
          };
        }
      }

      // Normal (non-dry-run) flow
      // Start the proxy manager
      await this.startProxyManager(session, scriptPath, scriptArgs, dapLaunchArgs, dryRunSpawn);
      this.logger.info(`[SessionManager] ProxyManager started for session ${sessionId}`);

      // Perform language-specific handshake if required
      const policy = this.selectPolicy(session.language);
      if (policy.performHandshake) {
        try {
          await policy.performHandshake({
            proxyManager: session.proxyManager,
            sessionId: session.id,
            dapLaunchArgs,
            scriptPath,
            scriptArgs,
            breakpoints: session.breakpoints
          });
        } catch (handshakeErr) {
          this.logger.warn(
            `[SessionManager] Language handshake returned with warning/error: ${
              handshakeErr instanceof Error ? handshakeErr.message : String(handshakeErr)
            }`
          );
        }
      }

      // Use policy-defined readiness criteria when available.
      const sessionStateAfterHandshake = this._getSessionById(sessionId).state;
      const alreadyReady = policy.isSessionReady
        ? policy.isSessionReady(sessionStateAfterHandshake, { stopOnEntry: dapLaunchArgs?.stopOnEntry })
        : sessionStateAfterHandshake === SessionState.PAUSED;

      if (!alreadyReady) {
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
            const readyOnRunning = policy.isSessionReady
              ? policy.isSessionReady(SessionState.RUNNING, { stopOnEntry: dapLaunchArgs?.stopOnEntry })
              : !dapLaunchArgs?.stopOnEntry;
            if (!resolved && readyOnRunning) {
              resolved = true;
              this.logger.info(
                `[SessionManager] Session ${sessionId} running (stopOnEntry=${dapLaunchArgs?.stopOnEntry ?? false})`
              );
              resolve();
            }
          };

          session.proxyManager?.once('stopped', handleStopped);
          session.proxyManager?.once('adapter-configured', handleConfigured);

          // In case the adapter already reached the desired state before listeners were attached,
          // perform a synchronous state check to avoid waiting for an event that already fired.
          const currentState = this._getSessionById(sessionId).state;
          const readyNow = policy.isSessionReady
            ? policy.isSessionReady(currentState, { stopOnEntry: dapLaunchArgs?.stopOnEntry })
            : currentState === SessionState.PAUSED;
          if (readyNow) {
            resolved = true;
            session.proxyManager?.removeListener('stopped', handleStopped);
            session.proxyManager?.removeListener('adapter-configured', handleConfigured);
            resolve();
            return;
          }

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
      } else {
        this.logger.info(
          `[SessionManager] Session ${sessionId} already ${sessionStateAfterHandshake} after handshake - skipping adapter readiness wait`
        );
      }

      // Re-fetch session to get the most up-to-date state
      const finalSession = this._getSessionById(sessionId);
      const finalState = finalSession.state;

      this.logger.info(
        `[SessionManager] Debugging started for session ${sessionId}. State: ${finalState}`
      );

      return {
        success: true,
        state: finalState,
        data: {
          message: `Debugging started for ${scriptPath}. Current state: ${finalState}`,
          reason:
            finalState === SessionState.PAUSED
              ? dapLaunchArgs?.stopOnEntry
                ? 'entry'
                : 'breakpoint'
              : undefined,
          stopOnEntrySuccessful: !!dapLaunchArgs?.stopOnEntry && finalState === SessionState.PAUSED,
        },
      };
    } catch (error) {
      // Comprehensive error capture for debugging Windows CI issues
      const errorDetails: Record<string, unknown> = {
        type: error?.constructor?.name || 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack available',
        code: (error as Record<string, unknown>)?.code,
        errno: (error as Record<string, unknown>)?.errno,
        syscall: (error as Record<string, unknown>)?.syscall,
        path: (error as Record<string, unknown>)?.path,
        toString: error?.toString ? error.toString() : 'No toString'
      };

      // Try to capture raw error object
      try {
        errorDetails.raw = JSON.stringify(error);
      } catch {
        errorDetails.raw = 'Error not JSON serializable';
      }

      // Log comprehensive error details
      this.logger.error(
        `[SessionManager] Detailed error in startDebugging for session ${sessionId}:`,
        errorDetails
      );
      
      // Also log to console for CI visibility
      if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
        console.error('[SessionManager] Windows CI Debug - Full error details:', errorDetails);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      this._updateSessionState(session, SessionState.ERROR);

      if (session.proxyManager) {
        await session.proxyManager.stop();
        session.proxyManager = undefined;
      }

      // Normalize error identity for callers/tests
      let errorType: string | undefined;
      let errorCode: number | undefined;
      if (error instanceof McpError) {
        errorType = (error as McpError).constructor.name || 'McpError';
        errorCode = (error as McpError).code as number | undefined;
      } else if (error instanceof Error) {
        errorType = error.constructor.name || 'Error';
      }

      return { success: false, error: errorMessage, state: session.state, errorType, errorCode };
    }
  }


  async setBreakpoint(
    sessionId: string,
    file: string,
    line: number,
    condition?: string
  ): Promise<Breakpoint> {
    const session = this._getSessionById(sessionId);

    // Check if session is terminated
    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

    const bpId = uuidv4();

    // The file path has been validated and translated by server.ts before reaching here
    this.logger.info(
      `[SessionManager setBreakpoint] Using validated file path "${file}" for session ${sessionId}`
    );

    const newBreakpoint: Breakpoint = { id: bpId, file, line, condition, verified: false };

    if (!session.breakpoints) session.breakpoints = new Map();
    session.breakpoints.set(bpId, newBreakpoint);
    this.logger.info(
      `[SessionManager] Breakpoint ${bpId} queued for ${file}:${line} in session ${sessionId}.`
    );

    if (
      session.proxyManager &&
      session.proxyManager.isRunning() &&
      (session.state === SessionState.RUNNING || session.state === SessionState.PAUSED)
    ) {
      try {
        this.logger.info(
          `[SessionManager] Active proxy for session ${sessionId}, sending breakpoint ${bpId}.`
        );
        const response =
          await session.proxyManager.sendDapRequest<DebugProtocol.SetBreakpointsResponse>(
            'setBreakpoints',
            {
              source: { path: newBreakpoint.file },
              breakpoints: [{ line: newBreakpoint.line, condition: newBreakpoint.condition }],
            }
          );
        if (
          response &&
          response.body &&
          response.body.breakpoints &&
          response.body.breakpoints.length > 0
        ) {
          const bpInfo = response.body.breakpoints[0];
          newBreakpoint.verified = bpInfo.verified;
          newBreakpoint.line = bpInfo.line || newBreakpoint.line;
          newBreakpoint.message = bpInfo.message; // Capture validation message
          this.logger.info(
            `[SessionManager] Breakpoint ${bpId} sent and response received. Verified: ${newBreakpoint.verified}${
              bpInfo.message ? `, Message: ${bpInfo.message}` : ''
            }`
          );

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
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        this.logger.error(
          `[SessionManager] Error sending setBreakpoint to proxy for session ${sessionId}:`,
          error
        );
      }
    }
    return newBreakpoint;
  }

  async stepOver(sessionId: string): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);

    // Check if session is terminated
    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

    const threadId = session.proxyManager?.getCurrentThreadId();
    this.logger.info(
      `[SM stepOver ${sessionId}] Entered. Current state: ${session.state}, ThreadID: ${threadId}`
    );

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      throw new ProxyNotRunningError(sessionId, 'step over');
    }
    if (session.state !== SessionState.PAUSED) {
      this.logger.warn(`[SM stepOver ${sessionId}] Not paused. State: ${session.state}`);
      return { success: false, error: 'Not paused', state: session.state };
    }
    if (typeof threadId !== 'number') {
      this.logger.warn(`[SM stepOver ${sessionId}] No current thread ID.`);
      return { success: false, error: 'No current thread ID', state: session.state };
    }

    this.logger.info(`[SM stepOver ${sessionId}] Sending DAP 'next' for threadId ${threadId}`);

    try {
      return await this._executeStepOperation(session, sessionId, {
        command: 'next',
        threadId,
        logTag: 'stepOver',
        successMessage: 'Step completed.',
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

    // Check if session is terminated
    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

    const threadId = session.proxyManager?.getCurrentThreadId();
    this.logger.info(
      `[SM stepInto ${sessionId}] Entered. Current state: ${session.state}, ThreadID: ${threadId}`
    );

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      throw new ProxyNotRunningError(sessionId, 'step into');
    }
    if (session.state !== SessionState.PAUSED) {
      this.logger.warn(`[SM stepInto ${sessionId}] Not paused. State: ${session.state}`);
      return { success: false, error: 'Not paused', state: session.state };
    }
    if (typeof threadId !== 'number') {
      this.logger.warn(`[SM stepInto ${sessionId}] No current thread ID.`);
      return { success: false, error: 'No current thread ID', state: session.state };
    }

    this.logger.info(`[SM stepInto ${sessionId}] Sending DAP 'stepIn' for threadId ${threadId}`);

    try {
      return await this._executeStepOperation(session, sessionId, {
        command: 'stepIn',
        threadId,
        logTag: 'stepInto',
        successMessage: 'Step into completed.',
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

    // Check if session is terminated
    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

    const threadId = session.proxyManager?.getCurrentThreadId();
    this.logger.info(
      `[SM stepOut ${sessionId}] Entered. Current state: ${session.state}, ThreadID: ${threadId}`
    );

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      throw new ProxyNotRunningError(sessionId, 'step out');
    }
    if (session.state !== SessionState.PAUSED) {
      this.logger.warn(`[SM stepOut ${sessionId}] Not paused. State: ${session.state}`);
      return { success: false, error: 'Not paused', state: session.state };
    }
    if (typeof threadId !== 'number') {
      this.logger.warn(`[SM stepOut ${sessionId}] No current thread ID.`);
      return { success: false, error: 'No current thread ID', state: session.state };
    }

    this.logger.info(`[SM stepOut ${sessionId}] Sending DAP 'stepOut' for threadId ${threadId}`);

    try {
      return await this._executeStepOperation(session, sessionId, {
        command: 'stepOut',
        threadId,
        logTag: 'stepOut',
        successMessage: 'Step out completed.',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[SM stepOut ${sessionId}] Error during step:`, error);
      this._updateSessionState(session, SessionState.ERROR);
      return { success: false, error: errorMessage, state: session.state };
    }
  }

  private _executeStepOperation(
    session: ManagedSession,
    sessionId: string,
    options: {
      command: 'next' | 'stepIn' | 'stepOut';
      threadId: number;
      logTag: string;
      successMessage: string;
      terminatedMessage?: string;
      exitedMessage?: string;
    }
  ): Promise<DebugResult> {
    const proxyManager = session.proxyManager;

    if (!proxyManager) {
      return Promise.resolve({
        success: false,
        error: 'Proxy manager unavailable',
        state: session.state,
      });
    }

    const terminatedMessage =
      options.terminatedMessage ?? 'Step completed as session terminated.';
    const exitedMessage = options.exitedMessage ?? 'Step completed as session exited.';

    return new Promise((resolve) => {
      let settled = false;

      const cleanup = () => {
        proxyManager.off('stopped', onStopped);
        proxyManager.off('terminated', onTerminated);
        proxyManager.off('exited', onExited);
        proxyManager.off('exit', onExit);
        clearTimeout(timeout);
      };

      const settle = (result: DebugResult) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(result);
      };

      const success = (message: string) => {
        this.logger.info(`[SM ${options.logTag} ${sessionId}] ${message} Current state: ${session.state}`);
        settle({
          success: true,
          state: session.state,
          data: { message },
        });
      };

      const onStopped = () => success(options.successMessage);
      const onTerminated = () => success(terminatedMessage);
      const onExited = () => success(exitedMessage);
      const onExit = () => success(exitedMessage);

      const timeout = setTimeout(() => {
        this.logger.warn(
          `[SM ${options.logTag} ${sessionId}] Timeout waiting for stopped or termination event`
        );
        settle({
          success: false,
          error: ErrorMessages.stepTimeout(5),
          state: session.state,
        });
      }, 5000);

      proxyManager.on('stopped', onStopped);
      proxyManager.on('terminated', onTerminated);
      proxyManager.on('exited', onExited);
      proxyManager.on('exit', onExit);

      this._updateSessionState(session, SessionState.RUNNING);

      proxyManager
        .sendDapRequest(options.command, { threadId: options.threadId })
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `[SM ${options.logTag} ${sessionId}] Error during step request:`,
            error
          );
          this._updateSessionState(session, SessionState.ERROR);
          settle({ success: false, error: errorMessage, state: session.state });
        });
    });
  }

  async continue(sessionId: string): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);

    // Check if session is terminated
    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

    const threadId = session.proxyManager?.getCurrentThreadId();
    this.logger.info(
      `[SessionManager continue] Called for session ${sessionId}. Current state: ${session.state}, ThreadID: ${threadId}`
    );

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      throw new ProxyNotRunningError(sessionId, 'continue');
    }
    if (session.state !== SessionState.PAUSED) {
      this.logger.warn(
        `[SessionManager continue] Session ${sessionId} not paused. State: ${session.state}.`
      );
      return { success: false, error: 'Not paused', state: session.state };
    }
    if (typeof threadId !== 'number') {
      this.logger.warn(
        `[SessionManager continue] No current thread ID for session ${sessionId}.`
      );
      return { success: false, error: 'No current thread ID', state: session.state };
    }

    try {
      this.logger.info(
        `[SessionManager continue] Sending DAP 'continue' for session ${sessionId}, threadId ${threadId}.`
      );
      await session.proxyManager.sendDapRequest('continue', { threadId });
      this._updateSessionState(session, SessionState.RUNNING);
      this.logger.info(
        `[SessionManager continue] DAP 'continue' sent, session ${sessionId} state updated to RUNNING.`
      );
      return { success: true, state: session.state };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[SessionManager continue] Error sending 'continue' to proxy for session ${sessionId}: ${errorMessage}`
      );
      throw error;
    }
  }


  /**
   * Helper method to truncate long strings for logging
   */
  private truncateForLog(value: string, maxLength: number = 1000): string {
    if (!value) return '';
    return value.length > maxLength ? value.substring(0, maxLength) + '... (truncated)' : value;
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
    context: 'watch' | 'repl' | 'hover' | 'clipboard' | 'variables' = 'variables'
  ): Promise<EvaluateResult> {
    const session = this._getSessionById(sessionId);
    this.logger.info(
      `[SM evaluateExpression ${sessionId}] Entered. Expression: "${this.truncateForLog(
        expression,
        100
      )}", frameId: ${frameId}, context: ${context}, state: ${session.state}`
    );

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
      this.logger.warn(
        `[SM evaluateExpression ${sessionId}] Cannot evaluate: session not paused. State: ${session.state}`
      );
      return {
        success: false,
        error: 'Cannot evaluate: debugger not paused. Ensure the debugger is stopped at a breakpoint.',
      };
    }

    // Handle frameId - get current frame from stack trace if not provided
    if (frameId === undefined) {
      try {
        const threadId = session.proxyManager.getCurrentThreadId();
        if (typeof threadId !== 'number') {
          this.logger.warn(
            `[SM evaluateExpression ${sessionId}] No current thread ID to get stack trace`
          );
          return {
            success: false,
            error: 'Unable to find thread for evaluation. Ensure the debugger is paused at a breakpoint.',
          };
        }

        this.logger.info(
          `[SM evaluateExpression ${sessionId}] No frameId provided, getting current frame from stack trace`
        );
        const stackResponse = await session.proxyManager.sendDapRequest<DebugProtocol.StackTraceResponse>(
          'stackTrace',
          {
            threadId,
            startFrame: 0,
            levels: 1, // We only need the first frame
          }
        );

        if (stackResponse?.body?.stackFrames && stackResponse.body.stackFrames.length > 0) {
          frameId = stackResponse.body.stackFrames[0].id;
          this.logger.info(
            `[SM evaluateExpression ${sessionId}] Using current frame ID: ${frameId} from stack trace`
          );
        } else {
          this.logger.warn(`[SM evaluateExpression ${sessionId}] No stack frames available`);
          return {
            success: false,
            error: 'No active stack frame. Ensure the debugger is paused at a breakpoint.',
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `[SM evaluateExpression ${sessionId}] Error getting stack trace for default frame:`,
          error
        );
        return { success: false, error: `Unable to determine current frame: ${errorMessage}` };
      }
    }

    try {
      // Send DAP evaluate request
      this.logger.info(
        `[SM evaluateExpression ${sessionId}] Sending DAP 'evaluate' request. Expression: "${this.truncateForLog(
          expression,
          100
        )}", frameId: ${frameId}, context: ${context}`
      );

      const response =
        await session.proxyManager.sendDapRequest<DebugProtocol.EvaluateResponse>('evaluate', {
          expression,
          frameId,
          context,
        });

      // Log raw response in debug mode
      this.logger.debug(`[SM evaluateExpression ${sessionId}] DAP evaluate raw response:`, response);

      // Process response
      if (response && response.body) {
        const body = response.body;

        // Note: debugpy automatically truncates collections at 300 items for performance
        const result: EvaluateResult = {
          success: true,
          result: body.result || '', // Default to empty string if no result
          type: body.type, // Optional, can be undefined
          variablesReference: body.variablesReference || 0, // Default to 0 (no children)
          namedVariables: body.namedVariables,
          indexedVariables: body.indexedVariables,
          presentationHint: body.presentationHint,
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
          timestamp: Date.now(),
        });

        this.logger.info(
          `[SM evaluateExpression ${sessionId}] Evaluation successful. Result: "${this.truncateForLog(
            result.result || '',
            200
          )}", Type: ${result.type}, VarRef: ${result.variablesReference}`
        );

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
        timestamp: Date.now(),
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

  /**
   * Wait for a session to emit a stopped event after launch to honour the first breakpoint.
   */
  private async waitForInitialBreakpointPause(sessionId: string, timeoutMs: number): Promise<boolean> {
    const session = this._getSessionById(sessionId);
    const proxyManager = session.proxyManager;

    if (!proxyManager) {
      return false;
    }

    if (session.state === SessionState.PAUSED) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;

      const cleanup = () => {
        proxyManager.removeListener('stopped', onStopped);
        clearTimeout(timer);
      };

      const onStopped = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(true);
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(false);
      }, timeoutMs);

      proxyManager.once('stopped', onStopped);
    });
  }
}
