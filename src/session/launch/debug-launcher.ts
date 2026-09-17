/**
 * Launch-mode sessions: `start_debugging` end to end, its dry-run variant, and
 * `restart_debugging`, which replays the last real launch.
 *
 * The shape of a launch is: gate on the toolchain, tear down any previous
 * proxy (session-preservingly), record the launch spec for restart, start the
 * proxy through the ProxyLauncher, run the policy handshake, wait for
 * readiness, re-sync breakpoints against the live debuggee, then report the
 * state plus every launch-time warning the session accumulated. A failure at
 * any point after the proxy exists tears it down and reports the proxy-log
 * pointers alongside the error.
 */
import {
  SessionState,
  SessionLifecycleState,
  sanitizePayloadForLogging,
  type ExceptionBreakMode
} from '@debugmcp/shared';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { ErrorMessages } from '../../utils/error-messages.js';
import { checkLaunchToolchain } from '../../utils/language-availability.js';
import type { CustomLaunchRequestArguments, DebugResult } from '../session-manager-core.js';
import type { ManagedSession, ToolchainValidationState } from '../session-store.js';
import type { LaunchContext } from '../operations-context.js';
import type { BreakpointController } from '../breakpoints/breakpoint-controller.js';
import { reresolveAnchors } from '../breakpoints/anchor-resolution.js';
import {
  buildLogpointDowngradeLaunchWarning,
  buildNoDebugFailureNote,
  buildNoDebugLaunchWarning,
  buildUnboundBreakpointExitWarning,
  buildRunToCompletionSummary
} from '../breakpoints/launch-warnings.js';
import {
  failProxySetup,
  logProxyFailure,
  sessionRemovedDuringTeardown
} from './proxy-failure-diagnostics.js';
import { waitForLaunchReadiness } from './launch-readiness.js';
import type { ProxyLauncher } from './proxy-launcher.js';
import type { InFlightGuard } from '../in-flight-guard.js';

/**
 * A launch flag the way the adapter will see it. The proxy launcher merges
 * adapterLaunchConfig over dapLaunchArgs (the server defaults carry neither
 * of these keys), so a value read from dapLaunchArgs alone would miss a flag
 * set — or unset — through adapterLaunchConfig. The string forms are read
 * the way the proxy's message parser coerces them ('true'/'false', the
 * string-typed-args transport quirk); anything else counts by truthiness,
 * which is how the adapters read it.
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
 * The `data` of a failed launch: the failure record, plus the noDebug note
 * when there is one — an adapter that honours the flag but cannot complete
 * the launch under it (debugpy, Delve, CodeLLDB today: issue #746) would
 * otherwise report an init failure with no pointer to the flag behind it.
 */
