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
import { AdapterPolicy, DefaultAdapterPolicy, JsDebugAdapterPolicy } from '@debugmcp/shared';

const logger = createLogger('minimal-dap-simple');

const TWO_CRLF = '\r\n\r\n';

const CHILD_ROUTED_COMMANDS = new Set<string>([
  'threads',
  'pause',
  'continue',
  'next',
  'stepIn',
  'stepOut',
  'stackTrace',
  'scopes',
  'variables',
  'evaluate',
  'loadedSources',
  'source',
  'setVariable',
  'setExpression',
  'restart',
  'disconnect',
  'terminate',
  'goto',
  'restartFrame',
  'stepBack',
  'reverseContinue'
]);

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
  private lastInspectorPort?: number;
  private lastPendingTargetId?: string;
  private lastPendingType?: string;
  private initializedSeen = false;
  private configDoneSent = false;

  // Adapter policy (selected per reverse startDebugging request)
  private activePolicy?: AdapterPolicy;
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

  // JS attach/launch mode tracking and guards
  private parentStartMode: 'attach' | 'launch' | null = null;
  private parentPortAttachPerformed = false;
  private adoptionStarted = false;
  private supportsConfigDone = true;

  constructor(host: string, port: number) {
    super();
    this.host = host;
    this.port = port;
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
      
      for (const line of lines) {
        const match = line.match(/Content-Length: (\d+)/i);
        if (match) {
          this.contentLength = parseInt(match[1], 10);
        }
      }
      
      // Remove header from buffer
      this.rawData = this.rawData.slice(idx + TWO_CRLF.length);
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
    
    logger.debug(`[MinimalDapClient] Received message:`, debugInfo);
    
    if (message.type === 'response') {
      const response = message as DebugProtocol.Response;
      const pending = this.pendingRequests.get(response.request_seq);
      
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(response.request_seq);
        
        if (response.success) {
          // Track configurationDone acknowledgement
          if (response.command === 'configurationDone') {
            this.configDoneSent = true;
          }
          // Cache capabilities from initialize response
          if (response.command === 'initialize') {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const caps: any = (response as any)?.body?.capabilities ?? (response as any)?.body;
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
      try {
        switch (request.command) {
          case 'runInTerminal':
            // Acknowledge without spawning a terminal (internalConsole launch path).
            this.sendResponse(request, {});
            break;
          case 'startDebugging': {
            // Multi-session pattern: spawn a child DAP session and attach via launch(__pendingTargetId)
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const args: any = (request as any)?.arguments ?? {};
              const cfg = args?.configuration ?? {};
              const pendingId: string | undefined = cfg?.__pendingTargetId;
              this.sendResponse(request, {});
              if (pendingId && typeof pendingId === 'string') {
                // mark adoption started to suppress late parent attaches
                this.adoptionStarted = true;
                this.lastPendingTargetId = pendingId;

                // If we're already adopting or have an active child, ignore additional startDebugging requests
                if (this.adoptionInProgress || this.activeChild || this.childSessions.size > 0) {
                  logger.info('[MinimalDapClient] Ignoring startDebugging; adoption in progress or child active');
                  return;
                }
                // Mark adoption in progress immediately to avoid races when js-debug sends multiple requests
                this.adoptionInProgress = true;

                // Choose policy by adapter type
                const adapterType: string | undefined = typeof cfg?.type === 'string' ? (cfg.type as string) : undefined;
                const policy: AdapterPolicy = adapterType === 'pwa-node' ? JsDebugAdapterPolicy : DefaultAdapterPolicy;
                this.activePolicy = policy;
                this.deferParentConfigDoneActive = !!policy.shouldDeferParentConfigDone(cfg as Record<string, unknown>);
                // De-duplicate per pending target id
                if (!this.adoptedTargets.has(pendingId)) {
                  this.adoptedTargets.add(pendingId);
                  void this.createChildSession(pendingId, cfg, policy)
                    .then(() => {
                      // keep adoptionInProgress false after child established
                      this.adoptionInProgress = false;
                    })
                    .catch((err) => {
                      const msg = err instanceof Error ? err.message : String(err);
                      logger.error(`[MinimalDapClient] createChildSession failed for ${pendingId}: ${msg}`);
                      this.adoptionInProgress = false;
                    });
                }
              }
            } catch {
              // Best-effort ack even if we couldn't parse args
              this.sendResponse(request, {});
            }
            break;
          }
          default:
            // For unrecognized adapter requests, reply success with empty body to avoid deadlocks.
            this.sendResponse(request, {});
            break;
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error(`[MinimalDapClient] Error handling adapter request '${request.command}': ${err}`);
        // Best-effort ack to unblock the adapter even on error.
        // For startDebugging, prefer explicit failure even on error.
        if (request.command === 'startDebugging') {
          this.sendResponse(request, {}, false, 'startDebugging not supported by MCP DAP client');
        } else {
          this.sendResponse(request, {});
        }
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
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        this.removeListener('initialized', onInit);
        resolve();
      }, timeoutMs);
      this.on('initialized', () => {
        clearTimeout(timer);
        onInit();
      });
    });
  }

  // Inspector port management to avoid EADDRINUSE during tests or concurrent runs
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => {
        resolve(false);
      });
      srv.once('listening', () => {
        srv.close(() => resolve(true));
      });
      srv.listen(port, this.host);
    });
  }

  private async findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.once('error', (e) => reject(e));
      srv.listen(0, this.host, () => {
        const address = srv.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        srv.close(() => resolve(port));
      });
    });
  }

  // Normalize launch args to a unique free inspector port to avoid EADDRINUSE races
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async adjustInspectorPortIfBusy(args: any): Promise<any> {
    if (!args || typeof args !== 'object') return args;
    const ra: unknown = Array.isArray(args.runtimeArgs) ? [...args.runtimeArgs] : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let runtimeArgs: any[] | null = (ra as any[]) ?? null;

    // If caller provided explicit inspector wiring, honor it (don't remap)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasAttachSimplePort = Object.prototype.hasOwnProperty.call(args as any, 'attachSimplePort');
    const hasExplicitInspect =
      Array.isArray(runtimeArgs) &&
      runtimeArgs.some((entry) => typeof entry === 'string' && /^--inspect(?:-brk)?(?:=\d+)?$/.test(entry as string));

    // If caller provided explicit inspector wiring, honor it unless the chosen port is busy.
    if (hasAttachSimplePort || hasExplicitInspect) {
      // Parse current port (attachSimplePort takes precedence)
      let currentPort: number | undefined = undefined;
      if (hasAttachSimplePort) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = Number((args as any).attachSimplePort);
        if (!Number.isNaN(p) && p > 0) currentPort = p;
      }
      if (currentPort == null && Array.isArray(runtimeArgs)) {
        for (const entry of runtimeArgs) {
          if (typeof entry === 'string') {
            const m = entry.match(/^--inspect(?:-brk)?=(\d+)$/);
            if (m) {
              const p = Number(m[1]);
              if (!Number.isNaN(p) && p > 0) {
                currentPort = p;
                break;
              }
            }
          }
        }
      }

      // Always remap to a fresh free port to avoid time-of-check/use EADDRINUSE races on CI
      const newPort = await this.findFreePort();
      this.lastInspectorPort = newPort;

      // Update runtimeArgs entry if present; otherwise append
      let updated = false;
      if (Array.isArray(runtimeArgs)) {
        for (let i = 0; i < runtimeArgs.length; i++) {
          const entry = runtimeArgs[i];
          if (typeof entry === 'string') {
            const match = entry.match(/^--inspect(-brk)?(?:=(\d+))?$/);
            if (match) {
              const isBrk = match[1] === '-brk';
              runtimeArgs[i] = `${isBrk ? '--inspect-brk' : '--inspect'}=${newPort}`;
              updated = true;
              break;
            }
            if (/^--inspect(?:-brk)?=/.test(entry)) {
              const isBrk = entry.startsWith('--inspect-brk=');
              runtimeArgs[i] = `${isBrk ? '--inspect-brk' : '--inspect'}=${newPort}`;
              updated = true;
              break;
            }
          }
        }
      }
      if (!updated) {
        runtimeArgs = Array.isArray(runtimeArgs) ? runtimeArgs : [];
        runtimeArgs.push(`--inspect-brk=${newPort}`);
      }

      // Reflect updates
      args.runtimeArgs = runtimeArgs;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (args as any).attachSimplePort = newPort;
      logger.info(`[MinimalDapClient] Remapped inspector port ${typeof currentPort === 'number' ? currentPort : 'unknown'} -> ${newPort} to avoid conflicts`);
      return args;
    }

    // Always assign a unique free port when using Node inspector to avoid time-of-check/use races
    const newPort = await this.findFreePort();
    this.lastInspectorPort = newPort;

    // Detect existing inspect flag (with or without explicit port)
    let foundInspect = false;
    if (runtimeArgs) {
      for (let i = 0; i < runtimeArgs.length; i++) {
        const entry = runtimeArgs[i];
        if (typeof entry === 'string') {
          const m = entry.match(/^--inspect(-brk)?(?:=(\d+))?$/);
          if (m) {
            const isBrk = m[1] === '-brk';
            runtimeArgs[i] = `${isBrk ? '--inspect-brk' : '--inspect'}=${newPort}`;
            foundInspect = true;
            break;
          }
          // Also handle explicit forms with equals (already covered above), but keep fallback
          if (/^--inspect(?:-brk)?=/.test(entry)) {
            const isBrk = entry.startsWith('--inspect-brk=');
            runtimeArgs[i] = `${isBrk ? '--inspect-brk' : '--inspect'}=${newPort}`;
            foundInspect = true;
            break;
          }
        }
      }
    }

    // If no runtimeArgs or no inspect flag present, ensure we add one
    if (!runtimeArgs) {
      runtimeArgs = [`--inspect-brk=${newPort}`];
    } else if (!foundInspect) {
      runtimeArgs.push(`--inspect-brk=${newPort}`);
    }

    // Reflect updates
    args.runtimeArgs = runtimeArgs;
    args.attachSimplePort = newPort;
    logger.info(`[MinimalDapClient] Using unique inspector port ${newPort} to avoid conflicts`);
    return args;
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

  private async waitForFirstThreadId(maxAttempts = 240, intervalMs = 100): Promise<number | undefined> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const resp = await this.sendRequest<DebugProtocol.ThreadsResponse>('threads', {} as unknown, 5000);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const threads = (resp as any)?.body?.threads;
        const firstId = Array.isArray(threads) && threads.length ? threads[0]?.id : undefined;
        if (typeof firstId === 'number') {
          return firstId;
        }
      } catch {
        // ignore and retry
      }
      await this.sleep(intervalMs);
    }
    return undefined;
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

  private async tryAdoptInParent(pendingId: string, type: string = 'pwa-node'): Promise<boolean> {
    // Attempt to attach the pending target directly in this (parent) session.
    // This avoids spawning a second DAP session and matches js-debug's adoption flow when supported.

    let attached = false;
    let lastErr: unknown = undefined;

    for (let i = 0; i < 8; i++) {
      try {
        logger.info(`[MinimalDapClient] [parent] attach by __pendingTargetId attempt ${i + 1}`);
        await this.sendRequest('attach', { type, request: 'attach', __pendingTargetId: pendingId, continueOnAttach: false }, 5000);
        attached = true;
        break;
      } catch (e1) {
        lastErr = e1;
        const emsg = e1 instanceof Error ? e1.message : String(e1);
        logger.warn(`[MinimalDapClient] [parent] attach by __pendingTargetId failed: ${emsg}`);

        if (this.lastInspectorPort) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const altArgs: any = {
              type,
              request: 'attach',
              // Provide both for maximum compatibility with js-debug
              port: this.lastInspectorPort,
              attachSimplePort: this.lastInspectorPort,
              // IPv4/IPv6 loopback
              address: 'localhost',
              continueOnAttach: false,
              attachExistingChildren: true
            };
            logger.info(`[MinimalDapClient] [parent] attach by port=${this.lastInspectorPort} attempt ${i + 1}`);
            await this.sendRequest('attach', altArgs, 4000);
            attached = true;
            break;
          } catch (e2) {
            lastErr = e2;
            const emsg2 = e2 instanceof Error ? e2.message : String(e2);
            logger.warn(`[MinimalDapClient] [parent] attach by port=${this.lastInspectorPort} failed: ${emsg2}`);
          }
        }
      }
      await this.sleep(250);
    }

    if (attached) {
      // Route subsequent debuggee-scoped requests to this (parent) session
      this.activeChild = null;

      // Ensure configurationDone after adoption to finalize configuration in this session
      try {
        await this.sendRequest('configurationDone', {});
      } catch {
        // ignore
      }

      // Best-effort to trigger a stopped by pausing the first available thread
      try {
        const tid = await this.waitForFirstThreadId();
        if (typeof tid === 'number') {
          await this.sendRequest('pause', { threadId: tid });
        }
      } catch {
        // ignore
      }

      logger.info('[MinimalDapClient] [parent] pending target adopted successfully in parent session');
      return true;
    }

    logger.warn(`[MinimalDapClient] [parent] adoption failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
    return false;
  }

  private async createChildSession(pendingId: string, configuration: Record<string, unknown>, _policy: AdapterPolicy): Promise<void> {
    void _policy;
    // Mark adoption begun (idempotent)
    this.adoptionStarted = true;

    if (this.childSessions.has(pendingId)) {
      this.activeChild = this.childSessions.get(pendingId)!;
      return;
    }

    const child = new MinimalDapClient(this.host, this.port);
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
          clearTimeout(timer);
          resolve();
        }
      };
      const timer = setTimeout(() => {
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
      const emsg = e instanceof Error ? e.message : String(e);
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
            continueOnAttach: false
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
            clearTimeout(t2);
            resolve();
          }
        };
        const t2 = setTimeout(() => {
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
    let sawStopped = false;


    try {
      await new Promise<void>((resolve) => {
        let done = false;
        const onEvt = (evt: DebugProtocol.Event) => {
          if (done) return;
          if (evt && evt.event === 'stopped') {
            done = true;
            sawStopped = true;
            child.off('event', onEvt);
            clearTimeout(timer);
            resolve();
          }
        };
        const timer = setTimeout(() => {
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

    if (!sawStopped) {
      // Fallback: poll threads and pause the first one (accept threadId===0)
      try {
        let threadId: number | undefined;
        for (let i = 0; i < 240; i++) {
        const resp = await child.sendRequest<DebugProtocol.ThreadsResponse>('threads', {} as unknown, 5000);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const threads = (resp as any)?.body?.threads;
        const firstId = Array.isArray(threads) && threads.length ? threads[0]?.id : undefined;
        if (typeof firstId === 'number') {
          threadId = firstId;
          break;
        }
          await this.sleep(100);
        }
        if (typeof threadId === 'number') {
          logger.info(`[MinimalDapClient] [child:${pendingId}] pause fallback on threadId=${threadId}`);
          try {
            await child.sendRequest('pause', { threadId });
          } catch {
            // ignore pause errors
          }

          // If js-debug reports threadId=0, also try pausing threadId=1 (some builds prefer 1)
          if (threadId === 0) {
            try {
              logger.info(`[MinimalDapClient] [child:${pendingId}] additional pause attempt on threadId=1 (id=0 fallback)`);
              await child.sendRequest('pause', { threadId: 1 });
            } catch {
              // ignore
            }
          }

          // wait again for stopped briefly
          await new Promise<void>((resolve) => {
            let done = false;
            const onEvt = (evt: DebugProtocol.Event) => {
              if (done) return;
              if (evt && evt.event === 'stopped') {
                done = true;
                child.off('event', onEvt);
                clearTimeout(timer2);
                resolve();
              }
            };
            const timer2 = setTimeout(() => {
              if (done) return;
              done = true;
              child.off('event', onEvt);
              resolve();
            }, 12000);
            child.on('event', onEvt);
          });

          // If still not stopped, iterate available thread ids and try pausing each (best-effort)
          if (!sawStopped) {
            try {
              const resp2 = await child.sendRequest<DebugProtocol.ThreadsResponse>('threads', {} as unknown, 3000);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const threads2 = (resp2 as any)?.body?.threads ?? [];
              const ids: number[] = [];
              for (const t of threads2) {
                const id = t?.id;
                if (typeof id === 'number' && !ids.includes(id)) ids.push(id);
              }
              for (const id of ids) {
                try {
                  logger.info(`[MinimalDapClient] [child:${pendingId}] secondary pause attempt on threadId=${id}`);
                  await child.sendRequest('pause', { threadId: id });
                } catch {
                  // ignore per-thread pause errors
                }
              }
            } catch {
              // ignore threads probe errors
            }
          }
        } else {
          logger.warn(`[MinimalDapClient] [child:${pendingId}] No threads discovered within timeout for pause fallback`);
        }
      } catch (e) {
        const emsg = e instanceof Error ? e.message : String(e);
        logger.warn(`[MinimalDapClient] [child:${pendingId}] threads/pause fallback failed: ${emsg}`);
      }
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

    // Mode-aware guard for parent attach by inspector port to avoid js-debug DI ambiguity
    if (command === 'attach') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a: any = args;
        const hasPending = !!(a && typeof a.__pendingTargetId === 'string');
        const hasPortAttach = !!(a && (typeof a.port === 'number' || typeof a.attachSimplePort === 'number'));

        if (hasPending) {
          // Always allow adoption attach using __pendingTargetId
        } else if (hasPortAttach) {
          // Infer attach mode if first start mode not yet set
          if (this.parentStartMode == null) {
            this.parentStartMode = 'attach';
          }
          const allowOncePreAdoption =
            this.parentStartMode === 'attach' &&
            !this.parentPortAttachPerformed &&
            !this.adoptionStarted;

          if (allowOncePreAdoption) {
            this.parentPortAttachPerformed = true;
            logger.info('[MinimalDapClient] Allowing single parent attach-by-port (attach mode, pre-adoption).');
          } else {
            logger.info('[MinimalDapClient] Suppressing parent attach-by-port to avoid js-debug DI ambiguity.');
            // Fabricate a local success response to satisfy upstream correlation without sending to adapter
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return Promise.resolve({ type: 'response', seq: 0, request_seq: 0, command: 'attach', success: true, body: {} } as any as T);
          }
        }
      } catch {
        // ignore guard errors, fall through to normal path if parsing fails
      }
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
            clearTimeout(this.parentConfigDoneDeferred.timer);
            this.parentConfigDoneDeferred = null;
          }
          const timer = setTimeout(() => {
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
    
    // Route debuggee-scoped requests to active child session when present.
    // If a child session is being created asynchronously, wait briefly.
    if (CHILD_ROUTED_COMMANDS.has(command)) {
      // If a child session is pending creation (adoptedTargets > childSessions) or not yet selected, wait longer.
      if (!this.activeChild) {
        const shouldWait = this.childSessions.size > 0;
        if (shouldWait) {
          for (let i = 0; i < 120 && !this.activeChild; i++) {
            await this.sleep(100); // up to ~12s
          }
          // If a child exists but not marked active yet, pick the most recently created
          if (!this.activeChild && this.childSessions.size > 0) {
            const lastChild = Array.from(this.childSessions.values()).pop() || null;
            if (lastChild) this.activeChild = lastChild;
          }
        }
      }
      if (this.activeChild) {
        return this.activeChild.sendRequest<T>(command, args as unknown, timeoutMs);
      } else {
        logger.warn(`[MinimalDapClient] No active child available for routed command '${command}'. Forwarding to parent session (may return empty/unsupported).`);
      }
    }
    
    // Track and mirror setBreakpoints to child if/when present
    if (command === 'setBreakpoints') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a: any = args ?? {};
        const sp: string | undefined = a?.source?.path;
        const bps: DebugProtocol.SourceBreakpoint[] | undefined = a?.breakpoints;
        if (typeof sp === 'string' && Array.isArray(bps)) {
          const absolutePath = path.isAbsolute(sp) ? sp : path.resolve(sp);
          this.storedBreakpoints.set(absolutePath, bps);
          if (this.activeChild) {
            void this.activeChild.sendRequest('setBreakpoints', { source: { path: absolutePath }, breakpoints: bps }).catch(() => {});
          }
        }
      } catch {
        // ignore tracking errors
      }
    }
    
    // Ensure requested inspector port is available; if not, remap to a free one
    if (command === 'launch') {
      try {
        // For child sessions launched via __pendingTargetId, do NOT mutate runtimeArgs/ports.
        // Only adjust inspector ports for primary parent launches.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a: any = args;
        const hasPending = a && typeof a.__pendingTargetId === 'string';
        if (!hasPending) {
          if (this.parentStartMode == null) {
            this.parentStartMode = 'launch';
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          args = await this.adjustInspectorPortIfBusy(a as any);
        }
      } catch (e) {
        const emsg = e instanceof Error ? e.message : String(e);
        logger.warn(`[MinimalDapClient] adjustInspectorPortIfBusy failed: ${emsg}`);
      }
    }

    const requestSeq = this.nextSeq++;
    
    // Normalize initialize args for js-debug: adapterID should be 'pwa-node' (tests send 'javascript')
    if (command === 'initialize') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a: any = args && typeof args === 'object' ? { ...(args as Record<string, unknown>) } : {};
        if (typeof a.adapterID === 'string' && a.adapterID.toLowerCase() === 'javascript') {
          a.adapterID = 'pwa-node';
          args = a;
          logger.info('[MinimalDapClient] Normalized initialize.adapterID -> pwa-node for js-debug');
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

    // For single-session js-debug launches (no __pendingTargetId), attempt to ensure an early stop:
    // after launch, poll threads and issue a pause as a fallback to surface a 'stopped' event.
    const willAutoPauseAfterLaunch =
      command === 'launch' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !((args as any) && typeof (args as any).__pendingTargetId === 'string') &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof (args as any)?.type === 'string' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (args as any).type === 'pwa-node';
    
    logger.info(`[MinimalDapClient] Sending request:`, {
      command,
      seq: requestSeq,
      args: args || {}
    });
    
    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timer = setTimeout(() => {
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
      try {
        if (command === 'launch') {
          const a = args as Record<string, unknown> | undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const portCandidate = Number((a as any)?.attachSimplePort);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const type = typeof (a as any)?.type === 'string' ? ((a as any).type as string) : 'pwa-node';
          if (Number.isFinite(portCandidate) && portCandidate > 0) {
            this.lastInspectorPort = portCandidate;
            // Record mode if unset
            if (this.parentStartMode == null) {
              this.parentStartMode = 'launch';
            }
            // Only perform a parent attach-by-port automatically in ATTACH-driven flows.
            // For LAUNCH flows, js-debug will manage the session; avoid DI ambiguity.
            if (this.parentStartMode === 'attach' && !this.adoptionStarted && !this.parentPortAttachPerformed) {
              setTimeout(() => {
                try {
                  if (this.adoptionStarted || this.parentPortAttachPerformed) {
                    return;
                  }
                  this.parentPortAttachPerformed = true;
                  const attachArgs = {
                    type,
                    request: 'attach',
                    address: 'localhost',
                    port: portCandidate,
                    attachExistingChildren: true,
                    continueOnAttach: false,
                    attachSimplePort: portCandidate
                  };
                  logger.info(`[MinimalDapClient] Performing single parent attach-by-port type='${String(type)}' port=${portCandidate} to initiate child adoption`);
                  void this.sendRequest('attach', attachArgs).catch((err) => {
                    const emsg = err instanceof Error ? err.message : String(err);
                    logger.warn(`[MinimalDapClient] Post-launch parent attach failed: ${emsg}`);
                  });
                } catch (e) {
                  const emsg = e instanceof Error ? e.message : String(e);
                  logger.warn(`[MinimalDapClient] Error scheduling parent attach: ${emsg}`);
                }
              }, 200);
            } else {
              logger.info('[MinimalDapClient] Skipping parent attach in LAUNCH flow or because adoption already started / attach already performed');
            }
          }
        }
      } catch {
        // ignore post-launch attach scheduling errors
      }
      this.appendTrace('out', request);
      const json = JSON.stringify(request);
      const contentLength = Buffer.byteLength(json, 'utf8');
      const message = `Content-Length: ${contentLength}${TWO_CRLF}${json}`;
      
      // Socket was already checked above, but TypeScript needs reassurance
      if (!this.socket) {
        clearTimeout(timer);
        this.pendingRequests.delete(requestSeq);
        reject(new Error('Socket unexpectedly null'));
        return;
      }
      
      this.socket.write(message, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pendingRequests.delete(requestSeq);
          reject(err);
        } else if (willAutoPauseAfterLaunch) {
          // Try to surface a 'stopped' event quickly:
          // 1) Listen for a 'thread' event and pause that thread immediately
          // 2) Fallback: poll threads and pause the first available
          const onEvt = (evt: DebugProtocol.Event) => {
            try {
              if (evt.event === 'thread') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tid = (evt.body as any)?.threadId;
                if (typeof tid === 'number') {
                  this.off('event', onEvt);
                  // First try pausing the reported thread
                  void this.sendRequest('pause', { threadId: tid }).catch(() => {});
                  // If js-debug reports threadId=0, also try pausing threadId=1 as a fallback
                  if (tid === 0) {
                    setTimeout(() => {
                      void this.sendRequest('pause', { threadId: 1 }).catch(() => {});
                    }, 50);
                  }
                }
              }
            } catch {
              // ignore
            }
          };
          this.on('event', onEvt);
          // Remove the event listener after a safety window
          const evtTimer = setTimeout(() => {
            try {
              this.off('event', onEvt);
            } catch {
              // ignore
            }
          }, 12000);

          // Fallback poll in parallel after a short delay
          setTimeout(() => {
            void (async () => {
              try {
                const tid = await this.waitForFirstThreadId(120, 100);
                if (typeof tid === 'number') {
                  clearTimeout(evtTimer);
                  try {
                    this.off('event', onEvt);
                  } catch {
                    // ignore
                  }
                  await this.sendRequest('pause', { threadId: tid });
                }
              } catch {
                // ignore
              }
            })();
          }, 300);
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
        child.shutdown('parent shutdown');
      }
      this.childSessions.clear();
      this.activeChild = null;
    } catch (e) {
      logger.warn('[MinimalDapClient] Error shutting down child sessions', e as Error);
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
      clearTimeout(pending.timer);
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
