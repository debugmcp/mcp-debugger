/**
 * Launch-mode sessions: `start_debugging` end to end, its dry-run variant, and
 * `restart_debugging`, which replays the last real launch.
 *
 * The shape of a launch is: gate on the toolchain, tear down any previous
 * proxy (session-preservingly), record the launch spec for restart, start the
 * proxy through the ProxyLauncher, run the policy handshake, wait until the
 * program is launched and then hold briefly for its first stop
 * (launch-readiness.ts — the same for every adapter, issues #823/#826),
 * re-sync breakpoints against the debuggee if it is paused, then report the
 * state plus every launch-time warning the session accumulated. A failure at any point
 * after the proxy exists tears it down and reports the proxy-log pointers
 * alongside the error.
 *
 * A dry run (issue #812) is a query, not a launch: after the toolchain gate it
 * runs the launch preparation through the ProxyLauncher — adapter, transform,
 * executable, the spawn command — and answers with what the launch would run.
 * It touches nothing: no teardown of a live proxy, no state change, no
 * per-launch reset, no record on the session.
 */
import {
  SessionState,
  SessionLifecycleState,
  sanitizePayloadForLogging,
  type AdapterPolicy,
  type ExceptionBreakMode
} from '@debugmcp/shared';
import { isTerminalSessionState, resolveExceptionFilters } from '@debugmcp/shared';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { ErrorMessages } from '../../utils/error-messages.js';
import { checkLaunchToolchain } from '../../utils/language-availability.js';
import { setCuratedMessage } from '../breakpoints/hit-verification.js';
import type { CustomLaunchRequestArguments, DebugResult, LaunchResultData } from '../session-manager-core.js';
import type { ManagedSession, ToolchainValidationState } from '../session-store.js';
import type { LaunchContext } from '../operations-context.js';
import { describeStopLocation, landingFields, type StopLanding } from '../inspection/stop-location.js';
import { composeStopSnapshot } from '../inspection/stop-snapshot.js';
import type { BreakpointController, ResyncOutcome } from '../breakpoints/breakpoint-controller.js';
import { reresolveAnchors, type AnchorResolution } from '../breakpoints/anchor-resolution.js';
import {
  buildLogpointDowngradeLaunchWarning,
  buildNoDebugFailureNote,
  buildNoDebugLaunchWarning,
  buildUnboundBreakpointExitWarning,
  buildRunToCompletionSummary
} from '../breakpoints/launch-warnings.js';
import {
  failProxySetup,
  sessionRemovedDuringTeardown
} from './proxy-failure-diagnostics.js';
import { waitForLaunchReadiness } from './launch-readiness.js';
import { describeLaunchArming } from './launch-arming.js';
import type { AdapterPreparationOutcome, ProxyLauncher } from './proxy-launcher.js';
import { describeLaunchTarget, describeSpawnCommand } from './spawn-command.js';
import { classifyTestRunner, TEST_RUNNER_KEY } from './test-runner-gate.js';
import type { InFlightGuard } from '../in-flight-guard.js';
import { adapterVerifiedABreakpoint, debuggerOffWhy } from '../debugger-off.js';

/**
 * A launch flag the way the adapter will see it. The proxy launcher merges
 * adapterLaunchConfig over dapLaunchArgs (the server defaults carry neither
 * of these keys), so a value read from dapLaunchArgs alone would miss a flag
 * set — or unset — through adapterLaunchConfig. The string forms are read
 * the way the proxy's message parser coerces them ('true'/'false', the
 * string-typed-args transport quirk); anything else counts by truthiness,
 * which is how the adapters read it. This is the one reading: the worker
 * takes the decision stamped on its init payload, never the flag (#746).
 */
function resolveLaunchFlag(
  key: 'noDebug' | 'stopOnEntry',
  dapLaunchArgs: Partial<CustomLaunchRequestArguments> | undefined,
  adapterLaunchConfig: Record<string, unknown> | undefined
): boolean {
  const fromAdapterConfig = adapterLaunchConfig?.[key];
  const value = fromAdapterConfig !== undefined ? fromAdapterConfig : dapLaunchArgs?.[key];
  if (value === 'true') return true;
  if (value === 'false') return false;
  return Boolean(value);
}

/**
 * Keep configuration and adapter warnings alongside a failed launch's
 * diagnostics, including failures before the proxy starts.
 */
function failureData<T extends object>(
  diagnosticData: T,
  warning: string | undefined
): { data?: T & { warning?: string } } {
  const data = { ...diagnosticData, ...(warning ? { warning } : {}) };
  return Object.keys(data).length > 0 ? { data } : {};
}

/** Preparation and adapter notes share the existing warning surface, once each. */
function launchWarnings(session: ManagedSession, ...notes: (string | undefined)[]): string | undefined {
  return joinWarnings(...notes, ...(session.launchConfigNotices ?? []), ...(session.adapterNotices ?? []));
}

/** The warning surface's join: each note once, `'; '`-separated, absent when there is none. */
function joinWarnings(...notes: (string | undefined)[]): string | undefined {
  return [...new Set(notes.filter((note): note is string => Boolean(note)))].join('; ') || undefined;
}

/**
 * What the launcher decides about noDebug before anything starts (issues
 * #710, #746, #749), shared by the launch and the dry run so both say the
 * same thing about the same request.
 */
interface NoDebugDecision {
  /** `request: 'attach'` / `__attachMode`: attaches with the debugger on; noDebug is a launch-request property. */
  isAttachShaped: boolean;
  /** The caller set the flag (never for an attach-shaped request). */
  noDebug: boolean;
  /** The flag is set and the adapter honours it: nothing armed can fire. */
  debuggerOff: boolean;
  noDebugWarning: string | undefined;
  /** For a failed launch: the warning, or the bare note when nothing was armed. */
  noDebugFailureNote: string | undefined;
  /** The caller's arguments as the launch sends them: stopOnEntry forced off when the debugger is off. */
  launchArgs: Partial<CustomLaunchRequestArguments> | undefined;
  launchAdapterConfig: Record<string, unknown> | undefined;
}

/**
 * Whether the flag turns the debugger off is the policy's word, measured per
 * adapter: where it does, nothing the caller asked to stop on can fire and
 * the breakpoint-shaped launch warnings are withheld; where the adapter
 * ignores it, the warning says so instead. Decided from the caller's own
 * breakOnExceptions rather than the policy default resolved later: a dry run
 * is a configuration check and a restart replays the same arguments, and
 * both should say so.
 */
