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
 *
 * Preparation and commitment are kept apart (issue #812): `prepareLaunchInputs`
 * and `prepareAdapter` compute everything and write nothing to the session,
 * handing back a `LaunchPreparationRecord`; `start()` commits that record and
 * starts the proxy, and a dry run answers with it and leaves the session as it
 * found it.
 */
import path from 'path';
import {
  AdapterConfig,
  type ExceptionBreakMode,
  type IDebugAdapter,
  type GenericLaunchConfig,
  type GenericAttachConfig,
  type LanguageSpecificLaunchConfig,
  redactSecretsInString
} from '@debugmcp/shared';
import { AdapterLease } from '../../adapters/adapter-lease.js';
import { DebugSessionCreationError, PythonNotFoundError } from '../../errors/debug-errors.js';
import { ProxyConfig } from '../../proxy/proxy-config.js';
import { sessionRunDirectoryFor } from '../../proxy/session-log-layout.js';
import { didYouMean } from '../../utils/did-you-mean.js';
import { ErrorMessages } from '../../utils/error-messages.js';
import type { CustomLaunchRequestArguments } from '../session-manager-core.js';
import type { ManagedSession, ToolchainValidationState, TransformedLaunch } from '../session-store.js';
import type { ProxyLaunchContext } from '../operations-context.js';
import { callerLaunchInputs, collectLaunchConfigNotices, type CallerLaunchInput, collectAttachTransformNotices } from './launch-config-diagnostics.js';


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
  adapterLaunchConfig?: Record<string, unknown>;
  breakOnExceptions?: ExceptionBreakMode;
  /** The launcher's decision that this launch runs with the debugger off (issues #710, #746). */
  debuggerOff?: boolean;
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
  callerLaunchInputs: Record<string, CallerLaunchInput>;
  adapterConfig: AdapterConfig;
}

/** The two products of adapter-side preparation: what to start, and what to return. */
export interface AdapterLaunchPlan {
  launchConfig: LanguageSpecificLaunchConfig;
  proxyConfig: ProxyConfig;
}

/**
 * What adapter-side preparation learned about the attempt, kept apart from the
 * session until the caller decides what it becomes: `start()` commits it as
 * the real launch's record; a dry run answers with it and commits nothing
 * (issue #812). Filled on every outcome — a transform that throws has still
 * drained its notices, and the toolchain verdict it recorded still names the
 * cause (issue #552) — so a failed launch reports what it learned.
 */
export interface LaunchPreparationRecord {
  /** Caller-key notices from the launch transform, redacted; empty for an attach. */
  launchConfigNotices: string[];
  /** The adapter's own attach notes (issue #908); attach mode only. */
  attachTransformNotices?: string[];
  /** Attach keys the transform dropped or forwarded unrecognized (issues #450, #466); attach mode, success only. */
  attachKeyDiff?: { dropped: string[]; forwardedUnknown: string[] };
  /** The adapter's toolchain verdict, when it recorded one. */
  toolchainValidation?: ToolchainValidationState;
  /** The artefact the launch runs (issue #950); launch mode, success only. */
  transformedLaunch?: TransformedLaunch;
}

/**
 * Adapter-side preparation either yields a held lease and the plan, or the
 * error it hit with the lease already released. The error is the same object,
 * unwrapped: callers classify it by class and message. Either way the record
 * says what was learned.
 */
export type AdapterPreparationOutcome =
  | { ok: true; lease: AdapterLease; plan: AdapterLaunchPlan; record: LaunchPreparationRecord }
  | { ok: false; error: unknown; record: LaunchPreparationRecord };

/**
 * The artefact a source binds through is whatever the transform made the
 * engine run (issue #950) — the compiled binary for a `.rs`/`.cpp` program,
 * the DLL a .NET launch named, the script itself for Python — so it is read
 * off the plan, after the transform; lastLaunch holds the caller's request. A
 * relative program is resolved against the launch cwd, as the engine resolves
 * it. Recorded without `env` and `envFile`: no policy reads them, and a
 * session should not hold a copy of the caller's secrets (or js-debug's whole
 * merged environment) for its lifetime.
 */
function describeTransformedLaunch(plan: AdapterLaunchPlan): TransformedLaunch {
  const { env: _env, envFile: _envFile, ...recorded } = { ...plan.launchConfig } as Record<string, unknown>;
  const program = plan.proxyConfig.scriptPath;
  const cwd = typeof recorded.cwd === 'string' && recorded.cwd.length > 0 ? recorded.cwd : undefined;
  return {
    program: path.isAbsolute(program) || cwd === undefined ? program : path.resolve(cwd, program),
    launchConfig: recorded
  };
}

