/**
 * ChildSessionManager - Manages child debug sessions for multi-session adapters
 * 
 * This abstraction handles the complexity of child session creation and management,
 * particularly for JavaScript debugging with js-debug/pwa-node which uses multiple
 * concurrent sessions.
 */

import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy, ChildReport, ExceptionBreakMode } from '@debugmcp/shared';
import type { DapClientBehavior, ChildSessionConfig, ParentStart } from '@debugmcp/shared';
import { resolveExceptionFilters } from '@debugmcp/shared';
import { createLogger } from '../utils/logger.js';
import { createChildSafePolicy } from './child-safe-policy.js';
import type { MinimalDapClient } from './minimal-dap.js';
import { CdpFunctionBreakpointBridge } from './cdp-function-breakpoint-bridge.js';
import { sendSetBreakpointsStamping, watchConditionSyntaxErrors, matchStoredBreakpoint } from './breakpoint-condition-errors.js';
import path from 'path';

// redirectable: the proxy worker re-points this logger into the per-session
// proxy-<sessionId>.log at init so routing decisions are visible there (#519)
const logger = createLogger('child-session-manager', { redirectable: true });

// Deferred, cached import of MinimalDapClient — deferred to break the static
// import cycle with minimal-dap.ts, cached so concurrent first uses share one
// import() call: concurrent dynamic imports of the same module can resolve
// inconsistently under vitest's module mocker, handing one caller the real
// module and the other the mock.
let minimalDapModule: Promise<typeof import('./minimal-dap.js')> | undefined;
function loadMinimalDap(): Promise<typeof import('./minimal-dap.js')> {
  minimalDapModule ??= import('./minimal-dap.js');
  return minimalDapModule;
}

function createInstanceId(): string {
  return randomBytes(4).toString('hex');
}

export interface ChildSessionOptions {
  policy: AdapterPolicy;
  host: string;
  port: number;
  /** DI seam for tests; only consulted when the policy delivers function breakpoints via CDP (issue #295). */
  cdpBridgeFactory?: () => CdpFunctionBreakpointBridge;
  /**
   * Read once per adoption (#712). Start intent never modifies parentConfig (#730).
   */
  getParentStart?: () => ParentStart | undefined;
}

/**
 * How a startDebugging reverse request was resolved:
 * - 'adopted': became the active child session
 * - 'duplicate': already adopted; nothing to do
 *
 * The in-session manager adopts one target, the program's own (issue #704).
 * Every later report is relayed as a child report before it gets here — by
 * the js policy on the root connection once a target is adopted, by
 * createChildSafePolicy on every other connection — and the worker's holder
 * adopts or releases it (issue #1082; the release is throwaway-release.ts).
 * The manager's own release of a second target (issue #501) went with that
 * routing: a second target reaching createChildSession is refused by name.
 */
export type ChildSessionOutcome = 'adopted' | 'duplicate';

/**
 * Settle-once death signal for a child client during adoption (issue #248).
 * Modeled on JsDebugLaunchBarrier: pre-caught so an unused latch never becomes
 * an unhandled rejection, and disposed once adoption settles either way.
 */
interface ChildDeathLatch {
  isDead(): boolean;
  error(): Error | null;
  /** Race a step against child death; rejects immediately once the child dies. */
  race<T>(step: Promise<T>): Promise<T>;
  dispose(): void;
}

function createChildDeathLatch(child: MinimalDapClient, pendingId: string): ChildDeathLatch {
  let dead: Error | null = null;
  let rejectDeath: ((err: Error) => void) | null = null;
  const deathPromise = new Promise<never>((_, reject) => {
    rejectDeath = reject;
  });
  // Pre-catch: if no race is in flight when death fires, nothing awaits this
  deathPromise.catch(() => {});

  const markDead = (why: string) => (cause?: Error) => {
    if (dead) return;
    const detail = cause?.message ? `: ${cause.message}` : '';
    dead = new Error(`Child session ${pendingId} ${why} during adoption${detail}`);
    rejectDeath?.(dead);
  };
  const onClose = markDead('closed');
  const onError = markDead('errored');
  child.on('close', onClose);
  child.on('error', onError);

  return {
    isDead: () => dead !== null,
    error: () => dead,
    race<T>(step: Promise<T>): Promise<T> {
      // A losing step may reject later (e.g. socket teardown); keep it handled
      step.catch(() => {});
      if (dead) {
        return Promise.reject(dead);
      }
      return Promise.race([step, deathPromise]);
    },
    dispose: () => {
      child.off('close', onClose);
      child.off('error', onError);
    }
  };
}

export class ChildSessionManager extends EventEmitter {
  private policy: AdapterPolicy;
  private dapBehavior: DapClientBehavior;
  private host: string;
  private port: number;
  private readonly getParentStart?: () => ParentStart | undefined;

  // Child session tracking
  private adoptedTargets = new Set<string>();
  private childSessions = new Map<string, MinimalDapClient>();
  private activeChild: MinimalDapClient | null = null;

  // Breakpoint mirroring
  private storedBreakpoints = new Map<string, DebugProtocol.SourceBreakpoint[]>();