function decideNoDebug(
  session: ManagedSession,
  policy: AdapterPolicy,
  dapLaunchArgs: Partial<CustomLaunchRequestArguments> | undefined,
  adapterLaunchConfig: Record<string, unknown> | undefined,
  breakOnExceptions: ExceptionBreakMode | undefined
): NoDebugDecision {
  const launchArgsShape = dapLaunchArgs as Record<string, unknown> | undefined;
  const isAttachShaped =
    launchArgsShape?.request === 'attach' || launchArgsShape?.__attachMode === true;
  const noDebug = !isAttachShaped && resolveLaunchFlag('noDebug', dapLaunchArgs, adapterLaunchConfig);
  const honoursNoDebug = policy.honoursNoDebug === true;
  const debuggerOff = noDebug && honoursNoDebug;
  const noDebugWarning = buildNoDebugLaunchWarning(
    session,
    { noDebug, stopOnEntry: resolveLaunchFlag('stopOnEntry', dapLaunchArgs, adapterLaunchConfig) },
    breakOnExceptions,
    honoursNoDebug
  );
  // A launch that fails under the flag still needs to point at it, whether
  // or not there was anything armed to warn about.
  const noDebugFailureNote = noDebugWarning ?? (debuggerOff ? buildNoDebugFailureNote(session.language) : undefined);
  // With the debugger off an entry stop cannot come. Everything that reads
  // stopOnEntry from here on — the proxy config (from either source the
  // adapter merge reads), the core's projection to RUNNING on
  // adapter-configured, the readiness wait — sees it off, so they agree and
  // none of them waits for a stop that cannot arrive. The warning above and
  // session.lastLaunch keep the caller's values.
  const launchArgs = debuggerOff ? { ...dapLaunchArgs, stopOnEntry: false } : dapLaunchArgs;
  const launchAdapterConfig =
    debuggerOff && adapterLaunchConfig?.stopOnEntry !== undefined
      ? { ...adapterLaunchConfig, stopOnEntry: false }
      : adapterLaunchConfig;
  return { isAttachShaped, noDebug, debuggerOff, noDebugWarning, noDebugFailureNote, launchArgs, launchAdapterConfig };
}

/** What `start_debugging` asked for, as the dry run and the launch both read it. */
interface LaunchRequestArgs {
  scriptPath: string;
  scriptArgs?: string[];
  dapLaunchArgs?: Partial<CustomLaunchRequestArguments>;
  adapterLaunchConfig?: Record<string, unknown>;
  breakOnExceptions?: ExceptionBreakMode;
}

/**
 * Which breakpoints the session holds: taken before the proxy starts and
 * compared once the program is launched. A different `signature` means a
 * set_breakpoint, remove_breakpoint or clear_breakpoints landed while the
 * launch was starting, when the breakpoint layer can only store the change
 * (issue #851). `files` and `hasFunctionBreakpoints` say what the proxy's own
 * snapshot handed the adapter, so that what was removed meanwhile can be
 * cleared there too — a re-send only visits what the store still holds.
 */
interface BreakpointSetSnapshot {
  signature: string;
  files: Set<string>;
  hasFunctionBreakpoints: boolean;
}

function snapshotBreakpointSet(
  session: Pick<ManagedSession, 'breakpoints' | 'functionBreakpoints'>
): BreakpointSetSnapshot {
  const functionIds = [...(session.functionBreakpoints?.keys() ?? [])];
  return {
    signature: [...[...session.breakpoints.keys()].sort(), '|', ...functionIds.sort()].join(','),
    files: new Set([...session.breakpoints.values()].map((bp) => bp.file)),
    hasFunctionBreakpoints: functionIds.length > 0
  };
}

export class DebugLauncher {
  constructor(
    private readonly ctx: LaunchContext,
    private readonly proxyLauncher: ProxyLauncher,
    private readonly breakpoints: BreakpointController,
    /** Shared with the attach controller: one launch-shaped call per session at a time (#711) */
    private readonly inFlight: InFlightGuard
  ) {}

  /**
   * Start a launch, or answer a dry run (issue #812). Claims the session for
   * the whole call (issue #711): a concurrent start_debugging,
   * restart_debugging or attach_to_process on the same session is refused
   * with a clear error instead of tearing down the launch this call is still
   * awaiting. The claim is made before the first await so a same-tick call
   * cannot race it. A dry run holds the claim too: it takes the language's
   * registry slot while it prepares, and one launch-shaped call per session
   * keeps its answer about one request.
   */
  async startDebugging(
    sessionId: string,
    scriptPath: string,
    scriptArgs?: string[],
    dapLaunchArgs?: Partial<CustomLaunchRequestArguments>,
    dryRunSpawn?: boolean,
    adapterLaunchConfig?: Record<string, unknown>,
    breakOnExceptions?: ExceptionBreakMode
  ): Promise<DebugResult<LaunchResultData>> {
    return this.inFlight.run(sessionId, 'launch', 'start_debugging', this.ctx, () =>
      this.launch(
        sessionId,
        scriptPath,
        scriptArgs,
        dapLaunchArgs,
        dryRunSpawn,
        adapterLaunchConfig,
        breakOnExceptions
      )
    );
  }

