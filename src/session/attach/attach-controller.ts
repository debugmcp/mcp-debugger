/**
 * Attach-mode sessions: `attach_to_process` and `detach_from_process`.
 *
 * An attach is a launch whose configuration says `request: 'attach'`, so the
 * proxy comes up through the same ProxyLauncher. What is attach-specific is
 * everything around it: the verifyTimeout override, the fail-fast gate for
 * languages that declare no attach mode, the policy handshake, and — because
 * a completed handshake proves nothing about the target — the thread
 * verification and post-attach pause in attach-verification.ts before PAUSED
 * is reported. A failure after the proxy exists tears it down
 * session-preservingly and reports the proxy-log pointers alongside the error.
 */
import type { ManagedSession } from '../session-store.js';
import { resolveDapTimeoutOverride } from '../dap-request-helpers.js';
import {
  SessionState,
  SessionLifecycleState,
  type ExceptionBreakMode
} from '@debugmcp/shared';
import { ErrorMessages } from '../../utils/error-messages.js';
import type { AttachResultData, CustomLaunchRequestArguments, DebugResult } from '../session-manager-core.js';
import type { AttachContext } from '../operations-context.js';
import type { BreakpointController } from '../breakpoints/breakpoint-controller.js';
import { failProxySetup, sessionRemovedDuringTeardown } from '../launch/proxy-failure-diagnostics.js';
import type { ProxyLauncher } from '../launch/proxy-launcher.js';
import { verifyAttachThreads } from './attach-verification.js';
import type { PauseCoordinator } from '../execution/pause-coordinator.js';
import type { InFlightGuard } from '../in-flight-guard.js';

/** The attach_to_process arguments as the session layer receives them. */
export interface AttachRequest {
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

/**
 * The thread of a stop the debugger has already reported for this attach, when the
 * session is paused on it. A separate function on purpose: inside attachToProcess the
 * flow analysis still holds the state the controller set itself, while the stop
 * handler has moved it on since.
 */
function observedAttachStopThread(session: ManagedSession): number | undefined {
  return session.state === SessionState.PAUSED ? session.lastStop?.threadId : undefined;
}

export class AttachController {
  constructor(
    private readonly ctx: AttachContext,
    private readonly proxyLauncher: ProxyLauncher,
    private readonly breakpoints: BreakpointController,
    private readonly pauseCoordinator: PauseCoordinator,
    /** Shared with the launcher: one launch-shaped call per session at a time (#711) */
    private readonly inFlight: InFlightGuard
  ) {}

  /**
   * Attach to a running process for debugging. Claims the session for the
   * whole call (issue #711): a concurrent start_debugging,
   * restart_debugging or attach_to_process is refused instead of tearing
   * down the proxy this attach is still bringing up. Claimed before the
   * first await so a same-tick call cannot race it.
   */
  async attachToProcess(
    sessionId: string,
    attachConfig: AttachRequest
  ): Promise<DebugResult<AttachResultData>> {
    return this.inFlight.run(sessionId, 'attach', 'attach_to_process', this.ctx, () =>
      this.attach(sessionId, attachConfig)
    );
  }

