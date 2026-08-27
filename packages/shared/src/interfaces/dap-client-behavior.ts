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
   * @returns A ReverseRequestResult indicating whether the request was handled
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

  /**
   * Child-routed commands that MUST reach the child session: forwarding them
   * to the parent is known-harmful. js-debug's root session answers 'pause'
   * with an empty success response and performs no CDP action, so a pause
   * that falls through to the parent "succeeds" yet can never produce a
   * 'stopped' event (issue #513). Commands listed here fail loudly when no
   * child session is available instead of falling back to the parent.
   */
  childRequiredCommands?: Set<string>;
}

/**
 * Marker present in every error thrown when a child-required command has no
 * child session to run against (issue #513). Shared between the proxy-side
 * thrower (minimal-dap) and the session-manager matcher so the tool layer can
 * turn it into a structured failure instead of a protocol error.
 */
export const NO_DEBUG_TARGET_MARKER = 'no debug target';

/**
 * Build the error message for a child-required command with no child session.
 * `state` distinguishes "never adopted" from "adopted but gone".
 */
export function buildNoDebugTargetError(command: string, state: 'none' | 'ended'): string {
  if (state === 'ended') {
    return (
      `Cannot deliver '${command}': the adopted debug target has ended or disconnected ` +
      `(${NO_DEBUG_TARGET_MARKER} available). Re-attach to continue debugging.`
    );
  }
  return (
    `Cannot deliver '${command}': ${NO_DEBUG_TARGET_MARKER} adopted yet — the runtime session ` +
    `is not available. Verify the attach connected (list_threads should report a thread) or retry shortly.`
  );
}
