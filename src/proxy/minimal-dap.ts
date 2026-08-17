/**
 * MinimalDapClient - Lightweight DAP client for communicating with debug adapters
 * over TCP sockets using the Debug Adapter Protocol wire format.
 */

import net, { Socket } from 'net';
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import { createLogger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import {
  AdapterPolicy,
  DefaultAdapterPolicy,
  DapClientBehavior,
  DapClientContext,
  ChildSessionConfig,
  sanitizePayloadForLogging
} from '@debugmcp/shared';
import { ChildSessionManager, type ChildSessionOptions } from './child-session-manager.js';
import { getErrorMessage } from '../errors/debug-errors.js';
import { DapFrameDecoder, encodeDapMessage } from './dap-framing.js';

const logger = createLogger('minimal-dap-simple');

type MinimalDapClientOptions = {
  childSessionManagerFactory?: (options: ChildSessionOptions) => ChildSessionManager;
  timers?: {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  };
};

export class MinimalDapClient extends EventEmitter {
  private socket: Socket | null = null;
  private decoder = new DapFrameDecoder({
    onError: (error, context) => {
      if (context === 'header') {
        logger.warn('[MinimalDapClient] Invalid Content-Length header encountered; discarding payload');
      } else {
        logger.error('[MinimalDapClient] Error parsing message:', error);
      }
    }
  });
  private pendingRequests = new Map<number, {
    resolve: (response: DebugProtocol.Response) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  private nextSeq = 1;
  private isDisconnectingOrDisconnected = false;
  private host: string;
  private port: number;
  private traceFile?: string = process.env.DAP_TRACE_FILE;
  private adoptedTargets = new Set<string>();
  private childSessions = new Map<string, MinimalDapClient>();
  private activeChild: MinimalDapClient | null = null;

  // Arguments of the last 'launch'/'attach' request sent through this client.
  // Used to thread the caller's intent (attach mode, stopOnEntry) into child
  // session creation — the adapter does not echo these fields (issue #124).
  private lastStartRequestArgs: Record<string, unknown> | null = null;

  // Adapter policy and DAP behavior configuration
  private policy: AdapterPolicy;
  private dapBehavior: DapClientBehavior;
  private childSessionManager?: ChildSessionManager;

  private readonly timers: {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  };

  constructor(host: string, port: number, policy?: AdapterPolicy, options?: MinimalDapClientOptions) {
    super();
    this.host = host;
    this.port = port;
    this.policy = policy || DefaultAdapterPolicy;
    this.dapBehavior = this.policy.getDapClientBehavior();
    this.timers = options?.timers ?? {
      setTimeout,
      clearTimeout
    };
    // Initialize ChildSessionManager for policies that support child sessions
    if (this.policy.supportsReverseStartDebugging) {
      const createChildSessionManager =
        options?.childSessionManagerFactory ??
        ((opts: ChildSessionOptions) => new ChildSessionManager(opts));

      this.childSessionManager = createChildSessionManager({
        policy: this.policy,
        host,
        port
      });
      
      // Wire up events from ChildSessionManager
      this.childSessionManager.on('childCreated', (pendingId, child) => {
        logger.info(`[MinimalDapClient] childCreated event: Setting activeChild for ${pendingId}`);
        this.childSessions.set(pendingId, child as MinimalDapClient);
        this.activeChild = child as MinimalDapClient;
      });
      
      this.childSessionManager.on('childEvent', (evt: DebugProtocol.Event) => {
        // Forward child events
        this.emit(evt.event, evt.body);
        this.emit('event', evt);
      });
      
      this.childSessionManager.on('childError', (_pendingId, error) => {
        logger.error('[MinimalDapClient] Child session error:', error);
      });

      this.childSessionManager.on('childClosed', () => {
        logger.info(`[MinimalDapClient] childClosed event: Clearing activeChild`);
        this.childSessions.clear();
        this.activeChild = null;
      });
    }
  }

  /**
   * Record the session's break-on-exception mode and propagate it to the
   * child-session manager so child sessions arm the same exception filters
   * (issue #220).
   */
  setExceptionBreakMode(mode: 'uncaught' | 'all' | 'none'): void {
    this.childSessionManager?.setExceptionBreakMode(mode);
  }

  /**
   * Resolves once all child events enqueued so far (output included) have
   * been forwarded to this client's listeners (issue #366). Returns
   * undefined for adapters without child sessions so callers can skip the
   * flush-and-settle entirely (issue #378) — every adapter shares this
   * client class, so the method's mere presence says nothing.
   */
  flushChildEvents(): Promise<void> | undefined {
    return this.childSessionManager?.flushEvents();
  }

  /**
   * Handle raw data using the same algorithm as vscode's ProtocolServer
   * (extracted to DapFrameDecoder). This ensures compatibility and proper
   * message boundaries.
   */
  private handleData(data: Buffer): void {
    for (const msg of this.decoder.push(data)) {
      void this.handleProtocolMessage(msg);
    }
  }

  private async handleProtocolMessage(message: DebugProtocol.ProtocolMessage): Promise<void> {
    this.appendTrace('in', message);
    const debugInfo: Record<string, unknown> = {
      type: message.type,
      seq: message.seq
    };
    
    // Add command if it's a request or response
    if (message.type === 'request' || message.type === 'response') {
      debugInfo.command = (message as DebugProtocol.Request | DebugProtocol.Response).command;
    }
    
    // Add event if it's an event
    if (message.type === 'event') {
      debugInfo.event = (message as DebugProtocol.Event).event;
    }
    
    // Log all incoming DAP messages
    logger.info(`[MinimalDapClient] DAP message: ${message.type}`, debugInfo);
    if (message.type === 'request') {
      const req = message as DebugProtocol.Request;
      logger.info(`[MinimalDapClient] Reverse request: ${req.command}`, {
        command: req.command,
        seq: req.seq,
        // Sanitized: js-debug's startDebugging carries a child launch
        // configuration that can include the debuggee's full environment
        arguments: sanitizePayloadForLogging(req.arguments)
      });
    } else if (message.type === 'event') {
      const evt = message as DebugProtocol.Event;
      logger.info(`[MinimalDapClient] Event: ${evt.event}`, {
        event: evt.event,
        body: evt.body
      });
    }
    
    logger.debug(`[MinimalDapClient] Received message:`, debugInfo);
    
    if (message.type === 'response') {
      const response = message as DebugProtocol.Response;
      const pending = this.pendingRequests.get(response.request_seq);
      
      if (pending) {
        this.timers.clearTimeout(pending.timer);
        this.pendingRequests.delete(response.request_seq);
        
        if (response.success) {
          pending.resolve(response);
        } else {
          pending.reject(new Error(response.message || 'Request failed'));
        }
      } else {
        if (this.isDisconnectingOrDisconnected) {
          logger.debug(`[MinimalDapClient] Received response for unknown request ${response.request_seq} during shutdown`);
        } else {
          logger.warn(`[MinimalDapClient] Received response for unknown request ${response.request_seq}`);
        }
      }
    } else if (message.type === 'event') {
      const event = message as DebugProtocol.Event;
      logger.info(`[MinimalDapClient] Received event: ${event.event}`);
      // Do not auto-send configurationDone on 'initialized'; defer to higher-level sequencing/policy.
      // This avoids premature resume and double-config in multi-session adapters like js-debug.
      // Emit both the specific event and the generic event for backward compatibility
      this.emit(event.event, event.body);
      this.emit('event', event);
    } else if (message.type === 'request') {
      const request = message as DebugProtocol.Request;
      logger.info(`[MinimalDapClient] Received adapter request: ${request.command}`);
      
      // Try to handle through policy's reverse request handler
      if (this.dapBehavior.handleReverseRequest) {
        try {
          const context: DapClientContext = {
            sendResponse: (req: DebugProtocol.Request, body: unknown, success?: boolean, errorMessage?: string) => {
              this.sendResponse(req, body, success ?? true, errorMessage);
            },
            createChildSession: async (config: ChildSessionConfig) => {
              if (this.childSessionManager) {
                await this.childSessionManager.createChildSession(this.enrichChildConfig(config));
                // Update active child reference from manager
                this.activeChild = this.childSessionManager.getActiveChild();
              }
            },
            activeChildren: this.childSessions as Map<string, unknown>,
            adoptedTargets: this.adoptedTargets
          };
          
          const result = await this.dapBehavior.handleReverseRequest(request, context);
          
          if (result.handled) {
            // Policy handled the request
            if (result.createChildSession && this.childSessionManager && result.childConfig) {
              // Create child session through the manager
              logger.info(`[MinimalDapClient] Creating child session via ChildSessionManager`);
              try {
                await this.childSessionManager.createChildSession(this.enrichChildConfig(result.childConfig));

                // Update active child reference from manager
                this.activeChild = this.childSessionManager.getActiveChild();
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error(`[MinimalDapClient] Failed to create child session: ${msg}`);
                // The policy adds the pending target to adoptedTargets before
                // adoption runs; roll that back so a re-sent startDebugging
                // for the same target can retry instead of silently no-oping
                // against a session with no debuggable child (issue #249)
                const failedPendingId = result.childConfig.pendingId;
                if (typeof failedPendingId === 'string') {
                  this.adoptedTargets.delete(failedPendingId);
                }
              }
            }
            return;
          }
        } catch (e) {
          const err = getErrorMessage(e);
          logger.error(`[MinimalDapClient] Error in policy reverse request handler: ${err}`);
        }
      }
      
      // Default handling for unhandled reverse requests
      try {
        switch (request.command) {
          case 'runInTerminal':
            // Acknowledge without spawning a terminal (internalConsole launch path).
            this.sendResponse(request, {});
            break;
          default:
            // For unrecognized adapter requests, reply success with empty body to avoid deadlocks.
            this.sendResponse(request, {});
            break;
        }
      } catch (e) {
          const err = getErrorMessage(e);
        logger.error(`[MinimalDapClient] Error handling adapter request '${request.command}': ${err}`);
        this.sendResponse(request, {});
      }
    }
  }

  private appendTrace(direction: 'in' | 'out', payload: unknown): void {
    if (!this.traceFile) return;
    try {
      fs.appendFileSync(
        this.traceFile,
        // env objects are redacted: the trace file persists next to the logs
        // and the launch request embeds the debuggee's full environment
        JSON.stringify({ ts: new Date().toISOString(), direction, payload: sanitizePayloadForLogging(payload) }) + '\n',
        'utf8'
      );
    } catch {
      // ignore trace errors
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timers.setTimeout(resolve, ms);
    });
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info(`[MinimalDapClient] Connecting to ${this.host}:${this.port}`);
      
      let connected = false;
      let connectionRejected = false;
      
      // Use net.createConnection for test compatibility
      this.socket = net.createConnection({ host: this.host, port: this.port }, () => {
        logger.info(`[MinimalDapClient] Connected to ${this.host}:${this.port}`);
        connected = true;
        resolve();
      });
      
      // Set up all handlers immediately
      this.socket.on('data', (data: Buffer) => {
        this.handleData(data);
      });
      
      this.socket.on('error', (err) => {
        logger.error('[MinimalDapClient] Socket error:', err);

        // After shutdown, all listeners are stripped — emitting 'error' would
        // crash the child process with an uncaught exception. Bail out early.
        if (this.isDisconnectingOrDisconnected) return;

        // Only emit error events after successful connection
        // During connection, just reject the promise
        if (connected) {
          this.emit('error', err);
        } else if (!connectionRejected) {
          connectionRejected = true;
          reject(err);
        }
      });
      
      this.socket.on('close', () => {
        logger.info('[MinimalDapClient] Socket closed');
        this.emit('close');
        this.cleanup();
        
        // If we never connected and haven't rejected yet, reject now
        if (!connected && !connectionRejected) {
          connectionRejected = true;
          reject(new Error('Socket closed before connection established'));
        }
      });
    });
  }

  /**
   * Thread the caller's attach intent into a child session config. js-debug's
   * reverse startDebugging configuration only carries
   * {type, name, __pendingTargetId}: without this, ChildSessionManager cannot
   * distinguish attach-mode children from launch-mode children, nor see
   * whether the user asked for an entry stop (issue #124). Launch-mode
   * configs are returned unchanged.
   */
  private enrichChildConfig(config: ChildSessionConfig): ChildSessionConfig {
    const start = this.lastStartRequestArgs;
    if (!start || start.request !== 'attach') {
      return config;
    }
    const parentConfig: Record<string, unknown> = {
      ...(config.parentConfig ?? {}),
      request: 'attach'
    };
    if (typeof start.stopOnEntry === 'boolean') {
      parentConfig.stopOnEntry = start.stopOnEntry;
    }
    return { ...config, parentConfig };
  }

  public async sendRequest<T extends DebugProtocol.Response>(
    command: string,
    args?: unknown,
    timeoutMs: number = 30000
  ): Promise<T> {
    if (!this.socket || this.socket.destroyed) {
      throw new Error('Socket not connected or destroyed');
    }
    
    if (this.isDisconnectingOrDisconnected) {
      throw new Error('Client is disconnecting or disconnected');
    }

    // Remember the parent's start request so child session creation can see
    // the caller's intent: js-debug's reverse startDebugging configuration
    // only carries {type, name, __pendingTargetId} — request mode and
    // stopOnEntry never round-trip through the adapter (issue #124).
    if (command === 'attach' || command === 'launch') {
      this.lastStartRequestArgs = {
        ...((args as Record<string, unknown> | undefined) ?? {}),
        request: command
      };
    }

    // CDP-delivered function breakpoints (issue #295): the adapter has no
    // setFunctionBreakpoints handler at all, so the request must never reach
    // any DAP socket — the ChildSessionManager's CDP bridge owns the feature
    // and synthesizes the authoritative response.
    if (command === 'setFunctionBreakpoints' && this.policy?.functionBreakpointsVia === 'cdp' && this.childSessionManager) {
      const fnArgs = (args as DebugProtocol.SetFunctionBreakpointsArguments | undefined) ?? { breakpoints: [] };
      const body = await this.childSessionManager.syncFunctionBreakpoints(fnArgs.breakpoints ?? []);
      const synthetic: DebugProtocol.Response = {
        type: 'response',
        seq: this.nextSeq++,
        request_seq: -1,
        command,
        success: true,
        body
      };
      return synthetic as T;
    }

    // Route debuggee-scoped requests to active child session when present using policy
    const manager = this.childSessionManager;
    const shouldRouteToChild = manager?.shouldRouteToChild(command) ?? false;

    if (shouldRouteToChild) {
      const hasActiveChild = manager?.hasActiveChildren?.() ?? false;
      const adoptionInProgress =
        typeof manager?.isAdoptionInProgress === 'function'
          ? manager.isAdoptionInProgress()
          : false;
      logger.info(
        `[MinimalDapClient] Routing '${command}' to child session (hasActiveChild=${hasActiveChild}, adoptionInProgress=${adoptionInProgress})`
      );

      // Special handling for stackTrace when child isn't ready yet.
      // Policies can opt-in to waiting for a child session instead of falling back immediately.
      const stackTraceRequiresChild = this.dapBehavior.stackTraceRequiresChild === true;
      if (command === 'stackTrace' && !this.activeChild) {
        const expectChild =
          stackTraceRequiresChild || adoptionInProgress || hasActiveChild;

        if (expectChild) {
          logger.info(
            `[MinimalDapClient] stackTrace requested while child not ready - waiting for child session (policy=${this.policy?.name}, requiresChild=${stackTraceRequiresChild}, adoptionInProgress=${adoptionInProgress}, hasActiveChild=${hasActiveChild})`
          );

          const maxWaitMs = this.dapBehavior.childInitTimeout ?? 12000;
          const pollIntervalMs = 50;
          const maxIterations = maxWaitMs / pollIntervalMs;

          for (let i = 0; i < maxIterations && !this.activeChild; i++) {
            await this.sleep(pollIntervalMs);
            this.activeChild = manager?.getActiveChild() || null;

            if (i % 10 === 0 && i > 0) {
              const elapsedMs = i * pollIntervalMs;
              const stillAdopting = manager?.isAdoptionInProgress() ?? false;
              logger.info(
                `[MinimalDapClient] stackTrace wait ${elapsedMs}ms: activeChild=${!!this.activeChild}, adoptionInProgress=${stillAdopting}`
              );
            }
          }

          if (!this.activeChild) {
            logger.warn(
              `[MinimalDapClient] stackTrace: Child still not ready after ${maxWaitMs}ms wait`
            );
            if (stackTraceRequiresChild) {
              const syntheticFailure: DebugProtocol.Response = {
                type: 'response',
                seq: this.nextSeq++,
                request_seq: -1,
                command,
                success: false,
                message: `Child session not ready for '${command}' after waiting ${maxWaitMs}ms`
              };
              return syntheticFailure as T;
            }
          } else {
            logger.info('[MinimalDapClient] Child session now ready for stackTrace');
          }
        }
      } else if (!this.activeChild && manager?.hasActiveChildren()) {
        // For other commands, wait longer if needed
        logger.info(`[MinimalDapClient] Waiting for active child before routing '${command}'`);
        for (let i = 0; i < 120 && !this.activeChild; i++) {
          await this.sleep(100); // up to ~12s
          this.activeChild = manager.getActiveChild();
        }
      }
      
      if (this.activeChild) {
        try {
          logger.info(`[MinimalDapClient] Dispatching '${command}' to child session`);
          return await this.activeChild.sendRequest<T>(command, args as unknown, timeoutMs);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const treatAsGracefulCompletion =
            command === 'continue' || command === 'disconnect' || command === 'terminate';
          if (
            message.includes('DAP client disconnected') ||
            message.includes('Socket not connected') ||
            message.includes('write after end')
          ) {
            logger.warn(`[MinimalDapClient] Child session unavailable for '${command}' (${message}); falling back to parent session.`);
            if (treatAsGracefulCompletion) {
              const syntheticResponse = {
                type: 'response',
                seq: this.nextSeq++,
                request_seq: -1,
                command,
                success: true
              } as DebugProtocol.Response;
              return syntheticResponse as T;
            }
          } else {
            throw err;
          }
        }
      } else if (command === 'stackTrace') {
        logger.warn(`[MinimalDapClient] No active child for stackTrace - attempting parent session (may return empty)`);
        // Fall through to send to parent session
      } else {
        logger.warn(`[MinimalDapClient] No active child available for routed command '${command}'. Forwarding to parent session (may return empty/unsupported).`);
      }
    } else {
      const hasActiveChild = this.childSessionManager?.hasActiveChildren?.() ?? false;
      const adoptionInProgress =
        typeof this.childSessionManager?.isAdoptionInProgress === 'function'
          ? this.childSessionManager.isAdoptionInProgress()
          : false;
      logger.info(
        `[MinimalDapClient] Keeping '${command}' on parent session (hasActiveChild=${hasActiveChild}, adoptionInProgress=${adoptionInProgress})`
      );
    }
    
    // Track and mirror setBreakpoints to child if/when present using ChildSessionManager
    if (command === 'setBreakpoints' && this.childSessionManager) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a: any = args ?? {};
        const sp: string | undefined = a?.source?.path;
        const bps: DebugProtocol.SourceBreakpoint[] | undefined = a?.breakpoints;
        if (typeof sp === 'string' && Array.isArray(bps)) {
          const absolutePath = path.isAbsolute(sp) ? sp : path.resolve(sp);
          // Store breakpoints in ChildSessionManager for mirroring
          this.childSessionManager.storeBreakpoints(absolutePath, bps);
        }
      } catch {
        // ignore tracking errors
      }
    }
    

    const requestSeq = this.nextSeq++;
    
    // Normalize initialize args using policy
    if (command === 'initialize' && this.dapBehavior.normalizeAdapterId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a: any = args && typeof args === 'object' ? { ...(args as Record<string, unknown>) } : {};
        if (typeof a.adapterID === 'string') {
          const normalized = this.dapBehavior.normalizeAdapterId(a.adapterID);
          if (normalized !== a.adapterID) {
            a.adapterID = normalized;
            args = a;
            logger.info(`[MinimalDapClient] Normalized initialize.adapterID -> ${normalized}`);
          }
        }
      } catch {
        // ignore normalization errors
      }
    }

    const request: DebugProtocol.Request = {
      seq: requestSeq,
      type: 'request',
      command: command,
      arguments: args
    };
    
    logger.info(`[MinimalDapClient] Sending request:`, {
      command,
      seq: requestSeq,
      // Sanitized: 'launch'/'attach' args carry the debuggee's full environment
      args: sanitizePayloadForLogging(args || {})
    });
    
    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timer = this.timers.setTimeout(() => {
        if (this.pendingRequests.has(requestSeq)) {
          this.pendingRequests.delete(requestSeq);
          reject(new Error(`DAP request '${command}' (seq ${requestSeq}) timed out`));
        }
      }, timeoutMs);
      
      // Store pending request
      this.pendingRequests.set(requestSeq, {
        resolve: resolve as (value: DebugProtocol.Response) => void,
        reject,
        timer
      });
      
      // Send the request
      this.appendTrace('out', request);
      const message = encodeDapMessage(request);

      // Socket was already checked above, but TypeScript needs reassurance
      if (!this.socket) {
        this.timers.clearTimeout(timer);
        this.pendingRequests.delete(requestSeq);
        reject(new Error('Socket unexpectedly null'));
        return;
      }
      
      this.socket.write(message, (err) => {
        if (err) {
          this.timers.clearTimeout(timer);
          this.pendingRequests.delete(requestSeq);
          reject(err);
        }
      });
    });
  }

  private writeMessage(message: DebugProtocol.ProtocolMessage): void {
    const payload = encodeDapMessage(message);
    this.appendTrace('out', message);
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(payload);
    } else {
      logger.error('[MinimalDapClient] Cannot write message, socket not connected/destroyed');
    }
  }

  private sendResponse(request: DebugProtocol.Request, body: unknown = {}, success: boolean = true, errorMessage?: string): void {
    const response: DebugProtocol.Response = {
      type: 'response',
      seq: this.nextSeq++,
      request_seq: request.seq,
      command: request.command,
      success,
      ...(success ? { body } : { message: errorMessage || 'Request failed' })
    };
    this.writeMessage(response);
  }

  public disconnect(): void {
    this.shutdown('Client disconnect requested');
  }

  public shutdown(reason: string = 'shutdown'): void {
    if (this.isDisconnectingOrDisconnected) {
      logger.debug('[MinimalDapClient] Already disconnecting or disconnected');
      return;
    }
    
    this.isDisconnectingOrDisconnected = true;
    logger.info(`[MinimalDapClient] Shutting down: ${reason}`);
    
    // Shutdown any child sessions
    try {
      for (const child of this.childSessions.values()) {
        try {
          child.shutdown('parent shutdown');
        } catch (e) {
          const emsg = getErrorMessage(e);
          logger.warn('[MinimalDapClient] Error shutting down child sessions:', emsg);
        }
      }
    } finally {
      this.childSessions.clear();
      this.activeChild = null;
      this.adoptedTargets.clear();
    }

    // Also shut down the manager's own registry: it tracks children from the
    // moment adoption starts, so this reaches mid-adoption sockets that were
    // never promoted into this.childSessions via childCreated (issue #248)
    try {
      void this.childSessionManager?.shutdown().catch(() => {});
    } catch (e) {
      logger.warn('[MinimalDapClient] Error shutting down child session manager:', getErrorMessage(e));
    }

    // Use immediate cleanup when explicitly shutting down
    this.cleanup(true);
    
    // Close socket
    if (this.socket && !this.socket.destroyed) {
      this.socket.end();
      this.socket.destroy();
    }
  }

  private cleanup(immediate: boolean = false): void {
    // Clear all pending requests
    this.pendingRequests.forEach((pending) => {
      this.timers.clearTimeout(pending.timer);
      pending.reject(new Error('DAP client disconnected'));
    });
    this.pendingRequests.clear();
    
    // Clear buffer to free memory
    this.decoder.reset();
    
    // Remove all listeners to prevent memory leaks
    if (immediate) {
      this.removeAllListeners();
    } else {
      // Use setTimeout(0) to allow any pending emit operations to complete
      this.timers.setTimeout(() => {
        this.removeAllListeners();
      }, 0);
    }
  }
}