  /**
   * The dry run (issue #812): the launch preparation, run in this process and
   * answered without a proxy. Nothing on the session changes — the record is
   * answered rather than committed and the adapter lease is released — and
   * every failure is handled here, never in the launch catch, whose first act
   * is to tear down the session's proxy.
   */
  private async dryRun(
    session: ManagedSession,
    request: LaunchRequestArgs
  ): Promise<DebugResult<LaunchResultData>> {
    const { scriptPath, scriptArgs, dapLaunchArgs, adapterLaunchConfig, breakOnExceptions } = request;
    const policy = this.ctx.selectPolicy(session.language);
    const decision = decideNoDebug(session, policy, dapLaunchArgs, adapterLaunchConfig, breakOnExceptions);
    if (decision.isAttachShaped) {
      // The attach transforms act on the target process — js-debug signals it
      // to open an inspector port, netcoredbg probes its architecture — which
      // is not preparation. attach_to_process has no dry run; neither does
      // its launch-shaped spelling.
      return { success: false, state: session.state, error: ErrorMessages.dryRunAttachShaped() };
    }
    // The same request the launch would hand the ProxyLauncher, so the plan
    // (and the command read off it) is the one a real launch would run.
    const launchRequest = {
      scriptPath,
      scriptArgs,
      dapLaunchArgs: decision.launchArgs,
      adapterLaunchConfig: decision.launchAdapterConfig,
      breakOnExceptions: this.resolveBreakOnExceptionsDefault(session, policy, breakOnExceptions, false),
      debuggerOff: decision.debuggerOff,
    };
    // The warning comes from this preparation, never from the session: its
    // notices belong to the last real launch, and its adapter notes to the
    // program that may still be running.
    const warningFrom = (notices: readonly string[]): string | undefined =>
      joinWarnings(decision.noDebugWarning, ...notices);

    let outcome: AdapterPreparationOutcome;
    try {
      const inputs = await this.proxyLauncher.prepareLaunchInputs(session, launchRequest);
      outcome = await this.proxyLauncher.prepareAdapter(session, inputs, launchRequest);
    } catch (error) {
      // The run directory could not be created: nothing was acquired.
      return this.describeDryRunFailure(session, error, warningFrom([]));
    }
    const warning = warningFrom(outcome.record.launchConfigNotices);
    if (!outcome.ok) {
      return this.describeDryRunFailure(session, outcome.error, warning);
    }
    try {
      const command = describeSpawnCommand(policy, outcome.plan.proxyConfig);
      this.ctx.logger.info(`[SessionManager] Dry run for session ${session.id} would run: ${command}`);
      return {
        success: true,
        state: session.state,
        data: {
          dryRun: true,
          message: 'Dry run: nothing was started and the session is unchanged.',
          command,
          // The program the engine runs — or, for a module/code launch, the
          // target it names, not the stand-in file (issue #985).
          script: describeLaunchTarget(policy, outcome.plan.proxyConfig),
          ...(warning ? { warning } : {}),
        },
      };
    } catch (error) {
      return this.describeDryRunFailure(session, error, warning);
    } finally {
      await outcome.lease.release();
    }
  }

  /**
   * A failed dry run in the launch's own words: the MSVC shape when the error
   * carries an incompatible verdict (`error: 'MSVC_TOOLCHAIN_DETECTED'`,
   * `data.message`/`toolchainValidation`, `canContinue`), the plain shape
   * otherwise — minus everything a launch failure does to the session (the
   * state and lifecycle writes, the proxy teardown) and minus the proxy-log
   * pointers: there is no proxy, and session.logDir names the last real run.
   */
  private describeDryRunFailure(
    session: ManagedSession,
    error: unknown,
    warning: string | undefined
  ): DebugResult<LaunchResultData> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    let errorType: string | undefined;
    let errorCode: number | undefined;
    if (error instanceof McpError) {
      errorType = error.constructor.name || 'McpError';
      errorCode = error.code as number | undefined;
    } else if (error instanceof Error) {
      errorType = error.constructor.name || 'Error';
    }
    const toolchainValidation =
      (error as { toolchainValidation?: ToolchainValidationState } | null)?.toolchainValidation;
    if (toolchainValidation && toolchainValidation.compatible === false) {
      const behavior = (toolchainValidation.behavior ?? 'warn').toLowerCase();
      return {
        success: false,
        error: 'MSVC_TOOLCHAIN_DETECTED',
        state: session.state,
        data: {
          message: toolchainValidation.message ?? errorMessage,
          toolchainValidation,
          ...(warning ? { warning } : {}),
        },
        canContinue: behavior !== 'error',
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
      ...(warning ? { data: { warning } } : {}),
    };
  }

  /**
   * The effective breakOnExceptions mode (issue #244): when the caller did not
   * specify one, launch sessions take the adapter policy's default. Attach-
   * shaped configs are excluded — pausing a process you attached to on
   * exceptions is surprising. The launch records the result on the session;
   * the dry run only hands it to the preparation so the plan matches what the
   * launch would run.
   */
  private resolveBreakOnExceptionsDefault(
    session: ManagedSession,
    policy: AdapterPolicy,
    breakOnExceptions: ExceptionBreakMode | undefined,
    isAttachShaped: boolean
  ): ExceptionBreakMode | undefined {
    if (breakOnExceptions !== undefined || isAttachShaped) {
      return breakOnExceptions;
    }
    const policyDefault = policy.getInitializationBehavior?.().defaultExceptionBreakMode;
    if (!policyDefault) {
      return undefined;
    }
    this.ctx.logger.info(
      `[SessionManager] Applying policy default breakOnExceptions='${policyDefault}' for ${session.language} launch session ${session.id}`
    );
    return policyDefault;
  }

