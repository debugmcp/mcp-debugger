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
import type { AdapterPolicy, ExceptionBreakMode } from '@debugmcp/shared';
import type { DapClientBehavior, ChildSessionConfig } from '@debugmcp/shared';
import { resolveExceptionFilters } from '@debugmcp/shared';
import { createLogger } from '../utils/logger.js';
import type { MinimalDapClient } from './minimal-dap.js';
import { CdpFunctionBreakpointBridge } from './cdp-function-breakpoint-bridge.js';
import path from 'path';

const logger = createLogger('child-session-manager');

function createInstanceId(): string {
  return randomBytes(4).toString('hex');
}

function createChildSafePolicy(policy: AdapterPolicy): AdapterPolicy {
  if (!policy.supportsReverseStartDebugging) {
    return policy;
  }

  return {
    ...policy,
    supportsReverseStartDebugging: false,
    childSessionStrategy: 'none',
    getDapClientBehavior: (): DapClientBehavior => {
      const baseBehavior = policy.getDapClientBehavior();
      const behavior: DapClientBehavior = {
        ...baseBehavior,
        childRoutedCommands: new Set<string>(),
        mirrorBreakpointsToChild: false,
        pauseAfterChildAttach: false,
        stackTraceRequiresChild: false,
      };

      if (baseBehavior.handleReverseRequest) {
        behavior.handleReverseRequest = async (request, context) => {
          const result = await baseBehavior.handleReverseRequest!(request, context);
          if (!result.handled) {
            return result;
          }
          // Do not spawn grandchildren; acknowledge and stop.
          return { handled: true };
        };
      }

      return behavior;
    },
  };
}

