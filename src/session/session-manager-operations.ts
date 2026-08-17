/**
 * Debug operations for session management including starting, stepping,
 * continuing, and breakpoint management.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  Breakpoint,
  FunctionBreakpoint,
  SessionState,
  SessionLifecycleState,
  sanitizePayloadForLogging,
  toSourceBreakpoint,
  toFunctionBreakpoint,
  isSensitiveName,
  redactVariableValue,
  redactSecretsDeep,
  buildRedactionNotice,
  type AdapterPolicy,
  type ExceptionBreakMode
} from '@debugmcp/shared';
import { ManagedSession, ToolchainValidationState } from './session-store.js';
import { DebugProtocol } from '@vscode/debugprotocol';
import path from 'path';
import { ProxyConfig } from '../proxy/proxy-config.js';
import { MIRROR_EXPOSE_COMMAND, MIRROR_UNEXPOSE_COMMAND } from '../proxy/dap-proxy-interfaces.js';
import { ErrorMessages } from '../utils/error-messages.js';
import { resolveStatement } from '../utils/breakpoint-resolver.js';
import { SessionManagerData } from './session-manager-data.js';
import { CustomLaunchRequestArguments, DebugResult } from './session-manager-core.js';
import {
  AdapterConfig,
  type GenericLaunchConfig,
  type GenericAttachConfig,
  type LanguageSpecificLaunchConfig
} from '@debugmcp/shared';
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
  /** Present when secret-shaped content was masked in `result` (issue #237) */
  redaction?: { rules: string[]; notice: string };
}

export interface RedefineClassesResult {
  success: boolean;
  redefined?: string[];
  redefinedCount?: number;
  skippedNotLoaded?: number;
  failedCount?: number;
  failed?: Array<{ fqcn: string; error: string }>;
  scannedFiles?: number;
  newestTimestamp?: number;
  error?: string;
}

/** Result of expose_session (issue #217). */
export interface ExposeSessionResult {
  success: boolean;
  state: SessionState;
  host?: string;
  port?: number;
  token?: string;
  error?: string;
}

/** Result of unexpose_session (issue #217). */
export interface UnexposeSessionResult {
  success: boolean;
  state: SessionState;
  wasExposed?: boolean;
  closedClients?: number;
  error?: string;
}

/**
 * Debug operations functionality for session management
 */
export abstract class SessionManagerOperations extends SessionManagerData {
  /**
   * Attach verification window: after an attach handshake completes, DAP
   * 'threads' is polled until the debugger reports at least one thread.
   * If the window elapses without any threads, the attach is reported as a
   * failure instead of a false "paused" success (issue #124).
   * Callers can widen the window per attach via the 'verifyTimeout' tool
   * argument for targets that are slow to become debuggable (issue #143).
   * Protected so tests can shrink the window.
   */
  protected attachVerifyTimeoutMs = 5000;
  protected attachVerifyIntervalMs = 250;

  /**
   * How long to wait for the 'stopped' event after a post-attach pause
   * (policies with getAttachBehavior().pauseAfterAttach) before reporting
   * PAUSED anyway with a warning. Protected so tests can shrink the window.
   */
  protected attachPauseStopTimeoutMs = 5000;

  /**
   * Grace windows for step and pause operations: how long to wait for the
   * 'stopped' event before returning a truthful "still running" success
   * (data.pending = true). These are NOT deadlines on the debuggee — a step
   * over a long-running call or a pause of a target blocked in native code
   * completes asynchronously via the core handleStopped listener, which has
   * no timeout. Protected so tests can shrink the windows.
   */
  protected stepGraceMs = 5000;
  protected pauseGraceMs = 5000;

