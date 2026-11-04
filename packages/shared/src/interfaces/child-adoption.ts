/**
 * The session-tree adoption contract (issue #1081): how an adapter that can
 * report a process its debuggee started hands that process to the server, so
 * the server can make it a child debug session of the reporting one.
 *
 * The Debug Adapter Protocol has one mechanism for this, the `startDebugging`
 * reverse request, sent only when the client's `initialize` advertised
 * `supportsStartDebuggingRequest`. Two of this server's engines implement it
 * (debugpy, js-debug); the rest keep `attach_to_process` as the route to a
 * child and leave the contract undefined. See docs/architecture/session-tree.md.
 */

/** One reported child, as the policy read it off the adapter's request. */
export interface ChildReport {
  /** The adapter's identity for the process: debugpy's `subProcessId`, js-debug's `__pendingTargetId`. */
  targetId: string;
  /** The adapter's own label for the process (`Subprocess <pid>`, `<script> [<pid>]`). */
  name: string;
  /** The configuration the adapter delivered with the report, verbatim. */
  configuration: Record<string, unknown>;
}

export interface ChildAdoptionContract {
  /**
   * Whether the worker's `initialize` sets `supportsStartDebuggingRequest: true`
   * on every connection it opens to this adapter, so a child arrives as a
   * request (which can be refused) rather than as an event.
   */
  advertiseStartDebugging: boolean;
  /**
   * What releases a reported child the server will not adopt: answering the
   * request `success: false` (debugpy unblocks the child itself), or a
   * throwaway attach-then-detach (js-debug parks a refused child forever).
   */
  releaseLever: 'reject-request' | 'throwaway-attach';
  /**
   * Where a child's own output lands: on its own connection (debugpy with
   * `redirectOutput`), or only on the launch session's (js-debug).
   */
  childOutput: 'own-connection' | 'launch-session';
  /**
   * What an explicit `close_debug_session` on the child does to its process:
   * debugpy terminates it; js-debug can only release it to run undebugged.
   */
  closeChild: 'terminate' | 'release';
  /** The `attach` arguments for the child's own connection, built from the report. */
  buildChildAttachArguments(report: ChildReport): Record<string, unknown>;
}