function failureData<T extends object>(
  diagnosticData: T,
  noDebugWarning: string | undefined
): { data?: T & { warning?: string } } {
  const data = { ...diagnosticData, ...(noDebugWarning ? { warning: noDebugWarning } : {}) };
  return Object.keys(data).length > 0 ? { data } : {};
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
   * Helper method to wait for dry run completion with timeout
   */
  async waitForDryRunCompletion(
    session: ManagedSession,
    timeoutMs: number
  ): Promise<boolean> {
    if (session.proxyManager?.hasDryRunCompleted?.()) {
      this.ctx.logger.info(
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
            this.ctx.logger.info(
              `[SessionManager] Dry run completion event received for session ${session.id}`
            );
            resolve(true);
          };
          this.ctx.logger.info(
            `[SessionManager] Setting up dry-run-complete listener for session ${session.id}`
          );
          session.proxyManager?.once('dry-run-complete', handler);
        }),
        new Promise<boolean>((resolve) => {
          timeoutId = setTimeout(() => {
            if (session.proxyManager?.hasDryRunCompleted?.()) {
              this.ctx.logger.info(
                `[SessionManager] Dry run marked complete during timeout window for session ${session.id}`
              );
              resolve(true);
              return;
            }
            this.ctx.logger.warn(
              `[SessionManager] Dry run timeout after ${timeoutMs}ms for session ${session.id}`
            );
            resolve(false);
          }, timeoutMs);
        }),
      ]);
    } finally {
      // Clean up immediately
      if (handler && session.proxyManager) {
        this.ctx.logger.info(
          `[SessionManager] Removing dry-run-complete listener for session ${session.id}`
        );
        session.proxyManager.removeListener('dry-run-complete', handler);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Start (or dry-run) a launch. Claims the session for the whole call
   * (issue #711): a concurrent start_debugging, restart_debugging or
   * attach_to_process on the same session is refused with a clear error
   * instead of tearing down the launch this call is still awaiting. The
   * claim is made before the first await so a same-tick call cannot race it.
   */
  async startDebugging(
    sessionId: string,
    scriptPath: string,
    scriptArgs?: string[],
    dapLaunchArgs?: Partial<CustomLaunchRequestArguments>,
    dryRunSpawn?: boolean,
    adapterLaunchConfig?: Record<string, unknown>,
    breakOnExceptions?: ExceptionBreakMode
  ): Promise<DebugResult> {
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

  /** The launch sequence proper; the caller holds the session's in-flight claim. */
  private async launch(
    sessionId: string,
    scriptPath: string,
    scriptArgs?: string[],
    dapLaunchArgs?: Partial<CustomLaunchRequestArguments>,
    dryRunSpawn?: boolean,
    adapterLaunchConfig?: Record<string, unknown>,
    breakOnExceptions?: ExceptionBreakMode
  ): Promise<DebugResult> {
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
    // The previous launch's debugger-off decision does not carry over
    // (issue #749); this attempt decides again below.
    session.debuggerDisabled = undefined;
    this.ctx.logger.info(`[SessionManager] Session ${sessionId} lifecycle state set to ACTIVE`);

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

    // noDebug (issue #710). Whether the flag turns the debugger off is the
    // policy's word, measured per adapter: where it does, nothing the caller
    // asked to stop on can fire and the breakpoint-shaped launch warnings
    // below are withheld; where the adapter ignores it, the warning says so
    // instead. Decided here, before the dry-run branch, from the caller's own
    // breakOnExceptions rather than the policy default resolved below: a dry
    // run is a configuration check and a restart replays the same arguments,
    // and both should say so.
    const policy = this.ctx.selectPolicy(session.language);
    // noDebug is a launch-request property; an attach-shaped start_debugging
    // (request: 'attach' / __attachMode) attaches with the debugger on.
    const launchArgsShape = dapLaunchArgs as Record<string, unknown> | undefined;
    const isAttachShaped =
      launchArgsShape?.request === 'attach' || launchArgsShape?.__attachMode === true;
    const noDebug = !isAttachShaped && resolveLaunchFlag('noDebug', dapLaunchArgs, adapterLaunchConfig);
    const honoursNoDebug = policy.honoursNoDebug === true;
    const debuggerOff = noDebug && honoursNoDebug;
    // Recorded on the session so the surfaces after this response can say
    // why they answer in non-debugger terms (issue #749). Not for a dry run:
    // nothing launches. Written before the proxy starts, so the core's
    // per-launch reset (which runs inside proxyLauncher.start) is not the
    // place to clear it — the block above is.
    if (debuggerOff && !dryRunSpawn) {
      session.debuggerDisabled = true;
    }
    const noDebugWarning = buildNoDebugLaunchWarning(
      session,
      { noDebug, stopOnEntry: resolveLaunchFlag('stopOnEntry', dapLaunchArgs, adapterLaunchConfig) },
      breakOnExceptions,
      honoursNoDebug
    );
    // A launch that fails under the flag still needs to point at it, whether
    // or not there was anything armed to warn about.
    const noDebugFailureNote = noDebugWarning ?? (debuggerOff ? buildNoDebugFailureNote() : undefined);
    // With the debugger off an entry stop cannot come. Everything that reads
    // stopOnEntry from here on — the proxy config (from either source the
    // adapter merge reads), the core's projection to RUNNING on
    // adapter-configured, the readiness wait — sees it off, so they agree and
    // none of them waits for a stop that cannot arrive. The warning above and
    // session.lastLaunch (recorded earlier) keep the caller's values.
    const launchArgs = debuggerOff ? { ...dapLaunchArgs, stopOnEntry: false } : dapLaunchArgs;
    const launchAdapterConfig =
      debuggerOff && adapterLaunchConfig?.stopOnEntry !== undefined
        ? { ...adapterLaunchConfig, stopOnEntry: false }
        : adapterLaunchConfig;
    // Likewise readiness: python/go/cpp count only a pause as ready (they
    // always request an entry stop and auto-continue), which cannot happen
    // here — running is ready, and so is a pause that came anyway.
    const isReady = (state: SessionState): boolean =>
      debuggerOff
        ? state === SessionState.RUNNING || state === SessionState.PAUSED
        : policy.isSessionReady
          ? policy.isSessionReady(state, { stopOnEntry: launchArgs?.stopOnEntry })
          : state === SessionState.PAUSED;
    const readinessPolicy = debuggerOff ? { ...policy, isSessionReady: undefined } : policy;

    try {
      // For dry run, start the proxy and wait for completion
      if (dryRunSpawn) {
        const dryRunResult = (snapshot: { command?: string; script?: string } | undefined): DebugResult => ({
          success: true,
          state: SessionState.STOPPED,
          data: {
            ...(noDebugWarning ? { warning: noDebugWarning } : {}),
            dryRun: true,
            message: 'Dry run spawn command logged by proxy.',
            command: snapshot?.command,
            script: snapshot?.script,
          },
        });

        // Mark that we're setting up a dry run handler
        const sessionWithSetup = session as ManagedSession & { _dryRunHandlerSetup?: boolean };
        sessionWithSetup._dryRunHandlerSetup = true;

        // Start the proxy manager
        // No breakOnExceptions: a dry run reports the spawn command and stops
        // before the adapter connection, so setExceptionBreakpoints never runs
        // and the mode would be inert. Same reason lastLaunch skips dry runs.
        await this.proxyLauncher.start(session, {
          scriptPath,
          scriptArgs,
          dapLaunchArgs,
          dryRunSpawn,
          adapterLaunchConfig,
        });
        this.ctx.logger.info(`[SessionManager] ProxyManager started for session ${sessionId}`);
        
        // Check if already completed before waiting
        const refreshedSession = this.ctx.getSession(sessionId);
        this.ctx.logger.info(`[SessionManager] Checking state after start: ${refreshedSession.state}`);
        
        const initialDryRunSnapshot = refreshedSession.proxyManager?.getDryRunSnapshot?.();
        const dryRunAlreadyComplete =
          refreshedSession.state === SessionState.STOPPED ||
          refreshedSession.proxyManager?.hasDryRunCompleted?.() === true;

        if (dryRunAlreadyComplete) {
          this.ctx.logger.info(
            `[SessionManager] Dry run already completed for session ${sessionId}`
          );
          delete sessionWithSetup._dryRunHandlerSetup;

          return dryRunResult(initialDryRunSnapshot);
        }

        // Wait for completion with timeout
        this.ctx.logger.info(
          `[SessionManager] Waiting for dry run completion with timeout ${this.ctx.dryRunTimeoutMs}ms`
        );
        
        const dryRunCompleted = await this.waitForDryRunCompletion(
          refreshedSession,
          this.ctx.dryRunTimeoutMs
        );
        delete sessionWithSetup._dryRunHandlerSetup;

        const latestSessionState = this.ctx.getSession(sessionId);
        const latestSnapshot =
          latestSessionState.proxyManager?.getDryRunSnapshot?.() ?? initialDryRunSnapshot;
        const effectiveDryRunComplete =
          dryRunCompleted ||
          latestSessionState.state === SessionState.STOPPED ||
          latestSessionState.proxyManager?.hasDryRunCompleted?.() === true;

        if (effectiveDryRunComplete) {
          this.ctx.logger.info(
            `[SessionManager] Dry run completed for session ${sessionId}, final state: ${latestSessionState.state}`
          );

          return dryRunResult(latestSnapshot);
        } else {
          // Timeout occurred. The state is read once: the log read below is
          // an await, and a late dry-run-complete/exit landing during it must
          // not leave the message and the returned state disagreeing.
          const finalSession = latestSessionState;
          const state = finalSession.state;
          this.ctx.logger.error(
            `[SessionManager] Dry run timeout for session ${sessionId}. ` +
              `State: ${state}, ProxyManager active: ${!!finalSession.proxyManager}`
          );

          // The same failure record and proxy-log pointers a thrown launch
          // failure gets: the proxy log is where a dry run that never
          // reported back usually explains itself.
          const dryRunTimeoutError = new Error(
            `Dry run timed out after ${this.ctx.dryRunTimeoutMs}ms. Current state: ${state}`
          );
          const diagnosticData = await logProxyFailure(
            { logger: this.ctx.logger, fileSystem: this.ctx.fileSystem },
            session,
            dryRunTimeoutError,
            'startDebugging'
          );
          session.failureDiagnostics = Object.keys(diagnosticData).length > 0
            ? diagnosticData
            : undefined;

          return {
            success: false,
            error: dryRunTimeoutError.message,
            state,
            ...failureData(diagnosticData, noDebugFailureNote)
          };
        }
      }

      // Normal (non-dry-run) flow
      // Resolve the effective breakOnExceptions mode (issue #244): when the
      // user did not specify one, launch sessions take the adapter policy's
      // default. Attach-shaped configs are excluded — pausing a process you
      // attached to on exceptions is surprising — as are dry runs (above).
      let effectiveBreakOnExceptions = breakOnExceptions;
      if (effectiveBreakOnExceptions === undefined && !isAttachShaped) {
        const policyDefault = policy.getInitializationBehavior?.().defaultExceptionBreakMode;
        if (policyDefault) {
          effectiveBreakOnExceptions = policyDefault;
          this.ctx.logger.info(
            `[SessionManager] Applying policy default breakOnExceptions='${policyDefault}' for ${session.language} launch session ${sessionId}`
          );
        }
      }
      session.effectiveBreakOnExceptions = effectiveBreakOnExceptions;

      // Start the proxy manager
      const launchConfigData = await this.proxyLauncher.start(session, {
        scriptPath,
        scriptArgs,
        dapLaunchArgs: launchArgs,
        dryRunSpawn,
        adapterLaunchConfig: launchAdapterConfig,
        breakOnExceptions: effectiveBreakOnExceptions,
      });
      this.ctx.logger.info(`[SessionManager] ProxyManager started for session ${sessionId}`);

      // Perform language-specific handshake if required
      if (policy.performHandshake) {
        try {
          await policy.performHandshake({
            proxyManager: session.proxyManager,
            sessionId: session.id,
            dapLaunchArgs: launchArgs,
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

      // Use policy-defined readiness criteria when available.
      const sessionStateAfterHandshake = this.ctx.getSession(sessionId).state;
      const alreadyReady = isReady(sessionStateAfterHandshake);

      if (!alreadyReady) {
        // Wait for adapter to be configured, first stop event, or termination
        await waitForLaunchReadiness(this.ctx, { session, sessionId, policy: readinessPolicy, dapLaunchArgs: launchArgs });
      } else {
        this.ctx.logger.info(
          `[SessionManager] Session ${sessionId} already ${sessionStateAfterHandshake} after handshake - skipping adapter readiness wait`
        );
      }

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
        const errorMessage = finalSession.lastProxyError ??
          (exitDescription
            ? `Debug proxy exited unexpectedly during launch (${exitDescription})`
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
          ...failureData(diagnosticData, noDebugFailureNote)
        };
      }

      // Belt-and-braces re-sync (issues #236/#439, function breakpoints
      // #271 phase 3): the store is normally already stamped by the worker's
      // breakpoints_synced status — including for launches that are STOPPED
      // by now (logpoint-only short programs), which this gated path can
      // never help — and a live re-send heals anything that changed between
      // the snapshot and now.
      if (finalState === SessionState.RUNNING || finalState === SessionState.PAUSED) {
        await this.breakpoints.resyncAll(finalSession);
      }

      // The policy's word is a static pin; a stop that arrived anyway is the
      // stronger evidence (an adapter build that ignores the flag after all).
      // The core's stopped handler is the one judge of that — it clears the
      // recorded decision on a stop only a live debugger produces (issue
      // #749), so the launch response and the record cannot disagree. Then
      // the debugger was on: keep the ordinary diagnostics and say the flag
      // had no effect rather than that no stop can come.
      const stoppedAnyway = debuggerOff && finalSession.debuggerDisabled !== true;
      const noDebugNote = stoppedAnyway
        ? buildNoDebugLaunchWarning(finalSession, { noDebug }, breakOnExceptions, false)
        : noDebugWarning;

      // The three breakpoint-shaped warnings below each diagnose a symptom
      // ("check the file path", "check the symbol name", "will PAUSE") that
      // has one cause when the debugger is off — the noDebug warning names
      // it, and they are withheld so they cannot contradict it (issue #710).
      const debuggerOn = !debuggerOff || stoppedAnyway;

      // Unbound-at-launch warning (issue #308): the verified state is fresh
      // after the re-sync above, so a name the adapter could not resolve is
      // reported here instead of failing silently at "the program never
      // stopped". Suppressed for bind-late adapters (js/java), where
      // unverified-at-launch is the designed deferral path.
      const fnBpWarning = debuggerOn
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
      const launchWarning =
        [noDebugNote, fnBpWarning, logpointWarning, unboundAtExitWarning, ...(finalSession.adapterNotices ?? [])]
          .filter(Boolean)
          .join('; ') || undefined;

      this.ctx.logger.info(
        `[SessionManager] Debugging started for session ${sessionId}. State: ${finalState}`
      );

      // Ended before the launch could report a pause (issue #701): say how
      // the program ended, with its exit code and the breakpoints it ran past.
      const runToCompletion =
        finalState === SessionState.STOPPED
          ? buildRunToCompletionSummary(finalSession)
          : undefined;

      return {
        success: true,
        state: finalState,
        data: {
          ...(launchWarning ? { warning: launchWarning } : {}),
          message:
            `Debugging started for ${scriptPath}. Current state: ${finalState}` +
            (runToCompletion ? `. ${runToCompletion.summary}` : ''),
          ...(runToCompletion?.data ?? {}),
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
                (launchArgs?.stopOnEntry ? 'entry' : 'unknown')
              : undefined,
          stopOnEntrySuccessful: !!launchArgs?.stopOnEntry && finalState === SessionState.PAUSED,
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
          ...failureData(diagnosticData, noDebugFailureNote)
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
        ...failureData(diagnosticData, noDebugFailureNote)
      };
    }
  }

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
    // Claimed first (issue #711): a launch or attach still being awaited, or
    // a restart already replaying, is the most relevant fact about the
    // session. Held for the whole restart, so the replayed launch runs under
    // this claim. The refusal text distinguishes "wait for it" from the one
    // pairing that is terminal rather than transient — an in-flight attach,
    // whose session will never accept a restart (the `session.attachMode`
    // check below, answered up front because attachMode is only written
    // after the attach's first awaits).
    return this.inFlight.run(sessionId, 'restart', 'restart_debugging', this.ctx, () =>
      this.restart(this.ctx.getSession(sessionId))
    );
  }

  /** The restart proper; the caller holds the session's in-flight claim. */
  private async restart(session: ManagedSession): Promise<DebugResult> {
    const sessionId = session.id;

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

    // Content anchors re-resolve BEFORE the relaunch snapshots
    // initialBreakpoints, so breakpoints survive the edit that was the
    // point of the session (issue #271).
    const anchorResolution = await reresolveAnchors(session, this.ctx);

    const spec = session.lastLaunch;
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
      const staleCount = anchorResolution?.stale.length ?? 0;
      // Stamp stale-anchor notes AFTER the relaunch: the per-launch
      // breakpoint state reset (#238) clears message on every new launch,
      // and a real adapter message should still win over ours.
      if (anchorResolution) {
        const bps = this.ctx.getSession(sessionId).breakpoints;
        for (const staleEntry of anchorResolution.stale) {
          const bp = bps.get(staleEntry.breakpointId);
          if (bp && !bp.message) {
            bp.message = `Anchor "${staleEntry.statement}" not found at restart; breakpoint kept at last known line ${staleEntry.line}`;
          }
        }
      }
      // Join rather than clobber: startDebugging may already have set a
      // warning (unbound function breakpoints, issue #308).
      const priorWarning = result.data?.warning;
      const staleWarning = staleCount > 0
        ? `${staleCount} statement anchor(s) no longer match the current file; those breakpoints kept their previous lines — re-set them if the target moved.`
        : undefined;
      const ambiguousCount = anchorResolution?.moved.filter((m) => m.candidates !== undefined).length ?? 0;
      const ambiguousWarning = ambiguousCount > 0
        ? `${ambiguousCount} statement anchor(s) matched multiple lines and re-anchored to the nearest match — check anchorResolution.moved (candidates listed) and re-set any that landed wrong.`
        : undefined;
      const warnings = [priorWarning, staleWarning, ambiguousWarning].filter(Boolean);
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
}
