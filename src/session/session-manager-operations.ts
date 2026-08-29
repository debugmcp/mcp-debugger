/**
 * Debug operations for session management including starting, stepping,
 * continuing, and breakpoint management.
 */
import {
  Breakpoint,
  FunctionBreakpoint,
  SessionState,
  SessionLifecycleState,
  sanitizePayloadForLogging,
  type ExceptionBreakMode
} from '@debugmcp/shared';
import { ManagedSession, ToolchainValidationState } from './session-store.js';
import { DebugProtocol } from '@vscode/debugprotocol';
import path from 'path';
import { ProxyConfig } from '../proxy/proxy-config.js';
import { MIRROR_EXPOSE_COMMAND, MIRROR_UNEXPOSE_COMMAND } from '../proxy/dap-proxy-interfaces.js';
import { ErrorMessages } from '../utils/error-messages.js';
import { checkLaunchToolchain } from '../utils/language-availability.js';
import { didYouMean } from '../utils/did-you-mean.js';
import { SessionManagerData } from './session-manager-data.js';
import type { OperationsContext } from './operations-context.js';
import {
  resolveDapTimeoutOverride,
  withTimeoutHint
} from './dap-request-helpers.js';
import { BreakpointController } from './breakpoints/breakpoint-controller.js';
import { ExecutionController } from './execution/execution-controller.js';
import {
  ExpressionEvaluator,
  type EvaluateResult
} from './inspection/expression-evaluator.js';
import { reresolveAnchors } from './breakpoints/anchor-resolution.js';
import {
  buildLogpointDowngradeLaunchWarning,
  buildUnboundBreakpointExitWarning
} from './breakpoints/launch-warnings.js';
import { AdapterLease } from '../adapters/adapter-lease.js';
import { logProxyFailure } from './launch/proxy-failure-diagnostics.js';
import { CustomLaunchRequestArguments, DebugResult } from './session-manager-core.js';
import {
  AdapterConfig,
  type IDebugAdapter,
  type GenericLaunchConfig,
  type GenericAttachConfig,
  type LanguageSpecificLaunchConfig
} from '@debugmcp/shared';
import {
  DebugSessionCreationError,
  PythonNotFoundError
} from '../errors/debug-errors.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';

/** Result type for evaluate expression operations. */
export type { EvaluateResult } from './inspection/expression-evaluator.js';