export interface ChildSessionOptions {
  policy: AdapterPolicy;
  host: string;
  port: number;
  /** DI seam for tests; only consulted when the policy delivers function breakpoints via CDP (issue #295). */
  cdpBridgeFactory?: () => CdpFunctionBreakpointBridge;
}

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
  private readonly instanceId: string;

  // CDP-delivered function breakpoints (issue #295); present only when the
  // policy declares functionBreakpointsVia 'cdp' (js-debug)
  private cdpBridge: CdpFunctionBreakpointBridge | null = null;
  // Serializes child event forwarding so a stopped event held by the bridge
  // (correlation/bind window) cannot be overtaken by later events
  private childEventChain: Promise<void> = Promise.resolve();

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
    this.instanceId = createInstanceId();
    if (options.policy.functionBreakpointsVia === 'cdp') {
      this.cdpBridge = options.cdpBridgeFactory?.() ?? new CdpFunctionBreakpointBridge();
      this.cdpBridge.on('breakpointEvent', (evt: DebugProtocol.Event) => {
        this.emit('childEvent', evt);
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
   * Store breakpoints for mirroring to child sessions
   */
  storeBreakpoints(sourcePath: string, breakpoints: DebugProtocol.SourceBreakpoint[]): void {
    if (!this.dapBehavior.mirrorBreakpointsToChild) {
      return;
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
    if (this.activeChild) {
      void this.activeChild.sendRequest<DebugProtocol.SetBreakpointsResponse>('setBreakpoints', {
        source: { path: absolutePath },
        breakpoints
      }).then(resp => {
        this.emitBreakpointResults(absolutePath, breakpoints, resp);
      }).catch(() => {
        // Ignore errors when mirroring
      });
    }
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
    if (!Array.isArray(bps)) {
      return;
    }
    bps.forEach((bp, i) => {
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
   * Create and configure a child session
   */
  async createChildSession(config: ChildSessionConfig): Promise<void> {
    const { pendingId, parentConfig } = config;
    
    // Check if already adopted
    if (this.adoptedTargets.has(pendingId)) {
      logger.warn(`Pending target ${pendingId} already adopted`);
      return;
    }
    
    // Check if adoption is in progress or we already have a child
    if (this.adoptionInProgress || this.hasActiveChildren()) {
      logger.info(`[ChildSessionManager:${this.instanceId}] Ignoring child session request; adoption in progress or child active`, {
        adoptionInProgress: this.adoptionInProgress,
        hasActiveChild: !!this.activeChild,
        childSessionCount: this.childSessions.size
      });
      return;
    }
    
    this.adoptionInProgress = true;
    logger.info(`[ChildSessionManager:${this.instanceId}] Setting adoptionInProgress = true for ${pendingId}`);
    this.adoptedTargets.add(pendingId);

    let child: MinimalDapClient | null = null;
    let death: ChildDeathLatch | null = null;
    try {
      // Import MinimalDapClient dynamically to avoid circular dependency
      const { MinimalDapClient } = await import('./minimal-dap.js');

      // Create child client with a policy that disables recursive reverse debugging
      const childPolicy = createChildSafePolicy(this.policy);
      child = new MinimalDapClient(this.host, this.port, childPolicy);
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

      // Attach to pending target
      await this.attachChild(child, pendingId, parentConfig, death);

      // Handle post-attach initialization if needed
      await death.race(this.handlePostAttachInit(child));

      // Connect the CDP function-breakpoint bridge BEFORE forcing the entry
      // pause so the proxy's sticky Debugger.paused replay plus a live
      // subscription cover it either way (issue #295). attachToChild never
      // throws by design; death.race can, and a dead child fails adoption in
      // the next step regardless, so log and continue here.
      if (this.cdpBridge) {
        try {
          await death.race(this.cdpBridge.attachToChild(child));
        } catch (err) {
          logger.warn(`[ChildSessionManager:${this.instanceId}] CDP bridge attach aborted: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Ensure initial stop if policy requires it.
      // Skip when the user explicitly requested stopOnEntry=false: forcing a
      // pause contradicts intent and the resulting 'pause'-reason stopped
      // event would not be recognized by the auto-continue trigger.
      // Also skip for attach-mode parents (request === 'attach', threaded in
      // by MinimalDapClient.enrichChildConfig): attach targets emit no entry
      // stop, so waiting for one here only stalls adoption, and the
      // SessionManager already issues and verifies the post-attach pause via
      // the policy's getAttachBehavior().pauseAfterAttach (issue #124).
      const wantsEntryStop = parentConfig?.stopOnEntry !== false;
      const attachModeParent = parentConfig?.request === 'attach';
      if (this.dapBehavior.pauseAfterChildAttach && wantsEntryStop && !attachModeParent) {
        await death.race(this.ensureChildStopped(child));
      }

      this.adoptionInProgress = false;
      logger.info(`[ChildSessionManager:${this.instanceId}] Setting adoptionInProgress = false for ${pendingId} (success)`);

      logger.info(`[ChildSessionManager:${this.instanceId}] Child session created successfully for ${pendingId}`);
      this.emit('childCreated', pendingId, child);

    } catch (error) {
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
      columnsStartAt1: true
    };
    
    logger.info(`[child:${pendingId}] initialize`);
    await child.sendRequest('initialize', initArgs);
    
    // Wait for initialized event
    await this.waitForEvent(child, 'initialized', this.dapBehavior.childInitTimeout || 12000);
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
          const resp = await child.sendRequest<DebugProtocol.SetBreakpointsResponse>('setBreakpoints', {
            source: { path: srcPath },
            breakpoints: bps
          });
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
    death: ChildDeathLatch
  ): Promise<void> {
    const attachArgs = this.policy.buildChildStartArgs(pendingId, parentConfig);

    // Retry logic for attachment, bounded by a total deadline so a live but
    // unresponsive adapter cannot pin the worker for retries x timeout (#248)
    const maxRetries = 20;
    const totalDeadlineMs = 60000;
    const deadline = Date.now() + totalDeadlineMs;
    let adopted = false;
    let lastError: unknown;

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

    if (!adopted) {
      const msg = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(`Failed to attach child after ${maxRetries} attempts or ${totalDeadlineMs}ms deadline: ${msg}`);
    }
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
   * Handle post-attach initialization (some adapters emit another 'initialized')
   */
  private async handlePostAttachInit(child: MinimalDapClient): Promise<void> {
    // Wait briefly for a post-attach initialized event
    const sawPostInit = await this.waitForEvent(child, 'initialized', 3000, false);
    
    if (sawPostInit && this.dapBehavior.mirrorBreakpointsToChild) {
      // Re-send configuration after post-attach initialized
      try {
        await child.sendRequest('setExceptionBreakpoints', {
          filters: resolveExceptionFilters(this.policy, this.exceptionBreakMode)
        });
      } catch {}
      
      for (const [srcPath, bps] of this.storedBreakpoints) {
        try {
          const resp = await child.sendRequest<DebugProtocol.SetBreakpointsResponse>('setBreakpoints', {
            source: { path: srcPath },
            breakpoints: bps
          });
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
    child.on('event', (evt: DebugProtocol.Event) => {
      if (evt.event === 'stopped') {
        this.sawChildStop = true;
      }
      const bridge = this.cdpBridge;
      if (!bridge) {
        // Forward child events through parent
        this.emit('childEvent', evt);
        return;
      }
      // Serialize through the chain so a stopped event the bridge holds
      // (bind/correlation window) keeps its place in the event order
      this.childEventChain = this.childEventChain.then(async () => {
        let out = evt;
        if (evt.event === 'stopped') {
          if (bridge.hasArmedOrPending()) {
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
      logger.info(`[ChildSessionManager:${this.instanceId}] *** ACTIVE CHILD CLEARED *** (child closed) at timestamp ${Date.now()}`);
    });
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
    this.adoptedTargets.clear();
    this.storedBreakpoints.clear();
  }
}