  // Break-on-exception mode for child sessions (issue #220); resolved to
  // concrete filters via the adapter policy when configuring a child
  private exceptionBreakMode: ExceptionBreakMode = 'none';

  // State tracking
  private adoptionInProgress = false;
  private sawChildStop = false;
  // Latched in wireChildEvents: an 'initialized' event can arrive in the same
  // socket chunk as the request's response, i.e. before any waitForEvent
  // listener registered by the response's awaiter exists (issue #529)
  private childInitializedCount = 0;
  // An adopted child's connection closed and no new adoption has started
  // since — routed commands can only hit the parent, where child-required
  // ones (e.g. js-debug 'pause') would silently no-op (issue #513)
  private childEnded = false;
  private readonly instanceId: string;

  // CDP-delivered function breakpoints (issue #295); present only when the
  // policy declares functionBreakpointsVia 'cdp' (js-debug)
  private cdpBridge: CdpFunctionBreakpointBridge | null = null;
  // Serializes child event forwarding so a stopped event held by the bridge
  // (correlation/bind window) cannot be overtaken by later events
  private childEventChain: Promise<void> = Promise.resolve();
  /**
   * Settles when the CDP bridge attach of the adoption in progress has run
   * (or adoption failed first). The child event chain waits on it so a
   * forced entry stop never reaches the SessionManager — whose auto-continue
   * resumes the program — before the bridge has installed the logpoint
   * delivery binding (issue #850). Resolved in every exit of
   * createChildSession, so nothing is ever held past a failed adoption.
   */
  private bridgeAttachSettled: Promise<void> = Promise.resolve();
  /**
   * The child's adapter ids as last echoed per file, by request index, so
   * a synthesized breakpoint event can name a record by id rather than by
   * file + line (two breakpoints may share a line) (issue #853).
   */
  private readonly childEchoedIds = new Map<string, Array<number | undefined>>();

  /**
   * Resolves when every child event enqueued so far has been forwarded
   * (issue #366): output events ride the childEventChain when the CDP bridge
   * is active, so a terminal event must not be forwarded upstream until the
   * chain has drained or queued output is silently dropped at teardown.
   */
  flushEvents(): Promise<void> {
    return this.childEventChain;
  }

  constructor(options: ChildSessionOptions) {
    super();
    this.policy = options.policy;
    this.dapBehavior = options.policy.getDapClientBehavior();
    this.host = options.host;
    this.port = options.port;
    this.getParentStart = options.getParentStart;
    this.instanceId = createInstanceId();
    if (options.policy.functionBreakpointsVia === 'cdp') {
      this.cdpBridge = options.cdpBridgeFactory?.() ?? new CdpFunctionBreakpointBridge();
      this.cdpBridge.on('breakpointEvent', (evt: DebugProtocol.Event) => {
        this.emit('childEvent', evt);
      });
      // Logpoint messages delivered over the CDP binding (issue #850) ride
      // the same path as any adapter output event — through the chain, so
      // a message never overtakes child events the chain is still holding.
      this.cdpBridge.on('outputEvent', (evt: DebugProtocol.Event) => {
        this.childEventChain = this.childEventChain.then(() => {
          this.emit('childEvent', evt);
        });
      });
    }
    logger.info(`[ChildSessionManager:${this.instanceId}] created`);
  }

  /**
   * Replace-all function breakpoint sync, delivered over the CDP bridge
   * (issue #295). MinimalDapClient intercepts setFunctionBreakpoints for
   * cdp-delivery policies and lands here; safe before any child exists (the
   * bridge queues the desired set as pending).
   */
  async syncFunctionBreakpoints(
    breakpoints: DebugProtocol.FunctionBreakpoint[]
  ): Promise<{ breakpoints: DebugProtocol.Breakpoint[] }> {
    if (!this.cdpBridge) {
      return { breakpoints: breakpoints.map(() => ({ verified: false })) };
    }
    return this.cdpBridge.sync(breakpoints);
  }

  /**
   * Record the session's break-on-exception mode, applied to child sessions
   * created afterwards (issue #220). Set at worker init, before any child
   * session exists.
   */
  setExceptionBreakMode(mode: ExceptionBreakMode): void {
    this.exceptionBreakMode = mode;
  }

  /**
   * Check if a pending target has already been adopted
   */
  isAdopted(pendingId: string): boolean {
    return this.adoptedTargets.has(pendingId);
  }

  /**
   * Check if adoption is currently in progress
   */
  isAdoptionInProgress(): boolean {
    logger.info(`[ChildSessionManager:${this.instanceId}] isAdoptionInProgress() => ${this.adoptionInProgress}`);
    return this.adoptionInProgress;
  }

  /**
   * Check if there are any active child sessions
   */
  hasActiveChildren(): boolean {
    const result = this.activeChild !== null || this.childSessions.size > 0;
    logger.info(`[ChildSessionManager:${this.instanceId}] hasActiveChildren() => ${result} (activeChild: ${!!this.activeChild}, sessions: ${this.childSessions.size})`);
    return result;
  }

  /**
   * Get the active child session
   */
  getActiveChild(): MinimalDapClient | null {
    logger.info(`[ChildSessionManager:${this.instanceId}] getActiveChild() => ${this.activeChild ? 'active' : 'null'}`);
    return this.activeChild;
  }

