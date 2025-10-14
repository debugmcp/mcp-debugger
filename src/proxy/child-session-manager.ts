/**
 * ChildSessionManager - Manages child debug sessions for multi-session adapters
 * 
 * This abstraction handles the complexity of child session creation and management,
 * particularly for JavaScript debugging with js-debug/pwa-node which uses multiple
 * concurrent sessions.
 */

import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy } from '@debugmcp/shared';
import type { DapClientBehavior, ChildSessionConfig } from '@debugmcp/shared';
import { createLogger } from '../utils/logger.js';
import type { MinimalDapClient } from './minimal-dap.js';
import path from 'path';

const logger = createLogger('child-session-manager');

export interface ChildSessionOptions {
  policy: AdapterPolicy;
  parentClient: MinimalDapClient;
  host: string;
  port: number;
}

export class ChildSessionManager extends EventEmitter {
  private policy: AdapterPolicy;
  private dapBehavior: DapClientBehavior;
  private parentClient: MinimalDapClient;
  private host: string;
  private port: number;
  
  // Child session tracking
  private adoptedTargets = new Set<string>();
  private childSessions = new Map<string, MinimalDapClient>();
  private activeChild: MinimalDapClient | null = null;
  
  // Breakpoint mirroring
  private storedBreakpoints = new Map<string, DebugProtocol.SourceBreakpoint[]>();
  
  // State tracking
  private adoptionInProgress = false;
  private childConfigComplete = false;

  constructor(options: ChildSessionOptions) {
    super();
    this.policy = options.policy;
    this.dapBehavior = options.policy.getDapClientBehavior();
    this.parentClient = options.parentClient;
    this.host = options.host;
    this.port = options.port;
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
    return this.adoptionInProgress;
  }

  /**
   * Check if there are any active child sessions
   */
  hasActiveChildren(): boolean {
    return this.activeChild !== null || this.childSessions.size > 0;
  }

  /**
   * Get the active child session
   */
  getActiveChild(): MinimalDapClient | null {
    return this.activeChild;
  }

  /**
   * Route a command to the appropriate child session if needed
   */
  shouldRouteToChild(command: string): boolean {
    if (!this.dapBehavior.childRoutedCommands) {
      return false;
    }
    return this.dapBehavior.childRoutedCommands.has(command);
  }

  /**
   * Store breakpoints for mirroring to child sessions
   */
  storeBreakpoints(sourcePath: string, breakpoints: DebugProtocol.SourceBreakpoint[]): void {
    if (!this.dapBehavior.mirrorBreakpointsToChild) {
      return;
    }
    
    const absolutePath = path.isAbsolute(sourcePath) ? sourcePath : path.resolve(sourcePath);
    this.storedBreakpoints.set(absolutePath, breakpoints);
    
    // Mirror to active child if present
    if (this.activeChild) {
      void this.activeChild.sendRequest('setBreakpoints', {
        source: { path: absolutePath },
        breakpoints
      }).catch(() => {
        // Ignore errors when mirroring
      });
    }
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
      logger.info('Ignoring child session request; adoption in progress or child active', {
        adoptionInProgress: this.adoptionInProgress,
        hasActiveChild: !!this.activeChild,
        childSessionCount: this.childSessions.size
      });
      return;
    }
    
    this.adoptionInProgress = true;
    this.adoptedTargets.add(pendingId);
    