export class ProxyLauncher {
  constructor(private readonly ctx: ProxyLaunchContext) {}

  async start(
    session: ManagedSession,
    request: ProxyLaunchRequest
  ): Promise<LanguageSpecificLaunchConfig> {
    // A verdict belongs to exactly one proxy-launch attempt. Clear the stored
    // projection before any fallible setup so an adapter-acquire, filesystem,
    // or transform failure cannot inherit an earlier MSVC classification.
    this.ctx.updateSession(session.id, { toolchainValidation: undefined });
    session.launchConfigNotices = [];
    session.attachTransformNotices = undefined;
    session.transformedLaunch = undefined;

    // Log entrance for Windows CI debugging
    this.ctx.logger.info(
      `[SessionManager] Entering ProxyLauncher.start for session ${session.id}, scriptPath: ${request.scriptPath}`
    );

    const inputs = await this.prepareLaunchInputs(session, request);
    // The run directory goes on the session before the adapter is acquired: a
    // failure's proxy-log pointers (proxy-failure-diagnostics.ts) are derived
    // from it and must name this attempt's directory, not the last run's.
    this.ctx.updateSession(session.id, { logDir: inputs.sessionLogDir });

    // What preparation learned is this attempt's record whether or not it
    // succeeded: a thrown transform has still drained its notices, and the
    // verdict it recorded still names the cause. Committed before the proxy
    // handlers are installed, which seed the notices into the output buffer.
    const outcome = await this.prepareAdapter(session, inputs, request);
    if (!outcome.ok) {
      // The lease is already released: a throw from the commit itself (the
      // session closed meanwhile) strands nothing.
      this.commitPreparation(session, outcome.record);
      throw outcome.error;
    }

    // The lease owns the adapter until `transferTo` hands it to the ProxyManager:
    // every throw before that point disposes it (prepareAdapter's own catch, or
    // the finally below), returning its registry slot. After the transfer the
    // release is a no-op and the ProxyManager's teardown owns disposal — both
    // callers' catches stop `session.proxyManager`, and `ProxyManager.cleanup()`
    // disposes the adapter from there. Same behaviour as the `adapterOwnedByProxy`
    // boolean it replaces (#557); the difference is that the boolean had to be
    // assigned at one point and consulted from one catch, so the next throw site
    // added outside that window would have silently reopened the leak — which is
    // why the commit below runs inside this try: it writes through the store,
    // and the store throws once a close has removed the session.
    const { lease, plan } = outcome;
    try {
      this.commitPreparation(session, outcome.record);

      // Create and start ProxyManager with the adapter. Ownership moves here:
      // ProxyManager.cleanup() becomes the disposer and release() below is a
      // no-op.
      const proxyManager = lease.transferTo(this.ctx.proxyManagerFactory);
      session.proxyManager = proxyManager;

      // Set up event handlers
      // The core must see the same entry-stop intent the worker sees (#791).
      // Attach retains its separate pause/verification semantics.
      const effectiveLaunchArgs = inputs.isAttachMode ? inputs.effectiveLaunchArgs : {
        ...inputs.effectiveLaunchArgs,
        stopOnEntry: plan.proxyConfig.stopOnEntry
      };
      this.ctx.setupProxyEventHandlers(session, proxyManager, effectiveLaunchArgs);

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
    const sessionLogDir = sessionRunDirectoryFor(this.ctx.logDirBase, sessionId, Date.now());
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
      callerLaunchInputs: callerLaunchInputs(dapLaunchArgs, adapterLaunchConfig),
      adapterConfig
    };
  }

  /**
   * Everything that needs an adapter, on one lease, writing nothing to the
   * session: acquire it, transform the configuration, settle the toolchain
   * verdict, resolve the executable, assemble the plan. The caller decides
   * what the record becomes — `start()` commits it and transfers the lease to
   * the ProxyManager; a dry run answers with it and releases the lease (issue
   * #812). A failure comes back as an outcome rather than a throw so the
   * record travels with the error, and the lease is already released.
   *
   * One adapter instance for the whole attempt is load-bearing: the Dart and
   * COBOL adapters' `buildAdapterCommand` read what their transform set on the
   * instance, the .NET adapter's executable resolution reads the architecture
   * its attach transform probed, and the verdict and diagnostics are drained
   * once each.
   */
  async prepareAdapter(
    session: ManagedSession,
    inputs: LaunchInputs,
    request: ProxyLaunchRequest
  ): Promise<AdapterPreparationOutcome> {
    const record: LaunchPreparationRecord = { launchConfigNotices: [] };
    let lease: AdapterLease;
    try {
      lease = await AdapterLease.acquire(
        this.ctx.adapterRegistry,
        session.language,
        inputs.adapterConfig,
        this.ctx.logger
      );
    } catch (error) {
      return { ok: false, error, record };
    }
    try {
      const plan = await this.prepareAdapterLaunch(session, lease.adapter, inputs, request, record);
      // An attach debugs some other process: nothing to record.
      if (!inputs.isAttachMode) {
        record.transformedLaunch = describeTransformedLaunch(plan);
      }
      return { ok: true, lease, plan, record };
    } catch (error) {
      await lease.release();
      return { ok: false, error, record };
    }
  }