  /** The attach sequence proper; the caller holds the session's in-flight claim. */
  private async attach(
    sessionId: string,
    attachConfig: AttachRequest
  ): Promise<DebugResult<AttachResultData>> {
    const session = this.ctx.getSession(sessionId);
    this.ctx.logger.info(
      `[SessionManager] Attempting to attach to process for session ${sessionId}`,
      attachConfig
    );

    // The verification-window override is consumed by the thread-discovery
    // loop below, not by the adapter — strip it from the config that becomes
    // the DAP attach arguments. Validate before any state mutation.
    // breakOnExceptions maps to setExceptionBreakpoints, not attach args —
    // strip it too and thread it through the proxy config instead.
    // adapterConfig is merged by ProxyLauncher.start (the same slot launch uses
    // for adapterLaunchConfig, issue #336) — strip it here so the wrapper key
    // itself cannot leak into the DAP attach arguments.
    const { verifyTimeout, breakOnExceptions, adapterConfig, ...adapterAttachConfig } = attachConfig;
    if (adapterConfig && adapterConfig.stopOnEntry !== undefined) {
      this.ctx.logger.warn(
        '[SessionManager] adapterConfig.stopOnEntry reaches the adapter but does not affect post-attach pause verification; prefer the top-level stopOnEntry parameter'
      );
    }
    // Same rules as every per-request 'timeout' override: positive finite
    // milliseconds, clamped to the shared maximum (issue #142).
    const verifyTimeoutCheck = resolveDapTimeoutOverride(
      verifyTimeout,
      'SessionManager',
      this.ctx.logger,
      'verifyTimeout'
    );
    if (verifyTimeoutCheck.error) {
      return { success: false, state: session.state, error: verifyTimeoutCheck.error };
    }
    const verifyTimeoutOverride = verifyTimeoutCheck.timeoutMs;

    // Languages whose adapter declares no attach implementation fail fast,
    // before any state mutation (issue #331). Only an explicit 'none'
    // declaration is enforced — absent metadata falls through to the
    // adapter's natural behavior.
    // getFactoryMetadata is on IAdapterRegistry (issue #435 part 4); the
    // runtime guard stays for partial registry doubles, but skipping the
    // gate must never be silent — that is the fail-open degradation the
    // typed surface exists to expose.
    if (typeof this.ctx.adapterRegistry.getFactoryMetadata === 'function') {
      const factoryMeta = await this.ctx.adapterRegistry.getFactoryMetadata(session.language).catch(() => undefined);
      if (factoryMeta?.modes?.attach === 'none') {
        return {
          success: false,
          state: session.state,
          error: ErrorMessages.attachModeNotSupported(session.language)
        };
      }
    } else {
      this.ctx.logger.warn(
        `[SessionManager] adapterRegistry has no getFactoryMetadata; skipping the attach-'none' ` +
          `enforcement gate for '${session.language}'.`
      );
    }

    if (session.proxyManager || session.pendingProxyStop) {
      if (session.proxyManager) {
        this.ctx.logger.warn(
          `[SessionManager] Session ${sessionId} already has an active proxy. Terminating before attaching.`
        );
      }
      // Session-preserving teardown (same landmine as startDebugging, #238);
      // a stop() still in flight from a terminal event handler is awaited
      // too, so the new worker never races the old one's exit (#502).
      await this.ctx.stopProxyPreservingSession(session);
    }

    // Update to INITIALIZING state and set lifecycle to ACTIVE
    this.ctx.updateState(session, SessionState.INITIALIZING);
    this.ctx.updateSession(sessionId, {
      sessionLifecycle: SessionLifecycleState.ACTIVE,
      attachMode: true,
    });
    session.failureDiagnostics = undefined;
    // Same per-attempt reset as startDebugging: an attach that fails before a
    // proxy exists emits no stop, so a stop left over from a prior run would
    // be reported as this attempt's once the session lands in ERROR (#720).
    session.lastStop = undefined;
    // An attach debugs regardless of any earlier noDebug launch (issue #749).
    session.launchDebuggerOff = undefined;

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

      const attachConfigData = await this.proxyLauncher.start(session, {
        scriptPath: placeholderPath,
        dapLaunchArgs: attachLaunchArgs as Partial<CustomLaunchRequestArguments>,
        dryRunSpawn: false,
        // merged over the attach config before transformAttachConfig (issue #336)
        adapterLaunchConfig: adapterConfig,
        breakOnExceptions,
      });

      // Perform language-specific handshake if required, mirroring
      // startDebugging. For js-debug the whole DAP sequence — initialize,
      // configurationDone and the DAP 'attach' request itself — is driven
      // here because the proxy worker skips its built-in attach flow for
      // command-queueing policies. Policies without performHandshake are
      // untouched: their attach is performed by the proxy worker.
      const policy = this.ctx.selectPolicy(session.language);
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
          this.ctx.logger.warn(
            `[SessionManager] Language handshake for attach returned with warning/error: ${
              handshakeErr instanceof Error ? handshakeErr.message : String(handshakeErr)
            }`
          );
        }
      }

      // Set session state based on stopOnEntry
      let finalState = session.state;
      let attachPausePending = false;

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

        const verifyTimeoutMs = verifyTimeoutOverride ?? this.ctx.tunables.attachVerifyTimeoutMs;
        const pollIntervalMs = this.ctx.tunables.attachVerifyIntervalMs;
        const verification = await verifyAttachThreads(this.ctx, {
          proxyManager,
          verifyTimeoutMs,
          pollIntervalMs
        });

        if (!verification.ok) {
          const { proxyGone, lastFailure } = verification;
          const reason = proxyGone
            ? ErrorMessages.attachAdapterFailed(lastFailure)
            : ErrorMessages.attachVerifyFailed(verifyTimeoutMs, lastFailure);
          this.ctx.logger.error(`[SessionManager] ${reason} — tearing down proxy for session ${sessionId}`);
          // Thrown with the proxy still attached: the catch below tears it
          // down through failProxySetup — the session-preserving teardown,
          // which also records lastProxyPid for the leaked-worker check
          // (#502). Nulling the handle here first would make that teardown
          // skip its live-proxy branch.
          throw new Error(reason);
        }
        const { threads } = verification;