  protected async startProxyManager(
    session: ManagedSession,
    scriptPath: string,
    scriptArgs?: string[],
    dapLaunchArgs?: Partial<CustomLaunchRequestArguments>,
    dryRunSpawn?: boolean,
    adapterLaunchConfig?: Record<string, unknown>,
    breakOnExceptions?: ExceptionBreakMode
  ): Promise<LanguageSpecificLaunchConfig> {
    const sessionId = session.id;
    
    // Log entrance for Windows CI debugging
    this.logger.info(
      `[SessionManager] Entering startProxyManager for session ${sessionId}, dryRunSpawn: ${dryRunSpawn}, scriptPath: ${scriptPath}`
    );

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
    // Persist log directory on session for diagnostics
    this.sessionStore.update(sessionId, { logDir: sessionLogDir });

    // Get free port for adapter
    const adapterPort = await this.findFreePort();

    const initialBreakpoints = Array.from(session.breakpoints.values()).map((bp) => {
      // Breakpoint file path has been validated by server.ts before reaching here.
      // Carry every per-breakpoint field (condition, logMessage, suspendPolicy) —
      // dropping one here silently loses it for the whole launch (#235).
      return {
        file: bp.file, // Use the validated path
        line: bp.line,
        condition: bp.condition,
        logMessage: bp.logMessage,
        suspendPolicy: bp.suspendPolicy,
      };
    });

    const initialFunctionBreakpoints = Array.from(session.functionBreakpoints?.values() ?? []).map((bp) => ({
      name: bp.functionName,
      condition: bp.condition,
    }));

    // Merge launch args
    const effectiveLaunchArgs = {
      ...this.defaultDapLaunchArgs,
      ...(dapLaunchArgs || {}),
    };

    // Detect attach mode early to avoid setting launch-specific fields
    const launchArgs = effectiveLaunchArgs as Record<string, unknown>;
    const isAttachMode = launchArgs.request === 'attach' ||
                         launchArgs.__attachMode === true;

    const genericLaunchConfig: Record<string, unknown> = {
      ...effectiveLaunchArgs
    };

    // Only set program/cwd/args for launch mode
    if (!isAttachMode) {
      // Use scriptPath as program only if dapLaunchArgs didn't provide one
      // (compiled languages like .NET, Rust, Go pass the binary via dapLaunchArgs.program)
      if (typeof genericLaunchConfig.program !== 'string' || genericLaunchConfig.program.length === 0) {
        genericLaunchConfig.program = scriptPath;
      }

      if (Array.isArray(scriptArgs) && scriptArgs.length > 0) {
        genericLaunchConfig.args = scriptArgs;
      }

      if (typeof genericLaunchConfig.cwd !== 'string' || genericLaunchConfig.cwd.length === 0) {
        genericLaunchConfig.cwd = path.dirname(scriptPath);
      }
    }

    if (adapterLaunchConfig && typeof adapterLaunchConfig === 'object') {
      // request/__attachMode select the DAP sequence and shutdown semantics —
      // the proxy worker re-reads them from the merged config (attach must
      // detach with terminateDebuggee=false) — so adapter extras must never
      // flip launch<->attach (issue #336).
      const {
        request: droppedRequest,
        __attachMode: droppedAttachMode,
        ...adapterExtras
      } = adapterLaunchConfig as Record<string, unknown>;
      if (droppedRequest !== undefined || droppedAttachMode !== undefined) {
        const droppedKeys = [
          droppedRequest !== undefined && 'request',
          droppedAttachMode !== undefined && '__attachMode'
        ].filter(Boolean).join(', ');
        this.logger.warn(
          `[SessionManager] Ignoring reserved adapter-config key(s) for session ${session.id}: ${droppedKeys}`
        );
      }
      Object.assign(genericLaunchConfig, adapterExtras);
    }

    let transformedLaunchConfig: LanguageSpecificLaunchConfig | undefined;

    // Create the adapter for this language first
    const adapterConfig: AdapterConfig = {
      sessionId,
      executablePath: '', // Will be resolved by adapter
      adapterHost: '127.0.0.1',
      adapterPort,
      logDir: sessionLogDir,
      scriptPath,
      scriptArgs,
      launchConfig: genericLaunchConfig as GenericLaunchConfig,
      attachMode: isAttachMode,
    };

    const adapter = await this.adapterRegistry.create(session.language, adapterConfig);

    // isAttachMode already detected above

    try {
      if (isAttachMode && adapter.supportsAttach && adapter.supportsAttach() && adapter.transformAttachConfig) {
        // Call transformAttachConfig for attach operations
        transformedLaunchConfig = adapter.transformAttachConfig(genericLaunchConfig as GenericAttachConfig);
        this.logger.info(`[SessionManager] Using attach config for ${session.language}`);
      } else {
        // Call transformLaunchConfig for launch operations
        transformedLaunchConfig = await adapter.transformLaunchConfig(genericLaunchConfig as GenericLaunchConfig);
      }
    } catch (error) {
      this.logger.warn(
        `[SessionManager] transform${isAttachMode ? 'Attach' : 'Launch'}Config failed for ${session.language}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      transformedLaunchConfig = undefined;
    }

    const adapterWithToolchain = adapter as {
      consumeLastToolchainValidation?: () => unknown;
    };
    const toolchainValidation =
      typeof adapterWithToolchain.consumeLastToolchainValidation === 'function'
      ? (adapterWithToolchain.consumeLastToolchainValidation() as ToolchainValidationState)
      : undefined;

    if (toolchainValidation) {
      this.sessionStore.update(sessionId, { toolchainValidation });
      if (!toolchainValidation.compatible && toolchainValidation.behavior !== 'continue') {
        const toolchainError = new Error('MSVC_TOOLCHAIN_DETECTED') as Error & {
          toolchainValidation?: ToolchainValidationState;
        };
        toolchainError.toolchainValidation = toolchainValidation;
        throw toolchainError;
      }
    } else {
      this.sessionStore.update(sessionId, { toolchainValidation: undefined });
    }

    // Use the adapter to resolve the executable path. Direct-connect attach
    // sessions (e.g. Ruby/rdbg, Python/debugpy) spawn no local process, so no
    // toolchain lookup runs — a nominal, unverified name keeps the proxy init
    // payload (which requires a non-empty string) satisfied (issue #331).
    const isDirectConnectAttach = isAttachMode && adapter.usesDirectConnectForAttach?.() === true;

    let resolvedExecutablePath: string;
    if (isDirectConnectAttach) {
      resolvedExecutablePath =
        session.executablePath || adapter.getDefaultExecutableName?.() || session.language;
      this.logger.info(
        `[SessionManager] Direct-connect attach for ${session.language}; skipping executable resolution`
      );
    } else {
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

        // On launch, adapters with an attach mode may still work without the
        // local toolchain — point the user at attach_to_process (issue #331)
        const attachHint =
          !isAttachMode && adapter.supportsAttach?.()
            ? ` ${ErrorMessages.attachMayStillWork(session.language)}`
            : '';

        throw new DebugSessionCreationError(
          `Failed to resolve ${session.language} executable: ${msg}${attachHint}`,
          error instanceof Error ? error : undefined
        );
      }
    }

    // Update adapter config with resolved executable path
    adapterConfig.executablePath = resolvedExecutablePath;

    // Build adapter command using the adapter. Direct-connect attach sessions
    // (e.g. Ruby/rdbg) have no adapter process to spawn, so no command is built;
    // the adapter policy connects straight to the attach host/port instead.
    const adapterCommand =
      isAttachMode && adapter.usesDirectConnectForAttach?.()
        ? undefined
        : adapter.buildAdapterCommand(adapterConfig);

    const launchConfigBase =
      transformedLaunchConfig ?? (genericLaunchConfig as LanguageSpecificLaunchConfig);
    const launchConfigData: LanguageSpecificLaunchConfig = { ...launchConfigBase };

    const stopOnEntryProvided = typeof dapLaunchArgs?.stopOnEntry === 'boolean';

    // Let adapter policy override stopOnEntry default when user hasn't specified it.
    // E.g., Go/Delve needs stopOnEntry=false to avoid "unknown goroutine" issues.
    if (!stopOnEntryProvided) {
      const adapterPolicy = this.selectPolicy(session.language);
      const policyDefaults = adapterPolicy.getInitializationBehavior?.();
      /* istanbul ignore next -- adapter-specific: Go/Delve stopOnEntry override */
      if (typeof policyDefaults?.defaultStopOnEntry === 'boolean') {
        launchConfigData.stopOnEntry = policyDefaults.defaultStopOnEntry;
      }
    }

    this.logger.info(
      `[SessionManager] Launch config stopOnEntry adjustments for ${sessionId}: base=${String(
        launchConfigBase?.stopOnEntry
      )}, final=${String(launchConfigData.stopOnEntry)}, userProvided=${String(
        dapLaunchArgs?.stopOnEntry
      )}`
    );

    const stopOnEntryFlag =
      typeof launchConfigData?.stopOnEntry === 'boolean'
        ? launchConfigData.stopOnEntry
        : effectiveLaunchArgs.stopOnEntry;

    const justMyCodeFlag =
      typeof launchConfigData?.justMyCode === 'boolean'
        ? launchConfigData.justMyCode
        : effectiveLaunchArgs.justMyCode;

    // Create ProxyConfig
    const programFromLaunchConfig =
      typeof launchConfigData?.program === 'string' && launchConfigData.program.length > 0
        ? launchConfigData.program
        : scriptPath;

    const argsFromLaunchConfig = Array.isArray(launchConfigData?.args)
      ? (launchConfigData!.args as unknown[]).filter((arg): arg is string => typeof arg === 'string')
      : Array.isArray(scriptArgs)
        ? [...scriptArgs]
        : [];

    const normalizedScriptArgs = argsFromLaunchConfig.length > 0 ? argsFromLaunchConfig : undefined;

    if (initialBreakpoints.length) {
      this.logger.info(
        `[SessionManager] Initial breakpoints for ${sessionId}:`,
        initialBreakpoints.map(bp => ({ file: bp.file, line: bp.line }))
      );
    }

    const proxyConfig: ProxyConfig = {
      sessionId,
      language: session.language, // Add language from session
      executablePath: resolvedExecutablePath,
      adapterHost: '127.0.0.1',
      adapterPort,
      logDir: sessionLogDir,
      scriptPath: programFromLaunchConfig,
      scriptArgs: normalizedScriptArgs,
      stopOnEntry: stopOnEntryFlag,
      justMyCode: justMyCodeFlag,
      initialBreakpoints,
      initialFunctionBreakpoints,
      dryRunSpawn: dryRunSpawn === true,
      breakOnExceptions,
      launchConfig: launchConfigData,
      adapterCommand, // Pass the adapter command
      attachMode: isAttachMode,
    };

    // Create and start ProxyManager with the adapter
    const proxyManager = this.proxyManagerFactory.create(adapter);
    session.proxyManager = proxyManager;

    // Set up event handlers
    this.setupProxyEventHandlers(session, proxyManager, effectiveLaunchArgs);

    // Start the proxy
    await proxyManager.start(proxyConfig);

    return launchConfigData;
  }

  /**
   * Helper method to wait for dry run completion with timeout
   */
  private async waitForDryRunCompletion(
    session: ManagedSession,
    timeoutMs: number
  ): Promise<boolean> {
    if (session.proxyManager?.hasDryRunCompleted?.()) {
      this.logger.info(
        `[SessionManager] Dry run already marked complete for session ${session.id} before wait`
      );
      return true;
    }

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
            if (session.proxyManager?.hasDryRunCompleted?.()) {
              this.logger.info(
                `[SessionManager] Dry run marked complete during timeout window for session ${session.id}`
              );
              resolve(true);
              return;
            }
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
    dryRunSpawn?: boolean,
    adapterLaunchConfig?: Record<string, unknown>,
    breakOnExceptions?: ExceptionBreakMode
  ): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);
    this.logger.info(
      `Attempting to start debugging for session ${sessionId}, script: ${scriptPath}, dryRunSpawn: ${dryRunSpawn}, dapLaunchArgs:`,
      sanitizePayloadForLogging(dapLaunchArgs)
    );

    if (session.proxyManager) {
      // Session-preserving teardown: closeSession here used to REMOVE the
      // session from the store, so the state update below threw
      // SessionNotFoundError and the session was silently destroyed (#238).
      this.logger.warn(
        `[SessionManager] Session ${sessionId} already has an active proxy. Terminating before starting new.`
      );
      await this.stopProxyPreservingSession(session);
    }

    // Update to INITIALIZING state and set lifecycle to ACTIVE
    this._updateSessionState(session, SessionState.INITIALIZING);

    // Explicitly set lifecycle state to ACTIVE when starting debugging.
    // attachMode is cleared: a launch supersedes any prior attach, and a
    // sticky flag would wrongly refuse restart_debugging forever (#238).
    this.sessionStore.update(sessionId, {
      sessionLifecycle: SessionLifecycleState.ACTIVE,
      attachMode: false,
    });
    this.logger.info(`[SessionManager] Session ${sessionId} lifecycle state set to ACTIVE`);

    // Record the launch spec for restart_debugging BEFORE attempting the
    // launch — a start that dies mid-way is still meaningfully replayable.
    // Dry runs are not recorded: lastLaunch means "most recent real launch".
    if (!dryRunSpawn) {
      session.lastLaunch = {
        scriptPath,
        scriptArgs,
        dapLaunchArgs,
        adapterLaunchConfig,
        breakOnExceptions,
        launchedAt: Date.now(),
      };
    }

    try {
      // For dry run, start the proxy and wait for completion
      if (dryRunSpawn) {
        // Mark that we're setting up a dry run handler
        const sessionWithSetup = session as ManagedSession & { _dryRunHandlerSetup?: boolean };
        sessionWithSetup._dryRunHandlerSetup = true;

        // Start the proxy manager
        await this.startProxyManager(session, scriptPath, scriptArgs, dapLaunchArgs, dryRunSpawn, adapterLaunchConfig);
        this.logger.info(`[SessionManager] ProxyManager started for session ${sessionId}`);
        
        // Check if already completed before waiting
        const refreshedSession = this._getSessionById(sessionId);
        this.logger.info(`[SessionManager] Checking state after start: ${refreshedSession.state}`);
        
        const initialDryRunSnapshot = refreshedSession.proxyManager?.getDryRunSnapshot?.();
        const dryRunAlreadyComplete =
          refreshedSession.state === SessionState.STOPPED ||
          refreshedSession.proxyManager?.hasDryRunCompleted?.() === true;

        if (dryRunAlreadyComplete) {
          this.logger.info(
            `[SessionManager] Dry run already completed for session ${sessionId}`
          );
          delete sessionWithSetup._dryRunHandlerSetup;

          return {
            success: true,
            state: SessionState.STOPPED,
            data: {
              dryRun: true,
              message: 'Dry run spawn command logged by proxy.',
              command: initialDryRunSnapshot?.command,
              script: initialDryRunSnapshot?.script,
            },
          };
        }

        // Wait for completion with timeout
        this.logger.info(
          `[SessionManager] Waiting for dry run completion with timeout ${this.dryRunTimeoutMs}ms`
        );
        
        const dryRunCompleted = await this.waitForDryRunCompletion(
          refreshedSession,
          this.dryRunTimeoutMs
        );
        delete sessionWithSetup._dryRunHandlerSetup;

        const latestSessionState = this._getSessionById(sessionId);
        const latestSnapshot =
          latestSessionState.proxyManager?.getDryRunSnapshot?.() ?? initialDryRunSnapshot;
        const effectiveDryRunComplete =
          dryRunCompleted ||
          latestSessionState.state === SessionState.STOPPED ||
          latestSessionState.proxyManager?.hasDryRunCompleted?.() === true;

        if (effectiveDryRunComplete) {
          this.logger.info(
            `[SessionManager] Dry run completed for session ${sessionId}, final state: ${latestSessionState.state}`
          );

          return {
            success: true,
            state: SessionState.STOPPED,
            data: {
              dryRun: true,
              message: 'Dry run spawn command logged by proxy.',
              command: latestSnapshot?.command,
              script: latestSnapshot?.script,
            },
          };
        } else {
          // Timeout occurred
          const finalSession = latestSessionState;
          this.logger.error(
            `[SessionManager] Dry run timeout for session ${sessionId}. ` +
              `State: ${finalSession.state}, ProxyManager active: ${!!finalSession.proxyManager}`
          );

          return {
            success: false,
            error: `Dry run timed out after ${this.dryRunTimeoutMs}ms. Current state: ${finalSession.state}`,
            state: finalSession.state,
          };
        }
      }

      // Normal (non-dry-run) flow
      // Resolve the effective breakOnExceptions mode (issue #244): when the
      // user did not specify one, launch sessions take the adapter policy's
      // default. Attach-shaped configs are excluded — pausing a process you
      // attached to on exceptions is surprising — as are dry runs (above).
      const launchArgsShape = dapLaunchArgs as Record<string, unknown> | undefined;
      const isAttachShaped =
        launchArgsShape?.request === 'attach' || launchArgsShape?.__attachMode === true;
      let effectiveBreakOnExceptions = breakOnExceptions;
      if (effectiveBreakOnExceptions === undefined && !isAttachShaped) {
        const policyDefault = this.selectPolicy(session.language)
          .getInitializationBehavior?.().defaultExceptionBreakMode;
        if (policyDefault) {
          effectiveBreakOnExceptions = policyDefault;
          this.logger.info(
            `[SessionManager] Applying policy default breakOnExceptions='${policyDefault}' for ${session.language} launch session ${sessionId}`
          );
        }
      }
      session.effectiveBreakOnExceptions = effectiveBreakOnExceptions;

      // Start the proxy manager
      const launchConfigData = await this.startProxyManager(session, scriptPath, scriptArgs, dapLaunchArgs, dryRunSpawn, adapterLaunchConfig, effectiveBreakOnExceptions);
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
            breakpoints: session.breakpoints,
            launchConfig: launchConfigData,
            breakOnExceptions: effectiveBreakOnExceptions
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
        // Wait for adapter to be configured, first stop event, or termination
        const waitForReady = new Promise<void>((resolve) => {
          let resolved = false;
          // eslint-disable-next-line prefer-const -- assigned after cleanup/handlers are defined
          let timeoutId: ReturnType<typeof setTimeout> | undefined;

          const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId);
            session.proxyManager?.removeListener('stopped', handleStopped);
            session.proxyManager?.removeListener('adapter-configured', handleConfigured);
            session.proxyManager?.removeListener('terminated', handleTerminated);
            session.proxyManager?.removeListener('exited', handleExited);
            session.proxyManager?.removeListener('exit', handleExit);
          };

          const handleStopped = () => {
            if (!resolved) {
              resolved = true;
              cleanup();
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
              cleanup();
              this.logger.info(
                `[SessionManager] Session ${sessionId} running (stopOnEntry=${dapLaunchArgs?.stopOnEntry ?? false})`
              );
              resolve();
            }
          };

          const handleTerminated = () => {
            if (!resolved) {
              resolved = true;
              cleanup();
              this.logger.info(`[SessionManager] Session ${sessionId} terminated during startup`);
              resolve();
            }
          };

          const handleExited = () => {
            if (!resolved) {
              resolved = true;
              cleanup();
              this.logger.info(`[SessionManager] Session ${sessionId} exited during startup`);
              resolve();
            }
          };

          const handleExit = () => {
            if (!resolved) {
              resolved = true;
              cleanup();
              this.logger.info(`[SessionManager] Session ${sessionId} proxy exited during startup`);
              resolve();
            }
          };

          session.proxyManager?.once('stopped', handleStopped);
          session.proxyManager?.once('adapter-configured', handleConfigured);
          session.proxyManager?.once('terminated', handleTerminated);
          session.proxyManager?.once('exited', handleExited);
          session.proxyManager?.once('exit', handleExit);

          // In case the adapter already reached the desired state before listeners were attached,
          // perform a synchronous state check to avoid waiting for an event that already fired.
          const currentState = this._getSessionById(sessionId).state;
          const readyNow = policy.isSessionReady
            ? policy.isSessionReady(currentState, { stopOnEntry: dapLaunchArgs?.stopOnEntry })
            : currentState === SessionState.PAUSED;
          if (readyNow) {
            resolved = true;
            cleanup();
            resolve();
            return;
          }

          // Also check if already terminated/stopped
          if (currentState === SessionState.STOPPED || currentState === SessionState.ERROR) {
            resolved = true;
            cleanup();
            this.logger.info(`[SessionManager] Session ${sessionId} already ${currentState} - skipping readiness wait`);
            resolve();
            return;
          }

          // Timeout after 30 seconds
          timeoutId = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              cleanup();
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

      // The worker applies initialBreakpoints itself, but its setBreakpoints
      // responses never reach this store — without a re-sync, pre-launch
      // breakpoints would stay verified:false forever on adapters that don't
      // push breakpoint events (issue #236). Replace-all with the identical
      // set is idempotent; syncBreakpointsForFile no-ops unless live.
      if (finalSession.breakpoints.size > 0 &&
          (finalState === SessionState.RUNNING || finalState === SessionState.PAUSED)) {
        const files = [...new Set(Array.from(finalSession.breakpoints.values()).map(bp => bp.file))];
        for (const file of files) {
          await this.syncBreakpointsForFile(finalSession, file);
        }
      }
      // Same re-sync for function breakpoints (issue #271 phase 3): the
      // worker's initial send's responses never reach this store either.
      if ((finalSession.functionBreakpoints?.size ?? 0) > 0 &&
          (finalState === SessionState.RUNNING || finalState === SessionState.PAUSED)) {
        await this.syncFunctionBreakpoints(finalSession);
      }

      // Unbound-at-launch warning (issue #308): the verified state is fresh
      // after the re-sync above, so a name the adapter could not resolve is
      // reported here instead of failing silently at "the program never
      // stopped". Suppressed for bind-late adapters (js/java), where
      // unverified-at-launch is the designed deferral path.
      const fnBpWarning = this.buildFunctionBreakpointLaunchWarning(finalSession);

      this.logger.info(
        `[SessionManager] Debugging started for session ${sessionId}. State: ${finalState}`
      );

      return {
        success: true,
        state: finalState,
        data: {
          ...(fnBpWarning ? { warning: fnBpWarning } : {}),
          message: `Debugging started for ${scriptPath}. Current state: ${finalState}`,
          // Prefer the actual DAP stop reason (issue #214) — the first stop is
          // not always a breakpoint (e.g. an uncaught exception before any
          // breakpoint is hit). handleStopped records lastStop synchronously
          // before every user-visible PAUSED transition, so PAUSED without
          // lastStop is only the auto-continue transient (an entry stop being
          // auto-continued); report 'unknown' rather than fabricating
          // 'breakpoint' there (issue #255 residual).
          reason:
            finalState === SessionState.PAUSED
              ? finalSession.lastStop?.reason ??
                (dapLaunchArgs?.stopOnEntry ? 'entry' : 'unknown')
              : undefined,
          stopOnEntrySuccessful: !!dapLaunchArgs?.stopOnEntry && finalState === SessionState.PAUSED,
        },
      };
    } catch (error) {
      // Attempt to capture proxy log tail for debugging initialization failures
      let proxyLogTail: string | undefined;
      let proxyLogPath: string | undefined;
      try {
        const latestSession = this._getSessionById(sessionId);
        if (latestSession.logDir) {
          proxyLogPath = path.join(latestSession.logDir, `proxy-${sessionId}.log`);
          const logExists = await this.fileSystem.pathExists(proxyLogPath);
          if (logExists) {
            const logContent = await this.fileSystem.readFile(proxyLogPath, 'utf-8');
            const logLines = logContent.split(/\r?\n/);
            const tailLineCount = 80;
            const startIndex = Math.max(0, logLines.length - tailLineCount);
            proxyLogTail = logLines.slice(startIndex).join('\n');
          }
        }
      } catch (logReadError) {
        proxyLogTail = `<<Failed to read proxy log: ${
          logReadError instanceof Error ? logReadError.message : String(logReadError)
        }>>`;
      }

      // Comprehensive error capture for debugging Windows CI issues
      const errorDetails: Record<string, unknown> = {
        type: error?.constructor?.name || 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack available',
        code: (error as Record<string, unknown>)?.code,
        errno: (error as Record<string, unknown>)?.errno,
        syscall: (error as Record<string, unknown>)?.syscall,
        path: (error as Record<string, unknown>)?.path,
        toString: error?.toString ? error.toString() : 'No toString',
        proxyLogPath,
        proxyLogTail
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
      
      const errorMessage = error instanceof Error ? error.message : String(error);

      const toolchainValidation =
        (error as { toolchainValidation?: ToolchainValidationState })?.toolchainValidation ??
        session.toolchainValidation;
      const incompatibleToolchain =
        Boolean(toolchainValidation) && toolchainValidation?.compatible === false;

      if (incompatibleToolchain) {
        this._updateSessionState(session, SessionState.CREATED);
        this.sessionStore.update(sessionId, {
          sessionLifecycle: SessionLifecycleState.CREATED,
        });
      } else {
        this._updateSessionState(session, SessionState.ERROR);
      }

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

      if (incompatibleToolchain && toolchainValidation) {
        const behavior = (toolchainValidation.behavior ?? 'warn').toLowerCase();
        const canContinue = behavior !== 'error';
        const updatedSession = this._getSessionById(sessionId);
        return {
          success: false,
          error: 'MSVC_TOOLCHAIN_DETECTED',
          state: updatedSession.state,
          data: {
            message: toolchainValidation.message ?? errorMessage,
            toolchainValidation,
          },
          canContinue,
          errorType,
          errorCode,
        };
      }

      return { success: false, error: errorMessage, state: session.state, errorType, errorCode };
    }
  }


  /** Sessions with a restart currently in flight (reentrancy guard, #238) */
  private restartingSessions = new Set<string>();

  /**
   * Restart the debuggee: terminate the current program (if any) and replay
   * the last real launch with the same configuration. Breakpoints re-apply
   * automatically via the initialBreakpoints snapshot; the output buffer
   * starts fresh (read from since=0). Terminate+relaunch is used uniformly —
   * no adapter advertises native DAP restart, and the spec blesses the
   * emulation — so every launch-mode language works with no per-adapter
   * wiring (issue #238).
   */
  async restartDebugging(sessionId: string): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);

    if (session.attachMode) {
      return {
        success: false,
        state: session.state,
        error: 'Cannot restart an attach session: there is no launch configuration to replay. Detach and re-attach instead.'
      };
    }
    if (!session.lastLaunch) {
      return {
        success: false,
        state: session.state,
        error: 'Nothing to restart: this session has not been launched (start_debugging has not run, or only a dry run was performed).'
      };
    }
    if (this.restartingSessions.has(sessionId)) {
      return {
        success: false,
        state: session.state,
        error: 'A restart is already in progress for this session.'
      };
    }
    if (session.state === SessionState.INITIALIZING) {
      return {
        success: false,
        state: session.state,
        error: 'Session is still initializing; wait for the current start to complete before restarting.'
      };
    }

    this.restartingSessions.add(sessionId);
    try {
      // Content anchors re-resolve BEFORE the relaunch snapshots
      // initialBreakpoints, so breakpoints survive the edit that was the
      // point of the session (issue #271).
      const anchorResolution = await this.reresolveAnchors(session);

      const spec = session.lastLaunch;
      this.logger.info(
        `[SessionManager] Restarting session ${sessionId}: replaying launch of ${spec.scriptPath}`
      );
      const result = await this.startDebugging(
        sessionId,
        spec.scriptPath,
        spec.scriptArgs,
        spec.dapLaunchArgs,
        false, // never replay as a dry run
        spec.adapterLaunchConfig,
        spec.breakOnExceptions
      );
      if (result.success) {
        const staleCount = anchorResolution?.stale.length ?? 0;
        // Stamp stale-anchor notes AFTER the relaunch: the per-launch
        // breakpoint state reset (#238) clears message on every new launch,
        // and a real adapter message should still win over ours.
        if (anchorResolution) {
          const bps = this._getSessionById(sessionId).breakpoints;
          for (const staleEntry of anchorResolution.stale) {
            const bp = bps.get(staleEntry.breakpointId);
            if (bp && !bp.message) {
              bp.message = `Anchor "${staleEntry.statement}" not found at restart; breakpoint kept at last known line ${staleEntry.line}`;
            }
          }
        }
        // Join rather than clobber: startDebugging may already have set a
        // warning (unbound function breakpoints, issue #308).
        const priorWarning = (result.data as { warning?: string } | undefined)?.warning;
        const staleWarning = staleCount > 0
          ? `${staleCount} statement anchor(s) no longer match the current file; those breakpoints kept their previous lines — re-set them if the target moved.`
          : undefined;
        const warnings = [priorWarning, staleWarning].filter(Boolean);
        result.data = {
          ...((result.data as object) ?? {}),
          breakpointsReapplied: this._getSessionById(sessionId).breakpoints.size,
          // Each launch starts a fresh output buffer: tell the caller to
          // reset its get_output cursor to since=0.
          outputReset: true,
          ...(anchorResolution ? { anchorResolution } : {}),
          ...(warnings.length > 0 ? { warning: warnings.join('; ') } : {}),
        };
      }
      return result;
    } finally {
      this.restartingSessions.delete(sessionId);
    }
  }

  /**
   * Re-resolve statement-anchored breakpoints against the current file
   * contents (fresh read — deliberately not the server's LineReader cache).
   * The breakpoint's current line doubles as the nearLine hint so duplicate
   * statements re-anchor to the nearest occurrence of where the breakpoint
   * last was. Anchors that no longer match keep their stale line and warn:
   * failing the restart would block the edit-relaunch loop, and dropping the
   * breakpoint would destroy user state (issue #271).
   */
  private async reresolveAnchors(session: ManagedSession): Promise<
    | {
        moved: Array<{ breakpointId: string; file: string; from: number; to: number; statement: string }>;
        stale: Array<{ breakpointId: string; file: string; line: number; statement: string; reason: string }>;
      }
    | undefined
  > {
    const anchored = Array.from(session.breakpoints.values()).filter(
      (bp): bp is Breakpoint & { anchor: { statement: string; nearLine?: number } } => bp.anchor !== undefined
    );
    if (anchored.length === 0) {
      return undefined;
    }

    const moved: Array<{ breakpointId: string; file: string; from: number; to: number; statement: string }> = [];
    const stale: Array<{ breakpointId: string; file: string; line: number; statement: string; reason: string }> = [];

    const byFile = new Map<string, typeof anchored>();
    for (const bp of anchored) {
      const group = byFile.get(bp.file);
      if (group) {
        group.push(bp);
      } else {
        byFile.set(bp.file, [bp]);
      }
    }

    for (const [file, bps] of byFile) {
      let lines: string[] | null = null;
      try {
        const content = await this.fileSystem.readFile(file, 'utf8');
        lines = content.split(/\r?\n/);
      } catch (error) {
        this.logger.warn(
          `[SessionManager] Could not re-read ${file} for anchor re-resolution: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      for (const bp of bps) {
        if (!lines) {
          stale.push({
            breakpointId: bp.id,
            file,
            line: bp.line,
            statement: bp.anchor.statement,
            reason: 'file unreadable',
          });
          continue;
        }
        const resolution = resolveStatement(lines, bp.anchor.statement, file, bp.line);
        if (resolution.ok) {
          if (resolution.line !== bp.line) {
            moved.push({
              breakpointId: bp.id,
              file,
              from: bp.line,
              to: resolution.line,
              statement: bp.anchor.statement,
            });
            this.logger.info(
              `[SessionManager] Anchor re-resolved: breakpoint ${bp.id} moved ${bp.line} -> ${resolution.line} ("${bp.anchor.statement}")`
            );
            bp.line = resolution.line;
            bp.requestedLine = resolution.line;
          }
        } else {
          stale.push({
            breakpointId: bp.id,
            file,
            line: bp.line,
            statement: bp.anchor.statement,
            reason: 'statement not found',
          });
        }
      }
    }

    return { moved, stale };
  }

  async setBreakpoint(
    sessionId: string,
    bp: {
      /** Validated/translated by server.ts before reaching here */
      file: string;
      /** Resolved line (anchors are resolved to a line in the server layer) */
      line: number;
      condition?: string;
      suspendPolicy?: 'all' | 'thread';
      logMessage?: string;
      /** Set only in assert/content addressing modes (loud snapping, #271) */
      requestedLine?: number;
      /** Content anchor for restart re-resolution (content mode, #271) */
      anchor?: { statement: string; nearLine?: number };
    }
  ): Promise<{ breakpoint: Breakpoint; warning?: string }> {
    const session = this._getSessionById(sessionId);

    // Check if session is terminated
    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

    const bpId = uuidv4();

    this.logger.info(
      `[SessionManager setBreakpoint] Using validated file path "${bp.file}" for session ${sessionId}`
    );

    const newBreakpoint: Breakpoint = {
      id: bpId,
      file: bp.file,
      line: bp.line,
      condition: bp.condition,
      suspendPolicy: bp.suspendPolicy,
      logMessage: bp.logMessage,
      verified: false
    };
    if (bp.requestedLine !== undefined) {
      newBreakpoint.requestedLine = bp.requestedLine;
    }
    if (bp.anchor !== undefined) {
      newBreakpoint.anchor = bp.anchor;
    }

    if (!session.breakpoints) session.breakpoints = new Map();
    session.breakpoints.set(bpId, newBreakpoint);
    this.logger.info(
      `[SessionManager] Breakpoint ${bpId} queued for ${bp.file}:${bp.line} in session ${sessionId}.`
    );

    const sync = await this.syncBreakpointsForFile(session, bp.file);
    return { breakpoint: newBreakpoint, warning: sync.warning };
  }

  /**
   * Re-send the session's full breakpoint set for one file to the adapter
   * (DAP setBreakpoints is replace-all per file) and merge the response back
   * into the stored breakpoints (positional match). No-op unless the proxy is
   * live and the session is RUNNING or PAUSED. Never throws: a DAP failure is
   * logged and reported via `warning` — the store remains the source of truth
   * and the set is re-applied on the next launch.
   */
  protected async syncBreakpointsForFile(
    session: ManagedSession,
    file: string
  ): Promise<{ synced: boolean; warning?: string }> {
    const sessionId = session.id;
    if (
      !session.proxyManager ||
      !session.proxyManager.isRunning() ||
      (session.state !== SessionState.RUNNING && session.state !== SessionState.PAUSED)
    ) {
      return { synced: false };
    }

    // Collect ALL breakpoints for this source file (DAP setBreakpoints is replace-all)
    const allBpsForFile = Array.from(session.breakpoints.values())
      .filter(bp => bp.file === file);

    try {
      this.logger.info(
        `[SessionManager] Active proxy for session ${sessionId}, sending ${allBpsForFile.length} breakpoint(s) for ${file}.`
      );
      const response =
        await session.proxyManager.sendDapRequest<DebugProtocol.SetBreakpointsResponse>(
          'setBreakpoints',
          {
            source: { path: file },
            breakpoints: allBpsForFile.map(toSourceBreakpoint),
          }
        );
      if (
        response &&
        response.body &&
        response.body.breakpoints
      ) {
        const responseBps = response.body.breakpoints;
        // For child-mirroring adapters (js-debug), setBreakpoints responses
        // come from the parent session, which owns no runtime: its verified
        // flags are pessimistic and its ids belong to a different id space
        // than the child events that carry the real verification. Treat the
        // child as authoritative — never let a parent response downgrade
        // verified state or clobber child adapter ids.
        const childAuthoritative =
          !!this.selectPolicy(session.language)?.getDapClientBehavior?.().mirrorBreakpointsToChild;
        // Update ALL breakpoints from response (positional match)
        for (let i = 0; i < Math.min(responseBps.length, allBpsForFile.length); i++) {
          const bpInfo = responseBps[i];
          const keepChildState = childAuthoritative && allBpsForFile[i].verified === true;
          if (childAuthoritative) {
            allBpsForFile[i].verified = allBpsForFile[i].verified || bpInfo.verified;
          } else {
            allBpsForFile[i].verified = bpInfo.verified;
            allBpsForFile[i].adapterId = bpInfo.id ?? allBpsForFile[i].adapterId;
          }
          allBpsForFile[i].line = bpInfo.line || allBpsForFile[i].line;
          if (!keepChildState) {
            allBpsForFile[i].message = bpInfo.message;
          }
          // Enhance "no symbols" message for .NET with PDB format guidance
          if (bpInfo.message && session.language === 'dotnet' &&
              bpInfo.message.toLowerCase().includes('no symbols')) {
            allBpsForFile[i].message += ' (Hint: netcoredbg requires Portable PDB format. Compile with /debug:portable or convert with Pdb2Pdb.)';
          }
          this.logger.info(
            `[SessionManager] Breakpoint ${allBpsForFile[i].id} response received. Verified: ${allBpsForFile[i].verified}${
              bpInfo.message ? `, Message: ${bpInfo.message}` : ''
            }`
          );

          // Log breakpoint verification with structured logging
          if (allBpsForFile[i].verified) {
            this.logger.info('debug:breakpoint', {
              event: 'verified',
              sessionId: sessionId,
              sessionName: session.name,
              breakpointId: allBpsForFile[i].id,
              file: allBpsForFile[i].file,
              line: allBpsForFile[i].line,
              verified: true,
              timestamp: Date.now(),
            });
          }
        }
      }
      return { synced: true };
    } catch (error) {
      this.logger.error(
        `[SessionManager] Error sending setBreakpoints to proxy for session ${sessionId}:`,
        error
      );
      const message = error instanceof Error ? error.message : String(error);
      return { synced: false, warning: this.buildLiveSyncWarning(session, message) };
    }
  }

  /**
   * Compose the live-sync failure warning. For ruby attach sessions whose
   * error is rdbg's "<path> is not available", append topology guidance
   * (issue #357): the path was rejected on the debug TARGET's filesystem
   * (e.g. container server + host rdbg, or vice versa) — expected behavior,
   * not a debugger fault. Same hint-append style as the netcoredbg
   * no-symbols guidance above.
   */
  private buildLiveSyncWarning(session: ManagedSession, message: string): string {
    let warning = `Breakpoint state updated, but live sync failed: ${message}`;
    if (session.attachMode && session.language === 'ruby' && /is not available/.test(message)) {
      warning += ' (Hint: attach sessions send breakpoint paths to the remote debugger verbatim; the path must be valid on the debug target\'s filesystem. Use target-side paths, or pass localfsMap in the attach config to map local paths to remote ones.)';
    }
    return warning;
  }

  /**
   * Set a function (symbol-addressed) breakpoint (issue #271 phase 3).
   * Session-global — no file. Queued like line breakpoints when no debuggee
   * is live; synced immediately otherwise.
   */
  async setFunctionBreakpoint(
    sessionId: string,
    bp: {
      functionName: string;
      condition?: string;
    }
  ): Promise<{ breakpoint: FunctionBreakpoint; warning?: string }> {
    const session = this._getSessionById(sessionId);

    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

    const newBreakpoint: FunctionBreakpoint = {
      id: uuidv4(),
      functionName: bp.functionName,
      condition: bp.condition,
      verified: false
    };

    if (!session.functionBreakpoints) session.functionBreakpoints = new Map();
    session.functionBreakpoints.set(newBreakpoint.id, newBreakpoint);
    this.logger.info(
      `[SessionManager] Function breakpoint ${newBreakpoint.id} queued for ${bp.functionName} in session ${sessionId}.`
    );

    const sync = await this.syncFunctionBreakpoints(session);
    return { breakpoint: newBreakpoint, warning: sync.warning };
  }

  /**
   * Re-send the session's FULL function-breakpoint set to the adapter (DAP
   * setFunctionBreakpoints is replace-all for the whole session, not per
   * file). Same live-session guard and never-throws contract as
   * syncBreakpointsForFile.
   */
  protected async syncFunctionBreakpoints(
    session: ManagedSession
  ): Promise<{ synced: boolean; warning?: string }> {
    const sessionId = session.id;
    if (
      !session.proxyManager ||
      !session.proxyManager.isRunning() ||
      (session.state !== SessionState.RUNNING && session.state !== SessionState.PAUSED)
    ) {
      return { synced: false };
    }

    const allFnBps = Array.from(session.functionBreakpoints.values());

    try {
      this.logger.info(
        `[SessionManager] Active proxy for session ${sessionId}, sending ${allFnBps.length} function breakpoint(s).`
      );
      const response =
        await session.proxyManager.sendDapRequest<DebugProtocol.SetFunctionBreakpointsResponse>(
          'setFunctionBreakpoints',
          { breakpoints: allFnBps.map(toFunctionBreakpoint) }
        );
      const responseBps = response?.body?.breakpoints;
      if (responseBps) {
        // Positional match, same DAP guarantee as setBreakpoints
        for (let i = 0; i < Math.min(responseBps.length, allFnBps.length); i++) {
          const bpInfo = responseBps[i];
          allFnBps[i].verified = bpInfo.verified;
          allFnBps[i].adapterId = bpInfo.id ?? allFnBps[i].adapterId;
          allFnBps[i].message = bpInfo.message;
          if (typeof bpInfo.line === 'number') {
            allFnBps[i].boundLine = bpInfo.line;
          }
          if (bpInfo.source?.path) {
            allFnBps[i].boundFile = bpInfo.source.path;
          }
          if (allFnBps[i].verified) {
            this.logger.info('debug:breakpoint', {
              event: 'verified',
              sessionId,
              sessionName: session.name,
              breakpointId: allFnBps[i].id,
              functionName: allFnBps[i].functionName,
              line: allFnBps[i].boundLine,
              verified: true,
              timestamp: Date.now(),
            });
          }
        }
      }
      return { synced: true };
    } catch (error) {
      this.logger.error(
        `[SessionManager] Error sending setFunctionBreakpoints to proxy for session ${sessionId}:`,
        error
      );
      const message = error instanceof Error ? error.message : String(error);
      return { synced: false, warning: this.buildLiveSyncWarning(session, message) };
    }
  }

  /**
   * Launch-time unbound-function-breakpoint warning (issue #308). Called
   * after the post-launch re-sync, when verified state is fresh. Returns
   * undefined for bind-late policies (js/java) — unverified-at-launch is
   * their designed deferral, not a failure.
   */
  protected buildFunctionBreakpointLaunchWarning(session: ManagedSession): string | undefined {
    if ((session.functionBreakpoints?.size ?? 0) === 0) {
      return undefined;
    }
    let policy: AdapterPolicy | undefined;
    try {
      policy = this.sessionStore.selectPolicy(session.language);
    } catch {
      policy = undefined;
    }
    if (policy?.functionBreakpointsBindLate === true) {
      return undefined;
    }
    const parts: string[] = [];
    for (const bp of session.functionBreakpoints.values()) {
      if (bp.verified) {
        continue;
      }
      const hint = policy?.functionBreakpointNameHint?.(bp.functionName) ?? bp.message;
      parts.push(`'${bp.functionName}'${hint ? ` (${hint})` : ''}`);
    }
    if (parts.length === 0) {
      return undefined;
    }
    return (
      `Function breakpoint(s) not bound at launch: ${parts.join('; ')}. ` +
      `The adapter could not resolve the name, so the program will not stop there — ` +
      `check the symbol name; list_breakpoints shows the current state`
    );
  }

  /**
   * Remove one breakpoint by its id (the id returned by setBreakpoint).
   * The removal always takes effect in the session's breakpoint store; if the
   * debuggee is live the file's remaining set is re-sent immediately.
   * Deliberately works after the debuggee exits — the surviving set is
   * re-applied on the next launch. Checks line and function breakpoints
   * alike (shared UUID namespace).
   */
  async removeBreakpoint(
    sessionId: string,
    breakpointId: string
  ): Promise<{ removed?: Breakpoint | FunctionBreakpoint; warning?: string }> {
    const session = this._getSessionById(sessionId);

    const functionBreakpoint = session.functionBreakpoints?.get(breakpointId);
    if (functionBreakpoint) {
      session.functionBreakpoints.delete(breakpointId);
      this.logger.info('debug:breakpoint', {
        event: 'removed',
        sessionId,
        sessionName: session.name,
        breakpointId,
        functionName: functionBreakpoint.functionName,
        timestamp: Date.now(),
      });
      const { warning } = await this.syncFunctionBreakpoints(session);
      return { removed: functionBreakpoint, warning };
    }

    const breakpoint = session.breakpoints.get(breakpointId);
    if (!breakpoint) {
      return { removed: undefined };
    }

    session.breakpoints.delete(breakpointId);
    this.logger.info('debug:breakpoint', {
      event: 'removed',
      sessionId,
      sessionName: session.name,
      breakpointId,
      file: breakpoint.file,
      line: breakpoint.line,
      timestamp: Date.now(),
    });

    const { warning } = await this.syncBreakpointsForFile(session, breakpoint.file);
    return { removed: breakpoint, warning };
  }

  /**
   * Remove ALL breakpoints at a file:line location (duplicates at one line —
   * e.g. with different conditions — are removed together; DAP replace-all
   * semantics cannot distinguish them anyway). Same lifecycle behavior as
   * removeBreakpoint.
   */
  async removeBreakpointsByLocation(
    sessionId: string,
    file: string,
    line: number
  ): Promise<{ removed: Breakpoint[]; warning?: string }> {
    const session = this._getSessionById(sessionId);

    const removed = Array.from(session.breakpoints.values())
      .filter(bp => bp.file === file && bp.line === line);
    if (removed.length === 0) {
      return { removed: [] };
    }

    for (const bp of removed) {
      session.breakpoints.delete(bp.id);
      this.logger.info('debug:breakpoint', {
        event: 'removed',
        sessionId,
        sessionName: session.name,
        breakpointId: bp.id,
        file: bp.file,
        line: bp.line,
        timestamp: Date.now(),
      });
    }

    const { warning } = await this.syncBreakpointsForFile(session, file);
    return { removed, warning };
  }

  /**
   * Remove all of the session's breakpoints, or all breakpoints in one file.
   * Clearing zero breakpoints is success, not an error. Works in every
   * lifecycle state; live sessions get one empty/remaining setBreakpoints
   * re-send per affected file.
   */
  async clearBreakpoints(
    sessionId: string,
    file?: string
  ): Promise<{ cleared: number; files: string[]; warning?: string }> {
    const session = this._getSessionById(sessionId);

    const toClear = Array.from(session.breakpoints.values())
      .filter(bp => file === undefined || bp.file === file);
    const files = [...new Set(toClear.map(bp => bp.file))];

    // Function breakpoints are not file-scoped: only an unscoped clear
    // touches them (issue #271 phase 3).
    const fnToClear = file === undefined
      ? Array.from(session.functionBreakpoints?.values() ?? [])
      : [];

    for (const bp of toClear) {
      session.breakpoints.delete(bp.id);
    }
    for (const bp of fnToClear) {
      session.functionBreakpoints.delete(bp.id);
    }
    if (toClear.length > 0 || fnToClear.length > 0) {
      this.logger.info('debug:breakpoint', {
        event: 'cleared',
        sessionId,
        sessionName: session.name,
        cleared: toClear.length + fnToClear.length,
        files,
        functionBreakpoints: fnToClear.length,
        timestamp: Date.now(),
      });
    }

    const warnings: string[] = [];
    for (const clearedFile of files) {
      const { warning } = await this.syncBreakpointsForFile(session, clearedFile);
      if (warning) warnings.push(warning);
    }
    if (fnToClear.length > 0) {
      const { warning } = await this.syncFunctionBreakpoints(session);
      if (warning) warnings.push(warning);
    }

    return {
      cleared: toClear.length + fnToClear.length,
      files,
      ...(warnings.length > 0 ? { warning: warnings.join('; ') } : {})
    };
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

      const success = (message: string, location?: { file: string; line: number; column?: number }) => {
        this.logger.info(`[SM ${options.logTag} ${sessionId}] ${message} Current state: ${session.state}`);
        const data: { message: string; location?: { file: string; line: number; column?: number } } = { message };
        if (location) {
          data.location = location;
        }
        settle({
          success: true,
          state: session.state,
          data,
        });
      };

      const onStopped = async () => {
        // Try to get current location from stack trace
        let location: { file: string; line: number; column?: number } | undefined;
        try {
          // Wait a brief moment for state to settle after stopped event
          await new Promise(resolve => setTimeout(resolve, 10));

          const stackFrames = await this.getStackTrace(sessionId);
          if (stackFrames && stackFrames.length > 0) {
            const topFrame = stackFrames[0];
            location = {
              file: topFrame.file,
              line: topFrame.line,
              column: topFrame.column
            };
            this.logger.debug(`[SM ${options.logTag} ${sessionId}] Captured location: ${location.file}:${location.line}`);
          }
        } catch (error) {
          // Log but don't fail the step operation if we can't get location
          this.logger.debug(`[SM ${options.logTag} ${sessionId}] Could not capture location:`, error);
        }
        success(options.successMessage, location);
      };

      const onTerminated = () => success(terminatedMessage);
      const onExited = () => success(exitedMessage);
      const onExit = () => success(exitedMessage);

      const timeout = setTimeout(() => {
        this.logger.info(
          `[SM ${options.logTag} ${sessionId}] Step still running after ${this.stepGraceMs}ms grace window; completing asynchronously`
        );
        settle({
          success: true,
          state: session.state,
          data: {
            message: ErrorMessages.stepStillRunning(this.stepGraceMs / 1000),
            pending: true,
          },
        });
      }, this.stepGraceMs);

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
      // Set RUNNING *before* sending the DAP request so that concurrent
      // operations (e.g. getStackTrace polling) see the correct state.
      // If a breakpoint fires during the await, the handleStopped callback
      // will set state back to PAUSED before the await resolves.
      this._updateSessionState(session, SessionState.RUNNING);
      await session.proxyManager.sendDapRequest('continue', { threadId });

      this.logger.info(
        `[SessionManager continue] DAP 'continue' sent, session ${sessionId} state is ${session.state}.`
      );
      return { success: true, state: session.state };
    } catch (error) {
      // Revert to PAUSED — the VM didn't actually resume
      this._updateSessionState(session, SessionState.PAUSED);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[SessionManager continue] Error sending 'continue' to proxy for session ${sessionId}: ${errorMessage}`
      );
      throw error;
    }
  }

  async pause(sessionId: string, threadId?: number): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);

    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

    this.logger.info(
      `[SessionManager pause] Called for session ${sessionId}. Current state: ${session.state}`
    );

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      throw new ProxyNotRunningError(sessionId, 'pause');
    }

    if (session.state === SessionState.PAUSED) {
      return {
        success: true,
        state: session.state,
        data: {
          message: 'Already paused',
          ...(session.lastStop?.reason ? { stopReason: session.lastStop.reason } : {}),
          ...(session.lastStop?.rawReason ? { rawStopReason: session.lastStop.rawReason } : {})
        }
      };
    }

    if (session.state !== SessionState.RUNNING) {
      return { success: false, error: `Cannot pause in state: ${session.state}`, state: session.state };
    }

    this.logger.debug(`[SessionManager] pauseExecution: sending DAP pause for session=${sessionId} currentState=${session.state}`);
    // DAP pause request: threadId 0 should pause all threads per DAP spec,
    // but some adapters (e.g. netcoredbg) reject threadId=0 with E_INVALIDARG.
    // When no explicit threadId is provided, discover one via a threads request.
    let effectiveThreadId = threadId ?? 0;
    if (effectiveThreadId === 0) {
      try {
        const threadsResp = await session.proxyManager.sendDapRequest<DebugProtocol.ThreadsResponse>('threads', {});
        const threads = threadsResp?.body?.threads;
        if (Array.isArray(threads) && threads.length > 0 && typeof threads[0]?.id === 'number') {
          effectiveThreadId = threads[0].id;
          this.logger.info(`[SessionManager pause] Auto-discovered threadId=${effectiveThreadId} for pause`);
        }
      } catch {
        // threads request failed — fall through with threadId=0
      }
    }

    const proxyManager = session.proxyManager;

    // Snapshot the current lastStop so result paths can tell whether the stop
    // they observe belongs to THIS pause (handleStopped replaces the object)
    // rather than reporting a stale earlier stop.
    const lastStopBefore = session.lastStop;
    // Flag the in-flight pause so policy stop-reason normalization can use it
    // (e.g. CodeLLDB reports pauses as 'exception'/SIGSTOP). handleStopped
    // clears it on every stop; clear it here too on error/terminate paths.
    session.pausePending = true;

    // The pause response only acknowledges the request; the state transition
    // to PAUSED happens when the asynchronous 'stopped' event is handled by
    // the core handleStopped listener. Adapters differ on whether the event
    // arrives before or after the response, so listen for it (registered
    // BEFORE sending the request) and only settle once the stop is observed.
    return new Promise<DebugResult>((resolve, reject) => {
      let settled = false;
      let stopEventSeen = false;

      const cleanup = () => {
        proxyManager.off('stopped', onStopped);
        proxyManager.off('terminated', onEnded);
        proxyManager.off('exited', onEnded);
        proxyManager.off('exit', onEnded);
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

      const onStopped = async () => {
        stopEventSeen = true;
        // Try to get current location from stack trace
        let location: { file: string; line: number; column?: number } | undefined;
        try {
          // Wait a brief moment for state to settle after stopped event
          await new Promise(resolve => setTimeout(resolve, 10));

          const stackFrames = await this.getStackTrace(sessionId);
          if (stackFrames && stackFrames.length > 0) {
            const topFrame = stackFrames[0];
            location = {
              file: topFrame.file,
              line: topFrame.line,
              column: topFrame.column
            };
          }
        } catch (error) {
          this.logger.debug(`[SessionManager pause ${sessionId}] Could not capture location:`, error);
        }
        this.logger.info(
          `[SessionManager pause] Paused session ${sessionId}. Current state: ${session.state}`
        );
        const data: {
          message: string;
          stopReason?: string;
          rawStopReason?: string;
          location?: { file: string; line: number; column?: number };
        } = { message: 'Paused' };
        // Only report the stop reason when handleStopped recorded a NEW stop
        // for this pause — never echo a stale earlier stop.
        if (session.lastStop && session.lastStop !== lastStopBefore) {
          data.stopReason = session.lastStop.reason;
          if (session.lastStop.rawReason) {
            data.rawStopReason = session.lastStop.rawReason;
          }
        }
        if (location) {
          data.location = location;
        }
        settle({ success: true, state: session.state, data });
      };

      const onEnded = () => {
        session.pausePending = false;
        settle({
          success: true,
          state: session.state,
          data: { message: 'Session ended before pause took effect' }
        });
      };

      const timeout = setTimeout(() => {
        this.logger.info(
          `[SessionManager pause] No stopped event within ${this.pauseGraceMs}ms grace window in session ${sessionId}; completing asynchronously`
        );
        settle({
          success: true,
          state: session.state,
          data: {
            message: ErrorMessages.pausePending(this.pauseGraceMs / 1000),
            pending: true,
          },
        });
      }, this.pauseGraceMs);

      proxyManager.on('stopped', onStopped);
      proxyManager.on('terminated', onEnded);
      proxyManager.on('exited', onEnded);
      proxyManager.on('exit', onEnded);

      proxyManager
        .sendDapRequest('pause', { threadId: effectiveThreadId })
        .then(() => {
          this.logger.info(
            `[SessionManager pause] DAP 'pause' sent for session ${sessionId}. Waiting for stopped event.`
          );
          // Guard: if the stopped event fired before the listeners above were
          // registered (e.g. during the threads-discovery await), the state is
          // already PAUSED and no further event will arrive.
          if (session.state === SessionState.PAUSED && !stopEventSeen) {
            const raceData: { message: string; stopReason?: string; rawStopReason?: string } = { message: 'Paused' };
            if (session.lastStop && session.lastStop !== lastStopBefore) {
              raceData.stopReason = session.lastStop.reason;
              if (session.lastStop.rawReason) {
                raceData.rawStopReason = session.lastStop.rawReason;
              }
            }
            settle({ success: true, state: session.state, data: raceData });
          }
        })
        .catch((error: unknown) => {
          session.pausePending = false;
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `[SessionManager pause] Error sending 'pause' for session ${sessionId}: ${errorMessage}`
          );
          if (!settled) {
            settled = true;
            cleanup();
            reject(error instanceof Error ? error : new Error(errorMessage));
          }
        });
    });
  }

  async listThreads(sessionId: string): Promise<Array<{ id: number; name: string }>> {
    const session = this._getSessionById(sessionId);

    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      throw new ProxyNotRunningError(sessionId, 'listThreads');
    }

    const response = await session.proxyManager.sendDapRequest<DebugProtocol.ThreadsResponse>('threads', {});
    // A failed DAP response must not be flattened into an empty-but-successful
    // thread list (issue #124): propagate the failure to the caller.
    if (response?.success === false) {
      throw new Error(response.message || `DAP 'threads' request failed`);
    }
    return (response?.body?.threads ?? []).map(t => ({ id: t.id, name: t.name }));
  }

  /**
   * Helper method to truncate long strings for logging
   */
  private truncateForLog(value: string, maxLength: number = 1000): string {
    if (!value) return '';
    return value.length > maxLength ? value.substring(0, maxLength) + '... (truncated)' : value;
  }

  /**
   * The "variable name" an evaluate expression stands for, for name-based
   * redaction (issue #237): the whole expression when it is itself a
   * sensitive name, otherwise its final dot-segment — so `config.password`
   * is treated like the variable `password`.
   */
  protected static expressionNameForRedaction(expression: string): string {
    const trimmed = expression.trim();
    if (isSensitiveName(trimmed)) {
      return trimmed;
    }
    const lastDot = trimmed.lastIndexOf('.');
    return lastDot >= 0 ? trimmed.slice(lastDot + 1) : trimmed;
  }

  /** Upper bound for caller-supplied per-request DAP timeouts (10 minutes). */
  private static readonly MAX_DAP_TIMEOUT_MS = 600000;

  /**
   * Validate and clamp a caller-supplied per-request DAP timeout override (ms).
   * Returns { error } for invalid values, { timeoutMs } with the (possibly
   * clamped) override, or {} when no override was given.
   */
  private resolveDapTimeoutOverride(
    timeoutMs: number | undefined,
    logContext: string
  ): { error?: string; timeoutMs?: number } {
    if (timeoutMs === undefined) {
      return {};
    }
    if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return {
        error: `Invalid 'timeout': must be a positive number of milliseconds (got ${timeoutMs})`
      };
    }
    if (timeoutMs > SessionManagerOperations.MAX_DAP_TIMEOUT_MS) {
      this.logger.warn(
        `[${logContext}] 'timeout' ${timeoutMs}ms exceeds the maximum; clamping to ${SessionManagerOperations.MAX_DAP_TIMEOUT_MS}ms`
      );
      return { timeoutMs: SessionManagerOperations.MAX_DAP_TIMEOUT_MS };
    }
    return { timeoutMs };
  }

  /** Append the 'timeout' tool-arg hint to DAP timeout failures. */
  private withTimeoutHint(errorMessage: string): string {
    if (!/timed out|did not respond/i.test(errorMessage)) {
      return errorMessage;
    }
    const separator = errorMessage.trimEnd().endsWith('.') ? ' ' : '. ';
    return `${errorMessage}${separator}${ErrorMessages.dapRequestTimeoutHint()}`;
  }

  /**
   * Evaluate an expression in the context of the current debug session.
   * The debugger must be paused for evaluation to work.
   * Expressions CAN and SHOULD be able to modify program state (this is a feature).
   *
   * @param sessionId - The session ID
   * @param expression - The expression to evaluate
   * @param frameId - Optional stack frame ID for context (defaults to current frame)
   * @param timeoutMs - Optional per-request timeout override (ms) for the DAP
   *   evaluate request (default 30s, max 600000). Issue #142.
   * @returns Evaluation result with value, type, and optional variable reference
   */
  async evaluateExpression(
    sessionId: string,
    expression: string,
    frameId?: number,
    timeoutMs?: number
  ): Promise<EvaluateResult> {
    const session = this._getSessionById(sessionId);
    // Some debuggers (rdbg) reject the default 'variables' context; let the
    // adapter policy pick the context its debugger understands.
    const context = this.selectPolicy(session.language).getEvaluateContext?.() ?? 'variables';
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

    const timeoutOverride = this.resolveDapTimeoutOverride(
      timeoutMs,
      `SM evaluateExpression ${sessionId}`
    );
    if (timeoutOverride.error) {
      this.logger.warn(`[SM evaluateExpression ${sessionId}] ${timeoutOverride.error}`);
      return { success: false, error: timeoutOverride.error };
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

      // Conditional 3-arg call: only pass options when an override is present,
      // so the default path keeps its exact 2-arg contract.
      const evaluateArgs = { expression, frameId, context };
      const response = timeoutOverride.timeoutMs !== undefined
        ? await session.proxyManager.sendDapRequest<DebugProtocol.EvaluateResponse>(
            'evaluate', evaluateArgs, { timeoutMs: timeoutOverride.timeoutMs })
        : await session.proxyManager.sendDapRequest<DebugProtocol.EvaluateResponse>(
            'evaluate', evaluateArgs);

      // Log raw response in debug mode — scrubbed, the raw body carries
      // unredacted values (issue #237)
      this.logger.debug(
        `[SM evaluateExpression ${sessionId}] DAP evaluate raw response:`,
        this.redactionEnabled() ? redactSecretsDeep(response).value : response
      );

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

        // Redaction hook (issue #237), placed above the logs below so they
        // only ever see masked values. The expression's final dot-segment
        // counts as the "variable name" so `config.password` is treated like
        // the variable `password` would be.
        if (this.redactionEnabled() && result.result) {
          const redacted = redactVariableValue(
            SessionManagerOperations.expressionNameForRedaction(expression),
            result.result
          );
          if (redacted.redacted) {
            result.result = redacted.value;
            result.redaction = {
              rules: redacted.hits.map(hit => hit.ruleId),
              notice: buildRedactionNotice(redacted.hits)
            };
          }
        }

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

      return { success: false, error: this.withTimeoutHint(userError) };
  }
}

  /**
   * Attach to a running process for debugging
   */
  async attachToProcess(
    sessionId: string,
    attachConfig: {
      port?: number;
      host?: string;
      processId?: number | string;
      timeout?: number;
      sourcePaths?: string[];
      stopOnEntry?: boolean;
      justMyCode?: boolean;
      verifyTimeout?: number;
      breakOnExceptions?: ExceptionBreakMode;
      adapterConfig?: Record<string, unknown>;
    }
  ): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);
    this.logger.info(
      `[SessionManager] Attempting to attach to process for session ${sessionId}`,
      attachConfig
    );

    // The verification-window override is consumed by the thread-discovery
    // loop below, not by the adapter — strip it from the config that becomes
    // the DAP attach arguments. Validate before any state mutation.
    // breakOnExceptions maps to setExceptionBreakpoints, not attach args —
    // strip it too and thread it through the proxy config instead.
    // adapterConfig is merged by startProxyManager (the same slot launch uses
    // for adapterLaunchConfig, issue #336) — strip it here so the wrapper key
    // itself cannot leak into the DAP attach arguments.
    const { verifyTimeout, breakOnExceptions, adapterConfig, ...adapterAttachConfig } = attachConfig;
    if (adapterConfig && adapterConfig.stopOnEntry !== undefined) {
      this.logger.warn(
        '[SessionManager] adapterConfig.stopOnEntry reaches the adapter but does not affect post-attach pause verification; prefer the top-level stopOnEntry parameter'
      );
    }
    let verifyTimeoutOverride = verifyTimeout;
    if (verifyTimeoutOverride !== undefined) {
      if (
        typeof verifyTimeoutOverride !== 'number' ||
        !Number.isFinite(verifyTimeoutOverride) ||
        verifyTimeoutOverride <= 0
      ) {
        return {
          success: false,
          state: session.state,
          error: `'verifyTimeout' must be a positive number of milliseconds, got: ${String(verifyTimeoutOverride)}`
        };
      }
      const maxVerifyTimeoutMs = 600000;
      if (verifyTimeoutOverride > maxVerifyTimeoutMs) {
        this.logger.warn(
          `[SessionManager] verifyTimeout ${verifyTimeoutOverride}ms exceeds the maximum; clamping to ${maxVerifyTimeoutMs}ms`
        );
        verifyTimeoutOverride = maxVerifyTimeoutMs;
      }
    }

    // Languages whose adapter declares no attach implementation fail fast,
    // before any state mutation (issue #331). Only an explicit 'none'
    // declaration is enforced — absent metadata falls through to the
    // adapter's natural behavior.
    const registryWithMeta = this.adapterRegistry as unknown as {
      getFactoryMetadata?: (language: string) => Promise<{ modes?: { attach?: string } } | undefined>;
    };
    if (typeof registryWithMeta.getFactoryMetadata === 'function') {
      const factoryMeta = await registryWithMeta.getFactoryMetadata(session.language).catch(() => undefined);
      if (factoryMeta?.modes?.attach === 'none') {
        return {
          success: false,
          state: session.state,
          error: ErrorMessages.attachModeNotSupported(session.language)
        };
      }
    }

    if (session.proxyManager) {
      this.logger.warn(
        `[SessionManager] Session ${sessionId} already has an active proxy. Terminating before attaching.`
      );
      // Session-preserving teardown (same landmine as startDebugging, #238)
      await this.stopProxyPreservingSession(session);
    }

    // Update to INITIALIZING state and set lifecycle to ACTIVE
    this._updateSessionState(session, SessionState.INITIALIZING);
    this.sessionStore.update(sessionId, {
      sessionLifecycle: SessionLifecycleState.ACTIVE,
      attachMode: true,
    });

    try {
      // For attach mode, we use a placeholder scriptPath
      // The actual attach logic will be handled by the adapter via dapLaunchArgs
      const placeholderPath = 'attach://remote';

      // Pass attach config through dapLaunchArgs with special request type
      const attachLaunchArgs = {
        ...adapterAttachConfig,
        request: 'attach',
        __attachMode: true  // Internal flag to signal attach mode
      };

      // Attach never receives a policy default (issue #244) — record the
      // user's value (possibly undefined) for read-back symmetry.
      session.effectiveBreakOnExceptions = breakOnExceptions;

      const attachConfigData = await this.startProxyManager(
        session,
        placeholderPath,
        undefined,
        attachLaunchArgs as Partial<CustomLaunchRequestArguments>,
        false,
        adapterConfig,  // merged over the attach config before transformAttachConfig (issue #336)
        breakOnExceptions
      );

      // Perform language-specific handshake if required, mirroring
      // startDebugging. For js-debug the whole DAP sequence — initialize,
      // configurationDone and the DAP 'attach' request itself — is driven
      // here because the proxy worker skips its built-in attach flow for
      // command-queueing policies. Policies without performHandshake are
      // untouched: their attach is performed by the proxy worker.
      const policy = this.selectPolicy(session.language);
      if (policy.performHandshake) {
        try {
          await policy.performHandshake({
            proxyManager: session.proxyManager,
            sessionId: session.id,
            dapLaunchArgs: attachLaunchArgs as Partial<CustomLaunchRequestArguments>,
            scriptPath: placeholderPath,
            scriptArgs: undefined,
            breakpoints: session.breakpoints,
            launchConfig: attachConfigData,
            breakOnExceptions
          });
        } catch (handshakeErr) {
          this.logger.warn(
            `[SessionManager] Language handshake for attach returned with warning/error: ${
              handshakeErr instanceof Error ? handshakeErr.message : String(handshakeErr)
            }`
          );
        }
      }

      // Set session state based on stopOnEntry
      let finalState = session.state;

      if (attachConfig.stopOnEntry !== false) {
        // Verify the attach actually produced a debuggable target before
        // reporting PAUSED: poll DAP 'threads' until the debugger reports at
        // least one thread. A debugger that cannot enumerate any threads after
        // attach is not usable — reporting success would be a lie (issue #124:
        // JS attach reported success + "paused" while the js-debug child
        // session never connected to the target).
        if (!session.proxyManager) {
          throw new Error('Proxy manager is not available after attach initialization');
        }
        const proxyManager = session.proxyManager;

        const verifyTimeoutMs = verifyTimeoutOverride ?? this.attachVerifyTimeoutMs;
        const pollIntervalMs = this.attachVerifyIntervalMs;
        const deadline = Date.now() + verifyTimeoutMs;

        let threads: DebugProtocol.Thread[] | undefined;
        let lastFailure = 'no threads response received';

        const requestThreads = async (): Promise<void> => {
          const remainingMs = Math.max(deadline - Date.now(), 1);
          const threadsResponse = await this.sendThreadsRequestBounded(proxyManager, remainingMs);
          if (threadsResponse?.success === false) {
            lastFailure = threadsResponse.message || `'threads' request failed`;
            return;
          }
          const reported = threadsResponse?.body?.threads;
          if (Array.isArray(reported) && reported.length > 0) {
            threads = reported;
          } else {
            lastFailure = 'debugger reported zero threads';
          }
        };

        // First discovery attempt.
        try {
          await requestThreads();
        } catch (err) {
          lastFailure = err instanceof Error ? err.message : String(err);
          this.logger.warn(`[SessionManager] Initial thread discovery for attach failed: ${lastFailure}`);
        }

        // Retry until the deadline if the debugger has not reported threads yet.
        while (!threads && Date.now() < deadline) {
          const sleepMs = Math.min(pollIntervalMs, Math.max(deadline - Date.now(), 1));
          await new Promise((resolve) => setTimeout(resolve, sleepMs));
          if (Date.now() >= deadline) {
            break;
          }
          try {
            await requestThreads();
          } catch (err) {
            lastFailure = err instanceof Error ? err.message : String(err);
          }
        }

        if (!threads) {
          const reason = ErrorMessages.attachVerifyFailed(verifyTimeoutMs, lastFailure);
          this.logger.error(`[SessionManager] ${reason} — tearing down proxy for session ${sessionId}`);
          // Tear down the proxy using the same mechanics as closeSession, but
          // keep the session record so the failure is inspectable as ERROR.
          try {
            this.cleanupProxyEventHandlers(session, proxyManager);
          } catch (cleanupError) {
            this.logger.error(`[SessionManager] Error during listener cleanup for failed attach:`, cleanupError);
          }
          try {
            await proxyManager.stop();
          } catch (stopError) {
            this.logger.error(`[SessionManager] Error stopping proxy for failed attach:`, stopError);
          } finally {
            session.proxyManager = undefined;
          }
          throw new Error(reason);
        }

        // Prefer a thread named "main" (common in JVM debugging)
        const mainThread = threads.find(t => t.name === 'main');
        const discoveredThreadId = mainThread ? mainThread.id : threads[0].id;
        this.logger.info(`[SessionManager] Discovered ${threads.length} threads. Using threadId=${discoveredThreadId} (name=${mainThread?.name || threads[0].name})`);
        proxyManager.setCurrentThreadId(discoveredThreadId);
        this.logger.info(`[SessionManager] Set threadId=${discoveredThreadId} for attach mode`);

        // Some debuggers (rdbg; js-debug attaches with continueOnAttach) do
        // not suspend a running target on attach; issue an explicit pause so
        // the PAUSED state we report is real, and wait for the stop to be
        // observed before reporting it. Sent after thread verification so it
        // reaches the debuggee-owning session (for js-debug the pause is
        // routed to the child session, which exists once threads are
        // reported). A rejected pause means the target is already stopped
        // (e.g. started suspended) — fine, no stop event will follow.
        const attachBehavior = this.selectPolicy(session.language).getAttachBehavior?.();
        if (attachBehavior?.pauseAfterAttach) {
          let stopSettled = false;
          let stopTimer: ReturnType<typeof setTimeout> | undefined;
          let onStopped: (() => void) | undefined;
          const stoppedSeen = new Promise<boolean>((resolve) => {
            onStopped = () => {
              if (!stopSettled) {
                stopSettled = true;
                if (stopTimer) clearTimeout(stopTimer);
                resolve(true);
              }
            };
            stopTimer = setTimeout(() => {
              if (!stopSettled) {
                stopSettled = true;
                resolve(false);
              }
            }, this.attachPauseStopTimeoutMs);
            proxyManager.once('stopped', onStopped);
          });
          try {
            await proxyManager.sendDapRequest('pause', { threadId: discoveredThreadId });
            this.logger.info(`[SessionManager] Sent post-attach pause (threadId=${discoveredThreadId})`);
            const stopObserved = await stoppedSeen;
            if (!stopObserved) {
              this.logger.warn(
                `[SessionManager] No 'stopped' event within ${this.attachPauseStopTimeoutMs}ms after post-attach pause; reported state may lag the engine`
              );
            }
          } catch (err) {
            // Already stopped (e.g. target was started suspended) — fine.
            this.logger.info(
              `[SessionManager] Post-attach pause not needed/accepted: ${err instanceof Error ? err.message : String(err)}`
            );
          } finally {
            stopSettled = true;
            if (stopTimer) clearTimeout(stopTimer);
            if (onStopped) proxyManager.removeListener('stopped', onStopped);
          }
        }

        this._updateSessionState(session, SessionState.PAUSED);
        finalState = SessionState.PAUSED;
        this.logger.info(`[SessionManager] Set session ${sessionId} to PAUSED after attach (stopOnEntry=${attachConfig.stopOnEntry})`);
      } else {
        // JVM is already running (suspend=n), set RUNNING state
        this._updateSessionState(session, SessionState.RUNNING);
        finalState = SessionState.RUNNING;
        this.logger.info(`[SessionManager] Set session ${sessionId} to RUNNING (stopOnEntry=false, process started with suspend=n)`);
      }

      return {
        success: true,
        state: finalState,
        data: {
          message: attachConfig.processId
            ? `Attached to process PID ${attachConfig.processId}`
            : `Attached to process at ${attachConfig.host || 'localhost'}:${attachConfig.port}`,
          attachConfig
        }
      };
    } catch (error) {
      this.logger.error(`[SessionManager] Failed to attach to process for session ${sessionId}:`, error);
      // Never leave a live proxy chain behind a failed attach — e.g.
      // ProxyManager.start()'s init timeout rejects after the worker was
      // spawned (issue #337). Idempotent with the verify-failure teardown
      // above, which already nulled session.proxyManager.
      await this.stopProxyPreservingSession(session);
      this._updateSessionState(session, SessionState.ERROR);

      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        state: SessionState.ERROR,
        error: `Failed to attach: ${message}`
      };
    }
  }

  /**
   * Send a DAP 'threads' request bounded by a timeout so a hung request
   * cannot stall attach verification past its deadline. The underlying
   * request keeps its own lifecycle; only the wait here is bounded.
   */
  private async sendThreadsRequestBounded(
    proxyManager: NonNullable<ManagedSession['proxyManager']>,
    timeoutMs: number
  ): Promise<DebugProtocol.ThreadsResponse | undefined> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        proxyManager.sendDapRequest<DebugProtocol.ThreadsResponse>('threads', {}),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`'threads' request did not respond within ${timeoutMs}ms`)),
            timeoutMs
          );
        })
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  /**
   * Detach from the debugged process without terminating it
   */
  async detachFromProcess(
    sessionId: string,
    terminateProcess: boolean = false
  ): Promise<DebugResult> {
    const session = this._getSessionById(sessionId);
    this.logger.info(
      `[SessionManager] Detaching from process for session ${sessionId}, terminateProcess: ${terminateProcess}`
    );

    if (!session.proxyManager) {
      return {
        success: false,
        state: session.state,
        error: 'No active debug session to detach from'
      };
    }

    try {
      if (terminateProcess) {
        // Terminate the process
        await this.closeSession(sessionId);
      } else {
        // Disconnect without terminating - send DAP disconnect request
        try {
          await session.proxyManager.sendDapRequest('disconnect', {
            terminateDebuggee: false
          });
        } catch (disconnectError) {
          this.logger.warn(`[SessionManager] Disconnect request failed, continuing with cleanup:`, disconnectError);
        }

        // Stop the proxy manager — it may already be gone if the disconnect
        // request triggered a 'terminated' event that cleared proxyManager.
        if (session.proxyManager) {
          await session.proxyManager.stop();
        }

        this._updateSessionState(session, SessionState.STOPPED);
        this.sessionStore.update(sessionId, {
          sessionLifecycle: SessionLifecycleState.TERMINATED
        });
      }

      return {
        success: true,
        state: SessionState.STOPPED,
        data: {
          message: terminateProcess
            ? 'Detached and terminated process'
            : 'Detached from process (process still running)'
        }
      };
    } catch (error) {
      this.logger.error(`[SessionManager] Failed to detach from process for session ${sessionId}:`, error);

      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        state: session.state,
        error: `Failed to detach: ${message}`
      };
    }
  }

  async redefineClasses(
    sessionId: string,
    classesDir: string,
    sinceTimestamp: number = 0,
    timeoutMs?: number
  ): Promise<RedefineClassesResult> {
    const session = this._getSessionById(sessionId);
    this.logger.info(
      `[SM redefineClasses ${sessionId}] classesDir: "${classesDir}", since: ${sinceTimestamp}`
    );

    const timeoutOverride = this.resolveDapTimeoutOverride(
      timeoutMs,
      `SM redefineClasses ${sessionId}`
    );
    if (timeoutOverride.error) {
      this.logger.warn(`[SM redefineClasses ${sessionId}] ${timeoutOverride.error}`);
      return { success: false, error: timeoutOverride.error };
    }

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      return { success: false, error: 'No active debug session' };
    }

    try {
      const redefineArgs = { classesDir, sinceTimestamp };
      const response = timeoutOverride.timeoutMs !== undefined
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? await session.proxyManager.sendDapRequest<any>(
            'redefineClasses', redefineArgs, { timeoutMs: timeoutOverride.timeoutMs })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : await session.proxyManager.sendDapRequest<any>(
            'redefineClasses', redefineArgs);

      const body = response?.body;
      if (!body) {
        return { success: false, error: 'No response body from redefineClasses' };
      }

      return {
        success: true,
        redefined: body.redefined,
        redefinedCount: body.redefinedCount,
        skippedNotLoaded: body.skippedNotLoaded,
        failedCount: body.failedCount,
        failed: body.failed,
        scannedFiles: body.scannedFiles,
        newestTimestamp: body.newestTimestamp,
      };
    } catch (error) {
      this.logger.error(`[SM redefineClasses ${sessionId}] Error: ${error}`);
      return {
        success: false,
        error: this.withTimeoutHint(error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Expose the session's live DAP connection as a read-only mirror endpoint
   * for IDE attach (issue #217). Idempotent: the worker returns the existing
   * endpoint (token unrotated) when already exposed. Allowed while RUNNING
   * as well as PAUSED — a paused-only gate would race the debuggee anyway.
   */
  async exposeSession(sessionId: string): Promise<ExposeSessionResult> {
    const session = this._getSessionById(sessionId);

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      return {
        success: false,
        state: session.state,
        error: 'No active debug session to expose — start_debugging or attach_to_process first'
      };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await session.proxyManager.sendDapRequest<any>(MIRROR_EXPOSE_COMMAND, {});
      const body = response?.body;
      if (!body || typeof body.port !== 'number' || typeof body.token !== 'string') {
        return { success: false, state: session.state, error: 'Malformed mirrorExpose response from debug proxy' };
      }
      const host = typeof body.host === 'string' ? body.host : '127.0.0.1';
      this.sessionStore.update(sessionId, {
        exposure: { host, port: body.port, token: body.token, exposedAt: Date.now() }
      });
      // The token is an attach capability — log the endpoint, never the token.
      this.logger.info(`[SM exposeSession ${sessionId}] Mirror listening on ${host}:${body.port}`);
      return { success: true, state: session.state, host, port: body.port, token: body.token };
    } catch (error) {
      this.logger.error(`[SM exposeSession ${sessionId}] Error: ${error}`);
      return {
        success: false,
        state: session.state,
        error: this.withTimeoutHint(error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * Close the session's mirror endpoint (issue #217). A no-op success when
   * not exposed — the caller's desired end-state holds either way.
   */
  async unexposeSession(sessionId: string): Promise<UnexposeSessionResult> {
    const session = this._getSessionById(sessionId);
    const hadRecord = session.exposure !== undefined;

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      // Worker gone => listener gone; just clear any stale record.
      if (hadRecord) {
        this.sessionStore.update(sessionId, { exposure: undefined });
      }
      return { success: true, state: session.state, wasExposed: false };
    }

    try {
      // Always forward even without a parent record — record and reality can
      // disagree, and the worker no-ops safely.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await session.proxyManager.sendDapRequest<any>(MIRROR_UNEXPOSE_COMMAND, {});
      this.sessionStore.update(sessionId, { exposure: undefined });
      const body = response?.body;
      return {
        success: true,
        state: session.state,
        wasExposed: body?.closed === true || hadRecord,
        ...(typeof body?.closedClients === 'number' ? { closedClients: body.closedClients } : {})
      };
    } catch (error) {
      this.logger.error(`[SM unexposeSession ${sessionId}] Error: ${error}`);
      return {
        success: false,
        state: session.state,
        error: this.withTimeoutHint(error instanceof Error ? error.message : String(error))
      };
    }
  }
}
