/**
 * Adapter Policy contracts for adapter-specific DAP behaviors
 *
 * The goal is to keep the DAP transport core generic while exposing
 * adapter-specific quirks and multi-session strategies via a typed policy.
 *
 * Consumers (e.g., proxy/minimal-dap) consult this policy to decide:
 * - whether reverse startDebugging is supported
 * - how to start a child session (launch/attach) when a __pendingTargetId is provided
 * - whether to defer parent configurationDone temporarily
 * - when a child session is considered "ready" (e.g., after 'initialized', or when a 'thread'/'stopped' event is seen)
 *
 * @since 2.1.0
 */
import type { DebugProtocol } from '@vscode/debugprotocol';

export type ChildSessionStrategy =
  | 'none'                     // No child session expected/created
  | 'launchWithPendingTarget'  // Launch child using __pendingTargetId (js-debug typical)
  | 'attachByPort'             // Attach child by known inspector port
  | 'adoptInParent';           // Adopt pending target in the same parent session

export interface AdapterPolicy {
  /**
   * Identifying name for diagnostics (e.g., 'default', 'js-debug')
   */
  name: string;

  /**
   * Whether the adapter uses reverse startDebugging (adapter asks client to start a child session)
   */
  supportsReverseStartDebugging: boolean;

  /**
   * Strategy for how to create/attach to the child session when reverse startDebugging occurs
   */
  childSessionStrategy: ChildSessionStrategy;

  /**
   * Whether to defer sending configurationDone in the parent session temporarily
   * to ensure the child session is fully configured before the target resumes.
   * This should return true only for adapters that require it (e.g., js-debug).
   */
  shouldDeferParentConfigDone(parentConfig: Record<string, unknown>): boolean;

  /**
   * Build the child start request (launch or attach) for a given pending target ID.
   * This should include just the necessary args; consumers may sanitize/augment further.
   */
  buildChildStartArgs(
    pendingId: string,
    parentConfig: Record<string, unknown>
  ): { command: 'launch' | 'attach'; args: Record<string, unknown> };

  /**
   * Decide whether an incoming DAP event indicates the child session is ready
   * to surface queries like 'threads'. Defaults to 'initialized' for many adapters.
   * Some adapters (e.g., js-debug) may prefer to wait for 'thread' or 'stopped'.
   */
  isChildReadyEvent(evt: DebugProtocol.Event): boolean;
}

/**
 * Default policy: no reverse startDebugging and no child sessions.
 * Parent configurationDone is never deferred.
 */
export const DefaultAdapterPolicy: AdapterPolicy = {
  name: 'default',
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  shouldDeferParentConfigDone: () => false,
  buildChildStartArgs: (pendingId: string) => {
    // Default policy should not be asked to build child start args.
    // Throwing here helps catch accidental misuse.
    throw new Error(
      `DefaultAdapterPolicy does not support child sessions. PendingId=${pendingId}`
    );
  },
  isChildReadyEvent: (evt: DebugProtocol.Event): boolean => {
    // For most adapters, 'initialized' is the earliest readiness signal.
    return evt?.event === 'initialized';
  }
};