  /**
   * Write what preparation learned onto the session: the launch warning reads
   * the notices, `setupProxyEventHandlers` seeds them into the output buffer
   * (so this runs before the handlers are installed), the attach controller
   * reads the attach notes and key diff, and the stale-build check reads the
   * transformed launch. The toolchain verdict is a projection for diagnostics,
   * not an error discriminator: the launch-level catch classifies only the
   * verdict attached to the thrown sentinel.
   */
  private commitPreparation(session: ManagedSession, record: LaunchPreparationRecord): void {
    session.launchConfigNotices = record.launchConfigNotices;
    session.attachTransformNotices = record.attachTransformNotices;
    if (record.attachKeyDiff) {
      // Both assigned whenever an attach transform ran, so a prior attach's
      // record never leaks into this one.
      const { dropped, forwardedUnknown } = record.attachKeyDiff;
      session.attachDroppedConfigKeys = dropped.length > 0 ? dropped : undefined;
      session.attachForwardedUnknownConfigKeys = forwardedUnknown.length > 0 ? forwardedUnknown : undefined;
    }
    this.ctx.updateSession(session.id, { toolchainValidation: record.toolchainValidation });
    session.transformedLaunch = record.transformedLaunch;
  }

  /**
   * Everything that needs the adapter, in the order the adapters depend on:
   * transform the configuration, record which attach keys the transform
   * dropped, settle the toolchain verdict, resolve the executable, then
   * assemble the proxy configuration. Runs inside the lease, so any step here
   * may throw without stranding the adapter's registry slot. Writes into the
   * record, never the session.
   */
  private async prepareAdapterLaunch(
    session: ManagedSession,
    adapter: IDebugAdapter,
    inputs: LaunchInputs,
    request: ProxyLaunchRequest,
    record: LaunchPreparationRecord
  ): Promise<AdapterLaunchPlan> {
    let transformedLaunchConfig: LanguageSpecificLaunchConfig | undefined;
    try {
      transformedLaunchConfig = await this.transformAdapterConfig(session, adapter, inputs, record);
    } finally {
      if (!inputs.isAttachMode) {
        // Notices name caller keys. Redact them here, the same way the output
        // buffer they are seeded into does (#237): a launch that fails before
        // the proxy starts returns them straight from the record, and one
        // redacted text lets the launch warning dedupe against its seeded copy.
        const notices = collectLaunchConfigNotices(adapter, inputs.callerLaunchInputs, transformedLaunchConfig);
        record.launchConfigNotices = this.ctx.redactionEnabled()
          ? notices.map(notice => redactSecretsInString(notice).value)
          : notices;
        for (const notice of record.launchConfigNotices) this.ctx.logger.warn(`[SessionManager] ${notice}`);
      } else {
        // The adapter's own attach notes (issue #908): drained here or lost —
        // each attempt acquires a fresh adapter. On a thrown transform they
        // are recorded and logged only; the attach error is the adapter's own.
        const notices = collectAttachTransformNotices(adapter);
        const rendered = this.ctx.redactionEnabled()
          ? notices.map(notice => redactSecretsInString(notice).value)
          : notices;
        record.attachTransformNotices = rendered.length > 0 ? rendered : undefined;
        for (const notice of rendered) {
          this.ctx.logger.warn(`[SessionManager] ${session.language} attach: ${notice}`);
        }
      }
    }

    record.attachKeyDiff = this.describeAttachKeyDiff(session, adapter, inputs, transformedLaunchConfig);

    this.settleToolchainValidation(adapter, record);

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
    inputs: LaunchInputs,
    record: LaunchPreparationRecord
  ): Promise<LanguageSpecificLaunchConfig> {
    const { isAttachMode, genericLaunchConfig } = inputs;
    try {
      if (isAttachMode && adapter.supportsAttach && adapter.supportsAttach() && adapter.transformAttachConfig) {
        // Call transformAttachConfig for attach operations (sync or async: awaited either
        // way, so a rejection lands in the catch below like a thrown error).
        const transformedAttachConfig = await adapter.transformAttachConfig(genericLaunchConfig as GenericAttachConfig);
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
      this.settleToolchainValidation(adapter, record);
      throw error;
    }
  }

  /**
   * Attach transforms may strip adapterConfig keys (issue #450) — record the
   * drops so attachToProcess can warn the caller. Keys the transform kept but
   * the adapter doesn't declare in supportedAttachKeys are forwarded to the
   * debug adapter as-is, and recorded separately so the caller learns they
   * weren't recognized (issue #466) — never deleted, so upstream debugger
   * capabilities stay reachable without an mcp-debugger release. Both lists
   * come back whenever an attach transform ran (empty included) so the commit
   * assigns both and a prior attach's record never leaks; nothing for a launch.
   */
  private describeAttachKeyDiff(
    session: ManagedSession,
    adapter: IDebugAdapter,
    inputs: LaunchInputs,
    transformedLaunchConfig: LanguageSpecificLaunchConfig
  ): LaunchPreparationRecord['attachKeyDiff'] {
    if (!inputs.isAttachMode) {
      return undefined;
    }
    const sessionId = session.id;
    const supportedKeys = adapter.supportedAttachKeys;
    // A typo of a supported key is the likeliest caller mistake — annotate
    // both buckets with an edit-distance suggestion when a list is declared.
    const describeKey = (key: string): string => {
      const suggestion = supportedKeys ? didYouMean(key, supportedKeys) : null;
      return suggestion && suggestion !== key ? `${key} (did you mean ${suggestion}?)` : key;
    };
    // Keys the adapter declares it consumes (a manifest regeneration, a shim side
    // channel) leave the transform's output on purpose: used, not dropped.
    const consumedKeys = adapter.consumedAttachKeys ?? [];

    const dropped: string[] = [];
    const forwardedUnknown: string[] = [];
    for (const key of inputs.adapterExtraKeys) {
      if (!(key in transformedLaunchConfig)) {
        if (!consumedKeys.includes(key)) {
          dropped.push(describeKey(key));
        }
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
    return { dropped, forwardedUnknown };
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
    const { scriptPath, scriptArgs, dapLaunchArgs, breakOnExceptions } = request;
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

    const stopOnEntryProvided = typeof request.adapterLaunchConfig?.stopOnEntry === 'boolean' ||
      typeof dapLaunchArgs?.stopOnEntry === 'boolean';

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
    if (request.debuggerOff) launchConfigData.stopOnEntry = false;

    this.ctx.logger.info(
      `[SessionManager] Launch config stopOnEntry adjustments for ${sessionId}: base=${String(
        transformedLaunchConfig.stopOnEntry
      )}, final=${String(launchConfigData.stopOnEntry)}, userProvided=${String(
        request.adapterLaunchConfig?.stopOnEntry ?? dapLaunchArgs?.stopOnEntry
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
      // A dry run never reaches the proxy (issue #812): it is answered from the
      // plan in the parent. The field goes with the worker's dry-run path.
      dryRunSpawn: false,
      debuggerOff: request.debuggerOff === true,
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
   * Drain the adapter's toolchain verdict for this attempt into the record and
   * turn an incompatible one into the MSVC_TOOLCHAIN_DETECTED sentinel that
   * startDebugging renders as a structured, retryable response. Runs after
   * the launch transform whether it resolved or rejected: with
   * CPP/RUST_MSVC_BEHAVIOR=error the adapter records the verdict and then
   * rejects from inside transformLaunchConfig, and that verdict must still
   * reach the caller. A no-verdict attempt records none, so the commit clears
   * a previous launch's verdict rather than letting it mislabel an unrelated
   * failure.
   */
  private settleToolchainValidation(adapter: IDebugAdapter, record: LaunchPreparationRecord): void {
    const adapterWithToolchain = adapter as {
      consumeLastToolchainValidation?: () => unknown;
    };
    const toolchainValidation =
      typeof adapterWithToolchain.consumeLastToolchainValidation === 'function'
      ? (adapterWithToolchain.consumeLastToolchainValidation() as ToolchainValidationState | undefined)
      : undefined;

    record.toolchainValidation = toolchainValidation ?? undefined;
    if (!toolchainValidation) {
      return;
    }
    if (!toolchainValidation.compatible && toolchainValidation.behavior !== 'continue') {
      const toolchainError = new Error('MSVC_TOOLCHAIN_DETECTED') as Error & {
        toolchainValidation?: ToolchainValidationState;
      };
      toolchainError.toolchainValidation = toolchainValidation;
      throw toolchainError;
    }
  }
}
