/**
 * The proxy launch: everything between "start this session's debug proxy" and
 * a running ProxyManager with the adapter handed over to it. Launch and attach
 * both go through `start()` — attach is a launch whose configuration says
 * `request: 'attach'` — so this is the one place adapter creation, the
 * language-specific configuration transform, executable resolution and the
 * ProxyConfig assembly happen.
 *
 * Adapter ownership is explicit: `AdapterLease` holds the registry slot from
 * `acquire` until `transferTo` hands the adapter to the ProxyManager, and its
 * `release()` in the `finally` disposes on every failure path (issue #557).
 * The preparation is split into typed steps (`LaunchInputs` before an adapter
 * exists, `AdapterLaunchPlan` once one does) so each can be tested on its own.
 */
import path from 'path';
import {
  AdapterConfig,
  type ExceptionBreakMode,
  type IDebugAdapter,
  type GenericLaunchConfig,
  type GenericAttachConfig,
  type LanguageSpecificLaunchConfig
} from '@debugmcp/shared';
import { AdapterLease } from '../../adapters/adapter-lease.js';
import { DebugSessionCreationError, PythonNotFoundError } from '../../errors/debug-errors.js';
import { ProxyConfig } from '../../proxy/proxy-config.js';
import { didYouMean } from '../../utils/did-you-mean.js';
import { ErrorMessages } from '../../utils/error-messages.js';
import type { CustomLaunchRequestArguments } from '../session-manager-core.js';
import type { ManagedSession, ToolchainValidationState } from '../session-store.js';
import type { ProxyLaunchContext } from '../operations-context.js';


/**
 * Everything `start()` needs about the launch, as one object.
 *
 * It was seven positional parameters, six of them optional, which is how
 * `debug-launcher`'s dry-run call came to end three arguments early with
 * nothing at the call site to say whether that was deliberate. Named fields
 * make an omission legible. The same type is threaded through the launch
 * preparation unchanged, so no step needs a six-argument signature of its own.
 */
export interface ProxyLaunchRequest {
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
export interface LaunchInputs {
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
export interface AdapterLaunchPlan {
  launchConfig: LanguageSpecificLaunchConfig;
  proxyConfig: ProxyConfig;
}

export class ProxyLauncher {
  constructor(private readonly ctx: ProxyLaunchContext) {}

  async start(
    session: ManagedSession,
    request: ProxyLaunchRequest
  ): Promise<LanguageSpecificLaunchConfig> {
    // Log entrance for Windows CI debugging
    this.ctx.logger.info(
      `[SessionManager] Entering ProxyLauncher.start for session ${session.id}, dryRunSpawn: ${request.dryRunSpawn}, scriptPath: ${request.scriptPath}`
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
      this.ctx.adapterRegistry,
      session.language,
      inputs.adapterConfig,
      this.ctx.logger
    );
    try {
      const plan = await this.prepareAdapterLaunch(session, lease.adapter, inputs, request);

      // Create and start ProxyManager with the adapter. Ownership moves here:
      // ProxyManager.cleanup() becomes the disposer and release() below is a
      // no-op.
      const proxyManager = lease.transferTo(this.ctx.proxyManagerFactory);
      session.proxyManager = proxyManager;

      // Set up event handlers
      this.ctx.setupProxyEventHandlers(session, proxyManager, inputs.effectiveLaunchArgs);

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
  async prepareLaunchInputs(
    session: ManagedSession,
    request: ProxyLaunchRequest
  ): Promise<LaunchInputs> {
    const sessionId = session.id;
    const { scriptPath, scriptArgs, dapLaunchArgs, adapterLaunchConfig } = request;

    // Create session log directory
    const sessionLogDir = path.join(this.ctx.logDirBase, sessionId, `run-${Date.now()}`);
    this.ctx.logger.info(`[SessionManager] Ensuring session log directory: ${sessionLogDir}`);
    try {
      // ensureDir (fs-extra's recursive mkdir) rejects when it cannot create
      // the directory; a follow-up existence check was a redundant stat.
      await this.ctx.fileSystem.ensureDir(sessionLogDir);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.ctx.logger.error(`[SessionManager] Failed to create log directory:`, err);
      throw new Error(`Failed to create session log directory: ${message}`);
    }
    // Persist log directory on session for diagnostics
    this.ctx.updateSession(sessionId, { logDir: sessionLogDir });

    // Get free port for adapter
    const adapterPort = await this.ctx.findFreePort();

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
      ...this.ctx.defaultDapLaunchArgs,
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
        this.ctx.logger.warn(
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
        this.ctx.logger.info(`[SessionManager] Using attach config for ${session.language}`);
        return transformedAttachConfig;
      }
      // Call transformLaunchConfig for launch operations
      return await adapter.transformLaunchConfig(genericLaunchConfig as GenericLaunchConfig);
    } catch (error) {
      this.ctx.logger.warn(
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
      this.ctx.logger.warn(
        `[SessionManager] ${session.language} attach transform dropped adapterConfig key(s) for session ${sessionId}: ${dropped.join(', ')}`
      );
    }
    if (forwardedUnknown.length > 0) {
      this.ctx.logger.warn(
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
      this.ctx.logger.info(
        `[SessionManager] Direct-connect attach for ${session.language}; skipping executable resolution`
      );
      return resolvedExecutablePath;
    }

    try {
      const resolvedExecutablePath = await adapter.resolveExecutablePath(session.executablePath);
      this.ctx.logger.info(`[SessionManager] Adapter resolved executable path: ${resolvedExecutablePath}`);
      return resolvedExecutablePath;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.logger.error(
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
  buildAdapterLaunchPlan(
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
      const adapterPolicy = this.ctx.selectPolicy(session.language);
      const policyDefaults = adapterPolicy.getInitializationBehavior?.();
      /* istanbul ignore next -- adapter-specific: Go/Delve stopOnEntry override */
      if (typeof policyDefaults?.defaultStopOnEntry === 'boolean') {
        launchConfigData.stopOnEntry = policyDefaults.defaultStopOnEntry;
      }
    }

    this.ctx.logger.info(
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
      this.ctx.logger.info(
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
      logLevel: (this.ctx.logger as { level?: string }).level,
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
      this.ctx.updateSession(sessionId, { toolchainValidation: undefined });
      return;
    }
    this.ctx.updateSession(sessionId, { toolchainValidation });
    if (!toolchainValidation.compatible && toolchainValidation.behavior !== 'continue') {
      const toolchainError = new Error('MSVC_TOOLCHAIN_DETECTED') as Error & {
        toolchainValidation?: ToolchainValidationState;
      };
      toolchainError.toolchainValidation = toolchainValidation;
      throw toolchainError;
    }
  }
}