  /** The launch sequence proper; the caller holds the session's in-flight claim. */
  private async launch(
    sessionId: string,
    scriptPath: string,
    scriptArgs?: string[],
    dapLaunchArgs?: Partial<CustomLaunchRequestArguments>,
    dryRunSpawn?: boolean,
    adapterLaunchConfig?: Record<string, unknown>,
    breakOnExceptions?: ExceptionBreakMode
  ): Promise<DebugResult<LaunchResultData>> {
    const session = this.ctx.getSession(sessionId);
    this.ctx.logger.info(
      `Attempting to start debugging for session ${sessionId}, script: ${scriptPath}, dryRunSpawn: ${dryRunSpawn}, dapLaunchArgs:`,
      sanitizePayloadForLogging(dapLaunchArgs)
    );

    // Fail fast when the adapter is known-unavailable (issue #360): consult
    // the same toolchain probe list_supported_languages reports, BEFORE any
    // state mutation or proxy teardown, so the caller gets the real reason
    // instead of success-then-silence. Fails open when the probe can't tell.
    const launchGate = await checkLaunchToolchain(
      session.language,
      this.ctx.adapterRegistry,
      this.ctx.launchValidationCache,
      this.ctx.logger
    );
    if (!launchGate.available) {
      const error = ErrorMessages.launchUnavailable(session.language, launchGate.reason);
      this.ctx.logger.warn(`[SessionManager] ${error}`);
      return { success: false, state: session.state, error };
    }

    // The test-runner preset gate (issue #985): a `testRunner` the language's
    // factory does not declare is refused here — by name, with the runners it
    // does take — before any state changes and before the dry run, so the
    // session stays usable and a dry run of a bad preset says why.
    if (adapterLaunchConfig?.[TEST_RUNNER_KEY] !== undefined || adapterLaunchConfig?.testTarget !== undefined) {
      if (typeof this.ctx.adapterRegistry.getFactoryMetadata === 'function') {
        const factoryMeta = await this.ctx.adapterRegistry.getFactoryMetadata(session.language).catch(() => undefined);
        const verdict = classifyTestRunner(session.language, adapterLaunchConfig, factoryMeta?.modes);
        if (!verdict.ok) {
          this.ctx.logger.warn(`[SessionManager] ${verdict.error}`);
          return { success: false, state: session.state, error: verdict.error };
        }
      } else {
        // The same fail-open as the attach gate (#903): a registry double
        // without metadata skips the gate; the adapter's transform re-checks
        // the runner itself.
        this.ctx.logger.warn(
          `[SessionManager] adapterRegistry has no getFactoryMetadata; skipping the test-runner preset gate for '${session.language}'.`
        );
      }
    }

    // A dry run is a query (issue #812): everything a launch prepares, nothing
    // it changes. Answered here, before the teardown of a previous proxy and
    // the per-attempt resets below, so a paused program keeps running and the
    // previous run's output, exit code and stop stay readable.
    if (dryRunSpawn) {
      return this.dryRun(session, { scriptPath, scriptArgs, dapLaunchArgs, adapterLaunchConfig, breakOnExceptions });
    }

    if (session.proxyManager || session.pendingProxyStop) {
      if (session.proxyManager) {
        this.ctx.logger.warn(
          `[SessionManager] Session ${sessionId} already has an active proxy. Terminating before starting new.`
        );
      }
      // Session-preserving teardown: closeSession here used to REMOVE the
      // session from the store, so the state update below threw
      // SessionNotFoundError and the session was silently destroyed (#238).
      // Not gated on a live handle alone: a terminal event handler nulls
      // proxyManager and leaves its stop() in flight as pendingProxyStop,
      // which this awaits too (#502) — otherwise the relaunch races the old
      // worker's exit (a debuggee port still bound, lastProxyPid overwritten).
      await this.ctx.stopProxyPreservingSession(session);
    }

    // Update to INITIALIZING state and set lifecycle to ACTIVE
    this.ctx.updateState(session, SessionState.INITIALIZING);

    // Explicitly set lifecycle state to ACTIVE when starting debugging.
    // attachMode is cleared: a launch supersedes any prior attach, and a
    // sticky flag would wrongly refuse restart_debugging forever (#238).
    this.ctx.updateSession(sessionId, {
      sessionLifecycle: SessionLifecycleState.ACTIVE,
      attachMode: false,
      attachLocality: undefined,
    });
    // Per-attempt terminal evidence. A prior program/proxy exit must not
    // influence whether this launch is reported as successful. lastStop is
    // part of that evidence: a launch that dies before a proxy exists emits no
    // stop of its own, so a leftover one would be listed as this attempt's
    // once the session lands in ERROR (issue #720).
    session.exitCode = undefined;
    session.lastProxyExit = undefined;
    session.lastProxyError = undefined;
    session.failureDiagnostics = undefined;
    session.lastStop = undefined;
    session.snapshotDiffBase = undefined;
    session.launchConfigNotices = [];
    session.adapterNotices = [];
    session.launchExceptionFilters = undefined;
    // The previous launch's debugger-off decision does not carry over
    // (issue #749); this attempt decides again below.
    session.launchDebuggerOff = undefined;
    this.ctx.logger.info(`[SessionManager] Session ${sessionId} lifecycle state set to ACTIVE`);

    // Record the launch spec for restart_debugging BEFORE attempting the
    // launch — a start that dies mid-way is still meaningfully replayable.
    // A dry run was answered above and never reaches this point, so
    // lastLaunch means "most recent real launch".
    session.lastLaunch = {
      scriptPath,
      scriptArgs,
      dapLaunchArgs,
      adapterLaunchConfig,
      breakOnExceptions,
      launchedAt: Date.now(),
    };

    // noDebug (issue #710), decided once for the launch and the dry run alike.
    const policy = this.ctx.selectPolicy(session.language);
    const { isAttachShaped, noDebug, debuggerOff, noDebugWarning, noDebugFailureNote, launchArgs, launchAdapterConfig } =
      decideNoDebug(session, policy, dapLaunchArgs, adapterLaunchConfig, breakOnExceptions);
    // Recorded on the session so the surfaces after this response can say
    // why they answer in non-debugger terms (issue #749). Written before the
    // proxy starts, so the core's per-launch reset (which runs inside
    // proxyLauncher.start) is not the place to clear it — the block above is.
    if (debuggerOff) {
      session.launchDebuggerOff = true;
    }
    let effectiveLaunchArgs = launchArgs;

    try {
      const effectiveBreakOnExceptions =
        this.resolveBreakOnExceptionsDefault(session, policy, breakOnExceptions, isAttachShaped);
      session.effectiveBreakOnExceptions = effectiveBreakOnExceptions;

      // What the proxy is about to start with (issue #851): its own snapshot
      // of the breakpoints is taken inside start().
      const breakpointsAtStart = snapshotBreakpointSet(session);

      // Start the proxy manager
      const launchConfigData = await this.proxyLauncher.start(session, {
        scriptPath,
        scriptArgs,
        dapLaunchArgs: launchArgs,
        adapterLaunchConfig: launchAdapterConfig,
        breakOnExceptions: effectiveBreakOnExceptions,
        // Decided once, here; the worker reads the stamp (issue #746).
        debuggerOff,
      });
      effectiveLaunchArgs = {
        ...launchArgs,
        stopOnEntry: typeof launchConfigData.stopOnEntry === 'boolean'
          ? launchConfigData.stopOnEntry
          : launchArgs?.stopOnEntry
      };
      this.ctx.logger.info(`[SessionManager] ProxyManager started for session ${sessionId}`);

      // One resolver, two readers (issue #985): the same launch-aware answer
      // the worker sends as setExceptionBreakpoints, recorded here with the
      // ids beyond the mode's table, so the arming text cannot drift from the
      // wire — a pytest module launch adds userUnhandled to the uncaught default.
      const armedFilters = resolveExceptionFilters(policy, effectiveBreakOnExceptions, launchConfigData);
      // The mode's table alone: the resolver without a launch config.
      const tableFilters = resolveExceptionFilters(policy, effectiveBreakOnExceptions);
      session.launchExceptionFilters = {
        ids: armedFilters,
        beyondMode: armedFilters.filter(id => !tableFilters.includes(id))
      };

      // Perform language-specific handshake if required
      if (policy.performHandshake) {
        try {
          await policy.performHandshake({
            proxyManager: session.proxyManager,
            sessionId: session.id,
            dapLaunchArgs: effectiveLaunchArgs,
            scriptPath,
            scriptArgs,
            breakpoints: session.breakpoints,
            launchConfig: launchConfigData,
            breakOnExceptions: effectiveBreakOnExceptions
          });
        } catch (handshakeErr) {
          this.ctx.logger.warn(
            `[SessionManager] Language handshake returned with warning/error: ${
              handshakeErr instanceof Error ? handshakeErr.message : String(handshakeErr)
            }`
          );
        }
      }

      // The launch is answered when the launched program stops, when it
      // ends, or when a short hold elapses — whichever comes first, and the
      // same for every adapter and whatever is armed (issues #823, #826). No
      // policy has a say in it: js-debug used to count a running program as
      // "ready" and answer at once, so its launch response alone could not be
      // read as "where did it stop"; the others waited up to 30 s when
      // something was armed, which is the wrong trade for a breakpoint that
      // needs an outside trigger (a request handler). The hold is not a limit
      // on the program — its breakpoints stay armed — and wait_for_stop
      // (issue #849) is the explicit way to wait longer. The noDebug case
      // needs no branch: a launch with the debugger off simply never stops,
      // so it is answered by its exit or by the hold.
      let earlyResync: ResyncOutcome | undefined;
      const readiness = await waitForLaunchReadiness(this.ctx, {
        sessionId,
        launchedCeilingMs: this.ctx.tunables.launchReadyCeilingMs,
        holdMs: this.ctx.tunables.launchHoldMs,
        // A breakpoint set, removed or cleared while the launch was starting
        // was only stored: the breakpoint layer talks to the adapter when the
        // session is running or paused, and the proxy's own snapshot had
        // already been taken. Deliver the difference now, before the hold —
        // it used to wait for the re-sync after the wait, 30 s later with the
        // program running past it all the while (issue #851).
        beforeHold: async () => {
          const launched = this.ctx.getSession(sessionId);
          const now = snapshotBreakpointSet(launched);
          if (debuggerOff || now.signature === breakpointsAtStart.signature) {
            return;
          }
          this.ctx.logger.info(
            `[SessionManager] Breakpoints of session ${sessionId} changed while the launch was starting; sending them before the hold`
          );
          earlyResync = await this.breakpoints.resyncAll(launched, { forceFreshEcho: true });
          // What the adapter was handed at start and the store no longer
          // holds: an empty replace-all is the only thing that clears it.
          for (const file of breakpointsAtStart.files) {
            if (!now.files.has(file)) {
              await this.breakpoints.syncBreakpointsForFile(launched, file);
            }
          }
          if (breakpointsAtStart.hasFunctionBreakpoints && !now.hasFunctionBreakpoints) {
            await this.breakpoints.syncFunctionBreakpoints(launched);
          }
        }
      });

      // Re-fetch session to get the most up-to-date state
      const finalSession = this.ctx.getSession(sessionId);
      const finalState = finalSession.state;

      // Readiness resolves on terminal events as well as a usable debugger.
      // Do not turn an adapter/proxy crash into a successful start merely
      // because the wait completed. STOPPED remains a truthful success for a
      // program that ran to completion; infrastructure failures map to ERROR.
      if (finalState === SessionState.ERROR) {
        const proxyExit = finalSession.lastProxyExit;
        const exitDescription = proxyExit
          ? `code=${proxyExit.code ?? 'null'}${proxyExit.signal ? `, signal=${proxyExit.signal}` : ''}`
          : undefined;
        // The adapter's last stderr line rides the exit record (issue #897):
        // the manager is already gone from the session by now.
        const stderrSuffix = proxyExit?.stderrLine ? `; adapter stderr: "${proxyExit.stderrLine}"` : '';
        const errorMessage = finalSession.lastProxyError ??
          (exitDescription
            ? `Debug proxy exited unexpectedly during launch (${exitDescription})${stderrSuffix}`
            : 'Debug proxy entered an error state during launch');
        const diagnosticData = await failProxySetup(
          this.ctx,
          finalSession,
          new Error(errorMessage),
          'startDebugging'
        );
        finalSession.failureDiagnostics = Object.keys(diagnosticData).length > 0
          ? diagnosticData
          : undefined;
        return {
          success: false,
          state: SessionState.ERROR,
          error: errorMessage,
          ...failureData(diagnosticData, launchWarnings(session, noDebugFailureNote))
        };
      }

      // Belt-and-braces re-sync for a launch that is PAUSED (issues
      // #236/#439, function breakpoints #271 phase 3): the store is normally
      // already stamped by the worker's breakpoints_synced status and kept
      // current by the adapter's breakpoint events, and a re-send to the
      // stopped program heals anything that changed between the snapshot and
      // now. Ask for a fresh echo: js-debug's unchanged-set response
      // otherwise contains no breakpoint records to reconcile (#705).
      // Not for a launch still RUNNING when the hold elapsed (issue #856).
      // From here a live program cannot be told from one whose exit is on its
      // way — the worker holds exited/terminated until the adapter's output
      // has drained, a full 2 s for CodeLLDB on Windows — and a re-send that
      // reaches what is left of the program is answered "could not be
      // resolved": a logpoint that had already fired read verified: false
      // afterwards. Such a launch loses nothing by going without: the
      // proxy's own send and its stamp stand (which is all a launch that is
      // STOPPED by now ever had), a breakpoint set during the hold went
      // straight to the adapter because the session was RUNNING, and one set
      // while the launch was starting was delivered before the hold (issue
      // #851, above).
      // Not with the debugger off (issue #746): the adapter has answered the
      // pre-launch set already — CodeLLDB's refusal is echoed per breakpoint
      // by the worker, and debugpy/Delve open no phase to answer in — and a
      // re-send would only be a round trip per file the debugger declines.
      // A refused re-send is stamped on the records by the send itself and its
      // warning joins the launch result below (issue #754).
      // A launch that already re-sent before the hold (issue #851) keeps
      // that answer rather than clearing and re-setting a second time.
      let resync: ResyncOutcome = earlyResync ?? { warnings: [], functionBreakpointsFailed: false };
      if (!earlyResync && finalState === SessionState.PAUSED && !debuggerOff) {
        resync = await this.breakpoints.resyncAll(finalSession, { forceFreshEcho: true });
      }

      // Where the program stopped (issue #951): the same short settle and
      // stack read a step, a pause or wait_for_stop makes, so the answer
      // carries `location` — and `threadId`/`note` when there is something
      // to say — and the handler can read the line and the build behind it.
      // An entry stop the core auto-continues never gets here: the readiness
      // wait reads the state through waitForSessionState, whose microtask
      // re-read (issue #849) sees the RUNNING the continue sets in the same
      // call stack. Best effort, like every landing read: a stack that cannot
      // be read leaves the answer as it was.
      const landing: StopLanding = finalState === SessionState.PAUSED
        ? await describeStopLocation(this.ctx, sessionId, 'launch')
        : {};
      // The bounded state snapshot the landing read pays for (issue #982):
      // frames and locals from the same resolver result. An entry stop and a
      // launch that is not paused answer no snapshot (composer gates).
      const snapshot = await composeStopSnapshot(this.ctx, sessionId, landing.stackResult, 'launch');

      // The policy's word is a static pin; a stop that arrived anyway is the
      // stronger evidence (an adapter build that ignores the flag after all):
      // a stop only a live debugger produces — the core's stopped handler
      // is the one judge of that and clears the recorded decision (issue
      // #749) — or a breakpoint the adapter verified in its configuration
      // phase, which is read from the same evidence every later surface
      // reads. Either way the launch response and the record cannot
      // disagree. Then the debugger was on: keep the ordinary diagnostics
      // and say the flag had no effect rather than that the breakpoints
      // will not fire. (A launch that ends paused on a pause or a step
      // keeps the record and the warning: the flag still keeps its
      // breakpoints from binding.)
      const debuggerOnAnyway =
        debuggerOff && (finalSession.launchDebuggerOff !== true || adapterVerifiedABreakpoint(finalSession));
      const noDebugNote = debuggerOnAnyway
        ? buildNoDebugLaunchWarning(finalSession, { noDebug }, breakOnExceptions, false)
        : noDebugWarning;

      // The three breakpoint-shaped warnings below each diagnose a symptom
      // ("check the file path", "check the symbol name", "will PAUSE") that
      // has one cause when the debugger is off — the noDebug warning names
      // it, and they are withheld so they cannot contradict it (issue #710).
      const debuggerOn = !debuggerOff || debuggerOnAnyway;

      // Unbound-at-launch warning (issue #308): a name the adapter could not
      // resolve is reported here instead of failing silently at "the program
      // never stopped". The verified state it reads is fresh from the re-sync
      // above for a launch that paused; for one answered while running it is
      // what the worker's pre-launch send and the adapter's breakpoint events
      // left, a rejected request included — the worker echoes that, and it is
      // quoted as a refusal (issue #856). Suppressed for bind-late adapters
      // (js/java), where unverified-at-launch is the designed deferral path.
      // Withheld when the post-launch function-breakpoint re-send failed —
      // refused or never answered (issue #754): the cause is in the resync
      // warning below, and the symptom sentence would only restate it as a
      // name problem (the #710 rule — a known cause displaces the symptom).
      const fnBpWarning = debuggerOn && !resync.functionBreakpointsFailed
        ? this.breakpoints.functionBreakpointLaunchWarning(finalSession)
        : undefined;

      // Ran-to-completion with breakpoints that never bound (issue #467):
      // state "stopped" where the caller expected "paused" is only
      // explainable via list_breakpoints today — surface the stored
      // per-breakpoint diagnostics right here where the caller is looking.
      const unboundAtExitWarning =
        debuggerOn && finalState === SessionState.STOPPED
          ? buildUnboundBreakpointExitWarning(finalSession)
          : undefined;

      // Logpoint-downgrade verdict (issue #469): the deferred set_breakpoint
      // warning promised a launch-time answer — deliver it on this response.
      const logpointWarning = debuggerOn
        ? buildLogpointDowngradeLaunchWarning(finalSession)
        : undefined;

      // Adapter degradation notes (issue #441) accumulate on the session as
      // annotated output events arrive; joining here is best-effort — a note
      // arriving after this return still lands in the output buffer as an
      // attributed [mcp-debugger] Warning entry.
      const launchWarning = launchWarnings(
        finalSession, noDebugNote, fnBpWarning, logpointWarning, unboundAtExitWarning, ...resync.warnings
      );

      this.ctx.logger.info(
        `[SessionManager] Debugging started for session ${sessionId}. State: ${finalState}`
      );

      // Ended before the launch could report a pause (issue #701): say how
      // the program ended, with its exit code and the breakpoints it ran past.
      const runToCompletion =
        finalState === SessionState.STOPPED
          ? buildRunToCompletionSummary(finalSession)
          : undefined;

      // The hold elapsed with the program still running: say so, with
      // pending: true the way a step that has not landed does, and say what
      // is armed — read now, not when the launch began, so a breakpoint set
      // during the hold is named (issue #826). The arming no longer decides
      // how long the launch waits; it only words this answer. The stop, if
      // one comes, is collected with wait_for_stop.
      let stillRunning: string | undefined;
      if (readiness === 'running' && finalState === SessionState.RUNNING) {
        const arming = describeLaunchArming(finalSession, effectiveLaunchArgs?.stopOnEntry);
        stillRunning = ErrorMessages.launchStillRunning(
          arming.armed ? arming.summary : undefined,
          debuggerOnAnyway ? undefined : debuggerOffWhy(finalSession),
          arming.loggingSummary
        );
      }

      return {
        success: true,
        state: finalState,
        data: {
          ...(launchWarning ? { warning: launchWarning } : {}),
          message:
            `Debugging started for ${scriptPath}. Current state: ${finalState}` +
            (runToCompletion ? `. ${runToCompletion.summary}` : '') +
            (stillRunning ? `. ${stillRunning}` : ''),
          ...(stillRunning ? { pending: true } : {}),
          ...(runToCompletion?.data ?? {}),
          // Prefer the actual DAP stop reason (issue #214) — the first stop is
          // not always a breakpoint (e.g. an uncaught exception before any
          // breakpoint is hit). A PAUSED session always carries lastStop
          // (_updateSessionState enforces it, issue #598), so the fallback is
          // for the type alone: 'entry' for a stopOnEntry launch, 'unknown'
          // otherwise — never a fabricated 'breakpoint' (issue #255).
          reason:
            finalState === SessionState.PAUSED
              ? finalSession.lastStop?.reason ??
                (effectiveLaunchArgs?.stopOnEntry ? 'entry' : 'unknown')
              : undefined,
          stopOnEntrySuccessful: !!effectiveLaunchArgs?.stopOnEntry && finalState === SessionState.PAUSED,
          ...landingFields(landing),
          ...(snapshot ? { snapshot } : {}),
        },
      };
    } catch (error) {
      const diagnosticData = await failProxySetup(this.ctx, session, error, 'startDebugging');
      session.failureDiagnostics = Object.keys(diagnosticData).length > 0
        ? diagnosticData
        : undefined;

      const errorMessage = error instanceof Error ? error.message : String(error);

      // Normalize error identity for callers/tests
      let errorType: string | undefined;
      let errorCode: number | undefined;
      if (error instanceof McpError) {
        errorType = (error as McpError).constructor.name || 'McpError';
        errorCode = (error as McpError).code as number | undefined;
      } else if (error instanceof Error) {
        errorType = error.constructor.name || 'Error';
      }

      // A close that landed during the teardown removed the session; the
      // state writes below would throw. Report the failure as-is.
      if (sessionRemovedDuringTeardown(this.ctx, sessionId)) {
        return {
          success: false,
          error: errorMessage,
          state: SessionState.STOPPED,
          errorType,
          errorCode,
          ...failureData(diagnosticData, launchWarnings(session, noDebugFailureNote))
        };
      }

      const toolchainValidation =
        (error as { toolchainValidation?: ToolchainValidationState })?.toolchainValidation;
      const incompatibleToolchain =
        Boolean(toolchainValidation) && toolchainValidation?.compatible === false;

      if (incompatibleToolchain) {
        this.ctx.updateState(session, SessionState.CREATED);
        this.ctx.updateSession(sessionId, {
          sessionLifecycle: SessionLifecycleState.CREATED,
        });
      } else {
        this.ctx.updateState(session, SessionState.ERROR);
      }

      if (incompatibleToolchain && toolchainValidation) {
        const behavior = (toolchainValidation.behavior ?? 'warn').toLowerCase();
        const canContinue = behavior !== 'error';
        const updatedSession = this.ctx.getSession(sessionId);
        const warning = launchWarnings(session, noDebugFailureNote);
        return {
          success: false,
          error: 'MSVC_TOOLCHAIN_DETECTED',
          state: updatedSession.state,
          data: {
            message: toolchainValidation.message ?? errorMessage,
            toolchainValidation,
            ...(warning ? { warning } : {}),
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
        ...failureData(diagnosticData, launchWarnings(session, noDebugFailureNote))
      };
    }
  }

  /**
   * Restart the debuggee. When the adapter advertises `supportsRestartRequest`
   * — the Flutter adapter does, in a `capabilities` event once the app has
   * started, and its `restart` is a hot restart: the same process re-runs
   * `main()` and reaches its first breakpoint again in well under a second
   * (issue #876) — the DAP `restart` request is sent and the session goes on
   * in place: breakpoints stay armed and the output buffer is kept. Otherwise
   * the current program is terminated (if any) and the last real launch is
   * replayed with the same configuration — the spec-blessed emulation every
   * launch-mode language gets with no per-adapter wiring (issue #238);
   * breakpoints re-apply through the initialBreakpoints snapshot and the
   * output buffer starts fresh (read from since=0). Either way the statement
   * anchors are re-resolved first, so breakpoints survive the edit that was
   * the point of the session (issue #271).
   */
  async restartDebugging(sessionId: string): Promise<DebugResult<LaunchResultData>> {
    // Claimed first (issue #711): a launch or attach still being awaited, or
    // a restart already replaying, is the most relevant fact about the
    // session. Held for the whole restart, so the replayed launch runs under
    // this claim. The refusal text distinguishes "wait for it" from the one
    // pairing that is terminal rather than transient — an in-flight attach,
    // whose session will never accept a relaunch (the `session.attachMode`
    // check below, answered up front because attachMode is only written
    // after the attach's first awaits).
    return this.inFlight.run(sessionId, 'restart', 'restart_debugging', this.ctx, () =>
      this.restart(this.ctx.getSession(sessionId))
    );
  }

  /** The restart proper; the caller holds the session's in-flight claim. */
  private async restart(session: ManagedSession): Promise<DebugResult<LaunchResultData>> {
    const sessionId = session.id;

    // The adapter's own restart, when the policy is pinned for it (measured:
    // js-debug advertises `restart` too, and relaunches through a child
    // session this proxy does not follow), the live capabilities — which the
    // worker keeps current with the adapter's capabilities events — advertise
    // it, and the debuggee is live (issue #876).
    const nativeRestart =
      this.ctx.selectPolicy(session.language).restartViaDapRequest === true &&
      session.adapterCapabilities?.supportsRestartRequest === true &&
      session.proxyManager?.isRunning() === true;

    if (session.attachMode && !nativeRestart) {
      return {
        success: false,
        state: session.state,
        error: 'Cannot restart an attach session: there is no launch configuration to replay, and the adapter offers no restart request. Detach and re-attach instead.'
      };
    }
    if (!session.lastLaunch && !nativeRestart) {
      return {
        success: false,
        state: session.state,
        error: 'Nothing to restart: this session has not been launched (start_debugging has not run, or only a dry run was performed).'
      };
    }

    // Content anchors re-resolve BEFORE the relaunch snapshots
    // initialBreakpoints, so breakpoints survive the edit that was the
    // point of the session (issue #271).
    const anchorResolution = await reresolveAnchors(session, this.ctx);

    if (nativeRestart) {
      return this.hotRestart(session, anchorResolution);
    }

    const spec = session.lastLaunch;
    if (!spec) {
      return {
        success: false,
        state: session.state,
        error: 'Nothing to restart: this session has not been launched (start_debugging has not run, or only a dry run was performed).'
      };
    }
    this.ctx.logger.info(
      `[SessionManager] Restarting session ${sessionId}: replaying launch of ${spec.scriptPath}`
    );
    // The replay runs under this restart's claim, not startDebugging's own.
    const result = await this.launch(
      sessionId,
      spec.scriptPath,
      spec.scriptArgs,
      spec.dapLaunchArgs,
      false, // never replay as a dry run
      spec.adapterLaunchConfig,
      spec.breakOnExceptions
    );
    if (result.success) {
      // Stamp stale-anchor notes AFTER the relaunch: the per-launch
      // breakpoint state reset (#238) clears message on every new launch,
      // and a real adapter verdict should still win over ours — a refusal of
      // the relaunch's re-send is not one (issue #754), so the note displaces it.
      this.stampStaleAnchorNotes(this.ctx.getSession(sessionId), anchorResolution);
      // Join rather than clobber: startDebugging may already have set a
      // warning (unbound function breakpoints, issue #308).
      const warnings = [result.data?.warning, anchorWarnings(anchorResolution)].filter(Boolean);
      result.data = {
        ...(result.data ?? {}),
        breakpointsReapplied: this.ctx.getSession(sessionId).breakpoints.size,
        // Each launch starts a fresh output buffer: tell the caller to
        // reset its get_output cursor to since=0.
        outputReset: true,
        ...(anchorResolution ? { anchorResolution } : {}),
        ...(warnings.length > 0 ? { warning: warnings.join('; ') } : {}),
      };
    }
    return result;
  }

  /**
   * The adapter's own restart (issue #876): `restart` goes out and the
   * session goes on in place — the same process, so the output buffer is
   * kept and the breakpoints stay armed in the adapter. The answer is built
   * the way a launch's is: a short hold for the first stop (issues #823,
   * #826), then the landing and the snapshot (issues #951, #982), or
   * `pending` with what is armed.
   */
  private async hotRestart(
    session: ManagedSession,
    anchorResolution: AnchorResolution | undefined
  ): Promise<DebugResult<LaunchResultData>> {
    const sessionId = session.id;
    const proxyManager = session.proxyManager!;
    const target = session.lastLaunch?.scriptPath ?? 'the attached program';
    this.ctx.logger.info(
      `[SessionManager] Restarting session ${sessionId} in place: the adapter offers a restart request (hot restart)`
    );

    // A breakpoint whose anchor moved with the edit must reach the adapter
    // before the program re-runs; the rest is still armed there.
    if (anchorResolution && anchorResolution.moved.length > 0) {
      await this.breakpoints.resyncAll(session, { forceFreshEcho: true });
    }

    // RUNNING before the request, the way continue does: the core keeps a
    // paused session paused on a `continued` event (its guard against stale
    // resumes), so the adapter's own resume of the paused thread would not
    // move it, and the hold below would read the stop the restart replaces.
    const wasPaused = session.state === SessionState.PAUSED;
    if (wasPaused) {
      this.ctx.updateState(session, SessionState.RUNNING);
    }
    try {
      await proxyManager.sendDapRequest('restart', {});
    } catch (error) {
      if (wasPaused && !isTerminalSessionState(session.state)) {
        this.ctx.updateState(session, SessionState.PAUSED);
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        state: session.state,
        error: `The adapter refused the restart request: ${message}`
      };
    }

    const readiness = await waitForLaunchReadiness(this.ctx, {
      sessionId,
      launchedCeilingMs: this.ctx.tunables.launchReadyCeilingMs,
      holdMs: this.ctx.tunables.launchHoldMs,
    });
    const finalSession = this.ctx.getSession(sessionId);
    const finalState = finalSession.state;
    const landing: StopLanding = finalState === SessionState.PAUSED
      ? await describeStopLocation(this.ctx, sessionId, 'launch')
      : {};
    const snapshot = await composeStopSnapshot(this.ctx, sessionId, landing.stackResult, 'launch');
    const runToCompletion = finalState === SessionState.STOPPED
      ? buildRunToCompletionSummary(finalSession)
      : undefined;
    let stillRunning: string | undefined;
    if (readiness === 'running' && finalState === SessionState.RUNNING) {
      const requestedEntry = finalSession.lastLaunch?.dapLaunchArgs?.stopOnEntry;
      const arming = describeLaunchArming(finalSession, typeof requestedEntry === 'boolean' ? requestedEntry : undefined);
      stillRunning = ErrorMessages.launchStillRunning(
        arming.armed ? arming.summary : undefined,
        debuggerOffWhy(finalSession),
        arming.loggingSummary
      );
    }
    this.stampStaleAnchorNotes(finalSession, anchorResolution);
    const warning = anchorWarnings(anchorResolution);

    this.ctx.logger.info(`[SessionManager] Hot restart of session ${sessionId} answered. State: ${finalState}`);
    return {
      success: true,
      state: finalState,
      data: {
        message:
          `Restarted ${target} in place (the adapter's hot restart). Current state: ${finalState}` +
          (runToCompletion ? `. ${runToCompletion.summary}` : '') +
          (stillRunning ? `. ${stillRunning}` : ''),
        hotRestart: true,
        breakpointsReapplied: finalSession.breakpoints.size,
        ...(anchorResolution ? { anchorResolution } : {}),
        ...(warning ? { warning } : {}),
        ...(stillRunning ? { pending: true } : {}),
        ...(runToCompletion?.data ?? {}),
        reason: finalState === SessionState.PAUSED ? finalSession.lastStop?.reason ?? 'unknown' : undefined,
        ...landingFields(landing),
        ...(snapshot ? { snapshot } : {}),
      },
    };
  }

  /**
   * Stale-anchor notes on the breakpoints that kept their previous lines: a
   * real adapter verdict still wins over ours; a refusal of a re-send is not
   * one (issue #754), so the note displaces it.
   */
  private stampStaleAnchorNotes(session: ManagedSession, anchorResolution: AnchorResolution | undefined): void {
    if (!anchorResolution) {
      return;
    }
    for (const staleEntry of anchorResolution.stale) {
      const bp = session.breakpoints.get(staleEntry.breakpointId);
      if (bp && (bp.message === undefined || bp.messageOrigin === 'refusal')) {
        setCuratedMessage(
          bp,
          `Anchor "${staleEntry.statement}" not found at restart; breakpoint kept at last known line ${staleEntry.line}`
        );
      }
    }
  }
}

/** The restart answer's warning for anchors that went stale or re-anchored ambiguously (issue #271). */
function anchorWarnings(anchorResolution: AnchorResolution | undefined): string | undefined {
  if (!anchorResolution) {
    return undefined;
  }
  const staleCount = anchorResolution.stale.length;
  const ambiguousCount = anchorResolution.moved.filter((m) => m.candidates !== undefined).length;
  const parts = [
    staleCount > 0
      ? `${staleCount} statement anchor(s) no longer match the current file; those breakpoints kept their previous lines — re-set them if the target moved.`
      : undefined,
    ambiguousCount > 0
      ? `${ambiguousCount} statement anchor(s) matched multiple lines and re-anchored to the nearest match — check anchorResolution.moved (candidates listed) and re-set any that landed wrong.`
      : undefined,
  ].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? parts.join('; ') : undefined;
}
