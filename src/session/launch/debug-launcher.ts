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
  buildUnboundBreakpointExitWarning
} from '../breakpoints/launch-warnings.js';
import {
  failProxySetup,
  logProxyFailure,
  sessionRemovedDuringTeardown
} from './proxy-failure-diagnostics.js';
import { waitForLaunchReadiness } from './launch-readiness.js';
import type { ProxyLauncher } from './proxy-launcher.js';

export class DebugLauncher {
  /** Sessions with a restart currently in flight (reentrancy guard, #238) */
  private restartingSessions = new Set<string>();

  constructor(
    private readonly ctx: LaunchContext,
    private readonly proxyLauncher: ProxyLauncher,
    private readonly breakpoints: BreakpointController
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

  async startDebugging(
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
    // influence whether this launch is reported as successful.
    session.exitCode = undefined;
    session.lastProxyExit = undefined;
    session.lastProxyError = undefined;
    session.failureDiagnostics = undefined;
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

    try {
      // For dry run, start the proxy and wait for completion
      if (dryRunSpawn) {
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
            ...(Object.keys(diagnosticData).length > 0 ? { data: diagnosticData } : {})
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
        const policyDefault = this.ctx.selectPolicy(session.language)
          .getInitializationBehavior?.().defaultExceptionBreakMode;
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
        dapLaunchArgs,
        dryRunSpawn,
        adapterLaunchConfig,
        breakOnExceptions: effectiveBreakOnExceptions,
      });
      this.ctx.logger.info(`[SessionManager] ProxyManager started for session ${sessionId}`);

      // Perform language-specific handshake if required
      const policy = this.ctx.selectPolicy(session.language);
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
          this.ctx.logger.warn(
            `[SessionManager] Language handshake returned with warning/error: ${
              handshakeErr instanceof Error ? handshakeErr.message : String(handshakeErr)
            }`
          );
        }
      }

      // Use policy-defined readiness criteria when available.
      const sessionStateAfterHandshake = this.ctx.getSession(sessionId).state;
      const alreadyReady = policy.isSessionReady
        ? policy.isSessionReady(sessionStateAfterHandshake, { stopOnEntry: dapLaunchArgs?.stopOnEntry })
        : sessionStateAfterHandshake === SessionState.PAUSED;

      if (!alreadyReady) {
        // Wait for adapter to be configured, first stop event, or termination
        await waitForLaunchReadiness(this.ctx, { session, sessionId, policy, dapLaunchArgs });
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
          ...(Object.keys(diagnosticData).length > 0 ? { data: diagnosticData } : {})
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

      this.ctx.logger.info(
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
          ...(Object.keys(diagnosticData).length > 0 ? { data: diagnosticData } : {})
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
        ...(Object.keys(diagnosticData).length > 0 ? { data: diagnosticData } : {})
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
    const session = this.ctx.getSession(sessionId);

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
      const anchorResolution = await reresolveAnchors(session, this.ctx);

      const spec = session.lastLaunch;
      this.ctx.logger.info(
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
    } finally {
      this.restartingSessions.delete(sessionId);
    }
  }
}