        // The debugger's own stop names the thread to anchor on. A debugger that
        // stops the target on attach (CodeLLDB; the COBOL shim then re-anchors that
        // stop on the thread inside the program, issue #759) has already reported
        // it by the time the threads are listed, and on Windows the first listed
        // thread is routinely a thread-pool worker. Only without such a stop does
        // the name heuristic apply: a thread named "main" (common in JVM
        // debugging), else the first thread.
        const stoppedThreadId = observedAttachStopThread(session);
        const stoppedThread = typeof stoppedThreadId === 'number' ? threads.find(t => t.id === stoppedThreadId) : undefined;
        const mainThread = threads.find(t => t.name === 'main');
        const chosen = stoppedThread ?? mainThread ?? threads[0];
        const discoveredThreadId = chosen.id;
        this.ctx.logger.info(
          `[SessionManager] Discovered ${threads.length} threads. Using threadId=${discoveredThreadId} (name=${chosen.name}${stoppedThread ? ', the thread of the observed attach stop' : ''})`
        );
        proxyManager.setCurrentThreadId(discoveredThreadId);
        this.ctx.logger.info(`[SessionManager] Set threadId=${discoveredThreadId} for attach mode`);

        // Some debuggers (rdbg; js-debug attaches with continueOnAttach) do
        // not suspend a running target on attach; issue an explicit pause so
        // the PAUSED state we report is real, and wait for the stop to be
        // observed before reporting it. Sent after thread verification so it
        // reaches the debuggee-owning session (for js-debug the pause is
        // routed to the child session, which exists once threads are
        // reported). A rejected pause means the target is already stopped
        // (e.g. started suspended) — fine, no stop event will follow.
        const attachBehavior = this.ctx.selectPolicy(session.language).getAttachBehavior?.();
        if (attachBehavior?.pauseAfterAttach) {
          const pauseThreadId = attachBehavior.pauseAllThreads ? 0 : discoveredThreadId;
          const pauseOutcome = await this.pauseCoordinator.requestPause({
            session,
            proxyManager,
            threadId: pauseThreadId,
            timeoutMs: this.ctx.tunables.attachPauseStopTimeoutMs,
            source: 'attach'
          });
          if (pauseOutcome.status === 'observed') {
            this.ctx.logger.info(
              `[SessionManager] Observed post-attach pause (threadId=${pauseThreadId})`
            );
          } else if (pauseOutcome.status === 'pending') {
            attachPausePending = true;
            this.ctx.logger.warn(
              `[SessionManager] No 'stopped' event within ${this.ctx.tunables.attachPauseStopTimeoutMs}ms after post-attach pause; returning RUNNING with pending=true`
            );
          } else {
            this.ctx.logger.info(
              `[SessionManager] Post-attach pause not needed/accepted: ${pauseOutcome.error instanceof Error ? pauseOutcome.error.message : String(pauseOutcome.error)}`
            );
          }
        }