  /**
   * Where the debuggable target session currently lives (issue #513):
   * - 'active':   adoption completed — the child is connected AND bound to
   *               its pending target (its attach handshake finished)
   * - 'adopting': adoption is underway. The activeChild reference may already
   *               be set in this state, but the child is not yet bound to the
   *               target: a request dispatched to it now can be swallowed by
   *               js-debug without a response (observed with 'pause' sent
   *               between the child's initialize and attach)
   * - 'ended':    an adopted child closed and nothing replaced it — routed
   *               commands can only reach the parent from here on
   * - 'none':     no adoption has happened (yet)
   */
  getChildTargetState(): 'active' | 'adopting' | 'ended' | 'none' {
    let state: 'active' | 'adopting' | 'ended' | 'none';
    if (this.adoptionInProgress) {
      state = 'adopting';
    } else if (this.activeChild !== null) {
      state = 'active';
    } else if (this.childEnded) {
      state = 'ended';
    } else {
      state = 'none';
    }
    logger.info(`[ChildSessionManager:${this.instanceId}] getChildTargetState() => ${state}`);
    return state;
  }

  /**
   * Route a command to the appropriate child session if needed
   */
  shouldRouteToChild(command: string): boolean {
    const routedCommands = this.dapBehavior.childRoutedCommands;
    if (!routedCommands) {
      logger.info(`[ChildSessionManager:${this.instanceId}] shouldRouteToChild(${command}): false (no routed command set configured)`);
      return false;
    }

    if (!routedCommands.has(command)) {
      logger.info(`[ChildSessionManager:${this.instanceId}] shouldRouteToChild(${command}): false (command not routed)`);
      return false;
    }

    // The child can enumerate a thread before its attach response and
    // configuration replay finish (#762). The parent's empty response keeps
    // attach verification polling within its own deadline until adoption is
    // complete; do not wait childInitTimeout inside a threads request.
    if (command === 'threads' && this.getChildTargetState() !== 'active') {
      return false;
    }

    const hasActive = this.hasActiveChildren();
    const adoptionInProg = this.adoptionInProgress;

    if (hasActive) {
      logger.info(`[ChildSessionManager:${this.instanceId}] shouldRouteToChild(${command}): true (active child session available)`);
    } else if (adoptionInProg) {
      logger.info(`[ChildSessionManager:${this.instanceId}] shouldRouteToChild(${command}): true (child adoption in progress)`);
    } else {
      // Still return true so callers can queue/await until the child attaches.
      logger.info(`[ChildSessionManager:${this.instanceId}] shouldRouteToChild(${command}): true (child command with no active child yet)`);
    }

    return true;
  }

  /**
   * One child setBreakpoints send. js-debug reports a condition (or a
   * compiled logpoint) that does not parse only as a stderr line written
   * during the request (issue #853); the send watches the child's own output
   * — emitted synchronously as the frame is parsed, ahead of the held event
   * chain — and stamps the line onto the answer's breakpoint.
   */
  private sendChildSetBreakpoints(
    child: MinimalDapClient,
    sourcePath: string,
    breakpoints: DebugProtocol.SourceBreakpoint[]
  ): Promise<DebugProtocol.SetBreakpointsResponse> {
    const send = (): Promise<DebugProtocol.SetBreakpointsResponse> =>
      child.sendRequest<DebugProtocol.SetBreakpointsResponse>('setBreakpoints', {
        source: { path: sourcePath },
        breakpoints
      });
    return this.dapBehavior.reportsBreakpointSyntaxErrorsOnStderr
      ? sendSetBreakpointsStamping(child, breakpoints, send)
      : send();
  }

