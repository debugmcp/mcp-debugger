/**
 * DAP Client behavior configuration for adapter policies
 * This groups all DAP client-specific behaviors to keep the main interface clean
 */

import type { DebugProtocol } from '@vscode/debugprotocol';

/**
 * Result from handling a reverse request
 */
export interface ReverseRequestResult {
  handled: boolean;
  createChildSession?: boolean;
  childConfig?: ChildSessionConfig;
}

/**
 * Configuration for a child debug session
 */
export interface ChildSessionConfig {
  host: string;
  port: number;
  pendingId: string;
  parentConfig: Record<string, unknown>;
}

/**
 * Context provided to reverse request handlers
 */
export interface DapClientContext {
  sendResponse: (request: DebugProtocol.Request, body: unknown, success?: boolean, message?: string) => void;
  createChildSession: (config: ChildSessionConfig) => Promise<void>;
  activeChildren: Map<string, unknown>;
  adoptedTargets: Set<string>;
}

/**
 * DAP Client-specific behaviors that can be customized per adapter
 */
export interface DapClientBehavior {
  /**
   * Handle reverse requests from the debug adapter
   * @returns true if the request was handled, false to use default handling
   */
  handleReverseRequest?(
    request: DebugProtocol.Request, 
    context: DapClientContext
  ): Promise<ReverseRequestResult>;
  
  /**
   * Commands that should be routed to child sessions instead of parent
   */
  childRoutedCommands?: Set<string>;
  
  /**
   * Whether to mirror breakpoints from parent to child sessions
   */
  mirrorBreakpointsToChild?: boolean;
  
  /**
   * Whether to defer parent's configurationDone until child is configured
   */
  deferParentConfigDone?: boolean;
  
  /**
   * Whether to attempt pause after launching/attaching child
   */
  pauseAfterChildAttach?: boolean;
  
  /**
   * Normalize adapter ID for initialize request (e.g., 'javascript' -> 'pwa-node')
   */
  normalizeAdapterId?(requestedId: string): string;
  
  /**
   * Timeout in ms to wait for child session initialization
   */
  childInitTimeout?: number;
  
  /**
   * Whether to suppress configurationDone after child attach
   */
  suppressPostAttachConfigDone?: boolean;

  /**
   * Whether stackTrace requests are expected to run against a child session.
   * When true, callers should wait briefly for the active child to be ready
   * before issuing stackTrace to avoid empty results.
   */
  stackTraceRequiresChild?: boolean;
}
