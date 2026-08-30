/**
 * Session operations facade. Launch, attach and detach live here; breakpoint,
 * execution, evaluation, JVM hot-swap and DAP-mirror operations delegate to the
 * collaborators under src/session/{breakpoints,execution,inspection,jvm,mirror}/
 * through OperationsContext (see operations-context.ts).
 */
import {
  Breakpoint,
  FunctionBreakpoint,
  SessionState,
  SessionLifecycleState,
  type ExceptionBreakMode
} from '@debugmcp/shared';
import { ManagedSession } from './session-store.js';
import { DebugProtocol } from '@vscode/debugprotocol';
import { ErrorMessages } from '../utils/error-messages.js';
import { SessionManagerData } from './session-manager-data.js';
import type { OperationsContext } from './operations-context.js';
import { BreakpointController } from './breakpoints/breakpoint-controller.js';
import { ExecutionController } from './execution/execution-controller.js';
import {
  ExpressionEvaluator,
  type EvaluateResult
} from './inspection/expression-evaluator.js';
import {
  RedefineClassesController,
  type RedefineClassesResult
} from './jvm/redefine-classes-controller.js';
import {
  MirrorController,
  type ExposeSessionResult,
  type UnexposeSessionResult
} from './mirror/mirror-controller.js';
import { ProxyLauncher } from './launch/proxy-launcher.js';
import { DebugLauncher } from './launch/debug-launcher.js';
import { logProxyFailure } from './launch/proxy-failure-diagnostics.js';
import { CustomLaunchRequestArguments, DebugResult } from './session-manager-core.js';

/** Result type for evaluate expression operations. */
export type { EvaluateResult } from './inspection/expression-evaluator.js';

/** Result type for redefine_classes (JVM hot swap). */
export type { RedefineClassesResult } from './jvm/redefine-classes-controller.js';

/** Result types for expose_session / unexpose_session (issue #217). */
export type {
  ExposeSessionResult,
  UnexposeSessionResult
} from './mirror/mirror-controller.js';

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
  protected readonly hotSwap = new RedefineClassesController(this.opsContext, this.breakpoints);
  protected readonly mirror = new MirrorController(this.opsContext);
  protected readonly proxyLauncher = new ProxyLauncher(this.opsContext);
  protected readonly launcher = new DebugLauncher(this.opsContext, this.proxyLauncher, this.breakpoints);

  /**
   * Start (or dry-run) a launch-mode debug session. Delegates to the launcher,
   * which owns the launch sequence end to end.
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
    return this.launcher.startDebugging(
      sessionId,
      scriptPath,
      scriptArgs,
      dapLaunchArgs,
      dryRunSpawn,
      adapterLaunchConfig,
      breakOnExceptions
    );
  }

  /**
   * Restart the debuggee by replaying the last real launch (issue #238).
   */
  async restartDebugging(sessionId: string): Promise<DebugResult> {
    return this.launcher.restartDebugging(sessionId);
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

      const attachConfigData = await this.proxyLauncher.start(
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

  /**
   * Hot-swap changed classes into a running JVM (Java only).
   */
  async redefineClasses(
    sessionId: string,
    classesDir: string,
    sinceTimestamp: number = 0,
    timeoutMs?: number
  ): Promise<RedefineClassesResult> {
    return this.hotSwap.redefineClasses(sessionId, classesDir, sinceTimestamp, timeoutMs);
  }

  /**
   * Open a read-only DAP mirror endpoint for IDE attach (issue #217).
   */
  async exposeSession(sessionId: string): Promise<ExposeSessionResult> {
    return this.mirror.exposeSession(sessionId);
  }

  /**
   * Close the session's mirror endpoint (issue #217).
   */
  async unexposeSession(sessionId: string): Promise<UnexposeSessionResult> {
    return this.mirror.unexposeSession(sessionId);
  }
}