    try {
      // Import MinimalDapClient dynamically to avoid circular dependency
      const { MinimalDapClient } = await import('./minimal-dap.js');
      
      // Create child client with policy for proper multi-session behavior
      const child = new MinimalDapClient(this.host, this.port, this.policy);
      await child.connect();
      
      // Wire up event forwarding
      this.wireChildEvents(child);
      
      // Store and activate child
      this.childSessions.set(pendingId, child);
      this.activeChild = child;
      
      // Initialize child session
      await this.initializeChild(child, pendingId, parentConfig);
      
      // Configure child session
      await this.configureChild(child, pendingId, parentConfig);
      
      // Attach to pending target
      await this.attachChild(child, pendingId, parentConfig);
      
      // Handle post-attach initialization if needed
      await this.handlePostAttachInit(child);
      
      // Ensure initial stop if policy requires it
      if (this.dapBehavior.pauseAfterChildAttach) {
        await this.ensureChildStopped(child);
      }
      
      this.adoptionInProgress = false;
      this.childConfigComplete = true;
      
      logger.info(`Child session created successfully for ${pendingId}`);
      this.emit('childCreated', pendingId, child);
      
    } catch (error) {
      this.adoptionInProgress = false;
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to create child session for ${pendingId}: ${msg}`);
      this.emit('childError', pendingId, error);
      throw error;
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
    
    // Set exception breakpoints
    try {
      logger.info(`[child:${pendingId}] setExceptionBreakpoints`);
      await child.sendRequest('setExceptionBreakpoints', { filters: [] });
    } catch {
      logger.warn(`[child:${pendingId}] setExceptionBreakpoints failed or not supported`);
    }
    
    // Mirror breakpoints if policy requires
    if (this.dapBehavior.mirrorBreakpointsToChild) {
      for (const [srcPath, bps] of this.storedBreakpoints) {
        logger.info(`[child:${pendingId}] setBreakpoints -> ${srcPath} (${bps.length})`);
        try {
          await child.sendRequest('setBreakpoints', {
            source: { path: srcPath },
            breakpoints: bps
          });
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
  private async attachChild(child: MinimalDapClient, pendingId: string, parentConfig: Record<string, unknown>): Promise<void> {
    const attachArgs = this.policy.buildChildStartArgs(pendingId, parentConfig);
    
    // Retry logic for attachment
    const maxRetries = 20;
    let adopted = false;
    let lastError: unknown;
    
    for (let i = 0; i < maxRetries && !adopted; i++) {
      try {
        logger.info(`[child:${pendingId}] ${attachArgs.command} attempt ${i + 1}`);
        await child.sendRequest(attachArgs.command, attachArgs.args, 20000);
        adopted = true;
        break;
      } catch (e) {
        lastError = e;
        await this.sleep(200);
      }
    }
    
    if (!adopted) {
      const msg = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(`Failed to attach child after ${maxRetries} attempts: ${msg}`);
    }
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
        await child.sendRequest('setExceptionBreakpoints', { filters: [] });
      } catch {}
      
      for (const [srcPath, bps] of this.storedBreakpoints) {
        try {
          await child.sendRequest('setBreakpoints', {
            source: { path: srcPath },
            breakpoints: bps
          });
        } catch {}
      }
    }
  }

  /**
   * Ensure child is stopped (for adapters that require it)
   */
  private async ensureChildStopped(child: MinimalDapClient): Promise<void> {
    // Wait for stopped event
    const stopped = await this.waitForEvent(child, 'stopped', 15000, false);
    
    if (!stopped) {
      // Try to pause the first thread
      try {
        const threadsResp = await child.sendRequest<DebugProtocol.ThreadsResponse>('threads', {}, 5000);
        const threads = (threadsResp as DebugProtocol.ThreadsResponse)?.body?.threads;
        
        if (Array.isArray(threads) && threads.length > 0) {
          const threadId = threads[0].id;
          logger.info(`[child] Pausing thread ${threadId}`);
          
          try {
            await child.sendRequest('pause', { threadId });
          } catch {
            // Ignore pause errors
          }
          
          // For js-debug quirk: also try threadId 1 if we got 0
          if (threadId === 0) {
            try {
              await child.sendRequest('pause', { threadId: 1 });
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
      // Forward child events through parent
      this.emit('childEvent', evt);
    });
    
    child.on('error', (err: Error) => {
      logger.error('[child] DAP client error:', err);
      this.emit('childError', null, err);
    });
    
    child.on('close', () => {
      logger.info('[child] DAP client connection closed');
      this.emit('childClosed');
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
      
      const onEvent = (evt: DebugProtocol.Event) => {
        if (done) return;
        if (evt && evt.event === eventName) {
          done = true;
          client.off('event', onEvent);
          clearTimeout(timer);
          resolve(true);
        }
      };
      
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        client.off('event', onEvent);
        if (required) {
          logger.warn(`Timeout waiting for '${eventName}' event`);
        }
        resolve(false);
      }, timeoutMs);
      
      client.on('event', onEvent);
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
    logger.info('Shutting down child sessions');
    
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
  }
}
