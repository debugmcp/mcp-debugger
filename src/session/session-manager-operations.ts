/**
 * Session operations facade. Launch, attach and detach live here; breakpoint,
 * execution, evaluation, JVM hot-swap and DAP-mirror operations delegate to the
 * collaborators under src/session/{breakpoints,execution,inspection,jvm,mirror}/
 * through OperationsContext (see operations-context.ts).
 */
import {
  Breakpoint,
  FunctionBreakpoint,
  type ExceptionBreakMode
} from '@debugmcp/shared';
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
import { AttachController } from './attach/attach-controller.js';
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
  protected readonly attach = new AttachController(this.opsContext, this.proxyLauncher, this.breakpoints);

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
   * Attach to a running process. Delegates to the attach controller, which
   * owns the attach sequence including thread verification.
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
    return this.attach.attachToProcess(sessionId, attachConfig);
  }

  /**
   * Detach from the debugged process without terminating it.
   */
  async detachFromProcess(
    sessionId: string,
    terminateProcess: boolean = false
  ): Promise<DebugResult> {
    return this.attach.detachFromProcess(sessionId, terminateProcess);
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