export interface RedefineClassesResult {
  success: boolean;
  redefined?: string[];
  redefinedCount?: number;
  skippedNotLoaded?: number;
  failedCount?: number;
  failed?: Array<{ fqcn: string; error: string }>;
  scannedFiles?: number;
  newestTimestamp?: number;
  /** Breakpoints re-planted after redefine (issue #370). */
  replantedBreakpoints?: number;
  /**
   * Statement-anchored breakpoints re-resolved against the new source after
   * the hot-swap (issue #464) — same shape restart_debugging returns.
   */
  anchorResolution?: {
    moved: Array<{ breakpointId: string; file: string; from: number; to: number; statement: string; candidates?: number[] }>;
    stale: Array<{ breakpointId: string; file: string; line: number; statement: string; reason: string }>;
  };
  warning?: string;
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
 * The seven positional arguments `startProxyManager` has always taken, named.
 * They are threaded through the launch preparation unchanged; giving them a
 * type is what lets the preparation split into steps without each step growing
 * its own six-argument signature.
 */
interface ProxyLaunchRequest {
  scriptPath: string;
  scriptArgs?: string[];
  dapLaunchArgs?: Partial<CustomLaunchRequestArguments>;
  dryRunSpawn?: boolean;
  adapterLaunchConfig?: Record<string, unknown>;
  breakOnExceptions?: ExceptionBreakMode;
}

/**
 * What a launch computes before it has an adapter — the inputs every later
 * step reads. `adapterConfig` is handed to the registry to create the adapter
 * and then updated in place with the resolved executable path, exactly as the
 * single long method did.
 */
interface LaunchInputs {
  sessionLogDir: string;
  adapterPort: number;
  initialBreakpoints: NonNullable<ProxyConfig['initialBreakpoints']>;
  initialFunctionBreakpoints: NonNullable<ProxyConfig['initialFunctionBreakpoints']>;
  effectiveLaunchArgs: Partial<CustomLaunchRequestArguments>;
  isAttachMode: boolean;
  genericLaunchConfig: Record<string, unknown>;
  adapterExtraKeys: string[];
  adapterConfig: AdapterConfig;
}

/** The two products of adapter-side preparation: what to start, and what to return. */
interface AdapterLaunchPlan {
  launchConfig: LanguageSpecificLaunchConfig;
  proxyConfig: ProxyConfig;
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
   * Callers can adjust the window per attach via the 'verifyTimeout' tool
   * argument (issue #143) — smaller for fast failure-by-design probes, larger
   * for targets that are exceptionally slow to become debuggable.
   *
   * The default is deliberately generous: an adapter that dies mid-verify
   * fails fast regardless (the proxyGone latch), so the deadline only ever
   * bites when the adapter is alive but the target is slow to report threads
   * — e.g. js-debug child-session adoption on a heavily loaded host, or a
   * warming JVM — where a false "attach failed" is far worse than a slow
   * genuine failure. The poll exits as soon as threads appear, so healthy
   * attaches never pay for the headroom.
   * Protected so tests can shrink the window.
   */
  protected attachVerifyTimeoutMs = 20000;
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

  /**
   * The view of this facade that the operation collaborators get. Every member
   * is late bound (arrows for methods, getters for fields and tunables) so that
   * reassigning `selectPolicy` or writing `stepGraceMs` on a live instance —
   * which the tests do — is seen by the collaborators too.
   */
  protected buildOperationsContext(): OperationsContext {
    // An arrow rather than a `this` alias, so each getter below resolves the
    // facade when it is read instead of closing over a snapshot.
    const facade = () => this;
    return {
      get logger() { return facade().logger; },
      get fileSystem() { return facade().fileSystem; },
      get adapterRegistry() { return facade().adapterRegistry; },
      get proxyManagerFactory() { return facade().proxyManagerFactory; },
      get launchValidationCache() { return facade().launchValidationCache; },
      get logDirBase() { return facade().logDirBase; },
      get defaultDapLaunchArgs() { return facade().defaultDapLaunchArgs; },
      get dryRunTimeoutMs() { return facade().dryRunTimeoutMs; },
      tunables: {
        get attachVerifyTimeoutMs() { return facade().attachVerifyTimeoutMs; },
        get attachVerifyIntervalMs() { return facade().attachVerifyIntervalMs; },
        get attachPauseStopTimeoutMs() { return facade().attachPauseStopTimeoutMs; },
        get stepGraceMs() { return facade().stepGraceMs; },
        get pauseGraceMs() { return facade().pauseGraceMs; }
      },
      getSession: (sessionId) => this._getSessionById(sessionId),
      updateSession: (sessionId, updates) => this.sessionStore.update(sessionId, updates),
      updateState: (session, newState) => this._updateSessionState(session, newState),
      selectPolicy: (language) => this.selectPolicy(language),
      selectStorePolicy: (language) => this.sessionStore.selectPolicy(language),
      findFreePort: () => this.findFreePort(),
      setupProxyEventHandlers: (session, proxyManager, effectiveLaunchArgs) =>
        this.setupProxyEventHandlers(session, proxyManager, effectiveLaunchArgs),
      cleanupProxyEventHandlers: (session, proxyManager) =>
        this.cleanupProxyEventHandlers(session, proxyManager),
      stopProxyPreservingSession: (session) => this.stopProxyPreservingSession(session),
      closeSession: (sessionId) => this.closeSession(sessionId),
      getStackTrace: (sessionId, threadId, includeInternals) =>
        this.getStackTrace(sessionId, threadId, includeInternals),
      redactionEnabled: () => this.redactionEnabled()
    };
  }

  /**
   * The collaborators the debug operations are split across. Field
   * initializers rather than constructor wiring: they carry no state of their
   * own beyond the context, so there is nothing to sequence. Call sites always
   * go through the field (`this.breakpoints.syncBreakpointsForFile(...)`) and
   * never capture a method off it, so a test can spy on any of them.
   */
  protected readonly opsContext: OperationsContext = this.buildOperationsContext();
  protected readonly breakpoints = new BreakpointController(this.opsContext);
  protected readonly execution = new ExecutionController(this.opsContext);
  protected readonly evaluator = new ExpressionEvaluator(this.opsContext);

  protected async startProxyManager(
    session: ManagedSession,
    scriptPath: string,
    scriptArgs?: string[],
    dapLaunchArgs?: Partial<CustomLaunchRequestArguments>,
    dryRunSpawn?: boolean,
    adapterLaunchConfig?: Record<string, unknown>,
    breakOnExceptions?: ExceptionBreakMode
  ): Promise<LanguageSpecificLaunchConfig> {
    const request: ProxyLaunchRequest = {
      scriptPath,
      scriptArgs,
      dapLaunchArgs,
      dryRunSpawn,
      adapterLaunchConfig,
      breakOnExceptions
    };

    // Log entrance for Windows CI debugging
    this.logger.info(
      `[SessionManager] Entering startProxyManager for session ${session.id}, dryRunSpawn: ${dryRunSpawn}, scriptPath: ${scriptPath}`
    );

    const inputs = await this.prepareLaunchInputs(session, request);

    // The lease owns the adapter until `transferTo` hands it to the ProxyManager:
    // every throw before that point disposes it here, returning its registry
    // slot. After the transfer the release is a no-op and the ProxyManager's
    // teardown owns disposal — both callers' catches stop `session.proxyManager`,
    // and `ProxyManager.cleanup()` disposes the adapter from there. Same
    // behaviour as the `adapterOwnedByProxy` boolean it replaces (#557); the
    // difference is that the boolean had to be assigned at one point and
    // consulted from one catch, so the next throw site added outside that window
    // would have silently reopened the leak.
    const lease = await AdapterLease.acquire(
      this.adapterRegistry,
      session.language,
      inputs.adapterConfig,
      this.logger
    );
    try {
      const plan = await this.prepareAdapterLaunch(session, lease.adapter, inputs, request);

      // Create and start ProxyManager with the adapter. Ownership moves here:
      // ProxyManager.cleanup() becomes the disposer and release() below is a
      // no-op.
      const proxyManager = lease.transferTo(this.proxyManagerFactory);
      session.proxyManager = proxyManager;

      // Set up event handlers
      this.setupProxyEventHandlers(session, proxyManager, inputs.effectiveLaunchArgs);

      // Start the proxy
      await proxyManager.start(plan.proxyConfig);

      return plan.launchConfig;
    } finally {
      await lease.release();
    }
  }

  /**
   * Everything the launch needs before an adapter exists: this run's log
   * directory, a free adapter port, the breakpoint snapshots, and the generic
   * launch configuration the adapter will transform. Nothing here allocates a
   * registry slot, so a failure needs no cleanup.
   */
  private async prepareLaunchInputs(
    session: ManagedSession,
    request: ProxyLaunchRequest
  ): Promise<LaunchInputs> {
    const sessionId = session.id;
    const { scriptPath, scriptArgs, dapLaunchArgs, adapterLaunchConfig } = request;

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
      // The store id is echoed back by the worker's breakpoints_synced
      // status for exact store matching (issue #439).
      return {
        id: bp.id,
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

    // Caller's adapterConfig keys (minus reserved) — diffed against the attach
    // transform's output to surface silently dropped keys (issue #450).
    let adapterExtraKeys: string[] = [];
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
      adapterExtraKeys = Object.keys(adapterExtras);
    }

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

    return {
      sessionLogDir,
      adapterPort,
      initialBreakpoints,
      initialFunctionBreakpoints,
      effectiveLaunchArgs,
      isAttachMode,
      genericLaunchConfig,
      adapterExtraKeys,
      adapterConfig
    };
  }

  /**
   * Everything that needs the adapter, in the order the adapters depend on:
   * transform the configuration, record which attach keys the transform
   * dropped, settle the toolchain verdict, resolve the executable, then
   * assemble the proxy configuration. Runs inside the lease, so any step here
   * may throw without stranding the adapter's registry slot.
   */
  private async prepareAdapterLaunch(
    session: ManagedSession,
    adapter: IDebugAdapter,
    inputs: LaunchInputs,
    request: ProxyLaunchRequest
  ): Promise<AdapterLaunchPlan> {
    const transformedLaunchConfig = await this.transformAdapterConfig(session, adapter, inputs);

    this.recordAttachKeyDiff(session, adapter, inputs, transformedLaunchConfig);

    this.applyToolchainValidation(session.id, adapter);

    const resolvedExecutablePath = await this.resolveAdapterExecutable(session, adapter, inputs);

    // Update adapter config with resolved executable path
    inputs.adapterConfig.executablePath = resolvedExecutablePath;

    return this.buildAdapterLaunchPlan(
      session,
      adapter,
      inputs,
      request,
      transformedLaunchConfig,
      resolvedExecutablePath
    );
  }

  /**
   * Turn the generic configuration into the adapter's language-specific form.
   */
  private async transformAdapterConfig(
    session: ManagedSession,
    adapter: IDebugAdapter,
    inputs: LaunchInputs
  ): Promise<LanguageSpecificLaunchConfig> {
    const { isAttachMode, genericLaunchConfig } = inputs;
    try {
      if (isAttachMode && adapter.supportsAttach && adapter.supportsAttach() && adapter.transformAttachConfig) {
        // Call transformAttachConfig for attach operations
        const transformedAttachConfig = adapter.transformAttachConfig(genericLaunchConfig as GenericAttachConfig);
        this.logger.info(`[SessionManager] Using attach config for ${session.language}`);
        return transformedAttachConfig;
      }
      // Call transformLaunchConfig for launch operations
      return await adapter.transformLaunchConfig(genericLaunchConfig as GenericLaunchConfig);
    } catch (error) {
      this.logger.warn(
        `[SessionManager] transform${isAttachMode ? 'Attach' : 'Launch'}Config failed for ${session.language}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      // A transform can perform required work (such as compiling a C++ source
      // file) or reject invalid attach arguments. Forwarding the generic
      // configuration after that failure starts the adapter with inputs known
      // to be wrong and hides the actionable error (issue #552). A toolchain
      // verdict recorded before the rejection (CPP/RUST_MSVC_BEHAVIOR=error
      // rejects from inside the transform) still becomes the structured
      // MSVC_TOOLCHAIN_DETECTED sentinel rather than a bare error.
      this.applyToolchainValidation(session.id, adapter);
      throw error;
    }
  }

  /**
   * Attach transforms may strip adapterConfig keys (issue #450) — record the
   * drops so attachToProcess can warn the caller. Keys the transform kept but
   * the adapter doesn't declare in supportedAttachKeys are forwarded to the
   * debug adapter as-is, and recorded separately so the caller learns they
   * weren't recognized (issue #466) — never deleted, so upstream debugger
   * capabilities stay reachable without an mcp-debugger release. Both records
   * are assigned unconditionally so a prior attach's record never leaks.
   */
  private recordAttachKeyDiff(
    session: ManagedSession,
    adapter: IDebugAdapter,
    inputs: LaunchInputs,
    transformedLaunchConfig: LanguageSpecificLaunchConfig
  ): void {
    if (!inputs.isAttachMode) {
      return;
    }
    const sessionId = session.id;
    const supportedKeys = adapter.supportedAttachKeys;
    // A typo of a supported key is the likeliest caller mistake — annotate
    // both buckets with an edit-distance suggestion when a list is declared.
    const describeKey = (key: string): string => {
      const suggestion = supportedKeys ? didYouMean(key, supportedKeys) : null;
      return suggestion ? `${key} (did you mean ${suggestion}?)` : key;
    };

    const dropped: string[] = [];
    const forwardedUnknown: string[] = [];
    for (const key of inputs.adapterExtraKeys) {
      if (!(key in transformedLaunchConfig)) {
        dropped.push(describeKey(key));
      } else if (supportedKeys && !supportedKeys.includes(key)) {
        forwardedUnknown.push(describeKey(key));
      }
    }

    if (dropped.length > 0) {
      this.logger.warn(
        `[SessionManager] ${session.language} attach transform dropped adapterConfig key(s) for session ${sessionId}: ${dropped.join(', ')}`
      );
    }
    if (forwardedUnknown.length > 0) {
      this.logger.warn(
        `[SessionManager] ${session.language} attach forwarded unrecognized adapterConfig key(s) for session ${sessionId}: ${forwardedUnknown.join(', ')}`
      );
    }
    session.attachDroppedConfigKeys = dropped.length > 0 ? dropped : undefined;
    session.attachForwardedUnknownConfigKeys = forwardedUnknown.length > 0 ? forwardedUnknown : undefined;
  }

  /**
   * Use the adapter to resolve the executable path. Direct-connect attach
   * sessions (e.g. Ruby/rdbg, Python/debugpy) spawn no local process, so no
   * toolchain lookup runs — a nominal, unverified name keeps the proxy init
   * payload (which requires a non-empty string) satisfied (issue #331).
   */
  private async resolveAdapterExecutable(
    session: ManagedSession,
    adapter: IDebugAdapter,
    inputs: LaunchInputs
  ): Promise<string> {
    const isDirectConnectAttach = inputs.isAttachMode && adapter.usesDirectConnectForAttach?.() === true;

    if (isDirectConnectAttach) {
      const resolvedExecutablePath =
        session.executablePath || adapter.getDefaultExecutableName?.() || session.language;
      this.logger.info(
        `[SessionManager] Direct-connect attach for ${session.language}; skipping executable resolution`
      );
      return resolvedExecutablePath;
    }

    try {
      const resolvedExecutablePath = await adapter.resolveExecutablePath(session.executablePath);
      this.logger.info(`[SessionManager] Adapter resolved executable path: ${resolvedExecutablePath}`);
      return resolvedExecutablePath;
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
        !inputs.isAttachMode && adapter.supportsAttach?.()
          ? ` ${ErrorMessages.attachMayStillWork(session.language)}`
          : '';

      throw new DebugSessionCreationError(
        `Failed to resolve ${session.language} executable: ${msg}${attachHint}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Assemble the adapter spawn command, the final launch configuration and the
   * ProxyConfig the worker is started with.
   */
  private buildAdapterLaunchPlan(
    session: ManagedSession,
    adapter: IDebugAdapter,
    inputs: LaunchInputs,
    request: ProxyLaunchRequest,
    transformedLaunchConfig: LanguageSpecificLaunchConfig,
    resolvedExecutablePath: string
  ): AdapterLaunchPlan {
    const sessionId = session.id;
    const { scriptPath, scriptArgs, dapLaunchArgs, dryRunSpawn, breakOnExceptions } = request;
    const {
      sessionLogDir,
      adapterPort,
      initialBreakpoints,
      initialFunctionBreakpoints,
      effectiveLaunchArgs,
      isAttachMode
    } = inputs;

    // Build adapter command using the adapter. Direct-connect attach sessions
    // (e.g. Ruby/rdbg) have no adapter process to spawn, so no command is built;
    // the adapter policy connects straight to the attach host/port instead.
    const adapterCommand =
      isAttachMode && adapter.usesDirectConnectForAttach?.()
        ? undefined
        : adapter.buildAdapterCommand(inputs.adapterConfig);

    const launchConfigData: LanguageSpecificLaunchConfig = { ...transformedLaunchConfig };

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
        transformedLaunchConfig.stopOnEntry
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
      // ILogger doesn't declare level, but the injected logger is the winston
      // instance whose level already resolves CLI --log-level and
      // DEBUG_MCP_LOG_LEVEL (issue #403); mocks without it fall back to the
      // worker's legacy default.
      logLevel: (this.logger as { level?: string }).level,
      breakOnExceptions,
      launchConfig: launchConfigData,
      adapterCommand, // Pass the adapter command
      attachMode: isAttachMode,
    };

    return { launchConfig: launchConfigData, proxyConfig };
  }

  /**
   * Persist (or clear) the adapter's toolchain verdict for this launch and
   * turn an incompatible one into the MSVC_TOOLCHAIN_DETECTED sentinel that
   * startDebugging renders as a structured, retryable response. Runs after
   * the launch transform whether it resolved or rejected: with
   * CPP/RUST_MSVC_BEHAVIOR=error the adapter records the verdict and then
   * rejects from inside transformLaunchConfig, and that verdict must still
   * reach the caller. Clearing on the no-verdict path keeps a previous
   * launch's verdict from mislabeling an unrelated failure.
   */
  private applyToolchainValidation(sessionId: string, adapter: IDebugAdapter): void {
    const adapterWithToolchain = adapter as {
      consumeLastToolchainValidation?: () => unknown;
    };
    const toolchainValidation =
      typeof adapterWithToolchain.consumeLastToolchainValidation === 'function'
      ? (adapterWithToolchain.consumeLastToolchainValidation() as ToolchainValidationState | undefined)
      : undefined;

    if (!toolchainValidation) {
      this.sessionStore.update(sessionId, { toolchainValidation: undefined });
      return;
    }
    this.sessionStore.update(sessionId, { toolchainValidation });
    if (!toolchainValidation.compatible && toolchainValidation.behavior !== 'continue') {
      const toolchainError = new Error('MSVC_TOOLCHAIN_DETECTED') as Error & {
        toolchainValidation?: ToolchainValidationState;
      };
      toolchainError.toolchainValidation = toolchainValidation;
      throw toolchainError;
    }
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

    // Fail fast when the adapter is known-unavailable (issue #360): consult
    // the same toolchain probe list_supported_languages reports, BEFORE any
    // state mutation or proxy teardown, so the caller gets the real reason
    // instead of success-then-silence. Fails open when the probe can't tell.
    const launchGate = await checkLaunchToolchain(
      session.language,
      this.adapterRegistry,
      this.launchValidationCache,
      this.logger
    );
    if (!launchGate.available) {
      const error = ErrorMessages.launchUnavailable(session.language, launchGate.reason);
      this.logger.warn(`[SessionManager] ${error}`);
      return { success: false, state: session.state, error };
    }

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

      // Belt-and-braces re-sync (issues #236/#439): the worker forwards its
      // initial setBreakpoints results via the breakpoints_synced status, so
      // the store is normally already stamped — including for launches that
      // are STOPPED by now (logpoint-only short programs), which this gated
      // path can never help. A live re-sync still heals anything that
      // changed between the snapshot and now, or a status lost to an IPC
      // hiccup. Replace-all with the identical set is idempotent;
      // syncBreakpointsForFile no-ops unless live.
      if (finalSession.breakpoints.size > 0 &&
          (finalState === SessionState.RUNNING || finalState === SessionState.PAUSED)) {
        const files = [...new Set(Array.from(finalSession.breakpoints.values()).map(bp => bp.file))];
        for (const file of files) {
          await this.breakpoints.syncBreakpointsForFile(finalSession, file);
        }
      }
      // Same re-sync for function breakpoints (issue #271 phase 3): the
      // worker's initial send's responses never reach this store either.
      if ((finalSession.functionBreakpoints?.size ?? 0) > 0 &&
          (finalState === SessionState.RUNNING || finalState === SessionState.PAUSED)) {
        await this.breakpoints.syncFunctionBreakpoints(finalSession);
      }

      // Unbound-at-launch warning (issue #308): the verified state is fresh
      // after the re-sync above, so a name the adapter could not resolve is
      // reported here instead of failing silently at "the program never
      // stopped". Suppressed for bind-late adapters (js/java), where
      // unverified-at-launch is the designed deferral path.
      const fnBpWarning = this.breakpoints.functionBreakpointLaunchWarning(finalSession);

      // Ran-to-completion with breakpoints that never bound (issue #467):
      // state "stopped" where the caller expected "paused" is only
      // explainable via list_breakpoints today — surface the stored
      // per-breakpoint diagnostics right here where the caller is looking.
      const unboundAtExitWarning =
        finalState === SessionState.STOPPED
          ? buildUnboundBreakpointExitWarning(finalSession)
          : undefined;

      // Logpoint-downgrade verdict (issue #469): the deferred set_breakpoint
      // warning promised a launch-time answer — deliver it on this response.
      const logpointWarning = buildLogpointDowngradeLaunchWarning(finalSession);

      // Adapter degradation notes (issue #441) accumulate on the session as
      // annotated output events arrive; joining here is best-effort — a note
      // arriving after this return still lands in the output buffer as an
      // attributed [mcp-debugger] Warning entry.
      const launchWarning =
        [fnBpWarning, logpointWarning, unboundAtExitWarning, ...(finalSession.adapterNotices ?? [])]
          .filter(Boolean)
          .join('; ') || undefined;

      this.logger.info(
        `[SessionManager] Debugging started for session ${sessionId}. State: ${finalState}`
      );

      return {
        success: true,
        state: finalState,
        data: {
          ...(launchWarning ? { warning: launchWarning } : {}),
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
      const diagnosticData = await logProxyFailure(
        { logger: this.logger, fileSystem: this.fileSystem },
        session,
        error,
        'startDebugging'
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

      return {
        success: false,
        error: errorMessage,
        state: session.state,
        errorType,
        errorCode,
        ...(Object.keys(diagnosticData).length > 0 ? { data: diagnosticData } : {})
      };
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
      const anchorResolution = await reresolveAnchors(session, this.opsContext);

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
        const ambiguousCount = anchorResolution?.moved.filter((m) => m.candidates !== undefined).length ?? 0;
        const ambiguousWarning = ambiguousCount > 0
          ? `${ambiguousCount} statement anchor(s) matched multiple lines and re-anchored to the nearest match — check anchorResolution.moved (candidates listed) and re-set any that landed wrong.`
          : undefined;
        const warnings = [priorWarning, staleWarning, ambiguousWarning].filter(Boolean);
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
   * Set a line breakpoint. Delegates to the breakpoint controller, which owns
   * the store and the DAP re-send.
   */
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
    return this.breakpoints.setBreakpoint(sessionId, bp);
  }

  /**
   * Set a function (symbol-addressed) breakpoint (issue #271 phase 3).
   */
  async setFunctionBreakpoint(
    sessionId: string,
    bp: {
      functionName: string;
      condition?: string;
    }
  ): Promise<{ breakpoint: FunctionBreakpoint; warning?: string }> {
    return this.breakpoints.setFunctionBreakpoint(sessionId, bp);
  }

  /**
   * Remove one breakpoint by its id (the id returned by setBreakpoint).
   */
  async removeBreakpoint(
    sessionId: string,
    breakpointId: string
  ): Promise<{ removed?: Breakpoint | FunctionBreakpoint; warning?: string }> {
    return this.breakpoints.removeBreakpoint(sessionId, breakpointId);
  }

  /**
   * Remove ALL breakpoints at a file:line location.
   */
  async removeBreakpointsByLocation(
    sessionId: string,
    file: string,
    line: number
  ): Promise<{ removed: Breakpoint[]; warning?: string }> {
    return this.breakpoints.removeBreakpointsByLocation(sessionId, file, line);
  }

  /**
   * Remove all of the session's breakpoints, or all breakpoints in one file.
   */
  async clearBreakpoints(
    sessionId: string,
    file?: string
  ): Promise<{ cleared: number; files: string[]; warning?: string }> {
    return this.breakpoints.clearBreakpoints(sessionId, file);
  }

  /** Step over the current line. */
  async stepOver(sessionId: string): Promise<DebugResult> {
    return this.execution.stepOver(sessionId);
  }

  /** Step into the call on the current line. */
  async stepInto(sessionId: string): Promise<DebugResult> {
    return this.execution.stepInto(sessionId);
  }

  /** Step out of the current frame. */
  async stepOut(sessionId: string): Promise<DebugResult> {
    return this.execution.stepOut(sessionId);
  }

  /**
   * Resume the debuggee. Stays a facade method because the core's
   * auto-continue path calls it directly.
   */
  async continue(sessionId: string): Promise<DebugResult> {
    return this.execution.continue(sessionId);
  }

  /** Pause a running debuggee. */
  async pause(sessionId: string, threadId?: number): Promise<DebugResult> {
    return this.execution.pause(sessionId, threadId);
  }

  /** List the debuggee's threads. */
  async listThreads(sessionId: string): Promise<Array<{ id: number; name: string }>> {
    return this.execution.listThreads(sessionId);
  }

  /**
   * Evaluate an expression in the paused debuggee's frame.
   */
  async evaluateExpression(
    sessionId: string,
    expression: string,
    frameId?: number,
    timeoutMs?: number
  ): Promise<EvaluateResult> {
    return this.evaluator.evaluateExpression(sessionId, expression, frameId, timeoutMs);
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
    // getFactoryMetadata is on IAdapterRegistry (issue #435 part 4); the
    // runtime guard stays for partial registry doubles, but skipping the
    // gate must never be silent — that is the fail-open degradation the
    // typed surface exists to expose.
    if (typeof this.adapterRegistry.getFactoryMetadata === 'function') {
      const factoryMeta = await this.adapterRegistry.getFactoryMetadata(session.language).catch(() => undefined);
      if (factoryMeta?.modes?.attach === 'none') {
        return {
          success: false,
          state: session.state,
          error: ErrorMessages.attachModeNotSupported(session.language)
        };
      }
    } else {
      this.logger.warn(
        `[SessionManager] adapterRegistry has no getFactoryMetadata; skipping the attach-'none' ` +
          `enforcement gate for '${session.language}'.`
      );
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

        // Some adapters reject the attach only after reporting themselves
        // configured (CodeLLDB does this for e.g. ptrace EPERM). The proxy
        // then dies mid-verify and every remaining 'threads' poll would throw
        // a generic "Proxy not initialized", masking the real error — so latch
        // the first proxy error/exit as the failure and stop polling.
        let proxyGone = false;
        const onProxyError = (err: Error): void => {
          if (!proxyGone) {
            proxyGone = true;
            lastFailure = err.message;
          }
        };
        const onProxyExit = (code: number | null, signal?: string): void => {
          if (!proxyGone) {
            proxyGone = true;
            lastFailure = `debug adapter exited during attach verification (code=${code}${signal ? `, signal=${signal}` : ''})`;
          }
        };
        proxyManager.on('error', onProxyError);
        proxyManager.on('exit', onProxyExit);

        const requestThreads = async (): Promise<void> => {
          const remainingMs = Math.max(deadline - Date.now(), 1);
          const threadsResponse = await this.sendThreadsRequestBounded(proxyManager, remainingMs);
          if (proxyGone) {
            return;
          }
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

        try {
          // First discovery attempt.
          try {
            await requestThreads();
          } catch (err) {
            if (!proxyGone) {
              lastFailure = err instanceof Error ? err.message : String(err);
            }
            this.logger.warn(`[SessionManager] Initial thread discovery for attach failed: ${lastFailure}`);
          }

          // Retry until the deadline if the debugger has not reported threads yet.
          while (!threads && !proxyGone && Date.now() < deadline) {
            const sleepMs = Math.min(pollIntervalMs, Math.max(deadline - Date.now(), 1));
            await new Promise((resolve) => setTimeout(resolve, sleepMs));
            if (proxyGone || Date.now() >= deadline) {
              break;
            }
            try {
              await requestThreads();
            } catch (err) {
              if (!proxyGone) {
                lastFailure = err instanceof Error ? err.message : String(err);
              }
            }
          }
        } finally {
          proxyManager.removeListener('error', onProxyError);
          proxyManager.removeListener('exit', onProxyExit);
        }

        if (!threads) {
          const reason = proxyGone
            ? ErrorMessages.attachAdapterFailed(lastFailure)
            : ErrorMessages.attachVerifyFailed(verifyTimeoutMs, lastFailure);
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
            // pauseAllThreads (issue #465): threadId 0 asks the adapter for a
            // process-wide suspend — the JDI bridge then re-anchors its
            // stopped event to a thread that can actually report frames,
            // instead of single-thread-suspending whichever id we picked.
            const pauseThreadId = attachBehavior.pauseAllThreads ? 0 : discoveredThreadId;
            await proxyManager.sendDapRequest('pause', { threadId: pauseThreadId });
            this.logger.info(`[SessionManager] Sent post-attach pause (threadId=${pauseThreadId})`);
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

      // Attach parity with the post-launch belt-and-braces re-sync (issues
      // #236/#439, here for #500): breakpoints set before attach_to_process
      // were sent during the handshake, whose responses the policy may
      // discard — and for js-debug the child session only answered its
      // pending stub while adoption was in flight. Re-sending now, with the
      // debuggee-owning session provably live, delivers the authoritative
      // verification. Replace-all with the identical set is idempotent;
      // syncBreakpointsForFile never throws and no-ops unless live.
      if (session.breakpoints.size > 0) {
        const files = [...new Set(Array.from(session.breakpoints.values()).map(bp => bp.file))];
        for (const file of files) {
          // forceFreshEcho: js-debug answers a no-change re-send with an
          // empty echo, and pre-attach breakpoints were already registered
          // via its pending-target queue — without a fresh echo their
          // verified state is unrecoverable (issue #500).
          await this.breakpoints.syncBreakpointsForFile(session, file, { forceFreshEcho: true });
        }
      }
      if ((session.functionBreakpoints?.size ?? 0) > 0) {
        await this.breakpoints.syncFunctionBreakpoints(session);
      }
      // Unverified-at-attach function breakpoints get the same launch-style
      // warning (issue #308); bind-late adapters (js/java) stay suppressed
      // inside the builder.
      const attachFnBpWarning = this.breakpoints.functionBreakpointLaunchWarning(session);

      const attachData: Record<string, unknown> = {
        message: attachConfig.processId
          ? `Attached to process PID ${attachConfig.processId}`
          : `Attached to process at ${attachConfig.host || 'localhost'}:${attachConfig.port}`,
        attachConfig
      };
      // Surface adapterConfig keys the adapter's attach transform dropped
      // (issue #450) and keys forwarded to the adapter unrecognized (issue
      // #466) — "unknown attach keys should either work or warn".
      const droppedKeys = session.attachDroppedConfigKeys;
      const forwardedKeys = session.attachForwardedUnknownConfigKeys;
      session.attachDroppedConfigKeys = undefined;
      session.attachForwardedUnknownConfigKeys = undefined;
      const warningParts: string[] = [];
      if (attachFnBpWarning) {
        warningParts.push(attachFnBpWarning);
      }
      if (droppedKeys && droppedKeys.length > 0) {
        warningParts.push(
          `adapterConfig key(s) not supported by the ${session.language} attach request were ignored: ${droppedKeys.join(', ')}`
        );
      }
      if (forwardedKeys && forwardedKeys.length > 0) {
        warningParts.push(
          `adapterConfig key(s) not recognized by mcp-debugger were forwarded to the ${session.language} adapter as-is: ${forwardedKeys.join(', ')}`
        );
      }
      if (warningParts.length > 0) {
        attachData.warning = warningParts.join('; ');
      }

      return {
        success: true,
        state: finalState,
        data: attachData
      };
    } catch (error) {
      this.logger.error(`[SessionManager] Failed to attach to process for session ${sessionId}:`, error);
      // Never leave a live proxy chain behind a failed attach — e.g.
      // ProxyManager.start()'s init timeout rejects after the worker was
      // spawned (issue #337). Idempotent with the verify-failure teardown
      // above, which already nulled session.proxyManager.
      await this.stopProxyPreservingSession(session);
      this._updateSessionState(session, SessionState.ERROR);

      // Surface the same structured diagnostics the launch path returns
      // (issue #551) and log the same full failure record it logs, proxy-log
      // tail included (issue #561) — an attach that dies during proxy
      // initialization used to leave the adapter's own complaint unreadable.
      // Teardown only clears the proxy handle; logDir and the error's
      // initProgress survive it, so this reads after the teardown and can
      // never keep it from running.
      const diagnosticData = await logProxyFailure(
        { logger: this.logger, fileSystem: this.fileSystem },
        session,
        error,
        'attachToProcess'
      );
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        state: SessionState.ERROR,
        error: `Failed to attach: ${message}`,
        ...(Object.keys(diagnosticData).length > 0 ? { data: diagnosticData } : {})
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

    const timeoutOverride = resolveDapTimeoutOverride(
      timeoutMs,
      `SM redefineClasses ${sessionId}`,
      this.logger
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

      // Statement anchors are content identities and a hot-swap invalidates
      // line numbers (issue #464): re-resolve them against the new source —
      // which IS what is on disk in the edit -> recompile -> hot-swap loop —
      // and re-send the affected files so the JDI replant binds the moved
      // lines against the new line table. Ordered after the redefine
      // response, i.e. after vm.redefineClasses, by construction.
      let anchorResolution: RedefineClassesResult['anchorResolution'];
      const syncWarnings: string[] = [];
      if ((body.redefinedCount ?? 0) > 0) {
        anchorResolution = await reresolveAnchors(session, this.opsContext);
        if (anchorResolution && anchorResolution.moved.length > 0) {
          const movedFiles = [...new Set(anchorResolution.moved.map(m => m.file))];
          for (const file of movedFiles) {
            const { warning } = await this.breakpoints.syncBreakpointsForFile(session, file);
            if (warning) {
              syncWarnings.push(warning);
            }
          }
        }
        if (anchorResolution && anchorResolution.stale.length > 0) {
          syncWarnings.push(
            `${anchorResolution.stale.length} statement-anchored breakpoint(s) could not be re-resolved ` +
            `against the new source and keep their previous line — see anchorResolution.stale`
          );
        }
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
        replantedBreakpoints: body.replantedBreakpoints,
        ...(anchorResolution ? { anchorResolution } : {}),
        ...(syncWarnings.length > 0 ? { warning: syncWarnings.join('; ') } : {}),
      };
    } catch (error) {
      this.logger.error(`[SM redefineClasses ${sessionId}] Error: ${error}`);
      return {
        success: false,
        error: withTimeoutHint(error instanceof Error ? error.message : String(error)),
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
        error: withTimeoutHint(error instanceof Error ? error.message : String(error))
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
        error: withTimeoutHint(error instanceof Error ? error.message : String(error))
      };
    }
  }
}
