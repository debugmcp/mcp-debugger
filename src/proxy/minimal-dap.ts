/**
 * Simplified MinimalDapClient using proper buffer management
 * Extracts just the message parsing logic from vscode's implementation
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
  ChildSessionConfig 
} from '@debugmcp/shared';
import { ChildSessionManager, type ChildSessionOptions } from './child-session-manager.js';
import { getErrorMessage } from '../errors/debug-errors.js';

const logger = createLogger('minimal-dap-simple');

type MinimalDapClientOptions = {
  childSessionManagerFactory?: (options: ChildSessionOptions) => ChildSessionManager;
  childClientFactory?: (host: string, port: number, policy: AdapterPolicy) => MinimalDapClient;
  timers?: {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  };
};

const TWO_CRLF = '\r\n\r\n';

function isInitializeResponse(
  response: unknown
): response is { command: string; body?: { capabilities?: Record<string, unknown> } } {
  return (
    response !== null &&
    typeof response === 'object' &&
    'command' in response &&
    (response as { command: unknown }).command === 'initialize'
  );
}

export class MinimalDapClient extends EventEmitter {
  private socket: Socket | null = null;
  private rawData = Buffer.alloc(0);
  private contentLength = -1;
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
  private storedBreakpoints = new Map<string, DebugProtocol.SourceBreakpoint[]>();
  private initializedSeen = false;

  // Adapter policy and DAP behavior configuration
  private policy: AdapterPolicy;
  private dapBehavior: DapClientBehavior;
  private childSessionManager?: ChildSessionManager;

  // When true, we defer parent's configurationDone (policy-driven, e.g. js-debug)
  private deferParentConfigDoneActive = false;

  // Defers parent's configurationDone to keep process paused until child is configured
  private parentConfigDoneDeferred: {
    resolve: (resp: DebugProtocol.Response) => void;
    reject: (err: Error) => void;
    args: unknown;
    timer: NodeJS.Timeout;
  } | null = null;

  // When set, the very next configurationDone send will not be deferred
  private suppressNextConfigDoneDeferral = false;

  // Marks that child configuration is finished
  private childConfigComplete = false;
  // Prevent handling multiple concurrent startDebugging requests (js-debug may send attach+launch)
  private adoptionInProgress = false;
  
  private supportsConfigDone = true;

  private readonly childClientFactory: (host: string, port: number, policy: AdapterPolicy) => MinimalDapClient;
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
    this.childClientFactory =
      options?.childClientFactory ??
      ((childHost: string, childPort: number, policyForChild: AdapterPolicy) =>
        new MinimalDapClient(childHost, childPort, policyForChild, {
          timers: this.timers
        }));
    
    // Initialize ChildSessionManager for policies that support child sessions
    if (this.policy.supportsReverseStartDebugging) {
      const createChildSessionManager =
        options?.childSessionManagerFactory ??
        ((opts: ChildSessionOptions) => new ChildSessionManager(opts));

      this.childSessionManager = createChildSessionManager({
        policy: this.policy,
        parentClient: this,
        host,
        port
      });
      
      // Wire up events from ChildSessionManager
      this.childSessionManager.on('childCreated', (_pendingId, _child) => {
        // Child session created successfully
        void _pendingId;
        void _child;
      });
      
      this.childSessionManager.on('childEvent', (evt: DebugProtocol.Event) => {
        // Forward child events
        this.emit(evt.event, evt.body);
        this.emit('event', evt);
      });
      
      this.childSessionManager.on('childError', (_pendingId, error) => {
        logger.error('[MinimalDapClient] Child session error:', error);
      });
    }
  }

  /**
   * Handle raw data using the same algorithm as vscode's ProtocolServer
   * This ensures compatibility and proper message boundaries
   */
  private handleData(data: Buffer): void {
    this.rawData = Buffer.concat([this.rawData, data]);
    
    while (true) {
      if (this.contentLength >= 0) {
        // We have a content length, check if we have the full message
        if (this.rawData.length >= this.contentLength) {
          const message = this.rawData.toString('utf8', 0, this.contentLength);
          this.rawData = this.rawData.slice(this.contentLength);
          this.contentLength = -1;
          
          // Parse and handle the message
          if (message.length > 0) {
            try {
              const msg = JSON.parse(message) as DebugProtocol.ProtocolMessage;
              void this.handleProtocolMessage(msg);
            } catch (e) {
              logger.error('[MinimalDapClient] Error parsing message:', e);
            }
          }
          continue;
        }
      }
      
      // Look for the header
      const idx = this.rawData.indexOf(TWO_CRLF);
      if (idx === -1) {
        // No complete header yet
        break;
      }
      
      const header = this.rawData.toString('utf8', 0, idx);
      const lines = header.split('\r\n');
      let parsedLength: number | null = null;

      for (const line of lines) {
        if (line.toLowerCase().startsWith('content-length')) {
          const value = line.split(':')[1]?.trim();
          const candidate = Number.parseInt(value ?? '', 10);
          if (!Number.isNaN(candidate)) {
            parsedLength = candidate;
          }
          break;
        }
      }

      // Remove header from buffer
      this.rawData = this.rawData.slice(idx + TWO_CRLF.length);

      if (parsedLength === null || parsedLength <= 0 || !Number.isFinite(parsedLength)) {
        logger.warn('[MinimalDapClient] Invalid Content-Length header encountered; discarding payload');
        this.contentLength = -1;
        this.rawData = Buffer.alloc(0);
        continue;
      }

      this.contentLength = parsedLength;
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
    
    // DIAGNOSTIC: Enhanced logging for ALL messages
    logger.info(`[MinimalDapClient] DAP message: ${message.type}`, debugInfo);
    if (message.type === 'request') {
      const req = message as DebugProtocol.Request;
      logger.info(`[MinimalDapClient] Reverse request: ${req.command}`, {
        command: req.command,
        seq: req.seq,
        arguments: req.arguments
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
          // Cache capabilities from initialize response
          if (response.command === 'initialize' && isInitializeResponse(response)) {
            try {
              const caps = response.body?.capabilities;
              if (caps && typeof caps.supportsConfigurationDoneRequest === 'boolean') {
                this.supportsConfigDone = !!caps.supportsConfigurationDoneRequest;
                logger.info(`[MinimalDapClient] initialize capabilities: supportsConfigurationDoneRequest=${this.supportsConfigDone}`);
              }
            } catch {
              // ignore capability parse errors
            }
          }
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
      if (event.event === 'initialized') {
        this.initializedSeen = true;
        // Do not auto-send configurationDone here; defer to higher-level sequencing/policy
        // This avoids premature resume and double-config in multi-session adapters like js-debug.
      }
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
                await this.childSessionManager.createChildSession(config);
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
                await this.childSessionManager.createChildSession(result.childConfig);
                
                // Set up deferred config if needed
                if (this.dapBehavior.deferParentConfigDone) {
                  this.deferParentConfigDoneActive = true;
                }
                
                // Update active child reference from manager
                this.activeChild = this.childSessionManager.getActiveChild();
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error(`[MinimalDapClient] Failed to create child session: ${msg}`);
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
        JSON.stringify({ ts: new Date().toISOString(), direction, payload }) + '\n',
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

  private async waitInitialized(timeoutMs = 5000): Promise<void> {
    if (this.initializedSeen) return;
    await new Promise<void>((resolve) => {
      let done = false;
      const onInit = () => {
        if (done) return;
        done = true;
        this.removeListener('initialized', onInit);
        resolve();
      };
      const timer = this.timers.setTimeout(() => {
        if (done) return;
        done = true;
        this.removeListener('initialized', onInit);
        resolve();
      }, timeoutMs);
      this.on('initialized', () => {
        this.timers.clearTimeout(timer);
        onInit();
      });
    });
  }

  private flushDeferredParentConfigDone(): void {
    if (this.parentConfigDoneDeferred) {
      const pending = this.parentConfigDoneDeferred;
      this.parentConfigDoneDeferred = null;
      // Ensure we do not defer the parent's configDone again
      this.suppressNextConfigDoneDeferral = true;
      // Send now and wire through the original promise handlers
      void this.sendRequest<DebugProtocol.Response>('configurationDone', pending.args)
        .then(pending.resolve)
        .catch(pending.reject);
    }
  }

  private wireChildEvents(child: MinimalDapClient): void {
    child.on('event', (evt: DebugProtocol.Event) => {
      try {
        // Re-emit child events on this parent client so upstream sees a single stream
        this.emit(evt.event, evt.body);
        this.emit('event', evt);
      } catch (e) {
        logger.warn('[MinimalDapClient] Error forwarding child event:', e);
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    child.on('error', (err: any) => {
      logger.error('[MinimalDapClient] Child DAP client error:', err);
    });
    child.on('close', () => {
      logger.info('[MinimalDapClient] Child DAP client connection closed');
    });
  }

  private async createChildSession(pendingId: string, configuration: Record<string, unknown>, _policy: AdapterPolicy): Promise<void> {
    void _policy;

    if (this.childSessions.has(pendingId)) {
      this.activeChild = this.childSessions.get(pendingId)!;
      return;
    }

    const child = this.childClientFactory(this.host, this.port, this.policy);
    await child.connect();
    this.wireChildEvents(child);
    // Make the child discoverable for routed commands as early as possible
    this.childSessions.set(pendingId, child);
    // Mark child active immediately so debuggee-scoped commands route to the correct session
    this.activeChild = child;

    // 1) initialize
    const initArgs = {
      clientID: `mcp-child-${pendingId}`,
      adapterID: 'pwa-node',
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true
    };
    logger.info(`[MinimalDapClient] [child:${pendingId}] initialize`);
    await child.sendRequest('initialize', initArgs);

    // 2) wait for initialized
    await new Promise<void>((resolve) => {
      let done = false;
      const onEvt = (evt: DebugProtocol.Event) => {
        if (done) return;
        if (evt && evt.event === 'initialized') {
          done = true;
          child.off('event', onEvt);
          this.timers.clearTimeout(timer);
          resolve();
        }
      };
      const timer = this.timers.setTimeout(() => {
        if (done) return;
        done = true;
        child.off('event', onEvt);
        resolve();
      }, 12000);
      child.on('event', onEvt);
    });

    // 3) setExceptionBreakpoints
    try {
      logger.info(`[MinimalDapClient] [child:${pendingId}] setExceptionBreakpoints []`);
      await child.sendRequest('setExceptionBreakpoints', { filters: [] });
    } catch {
      logger.warn(`[MinimalDapClient] [child:${pendingId}] setExceptionBreakpoints failed or not supported`);
    }

    // 4) setBreakpoints for any stored sources
    try {
      for (const [srcPath, bps] of this.storedBreakpoints) {
        const absolutePath = path.isAbsolute(srcPath) ? srcPath : path.resolve(srcPath);
        logger.info(`[MinimalDapClient] [child:${pendingId}] setBreakpoints -> ${absolutePath} (${bps.length})`);
        await child.sendRequest('setBreakpoints', { source: { path: absolutePath }, breakpoints: bps });
      }
      } catch (e) {
        const emsg = getErrorMessage(e);
        logger.warn(`[MinimalDapClient] [child:${pendingId}] setBreakpoints failed: ${emsg}`);
      }

    // 5) configurationDone (guarded by capability observed on child's initialize)
    try {
      if ((child as unknown as MinimalDapClient).supportsConfigDone) {
        logger.info(`[MinimalDapClient] [child:${pendingId}] configurationDone`);
        await child.sendRequest('configurationDone', {});
      } else {
        logger.info(`[MinimalDapClient] [child:${pendingId}] skipping configurationDone (capability not advertised)`);
      }
      this.childConfigComplete = true;
      // Release any deferred parent configurationDone now that child is configured
      this.flushDeferredParentConfigDone();
    } catch {
      logger.warn('[MinimalDapClient] [child] configurationDone failed or not required; flushing parent deferral to avoid deadlock');
      this.flushDeferredParentConfigDone();
    }

    // 6) attach adoption using __pendingTargetId with retries
    {
      const type = (typeof configuration?.type === 'string') ? (configuration as { type: string }).type : 'pwa-node';
      let adopted = false;
      let lastErr: unknown;
      for (let i = 0; i < 20 && !adopted; i++) {
        try {
          logger.info(`[MinimalDapClient] [child:${pendingId}] attach adopt (__pendingTargetId) attempt ${i + 1}`);
          await child.sendRequest('attach', {
            type,
            request: 'attach',
            __pendingTargetId: pendingId,
            continueOnAttach: true
          }, 20000);
          adopted = true;
          break;
        } catch (e) {
          lastErr = e;
          await this.sleep(200);
        }
      }
      if (!adopted) {
        const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
        logger.warn(`[MinimalDapClient] [child:${pendingId}] attach adoption failed after retries: ${msg}`);
      }
    }

    // Post-attach: js-debug may emit another 'initialized'; re-send configs to finalize breakpoint registration
    try {
      let sawPostInit = false;
      await new Promise<void>((resolve) => {
        let done = false;
        const onEvt2 = (evt: DebugProtocol.Event) => {
          if (done) return;
          if (evt && evt.event === 'initialized') {
            sawPostInit = true;
            done = true;
            child.off('event', onEvt2);
            this.timers.clearTimeout(t2);
            resolve();
          }
        };
        const t2 = this.timers.setTimeout(() => {
          if (done) return;
          done = true;
          child.off('event', onEvt2);
          resolve();
        }, 3000);
        child.on('event', onEvt2);
      });
      if (sawPostInit) {
        try { await child.sendRequest('setExceptionBreakpoints', { filters: [] }); } catch {}
        try {
          for (const [srcPath, bps] of this.storedBreakpoints) {
            const absolutePath = path.isAbsolute(srcPath) ? srcPath : path.resolve(srcPath);
            await child.sendRequest('setBreakpoints', { source: { path: absolutePath }, breakpoints: bps });
          }
        } catch {}
        // Do NOT send configurationDone again after post-attach initialized; it can spuriously resume the target.
      }
    } catch {}

    // 7) Wait for stopped; fallback to threads+pause and retry wait
    try {
      await new Promise<void>((resolve) => {
        let done = false;
        const onEvt = (evt: DebugProtocol.Event) => {
          if (done) return;
          if (evt && evt.event === 'stopped') {
            done = true;
            child.off('event', onEvt);
            this.timers.clearTimeout(timer);
            resolve();
          }
        };
        const timer = this.timers.setTimeout(() => {
          if (done) return;
          done = true;
          child.off('event', onEvt);
          resolve(); // fallback path will try pause
        }, 15000);
        child.on('event', onEvt);
      });
    } catch {
      // ignore
    }

    this.childSessions.set(pendingId, child);
    this.activeChild = child;
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


    // Defer parent's configurationDone briefly to allow child session to configure,
    // avoiding immediate resume of the target before adoption completes.
    if (command === 'configurationDone' && this.deferParentConfigDoneActive) {
      if (this.suppressNextConfigDoneDeferral) {
        // Consume the suppression for a single pass-through
        this.suppressNextConfigDoneDeferral = false;
      } else {
        // Create a promise we will resolve once we actually send the deferred configDone
        return new Promise<T>((resolve, reject) => {
          // Clear any prior deferral
          if (this.parentConfigDoneDeferred) {
            this.timers.clearTimeout(this.parentConfigDoneDeferred.timer);
            this.parentConfigDoneDeferred = null;
          }
          const timer = this.timers.setTimeout(() => {
            // Time-bound deferral: if no child completed in time, send now
            this.suppressNextConfigDoneDeferral = true;
            void this.sendRequest<DebugProtocol.Response>('configurationDone', args)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .then(resolve as any)
              .catch(reject);
            this.parentConfigDoneDeferred = null;
          }, 1500);
          this.parentConfigDoneDeferred = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            resolve: resolve as any,
            reject,
            args,
            timer
          };
        });
      }
    }
    
    // Route debuggee-scoped requests to active child session when present using policy
    if (this.childSessionManager?.shouldRouteToChild(command)) {
      // If a child session is pending creation, wait briefly
      if (!this.activeChild && this.childSessionManager.hasActiveChildren()) {
        for (let i = 0; i < 120 && !this.activeChild; i++) {
          await this.sleep(100); // up to ~12s
          this.activeChild = this.childSessionManager.getActiveChild();
        }
      }
      
      if (this.activeChild) {
        return this.activeChild.sendRequest<T>(command, args as unknown, timeoutMs);
      } else {
        logger.warn(`[MinimalDapClient] No active child available for routed command '${command}'. Forwarding to parent session (may return empty/unsupported).`);
      }
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
          // Also keep local copy for legacy code compatibility
          this.storedBreakpoints.set(absolutePath, bps);
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
      args: args || {}
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
      const json = JSON.stringify(request);
      const contentLength = Buffer.byteLength(json, 'utf8');
      const message = `Content-Length: ${contentLength}${TWO_CRLF}${json}`;
      
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
    const json = JSON.stringify(message);
    const contentLength = Buffer.byteLength(json, 'utf8');
    const payload = `Content-Length: ${contentLength}${TWO_CRLF}${json}`;
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
    this.rawData = Buffer.alloc(0);
    this.contentLength = -1;
    
    // Remove all listeners to prevent memory leaks
    if (immediate) {
      this.removeAllListeners();
    } else {
      // Use setImmediate to allow any pending emit operations to complete
      setImmediate(() => {
        this.removeAllListeners();
      });
    }
  }
}