        // A stopped event is the only evidence that the target is paused.
        // handleStopped records lastStop before transitioning to PAUSED; a
        // timeout or rejected redundant pause must not fabricate that state.
        if (session.state === SessionState.PAUSED && session.lastStop) {
          finalState = SessionState.PAUSED;
          this.ctx.logger.info(
            `[SessionManager] Session ${sessionId} is PAUSED after an observed attach stop`
          );
        } else {
          this.ctx.updateState(session, SessionState.RUNNING);
          finalState = SessionState.RUNNING;
          this.ctx.logger.info(
            `[SessionManager] Session ${sessionId} remains RUNNING until a stopped event is observed`
          );
        }
      } else {
        // JVM is already running (suspend=n), set RUNNING state
        this.ctx.updateState(session, SessionState.RUNNING);
        finalState = SessionState.RUNNING;
        this.ctx.logger.info(`[SessionManager] Set session ${sessionId} to RUNNING (stopOnEntry=false, process started with suspend=n)`);
      }

      // Attach parity with the post-launch belt-and-braces re-sync (issues
      // #236/#439, here for #500): breakpoints set before attach_to_process
      // were sent during the handshake, whose responses the policy may
      // discard — and for js-debug the child session only answered its
      // pending stub while adoption was in flight. Re-sending now, with the
      // debuggee-owning session provably live, delivers the authoritative
      // verification. forceFreshEcho: js-debug answers a no-change re-send
      // with an empty echo, and pre-attach breakpoints were already
      // registered via its pending-target queue — without a fresh echo their
      // verified state is unrecoverable (issue #500).
      await this.breakpoints.resyncAll(session, { forceFreshEcho: true });
      // Unverified-at-attach function breakpoints get the same launch-style
      // warning (issue #308); bind-late adapters (js/java) stay suppressed
      // inside the builder.
      const attachFnBpWarning = this.breakpoints.functionBreakpointLaunchWarning(session);

      const attachedTo = attachConfig.processId
        ? `Attached to process PID ${attachConfig.processId}`
        : `Attached to process at ${attachConfig.host || 'localhost'}:${attachConfig.port}`;
      // A late-landing pause must be named in the message, not only flagged:
      // pending:true next to state "running" reads as "nothing happened" to
      // an agent, and the target still freezes on its next dispatch (#654).
      const attachData: AttachResultData = {
        message: attachPausePending
          ? `${attachedTo}; ${ErrorMessages.attachPausePending}`
          : attachedTo,
        ...(attachPausePending ? { pending: true } : {})
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
      this.ctx.logger.error(`[SessionManager] Failed to attach to process for session ${sessionId}:`, error);
      // Never leave a live proxy chain behind a failed attach — e.g.
      // ProxyManager.start()'s init timeout rejects after the worker was
      // spawned (issue #337), and the verify failure above throws with the
      // proxy still attached so this is its one teardown. Then surface the
      // same structured diagnostics the launch path returns (issue #551) and
      // log the same full failure record it logs, proxy-log tail included
      // (issue #561) — an attach that dies during proxy initialization used
      // to leave the adapter's own complaint unreadable.
      const diagnosticData = await failProxySetup(this.ctx, session, error, 'attachToProcess');
      session.failureDiagnostics = Object.keys(diagnosticData).length > 0
        ? diagnosticData
        : undefined;
      const message = error instanceof Error ? error.message : String(error);
      // A close that landed during the teardown removed the session; the
      // state write would throw. Report the failure as-is.
      const state = sessionRemovedDuringTeardown(this.ctx, sessionId)
        ? SessionState.STOPPED
        : SessionState.ERROR;
      if (state === SessionState.ERROR) {
        this.ctx.updateState(session, SessionState.ERROR);
      }
      return {
        success: false,
        state,
        error: `Failed to attach: ${message}`,
        ...(Object.keys(diagnosticData).length > 0 ? { data: diagnosticData } : {})
      };
    }
  }

  /**
   * Detach from the debugged process without terminating it. Claims the
   * session for the whole call (issue #711): a detach tears the proxy down,
   * so it must not run while a launch, restart or attach is still being
   * awaited — a detach during a parked `start_debugging` used to stop the
   * worker out from under the readiness wait, which then read the worker's
   * exit as the program running to completion and returned `success: true`
   * for a process the caller had just detached from. Claimed before the
   * proxy check and before the first await, so a same-tick call cannot race
   * it, and a launch arriving mid-detach is refused likewise.
   */
  async detachFromProcess(
    sessionId: string,
    terminateProcess: boolean = false
  ): Promise<DebugResult> {
    return this.inFlight.run(sessionId, 'detach', 'detach_from_process', this.ctx, () =>
      this.detach(sessionId, terminateProcess)
    );
  }

  /** The detach proper; the caller holds the session's in-flight claim. */
  private async detach(
    sessionId: string,
    terminateProcess: boolean
  ): Promise<DebugResult> {
    const session = this.ctx.getSession(sessionId);
    this.ctx.logger.info(
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
        await this.ctx.closeSession(sessionId);
      } else {
        // Disconnect without terminating - send DAP disconnect request
        try {
          await session.proxyManager.sendDapRequest('disconnect', {
            terminateDebuggee: false
          });
        } catch (disconnectError) {
          this.ctx.logger.warn(`[SessionManager] Disconnect request failed, continuing with cleanup:`, disconnectError);
        }

        // Stop the proxy manager — it may already be gone if the disconnect
        // request triggered a 'terminated' event that cleared proxyManager.
        // Listeners come off BEFORE the worker is stopped, the ordering
        // closeSession uses: otherwise the worker's own exit(0) reaches the
        // session's handlers, which read it as the debuggee finishing and
        // report a run to completion for the process just detached from.
        if (session.proxyManager) {
          const proxyManager = session.proxyManager;
          try {
            this.ctx.cleanupProxyEventHandlers(session, proxyManager);
          } catch (cleanupError) {
            this.ctx.logger.error(
              `[SessionManager] Error during listener cleanup for session ${sessionId}:`,
              cleanupError
            );
          }
          await proxyManager.stop();
        }

        this.ctx.updateState(session, SessionState.STOPPED);
        this.ctx.updateSession(sessionId, {
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
      this.ctx.logger.error(`[SessionManager] Failed to detach from process for session ${sessionId}:`, error);

      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        state: session.state,
        error: `Failed to detach: ${message}`
      };
    }
  }
}