  /**
   * Store breakpoints for mirroring to child sessions.
   *
   * Returns the child's setBreakpoints response when an active child was
   * mirrored to, or null when there was no child / the mirror failed — the
   * child owns the runtime, so its response carries the authoritative
   * verified state (issue #500). Never rejects.
   */
  storeBreakpoints(
    sourcePath: string,
    breakpoints: DebugProtocol.SourceBreakpoint[],
    options?: { forceFreshEcho?: boolean }
  ): Promise<DebugProtocol.SetBreakpointsResponse | null> {
    if (!this.dapBehavior.mirrorBreakpointsToChild) {
      return Promise.resolve(null);
    }

    const absolutePath = path.isAbsolute(sourcePath) ? sourcePath : path.resolve(sourcePath);
    if (breakpoints.length === 0) {
      // A fresh child never saw this file's breakpoints, so replaying an
      // empty set is a no-op — drop the key instead of retaining every file
      // that ever had a breakpoint (issue #405).
      this.storedBreakpoints.delete(absolutePath);
    } else {
      this.storedBreakpoints.set(absolutePath, breakpoints);
    }

    // Mirror to active child if present
    const child = this.activeChild;
    if (!child) {
      logger.info(
        `[ChildSessionManager:${this.instanceId}] No active child to mirror ${breakpoints.length} breakpoint(s) for ${absolutePath} (adoptionInProgress=${this.adoptionInProgress}); stored for replay`
      );
      return Promise.resolve(null);
    }
    logger.info(
      `[ChildSessionManager:${this.instanceId}] Mirroring ${breakpoints.length} breakpoint(s) for ${absolutePath} to active child`
    );
    const send = (): Promise<DebugProtocol.SetBreakpointsResponse> =>
      this.sendChildSetBreakpoints(child, absolutePath, breakpoints);
    return send().then(async resp => {
      let effective = resp;
      const echoed = resp?.body?.breakpoints;
      if (
        options?.forceFreshEcho === true &&
        breakpoints.length > 0 &&
        Array.isArray(echoed) &&
        echoed.length < breakpoints.length
      ) {
        // js-debug's BreakpointManager answers a no-change re-send with an
        // EMPTY breakpoints array (`if (unbound===0 && new===0) return
        // {breakpoints:[]}` in the vendored bundle), so re-sending an
        // already-registered set can never recover verified state — the
        // exact hole behind issue #500's pre-attach breakpoints. When the
        // caller asked for an authoritative echo (the post-attach re-sync,
        // which runs against a paused or freshly-attached debuggee), clear
        // the path and set again so the child must answer with real records.
        logger.info(
          `[ChildSessionManager:${this.instanceId}] Child echoed ${echoed.length}/${breakpoints.length} breakpoint(s) for ${absolutePath} (no-change short echo); clearing and re-setting for a fresh echo`
        );
        try {
          await child.sendRequest<DebugProtocol.SetBreakpointsResponse>('setBreakpoints', {
            source: { path: absolutePath },
            breakpoints: []
          });
          effective = await send();
        } catch (err: unknown) {
          logger.warn(
            `[ChildSessionManager:${this.instanceId}] Fresh-echo re-set FAILED for ${absolutePath}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
      const summary = (effective?.body?.breakpoints ?? [])
        .map(bp => `id=${bp.id} verified=${bp.verified} line=${bp.line}`)
        .join('; ');
      logger.info(
        `[ChildSessionManager:${this.instanceId}] Child setBreakpoints response for ${absolutePath}: [${summary}]`
      );
      this.emitBreakpointResults(absolutePath, breakpoints, effective);
      return effective;
    }).catch((err: unknown) => {
      logger.warn(
        `[ChildSessionManager:${this.instanceId}] Child setBreakpoints mirror FAILED for ${absolutePath}: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    });
  }

  /**
   * Forward a child setBreakpoints response as synthesized DAP breakpoint
   * events. The child session owns the runtime, so its responses carry the
   * authoritative verified state and breakpoint ids — but the SessionManager
   * store only ever sees the parent session's responses. Without this, a
   * breakpoint that the child verifies in the response (no subsequent
   * 'breakpoint' event) would stay verified:false forever.
   */
  private emitBreakpointResults(
    sourcePath: string,
    requested: DebugProtocol.SourceBreakpoint[],
    response: DebugProtocol.SetBreakpointsResponse | undefined
  ): void {
    const bps = response?.body?.breakpoints;
    if (!Array.isArray(bps) || bps.length < requested.length) {
      // Silent before issue #500: an attach-path child answering without a
      // breakpoints array — or with fewer entries than requested (observed:
      // an empty [] from a post-attach-init replay) — left the store
      // unreconciled with no trace. Synthesize from whatever did come back.
      logger.warn(
        `[ChildSessionManager:${this.instanceId}] Child setBreakpoints response for ${sourcePath} echoed ${Array.isArray(bps) ? bps.length : 'no'} breakpoint(s) for ${requested.length} requested (body=${JSON.stringify(response?.body)}); unechoed breakpoints stay unreconciled`
      );
    }
    if (!Array.isArray(bps)) {
      return;
    }
    if (bps.length === requested.length) {
      this.childEchoedIds.set(sourcePath, bps.map((bp) => bp.id));
    }
    bps.forEach((bp, i) => {
      logger.debug(
        `[ChildSessionManager:${this.instanceId}] Synthesizing breakpoint event from child response: id=${bp.id} verified=${bp.verified} ${bp.source?.path ?? sourcePath}:${bp.line ?? requested[i]?.line}`
      );
      const event: DebugProtocol.BreakpointEvent = {
        seq: 0,
        type: 'event',
        event: 'breakpoint',
        body: {
          reason: 'changed',
          breakpoint: {
            ...bp,
            // DAP responses may omit source/line; fall back to the request
            source: bp.source ?? { path: sourcePath },
            line: bp.line ?? requested[i]?.line
          }
        }
      };
      this.emit('childEvent', event);
    });
  }

  /**
   * Create and configure the in-session child: the program's own target, the
   * one report the root connection adopts here. Every later report — a fork
   * on the program target's connection, a grandchild on the fork's, and any
   * on the root itself once a target is adopted — is relayed as a child
   * report for the worker to hold (issue #1082) and never reaches this
   * method. The adoption snapshots the parent intent once (#712/#730).
   */
  async createChildSession(config: ChildSessionConfig): Promise<ChildSessionOutcome> {
    const parentStart = this.getParentStart?.();
    const { pendingId, parentConfig } = config;

    // Check if already adopted
    if (this.adoptedTargets.has(pendingId)) {
      logger.warn(`Pending target ${pendingId} already adopted`);
      return 'duplicate';
    }

    // One in-session child only. Every report after the program's own is
    // relayed as a child report before it can get here (the js policy on the
    // root connection once a target is adopted, createChildSafePolicy on every
    // other connection, issue #1082), so a second target reaching this method
    // is a routing bug. Say so: an ack with nothing attached would leave the
    // forked process parked forever in waitForDebugger (issue #501), and a
    // release belongs to the worker's holder (throwaway-release.ts).
    if (this.adoptionInProgress || this.hasActiveChildren()) {
      const state = this.adoptionInProgress ? 'is being adopted' : 'is active';
      logger.error(`[ChildSessionManager:${this.instanceId}] Pending target ${pendingId} reached in-session adoption while a child ${state}; later reports are relayed as child reports (issue #1082), not adopted here`, {
        pendingId,
        adoptionInProgress: this.adoptionInProgress,
        hasActiveChild: !!this.activeChild,
        childSessionCount: this.childSessions.size
      });
      throw new Error(`Pending target ${pendingId} reported while a child ${state}; later reports are relayed as child reports (issue #1082), not adopted in-session`);
    }

    this.adoptionInProgress = true;
    this.childEnded = false;
    logger.info(`[ChildSessionManager:${this.instanceId}] Setting adoptionInProgress = true for ${pendingId}`);
    this.adoptedTargets.add(pendingId);

    let child: MinimalDapClient | null = null;
    let death: ChildDeathLatch | null = null;
    let settleBridgeAttach: () => void = () => undefined;
    if (this.cdpBridge) {
      this.bridgeAttachSettled = new Promise<void>((resolve) => {
        settleBridgeAttach = resolve;
      });
    }
    try {
      // Import MinimalDapClient dynamically to avoid circular dependency
      const { MinimalDapClient } = await loadMinimalDap();

      // Create child client with a policy that disables recursive reverse debugging
      const childPolicy = this.buildChildSafePolicy();
      // traceLabel disambiguates this connection's frames in the shared DAP
      // trace file (issue #518)
      child = new MinimalDapClient(this.host, this.port, childPolicy, {
        traceLabel: `child:${pendingId.slice(0, 8)}`
      });
      await child.connect();

      // Wire up event forwarding
      this.wireChildEvents(child);

      // Abort remaining adoption steps the moment the child dies (issue #248)
      death = createChildDeathLatch(child, pendingId);

      // Store and activate child
      this.childSessions.set(pendingId, child);
      this.activeChild = child;
      logger.info(`[ChildSessionManager:${this.instanceId}] *** ACTIVE CHILD SET *** for ${pendingId} at timestamp ${Date.now()}`);

      // Initialize child session
      await death.race(this.initializeChild(child, pendingId, parentConfig));

      // Configure child session
      await death.race(this.configureChild(child, pendingId, parentConfig));

      // Attach to pending target. Snapshot the 'initialized' latch first:
      // js-debug can deliver the post-attach 'initialized' in the same socket
      // chunk as the attach response, and a listener registered only after
      // attachChild resolves would miss it — stalling adoption 3s and pushing
      // the CDP bridge attach past the entry pause (issue #529)
      const postAttachInitBaseline = this.childInitializedCount;
      await this.attachChild(child, pendingId, parentConfig, death, parentStart);

      // Handle post-attach initialization if needed
      await death.race(this.handlePostAttachInit(child, postAttachInitBaseline));

      // Connect the CDP function-breakpoint bridge BEFORE the entry-stop gate
      // below so the proxy's sticky Debugger.paused replay plus a live
      // subscription cover an entry stop either way (issue #295). attachToChild never
      // throws by design; death.race can, and a dead child fails adoption in
      // the next step regardless, so log and continue here.
      if (this.cdpBridge) {
        try {
          await death.race(this.cdpBridge.attachToChild(child));
        } catch (err) {
          logger.warn(`[ChildSessionManager:${this.instanceId}] CDP bridge attach aborted: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      settleBridgeAttach();

      // Ensure initial stop if policy requires it.
      // Skip when the user explicitly requested stopOnEntry=false: forcing a
      // pause contradicts intent and the resulting 'pause'-reason stopped
      // event would not be recognized by the auto-continue trigger.
      // Also skip for attach-mode parents: attach targets emit no entry
      // stop, so waiting for one here only stalls adoption, and the
      // SessionManager already issues and verifies the post-attach pause via
      // the policy's getAttachBehavior().pauseAfterAttach (issue #124).
      const wantsEntryStop = parentStart?.stopOnEntry !== false;
      const attachModeParent = parentStart?.request === 'attach';
      if (this.dapBehavior.pauseAfterChildAttach && wantsEntryStop && !attachModeParent) {
        await death.race(this.ensureChildStopped(child));
      }

      // childCreated becomes the parent's readiness status (issue #704): let
      // any child event the chain still holds — a stop the CDP bridge is
      // rewriting — reach the parent first, so the status never overtakes
      // the stop it should follow.
      await death.race(this.flushEvents());
      this.adoptionInProgress = false;
      logger.info(`[ChildSessionManager:${this.instanceId}] Setting adoptionInProgress = false for ${pendingId} (success)`);
      logger.info(`[ChildSessionManager:${this.instanceId}] Child session created successfully for ${pendingId}`);
      this.emit('childCreated', pendingId, child);
      return 'adopted';

    } catch (error) {
      settleBridgeAttach();
      this.adoptionInProgress = false;
      this.adoptedTargets.delete(pendingId);
      // Roll back registration so a later adoption attempt is not latched out
      // by hasActiveChildren(), and release the half-adopted socket (issue #248)
      if (child) {
        if (this.childSessions.get(pendingId) === child) {
          this.childSessions.delete(pendingId);
        }
        if (this.activeChild === child) {
          this.activeChild = null;
        }
        try {
          child.shutdown('adoption failed');
        } catch {
          // Best effort — the socket may already be gone
        }
      }
      logger.info(`[ChildSessionManager:${this.instanceId}] Setting adoptionInProgress = false for ${pendingId} (error)`);
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[ChildSessionManager:${this.instanceId}] Failed to create child session for ${pendingId}: ${msg}`);
      this.emit('childError', pendingId, error);
      throw error;
    } finally {
      death?.dispose();
    }
  }

  /**
   * Initialize child session
   */
  private async initializeChild(child: MinimalDapClient, pendingId: string, _parentConfig: Record<string, unknown>): Promise<void> {
    void _parentConfig; // Currently unused but may be needed for future policy implementations
    
    const initArgs = {
      clientID: `mcp-child-${pendingId}`,
      adapterID: this.policy.getDapAdapterConfiguration().type,
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      // The session tree (issue #1082): the processes this target starts are
      // reported on this connection; ask for the request form here too.
      ...(this.policy.childAdoption?.advertiseStartDebugging ? { supportsStartDebuggingRequest: true } : {})
    };
    
    logger.info(`[child:${pendingId}] initialize`);
    const initializedBaseline = this.childInitializedCount;
    await child.sendRequest('initialize', initArgs);

    // Wait for initialized event (latched — it may have arrived with the
    // initialize response itself, issue #529)
    await this.waitForChildInitialized(child, initializedBaseline, this.dapBehavior.childInitTimeout || 12000);
  }

  /**
   * Configure child session (breakpoints, exception filters, etc.)
   */
  private async configureChild(child: MinimalDapClient, pendingId: string, _parentConfig: Record<string, unknown>): Promise<void> {
    void _parentConfig; // Currently unused but may be needed for future policy implementations
    
    // Set exception breakpoints ([] unless breakOnExceptions was requested)
    const exceptionFilters = resolveExceptionFilters(this.policy, this.exceptionBreakMode);
    try {
      logger.info(`[child:${pendingId}] setExceptionBreakpoints ${JSON.stringify(exceptionFilters)}`);
      await child.sendRequest('setExceptionBreakpoints', { filters: exceptionFilters });
    } catch {
      logger.warn(`[child:${pendingId}] setExceptionBreakpoints failed or not supported`);
    }
    
    // Mirror breakpoints if policy requires
    if (this.dapBehavior.mirrorBreakpointsToChild) {
      for (const [srcPath, bps] of this.storedBreakpoints) {
        logger.info(`[child:${pendingId}] setBreakpoints -> ${srcPath} (${bps.length})`);
        try {
          const resp = await this.sendChildSetBreakpoints(child, srcPath, bps);
          this.emitBreakpointResults(srcPath, bps, resp);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          logger.warn(`[child:${pendingId}] setBreakpoints failed: ${msg}`);
        }
      }
    }
    
    // Send configuration done unless suppressed
    if (!this.dapBehavior.suppressPostAttachConfigDone) {
      try {
        logger.info(`[child:${pendingId}] configurationDone`);
        await child.sendRequest('configurationDone', {});
      } catch {
        logger.warn(`[child:${pendingId}] configurationDone failed or not required`);
      }
    }
  }

  /**
   * Attach child to pending target
   */
  private async attachChild(
    child: MinimalDapClient,
    pendingId: string,
    parentConfig: Record<string, unknown>,
    death: ChildDeathLatch,
    parentStart?: ParentStart
  ): Promise<void> {
    const attachArgs = this.policy.buildChildStartArgs(
      pendingId, parentConfig, parentStart?.request === 'attach' ? parentStart.attachArguments : undefined
    );

    // Retry logic for attachment, bounded by a total deadline so a live but
    // unresponsive adapter cannot pin the worker for retries x timeout (#248)
    const maxRetries = 20;
    const totalDeadlineMs = 60000;
    const deadline = Date.now() + totalDeadlineMs;
    let adopted = false;
    let lastError: unknown;

    // js-debug compiles the breakpoints it buffered on this pending-target
    // connection while answering attach, and reports a condition that does
    // not parse only as a stderr line then (issue #853) — there is no
    // setBreakpoints request of ours to stamp, so watch the whole attach.
    const syntaxErrors = this.dapBehavior.reportsBreakpointSyntaxErrorsOnStderr &&
      this.dapBehavior.mirrorBreakpointsToChild && this.storedBreakpoints.size > 0
      ? watchConditionSyntaxErrors(child)
      : null;
    try {
      for (let i = 0; i < maxRetries && !adopted; i++) {
        if (death.isDead()) {
          throw death.error();
        }
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          break;
        }
        try {
          logger.info(`[child:${pendingId}] ${attachArgs.command} attempt ${i + 1}`);
          await death.race(
            this.withTimeout(
              child.sendRequest(attachArgs.command, attachArgs.args, 20000),
              remainingMs,
              `${attachArgs.command} deadline exceeded`
            )
          );
          adopted = true;
        } catch (e) {
          if (death.isDead()) {
            throw death.error();
          }
          lastError = e;
          await this.sleep(200);
        }
      }
    } finally {
      const errors = syntaxErrors?.stop() ?? [];
      if (adopted) {
        this.reportAttachTimeSyntaxErrors(errors);
      }
    }

    if (!adopted) {
      const msg = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(`Failed to attach child after ${maxRetries} attempts or ${totalDeadlineMs}ms deadline: ${msg}`);
    }
  }

  /**
   * Hand each attach-time syntax error to the stored breakpoint it names as
   * a synthesized breakpoint event (file + line, the way the SessionManager
   * matches an id-less event), after the replay's provisional answers.
   */
  private reportAttachTimeSyntaxErrors(errors: ReadonlyArray<{ line: number; condition?: string; text: string }>): void {
    for (const error of errors) {
      const match = matchStoredBreakpoint(this.storedBreakpoints, error);
      if (!match) {
        logger.info(`[ChildSessionManager:${this.instanceId}] attach-time breakpoint syntax error matched no single stored breakpoint: ${error.text}`);
        continue;
      }
      const id = this.childEchoedIds.get(match.path)?.[match.index];
      const event: DebugProtocol.BreakpointEvent = {
        seq: 0,
        type: 'event',
        event: 'breakpoint',
        body: {
          reason: 'changed',
          breakpoint: {
            ...(id !== undefined ? { id } : {}),
            verified: false,
            line: match.breakpoint.line,
            source: { path: match.path },
            message: error.text
          }
        }
      };
      this.emit('childEvent', event);
    }
  }

  /**
   * The policy the program target's connection runs: no in-session adoption,
   * no child routing, and every process the adapter reports on it read as a
   * child report (issue #1082) that wireChildEvents relays to the root
   * connection's holder, unanswered.
   */
  private buildChildSafePolicy(): AdapterPolicy {
    return createChildSafePolicy(this.policy);
  }

  /**
   * Bound a step with its own timer (used to cap attach attempts at the
   * remaining total deadline regardless of per-request timeouts)
   */
  private withTimeout<T>(step: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      step.then(
        value => {
          clearTimeout(timer);
          resolve(value);
        },
        err => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  /**
   * Handle post-attach initialization (some adapters emit another 'initialized').
   * `initializedBaseline` is the latch count snapshotted before the attach
   * request was sent, so an event that raced the attach response still counts.
   */
  private async handlePostAttachInit(child: MinimalDapClient, initializedBaseline: number): Promise<void> {
    // Wait briefly for a post-attach initialized event
    const sawPostInit = await this.waitForChildInitialized(child, initializedBaseline, 3000, false);
    
    if (sawPostInit && this.dapBehavior.mirrorBreakpointsToChild) {
      // Re-send configuration after post-attach initialized
      try {
        await child.sendRequest('setExceptionBreakpoints', {
          filters: resolveExceptionFilters(this.policy, this.exceptionBreakMode)
        });
      } catch {}
      
      for (const [srcPath, bps] of this.storedBreakpoints) {
        try {
          const resp = await this.sendChildSetBreakpoints(child, srcPath, bps);
          this.emitBreakpointResults(srcPath, bps, resp);
        } catch {}
      }
    }
  }

  /**
   * Ensure child is stopped (for adapters that require it)
   */
  private async ensureChildStopped(child: MinimalDapClient): Promise<void> {
    // The entry stop may have fired while earlier adoption steps ran (e.g.
    // during the CDP bridge attach, issue #295) — waiting for a fresh event
    // would stall the full 15s against a target that is already paused.
    if (this.sawChildStop) {
      logger.info(`[ChildSessionManager:${this.instanceId}] child already reported a stop; skipping entry-stop wait`);
      return;
    }
    // Wait for stopped event
    const stopped = await this.waitForEvent(child, 'stopped', 15000, false);
    
    if (!stopped) {
      // Try to pause the first thread
      try {
        const threadsResp = await child.sendRequest<DebugProtocol.ThreadsResponse>('threads', {}, 5000);
        const threads = threadsResp?.body?.threads;
        
        if (Array.isArray(threads) && threads.length > 0) {
          const threadId = threads[0].id;
          logger.info(`[child] Pausing thread ${threadId}`);
          
          try {
            await child.sendRequest('pause', { threadId }, 5000);
          } catch {
            // Ignore pause errors
          }

          // For js-debug quirk: also try threadId 1 if we got 0
          if (threadId === 0) {
            try {
              await child.sendRequest('pause', { threadId: 1 }, 5000);
            } catch {}
          }
        }
      } catch {
        logger.warn('[child] Could not retrieve threads for pause');
      }
    }
  }

  /**
   * Wire child events to forward to parent
   */
  private wireChildEvents(child: MinimalDapClient): void {
    // A fork is reported on the program target's connection, i.e. on this
    // child (issue #1082): relay the held request, with the connection it
    // must be answered on, for the root client to hand to the worker.
    child.on('child-report', (held: { request: DebugProtocol.Request; report: ChildReport }) => {
      this.emit('childReport', { request: held.request, report: held.report, client: child });
    });

    child.on('event', (evt: DebugProtocol.Event) => {
      if (evt.event === 'stopped') {
        this.sawChildStop = true;
      }
      if (evt.event === 'initialized') {
        this.childInitializedCount++;
      }
      const bridge = this.cdpBridge;
      if (!bridge) {
        // Forward child events through parent
        this.emit('childEvent', evt);
        return;
      }
      // Serialize through the chain so a stopped event the bridge holds
      // (bind/correlation window) keeps its place in the event order. Every
      // event first waits for the adoption's bridge attach to settle (issue
      // #850); not on adoptionInProgress, which flushEvents() below awaits
      // through this very chain.
      this.childEventChain = this.childEventChain.then(async () => {
        await this.bridgeAttachSettled;
        let out = evt;
        if (evt.event === 'stopped') {
          // An entry stop always goes through the bridge: with nothing armed
          // it can still be a late entry inside a function (issue #858).
          const reason = (evt.body as { reason?: string } | undefined)?.reason;
          if (bridge.hasArmedOrPending() || reason === 'entry') {
            try {
              out = await bridge.processStoppedEvent(evt);
            } catch (err) {
              logger.warn(`[ChildSessionManager:${this.instanceId}] bridge stop processing failed, forwarding original: ${String(err)}`);
            }
          } else {
            logger.info(`[ChildSessionManager:${this.instanceId}] stopped event bypassed the CDP bridge (no armed or pending function breakpoints)`);
          }
        }
        this.emit('childEvent', out);
      });
    });

    child.on('error', (err: Error) => {
      logger.error('[child] DAP client error:', err);
      this.emit('childError', null, err);
    });

    child.on('close', () => {
      logger.info(`[ChildSessionManager:${this.instanceId}] [child] DAP client connection closed (current count=${this.childSessions.size})`);
      this.cdpBridge?.detach();
      this.emit('childClosed');
      this.childSessions.clear();
      this.activeChild = null;
      this.childEnded = true;
      logger.info(`[ChildSessionManager:${this.instanceId}] *** ACTIVE CHILD CLEARED *** (child closed) at timestamp ${Date.now()}`);
    });
  }

  /**
   * Wait until the child has emitted more 'initialized' events than
   * `baseline`. The count is latched in wireChildEvents from connect time, so
   * an event delivered in the same socket chunk as a request's response —
   * dispatched before the response's awaiter could register a listener — is
   * not lost (issue #529; same shape as the #515 init-ACK latch). The latch
   * check and waitForEvent's listener registration share one synchronous
   * frame, so no event can slip between them.
   */
  private waitForChildInitialized(
    child: MinimalDapClient,
    baseline: number,
    timeoutMs: number,
    required: boolean = true
  ): Promise<boolean> {
    if (this.childInitializedCount > baseline) {
      logger.info(`[ChildSessionManager:${this.instanceId}] 'initialized' already latched (count=${this.childInitializedCount}); skipping wait`);
      return Promise.resolve(true);
    }
    return this.waitForEvent(child, 'initialized', timeoutMs, required);
  }

  /**
   * Wait for a specific event with timeout
   */
  private waitForEvent(
    client: MinimalDapClient,
    eventName: string,
    timeoutMs: number,
    required: boolean = true
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let done = false;

      const settle = (value: boolean) => {
        if (done) return;
        done = true;
        client.off('event', onEvent);
        client.off('close', onDeath);
        client.off('error', onDeath);
        clearTimeout(timer);
        resolve(value);
      };

      const onEvent = (evt: DebugProtocol.Event) => {
        if (evt && evt.event === eventName) {
          settle(true);
        }
      };

      // Don't wait out the timer against a dead client (issue #248)
      const onDeath = () => {
        settle(false);
      };

      const timer = setTimeout(() => {
        if (required && !done) {
          logger.warn(`Timeout waiting for '${eventName}' event`);
        }
        settle(false);
      }, timeoutMs);

      client.on('event', onEvent);
      client.on('close', onDeath);
      client.on('error', onDeath);
    });
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown all child sessions
   */
  async shutdown(): Promise<void> {
    logger.info(`[ChildSessionManager:${this.instanceId}] Shutting down child sessions`);
    this.cdpBridge?.detach();

    for (const [id, child] of this.childSessions) {
      try {
        child.shutdown('parent shutdown');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.warn(`Error shutting down child ${id}: ${msg}`);
      }
    }
    
    this.childSessions.clear();
    this.activeChild = null;
    this.childEnded = false;
    this.adoptedTargets.clear();
    this.storedBreakpoints.clear();
  }
}
